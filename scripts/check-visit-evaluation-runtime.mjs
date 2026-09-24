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
const productionPaths = [pagePath, viewModelPath, applicationPath]
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
  runtime.load(applicationPath)
  runtime.load(pagePath)
  assert.ok(pageConfig)

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
    assert.match(page.data.contextMessage, /尚未接入/)
    assert.equal(page.data.draft.overallRating, null)
    assert.equal((await makeApplication(runtime).submit(
      createVisitEvaluationContextFixture(),
      viewModel.createEmptyVisitEvaluationDraft(),
    )).kind, 'submit_failed')
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
      assert.equal(/getPhoneNumber|phoneCode|sessionEvidence|Recommendation/i.test(source), false)
      assert.equal(/from ['"]\.\.\/\.\.\/.*(institution|recommendation|backend)/i.test(source), false)
    }
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
