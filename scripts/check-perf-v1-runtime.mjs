import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const { ts } = loadWechatTypeScript()
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const host = def => ({ ...def, ...def.methods, data: structuredClone(def.data), patches: [], setData(patch) { this.patches.push(patch); Object.assign(this.data, patch) } })
for (const mode of ['demo', 'production']) {
  let definition
  const wx = { cloud: {}, getStorageSync() {}, getAppBaseInfo: () => ({ fontSizeSetting: 16 }), getSystemInfoSync: () => ({ fontSizeSetting: 16 }),
    getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }) }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, Component(d) { definition = d }, Page(d) { definition = d }, setTimeout, clearTimeout })
  const load = file => rt.load(path.join('dist', mode, 'miniprogram', file + '.js'))
  load('app')
  const session = mode === 'demo' ? load('demo/session') : null
  if (session) await session.loadDemo()
  const catalog = await load('services/institution-catalog-v1-2-1').institutionCatalogServiceV121.loadCatalog()
  assert.ok(catalog.ok)
  const createResolver = load('services/institution-record-resolver').createInstitutionCurrentCatalogResolverV121
  let pending = deferred(), reads = 0
  const resolver = createResolver({ loadCatalog() { reads++; return pending.promise } }, { sharePendingLoads: true })
  const first = resolver.loadCurrentCatalog(), second = resolver.loadCurrentCatalog()
  assert.equal(reads, 1)
  pending.resolve(catalog)
  const [a, b] = await Promise.all([first, second])
  assert.ok(a.ok && b.ok)
  assert.notEqual(a.value, b.value)
  a.value.records[0].institutionId = 'TEST_ONLY-mutated-consumer'
  assert.notEqual(a.value.records[0].institutionId, b.value.records[0].institutionId)
  const changed = structuredClone(catalog)
  changed.value.datasetVersion = 'TEST_ONLY-new-catalog-version'
  pending = deferred()
  const refreshed = resolver.loadCurrentCatalog()
  assert.equal(reads, 2)
  pending.resolve(changed)
  assert.equal((await refreshed).value.datasetVersion, changed.value.datasetVersion)
  pending = deferred()
  const failures = [resolver.loadCurrentCatalog(), resolver.loadCurrentCatalog()]
  pending.reject(new Error('TEST_ONLY-provider-failure'))
  assert.ok((await Promise.all(failures)).every(r => !r.ok && r.error.code === 'PROVIDER_LOAD_FAILED'))
  pending = deferred()
  const recovered = resolver.loadCurrentCatalog()
  pending.resolve(catalog)
  assert.ok((await recovered).ok)
  assert.equal(reads, 4)
  pending = deferred()
  const invalid = resolver.loadCurrentCatalog()
  pending.resolve({ ok: true, value: { ...catalog.value, currentPointers: [] } })
  assert.equal((await invalid).ok, false, 'shared read retains envelope and pointer validation')

  const app = load('services/institution-list-detail-page')
  const original = app.buildInstitutionListPageSnapshot
  const snapshot = await original(null)
  assert.ok(snapshot.ok)
  let pageReadCount = 0
  pending = deferred()
  app.buildInstitutionListPageSnapshot = () => { pageReadCount++; return pending.promise }
  load('pages/home/index')
  const homeDef = definition, home = host(homeDef)
  homeDef.lifetimes.attached.call(home); homeDef.pageLifetimes.show.call(home)
  assert.equal(pageReadCount, 1, 'attached + first show use one read')
  // Explicit Demo reset/retry is never lost while the first load is pending.
  home.retryLoad(); home.retryLoad()
  pending.resolve(snapshot); await flush()
  assert.equal(pageReadCount, 2, 'explicit refreshes coalesce to one fresh queued read')
  assert.equal(home.data.isLoading, false)
  homeDef.pageLifetimes.hide.call(home); homeDef.pageLifetimes.show.call(home); await flush()
  assert.equal(pageReadCount, 3, 'return refreshes even after first-load optimization')
  const count = home.data.resultCount
  for (const keyword of ['安', '安宁', '不存在', '']) {
    home.patches = []; home.onSearchInput({ detail: { value: keyword } })
    assert.equal(home.patches.length, 1)
  }
  assert.equal(home.data.resultCount, count)
  home.toggleDirectory(); assert.equal(home.data.institutions.length, count)
  home.clearSearch(); assert.equal(home.data.institutions.length, 2)
  homeDef.lifetimes.detached.call(home)

  load('pages/institution/index')
  const listDef = definition, list = host(listDef)
  pending = deferred(); list.onLoad({}); list.onUnload()
  const prior = list.patches.length
  pending.resolve(snapshot); await flush()
  assert.equal(list.patches.length, prior, 'unloaded page ignores late list result')
  app.buildInstitutionListPageSnapshot = original
  const active = host(listDef); active.onLoad({}); await flush()
  assert.equal(active.data.pageState, 'ready')
  for (const field of ['items', 'recommendedItems', 'otherItems']) assert.equal(field in active.data.viewModel, false)
  const all = active.data.visibleItems.map(item => item.key)
  active.onSearchInput({ detail: { value: '不存在' } }); assert.equal(active.data.visibleItems.length, 0)
  active.clearKeyword(); assert.deepEqual(active.data.visibleItems.map(item => item.key), all)
  active.onUnload()
  if (session) {
    session.resetDemo()
    assert.equal(session.isDemoReady(), false)
    assert.equal(load('runtime/directory-metadata').readDirectoryMetadata().length, 0)
    const empty = await original(null)
    assert.equal(empty.value.displayInstitutions.length, 0, 'settled reads do not retain reset Demo facts')
    await session.loadDemo()
    assert.equal(session.isDemoReady(), true)
    assert.equal(load('runtime/directory-metadata').readDirectoryMetadata().length, 12)
  }
  console.log(`PASS ${mode}: overlapping reads, cloning, fresh version, pointer rejection, failure retry, initial show, queued refresh, return, search and unload`)
}
if (process.argv.includes('--compare')) {
  const baseline = JSON.parse(fs.readFileSync('output/perf-v1-20261028/baseline.json'))
  const after = JSON.parse(fs.readFileSync('output/perf-v1-20261028/after.json'))
  for (const mode of ['demo', 'production']) assert.deepEqual(after.modes[mode].signatures, baseline.modes[mode].signatures, mode + ' cards, Home and visible list remain byte-identical at the fixed evaluation time')
  console.log('PASS baseline/after display parity; no device timing claim')
}
