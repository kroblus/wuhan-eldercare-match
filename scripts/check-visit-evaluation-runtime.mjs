import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  VISIT_EVALUATION_TEST_FIXTURE_POLICY,
  createVisitEvaluationContextFixture,
  createVisitEvaluationTestOnlyProviders,
} from './fixtures/visit-evaluation-test-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.ts')
const viewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation-view-model.ts')
const applicationPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'visit-evaluation-application.ts')
const productionContextProviderPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'visit-evaluation-production-context.ts')
const writeContentPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'visit-evaluation-write-content.ts')
const productionPaths = [pagePath, viewModelPath, applicationPath, productionContextProviderPath, writeContentPath]
const failures = []
const cases = []

const clone = (value) => JSON.parse(JSON.stringify(value))

const makeValidDraft = (viewModel) => {
  const draft = viewModel.createEmptyVisitEvaluationDraft()
  draft.overallRating = 5
  draft.consideration = 'willing'
  return draft
}

const runCase = async (name, callback) => {
  cases.push(name)
  try {
    await callback()
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const makeApplication = (runtime, providers) => {
  const applicationModule = runtime.load(applicationPath)
  return applicationModule.createVisitEvaluationUiApplicationV1(providers)
}

const makePage = (pageConfig, application) => {
  const page = {
    ...pageConfig,
    data: clone(pageConfig.data),
    setData(patch) {
      Object.assign(this.data, patch)
    },
  }
  if (application) page._visitEvaluationApplication = application
  return page
}

const run = async () => {
  assert.equal(VISIT_EVALUATION_TEST_FIXTURE_POLICY,
    'TEST_ONLY_SYNTHETIC_VISIT_EVALUATION_CONTEXT_AND_SUBMIT_PROVIDER')
  const { ts } = loadWechatTypeScript()
  let pageConfig = null
  const runtime = createWechatTsRuntime(ts, {
    Page: (config) => { pageConfig = config },
    wx: { showToast() {} },
  })
  const viewModel = runtime.load(viewModelPath)
  const writeContent = runtime.load(writeContentPath)
  const productionContextModule = runtime.load(productionContextProviderPath)
  runtime.load(applicationPath)
  runtime.load(pagePath)
  assert.ok(pageConfig)

  await runCase('FRONTEND_CONTEXT_TYPES_CHECK_WITH_WECHAT_DECLARATIONS', async () => {
    const configPath = path.join(repositoryRoot, 'tsconfig.json')
    const configResult = ts.readConfigFile(configPath, (fileName) => readFileSync(fileName, 'utf8'))
    assert.equal(configResult.error, undefined)
    const parsedConfig = ts.parseJsonConfigFileContent(configResult.config, ts.sys, repositoryRoot, undefined, configPath)
    const program = ts.createProgram([
      pagePath,
      viewModelPath,
      applicationPath,
      productionContextProviderPath,
      writeContentPath,
      path.join(repositoryRoot, 'typings', 'index.d.ts'),
    ], parsedConfig.options)
    const errors = ts.getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    const format = (diagnostic) => {
      if (!diagnostic.file || diagnostic.start === undefined) return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
    }
    assert.equal(errors.length, 0, errors.map(format).join('\n'))
  })

  await runCase('INITIAL_DRAFT_IS_EMPTY_AND_HAS_ALL_PRODUCT_RATINGS', async () => {
    const draft = viewModel.createEmptyVisitEvaluationDraft()
    const ratingView = viewModel.createVisitEvaluationRatingViewModel(draft)
    assert.equal(ratingView.overallOptions.length, 5)
    assert.equal(ratingView.sections.reduce((sum, section) => sum + section.items.length, 0), 21)
    assert.equal(Object.values(draft.ratings).every((value) => value === null), true)
    const issues = viewModel.validateVisitEvaluationDraft(draft)
    assert.deepEqual(clone(issues.map((issue) => issue.path).sort()), ['consideration', 'overallRating'])
    assert.equal(viewModel.createVisitEvaluationFeeTopicViewModel(draft).length, 7)
  })

  await runCase('CONTRACT_REQUIRED_FIELDS_AND_MINIMAL_OPTIONAL_SUBMISSION', async () => {
    const draft = viewModel.createEmptyVisitEvaluationDraft()
    draft.overallRating = 4
    assert.equal(viewModel.validateVisitEvaluationDraft(draft).some((issue) => issue.path === 'consideration'), true)
    draft.consideration = 'compare'
    assert.deepEqual(clone(viewModel.validateVisitEvaluationDraft(draft)), [])
    const mapped = writeContent.mapVisitEvaluationDraftToWriteContentV1(draft)
    assert.equal(mapped.kind, 'valid')
    assert.deepEqual(clone(mapped.content), { overallRating: 4, consideration: 'compare' })
    assert.equal('ratings' in mapped.content, false)
    assert.equal('feeTopicExplanations' in mapped.content, false)
    assert.equal('careProcessObservations' in mapped.content, false)
  })

  await runCase('CONTRACT_VALIDATION_REJECTS_INVALID_RATINGS_AND_CONSIDERATION', async () => {
    const draft = makeValidDraft(viewModel)
    draft.overallRating = 0
    draft.ratings.hygiene = 6
    draft.consideration = 'other'
    const issues = viewModel.validateVisitEvaluationDraft(draft)
    assert.equal(issues.some((issue) => issue.path === 'overallRating'), true)
    assert.equal(issues.some((issue) => issue.path === 'ratings.hygiene'), true)
    assert.equal(issues.some((issue) => issue.path === 'consideration'), true)
    assert.equal(writeContent.mapVisitEvaluationDraftToWriteContentV1(draft).kind, 'invalid')
    const invalidFee = makeValidDraft(viewModel)
    invalidFee.feeTopicExplanations.bed_fee = 'not-a-contract-code'
    assert.equal(viewModel.validateVisitEvaluationDraft(invalidFee).some((issue) => issue.path === 'feeTopicExplanations.bed_fee'), true)
  })

  await runCase('PAGE_REQUIRED_ERRORS_BLOCK_TEST_ONLY_SUBMIT_AND_CLEAR_AFTER_FIX', async () => {
    let submitCalls = 0
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: createVisitEvaluationContextFixture },
      testOnlySubmitProvider: { submit: async () => {
        submitCalls += 1
        return { provenance: 'TEST_ONLY', outcome: 'submitted' }
      } },
    }))
    await page.onLoad({ visitId: 'visit-required-validation' })
    await page.onSubmit()
    assert.equal(page.data.pageState, 'editing')
    assert.equal(page.data.overallRatingValidationMessage, '请选择整体印象评分。')
    assert.equal(page.data.considerationValidationMessage, '请选择后续考虑。')
    assert.equal(submitCalls, 0)
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '4' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'compare' } } })
    assert.equal(page.data.overallRatingValidationMessage, '')
    assert.equal(page.data.considerationValidationMessage, '')
    await page.onSubmit()
    assert.equal(page.data.pageState, 'submitted')
    assert.equal(submitCalls, 1)
  })

  await runCase('PRICING_TOPICS_USE_STABLE_OPTIONAL_CODES_AND_RESTORE_SELECTION', async () => {
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: createVisitEvaluationContextFixture },
    }))
    await page.onLoad({ visitId: 'visit-fee-topics' })
    const expectedKeys = ['bed_fee', 'meal_fee', 'care_fee', 'management_fee', 'special_care_fee', 'deposit', 'other_one_time_fee']
    assert.deepEqual(clone(page.data.feeTopicExplanations.map((topic) => topic.key)), expectedKeys)
    assert.equal(page.data.feeTopicExplanations.every((topic) => topic.options.every((option) => !option.selected)), true)
    const answerCodes = ['explained', 'not_explained', 'unconfirmed']
    for (const topic of page.data.feeTopicExplanations) {
      for (const answer of answerCodes) {
        page.onFeeTopicTap({ currentTarget: { dataset: { topic: topic.key, value: answer } } })
        assert.equal(page.data.draft.feeTopicExplanations[topic.key], answer)
        assert.equal(page.data.feeTopicExplanations.find((item) => item.key === topic.key)
          .options.filter((option) => option.selected).length, 1)
      }
      page.onFeeTopicTap({ currentTarget: { dataset: { topic: topic.key, value: 'unconfirmed' } } })
      assert.equal(page.data.draft.feeTopicExplanations[topic.key], '')
    }
    const finalAnswers = ['explained', 'not_explained', 'unconfirmed', 'explained', 'not_explained', 'unconfirmed', 'explained']
    page.data.feeTopicExplanations.forEach((topic, index) => {
      page.onFeeTopicTap({ currentTarget: { dataset: { topic: topic.key, value: finalAnswers[index] } } })
    })
    page.onFeeTopicTap({ currentTarget: { dataset: { topic: 'bed_fee', value: 'explained' } } })
    assert.equal(page.data.draft.feeTopicExplanations.bed_fee, '')
    const content = writeContent.mapVisitEvaluationDraftToWriteContentV1({
      ...makeValidDraft(viewModel),
      feeTopicExplanations: page.data.draft.feeTopicExplanations,
    })
    assert.equal(content.kind, 'valid')
    assert.deepEqual(clone(content.content.feeTopicExplanations), {
      meal_fee: 'not_explained',
      care_fee: 'unconfirmed',
      management_fee: 'explained',
      special_care_fee: 'not_explained',
      deposit: 'unconfirmed',
      other_one_time_fee: 'explained',
    })
  })

  await runCase('UNANSWERED_FEE_CONTAINER_AND_TOPIC_KEYS_REMAIN_ABSENT', async () => {
    const partial = makeValidDraft(viewModel)
    delete partial.feeTopicExplanations.bed_fee
    delete partial.feeTopicExplanations.deposit
    partial.feeTopicExplanations.meal_fee = 'unconfirmed'
    const mappedPartial = writeContent.mapVisitEvaluationDraftToWriteContentV1(partial)
    assert.equal(mappedPartial.kind, 'valid')
    assert.deepEqual(clone(mappedPartial.content.feeTopicExplanations), { meal_fee: 'unconfirmed' })
    assert.equal(Object.prototype.hasOwnProperty.call(mappedPartial.content.feeTopicExplanations, 'bed_fee'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(mappedPartial.content.feeTopicExplanations, 'deposit'), false)

    const noFeeContainer = { ...makeValidDraft(viewModel), feeTopicExplanations: undefined }
    const mappedWithoutContainer = writeContent.mapVisitEvaluationDraftToWriteContentV1(noFeeContainer)
    assert.equal(mappedWithoutContainer.kind, 'valid')
    assert.equal(Object.prototype.hasOwnProperty.call(mappedWithoutContainer.content, 'feeTopicExplanations'), false)
  })

  await runCase('HANDOVER_UNCONFIRMED_XOR_IS_ENFORCED_BY_VIEW_MODEL_AND_VALIDATOR', async () => {
    const empty = makeValidDraft(viewModel)
    const unconfirmed = viewModel.toggleVisitEvaluationHandoverTopic(empty, 'unconfirmed')
    assert.deepEqual(clone(unconfirmed.handoverTopics), ['unconfirmed'])
    assert.deepEqual(clone(viewModel.validateVisitEvaluationDraft(unconfirmed)), [])
    const concrete = viewModel.toggleVisitEvaluationHandoverTopic(unconfirmed, 'follow_up')
    assert.deepEqual(clone(concrete.handoverTopics), ['follow_up'])
    const backToUnknown = viewModel.toggleVisitEvaluationHandoverTopic(concrete, 'unconfirmed')
    assert.deepEqual(clone(backToUnknown.handoverTopics), ['unconfirmed'])
    const invalid = { ...empty, handoverTopics: ['unconfirmed', 'vital_signs'] }
    assert.equal(viewModel.validateVisitEvaluationDraft(invalid).some((issue) => issue.path === 'handoverTopics'), true)
    const noIsNotUnknown = { ...empty, careRecordLearned: 'no', handoverLearned: 'unconfirmed' }
    const mapped = writeContent.mapVisitEvaluationDraftToWriteContentV1(noIsNotUnknown)
    assert.equal(mapped.kind, 'valid')
    assert.deepEqual(clone(mapped.content.careProcessObservations), {
      careRecordLearned: 'no',
      handoverLearned: 'unconfirmed',
    })
  })

  await runCase('WRITE_CONTENT_NORMALIZES_OPTIONAL_SETS_AND_EXCLUDES_SERVER_AUTHORITY', async () => {
    const draft = makeValidDraft(viewModel)
    draft.ratings.hygiene = 3
    draft.feeExplanationClear = 'clear'
    draft.feeTopicExplanations.bed_fee = 'explained'
    draft.careRecordLearned = 'no'
    draft.handoverTopics = ['follow_up', 'vital_signs']
    draft.likedTags = ['room', 'care']
    draft.concernTags = ['care']
    draft.comment = '记录本次观察'
    const mapped = writeContent.mapVisitEvaluationDraftToWriteContentV1(draft)
    assert.equal(mapped.kind, 'valid')
    assert.deepEqual(clone(mapped.content), {
      overallRating: 5,
      consideration: 'willing',
      ratings: { hygiene: 3 },
      feeExplanationClear: 'clear',
      feeTopicExplanations: { bed_fee: 'explained' },
      careProcessObservations: {
        careRecordLearned: 'no',
        handoverTopics: ['follow_up', 'vital_signs'],
      },
      likedTags: ['care', 'room'],
      concernTags: ['care'],
      comment: '记录本次观察',
    })
    const contentKeys = Object.keys(mapped.content)
    for (const forbidden of [
      'visitId', 'userId', 'ownerId', 'institutionId', 'institutionRecordRevision',
      'visitStatus', 'completed', 'evaluationId', 'submittedAt', 'idempotencyKey',
    ]) assert.equal(contentKeys.includes(forbidden), false)
  })

  await runCase('TAG_DUPLICATES_ARE_REJECTED_BUT_CROSS_GROUP_REUSE_IS_ALLOWED', async () => {
    const valid = makeValidDraft(viewModel)
    valid.likedTags = ['care']
    valid.concernTags = ['care']
    assert.deepEqual(clone(viewModel.validateVisitEvaluationDraft(valid)), [])
    const duplicate = { ...valid, likedTags: ['care', 'care'] }
    assert.equal(viewModel.validateVisitEvaluationDraft(duplicate).some((issue) => issue.code === 'duplicate_tag'), true)
    const unknown = { ...valid, concernTags: ['not-a-tag'] }
    assert.equal(viewModel.validateVisitEvaluationDraft(unknown).some((issue) => issue.code === 'invalid_tag'), true)
    const overLimit = { ...valid, likedTags: ['care', 'medical', 'room', 'environment'] }
    assert.equal(viewModel.validateVisitEvaluationDraft(overLimit).some((issue) => issue.code === 'too_many_tags'), true)
  })

  await runCase('COMMENT_LIMIT_VALIDATES_DIRECT_DRAFT_AND_EMPTY_IS_OPTIONAL', async () => {
    const empty = makeValidDraft(viewModel)
    assert.deepEqual(clone(viewModel.validateVisitEvaluationDraft(empty)), [])
    const tooLong = { ...empty, comment: '字'.repeat(201) }
    assert.equal(viewModel.validateVisitEvaluationDraft(tooLong).some((issue) => issue.path === 'comment'), true)
    assert.equal(viewModel.validateVisitEvaluationDraft({ ...empty, comment: '字'.repeat(200) }).length, 0)
  })

  await runCase('PRODUCTION_NO_CONTEXT_PROVIDER_FAILS_CLOSED', async () => {
    const page = makePage(pageConfig)
    await page.onLoad({ visitId: 'visit-test-route-only' })
    assert.equal(page.data.pageState, 'unavailable')
    assert.equal(page.data.contextMode, 'none')
    assert.equal(page.data.draft.overallRating, null)
    assert.equal((await makeApplication(runtime).submit(
      createVisitEvaluationContextFixture(),
      viewModel.createEmptyVisitEvaluationDraft(),
    )).kind, 'submit_failed')
  })

  await runCase('PRODUCTION_PROVIDER_EXCHANGES_C5_SESSION_THEN_READS_MINIMAL_CONTEXT', async () => {
    const requests = []
    const provider = productionContextModule.createProductionVisitEvaluationContextProviderV1({
      environment: () => 'develop',
      login: async () => 'test-only-login-code',
      request: async (request) => {
        requests.push(request)
        if (request.method === 'POST') return {
          statusCode: 200,
          data: {
            contractVersion: 'wechat-authenticated-principal-contract-v1',
            kind: 'wechat_authentication_result_v1',
            outcome: 'AUTHENTICATED',
            code: 'AUTHENTICATED',
            sessionEvidence: 'test-only-session-evidence',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        }
        return {
          statusCode: 200,
          data: {
            contractVersion: 'authenticated-visit-evaluation-context-contract-v1',
            kind: 'authenticated_visit_evaluation_context_result_v1',
            authResolution: 'authenticated',
            availability: 'eligible',
            context: {
              visitId: 'visit/owned',
              institutionId: 'institution-test-001',
              institutionRecordRevision: 'revision-test-001',
              visitStatus: 'completed',
            },
          },
        }
      },
    })
    const result = await provider.loadContext('visit/owned')
    assert.equal(result.kind, 'eligible')
    assert.equal(result.context.visitId, 'visit/owned')
    assert.equal(result.context.visitStatus, 'completed')
    assert.equal(requests.length, 2)
    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].url, 'http://127.0.0.1:8080/api/v1/auth/wechat')
    assert.equal(requests[0].data.kind, 'wechat_authentication_request_v1')
    assert.equal(requests[1].method, 'GET')
    assert.equal(requests[1].url, 'http://127.0.0.1:8080/api/v1/visits/visit%2Fowned/evaluation-context')
    assert.equal(requests[1].data, undefined)
    assert.equal(requests[1].header['X-Auth-Evidence'], 'test-only-session-evidence')
    assert.equal(Object.keys(result.context).sort().join('|'), 'institutionId|institutionRecordRevision|provenance|visitId|visitStatus')
    assert.equal(JSON.stringify(result).includes('session-evidence'), false)
  })

  await runCase('PRODUCTION_OWNER_READ_REQUIRES_AUTHENTICATED_C5_SESSION', async () => {
    let requests = 0
    const provider = productionContextModule.createProductionVisitEvaluationContextProviderV1({
      environment: () => 'develop',
      login: async () => 'test-only-login-code',
      request: async () => {
        requests += 1
        return {
          statusCode: 200,
          data: {
            contractVersion: 'wechat-authenticated-principal-contract-v1',
            kind: 'wechat_authentication_result_v1',
            outcome: 'UNAVAILABLE',
            code: 'SERVICE_UNAVAILABLE',
            sessionEvidence: null,
            expiresAt: null,
          },
        }
      },
    })
    assert.equal((await provider.loadContext('visit-no-session')).kind, 'unavailable')
    assert.equal(requests, 1)
  })

  await runCase('UNCONFIGURED_RELEASE_BACKEND_DOES_NOT_FABRICATE_OR_REQUEST', async () => {
    let loginCalls = 0
    const provider = productionContextModule.createProductionVisitEvaluationContextProviderV1({
      environment: () => 'release',
      login: async () => {
        loginCalls += 1
        return 'test-only-login-code'
      },
      request: async () => { throw new Error('must_not_request') },
    })
    assert.equal((await provider.loadContext('visit-release')).kind, 'unavailable')
    assert.equal(loginCalls, 0)
  })

  await runCase('PRODUCTION_CONTEXT_STATUS_AUTHORITY_AND_MINIMAL_DENIAL_MAPPING', async () => {
    const parse = productionContextModule.readProductionVisitEvaluationContextResponseV1
    const base = {
      contractVersion: 'authenticated-visit-evaluation-context-contract-v1',
      kind: 'authenticated_visit_evaluation_context_result_v1',
      authResolution: 'authenticated',
      availability: 'eligible',
      context: {
        visitId: 'visit-server-status',
        institutionId: 'institution-test-001',
        institutionRecordRevision: 'revision-test-001',
        visitStatus: 'completed',
      },
    }
    assert.equal(parse({ ...base, context: { ...base.context, visitStatus: 'scheduled' } }, 'visit-server-status').kind, 'load_error')
    assert.equal(parse({ ...base, availability: 'not_completed', context: { ...base.context, visitStatus: 'scheduled' } }, 'visit-server-status').kind, 'not_completed')
    assert.equal(parse({ ...base, availability: 'not_found', context: null }, 'visit-server-status').kind, 'denied')
    assert.equal(parse({ ...base, availability: 'not_found', context: { ...base.context, phone: 'must-not-project' } }, 'visit-server-status').kind, 'load_error')
    for (const authResolution of ['missing', 'expired', 'invalid']) {
      assert.equal(parse({ ...base, authResolution, availability: null, context: null }, 'visit-server-status').kind, 'denied')
    }
    assert.equal(parse({ ...base, authResolution: 'unavailable', availability: null, context: null }, 'visit-server-status').kind, 'unavailable')
    assert.equal(parse({ ...base, authResolution: 'technical_failure', availability: null, context: null }, 'visit-server-status').kind, 'load_error')
    assert.equal(parse({ ...base, availability: 'unavailable', context: null }, 'visit-server-status').kind, 'unavailable')
    assert.equal(parse({ ...base, availability: 'technical_failure', context: { ...base.context, visitStatus: 'completed' } }, 'visit-server-status').kind, 'load_error')
    assert.equal(parse({ ...base, availability: 'technical_failure', context: null }, 'visit-server-status').kind, 'load_error')
  })

  await runCase('PRODUCTION_CONTEXT_PAGE_RETRY_AND_TEST_SUBMIT_IS_DISABLED', async () => {
    let loads = 0
    let testSubmits = 0
    const application = makeApplication(runtime, {
      productionContextProvider: {
        loadContext: async (visitId) => {
          loads += 1
          return loads === 1
            ? { kind: 'load_error' }
            : { kind: 'eligible', context: {
              provenance: 'PRODUCTION',
              visitId,
              institutionId: 'institution-test-001',
              institutionRecordRevision: 'revision-test-001',
              visitStatus: 'completed',
            } }
        },
      },
      testOnlySubmitProvider: { submit: async () => {
        testSubmits += 1
        return { provenance: 'TEST_ONLY', outcome: 'submitted' }
      } },
    })
    const page = makePage(pageConfig, application)
    await page.onLoad({ visitId: 'visit-production' })
    assert.equal(page.data.pageState, 'load_error')
    assert.equal(page._visitEvaluationContext, undefined)
    await page.onRetryContext()
    assert.equal(page.data.pageState, 'editing')
    assert.equal(page.data.contextMode, 'production')
    assert.equal(page._visitEvaluationContext, undefined)
    await page.onSubmit()
    assert.equal(testSubmits, 0)
    assert.equal(loads, 2)
  })

  await runCase('CONTEXT_LOADING_AND_RAPID_RETRY_REQUEST_GUARD', async () => {
    let releaseLoad
    let loads = 0
    const application = makeApplication(runtime, {
      productionContextProvider: { loadContext: () => {
        loads += 1
        return new Promise((resolve) => { releaseLoad = resolve })
      } },
    })
    const page = makePage(pageConfig, application)
    const firstLoad = page.onLoad({ visitId: 'visit-pending' })
    assert.equal(page.data.pageState, 'loading_context')
    await page.onRetryContext()
    assert.equal(loads, 1)
    releaseLoad({ kind: 'not_completed' })
    await firstLoad
    assert.equal(page.data.pageState, 'not_completed')
    assert.equal(loads, 1)
  })

  await runCase('PRODUCTION_NONCOMPLETED_DENIED_AND_UNAVAILABLE_NEVER_ENTER_EDITING', async () => {
    const states = ['not_completed', 'denied', 'unavailable']
    for (const result of states) {
      const application = makeApplication(runtime, {
        productionContextProvider: { loadContext: async () => ({ kind: result }) },
      })
      const page = makePage(pageConfig, application)
      await page.onLoad({ visitId: 'visit-not-editable', status: 'completed' })
      assert.notEqual(page.data.pageState, 'editing')
      assert.equal(page.data.contextMode, 'none')
      assert.equal(page._productionVisitEvaluationContext, undefined)
    }
  })

  await runCase('CONTEXT_MUST_MATCH_ROUTE_AND_COMPLETED_TEST_FACT', async () => {
    const invalidApplication = makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: () => createVisitEvaluationContextFixture('different-visit') },
    })
    const page = makePage(pageConfig, invalidApplication)
    await page.onLoad({ visitId: 'visit-test-route-only' })
    assert.equal(page.data.pageState, 'unavailable')

    const invalidStatusApplication = makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: (visitId) => ({
        ...createVisitEvaluationContextFixture(visitId), visitStatus: 'scheduled',
      }) },
    })
    const invalidStatusPage = makePage(pageConfig, invalidStatusApplication)
    await invalidStatusPage.onLoad({ visitId: 'visit-test-route-only' })
    assert.equal(invalidStatusPage.data.pageState, 'unavailable')
  })

  await runCase('TEST_ONLY_CONTEXT_BINDS_TO_VISIT_ID', async () => {
    const providers = createVisitEvaluationTestOnlyProviders()
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: providers.contextProvider,
      testOnlySubmitProvider: providers.submitProvider,
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    assert.equal(page.data.pageState, 'editing')
    assert.equal(page.data.visitId, 'visit-test-completed')
    assert.match(page.data.contextMessage, /institution-test-001/)
    assert.match(page.data.statusMessage, /不会写入真实评价/)
  })

  await runCase('RATING_RANGE_AND_ALL_RATING_GROUPS', async () => {
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: createVisitEvaluationContextFixture },
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '5' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'willing' } } })
    page.onRatingTap({ currentTarget: { dataset: { question: 'hygiene', value: '1' } } })
    page.onRatingTap({ currentTarget: { dataset: { question: 'common_area_use', value: '4' } } })
    page.onRatingTap({ currentTarget: { dataset: { question: 'hygiene', value: '6' } } })
    assert.equal(page.data.draft.overallRating, 5)
    assert.equal(page.data.draft.ratings.hygiene, 1)
    assert.equal(page.data.draft.ratings.common_area_use, 4)
    assert.equal(viewModel.setVisitEvaluationRating(page.data.draft, 'hygiene', 0), null)
  })

  await runCase('CONSIDERATION_FEE_AND_OBSERVATION_MAP_TO_LOCAL_DRAFT', async () => {
    const providers = createVisitEvaluationTestOnlyProviders()
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: providers.contextProvider,
      testOnlySubmitProvider: providers.submitProvider,
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'compare' } } })
    page.onFeeClarityTap({ currentTarget: { dataset: { value: 'clear' } } })
    page.onObservationTap({ currentTarget: { dataset: { question: 'careRecordLearned', value: 'no' } } })
    page.onObservationTap({ currentTarget: { dataset: { question: 'handoverLearned', value: 'unconfirmed' } } })
    page.onHandoverTopicTap({ currentTarget: { dataset: { value: 'unconfirmed' } } })
    page.onHandoverTopicTap({ currentTarget: { dataset: { value: 'follow_up' } } })
    assert.equal(page.data.draft.consideration, 'compare')
    assert.equal(page.data.draft.feeExplanationClear, 'clear')
    assert.equal(page.data.draft.careRecordLearned, 'no')
    assert.equal(page.data.draft.handoverLearned, 'unconfirmed')
    assert.equal(JSON.stringify(page.data.draft.handoverTopics), '["follow_up"]')
    assert.equal(providers.calls.length, 0)
  })

  await runCase('TAG_GROUP_LIMITS_ARE_INDEPENDENT_AND_RETAIN_PRIOR_SELECTIONS', async () => {
    const providers = createVisitEvaluationTestOnlyProviders()
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: providers.contextProvider,
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '5' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'willing' } } })
    const choose = (group, tag) => page.onTagTap({ currentTarget: { dataset: { group, tag } } })
    choose('likedTags', 'care')
    choose('likedTags', 'medical')
    choose('likedTags', 'room')
    choose('likedTags', 'environment')
    assert.match(page.data.tagFeedbackMessage, /最多选择3项/)
    choose('concernTags', 'environment')
    assert.equal(JSON.stringify(page.data.draft.likedTags), '["care","medical","room"]')
    assert.equal(JSON.stringify(page.data.draft.concernTags), '["environment"]')
    assert.equal(viewModel.validateVisitEvaluationDraft(page.data.draft).length, 0)
  })

  await runCase('COMMENT_IS_LIMITED_TO_200_UNICODE_CHARACTERS', async () => {
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: createVisitEvaluationContextFixture },
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '5' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'willing' } } })
    page.onCommentInput({ detail: { value: '看'.repeat(201) } })
    assert.equal(viewModel.countVisitEvaluationCharacters(page.data.draft.comment), 200)
    assert.equal(page.data.commentRemaining, 0)
    page.onCommentInput({ detail: { value: '😀'.repeat(201) } })
    assert.equal(viewModel.countVisitEvaluationCharacters(page.data.draft.comment), 200)
    assert.equal(viewModel.validateVisitEvaluationDraft(page.data.draft).length, 0)
  })

  await runCase('SUBMITTING_GUARD_AND_TEST_ONLY_SUCCESS', async () => {
    let releaseSubmit
    let calls = 0
    const application = makeApplication(runtime, {
      testOnlyContextProvider: { loadContext: createVisitEvaluationContextFixture },
      testOnlySubmitProvider: { submit: () => {
        calls += 1
        return new Promise((resolve) => { releaseSubmit = resolve })
      } },
    })
    const page = makePage(pageConfig, application)
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '4' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'willing' } } })
    const beforeSubmit = clone(page.data.draft)
    const first = page.onSubmit()
    const second = page.onSubmit()
    assert.equal(page.data.pageState, 'submitting')
    assert.equal(calls, 1)
    releaseSubmit({ provenance: 'TEST_ONLY', outcome: 'submitted' })
    await Promise.all([first, second])
    assert.equal(page.data.pageState, 'submitted')
    assert.equal(JSON.stringify(page.data.draft), JSON.stringify(beforeSubmit))
    assert.match(page.data.feedbackMessage, /未写入真实评价/)
  })

  await runCase('FAILURE_RETAINS_DRAFT_AND_RETRY_SUBMITS_ONCE', async () => {
    const providers = createVisitEvaluationTestOnlyProviders(['failed', 'submitted'])
    const page = makePage(pageConfig, makeApplication(runtime, {
      testOnlyContextProvider: providers.contextProvider,
      testOnlySubmitProvider: providers.submitProvider,
    }))
    await page.onLoad({ visitId: 'visit-test-completed' })
    page.onRatingTap({ currentTarget: { dataset: { question: 'overallRating', value: '3' } } })
    page.onConsiderationTap({ currentTarget: { dataset: { value: 'willing' } } })
    page.onCommentInput({ detail: { value: '保留本地内容' } })
    const originalDraft = clone(page.data.draft)
    await page.onSubmit()
    assert.equal(page.data.pageState, 'submit_failed')
    assert.equal(JSON.stringify(page.data.draft), JSON.stringify(originalDraft))
    assert.match(page.data.feedbackMessage, /已保留全部填写内容/)
    await page.onSubmit()
    assert.equal(page.data.pageState, 'submitted')
    assert.equal(JSON.stringify(page.data.draft), JSON.stringify(originalDraft))
    assert.equal(providers.calls.length, 2)
  })

  await runCase('INVALID_ROUTE_AND_PRODUCTION_GRAPH_ISOLATION', async () => {
    const page = makePage(pageConfig)
    await page.onLoad({ visitId: '\u0001bad' })
    assert.equal(page.data.pageState, 'unavailable')
    assert.equal(page.data.visitId, '')
    for (const file of productionPaths) {
      const source = readFileSync(file, 'utf8')
      assert.equal(/scripts[\\/]fixtures|TEST_ONLY_SYNTHETIC_VISIT/.test(source), false)
      assert.equal(/getPhoneNumber|phoneCode|Recommendation/i.test(source), false)
      assert.equal(/from ['"]\.\.\/\.\.\/.*(institution|recommendation|backend)/i.test(source), false)
    }
    const productionContextSource = readFileSync(productionContextProviderPath, 'utf8')
    assert.equal(/sessionEvidence/.test(productionContextSource), true)
    assert.equal(/console\.|setStorageSync|setData\(/.test(productionContextSource), false)
    const pageSource = readFileSync(pagePath, 'utf8')
    assert.equal(/sessionEvidence|phoneCode|getPhoneNumber/i.test(pageSource), false)
    const fixturePath = path.join(repositoryRoot, 'scripts', 'fixtures', 'visit-evaluation-test-fixtures.mjs')
    assert.ok(readFileSync(fixturePath, 'utf8').includes('TEST_ONLY'))
    const appJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'miniprogram', 'app.json'), 'utf8'))
    assert.ok(appJson.pages.includes('pages/visit/evaluation'))
    const pageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.json'), 'utf8'))
    assert.equal(pageJson.usingComponents['primary-button'], '/components/primary-button/primary-button')
  })

  await runCase('WXML_SINGLE_ACTION_AND_FIELDS', async () => {
    const wxml = readFileSync(path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.wxml'), 'utf8')
    assert.match(wxml, /bind:action="onSubmit"/)
    assert.equal((wxml.match(/bind:action="onSubmit"/g) || []).length, 1)
    assert.match(wxml, /最多选择 3 项/)
    assert.match(wxml, /tagFeedbackGroup === group.key/)
    assert.match(wxml, /最多 200 字/)
    assert.match(wxml, /整体印象（必填）/)
    assert.match(wxml, /后续考虑（必填）/)
    assert.match(wxml, /feeTopicExplanations/)
    assert.match(wxml, /bindtap="onFeeTopicTap"/)
    assert.match(wxml, /未选择表示未填写/)
    assert.match(wxml, /“未确认”与具体交接项目互斥/)
    assert.match(wxml, /USER_REPORTED_DATA|个人感受与观察/)
    assert.equal(/bindtap="onSubmit"/.test(wxml), false)
    assert.match(wxml, /pageState === 'not_completed'/)
    assert.match(wxml, /bind:action="onRetryContext"/)
    assert.match(wxml, /contextMode === 'test_only'/)
    assert.match(wxml, /评价提交服务尚未接入/)
  })

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`VISIT_EVALUATION_TEST_FIXTURE_POLICY: ${VISIT_EVALUATION_TEST_FIXTURE_POLICY}`)
  console.log(`VISIT_EVALUATION_RUNTIME_CASES: ${cases.length}`)
  console.log('VISIT_EVALUATION_RUNTIME_ASSERTIONS: PASS')
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
