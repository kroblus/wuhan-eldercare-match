import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
const allowed = ['公办', '民办', '公建民营']
for (const mode of ['production', 'demo']) {
  let fontSetting = 16, fontReadFails = false
  const wx = { cloud: {}, getSystemInfoSync() { if (fontReadFails) throw new Error('TEST_ONLY setting unavailable'); return { fontSizeSetting: fontSetting } }, getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }) }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, setTimeout, clearTimeout })
  const load = file => rt.load(path.join('dist', mode, 'miniprogram', file + '.js'))
  vm.runInContext("Date.now = () => Date.parse('2026-10-23T00:00:00Z')", rt.context)
  load('app'); if (mode === 'demo') await load('demo/session').loadDemo()
  const { readBrowseFontStyle } = load('utils/browse-font')
  for (const size of [16, 14, undefined, NaN, Infinity]) {
    fontSetting = size; check(readBrowseFontStyle() === '', 'standard/missing/invalid font setting uses original CSS fallbacks')
  }
  for (const size of [20, 24]) {
    fontSetting = size
    const style = readBrowseFontStyle()
    for (const [role, base] of [['body',16],['meta',14],['control',16],['title',20],['hero',23]]) check(style.includes(`--browse-${role}-size:${base * size / 16}px`), 'WeChat font setting scales ' + role + ' to ' + size)
  }
  fontReadFails = true; check(readBrowseFontStyle() === '', 'setting read failure is display-only fallback'); fontReadFails = false; fontSetting = 16
  const { decorateDirectoryCards, presentDirectoryNature } = load('pages/institution/directory-presentation')
  for (const nature of allowed) {
    const card = presentDirectoryNature(nature)
    check(card.nature === '' && card.factTags.length === 1 && card.factTags[0] === nature, 'known projected nature allocated once')
  }
  for (const nature of ['', '性质待确认', '核验已过期', '资料待核验', '医养结合', '低价', '公办康复中心']) {
    const card = presentDirectoryNature(nature)
    check(card.nature === nature && !card.factTags.length, 'no inference or positive label from unknown/type/name: ' + nature)
  }
  const service = load('services/institution-list-detail-page')
  const snapshot = await service.buildInstitutionListPageSnapshot(null)
  check(snapshot.ok, mode + ' real application snapshot')
  const list = load('pages/institution/list-view-model').createInstitutionListPageViewModel(snapshot.value).items
  const original = JSON.stringify(list)
  const items = await decorateDirectoryCards(list, snapshot.value.evaluationAsOf)
  check(JSON.stringify(list) === original, 'display allocation does not mutate original snapshot')
  check(items.every(item => item.card.factTags.length <= 3 && item.card.factTags.every(tag => allowed.includes(tag))), 'T1 only; no price/distance/capability positives')
  check(items.every(item => !item.card.factTags.length || !item.card.nature), 'no nature duplicated in subtitle')
  check(items.every(item => item.card.factTags.every(tag => tag !== item.card.region && tag !== item.card.phone && tag !== item.card.address)), 'region/contact/address not duplicated')
  check(items.every((item, i) => item.key === list[i].key && JSON.stringify(item.navigationIntent) === JSON.stringify(list[i].navigationIntent)), 'order, identity, revision, source context preserved')
  check(items.every((item, i) => list[i].card.notes.every(note => item.card.notes.includes(note))), 'every institution-specific risk preserved')
  if (mode === 'production') {
    check(items.some(item => item.card.factTags.length === 1), 'real current nature facts render chips')
    check(items.some(item => item.card.factTags.length === 0 && item.card.nature === '性质待确认'), 'real unknown nature keeps explicit text and zero tags')
    check(items.every(item => !item.card.phone), 'ordinary directory omits generic phone status and never claims a connection')
  } else check(items.every(item => item.card.isDemo && !item.card.factTags.length), 'demo provider semantics untouched; no new synthetic facts')
  const noEvidence = { ...list[0], institutionId: 'TEST_ONLY-no-evidence', recordRevision: 999, name: '公办低价医养结合康复中心', card: { ...list[0].card, nature: '性质待确认', notes: ['TEST_ONLY 电话来源冲突'] } }
  const fallback = (await decorateDirectoryCards([noEvidence], snapshot.value.evaluationAsOf))[0]
  check(!fallback.card.factTags.length && fallback.card.nature === '性质待确认' && fallback.card.notes.includes('TEST_ONLY 电话来源冲突'), 'no source, name-based nature, fee, location, phone, service inference; risk retained')
  vm.runInContext("Date.now = () => Date.parse('2027-02-01T00:00:00Z')", rt.context)
  const expired = await service.buildInstitutionListPageSnapshot(null)
  const expiredList = load('pages/institution/list-view-model').createInstitutionListPageViewModel(expired.value).items
  const expiredItems = await decorateDirectoryCards(expiredList, expired.value.evaluationAsOf)
  check(expiredItems.every(item => !item.card.factTags.length), 'expired evidence never gains a positive tag')
  console.log('PASS ' + mode + ': nature allocation, evidence, expiry, risk, identity, isolation')
}
// Check actual generated WeChat styles, not an HTML facsimile.
const css = fs.readFileSync('dist/production/miniprogram/pages/home/index.wxss', 'utf8')
const rule = selector => {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) => selectors.split(',').map(s => s.trim()).includes(selector))
  assert.ok(found, 'generated CSS selector ' + selector)
  return Object.fromEntries(found[2].split(';').filter(s => s.includes(':')).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()] }))
}
const luminance = color => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  assert.ok(match, 'hex computed color: ' + color)
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1]
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
}
for (const [foreground, background] of [
  [rule('.home-news__row').color, rule('.home-news__row').background],
  [rule('.institution-fact-tag').color, rule('.institution-fact-tag').background],
  [rule('.institution-fact-tag--teal').color, rule('.institution-fact-tag--teal').background],
  [rule('.home-service__title').color, rule('.home-service').background],
  [rule('.home-service--assessment .home-service__summary').color, rule('.home-service--assessment').background],
  [rule('.institution-risk').color, rule('.institution-risk').background],
]) {
  const a = luminance(foreground), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  check(ratio >= 4.5, `actual generated text contrast AA ${foreground}/${background}: ${ratio.toFixed(2)}`)
  console.log(`CONTRAST ${foreground}/${background} = ${ratio.toFixed(2)}:1`)
}
const markup = fs.readFileSync('miniprogram/templates/institution-directory.wxml', 'utf8')
check(/wx:if="\{\{item.card.factTags.length\}\}"/.test(markup) && /wx:for="\{\{item.card.factTags\}\}"/.test(markup), 'zero/one/multiple tag layouts use one conditional container')
check(rule('.institution-fact-tags')['flex-wrap'] === 'wrap' && rule('.institution-name')['overflow-wrap'] === 'anywhere', 'multiple tags and long name wrap without truncation')
check(!/line-clamp|text-overflow:\s*ellipsis/.test(css), 'no ellipsis/clamp hides card or home content at large font')
check(['home','institution'].every(name => fs.readFileSync(`miniprogram/pages/${name}/index.wxml`, 'utf8').includes('<page-meta page-style="{{browseFontStyle}}" />')), 'font variables attached to both native browsing pages')
const home = fs.readFileSync('miniprogram/pages/home/index.wxml', 'utf8')
check((home.match(/class="home-news__row /g) || []).length === 3 && /home-news__row--admission[^>]+data-topic="admission"/.test(home), 'three real-content reading cards include policy, education and compact guide')
check(!/TEST_ONLY|unread|badge/.test(home), 'no fake announcements, badge or synthetic fixture in home')
console.log(`V2_1_B1_1_VISUAL = PASS (${assertions} assertions; generated CSS and Node VM, not device layout evidence)`)
