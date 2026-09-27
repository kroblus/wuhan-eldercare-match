import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  APPOINTMENT_LIST_FIXTURE_POLICY,
  makeAppointmentListFixtures,
} from './fixtures/appointment-list-test-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appointmentPagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.ts')
const appointmentWxmlPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.wxml')
const viewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'list-view-model.ts')
const providerPath = path.join(repositoryRoot, 'miniprogram', 'services', 'appointment-owner-read.ts')
const sessionPath = path.join(repositoryRoot, 'miniprogram', 'services', 'c5-authenticated-backend-session.ts')
const evaluationPagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.ts')
const failures = []
const executedCases = []

const runCase = async (name, callback) => {
  executedCases.push(name)
  try {
    await callback()
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const makeItem = (visitId, visitStatus, institutionAvailability = 'ready', pickupRequested) => ({
  visitId,
  institutionId: `synthetic-institution-${visitId}`,
  institutionRecordRevision: '4',
  visitStatus,
  visitDate: '2020-01-02',
  visitTimePreference: 'morning',
  participantCount: 2,
  ...(pickupRequested === undefined ? {} : { pickupRequested }),
  institutionDisplay: institutionAvailability === 'ready'
    ? { availability: 'ready', name: `Synthetic Historical Name ${visitId}` }
    : { availability: 'unavailable', name: null },
})

const makeReadyResult = (items) => ({
  contractVersion: 'appointment-production-owner-read-contract-v1',
  kind: 'appointment_owner_read_result_v1',
  authResolution: 'authenticated',
  availability: 'ready',
  items,
})

const makeFailureResult = (authResolution, availability = null) => ({
  contractVersion: 'appointment-production-owner-read-contract-v1',
  kind: 'appointment_owner_read_result_v1',
  authResolution,
  availability,
  items: null,
})

const makeAuthResult = () => ({
  contractVersion: 'wechat-authenticated-principal-contract-v1',
  kind: 'wechat_authentication_result_v1',
  outcome: 'AUTHENTICATED',
  code: 'AUTHENTICATED',
  sessionEvidence: 'synthetic-session-evidence-for-test-only',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
})

const createRuntimeHarness = (getResult, developmentOrigin = 'http://10.123.45.67:8080') => {
  const state = { requests: [], loginCalls: 0, authCalls: 0, getCalls: 0 }
  let pageConfig = null
  const { ts } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts, {
    Page: (config) => { pageConfig = config },
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
      getStorageSync: () => developmentOrigin,
      login: (options) => {
        state.loginCalls += 1
        options.success({ code: 'synthetic-login-code-for-test-only' })
      },
      request: (options) => {
        state.requests.push({
          url: options.url,
          method: options.method,
          header: options.header,
          data: options.data,
        })
        if (options.url.endsWith('/api/v1/auth/wechat')) {
          state.authCalls += 1
          options.success({ statusCode: 200, data: makeAuthResult() })
          return
        }
        state.getCalls += 1
        Promise.resolve(getResult(state.getCalls, options)).then((data) => {
          options.success({ statusCode: 200, data })
        }, () => {
          options.fail({ errMsg: 'request:fail test-only' })
        })
      },
      navigateTo: () => {},
      showToast: () => {},
    },
  })
  runtime.load(appointmentPagePath)
  assert.ok(pageConfig)
  const navigationCalls = []
  const toastCalls = []
  runtime.context.wx.navigateTo = (options) => {
    navigationCalls.push(options)
    if (options.success) options.success({})
    if (options.complete) options.complete({})
  }
  runtime.context.wx.showToast = (options) => toastCalls.push(options)
  const page = {
    ...pageConfig,
    data: clone(pageConfig.data),
    setData(patch) { Object.assign(this.data, patch) },
  }
  return { runtime, page, state, navigationCalls, toastCalls }
}

const expectedFiveStatusResult = () => makeReadyResult([
  makeItem('visit-requested', 'requested'),
  makeItem('visit-contacting', 'contacting'),
  makeItem('visit-scheduled-past', 'scheduled'),
  makeItem('visit-completed', 'completed', 'unavailable'),
  makeItem('visit-cancelled', 'cancelled'),
])

const run = async () => {
  assert.equal(APPOINTMENT_LIST_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_APPOINTMENT_LIST_VIEW_ITEMS')

  await runCase('PRODUCTION_CONTEXT_LOADS_AND_MAPS_FIVE_STATUSES', async () => {
    const harness = createRuntimeHarness(() => expectedFiveStatusResult())
    await harness.page.onLoad()
    assert.equal(harness.page.data.loadState, 'ready_non_empty')
    assert.equal(harness.page.data.visits.map((visit) => visit.status).join(','),
      'requested,contacting,scheduled,completed,cancelled')
    assert.equal(harness.page.data.visits.map((visit) => visit.statusLabel).join(','),
      '待确认 · 已提交,待确认 · 顾问联系中,已确认,已完成,已取消')
    assert.equal(harness.page.data.visits[2].statusLabel, '已确认')
    assert.match(harness.page.data.visits[0].institutionLabel, /Synthetic Historical Name/)
    assert.equal(harness.page.data.visits[3].institutionLabel, '机构资料暂不可用')
    assert.equal(harness.page.data.visits[3].showEvaluationAction, true)
    assert.equal(harness.page.data.visits[2].showEvaluationAction, false)
    assert.equal(Object.hasOwn(harness.page.data.visits[0], 'elderId'), false)
    assert.equal(Object.hasOwn(harness.page.data.visits[0], 'institutionRecordRevision'), false)
  })

  await runCase('C5_SESSION_IS_REUSED_AND_OWNER_READ_REQUEST_HAS_NO_OWNER_SELECTOR', async () => {
    const harness = createRuntimeHarness(() => makeReadyResult([]))
    await harness.page.onLoad()
    assert.equal(harness.state.loginCalls, 1)
    assert.equal(harness.state.authCalls, 1)
    assert.equal(harness.state.getCalls, 1)
    const authRequest = harness.state.requests[0]
    const listRequest = harness.state.requests[1]
    assert.equal(authRequest.url, 'http://10.123.45.67:8080/api/v1/auth/wechat')
    assert.equal(listRequest.url, 'http://10.123.45.67:8080/api/v1/visits')
    assert.equal(listRequest.method, 'GET')
    assert.equal(listRequest.data, undefined)
    assert.equal(listRequest.header['X-Auth-Evidence'], 'synthetic-session-evidence-for-test-only')
    assert.equal(Object.keys(listRequest.header).some((key) => /user|owner/i.test(key)), false)
    assert.equal(/[?&](userId|ownerId)=/i.test(listRequest.url), false)
  })

  await runCase('READY_EMPTY_IS_NOT_ERROR_OR_FIXTURE_FALLBACK', async () => {
    const harness = createRuntimeHarness(() => makeReadyResult([]))
    await harness.page.onLoad()
    assert.equal(harness.page.data.loadState, 'ready_empty')
    assert.equal(harness.page.data.visits.length, 0)
    assert.equal(harness.state.getCalls, 1)
  })

  await runCase('MISSING_DEVELOP_ORIGIN_FAILS_CLOSED_BEFORE_LOGIN_OR_NETWORK', async () => {
    const harness = createRuntimeHarness(() => makeReadyResult([]), '')
    await harness.page.onLoad()
    assert.equal(harness.page.data.loadState, 'load_error')
    assert.equal(harness.state.loginCalls, 0)
    assert.equal(harness.state.authCalls, 0)
    assert.equal(harness.state.getCalls, 0)
    assert.equal(harness.state.requests.length, 0)
  })

  await runCase('AUTH_FAILURE_IS_NOT_EMPTY_AND_RETRY_REACQUIRES_SESSION', async () => {
    const harness = createRuntimeHarness((call) => call === 1
      ? makeFailureResult('missing')
      : makeReadyResult([makeItem('visit-after-retry', 'completed')]))
    await harness.page.onLoad()
    assert.equal(harness.page.data.loadState, 'load_error')
    assert.equal(harness.page.data.visits.length, 0)
    assert.match(harness.page.data.errorMessage, /账号身份/)
    await harness.page.onRetry()
    assert.equal(harness.page.data.loadState, 'ready_non_empty')
    assert.equal(harness.page.data.visits[0].visitId, 'visit-after-retry')
    assert.equal(harness.state.loginCalls, 2)
    assert.equal(harness.state.authCalls, 2)
  })

  await runCase('TECHNICAL_FAILURE_AND_MALFORMED_RESULT_FAIL_CLOSED', async () => {
    const technical = createRuntimeHarness(() => makeFailureResult('authenticated', 'technical_failure'))
    await technical.page.onLoad()
    assert.equal(technical.page.data.loadState, 'load_error')
    assert.equal(technical.page.data.visits.length, 0)

    const authUnavailable = createRuntimeHarness(() => makeFailureResult('unavailable'))
    await authUnavailable.page.onLoad()
    assert.equal(authUnavailable.page.data.loadState, 'load_error')
    assert.equal(authUnavailable.page.data.visits.length, 0)
    assert.doesNotMatch(authUnavailable.page.data.errorMessage, /手机号|登录授权/)

    const malformed = createRuntimeHarness(() => ({
      contractVersion: 'unsupported-contract', kind: 'appointment_owner_read_result_v1',
      authResolution: 'authenticated', availability: 'ready', items: [],
    }))
    await malformed.page.onLoad()
    assert.equal(malformed.page.data.loadState, 'load_error')
    assert.equal(malformed.page.data.visits.length, 0)
  })

  await runCase('UNAVAILABLE_HISTORICAL_NAME_RETAINS_VISIT_AND_NEVER_LOOKS_UP_LATEST', async () => {
    const runtimeHarness = createRuntimeHarness(() => makeReadyResult([
      makeItem('visit-no-history', 'scheduled', 'unavailable'),
    ]))
    await runtimeHarness.page.onLoad()
    assert.equal(runtimeHarness.page.data.loadState, 'ready_non_empty')
    assert.equal(runtimeHarness.page.data.visits.length, 1)
    assert.equal(runtimeHarness.page.data.visits[0].institutionLabel, '机构资料暂不可用')

    const source = readFileSync(providerPath, 'utf8')
    assert.equal(/institution-catalog|institutionCatalog|currentCatalog/i.test(source), false)
  })

  await runCase('LOCAL_FILTERS_PRESERVE_DOMAIN_STATUS_AND_INPUT_ORDER', async () => {
    const harness = createRuntimeHarness(() => expectedFiveStatusResult())
    await harness.page.onLoad()
    const expectedCounts = { all: 5, awaiting: 2, confirmed: 1, completed: 1, cancelled: 1 }
    Object.entries(expectedCounts).forEach(([filter, count]) => {
      harness.page.onFilterTap({ currentTarget: { dataset: { filter } } })
      assert.equal(harness.page.data.activeFilter, filter)
      assert.equal(harness.page.data.visibleVisits.length, count)
    })
    assert.equal(harness.state.getCalls, 1)
    assert.equal(harness.page.data.visits.map((visit) => visit.visitId).join(','),
      'visit-requested,visit-contacting,visit-scheduled-past,visit-completed,visit-cancelled')
  })

  await runCase('ERROR_RETRY_RECOVERS_AND_RAPID_RETRY_IS_SINGLE_FLIGHT', async () => {
    let releaseFirst
    let getCallCount = 0
    const harness = createRuntimeHarness(() => {
      getCallCount += 1
      if (getCallCount === 1) return new Promise((resolve) => { releaseFirst = resolve })
      return makeReadyResult([makeItem('visit-recovered', 'requested')])
    })
    const firstLoad = harness.page.onLoad()
    const duplicateLoad = harness.page.onRetry()
    for (let attempt = 0; attempt < 12 && harness.state.getCalls === 0; attempt += 1) {
      await Promise.resolve()
    }
    assert.equal(harness.page.data.loadState, 'loading')
    assert.equal(harness.state.getCalls, 1)
    releaseFirst(makeFailureResult('authenticated', 'unavailable'))
    await Promise.all([firstLoad, duplicateLoad])
    assert.equal(harness.page.data.loadState, 'load_error')
    await harness.page.onRetry()
    assert.equal(harness.page.data.loadState, 'ready_non_empty')
    assert.equal(harness.page.data.visits[0].visitId, 'visit-recovered')
    assert.equal(harness.state.getCalls, 2)
  })

  await runCase('COMPLETED_EVALUATION_NAVIGATION_IS_VISIT_BOUND_AND_SINGLE_ACTION', async () => {
    const harness = createRuntimeHarness(() => expectedFiveStatusResult())
    await harness.page.onLoad()
    harness.page.onFilterTap({ currentTarget: { dataset: { filter: 'all' } } })
    harness.page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-scheduled-past' } } })
    assert.equal(harness.navigationCalls.length, 0)
    harness.page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-completed' } } })
    harness.page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-completed' } } })
    assert.equal(harness.navigationCalls.length, 1)
    assert.equal(harness.navigationCalls[0].url, '/pages/visit/evaluation?visitId=visit-completed')
    harness.page.onShow()
    harness.page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-completed' } } })
    assert.equal(harness.navigationCalls.length, 2)
    assert.equal(harness.state.getCalls, 1)
  })

  await runCase('TRANSPORT_FAILURE_STAYS_ERROR_AND_RETRY_DOES_NOT_USE_FIXTURE', async () => {
    let attempts = 0
    const harness = createRuntimeHarness(() => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error('synthetic transport failure'))
        : makeReadyResult([makeItem('visit-transport-retry', 'contacting')])
    })
    await harness.page.onLoad()
    assert.equal(harness.page.data.loadState, 'load_error')
    assert.equal(harness.page.data.visits.length, 0)
    await harness.page.onRetry()
    assert.equal(harness.page.data.loadState, 'ready_non_empty')
    assert.equal(harness.page.data.visits[0].visitId, 'visit-transport-retry')
    assert.equal(harness.state.getCalls, 2)
    assert.equal(harness.state.authCalls, 1)
  })

  await runCase('PROVIDER_RESPONSE_REJECTS_PRIVATE_FIELDS_AND_UNKNOWN_STATUS', async () => {
    const runtime = createWechatTsRuntime(loadWechatTypeScript().ts)
    const providerModule = runtime.load(providerPath)
    const privateItem = makeItem('visit-private', 'completed')
    privateItem.phone = 'must-not-be-read'
    assert.equal(providerModule.readAppointmentOwnerReadResultV1(makeReadyResult([privateItem])).kind,
      'technical_failure')
    assert.equal(providerModule.readAppointmentOwnerReadResultV1(makeReadyResult([
      makeItem('visit-unknown', 'pending'),
    ])).kind, 'technical_failure')
    const goodResult = providerModule.readAppointmentOwnerReadResultV1(makeReadyResult([
      makeItem('visit-good', 'completed'),
    ]))
    assert.equal(goodResult.kind, 'ready')
    assert.equal(Object.keys(goodResult.visits[0]).sort().join('|'),
      'institutionDisplay|participantCount|visitDate|visitId|visitStatus|visitTimePreference')
  })

  await runCase('SYNTHETIC_FIXTURES_ARE_USED_ONLY_BY_EXPLICIT_TEST_VIEW_MODEL', async () => {
    const runtime = createWechatTsRuntime(loadWechatTypeScript().ts)
    const viewModel = runtime.load(viewModelPath)
    const result = viewModel.createAppointmentListViewModel(makeAppointmentListFixtures())
    assert.equal(result.loadState, 'ready_non_empty')
    assert.equal(result.visits.length, 5)
    assert.equal(result.visits[2].status, 'scheduled')
    assert.equal(result.visits[3].institutionLabel, '机构资料暂不可用')
    assert.equal(result.visits[3].showEvaluationAction, true)
  })

  await runCase('PAGE_AND_PRODUCTION_GRAPH_KEEP_TEST_FIXTURES_OUT', async () => {
    const productionSources = [appointmentPagePath, viewModelPath, providerPath, sessionPath]
    productionSources.forEach((file) => {
      const source = readFileSync(file, 'utf8')
      assert.equal(/scripts[\\/]fixtures|TEST_ONLY_SYNTHETIC/.test(source), false)
      assert.equal(/getPhoneNumber|phoneCode|realPhone/i.test(source), false)
      assert.equal(/sessionEvidence.{0,40}console|console.{0,40}sessionEvidence/is.test(source), false)
    })
    const wxml = readFileSync(appointmentWxmlPath, 'utf8')
    assert.match(wxml, /actionText="重试"\s+bind:action="onRetry"/)
    assert.match(wxml, /wx:if="\{\{item\.showEvaluationAction\}\}"/)
    assert.match(wxml, /data-visit-id="\{\{item\.visitId\}\}"/)
    assert.equal(APPOINTMENT_LIST_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_APPOINTMENT_LIST_VIEW_ITEMS')
  })

  await runCase('EVALUATION_SCAFFOLD_ACCEPTS_ONLY_VISIT_ID', async () => {
    const { ts } = loadWechatTypeScript()
    let evaluationConfig = null
    const runtime = createWechatTsRuntime(ts, { Page: (config) => { evaluationConfig = config } })
    runtime.load(evaluationPagePath)
    const evaluationPage = {
      ...evaluationConfig,
      data: clone(evaluationConfig.data),
      setData(patch) { Object.assign(this.data, patch) },
    }
    await evaluationPage.onLoad({ visitId: 'visit-test-completed', institutionId: 'must-not-be-trusted' })
    assert.equal(evaluationPage.data.visitId, 'visit-test-completed')
    assert.equal(Object.hasOwn(evaluationPage.data, 'institutionId'), false)
    await evaluationPage.onLoad({ visitId: '' })
    assert.equal(evaluationPage.data.visitId, '')
    assert.equal(evaluationPage.data.pageState, 'unavailable')
  })

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`APPOINTMENT_LIST_FIXTURE_POLICY: ${APPOINTMENT_LIST_FIXTURE_POLICY}`)
  console.log(`APPOINTMENT_LIST_RUNTIME_CASES: ${executedCases.length}`)
  console.log('APPOINTMENT_LIST_RUNTIME_ASSERTIONS: PASS')
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
