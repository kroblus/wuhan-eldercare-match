import assert from 'node:assert/strict'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const runtime = createWechatTsRuntime(ts)
const { createCompletedAssessmentHistoryClientV1: client } = runtime.load(path.resolve('miniprogram/services/completed-assessment-history.ts'))
const { createHistoryViewModel: model } = runtime.load(path.resolve('miniprogram/pages/assessment/history-view-model.ts'))
const record = { kind: 'completed_assessment', id: '11111111-1111-1111-1111-111111111111', status: 'completed', schemaVersion: 2,
  completedAt: '2026-10-13T08:00:00.123456Z', assessmentContractVersion: 'assessment-schema-v2', source: 'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1', snapshotRevision: 1 }
const envelope = (items = [], nextCursor = null) => ({ contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_history_result_v1', availability: 'ready', items, nextCursor })
const scopeEnvelope = { contractVersion: 'completed-assessment-history-api-v1', kind: 'history_save_recovery_v1',
  scopeId: '33333333-3333-4333-8333-333333333333', intentId: null, createdAt: null, state: 'SCOPE', item: null, sessionId: null }
const run = async (response, environment = 'develop') => {
  const requests = []
  const transport = { environment: () => environment, developmentBackendOrigin: () => 'https://test-only.example',
    login: async () => 'TEST_ONLY_LOGIN', request: async request => {
      requests.push(request)
      if (request.url.endsWith('/capability')) return { statusCode: 200, data: {
        contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_history_capability_v1',
        availability: 'ready', source: 'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1',
      } }
      if (request.url.endsWith('/api/v1/auth/wechat')) return { statusCode: 200, data: {
        contractVersion: 'wechat-authenticated-principal-contract-v1', kind: 'wechat_authentication_result_v1',
        outcome: 'AUTHENTICATED', code: 'AUTHENTICATED', sessionEvidence: 'TEST_ONLY_SESSION', expiresAt: new Date(Date.now() + 60000).toISOString(),
      } }
      if (request.url.endsWith('/save-intents/scope')) return { statusCode: 200, data: scopeEnvelope }
      if (response instanceof Error) throw response
      return response
    } }
  const result = await client(transport).readPage()
  return { result, requests }
}
assert.equal((await run({}, 'release')).result.state, 'UNAVAILABLE')
assert.equal((await run({}, 'trial')).requests.length, 0)
const empty = await run({ statusCode: 200, data: envelope() })
assert.equal(model(empty.result).historyState, 'EMPTY')
const ready = await run({ statusCode: 200, data: envelope([record]) })
assert.equal(ready.result.state, 'READY'); assert.equal(model(ready.result).testOnly, true)
assert.match(model(ready.result).records[0].sourceLabel, /隔离环境已保存/)
assert.equal(ready.requests.at(-1).method, 'GET')
assert.equal(ready.requests.at(-1).header['X-Auth-Evidence'], 'TEST_ONLY_SESSION')
assert.ok(!('data' in ready.requests.at(-1)))
for (const statusCode of [401, 403, 500]) {
  const result = (await run({ statusCode, data: {} })).result
  assert.equal(result.state, 'ERROR'); assert.equal(model(result).historyState, 'ERROR')
}
assert.equal((await run(new Error('TEST_ONLY_NETWORK'))).result.state, 'ERROR')
assert.equal((await run({ statusCode: 503, data: { contractVersion: 'completed-assessment-history-api-v1',
  kind: 'completed_assessment_history_error_v1', availability: 'unavailable', code: 'UNAVAILABLE' } })).result.state, 'UNAVAILABLE')
for (const data of [envelope([{ ...record, answers: {} }]), envelope([{ ...record, ownerUserId: 'forged' }]),
  envelope([{ ...record, kind: 'assessment_draft' }]), envelope([{ ...record, source: 'TEST_ONLY' }]),
  envelope([{ ...record, completedAt: '2026-02-30T00:00:00Z' }]), envelope([{ ...record, schemaVersion: 1 }]),
  envelope([{ ...record, snapshotRevision: 2 }]), envelope([record, record]), envelope([], record.id),
  { ...envelope(), ownerUserId: 'forged' }, envelope([{ ...record, id: '' }])]) {
  assert.equal((await run({ statusCode: 200, data })).result.state, 'ERROR')
}
// Actual page lifecycle + pagination action, using only isolated transport callbacks.
let config
let resolveFirst
let listReads = 0
const callbacks = []
const pageRuntime = createWechatTsRuntime(ts, { Component(value) { config = value }, wx: {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getStorageSync: () => 'https://test-only.example',
  login: options => options.success({ code: 'TEST_ONLY_LOGIN' }),
  request: options => {
    callbacks.push(options)
    if (options.url.endsWith('/user-loop-capability')) options.success({ statusCode: 200, data: {
      contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_user_loop_capability_v1', availability: 'unavailable', source: null,
    } })
    else if (options.url.endsWith('/capability')) options.success({ statusCode: 200, data: {
      contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_history_capability_v1',
      availability: 'ready', source: 'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1',
    } })
    else if (options.url.endsWith('/auth/wechat')) options.success({ statusCode: 200, data: {
      contractVersion: 'wechat-authenticated-principal-contract-v1', kind: 'wechat_authentication_result_v1', outcome: 'AUTHENTICATED',
      code: 'AUTHENTICATED', sessionEvidence: 'TEST_ONLY_SESSION', expiresAt: new Date(Date.now() + 60000).toISOString(),
    } })
    else if (options.url.endsWith('/save-intents/scope')) options.success({ statusCode: 200, data: scopeEnvelope })
    else { listReads++; resolveFirst = data => options.success({ statusCode: 200, data }) }
  },
} })
pageRuntime.load(path.resolve('miniprogram/pages/assessment/history.ts'))
const page = { data: JSON.parse(JSON.stringify(config.data)), setData(patch) { Object.assign(this.data, JSON.parse(JSON.stringify(patch))) } }
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
config.pageLifetimes.show.call(page); await flush()
config.pageLifetimes.hide.call(page)
resolveFirst(envelope([record])); await flush()
assert.equal(page.data.historyState, 'UNAVAILABLE', 'hidden page must ignore late ready response')
config.pageLifetimes.show.call(page); await flush()
resolveFirst(envelope([record], record.id)); await flush()
assert.equal(page.data.historyState, 'READY'); assert.equal(page.data.hasMore, true)
config.methods.loadMoreHistory.call(page); config.methods.loadMoreHistory.call(page); await flush()
assert.equal(listReads, 3, 'one initial read per show + one guarded load-more')
const second = { ...record, id: '22222222-2222-2222-2222-222222222222', completedAt: '2026-10-12T00:00:00Z' }
resolveFirst(envelope([second])); await flush()
assert.equal(page.data.records.length, 2); assert.equal(page.data.hasMore, false)
config.lifetimes.detached.call(page)
assert.ok(callbacks.every(request => !request.url.includes('profile') && !request.url.includes('recommendation')))
console.log('PASS: History Provider states/strict provenance/metadata/auth/no fixture fallback; page stale-response isolation and guarded pagination')
let authenticationCalls = 0
for (const capability of [
  { statusCode: 404, data: {} },
  { statusCode: 200, data: { contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_history_capability_v1', availability: 'unavailable', source: null } },
  { statusCode: 200, data: { contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_history_capability_v1', availability: 'ready', source: 'PRODUCTION_UNAPPROVED' } },
]) {
  const result = await client({ environment: () => 'develop', developmentBackendOrigin: () => 'https://test-only.example',
    login: async () => { authenticationCalls++; throw new Error('must not authenticate') }, request: async () => capability }).readPage()
  assert.ok(['UNAVAILABLE', 'ERROR'].includes(result.state))
}
assert.equal(authenticationCalls, 0)
console.log('PASS: missing/disabled/unapproved-source capability never triggers C5 login')
