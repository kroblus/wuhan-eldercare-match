/** Actual HTTP + C5 sessions + disposable MySQL + production frontend client. TEST_ONLY. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL, 'true', 'explicit isolated marker required')
const { ts } = loadWechatTypeScript()
const runtime = createWechatTsRuntime(ts)
const { createCompletedAssessmentHistoryClientV1 } = runtime.load(path.resolve('miniprogram/services/completed-assessment-history.ts'))
const { createC5AuthenticatedBackendSessionClientV1, createC5AuthenticatedJsonHeadersV1 } = runtime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
const { createHistoryViewModel } = runtime.load(path.resolve('miniprogram/pages/assessment/history-view-model.ts'))
const guardMode = process.argv.includes('--intent-resource-guard')
const primaryPort = guardMode ? 34481 : 34479
const runId = randomUUID()
const requests = []
const request = async input => {
  const url = new URL(input.url)
  assert.equal(url.hostname, 'history-e2e.local')
  assert.ok(['34479', '34480', '34481'].includes(url.port))
  url.hostname = '127.0.0.1' // TEST transport routing only; no production DNS override.
  requests.push({ method: input.method, pathname: url.pathname })
  const response = await fetch(url, { method: input.method, headers: { 'Content-Type': 'application/json', ...input.header },
    body: input.data === undefined ? undefined : JSON.stringify(input.data), signal: AbortSignal.timeout(15000) })
  return { statusCode: response.status, data: await response.json() }
}
const transport = (account, port = primaryPort) => ({ environment: () => 'develop', developmentBackendOrigin: () => `http://history-e2e.local:${port}`,
  login: async () => `TEST_ONLY_LOGIN_${account}_${runId}`, request })
const a = transport('A'), b = transport('B'), c = transport('C')
const session = async tr => {
  const client = createC5AuthenticatedBackendSessionClientV1(tr)
  const result = await client.acquireSession(client.resolveBackendOrigin())
  assert.equal(result.kind, 'authenticated')
  return result.session
}
const as = await session(a), bs = await session(b), cs = await session(c)
const endpoint = (s, pathname, method = 'GET', data) => request({ url: s.origin + pathname, method, header: createC5AuthenticatedJsonHeadersV1(s), data })
const provider = createCompletedAssessmentHistoryClientV1(a)
if (process.argv.includes('--test-only-read-visual-patch')) {
  const result = await provider.readPage()
  assert.equal(result.state, 'READY')
  assert.ok(result.records.length)
  console.log(JSON.stringify({ ...createHistoryViewModel({ ...result, records: result.records.slice(0, 3) }), historyLoading: false, hasMore: false }))
  process.exit(0)
}
const elder = async s => {
  const result = await endpoint(s, '/api/v1/elder-record', 'POST')
  assert.equal(result.statusCode, 200); assert.equal(result.data.authResolution, 'authenticated')
  assert.ok(result.data.elderId)
  return result.data.elderId
}
const elderA = await elder(as), elderB = await elder(bs)
if (guardMode) {
  const previous=new Map(), preparedBySession=new Map()
  const answers=JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json','utf8'))
  const saveFixture=async(s,v)=>endpoint(s,'/api/v1/completed-assessments','POST',{kind:'completed_assessment_save_request_v1',intent:'SAVE_COMPLETED_ASSESSMENT',assessmentContractVersion:'assessment-schema-v2',
    schemaVersion:2,elderId:s===as?elderA:elderB,idempotencyKey:`recover_${v.intentId}`,answers})
  const prepare = async s => {
    const prior=previous.get(s)
    if(prior) assert.ok([200,201].includes((await saveFixture(s,preparedBySession.get(prior))).statusCode))
    const r=await endpoint(s,'/api/v1/completed-assessments/assessment-sessions/'+(prior?'new':'register'),'POST',prior
      ? {intent:'CONFIRMED_NEW_ASSESSMENT',fromSessionId:prior,draftContext:'test_'+randomUUID()} : {intent:'REGISTER_CURRENT_ASSESSMENT',draftContext:'test_'+randomUUID()})
    if(r.statusCode!==200)return r
    const v=await endpoint(s,'/api/v1/completed-assessments/save-intents','POST',{sessionId:r.data.sessionId})
    if(v.statusCode===200){previous.set(s,r.data.sessionId);preparedBySession.set(r.data.sessionId,v.data)}return v
  }
  const reconcile = (s,r) => endpoint(s, '/api/v1/completed-assessments/save-intents/reconcile', 'POST', {scopeId:r.scopeId,intentId:r.intentId})
  const first = await prepare(as)
  assert.equal((await reconcile(as,first.data)).data.state,'PENDING_OR_UNCERTAIN')
  const second = await prepare(as)
  assert.equal(first.statusCode,200);assert.equal(second.statusCode,200)
  const refused = await prepare(as);assert.equal(refused.statusCode,429);assert.equal(refused.data.code,'INTENT_CREATE_LIMITED')
  assert.deepEqual(Object.keys(refused.data).sort(),['contractVersion','kind','availability','code'].sort())
  assert.equal((await reconcile(as,first.data)).data.state,'CONFIRMED')
  const original={kind:'completed_assessment_save_request_v1',intent:'SAVE_COMPLETED_ASSESSMENT',assessmentContractVersion:'assessment-schema-v2',
    schemaVersion:2,elderId:elderA,idempotencyKey:`recover_${first.data.intentId}`,answers}
  const saved=await endpoint(as,'/api/v1/completed-assessments','POST',original);assert.equal(saved.statusCode,200);assert.equal(saved.data.availability,'replayed')
  assert.equal((await endpoint(as,'/api/v1/completed-assessments','POST',original)).data.item.id,saved.data.item.id)
  assert.equal((await reconcile(as,first.data)).data.item.id,saved.data.item.id)
  assert.equal((await prepare(bs)).statusCode,200,'another account has independent capacity')
  const foreign=await reconcile(bs,first.data),missing=await reconcile(bs,{...first.data,intentId:randomUUID()})
  assert.equal(foreign.statusCode,404);assert.deepEqual(foreign,missing)
  await new Promise(resolve=>setTimeout(resolve,5100))
  assert.equal((await prepare(as)).statusCode,200);assert.equal((await prepare(as)).statusCode,200)
  assert.equal((await prepare(as)).statusCode,429,'total cap survives burst window')
  await new Promise(resolve=>setTimeout(resolve,5100))
  assert.equal((await prepare(as)).statusCode,429,'no automatic expiry/deletion to recover capacity')
  assert.equal((await reconcile(as,second.data)).data.state,'CONFIRMED')
  assert.equal((await reconcile(as,first.data)).data.state,'CONFIRMED')
  assert.equal((await provider.readPage()).records.length,4)
  assert.equal((await endpoint(as,`/api/v1/completed-assessments/${saved.data.item.id}`)).data.profileAvailability,'ready')
  assert.equal((await endpoint(as,`/api/v1/completed-assessments/${saved.data.item.id}/recommendation`)).data.availability,'ready')
  console.log('PASS: actual HTTP TEST_ONLY burst/total resource limits; owner isolation; existing pending/confirmed intent reconciliation and immutable Profile/Recommendation remain accessible')
  process.exit(0)
}
assert.equal(createHistoryViewModel(await provider.readPage()).historyState, 'EMPTY')
const answers = JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json', 'utf8'))
const keys = new Map()
let lastSession
const body = async logical => {
  if (!keys.has(logical)) {
    const context='test_'+randomUUID(), deadline=Date.now()+90000
    let r
    do { r=await endpoint(as,'/api/v1/completed-assessments/assessment-sessions/'+(lastSession?'new':'register'),'POST',lastSession
      ? {intent:'CONFIRMED_NEW_ASSESSMENT',draftContext:context,fromSessionId:lastSession} : {intent:'REGISTER_CURRENT_ASSESSMENT',draftContext:context})
      if(r.statusCode===429){assert.ok(Date.now()<deadline,'bounded fixture seeding must respect the real resource window');await new Promise(resolve=>setTimeout(resolve,1000))}
    } while(r.statusCode===429)
    assert.equal(r.statusCode,200)
    let prepared
    do { prepared=await endpoint(as,'/api/v1/completed-assessments/save-intents','POST',{sessionId:r.data.sessionId})
      if(prepared.statusCode===429){assert.ok(Date.now()<deadline);await new Promise(resolve=>setTimeout(resolve,1000))}
    } while(prepared.statusCode===429)
    assert.equal(prepared.statusCode,200);keys.set(logical,'recover_'+prepared.data.intentId);lastSession=r.data.sessionId
  }
  return {kind:'completed_assessment_save_request_v1',intent:'SAVE_COMPLETED_ASSESSMENT',assessmentContractVersion:'assessment-schema-v2',schemaVersion:2,elderId:elderA,idempotencyKey:keys.get(logical),answers}
}
const key = 'TEST_ONLY_' + randomUUID()
const before = Date.now()
const created = await endpoint(as, '/api/v1/completed-assessments', 'POST', await body(key))
assert.equal(created.statusCode, 201); assert.equal(created.data.availability, 'created')
assert.match(created.data.item.id, /^[0-9a-f-]{36}$/)
assert.ok(Date.parse(created.data.item.completedAt) >= before - 1000)
assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', await body(key))).data.item.id, created.data.item.id)
assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', { ...await body(key), answers: { ...answers, 'basic.age': 73 } })).statusCode, 409)
assert.equal((await endpoint(bs, '/api/v1/completed-assessments', 'POST', await body(key))).statusCode, 403)
assert.equal((await endpoint(cs, '/api/v1/completed-assessments')).statusCode, 403, 'unbound must not be EMPTY')
assert.equal((await request({ url: as.origin + '/api/v1/completed-assessments', method: 'GET', header: {} })).statusCode, 401)
assert.equal((await request({ url: as.origin + '/api/v1/completed-assessments', method: 'POST', header: {}, data: await body(key) })).statusCode, 401)
assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', { ...await body(key), ownerUserId: 'forged', completedAt: 'client' })).statusCode, 400)
assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', { kind: 'assessment_draft', answers })).statusCode, 400)
assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', { ...await body(key), schemaVersion: 1 })).statusCode, 400)
for (let i = 0; i < 20; i++) assert.equal((await endpoint(as, '/api/v1/completed-assessments', 'POST', await body('TEST_ONLY_PAGE_' + i + '_' + key))).statusCode, 201)
const first = await provider.readPage()
assert.equal(first.state, 'READY'); assert.equal(first.records.length, 20); assert.ok(first.nextCursor)
const next = await provider.readPage(first.nextCursor)
assert.equal(next.state, 'READY'); assert.equal(next.records.length, 1); assert.equal(next.nextCursor, null)
assert.equal(new Set([...first.records, ...next.records].map(row => row.id)).size, 21)
assert.equal(createHistoryViewModel(first).historyState, 'READY')
assert.match(createHistoryViewModel(first).records[0].sourceLabel, /隔离环境已保存/)
assert.equal((await endpoint(bs, '/api/v1/completed-assessments?cursor=' + first.nextCursor)).statusCode, 400)
assert.equal(createHistoryViewModel(await createCompletedAssessmentHistoryClientV1(b).readPage()).historyState, 'EMPTY')
const listJson = JSON.stringify(first)
for (const field of ['health.', 'answers', 'ownerUserId', 'elderId', 'idempotencyKey']) assert.ok(!listJson.includes(field))
const disabled = await session(transport('A', 34480))
assert.equal((await endpoint(disabled, '/api/v1/completed-assessments?productionWriteEnabled=true', 'POST', await body(key))).statusCode, 503)
assert.equal((await createCompletedAssessmentHistoryClientV1(transport('A', 34480)).readPage()).state, 'UNAVAILABLE')
// No change to the local Draft/Profile/Recommendation graph is needed to read HTTP history.
assert.ok(!requests.some(row => /profile|recommendation/.test(row.pathname)))
if (process.argv.includes('--test-only-visual-patch')) console.log(JSON.stringify({ ...createHistoryViewModel(first), historyLoading: false, hasMore: false }))
console.log('PASS: real synthetic HTTP -> C5 server session -> Elder binding -> shared validator -> MySQL snapshot -> owner metadata -> production frontend History Provider')
console.log('PASS: owner isolation, unbound/unauthenticated, idempotency/conflict, bounded cursor, redacted list, disabled-server write firewall')
