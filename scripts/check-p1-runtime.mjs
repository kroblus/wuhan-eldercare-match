import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const root=process.cwd(), {ts}=loadWechatTypeScript()
const runtime=createWechatTsRuntime(ts,{})
const clientModule=runtime.load(path.join(root,'miniprogram/services/p1-service-client.ts'))
const prices=runtime.load(path.join(root,'miniprogram/content/p1-public-institution.ts')).p1Institution
assert.deepEqual(Array.from(prices.prices,x=>x.total),[3600,4200,5100,6300,7200])
for(const row of prices.prices) assert.equal(row.total,row.bed+row.care+row.food)
assert.match(prices.otherFees,/医疗备用金 5000/); assert.match(prices.otherFees,/床品 900/)
const VERSION=clientModule.P1_VERSION, mode='SYNTHETIC_TEST_ONLY'
const input={requestId:'ca2a0bb3-b9bd-4418-80b6-c689563f73f2',inputVersion:VERSION,kind:'VISIT_INTENT',institutionId:prices.id,contactName:'合成联系人',contactPhone:'13800000000',relationship:'FAMILY',serviceScenario:'SHORT_STAY',preferredWindow:'周六上午或周二下午',partySize:2,assistanceNote:null,consentVersion:'p1-test',consentAccepted:true}
const item={...input,id:input.requestId,institutionName:prices.name,status:'PENDING_ARRANGEMENT',createdAt:'2026-10-28T02:00:00Z',updatedAt:'2026-10-28T02:00:00Z',datasetMode:mode,source:mode,assignedTo:null,scheduledStart:null,scheduledEnd:null}
const config={contractVersion:VERSION,enabled:true,datasetMode:mode,platformContact:{label:'平台咨询',phone:null},notice:{version:'p1-test',text:'合成测试告知，不输入真实个人资料'}}
let calls=[], origin='http://192.168.7.8:18341',environment='develop', replyItem=item, failSubmit=false, unauthorized=false
const transport={environment:()=>environment,developmentBackendOrigin:()=>origin,login:async()=>'synthetic-code',request:async request=>{
  calls.push(request)
  if(request.url.endsWith('/config')) return {statusCode:200,data:config}
  if(request.url.endsWith('/auth/wechat')) return {statusCode:200,data:{contractVersion:'wechat-authenticated-principal-contract-v1',kind:'wechat_authentication_result_v1',outcome:'AUTHENTICATED',code:'AUTHENTICATED',sessionEvidence:'synthetic-evidence',expiresAt:new Date(Date.now()+3600000).toISOString()}}
  if(unauthorized) return {statusCode:401,data:{}}
  if(request.method==='POST'&&failSubmit) throw Error('synthetic timeout')
  return {statusCode:200,data:{contractVersion:VERSION,item:replyItem,items:[replyItem]}}
}}
const demo=clientModule.createP1Client(transport,'MOCK_DEVELOPMENT_ONLY')
assert.equal(await demo.loadConfig(),null); assert.equal(calls.length,0)
await assert.rejects(demo.submit(input)); assert.equal(calls.length,0)
const client=clientModule.createP1Client(transport,'PRODUCTION')
await client.loadConfig()
assert.equal((await client.submit(input)).status,'PENDING_ARRANGEMENT')
assert.equal(calls.filter(c=>c.url.endsWith('/auth/wechat')).length,1)
assert.equal((await client.list()).length,1)
assert.equal(calls.filter(c=>c.url.endsWith('/auth/wechat')).length,1)
replyItem={...item,status:'CANCELLED'}
assert.equal((await client.cancel(item.id)).status,'CANCELLED')
await assert.rejects(client.cancel('../other'))
replyItem={...item,datasetMode:'PRODUCTION'}; await assert.rejects(client.list(),/INVALID_RESPONSE/)
replyItem={...item,id:'bad'}; await assert.rejects(client.list(),/INVALID_RESPONSE/)
replyItem={...item,id:'ca2a0bb3-b9bd-4418-80b6-c689563f73f3'}; await assert.rejects(client.submit(input),/INVALID_RESPONSE/)
replyItem=item; unauthorized=true; await assert.rejects(client.list(),/HTTP_401/); unauthorized=false
await client.list(); assert.equal(calls.filter(c=>c.url.endsWith('/auth/wechat')).length,2)
failSubmit=true; await assert.rejects(client.submit(input)); failSubmit=false
await client.submit(input)
const submissions=calls.filter(c=>c.method==='POST'&&c.url.endsWith('/requests'))
assert.deepEqual(submissions.at(-2).data,submissions.at(-1).data)
origin='http://192.168.7.9:18341'; const previous=calls.length; await assert.rejects(client.list(),/UNAVAILABLE/); assert.equal(calls.length,previous)
environment='release'; assert.equal(await client.loadConfig(),null)
assert.notEqual(clientModule.validateP1Input({...input,consentAccepted:false}),'')
assert.notEqual(clientModule.validateP1Input({...input,contactPhone:'123'}),'')
assert.notEqual(clientModule.validateP1Input({...input,partySize:0}),'')
assert.notEqual(clientModule.validateP1Input({...input,assistanceNote:'字'.repeat(201)}),'')

// Page behavior: an unresolved submission retains identity, double clicks coalesce, unload blocks stale UI.
let definition
const pageRuntime=createWechatTsRuntime(ts,{Page:value=>{definition=value},wx:{}})
const pageClient=pageRuntime.load(path.join(root,'miniprogram/services/p1-service-client.ts'))
pageClient.p1Client.loadConfig=async()=>config
pageRuntime.load(path.join(root,'miniprogram/pages/service/intake/index.ts'))
const page=()=>{ const p={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(value){Object.assign(this.data,value)}}; p.onLoad(); return p }
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const p=page(); await tick()
p.setData({kindIndex:1,institutionIndex:1,contactName:'合成联系人',contactPhone:'13800000000',consent:true})
let submitted=[],rejectSubmit,resolveSubmit
pageClient.p1Client.submit=value=>{submitted.push(JSON.parse(JSON.stringify(value)));return new Promise((resolve,reject)=>{resolveSubmit=resolve;rejectSubmit=reject})}
const first=p.submit(); await p.submit(); assert.equal(submitted.length,1)
rejectSubmit(Error('timeout')); await first
assert.equal(p.data.pending,true); assert.equal(p.data.contactName,'合成联系人')
p.editText({currentTarget:{dataset:{field:'contactName'}},detail:{value:'changed'}}); assert.equal(p.data.contactName,'合成联系人')
const retry=p.submit(); assert.deepEqual(submitted[0],submitted[1]); resolveSubmit({...item,id:submitted[1].requestId}); await retry
assert.equal(p.data.pending,false); assert.match(p.data.feedback,/待顾问联系/); assert.equal(p.data.contactPhone,'')
pageClient.p1Client.list=async()=>{throw Error('unavailable')}; await p.loadMine(); assert.equal(p.data.listLoaded,false); assert.match(p.data.listError,/不表示没有/)
p.setData({contactName:'合成联系人',contactPhone:'13800000000',consent:true})
const delayed=p.submit(); p.onUnload(); p.setData({feedback:'unloaded'}); resolveSubmit({...item,id:submitted.at(-1).requestId}); await delayed
assert.equal(p.data.feedback,'unloaded')
let resolveList
pageClient.p1Client.list=()=>new Promise(resolve=>{resolveList=resolve})
const restored=page(); await tick(); const listing=restored.loadMine(); restored.onUnload(); resolveList([item]); await listing; assert.equal(restored.data.items.length,0)
const script=fs.readFileSync(path.join(root,'admin-web/app.js'),'utf8')
assert.ok(!script.includes('innerHTML')); assert.ok(!script.includes('localStorage')); assert.ok(!script.includes('setInterval'))
console.log('P1: five-grade sums, mode isolation, response identity, C5 recovery, permissions failures, consent, same-ID retry, double submit, unload guard and safe admin rendering PASS')
const visit={id:'18552c03-fdb2-4db4-a8b2-937079f890c8',status:'CONFIRMED',institutionId:prices.id,institutionName:prices.name,start:'2026-10-27T16:00:00Z',end:'2026-10-27T17:00:00Z',meetingNote:'合成集合说明',actualAt:null}
assert.equal(clientModule.readP1Item({...item,status:'CONFIRMED',visits:[visit],canCancel:true},mode).visits.length,1)
assert.throws(()=>clientModule.readP1Item({...item,status:'CONFIRMED',visits:[]},mode))
assert.throws(()=>clientModule.readP1Item({...item,visits:[{...visit,status:'DRAFT'}]},mode))
assert.throws(()=>clientModule.readP1Item({...item,status:'VISITED',visits:[{...visit,status:'ARRIVED',actualAt:visit.start}],canCancel:true},mode))
assert.throws(()=>clientModule.readP1Item({...item,visits:[visit,{...visit}]},mode))
assert.equal(clientModule.p1BeijingTime('2026-10-27T16:05:00Z'),'2026-10-28 00:05（北京时间）')
assert.equal(clientModule.p1BeijingTime('2026-12-31T20:00:00Z'),'2027-01-01 04:00（北京时间）')
console.log('P1 progress: confirmed/draft/outcome boundaries, duplicate visit IDs, cancellation protection and Beijing day/year rollover PASS')
