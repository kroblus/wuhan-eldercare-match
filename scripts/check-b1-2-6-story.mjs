import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const modes = ['demo','production']
for (const mode of modes) assert.equal(JSON.parse(fs.readFileSync('dist/'+mode+'/.shared-build.json')).status, 'PASS_LOCAL_BUILD')
let app, page, activePage
const effects = [], navigations = []
const appId = JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid
const wx = { getAccountInfoSync: () => ({miniProgram:{appId,envVersion:'trial'}}), getSystemInfoSync: () => ({fontSizeSetting:16}),
  navigateTo(o) { navigations.push(o.url); if(o.success)o.success({}); }, pageScrollTo() {} }
for (const key of ['request','login','getStorageSync','setStorageSync','makePhoneCall','openLocation','openCustomerServiceChat']) wx[key] = () => effects.push(key)
const rt = createWechatTsRuntime(ts,{wx,App(p){app=p},Page(p){page=p},Component(){},setTimeout,clearTimeout,getCurrentPages:()=>activePage?[activePage]:[]})
const load = p => rt.load(path.resolve('dist/demo/miniprogram',p+'.js'))
const make = p => {load(p);return {...page,data:structuredClone(page.data),setData(v){Object.assign(this.data,v)}}}
load('app'); app.onLaunch()
const session=load('demo/session'); await session.loadDemo()
const initial=session.readDemo(), snapshots=JSON.stringify(initial.assessments), catalog=JSON.stringify(load('demo/catalog').readModeCatalog())
assert.equal(initial.ready,true);assert.equal(initial.flows.length,3)
const story=load('demo/story'), q={institutionId:'demo-inst-chunhe-home',recordRevision:'1',source:'direct_link'}
const context=await story.resolveStory(q)
assert.equal(context.name,'虚构示例·春和颐养中心');assert.equal(context.mediaAvailable,true)
assert.equal(await story.resolveStory({...q,recordRevision:'999'}),null)
assert.equal(await story.resolveStory({...q,institutionId:'not-a-demo-id'}),null)
assert.equal(await story.resolveStory({...q,source:'recommendation',sourceContextRef:'missing-context'}),null)
const recommendationContext=await story.resolveStory({...q,source:'recommendation',sourceContextRef:initial.contextRef})
assert.ok(recommendationContext && recommendationContext.vrUrl.includes('sourceContextRef='+encodeURIComponent(initial.contextRef)))
assert.equal((await story.resolveStory({...q,institutionId:'demo-inst-anning-home'})).mediaAvailable,false)
console.log('PASS story identity/revision/source validation and main-only resource binding')
const mine=make('pages/mine/index');mine.onShow()
assert.deepEqual([mine.data.elders,mine.data.assessments,mine.data.appointments],[2,2,3])
const mineMarkup=fs.readFileSync('dist/demo/miniprogram/pages/mine/index.wxml','utf8')
assert.doesNotMatch(mineMarkup,/demo-tools|模拟完成|另存|重置|载入案例/)
assert.match(mineMarkup,/演示设置/)
const tab=make('pages/consultant/index');tab.onLoad({});await tab.onShow()
assert.equal(tab.data.story,null);assert.ok(tab.data.needs.summary);assert.equal(tab.data.name,'演示顾问·小安')
tab.contact();tab.ask({currentTarget:{dataset:{key:'fees'}}});assert.match(tab.data.reply,/人工确认/)
// Complement native coordinate taps with off-screen feedback / hidden-page regression.
const ticks=[], scrolls=[], revealed=[]
wx.nextTick=fn=>ticks.push(fn)
wx.pageScrollTo=o=>scrolls.push(o.scrollTop)
wx.createSelectorQuery=()=>{
  let selector='', navigation=false
  const query={in(){navigation=true;return query},select(s){selector=s;return query},boundingClientRect(){return query},
    selectViewport(){return query},scrollOffset(){return query},exec(fn){
      if(!navigation)revealed.push(selector)
      fn(navigation?[{height:98}]:[{top:selector==='#consultant-faq'?900:1200},{scrollTop:0}])
    }}
  return query
}
tab.selectComponent=()=>({})
activePage=tab;tab.contact();ticks.shift()()
assert.equal(revealed.at(-1),'#consultant-faq');assert.equal(scrolls.at(-1),786)
for(const key of ['care','fees','medical']){
  tab.ask({currentTarget:{dataset:{key}}});ticks.shift()()
  assert.equal(revealed.at(-1),'.story-reply');assert.equal(scrolls.at(-1),1086)
  assert.match(tab.data.reply,/演示回复/)
}
const scrollCount=scrolls.length
tab.contact();activePage=undefined;ticks.shift()();assert.equal(scrolls.length,scrollCount)
console.log('PASS local consultation reveals existing FAQ/reply below measured header; hidden page cannot scroll another page')
tab.book();assert.equal(navigations.length,0)
const consultant=make('pages/consultant/consultation');consultant.onLoad(q);await consultant.onShow()
assert.equal(consultant.data.story.institutionId,q.institutionId);consultant.contact();consultant.book()
assert.equal(navigations.length,1);assert.match(navigations[0],/pages\/appointment\/create\?institutionId=demo-inst-chunhe-home/)
consultant.book();assert.equal(navigations.length,1)
await consultant.onShow();consultant.book();assert.equal(navigations.length,2)
assert.equal(effects.length,0)
console.log('PASS clean personal centre, consultant tab without false context, contextual consultation, no external communication')
const book=make('pages/appointment/create');await book.onLoad(q)
assert.equal(book.data.state,'completed');book.confirm();book.confirm();assert.equal(session.readDemo().flows.length,3)
book.evaluate();assert.match(navigations.at(-1),/pages\/visit\/evaluation\?visitId=demo-visit-demo-inst-chunhe-home/)
const pending=make('pages/appointment/create');await pending.onLoad({...q,institutionId:'demo-inst-anning-home'})
pending.confirm();pending.confirm();assert.equal(session.readDemo().flows.length,4)
const before=navigations.length;pending.evaluate();assert.equal(navigations.length,before)
session.simulateVisit('demo-inst-anning-home',initial.epoch);pending.evaluate();assert.equal(navigations.length,before+1)
await session.loadDemo();assert.equal(session.readDemo().flows.length,4)
assert.equal(JSON.stringify(session.readDemo().assessments),snapshots);assert.equal(JSON.stringify(load('demo/catalog').readModeCatalog()),catalog)
session.resetDemo();pending.confirm();assert.equal(session.readDemo().flows.length,0);assert.ok(pending.data.error)
const staleNavigationCount = navigations.length
pending.evaluate();assert.equal(navigations.length,staleNavigationCount)
assert.equal(story.isStoryCurrent(context),false)
assert.equal(await story.resolveStory(q),null)
await session.loadDemo();assert.equal(session.readDemo().flows.length,3)
console.log('PASS idempotent booking, explicit completed Visit gate, immutable snapshots/facts, stale epoch rejection and cold/reset lifecycle')
for(const key of ['request','login','getStorageSync','setStorageSync','makePhoneCall','openLocation','openCustomerServiceChat'])assert.throws(()=>wx[key](),/DEMO_API_BLOCKED/)
const prod='dist/production/miniprogram/'
for(const p of ['demo','components/demo-tools','components/demo-story-preview','assets/vr-synthetic-test.jpg'])assert.equal(fs.existsSync(prod+p),false,p)
assert.doesNotMatch(fs.readFileSync(prod+'pages/consultant/index.js','utf8'),/demo-consultant|demo\/story|演示顾问/)
assert.doesNotMatch(fs.readFileSync(prod+'pages/institution/detail.js','utf8'),/demo\/story|storyDestination/)
assert.match(fs.readFileSync(prod+'services/institution-vr-resource.js','utf8'),/PRODUCTION_CANDIDATE/)
assert.equal(effects.length,0)
console.log('PASS production excludes Demo consultant, management, story provider and synthetic media; all existing API guards retained')
