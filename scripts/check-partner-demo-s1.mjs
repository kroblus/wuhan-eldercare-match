import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { checkIsolation, checkDemoJavaScript, demoFiles } from './support/partner-demo-isolation-check.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demoRoot = path.join(root, 'partner-demo/miniprogram')
const evidence = path.join(root, 'output/partner-demo-s1-isolation-shell-v0-1')
const identity = JSON.parse(readFileSync(path.join(demoRoot, 'runtime/build-identity.json'), 'utf8'))
const detached = (value) => JSON.parse(JSON.stringify(value))
const results = []
function test(name, run) {
  try { const details = run(); results.push({ name, pass: true, ...(details ? { details } : {}) }); console.log('PASS ' + name) }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error('FAIL ' + name + ': ' + error.message) }
}

// Only synthetic sentinels; no real storage, Draft import, cache, or platform calls.
function harness(overrides = {}) {
  const protectedStorage = new Map([
    ['wuhan-eldercare-match.assessment-draft.v1', { syntheticSentinel: 'legacy', provenance: 'development-synthetic' }],
    ['wuhan-eldercare-match.assessment-draft.v2', { syntheticSentinel: 'current', provenance: 'development-synthetic' }],
    ['wuhan-eldercare-match.assessment-draft.active', 'synthetic-active-pointer'],
  ])
  const before = JSON.stringify([...protectedStorage])
  const calls = []
  const imported = []
  const cache = new Map()
  let app, page
  const context = vm.createContext({
    wx: new Proxy({}, { get(_target, api) { calls.push(String(api)); throw new Error('FORBIDDEN_PLATFORM_ACCESS:' + String(api)) } }),
    App(definition) { app = definition }, Page(definition) { page = definition },
  }, { codeGeneration: { strings: false, wasm: false } })
  function load(relative) {
    assert(demoFiles.includes(relative), 'Module outside demo allowlist: ' + relative)
    if (Object.hasOwn(overrides, relative) && overrides[relative] === null) throw new Error('Synthetic missing module')
    if (cache.has(relative)) return cache.get(relative).exports
    imported.push(relative)
    const file = path.join(demoRoot, relative)
    const source = Object.hasOwn(overrides, relative) ? overrides[relative] : readFileSync(file, 'utf8')
    const module = { exports: {} }
    cache.set(relative, module)
    if (relative.endsWith('.json')) module.exports = JSON.parse(source)
    else {
      const localRequire = (specifier) => {
        assert(specifier.startsWith('.'), 'External module denied')
        let target = path.resolve(path.dirname(file), specifier)
        if (!path.extname(target)) target += '.js'
        return load(path.relative(demoRoot, target).replaceAll('\\', '/'))
      }
      context.__s1Module = module
      context.__s1Require = localRequire
      new vm.Script('(function(require,module,exports){\n' + source + '\n})(__s1Require,__s1Module,__s1Module.exports)', { filename: relative }).runInContext(context, { timeout: 1000 })
    }
    return module.exports
  }
  return {
    load, calls, imported,
    app: () => app,
    page: () => ({ ...page, data: detached(page.data), setData(patch) { this.data = { ...this.data, ...detached(patch) } } }),
    pristine() { assert.deepEqual(calls, []); assert.equal(JSON.stringify([...protectedStorage]), before); assert(imported.every((name) => demoFiles.includes(name))) },
  }
}

test('01 cold App + Page startup: zero protected Draft reads/writes', () => {
  const h = harness(); h.load('app.js'); h.load('pages/demo/index.js')
  h.app().onLaunch({ path: 'pages/demo/index', query: {} })
  const page = h.page(); page.onLoad({}); page.onShow()
  assert.equal(page.data.sessionActive, true); h.pristine()
  return { platformAccesses: h.calls.length, modules: h.imported }
})
test('02 dependency import: no Draft migration or storage capability', () => {
  const h = harness(); h.load('runtime/dependencies.js'); h.load('runtime/host.js')
  assert.equal(h.load('runtime/host.js').view().sessionActive, false); h.pristine()
})
test('03 detached memory, synthetic provenance, idempotent destruction', () => {
  const h = harness(); const { session } = h.load('runtime/dependencies.js').createDemoSession(identity)
  const input = { provenance: 'development-synthetic', sentinel: { count: 1 } }
  assert.equal(session.memory.write('sentinel', input).ok, true); input.sentinel.count = 9
  const read = session.memory.read('sentinel'); assert.equal(read.value.sentinel.count, 1)
  read.value.sentinel.count = 7; assert.equal(session.memory.read('sentinel').value.sentinel.count, 1)
  assert.equal(session.memory.write('real', { sentinel: 'unlabelled' }).ok, false)
  assert.equal(session.memory.write('coercion', { provenance: 'development-synthetic', toJSON() { return { sentinel: 'unlabelled' } } }).reason, 'SYNTHETIC_PROVENANCE_REQUIRED')
  assert.equal(session.memory.read('coercion').value, null)
  for (let i = 0; i < 5; i++) assert.equal(session.destroy().ok, true)
  assert.equal(session.memory.read('sentinel').reason, 'SESSION_DESTROYED')
  assert.equal(session.memory.write('sentinel', input).reason, 'SESSION_DESTROYED'); h.pristine()
})
test('04 external capabilities and all business actions default deny', () => {
  const h = harness(); const { session } = h.load('runtime/dependencies.js').createDemoSession(identity)
  const payload = new Proxy({}, { get() { throw new Error('Payload must not be touched') } })
  const actions = ['storage.read', 'storage.clear', 'draft.migrate', 'C5.login', 'C6.getPhoneNumber', 'request', 'appointment.create', 'evaluation.submit', 'makePhoneCall', 'openLocation', 'openCustomerServiceChat', 'uploadFile', 'downloadFile', 'remoteImage', 'institution.publish', 'unknown']
  for (const action of actions) {
    assert.equal(session.externalActions.perform(action, payload).reason, 'EXTERNAL_ACTION_DENIED')
    assert.equal(session.businessActions.perform(action, payload).reason, 'S1_BUSINESS_ACTION_NOT_IMPLEMENTED')
  }
  session.destroy(); assert.equal(session.externalActions.perform('login').ok, false); h.pristine()
  return { deniedActionKinds: actions.length }
})
test('05 invalid route/query and repeated navigation cannot escape', () => {
  const h = harness(); const { createDemoShell, ENTRY_ROUTE } = h.load('runtime/shell.js')
  const shell = createDemoShell(identity)
  const routes = ['/pages/home/index', '/pages/assessment/basic', '/pages/appointment/create', '/pages/visit/evaluation', '/pages/demo/index?target=production', '/pages/demo/../home/index', 'https://synthetic.invalid', undefined, {}, ENTRY_ROUTE]
  shell.start(ENTRY_ROUTE)
  for (let i = 0; i < 3; i++) for (const route of routes) assert.equal(shell.requestRoute(route).ok, false)
  for (const route of routes.slice(0, -1)) assert.equal(shell.start(route).sessionActive, false)
  assert.equal(shell.start(ENTRY_ROUTE, { target: '/pages/home/index' }).reason, 'ROUTE_DENIED'); h.pristine()
})
test('06 missing, wrong, incomplete and production identity refuse startup', () => {
  const h = harness(); const deps = h.load('runtime/dependencies.js'); const { createDemoShell, ENTRY_ROUTE } = h.load('runtime/shell.js')
  const identities = [null, undefined, {}, { DEMO_MODE: true }, ...Object.keys(identity).map((key) => ({ ...identity, [key]: 'wrong' }))]
  for (const value of identities) {
    assert.equal(deps.createDemoSession(value).ok, false)
    assert.equal(createDemoShell(value).start(ENTRY_ROUTE).reason, 'DEMO_BUILD_IDENTITY_REQUIRED')
  }
  const missing = {}; const shell = createDemoShell(missing); Object.assign(missing, identity)
  assert.equal(shell.start(ENTRY_ROUTE).status, 'BLOCKED'); h.pristine()
})
test('07 absent packaged identity: real entry handlers stay blocked', () => {
  const h = harness({ 'runtime/build-identity.json': null }); h.load('app.js'); h.load('pages/demo/index.js')
  h.app().onLaunch({}); const page = h.page(); page.onLoad({}); page.onShow()
  assert.equal(page.data.sessionActive, false); assert(page.data.message.includes('拒绝')); h.pristine()
})
test('08 malformed packaged identity: fail closed without fallback', () => {
  const h = harness({ 'runtime/build-identity.json': '{invalid' }); h.load('app.js'); h.load('pages/demo/index.js')
  h.app().onLaunch({}); const page = h.page(); page.onLoad({}); assert.equal(page.data.sessionActive, false); h.pristine()
})
test('09 lifecycle hide/unload, repeated exit, error, not-found: destroy only', () => {
  const h = harness(); h.load('app.js'); h.load('pages/demo/index.js'); h.app().onLaunch({})
  const page = h.page(); page.onLoad({}); for (let i = 0; i < 5; i++) page.onExit()
  assert.equal(page.data.sessionActive, false); assert(page.data.message.includes('已销毁'))
  page.onLoad({}); h.app().onHide(); page.onShow(); assert.equal(page.data.sessionActive, false)
  page.onLoad({}); h.app().onError('synthetic-error'); page.onShow(); assert.equal(page.data.sessionActive, false)
  page.onLoad({}); h.app().onPageNotFound({ path: 'pages/home/index' }); page.onShow(); assert.equal(page.data.sessionActive, false)
  page.onUnload(); page.onUnload(); h.pristine()
})
test('10 exceptions and cycles release memory without production fallback', () => {
  const h = harness(); const { createDemoShell, ENTRY_ROUTE } = h.load('runtime/shell.js'); const shell = createDemoShell(identity)
  shell.start(ENTRY_ROUTE)
  const query = new Proxy({}, { ownKeys() { throw new Error('synthetic-query-error') } })
  assert.equal(shell.start(ENTRY_ROUTE, query).reason, 'SHELL_ERROR'); assert.equal(shell.view().sessionActive, false)
  const { session } = h.load('runtime/dependencies.js').createDemoSession(identity)
  const cyclic = { provenance: 'development-synthetic' }; cyclic.self = cyclic
  assert.equal(session.memory.write('cycle', cyclic).reason, 'INVALID_SYNTHETIC_STATE')
  assert.equal(session.memory.read('cycle').value, null); session.destroy(); h.pristine()
})
test('11 empty institution source and session separation', () => {
  const h = harness(); const deps = h.load('runtime/dependencies.js'); const a = deps.createDemoSession(identity).session; const b = deps.createDemoSession(identity).session
  assert.deepEqual(detached(a.institutionSource.list()), { ok: true, provenance: 'development-synthetic', institutions: [] })
  a.memory.write('sentinel', { provenance: 'development-synthetic', value: 1 }); assert.equal(b.memory.read('sentinel').value, null)
  a.destroy(); assert.equal(a.institutionSource.list().reason, 'SESSION_DESTROYED'); assert.equal(b.isAlive(), true); b.destroy(); h.pristine()
})
test('12 source/config isolation: production excludes demo, demo excludes production', () => checkIsolation(root))
test('13 static guard negative controls: capabilities, dynamic and escaped imports', () => {
  const file = path.join(demoRoot, 'app.js')
  for (const source of ["wx.login({})", "require('../../miniprogram/store/assessment-draft')", "require('production-client')", 'require(variable)', 'var r = require; r(variable)', 'globalThis.wx.request({})', "import('production-client')", "fetch('https://synthetic.invalid')", "module['require']('production-client')"]) assert.throws(() => checkDemoJavaScript(source, file, demoRoot))
  return { rejectedMutations: 9 }
})
test('14 cold start with hostile route/query: no native navigation', () => {
  const h = harness(); h.load('app.js'); h.load('pages/demo/index.js')
  h.app().onLaunch({ path: 'pages/home/index', query: { returnTo: 'pages/assessment/basic' } })
  const page = h.page(); page.onLoad({ returnTo: '/pages/home/index' }); page.onShow()
  assert.equal(page.data.sessionActive, false); h.pristine()
})

mkdirSync(evidence, { recursive: true })
const report = {
  evidenceType: 'OFFLINE_NODE_SYNTHETIC_ONLY', passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length, results,
  actualWeChatPackage: 'NOT_EXECUTED', devTools: 'NOT_EXECUTED', androidDevice: 'NOT_EXECUTED',
  realDraftAccess: 'NONE', businessNetwork: 'NONE', productionReleaseReady: false,
}
writeFileSync(path.join(evidence, 'offline-test-results.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, evidenceType: report.evidenceType }))
if (report.failed) process.exitCode = 1
