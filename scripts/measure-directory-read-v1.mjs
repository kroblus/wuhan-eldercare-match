// Compiled-module Node measurements, not WeChat startup/render/device timings.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const label = process.argv[2]
assert.ok(label === 'baseline' || label === 'after', 'Use baseline or after')
const output = 'output/directory-read-v1-20261028'
fs.mkdirSync(output, { recursive: true })
const { ts } = loadWechatTypeScript()
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const bytes = value => Buffer.byteLength(JSON.stringify(value))
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve() }
const summary = values => ({ samples: values, median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] })
const report = { node: process.version, typescript: ts.version, evaluationAsOf: '2026-10-28T00:00:00.000Z', samples: 7, warmup: 1, metric: 'Node VM execution; internal snapshot JSON bytes; static require graph, not runtime module-loading evidence', modes: {} }

for (const mode of ['demo', 'production']) {
  const root = path.resolve('dist', mode, 'miniprogram')
  let definition
  const wx = { cloud: {}, getStorageSync() {}, getAppBaseInfo: () => ({ fontSizeSetting: 16 }), getSystemInfoSync: () => ({ fontSizeSetting: 16 }),
    getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }) }
  const rt = createWechatTsRuntime(ts, { wx, App() {}, Component(d) { definition = d }, Page(d) { definition = d }, setTimeout, clearTimeout })
  vm.runInContext("const RealDate = Date; Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-28T00:00:00.000Z'])) } static now() { return RealDate.parse('2026-10-28T00:00:00.000Z') } }", rt.context)
  const load = file => rt.load(path.join(root, file + '.js'))
  load('app')
  if (mode === 'demo') await load('demo/session').loadDemo()
  const provider = load('services/institution-catalog-v1-2-1').mockInstitutionCatalogProviderV121
  const application = load('services/institution-list-detail-page')
  const detail = load('pages/institution/detail-view-model')
  const originalProvider = provider.loadCatalog, originalDetail = application.institutionDetailApplicationV12.build, originalView = detail.createInstitutionDetailPageViewModel
  let counters
  const reset = () => { counters = { providerReads: 0, fullDetailBuilds: 0, fullDetailViewModels: 0, directoryReadBatches: 0, projectedJsonBytes: 0 } }
  provider.loadCatalog = (...args) => { counters.providerReads++; return originalProvider(...args) }
  application.institutionDetailApplicationV12.build = async (...args) => {
    counters.fullDetailBuilds++
    const result = await originalDetail(...args)
    if (result.ok) counters.projectedJsonBytes += bytes(result.value)
    return result
  }
  detail.createInstitutionDetailPageViewModel = (...args) => { counters.fullDetailViewModels++; return originalView(...args) }
  if (fs.existsSync(path.join(root, 'services/institution-directory-read.js'))) {
    const service = load('services/institution-directory-read').institutionDirectoryReadService, original = service.read
    service.read = async (...args) => {
      counters.directoryReadBatches++
      const results = await original(...args)
      results.forEach(result => { if (result.ok) counters.projectedJsonBytes += bytes(result.value) })
      return results
    }
  }
  const view = load('pages/institution/list-view-model'), decorate = load('pages/institution/directory-presentation').decorateDirectoryCards
  load('pages/home/index'); const homeDefinition = definition
  load('pages/institution/index'); const listDefinition = definition
  const host = def => ({ ...def, ...def.methods, data: structuredClone(def.data), setData(patch) { Object.assign(this.data, patch) } })
  const times = { directory: [], home: [], list: [] }, counts = {}, signatures = {}
  for (let sample = -1; sample < 7; sample++) {
    reset(); let start = performance.now()
    const result = await application.buildInstitutionListPageSnapshot(null)
    assert.ok(result.ok)
    const cards = await decorate(view.createInstitutionListPageViewModel(result.value).items, result.value.evaluationAsOf)
    if (sample >= 0) times.directory.push(performance.now() - start)
    counts.directory = { ...counters, cards: cards.length }; signatures.cards = digest(cards)
    reset(); start = performance.now()
    const home = host(homeDefinition)
    homeDefinition.lifetimes.attached.call(home); homeDefinition.pageLifetimes.show.call(home); await flush()
    assert.ok(!home.data.isLoading && !home.data.loadError)
    if (sample >= 0) times.home.push(performance.now() - start)
    counts.home = { ...counters }; signatures.home = digest(home.data)
    homeDefinition.lifetimes.detached.call(home)
    reset(); start = performance.now()
    const list = host(listDefinition); list.onLoad({}); await flush()
    assert.equal(list.data.pageState, 'ready')
    if (sample >= 0) times.list.push(performance.now() - start)
    counts.list = { ...counters }; signatures.visibleItems = digest(list.data.visibleItems); list.onUnload()
  }
  const reachable = new Set()
  const visit = file => {
    if (reachable.has(file)) return
    reachable.add(file)
    const code = fs.readFileSync(path.join(root, file), 'utf8')
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])) + '.js'
      visit(target)
    }
  }
  visit('pages/home/index.js')
  report.modes[mode] = { timingsMs: Object.fromEntries(Object.entries(times).map(([name, values]) => [name, summary(values)])), counts, signatures,
    homeStaticGraph: { modules: reachable.size, rawJsBytes: [...reachable].reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0), files: [...reachable].sort() } }
}
if (label === 'after') {
  const baseline = JSON.parse(fs.readFileSync(output + '/baseline.json'))
  for (const mode of ['demo', 'production']) {
    assert.deepEqual(report.modes[mode].signatures, baseline.modes[mode].signatures, mode + ' visible outputs changed')
    for (const counts of Object.values(report.modes[mode].counts)) {
      assert.equal(counts.fullDetailBuilds, 0, 'Directory must not build full Detail')
      assert.equal(counts.fullDetailViewModels, 0, 'Directory must not build full Detail ViewModel')
      assert.equal(counts.directoryReadBatches, 1, 'One bounded batch per directory read')
    }
  }
}
fs.writeFileSync(output + '/' + label + '.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ label, modes: Object.fromEntries(Object.entries(report.modes).map(([mode, result]) => [mode, { timingsMs: result.timingsMs, counts: result.counts, signatures: result.signatures, staticModules: result.homeStaticGraph.modules }])) }, null, 2))
