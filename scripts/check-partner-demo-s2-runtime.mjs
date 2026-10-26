import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidenceRoot = path.join(root, 'output/partner-demo-s2b-interactive-implementation')
const generated = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'generated-project.json'), 'utf8'))
const mini = generated.miniprogramRoot
const { ts } = loadWechatTypeScript()
const captures = []
const nativeCalls = []
let navigation = []
let navigationMode = 'success'
let systemInfo = { platform:'android', safeArea:{top:20}, windowWidth:375, windowHeight:800 }
let systemInfoThrows = false
let currentPages = [{route:'pages/home/index'},{route:'current'}]
const sentinel = new Map([['wuhan-eldercare-match.assessment-draft.v2', 'SYNTHETIC_PROTECTED_ONLY']])
const sentinelBefore = JSON.stringify([...sentinel])
const wx = new Proxy({
  getSystemInfoSync: () => { if(systemInfoThrows) throw new Error('SYNTHETIC_INFO_UNAVAILABLE'); return systemInfo },
  getAccountInfoSync: () => ({miniProgram:{envVersion:'develop'}}),
  getMenuButtonBoundingClientRect: () => ({left:270,top:24,width:90,height:32,right:360,bottom:56}),
  nextTick: (callback) => callback(), showToast: () => {}, pageScrollTo: (options) => options.success?.(),
  showModal: (options) => { options.success?.({confirm:false,cancel:true}); options.complete?.() },
  navigateTo: (options) => nav('navigateTo',options), redirectTo: (options) => nav('redirectTo',options),
  reLaunch: (options) => nav('reLaunch',options), switchTab: (options) => nav('switchTab',options),
  navigateBack: (options) => nav('navigateBack',options),
}, {get(target,name) { if(name in target) return target[name]; return () => {nativeCalls.push(String(name)); throw new Error(`forbidden wx.${String(name)}`)} }})
function nav(api,options) { navigation.push({api,url:options.url}); if(navigationMode === 'fail') options.fail?.({errMsg:'SYNTHETIC_NAVIGATION_FAILURE'}); else options.success?.(); options.complete?.() }
const runtime = createWechatTsRuntime(ts, {
  wx, getCurrentPages:() => currentPages,
  App: () => {}, Page:(definition) => captures.push(definition), Component:(definition) => captures.push(definition),
  setTimeout, clearTimeout,
})
const load = (name) => runtime.load(path.join(mini, name))
const clone = (value) => JSON.parse(JSON.stringify(value))
const flush = () => new Promise((resolve) => setTimeout(resolve,0))
const pageDefinitions = new Map()
function page(name) {
  if(!pageDefinitions.has(name)) { load(`${name}.ts`); pageDefinitions.set(name,captures.pop()) }
  const definition = pageDefinitions.get(name)
  assert.ok(definition, `captured ${name}`)
  const instance = { data:clone(definition.data || {}), setData(patch) { for(const [key,value] of Object.entries(patch)) {
    const fields = key.replace(/\[(\d+)\]/g,'.$1').split('.')
    let target = this.data
    while(fields.length > 1) { const field = fields.shift(); target = target[field] || (target[field] = {}) }
    target[fields[0]] = clone(value)
  } } }
  for (const [key,value] of Object.entries(definition.methods || definition)) if(typeof value === 'function') instance[key] = value.bind(instance)
  if(definition.lifetimes?.attached) instance.attached = definition.lifetimes.attached.bind(instance)
  if(definition.pageLifetimes?.show) instance.onShow = definition.pageLifetimes.show.bind(instance)
  return instance
}
const results = []
async function test(name,action) { try {await action(); results.push({name,status:'PASS'})} catch(error) {results.push({name,status:'FAIL',message:error.message}); throw error} }
const draft = load('store/assessment-draft.ts').assessmentDraftStore
const business = load('services/business-session.ts')
await test('generated graph and immutable domain source', () => {
  for(const item of generated.manifest.files) {
    const source = fs.readFileSync(path.join(mini,item.path))
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),item.generatedSha256)
    if(item.path.startsWith('domain/')) assert.equal(source.toString('utf8'),fs.readFileSync(path.join(root,'miniprogram',item.path),'utf8').replaceAll('\r\n','\n'))
    if(/\.(ts|js)$/.test(item.path)) assert.doesNotMatch(source.toString(), /wx\.(request|login|getStorageSync|setStorageSync|uploadFile|downloadFile)\s*\(/)
  }
  assert.equal(fs.existsSync(path.join(generated.project,'project.private.config.json')), false)
})
await test('memory Draft cold start, validation, reset and synthetic load', () => {
  assert.equal(draft.hasAnswers(),false)
  assert.equal(draft.getDraft().schemaVersion,2)
  draft.loadSyntheticAnswers()
  assert.equal(Object.keys(draft.getDraft().answers).length,32)
  assert.equal(draft.setAnswer('basic.age',999).persistence.ok,false)
  draft.setAnswer('basic.hasInstitutionExperience','false')
  assert.equal(draft.getAnswer('basic.institutionExitReasons'),undefined)
  draft.clear()
  assert.equal(draft.hasAnswers(),false)
  draft.loadSyntheticAnswers()
})
await test('Home synthetic load navigates once; repeat cannot reset the new session', () => {
  const home = page('pages/home/index')
  navigation = []
  home.loadSyntheticDemo()
  const firstId = draft.getDraft().localDraftId
  home.loadSyntheticDemo()
  assert.equal(navigation.length,1)
  assert.equal(draft.getDraft().localDraftId,firstId)
  assert.equal(Object.keys(draft.getDraft().answers).length,32)
  home.onShow()
  home.resetSyntheticDemo() // Mocked cancellation must retain answers.
  assert.equal(Object.keys(draft.getDraft().answers).length,32)
})
await test('Intro title has no literal escape; first continue, rapid tap, failure retry and return keep the Draft', () => {
  const markup=fs.readFileSync(path.join(mini,'pages/assessment/intro.wxml'),'utf8')
  assert.doesNotMatch(markup,/先花几分钟，\\n/)
  draft.loadSyntheticAnswers()
  const before=clone(draft.getDraft())
  const intro=page('pages/assessment/intro')
  currentPages=[{route:'pages/assessment/intro'}]
  intro.onShow()
  navigation=[]
  intro.startAssessment();intro.startAssessment()
  assert.deepEqual(navigation,[{api:'redirectTo',url:'/pages/assessment/basic'}])
  assert.deepEqual(clone(draft.getDraft()),before)
  intro.onShow()
  navigation=[];navigationMode='fail'
  intro.startAssessment()
  navigationMode='success';intro.startAssessment()
  assert.equal(navigation.length,2)
  assert.ok(navigation.every(n=>n.url==='/pages/assessment/basic'))
  assert.deepEqual(clone(draft.getDraft()),before)
  currentPages=[{route:'pages/home/index'},{route:'current'}]
})
await test('six Assessment cold mounts tolerate missing, invalid and throwing layout information', () => {
  const initial=systemInfo
  for(const value of [{platform:'android'},undefined,{platform:'android',safeArea:{top:NaN}}]) {
    systemInfo=value
    for(const name of ['basic','health','adl','cognitive','preference','budget']) {
      const instance=page(`pages/assessment/${name}`)
      assert.doesNotThrow(()=>instance.onLoad({}))
      assert.equal(instance.data.warmSwissHeaderHeight,48)
    }
  }
  systemInfoThrows=true
  assert.doesNotThrow(()=>page('pages/assessment/basic').onLoad({}))
  systemInfoThrows=false;systemInfo=initial
})
await test('six reused Assessment handlers validate, navigate once and unlock on return', async () => {
  for(const step of ['basic','health','adl','cognitive','preference','budget']) {
    draft.clear()
    const instance = page(`pages/assessment/${step}`)
    if(instance.onLoad) await instance.onLoad({})
    if(instance.onShow) await instance.onShow()
    navigation = []
    await instance.onNext()
    assert.equal(navigation.length,0,step+' invalid next')
    draft.loadSyntheticAnswers()
    if(instance.onShow) await instance.onShow()
    await instance.onNext()
    await instance.onNext()
    assert.equal(navigation.length,1,step+' rapid next')
    if(instance.onShow) await instance.onShow()
    await instance.onNext()
    assert.equal(navigation.length,2,step+' next after return')
  }
})
await test('real Profile and Recommendation V2 preserve S2A outcome', async () => {
  const profile = load('services/profile-application-v2.ts').buildProfileApplicationSnapshot()
  assert.equal(profile.ok,true)
  assert.equal(profile.version,2)
  assert.equal(profile.value.preview.adl.derivedFacts.careLevel.value,'semi_disabled')
  const service = load('services/recommendation-result-application.ts')
  const asOf = load('demo/data.ts').DEMO_AS_OF
  const result = await service.buildRecommendationResultApplicationSnapshot({evaluationAsOf:asOf})
  assert.equal(result.ok,true)
  assert.equal(result.version,2)
  const semantics = result.value.preview.semantics
  assert.equal(semantics.exactMatch,false)
  assert.equal(semantics.noExactMatch.reasonCode,'ONLY_SOFT_NEAR_MATCHES')
  assert.deepEqual(clone(semantics.cards.map(c => c.institutionId)),['s2a-synth-alpha'])
  const second = await service.buildRecommendationResultApplicationSnapshot({evaluationAsOf:asOf})
  assert.deepEqual(clone(second),clone(result))
  draft.clearAnswer('basic.age')
  const invalid = await service.buildRecommendationResultApplicationSnapshot({evaluationAsOf:asOf})
  assert.equal(invalid.ok,false)
  draft.loadSyntheticAnswers()
})
await test('same synthetic catalog for list and real V121 detail projection', async () => {
  const application = load('services/institution-list-detail-page.ts')
  const listing = await application.buildInstitutionListPageSnapshot(null)
  assert.equal(listing.ok,true)
  const parser = load('services/institution-detail-route.ts').parseInstitutionDetailRouteQuery
  for(const institutionId of ['s2a-synth-alpha','s2a-synth-beta','s2a-synth-gamma']) {
    const route = parser({institutionId,recordRevision:'1'})
    assert.equal(route.ok,true)
    const detail = await application.buildInstitutionDetailPageSnapshot(route.value)
    assert.equal(detail.ok,true,JSON.stringify(detail.error))
  }
})
await test('ordinary appointment button creates one local Visit, same Visit advances to TEST_ONLY evaluation', async () => {
  business.resetDemoBusinessSession()
  const instance = page('pages/appointment/create')
  await instance.onLoad({institutionId:'s2a-synth-alpha',recordRevision:'1'})
  await flush()
  assert.equal(instance.data.pageState,'ready')
  await instance.onPrepareAppointment()
  assert.equal(instance.data.prepared,true,JSON.stringify(instance.data.formErrors))
  navigation = []
  await Promise.all([instance.onDemoSubmit({}),instance.onDemoSubmit({})])
  assert.equal(instance.data.receiptReady,true,instance.data.actionMessage)
  assert.equal(navigation.length,1)
  assert.equal(business.listDemoVisits().length,1)
  const id = business.listDemoVisits()[0].visitId
  const providers = load('services/visit-evaluation-providers.ts').createDemoVisitEvaluationProvidersV1()
  const factory = load('pages/visit/visit-evaluation-application.ts').createVisitEvaluationUiApplicationV1
  const app = factory({testOnlyContextProvider:providers.contextProvider,testOnlySubmitProvider:providers.submitProvider})
  assert.notEqual((await app.loadContext(id)).kind,'ready')
  for(let stage=0;stage<3;stage++) business.advanceDemoVisitStatus(id)
  assert.equal((await app.loadContext(id)).kind,'ready')
  const evaluation = page('pages/visit/evaluation')
  await evaluation.onLoad({visitId:id})
  await flush()
  assert.equal(evaluation.data.contextMode,'test_only')
  assert.equal(evaluation.data.pageState,'editing')
  evaluation.onRatingTap({currentTarget:{dataset:{question:'overallRating',value:4}}})
  evaluation.onConsiderationTap({currentTarget:{dataset:{value:'willing'}}})
  await Promise.all([evaluation.onSubmit(),evaluation.onSubmit()])
  assert.equal(evaluation.data.pageState,'submitted',evaluation.data.feedbackMessage)
  assert.match(evaluation.data.feedbackMessage,/测试提交已完成/)
  business.resetDemoBusinessSession()
  assert.equal(business.listDemoVisits().length,0)
  assert.notEqual((await app.loadContext(id)).kind,'ready')
})
await test('approved FAQ and honest consultant availability; no platform/storage/business calls', async () => {
  const faq = load('services/ai-consultation-page.ts').createAIConsultationPageApplicationV1()
  const initial = faq.createInitialResult()
  const sending = faq.beginSend(initial,'怎样开始养老需求评估？')
  const answer = await faq.completeSend(sending)
  assert.equal(answer.ok,true)
  assert.equal(answer.value.state,'answer_ready')
  const consultant = load('services/consultant-global-page.ts').buildGlobalConsultantPageApplicationV1()
  assert.ok(consultant)
  assert.equal(nativeCalls.length,0)
  assert.equal(JSON.stringify([...sentinel]),sentinelBefore)
})
fs.writeFileSync(path.join(evidenceRoot,'offline-runtime-results.json'),JSON.stringify({status:'PASS',passed:results.length,failed:0,project:generated.project,tests:results,protectedActions:nativeCalls,storageSentinelUnchanged:true},null,2)+'\n')
console.log(JSON.stringify({status:'PASS',passed:results.length,failed:0,protectedActions:nativeCalls.length}))
