import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repositoryRoot, 'miniprogram')
const servicePath = path.join(appRoot, 'services', 'elder-record-read-only-diagnostic.ts')
const appointmentServicePath = path.join(appRoot, 'services', 'appointment-create-client.ts')
const pagePath = path.join(appRoot, 'pages', 'appointment', 'create.ts')
const pageWxmlPath = path.join(appRoot, 'pages', 'appointment', 'create.wxml')
const elderUrl = 'https://api.example.test/api/v1/elder-record'

const authResponse = () => ({
  statusCode: 200,
  data: {
    contractVersion: 'wechat-authenticated-principal-contract-v1',
    kind: 'wechat_authentication_result_v1',
    outcome: 'AUTHENTICATED',
    code: 'AUTHENTICATED',
    sessionEvidence: 'TEST_ONLY_opaque_session_evidence',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
})

const elderEnvelope = (authResolution, availability, elderId = null) => ({
  statusCode: 200,
  data: {
    contractVersion: 'elder-record-identity-api-v1',
    kind: 'elder_record_resolution_result_v1',
    authResolution,
    availability,
    elderId,
  },
})

const makeInjectedTransport = (elderResponder, environment = 'develop') => {
  const requests = []
  return {
    requests,
    transport: {
      environment: () => environment,
      developmentBackendOrigin: () => 'https://api.example.test',
      login: async () => 'TEST_ONLY_login_code',
      request: async (input) => {
        requests.push(input)
        if (input.url.endsWith('/api/v1/auth/wechat')) return authResponse()
        if (input.url === elderUrl) return elderResponder(input)
        throw new Error('unexpected TEST_ONLY request')
      },
    },
  }
}

const resultFor = async (typescript, elderResponder, environment = 'develop') => {
  const runtime = createWechatTsRuntime(typescript, { wx: {} })
  const service = runtime.load(servicePath)
  const harness = makeInjectedTransport(elderResponder, environment)
  const client = service.createElderRecordReadOnlyDiagnosticClientV1(harness.transport)
  return { result: await client.resolveCurrentElderRecordReadOnly(), requests: harness.requests }
}

const makePageHarness = (typescript, environment, elderResponder) => {
  const requests = []
  let loginCount = 0
  let storageWrites = 0
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
    getStorageSync: () => 'https://api.example.test',
    setStorageSync: () => { storageWrites += 1 },
    login: (options) => {
      loginCount += 1
      options.success({ code: 'TEST_ONLY_login_code' })
    },
    request: (options) => {
      requests.push(options)
      let response
      try {
        if (options.url.endsWith('/api/v1/auth/wechat')) response = authResponse()
        else if (options.url === elderUrl) response = elderResponder(options)
        else throw new Error('unexpected TEST_ONLY request')
        Promise.resolve(response).then(options.success).catch(() => options.fail({ errMsg: 'request:fail' }))
      } catch (_error) {
        options.fail({ errMsg: 'request:fail' })
      }
    },
    nextTick: (callback) => callback(),
    pageScrollTo: () => {},
    redirectTo: (options) => options.success && options.success({}),
    navigateTo: (options) => options.success && options.success({}),
    switchTab: (options) => options.success && options.success({}),
  }
  const capture = { pageConfiguration: null }
  const runtime = createWechatTsRuntime(typescript, {
    wx,
    Page: (configuration) => { capture.pageConfiguration = configuration },
    getCurrentPages: () => [],
  })
  const appointmentService = runtime.load(appointmentServicePath)
  appointmentService.recordAppointmentInstitutionDisplaySnapshotV1(
    'institution-test-001',
    8,
    'TEST_ONLY synthetic institution',
  )
  runtime.load(pagePath)
  const pageConfiguration = capture.pageConfiguration
  const page = {
    data: {
      ...pageConfiguration.data,
      form: { ...pageConfiguration.data.form },
      formErrors: {},
    },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  pageConfiguration.onLoad.call(page, {
    institutionId: 'institution-test-001',
    recordRevision: '8',
  })
  return {
    page,
    pageConfiguration,
    requests,
    get loginCount() { return loginCount },
    get storageWrites() { return storageWrites },
  }
}

const appointmentState = (page) => ({
  pageState: page.data.pageState,
  institution: JSON.stringify(page.data.institution),
  form: JSON.stringify(page.data.form),
  formErrors: JSON.stringify(page.data.formErrors),
  firstErrorAnchor: page.data.firstErrorAnchor,
  actionMessage: page.data.actionMessage,
  actionMessageTone: page.data.actionMessageTone,
  preparingElder: page.data.preparingElder,
  prepared: page.data.prepared,
  phoneSubmitting: page.data.phoneSubmitting,
  outcomeUnknown: page.data.outcomeUnknown,
  terminalConflict: page.data.terminalConflict,
  formLocked: page.data.formLocked,
  receiptReady: page.data.receiptReady,
  successNavigationFailed: page.data.successNavigationFailed,
})

const elderRequests = (requests) => requests.filter((request) => request.url === elderUrl)
const assertSafeResult = (result, kind) => {
  assert.equal(result.kind, kind)
  assert.deepEqual(Object.keys(result), ['kind'])
}

const runServiceCases = async (typescript) => {
  const exists = await resultFor(typescript, async () => elderEnvelope('authenticated', 'bound', 'TEST_ONLY_elder_id'))
  assertSafeResult(exists.result, 'exists')
  assert.equal(exists.requests.filter((request) => request.url.endsWith('/api/v1/auth/wechat')).length, 1)
  assert.equal(exists.requests.filter((request) => request.url === elderUrl).length, 1)
  assert.equal(exists.requests.find((request) => request.url === elderUrl).method, 'GET')
  assert.equal(exists.requests.find((request) => request.url === elderUrl).header['X-Auth-Evidence'], 'TEST_ONLY_opaque_session_evidence')
  assert.equal(Object.prototype.hasOwnProperty.call(exists.requests.find((request) => request.url === elderUrl), 'data'), false)

  const notFound = await resultFor(typescript, async () => elderEnvelope('authenticated', 'not_found'))
  assertSafeResult(notFound.result, 'not_found')
  assert.equal(elderRequests(notFound.requests).filter((request) => request.method === 'POST').length, 0)

  const authUnavailable = await resultFor(typescript, async () => elderEnvelope('expired', null))
  assertSafeResult(authUnavailable.result, 'auth_unavailable')

  const technicalFailure = await resultFor(typescript, async () => elderEnvelope('technical_failure', null))
  assertSafeResult(technicalFailure.result, 'service_unavailable')

  const malformed = await resultFor(typescript, async () => ({
    statusCode: 200,
    data: { contractVersion: 'wrong', elderId: 'TEST_ONLY_private_value' },
  }))
  assertSafeResult(malformed.result, 'malformed')
  assert.equal(JSON.stringify(malformed.result).includes('TEST_ONLY_private_value'), false)

  const malformedTransportResult = await resultFor(typescript, async () => ({
    statusCode: '200',
    data: elderEnvelope('authenticated', 'not_found').data,
  }))
  assertSafeResult(malformedTransportResult.result, 'malformed')

  const networkFailure = await resultFor(typescript, async () => { throw new Error('TEST_ONLY private transport detail') })
  assertSafeResult(networkFailure.result, 'service_unavailable')
  assert.equal(JSON.stringify(networkFailure.result).includes('TEST_ONLY'), false)

  const forbidden = await resultFor(typescript, async () => ({ statusCode: 403, data: null }))
  assertSafeResult(forbidden.result, 'auth_unavailable')

  for (const rejectedStatus of [401, 403]) {
    const runtime = createWechatTsRuntime(typescript, { wx: {} })
    const service = runtime.load(servicePath)
    const requests = []
    let loginCount = 0
    let authRequestCount = 0
    let elderRequestCount = 0
    const transport = {
      environment: () => 'develop',
      developmentBackendOrigin: () => 'https://api.example.test',
      login: async () => {
        loginCount += 1
        return `TEST_ONLY_login_code_${loginCount}`
      },
      request: async (input) => {
        requests.push(input)
        if (input.url.endsWith('/api/v1/auth/wechat')) {
          authRequestCount += 1
          const response = authResponse()
          response.data.sessionEvidence = `TEST_ONLY_session_evidence_${authRequestCount}`
          return response
        }
        if (input.url === elderUrl) {
          elderRequestCount += 1
          return elderRequestCount === 1
            ? { statusCode: rejectedStatus, data: null }
            : elderEnvelope('authenticated', 'bound', 'TEST_ONLY_elder_id')
        }
        throw new Error('unexpected TEST_ONLY request')
      },
    }
    const client = service.createElderRecordReadOnlyDiagnosticClientV1(transport)
    const rejected = await client.resolveCurrentElderRecordReadOnly()
    assertSafeResult(rejected, 'auth_unavailable')
    const retried = await client.resolveCurrentElderRecordReadOnly()
    assertSafeResult(retried, 'exists')
    assert.equal(loginCount, 2)
    assert.equal(authRequestCount, 2)
    assert.equal(elderRequestCount, 2)
    const diagnosticGets = elderRequests(requests)
    assert.equal(diagnosticGets[0].method, 'GET')
    assert.equal(diagnosticGets[1].method, 'GET')
    assert.equal(diagnosticGets[0].header['X-Auth-Evidence'], 'TEST_ONLY_session_evidence_1')
    assert.equal(diagnosticGets[1].header['X-Auth-Evidence'], 'TEST_ONLY_session_evidence_2')
  }

  for (const environment of ['trial', 'release']) {
    const blocked = await resultFor(typescript, async () => elderEnvelope('authenticated', 'bound', 'must-not-read'), environment)
    assertSafeResult(blocked.result, 'service_unavailable')
    assert.equal(blocked.requests.length, 0)
  }
}

const runPageEnvironmentCases = async (typescript) => {
  for (const environment of ['trial', 'release']) {
    const harness = makePageHarness(typescript, environment, async () => elderEnvelope('authenticated', 'bound', 'must-not-read'))
    assert.equal(harness.page.data.showElderReadOnlyDiagnostic, false)
    assert.equal(harness.requests.length, 0)
    const before = appointmentState(harness.page)
    assert.equal(harness.page.data.elderDiagnosticState, 'idle')
    await harness.pageConfiguration.onReadOnlyElderDiagnostic.call(harness.page)
    assert.deepEqual(appointmentState(harness.page), before)
    assert.equal(harness.page.data.elderDiagnosticState, 'idle')
    assert.equal(harness.requests.length, 0)
    assert.equal(harness.loginCount, 0)
  }
}

const runPageClassificationAndIsolationCases = async (typescript) => {
  const harness = makePageHarness(
    typescript,
    'develop',
    async () => elderEnvelope('authenticated', 'bound', 'TEST_ONLY_elder_id_not_for_ui'),
  )
  assert.equal(harness.page.data.showElderReadOnlyDiagnostic, true)
  assert.equal(harness.page.data.elderDiagnosticState, 'idle')
  assert.equal(harness.page.data.form.contactName, '')
  assert.equal(harness.page.data.form.phone, '')
  assert.equal(harness.requests.length, 0)
  assert.equal(harness.loginCount, 0)

  const before = appointmentState(harness.page)
  await harness.pageConfiguration.onReadOnlyElderDiagnostic.call(harness.page)
  assert.equal(harness.page.data.elderDiagnosticState, 'exists')
  assert.deepEqual(appointmentState(harness.page), before)
  assert.equal(elderRequests(harness.requests).length, 1)
  assert.equal(elderRequests(harness.requests)[0].method, 'GET')
  assert.equal(elderRequests(harness.requests).filter((request) => request.method === 'POST').length, 0)
  assert.equal(harness.requests.some((request) => request.url.includes('/appointment-submissions')), false)
  assert.equal(harness.requests.some((request) => request.url.includes('/phone')), false)
  assert.equal(harness.storageWrites, 0)
  assert.equal(JSON.stringify(harness.page.data).includes('TEST_ONLY_elder_id_not_for_ui'), false)
  assert.equal(JSON.stringify(harness.page.data).includes('session_evidence'), false)
  assert.equal(JSON.stringify(harness.page.data).includes('TEST_ONLY_login_code'), false)

  const wxml = readFileSync(pageWxmlPath, 'utf8')
  assert.match(wxml, /wx:if="\{\{showElderReadOnlyDiagnostic\}\}"[\s\S]*?bind:action="onReadOnlyElderDiagnostic"/)
  const diagnosticSection = wxml.slice(wxml.indexOf('开发诊断'), wxml.indexOf('开发诊断') + 1100)
  assert.doesNotMatch(diagnosticSection, /bindgetphonenumber|onPrepareAppointment|appointment-submissions/)
  assert.match(diagnosticSection, /老人档案已绑定/)
  assert.match(diagnosticSection, /当前账号暂无老人档案/)
  assert.match(diagnosticSection, /登录状态暂不可用/)
  assert.match(diagnosticSection, /服务暂不可用/)
  assert.match(diagnosticSection, /读取结果异常/)
}

const runSingleFlightAndRetryCases = async (typescript) => {
  let resolveElder
  const delayed = new Promise((resolve) => { resolveElder = resolve })
  const rapidTap = makePageHarness(typescript, 'develop', async () => delayed)
  const firstAction = rapidTap.pageConfiguration.onReadOnlyElderDiagnostic.call(rapidTap.page)
  for (let attempt = 0; attempt < 20 && elderRequests(rapidTap.requests).length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  assert.equal(elderRequests(rapidTap.requests).length, 1)
  const duplicateAction = rapidTap.pageConfiguration.onReadOnlyElderDiagnostic.call(rapidTap.page)
  await duplicateAction
  assert.equal(elderRequests(rapidTap.requests).length, 1)
  resolveElder(elderEnvelope('authenticated', 'not_found'))
  await firstAction
  assert.equal(rapidTap.page.data.elderDiagnosticState, 'not_found')

  let elderCall = 0
  const retry = makePageHarness(typescript, 'develop', async () => {
    elderCall += 1
    if (elderCall === 1) throw new Error('TEST_ONLY temporary network error')
    return elderEnvelope('authenticated', 'not_found')
  })
  await retry.pageConfiguration.onReadOnlyElderDiagnostic.call(retry.page)
  assert.equal(retry.page.data.elderDiagnosticState, 'service_unavailable')
  await retry.pageConfiguration.onReadOnlyElderDiagnostic.call(retry.page)
  assert.equal(retry.page.data.elderDiagnosticState, 'not_found')
  assert.equal(elderRequests(retry.requests).length, 2)
  assert.equal(elderRequests(retry.requests).every((request) => request.method === 'GET'), true)
}

const run = async () => {
  const { ts } = loadWechatTypeScript()
  await runServiceCases(ts)
  await runPageEnvironmentCases(ts)
  await runPageClassificationAndIsolationCases(ts)
  await runSingleFlightAndRetryCases(ts)
  console.log('ELDER_READ_ONLY_DIAGNOSTIC_TEST_PROVENANCE = TEST_ONLY_SYNTHETIC')
  console.log('ELDER_READ_ONLY_DIAGNOSTIC_SERVICE_CLASSIFICATION = PASS')
  console.log('ELDER_READ_ONLY_DIAGNOSTIC_ENVIRONMENT_FIREWALL = PASS')
  console.log('ELDER_READ_ONLY_DIAGNOSTIC_PAGE_ISOLATION = PASS')
  console.log('ELDER_READ_ONLY_DIAGNOSTIC_SINGLE_FLIGHT_RETRY = PASS')
}

run().catch((error) => {
  console.error(`ELDER_READ_ONLY_DIAGNOSTIC_RUNTIME = FAIL\n${error instanceof Error ? error.stack : String(error)}`)
  process.exitCode = 1
})
