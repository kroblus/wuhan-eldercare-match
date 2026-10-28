import assert from 'node:assert/strict'
import fs from 'node:fs'
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
const home = fs.readFileSync('miniprogram/pages/home/index.wxml', 'utf8')
const template = fs.readFileSync('miniprogram/templates/institution-directory.wxml', 'utf8')
// P1's earlier service-intent block also uses home-boundary. Check the final
// disclosure by its own content, rather than mistaking the P1 entry for it.
const order = ['home-brand', 'home-hero', 'home-news', 'home-services', 'id="home-search"', 'home-results', '资料说明与服务边界'].map(token => home.indexOf(token))
check(order.every((index, i) => index >= 0 && (!i || index > order[i - 1])), 'native spatial groups have one consistent order')
check(home.indexOf('<!-- demo-home-entry -->') < home.indexOf('id="home-search"'), 'isolated demo controls precede search and never interrupt query/results')
check(/<view id="home-search"[\s\S]*?<\/view>\s*<view class="home-results">/.test(home), 'result block immediately follows search controls without another module')
check(/<navigation-bar[^>]+back="\{\{false\}\}"[^>]*>[\s\S]*<page-container[\s\S]*home-brand/.test(home), 'brand and bell follow existing native navigation safe area')
const header = home.slice(home.indexOf('home-brand'), home.indexOf('home-hero'))
check(header.includes('home-bell') && header.includes('bindtap="openAnnouncements"'), 'small actionable bell belongs to horizontal brand group')
check(!/未读|badge|unread|TEST_ONLY/.test(home), 'no synthetic announcements or unread counters')
check(!/<image\b|https?:\/\//.test(home + template), 'native text/geometric illustration, no fabricated institutional imagery or network image')
check(/home-hero__accent">查找机构资料/.test(home) && /home-hero__art" aria-hidden="true"/.test(home), 'accurate hero text and decorative abstract family composition')
for (const topic of ['policy', 'education', 'admission']) check((home.match(new RegExp('data-topic="' + topic + '"', 'g')) || []).length === 1, topic + ' has one reading entry')
for (const action of ['startAssessment', 'openAnnouncements']) check((home.match(new RegExp('bindtap="' + action + '"', 'g')) || []).length === 1, action + ' has one physical event path')
check((home.match(/bindtap="focusSearch"/g) || []).length === 2 && /<button class="browse-button home-hero__find" bindtap="focusSearch">/.test(home) && /<button class="home-service" bindtap="focusSearch">/.test(home), 'narrow hero and standard service buttons each have one physical event path to the same guarded locator')
// The existing P1 service-direction label has an explicit acceptance caveat;
// it is not a recommendation advantage or a medical qualification assertion.
const p1Direction = '医养结合 / 术后康养 / 短期托养（服务方向，具体接收条件待核实）'
check(home.includes(p1Direction) && home.includes('bindtap="openP1Service"'), 'P1 direction keeps its acceptance caveat and existing entry')
check(!/优质养老机构推荐|专业顾问支持|精准匹配好机构|智能推荐合适机构|一站式服务保障|医养结合|价格友好|离家近|环境安静/.test(home.replace(p1Direction, '') + template), 'reference image advantages and unsupported promises excluded')
for (const state of ['isLoading', 'loadError', 'empty']) check(home.includes('wx:' + (state === 'isLoading' ? 'if' : 'elif') + '="{{' + state + '}}"'), state + ' stays isolated in institution results')
for (const field of ['item.card.notes', 'item.card.address', 'item.card.phone', 'item.card.price', 'item.navigationIntent.institutionId', 'item.navigationIntent.recordRevision', 'item.navigationIntent.source']) check(template.includes(field), 'native card retains ' + field)
check(template.includes('wx:if="{{item.card.factTags.length}}"') && template.includes('wx:for="{{item.card.factTags}}"'), 'zero tags omit container; current projected legal facts only')
check(template.includes('bindinput="onSearchInput"') && template.includes('bindchange="onDistrictChange"') && template.includes('bindchange="onNatureChange"') && template.includes('bindtap="clearKeyword"') && template.includes('bindtap="clearSearch"'), 'live input, AND filter handlers and both clearing controls preserved')
for (const mode of ['production', 'demo']) {
  const root = 'dist/' + mode + '/miniprogram/'
  const css = fs.readFileSync(root + 'pages/home/index.wxss', 'utf8')
  const builtHome = fs.readFileSync(root + 'pages/home/index.wxml', 'utf8')
  check(['home-brand', 'home-bell', 'home-hero', 'home-news__row--policy', 'home-news__row--education', 'home-news__row--admission', 'home-services', 'id="home-search"'].every(token => builtHome.includes(token)), mode + ' actual build contains current native homepage groups')
  check(mode === 'demo' ? builtHome.includes('demo-tools') : !builtHome.includes('demo-tools'), mode + ' injected demo controls remain isolated')
  check(/\.home-brand\s*\{[^}]*display:\s*flex/.test(css), mode + ' horizontal brand')
  check(/\.home-news\s*\{[^}]*flex-wrap:\s*wrap/.test(css) && /flex:\s*1 1 calc\(var\(--browse-body-size, 16px\) \* 6.5\)/.test(css), mode + ' font-aware three-column-capable reading grid wraps naturally')
  check(/\.home-services\s*\{[^}]*flex-wrap:\s*wrap/.test(css) && /max-width:\s*340px/.test(css), mode + ' service cards can stack at narrow width')
  check(/\.home-hero__accent\s*\{[^}]*color:\s*#b54808/i.test(css) && /\.home-service--assessment[\s\S]*background:\s*#fff1e6/i.test(css), mode + ' B1.2.4 high-contrast warm orange hero text and bright orange assessment surface')
  check(!/line-clamp|text-overflow:\s*ellipsis|background-image:\s*url/.test(css), mode + ' no clipping or full-image facsimile')
  const app = JSON.parse(fs.readFileSync(root + 'app.json', 'utf8'))
  check(JSON.stringify(app.tabBar.list.map(tab => tab.pagePath)) === JSON.stringify(['pages/home/index', 'pages/consultant/index', 'pages/mine/index']), mode + ' N1 tabbar preserved')
}
console.log('V2_1_B1_2_HOME = PASS (' + assertions + ' assertions; native source/build structure, not device layout evidence)')
