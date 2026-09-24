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
const productionPaths = [pagePath, viewModelPath, applicationPath, productionContextProviderPath]
const failures = []
const cases = []

const clone = (value) => JSON.parse(JSON.stringify(value))

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
    assert.equal(JSON.stringify(viewModel.validateVisitEvaluationDraft(draft)), '[]')
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
