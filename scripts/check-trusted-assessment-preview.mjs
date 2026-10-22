/** TEST_ONLY virtual build fixtures; HTTP is real C5/History/disposable MySQL, never device admission. */
import assert from 'node:assert/strict'
import path from 'node:path'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createWechatTsRuntime,loadWechatTypeScript} from './support/load-wechat-ts-runtime.mjs'
const {ts}=loadWechatTypeScript(), clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)), origin='https://trust-test-only.example'
const build={kind:'recommendation_save_test_only_build_v1',independentAppId:'wx1111111111111111',standardAppId:'wx2222222222222222',backendOrigin:origin,
  approvalReference:'TEST_ONLY_VIRTUAL_FIXTURE_NOT_OWNER_APPROVAL',artifactReference:'TEST_ONLY_RUNTIME_NOT_DEVICE_BUILD'}
const account={appId:build.independentAppId,envVersion:'develop'}, snapshot={kind:'recommendation_result_application_snapshot_v2'}
const answers=JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json','utf8'))
const rt=createWechatTsRuntime(ts,{wx:{getStorageSync:()=>'',setStorageSync:()=>{throw new Error('unit should not persist')}}})
const catalog=JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-server-recommendation-catalog-v1.json','utf8'))
const completed={kind:'completed_assessment',id:randomUUID(),elderId:'TEST_ONLY_ELDER',status:'completed',schemaVersion:2,completedAt:new Date().toISOString(),answers}
const capture=rt.load(path.resolve('miniprogram/domain/assessment-history/recommendation-display.ts')).captureHistoricalRecommendationV1
const display=capture({completed,catalog,evaluationAsOf:completed.completedAt,sourceReference:'TEST_ONLY_INPUT_CATALOG',sourceDigest:createHash('sha256').update(JSON.stringify(catalog)).digest('hex')})
assert.equal(display.ok,true)
const candidate={contractVersion:'completed-assessment-history-api-v1',kind:'trusted_recommendation_preview_v1',previewId:completed.id,displayBinding:randomBytes(32).toString('base64url'),sessionId:randomUUID(),scopeId:randomUUID(),
  environment:'TEST_ONLY_UNIT_V1',createdAt:completed.completedAt,expiresAt:new Date(Date.now()+600000).toISOString(),state:'READY',
  profileDisplay:{kind:'historical_profile_display_v1',snapshotVersion:1,assessmentId:completed.id,assessmentCompletedAt:completed.completedAt,assessmentSchemaVersion:2,
    profileContractVersion:'elder-profile-contract-v2',derivationRulesetVersion:'elder-profile-ruleset-v2',rows:['照护需求','行动能力','康复需求','食物质地支持','吞咽关注','认知关注'].map(label=>({label,value:'TEST_ONLY'}))},recommendationDisplay:display.display}
const helpers=rt.load(path.resolve('miniprogram/services/trusted-assessment-preview.ts')), create=rt.load(path.resolve('miniprogram/services/recommendation-result-save.ts')).createRecommendationResultSaveControllerV1
assert.equal(helpers.validTrustedAssessmentPreviewV1(candidate),true)
for(const changed of [{...candidate,answers:{}},{...candidate,displayBinding:'guessable'},{...candidate,displayBinding:randomUUID()},{...candidate,environment:'production'},{...candidate,profileDisplay:{...candidate.profileDisplay,assessmentId:randomUUID()}}]) assert.equal(helpers.validTrustedAssessmentPreviewV1(changed),false)
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name)}
const fixture=(override={})=>{
  const host={data:{},setData(p){Object.assign(this.data,clone(p))}}, calls={save:0,preview:0},token={message:'TEST_ONLY D02, not D11'}
  let scope=candidate.scopeId
  const client={capability:async()=>true,currentAuthorizedScope:async()=>scope,cancelSaveConfirmation(){},recoverPending:async()=>null,
    requestSaveConfirmation:async()=>({state:'ERROR',message:'anonymous not bound'}),
    createTrustedPreview:async()=>{calls.preview++;return {state:'READY',projection:helpers.trustedPreviewProjectionV1(candidate)}},
    requestTrustedSaveConfirmation:async()=>({state:'CONFIRM',confirmation:token}),
    saveCurrent:async proof=>{assert.equal(proof,token);calls.save++;return {state:'SUCCESS',item:{id:'TEST_ONLY'},message:'保存成功'}},...override}
  const c=create(host,{build:()=>build,account:()=>account,client:()=>client})
  return {c,host,calls,scope:v=>scope=v,async ready(){await c.activate(snapshot);await c.verify();await c.obtainPreview()}}
}
await test('explicit candidate, actually projected rows/order/reasons/source, D02 and one save',async()=>{
  const f=fixture();await f.c.activate(snapshot);assert.equal(f.calls.preview,0);await f.ready()
  assert.equal(JSON.stringify(f.host.data.resultSaveTrustedView),JSON.stringify(helpers.trustedPreviewViewV1(helpers.trustedPreviewProjectionV1(candidate))))
  await f.c.begin();assert.equal(f.host.data.resultSaveConfirmDisabled,false);await Promise.all([f.c.confirm(),f.c.confirm()]);assert.equal(f.calls.save,1)
})
await test('cancel before D02 creates no completion',async()=>{const f=fixture();await f.ready();await f.c.begin();f.c.cancel();await f.c.confirm();assert.equal(f.calls.save,0)})
await test('forged page flags without private candidate cannot save',async()=>{const f=fixture();await f.c.activate(snapshot);await f.c.verify();f.host.data.resultSaveConfirmDisabled=false;await f.c.confirm();assert.equal(f.calls.save,0)})
await test('actual page projection tampering cancels confirmation',async()=>{const f=fixture();await f.ready();await f.c.begin();f.host.data.resultSaveTrustedView.profileRows[0].value='forged';await f.c.confirm();assert.equal(f.calls.save,0)})
await test('candidate expiry/context mismatch gives visible safe block',async()=>{const f=fixture({requestTrustedSaveConfirmation:async()=>({state:'ERROR',message:'可信展示已失效，请重新核验'})});await f.ready();await f.c.begin();assert.equal(f.host.data.resultSaveDialog,false);assert.match(f.host.data.resultSaveMessage,/失效/);await f.c.confirm();assert.equal(f.calls.save,0)})
await test('late candidate from old owner is hidden',async()=>{let release;const f=fixture({createTrustedPreview:()=>new Promise(r=>release=r)});await f.c.activate(snapshot);await f.c.verify();const p=f.c.obtainPreview();while(!release)await Promise.resolve();f.scope(randomUUID());release({state:'READY',projection:helpers.trustedPreviewProjectionV1(candidate)});await p;assert.equal(f.host.data.resultSaveTrustedView,null);assert.equal(f.calls.save,0)})
await test('hide and refresh drop executable confirmation',async()=>{const f=fixture();await f.ready();await f.c.begin();f.c.close();await f.c.confirm();assert.equal(f.calls.save,0)})
await test('normal artifact remains null',async()=>assert.equal(rt.load(path.resolve('miniprogram/services/recommendation-save-build.ts')).readRecommendationSaveBuildV1(),null))

if(process.argv.includes('--http')){
  assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL,'true')
  const factory=async({noSafe=false}={})=>{
    let actor='A',drop=false,failStorage=false,denySave=false,lastCandidate;const storage=new Map(),requests=[]
    const runtime=createWechatTsRuntime(ts,{wx:{getStorageSync:k=>clone(storage.get(k)??''),setStorageSync:(k,v)=>{if(failStorage&&k==='__test_only_history_save_recovery_v1')throw new Error('TEST_ONLY persistence failure');storage.set(k,clone(v))},removeStorageSync(){throw new Error('no clear')}}})
    const transport={environment:()=> 'develop',developmentBackendOrigin:()=>origin,login:async()=>`TEST_ONLY_LOGIN_${actor}_${runId}`,
      request:async input=>{
        const u=new URL(input.url),save=u.pathname==='/api/v1/completed-assessments'&&input.method==='POST'
        requests.push({path:u.pathname,method:input.method,body:input.data&&clone(input.data)})
        if(save){assert.ok(storage.get('__test_only_history_save_recovery_v1'),'persist before request');if(denySave){denySave=false;throw new Error('TEST_ONLY before delivery')}}
        u.protocol='http:';u.hostname='127.0.0.1';u.port='34479'
        const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data),signal:AbortSignal.timeout(15000)}),data=await r.json()
        if(u.pathname.endsWith('/trusted-previews')&&r.status===200)lastCandidate=clone(data)
        if(save&&drop){drop=false;assert.equal(r.status,201);throw new Error('TEST_ONLY lost response')}
        return {statusCode:r.status,data}
      }}
    const runId=randomUUID(),c5=runtime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
    const auth=async()=>{const s=await c5.createC5AuthenticatedBackendSessionClientV1(transport).acquireSession(origin);assert.equal(s.kind,'authenticated');return s.session}
    for(const who of ['A','B']){actor=who;const s=await auth();assert.equal((await transport.request({url:origin+'/api/v1/elder-record',method:'POST',header:c5.createC5AuthenticatedJsonHeadersV1(s),timeout:15000})).statusCode,200)} actor='A'
    const store=runtime.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
    for(const [key,value]of Object.entries({...answers,...(noSafe?{'cognitive.symptoms':['unknown']}: {})}))assert.equal(store.setAnswer(key,clone(value)).persistence.ok,true)
    const loop=runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(()=>store,transport,{read:k=>clone(storage.get(k)),write:(k,v)=>{if(failStorage&&k==='__test_only_history_save_recovery_v1')throw new Error('TEST_ONLY persistence failure');storage.set(k,clone(v))}})
    const host={data:{},setData(p){Object.assign(this.data,clone(p))}},controller=runtime.load(path.resolve('miniprogram/services/recommendation-result-save.ts')).createRecommendationResultSaveControllerV1(host,{build:()=>build,account:()=>account,client:()=>loop})
    await controller.activate(snapshot);await controller.verify();assert.equal(host.data.resultSaveAdmissionReady,true)
    return {loop,controller,host,store,storage,requests,before:JSON.stringify(store.getDraft()),candidate:()=>clone(lastCandidate),switch:v=>actor=v,drop:()=>drop=true,failStorage:()=>failStorage=true,deny:()=>denySave=true,
      async http(path,data){const s=await auth();return transport.request({url:origin+path,method:'POST',timeout:15000,header:c5.createC5AuthenticatedJsonHeadersV1(s),data})},
      saves:()=>requests.filter(r=>r.path==='/api/v1/completed-assessments'&&r.method==='POST'),async list(){const s=await auth();return (await transport.request({url:origin+'/api/v1/completed-assessments?limit=50',method:'GET',timeout:15000,header:c5.createC5AuthenticatedJsonHeadersV1(s)})).data.items}}
  }
  const critical=d=>{const v=clone(d);delete v.assessmentId;delete v.assessmentCompletedAt;return JSON.stringify(v)}
  await test('real HTTP controller Preview->D02->immutable Profile/Recommendation, cancel/rapid click',async()=>{
    const f=await factory();await f.controller.obtainPreview();assert.ok(f.host.data.resultSaveTrustedView);const view=clone(f.host.data.resultSaveTrustedView)
    const candidateResponse=await f.loop.createTrustedPreview();assert.equal(candidateResponse.state,'READY') // identical input returns same server candidate
    if(process.argv.includes('--visual-fixture')){
      const file=path.resolve('server/target',`trust-visual-projection-${randomUUID()}.json`)
      writeFileSync(file,JSON.stringify({provenance:'TEST_ONLY_HTTP_PROJECTED_DISPLAY_NO_CREDENTIALS',view:clone(f.host.data.resultSaveTrustedView)}))
      console.log('VISUAL_ONLY_PROJECTION = '+file)
    }
    await f.controller.begin();f.controller.cancel();assert.equal((await f.list()).length,0);assert.equal(f.saves().length,0)
    await f.controller.begin();assert.equal(f.host.data.resultSaveConfirmDisabled,false,f.host.data.resultSaveMessage);await Promise.all([f.controller.confirm(),f.controller.confirm()]);assert.equal(f.saves().length,1,f.host.data.resultSaveMessage);assert.match(f.host.data.resultSaveMessage,/保存成功/)
    const list=await f.list();assert.equal(list.length,1);const detail=await f.loop.readDetail(list[0].id),rec=await f.loop.readRecommendation(list[0].id)
    assert.equal(detail.state,'READY');assert.equal(rec.state,'READY');assert.equal(critical(detail.profile),critical(candidateResponse.projection.profileDisplay));assert.equal(critical(rec.display),critical(candidateResponse.projection.recommendationDisplay))
    assert.equal(JSON.stringify(f.host.data.resultSaveTrustedView),JSON.stringify(view));assert.equal(JSON.stringify(f.store.getDraft()),f.before)
    assert.deepEqual(Object.keys(f.storage.get('__test_only_history_save_recovery_v1')).sort(),['version','origin','scopeId','intentId','createdAt','draftContext','state'].sort())
    f.switch('B');await f.controller.begin();assert.equal(f.host.data.resultSaveTrustedView,null);assert.equal((await f.loop.readDetail(list[0].id)).state,'ERROR')
  })
  await test('NO_SAFE/NO_EXACT_MATCH saved without false candidates',async()=>{
    const f=await factory({noSafe:true});await f.controller.obtainPreview();assert.equal(f.host.data.resultSaveTrustedView.state,'no_safe_recommendation');assert.equal(f.host.data.resultSaveTrustedView.recommendation.cards.length,0)
    await f.controller.begin();await f.controller.confirm();assert.match(f.host.data.resultSaveMessage,/保存成功/);const items=await f.list(),r=await f.loop.readRecommendation(items[0].id)
    assert.equal(r.state,'READY');assert.equal(r.display.state,'no_safe_recommendation');assert.equal(r.display.cards.length,0);assert.ok(r.display.noExactMatch);assert.equal(JSON.stringify(f.store.getDraft()),f.before)
  })
  await test('lost receipt recovers original record, never new intent',async()=>{
    const f=await factory();await f.controller.obtainPreview();await f.controller.begin();f.drop();await f.controller.confirm();assert.equal(f.saves().length,1)
    await f.controller.reconcile();assert.match(f.host.data.resultSaveMessage,/已确认原历史/);assert.equal((await f.list()).length,1);assert.equal(f.saves().length,1)
  })
  await test('local recovery write failure sends no completion request',async()=>{const f=await factory();await f.controller.obtainPreview();await f.controller.begin();f.failStorage();await f.controller.confirm();assert.equal(f.saves().length,0);assert.equal((await f.list()).length,0);assert.equal(JSON.stringify(f.store.getDraft()),f.before)})
  await test('same exact in-memory trusted payload retries original intent after network failure',async()=>{const f=await factory();await f.controller.obtainPreview();await f.controller.begin();f.deny();await f.controller.confirm();await f.controller.begin();await f.controller.confirm();assert.equal(f.saves().length,2);assert.equal(f.saves()[0].body.idempotencyKey,f.saves()[1].body.idempotencyKey);assert.equal(JSON.stringify(f.saves()[0].body),JSON.stringify(f.saves()[1].body));assert.equal((await f.list()).length,1)})
  await test('changed Draft blocks old candidate and creates no intention',async()=>{const f=await factory();await f.controller.obtainPreview();f.store.setAnswer('basic.age',75);await f.controller.begin();assert.equal(f.host.data.resultSaveDialog,false);assert.equal(f.saves().length,0);assert.equal((await f.list()).length,0)})
  await test('HTTP tampered ID/nonce/digest, foreign owner and unapproved synthetic input refused',async()=>{
    const f=await factory();await f.controller.obtainPreview();const c=f.candidate(),check='/api/v1/completed-assessments/trusted-previews/check'
    const body={sessionId:c.sessionId,previewId:c.previewId,displayBinding:c.displayBinding}
    assert.equal((await f.http(check,{...body,previewId:randomUUID()})).statusCode,404)
    assert.equal((await f.http(check,{...body,displayBinding:'A'.repeat(43)})).statusCode,404)
    assert.equal((await f.http(check,{...body,digest:'forged'})).statusCode,400)
    f.switch('B');assert.equal((await f.http(check,body)).statusCode,404);f.switch('A')
    f.store.setAnswer('basic.age',75);const r=await f.loop.createTrustedPreview();assert.equal(r.state,'ERROR');assert.equal(f.saves().length,0);assert.equal((await f.list()).length,0)
    assert.equal((await f.http(check,body)).data.state,'READY','invalid input does not revoke the existing approved candidate')
  })
}
console.log(`TRUSTED_PREVIEW_TEST = PASS: ${count} scenarios; ${process.argv.includes('--http')?'real synthetic C5 HTTP/MySQL controller flow':'unit only'}; AppID/build values are virtual fixtures, no device proof`)
