// Source-only synthetic boundary tests. No real institution publishing or network calls.
import assert from 'node:assert/strict'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeInitialReferenceRecordV121, makeInitialReferenceCatalogWithRecordsV121, reidentifyInitialReferenceRecordV121 } from './fixtures/initial-reference-v1-fixtures.mjs'
const { ts } = loadWechatTypeScript(), root = process.cwd()
const clone = value => JSON.parse(JSON.stringify(value))
const rt = createWechatTsRuntime(ts, {})
const load = name => rt.load(path.join(root, 'miniprogram', name + '.ts'))
const module = load('services/institution-publications')
for (const origin of ['https://192.168.1.2', 'https://10.0.0.1', 'https://[fc00::1]', 'https://service.local',
  'https://service.internal', 'https://service.test', 'https://service.invalid', 'https://service.example',
  'https://localhost', 'https://user:password@example.org', 'https://example.org/api', 'https://example.org?token=x',
  'http://example.org', 'https://2130706433', 'https://0x7f.0.0.1']) {
  assert.equal(module.isReleasePublicationOrigin(origin), false, 'Reject non-release origin: ' + origin)
}
assert.equal(module.isReleasePublicationOrigin('https://public.example.org'), true)
assert.equal(module.isReleasePublicationOrigin('https://public.example.org:8443'), true)
const legacy = load('content/p1-public-institution').p1Institution
const a = makeInitialReferenceRecordV121(), b = reidentifyInitialReferenceRecordV121(a, 'publication-synthetic-second')
for (const row of [a, b]) row.recordProvenance = 'PRODUCTION_CANDIDATE'
const body = {
  contractVersion: 'institution-publications-v1', dataEnvironment: 'SYNTHETIC_TEST_ONLY',
  catalog: makeInitialReferenceCatalogWithRecordsV121([a, b], { datasetMode: 'PRODUCTION' }),
  publicProfiles: [a, b].map(record => ({ institutionId: record.institutionId, recordRevision: record.recordRevision,
    profile: { ...clone(legacy), id: record.institutionId, name: record.identity.name.value } })),
}
let environment = 'develop', origin = 'http://192.168.7.8:18341', response = body, status = 200, calls = [], delayed
const transport = {
  environment: () => environment, developmentPublicationOrigin: () => origin,
  request: async input => { calls.push(input); if (delayed) return delayed; return { statusCode: status, data: clone(response) } },
}
const client = module.createInstitutionPublicationClient(transport, 'PRODUCTION')
const before = JSON.stringify(body)
const result = await client.load()
assert.equal(result.publicProfiles.length, 2)
assert.equal(result.publicProfiles[1].profile.name, b.identity.name.value)
assert.equal(JSON.stringify(body), before)
assert.equal(calls[0].method, 'GET')
assert.deepEqual(Object.keys(calls[0].header), ['Accept'])
result.publicProfiles[0].profile.tags.push('changed caller copy')
assert.ok(!(await client.load()).publicProfiles[0].profile.tags.includes('changed caller copy'))
const count = calls.length
assert.equal(await module.createInstitutionPublicationClient(transport, 'MOCK_DEVELOPMENT_ONLY', 'https://example.org').load(), null)
assert.equal(calls.length, count, 'Demo never requests public or private production services')
origin = ''; assert.equal(await client.load(), null)
for (const invalid of [false, 0, {}, ['https://example.org']]) {
  origin = invalid
  await assert.rejects(client.load(), /INVALID_PUBLICATION_ORIGIN/, 'Malformed storage cannot select bundled facts')
}
origin = 'file:///tmp/data'; await assert.rejects(client.load(), /INVALID_PUBLICATION_ORIGIN/)
origin = 'http://192.168.7.8:18341'
status = 503; await assert.rejects(client.load(), /PUBLICATION_LOAD_FAILED/); status = 200
response = { ...body, contractVersion: 'wrong' }; await assert.rejects(client.load())
response = clone(body); response.catalog.currentPointers[0].recordRevision++
await assert.rejects(client.load(), /INVALID_PUBLICATION_CATALOG/)
for (const change of [
  value => { value.publicProfiles[0].recordRevision++ },
  value => { value.publicProfiles[0].profile.id = 'different' },
  value => { value.publicProfiles[0].profile.name = 'different name' },
  value => { value.publicProfiles.push(value.publicProfiles[0]) },
  value => { value.publicProfiles[0].profile.prices[0].total++ },
  value => { value.publicProfiles[0].profile.prices[0].bed = -1 },
  value => { value.publicProfiles[0].profile.tags = ['x'.repeat(101)] },
  value => { value.publicProfiles[0].profile.schemaVersion = 'unknown' },
]) { response = clone(body); change(response); await assert.rejects(client.load()) }
response = body
const normalRequest = transport.request
for (const reason of ['ENOTFOUND', 'ECONNREFUSED', 'request:fail timeout']) {
  transport.request = async () => { throw new Error(reason) }
  await assert.rejects(client.load(), error => error.message === reason)
}
transport.request = normalRequest
assert.equal((await client.load()).publicProfiles.length, 2, 'DNS/connect/timeout failures do not cache a failed result')
environment = 'release'; assert.equal(await client.load(), null, 'A develop-only address cannot enable release network access')
const release = module.createInstitutionPublicationClient(transport, 'PRODUCTION', 'https://example.org')
await assert.rejects(release.load(), /PUBLICATION_LOAD_FAILED/, 'Synthetic catalog cannot enter release')
response = { ...body, dataEnvironment: 'PRODUCTION' }
assert.equal((await release.load()).dataEnvironment, 'PRODUCTION')
assert.match(calls.at(-1).url, /^https:\/\/example.org\/api\/v1\/institution-publications\/catalog$/)
await assert.rejects(module.createInstitutionPublicationClient(transport, 'PRODUCTION', 'http://192.168.7.8:18341').load(), /INVALID_PUBLICATION_ORIGIN/)
environment = 'develop'; response = body
let resolveDelayed
delayed = new Promise(resolve => { resolveDelayed = resolve })
const inFlight = client.load(); origin = 'http://192.168.7.9:18341'
resolveDelayed({ statusCode: 200, data: body }); await assert.rejects(inFlight, /PUBLICATION_SOURCE_CHANGED/)
delayed = null; origin = 'http://192.168.7.8:18341'
assert.equal((await client.load()).publicProfiles.length, 2, 'A failed read is retried freshly')
console.log('PASS publication client: no-auth read, source isolation, exact profile links, schema, retry and origin changes')

// Publishing any current pointer changes the pool version. An older recommendation
// must still resolve its exact record, including when a different institution changed.
const identity = { institutionId: a.institutionId, recordRevision: a.recordRevision }
const exact = { contractVersion: body.contractVersion, dataEnvironment: 'PRODUCTION', ...identity, record: clone(a), publicProfile: null }
response = exact
assert.equal((await client.resolveExactRevision(identity)).ok, true)
assert.ok(calls.at(-1).url.endsWith('/' + encodeURIComponent(a.institutionId) + '/revisions/' + a.recordRevision))
for (const [reply, code] of [
  [{ ...exact, recordRevision: a.recordRevision + 1 }, 'EXACT_IDENTITY_MISMATCH'],
  [{ ...exact, record: b }, 'EXACT_IDENTITY_MISMATCH'],
  [{ ...exact, record: { ...a, contractVersion: 'unsupported' } }, 'INVALID_HISTORICAL_INSTITUTION_RECORD'],
  [{ ...exact, dataEnvironment: 'SYNTHETIC_TEST_ONLY' }, 'HISTORICAL_REVISION_PROVIDER_FAILED'],
]) { response = reply; assert.equal((await client.resolveExactRevision(identity)).error.code, code) }
status = 404; assert.equal((await client.resolveExactRevision(identity)).error.code, 'INSTITUTION_REVISION_NOT_FOUND')
status = 503; assert.equal((await client.resolveExactRevision(identity)).error.code, 'HISTORICAL_REVISION_PROVIDER_FAILED')
status = 200; response = exact
const { createInstitutionCurrentCatalogResolverV121 } = load('services/institution-record-resolver')
const registry = load('services/institution-source-context').createInstitutionSourceContextRegistry()
const evaluationAsOf = '2026-09-01T09:00:00.000Z'
const context = registry.register({
  datasetVersion: body.catalog.datasetVersion, datasetMode: 'PRODUCTION', evaluationAsOf,
  recommendationContractVersion: 'recommendation-contract-v2', recommendationRulesetVersion: 'recommendation-ruleset-v2',
  recommendationPolicyVersion: 'conservative-exact-with-conditional-v1', institutionContractVersion: 'institution-contract-v1.1',
  institutionCapabilityContractVersion: 'institution-capability-contract-v1',
  manifest: [a, b].map(r => ({ identity: { institutionId: r.institutionId, recordRevision: r.recordRevision }, recordProvenance: r.recordProvenance, recordStatus: r.recordStatus, disposition: r === a ? 'included' : 'excluded' })),
  candidates: [{ identity, group: 'cards', order: 0, tier: 'EXACT', reasons: [], differences: [] }],
})
assert.equal(context.ok, true)
const current = { ...clone(body.catalog), datasetVersion: 'publication-next-pool-version' }
const detail = load('services/institution-list-detail-application').createInstitutionDetailApplicationServiceV12({
  currentCatalogResolver: createInstitutionCurrentCatalogResolverV121({ loadCatalog: async () => ({ ok: true, value: current }) }),
  historicalRevisionResolver: client, sourceContextRegistry: registry,
})
const detailInput = { identity, source: 'recommendation', sourceContextRef: context.value, evaluationAsOf }
const historical = await detail.build(detailInput)
assert.equal(historical.ok, true, JSON.stringify(historical))
assert.equal(historical.value.identity.recordRevision, a.recordRevision)
current.records[0].recordRevision++
current.records[0].evidence.forEach(e => { e.recordRevision = current.records[0].recordRevision })
current.currentPointers[0].recordRevision++
assert.equal((await detail.build(detailInput)).value.identity.recordRevision, a.recordRevision, 'An updated institution also retains the original recommendation revision')
status = 404
assert.equal((await detail.build(detailInput)).ok, false, 'Missing old versions never silently read the latest one')
status = 200; response = body
const previousCalls = calls.length
assert.equal((await module.createInstitutionPublicationClient(transport, 'MOCK_DEVELOPMENT_ONLY').resolveExactRevision(identity)).error.code, 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED')
assert.equal(calls.length, previousCalls)
console.log('PASS exact history: pool-version drift, same-institution update, exact identity/schema/environment and no latest fallback')

let definition, published = clone(body), config
const pageRuntime = createWechatTsRuntime(ts, { Page(value) { definition = value }, wx: {} })
const pageLoad = name => pageRuntime.load(path.join(root, 'miniprogram', name + '.ts'))
const pagePublic = pageLoad('services/institution-publications').institutionPublicationClient
const p1 = pageLoad('services/p1-service-client')
config = { enabled: true, datasetMode: 'SYNTHETIC_TEST_ONLY', platformContact: { label: '平台咨询', phone: null },
  notice: { version: 'synthetic-notice', text: '合成测试' },
  institutions: body.publicProfiles.map(p => ({ institutionId: p.institutionId, institutionName: p.profile.name, recordRevision: p.recordRevision })),
}
pagePublic.load = async () => published
p1.p1Client.loadConfig = async () => config
pageLoad('pages/service/intake/index')
const tick = () => new Promise(resolve => setImmediate(resolve))
const page = () => { const p = { ...definition, data: clone(definition.data), setData(patch) { Object.assign(this.data, patch) } }; p.onLoad(); return p }
const p = page(); await tick()
assert.equal(p.data.publicSynthetic, true)
assert.equal(p.data.publicProfiles.length, 2)
assert.equal(p.data.institutionIds[2], b.institutionId)
p.choosePublicInstitution({ detail: { value: '1' } })
assert.equal(p.data.institution.id, b.institutionId)
published = { ...body, publicProfiles: [...body.publicProfiles].reverse() }
await p.loadPublicInstitutions(); assert.equal(p.data.institution.id, b.institutionId, 'Reordering retains chosen identity')
assert.match(p.data.publicPriceSummary, /3600—7200/)
published = { ...body, publicProfiles: [{ ...body.publicProfiles[0], profile: { ...body.publicProfiles[0].profile, prices: [] } }] }
await p.loadPublicInstitutions(); assert.equal(p.data.publicPriceSummary, '')
pagePublic.load = async () => { throw Error('unavailable') }
await p.loadPublicInstitutions()
assert.equal(p.data.institution, null); assert.ok(p.data.publicError); assert.equal(p.data.publicProfiles.length, 0)
pagePublic.load = async () => ({ ...body, publicProfiles: [] })
await p.loadPublicInstitutions(); assert.equal(p.data.institution, null); assert.equal(p.data.publicError, '')
pagePublic.load = async () => null
await p.loadPublicInstitutions(); assert.equal(p.data.institution.id, legacy.id); assert.equal(p.data.publicOnline, false)

// Request target is the selected service-access identity, independent of the browsed public profile.
p.choose({ currentTarget: { dataset: { field: 'institutionIndex' } }, detail: { value: '2' } })
p.setData({ contactName: '合成联系人', contactPhone: '13800000000', consent: true })
let submitted
p1.p1Client.submit = async input => { submitted = clone(input); throw Error('timeout') }
await p.submit(); assert.equal(submitted.institutionId, b.institutionId); assert.equal(p.data.pending, true)
config = { ...config, institutions: [] }
await p.loadConfig()
assert.equal(p.data.institutionIds[p.data.institutionIndex], b.institutionId, 'Unknown submission retains original identity after access removal')
const originalInput = clone(submitted)
await p.submit(); assert.deepEqual(submitted, originalInput, 'Retry uses the original immutable request, not current service options')
p1.p1Pending.input = null
let resolvePage
pagePublic.load = () => new Promise(resolve => { resolvePage = resolve })
const loadLater = p.loadPublicInstitutions(); p.onUnload(); p.setData({ publicError: 'unloaded' })
resolvePage(body); await loadLater; assert.equal(p.data.publicError, 'unloaded')
const afterReload = page(); await tick(); afterReload.onUnload(); resolvePage(body)
console.log('PASS publication page: multi-institution browsing, unknown prices, explicit failures, pending request identity and unload guards')

if (process.argv.includes('--built')) {
  let publicOrigin = 'http://192.168.7.8:18341', reply = { ...clone(body), dataEnvironment: 'PRODUCTION' }, httpStatus = 200
  const requests = []
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: key => key === module.DEVELOPMENT_PUBLICATION_ORIGIN_KEY ? publicOrigin : undefined,
    request(input) { requests.push({ method: input.method, url: input.url }); input.success({ statusCode: httpStatus, data: clone(input.url.includes('/revisions/') ? exact : reply) }) },
  }
  const production = createWechatTsRuntime(ts, { wx })
  const selected = production.load(path.join(root, 'dist/production/miniprogram/runtime/institution-catalog-provider.js'))
  const online = await selected.readModeCatalog()
  assert.equal(online.records.length, 2, 'Online current catalog is not merged with the bundled eleven')
  assert.deepEqual(Array.from(online.records, r => r.institutionId), [a.institutionId, b.institutionId])
  const pageEntry = production.load(path.join(root, 'dist/production/miniprogram/services/institution-list-detail-page.js'))
  const { kind: _contextKind, ...pinnedContext } = registry.resolve(context.value).value
  const pinned = pageEntry.institutionSourceContextRegistry.register(pinnedContext)
  assert.equal(pinned.ok, true)
  reply.catalog.datasetVersion = 'newer-production-pool'
  const pinnedDetail = await pageEntry.buildInstitutionDetailPageSnapshot({ identity, source: 'recommendation', sourceContextRef: pinned.value })
  assert.equal(pinnedDetail.ok, true, JSON.stringify(pinnedDetail))
  assert.equal(pinnedDetail.value.identity.recordRevision, identity.recordRevision)
  assert.ok(requests.some(r => r.url.includes('/revisions/')), 'The actual production page composition uses exact history')
  httpStatus = 503; await assert.rejects(selected.readModeCatalog()); httpStatus = 200
  reply.dataEnvironment = 'SYNTHETIC_TEST_ONLY'
  await assert.rejects(selected.readModeCatalog(), /SYNTHETIC_PUBLIC_CATALOG_NOT_ALLOWED/)
  publicOrigin = ''; assert.equal((await selected.readModeCatalog()).records.length, 11, 'Only explicit absence of an online origin uses bundled facts')
  assert.ok(requests.every(r => r.method === 'GET' && r.url.includes('/institution-publications/')))
  let effects = 0
  const demo = createWechatTsRuntime(ts, { wx: new Proxy({}, { get() { effects++; throw Error('Demo side effect') } }) })
  const demoPublic = demo.load(path.join(root, 'dist/demo/miniprogram/services/institution-publications.js'))
  assert.equal(await demoPublic.institutionPublicationClient.load(), null)
  assert.equal(effects, 0)
  console.log('PASS built adapters: online-only pool, configured failure, synthetic rejection and no Demo side effects')
}
