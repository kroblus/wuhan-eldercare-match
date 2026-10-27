/** Explicit opt-in integration with the test-classpath-only loopback server. Never uses production. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createWechatTsRuntime,loadWechatTypeScript} from './support/load-wechat-ts-runtime.mjs'
const root=process.cwd(), arg=process.argv.indexOf('--synthetic-runtime')
assert.ok(arg>=0 && process.argv[arg+1], 'Pass --synthetic-runtime output/p1-1/runtime.private.json explicitly')
const file=path.resolve(process.argv[arg+1])
assert.ok(file.toLowerCase().startsWith(path.join(root,'output').toLowerCase()+path.sep))
const settings=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
assert.equal(settings.baseUrl,'http://127.0.0.1:18341'); assert.equal(settings.datasetMode,'SYNTHETIC_TEST_ONLY')
const {ts}=loadWechatTypeScript(), runtime=createWechatTsRuntime(ts,{})
const {createP1Client,P1_VERSION}=runtime.load(path.join(root,'miniprogram/services/p1-service-client.ts'))
const testOrigin='http://192.168.254.254:18341'
// Only this test transport maps a synthetic develop origin to the loopback fixture.
const transport={environment:()=> 'develop',developmentBackendOrigin:()=>testOrigin,login:async()=> 'p1-synthetic-code',request:async req=>{
  assert.ok(req.url.startsWith(testOrigin+'/api/'))
  const response=await fetch(settings.baseUrl+req.url.slice(testOrigin.length),{method:req.method,headers:req.header,...(req.data?{body:JSON.stringify(req.data)}:{}),signal:AbortSignal.timeout(15000)})
  return {statusCode:response.status,data:await response.json()}
}}
const client=createP1Client(transport,'PRODUCTION'), config=await client.loadConfig()
assert.equal(config.enabled,true); assert.equal(config.datasetMode,'SYNTHETIC_TEST_ONLY')
const input={requestId:randomUUID(),inputVersion:P1_VERSION,kind:'VISIT_INTENT',institutionId:'ningyue-yiyang-center',contactName:'合成联调家庭',contactPhone:'13800000000',relationship:'FAMILY',serviceScenario:'SHORT_STAY',preferredWindow:'合成周六上午\n或周日下午',partySize:2,assistanceNote:'合成轮椅协助',consentVersion:config.notice.version,consentAccepted:true}
const item=await client.submit(input)
assert.equal(item.status,'PENDING_ARRANGEMENT'); assert.equal(item.scheduledStart,null)
assert.equal((await client.submit(input)).id,item.id)
assert.equal((await client.list()).filter(v=>v.id===item.id).length,1)
const login=await fetch(settings.baseUrl+'/api/v1/p1-service/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-P1-Admin-Request':'1'},body:JSON.stringify({username:settings.adminUsername,password:settings.adminPassword})})
assert.equal(login.status,200)
const cookie=login.headers.get('set-cookie').split(';')[0], session=await login.json()
const admin=async route=>{const response=await fetch(settings.baseUrl+'/api/v1/p1-service/admin'+route,{headers:{Cookie:cookie}});assert.equal(response.status,200);return response.json()}
const detail=await admin('/requests/'+item.id)
assert.equal(detail.item.contactName,input.contactName);assert.equal(detail.events.length,1)
const mine=await fetch(settings.baseUrl+'/api/v1/p1-service/requests/'+item.id,{headers:{'X-Auth-Evidence':settings.otherSessionEvidence}})
assert.equal(mine.status,404)
const forbidden=await fetch(settings.baseUrl+'/api/v1/p1-service/admin/requests',{headers:{'X-Auth-Evidence':settings.ownerSessionEvidence}})
assert.equal(forbidden.status,401)
assert.equal((await client.cancel(item.id)).status,'CANCELLED')
const cancelled=await admin('/requests/'+item.id)
assert.equal(cancelled.events.length,2);assert.equal(cancelled.item.status,'CANCELLED')
await client.cancel(item.id);assert.equal((await admin('/requests/'+item.id)).events.length,2)
const logout=await fetch(settings.baseUrl+'/api/v1/p1-service/admin/logout',{method:'POST',headers:{Cookie:cookie,'X-P1-CSRF':session.csrfToken}})
assert.equal(logout.status,200)
// Leave one explicitly synthetic ordinary consultation for the Owner/friend GUI walkthrough.
await client.submit({...input,requestId:randomUUID(),kind:'CONSULTATION',preferredWindow:null,assistanceNote:null})
console.log('P1 HTTP + actual isolated MySQL PASS: existing C5 client -> submit/read -> admin detail -> owner isolation -> cancel/event idempotency -> logout. Only synthetic records created; no real WeChat provider tested.')
