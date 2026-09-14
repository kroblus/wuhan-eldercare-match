/**
 * Phase V1.2-A1-4 Detail interaction gate.
 *
 * The wx methods below are test doubles.  They prove the Page handler's
 * physical-action contract without claiming that a simulator placed a real
 * call or map intent.  All action data comes from synthetic ViewModels.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDetailUiFutureFixtures, createDetailUiSnapshot } from './fixtures/institution-detail-v1-2-1-ui-fixtures.mjs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const detailRoot = path.join(appRoot, 'pages', 'institution')

const failures = []
const executed = []
const run = (id, description, callback) => {
  assert.match(id, /^DETAIL-V121-INTERACTION-\d{3}$/)
  assert.ok(!executed.includes(id), `duplicate case ${id}`)
  try {
    callback()
    executed.push(id)
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const buildLiveDetail = async (runtime) => {
  const application = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-page.ts'))
  const list = await application.buildInstitutionListPageSnapshot(null)
  assert.equal(list.ok, true)
  const item = list.value.displayInstitutions[0]
  const detail = await application.buildInstitutionDetailPageSnapshot({
    identity: { institutionId: item.institutionId, recordRevision: item.recordRevision },
    source: 'direct',
    sourceContextRef: null,
  })
  assert.equal(detail.ok, true)
  return detail.value
}

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  let pageDefinition = null
  const pages = [{}, {}]
  const wxApi = {
    openLocation: () => {},
    makePhoneCall: () => {},
    navigateBack: () => {},
    redirectTo: () => {},
  }
  const runtime = createWechatTsRuntime(ts, {
    Page: (definition) => { pageDefinition = definition },
    wx: wxApi,
    getCurrentPages: () => pages,
  })
  const vmModule = runtime.load(path.join(detailRoot, 'detail-view-model.ts'))
  const baseSnapshot = await buildLiveDetail(runtime)
  const fixtures = createDetailUiFutureFixtures()
  const pageModule = runtime.load(path.join(detailRoot, 'detail.ts'))
  assert.ok(pageModule)
  assert.ok(pageDefinition)
  const wxml = readFileSync(path.join(detailRoot, 'detail.wxml'), 'utf8')
  const page = pageDefinition

  const mapView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.mapReady),
  )
  const phoneView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.verifiedPhone),
  )
  const multiPhoneView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.multiplePhones),
  )
  const unverifiedPhoneView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.unverifiedPhone),
  )
  const expiredPhoneView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.expiredPhone),
  )
  const unknownPhoneView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.unknownPhone),
  )
  const unavailableMapView = vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(baseSnapshot, fixtures.addressReadyGeoUnknown),
  )

  const makeInstance = (viewModel) => {
    const instance = {
      data: {
        pageState: 'ready',
        viewModel,
        errorViewModel: null,
        actionErrorKey: '',
        actionErrorMessage: '',
        isSwitchingRevision: false,
      },
      setData(changes) {
        Object.assign(this.data, changes)
      },
    }
    page.onShow.call(instance)
    return instance
  }

  const phoneEvent = (key) => ({ currentTarget: { dataset: { phoneKey: key } } })

  run('DETAIL-V121-INTERACTION-001', 'map success invokes wx.openLocation once with ViewModel payload', () => {
    let calls = 0
    let received = null
    wxApi.openLocation = (options) => { calls += 1; received = options; options.success(); options.complete() }
    const instance = makeInstance(mapView)
    page.onMapTap.call(instance)
    assert.equal(calls, 1)
    assert.equal(received.latitude, 30.521234)
    assert.equal(received.longitude, 114.356789)
    assert.equal(received.name, '测试机构 · 地图 Ready')
    assert.equal(received.address, '湖北省武汉市武昌区测试路 1 号')
    assert.equal(received.scale, 16)
    assert.equal(instance.data.actionErrorKey, '')
  })
  run('DETAIL-V121-INTERACTION-002', 'rapid map taps are guarded to one pending wx.openLocation', () => {
    let calls = 0
    let pending = null
    wxApi.openLocation = (options) => { calls += 1; pending = options }
    const instance = makeInstance(mapView)
    page.onMapTap.call(instance)
    page.onMapTap.call(instance)
    assert.equal(calls, 1)
    pending.complete()
  })
  run('DETAIL-V121-INTERACTION-003', 'map fail reports feedback and releases guard for retry', () => {
    let calls = 0
    wxApi.openLocation = (options) => {
      calls += 1
      if (calls === 1) { options.fail({ errMsg: 'test failure' }); options.complete(); return }
      options.success(); options.complete()
    }
    const instance = makeInstance(mapView)
    page.onMapTap.call(instance)
    assert.equal(instance.data.actionErrorKey, 'map')
    assert.equal(instance.data.actionErrorMessage, '暂时无法打开地图，请稍后重试。')
    page.onMapTap.call(instance)
    assert.equal(calls, 2)
  })
  run('DETAIL-V121-INTERACTION-004', 'map unavailable state never invokes wx.openLocation', () => {
    let calls = 0
    wxApi.openLocation = () => { calls += 1 }
    const instance = makeInstance(unavailableMapView)
    page.onMapTap.call(instance)
    assert.equal(calls, 0)
  })
  run('DETAIL-V121-INTERACTION-005', 'map action success never navigates the page', () => {
    let navigationCalls = 0
    wxApi.openLocation = (options) => { options.success(); options.complete() }
    wxApi.navigateBack = () => { navigationCalls += 1 }
    wxApi.redirectTo = () => { navigationCalls += 1 }
    const instance = makeInstance(mapView)
    page.onMapTap.call(instance)
    assert.equal(navigationCalls, 0)
  })
  run('DETAIL-V121-INTERACTION-006', 'verified phone success invokes wx.makePhoneCall once with exact dial value', () => {
    let calls = 0
    let received = null
    wxApi.makePhoneCall = (options) => { calls += 1; received = options; options.success(); options.complete() }
    const instance = makeInstance(phoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    assert.equal(calls, 1)
    assert.equal(received.phoneNumber, '02788886666')
    assert.equal(instance.data.actionErrorKey, '')
  })
  run('DETAIL-V121-INTERACTION-007', 'rapid verified-phone taps are guarded to one pending call', () => {
    let calls = 0
    let pending = null
    wxApi.makePhoneCall = (options) => { calls += 1; pending = options }
    const instance = makeInstance(phoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    assert.equal(calls, 1)
    pending.complete()
  })
  run('DETAIL-V121-INTERACTION-008', 'phone fail reports feedback and releases guard for retry', () => {
    let calls = 0
    wxApi.makePhoneCall = (options) => {
      calls += 1
      if (calls === 1) { options.fail({ errMsg: 'test failure' }); options.complete(); return }
      options.success(); options.complete()
    }
    const instance = makeInstance(phoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    assert.equal(instance.data.actionErrorKey, 'phone')
    assert.equal(instance.data.actionErrorMessage, '暂时无法拨打机构电话，请稍后重试。')
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    assert.equal(calls, 2)
  })
  run('DETAIL-V121-INTERACTION-009', 'unverified sourced phone is physically rendered as blocked and invokes no API', () => {
    let calls = 0
    wxApi.makePhoneCall = () => { calls += 1 }
    const instance = makeInstance(unverifiedPhoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-unverified'))
    assert.equal(calls, 0)
  })
  run('DETAIL-V121-INTERACTION-010', 'expired phone is blocked without exposing or dialing its hidden number', () => {
    let calls = 0
    wxApi.makePhoneCall = () => { calls += 1 }
    const instance = makeInstance(expiredPhoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-expired'))
    assert.equal(calls, 0)
    assert.equal(expiredPhoneView.officialContact.phones[0].displayValue, '')
  })
  run('DETAIL-V121-INTERACTION-011', 'unknown phone is blocked without fallback to another contact', () => {
    let calls = 0
    wxApi.makePhoneCall = () => { calls += 1 }
    const instance = makeInstance(unknownPhoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-unknown'))
    assert.equal(calls, 0)
  })
  run('DETAIL-V121-INTERACTION-012', 'multiple phone action selects the requested ordered item without Page-side sorting', () => {
    let received = null
    wxApi.makePhoneCall = (options) => { received = options; options.success(); options.complete() }
    const instance = makeInstance(multiPhoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-service'))
    assert.equal(received.phoneNumber, '02766664444')
    assert.equal(multiPhoneView.officialContact.phones[2].purposeLabel, '服务电话')
  })
  run('DETAIL-V121-INTERACTION-013', 'phone complete releases guard and never navigates', () => {
    let navigationCalls = 0
    wxApi.makePhoneCall = (options) => { options.complete() }
    wxApi.navigateBack = () => { navigationCalls += 1 }
    wxApi.redirectTo = () => { navigationCalls += 1 }
    const instance = makeInstance(phoneView)
    page.onOfficialPhoneTap.call(instance, phoneEvent('test-main'))
    assert.equal(navigationCalls, 0)
  })
  run('DETAIL-V121-INTERACTION-014', 'Back remains available after a failed map action', () => {
    let mapCalls = 0
    let backCalls = 0
    wxApi.openLocation = (options) => { mapCalls += 1; options.fail({ errMsg: 'test failure' }); options.complete() }
    wxApi.navigateBack = (options) => { backCalls += 1; options.success(); options.complete() }
    const instance = makeInstance(mapView)
    page.onMapTap.call(instance)
    page.onBackToList.call(instance)
    assert.equal(mapCalls, 1)
    assert.equal(backCalls, 1)
  })
  run('DETAIL-V121-INTERACTION-015', 'Back stays one channel and still uses existing fallback behavior', () => {
    let backCalls = 0
    wxApi.navigateBack = (options) => { backCalls += 1; options.success(); options.complete() }
    const instance = makeInstance(mapView)
    page.onBackToList.call(instance)
    page.onBackToList.call(instance)
    assert.equal(backCalls, 1)
  })
  run('DETAIL-V121-INTERACTION-016', 'WXML and Page expose exactly one explicit handler per new action', () => {
    const source = readFileSync(path.join(detailRoot, 'detail.ts'), 'utf8')
    assert.equal((wxml.match(/bindtap="onMapTap"/g) || []).length, 1)
    assert.equal((wxml.match(/bindtap="onOfficialPhoneTap"/g) || []).length, 1)
    assert.equal((source.match(/wx\.openLocation\s*\(/g) || []).length, 1)
    assert.equal((source.match(/wx\.makePhoneCall\s*\(/g) || []).length, 1)
    assert.equal(/wx\.getLocation|wx\.chooseLocation|geocode|scope\.userLocation/.test(source), false)
  })

  assert.deepEqual(executed, Array.from({ length: 16 }, (_, index) => `DETAIL-V121-INTERACTION-${String(index + 1).padStart(3, '0')}`))
  if (failures.length > 0) throw new Error(`${failures.length} Detail V1.2.1 interaction case(s) failed\n${failures.join('\n')}`)
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`DETAIL_V121_INTERACTION_CASES: ${executed.length}/16 PASS`)
  console.log('INSTITUTION_DETAIL_V1_2_1_INTERACTIONS = PASS')
}

main().catch((error) => {
  console.error('INSTITUTION_DETAIL_V1_2_1_INTERACTIONS = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
