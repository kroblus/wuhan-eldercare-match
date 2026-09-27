/**
 * Targeted Mine -> My Appointments interaction runtime gate.
 *
 * It executes the production PrimaryButton action and Mine page handler with
 * synthetic wx callbacks. It does not call authentication, owner-read, phone,
 * storage, or backend capabilities, and does not claim DevTools or device proof.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const require = createRequire(import.meta.url)

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return require(path.resolve(explicitPath))
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const profiles = existsSync(profileRoot) ? readdirSync(profileRoot, { withFileTypes: true }) : []
  for (const profile of profiles) {
    if (!profile.isDirectory()) continue
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) continue
    for (const runtime of readdirSync(runtimeRoot, { withFileTypes: true })) {
      if (!runtime.isDirectory()) continue
      const file = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
      if (!existsSync(file)) continue
      const typescript = require(file)
      if (typescript.version === '4.1.2') return typescript
    }
  }
  throw new Error('WeChat TypeScript 4.1.2 parser is required')
}

const createRuntime = (typescript, globals = {}) => {
  const cache = new Map()
  const loadedPaths = new Set()
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, ...globals })

  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts')]
    const resolved = candidates.find((file) => existsSync(file))
    assert.ok(resolved, `cannot resolve ${request} from ${importer}`)
    return resolved
  }

  const load = (file) => {
    const resolved = path.resolve(file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    loadedPaths.add(path.relative(repositoryRoot, resolved).replaceAll(path.sep, '/'))
    const source = readFileSync(resolved, 'utf8')
    const output = resolved.endsWith('.ts')
      ? typescript.transpileModule(source, {
        fileName: resolved,
        reportDiagnostics: true,
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          strict: true,
        },
      })
      : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((item) => item.category === typescript.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire,
      module,
      module.exports,
    )
    return module.exports
  }

  return { context, load, loadedPaths }
}

const run = () => {
  const typescript = loadWechatTypeScript()
  let mineComponentConfig = null
  let buttonComponentConfig = null
  const navigationCalls = []
  const forbiddenCalls = Object.create(null)
  const countForbiddenCall = (name) => (..._args) => {
    forbiddenCalls[name] = (forbiddenCalls[name] || 0) + 1
  }
  const wxRuntime = {
    navigateTo(options) { navigationCalls.push(options) },
    switchTab: countForbiddenCall('switchTab'),
    login: countForbiddenCall('login'),
    checkSession: countForbiddenCall('checkSession'),
    request: countForbiddenCall('request'),
    getUserProfile: countForbiddenCall('getUserProfile'),
    makePhoneCall: countForbiddenCall('makePhoneCall'),
    setStorage: countForbiddenCall('setStorage'),
    setStorageSync: countForbiddenCall('setStorageSync'),
    removeStorage: countForbiddenCall('removeStorage'),
    removeStorageSync: countForbiddenCall('removeStorageSync'),
    clearStorage: countForbiddenCall('clearStorage'),
    clearStorageSync: countForbiddenCall('clearStorageSync'),
  }

  const mineRuntime = createRuntime(typescript, {
    wx: wxRuntime,
    Component(config) { mineComponentConfig = config },
  })
  mineRuntime.load(path.join(repositoryRoot, 'miniprogram/pages/mine/index.ts'))
  assert.ok(mineComponentConfig, 'Mine page Component config should register')
  assert.deepEqual(
    [...mineRuntime.loadedPaths].sort(),
    [
      'miniprogram/pages/mine/index.ts',
      'miniprogram/utils/navigation-guard.ts',
      'miniprogram/utils/route-scaffold.ts',
    ].sort(),
    'Mine entry must not load auth, owner-read, Elder, phone, or mutation services',
  )

  const page = {
    data: { ...mineComponentConfig.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  Object.assign(page, mineComponentConfig.methods)

  const buttonRuntime = createRuntime(typescript, {
    Component(config) { buttonComponentConfig = config },
  })
  buttonRuntime.load(path.join(repositoryRoot, 'miniprogram/components/primary-button/primary-button.ts'))
  assert.ok(buttonComponentConfig, 'PrimaryButton component config should register')

  const tapEvents = []
  const button = {
    data: { disabled: false, loading: false },
    triggerEvent(name, detail, options) {
      tapEvents.push({ name, detail, options })
      if (name === 'action') page.openAppointments()
    },
  }
  const tapPrimaryButton = () => buttonComponentConfig.methods.handleAction.call(button)

  assert.equal(navigationCalls.length, 0, 'page registration must not navigate')
  assert.equal(forbiddenCalls.request || 0, 0, 'page registration must not read owner records')
  assert.equal(forbiddenCalls.login || 0, 0, 'page registration must not authenticate')
  assert.equal(forbiddenCalls.makePhoneCall || 0, 0, 'page registration must not use phone')

  tapPrimaryButton()
  assert.equal(tapEvents.length, 1, 'one physical tap must emit one action event')
  assert.equal(tapEvents[0].name, 'action')
  assert.equal(Object.keys(tapEvents[0].detail).length, 0)
  assert.equal(tapEvents[0].options.bubbles, false)
  assert.equal(tapEvents[0].options.composed, false)
  assert.equal(navigationCalls.length, 1, 'one Action should navigate once')
  assert.equal(navigationCalls[0].url, '/pages/appointment/index')
  assert.equal(page.data.appointmentNavigationErrorMessage, '')

  tapPrimaryButton()
  assert.equal(tapEvents.length, 2, 'second physical tap is still delivered to the page')
  assert.equal(navigationCalls.length, 1, 'rapid tap must not create a second navigation')

  navigationCalls[0].fail({ errMsg: 'synthetic navigation failure' })
  navigationCalls[0].complete({ errMsg: 'synthetic navigation failure' })
  assert.match(page.data.appointmentNavigationErrorMessage, /暂时无法打开我的预约/)

  tapPrimaryButton()
  assert.equal(navigationCalls.length, 2, 'navigation failure must release guard for retry')
  assert.equal(page.data.appointmentNavigationErrorMessage, '', 'retry clears the prior error')
  navigationCalls[1].success({})
  navigationCalls[1].complete({})

  mineComponentConfig.pageLifetimes.show.call(page)
  tapPrimaryButton()
  assert.equal(navigationCalls.length, 3, 'returning to Mine must allow navigation again')
  assert.equal(navigationCalls[2].url, '/pages/appointment/index')

  page.navigateNext()
  assert.equal(navigationCalls.length, 4, 'existing Elder scaffold action must remain available')
  assert.equal(navigationCalls[3].url, '/pages/elder/index')

  const mineWxml = read('miniprogram/pages/mine/index.wxml')
  assert.match(mineWxml, /<primary-button[^>]*text="查看我的预约"[^>]*bind:action="openAppointments"/)
  assert.equal((mineWxml.match(/bind:action="openAppointments"/g) || []).length, 1)
  assert.doesNotMatch(mineWxml, /(?:bindtap|catchtap|bind:tap|catch:tap)="openAppointments"/)
  assert.match(mineWxml, /wx:if="\{\{appointmentNavigationErrorMessage\}\}"[^>]*role="alert"/)
  assert.doesNotMatch(mineWxml, /bindgetphonenumber|catchgetphonenumber/)
  assert.match(mineWxml, /bind:action="navigateNext"/, 'existing Elder entry must remain rendered')

  const appConfig = JSON.parse(read('miniprogram/app.json'))
  assert.ok(appConfig.pages.includes('pages/appointment/index'), 'target route must be registered')
  assert.equal(
    appConfig.tabBar.list.some((item) => item.pagePath === 'pages/appointment/index'),
    false,
    'appointment list route must remain a non-tab page for navigateTo',
  )

  for (const [name, count] of Object.entries(forbiddenCalls)) {
    assert.equal(count, 0, `Mine entry must not invoke wx.${name}`)
  }
  console.log('MINE APPOINTMENT ENTRY RUNTIME PASS: tap chain, rapid guard, failure retry, return reset, no eager capabilities')
  console.log(`TypeScript parser: ${typescript.version || 'unknown'}`)
  console.log(`Loaded Mine production modules: ${[...mineRuntime.loadedPaths].sort().join(', ')}`)
}

try {
  run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`MINE APPOINTMENT ENTRY RUNTIME FAIL: ${message}`)
  process.exitCode = 1
}
