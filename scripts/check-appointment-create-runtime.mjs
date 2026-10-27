import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { appointmentPhoneFormatCases, syntheticMobile } from './fixtures/appointment-phone-format-v1-fixtures.mjs'
import { makeDraftFixture, makeCompletedVisitFixture } from './fixtures/appointment-institution-visit-c2-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repositoryRoot, 'miniprogram')
const servicePath = path.join(appRoot, 'services', 'appointment-create-client.ts')
const createPagePath = path.join(appRoot, 'pages', 'appointment', 'create.ts')
const successPagePath = path.join(appRoot, 'pages', 'appointment', 'success.ts')
const institutionDetailPagePath = path.join(appRoot, 'pages', 'institution', 'detail.ts')
const consultantPagePath = path.join(appRoot, 'pages', 'consultant', 'index.ts')
const navigationBarPath = path.join(appRoot, 'components', 'navigation-bar', 'navigation-bar.ts')
const fixedIdentity = { institutionId: 'institution-test-001', recordRevision: 8 }
const fixedForm = {
  visitDate: '2026-10-01',
  visitTimePreference: '上午',
  participantCount: '2',
  contactName: '测试联系人',
  phone: '13800000000',
  notes: '',
}

const authResponse = () => ({
  statusCode: 200,
  data: {
    contractVersion: 'wechat-authenticated-principal-contract-v1',
    kind: 'wechat_authentication_result_v1',
    outcome: 'AUTHENTICATED',
    code: 'AUTHENTICATED',
    sessionEvidence: 'opaque-test-session-evidence',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
})

const elderEnvelope = (availability, elderId = null) => ({
  statusCode: 200,
  data: {
    contractVersion: 'elder-record-identity-api-v1',
    kind: 'elder_record_resolution_result_v1',
    authResolution: 'authenticated',
    availability,
    elderId,
  },
})

const establishmentEnvelope = (establishment, elderId) => ({
  statusCode: 200,
  data: {
    contractVersion: 'elder-record-identity-api-v1',
    kind: 'elder_record_establishment_result_v1',
    authResolution: 'authenticated',
    establishment,
    elderId,
  },
})

const makeReceipt = (submission) => ({
  contractVersion: 'appointment-institution-visit-contract-v1',
  kind: 'appointment_submission_receipt_v1',
  visitId: 'visit-test-receipt-001',
  institutionId: submission.institutionId,
  institutionRecordRevision: submission.institutionRecordRevision,
  status: 'requested',
  acceptedAt: '2026-09-27T08:00:00.000Z',
  publicMessage: '预约申请已提交',
})

const publicResult = (submission, outcome = 'accepted') => ({
  outcome,
  code: outcome === 'replayed' ? 'REPLAYED' : 'ACCEPTED',
  receipt: makeReceipt(submission),
})

const makeServiceTransport = (options = {}) => {
  const requests = []
  let c3Call = 0
  return {
    requests,
    transport: {
      environment: () => 'develop',
      developmentBackendOrigin: () => 'http://10.123.45.67:8080',
      login: async () => 'synthetic-login-code',
      request: async (input) => {
        requests.push(input)
        if (input.url.endsWith('/api/v1/auth/wechat')) return authResponse()
        if (input.url.endsWith('/api/v1/elder-record')) {
          if (input.method === 'GET') {
            return options.elderBound
              ? elderEnvelope('bound', 'elder-opaque-test-001')
              : elderEnvelope('not_found')
          }
          return establishmentEnvelope('created', 'elder-opaque-test-001')
        }
        if (input.url.endsWith('/api/v1/appointment-submissions')) {
          c3Call += 1
          if (options.firstC3Throws && c3Call === 1) throw new Error('test-only dropped response')
          if (typeof options.onC3 === 'function') return options.onC3(input, c3Call)
          return { statusCode: 200, data: publicResult(input.data, options.replay ? 'replayed' : 'accepted') }
        }
        throw new Error(`unexpected test route: ${input.url}`)
      },
    },
  }
}

const runServiceCases = async (runtime, service) => {
  const validation = service.validateAppointmentCreateFormV1
  const institution = {
    identity: fixedIdentity,
    displayName: '测试机构（仅测试数据）',
  }

  const noRequest = makeServiceTransport({})
  const invalidClient = service.createProductionAppointmentCreateClientV1(noRequest.transport)
  const invalid = await invalidClient.submit({
    institution,
    elderId: 'elder-opaque-test-001',
    form: { ...fixedForm, participantCount: '' },
    phoneCode: 'must-not-send',
  })
  assert.equal(invalid.kind, 'rejected')
  assert.equal(invalid.code, 'VALIDATION_FAILED')
  assert.equal(noRequest.requests.length, 0)
  assert.equal(validation({ ...fixedForm, participantCount: '' }, institution).valid, false)

  const createTrace = makeServiceTransport({ elderBound: false })
  const createClient = service.createProductionAppointmentCreateClientV1(createTrace.transport)
  const ready = await createClient.resolveOrEstablishElderAfterIntent()
  assert.equal(ready.kind, 'ready')
  assert.equal(ready.elderId, 'elder-opaque-test-001')
  const elderCalls = createTrace.requests.filter((item) => item.url.endsWith('/api/v1/elder-record'))
  assert.equal(elderCalls.length, 2)
  assert.equal(elderCalls[0].method, 'GET')
  assert.equal(elderCalls[1].method, 'POST')
  assert.equal(Object.prototype.hasOwnProperty.call(elderCalls[1], 'data'), false)
  assert.equal(elderCalls.every((item) => item.header['X-Auth-Evidence'] === 'opaque-test-session-evidence'), true)

  const submitTrace = makeServiceTransport({ elderBound: true })
  const submitClient = service.createProductionAppointmentCreateClientV1(submitTrace.transport)
  const submitElder = await submitClient.resolveOrEstablishElderAfterIntent()
  assert.equal(submitElder.kind, 'ready')
  const submitted = await submitClient.submit({
    institution,
    elderId: submitElder.elderId,
    form: fixedForm,
    phoneCode: 'fresh-native-phone-code-001',
  })
  assert.equal(submitted.kind, 'accepted')
  assert.equal(submitted.replayed, false)
  const c3Request = submitTrace.requests.find((item) => item.url.endsWith('/api/v1/appointment-submissions'))
  assert.ok(c3Request)
  assert.equal(c3Request.method, 'POST')
  assert.equal(c3Request.header['X-Auth-Evidence'], 'opaque-test-session-evidence')
  assert.equal(c3Request.header['X-Phone-Auth-Evidence'], 'fresh-native-phone-code-001')
  assert.equal(c3Request.data.institutionRecordRevision, '8')
  assert.equal(c3Request.data.institutionId, fixedIdentity.institutionId)
  assert.equal(c3Request.data.phone, fixedForm.phone)
  assert.equal(c3Request.data.phonePurpose, 'appointment_or_consultant_contact')
  assert.equal(c3Request.data.phoneAuthorization, 'explicit')
  assert.equal(Object.prototype.hasOwnProperty.call(c3Request.data, 'userId'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(c3Request.data, 'visitId'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(c3Request.data, 'phoneCode'), false)
  assert.equal(submitTrace.requests.some((item) => item.url.endsWith('/api/v1/auth/wechat/phone/verify')), false)
  assert.equal(submitTrace.requests.filter((item) => item.url.endsWith('/api/v1/elder-record') && item.method === 'POST').length, 0)

  const retryTrace = makeServiceTransport({ elderBound: true, firstC3Throws: true, replay: true })
  const retryClient = service.createProductionAppointmentCreateClientV1(retryTrace.transport)
  const retryElder = await retryClient.resolveOrEstablishElderAfterIntent()
  const first = await retryClient.submit({
    institution,
    elderId: retryElder.elderId,
    form: fixedForm,
    phoneCode: 'fresh-native-phone-code-before-timeout',
  })
  assert.equal(first.kind, 'outcome_unknown')
  const changedWhileUnknown = await retryClient.submit({
    institution,
    elderId: retryElder.elderId,
    form: { ...fixedForm, visitTimePreference: '下午' },
    phoneCode: 'fresh-code-must-not-dispatch',
  })
  assert.equal(changedWhileUnknown.kind, 'attempt_unresolved')
  const replay = await retryClient.submit({
    institution,
    elderId: retryElder.elderId,
    form: fixedForm,
    phoneCode: 'fresh-native-phone-code-for-replay',
  })
  assert.equal(replay.kind, 'accepted')
  assert.equal(replay.replayed, true)
  const retryCalls = retryTrace.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions'))
  assert.equal(retryCalls.length, 2)
  assert.equal(retryCalls[0].data.idempotencyKey, retryCalls[1].data.idempotencyKey)
  assert.deepEqual(retryCalls[0].data, retryCalls[1].data)
  assert.notEqual(retryCalls[0].header['X-Phone-Auth-Evidence'], retryCalls[1].header['X-Phone-Auth-Evidence'])
  assert.equal(retryCalls[1].header['X-Phone-Auth-Evidence'], 'fresh-native-phone-code-for-replay')
  assert.equal(retryCalls[0].data.visitTimePreference, '上午')
  assert.equal(retryCalls[1].data.visitTimePreference, '上午')

  const editTrace = makeServiceTransport({
    elderBound: true,
    onC3: (input, call) => call === 1
      ? { statusCode: 200, data: { outcome: 'rejected', code: 'CONTACT_REQUIRED', receipt: null } }
      : { statusCode: 200, data: publicResult(input.data) },
  })
  const editClient = service.createProductionAppointmentCreateClientV1(editTrace.transport)
  const editElder = await editClient.resolveOrEstablishElderAfterIntent()
  const knownReject = await editClient.submit({ institution, elderId: editElder.elderId, form: fixedForm, phoneCode: 'fresh-code-1' })
  assert.equal(knownReject.kind, 'rejected')
  assert.equal(knownReject.code, 'CONTACT_REQUIRED')
  const editedForm = { ...fixedForm, visitTimePreference: '下午' }
  const editedAccepted = await editClient.submit({ institution, elderId: editElder.elderId, form: editedForm, phoneCode: 'fresh-code-2' })
  assert.equal(editedAccepted.kind, 'accepted')
  const editCalls = editTrace.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions'))
  assert.equal(editCalls.length, 2)
  assert.notEqual(editCalls[0].data.idempotencyKey, editCalls[1].data.idempotencyKey)
  assert.equal(editCalls[0].data.visitTimePreference, '上午')
  assert.equal(editCalls[1].data.visitTimePreference, '下午')

  const appAdapter = runtime.load(path.join(appRoot, 'services', 'appointment-institution-visit-application.ts'))
  const rawSubmission = {
    contractVersion: 'appointment-institution-visit-contract-v1',
    kind: 'appointment_submission_v1',
    idempotencyKey: 'app-adapter-test-key',
    institutionId: fixedIdentity.institutionId,
    institutionRecordRevision: String(fixedIdentity.recordRevision),
    elderId: 'elder-opaque-test-001',
    visitDate: fixedForm.visitDate,
    visitTimePreference: fixedForm.visitTimePreference,
    participantCount: Number(fixedForm.participantCount),
    contactName: fixedForm.contactName,
    phone: fixedForm.phone,
    phonePurpose: 'appointment_or_consultant_contact',
    phoneAuthorization: 'explicit',
  }
  const adapter = appAdapter.createAppointmentVisitApplicationServiceV1()
  const badReceiptResults = [
    publicResult(rawSubmission, 'accepted'),
    publicResult(rawSubmission, 'accepted'),
    publicResult(rawSubmission, 'accepted'),
  ]
  delete badReceiptResults[0].receipt.visitId
  delete badReceiptResults[1].receipt.acceptedAt
  badReceiptResults[2].receipt.publicMessage = '预约成功'
  badReceiptResults.forEach((response) => {
    assert.equal(adapter.submit({ submission: rawSubmission, response }).kind, 'outcome_unknown')
  })
  const unknownOutcome = adapter.submit({
    submission: rawSubmission,
    response: { outcome: 'success', code: 'OK', receipt: makeReceipt(rawSubmission) },
  })
  assert.equal(unknownOutcome.kind, 'outcome_unknown')
}

const makePageWx = (responses) => {
  const requests = []
  const redirects = []
  const navigations = []
  const tabSwitches = []
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => 'http://10.123.45.67:8080',
    login: (options) => options.success({ code: 'synthetic-login-code' }),
    request: (options) => {
      requests.push(options)
      Promise.resolve().then(async () => {
        const response = await responses(options)
        options.success(response)
      }).catch(() => options.fail({ errMsg: 'request:fail' }))
    },
    nextTick: (callback) => callback(),
    pageScrollTo: () => {},
    redirectTo: (options) => {
      redirects.push(options.url)
      options.success && options.success({})
      options.complete && options.complete({})
    },
    navigateTo: (options) => {
      navigations.push(options.url)
      options.success && options.success({})
      options.complete && options.complete({})
    },
    switchTab: (options) => {
      tabSwitches.push(options.url)
      options.success && options.success({})
      options.complete && options.complete({})
    },
  }
  return { wx, requests, redirects, navigations, tabSwitches }
}

const makePageInstance = (configuration) => ({
  data: { ...configuration.data },
  setData(patch) {
    this.data = { ...this.data, ...patch }
  },
})

const fillValidForm = (pageConfiguration, page) => {
  pageConfiguration.onVisitDateChange.call(page, { detail: { value: fixedForm.visitDate } })
  pageConfiguration.onVisitTimePreferenceInput.call(page, { detail: { value: fixedForm.visitTimePreference } })
  pageConfiguration.onParticipantCountInput.call(page, { detail: { value: fixedForm.participantCount } })
  pageConfiguration.onContactNameInput.call(page, { detail: { value: fixedForm.contactName } })
  pageConfiguration.onPhoneInput.call(page, { detail: { value: fixedForm.phone } })
  pageConfiguration.onNotesInput.call(page, { detail: { value: fixedForm.notes } })
}

const runPageCases = async (typescript) => {
  const state = { pageConfiguration: null }
  let stack = []
  const wxHarness = makePageWx((options) => {
    if (options.url.endsWith('/api/v1/auth/wechat')) return authResponse()
    if (options.url.endsWith('/api/v1/elder-record')) {
      if (options.method === 'GET') return elderEnvelope('not_found')
      return establishmentEnvelope('created', 'elder-page-test-001')
    }
    if (options.url.endsWith('/api/v1/appointment-submissions')) {
      return { statusCode: 200, data: publicResult(options.data, 'accepted') }
    }
    return { statusCode: 404, data: {} }
  })
  const runtime = createWechatTsRuntime(typescript, {
    wx: wxHarness.wx,
    Page: (configuration) => { state.pageConfiguration = configuration },
    getCurrentPages: () => stack,
  })
  const service = runtime.load(servicePath)
  service.recordAppointmentInstitutionDisplaySnapshotV1(
    fixedIdentity.institutionId,
    fixedIdentity.recordRevision,
    '测试机构（仅测试数据）',
  )
  runtime.load(createPagePath)
  const createPage = state.pageConfiguration
  const page = makePageInstance(createPage)
  stack = [page]
  createPage.onLoad.call(page, {
    institutionId: fixedIdentity.institutionId,
    recordRevision: String(fixedIdentity.recordRevision),
  })
  assert.equal(page.data.pageState, 'ready')
  assert.equal(wxHarness.requests.length, 0)
  await createPage.onPrepareAppointment.call(page)
  assert.equal(page.data.formErrors.visitDate !== undefined, true)
  assert.equal(page.data.formErrors.participantCount !== undefined, true)
  assert.equal(page.data.firstErrorAnchor, 'appointment-field-visitDate')
  assert.equal(wxHarness.requests.length, 0)

  fillValidForm(createPage, page)
  const prepareA = createPage.onPrepareAppointment.call(page)
  const prepareB = createPage.onPrepareAppointment.call(page)
  await Promise.all([prepareA, prepareB])
  assert.equal(page.data.prepared, true)
  assert.equal(wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/elder-record') && item.method === 'POST').length, 1)
  const beforePhone = wxHarness.requests.length
  await createPage.onPhoneAuthorization.call(page, { detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  assert.equal(wxHarness.requests.length, beforePhone)
  assert.match(page.data.actionMessage, /未授权手机号/)
  assert.equal(page.data.form.phone, fixedForm.phone)
  await createPage.onPhoneAuthorization.call(page, { detail: { errMsg: 'getPhoneNumber:fail not supported' } })
  assert.equal(wxHarness.requests.length, beforePhone)
  assert.match(page.data.actionMessage, /未取得本次预约所需/)
  assert.equal(page.data.prepared, true)
  assert.equal(page.data.form.phone, fixedForm.phone)

  const firstPhoneCallback = createPage.onPhoneAuthorization.call(page, {
    detail: { code: 'fresh-native-page-code' },
  })
  const duplicatePhoneCallback = createPage.onPhoneAuthorization.call(page, {
    detail: { code: 'duplicate-native-page-code' },
  })
  await Promise.all([firstPhoneCallback, duplicatePhoneCallback])
  assert.equal(wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions')).length, 1)
  assert.equal(wxHarness.redirects.length, 1)
  assert.match(wxHarness.redirects[0], /^\/pages\/appointment\/success\?handoffId=appointment-result-/)

  runtime.load(successPagePath)
  const successPage = state.pageConfiguration
  const handoffId = new URL(`http://local${wxHarness.redirects[0]}`).searchParams.get('handoffId')
  const successInstance = makePageInstance(successPage)
  successPage.onLoad.call(successInstance, { handoffId })
  assert.equal(successInstance.data.pageState, 'ready')
  assert.equal(successInstance.data.handoff.receipt.publicMessage, '预约申请已提交')
  assert.equal(successInstance.data.handoff.summary.participantCount, 2)
  assert.equal(Object.prototype.hasOwnProperty.call(successInstance.data.handoff.summary, 'phone'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(successInstance.data.handoff.summary, 'contactName'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(successInstance.data.handoff.summary, 'elderId'), false)
  successPage.onContactConsultant.call(successInstance)
  successPage.onContactConsultant.call(successInstance)
  successPage.onViewAppointments.call(successInstance)
  successPage.onViewAppointments.call(successInstance)
  successPage.onReturnHome.call(successInstance)
  successPage.onReturnHome.call(successInstance)
  assert.deepEqual(wxHarness.tabSwitches, ['/pages/home/index'])
  assert.deepEqual(wxHarness.navigations, ['/pages/consultant/consultation', '/pages/appointment/index'])

  const invalidSuccess = makePageInstance(successPage)
  successPage.onLoad.call(invalidSuccess, { visitId: 'forged-route-visit' })
  assert.equal(invalidSuccess.data.pageState, 'unavailable')
  successPage.onContactConsultant.call(invalidSuccess)
  assert.equal(wxHarness.tabSwitches.length, 1)

  service.recordAppointmentInstitutionDisplaySnapshotV1(
    fixedIdentity.institutionId,
    fixedIdentity.recordRevision,
    'must-not-be-used',
  )
  const invalidRoutePage = makePageInstance(createPage)
  stack = [invalidRoutePage]
  const beforeInvalidRoute = wxHarness.requests.length
  createPage.onLoad.call(invalidRoutePage, { institutionId: fixedIdentity.institutionId })
  assert.equal(invalidRoutePage.data.pageState, 'route_error')
  assert.equal(wxHarness.requests.length, beforeInvalidRoute)
}

const runInstitutionReturnRouteCases = (typescript) => {
  const trace = { back: [], push: [], redirect: [] }
  let stack = []
  let pageConfiguration = null
  const runtime = createWechatTsRuntime(typescript, {
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
      getSystemInfoSync: () => ({ platform: 'ios', safeArea: { top: 0 } }),
      request: () => { throw new Error('TEST_ONLY invalid entry must not call request') },
      navigateBack: (options) => trace.back.push(options),
      navigateTo: (options) => trace.push.push(options),
      redirectTo: (options) => trace.redirect.push(options),
      showToast: () => {},
    },
    Page: (configuration) => { pageConfiguration = configuration },
    getCurrentPages: () => stack,
  })
  runtime.load(createPagePath)
  const createPage = pageConfiguration
  const list = { route: 'pages/institution/index', sourceContext: 'TEST_ONLY_RECOMMENDATION', selectedRevision: '8' }
  const detail = { route: 'pages/institution/detail' }
  const nestedPage = makePageInstance(createPage)
  createPage.onLoad.call(nestedPage, {})
  stack = [{ route: 'pages/index/index' }, list, detail, nestedPage]
  createPage.onShow.call(nestedPage)
  assert.equal(nestedPage.data.returnInstitutionButtonText, '返回合作机构列表')
  assert.match(readFileSync(path.join(appRoot, 'pages', 'appointment', 'create.wxml'), 'utf8'),
    /text="\{\{returnInstitutionButtonText\}\}" bind:action="onReturnToInstitution"/)
  createPage.onReturnToInstitution.call(nestedPage)
  assert.equal(trace.back.length, 1)
  assert.equal(trace.back[0].delta, 2)
  assert.equal(trace.push.length, 0)
  assert.equal(trace.redirect.length, 0)
  trace.back[0].fail({ errMsg: 'TEST_ONLY back failure' })
  trace.back[0].complete({ errMsg: 'TEST_ONLY back failure' })
  assert.match(nestedPage.data.actionMessage, /暂时无法返回养老机构/)
  createPage.onReturnToInstitution.call(nestedPage)
  assert.equal(trace.back.length, 2, 'failed ancestor return releases the route guard')
  trace.back[1].success({})
  trace.back[1].complete({})

  const rootPage = makePageInstance(createPage)
  createPage.onLoad.call(rootPage, {})
  stack = [rootPage]
  createPage.onShow.call(rootPage)
  assert.equal(rootPage.data.returnInstitutionButtonText, '重新浏览合作机构')
  createPage.onReturnToInstitution.call(rootPage)
  assert.equal(trace.redirect.length, 1, 'a root invalid route is replaced by the directory')
  assert.equal(trace.redirect[0].url, '/pages/institution/index')
  assert.equal(trace.push.length, 0, 'do not push another page over the dead-end route')
  trace.redirect[0].fail({ errMsg: 'TEST_ONLY redirect failure' })
  trace.redirect[0].complete({ errMsg: 'TEST_ONLY redirect failure' })
  assert.match(rootPage.data.actionMessage, /暂时无法返回养老机构/)
  createPage.onReturnToInstitution.call(rootPage)
  assert.equal(trace.redirect.length, 2, 'failed root replacement releases the route guard')
  assert.equal(readFileSync(path.join(appRoot, 'pages', 'appointment', 'create.wxml'), 'utf8').includes(
    'bind:navigationfail="onNavigationFailure"',
  ), true, 'appointment header Back failure is wired to visible feedback')
}

const runAppointmentLifecycleCases = async (typescript) => {
  const makeScenario = (responses) => {
    const capture = { pageConfiguration: null }
    let stack = []
    const wxHarness = makePageWx(responses)
    const runtime = createWechatTsRuntime(typescript, {
      wx: wxHarness.wx,
      Page: (configuration) => { capture.pageConfiguration = configuration },
      getCurrentPages: () => stack,
    })
    const service = runtime.load(servicePath)
    let handoffId = null
    const createHandoff = service.createAppointmentSuccessHandoffV1
    service.createAppointmentSuccessHandoffV1 = (...args) => {
      const created = createHandoff(...args)
      handoffId = created.id
      return created
    }
    service.recordAppointmentInstitutionDisplaySnapshotV1(
      fixedIdentity.institutionId,
      fixedIdentity.recordRevision,
      '测试机构（仅测试数据）',
    )
    runtime.load(createPagePath)
    const configuration = capture.pageConfiguration
    const page = makePageInstance(configuration)
    stack = [page]
    configuration.onLoad.call(page, {
      institutionId: fixedIdentity.institutionId,
      recordRevision: String(fixedIdentity.recordRevision),
    })
    configuration.onShow.call(page)
    fillValidForm(configuration, page)
    return { configuration, page, runtime, service, wxHarness, setStack: (pages) => { stack = pages }, getHandoffId: () => handoffId }
  }

  const createAcceptedGate = () => {
    let startedResolve
    let releaseResolve
    let submissionOptions = null
    const started = new Promise((resolve) => { startedResolve = resolve })
    const response = new Promise((resolve) => { releaseResolve = resolve })
    return {
      started,
      release: (value) => releaseResolve(value),
      capture: (options) => {
        submissionOptions = options
        startedResolve()
        return response
      },
      get submissionOptions() { return submissionOptions },
    }
  }
  const fixedResponses = (gate) => async (options) => {
    if (options.url.endsWith('/api/v1/auth/wechat')) return authResponse()
    if (options.url.endsWith('/api/v1/elder-record')) return elderEnvelope('bound', 'elder-lifecycle-test-001')
    if (options.url.endsWith('/api/v1/appointment-submissions')) return gate.capture(options)
    return { statusCode: 404, data: {} }
  }
  const waitForSubmission = async (gate) => Promise.race([
    gate.started,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TEST_ONLY submission did not start')), 2000)),
  ])

  const hiddenGate = createAcceptedGate()
  const hidden = makeScenario(fixedResponses(hiddenGate))
  await hidden.configuration.onPrepareAppointment.call(hidden.page)
  assert.equal(hidden.page.data.prepared, true)
  const pending = hidden.configuration.onPhoneAuthorization.call(hidden.page, { detail: { code: 'TEST_ONLY_FRESH_PHONE_CODE' } })
  await waitForSubmission(hiddenGate)
  await hidden.configuration.onPhoneAuthorization.call(hidden.page, { detail: { code: 'TEST_ONLY_DUPLICATE_CODE' } })
  assert.equal(hidden.wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions')).length, 1,
    'pending callback must block duplicate business submission')
  hidden.configuration.onHide.call(hidden.page)
  hidden.setStack([hidden.page, { route: 'pages/appointment/success' }])
  hiddenGate.release({ statusCode: 200, data: publicResult(hiddenGate.submissionOptions.data, 'accepted') })
  await pending
  assert.equal(hidden.page.data.receiptReady, true, 'hidden live page retains accepted receipt state')
  assert.equal(hidden.wxHarness.redirects.length, 0, 'accepted response while hidden must not redirect behind another page')
  hidden.setStack([hidden.page])
  hidden.configuration.onShow.call(hidden.page)
  assert.equal(hidden.wxHarness.redirects.length, 1, 're-show may open the retained accepted result')
  assert.match(hidden.wxHarness.redirects[0], /^\/pages\/appointment\/success\?handoffId=/)
  assert.equal(hidden.wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions')).length, 1,
    're-show must not resubmit the appointment')

  const nonTopGate = createAcceptedGate()
  const nonTop = makeScenario(fixedResponses(nonTopGate))
  await nonTop.configuration.onPrepareAppointment.call(nonTop.page)
  const activeButCoveredSubmit = nonTop.configuration.onPhoneAuthorization.call(nonTop.page, {
    detail: { code: 'TEST_ONLY_COVERED_PAGE_CODE' },
  })
  await waitForSubmission(nonTopGate)
  nonTop.setStack([nonTop.page, { route: 'pages/other/overlay' }])
  nonTopGate.release({ statusCode: 200, data: publicResult(nonTopGate.submissionOptions.data, 'accepted') })
  await activeButCoveredSubmit
  assert.equal(nonTop.page.data.receiptReady, true)
  assert.equal(nonTop.wxHarness.redirects.length, 0, 'stack top must be this exact page before redirect')
  const redirectImmediately = nonTop.wxHarness.wx.redirectTo
  let failFirstResultNavigation = true
  nonTop.wxHarness.wx.redirectTo = (options) => {
    if (failFirstResultNavigation) {
      failFirstResultNavigation = false
      nonTop.wxHarness.redirects.push(options.url)
      options.fail && options.fail({ errMsg: 'TEST_ONLY result route failure' })
      options.complete && options.complete({ errMsg: 'TEST_ONLY result route failure' })
      return
    }
    redirectImmediately(options)
  }
  nonTop.setStack([nonTop.page])
  nonTop.configuration.onShow.call(nonTop.page)
  assert.equal(nonTop.wxHarness.redirects.length, 1, 'visible page may navigate to its retained result')
  assert.equal(nonTop.page.data.successNavigationFailed, true, 'failed result navigation remains an accepted, retryable receipt')
  nonTop.configuration.onRetrySuccessNavigation.call(nonTop.page)
  assert.equal(nonTop.wxHarness.redirects.length, 2, 'result navigation retry does not repeat business submission')
  assert.equal(nonTop.wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions')).length, 1)

  const unloadedGate = createAcceptedGate()
  const unloaded = makeScenario(fixedResponses(unloadedGate))
  await unloaded.configuration.onPrepareAppointment.call(unloaded.page)
  const lateAccepted = unloaded.configuration.onPhoneAuthorization.call(unloaded.page, {
    detail: { code: 'TEST_ONLY_LATE_ACCEPTED_PHONE_CODE' },
  })
  await waitForSubmission(unloadedGate)
  let isUnloaded = false
  const originalSetData = unloaded.page.setData
  unloaded.page.setData = function (patch) {
    assert.equal(isUnloaded, false, 'late accepted response must not call setData after unload')
    originalSetData.call(this, patch)
  }
  unloaded.configuration.onHide.call(unloaded.page)
  unloaded.setStack([unloaded.page, { route: 'pages/home/index' }])
  unloaded.configuration.onUnload.call(unloaded.page)
  isUnloaded = true
  unloadedGate.release({ statusCode: 200, data: publicResult(unloadedGate.submissionOptions.data, 'accepted') })
  await lateAccepted
  assert.equal(unloaded.wxHarness.redirects.length, 0, 'late accepted response must not redirect an unloaded page')
  assert.equal(unloaded.page.data.actionMessage, '', 'accepted must not be presented as a rejection or cancellation')
  assert.equal(unloaded.wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions')).length, 1)
  assert.ok(unloaded.getHandoffId(), 'accepted late response still creates a result handoff')
  const retainedHandoff = unloaded.service.consumeAppointmentSuccessHandoffV1(unloaded.getHandoffId())
  assert.equal(retainedHandoff.receipt.publicMessage, '预约申请已提交')

  const staleGate = createAcceptedGate()
  const stale = makeScenario(fixedResponses(staleGate))
  await stale.configuration.onPrepareAppointment.call(stale.page)
  const stalePending = stale.configuration.onPhoneAuthorization.call(stale.page, {
    detail: { code: 'TEST_ONLY_STALE_GENERATION_CODE' },
  })
  await waitForSubmission(staleGate)
  let staleGenerationCompleted = false
  const staleSetData = stale.page.setData
  stale.page.setData = function (patch) {
    assert.equal(staleGenerationCompleted, false, 'old callback must not update the replacement page generation')
    staleSetData.call(this, patch)
  }
  stale.configuration.onHide.call(stale.page)
  stale.configuration.onUnload.call(stale.page)
  stale.configuration.onLoad.call(stale.page, {})
  stale.configuration.onShow.call(stale.page)
  assert.equal(stale.page.data.pageState, 'route_error', 'test creates a new generation on the same instance')
  staleGenerationCompleted = true
  staleGate.release({ statusCode: 200, data: publicResult(staleGate.submissionOptions.data, 'accepted') })
  await stalePending
  assert.equal(stale.page.data.pageState, 'route_error')
  assert.equal(stale.wxHarness.redirects.length, 0, 'old accepted callback cannot redirect the replacement generation')
  assert.ok(stale.getHandoffId(), 'old accepted callback still preserves its independent result handoff')
}

const runLostResponseReplayPageCase = async (typescript) => {
  let c3Calls = 0
  let stack = []
  const wxHarness = makePageWx((options) => {
    if (options.url.endsWith('/api/v1/auth/wechat')) return authResponse()
    if (options.url.endsWith('/api/v1/elder-record')) {
      if (options.method === 'GET') return elderEnvelope('bound', 'elder-retry-page-001')
      throw new Error('existing Elder must not be recreated')
    }
    if (options.url.endsWith('/api/v1/appointment-submissions')) {
      c3Calls += 1
      if (c3Calls === 1) throw new Error('TEST_ONLY committed response lost')
      return { statusCode: 200, data: publicResult(options.data, 'replayed') }
    }
    return { statusCode: 404, data: {} }
  })
  const capture = { pageConfiguration: null }
  const runtime = createWechatTsRuntime(typescript, {
    wx: wxHarness.wx,
    Page: (configuration) => { capture.pageConfiguration = configuration },
    getCurrentPages: () => stack,
  })
  const service = runtime.load(servicePath)
  service.recordAppointmentInstitutionDisplaySnapshotV1(
    fixedIdentity.institutionId,
    fixedIdentity.recordRevision,
    '测试机构（仅测试数据）',
  )
  runtime.load(createPagePath)
  const createPage = capture.pageConfiguration
  const page = makePageInstance(createPage)
  stack = [page]
  createPage.onLoad.call(page, {
    institutionId: fixedIdentity.institutionId,
    recordRevision: String(fixedIdentity.recordRevision),
  })
  fillValidForm(createPage, page)
  await createPage.onPrepareAppointment.call(page)
  assert.equal(page.data.prepared, true)
  assert.equal(wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/elder-record') && item.method === 'POST').length, 0)

  await createPage.onPhoneAuthorization.call(page, { detail: { code: 'fresh-before-lost-response' } })
  assert.equal(page.data.outcomeUnknown, true)
  assert.equal(page.data.receiptReady, false)
  assert.equal(page.data.formLocked, true)
  assert.equal(wxHarness.redirects.length, 0)
  assert.equal(page.data.form.contactName, fixedForm.contactName)
  await createPage.onPhoneAuthorization.call(page, { detail: { code: 'fresh-retry-code' } })
  assert.equal(page.data.receiptReady, true)
  assert.equal(wxHarness.redirects.length, 1)
  const c3Requests = wxHarness.requests.filter((item) => item.url.endsWith('/api/v1/appointment-submissions'))
  assert.equal(c3Requests.length, 2)
  assert.equal(c3Requests[0].data.idempotencyKey, c3Requests[1].data.idempotencyKey)
  assert.deepEqual(c3Requests[0].data, c3Requests[1].data)
  assert.notEqual(c3Requests[0].header['X-Phone-Auth-Evidence'], c3Requests[1].header['X-Phone-Auth-Evidence'])
}

const runElderFailureAndStaleInstitutionCases = async (typescript) => {
  let elderCreateCalls = 0
  const wxHarness = makePageWx((options) => {
    if (options.url.endsWith('/api/v1/auth/wechat')) return authResponse()
    if (options.url.endsWith('/api/v1/elder-record')) {
      if (options.method === 'GET') return elderEnvelope('not_found')
      elderCreateCalls += 1
      if (elderCreateCalls === 1) return { statusCode: 503, data: null }
      return establishmentEnvelope('created', 'elder-retry-after-create-failure')
    }
    if (options.url.endsWith('/api/v1/appointment-submissions')) {
      return {
        statusCode: 200,
        data: { outcome: 'rejected', code: 'REFERENCE_UNAVAILABLE', receipt: null },
      }
    }
    return { statusCode: 404, data: {} }
  })
  const capture = { pageConfiguration: null }
  const runtime = createWechatTsRuntime(typescript, {
    wx: wxHarness.wx,
    Page: (configuration) => { capture.pageConfiguration = configuration },
    getCurrentPages: () => [],
  })
  const service = runtime.load(servicePath)
  service.recordAppointmentInstitutionDisplaySnapshotV1(
    fixedIdentity.institutionId,
    fixedIdentity.recordRevision,
    '测试机构（仅测试数据）',
  )
  runtime.load(createPagePath)
  const createPage = capture.pageConfiguration
  const page = makePageInstance(createPage)
  createPage.onLoad.call(page, {
    institutionId: fixedIdentity.institutionId,
    recordRevision: String(fixedIdentity.recordRevision),
  })
  fillValidForm(createPage, page)
  const prepareFirst = createPage.onPrepareAppointment.call(page)
  const duplicatePrepare = createPage.onPrepareAppointment.call(page)
  await Promise.all([prepareFirst, duplicatePrepare])
  assert.equal(page.data.prepared, false)
  assert.equal(page.data.formLocked, false)
  assert.equal(page.data.form.contactName, fixedForm.contactName)
  assert.equal(elderCreateCalls, 1)
  assert.equal(wxHarness.requests.some((item) => item.url.endsWith('/api/v1/appointment-submissions')), false)

  await createPage.onPrepareAppointment.call(page)
  assert.equal(page.data.prepared, true)
  assert.equal(elderCreateCalls, 2)
  await createPage.onPhoneAuthorization.call(page, { detail: { code: 'fresh-code-stale-institution' } })
  assert.equal(page.data.prepared, false)
  assert.equal(page.data.receiptReady, false)
  assert.equal(page.data.form.visitDate, fixedForm.visitDate)
  assert.equal(page.data.form.contactName, fixedForm.contactName)
  assert.match(page.data.actionMessage, /版本不会自动切换/)
  assert.equal(wxHarness.redirects.length, 0)
  const c3Request = wxHarness.requests.find((item) => item.url.endsWith('/api/v1/appointment-submissions'))
  assert.equal(c3Request.data.institutionId, fixedIdentity.institutionId)
  assert.equal(c3Request.data.institutionRecordRevision, String(fixedIdentity.recordRevision))
  assert.equal(c3Request.data.institutionRecordRevision === 'current-latest', false)
}

const runEntryCases = async (typescript) => {
  const navigationUrls = []
  const capture = { pageConfiguration: null, componentConfiguration: null }
  const runtime = createWechatTsRuntime(typescript, {
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
      navigateTo: (options) => {
        navigationUrls.push(options.url)
        options.success && options.success({})
        options.complete && options.complete({})
      },
    },
    Page: (configuration) => { capture.pageConfiguration = configuration },
    Component: (configuration) => { capture.componentConfiguration = configuration },
    getCurrentPages: () => [],
  })
  runtime.load(institutionDetailPagePath)
  const detailPage = capture.pageConfiguration
  const detailInstance = Object.assign(makePageInstance(detailPage), detailPage)
  detailPage.onLoad.call(detailInstance, {
    institutionId: fixedIdentity.institutionId,
    recordRevision: String(fixedIdentity.recordRevision),
  })
  detailInstance.data = { ...detailInstance.data, pageState: 'ready', viewModel: { title: '测试机构（仅测试数据）' } }
  detailPage.onAppointmentTap.call(detailInstance)
  assert.equal(
    navigationUrls[0],
    `/pages/appointment/create?institutionId=${encodeURIComponent(fixedIdentity.institutionId)}&recordRevision=8`,
  )
  assert.equal(navigationUrls[0].includes('测试机构'), false)
  const displayHandoff = runtime.load(servicePath).consumeAppointmentInstitutionDisplaySnapshotV1(
    fixedIdentity.institutionId,
    fixedIdentity.recordRevision,
  )
  assert.equal(displayHandoff, '测试机构（仅测试数据）')

  runtime.load(consultantPagePath)
  const consultant = capture.componentConfiguration
  const consultantInstance = {
    data: { ...consultant.data, pageState: 'ready' },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  consultant.methods.onAppointmentTap.call(consultantInstance)
  assert.equal(navigationUrls[1], '/pages/institution/index')
  assert.equal(navigationUrls[1].includes('institutionId'), false)
  assert.equal(navigationUrls[1].includes('recordRevision'), false)
  assert.equal(navigationUrls[1].includes('/pages/appointment/create'), false)
}

const runBackNavigationCases = (typescript) => {
  const source = readFileSync(path.join(appRoot, 'pages', 'appointment', 'create.wxml'), 'utf8')
  assert.match(source, /<navigation-bar[\s\S]*?back="\{\{true\}\}"[\s\S]*?fallbackUrl="\/pages\/institution\/index"/)
  assert.match(source, /guardBack="\{\{true\}\}"/)
  const redirected = []
  const returned = []
  let stackDepth = 0
  let componentConfiguration = null
  const runtime = createWechatTsRuntime(typescript, {
    wx: {
      redirectTo: (options) => { redirected.push(options.url) },
      navigateBack: (options) => { returned.push(options.delta) },
    },
    Component: (configuration) => { componentConfiguration = configuration },
    getCurrentPages: () => new Array(stackDepth),
  })
  runtime.load(navigationBarPath)
  const nav = componentConfiguration
  const instance = {
    data: { delta: 1, fallbackUrl: '/pages/institution/index' },
    triggerEvent() {},
  }
  stackDepth = 0
  nav.methods.back.call(instance)
  assert.deepEqual(redirected, ['/pages/institution/index'])
  stackDepth = 2
  nav.methods.back.call(instance)
  assert.deepEqual(returned, [1])
}

const runPhonePolicyCases = async (typescript) => {
  const observations = []
  const runtime = createWechatTsRuntime(typescript)
  const service = runtime.load(servicePath)
  const domain = runtime.load(path.join(appRoot, 'domain/appointment-institution-visit/validate-appointment-institution-visit.ts'))
  const institution = { identity: fixedIdentity, displayName: 'TEST_ONLY_SYNTHETIC_INSTITUTION' }
  const p = syntheticMobile()
  const submission = (phone) => ({
    contractVersion: 'appointment-institution-visit-contract-v1', kind: 'appointment_submission_v1',
    idempotencyKey: 'phone-policy-test-key', institutionId: fixedIdentity.institutionId,
    institutionRecordRevision: String(fixedIdentity.recordRevision), elderId: 'TEST_ONLY_ELDER',
    visitDate: fixedForm.visitDate, visitTimePreference: fixedForm.visitTimePreference, participantCount: 1,
    contactName: 'TEST_ONLY', phone, phonePurpose: 'appointment_or_consultant_contact', phoneAuthorization: 'explicit',
  })
  const newPage = () => {
    const state = { configuration: null }
    const harness = makePageWx((options) => {
      if (options.url.endsWith('/api/v1/auth/wechat')) return authResponse()
      if (options.url.endsWith('/api/v1/elder-record')) return elderEnvelope('bound', 'TEST_ONLY_ELDER')
      throw new Error('Unexpected submission in phone review test')
    })
    const isolated = createWechatTsRuntime(typescript, {
      wx: harness.wx, Page: (configuration) => { state.configuration = configuration }, getCurrentPages: () => [],
    })
    const localService = isolated.load(servicePath)
    localService.recordAppointmentInstitutionDisplaySnapshotV1(fixedIdentity.institutionId, fixedIdentity.recordRevision, institution.displayName)
    isolated.load(createPagePath)
    const page = makePageInstance(state.configuration)
    state.configuration.onLoad.call(page, { institutionId: fixedIdentity.institutionId, recordRevision: String(fixedIdentity.recordRevision) })
    assert.equal(page.data.pageState, 'ready')
    fillValidForm(state.configuration, page)
    return { configuration: state.configuration, page, harness }
  }
  for (const item of appointmentPhoneFormatCases()) {
    const form = { ...fixedForm, phone: item.input }
    const validated = service.validateAppointmentCreateFormV1(form, institution)
    assert.equal(validated.valid, item.valid, `${item.id}/${item.variant}: form`)
    const command = domain.validateAppointmentSubmissionV1(submission(item.input))
    assert.equal(command.ok, item.valid, `${item.id}/${item.variant}: command`)
    const draft = domain.validateAppointmentLocalDraftV1(makeDraftFixture({ phone: item.input }))
    // Optional phone may be omitted, but an explicitly supplied invalid value must not be restored.
    assert.equal(draft.ok, item.input === undefined || item.valid, `${item.id}/${item.variant}: draft`)
    if (item.valid) {
      const canonical = item.input.replace(/^ +/, '').replace(/ +$/, '')
      assert.equal(validated.normalized.phone === canonical, true, `${item.id}: canonical form`)
      assert.equal(command.value.phone === canonical, true, `${item.id}: canonical command`)
      assert.equal(draft.value.phone === canonical, true, `${item.id}: canonical draft`)
    } else {
      const trace = makeServiceTransport({ elderBound: true })
      const rejected = await service.createProductionAppointmentCreateClientV1(trace.transport).submit({ institution, elderId: 'TEST_ONLY_ELDER', form, phoneCode: 'TEST_ONLY_FRESH_CODE' })
      assert.equal(rejected.kind === 'rejected' && rejected.code === 'VALIDATION_FAILED', true, `${item.id}: pre-submit`)
      assert.equal(trace.requests.length, 0, `${item.id}: no transport`)
    }
    const test = newPage()
    test.configuration.onPhoneInput.call(test.page, { detail: { value: item.input } })
    const prepareA = test.configuration.onPrepareAppointment.call(test.page)
    const prepareB = test.configuration.onPrepareAppointment.call(test.page)
    await Promise.all([prepareA, prepareB])
    assert.equal(test.page.data.prepared, item.valid, `${item.id}/${item.variant}: review`)
    if (!item.valid) {
      assert.equal(test.page.data.formErrors.phone !== undefined, true, `${item.id}: inline error`)
      assert.equal(test.page.data.firstErrorAnchor, 'appointment-field-phone')
      assert.equal(test.harness.requests.length, 0, `${item.id}: no downstream side effect`)
      assert.equal(test.harness.redirects.length + test.harness.navigations.length, 0)
    } else {
      assert.equal(test.harness.requests.filter(r => r.url.endsWith('/api/v1/elder-record')).length, 1)
      for (const detail of [{}, { errMsg: 'getPhoneNumber:fail user deny' }, { errMsg: 'getPhoneNumber:fail user cancel' }]) {
        const before = test.harness.requests.length
        await test.configuration.onPhoneAuthorization.call(test.page, { detail })
        assert.equal(test.harness.requests.length, before, 'V23/V24: no evidence means no submission')
        assert.equal(test.page.data.receiptReady, false)
      }
    }
    observations.push({ id: item.id, variant: item.variant, status: 'PASS', formatValid: validated.valid,
      reviewPrepared: test.page.data.prepared, commandValid: command.ok, draftValid: draft.ok,
      invalidDownstreamCalls: item.valid ? null : test.harness.requests.length })
  }
  // V19 / V20: edits, stale prepared state and direct state replacement.
  for (const editByHandler of [true, false]) {
    const test = newPage()
    await test.configuration.onPrepareAppointment.call(test.page)
    assert.equal(test.page.data.prepared, true)
    const before = test.harness.requests.length
    if (editByHandler) test.configuration.onPhoneInput.call(test.page, { detail: { value: p.slice(0, -1) } })
    else test.page.data.form = { ...test.page.data.form, phone: p + '\n' }
    await test.configuration.onPrepareAppointment.call(test.page)
    assert.equal(test.page.data.prepared, false)
    assert.equal(test.harness.requests.length, before)
    await test.configuration.onPhoneAuthorization.call(test.page, { detail: { code: 'TEST_ONLY_FRESH_CODE' } })
    assert.equal(test.harness.requests.length, before)
  }
  // A direct tamper at the final callback is independently revalidated.
  const tampered = newPage()
  await tampered.configuration.onPrepareAppointment.call(tampered.page)
  const beforeCallback = tampered.harness.requests.length
  tampered.page.data.form = { ...tampered.page.data.form, phone: p + '\n' }
  await tampered.configuration.onPhoneAuthorization.call(tampered.page, { detail: { code: 'TEST_ONLY_FRESH_CODE' } })
  assert.equal(tampered.harness.requests.length, beforeCallback)
  assert.equal(tampered.page.data.prepared, false)
  // Empty -> correction -> invalid; onShow must not resurrect readiness, reentry starts empty.
  const restored = newPage()
  for (const phone of ['', p, p.slice(0, -1), '', p]) {
    restored.configuration.onPhoneInput.call(restored.page, { detail: { value: phone } })
    await restored.configuration.onPrepareAppointment.call(restored.page)
    assert.equal(restored.page.data.prepared, phone === p)
  }
  restored.configuration.onPhoneInput.call(restored.page, { detail: { value: '' } })
  restored.configuration.onShow.call(restored.page)
  assert.equal(restored.page.data.prepared, false)
  restored.configuration.onLoad.call(restored.page, { institutionId: fixedIdentity.institutionId, recordRevision: String(fixedIdentity.recordRevision) })
  assert.equal(restored.page.data.prepared, false)
  const reentry = newPage()
  assert.equal(reentry.page.data.prepared, false)
  // V26: canonical request only reaches an injected memory transport.
  const trace = makeServiceTransport({ elderBound: true })
  const accepted = await service.createProductionAppointmentCreateClientV1(trace.transport).submit({ institution, elderId: 'TEST_ONLY_ELDER', form: { ...fixedForm, phone: '  ' + p + '  ' }, phoneCode: 'TEST_ONLY_FRESH_CODE' })
  assert.equal(accepted.kind, 'accepted')
  const request = trace.requests.find(r => r.url.endsWith('/api/v1/appointment-submissions'))
  assert.equal(request.data.phone === p, true, 'V26: canonical wire value')
  const historic = { ...makeCompletedVisitFixture(), phone: '0'.repeat(6) }
  assert.equal(domain.validateInstitutionVisitV1(historic).ok, true, 'historical Visit reads keep their existing grammar')
  if (process.env.APPOINTMENT_PHONE_TEST_REPORT) {
    writeFileSync(process.env.APPOINTMENT_PHONE_TEST_REPORT, JSON.stringify({
      provenance: 'TEST_ONLY_SYNTHETIC_IN_MEMORY', policy: 'APPOINTMENT_PHONE_FORMAT_V1', observations,
      behaviorIdsPassed: ['V19', 'V20', 'V22', 'V23', 'V24', 'V26'], invalidPhoneFormAcceptance: 0,
      invalidPreparedTransition: 0, invalidDownstreamSideEffects: 0, realPhoneAuthorizationAttempts: 0,
      realAppointmentSubmissions: 0, realRecordsCreated: 0,
    }, null, 2))
  }
  console.log('APPOINTMENT_PHONE_POLICY_V1 = PASS')
  console.log('APPOINTMENT_PHONE_INVALID_DOWNSTREAM_CALLS = 0')
}

const run = async () => {
  const { ts } = loadWechatTypeScript()
  const standaloneRuntime = createWechatTsRuntime(ts)
  const service = standaloneRuntime.load(servicePath)
  await runServiceCases(standaloneRuntime, service)
  await runPageCases(ts)
  runInstitutionReturnRouteCases(ts)
  await runAppointmentLifecycleCases(ts)
  await runLostResponseReplayPageCase(ts)
  await runElderFailureAndStaleInstitutionCases(ts)
  await runEntryCases(ts)
  runBackNavigationCases(ts)
  await runPhonePolicyCases(ts)
  console.log('APPOINTMENT_CREATE_TEST_PROVENANCE = TEST_ONLY_SYNTHETIC')
  console.log('APPOINTMENT_CREATE_CLIENT_IDEMPOTENCY_REPLAY = PASS')
  console.log('APPOINTMENT_CREATE_C5_ELDER_C3_TRANSPORT = PASS')
  console.log('APPOINTMENT_CREATE_PAGE_INTERACTIONS = PASS')
  console.log('APPOINTMENT_CREATE_SUCCESS_RECEIPT_GATE = PASS')
  console.log('APPOINTMENT_CREATE_ENTRY_CONTEXT_AND_BACK = PASS')
  console.log('APPOINTMENT_CREATE_LIFECYCLE_AND_RETURN_STACK = PASS')
  console.log('APPOINTMENT_CREATE_TARGETED_RUNTIME = PASS')
}

run().catch((error) => {
  console.error(`APPOINTMENT_CREATE_TARGETED_RUNTIME = FAIL\n${error instanceof Error ? error.stack : String(error)}`)
  process.exitCode = 1
})
