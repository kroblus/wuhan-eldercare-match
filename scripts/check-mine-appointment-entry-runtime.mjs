/**
 * Targeted Mine -> My Appointments / Assessment History interaction runtime gate.
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
  const toastCalls = []
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
    getStorage: countForbiddenCall('getStorage'),
    getStorageSync: countForbiddenCall('getStorageSync'),
    getUserProfile: countForbiddenCall('getUserProfile'),
    makePhoneCall: countForbiddenCall('makePhoneCall'),
    setStorage: countForbiddenCall('setStorage'),
    setStorageSync: countForbiddenCall('setStorageSync'),
    removeStorage: countForbiddenCall('removeStorage'),
    removeStorageSync: countForbiddenCall('removeStorageSync'),
    clearStorage: countForbiddenCall('clearStorage'),
    clearStorageSync: countForbiddenCall('clearStorageSync'),
    showToast(options) { toastCalls.push(options) },
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
  page.navigateNext()
  assert.equal(navigationCalls.length, 4, 'existing Elder scaffold action must remain available')
  assert.equal(navigationCalls[3].url, '/pages/elder/index')
  navigationCalls[3].fail({ errMsg: 'synthetic route failure' })
  navigationCalls[3].complete({ errMsg: 'synthetic route failure' })
  assert.match(toastCalls.at(-1).title, /暂时无法打开老人档案/)
  page.navigateNext()
  assert.equal(navigationCalls.length, 5, 'failed Elder entry releases its local guard for retry')
  navigationCalls[4].success({})
  navigationCalls[4].complete({})
  page.navigateNext()
  assert.equal(navigationCalls.length, 5, 'successful navigation remains guarded until the page is shown again')
  mineComponentConfig.pageLifetimes.show.call(page)
  page.navigateNext()
  assert.equal(navigationCalls.length, 6, 'onShow resets the Elder entry guard')

  mineComponentConfig.pageLifetimes.show.call(page)
  const beforeHistory = navigationCalls.length
  const historyEvents = []
  const historyButton = {
    data: { disabled: true, loading: false },
    triggerEvent(name, detail, options) {
      historyEvents.push({ name, detail, options })
      if (name === 'action') page.openAssessmentHistory()
    },
  }
  const tapHistory = () => buttonComponentConfig.methods.handleAction.call(historyButton)
  tapHistory()
  historyButton.data.disabled = false
  historyButton.data.loading = true
  tapHistory()
  assert.equal(historyEvents.length, 0, 'disabled/loading button cannot emit a History action')
  historyButton.data.loading = false
  tapHistory()
  assert.equal(historyEvents.length, 1, 'one History tap emits one action')
  assert.equal(historyEvents[0].name, 'action')
  assert.equal(historyEvents[0].options.bubbles, false)
  assert.equal(historyEvents[0].options.composed, false)
  assert.equal(navigationCalls.length, beforeHistory + 1)
  assert.equal(navigationCalls.at(-1).url, '/pages/assessment/history')
  assert.equal(navigationCalls.at(-1).url.includes('?'), false, 'no identity or Assessment query is forwarded')
  tapHistory()
  assert.equal(navigationCalls.length, beforeHistory + 1, 'rapid History tap navigates at most once')
  navigationCalls.at(-1).fail({ errMsg: 'TEST_ONLY history navigation failure' })
  navigationCalls.at(-1).complete({})
  assert.match(page.data.historyNavigationErrorMessage, /暂时无法打开我的评估/)
  assert.equal(page.data.appointmentNavigationErrorMessage, '', 'History error does not leak into appointment entry')
  tapHistory()
  assert.equal(page.data.historyNavigationErrorMessage, '')
  assert.equal(navigationCalls.length, beforeHistory + 2, 'failed History navigation releases retry')
  navigationCalls.at(-1).success({})
  navigationCalls.at(-1).complete({})
  tapHistory()
  assert.equal(navigationCalls.length, beforeHistory + 2, 'success stays guarded before return')
  mineComponentConfig.pageLifetimes.show.call(page)
  tapHistory()
  assert.equal(navigationCalls.length, beforeHistory + 3, 'return to Mine allows History entry again')

  const mineWxml = read('miniprogram/pages/mine/index.wxml')
  assert.match(mineWxml, /<primary-button[^>]*text="查看我的预约"[^>]*bind:action="openAppointments"/)
  assert.equal((mineWxml.match(/bind:action="openAppointments"/g) || []).length, 1)
  assert.doesNotMatch(mineWxml, /(?:bindtap|catchtap|bind:tap|catch:tap)="openAppointments"/)
  assert.match(mineWxml, /wx:if="\{\{appointmentNavigationErrorMessage\}\}"[^>]*role="alert"/)
  assert.doesNotMatch(mineWxml, /bindgetphonenumber|catchgetphonenumber/)
  assert.match(mineWxml, /<primary-button[^>]*text="查看我的评估"[^>]*bind:action="openAssessmentHistory"/)
  assert.equal((mineWxml.match(/bind:action="openAssessmentHistory"/g) || []).length, 1)
  assert.doesNotMatch(mineWxml, /(?:bindtap|catchtap|bind:tap|catch:tap)="openAssessmentHistory"/)
  assert.match(mineWxml, /wx:if="\{\{historyNavigationErrorMessage\}\}"[^>]*role="alert"/)
  assert.match(mineWxml, /bind:action="navigateNext"/, 'existing Elder entry must remain rendered')

  const appConfig = JSON.parse(read('miniprogram/app.json'))
  assert.ok(appConfig.pages.includes('pages/appointment/index'), 'target route must be registered')
  assert.ok(appConfig.pages.includes('pages/assessment/history'))
  assert.equal(appConfig.tabBar.list.some(item => item.pagePath === 'pages/assessment/history'), false)
  assert.equal(
    appConfig.tabBar.list.some((item) => item.pagePath === 'pages/appointment/index'),
    false,
    'appointment list route must remain a non-tab page for navigateTo',
  )

  const routeScaffold = mineRuntime.load(path.join(repositoryRoot, 'miniprogram/utils/route-scaffold.ts'))
  routeScaffold.registerRoutePage({
    title: '老人档案详情',
    routeLabel: '档案 · 本机服务骨架',
    description: 'TEST_ONLY route scaffold',
    nextUrl: '/pages/elder/detail',
  })
  const scaffoldConfig = mineComponentConfig
  const scaffoldPage = {
    data: { ...scaffoldConfig.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  const beforeScaffold = navigationCalls.length
  scaffoldConfig.methods.navigateNext.call(scaffoldPage)
  scaffoldConfig.methods.navigateNext.call(scaffoldPage)
  assert.equal(navigationCalls.length, beforeScaffold + 1, 'route-scaffold non-Tab child action is locally guarded')
  assert.equal(navigationCalls.at(-1).url, '/pages/elder/detail')
  navigationCalls.at(-1).fail({ errMsg: 'synthetic scaffold failure' })
  navigationCalls.at(-1).complete({ errMsg: 'synthetic scaffold failure' })
  assert.match(toastCalls.at(-1).title, /暂时无法打开此页面/)
  scaffoldConfig.pageLifetimes.show.call(scaffoldPage)
  scaffoldConfig.methods.navigateNext.call(scaffoldPage)
  assert.equal(navigationCalls.length, beforeScaffold + 2, 'route-scaffold resets after returning to the page')

  for (const [name, count] of Object.entries(forbiddenCalls)) {
    assert.equal(count, 0, `Mine entry must not invoke wx.${name}`)
  }
  console.log('MINE APPOINTMENT ENTRY RUNTIME PASS: tap chain, rapid guard, failure retry, return reset, no eager capabilities')
  console.log('MINE HISTORY ENTRY RUNTIME PASS: single action, disabled/loading, rapid guard, inline failure/retry, return reset, no identity query or eager auth/storage/network')
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
