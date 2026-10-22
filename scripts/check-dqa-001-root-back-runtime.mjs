// Isolated NavigationBar VM only: no live wx, page lifecycle, account, storage or backend.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.resolve(root, file), 'utf8')
const { ts } = loadWechatTypeScript()
const sourceArg = process.argv.indexOf('--navigation-source')
const sourcePath = sourceArg < 0 ? 'miniprogram/components/navigation-bar/navigation-bar.ts' : process.argv[sourceArg + 1]
const source = read(sourcePath)
const app = JSON.parse(read('miniprogram/app.json'))
const mapping = [
  ['institution/vr', 'institution/index', false],
  ['service/ai-chat/index', 'home/index', true],
  ['elder/index', 'mine/index', true],
  ['elder/detail', 'elder/index', false],
  ['assessment/history', 'mine/index', true],
  ['appointment/index', 'mine/index', true],
  ['visit/evaluation', 'appointment/index', false],
]
const results = []
let forbiddenCalls = 0
const plain = (value) => JSON.parse(JSON.stringify(value))
const test = (id, fn) => {
  try { fn(); results.push({ id, status: 'PASS' }) }
  catch (error) { results.push({ id, status: 'FAIL', message: error.message }) }
}
const output = ts.transpileModule(source, {
  fileName: 'navigation-bar.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS, strict: true },
})
assert.equal((output.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0)

function environment(stack, mode = 'pending') {
  let definition
  const state = { stack, calls: [], events: [], toasts: [], mode }
  const navigate = (api) => (options) => {
    state.calls.push({ api, options })
    if (state.mode === 'throw') throw Error('ISOLATED_NAVIGATION_THROW')
  }
  const wx = new Proxy({
    navigateBack: navigate('navigateBack'), redirectTo: navigate('redirectTo'), switchTab: navigate('switchTab'),
    showToast: (options) => state.toasts.push(options),
  }, { get(target, key) {
    if (key in target) return target[key]
    return () => { forbiddenCalls += 1; throw Error(`FORBIDDEN_WX_CAPABILITY:${String(key)}`) }
  } })
  const context = vm.createContext({ wx, Component: (value) => { definition = value }, getCurrentPages: () => {
    if (state.stack instanceof Error) throw state.stack
    return state.stack
  } })
  vm.runInContext(output.outputText, context)
  const mount = (props = {}) => {
    const data = Object.fromEntries(Object.entries(definition.properties).map(([key, property]) => [key, property.value]))
    const instance = {
      data: { ...data, ...props },
      triggerEvent: (name, detail, options) => state.events.push({ name, detail: plain(detail), options: plain(options) }),
      setData(patch) { Object.assign(this.data, patch) },
    }
    Object.assign(instance, definition.methods)
    return instance
  }
  return { state, mount, definition }
}
function expectOne(state, api, url) {
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].api, api)
  if (url) assert.equal(state.calls[0].options.url, url)
  else assert.equal(state.calls[0].options.delta, 1)
}

for (const [page, destination, isTab] of mapping) {
  const route = `pages/${page}`
  const url = `/pages/${destination}`
  const wxml = read(`miniprogram/${route}.wxml`)
  const tag = wxml.match(/<navigation-bar\b[^>]*>/)?.[0] || ''
  const attrs = Object.fromEntries([...tag.matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]))
  const props = {
    fallbackUrl: attrs.fallbackUrl,
    fallbackIsTab: attrs.fallbackIsTab === '{{true}}',
    guardBack: attrs.guardBack === '{{true}}',
    navigationFailureMessage: attrs.navigationFailureMessage,
  }
  const rootStack = [{ route }]
  const parentStack = [{ route: 'pages/mine/index' }, { route }]
  const api = isTab ? 'switchTab' : 'redirectTo'
  test(`${page}:mapping-and-single-channel`, () => {
    assert.ok(app.pages.includes(route))
    assert.ok(app.pages.includes(url.slice(1)))
    assert.equal(app.tabBar.list.some((item) => item.pagePath === url.slice(1)), isTab)
    assert.equal(props.fallbackUrl, url)
    assert.equal(props.fallbackIsTab, isTab)
    assert.equal(props.guardBack, true)
    assert.equal(props.navigationFailureMessage, '返回失败，请重试')
    assert.ok(!/[?#]/.test(url))
    assert.ok(!Object.keys(attrs).some((key) => /^(?:bind|catch)(?::)?(?:back|tap|navigationfail)$/.test(key)))
    assert.equal(JSON.parse(read(`miniprogram/${route}.json`)).usingComponents['navigation-bar'], '/components/navigation-bar/navigation-bar')
  })
  for (const [kind, stack, expectedApi, expectedUrl] of [
    ['N01-parent', parentStack, 'navigateBack', undefined], ['N02-N06-N07-N10-root', rootStack, api, url],
  ]) {
    test(`${page}:${kind}`, () => {
      const e = environment(stack); const n = e.mount(props)
      n.back(); expectOne(e.state, expectedApi, expectedUrl)
      assert.equal(e.state.events.length, 0); assert.equal(e.state.toasts.length, 0)
    })
    test(`${page}:${kind}:N04-rapid-success-N09-show-reentry`, () => {
      const e = environment(stack); const n = e.mount(props)
      n.back(); n.back(); n.back(); expectOne(e.state, expectedApi, expectedUrl)
      e.state.calls[0].options.success(); e.state.calls[0].options.complete(); n.back()
      expectOne(e.state, expectedApi, expectedUrl)
      assert.equal(e.state.toasts.length, 0)
      e.definition.pageLifetimes.show.call(n); n.back(); assert.equal(e.state.calls.length, 2)
    })
    for (const order of ['fail-complete', 'complete-fail', 'complete-only', 'fail-twice']) {
      test(`${page}:${kind}:N05-${order}-repeated-retry`, () => {
        const e = environment(stack); const n = e.mount(props)
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          n.back(); assert.equal(e.state.calls.length, attempt)
          const callbacks = e.state.calls[attempt - 1].options
          for (const name of order.split('-').filter((name) => name !== 'only' && name !== 'twice')) callbacks[name]()
          if (order === 'fail-twice') callbacks.fail()
          assert.equal(e.state.toasts.length, attempt)
          assert.equal(e.state.toasts[attempt - 1].icon, 'none')
          assert.equal(e.state.events.length, 0)
        }
      })
    }
    test(`${page}:${kind}:synchronous-exception-releases`, () => {
      const e = environment(stack, 'throw'); const n = e.mount(props)
      n.back(); assert.equal(e.state.toasts.length, 1)
      e.state.mode = 'pending'; n.back(); assert.equal(e.state.calls.length, 2)
    })
  }
  for (const [name, badStack] of [
    ['throw', Error('ISOLATED_STACK_THROW')], ['empty', []], ['null', null], ['undefined', undefined],
    ['arraylike', { length: 1 }], ['invalid-current', [{}]], ['invalid-parent', [null, { route }]],
    ['sparse', new Array(1)], ['non-string-route', [{ route: 42 }]], ['blank-route', [{ route: '' }]],
  ]) {
    test(`${page}:N03-${name}-retry`, () => {
      const e = environment(badStack); const n = e.mount(props)
      n.back(); assert.equal(e.state.calls.length, 0); assert.equal(e.state.toasts.length, 1)
      e.state.stack = rootStack; n.back(); expectOne(e.state, api, url)
    })
  }
  test(`${page}:N08-N11-invalid-form-and-draft-untouched`, () => {
    const e = environment(rootStack); const n = e.mount(props)
    const form = { valid: false, draft: { developmentOnly: true } }
    Object.defineProperty(n.data, 'form', { get() { throw Error('Back must not read form') } })
    const snapshot = JSON.stringify(form)
    n.back(); expectOne(e.state, api, url); assert.equal(JSON.stringify(form), snapshot)
  })
  test(`${page}:destroy-new-instance-stale-callback`, () => {
    const e = environment(rootStack); const old = e.mount(props)
    old.back(); const callbacks = e.state.calls[0].options
    e.definition.lifetimes.detached.call(old)
    const next = e.mount(props); next.back(); assert.equal(e.state.calls.length, 2)
    callbacks.fail(); callbacks.complete(); assert.equal(e.state.toasts.length, 0)
    next.back(); assert.equal(e.state.calls.length, 2)
  })
  test(`${page}:old-failure-cannot-release-new-attempt`, () => {
    const e = environment(rootStack); const n = e.mount(props)
    n.back(); const old = e.state.calls[0].options; old.fail(); n.back()
    old.complete(); old.fail(); n.back()
    assert.equal(e.state.calls.length, 2); assert.equal(e.state.toasts.length, 1)
  })
}

test('N12-legacy-parent-root-nontab-events', () => {
  for (const [stack, props, api, url] of [
    [[{}, {}], {}, 'navigateBack', undefined], [[{}], { fallbackUrl: '/pages/assessment/intro' }, 'redirectTo', '/pages/assessment/intro'],
  ]) {
    const e = environment(stack); const n = e.mount(props); n.back(); expectOne(e.state, api, url)
    assert.deepEqual(e.state.events, [{ name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } }])
  }
  const e = environment([{}]); e.mount().back()
  assert.equal(e.state.calls.length, 0); assert.equal(e.state.events[0].name, 'back')
})
test('N12-legacy-tab-pending-failure-and-feedback', () => {
  const e = environment([{}]); const n = e.mount({ fallbackUrl: '/pages/home/index', fallbackIsTab: true })
  n.back(); n.back(); expectOne(e.state, 'switchTab', '/pages/home/index')
  assert.equal(e.state.events.length, 1)
  e.state.calls[0].options.fail(); e.state.calls[0].options.complete()
  assert.equal(e.state.events.filter((event) => event.name === 'navigationfail').length, 1)
  assert.equal(e.state.toasts.length, 0)
  n.back(); assert.equal(e.state.calls.length, 2)
})
test('N12-legacy-lifecycle-does-not-change-old-tab-lock', () => {
  const e = environment([{}]); const n = e.mount({ fallbackUrl: '/pages/home/index', fallbackIsTab: true })
  n.back(); e.state.calls[0].options.success(); e.state.calls[0].options.complete()
  e.definition.pageLifetimes.show.call(n); n.back(); assert.equal(e.state.calls.length, 1)
})
test('single-native-navigation-bar-action-channel', () => {
  const wxml = read('miniprogram/components/navigation-bar/navigation-bar.wxml')
  assert.equal((wxml.match(/bindtap="back"/g) || []).length, 1)
  assert.ok(!/bind:back|catchtap="back"/.test(wxml))
})
test('no-business-wx-capability-used', () => assert.equal(forbiddenCalls, 0))

const summary = {
  evidence: 'CODEX_ISOLATED_WX_MOCK_VM', parserVersion: ts.version, sourcePath,
  total: results.length, pass: results.filter((item) => item.status === 'PASS').length,
  fail: results.filter((item) => item.status === 'FAIL').length, blocked: 0, forbiddenCalls, results,
}
const reportArg = process.argv.indexOf('--report')
if (reportArg >= 0) writeFileSync(path.resolve(root, process.argv[reportArg + 1]), JSON.stringify(summary, null, 2) + '\n')
for (const failure of results.filter((item) => item.status === 'FAIL')) console.error(`${failure.id}: ${failure.message}`)
console.log(`DQA_001_ISOLATED_RUNTIME = ${summary.fail ? 'FAIL' : 'PASS'}; TOTAL=${summary.total}; PASS=${summary.pass}; FAIL=${summary.fail}; BLOCKED=0`)
if (summary.fail) process.exitCode = 1
