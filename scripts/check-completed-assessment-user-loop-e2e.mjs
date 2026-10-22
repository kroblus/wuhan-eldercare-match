/** TEST_ONLY: actual History/PrimaryButton/Intro handlers -> C5 HTTP -> disposable MySQL. */
import assert from 'node:assert/strict'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL, 'true', 'isolated disposable marker required')
const { ts } = loadWechatTypeScript()
const answers = JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json', 'utf8'))
const clone = v => JSON.parse(JSON.stringify(v))
const runId = randomUUID()
const until = async (condition, label) => {
  const deadline = Date.now() + 20000
  while (!condition()) { assert.ok(Date.now() < deadline, label); await new Promise(resolve => setTimeout(resolve, 15)) }
}
const app = (account, port = 34479, environment = 'develop', existingStorage) => {
  const storage = existingStorage ? new Map([...existingStorage].map(([k,v])=>[k,clone(v)])) : new Map([['__dev_backend_origin_v1', `http://history-e2e.local:${port}`]])
  let activeAccount=account, holdDetail=false, releaseDetail, holdList=false, releaseList
  const requests = [], nav = [], scroll = []
  let component, intro, button, lostReceipt = false, lostNewReceipt = false, detailFailure = false, recommendationFailure = false, rejectSave = false, writes = 0, failStorageKey = '', holdSave = false, releaseSave
  let stack = [{ route: 'pages/assessment/history' }]
  const runtime = createWechatTsRuntime(ts, { Component(v) { component = v }, Page(v) { intro = v },
    getCurrentPages: () => stack,
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
      getStorageSync: key => clone(storage.get(key) ?? ''),
      setStorageSync: (key, value) => { if (key === failStorageKey) { failStorageKey = ''; throw new Error('TEST_ONLY write failure') } if (!key.startsWith('__test_only_history_')) writes++; storage.set(key, clone(value)) },
      removeStorageSync: () => { throw new Error('must never clear Draft') },
      login: options => options.success({ code: `TEST_ONLY_LOGIN_${activeAccount}_${runId}` }),
      request: options => {
        const url = new URL(options.url); assert.equal(url.hostname, 'history-e2e.local'); url.hostname = '127.0.0.1'
        const save = options.method === 'POST' && url.pathname === '/api/v1/completed-assessments'
        requests.push({ pathname: url.pathname, method: options.method, body: options.data && clone(options.data) })
        if (detailFailure && /completed-assessments\/[0-9a-f-]{36}$/.test(url.pathname)) { detailFailure = false; options.fail({}); return }
        if (recommendationFailure && url.pathname.endsWith('/recommendation')) { recommendationFailure = false; options.fail({}); return }
        if (rejectSave && save) { rejectSave = false; options.fail({}); return }
        const send = () => fetch(url, { method: options.method, headers: { 'Content-Type': 'application/json', ...options.header },
          body: options.data === undefined ? undefined : JSON.stringify(options.data), signal: AbortSignal.timeout(15000) })
          .then(async response => {
            const data = await response.json()
            if (save && lostReceipt) { lostReceipt = false; options.fail({}); return }
            if (url.pathname.endsWith('/assessment-sessions/new') && lostNewReceipt) { lostNewReceipt = false; options.fail({}); return }
            if(holdDetail && /completed-assessments\/[0-9a-f-]{36}$/.test(url.pathname)){holdDetail=false;releaseDetail=()=>options.success({statusCode:response.status,data});return}
            if(holdList && url.pathname==='/api/v1/completed-assessments' && options.method==='GET'){holdList=false;releaseList=()=>options.success({statusCode:response.status,data});return}
            options.success({ statusCode: response.status, data })
          }).catch(() => options.fail({}))
        if (save && holdSave) { holdSave = false; releaseSave = send } else send()
      },
      pageScrollTo: options => scroll.push(options.scrollTop),
      navigateTo: options => { nav.push(options.url); options.success?.({}); options.complete?.({}) },
      showToast() {}, showModal: () => { throw new Error('dangerous reset/capacity modal not expected at shallow stack') },
    } })
  runtime.load(path.resolve('miniprogram/pages/assessment/history.ts'))
  const config = component
  let page = { data: clone(config.data), setData(patch) { Object.assign(this.data, clone(patch)) } }
  Object.assign(page, config.methods)
  runtime.load(path.resolve('miniprogram/components/primary-button/primary-button.ts')); button = component
  // Same PrimaryButton action boundary as WXML; dataset belongs to the bound component.
  const tap = (method, dataset = {}) => button.methods.handleAction.call({ data: { disabled: false, loading: false },
    triggerEvent(name, detail, options) { assert.equal(name, 'action'); assert.equal(options.bubbles, false)
      page[method]({ detail, currentTarget: { dataset } }) } })
  const store = runtime.load(path.resolve('miniprogram/store/assessment-draft.ts')).assessmentDraftStore
  const fill = values => { for (const [key, value] of Object.entries(values)) assert.equal(store.setAnswer(key, clone(value)).persistence.ok, true, key) }
  const establish = async () => {
    const c5=runtime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
    // Use the actual C5 client for trusted evidence; no self-reported owner fixture header.
    const tr={environment:()=> 'develop',developmentBackendOrigin:()=>`http://history-e2e.local:${port}`,login:async()=>`TEST_ONLY_LOGIN_${activeAccount}_${runId}`,
      request:async input=>{const u=new URL(input.url);u.hostname='127.0.0.1';const rr=await fetch(u,{method:input.method,headers:input.header,body:input.data&&JSON.stringify(input.data)});return {statusCode:rr.status,data:await rr.json()}}}
    const s=await c5.createC5AuthenticatedBackendSessionClientV1(tr).acquireSession(tr.developmentBackendOrigin());assert.equal(s.kind,'authenticated')
    assert.equal((await tr.request({url:s.session.origin+'/api/v1/elder-record',method:'POST',header:c5.createC5AuthenticatedJsonHeadersV1(s.session)})).statusCode,200)
  }
  const show = async () => { await establish(); config.pageLifetimes.show.call(page); await until(() => !page.data.historyLoading && page.data.userLoopEnabled && !page.data.loopRecoveryPending, 'History capability and recovery') }
  const saveClick = async () => { tap('saveCurrentAssessment'); await until(()=>!page.data.loopSavePreparing,'save confirmation prepared'); if(page.data.loopSaveConfirmVisible) tap('confirmSaveAssessment') }
  return { runtime, get page() { return page }, config, store, fill, tap, saveClick, show, storage, requests, nav, scroll, writes: () => writes,
    remount() { config.lifetimes.detached.call(page); page = { data: clone(config.data), setData(patch) { Object.assign(this.data, clone(patch)) } }; Object.assign(page, config.methods) },
    async provisionSyntheticSuccessor(previous) {
      // Test fixture provisioning uses the real owner-scoped /new, never a second root or production path.
      const code = `TEST_ONLY_LOGIN_${activeAccount}_${runId}`
      const tr = { environment: () => 'develop', developmentBackendOrigin: () => `http://history-e2e.local:${port}`, login: async () => code,
        request: async input => { const u=new URL(input.url);u.hostname='127.0.0.1';const r=await fetch(u,{method:input.method,headers:{'Content-Type':'application/json',...input.header},body:input.data&&JSON.stringify(input.data)});return {statusCode:r.status,data:await r.json()} } }
      const c5=runtime.load(path.resolve('miniprogram/services/c5-authenticated-backend-session.ts'))
      const s=await c5.createC5AuthenticatedBackendSessionClientV1(tr).acquireSession(tr.developmentBackendOrigin());assert.equal(s.kind,'authenticated')
      const r=await tr.request({url:s.session.origin+'/api/v1/completed-assessments/assessment-sessions/new',method:'POST',header:c5.createC5AuthenticatedJsonHeadersV1(s.session),
        data:{intent:'CONFIRMED_NEW_ASSESSMENT',fromSessionId:previous.sessionId,draftContext:store.getDraft().localDraftId}})
      assert.equal(r.statusCode,200);storage.set('__test_only_history_session_v1',{version:1,origin:s.session.origin,scopeId:r.data.scopeId,sessionId:r.data.sessionId,draftContext:r.data.draftContext,state:'active'})
    },
    loseReceipt: () => { lostReceipt = true }, loseNewReceipt: () => { lostNewReceipt = true }, failDetail: () => { detailFailure = true }, failSave: () => { rejectSave = true },
    failRecommendation: () => { recommendationFailure = true },
    switchAccount: value=>{activeAccount=value},holdNextDetail:()=>{holdDetail=true},detailHeld:()=>Boolean(releaseDetail),releaseDetail:()=>{assert.ok(releaseDetail);releaseDetail();releaseDetail=undefined},
    holdNextList:()=>{holdList=true},listHeld:()=>Boolean(releaseList),releaseList:()=>{assert.ok(releaseList);releaseList();releaseList=undefined},
    failStorage: key => { failStorageKey = key }, holdNextSave: () => { holdSave = true }, releaseSave: () => { assert.ok(releaseSave); releaseSave(); releaseSave = undefined },
    startIntro() { runtime.load(path.resolve('miniprogram/pages/assessment/intro.ts')); const instance = { ...intro, data: clone(intro.data),
      route: 'pages/assessment/intro', setData(patch) { Object.assign(this.data, clone(patch)) } };
      stack = [{ route: 'pages/assessment/history' }, instance]; instance.onLoad({}); instance.onShow(); instance.startAssessment() },
  }
}
const posts = a => a.requests.filter(r => r.pathname === '/api/v1/completed-assessments' && r.method === 'POST')
if (process.argv.includes('--sessions')) {
  const a = app('A'); a.fill(answers); await a.show()
  const client = a.runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(() => a.store)
  assert.equal((await client.lifecycle()).state, 'UNSAVED')
  let before = JSON.stringify(a.store.getDraft())
  assert.equal((await client.saveCurrent()).state,'ERROR','service requires a private confirmation, not just a UI flag')
  a.page.data.loopSaveConfirmVisible=true;a.tap('confirmSaveAssessment');assert.equal(posts(a).length,0);a.page.data.loopSaveConfirmVisible=false
  a.tap('saveCurrentAssessment');a.tap('saveCurrentAssessment');await until(()=>a.page.data.loopSaveConfirmVisible&&!a.page.data.loopSavePreparing,'D02 confirm shown')
  assert.match(a.page.data.loopSaveConfirmMessage,/不代表与当前匿名预览完全相同/);assert.match(a.page.data.loopSaveConfirmMessage,/不是敏感信息单独同意/)
  assert.equal(posts(a).length,0);assert.equal(a.requests.filter(r=>r.pathname.endsWith('/save-intents')).length,0)
  a.tap('cancelSaveAssessment');assert.equal(JSON.stringify(a.store.getDraft()),before);assert.equal(a.storage.has('__test_only_history_save_recovery_v1'),false)
  a.tap('saveCurrentAssessment');await until(()=>a.page.data.loopSaveConfirmVisible,'D02 content-change preflight')
  a.store.setAnswer('basic.age',74);a.tap('confirmSaveAssessment');await until(()=>!a.page.data.loopSavePending,'changed confirmation blocked')
  assert.equal(posts(a).length,0);assert.equal(a.requests.filter(r=>r.pathname.endsWith('/save-intents')).length,0)
  assert.match(a.page.data.loopSaveMessage,/确认后答案/);a.store.setAnswer('basic.age',answers['basic.age'])
  before=JSON.stringify(a.store.getDraft())
  a.holdNextSave(); await a.saveClick()
  await until(() => posts(a).length === 1, 'save reaches server boundary')
  assert.equal((await client.lifecycle()).state, 'SAVING')
  assert.equal((await client.confirmNewSession()).state, 'CONFLICT')
  assert.equal(JSON.stringify(a.store.getDraft()), before)
  a.releaseSave(); await until(() => !a.page.data.loopSavePending && /保存成功/.test(a.page.data.loopSaveMessage), 'A ack')
  await until(() => !a.page.data.historyLoading, 'A list')
  assert.equal(JSON.stringify(a.store.getDraft()), before)
  assert.equal((await client.lifecycle()).state, 'SAVED_UNCHANGED')
  const sa = clone(a.storage.get('__test_only_history_session_v1'))
  const ia = clone(a.storage.get('__test_only_history_save_recovery_v1'))
  const ar = await client.recoverPending(); assert.equal(ar.state, 'SUCCESS'); const aid = ar.item.id
  const profile = await client.readDetail(aid), recommendation = await client.readRecommendation(aid)
  assert.equal(profile.state, 'READY'); assert.equal(recommendation.state, 'READY')
  a.page.data.loopNewSessionConfirm = true; a.tap('confirmNewAssessmentSession')
  await new Promise(r => setTimeout(r, 30)); assert.equal(a.nav.length, 0, 'forged visible data cannot confirm')
  a.page.data.loopNewSessionConfirm = false
  a.tap('newAssessment'); await until(() => a.page.data.loopNewSessionConfirm, 'D03 confirmation')
  a.tap('cancelNewAssessmentSession'); assert.equal(JSON.stringify(a.store.getDraft()), before); assert.equal(a.nav.length, 0)
  a.tap('confirmNewAssessmentSession'); assert.equal(a.nav.length, 0, 'canceled private confirmation cannot be reused')
  a.tap('newAssessment'); await until(() => a.page.data.loopNewSessionConfirm, 'repeat confirmation')
  a.failStorage('__test_only_history_session_v1'); a.tap('confirmNewAssessmentSession')
  await until(() => !a.page.data.loopReassessmentPending, 'transition marker failure')
  assert.equal(a.requests.filter(r=>r.pathname.endsWith('/assessment-sessions/new')).length,0);assert.equal(JSON.stringify(a.store.getDraft()),before)
  a.tap('newAssessment'); await until(() => a.page.data.loopNewSessionConfirm, 'retry confirmation')
  a.loseNewReceipt(); a.tap('confirmNewAssessmentSession'); await until(()=>!a.page.data.loopReassessmentPending,'lost successor acknowledgment')
  const requested=clone(a.storage.get('__test_only_history_session_v1'));assert.equal(requested.state,'switch_requested');assert.equal(JSON.stringify(a.store.getDraft()),before)
  a.tap('newAssessment'); await until(() => a.page.data.loopNewSessionConfirm, 'same candidate confirmation retry')
  a.tap('confirmNewAssessmentSession'); a.tap('confirmNewAssessmentSession')
  await until(() => a.nav.length === 1 && !a.page.data.loopReassessmentPending, 'controlled B switch')
  assert.equal(a.nav[0], '/pages/assessment/intro'); assert.equal(a.store.hasAnswers(), false)
  const sb = clone(a.storage.get('__test_only_history_session_v1')); assert.notEqual(sb.sessionId, sa.sessionId)
  const newRequests=a.requests.filter(r=>r.pathname.endsWith('/assessment-sessions/new'));assert.equal(newRequests.length,2);assert.deepEqual(newRequests[0].body,newRequests[1].body);assert.equal(sb.draftContext,requested.nextDraftContext)
  assert.notEqual(sb.draftContext, sa.draftContext); assert.equal(sb.state, 'active'); assert.equal(a.store.getDraft().currentStep, 'basic')
  assert.equal((await client.lifecycle()).state, 'UNSAVED'); a.startIntro(); assert.equal(a.nav.at(-1), '/pages/assessment/basic')
  a.fill(answers); const bDraft = JSON.stringify(a.store.getDraft()); a.remount(); await a.show()
  await a.saveClick(); await a.saveClick()
  await until(() => !a.page.data.loopSavePending && /保存成功/.test(a.page.data.loopSaveMessage), 'B ack')
  await until(() => !a.page.data.historyLoading, 'B list')
  const br = await client.recoverPending(); assert.equal(br.state, 'SUCCESS'); assert.notEqual(br.item.id, aid)
  assert.notEqual(a.storage.get('__test_only_history_save_recovery_v1').intentId, ia.intentId)
  assert.equal(posts(a).length, 2); assert.equal(JSON.stringify(a.store.getDraft()), bDraft)
  assert.equal((await client.lifecycle()).state, 'SAVED_UNCHANGED')
  assert.ok(a.page.data.records.some(r => r.id === aid)); assert.ok(a.page.data.records.some(r => r.id === br.item.id))
  assert.deepEqual(await client.readDetail(aid), profile); assert.deepEqual(await client.readRecommendation(aid), recommendation)
  await a.saveClick(); await until(() => !a.page.data.loopSavePending, 'same B replay'); assert.equal(posts(a).length, 2)
  a.store.setAnswer('basic.age', 74); const modified = JSON.stringify(a.store.getDraft())
  assert.equal((await client.lifecycle()).state, 'SAVED_WITH_LOCAL_CHANGES')
  a.tap('newAssessment'); await until(() => a.page.data.loopConflict, 'modified B blocked')
  await a.saveClick(); await until(() => !a.page.data.loopSavePending, 'modified session original status')
  assert.equal(posts(a).length, 2); assert.equal(JSON.stringify(a.store.getDraft()), modified)
  assert.match(a.page.data.loopSaveMessage, /当前修改尚未保存/)
  assert.deepEqual(await client.readDetail(aid), profile); assert.deepEqual(await client.readRecommendation(aid), recommendation)
  // Existing Store CAS cannot replace a concurrently edited draft and preserves the one slot on write failure.
  const expected = a.store.getDraft(), candidate = a.store.prepareEmptyHistoryDraft()
  a.failStorage('wuhan-eldercare-match.assessment-draft.v2')
  assert.equal(a.store.replaceSavedHistoryDraft(expected, candidate).persistence.ok, false)
  assert.equal(JSON.stringify(a.store.getDraft()), modified)
  a.store.setAnswer('basic.age', 76)
  assert.equal(a.store.replaceSavedHistoryDraft(expected, candidate).persistence.ok, false)
  assert.equal(a.store.getDraft().answers['basic.age'], 76)
  const unknown = app('A'); await unknown.provisionSyntheticSuccessor(sb); unknown.fill(answers); await unknown.show(); unknown.failSave(); await unknown.saveClick()
  await until(() => !unknown.page.data.loopSavePending, 'unconfirmed save')
  const uc = unknown.runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1(() => unknown.store)
  assert.equal((await uc.lifecycle()).state, 'SAVE_UNCONFIRMED'); assert.equal((await uc.confirmNewSession()).state, 'CONFLICT')
  assert.equal(posts(unknown).length, 1)
  const peer=app('B');await peer.show()
  a.tap('saveCurrentAssessment');await until(()=>a.page.data.loopSaveConfirmVisible,'A confirmation before switch')
  const retainedScope=JSON.stringify(a.store.getDraft());a.switchAccount('B');a.tap('confirmSaveAssessment');await until(()=>!a.page.data.loopSavePending,'B cannot consume A proof')
  assert.equal(posts(a).length,2);assert.equal(JSON.stringify(a.store.getDraft()),retainedScope)
  a.config.pageLifetimes.hide.call(a.page);await a.show();assert.equal(a.page.data.records.length,0,'B sees no A list')
  a.switchAccount('A');await a.show();assert.ok(a.page.data.records.some(r=>r.id===aid))
  a.holdNextDetail();const lateDetail=client.readDetail(aid);await until(()=>a.detailHeld(),'A detail receipt deliberately held')
  a.switchAccount('B');a.releaseDetail();const hidden=await lateDetail;assert.equal(hidden.state,'ERROR');assert.equal(hidden.profile,undefined)
  a.switchAccount('A');assert.equal((await client.readDetail(aid)).state,'READY')
  const listClient=a.runtime.load(path.resolve('miniprogram/services/completed-assessment-history.ts')).createCompletedAssessmentHistoryClientV1()
  a.holdNextList();const lateList=listClient.readPage();await until(()=>a.listHeld(),'A list receipt deliberately held while page visible')
  a.switchAccount('B');a.releaseList();const hiddenList=await lateList;assert.equal(hiddenList.state,'ERROR');assert.equal(hiddenList.records,undefined)
  a.switchAccount('A');assert.ok((await listClient.readPage()).records.some(r=>r.id===aid))
  const orphan=new Map([...a.storage].map(([k,v])=>[k,clone(v)]));orphan.delete('__test_only_history_session_v1');orphan.delete('__test_only_history_save_recovery_v1')
  const inherited=app('B',34479,'develop',orphan);await inherited.show();const inheritedDraft=JSON.stringify(inherited.store.getDraft());await inherited.saveClick()
  assert.equal(posts(inherited).length,0);assert.equal(inherited.requests.filter(r=>r.pathname.endsWith('/save-intents')).length,0)
  assert.equal(JSON.stringify(inherited.store.getDraft()),inheritedDraft,'device Draft does not prove B ownership even if markers are missing')
  for(const mode of ['extra-field','missing-id','missing-origin','foreign-origin','foreign-scope','missing-marker','missing-both']) {
    const fixture=new Map([...a.storage].map(([k,v])=>[k,clone(v)])), k='__test_only_history_save_recovery_v1', marker=clone(fixture.get(k))
    if(mode==='extra-field')marker.answers='TEST_ONLY_FORBIDDEN'
    if(mode==='missing-id')delete marker.intentId
    if(mode==='missing-origin')delete marker.origin
    if(mode==='foreign-origin')marker.origin='http://history-e2e.local:34480'
    if(mode==='foreign-scope')marker.scopeId=randomUUID()
    if(mode==='missing-marker'||mode==='missing-both')fixture.delete(k);else fixture.set(k,marker)
    if(mode==='missing-both')fixture.delete('__test_only_history_session_v1')
    const cold=app('A',34479,'develop',fixture);await cold.show();const retained=JSON.stringify(cold.store.getDraft())
    await cold.saveClick();assert.equal(posts(cold).length,0,mode);assert.equal(cold.requests.filter(r=>r.pathname.endsWith('/save-intents')).length,0,mode)
    assert.equal(JSON.stringify(cold.store.getDraft()),retained,mode);assert.ok(cold.page.data.records.some(r=>r.id===aid),'legal history remains readable')
    if(mode==='foreign-origin'||mode==='foreign-scope')assert.equal(cold.requests.filter(r=>r.pathname.endsWith('/reconcile')).length,0,mode)
  }
  console.log('PASS: same synthetic user + same Store + actual PrimaryButton History/Intro/Basic -> A ack -> cancel -> confirm empty B -> identical answers -> independent B ack; old Profile/Recommendation unchanged')
  console.log('PASS: SAVING/UNCONFIRMED/MODIFIED conflicts, private confirmation, double clicks/remount, same-session replay, single-slot failure/CAS, no reset or extra sensitive storage')
  console.log('PASS: D02 cancel/forged flag/single-use confirmation, changed content refuses before intent; source inequality + separate-consent disclosure; D06 damaged/lost/copied metadata block intent/POST while own History remains readable')
  console.log('PASS: D07 A->B->A, pre-confirm account switch, held late A detail AND list rejected while visible, inherited Draft with both local markers missing cannot be assigned to B')
} else {
const a = app('A'); a.fill(answers); const original = JSON.stringify(a.store.getDraft()), originalWrites = a.writes()
await a.show(); assert.equal(posts(a).length, 0, 'load/list does not save')
a.failSave(); await a.saveClick(); await until(() => !a.page.data.loopSavePending, 'failed save')
assert.match(a.page.data.loopSaveMessage, /未收到|尚未确认/); assert.equal(JSON.stringify(a.store.getDraft()), original); assert.equal(a.writes(), originalWrites)
a.loseReceipt(); await a.saveClick(); await a.saveClick()
await until(() => !a.page.data.loopSavePending, 'lost save response')
assert.match(a.page.data.loopSaveMessage, /未收到|尚未确认/)
assert.equal(posts(a).length, 2, 'fast double tap produces one request')
// Editing after an uncertain response is legal; the retry keeps the original save intent.
assert.equal(a.store.setAnswer('basic.age', 74).persistence.ok, true)
const edited = JSON.stringify(a.store.getDraft()), editedWrites = a.writes()
a.remount(); await a.show()
await a.saveClick(); await until(() => !a.page.data.loopSavePending && /保存成功/.test(a.page.data.loopSaveMessage), 'retry acknowledgment')
await until(() => !a.page.data.historyLoading && a.page.data.records.length > 0, 'list refresh')
assert.equal(JSON.stringify(posts(a)[0].body), JSON.stringify(posts(a)[1].body)); assert.equal(posts(a).length, 2, 'remount reconciles committed result without another POST')
assert.equal(JSON.stringify(a.store.getDraft()), edited); assert.equal(a.writes(), editedWrites)
const firstId = a.page.data.records[0].id
a.page.onPageScroll({ scrollTop: 318 }); a.failDetail(); a.tap('viewHistoryResult', { recordId: firstId })
await until(() => a.page.data.loopDetailVisible && !a.page.data.loopDetailPending, 'detail network error')
assert.match(a.page.data.loopDetailMessage, /重试/)
a.tap('retryHistoricalResult'); await until(() => a.page.data.loopProfileAvailable && !a.page.data.loopDetailPending, 'detail retry')
const oldRows = clone(a.page.data.loopProfileRows); assert.equal(oldRows.length, 6)
let oldRecommendationCards
if (process.argv.includes('--recommendation')) {
  a.failRecommendation(); a.tap('viewHistoricalRecommendation')
  await until(() => !a.page.data.loopRecommendationPending, 'recommendation network failure')
  assert.equal(a.page.data.loopRecommendationState, 'ERROR')
  a.tap('retryHistoricalRecommendation'); await until(() => a.page.data.loopRecommendationState === 'READY', 'recommendation retry')
  oldRecommendationCards = clone(a.page.data.loopRecommendationCards); assert.ok(oldRecommendationCards.length)
  a.tap('returnToHistoricalProfile'); assert.equal(a.page.data.loopRecommendationVisible, false)
  assert.equal(JSON.stringify(a.page.data.loopProfileRows), JSON.stringify(oldRows))
}
assert.equal(JSON.stringify(a.store.getDraft()), edited); assert.equal(a.writes(), editedWrites)
a.tap('returnToHistoryList'); assert.equal(a.page.data.loopDetailVisible, false); assert.equal(a.scroll.at(-1), 318)
a.tap('newAssessment'); await until(() => a.page.data.loopConflict, 'active Draft conflict')
assert.equal(a.nav.length, 0); a.tap('keepCurrentDraft'); assert.equal(a.page.data.loopConflict, false)
assert.equal(JSON.stringify(a.store.getDraft()), edited); assert.equal(a.writes(), editedWrites)
a.tap('newAssessment'); await until(() => a.page.data.loopConflict, 'repeat conflict'); a.tap('continueCurrentDraft')
assert.equal(a.nav.at(-1), '/pages/assessment/intro'); assert.equal(JSON.stringify(a.store.getDraft()), edited)
// A separate, fresh local application context with no answers; never reset the existing Draft.
const fresh = app('A'); assert.equal(fresh.store.hasAnswers(), false)
await fresh.provisionSyntheticSuccessor(a.storage.get('__test_only_history_session_v1'))
const emptyId = fresh.store.getDraft().localDraftId; assert.notEqual(emptyId, a.store.getDraft().localDraftId)
await fresh.show(); fresh.tap('viewHistoryResult', { recordId: firstId })
await until(() => fresh.page.data.loopProfileAvailable, 'stored historical Profile')
assert.equal(JSON.stringify(fresh.page.data.loopProfileRows), JSON.stringify(oldRows), 'historical Profile independent of current Draft')
if (process.argv.includes('--recommendation')) {
  fresh.tap('viewHistoricalRecommendation'); await until(() => fresh.page.data.loopRecommendationState === 'READY', 'empty context reads saved recommendation before reassessment')
  assert.equal(JSON.stringify(fresh.page.data.loopRecommendationCards), JSON.stringify(oldRecommendationCards)); fresh.tap('returnToHistoricalProfile')
}
fresh.tap('returnToHistoryList'); fresh.tap('newAssessment'); await until(() => fresh.nav.length === 1, 'empty Draft safe entry')
assert.equal(fresh.nav[0], '/pages/assessment/intro'); fresh.startIntro(); assert.equal(fresh.nav.at(-1), '/pages/assessment/basic')
assert.equal(fresh.store.hasAnswers(), false); assert.equal(fresh.store.getDraft().localDraftId, emptyId)
fresh.fill({ ...answers, 'basic.age': 75 }); const newDraft = JSON.stringify(fresh.store.getDraft()), newWrites = fresh.writes()
await fresh.saveClick(); await until(() => !fresh.page.data.loopSavePending && /保存成功/.test(fresh.page.data.loopSaveMessage), 'new save')
await until(() => !fresh.page.data.historyLoading && fresh.page.data.records[0].id !== firstId, 'distinct record')
assert.notEqual(fresh.page.data.records[0].id, firstId); assert.equal(JSON.stringify(fresh.store.getDraft()), newDraft); assert.equal(fresh.writes(), newWrites)
const beforeDuplicate = posts(fresh).length; await fresh.saveClick(); await until(() => !fresh.page.data.loopSavePending, 'acknowledged double save')
assert.equal(posts(fresh).length, beforeDuplicate)
fresh.tap('viewHistoryResult', { recordId: firstId }); await until(() => fresh.page.data.loopProfileAvailable, 'old record after new save')
assert.equal(JSON.stringify(fresh.page.data.loopProfileRows), JSON.stringify(oldRows))
if (process.argv.includes('--recommendation')) {
  fresh.tap('viewHistoricalRecommendation'); await until(() => fresh.page.data.loopRecommendationState === 'READY', 'old recommendation after new assessment')
  assert.equal(JSON.stringify(fresh.page.data.loopRecommendationCards), JSON.stringify(oldRecommendationCards))
  fresh.tap('returnToHistoricalProfile')
  fresh.tap('returnToHistoryList')
  const noSafe = app('A'); await noSafe.show(); noSafe.fill(answers)
  await noSafe.provisionSyntheticSuccessor(fresh.storage.get('__test_only_history_session_v1'))
  const previousId = noSafe.page.data.records[0].id
  assert.equal(noSafe.store.setAnswer('cognitive.symptoms', ['unknown']).persistence.ok, true)
  const noSafeDraft = JSON.stringify(noSafe.store.getDraft()), noSafeWrites = noSafe.writes()
  await noSafe.saveClick(); await until(() => !noSafe.page.data.loopSavePending && /保存成功/.test(noSafe.page.data.loopSaveMessage), 'no-safe save')
  await until(() => !noSafe.page.data.historyLoading && noSafe.page.data.records[0].id !== previousId, 'no-safe row refresh')
  noSafe.tap('viewHistoryResult', { recordId: noSafe.page.data.records[0].id }); await until(() => !noSafe.page.data.loopDetailPending, 'no-safe Profile')
  noSafe.tap('viewHistoricalRecommendation'); await until(() => noSafe.page.data.loopRecommendationState === 'READY', 'no-safe stored Recommendation')
  assert.match(noSafe.page.data.loopRecommendationTitle, /没有/); assert.equal(noSafe.page.data.loopRecommendationCards.length, 0)
  assert.equal(JSON.stringify(noSafe.store.getDraft()), noSafeDraft); assert.equal(noSafe.writes(), noSafeWrites)
}
const service = fresh.runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts')).createCompletedAssessmentUserLoopV1
const transport = (account, port = 34479, environment = 'develop') => ({ environment: () => environment,
  developmentBackendOrigin: () => `http://history-e2e.local:${port}`, login: async () => `TEST_ONLY_LOGIN_${account}_${runId}`,
  request: async input => { const url = new URL(input.url); url.hostname = '127.0.0.1'
    const response = await fetch(url, { method: input.method, headers: { 'Content-Type': 'application/json', ...input.header }, body: input.data && JSON.stringify(input.data) })
    return { statusCode: response.status, data: await response.json() } } })
let draftAccess = 0
const blockedStore = () => { draftAccess++; throw new Error('must not touch current Draft') }
const b = service(blockedStore, transport('B'))
assert.equal((await b.readDetail(firstId)).message, (await b.readDetail('00000000-0000-0000-0000-000000000000')).message)
if (process.argv.includes('--recommendation')) assert.equal((await b.readRecommendation(firstId)).message,
  (await b.readRecommendation('00000000-0000-0000-0000-000000000000')).message)
assert.equal(draftAccess, 0)
const realTransport = transport('A')
const malformedDetail = service(blockedStore, { ...realTransport, request: async input => {
  const response = await realTransport.request(input)
  if (/completed-assessments\/[0-9a-f-]{36}$/.test(new URL(input.url).pathname)) response.data.answers = { TEST_ONLY: 'forbidden-raw-field' }
  return response
} })
assert.equal((await malformedDetail.readDetail(firstId)).state, 'ERROR', 'unapproved detail fields must not reach rendering')
assert.equal(draftAccess, 0)
for (const tr of [transport('A', 34480), transport('A', 34479, 'release'), transport('A', 34479, 'trial')]) {
  const blocked = service(blockedStore, tr); assert.equal(await blocked.capability(), false)
  assert.equal((await blocked.saveCurrent()).state, 'ERROR'); assert.equal((await blocked.reassessment()).state, 'UNAVAILABLE')
}
assert.equal(draftAccess, 0)
const disabled = app('A', 34480); disabled.config.pageLifetimes.show.call(disabled.page)
await until(() => !disabled.page.data.historyLoading, 'disabled server')
assert.equal(disabled.page.data.userLoopEnabled, false)
disabled.page.data.userLoopEnabled = true; disabled.tap('saveCurrentAssessment'); disabled.tap('newAssessment')
assert.equal(posts(disabled).length, 0); assert.equal(disabled.nav.length, 0, 'forged page data cannot approve a private action context')
for (const x of [a, fresh, disabled]) assert.ok(!x.requests.some(r => /profile/.test(r.pathname)
  || (/recommendation/.test(r.pathname) && !/^\/api\/v1\/completed-assessments\/[0-9a-f-]{36}\/recommendation$/.test(r.pathname))))
assert.equal(JSON.stringify(a.store.getDraft()), edited)
console.log('PASS: actual PrimaryButton -> History save/detail/retry/list/conflict -> Intro -> Basic -> new save; real HTTP/C5/MySQL')
console.log('PASS: explicit-only, lost acknowledgment + identical intent retries, duplicate clicks, unchanged Draft/storage, immutable old Profile, new ID')
console.log('PASS: owner enumeration protection, disabled/release/trial gates, forged page data isolation, no current Profile/Recommendation calls')
if (process.argv.includes('--recommendation')) console.log('PASS: actual History -> stored Profile -> historical Recommendation -> retry -> return -> safe assessment; old recommendation preserved')
}
