import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
for (const mode of ['production', 'demo']) {
  const calls = [], messages = []
  let component, pageDefinition, navigations = 0
  let throws = false
  const wx = { cloud: {}, getStorageSync() {}, getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }),
    navigateTo: options => { navigations++; options.success(); options.complete() },
    makePhoneCall: options => { if (throws) throw Error('TEST_ONLY API throw'); calls.push(options) } }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, Component(definition) { component = definition }, Page(definition) { pageDefinition = definition }, setTimeout, clearTimeout })
  const load = file => rt.load(path.join('dist', mode, 'miniprogram', file + '.js'))
  load('app'); if (mode === 'demo') await load('demo/session').loadDemo()
  const service = load('services/institution-list-detail-page')
  const presentation = load('pages/institution/directory-presentation')
  const action = load('pages/institution/directory-call')
  const snapshot = await service.buildInstitutionListPageSnapshot(null)
  check(snapshot.ok, mode + ' current ordinary directory builds')
  const cards = await presentation.decorateDirectoryCards(load('pages/institution/list-view-model').createInstitutionListPageViewModel(snapshot.value).items, snapshot.value.evaluationAsOf)
  check(cards.every(item => !JSON.stringify(item.card).includes('dialValue')), 'card data never carries dial values')
  check(cards.every(item => item.card.compact), 'only ordinary current list receives compact action presentation')
  const app = service.institutionDetailApplicationV12, originalBuild = app.build
  const invoke = (page, item, read = () => [item]) => action.callDirectoryPhone(page, item.key, read, message => messages.push(message))
  const target = cards.find(item => item.card.phoneKey) || cards[0]
  const event = { currentTarget: { dataset: { itemKey: target.key } } }
  const host = definition => ({ ...definition, ...definition.methods, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } })
  load('pages/home/index'); const home = host(component)
  Object.assign(home.data, { isLoading: false, loadError: false, institutions: [target] })
  home.onDirectoryPhoneTap(event); home.onDirectoryPhoneTap(event); await flush()
  check(navigations === 0 && (mode === 'demo' ? calls.length === 0 && home.data.institutionActionError.includes('TEST ONLY') : calls.length === 1), mode + ' actual Home phone handler performs only guarded call/simulation and no navigation')
  if (mode === 'production') {
    check(home.data.actionErrorKey === '' && home.data.institutionActionError === '', 'Home pending call has no empty feedback row')
    calls[0].fail({ errMsg: 'TEST_ONLY cancel' }); calls[0].complete()
    check(home.data.actionErrorKey === target.key && !!home.data.institutionActionError, 'Home failure remains visible near its card')
    home.onDirectoryPhoneTap(event); await flush()
    check(home.data.actionErrorKey === '' && home.data.institutionActionError === '', 'Home retry clears text and feedback row together')
    calls.at(-1).success(); calls.at(-1).complete()
    check(home.data.actionErrorKey === '', 'Home successful completion leaves no empty feedback row')
  } else check(home.data.actionErrorKey === target.key, 'Home simulation feedback stays near its Demo card')
  home.onCardTap(event); home.onCardTap(event)
  check(navigations === 1, mode + ' Home detail handler still navigates at most once')
  load('pages/institution/index'); const directory = host(pageDefinition)
  Object.assign(directory.data, { pageState: 'ready', sourceContextRef: null, visibleItems: [target], viewModel: { items: [target] } })
  const beforePageCall = calls.length
  directory.onDirectoryPhoneTap(event); directory.onDirectoryPhoneTap(event); await flush()
  check(navigations === 1 && (mode === 'demo' ? calls.length === beforePageCall && directory.data.actionErrorMessage.includes('TEST ONLY') : calls.length === beforePageCall + 1), mode + ' actual ordinary List phone handler keeps one call and zero parent navigation')
  if (mode === 'production') {
    check(directory.data.actionErrorKey === '' && directory.data.actionErrorMessage === '', 'List pending call has no empty feedback row')
    calls.at(-1).fail({ errMsg: 'TEST_ONLY fail' }); calls.at(-1).complete()
    check(directory.data.actionErrorKey === target.key && !!directory.data.actionErrorMessage, 'List failure remains visible near its card')
    directory.onDirectoryPhoneTap(event); await flush()
    check(directory.data.actionErrorKey === '' && directory.data.actionErrorMessage === '', 'List retry clears text and feedback row together')
    calls.at(-1).success(); calls.at(-1).complete()
    check(directory.data.actionErrorKey === '', 'List successful completion leaves no empty feedback row')
  } else check(directory.data.actionErrorKey === target.key, 'List simulation feedback stays near its Demo card')
  calls.length = 0
  if (mode === 'demo') {
    check(cards.length === 12 && cards.filter(item => item.card.price).length === 7 && cards.every(item => !item.card.phoneKey), 'existing Demo coverage and synthetic phone gating unchanged')
    const item = { ...cards[0], card: { ...cards[0].card, phoneKey: 'TEST_ONLY-injected-phone' } }
    await invoke({}, item)
    check(calls.length === 0 && messages.at(-1).includes('TEST ONLY'), 'even injected Demo number only simulates and never calls')
    continue
  }
  const item = cards.find(item => item.card.phoneKey)
  check(!!item, 'actual published Production current official action available')
  const noPhone = cards.find(item => !item.card.phoneKey)
  check(!!noPhone && cards.every(item => !item.card.price), 'unavailable phone sample and zero Production prices retained')
  const conflict = cards.find(item => item.institutionId === 'wh-qiaokou-social-welfare')
  check(!conflict.card.phoneKey && conflict.card.notes.some(note => note.includes('不一致')), 'actual public-phone conflict is blocked with original risk')
  const personal = cards.find(item => item.institutionId === 'wh-dongxihu-jiangjunlu-eldercare')
  check(!personal.card.phoneKey && personal.card.notes.some(note => note.includes('联系人手机号')), 'personal mobile never becomes official call action')
  await invoke({}, noPhone); await invoke({}, conflict)
  check(calls.length === 0, 'missing and conflicting phone cannot invoke API')
  const projected = await originalBuild({ identity: { institutionId: item.institutionId, recordRevision: item.recordRevision }, source: 'direct', sourceContextRef: null, evaluationAsOf: snapshot.value.evaluationAsOf })
  const good = projected.value
  const detailPhone = presentation.directoryPhone(good)
  check(detailPhone.key === item.card.phoneKey && detailPhone.callAction.available, 'selected key equals first legal Detail VM official action')
  const page = {}, pending = invoke(page, item)
  void invoke(page, item); await pending
  check(calls.length === 1 && calls[0].phoneNumber === detailPhone.callAction.dialValue, 'rapid preflight taps invoke correct exact phone once')
  await invoke(page, item); check(calls.length === 1, 'native API pending also prevents repeated taps')
  action.invalidateDirectoryCall(page, false); action.invalidateDirectoryCall(page, true)
  await invoke(page, item); check(calls.length === 1, 'hide/show cannot unlock unfinished native phone API')
  calls[0].fail({ errMsg: 'makePhoneCall:fail cancel' }); calls[0].complete()
  await invoke(page, item); check(calls.length === 2, 'cancelled call becomes retryable after return')
  calls[0].complete(); await invoke(page, item)
  check(calls.length === 2, 'late completion from old action cannot unlock new pending call')
  calls[1].fail({ errMsg: 'TEST_ONLY fail' }); calls[1].complete()
  check(messages.some(message => message.includes('取消')), 'failure/cancel provides actionable feedback')
  throws = true; await invoke(page, item); throws = false; await invoke(page, item)
  check(calls.length === 3, 'synchronous API exception releases action for retry')
  calls[2].complete(); await invoke(page, item)
  check(calls.length === 4, 'complete-only unsuccessful API releases with feedback')
  calls[3].success(); calls[3].complete()
  const other = cards.find(candidate => candidate.key !== item.key && candidate.card.phoneKey)
  check(!!other, 'multiple legal Production cards exist')
  await invoke(page, other)
  const otherSnapshot = await originalBuild({ identity: { institutionId: other.institutionId, recordRevision: other.recordRevision }, source: 'direct', sourceContextRef: null, evaluationAsOf: snapshot.value.evaluationAsOf })
  check(calls.at(-1).phoneNumber === presentation.directoryPhone(otherSnapshot.value).callAction.dialValue, 'another card resolves its own identity and number')
  calls.at(-1).success(); calls.at(-1).complete()
  const beforeInvalid = calls.length
  for (const patch of [{ identity: { ...good.identity, recordRevision: 999 } }, { identity: { ...good.identity, institutionId: 'TEST_ONLY-wrong' } }, { source: 'recommendation' }, { contextKind: 'RECOMMENDATION_PINNED' }, { recommendationContext: {} }, { recordStatus: 'archived' }, { evaluationAsOf: '1999-01-01T00:00:00Z' }, { datasetMode: 'MOCK_DEVELOPMENT_ONLY' }, { recordProvenance: 'MOCK_DEVELOPMENT_ONLY' }]) {
    app.build = async input => ({ ok: true, value: { ...good, evaluationAsOf: input.evaluationAsOf, ...patch } })
    await invoke({}, item)
    check(calls.length === beforeInvalid, 'wrong identity/revision/source/time/mode fails closed: ' + Object.keys(patch))
  }
  const contact = good.sections.futureV121.officialContact
  for (const patch of [{ status: 'unknown' }, { status: 'unavailable' }, { directory: { ...contact.directory, availability: 'unknown' } }, { directory: { ...contact.directory, effectiveVerification: 'expired' } }, { directory: { ...contact.directory, effectiveVerification: 'unverified' } }, { directory: { ...contact.directory, value: 'absent' } }, { phones: contact.phones.map(phone => ({ ...phone, status: 'expired', callActionAvailable: false, dialValue: null })) }, { phones: contact.phones.map(phone => ({ ...phone, officialPhoneKey: 'TEST_ONLY-other' })) }]) {
    app.build = async input => ({ ok: true, value: { ...good, evaluationAsOf: input.evaluationAsOf, sections: { ...good.sections, futureV121: { ...good.sections.futureV121, officialContact: { ...contact, ...patch } } } } })
    await invoke({}, item); check(calls.length === beforeInvalid, 'directory/child gate or selected key mismatch never dials')
  }
  app.build = async () => ({ ok: false }); await invoke({}, item)
  app.build = async () => { throw Error('TEST_ONLY projection failure') }; await invoke({}, item)
  check(calls.length === beforeInvalid && messages.at(-1).includes('重试'), 'projection rejection and exceptions recover visibly')
  for (const change of ['query', 'hide', 'load', 'unload', 'removed']) {
    let resolve, visible = [item]
    app.build = () => new Promise(done => { resolve = done })
    const actor = {}, waiting = invoke(actor, item, () => visible)
    if (change === 'removed') visible = []
    else action.invalidateDirectoryCall(actor, change === 'hide' || change === 'unload' ? false : undefined)
    resolve({ ok: true, value: good }); await waiting
    check(calls.length === beforeInvalid, 'late preflight after ' + change + ' cannot dial')
  }
  app.build = originalBuild
  for (const patch of [{ navigationIntent: { ...item.navigationIntent, source: 'recommendation' } }, { navigationIntent: { ...item.navigationIntent, sourceContextRef: 'TEST_ONLY-context' } }, { card: { ...item.card, compact: false } }]) await invoke({}, { ...item, ...patch })
  check(calls.length === beforeInvalid, 'Recommendation/pinned/noncompact sources never gain direct call')
  for (const change of ['query', 'show', 'load']) {
    let resolveOld, builds = 0
    app.build = input => ++builds === 1 ? new Promise(resolve => { resolveOld = resolve }) : originalBuild(input)
    const actor = {}, waiting = invoke(actor, item), before = calls.length
    if (change === 'show') { action.invalidateDirectoryCall(actor, false); action.invalidateDirectoryCall(actor, true) }
    else action.invalidateDirectoryCall(actor)
    await invoke(actor, item)
    check(calls.length === before + 1 && builds === 2, 'unsettled old preflight cannot block a new intentional call after ' + change)
    resolveOld({ ok: true, value: good }); await waiting
    await invoke(actor, item)
    check(calls.length === before + 1 && builds === 2, 'old preflight response/finally cannot dial or release newer native pending after ' + change)
    calls.at(-1).success(); calls.at(-1).complete()
    await invoke(actor, item)
    check(calls.length === before + 2, 'new native completion still restores future calls after ' + change)
    calls.at(-1).success(); calls.at(-1).complete()
  }
  app.build = originalBuild
  console.log('PASS Production call safety: canonical projection, phone correspondence, invalidation, guards, recovery')
}
const template = fs.readFileSync('miniprogram/templates/institution-directory.wxml', 'utf8')
check(/<view catchtap="onDirectoryPhoneTap" data-item-key="\{\{item.key\}\}"><button[^>]*disabled=/.test(template), 'disabled native button is enclosed by a catchtap boundary; no parent navigation')
check(!/bindtap="onDirectoryPhoneTap"|triggerEvent/.test(template), 'phone has one catchtap event path')
check((template.match(/bindtap="onCardTap"/g) || []).length === 1 && /<button catchtap="onCardTap" data-item-key="\{\{item.key\}\}"/.test(template), 'Detail child swallows bubbling and calls same guarded route handler once')
check(template.includes('wx:if="{{item.card.compact}}" class="institution-card__actions"') && template.includes('<block wx:else>'), 'Recommendation branch remains without direct phone actions')
const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
for (const mode of ['production', 'demo']) {
  const css = fs.readFileSync('dist/' + mode + '/miniprogram/pages/home/index.wxss', 'utf8')
  const rule = selector => {
    const normalize = value => value.trim().replace(/\s*>\s*/g, '>')
    const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors.split(',').map(normalize).includes(normalize(selector)))
    assert.ok(found.length, 'actual generated selector ' + selector)
    return Object.fromEntries(found.flatMap(row => row[2].split(';')).filter(s => s.includes(':')).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()] }))
  }
  const actionSelector = ".institution-card__actions button:not([size='mini'])"
  const phoneSelector = ".institution-card__actions .institution-phone:not([size='mini'])"
  for (const selector of ['.directory-input-wrap', '.directory-filter', '.institution-detail-link', actionSelector]) check(rule(selector)['border-radius'] === '11px', mode + ' common control radius for ' + selector)
  check(rule('.institution-card')['border-radius'] === '13px' && rule('.institution-fact-tag')['border-radius'] === '7px', mode + ' moderate card and lighter tag radii')
  check(rule('.institution-card__actions').display === 'flex' && parseInt(rule(actionSelector)['min-height']) >= 44, mode + ' two same-row controls retain minimum physical touch height')
  for (const [selector, backgroundSelector] of [[actionSelector, actionSelector], ['.institution-fact-tag', '.institution-fact-tag'], ['.institution-name', '.institution-card'], ['.institution-region', '.institution-card']]) {
    const text = rule(selector).color, bg = rule(backgroundSelector).background
    const a = lum(text), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    check(ratio >= 4.5, mode + ' actual generated text contrast >= 4.5: ' + selector + '=' + ratio.toFixed(2))
  }
  check(rule(actionSelector).background.toUpperCase() === '#FF6A00' && rule('.institution-card__actions .button-hover').background.toUpperCase() === '#E85E00', mode + ' precise orange CTA and pressed palette stay local')
  check(rule('.institution-name').color === '#202020' && rule('.institution-region').color === '#707070' && rule('.institution-card').background.toUpperCase() === '#FFFFFF' && rule('page').background.toUpperCase() === '#FFF9F5' && rule('.institution-card').border.toUpperCase().includes('#E8E2DD'), mode + ' institution information uses neutral readable text, white cards, warm page and restrained borders')
  const phone = rule(phoneSelector)
  check(phone.width === '44px' && phone.height === '44px' && phone.background === 'transparent' && phone.color.toUpperCase() === '#D95800' && rule('.institution-card__actions .institution-phone[disabled]').color === '#707070' && rule('.institution-phone-icon').width === '24px' && rule('.institution-phone-icon').height === '24px', mode + ' standard 24px handset keeps the transparent 44px target and local dark orange')
  check(rule('.institution-phone-icon').background.includes('data:image/svg+xml,') && rule('.institution-phone-icon').background.includes("stroke='%23D95800'") && rule('.institution-phone-icon').background.includes("fill='none'") && rule('.institution-phone[disabled] .institution-phone-icon').filter === 'grayscale(1)', mode + ' closed standard handset outline is self-contained; unavailable remains visually grey')
  check(rule(".home-expand:not([size='mini'])")['border-color'].toUpperCase() === '#E8E2DD' && rule(".home-expand:not([size='mini'])").color === '#202020' && rule(".home-directory-link:not([size='mini'])").color.toUpperCase() === '#B54808', mode + ' expand uses neutral border/dark text and independent directory uses readable dark orange')
  check(rule('.institution-card__actions')['justify-content'] === 'space-between' && rule('.institution-card__actions > view').flex === '0 0 44px' && rule(actionSelector).width === 'auto', mode + ' phone stays left and the only large CTA stays right without half-row phone fill')
}
const phoneMarkup = template.match(/<button class="institution-phone"[\s\S]*?<\/button>/)[0]
check(phoneMarkup.includes('aria-disabled=') && phoneMarkup.includes('TEST ONLY 模拟拨号') && phoneMarkup.includes('官方电话不可用') && phoneMarkup.includes('class="institution-phone-icon" aria-hidden="true"') && !/>\s*(?:拨打电话|模拟拨号|电话待确认)\s*</.test(phoneMarkup), 'icon-only phone retains explicit real/simulated/unavailable accessible labels and native disabled semantics')
check(!fs.readFileSync('miniprogram/styles/tokens.less', 'utf8').includes('@directory-'), 'candidate browsing palette/radii do not become global brand or business-status tokens')
const approval = fs.readFileSync('docs/architecture/INSTITUTION_ORDINARY_DIRECTORY_CALL_AMENDMENT_V1.md', 'utf8')
check(approval.includes('OWNER_APPROVAL = EXPLICIT_REQUEST_V2_1_B1_2_4') && approval.includes('ACTION_POLICY_VERSION = institution-ordinary-directory-call-v1'), 'narrow explicit action successor recorded')
console.log('V2_1_B1_2_4_CARD_ACTIONS = PASS (' + assertions + ' assertions; mocked API, no external calls/device claim)')
