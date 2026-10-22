/** Local synthetic regression against the isolated runner; NOT DevTools/AppID/device acceptance. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fork} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {randomUUID,randomBytes} from 'node:crypto'
import {createWechatTsRuntime,loadWechatTypeScript} from './load-wechat-ts-runtime.mjs'
import {verifyPreparation} from '../prepare-assessment-history-test-project.mjs'

const self=fileURLToPath(import.meta.url),clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v))
const canonical=v=>JSON.stringify(v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])))
const options={};for(let i=2;i<process.argv.length;i+=2)options[process.argv[i]]=process.argv[i+1]
const parsePrivate=file=>Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)]}))
const prepared=path.resolve(options['--prepared']),privateConfig=path.resolve(options['--private-config'])
verifyPreparation(prepared)
const values=parsePrivate(privateConfig),port=Number(values['http.port'])
assert.equal(port,34579);assert.equal(values['environment.appIdGate'],'WAITING_FOR_OWNER')
assert.match(privateConfig,/history-test-environment-[0-9a-f-]{36}[\\/]private[\\/]runtime\.properties$/)
const source=path.join(prepared,'source'),{ts}=loadWechatTypeScript()
const answers=JSON.parse(fs.readFileSync(path.join(source,'server/src/test/resources/assessment-history/test-only-answers.json'),'utf8'))
const origin='http://history-environment.local:34579'
if(options['--child']){
  const mode=options['--child'],directory=path.resolve(options['--directory']),storageFile=path.join(directory,'existing-store.json')
  const data=fs.existsSync(storageFile)?JSON.parse(fs.readFileSync(storageFile,'utf8')):{},requests=[]
  let drop=mode==='drop',actor=mode==='warm'?'B':'A'
  const runtime=createWechatTsRuntime(ts,{wx:{getStorageSync:key=>clone(data[key]??''),setStorageSync:(key,value)=>{data[key]=clone(value);fs.writeFileSync(storageFile,JSON.stringify(data))},removeStorageSync(){throw Error('No clearing is allowed')}}})
  const transport={environment:()=> 'develop',developmentBackendOrigin:()=>origin,login:async()=>values['c5.syntheticLoginTicket'+actor],
    request:async input=>{
      const u=new URL(input.url);assert.equal(u.origin,origin);u.hostname='127.0.0.1'
      const save=input.method==='POST'&&u.pathname==='/api/v1/completed-assessments'
      requests.push({method:input.method,path:u.pathname})
      if(save){const record=data.__test_only_history_save_recovery_v1;assert.ok(record,'Persist before POST');assert.equal(input.data.idempotencyKey,'recover_'+record.intentId)}
      const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data),signal:AbortSignal.timeout(15000)}),result=await r.json()
      if(save&&drop){drop=false;assert.equal(r.status,201);process.send({stage:'committed',id:result.item.id});await new Promise(()=>{})}
      return {statusCode:r.status,data:result}
    }}
  const store=runtime.load(path.join(source,'miniprogram/store/assessment-draft.ts')).assessmentDraftStore
  const fill=()=>{for(const [key,value]of Object.entries(answers))assert.equal(store.setAnswer(key,clone(value)).persistence.ok,true)}
  const c5=runtime.load(path.join(source,'miniprogram/services/c5-authenticated-backend-session.ts'))
  const auth=await c5.createC5AuthenticatedBackendSessionClientV1(transport).acquireSession(origin);assert.equal(auth.kind,'authenticated')
  const headers=c5.createC5AuthenticatedJsonHeadersV1(auth.session)
  assert.equal((await transport.request({url:origin+'/api/v1/elder-record',method:'POST',header:headers})).statusCode,200)
  const make=()=>runtime.load(path.join(source,'miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(()=>store,transport)
  const client=make(),save=async()=>{
    const candidate=await client.createTrustedPreview();assert.equal(candidate.state,'READY')
    const prepared=await client.requestTrustedSaveConfirmation();assert.equal(prepared.state,'CONFIRM')
    const result=await client.saveCurrent(prepared.confirmation);assert.equal(result.state,'SUCCESS');return {result,projection:candidate.projection}
  }
  if(mode==='drop'){fill();await save();throw Error('Parent must terminate this process')}
  if(mode==='recover'){
    const before=JSON.stringify(store.getDraft()),record=data.__test_only_history_save_recovery_v1
    assert.deepEqual(Object.keys(record).sort(),['version','origin','scopeId','intentId','createdAt','draftContext','state'].sort())
    const result=await client.recoverPending();assert.equal(result.state,'SUCCESS')
    assert.ok(JSON.stringify(store.getDraft())===before,'Draft preserved')
    assert.equal(requests.filter(x=>x.method==='POST'&&x.path==='/api/v1/completed-assessments').length,0)
    const foreign=options['--foreign'];if(foreign)assert.equal((await client.readDetail(foreign)).state,'ERROR')
    const list=(await transport.request({url:origin+'/api/v1/completed-assessments?limit=50',method:'GET',header:headers})).data
    assert.equal(list.items.length,1);assert.equal(list.items[0].id,result.item.id)
    process.send({stage:'done',id:result.item.id,draftPreserved:true,newPosts:0},()=>process.disconnect())
  }else if(mode==='warm'){
    fill();const before=JSON.stringify(store.getDraft()),a=await save()
    assert.ok(JSON.stringify(store.getDraft())===before,'Save keeps Draft')
    const profileA=await client.readDetail(a.result.item.id),recA=await client.readRecommendation(a.result.item.id)
    assert.equal(profileA.state,'READY');assert.equal(recA.state,'READY')
    const strip=value=>{const next=clone(value);delete next.assessmentId;delete next.assessmentCompletedAt;return canonical(next)}
    assert.ok(strip(profileA.profile)===strip(a.projection.profileDisplay),'Profile display pinned')
    assert.ok(strip(recA.display)===strip(a.projection.recommendationDisplay),'Recommendation display pinned')
    assert.equal((await client.confirmNewSession()).state,'EMPTY_CONTEXT');assert.equal(Object.keys(store.getDraft().answers).length,0)
    fill();const b=await save();assert.notEqual(a.result.item.id,b.result.item.id)
    assert.ok(JSON.stringify(await client.readDetail(a.result.item.id))===JSON.stringify(profileA),'Old profile unchanged')
    assert.ok(JSON.stringify(await client.readRecommendation(a.result.item.id))===JSON.stringify(recA),'Old recommendation unchanged')
    store.setAnswer('basic.age',75);const modified=JSON.stringify(store.getDraft());assert.equal((await client.confirmNewSession()).state,'CONFLICT');assert.ok(JSON.stringify(store.getDraft())===modified,'Modified Draft preserved')
    const noNetwork={...transport,environment:()=> 'release',request:async()=>{throw Error('Production cannot request')}}
    const closed=runtime.load(path.join(source,'miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(()=>store,noNetwork)
    assert.equal(await closed.capability(),false)
    assert.equal(runtime.load(path.join(source,'miniprogram/services/recommendation-save-build.ts')).readRecommendationSaveBuildV1(),null)
    process.send({stage:'done',id:b.result.item.id,aToB:true,oldHistoryImmutable:true,productionHidden:true},()=>process.disconnect())
  }
}else{
  const directory=path.resolve('server/target','history-environment-http-'+randomUUID());fs.mkdirSync(directory)
  const launch=(mode,subdir,foreign)=>new Promise((resolve,reject)=>{
    fs.mkdirSync(subdir,{recursive:true});const args=['--child',mode,'--directory',subdir,'--private-config',privateConfig,'--prepared',prepared]
    if(foreign)args.push('--foreign',foreign)
    const child=fork(self,args,{stdio:['ignore','pipe','pipe','ipc']});let result,error=''
    child.stderr.on('data',data=>{error+=data.toString()})
    const timer=setTimeout(()=>{child.kill();reject(Error('Local regression timeout'))},45000)
    child.on('message',message=>{result=message;if(message.stage==='committed')child.kill('SIGKILL')})
    child.on('exit',(code,signal)=>{clearTimeout(timer);if(!result||result.stage!=='committed'&&code!==0)reject(Error('Local child failed: '+error));else resolve({...result,pid:child.pid,signal})})
  })
  const coldDir=path.join(directory,'cold'),killed=await launch('drop',coldDir),recovered=await launch('recover',coldDir)
  assert.notEqual(killed.pid,recovered.pid);assert.ok(killed.signal);assert.equal(recovered.id,killed.id)
  const warm=await launch('warm',path.join(directory,'warm'));await launch('recover',coldDir,warm.id)
  const bad=await fetch('http://127.0.0.1:34579/api/v1/auth/wechat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractVersion:'wechat-authenticated-principal-contract-v1',kind:'wechat_authentication_request_v1',loginCode:randomBytes(32).toString('base64url')})})
  assert.equal(bad.status,200)
  const rejected=await bad.json();assert.equal(rejected.outcome,'INVALID','Foreign/random synthetic ticket refused');assert.equal(rejected.sessionEvidence,null)
  const proof={kind:'history_environment_local_regression_v1',sourceSnapshotId:verifyPreparation(prepared).sourceSnapshotId,environmentId:values['environment.id'],
    previewToHistory:'PASS',sessionAToB:'PASS',coldStart:'PASS',oldPid:killed.pid,newPid:recovered.pid,draftPreserved:true,ownerIsolation:true,foreignTicketRefused:true,productionEntryHidden:true,
    devtoolsFullSave:'NOT_RUN',android17ManualGate:'NOT_RUN',independentAppId:'NOT_AVAILABLE',buildProvenance:'NOT_VERIFIED'}
  fs.writeFileSync(path.join(directory,'LOCAL_REGRESSION.json'),JSON.stringify(proof,null,2),{flag:'wx'})
  console.log(JSON.stringify({localSyntheticRegression:'PASS',evidence:directory,coldDistinctPids:[killed.pid,recovered.pid],deviceAcceptance:false}))
}
