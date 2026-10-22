/** TEST_ONLY in-memory build/account admission vectors, not an independent AppID acceptance. */
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const runtime = createWechatTsRuntime(ts, { wx: { getStorageSync: () => '', setStorageSync: () => { throw new Error('no write') } } })
const { readRecommendationSaveBuildV1 } = runtime.load(path.resolve('miniprogram/services/recommendation-save-build.ts'))
assert.equal(readRecommendationSaveBuildV1(), null, 'normal build has no enabled build artifact')
const { createRecommendationResultSaveControllerV1: controller } = runtime.load(path.resolve('miniprogram/services/recommendation-result-save.ts'))
const build = { kind: 'recommendation_save_test_only_build_v1', independentAppId: 'wx1111111111111111', standardAppId: 'wx2222222222222222',
  backendOrigin: 'https://test-only.example', approvalReference: 'TEST_ONLY_UNIT_NO_REAL_APPID_AUTHORIZATION', artifactReference: 'TEST_ONLY_RUNTIME_NOT_DEPLOYED' }
const snapshot = { kind: 'recommendation_result_application_snapshot_v2', preview: { kind: 'recommendation_preview_v2', semantics: { state: 'no_exact_match' } } }
const flush = async () => { for(let i=0;i<30;i++) await Promise.resolve() }
const fixture = (override = {}) => {
  let profile = { ...build }, account = { appId: build.independentAppId, envVersion: 'develop' }, scope = 'TEST_ONLY_SCOPE_A', cap = true
  const calls = { client: 0, capability: 0, scope: 0, confirmation: 0, cancel: 0, reconcile: 0, save: 0 }
  const host = { data: {}, setData(patch) { Object.assign(this.data, JSON.parse(JSON.stringify(patch))) } }
  const client = {
    capability: async () => { calls.capability++;return cap },
    currentAuthorizedScope: async () => { calls.scope++;return scope },
    requestSaveConfirmation: async () => { calls.confirmation++;return { state: 'CONFIRM', confirmation: { message: 'TEST_ONLY private token' } } },
    cancelSaveConfirmation: () => { calls.cancel++ },
    recoverPending: async () => { calls.reconcile++;return { state: 'ERROR', message: '保存结果待确认；保留原意图和草稿' } },
    saveCurrent: () => { calls.save++;throw new Error('must never submit current anonymous Preview') },
    ...override,
  }
  const c = controller(host, { build: () => profile, account: () => account, client: () => { calls.client++;return client } })
  return { c,host,calls,client, admit:async value=>{await c.activate(value);await c.verify()},profile: v=>{profile=v}, account: v=>{account=v}, scope: v=>{scope=v}, capability: v=>{cap=v} }
}
let cases=0
const check = async (label, fn) => { await fn();cases++;console.log('PASS '+label) }
await check('production artifact closes before identity/network/storage',async()=>{
  const f=fixture();f.profile(null);await f.admit(snapshot);await f.c.begin();f.host.data.resultSaveVisible=true;f.host.data.resultSaveConfirmDisabled=false;f.c.confirm();await f.c.reconcile()
  assert.equal(f.calls.client,0);assert.equal(f.calls.save,0);assert.equal(f.calls.confirmation,0)
})
await check('anonymous viewing with admitted build performs no C5 or History request',async()=>{
  const f=fixture();await f.c.activate(snapshot);assert.equal(f.calls.client,0);assert.equal(f.host.data.resultSaveAdmissionReady,false)
  f.host.data.resultSaveAdmissionReady=true;await f.c.begin();await f.c.reconcile();assert.equal(await f.c.canOpenHistory(),false);assert.equal(f.calls.client,0)
  await f.c.verify();assert.equal(f.host.data.resultSaveAdmissionReady,true)
})
await check('rapid explicit verification creates one client',async()=>{
  let release,checks=0;const f=fixture({capability:()=>{checks++;return new Promise(r=>{release=r})}})
  await f.c.activate(snapshot);const first=f.c.verify(),second=f.c.verify();await flush();assert.equal(checks,1);assert.equal(f.calls.client,1)
  release(true);await Promise.all([first,second]);assert.equal(f.host.data.resultSaveAdmissionReady,true);assert.equal(f.calls.save,0)
})
await check('failed second verification cannot retain old admission',async()=>{
  const f=fixture();await f.admit(snapshot);assert.equal(f.host.data.resultSaveAdmissionReady,true)
  f.capability(false);await f.c.verify();assert.equal(f.host.data.resultSaveAdmissionReady,false);assert.equal(f.host.data.resultSaveCanReconcile,false)
  f.host.data.resultSaveAdmissionReady=true;await f.c.begin();await f.c.reconcile();assert.equal(await f.c.canOpenHistory(),false)
  assert.equal(f.calls.confirmation,0);assert.equal(f.calls.reconcile,0);assert.equal(f.calls.save,0)
})
for(const [label, alter] of [
  ['release',f=>f.account({appId:build.independentAppId,envVersion:'release'})],
  ['trial',f=>f.account({appId:build.independentAppId,envVersion:'trial'})],
  ['wrong-AppID',f=>f.account({appId:build.standardAppId,envVersion:'develop'})],
  ['same-AppID',f=>f.profile({...build,standardAppId:build.independentAppId})],
  ['local-origin',f=>f.profile({...build,backendOrigin:'http://127.0.0.1:34479'})],
  ['missing-approval',f=>f.profile({...build,approvalReference:''})],
  ['missing-artifact',f=>f.profile({...build,artifactReference:''})],
]) await check(label+' cannot admit',async()=>{const f=fixture();alter(f);await f.admit(snapshot);assert.equal(f.calls.client,0);assert.equal(f.host.data.resultSaveVisible,false)})
await check('server capability disabled',async()=>{const f=fixture();f.capability(false);await f.admit(snapshot);assert.equal(f.host.data.resultSaveAdmissionReady,false);assert.equal(f.calls.scope,0)})
await check('no authenticated sole Elder scope',async()=>{const f=fixture();f.scope(null);await f.admit(snapshot);assert.equal(f.host.data.resultSaveAdmissionReady,false)})
await check('loading/error/V1 do not display completed save',async()=>{const f=fixture();await f.c.activate();assert.equal(f.calls.client,0)})
await check('D02 preflight reused but preview persist blocked',async()=>{
  const f=fixture();await f.admit(snapshot);assert.equal(f.host.data.resultSaveVisible,true)
  await f.c.begin();assert.equal(f.calls.confirmation,1);assert.equal(f.host.data.resultSaveConfirmDisabled,true);assert.equal(f.host.data.resultSaveDialog,true)
  assert.match(f.host.data.resultSaveMessage,/缺少服务器绑定/);assert.match(f.host.data.resultSaveMessage,/不是|不代表敏感信息/)
  f.host.data.resultSaveConfirmDisabled=false;f.c.confirm();assert.equal(f.calls.save,0);assert.equal(f.host.data.resultSaveDialog,false)
})
await check('cancel invalidates and allocates nothing',async()=>{const f=fixture();await f.admit(snapshot);await f.c.begin();f.c.cancel();assert.equal(f.host.data.resultSaveDialog,false);assert.equal(f.calls.save,0)})
await check('rapid taps use one preflight; cancel suppresses late dialog',async()=>{
  let release;const f=fixture({requestSaveConfirmation:()=>new Promise(r=>{release=r})});await f.admit(snapshot)
  const first=f.c.begin();const second=f.c.begin();await flush();assert.ok(release)
  f.c.cancel();release({state:'CONFIRM',confirmation:{message:'late'}});await Promise.all([first,second]);assert.equal(f.host.data.resultSaveDialog,false);assert.equal(f.host.data.resultSavePending,false);assert.equal(f.calls.save,0)
})
await check('answers/session edit invalidates existing D02 proof',async()=>{
  const f=fixture({requestSaveConfirmation:async()=>({state:'ERROR',message:'确认后答案或会话已变化，未提交'})});await f.admit(snapshot);await f.c.begin();assert.equal(f.host.data.resultSaveDialog,false);assert.match(f.host.data.resultSaveMessage,/会话已变化/);assert.equal(f.calls.save,0)
})
for(const reason of ['owner','Elder']) await check(reason+' scope switch stops old confirmation',async()=>{
  let release;const f=fixture({requestSaveConfirmation:()=>new Promise(r=>{release=r})});await f.admit(snapshot);const p=f.c.begin();await flush();f.scope('TEST_ONLY_SCOPE_B');release({state:'CONFIRM',confirmation:{message:'old account'}});await p;assert.equal(f.host.data.resultSaveVisible,false);assert.equal(f.host.data.resultSaveDialog,false);assert.equal(f.calls.save,0)
})
await check('environment switch suppresses late response',async()=>{
  let release;const f=fixture({requestSaveConfirmation:()=>new Promise(r=>{release=r})});await f.admit(snapshot);const p=f.c.begin();await flush();f.account({appId:build.independentAppId,envVersion:'release'});release({state:'CONFIRM',confirmation:{message:'old'}});await p
  assert.equal(f.host.data.resultSaveDialog,false);assert.equal(f.calls.save,0)
})
await check('unconfirmed original is requery only',async()=>{const f=fixture();await f.admit(snapshot);await f.c.reconcile();assert.match(f.host.data.resultSaveMessage,/待确认/);assert.equal(f.calls.reconcile,1);assert.equal(f.calls.save,0)})
await check('confirmed old history never labels current preview saved',async()=>{
  const f=fixture({recoverPending:async()=>({state:'SUCCESS',item:{id:'TEST_ONLY_OLD'},message:'保存成功'})});await f.admit(snapshot);await f.c.reconcile();assert.match(f.host.data.resultSaveMessage,/不代表该历史结果/);assert.equal(f.calls.save,0)
})
await check('late confirmed A response hidden under B',async()=>{
  let release;const f=fixture({recoverPending:()=>new Promise(r=>{release=r})});await f.admit(snapshot);const p=f.c.reconcile();await flush();f.scope('TEST_ONLY_SCOPE_B');release({state:'SUCCESS',item:{id:'A_SECRET'},message:'A_SECRET'});await p
  assert.equal(f.host.data.resultSaveVisible,false);assert.ok(!JSON.stringify(f.host.data).includes('A_SECRET'))
})
await check('quota rejection is not success or new intent',async()=>{
  const f=fixture({requestSaveConfirmation:async()=>({state:'ERROR',message:'测试保存额度受限；请保留原意图和草稿'})});await f.admit(snapshot);await f.c.begin();assert.match(f.host.data.resultSaveMessage,/受限/);assert.equal(f.calls.save,0)
})
await check('NO_SAFE and NO_EXACT_MATCH cannot fabricate persistence proof',async()=>{
  for(const state of ['no_safe_recommendation','no_exact_match','ready_exact']){const f=fixture();await f.admit({...snapshot,preview:{semantics:{state,versions:{forged:'matching constant'}}}});await f.c.begin();f.c.confirm();assert.equal(f.calls.save,0);assert.equal(f.host.data.resultSaveConfirmDisabled,true)}
})
await check('hide or refresh drops old dialog',async()=>{
  let release;const f=fixture({requestSaveConfirmation:()=>new Promise(r=>{release=r})});await f.admit(snapshot);const p=f.c.begin();await flush();f.c.close();release({state:'CONFIRM',confirmation:{message:'old'}});await p;assert.equal(f.host.data.resultSaveVisible,false);assert.equal(f.calls.save,0)
})
await check('production page forged flags cannot open history',async()=>{const f=fixture();f.profile(null);await f.admit(snapshot);f.host.data.resultSaveVisible=true;assert.equal(await f.c.canOpenHistory(),false)})
const wxml=readFileSync('miniprogram/pages/recommendation/result.wxml','utf8'), source=readFileSync('miniprogram/services/recommendation-result-save.ts','utf8')
const {createCompletedAssessmentUserLoopV1:actualLoop}=runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts'))
for(const mode of ['same','changed','forbidden','production']) await check('actual readonly scope probe '+mode,async()=>{
  let scopes=0,requests=0
  const loop=actualLoop(()=>{throw new Error('scope admission must never read answers')},{
    environment:()=>mode==='production'?'release':'develop',developmentBackendOrigin:()=>build.backendOrigin,login:async()=> 'TEST_ONLY',
    request:async input=>{
      requests++
      if(input.url.endsWith('/user-loop-capability'))return {statusCode:200,data:{contractVersion:'completed-assessment-history-api-v1',kind:'completed_assessment_user_loop_capability_v1',availability:'ready',source:'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1'}}
      if(input.url.endsWith('/auth/wechat'))return {statusCode:200,data:{contractVersion:'wechat-authenticated-principal-contract-v1',kind:'wechat_authentication_result_v1',outcome:'AUTHENTICATED',code:'AUTHENTICATED',sessionEvidence:'TEST_ONLY',expiresAt:new Date(Date.now()+60000).toISOString()}}
      assert.ok(input.url.endsWith('/save-intents/scope'));assert.equal(input.method,'GET');scopes++
      return {statusCode:mode==='forbidden'?403:200,data:{contractVersion:'completed-assessment-history-api-v1',kind:'history_save_recovery_v1',scopeId:mode==='changed'&&scopes>1?'44444444-4444-4444-8444-444444444444':'33333333-3333-4333-8333-333333333333',intentId:null,createdAt:null,state:'SCOPE',item:null,sessionId:null}}
    },
  },{read(){throw new Error('scope probe cannot read local recovery')},write(){throw new Error('no local persistence')}})
  assert.equal(await loop.currentAuthorizedScope(),mode==='same'?'33333333-3333-4333-8333-333333333333':null)
  if(mode==='production')assert.equal(requests,0)
})
assert.ok(wxml.indexOf('class="result-save"')>wxml.indexOf('text="咨询养老顾问" variant="primary"'))
assert.equal((wxml.match(/bind:action="onSaveAssessment"/g)||[]).length,1);assert.ok(!wxml.includes('bindtap="onSaveAssessment"'))
assert.ok(/class="result-save__confirm"[^\n]+disabled="\{\{resultSaveConfirmDisabled \|\| resultSavePending\}\}"/.test(wxml));assert.ok(/\.saveCurrent\(token\)/.test(source))
assert.ok(!source.includes('setStorageSync')&&!source.includes('Math.random')&&!source.includes('captureHistoricalRecommendation'))
console.log(`RESULT_SAVE_RUNTIME = PASS: ${cases} cases + structural single-action/no new persistence assertions; synthetic unit admission only; real AppID/seen-saved proof unavailable`)
