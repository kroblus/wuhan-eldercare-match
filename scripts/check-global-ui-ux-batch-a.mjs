import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'

const { ts } = loadWechatTypeScript()
const evidence = 'docs/design/global-ui-ux-fix-batch-a-v1-evidence/'
const plain = value => JSON.parse(JSON.stringify(value))
const effects = [], navigations = []
let page, activePage
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ fontSizeSetting: 16, platform: 'devtools', safeArea: { top: 0 } }),
  pageScrollTo() {},
}
for (const key of ['request', 'login', 'getStorageSync', 'setStorageSync', 'makePhoneCall', 'openLocation', 'openCustomerServiceChat']) wx[key] = () => effects.push(key)
for (const key of ['navigateTo', 'redirectTo', 'navigateBack']) wx[key] = options => {
  navigations.push({ key, url: options.url, delta: options.delta })
  options.success?.({}); options.complete?.({})
}
const rt = createWechatTsRuntime(ts, { wx, App() {}, Page(p) { page = p }, Component() {}, setTimeout, clearTimeout, getCurrentPages: () => activePage ? [activePage] : [] })
const load = file => rt.load(path.resolve('dist/demo/miniprogram', file + '.js'))
const make = file => { load(file); return { ...page, data: plain(page.data), setData(v) { Object.assign(this.data, v) } } }
load('app')
const session = load('demo/session')
await session.loadDemo()
const before = JSON.stringify(session.readDemo())
const vm = load('pages/recommendation/result-v2-view-model').createRecommendationResultViewModelV2
const cards = session.readDemo().assessments.map(a => vm(a.recommendationSnapshot))
if (process.argv.includes('--record-baseline')) {
  fs.writeFileSync(evidence + 'recommendation-before.json', JSON.stringify(plain(cards), null, 2))
  console.log('Recorded pre-fix recommendation projection from existing built baseline'); process.exit(0)
}

const expected = JSON.parse(fs.readFileSync(evidence + 'recommendation-before.json'))
for (const group of expected) for (const key of ['cards', 'conditionalCards']) for (const card of group[key]) card.region = card.region.replace(/（Mock 演示目录）$/, '')
assert.deepEqual(plain(cards), expected, 'only the known Demo region suffix may change; order, reasons, differences, counts and identity remain exact')
for (const result of cards) for (const card of [...result.cards, ...result.conditionalCards]) assert.doesNotMatch(card.region, /Mock/)
assert.match(fs.readFileSync('dist/demo/miniprogram/pages/recommendation/result.wxml', 'utf8'), /演示数据 · 虚构机构/)

const time = load('demo/appointment-time').appointmentTimePresentation
const matrix = []
for (const status of ['requested', 'contacting', 'scheduled', 'completed', 'cancelled']) for (const date of ['', '2026年10月20日 10:00']) {
  const result = plain(time(status, date))
  assert.equal(result.time, date || (['completed', 'cancelled'].includes(status) ? '未记录' : '具体时间待确认'))
  assert.equal(result.timeLabel, status === 'completed' ? '看院时间' : '预约时间')
  matrix.push({ status, explicitRecordedTime: date || null, ...result })
}
const list = make('pages/appointment/index'); list.onLoad({}); list.onShow()
for (const row of list.data.rows) {
  assert.deepEqual({ time: row.time, timeLabel: row.timeLabel }, plain(time(row.status)))
  assert.equal(!!row.action, row.status === 'completed')
}
const booking = make('pages/appointment/create')
await booking.onLoad({ institutionId: 'demo-inst-chunhe-home', recordRevision: '1', source: 'direct_link' })
assert.equal(booking.data.state, 'completed'); assert.equal(booking.data.time, '未记录'); assert.equal(booking.data.timeLabel, '看院时间')
activePage = booking; booking.evaluate(); assert.match(navigations.at(-1).url, /visit\/evaluation\?visitId=/)
await session.loadDemo(); assert.equal(JSON.stringify(session.readDemo()), before, 'presentation, re-entry and repeated loading cannot mutate entities/snapshots/status')

for (const mode of ['demo', 'production']) {
  const markup = fs.readFileSync('dist/' + mode + '/miniprogram/pages/institution/index.wxml', 'utf8')
  assert.match(markup, /<navigation-bar[^>]+title="养老机构"/)
  assert.match(markup, /推荐机构资料/)
}

// Isolated VM only: actual Production gate stays false. Instrument the data
// reader to prove a closed gate never invokes it or creates a request.
let productionPage, reads = 0
const productionWx = { ...wx, request() { effects.push('production.request') } }
const prod = createWechatTsRuntime(ts, { wx: productionWx, Page(p) { productionPage = p }, Component() {}, setTimeout, clearTimeout, getCurrentPages: () => activePage ? [activePage] : [] })
const pload = file => prod.load(path.resolve('dist/production/miniprogram', file + '.js'))
const service = pload('services/institution-list-detail-page')
service.buildInstitutionDetailPageSnapshot = async () => { reads++; throw new Error('TEST_ONLY unavailable institution') }
const policy = pload('production/catalog')
assert.equal(policy.canRequestInstitutionService('wh-jiangan-social-welfare'), false)
pload('pages/appointment/create')
const p = () => ({ ...productionPage, data: plain(productionPage.data), setData(v) { Object.assign(this.data, v) } })
const closed = p(); activePage = closed
closed.onLoad({ institutionId: 'wh-jiangan-social-welfare', recordRevision: '1', source: 'direct_link' }); closed.onShow()
assert.equal(closed.data.pageState, 'service_unavailable')
assert.equal(closed.data.pageDescription, '目前暂不支持在线提交看院预约。您可以先浏览养老机构资料，了解服务内容。')
assert.equal(closed.data.returnInstitutionButtonText, '返回养老机构')
assert.equal(reads, 0)
await closed.onPrepareAppointment(); await closed.onPhoneAuthorization({ detail: { code: 'TEST_ONLY' } })
const n = navigations.length; closed.onReturnToInstitution(); closed.onReturnToInstitution()
assert.equal(navigations.length, n + 1); assert.equal(navigations.at(-1).url, '/pages/institution/index')
const failedReturn = p(); activePage = failedReturn
failedReturn.onLoad({ institutionId: 'wh-jiangan-social-welfare', recordRevision: '1' })
let failedReturns = 0
productionWx.redirectTo = options => { failedReturns++; options.fail?.({}); options.complete?.({}) }
failedReturn.onReturnToInstitution(); failedReturn.onReturnToInstitution()
assert.equal(failedReturns, 2, 'a failed navigation releases its guard for retry')
assert.equal(failedReturn.data.actionMessage, '暂时无法返回养老机构，请使用页面左上角返回。')
const markup = fs.readFileSync('dist/production/miniprogram/pages/appointment/create.wxml', 'utf8')
assert.match(markup, /service_unavailable' \? '预约服务尚未开放'/)
assert.match(markup, /'route_error' \? '预约入口无效' : '机构资料暂不可用'/)

// Test seam in this VM only exercises existing gate-on error branches; no
// source policy, production build or fixture is changed by these assignments.
policy.canRequestInstitutionService = () => true
const invalid = p(); activePage = invalid; invalid.onLoad({})
assert.equal(invalid.data.pageState, 'route_error')
const unavailable = p(); activePage = unavailable
unavailable.onLoad({ institutionId: 'wh-jiangan-social-welfare', recordRevision: '1', source: 'direct_link' })
await new Promise(resolve => setImmediate(resolve))
assert.equal(reads, 1); assert.equal(unavailable.data.pageState, 'institution_unavailable')
assert.match(unavailable.data.pageDescription, /无法读取/)
service.buildInstitutionDetailPageSnapshot = async () => ({ ok: false })
const missing = p(); activePage = missing
missing.onLoad({ institutionId: 'wh-jiangan-social-welfare', recordRevision: '999', source: 'direct_link' })
await new Promise(resolve => setImmediate(resolve))
assert.equal(missing.data.pageState, 'institution_unavailable'); assert.match(missing.data.pageDescription, /指定版本/)
service.buildInstitutionDetailPageSnapshot = async () => ({ ok: true, value: { sections: { basic: { name: { availability: 'unknown' } } } } })
const nameless = p(); activePage = nameless
nameless.onLoad({ institutionId: 'wh-jiangan-social-welfare', recordRevision: '1', source: 'direct_link' })
await new Promise(resolve => setImmediate(resolve))
assert.equal(nameless.data.pageState, 'institution_unavailable'); assert.match(nameless.data.pageDescription, /没有可展示的机构名称/)
assert.equal(effects.length, 0)
fs.writeFileSync(evidence + 'appointment-time-matrix.json', JSON.stringify(matrix, null, 2))
console.log('PASS GUI-008: closed gate/no reads/no submit/single return; route/read-error branches preserved in isolated VM')
console.log('PASS GUI-002: both directory titles; recommendation-context title unchanged')
console.log('PASS GUI-005: five statuses x date/no-date; Demo list/create agree; completed evaluation and immutable records')
console.log('PASS GUI-007: full baseline projection equality except suffix; provenance, order, reasons and context preserved')
