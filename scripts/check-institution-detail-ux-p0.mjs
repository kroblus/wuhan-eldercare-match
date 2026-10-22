/**
 * MAIN_APP_INSTITUTION_DETAIL_UX_P0. Synthetic presentation tests only.
 * No institution fact writes, backend requests, booking submission or release.
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { createDetailUiFutureFixtures, createDetailUiSnapshot, makePinnedRecommendationContext } from './fixtures/institution-detail-v1-2-1-ui-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const detail = path.join(root, 'miniprogram/pages/institution')
const output = path.join(root, 'output/institution-detail-ux-p0')
mkdirSync(output, { recursive: true })
const clone = (value) => JSON.parse(JSON.stringify(value))
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const { ts } = loadWechatTypeScript()
let pageDefinition
const calls = { map: [], phone: [], navigate: [], tab: [], back: [] }
const wx = {
  openLocation: (options) => calls.map.push(options),
  makePhoneCall: (options) => calls.phone.push(options),
  navigateTo: (options) => calls.navigate.push(options),
  switchTab: (options) => calls.tab.push(options),
  navigateBack: (options) => calls.back.push(options),
}
const runtime = createWechatTsRuntime(ts, { Page: (page) => { pageDefinition = page }, wx, getCurrentPages: () => [{}, {}] })
const application = runtime.load(path.join(root, 'miniprogram/services/institution-list-detail-page.ts'))
const list = await application.buildInstitutionListPageSnapshot(null)
assert.equal(list.ok, true)
const item = list.value.displayInstitutions[0]
const identity = { institutionId: item.institutionId, recordRevision: item.recordRevision }
const route = { identity, source: 'direct', sourceContextRef: null }
const resolved = await application.buildInstitutionDetailPageSnapshot(route)
assert.equal(resolved.ok, true)
const base = resolved.value
const fixtures = createDetailUiFutureFixtures()
const vm = runtime.load(path.join(detail, 'detail-view-model.ts'))
const { createDetailReading } = runtime.load(path.join(detail, 'detail-reading.ts'))
runtime.load(path.join(detail, 'detail.ts'))
const wxml = readFileSync(path.join(detail, 'detail.wxml'), 'utf8')
const less = readFileSync(path.join(detail, 'detail.less'), 'utf8')
const fact = (value, effectiveVerification = 'current_verified', availability = 'provided') => ({ value, effectiveVerification, availability })
const create = (snapshot) => {
  const before = JSON.stringify(snapshot)
  freeze(snapshot)
  const result = vm.createInstitutionDetailPageViewModel(snapshot)
  assert.equal(JSON.stringify(snapshot), before, 'presentation must not mutate the application snapshot')
  return result
}
const pageFor = (viewModel) => ({
  ...pageDefinition,
  data: { ...clone(pageDefinition.data), pageState: 'ready', viewModel },
  setData(patch) { Object.assign(this.data, patch) },
})
const check = async (name, test) => { await test(); console.log('PASS ' + name) }
const complete = createDetailUiSnapshot(base, fixtures.fullCare)
complete.dataDisclosure.text = '合成测试状态，仅用于开发验收，不代表真实机构。'
complete.sections.price.referenceMonthlyPrice = fact({ kind: 'bounded', min: { amountMinor: 500000 }, max: { amountMinor: 800000 } })
const full = create(complete)
await check('T01 complete institution overview and five groups', () => {
  assert.equal(full.title, base.sections.basic.name.value)
  assert.equal(full.overview.regionAndType.length, 2)
  assert.match(full.overview.monthlyPrice.value, /5000.*8000/)
  assert.match(full.overview.careSummary, /接收|确认/)
  assert.equal(JSON.stringify(full.overview.sections.map((section) => section.title)), JSON.stringify([
    '护理与照护能力', '费用与入住', '房间与日常生活', '护理团队与管理', '机构资料与位置',
  ]))
  assert.equal(full.overview.sections[3].rows.filter((row) => row.key.startsWith('careProcess.')).length, 11)
  assert.ok(wxml.indexOf('{{reading.title}}') < wxml.indexOf('detail-cover-wrap'))
  assert.ok(wxml.indexOf('机构位置') < wxml.indexOf('reading.groups'))
  assert.match(wxml, /房型、照护等级、包含项目/)
  const reading = createDetailReading(full)
  assert.equal(JSON.stringify(reading.groups.map(row => row.key)), JSON.stringify(['fees', 'care', 'info']))
  for (const original of full.overview.sections.flatMap(section => section.rows)) {
    assert.ok(reading.groups.some(section => section.rows.some(row => row.key === original.key)
      || section.pendingLabels.split('、').includes(original.label)), original.key)
  }
})
const missingSnapshot = clone(base)
missingSnapshot.sections.price.referenceMonthlyPrice = fact(null, 'unverified', 'unknown')
missingSnapshot.sections.meals = Object.fromEntries(Object.keys(base.sections.meals).map((key) => [key, fact(null, 'unverified', 'unknown')]))
const missing = create(missingSnapshot)
await check('T02 unknown secondary fields compact by default, individually accessible', () => {
  const life = missing.overview.sections.find((section) => section.key === 'life')
  assert.match(life.summary, /房型.*膳食|居住与日常生活资料/)
  assert.equal(life.highlights.length, 0)
  assert.equal(life.rows.length, missing.mealRows.length + missing.activityRows.length)
  assert.match(wxml, /wx:if="{{expandedSections\[section.key\]}}"/)
  assert.match(wxml, /rows: section.rows/)
  assert.equal(wxml.includes('detail-cover--empty'), false)
  assert.match(missing.overview.monthlyPrice.value, /暂不明确/)
  assert.equal(new Set(missing.overview.sections.map((section) => section.summary)).size, 5)
  const fees = missing.overview.sections.find((section) => section.key === 'fees')
  assert.equal(fees.notice, '')
  assert.equal(fees.highlights.length, 0)
  assert.equal(/床位费、护理费|管理费、特殊护理费/.test(fees.summary), false)
  assert.ok(fees.rows.some((row) => row.availability === 'unknown'))
  const info = missing.overview.sections.find((section) => section.key === 'info')
  assert.equal(info.highlights.some((text) => text.includes(missing.title) || text.includes('所在区域')), false)
  assert.match(info.summary, /地址.*官方.*资质/)
  assert.equal(missing.overview.careNotices.some((text) => text.startsWith('医疗、康复及健康监测')), false)
  assert.equal(wxml.includes('{{section.number}}'), false)
  assert.match(wxml, /detail-section-title/)
  assert.match(wxml, /detail-section-state/)
  assert.match(wxml, /提交申请后，请等待机构确认看院安排/)
})
await check('T03 independent unknown, unverified, expired and unavailable semantics', () => {
  const mixed = clone(base)
  mixed.sections.meals = {
    mealSchedule: fact(null, 'unverified', 'unknown'),
    easyChewSupport: fact('available', 'unverified'),
    modifiedFoodSupport: fact('available', 'expired'),
    serviceNote: fact(null, 'unverified', 'unavailable'),
  }
  const view = create(mixed)
  const life = view.overview.sections.find((section) => section.key === 'life')
  for (const text of ['尚无明确资料', '待核验', '已过期', '不可取得或不适用']) assert.ok(life.summary.includes(text))
  assert.equal(view.mealRows[0].availability, 'unknown')
  assert.equal(view.mealRows[1].effectiveVerification, 'unverified')
  assert.equal(view.mealRows[2].effectiveVerification, 'expired')
  assert.equal(view.mealRows[3].availability, 'unavailable')
  assert.equal(life.highlights.length, 0)
  const reading = createDetailReading(view)
  const care = reading.groups.find(section => section.key === 'care')
  assert.ok(care.pendingLabels.includes(view.mealRows[0].label))
  for (const row of view.mealRows.slice(1)) assert.ok(care.rows.some(display => display.key === row.key && display.statusSummary === row.statusSummary))
})
await check('T04 unavailable map and VR have no active entry or external effect', () => {
  assert.equal(missing.location.mapAction.available, false)
  assert.equal(missing.media.canOpenVr, false)
  assert.match(wxml, /<button wx:if="{{viewModel.location.mapAction.available}}"[^>]*bindtap="onMapTap"/)
  assert.match(wxml, /wx:if="{{section.key === 'care' && viewModel.media.canOpenVr}}"/)
  assert.match(wxml, /<button[^>]*bindtap="onVrTap"/)
  assert.equal(wxml.includes('vr-status'), false)
  const page = pageFor(missing)
  const count = calls.map.length
  page.onMapTap()
  assert.equal(calls.map.length, count)
})
await check('T05 synthetic ready map, media and VR retain existing controlled behavior', () => {
  const readySnapshot = createDetailUiSnapshot(base, fixtures.mapReady)
  readySnapshot.sections.media.vr = { state: 'available', canNavigate: true, sceneCount: 1 }
  readySnapshot.actions.canOpenVr = true
  readySnapshot.sections.media.cover = { ...readySnapshot.sections.media.cover, state: 'current_verified', url: 'https://example.invalid/synthetic-cover.jpg' }
  const ready = create(readySnapshot)
  assert.equal(ready.media.canOpenVr, true)
  assert.equal(ready.media.hasCover, true)
  const page = pageFor(ready)
  page.onCoverLoadError()
  assert.equal(page.data.coverLoadFailed, true)
  assert.equal(ready.media.hasCover, true, 'load failure must not rewrite verification or availability')
  assert.match(wxml, /viewModel.media.hasCover && !coverLoadFailed/)
  const count = calls.map.length
  page.onMapTap()
  page.onMapTap()
  assert.equal(calls.map.length, count + 1)
  assert.equal(calls.map.at(-1).latitude, ready.location.mapAction.latitude)
  assert.equal(calls.map.at(-1).longitude, ready.location.mapAction.longitude)
  calls.map.at(-1).complete()
  page.onMapTap()
  assert.equal(calls.map.length, count + 2)
  calls.map.at(-1).complete()
  page.onVrTap()
  assert.equal(page.data.actionErrorMessage, '')
  assert.equal(calls.navigate.length, 0, 'an unbound synthetic UI cannot invent a canonical VR route; bound routes are covered by check:institution-vr-runtime')
  const unavailable = clone(readySnapshot)
  unavailable.sections.media.vr.state = 'unknown'
  assert.equal(create(unavailable).media.canOpenVr, false)
  writeFileSync(path.join(output, 'synthetic-ready-view.json'), JSON.stringify(ready, null, 2))
})
await check('T06 recommendation uses existing reason/difference display mapping only', () => {
  const snapshot = createDetailUiSnapshot(base, fixtures.fullCare, { contextKind: 'RECOMMENDATION_PINNED', recommendationContext: makePinnedRecommendationContext() })
  const view = create(snapshot)
  assert.equal(view.recommendation.reasons.length, 1)
  assert.equal(view.recommendation.differences.length, 1)
  assert.match(view.recommendation.differences[0].value, /饮食|确认|不明确/)
  assert.match(wxml, /viewModel.recommendation.differences/)
  writeFileSync(path.join(output, 'synthetic-pinned-view.json'), JSON.stringify(view, null, 2))
})
await check('T07 direct directory detail has no personalized recommendation', () => {
  assert.equal(missing.recommendation, null)
  assert.match(wxml, /wx:if="{{viewModel.recommendation}}"/)
})
await check('T08 independent expand/collapse, invalid actions, navigation guard and failure recovery', async () => {
  const page = pageFor(full)
  assert.equal(Object.keys(page.data.expandedSections).length, 0)
  const toggle = (key) => page.onSectionToggle({ currentTarget: { dataset: { sectionKey: key } } })
  toggle('team'); toggle('life')
  assert.equal(page.data.expandedSections.team, true)
  assert.equal(page.data.expandedSections.life, true)
  toggle('team')
  assert.equal(page.data.expandedSections.team, false)
  assert.equal(page.data.expandedSections.life, true)
  const before = JSON.stringify(page.data.expandedSections)
  toggle('invalid')
  assert.equal(JSON.stringify(page.data.expandedSections), before)
  const boundPage = pageFor(full)
  boundPage.onLoad({ institutionId: identity.institutionId, recordRevision: String(identity.recordRevision) })
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(boundPage.data.pageState, 'ready')
  assert.equal(boundPage.data.coverLoadFailed, false)
  boundPage.onAppointmentTap(); boundPage.onAppointmentTap()
  assert.equal(calls.navigate.length, 1)
  assert.match(calls.navigate[0].url, /pages\/appointment\/create/)
  calls.navigate[0].fail()
  calls.navigate[0].complete()
  assert.match(boundPage.data.actionErrorMessage, /无法/)
  boundPage.onAppointmentTap()
  assert.equal(calls.navigate.length, 2)
  boundPage.onShow()
  boundPage.onConsultantTap(); boundPage.onConsultantTap()
  assert.equal(calls.tab.length, 0)
  assert.equal(calls.navigate.length, 3)
  assert.equal(calls.navigate[2].url, '/pages/consultant/consultation')
  boundPage.onShow()
  boundPage.onBackToList(); boundPage.onBackToList()
  assert.equal(calls.back.length, 1)
  assert.equal((wxml.match(/bindtap="onSectionToggle"/g) || []).length, 1)
  assert.match(less, /\.detail-sticky-actions[^}]*position: static/)
  assert.equal(/\.ws-footer\(/.test(less), false)
  assert.match(wxml, /bind:action="onConsultantTap"/)
  assert.match(wxml, /bind:action="onAppointmentTap"/)
})
await check('T09 presentation retains facts, CareProcess statuses and precise Chinese labels', () => {
  const synthetic = createDetailUiSnapshot(base, fixtures.partialCare)
  synthetic.sections.transportHospital.transportation = { metro: {
    nearestStationName: fact(null, 'unverified', 'unknown'),
    routeNote: fact(null, 'unverified', 'unavailable'),
  } }
  synthetic.sections.activity.zones = Object.fromEntries(['publicActivityZone', 'activeAgingZone', 'careZone', 'dementiaZone'].map((key) => [key, fact(null, 'unverified', 'unknown')]))
  synthetic.sections.rooms = [{
    roomId: 'synthetic-room-only', name: fact('合成房型'), roomType: fact('single'),
    areaSquareMeters: fact({ min: 10, max: 20 }), bedType: fact('nursing_bed'),
    features: { accessibility: fact('present'), magnifier: fact(null, 'unverified', 'unknown') },
    referencePrice: fact(null, 'unverified', 'unknown'), mediaIds: [],
  }]
  const view = create(synthetic)
  assert.equal(JSON.stringify(view.transportRows.map((row) => row.label)), JSON.stringify(['最近地铁站点', '交通路线说明']))
  assert.equal(JSON.stringify(view.activityRows.filter((row) => row.key.includes('.zones.')).map((row) => row.label)), JSON.stringify(['公共活动区域', '活力养老区域', '照护区域', '认知照护区域']))
  assert.ok(view.rooms[0].rows.some((row) => row.label === '无障碍设施' && row.value === '已提供'))
  assert.ok(view.rooms[0].rows.some((row) => row.label === '放大镜' && row.availability === 'unknown'))
  const team = view.overview.sections.find((section) => section.key === 'team')
  assert.equal(team.rows.filter((row) => row.key.startsWith('careProcess.')).length, 11)
  assert.ok(team.rows.some((row) => row.key.includes('completeness') && row.availability === 'unknown'))
  for (const section of view.overview.sections) for (const row of section.rows) assert.equal(/[a-z][A-Z]|_/.test(row.label), false, row.label)
})
writeFileSync(path.join(output, 'live-view.json'), JSON.stringify(create(clone(base)), null, 2))
console.log('INSTITUTION_DETAIL_UX_P0 = PASS (9/9; local presentation checks)')
