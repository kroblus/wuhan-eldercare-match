import assert from 'node:assert/strict'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const rt = createWechatTsRuntime(ts)
const create = rt.load('miniprogram/services/institution-vr-resource.ts').createInstitutionVrResourceResolver
const future = '2099-01-01T00:00:00.000Z', past = '2020-01-01T00:00:00.000Z'
const verified = { status: 'verified', evidenceIds: ['test-only-evidence'], verifiedAt: past, validUntil: future }
// Resolver boundary stubs only. No fixture is added to a production catalog.
const record = { institutionId: 'test-only-vr', recordRevision: 3, recordProvenance: 'PRODUCTION_CANDIDATE', recordStatus: 'published', vr: { status: 'available', verification: verified, url: { availability: 'provided', value: 'https://example.invalid/test-only-vr', verification: verified } } }
const snapshot = { contextKind: 'DIRECT_CURRENT', actions: { canOpenVr: true }, sections: { basic: { name: { value: 'TEST_ONLY VR' } }, media: { vr: { canNavigate: true } } } }
const route = { identity: { institutionId: 'test-only-vr', recordRevision: 3 }, source: 'direct', sourceContextRef: null }
const resolver = (r = record, s = snapshot, mode = 'PRODUCTION') => create({ loadCatalog: async () => ({ ok: true, value: { datasetMode: mode, records: [r] } }) }, async () => ({ ok: true, value: s }))
assert.equal((await resolver()(route)).url, record.vr.url.value)
assert.equal(await resolver()({ ...route, identity: { ...route.identity, recordRevision: 2 } }), null)
assert.equal(await resolver()({ ...route, identity: { ...route.identity, institutionId: 'other' } }), null)
assert.equal(await resolver({ ...record, recordProvenance: 'MOCK_DEVELOPMENT_ONLY' })(route), null)
assert.equal(await resolver(record, snapshot, 'MOCK_DEVELOPMENT_ONLY')(route), null)
assert.equal(await resolver(record, { ...snapshot, contextKind: 'HISTORICAL_READ_ONLY' })(route), null)
assert.equal(await resolver(record, { ...snapshot, actions: { canOpenVr: false } })(route), null)
assert.equal(await resolver({ ...record, recordStatus: 'archived' })(route), null)
for (const vr of [
  { ...record.vr, verification: { ...verified, status: 'unverified' } },
  { ...record.vr, verification: { ...verified, validUntil: past } },
  { ...record.vr, url: { ...record.vr.url, value: 'http://example.invalid/not-secure' } },
  { ...record.vr, url: { ...record.vr.url, verification: { ...verified, validUntil: past } } },
]) assert.equal(await resolver({ ...record, vr })(route), null)

// Actual Page handler, canonical route query and guarded retry on navigation failure.
let page, nav = [], reject = false
const wx = {
  navigateTo(options) { nav.push(options.url); if (reject) options.fail(); else if (options.success) options.success(); if (options.complete) options.complete() },
}
const pageRt = createWechatTsRuntime(ts, { wx, Page(v) { page = v }, getCurrentPages: () => [] })
pageRt.load('miniprogram/pages/institution/detail.ts')
const instance = { ...page, data: { ...page.data }, setData(p) { Object.assign(this.data, p) } }
// Establish the real private route through onLoad; the ordinary mock catalog will reject
// this test identity, after which the test installs only a UI snapshot for event assertions.
instance.onLoad({ institutionId: 'test-only-vr', recordRevision: '3', source: 'direct_link' })
await new Promise(resolve => setTimeout(resolve, 0))
instance.data.pageState = 'ready'; instance.data.viewModel = { media: { canOpenVr: true } }
instance.onVrTap(); instance.onVrTap()
assert.equal(nav.length, 1)
assert.match(nav[0], /^\/pages\/institution\/vr\?institutionId=test-only-vr&recordRevision=3&source=direct_link$/)
instance.onShow(); reject = true; instance.onVrTap(); instance.onVrTap()
assert.equal(nav.length, 3)
assert.equal(instance.data.actionErrorKey, 'vr')
instance.data.viewModel.media.canOpenVr = false
instance.onVrTap(); assert.equal(nav.length, 3)
console.log('PASS: VR exact revision, provenance, lifecycle availability, current verification, HTTPS, guarded canonical navigation, failure retry and unavailable action')
