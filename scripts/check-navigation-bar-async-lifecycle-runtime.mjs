import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const componentFile = path.join(repositoryRoot, 'miniprogram/components/navigation-bar/navigation-bar.ts')
const { ts } = loadWechatTypeScript()
let passedCases = 0

const tsconfigPath = path.join(repositoryRoot, 'tsconfig.json')
const tsconfig = ts.readConfigFile(tsconfigPath, (fileName) => ts.sys.readFile(fileName))
assert.equal(tsconfig.error, undefined, 'the project TypeScript configuration should parse')
const parsedConfig = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, repositoryRoot, undefined, tsconfigPath)
assert.deepEqual(parsedConfig.errors, [], 'the project TypeScript configuration should have no parse errors')
const compilerOptions = {
  ...parsedConfig.options,
  noEmit: true,
  incremental: false,
  composite: false,
}
const typeProgram = ts.createProgram([
  componentFile,
  path.join(repositoryRoot, 'typings/index.d.ts'),
], compilerOptions)
const typeErrors = ts.getPreEmitDiagnostics(typeProgram)
  .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
assert.deepEqual(
  typeErrors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
  [],
  'navigation-bar.ts should pass semantic TypeScript checking with the project wx declarations',
)
console.log('PASS semantic TypeScript check with project wx declarations')

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

const createHarness = ({ pages, menuRect } = {}) => {
  let currentPages = pages || [
    { route: 'pages/assessment/basic' },
    { route: 'pages/assessment/health' },
  ]
  let definition
  const calls = {
    menuRect: 0,
    getSystemInfo: [],
    setData: [],
    navigateBack: [],
    redirectTo: [],
    switchTab: [],
    showToast: [],
    events: [],
  }
  const wx = {
    getMenuButtonBoundingClientRect() {
      calls.menuRect += 1
      return menuRect || { left: 300, top: 24, width: 80, height: 32 }
    },
    getSystemInfo(options) { calls.getSystemInfo.push(options) },
    navigateBack(options) { calls.navigateBack.push(options) },
    redirectTo(options) { calls.redirectTo.push(options) },
    switchTab(options) { calls.switchTab.push(options) },
    showToast(options) { calls.showToast.push(options) },
  }
  const runtime = createWechatTsRuntime(ts, {
    Component(options) { definition = options },
    wx,
    getCurrentPages() { return currentPages },
  })
  runtime.load(componentFile)
  assert.ok(definition, 'the actual navigation-bar Component definition should load')

  const createInstance = (data = {}) => {
    const instance = {
      data: { ...clone(definition.data), ...data },
      setData(patch, callback) {
        calls.setData.push({ owner: this, patch: clone(patch) })
        Object.assign(this.data, clone(patch))
        if (callback) callback()
      },
      triggerEvent(name, detail, options) {
        calls.events.push({ owner: this, name, detail: clone(detail), options: clone(options) })
      },
    }
    Object.entries(definition.methods).forEach(([name, method]) => {
      instance[name] = method.bind(instance)
    })
    return instance
  }

  return {
    calls,
    definition,
    createInstance,
    setPages(value) { currentPages = value },
  }
}

const runCase = (name, action) => {
  action()
  passedCases += 1
  console.log(`PASS ${name}`)
}

runCase('Android, DevTools, and iOS layout payloads preserve the existing formulas', () => {
  const expectedByPlatform = [
    {
      platform: 'android',
      patch: {
        ios: false,
        innerPaddingRight: 'padding-right: 90px',
        leftWidth: 'width: 90px',
        safeAreaTop: 'height: calc(var(--height) + 24px); padding-top: 24px',
      },
    },
    {
      platform: 'devtools',
      patch: {
        ios: true,
        innerPaddingRight: 'padding-right: 90px',
        leftWidth: 'width: 90px',
        safeAreaTop: 'height: calc(var(--height) + 24px); padding-top: 24px',
      },
    },
    {
      platform: 'ios',
      patch: {
        ios: true,
        innerPaddingRight: 'padding-right: 90px',
        leftWidth: 'width: 90px',
        safeAreaTop: '',
      },
    },
  ]

  for (const expected of expectedByPlatform) {
    const harness = createHarness()
    const component = harness.createInstance()
    harness.definition.lifetimes.attached.call(component)
    assert.equal(harness.calls.menuRect, 1, 'menu-button geometry remains synchronous')
    assert.equal(harness.calls.getSystemInfo.length, 1, 'one system-info request starts per attach')
    assert.equal(harness.calls.setData.length, 0, 'layout waits for the existing success callback')
    harness.calls.getSystemInfo[0].success({
      platform: expected.platform,
      windowWidth: 390,
      safeArea: { top: 24 },
    })
    assert.deepEqual(harness.calls.setData.map((item) => item.patch), [expected.patch])
  }
})

runCase('a success callback arriving after detached is discarded', () => {
  const harness = createHarness()
  const component = harness.createInstance()
  harness.definition.lifetimes.attached.call(component)
  const request = harness.calls.getSystemInfo[0]
  harness.definition.lifetimes.detached.call(component)
  request.success({ platform: 'android', windowWidth: 390, safeArea: { top: 24 } })
  assert.equal(harness.calls.setData.length, 0)
})

runCase('a stale attach callback cannot overwrite the newest attach layout', () => {
  const harness = createHarness()
  const component = harness.createInstance()
  harness.definition.lifetimes.attached.call(component)
  const staleRequest = harness.calls.getSystemInfo[0]
  harness.definition.lifetimes.detached.call(component)
  harness.definition.lifetimes.attached.call(component)
  const currentRequest = harness.calls.getSystemInfo[1]

  currentRequest.success({ platform: 'android', windowWidth: 390, safeArea: { top: 24 } })
  staleRequest.success({ platform: 'android', windowWidth: 420, safeArea: { top: 40 } })

  assert.equal(harness.calls.setData.length, 1)
  assert.deepEqual(harness.calls.setData[0].patch, {
    ios: false,
    innerPaddingRight: 'padding-right: 90px',
    leftWidth: 'width: 90px',
    safeAreaTop: 'height: calc(var(--height) + 24px); padding-top: 24px',
  })
})

runCase('attach tokens are isolated between component instances', () => {
  const harness = createHarness()
  const first = harness.createInstance()
  const second = harness.createInstance()
  harness.definition.lifetimes.attached.call(first)
  harness.definition.lifetimes.attached.call(second)
  const firstRequest = harness.calls.getSystemInfo[0]
  const secondRequest = harness.calls.getSystemInfo[1]

  harness.definition.lifetimes.detached.call(first)
  firstRequest.success({ platform: 'android', windowWidth: 390, safeArea: { top: 24 } })
  secondRequest.success({ platform: 'ios', windowWidth: 400, safeArea: { top: 30 } })

  assert.equal(harness.calls.setData.length, 1)
  assert.equal(harness.calls.setData[0].owner, second)
  assert.deepEqual(harness.calls.setData[0].patch, {
    ios: true,
    innerPaddingRight: 'padding-right: 100px',
    leftWidth: 'width: 100px',
    safeAreaTop: '',
  })
})

runCase('an asynchronous system-info failure produces no update, retry, or thrown exception', () => {
  const harness = createHarness()
  const component = harness.createInstance()
  harness.definition.lifetimes.attached.call(component)
  const request = harness.calls.getSystemInfo[0]

  assert.doesNotThrow(() => request.fail?.(new Error('synthetic system-info failure')))
  assert.equal(harness.calls.setData.length, 0)
  assert.equal(harness.calls.getSystemInfo.length, 1)
})

runCase('guarded parent Back remains single-action and becomes available after source-page show', () => {
  const harness = createHarness()
  const component = harness.createInstance({ guardBack: true, delta: 1 })
  component.back()
  component.back()
  assert.equal(harness.calls.navigateBack.length, 1)
  assert.equal(harness.calls.redirectTo.length, 0)
  assert.equal(harness.calls.switchTab.length, 0)

  harness.calls.navigateBack[0].success()
  harness.calls.navigateBack[0].complete()
  component.back()
  assert.equal(harness.calls.navigateBack.length, 1, 'guard remains pending until the source page shows')
  harness.definition.pageLifetimes.show.call(component)
  component.back()
  assert.equal(harness.calls.navigateBack.length, 2)
})

runCase('unguarded parent Back still calls navigateBack once and emits its Back event', () => {
  const harness = createHarness()
  const component = harness.createInstance({ guardBack: false, delta: 1 })
  component.back()
  assert.equal(harness.calls.navigateBack.length, 1)
  assert.equal(harness.calls.events.filter((event) => event.name === 'back').length, 1)
})

runCase('root Tab fallback releases its existing unguarded retry latch on failure', () => {
  const harness = createHarness({ pages: [{ route: 'pages/assessment/intro' }] })
  const component = harness.createInstance({
    guardBack: false,
    delta: 1,
    fallbackUrl: '/pages/home/index',
    fallbackIsTab: true,
  })
  component.back()
  component.back()
  assert.equal(harness.calls.switchTab.length, 1)
  assert.equal(harness.calls.navigateBack.length, 0)
  harness.calls.switchTab[0].fail({ errMsg: 'synthetic failure' })
  harness.calls.switchTab[0].complete()
  component.back()
  assert.equal(harness.calls.switchTab.length, 2)
})

runCase('guarded non-Tab root fallback can retry after navigation failure', () => {
  const harness = createHarness({ pages: [{ route: 'pages/assessment/health' }] })
  const component = harness.createInstance({
    guardBack: true,
    delta: 1,
    fallbackUrl: '/pages/assessment/basic',
    fallbackIsTab: false,
  })
  component.back()
  assert.equal(harness.calls.redirectTo.length, 1)
  assert.equal(harness.calls.switchTab.length, 0)
  harness.calls.redirectTo[0].fail({ errMsg: 'synthetic failure' })
  harness.calls.redirectTo[0].complete()
  component.back()
  assert.equal(harness.calls.redirectTo.length, 2)
  assert.equal(harness.calls.events.filter((event) => event.name === 'navigationfail').length, 1)
})

runCase('detached still releases the existing guarded Back operation', () => {
  const harness = createHarness()
  const component = harness.createInstance({ guardBack: true, delta: 1 })
  component.back()
  assert.equal(harness.calls.navigateBack.length, 1)
  harness.definition.lifetimes.detached.call(component)
  component.back()
  assert.equal(harness.calls.navigateBack.length, 2)
})

console.log(`RESULT TARGETED_RUNTIME_CASES=${passedCases}/10 TYPESCRIPT=PASS`)
