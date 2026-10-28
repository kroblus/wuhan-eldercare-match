// Local compiled-module benchmark. Node timings are NOT WeChat render/device timings.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const label = process.argv[2] || 'after'
assert.ok(['baseline', 'after'].includes(label))
const out = 'output/perf-v1-20261028'
fs.mkdirSync(out, { recursive: true })
const { ts } = loadWechatTypeScript()
const bytes = value => Buffer.byteLength(JSON.stringify(value))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const stats = values => ({ samples: values, median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], min: Math.min(...values), max: Math.max(...values) })
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const report = { environment: { node: process.version, platform: process.platform, typescript: ts.version, evaluationAsOf: '2026-10-28T00:00:00.000Z', samples: 7, warmup: 1, metric: 'Node VM compiled-module execution + JSON byte proxy; no native render/network/device timing' }, modes: {} }
for (const mode of ['demo', 'production']) {
  const root = `dist/${mode}/miniprogram`
  const files = walk(root).map(file => ({ file: path.relative(root, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size }))
  const extensions = {}
  for (const file of files) extensions[path.extname(file.file)] = (extensions[path.extname(file.file)] || 0) + file.bytes
  let definition
  const wx = { cloud: {}, getStorageSync() {}, getAppBaseInfo: () => ({ fontSizeSetting: 16 }),
    getSystemInfoSync: () => ({ fontSizeSetting: 16 }),
    getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }) }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, Page(d) { definition = d }, Component(d) { definition = d }, setTimeout, clearTimeout })
  vm.runInContext("const RealDate = Date; Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-28T00:00:00.000Z'])) } static now() { return RealDate.parse('2026-10-28T00:00:00.000Z') } }", rt.context)
  const load = file => rt.load(path.join(root, file + '.js'))
  load('app')
  if (mode === 'demo') await load('demo/session').loadDemo()
  const provider = load('services/institution-catalog-v1-2-1').mockInstitutionCatalogProviderV121
  const originalLoad = provider.loadCatalog
  let providerReads = 0
  provider.loadCatalog = (...args) => { providerReads++; return originalLoad(...args) }
  const app = load('services/institution-list-detail-page')
  const view = load('pages/institution/list-view-model')
  const decorate = load('pages/institution/directory-presentation').decorateDirectoryCards
  const host = def => ({ ...def, ...def.methods, data: structuredClone(def.data), patches: [], setData(patch) { this.patches.push({ bytes: bytes(patch), keys: Object.keys(patch) }); Object.assign(this.data, patch) } })
  const measures = { directory: [], homeEnter: [], homeReturn: [], search: [], listEnter: [] }
  const counts = {}, signatures = {}
  for (let sample = -1; sample < 7; sample++) {
    providerReads = 0
    let start = performance.now()
    const result = await app.buildInstitutionListPageSnapshot(null)
    assert.ok(result.ok)
    const cards = await decorate(view.createInstitutionListPageViewModel(result.value).items, result.value.evaluationAsOf)
    const elapsed = performance.now() - start
    if (sample >= 0) measures.directory.push(elapsed)
    counts.directoryProviderReads = providerReads
    counts.institutions = cards.length
    signatures.cards = digest(cards)
    load('pages/home/index')
    // load is cached after the first iteration; retain the registered definition.
    if (!counts.homeDefinition) counts.homeDefinition = definition
    const homeDef = counts.homeDefinition
    const home = host(homeDef)
    providerReads = 0; start = performance.now()
    homeDef.lifetimes.attached.call(home); homeDef.pageLifetimes.show.call(home)
    await flush()
    assert.equal(home.data.isLoading, false); assert.equal(home.data.loadError, false)
    if (sample >= 0) measures.homeEnter.push(performance.now() - start)
    counts.homeEnter = { providerReads, setData: home.patches.length, bytes: home.patches.reduce((sum, p) => sum + p.bytes, 0) }
    signatures.home = digest(home.data)
    providerReads = 0; home.patches = []; start = performance.now()
    homeDef.pageLifetimes.hide.call(home); homeDef.pageLifetimes.show.call(home); await flush()
    if (sample >= 0) measures.homeReturn.push(performance.now() - start)
    counts.homeReturn = { providerReads, setData: home.patches.length, bytes: home.patches.reduce((sum, p) => sum + p.bytes, 0) }
    home.patches = []; start = performance.now()
    for (const keyword of ['安', '安宁', '不存在的机构', '']) home.onSearchInput({ detail: { value: keyword } })
    if (sample >= 0) measures.search.push(performance.now() - start)
    counts.searchFourInputs = { setData: home.patches.length, bytes: home.patches.reduce((sum, p) => sum + p.bytes, 0) }
    assert.equal(home.data.resultCount, cards.length)
    assert.equal(home.data.institutions.length, 2)
    home.toggleDirectory(); assert.equal(home.data.institutions.length, cards.length)
    home.clearSearch(); assert.equal(home.data.institutions.length, 2)
    homeDef.lifetimes.detached.call(home)
    load('pages/institution/index')
    if (!counts.listDefinition) counts.listDefinition = definition
    const listDef = counts.listDefinition, list = host(listDef)
    start = performance.now(); list.onLoad({}); await flush()
    assert.equal(list.data.pageState, 'ready')
    if (sample >= 0) measures.listEnter.push(performance.now() - start)
    counts.listEnter = { setData: list.patches.length, bytes: list.patches.reduce((sum, p) => sum + p.bytes, 0), largestPatchBytes: Math.max(...list.patches.map(p => p.bytes)) }
    signatures.listVisible = digest(list.data.visibleItems)
    list.onUnload()
  }
  delete counts.homeDefinition; delete counts.listDefinition
  const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json')))
  report.modes[mode] = { package: { rawBytes: files.reduce((sum, f) => sum + f.bytes, 0), extensions, topTen: files.sort((a, b) => b.bytes - a.bytes).slice(0, 10), files: files.length, routes: appConfig.pages.length, subPackages: appConfig.subPackages || [], lazyCodeLoading: appConfig.lazyCodeLoading, componentFramework: appConfig.componentFramework }, timingsMs: Object.fromEntries(Object.entries(measures).map(([key, values]) => [key, stats(values)])), counts, signatures }
}
fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
