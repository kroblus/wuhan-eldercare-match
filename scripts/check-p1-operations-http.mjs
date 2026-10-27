/** Real loopback HTTP + isolated MySQL, production TS client/page logic, synthetic identities only. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createWechatTsRuntime,loadWechatTypeScript} from './support/load-wechat-ts-runtime.mjs'
const root=process.cwd(),arg=process.argv.indexOf('--synthetic-runtime')
assert.ok(arg>=0&&process.argv[arg+1],'Explicit --synthetic-runtime required')
const file=path.resolve(process.argv[arg+1]);assert.ok(file.toLowerCase().startsWith(path.join(root,'output').toLowerCase()+path.sep))
const settings=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));assert.equal(settings.baseUrl,'http://127.0.0.1:18341');assert.equal(settings.datasetMode,'SYNTHETIC_TEST_ONLY')
const base=settings.baseUrl+'/api/v1/p1-service'
const {ts}=loadWechatTypeScript(),runtime=createWechatTsRuntime(ts,{})
const module=runtime.load(path.join(root,'miniprogram/services/p1-service-client.ts'))
const testOrigin='http://192.168.254.254:18341'
const transport={environment:()=> 'develop',developmentBackendOrigin:()=>testOrigin,login:async()=> 'p1-synthetic-code',request:async req=>{
 assert.ok(req.url.startsWith(testOrigin+'/api/'));const response=await fetch(settings.baseUrl+req.url.slice(testOrigin.length),{method:req.method,headers:req.header,...(req.data?{body:JSON.stringify(req.data)}:{}),signal:AbortSignal.timeout(15000)});return {statusCode:response.status,data:await response.json()}
}}
const client=module.createP1Client(transport,'PRODUCTION'),config=await client.loadConfig();assert.equal(config.enabled,true)
const makeInput=()=>({requestId:randomUUID(),inputVersion:module.P1_VERSION,kind:'VISIT_INTENT',institutionId:'ningyue-yiyang-center',contactName:'合成闭环演示',contactPhone:'13800000000',relationship:'FAMILY',serviceScenario:'SHORT_STAY',preferredWindow:'合成备选窗口，待协商',partySize:2,assistanceNote:null,consentVersion:config.notice.version,consentAccepted:true})
// Exercise the actual Mini Program submit handler, including its pending ID/state guards.
let definition
const pageRuntime=createWechatTsRuntime(ts,{Page:value=>{definition=value},wx:{}}),pageClient=pageRuntime.load(path.join(root,'miniprogram/services/p1-service-client.ts'))
pageClient.p1Client.loadConfig=async()=>config;pageClient.p1Client.submit=value=>client.submit(value);pageClient.p1Client.list=()=>client.list()
pageRuntime.load(path.join(root,'miniprogram/pages/service/intake/index.ts'))
const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(value){Object.assign(this.data,value)}};page.onLoad();await new Promise(resolve=>setImmediate(resolve))
const input=makeInput();page.setData({kindIndex:1,institutionIndex:1,contactName:input.contactName,contactPhone:input.contactPhone,consent:true,partySize:'2',preferredWindow:input.preferredWindow})
await page.submit();assert.equal(page.data.error,'');assert.equal(page.data.pending,false)
const item=page.data.items[0];assert.ok(item);assert.equal(item.status,'PENDING_ARRANGEMENT')
const auth=await fetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-P1-Admin-Request':'1'},body:JSON.stringify({username:settings.adminUsername,password:settings.adminPassword})});assert.equal(auth.status,200)
const cookie=auth.headers.get('set-cookie').split(';')[0],session=await auth.json()
async function admin(route,body,status=200,csrf=true){const response=await fetch(base+'/admin'+route,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',...(csrf?{'X-P1-CSRF':session.csrfToken}:{})}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,status,route);return response.json()}
const follow=result=>({operationId:randomUUID(),result,note:'=合成内部备注，不外发',nextContactAt:null,nextAction:null,feedbackSource:null,institutionId:null})
const first=follow('NO_ANSWER');await admin('/requests/'+item.id+'/followups',first,403,false);await admin('/requests/'+item.id+'/followups',first);await admin('/requests/'+item.id+'/followups',first)
await admin('/requests/'+item.id+'/followups',follow('CONNECTED'));assert.equal((await admin('/requests/'+item.id)).events.length,3)
const start=Date.now()-3*3600000,iso=t=>new Date(t).toISOString(),staff='合成带看-'+randomUUID()
const v={operationId:randomUUID(),visitId:randomUUID(),action:'SAVE_DRAFT',expectedRevision:0,institutionId:input.institutionId,staffId:staff,start:iso(start),end:iso(start+3600000),bufferBefore:0,bufferAfter:30,familyConfirmed:false,institutionConfirmed:false,meetingNote:'合成集合点，非真实院址。请携带饮水，按顾问确认出行。'}
await admin('/requests/'+item.id+'/visits',v)
let own=(await client.list()).find(x=>x.id===item.id);assert.equal(own.visits[0].start,null)
const confirm={...v,operationId:randomUUID(),action:'CONFIRM',expectedRevision:1,familyConfirmed:true,institutionConfirmed:true}
await admin('/requests/'+item.id+'/visits',confirm);await admin('/requests/'+item.id+'/visits',confirm)
const second=await client.submit(makeInput()),conflict={...confirm,operationId:randomUUID(),visitId:randomUUID(),expectedRevision:0}
assert.equal((await admin('/requests/'+second.id+'/visits',conflict,409)).code,'STAFF_CONFLICT')
const reschedule={...confirm,operationId:randomUUID(),action:'RESCHEDULE',expectedRevision:2,start:iso(start+7200000),end:iso(start+10800000)}
await admin('/requests/'+item.id+'/visits',reschedule)
own=(await client.list()).find(x=>x.id===item.id);assert.equal(own.visits[0].start,reschedule.start);assert.equal(own.status,'CONFIRMED')
const another={...confirm,operationId:randomUUID(),visitId:randomUUID(),expectedRevision:0,institutionId:'synthetic-reception-b',start:iso(start+18000000),end:iso(start+21600000)}
await admin('/requests/'+item.id+'/visits',another)
await admin('/requests/'+item.id+'/visits',{operationId:randomUUID(),visitId:another.visitId,action:'CANCEL',expectedRevision:1})
await admin('/requests/'+item.id+'/visits',{operationId:randomUUID(),visitId:v.visitId,action:'ARRIVE',expectedRevision:3,actualAt:iso(start+7500000)})
own=(await client.list()).find(x=>x.id===item.id);assert.equal(own.status,'VISITED');assert.equal(own.canCancel,false);assert.equal(own.visits.filter(v=>v.status==='CANCELLED').length,1)
assert.ok(!JSON.stringify(own).includes('内部备注'));assert.ok(!JSON.stringify(own).includes('staffId'))
assert.equal((await fetch(base+'/requests/'+item.id,{headers:{'X-Auth-Evidence':settings.otherSessionEvidence}})).status,404)
assert.equal((await fetch(base+'/requests/'+item.id+'/cancel',{method:'POST',headers:{'X-Auth-Evidence':settings.ownerSessionEvidence}})).status,409)
await admin('/requests/'+item.id+'/followups',{...follow('MOVED_IN'),feedbackSource:'FAMILY',institutionId:input.institutionId})
const calendar=await admin('/calendar?from='+new Date(start+8*3600000).toISOString().slice(0,10)+'&to='+new Date(start+21600000+8*3600000).toISOString().slice(0,10))
assert.ok(Array.isArray(calendar.capacities));assert.equal(calendar.visits.find(entry=>entry.id===v.visitId).status,'ARRIVED')
assert.equal(module.p1BeijingTime('2026-10-27T16:05:00Z'),'2026-10-28 00:05（北京时间）')
assert.equal(module.p1BeijingTime('2026-12-31T20:00:00Z'),'2027-01-01 04:00（北京时间）')
// Use actual Page handlers for progress refresh and ended-history cancellation guard.
await page.loadMine()
const displayed=page.data.items.find(x=>x.id===item.id);assert.equal(displayed.statusLabel,'已记录到访');assert.match(displayed.visits.find(x=>x.id===v.visitId).startLabel,/北京时间/);assert.equal(displayed.canCancel,false)
let attempted=false;pageClient.p1Client.cancel=()=>{attempted=true;throw Error('must not run')};await page.cancelRequest({currentTarget:{dataset:{id:item.id}}});assert.equal(attempted,false);page.onUnload()
fs.writeFileSync(path.join(root,'output/p1-operations/last-e2e.json'),JSON.stringify({datasetMode:'SYNTHETIC_TEST_ONLY',requestId:item.id,visitId:v.visitId,checks:['actual Page submit + TS client','multiple followups and retry','draft time hidden','confirm','conflict rejected','reschedule','cross institution','cancel one','explicit arrival','source-backed feedback','calendar latest and capacity display','actual page refresh','owner isolation','cancel history denied','Beijing cross day/year'],verifiedAt:new Date().toISOString()},null,2))
if(process.argv.includes('--with-reports')) {
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10)
  const from=new Date(start+7500000+8*3600000).toISOString().slice(0,10)
  // Test rows are actual intent submissions; no fabricated contacts/visits are inserted.
  if(!process.argv.includes('--reuse-report-fixture'))for(let i=0;i<155;i++)await client.submit({...makeInput(),kind:i%2?'CONSULTATION':'VISIT_INTENT',contactName:`合成报表样本${i+1}`})
  const page=await admin('/requests?limit=50&from='+from+'&to='+today)
  const page2=await admin('/requests?limit=50&offset=100&from='+from+'&to='+today)
  assert.ok(page.total>=155);assert.equal(page.items.length,50);assert.ok(page2.items.length>0)
  const report=(await admin('/reports',{from,to:today,institutionId:null,source:null})).report
  assert.equal(report.metrics.newRequests,page.total);assert.equal(report.timeZone,'Asia/Shanghai');assert.match(report.warning,/合成测试/)
  assert.ok(!JSON.stringify(report).includes('13800000000'));assert.ok(!JSON.stringify(report).includes('内部备注'))
  const endpoint=base+'/admin/reports/'+report.snapshotId+'/xlsx'
  assert.equal((await fetch(endpoint)).status,401)
  assert.equal((await fetch(endpoint,{headers:{Cookie:cookie}})).status,403)
  const download=async()=>{const response=await fetch(endpoint,{headers:{Cookie:cookie,'X-P1-CSRF':session.csrfToken}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/);assert.ok(response.headers.get('content-disposition').endsWith('-'+today+'.xlsx"'));return Buffer.from(await response.arrayBuffer())}
  const bytes=await download();assert.equal(bytes.subarray(0,2).toString(),'PK')
  await client.submit(makeInput());const again=await download();assert.deepEqual(again,bytes,'same snapshot export must remain unchanged after new intake')
  fs.writeFileSync(path.join(root,'output/p1-operations/合成机构服务报告.xlsx'),bytes)
  fs.writeFileSync(path.join(root,'output/p1-operations/report-snapshot.json'),JSON.stringify(report,null,2))
  console.log('P1 report real HTTP PASS: 155+ rows, paged list/full aggregation equality, same frozen preview/XLSX after later intake, auth+CSRF, aggregate-only synthetic sample.')
}
await admin('/logout',{})
console.log('P1 scheduling HTTP + actual isolated MySQL + TS client/page PASS: 15 business checks; no real identity provider or phone acceptance claimed.')
