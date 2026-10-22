/** TEST_ONLY: kill one real Node process; recover in another from metadata + existing Draft storage. */
import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL, 'true')
const self = fileURLToPath(import.meta.url), { ts } = loadWechatTypeScript()
const key = '__test_only_history_save_recovery_v1'
const answers = JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json', 'utf8'))
const clone = v => JSON.parse(JSON.stringify(v))
const confirmedSave = async client => {
  if(process.env.HISTORY_TRUSTED_PREVIEW==='true'){
    const candidate=await client.createTrustedPreview();if(candidate.state!=='READY')return candidate
    const prepared=await client.requestTrustedSaveConfirmation();return prepared.state==='CONFIRM'?client.saveCurrent(prepared.confirmation):prepared
  }
  const prepared=await client.requestSaveConfirmation();return prepared.state==='CONFIRM' ? client.saveCurrent(prepared.confirmation) : prepared
}
const runId = process.env.HISTORY_SYNTHETIC_ACCOUNT_RUN || (process.env.HISTORY_SYNTHETIC_ACCOUNT_RUN = randomUUID())
if (process.argv.includes('--child')) {
  const [directory, mode, account, port] = process.argv.slice(3)
  const draftFile = path.join(directory, 'existing-draft-storage.json'), recoveryFile = path.join(directory, 'minimal-recovery.json')
  const storage = existsSync(draftFile) ? JSON.parse(readFileSync(draftFile, 'utf8')) : {}
  let posts = 0, reconcilePosts = 0, preparePosts = 0, draftWrites = 0, scopes = 0
  const runtime = createWechatTsRuntime(ts, { wx: {
    getStorageSync: k => k === key ? (mode === 'readback-fails' ? '' : existsSync(recoveryFile) ? JSON.parse(readFileSync(recoveryFile, 'utf8')) : '') : clone(storage[k] ?? ''),
    setStorageSync: (k, value) => {
      if (k === key) {
        if (mode === 'write-fails') throw new Error('TEST_ONLY storage failure')
        writeFileSync(recoveryFile, JSON.stringify(value))
      } else { if (!k.startsWith('__test_only_history_')) draftWrites++; storage[k] = clone(value); writeFileSync(draftFile, JSON.stringify(storage)) }
    },
    removeStorageSync() { throw new Error('must not remove Draft/recovery') },
  } })
  const store = runtime.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
  if (!existsSync(draftFile)) for (const [k, v] of Object.entries(answers)) assert.equal(store.setAnswer(k, clone(v)).persistence.ok, true)
  if (mode === 'changed-draft') assert.equal(store.setAnswer('basic.age', 75).persistence.ok, true)
  const before = JSON.stringify(store.getDraft()), writesBefore = draftWrites
  const client = runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(() => store, {
    environment: () => mode === 'production' ? 'release' : 'develop',
    developmentBackendOrigin: () => `http://history-e2e.local:${port}`, login: async () => `TEST_ONLY_LOGIN_${account}_${runId}`,
    async request(input) {
      const url = new URL(input.url); url.hostname = '127.0.0.1'
      const save = input.method === 'POST' && url.pathname === '/api/v1/completed-assessments'
      if (url.pathname.endsWith('/scope')) scopes++
      if (url.pathname.endsWith('/save-intents') && input.method === 'POST') preparePosts++
      if (url.pathname.endsWith('/reconcile')) {
        reconcilePosts++
        if (mode === 'query-fails') throw new Error('TEST_ONLY network failure')
      }
      if (save) {
        posts++
        assert.ok(existsSync(recoveryFile), 'intent must be persisted BEFORE payload POST')
        const record = JSON.parse(readFileSync(recoveryFile, 'utf8')); assert.equal(input.data.idempotencyKey, `recover_${record.intentId}`)
        if (mode === 'hold-original') { process.send({ stage: 'held', record, originalBody:clone(input.data) }); await new Promise(() => {}) }
      }
      const response = await fetch(url, { method: input.method, headers: { 'Content-Type': 'application/json', ...input.header },
        body: input.data === undefined ? undefined : JSON.stringify(input.data), signal: AbortSignal.timeout(15000) })
      const data = await response.json()
      if (url.pathname.endsWith('/assessment-sessions/new') && mode === 'drop-new-response') {
        const persisted=JSON.parse(readFileSync(draftFile,'utf8')).__test_only_history_session_v1
        assert.equal(persisted.state,'switch_requested');assert.equal(persisted.nextDraftContext,input.data.draftContext)
        assert.equal(response.status,200);process.send({stage:'new-committed-no-receipt',item:data});await new Promise(()=>{})
      }
      if (save && mode === 'drop-response') {
        assert.equal(response.status, 201)
        process.send({ stage: 'committed-no-receipt', item: data.item }); await new Promise(() => {})
      }
      return { statusCode: response.status, data }
    },
  })
  const recovered = mode === 'drop-new-response' || mode === 'drop-response' || mode === 'hold-original' || mode === 'write-fails' || mode === 'normal-save' || mode === 'readback-fails'
    ? await confirmedSave(client) : await client.recoverPending()
  if(mode === 'drop-new-response'){assert.equal(recovered.state,'SUCCESS');await client.confirmNewSession();throw new Error('must kill before new receipt')}
  const coldLifecycle = ['recover','changed-draft'].includes(mode) ? await client.lifecycle() : null
  const second = ['recover', 'pending', 'changed-draft', 'wrong-account', 'query-fails', 'damaged', 'copied', 'production', 'disabled', 'invalid-login','tampered'].includes(mode)
    ? await confirmedSave(client) : null
  assert.equal(JSON.stringify(store.getDraft()), before); assert.equal(draftWrites, writesBefore)
  process.send({ stage: 'done', recovered, coldLifecycle, second, posts, reconcilePosts, preparePosts, scopes, draftPreserved: true }, () => { process.disconnect(); process.exitCode = 0 })
} else {
  const root = path.resolve('server/target', `history-cold-process-${randomUUID()}`); mkdirSync(root)
  const launch = (dir, mode, account = 'A', port = 34479, stopAt) => new Promise((resolve, reject) => {
    const child = fork(self, ['--child', dir, mode, account, String(port)], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    let error = '', result
    child.stderr.on('data', d => { error += d.toString() })
    const timer = setTimeout(() => { child.kill(); reject(new Error(`child timeout ${mode}`)) }, 45000)
    child.on('message', message => { if (message.stage === (stopAt || 'done')) { result = message; if (stopAt) child.kill('SIGKILL') } })
    child.on('exit', (code, signal) => { clearTimeout(timer); if (!result || (!stopAt && code !== 0)) reject(new Error(`child failed ${mode}: ${error}`)); else resolve({ ...result, pid: child.pid, signal }) })
  })
  // Reuse the existing C5 transport rather than invent its DTO shape for HTTP assertions.
  const clientRuntime = createWechatTsRuntime(ts)
  const c5 = clientRuntime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
  const session = await c5.createC5AuthenticatedBackendSessionClientV1({ environment: () => 'develop', developmentBackendOrigin: () => 'http://history-e2e.local:34479',
    login: async () => `TEST_ONLY_LOGIN_A_${runId}`, request: async input => { const u = new URL(input.url); u.hostname = '127.0.0.1'; const r = await fetch(u, { method: input.method,
      headers: input.header, body: input.data && JSON.stringify(input.data) }); return { statusCode: r.status, data: await r.json() } },
  }).acquireSession('http://history-e2e.local:34479')
  assert.equal(session.kind, 'authenticated'); const headers = { 'Content-Type': 'application/json', ...c5.createC5AuthenticatedJsonHeadersV1(session.session) }
  assert.equal((await fetch('http://127.0.0.1:34479/api/v1/elder-record',{method:'POST',headers})).status,200)
  const provision = async (dir, previous, currentHeaders = headers) => {
    const storage={}; const rt=createWechatTsRuntime(ts,{wx:{getStorageSync:k=>clone(storage[k]??''),setStorageSync:(k,v)=>{storage[k]=clone(v)}}})
    const st=rt.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
    for(const [k,v] of Object.entries(answers)) assert.equal(st.setAnswer(k,clone(v)).persistence.ok,true)
    const r=await fetch('http://127.0.0.1:34479/api/v1/completed-assessments/assessment-sessions/new',{method:'POST',headers:{'Content-Type':'application/json',...currentHeaders},body:JSON.stringify({
      intent:'CONFIRMED_NEW_ASSESSMENT',fromSessionId:previous.sessionId,draftContext:st.getDraft().localDraftId})})
    assert.equal(r.status,200);const v=await r.json()
    storage.__test_only_history_session_v1={version:1,origin:'http://history-e2e.local:34479',scopeId:v.scopeId,sessionId:v.sessionId,draftContext:v.draftContext,state:'active'}
    writeFileSync(path.join(dir,'existing-draft-storage.json'),JSON.stringify(storage));return storage
  }
  const list = async () => { const r = await fetch('http://127.0.0.1:34479/api/v1/completed-assessments?limit=50', { headers }); return (await r.json()).items }
  const initial = await list(), dir = path.join(root, 'lost-receipt'); mkdirSync(dir)
  const killed = await launch(dir, 'drop-response', 'A', 34479, 'committed-no-receipt')
  const draft = readFileSync(path.join(dir, 'existing-draft-storage.json'), 'utf8')
  const record = JSON.parse(readFileSync(path.join(dir, 'minimal-recovery.json'), 'utf8'))
  assert.deepEqual(Object.keys(record).sort(), ['version','origin','scopeId','intentId','createdAt','draftContext','state'].sort())
  assert.equal(record.state, 'pending'); assert.equal(record.version, 1)
  assert.match(record.intentId, /^[0-9a-f-]{14}4[0-9a-f-]{21}$/)
  const recovered = await launch(dir, 'recover'); assert.notEqual(killed.pid, recovered.pid); assert.ok(killed.signal)
  assert.equal(recovered.recovered.state, 'SUCCESS'); assert.equal(recovered.recovered.item.id, killed.item.id)
  assert.equal(recovered.coldLifecycle.state, 'RECOVERY_REQUIRED'); assert.equal(recovered.posts, 0); assert.equal(recovered.preparePosts, 0)
  assert.equal(readFileSync(path.join(dir, 'existing-draft-storage.json'), 'utf8'), draft)
  assert.equal((await list()).length, initial.length + 1)
  for (const [mode, account, port] of [['wrong-account','B',34479],['invalid-login','INVALID',34479],['query-fails','A',34479],['production','A',34479],['disabled','A',34480]]) {
    const r = await launch(dir, mode, account, port); assert.equal(r.posts, 0);assert.equal(r.preparePosts, 0)
    if (mode === 'wrong-account') assert.equal(r.reconcilePosts, 0, 'do not send old intent to a new principal scope')
  }
  const changed = await launch(dir, 'changed-draft'); assert.equal(changed.posts, 0);assert.equal(changed.recovered.item.id, killed.item.id)
  const bad = path.join(root, 'damaged');mkdirSync(bad);writeFileSync(path.join(bad,'minimal-recovery.json'), JSON.stringify({ ...record, answers: 'forbidden' }))
  const damaged = await launch(bad, 'damaged');assert.equal(damaged.posts,0);assert.equal(damaged.preparePosts,0);assert.equal(damaged.reconcilePosts,0)
  const copied = path.join(root,'copied');mkdirSync(copied);writeFileSync(path.join(copied,'minimal-recovery.json'),JSON.stringify(record))
  assert.equal((await launch(copied,'copied','B')).reconcilePosts,0)
  const pendingDir=path.join(root,'uncertain');mkdirSync(pendingDir)
  await provision(pendingDir,JSON.parse(draft).__test_only_history_session_v1)
  const held=await launch(pendingDir,'hold-original','A',34479,'held')
  const pending=await launch(pendingDir,'pending');assert.equal(pending.recovered.state,'ERROR');assert.equal(pending.posts,0);assert.equal(pending.preparePosts,0)
  assert.equal((await list()).length, initial.length+1)
  // Deliver the original, delayed synthetic request after recovery; same key, original fixture only.
  const elderResponse=await fetch('http://127.0.0.1:34479/api/v1/elder-record',{headers});const elder=await elderResponse.json()
  const delayed=await fetch('http://127.0.0.1:34479/api/v1/completed-assessments',{method:'POST',headers,body:JSON.stringify(held.originalBody || {
    kind:'completed_assessment_save_request_v1',intent:'SAVE_COMPLETED_ASSESSMENT',assessmentContractVersion:'assessment-schema-v2',schemaVersion:2,
    elderId:elder.elderId,idempotencyKey:`recover_${held.record.intentId}`,answers,
  })});assert.equal(delayed.status,201)
  const delayedItem=(await delayed.json()).item
  const later=await launch(pendingDir,'recover');assert.equal(later.posts,0);assert.equal(later.recovered.item.id,delayedItem.id)
  const failureDir=path.join(root,'write-failure');mkdirSync(failureDir)
  const nextStorage=await provision(failureDir,JSON.parse(readFileSync(path.join(pendingDir,'existing-draft-storage.json'),'utf8')).__test_only_history_session_v1)
  const failure=await launch(failureDir,'write-fails');assert.equal(failure.posts,0);assert.equal(failure.recovered.state,'ERROR')
  const readbackDir=path.join(root,'readback-failure');mkdirSync(readbackDir)
  writeFileSync(path.join(readbackDir,'existing-draft-storage.json'),JSON.stringify(nextStorage))
  const readback=await launch(readbackDir,'readback-fails');assert.equal(readback.posts,0);assert.equal(readback.recovered.state,'ERROR')
  const tamperedDir=path.join(root,'tampered');mkdirSync(tamperedDir);writeFileSync(path.join(tamperedDir,'minimal-recovery.json'),JSON.stringify({...record,intentId:randomUUID()}))
  const tampered=await launch(tamperedDir,'tampered');assert.equal(tampered.posts,0);assert.equal(tampered.preparePosts,0);assert.equal(tampered.recovered.state,'ERROR')
  assert.equal((await list()).length,initial.length+2)
  const normalDir=path.join(root,'normal');mkdirSync(normalDir)
  const bt={environment:()=> 'develop',developmentBackendOrigin:()=> 'http://history-e2e.local:34479',login:async()=>`TEST_ONLY_LOGIN_B_${runId}`,
    request:async input=>{const u=new URL(input.url);u.hostname='127.0.0.1';const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data)});return {statusCode:r.status,data:await r.json()}}}
  const bs=await c5.createC5AuthenticatedBackendSessionClientV1(bt).acquireSession(bt.developmentBackendOrigin());assert.equal(bs.kind,'authenticated')
  const bh=c5.createC5AuthenticatedJsonHeadersV1(bs.session)
  assert.equal((await bt.request({url:bs.session.origin+'/api/v1/elder-record',method:'POST',header:bh})).statusCode,200)
  const normal=await launch(normalDir,'normal-save','B');assert.equal(normal.posts,1);assert.equal(normal.recovered.state,'SUCCESS')
  assert.equal((await launch(normalDir,'recover','B')).posts,0)
  // Same runtime, concurrent clients and account change while A's acknowledgment is in flight.
  const raceDir=path.join(root,'race');mkdirSync(raceDir)
  const raceStorage = await provision(raceDir,JSON.parse(readFileSync(path.join(normalDir,'existing-draft-storage.json'),'utf8')).__test_only_history_session_v1,bh)
  const raceRuntime = createWechatTsRuntime(ts,{wx:{getStorageSync:k=>clone(raceStorage[k]??''),setStorageSync(){throw new Error('Draft write forbidden')}}})
  const raceStore=raceRuntime.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
  const factory=raceRuntime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1
  const markers=new Map([['__test_only_history_session_v1',raceStorage.__test_only_history_session_v1]]);const local={read:k=>markers.get(k)??'',write:(k,v)=>markers.set(k,clone(v))}
  let account='B',release,entered,BRequests=0
  const waiting=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve})
  const tr=who=>({environment:()=> 'develop',developmentBackendOrigin:()=> 'http://history-e2e.local:34479',login:async()=>`TEST_ONLY_LOGIN_${who==='dynamic'?account:who}_${runId}`,
    async request(input){if(who==='A')BRequests++;const u=new URL(input.url);u.hostname='127.0.0.1'
      if(input.method==='POST'&&u.pathname==='/api/v1/completed-assessments'){entered();await gate}
      const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data)})
      return {statusCode:r.status,data:await r.json()}
    }})
  const A=factory(()=>raceStore,tr('dynamic'),local),B=factory(()=>raceStore,tr('A'),local)
  const inFlight=confirmedSave(A);await waiting;account='A'
  const blockedB=await B.saveCurrent(),blockedSameClient=await A.saveCurrent()
  assert.equal(blockedB.state,'ERROR');assert.equal(blockedSameClient.state,'ERROR');assert.ok(!blockedB.item);assert.equal(BRequests,0)
  release();const late=await inFlight;assert.equal(late.state,'ERROR');assert.ok(!late.item,'late A result must not display after switching to B')
  const switched=await B.recoverPending();assert.equal(switched.state,'ERROR');assert.ok(!switched.item)
  account='B';assert.equal((await A.recoverPending()).state,'SUCCESS')
  assert.equal((await list()).length,initial.length+2)
  const ct={environment:()=> 'develop',developmentBackendOrigin:()=> 'http://history-e2e.local:34479',login:async()=>`TEST_ONLY_LOGIN_C_${runId}`,
    request:async input=>{const u=new URL(input.url);u.hostname='127.0.0.1';const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data)});return {statusCode:r.status,data:await r.json()}}}
  const cs=await c5.createC5AuthenticatedBackendSessionClientV1(ct).acquireSession(ct.developmentBackendOrigin());assert.equal(cs.kind,'authenticated')
  const ch=c5.createC5AuthenticatedJsonHeadersV1(cs.session)
  assert.equal((await ct.request({url:cs.session.origin+'/api/v1/elder-record',method:'POST',header:ch})).statusCode,200)
  const switchDir=path.join(root,'switch-crash');mkdirSync(switchDir)
  const lostSwitch=await launch(switchDir,'drop-new-response','C',34479,'new-committed-no-receipt')
  const switchStorage=readFileSync(path.join(switchDir,'existing-draft-storage.json'),'utf8'),transition=JSON.parse(switchStorage).__test_only_history_session_v1
  const coldSwitch=await launch(switchDir,'recover','C');assert.notEqual(coldSwitch.pid,lostSwitch.pid);assert.equal(coldSwitch.coldLifecycle.state,'RECOVERY_REQUIRED')
  assert.equal(coldSwitch.posts,0);assert.equal(readFileSync(path.join(switchDir,'existing-draft-storage.json'),'utf8'),switchStorage)
  const replay=await ct.request({url:cs.session.origin+'/api/v1/completed-assessments/assessment-sessions/new',method:'POST',header:ch,
    data:{intent:'CONFIRMED_NEW_ASSESSMENT',fromSessionId:transition.sessionId,draftContext:transition.nextDraftContext}})
  assert.equal(replay.statusCode,200);assert.equal(replay.data.sessionId,lostSwitch.item.sessionId,'durable candidate recovers same B identity; no second successor')
  console.log('PASS: distinct killed/restarted client processes; persisted-before-POST, lost acknowledgment reconciliation, no duplicate, delayed original, Draft preservation')
  console.log('PASS: concurrent cross-client/account promise isolation and late-acknowledgment scope recheck')
  console.log('PASS: process killed after server creates B but before receipt; candidate persisted before /new, same successor replay; cold content proof unavailable blocks Draft replacement')
  console.log('PASS: storage failure/corruption, changed Draft, account switch/copied marker, failed login/query, disabled and production modes; no health/credentials in recovery DTO')
  console.log(`TEST_ONLY evidence retained: ${root}`)
}
