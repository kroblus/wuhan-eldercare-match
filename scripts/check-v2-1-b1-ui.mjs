import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const event = (key, value) => ({ currentTarget: { dataset: { [key]: value } } })
const host = def => ({ ...def, ...def.methods, data: JSON.parse(JSON.stringify(def.data)), patches: [],
  setData(p) { this.patches.push(p); Object.assign(this.data, p) }, triggerEvent() {} })
let assertions = 0
const check = (condition, message) => { assert.ok(condition, message); assertions++ }
for (const mode of ['production', 'demo']) {
  let component, page, modal, scroll, failScroll = false, failModal = false, failNav = false, failCapsule = false
  const pushes = []
  const wx = { cloud: {}, nextTick: fn => fn(),
    getMenuButtonBoundingClientRect() { if (failCapsule) throw new Error('TEST_ONLY geometry unavailable'); return { bottom: 89 } },
    getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }),
    navigateTo(o) { pushes.push(o); if (failNav) { o.fail(); if (o.complete) o.complete() } else { if(o.success)o.success();if(o.complete)o.complete() } },
    pageScrollTo(o) { scroll = o; if(failScroll) { o.fail();o.complete() } },
    showModal(o) { modal = o; if(failModal) { o.fail();o.complete() } },
    showToast() {},
  }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, Component(d) { component = d }, Page(d) { page = d }, setTimeout, clearTimeout, getCurrentPages: () => [] })
  const load = file => rt.load(path.join('dist', mode, 'miniprogram', file + '.js'))
  load('app'); if(mode === 'demo') await load('demo/session').loadDemo()
  load('pages/home/index')
  const definition = component, home = host(component)
  home.loadInstitutions(); await flush()
  const total = mode === 'production' ? 11 : 12
  check(home.data.institutions.length === 2 && home.data.resultCount === total, mode + ' default preview')
  const initial = home.data.institutions.map(item => item.key)
  home.toggleDirectory(); check(home.data.institutions.length === total, 'inline expansion')
  check(JSON.stringify(home.data.institutions.slice(0,2).map(item => item.key)) === JSON.stringify(initial), 'unchanged order')
  home.toggleDirectory(); check(home.data.institutions.length === 2, 'collapse preview')
  home.onSearchInput({ detail: { value: mode === 'production' ? '社会福利院' : '春和' } })
  check(home.data.activeQuery && home.data.institutions.length === (mode === 'production' ? 7 : 3), 'all active matches')
  const query = home.data.keyword, count = home.data.institutions.length
  home.patches.length = 0; definition.pageLifetimes.show.call(home)
  check(!home.data.isLoading && home.data.institutions.length === count, 'return keeps result nodes/height')
  await flush(); check(home.data.keyword === query && home.data.institutions.length === count, 'return retains query/results')
  const frozen = JSON.stringify({ keyword: home.data.keyword, institutions: home.data.institutions, expanded: home.data.expanded })
  home.openAnnouncements(); const original = modal;home.openAnnouncements()
  check(modal === original && modal.content === '当前暂无可展示的公告。' && modal.showCancel === false, 'one real empty modal')
  modal.complete()
  check(JSON.stringify({ keyword: home.data.keyword, institutions: home.data.institutions, expanded: home.data.expanded }) === frozen, 'modal preserves search')
  failModal = true;home.openAnnouncements();check(!!home.data.searchActionError, 'modal failure visible');failModal = false;home.openAnnouncements();modal.complete()
  failScroll = true;home.focusSearch();check(!!home.data.searchActionError && !home.data.searchFocus, 'scroll failure visible/retryable')
  failScroll = false;home.focusSearch();const pendingScroll=scroll;home.focusSearch();check(scroll === pendingScroll, 'single pending focus action')
  scroll.success();scroll.complete();check(home.data.searchFocus && scroll.selector === '#home-search', 'native scroll and focus')
  check(scroll.offsetTop === -97, 'search input stays below capsule and fixed navigation')
  failCapsule = true;home.focusSearch();check(scroll.offsetTop === -96, 'missing capsule geometry retains usable safe offset');scroll.success();scroll.complete();failCapsule = false
  home.onSearchBlur();check(!home.data.searchFocus, 'blur resets requested focus')
  failNav=true;home.openReading(event('topic','admission'))
  check(!!home.data.readingActionError,'home admission navigation failure has visible feedback')
  failNav=false;const readingPushes=pushes.length
  home.openReading(event('topic','admission'));home.openReading(event('topic','admission'))
  check(!home.data.readingActionError && pushes.length===readingPushes+1 && pushes[readingPushes].url==='/pages/service/admission/index','home admission retry succeeds once after failure')
  const pendingActions = host(definition)
  pendingActions.focusSearch();const unloadedScroll=scroll
  pendingActions.openAnnouncements();const unloadedModal=modal
  definition.lifetimes.detached.call(pendingActions)
  const actionWrites=pendingActions.patches.length
  unloadedScroll.success();unloadedScroll.fail();unloadedScroll.complete();unloadedModal.fail();unloadedModal.complete()
  check(pendingActions.patches.length===actionWrites,'late native callbacks never write after detach')
  pendingActions.focusSearch();const newScroll=scroll
  unloadedScroll.complete();pendingActions.focusSearch()
  check(scroll===newScroll,'old lifetime callbacks cannot unlock new lifetime action')
  newScroll.success();newScroll.complete()
  check(home.data.institutions.every(item => item.card.factTags.length <= 1 && item.card.factTags.every(tag => ['公办','民办','公建民营'].includes(tag)) && (!item.card.factTags.length || !item.card.nature)), 'evidence-gated nature appears once; no T2/T3')
  if(mode === 'production') {
    home.clearSearch();home.toggleDirectory()
    check(home.data.institutions.some(item => item.card.notes.length), 'specific institution risks retained')
    check(home.data.institutions.every(item => !item.card.phone), 'ordinary directory omits generic contact rows; B1.2.4 action stores no full phone number')
    check(home.data.institutions.every(item => !item.card.addressStatus && (!item.card.address || !/详情可查|地址资料/.test(item.card.address))), 'ordinary directory uses only eligible direct address, no status substitute')
  }
  home.clearSearch();check(home.data.institutions.length === 2 && !home.data.expanded, 'clear restores preview')
  // Error isolation and load generations: inject only the page-facing application seam.
  const service = load('services/institution-list-detail-page'), originalBuild = service.buildInstitutionListPageSnapshot
  service.buildInstitutionListPageSnapshot = () => Promise.reject(new Error('TEST_ONLY load failure'))
  home.retryLoad();await flush();check(home.data.loadError && !home.data.isLoading, 'load error isolated')
  const before = pushes.length;home.startAssessment();home.startAssessment();check(pushes.length === before+1 && pushes[before].url === '/pages/assessment/intro', 'assessment available during error; rapid taps dedup')
  service.buildInstitutionListPageSnapshot = originalBuild;home.retryLoad();await flush();check(!home.data.loadError && home.data.institutions.length === 2, 'load retry restores preview')
  const snapshot = await originalBuild(null)
  let resolveOld, calls = 0
  service.buildInstitutionListPageSnapshot = () => { calls++;return calls===1 ? new Promise(resolve=>{ resolveOld=resolve }) : Promise.resolve(snapshot) }
  home.retryLoad();home.retryLoad();check(calls===1, 'inflight loads coalesce')
  resolveOld(snapshot);await flush();check(calls===2 && !home.data.isLoading, 'queued latest generation wins')
  const detached = host(definition);calls=0;detached.loadInstitutions();definition.lifetimes.detached.call(detached);const writes=detached.patches.length;resolveOld(snapshot);await flush()
  check(detached.patches.length === writes, 'no writes after detached')
  const resolvers=[];calls=0
  service.buildInstitutionListPageSnapshot = () => { calls++;return new Promise(resolve=>resolvers.push(resolve)) }
  const reattached=host(definition);reattached.loadInstitutions()
  definition.lifetimes.detached.call(reattached);definition.lifetimes.attached.call(reattached)
  check(calls===2,'detach releases old in-flight marker')
  resolvers[0](snapshot);await flush();reattached.retryLoad()
  check(calls===2,'old response cannot release current in-flight marker')
  resolvers[1](snapshot);await flush();check(calls===3,'current in-flight refresh remains coalesced')
  resolvers[2](snapshot);await flush();check(!reattached.data.loadError && reattached.data.institutions.length===2,'reattached current generation publishes')
  service.buildInstitutionListPageSnapshot = originalBuild
  const decorate=load('pages/institution/directory-presentation').decorateDirectoryCards
  const application=service.institutionDetailApplicationV12,originalDetailBuild=application.build
  const itemWithRisk={ ...home.data.institutions[0], card:{ ...home.data.institutions[0].card, notes:['TEST_ONLY institution-specific risk'] } }
  const originalCard=JSON.stringify(itemWithRisk.card)
  for(const outcome of ['error','rejected']) {
    application.build=()=>outcome==='error' ? Promise.resolve({ok:false}) : Promise.reject(new Error('TEST_ONLY supplemental failure'))
    const fallback=await decorate([itemWithRisk],snapshot.value.evaluationAsOf)
    check(fallback.length===1 && fallback[0].key===itemWithRisk.key && fallback[0].card.notes.includes('TEST_ONLY institution-specific risk'),'supplemental '+outcome+' preserves institution-specific risk/identity')
  }
  application.build=originalDetailBuild
  check(JSON.stringify(itemWithRisk.card)===originalCard,'supplemental projection never mutates existing card')
  const detailProjection=load('pages/institution/detail-view-model'),originalDetailProjection=detailProjection.createInstitutionDetailPageViewModel
  const originalDetailSnapshot=await originalDetailBuild({identity:{institutionId:itemWithRisk.institutionId,recordRevision:itemWithRisk.recordRevision},source:'direct',sourceContextRef:null,evaluationAsOf:snapshot.value.evaluationAsOf})
  for(const [state,status] of [['ready','地址已核验'],['address_unknown','机构地址待确认'],['address_unavailable','当前暂无可提供的机构地址'],['address_unverified','地址资料待核验'],['address_expired','地址资料已过核验期']]) {
    application.build=()=>Promise.resolve(originalDetailSnapshot)
    detailProjection.createInstitutionDetailPageViewModel=()=>({location:{address:'TEST_ONLY full address',addressState:state,addressStatus:status},officialContact:{phones:[],statusLabel:'TEST_ONLY contact status'}})
    const stateOnly=await decorate([itemWithRisk],snapshot.value.evaluationAsOf)
    check(stateOnly[0].card.address===(state==='ready'?'TEST_ONLY full address':'') && (!['address_unverified','address_expired'].includes(state)||stateOnly[0].card.notes.includes(status)),'ordinary directory '+state+' follows approved direct-address disclosure and preserves important warning')
  }
  const phoneCases=[['verified','已核验'],['pending','机构提供，平台待核验'],['expired','电话资料已过核验期'],['unavailable','当前暂无可提供的官方联系电话'],['unknown','官方联系电话待确认']]
  const withPhones=async (phones,state='ready',statusLabel='机构官方联系方式')=>{
    detailProjection.createInstitutionDetailPageViewModel=()=>({location:{addressState:'address_unknown',addressStatus:'机构地址待确认'},officialContact:{state,phones,statusLabel}})
    return (await decorate([itemWithRisk],snapshot.value.evaluationAsOf))[0].card
  }
  const phones=phoneCases.map(([state,statusLabel])=>({state,statusLabel,displayValue:'TEST_ONLY complete phone'}))
  for(const phone of phones) {
    const card=await withPhones([phone]),risk=phone.state==='pending'?'官方电话：'+phone.statusLabel:phone.statusLabel
    check(!card.phone && card.notes.includes('TEST_ONLY institution-specific risk') && (phone.state==='verified'?!card.notes.includes(phone.statusLabel):card.notes.includes(risk)), 'ordinary phone '+phone.state+' omits generic row but keeps exact concrete warning and original risk')
  }
  const mixed=await withPhones([phones[0],phones[1],phones[2],phones[1],phones[4]])
  check(!mixed.phone && mixed.notes.filter(note=>note==='官方电话：机构提供，平台待核验').length===1 && mixed.notes.includes('电话资料已过核验期') && mixed.notes.includes('官方联系电话待确认') && !JSON.stringify(mixed).includes('TEST_ONLY complete phone'),'mixed concrete warnings retain distinct states once, never full phone numbers')
  const unavailable=await withPhones([],'unavailable','当前暂无可提供的官方联系电话')
  check(unavailable.notes.includes('当前暂无可提供的官方联系电话'),'explicitly unavailable official contact remains a visible institution risk')
  const unknown=await withPhones([],'unknown','官方联系电话待确认')
  check(!unknown.notes.includes('官方联系电话待确认') && unknown.notes.includes('TEST_ONLY institution-specific risk'),'generic unknown contact does not add a repeated status row or erase specific source risks')
  application.build=originalDetailBuild;detailProjection.createInstitutionDetailPageViewModel=originalDetailProjection
  // Expired source facts cannot gain positive contact/address tags or overwrite history.
  vm.runInContext("Date.now = () => Date.parse('2027-02-01T00:00:00Z')", rt.context)
  const expiredSnapshot = await originalBuild(null)
  const items = load('pages/institution/list-view-model').createInstitutionListPageViewModel(expiredSnapshot.value).items
  const decorated = await load('pages/institution/directory-presentation').decorateDirectoryCards(items, '2027-02-01T00:00:00Z')
  check(decorated.every(item => item.card.factTags.length === 0), 'expired sources no positive chips')
  if(mode==='production') check(decorated.every(item=>!item.card.phone.includes('有公开电话记录') && item.card.nature === '性质待确认'), 'expired phone/nature not promoted')
  // Reading projection preserves original text/dates, and related navigation has one guarded path.
  for(const topic of ['policy','education','admission']) {
    load('pages/service/'+topic+'/index');const reading = host(page)
    check(reading.data.reviewedOn === '2026-10-22' && reading.data.sections.length === reading.data.article.sections.length, topic+' original content/date')
    check(reading.data.sections.every((section,i)=>JSON.stringify(section.paragraphs)===JSON.stringify(reading.data.article.sections[i].paragraphs)), topic+' unchanged paragraphs')
    const related = reading.data.related[0].topic
    failNav = true;reading.openRelated(event('topic',related));check(!!reading.data.navigationError,'related fail feedback');failNav = false
    reading.openRelated(event('topic',related));const pushed=pushes.length;reading.openRelated(event('topic',related));check(pushes.length===pushed,'related rapid tap dedup')
  }
  console.log('PASS '+mode+': preview/expand/search/return, focus/modal failure and retry, load races/unload, evidence expiry, reading/navigation')
}
const homeMarkup = fs.readFileSync('miniprogram/pages/home/index.wxml','utf8')
check((homeMarkup.match(/bindtap="startAssessment"/g)||[]).length===1,'one physical assessment event path')
check(homeMarkup.indexOf('home-news') < homeMarkup.indexOf('home-services') && homeMarkup.indexOf('home-services') < homeMarkup.indexOf('id="home-search"'),'A2 order')
check(!/TEST_ONLY|unread|badge|data.js/.test(homeMarkup),'no fixture announcements or badges')
const homeReadingMarkup=homeMarkup.slice(homeMarkup.indexOf('<view class="home-news"'),homeMarkup.indexOf('<view class="home-services"'))
check(/data-topic="policy"[\s\S]*data-topic="education"[\s\S]*data-topic="admission"[\s\S]*<view\b[^>]*wx:if="\{\{readingActionError\}\}"[^>]*role="alert"[^>]*>\{\{readingActionError\}\}<\/view>/.test(homeReadingMarkup),'grouped reading actions have adjacent failure alert before services')
const app=JSON.parse(fs.readFileSync('miniprogram/app.json'))
assert.deepEqual(app.tabBar.list.map(tab=>tab.pagePath),['pages/home/index','pages/consultant/index','pages/mine/index'])
console.log('V2_1_B1_UI = PASS ('+assertions+' assertions + N1 routes; Node VM evidence, not device input)')
