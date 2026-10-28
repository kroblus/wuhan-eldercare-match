import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
for (const mode of ['production', 'demo']) {
  const wx = { cloud: {}, getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }) }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, setTimeout, clearTimeout })
  const load = file => rt.load(path.join('dist', mode, 'miniprogram', file + '.js'))
  vm.runInContext("Date.now = () => Date.parse('2026-10-23T00:00:00Z')", rt.context)
  load('app'); if (mode === 'demo') await load('demo/session').loadDemo()
  const { presentDirectoryPrice, decorateDirectoryCards } = load('pages/institution/directory-presentation')
  const current = value => ({ availability: 'provided', effectiveVerification: 'current_verified', value })
  const value = { kind: 'bounded', minAmountMinor: 380050, maxAmountMinor: 500000, currency: 'CNY', period: 'month', basis: 'reference_total' }
  const price = { referenceMonthlyPrice: current(value), recurringComponents: [], oneTimeFees: [] }
  check(presentDirectoryPrice(price) === '参考月费 ¥3,800.5–5,000/月', 'bounded reference total preserves exact cents and month')
  check(presentDirectoryPrice({ ...price, referenceMonthlyPrice: current({ ...value, kind: 'starting_at', maxAmountMinor: null }) }) === '参考月费 ¥3,800.5起/月', 'starting-at is not a complete bounded quote')
  for (const patch of [{ availability: 'unknown' }, { availability: 'unavailable' }, { effectiveVerification: 'expired' }, { effectiveVerification: 'unverified' }, { value: null }]) check(presentDirectoryPrice({ ...price, referenceMonthlyPrice: { ...price.referenceMonthlyPrice, ...patch } }) === '', 'noncurrent price never becomes a number: ' + JSON.stringify(patch))
  for (const patch of [{ currency: 'USD' }, { period: 'one_time' }, { basis: 'care_fee' }, { minAmountMinor: -1 }, { minAmountMinor: 1.5 }, { maxAmountMinor: 1 }, { kind: 'starting_at' }, { kind: 'invented' }]) check(presentDirectoryPrice({ ...price, referenceMonthlyPrice: current({ ...value, ...patch }) }) === '', 'wrong unit/scope/range hidden: ' + JSON.stringify(patch))
  for (const patch of [{ priceNote: current('仅限某房型') }, { adjustmentFactors: current([{ factor: 'care_level' }]) }, { deposit: current({ min: 100 }) }, { oneTimeFees: [{ label: '另行收费' }] }, { recurringComponents: [{ referenceAmount: current(100) }] }]) check(presentDirectoryPrice({ ...price, ...patch }) === '', 'quote with extra limitations stays in Detail: ' + JSON.stringify(patch))
  const service = load('services/institution-list-detail-page')
  const directoryService = load('services/institution-directory-read').institutionDirectoryReadService
  const result = await service.buildInstitutionListPageSnapshot(null)
  check(result.ok, mode + ' application list builds')
  const list = load('pages/institution/list-view-model').createInstitutionListPageViewModel(result.value).items
  const before = JSON.stringify(list)
  const pinned = { ...list[0], navigationIntent: { ...list[0].navigationIntent, source: 'recommendation', sourceContextRef: 'TEST_ONLY-pinned-context' } }
  check((await decorateDirectoryCards([pinned], result.value.evaluationAsOf))[0] === pinned, 'recommended candidate bypasses compact decoration and keeps full source context')
  const cards = await decorateDirectoryCards(list, result.value.evaluationAsOf)
  const reads = await directoryService.read(list.map(item => ({ institutionId: item.institutionId, recordRevision: item.recordRevision })), result.value.evaluationAsOf)
  check(JSON.stringify(list) === before, 'ordinary decoration cannot mutate recommendation/base view model')
  check(cards.length === (mode === 'demo' ? 12 : 11), 'original provider count unchanged')
  check(cards.every((item, index) => item.card.compact && item.key === list[index].key && JSON.stringify(item.navigationIntent) === JSON.stringify(list[index].navigationIntent)), 'compact display preserves canonical identity/revision/source/order')
  check(cards.every((item, index) => list[index].card.notes.every(note => item.card.notes.includes(note))), 'all original phone and institution-specific risks retained')
  check(cards.every(item => !item.card.phone && !item.card.addressStatus), 'ordinary cards have no generic contact/status prose')
  for (const [index, item] of cards.entries()) {
    const detail = await service.institutionDetailApplicationV12.build({ identity: { institutionId: item.institutionId, recordRevision: item.recordRevision }, source: 'direct', sourceContextRef: null, evaluationAsOf: result.value.evaluationAsOf })
    check(detail.ok, 'exact revision Detail application builds')
    check(reads[index].ok, 'lightweight read resolves the same exact revision')
    const light = reads[index].value
    check(JSON.stringify(light.sections.price) === JSON.stringify(detail.value.sections.price), 'all price facts match the independent full Detail path')
    check(JSON.stringify(light.sections.futureV121.officialAddress) === JSON.stringify(detail.value.sections.futureV121.officialAddress), 'official address facts match Detail at the same time')
    check(JSON.stringify(light.sections.futureV121.officialContact) === JSON.stringify(detail.value.sections.futureV121.officialContact), 'official phone states and call intents match Detail at the same time')
    check(Object.keys(light.sections).sort().join(',') === 'futureV121,price' && Object.keys(light.sections.futureV121).sort().join(',') === 'officialAddress,officialContact', 'read result contains only the required directory sections')
    const view = load('pages/institution/detail-view-model').createInstitutionDetailPageViewModel(detail.value)
    check(item.card.address === (view.location.addressState === 'ready' ? view.location.address : ''), 'address uses exact existing current verified application projection, never guessed data')
  }
  if (mode === 'production') {
    check(cards.every(item => !item.card.isDemo && !item.card.price), 'production has zero fabricated/synthetic price coverage')
    check(cards.find(item => item.institutionId === 'wh-qiaokou-social-welfare').card.notes.includes('不同政府公开资料列示的联系电话不一致，尚未核实，暂不提供拨号入口。'), 'actual production conflicting official contacts remain fully visible')
    check(cards.find(item => item.institutionId === 'wh-dongxihu-jiangjunlu-eldercare').card.notes.includes('公开名单仅列联系人手机号，本页未将其作为机构官方固定电话。'), 'actual production personal-contact-only warning is retained')
    check(cards.find(item => item.institutionId === 'wh-dongxihu-baiquan-eldercare').card.notes.length === 0, 'current verified official phone does not add generic positive/negative clutter')
  } else {
    check(cards.every(item => item.card.isDemo) && cards.some(item => item.card.price.includes('–')) && cards.some(item => item.card.price.includes('起/月')) && cards.some(item => !item.card.price), 'existing Demo bounded/starting/absent values only, TEST ONLY identity stays intact')
    check(cards.every(item => !item.card.notes.includes('官方联系电话待确认')), 'all-unknown Demo contacts do not generate repeated generic warnings')
  }
  const originalRead = directoryService.read
  const item = list[0], good = reads[0]
  for (const patch of [{ identity: { ...good.value.identity, recordRevision: 999 } }, { identity: { ...good.value.identity, institutionId: 'TEST_ONLY-wrong' } }, { datasetMode: mode === 'demo' ? 'PRODUCTION' : 'MOCK_DEVELOPMENT_ONLY' }, { recordProvenance: mode === 'demo' ? 'PRODUCTION_CANDIDATE' : 'MOCK_DEVELOPMENT_ONLY' }, { source: 'recommendation' }, { recordStatus: 'archived' }, { contextKind: 'RECOMMENDATION_PINNED' }, { recommendationContext: { unexpected: true } }, { evaluationAsOf: '1999-01-01T00:00:00Z' }]) {
    directoryService.read = async () => [{ ok: true, value: { ...good.value, ...patch } }]
    const rejected = (await decorateDirectoryCards([item], result.value.evaluationAsOf))[0]
    check(!rejected.card.address && !rejected.card.price && item.card.notes.every(note => rejected.card.notes.includes(note)), 'wrong identity/version/mode/context/date fails closed without losing risks')
  }
  directoryService.read = originalRead
  // The isolated Demo price evidence expires later than Production's public facts.
  const expiredAsOf = mode === 'production' ? '2027-02-01T00:00:00Z' : '2028-01-01T00:00:00Z'
  vm.runInContext('Date.now = () => Date.parse(' + JSON.stringify(expiredAsOf) + ')', rt.context)
  const expiredResult = await service.institutionListApplicationV12.build({ evaluationAsOf: expiredAsOf, sourceContextRef: null })
  check(expiredResult.ok && expiredResult.value.evaluationAsOf === expiredAsOf, 'expiry test explicitly evaluates the real application at the requested time; Date.now alone does not replace new Date')
  const expiredList = load('pages/institution/list-view-model').createInstitutionListPageViewModel(expiredResult.value).items
  const expiredCards = await decorateDirectoryCards(expiredList, expiredResult.value.evaluationAsOf)
  const expiredReads = await directoryService.read(expiredList.map(item => ({ institutionId: item.institutionId, recordRevision: item.recordRevision })), expiredAsOf)
  for (const [index, item] of expiredList.entries()) {
    const detail = await service.institutionDetailApplicationV12.build({ identity: { institutionId: item.institutionId, recordRevision: item.recordRevision }, source: 'direct', sourceContextRef: null, evaluationAsOf: expiredAsOf })
    check(detail.ok && expiredReads[index].ok, 'both paths resolve the expired record')
    const light = expiredReads[index].value.sections, full = detail.value.sections
    check(JSON.stringify(light.price) === JSON.stringify(full.price) && JSON.stringify(light.futureV121.officialAddress) === JSON.stringify(full.futureV121.officialAddress) && JSON.stringify(light.futureV121.officialContact) === JSON.stringify(full.futureV121.officialContact), 'expiry preserves identical price/address/phone facts across both paths')
  }
  check(expiredCards.every(item => !item.card.price && !item.card.address), 'expired address and price cannot retain a direct factual value')
  if (mode === 'production') {
    const expiredPhone = expiredCards.find(item => item.institutionId === 'wh-dongxihu-baiquan-eldercare').card
    check(expiredPhone.notes.includes('电话资料已过核验期') && expiredPhone.notes.includes('地址资料已过核验期'), 'real production contact/address expiry remains explicit after generic contact row removal')
    check(expiredCards.find(item => item.institutionId === 'wh-qiaokou-social-welfare').card.notes.includes('不同政府公开资料列示的联系电话不一致，尚未核实，暂不提供拨号入口。'), 'original phone conflict remains visible after evidence expiry')
  } else check(expiredCards.every(item => !item.card.notes.includes('官方联系电话待确认') && !item.card.notes.includes('电话资料已过核验期')), 'Demo unknown phones are not mislabeled expired when unrelated price evidence expires')
  console.log('PASS ' + mode + ': direct addresses, precise reference prices, qualifiers, isolation, identity, risk retention')
}
const template = fs.readFileSync('miniprogram/templates/institution-directory.wxml', 'utf8')
const amendment = fs.readFileSync('docs/architecture/INSTITUTION_ORDINARY_DIRECTORY_DISPLAY_AMENDMENT_V1.md', 'utf8')
check(amendment.includes('DOC_STATUS = FROZEN') && amendment.includes('ADDRESS_CONTRACT_APPROVAL = OWNER_EXPLICIT_REQUEST_V2_1_B1_2_3') && amendment.includes('DISPLAY_POLICY_VERSION = institution-ordinary-directory-display-v1'), 'direct address implementation has explicit approved successor scope; old Frozen is not silently overwritten')
const ordinary = template.slice(template.indexOf('<block wx:if="{{item.card.compact}}"'), template.indexOf('<view wx:elif="{{item.card.address'))
check(!/地址资料|收费信息|费用待咨询|item.card.phone/.test(ordinary), 'ordinary branch contains only conditional address and exact reference price')
check(ordinary.includes('wx:if="{{item.card.address}}"') && ordinary.includes('wx:if="{{item.card.price}}"'), 'missing address/price leaves no empty row')
check((template.match(/bindtap="onCardTap"/g) || []).length === 1 && !/institution-detail-link[^>]+bindtap/.test(template), 'whole card and detail affordance share one event path')
check(template.includes('!item.card.compact && item.card.phone') && template.includes('TEST ONLY') && ordinary.includes('随照护等级、房型等变化，非最终报价'), 'recommended cards retain original phone prose; synthetic identity and reference-price caveat explicit')
for (const mode of ['production', 'demo']) {
  const css = fs.readFileSync('dist/' + mode + '/miniprogram/pages/home/index.wxss', 'utf8')
  check(!/line-clamp|text-overflow:\s*ellipsis/.test(css), 'long addresses/names/risks are never truncated')
  check(/\.institution-address--direct\s*\{[^}]*margin-top/.test(css) && !/\.institution-address--direct\s*\{[^}]*(?:max-height|height|overflow):/.test(css), 'direct address naturally wraps under system font scaling')
}
console.log('V2_1_B1_2_3_CARDS = PASS (' + assertions + ' assertions; application and native source/generated style, not device evidence)')
