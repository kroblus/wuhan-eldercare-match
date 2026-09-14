/**
 * Phase V1.2-A1-4 Detail ViewModel and WXML runtime gate.
 *
 * Positive states are test-only synthetic application snapshots.  The live
 * catalog is only read to prove that its unknown/Mock facts remain unchanged.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INSTITUTION_LIST_DETAIL_CURRENT_RECORDS,
  INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
  INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST,
  makeCurrentCatalogPayload,
} from './fixtures/institution-list-detail-fixtures.mjs'
import {
  createDetailUiFutureFixtures,
  createDetailUiSnapshot,
  makePinnedRecommendationContext,
} from './fixtures/institution-detail-v1-2-1-ui-fixtures.mjs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const detailRoot = path.join(appRoot, 'pages', 'institution')

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const buildDirect = async (runtime) => {
  const resolver = runtime.load(path.join(appRoot, 'services', 'institution-record-resolver.ts'))
  const context = runtime.load(path.join(appRoot, 'services', 'institution-source-context.ts'))
  const application = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-application.ts'))
  const currentResolver = resolver.createInstitutionCurrentCatalogResolver({
    loadCatalog: async () => ({ ok: true, value: makeCurrentCatalogPayload(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS) }),
  })
  const registry = context.createInstitutionSourceContextRegistry({ tokenFactory: () => 'detail-v121-ui-test-context' })
  const service = application.createInstitutionDetailApplicationServiceV12({
    currentCatalogResolver: currentResolver,
    historicalRevisionResolver: resolver.createNotConfiguredHistoricalRevisionResolver(),
    sourceContextRegistry: registry,
  })
  const first = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0]
  const result = await service.build({
    identity: { institutionId: first.institutionId, recordRevision: first.recordRevision },
    source: 'direct',
    sourceContextRef: null,
    evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
  })
  assert.equal(result.ok, true)
  return result.value
}

const failures = []
const executed = []
const run = (id, description, callback) => {
  assert.match(id, /^DETAIL-V121-UI-\d{3}$/)
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

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts)
  const vmModule = runtime.load(path.join(detailRoot, 'detail-view-model.ts'))
  const direct = await buildDirect(runtime)
  const livePageApplication = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-page.ts'))
  const liveList = await livePageApplication.buildInstitutionListPageSnapshot(null)
  assert.equal(liveList.ok, true)
  const liveItem = liveList.value.displayInstitutions[0]
  const liveDetail = await livePageApplication.buildInstitutionDetailPageSnapshot({
    identity: {
      institutionId: liveItem.institutionId,
      recordRevision: liveItem.recordRevision,
    },
    source: 'direct',
    sourceContextRef: null,
  })
  assert.equal(liveDetail.ok, true)
  const fixtures = createDetailUiFutureFixtures()
  const live = vmModule.createInstitutionDetailPageViewModel(liveDetail.value)
  const wxml = readFileSync(path.join(detailRoot, 'detail.wxml'), 'utf8')
  const detailSource = readFileSync(path.join(detailRoot, 'detail.ts'), 'utf8')
  const viewModelSource = readFileSync(path.join(detailRoot, 'detail-view-model.ts'), 'utf8')
  const first = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0]

  const makeView = (future, options = {}) => vmModule.createInstitutionDetailPageViewModel(
    createDetailUiSnapshot(direct, future, options),
  )

  run('DETAIL-V121-UI-001', 'live snapshot exposes A1-4 sections without changing catalog facts', () => {
    assert.ok(liveDetail.value.sections.futureV121)
    assert.equal(liveDetail.value.sections.futureV121.officialContact.status, 'unknown')
    assert.equal(liveDetail.value.sections.futureV121.officialAddress.status, 'unknown')
    assert.equal(liveDetail.value.sections.futureV121.mapLocation.status, 'address_unknown')
    assert.equal(liveDetail.value.sections.futureV121.careProcess.status, 'unknown')
    assert.equal(liveDetail.value.sections.careProcess.state, 'available_for_schema')
    assert.equal(direct.sections.careProcess.state, 'not_applicable_for_schema')
    assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.fixturePolicy, 'TEST_FIXTURE_ONLY')
  })
  run('DETAIL-V121-UI-002', 'live public introduction is shown only when application projection is ready', () => {
    assert.ok(live.introduction)
    assert.match(live.introduction.text, /机构|养老|服务/)
    assert.equal(live.hasDisclosure, true)
    assert.match(live.disclosure, /开发|Mock|示例/)
  })
  run('DETAIL-V121-UI-003', 'live unknown address has neutral non-empty copy', () => {
    assert.equal(live.location.state, 'address_unknown')
    assert.equal(live.location.address, '机构地址待确认')
    assert.equal(live.location.addressStatus, '机构地址待确认')
    assert.equal(live.location.address.includes('undefined'), false)
    assert.equal(live.location.address.includes('null'), false)
  })
  run('DETAIL-V121-UI-004', 'live map is unavailable and never publishes coordinates', () => {
    assert.equal(live.location.mapState, 'map_unavailable')
    assert.equal(live.location.mapAction.available, false)
    assert.equal(JSON.stringify(live.location.mapAction).includes('latitude'), false)
    assert.match(live.location.mapStatus, /确认|核验|不可用/)
  })
  run('DETAIL-V121-UI-005', 'live official phone remains unknown and does not use consultant data', () => {
    assert.equal(live.officialContact.state, 'unknown')
    assert.equal(live.officialContact.hasPhones, false)
    assert.equal(live.officialContact.statusLabel, '官方联系电话待确认')
    assert.equal(JSON.stringify(live.officialContact).includes('顾问'), false)
  })
  run('DETAIL-V121-UI-006', 'live CareProcess collapses unknown fields to one quiet state', () => {
    assert.equal(live.careProcess.hasFacts, false)
    assert.equal(live.careProcess.careRecordRows.length, 0)
    assert.equal(live.careProcess.handoverPresence, null)
    assert.equal(live.careProcess.handoverContentRows.length, 0)
    assert.equal(live.careProcess.emptyMessage, '相关资料待确认')
  })
  run('DETAIL-V121-UI-007', 'missing public introduction hides the whole section', () => {
    assert.equal(makeView(fixtures.allUnknown).introduction, null)
    assert.equal(wxml.includes('wx:if="{{viewModel.introduction}}"'), true)
  })
  run('DETAIL-V121-UI-008', 'exact synthetic introduction remains plain text with date-only metadata', () => {
    const view = makeView(fixtures.mapReady)
    assert.ok(view.introduction)
    assert.match(view.introduction.text, /换行/)
    assert.equal(view.introduction.sourceLabel, '机构提供')
    assert.equal(view.introduction.updatedDateLabel, '')
    assert.equal(/<rich-text|html|Capability|24小时护理/.test(view.introduction.text), false)
  })
  run('DETAIL-V121-UI-009', 'recommendation-pinned exact introduction is independent of recommendation semantics', () => {
    const view = makeView(fixtures.mapReady, {
      contextKind: 'RECOMMENDATION_PINNED',
      recommendationContext: makePinnedRecommendationContext(),
    })
    assert.ok(view.introduction)
    assert.ok(view.recommendation)
    assert.equal(view.recommendation.tierLabel.length > 0, true)
    assert.equal(view.recommendation.reasons.length, 1)
    assert.equal(view.recommendation.differences.length, 1)
  })
  run('DETAIL-V121-UI-010', 'recommendation-pinned snapshot without exact introduction pin stays hidden', () => {
    const noIntro = clone(fixtures.mapReady)
    noIntro.publicIntroduction = {
      status: 'hidden_no_pin', contentRevision: null, text: null, sourceType: null, updatedAt: null,
    }
    const view = makeView(noIntro, {
      contextKind: 'RECOMMENDATION_PINNED',
      recommendationContext: makePinnedRecommendationContext(),
    })
    assert.equal(view.introduction, null)
    assert.ok(view.recommendation)
  })
  run('DETAIL-V121-UI-011', 'direct detail keeps recommendation context absent while showing new sections', () => {
    const view = makeView(fixtures.mapReady)
    assert.equal(view.recommendation, null)
    assert.ok(view.introduction)
    assert.equal(view.location.mapState, 'map_ready')
  })
  run('DETAIL-V121-UI-012', 'map-ready fixture produces one controlled gcj02 action payload', () => {
    const view = makeView(fixtures.mapReady)
    assert.equal(view.location.state, 'map_ready')
    assert.equal(view.location.mapAction.available, true)
    if (!view.location.mapAction.available) throw new Error('map action unexpectedly unavailable')
    assert.equal(view.location.mapAction.latitude, 30.521234)
    assert.equal(view.location.mapAction.longitude, 114.356789)
    assert.equal(view.location.mapAction.name, '测试机构 · 地图 Ready')
    assert.equal(view.location.mapAction.address, '湖北省武汉市武昌区测试路 1 号')
    assert.equal(view.location.mapAction.scale, 16)
  })
  run('DETAIL-V121-UI-013', 'known address plus unknown geo shows address and disabled map', () => {
    const view = makeView(fixtures.addressReadyGeoUnknown)
    assert.equal(view.location.addressState, 'ready')
    assert.equal(view.location.address, '湖北省武汉市武昌区测试路 1 号')
    assert.equal(view.location.mapState, 'map_unavailable')
    assert.equal(view.location.mapAction.available, false)
    assert.equal(view.location.mapAction.disabledReason, '地图位置待确认')
  })
  run('DETAIL-V121-UI-014', 'unverified and expired geo states remain disabled with distinct copy', () => {
    const unverified = clone(fixtures.addressReadyGeoUnknown)
    unverified.mapLocation.status = 'geo_unverified'
    const expired = clone(fixtures.addressReadyGeoUnknown)
    expired.mapLocation.status = 'geo_expired'
    assert.equal(makeView(unverified).location.mapAction.disabledReason, '地图位置待核验')
    assert.equal(makeView(expired).location.mapAction.disabledReason, '地图位置资料已过核验期')
  })
  run('DETAIL-V121-UI-015', 'address verification states do not become map-ready by inference', () => {
    const unverified = clone(fixtures.mapReady)
    unverified.officialAddress.effectiveVerification = 'unverified'
    unverified.mapLocation.status = 'address_unverified'
    unverified.mapLocation.mapActionAvailable = false
    const expired = clone(unverified)
    expired.officialAddress.effectiveVerification = 'expired'
    expired.mapLocation.status = 'address_expired'
    assert.equal(makeView(unverified).location.addressState, 'address_unverified')
    assert.equal(makeView(unverified).location.mapState, 'map_unavailable')
    assert.equal(makeView(expired).location.addressState, 'address_expired')
  })
  run('DETAIL-V121-UI-016', 'unavailable address and map use explicit unavailable copy', () => {
    const view = makeView(fixtures.unavailable)
    assert.equal(view.location.addressState, 'address_unavailable')
    assert.equal(view.location.address, '当前暂无可提供的机构地址')
    assert.equal(view.location.mapAction.available, false)
    assert.equal(view.location.mapAction.disabledReason, '地图暂不可用')
  })
  run('DETAIL-V121-UI-017', 'ViewModel consumes the application map action decision without promoting raw-looking data', () => {
    const unavailable = clone(fixtures.mapReady)
    unavailable.mapLocation.mapActionAvailable = false
    const view = makeView(unavailable)
    assert.equal(view.location.mapState, 'map_unavailable')
    assert.equal(view.location.mapAction.available, false)
    assert.equal(/isUsableMapAction|Number\.isFinite\(future\.mapLocation|coordinateSystem\s*===\s*['"]gcj02['"]/.test(viewModelSource), false)
  })
  run('DETAIL-V121-UI-018', 'verified official phone exposes full display and exact dial payload', () => {
    const view = makeView(fixtures.verifiedPhone)
    assert.equal(view.officialContact.state, 'ready')
    assert.equal(view.officialContact.phones.length, 1)
    const item = view.officialContact.phones[0]
    assert.equal(item.state, 'verified')
    assert.equal(item.displayValue, '027-88886666')
    assert.equal(item.statusLabel, '已核验')
    assert.equal(item.verifiedDateLabel, '核验日期：2026-09-02')
    assert.equal(JSON.stringify(item.callAction), JSON.stringify({
      available: true, label: '拨打机构电话', dialValue: '02788886666',
    }))
    assert.equal(/state\s*===\s*['"]verified['"]\s*&&\s*phone\.callActionAvailable|typeof\s+phone\.dialValue/.test(viewModelSource), false)
  })
  run('DETAIL-V121-UI-019', 'multiple official phones preserve application ordering and purpose labels', () => {
    const view = makeView(fixtures.multiplePhones)
    assert.equal(JSON.stringify(view.officialContact.phones.map((item) => item.key)), JSON.stringify([
      'test-main', 'test-admission', 'test-service', 'test-other',
    ]))
    assert.equal(JSON.stringify(view.officialContact.phones.map((item) => item.purposeLabel)), JSON.stringify([
      '机构主电话', '入住咨询', '服务电话', '其它',
    ]))
  })
  run('DETAIL-V121-UI-020', 'unverified sourced phone displays but cannot be called', () => {
    const item = makeView(fixtures.unverifiedPhone).officialContact.phones[0]
    assert.equal(item.displayValue, '027-11112222')
    assert.equal(item.state, 'pending')
    assert.equal(item.statusLabel, '待核验')
    assert.equal(item.callAction.available, false)
    assert.equal(JSON.stringify(item).includes('拨打机构电话'), false)
  })
  run('DETAIL-V121-UI-021', 'expired phone hides complete number and blocks calling', () => {
    const item = makeView(fixtures.expiredPhone).officialContact.phones[0]
    assert.equal(item.displayValue, '')
    assert.equal(item.state, 'expired')
    assert.equal(item.statusLabel, '电话资料已过核验期')
    assert.equal(item.verifiedDateLabel, '核验日期：2025-01-01')
    assert.equal(item.callAction.available, false)
  })
  run('DETAIL-V121-UI-022', 'unknown phone never reveals a number or enables call', () => {
    const item = makeView(fixtures.unknownPhone).officialContact.phones[0]
    assert.equal(item.displayValue, '')
    assert.equal(item.statusLabel, '官方联系电话待确认')
    assert.equal(item.callAction.available, false)
  })
  run('DETAIL-V121-UI-023', 'unavailable contact has no empty phone rows', () => {
    const view = makeView(fixtures.unavailable)
    assert.equal(view.officialContact.state, 'unavailable')
    assert.equal(view.officialContact.hasPhones, false)
    assert.equal(view.officialContact.statusLabel, '当前暂无可提供的官方联系电话')
  })
  run('DETAIL-V121-UI-024', 'full CareProcess exposes four record facts plus one handover presence', () => {
    const view = makeView(fixtures.fullCare)
    assert.equal(view.careProcess.hasFacts, true)
    assert.equal(view.careProcess.careRecordRows.length, 4)
    assert.equal(view.careProcess.handoverPresence.value, '有')
    assert.equal(view.careProcess.handoverContentRows.length, 6)
    assert.equal(view.careProcess.pendingLabel, '')
  })
  run('DETAIL-V121-UI-025', 'full CareProcess keeps six handover contents independent', () => {
    const view = makeView(fixtures.fullCare)
    assert.equal(JSON.stringify(view.careProcess.handoverContentRows.map((item) => item.label)), JSON.stringify([
      '生命体征', '异常情况', '处理措施记录', '后续跟进', '家属沟通', '转医信息',
    ]))
    assert.equal(view.careProcess.handoverContentRows[5].value, '已确认暂无')
    assert.equal(JSON.stringify(view.careProcess).includes('实时监测'), false)
  })
  run('DETAIL-V121-UI-026', '24h handover presence uses process wording and never becomes 24h care', () => {
    const view = makeView(fixtures.fullCare)
    assert.equal(view.careProcess.handoverPresence.label, '24小时交接')
    assert.equal(view.careProcess.handoverPresence.value, '有')
    assert.equal(wxml.includes('护理管理与交接'), true)
    assert.equal(JSON.stringify(view.careProcess).includes('24小时护理'), false)
    assert.equal(JSON.stringify(view.careProcess).includes('全天医疗'), false)
  })
  run('DETAIL-V121-UI-027', 'partial CareProcess shows known facts and one pending summary', () => {
    const view = makeView(fixtures.partialCare)
    assert.equal(view.careProcess.hasFacts, true)
    assert.equal(view.careProcess.careRecordRows.length, 2)
    assert.equal(view.careProcess.handoverPresence, null)
    assert.equal(view.careProcess.handoverContentRows.length, 2)
    assert.equal(view.careProcess.pendingLabel, '部分字段资料待确认')
    const text = JSON.stringify(view.careProcess)
    assert.equal(text.includes('没有'), false)
    assert.equal(text.includes('不提供'), false)
  })
  run('DETAIL-V121-UI-028', 'expired CareProcess facts remain visibly expired instead of false', () => {
    const view = makeView(fixtures.expiredCare)
    assert.equal(view.careProcess.careRecordRows[0].value, '此前资料：有')
    assert.equal(view.careProcess.careRecordRows[0].status, '核验已过期')
    assert.equal(view.careProcess.careRecordRows[0].statusTone, 'warning')
    assert.equal(view.careProcess.handoverContentRows.length, 6)
  })
  run('DETAIL-V121-UI-029', 'completeness is displayed only from the provided snapshot value', () => {
    const full = makeView(fixtures.fullCare)
    const partial = makeView(fixtures.partialCare)
    assert.equal(full.careProcess.careRecordRows.some((item) => item.value === '完整'), true)
    assert.equal(partial.careProcess.careRecordRows.some((item) => item.label === '护理记录完整性'), false)
  })
  run('DETAIL-V121-UI-030', 'all-unknown CareProcess stays compact rather than rendering ten unknown rows', () => {
    const view = makeView(fixtures.allUnknown)
    assert.equal(view.careProcess.hasFacts, false)
    assert.equal(view.careProcess.careRecordRows.length + view.careProcess.handoverContentRows.length, 0)
    assert.equal(JSON.stringify(view.careProcess).includes('未知'), false)
  })
  run('DETAIL-V121-UI-031', 'legacy V1.1 sections still render beside A1-4 without list/result fields', () => {
    const view = makeView(fixtures.mapReady)
    assert.ok(view.basicRows.length > 0)
    assert.ok(view.capabilityGroups.length > 0)
    assert.equal(JSON.stringify(view).includes('recommendationScore'), false)
    assert.equal(JSON.stringify(view).includes('rating'), false)
  })
  run('DETAIL-V121-UI-032', 'ViewModel surface contains no raw record/evidence/provider boundary', () => {
    assert.equal(/InstitutionRecordV121|raw evidence|PublicContentProvider|CatalogProvider/.test(viewModelSource), false)
    assert.equal(Object.keys(live).some((key) => /raw|evidence|schema|provider/i.test(key)), false)
  })
  run('DETAIL-V121-UI-033', 'new sections do not invoke or recompute recommendation evaluation', () => {
    assert.equal(/evaluateRecommendation|runEvaluator|recommendationEvaluator/.test(detailSource + viewModelSource), false)
    const pinned = makeView(fixtures.fullCare, {
      contextKind: 'RECOMMENDATION_PINNED',
      recommendationContext: makePinnedRecommendationContext(),
    })
    assert.equal(pinned.recommendation.reasons.length, 1)
    assert.equal(pinned.recommendation.differences.length, 1)
  })
  run('DETAIL-V121-UI-034', 'missing future section falls back to explicit unavailable UI without exposing null', () => {
    const old = clone(liveDetail.value)
    delete old.sections.futureV121
    const view = vmModule.createInstitutionDetailPageViewModel(old)
    assert.equal(view.introduction, null)
    assert.equal(view.location.address, '当前暂无可提供的机构地址')
    assert.equal(view.officialContact.statusLabel, '当前暂无可提供的官方联系电话')
    assert.equal(view.careProcess.emptyMessage, '当前暂无可提供的护理管理与交接资料')
  })
  run('DETAIL-V121-UI-035', 'WXML has explicit section and action visibility boundaries', () => {
    assert.match(wxml, /机构简介/)
    assert.match(wxml, /机构位置/)
    assert.match(wxml, /机构官方电话/)
    assert.match(wxml, /护理管理与交接/)
    assert.match(wxml, /disabled="\{\{!viewModel\.location\.mapAction\.available\}\}"/)
    assert.match(wxml, /item\.callAction\.available/)
    assert.match(wxml, /<view wx:if="\{\{viewModel\.careProcess\}\}" class="detail-card-wrap">\s*<section-card>\s*<text class="section-kicker">护理管理与交接/)
    assert.match(wxml, /开发演示数据/)
  })
  run('DETAIL-V121-UI-036', 'WXML never puts phone/address/care facts into list-style card bindings', () => {
    assert.equal(wxml.includes('displayInstitutions'), false)
    assert.equal(wxml.includes('recommendationCandidates'), false)
    assert.equal(wxml.includes('consultantPhone'), false)
  })
  run('DETAIL-V121-UI-037', 'date-only metadata excludes time, evidence and internal locator fields', () => {
    const content = JSON.stringify(makeView(fixtures.verifiedPhone))
    assert.equal(content.includes('T00:00:00'), false)
    assert.equal(content.includes('evidenceId'), false)
    assert.equal(content.includes('sourceLocator'), false)
    assert.equal(content.includes('核验日期：2026-09-02'), true)
  })

  run('DETAIL-V121-UI-038', 'unverified absent CareProcess remains source-reported rather than confirmed', () => {
    const view = makeView(fixtures.unverifiedAbsentCare)
    const row = view.careProcess.careRecordRows.find((item) => item.label === '护理记录')
    assert.ok(row)
    assert.equal(row.value, '机构资料称暂无')
    assert.equal(row.statusSummary, '资料待核验')
    assert.equal(row.value.includes('已确认'), false)
  })

  run('DETAIL-V121-UI-039', 'V1.1 CareProcess is hidden for current detail and neutral for pinned history', () => {
    const current = vmModule.createInstitutionDetailPageViewModel(direct)
    const pinnedSnapshot = clone(direct)
    pinnedSnapshot.contextKind = 'RECOMMENDATION_PINNED'
    pinnedSnapshot.recommendationContext = makePinnedRecommendationContext()
    const pinned = vmModule.createInstitutionDetailPageViewModel(pinnedSnapshot)
    assert.equal(current.careProcess, null)
    assert.ok(pinned.careProcess)
    assert.equal(pinned.careProcess.hasFacts, false)
    assert.equal(pinned.careProcess.emptyMessage, '该版本机构资料尚未包含护理管理信息')
    assert.equal(JSON.stringify(pinned.careProcess).includes('机构暂无护理记录'), false)
    assert.equal(JSON.stringify(pinned.careProcess).includes('机构未实行交接班'), false)
    assert.equal(/sourceContractVersion/.test(viewModelSource.slice(
      viewModelSource.indexOf('const careProcessForSnapshot'),
      viewModelSource.indexOf('const formatMoney'),
    )), false)
  })

  assert.deepEqual(executed, Array.from({ length: 39 }, (_, index) => `DETAIL-V121-UI-${String(index + 1).padStart(3, '0')}`))
  if (failures.length > 0) throw new Error(`${failures.length} Detail V1.2.1 UI case(s) failed\n${failures.join('\n')}`)
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`DETAIL_V121_UI_CASES: ${executed.length}/39 PASS`)
  console.log('INSTITUTION_DETAIL_V1_2_1_UI_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('INSTITUTION_DETAIL_V1_2_1_UI_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
