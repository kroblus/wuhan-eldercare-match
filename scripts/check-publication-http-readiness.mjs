// Actual compiled Mini Program code -> loopback HTTP -> Spring Controllers ->
// disposable MySQL. Requires the test-classpath PublicationReaderFixtureServer.
// A private .local transport alias keeps the product's loopback prohibition intact.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const settingsPath = process.argv[2]
assert.ok(settingsPath?.endsWith('.private.json'), 'Pass the private reader-fixture settings path')
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''))
assert.equal(settings.fixtureOnly, true)
assert.equal(settings.protocolDataEnvironment, 'PRODUCTION')
const base = new URL(settings.baseUrl)
assert.equal(base.hostname, '127.0.0.1')
assert.equal(base.protocol, 'http:')
const id = settings.institutionId
assert.ok(id.startsWith('synthetic-reader-'))
let cookie = '', csrf = '', fault = '', calls = 0, timeoutMs = 15000
const results = []
const admin = '/api/v1/p1-service/admin'
async function request(route, method = 'GET', body) {
  const response = await fetch(base.origin + route, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Cookie: cookie,
      'X-P1-CSRF': csrf, 'X-P1-Admin-Request': '1' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  assert.ok(response.ok, 'HTTP_' + response.status + '_' + (data.code || 'FAILED'))
  if (route.endsWith('/login')) cookie = response.headers.get('set-cookie').split(';')[0]
  return data
}
const proxy = http.createServer(async (req, res) => {
  // Public-only fault injector. Never forwards credentials or private routes.
  if (!/^\/api\/v1\/institution-publications\//.test(req.url) || req.method !== 'GET') { res.writeHead(403); return res.end() }
  assert.equal(req.headers.cookie, undefined)
  assert.equal(req.headers.authorization, undefined)
  calls++
  const selectedFault = fault
  if (selectedFault === 'disconnect') return req.socket.destroy()
  if (selectedFault === 'timeout') { await new Promise(resolve => setTimeout(resolve, 100)); if (res.destroyed) return }
  if (selectedFault === '503' || selectedFault === '404') { res.writeHead(Number(selectedFault), { 'Content-Type': 'application/json' }); return res.end('{}') }
  try {
    const upstream = await fetch(base.origin + req.url, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    const data = await upstream.json()
    if (selectedFault === 'schema') data.contractVersion = 'invalid'
    if (selectedFault === 'identity') data.institutionId = 'synthetic-wrong-identity'
    if (selectedFault === 'environment') data.dataEnvironment = 'SYNTHETIC_TEST_ONLY'
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data))
  } catch { res.writeHead(502); res.end('{}') }
})
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
const local = 'http://127.0.0.1:' + proxy.address().port
let origin = 'http://publication-readiness.local:' + proxy.address().port
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getStorageSync: key => key === '__dev_institution_publication_origin_v1' ? origin : undefined,
  request(input) {
    const parsed = new URL(input.url)
    assert.equal(parsed.hostname, 'publication-readiness.local')
    fetch(local + parsed.pathname, { method: input.method, headers: input.header, redirect: 'error',
      signal: AbortSignal.timeout(Math.min(input.timeout, timeoutMs)) })
      .then(async response => input.success({ statusCode: response.status, data: await response.json() })).catch(input.fail)
  },
}
try {
  csrf = (await request(admin + '/login', 'POST', { username: settings.adminUsername, password: settings.adminPassword })).csrfToken
  const runtime = createWechatTsRuntime(loadWechatTypeScript().ts, { wx })
  const load = name => runtime.load(path.resolve('dist/production/miniprogram/' + name + '.js'))
  const client = load('services/institution-publications').institutionPublicationClient
  const provider = load('runtime/institution-catalog-provider')
  const page = load('services/institution-list-detail-page')
  const v1 = await client.load()
  const record = v1.catalog.records.find(row => row.institutionId === id)
  assert.equal(record.recordRevision, 1, 'Start a fresh disposable reader fixture for each run')
  const identity = { institutionId: id, recordRevision: 1 }
  const context = page.institutionSourceContextRegistry.register({
    datasetVersion: v1.catalog.datasetVersion, datasetMode: 'PRODUCTION', evaluationAsOf: new Date().toISOString(),
    recommendationContractVersion: 'recommendation-contract-v2', recommendationRulesetVersion: 'recommendation-ruleset-v2',
    recommendationPolicyVersion: 'conservative-exact-with-conditional-v1', institutionContractVersion: 'institution-contract-v1.1',
    institutionCapabilityContractVersion: 'institution-capability-contract-v1',
    manifest: [{ identity, recordProvenance: record.recordProvenance, recordStatus: record.recordStatus, disposition: 'included' }],
    candidates: [{ identity, group: 'cards', order: 0, tier: 'EXACT', reasons: [], differences: [] }],
  })
  assert.ok(context.ok)
  const pinned = JSON.stringify(page.institutionSourceContextRegistry.resolve(context.value))
  let draft = (await request(admin + '/institutions/' + id + '/draft')).item
  const name2 = '合成历史读取机构第二版'
  draft.record.identity.name.value = name2
  draft.record.evidence.filter(e => e.fieldPath === 'identity.name').forEach(e => { e.valueSnapshot.value = name2 })
  draft.publicProfile.name = name2
  draft.publicProfile.historyNote = '第二版合成介绍；旧版内容必须保留'
  draft.publicProfile.prices[0].bed += 100
  draft.publicProfile.prices[0].total += 100
  draft = (await request(admin + '/institutions/' + id + '/draft', 'PUT', {
    expectedDraftRevision: draft.draftRevision, record: draft.record, publicProfile: draft.publicProfile,
  })).item
  assert.equal(draft.status, 'DRAFT')
  draft = (await request(admin + '/institutions/' + id + '/confirm', 'POST', { expectedDraftRevision: draft.draftRevision,
    sourceReference: 'SYNTHETIC_READER_FIXTURE_ONLY', confirmedBy: '合成测试人', confirmedOn: new Date().toISOString().slice(0, 10) })).item
  const operation = { operationId: randomUUID(), expectedDraftRevision: draft.draftRevision }
  const publish = await request(admin + '/institutions/' + id + '/publish', 'POST', operation)
  assert.equal(publish.publication.recordRevision, 2)
  const v2 = await client.load()
  assert.equal(v2.publicProfiles.find(p => p.institutionId === id).profile.prices[0].total, 2600)
  assert.equal((await provider.readModeCatalog()).records.find(r => r.institutionId === id).identity.name.value, name2)
  const old = await request('/api/v1/institution-publications/' + id + '/revisions/1')
  assert.equal(old.publicProfile.prices[0].total, 2500)
  assert.equal(old.record.identity.name.value, record.identity.name.value)
  results.push('Actual Controller/MySQL current V2 and immutable V1 name, price and public profile')
  const route = { identity, source: 'recommendation', sourceContextRef: context.value }
  for (let i = 0; i < 2; i++) {
    const detail = await page.buildInstitutionDetailPageSnapshot(route)
    assert.ok(detail.ok, JSON.stringify(detail.error))
    assert.equal(detail.value.identity.recordRevision, 1)
    assert.equal(detail.value.sections.basic.name.value, record.identity.name.value)
  }
  assert.equal(JSON.stringify(page.institutionSourceContextRegistry.resolve(context.value)), pinned)
  results.push('Built recommendation detail retains V1 across re-entry; source context unchanged')
  for (const [type, expected] of [['404', 'INSTITUTION_REVISION_NOT_FOUND'], ['503', 'HISTORICAL_REVISION_PROVIDER_FAILED'],
    ['schema', 'HISTORICAL_REVISION_PROVIDER_FAILED'], ['identity', 'EXACT_IDENTITY_MISMATCH'], ['environment', 'HISTORICAL_REVISION_PROVIDER_FAILED']]) {
    fault = type
    assert.equal((await client.resolveExactRevision(identity)).error.code, expected)
    const detail = await page.buildInstitutionDetailPageSnapshot(route)
    assert.equal(detail.ok, false)
    fault = ''
    assert.equal((await page.buildInstitutionDetailPageSnapshot(route)).ok, true)
  }
  assert.equal((await client.resolveExactRevision({ institutionId: id, recordRevision: 999 })).error.code, 'INSTITUTION_REVISION_NOT_FOUND')
  results.push('Real missing history plus HTTP-injected status/schema/identity/environment failures recover without latest fallback')
  for (const type of ['disconnect', 'timeout', '503', 'schema', 'environment']) {
    fault = type; timeoutMs = type === 'timeout' ? 25 : 15000
    await assert.rejects(provider.readModeCatalog())
    fault = ''; timeoutMs = 15000
    assert.equal((await provider.readModeCatalog()).records.find(r => r.institutionId === id).recordRevision, 2)
  }
  const beforeNoOrigin = calls
  origin = ''; assert.equal((await provider.readModeCatalog()).records.length, 11)
  origin = 'file:///invalid'; await assert.rejects(provider.readModeCatalog())
  assert.equal(calls, beforeNoOrigin)
  results.push('Configured failures never use bundled facts; empty origin only uses bundled directory; invalid origin has no network')
  assert.equal((await request(admin + '/institutions/' + id + '/publish', 'POST', operation)).publication.recordRevision, 2)
  assert.equal((await request('/api/v1/p1-service/config')).enabled, false)
  let demoEffects = 0
  const demo = createWechatTsRuntime(loadWechatTypeScript().ts, { wx: new Proxy({}, { get() { demoEffects++; throw Error('Unexpected Demo effect') } }) })
  assert.equal(await demo.load(path.resolve('dist/demo/miniprogram/services/institution-publications.js')).institutionPublicationClient.load(), null)
  assert.equal(demoEffects, 0)
  results.push('Publish replay returns same V2; fixture intake disabled; compiled Demo has zero publication side effects')
  await request(admin + '/logout', 'POST')
  console.log(JSON.stringify({ kind: 'REAL_LOOPBACK_HTTP_MYSQL_COMPILED_CLIENT', fixtureOnly: true,
    protocolBranch: 'PRODUCTION', realInstitutionData: false, transportAliasToLoopback: true,
    httpsOrWeChatNetworkAcceptance: false, guiAcceptance: false, publicHttpRequests: calls, results }, null, 2))
} finally {
  proxy.closeAllConnections()
  await new Promise(resolve => proxy.close(resolve))
}
