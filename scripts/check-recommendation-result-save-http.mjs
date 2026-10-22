/** TEST_ONLY HTTP integration. Virtual AppID/build fixtures are NOT real package/AppID authorization. */
import assert from 'node:assert/strict'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL,'true')
const {ts}=loadWechatTypeScript(),storage=new Map(),requests=[];let account='A',writes=0
const runtime=createWechatTsRuntime(ts,{wx:{getStorageSync:key=>storage.get(key)||'',setStorageSync:(key,value)=>{writes++;storage.set(key,JSON.parse(JSON.stringify(value)))},removeStorageSync:()=>{throw new Error('no clear')}}})
const runId=randomUUID(),origin='https://test-only.example'
const transport={environment:()=> 'develop',developmentBackendOrigin:()=>origin,login:async()=>`TEST_ONLY_LOGIN_${account}_${runId}`,
  request:async input=>{
    const url=new URL(input.url);assert.equal(url.origin,origin)
    requests.push({path:url.pathname,method:input.method})
    // Only this test transport routes the virtual HTTPS origin to the owned loopback test harness.
    url.protocol='http:';url.hostname='127.0.0.1';url.port='34479'
    const r=await fetch(url,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data),signal:AbortSignal.timeout(15000)})
    return {statusCode:r.status,data:await r.json()}
  }}
const c5=runtime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
const auth=()=>c5.createC5AuthenticatedBackendSessionClientV1(transport).acquireSession(origin)
for(const actor of ['A','B']){account=actor;const s=await auth();assert.equal(s.kind,'authenticated');assert.equal((await transport.request({url:origin+'/api/v1/elder-record',method:'POST',header:c5.createC5AuthenticatedJsonHeadersV1(s.session)})).statusCode,200)}
account='A'
const store=runtime.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
const answers=JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json','utf8'))
for(const [key,value] of Object.entries(answers))assert.equal(store.setAnswer(key,value).persistence.ok,true)
const before=JSON.stringify(store.getDraft()),beforeWrites=writes
const application=runtime.load(path.resolve('miniprogram/services/recommendation-result-application.ts'))
const result=await application.buildRecommendationResultApplicationSnapshot({evaluationAsOf:'2026-10-14T00:00:00Z'})
assert.equal(result.ok,true);assert.equal(result.version,2)
const loop=runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(()=>store,transport,{read:key=>storage.get(key),write:()=>{throw new Error('result preflight cannot persist a new intent')}})
const {createRecommendationResultSaveControllerV1:create}=runtime.load(path.resolve('miniprogram/services/recommendation-result-save.ts'))
const host={data:{},setData(patch){Object.assign(this.data,JSON.parse(JSON.stringify(patch)))}}
const controller=create(host,{build:()=>({kind:'recommendation_save_test_only_build_v1',independentAppId:'wx1111111111111111',standardAppId:'wx2222222222222222',backendOrigin:origin,approvalReference:'TEST_ONLY_HTTP_FIXTURE_NOT_ACTUAL_APPROVAL',artifactReference:'TEST_ONLY_RUNTIME_ONLY'}),account:()=>({appId:'wx1111111111111111',envVersion:'develop'}),client:()=>loop})
const viewRequests=requests.length;await controller.activate(result.value);assert.equal(requests.length,viewRequests,'passive result viewing cannot authenticate')
await Promise.all([controller.verify(),controller.verify()]);assert.equal(host.data.resultSaveAdmissionReady,true)
await Promise.all([controller.begin(),controller.begin()]);assert.equal(host.data.resultSaveDialog,true);assert.equal(host.data.resultSaveConfirmDisabled,true)
controller.cancel();await controller.begin();host.data.resultSaveConfirmDisabled=false;controller.confirm()
assert.equal(JSON.stringify(store.getDraft()),before);assert.equal(writes,beforeWrites)
assert.equal(requests.filter(r=>r.method==='POST'&&(r.path.endsWith('/save-intents')||r.path==='/api/v1/completed-assessments'||r.path.endsWith('/assessment-sessions/register'))).length,0,'no intent/session/completion allocation')
const s=await auth();assert.equal(s.kind,'authenticated');const list=await transport.request({url:origin+'/api/v1/completed-assessments?limit=20',method:'GET',header:c5.createC5AuthenticatedJsonHeadersV1(s.session)});assert.equal(list.statusCode,200);assert.equal(list.data.items.length,0)
account='B';await controller.begin();assert.equal(host.data.resultSaveVisible,false,'real server scope prevents retaining A admission under B');assert.equal(JSON.stringify(store.getDraft()),before)
console.log('PASS: actual completed-input/D02/C5+Elder/scope HTTP preflight; anonymous view has no authentication; cancel/forged confirm/rapid taps allocate no intent and upload no answers; zero completed rows; Draft preserved; server A->B hides admission')
console.log('DISPLAY_PERSISTED_VERSION_CONSISTENCY = BLOCKED; virtual build/AppID fixtures do not prove real AppID/package/TLS isolation or result-page save success')
