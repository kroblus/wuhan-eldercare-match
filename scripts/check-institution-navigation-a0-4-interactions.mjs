/**
 * Phase V1.2-A0-4 canonical Institution navigation interaction gate.
 *
 * This is a deliberately small source/runtime-boundary harness.  It checks
 * the physical-action matrix at the Page/WXML boundary and the exact
 * application seams used by the navigation handlers.  It does not mount wx
 * or claim DevTools/Android evidence; those are separate gates.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')

const homeTs = read('miniprogram/pages/home/index.ts')
const sharedDirectoryWxml = read('miniprogram/templates/institution-directory.wxml')
const homeWxml = read('miniprogram/pages/home/index.wxml') + sharedDirectoryWxml
const introWxml = read('miniprogram/pages/assessment/intro.wxml')
const navigationBarTs = read('miniprogram/components/navigation-bar/navigation-bar.ts')
const listTs = read('miniprogram/pages/institution/index.ts')
const listWxml = read('miniprogram/pages/institution/index.wxml') + sharedDirectoryWxml
const detailTs = read('miniprogram/pages/institution/detail.ts')
const resultTs = read('miniprogram/pages/recommendation/result.ts')
const resultWxml = read('miniprogram/pages/recommendation/result.wxml')
const routeTs = read('miniprogram/services/institution-detail-route.ts')
const registryTs = read('miniprogram/services/institution-source-context.ts')
const sourceTs = read('miniprogram/services/institution-recommendation-source.ts')
const navGuardTs = read('miniprogram/utils/navigation-guard.ts')

const require = createRequire(import.meta.url)

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return require(path.resolve(explicitPath))
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const profiles = existsSync(profileRoot) ? readdirSync(profileRoot, { withFileTypes: true }) : []
  for (const profile of profiles) {
    if (!profile.isDirectory()) continue
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) continue
    const runtimes = readdirSync(packageRoot, { withFileTypes: true })
    for (const runtime of runtimes) {
      if (!runtime.isDirectory()) continue
      const file = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (!existsSync(file)) continue
      const ts = require(file)
      if (ts.version === '4.1.2') return ts
    }
  }
  throw new Error('WeChat TypeScript 4.1.2 parser is required for A0-4 harness')
}

const createRuntime = (typescript, options = {}) => {
  const cache = new Map()
  const overrides = options.overrides || new Map()
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    ...(options.globals || {}),
  })
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts')]
    const resolved = candidates.find((file) => existsSync(file) && statSync(file).isFile())
    assert.ok(resolved, `cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (file) => {
    const resolved = path.resolve(file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
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
      const target = resolve(request, resolved)
      return overrides.has(target) ? overrides.get(target) : load(target)
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire, module, module.exports,
    )
    return module.exports
  }
  return { load, context }
}

const makeResultSnapshot = () => ({
  kind: 'recommendation_result_application_snapshot_v2',
  source: 'anonymous_profile_preview_v2',
  sourceContext: {
    datasetVersion: 'institution-catalog-v1.2-test-20260901',
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    evaluationAsOf: '2026-09-08T12:00:00.000Z',
    institutionContractVersion: 'institution-contract-v1.1',
    institutionCapabilityContractVersion: 'institution-capability-contract-v1',
  },
  preview: {
    semantics: {
      exactMatch: true,
      elderReadiness: 'ready',
      cards: [{
        institutionId: 'institution-a-mock',
        recordRevision: 1,
        matchTier: 'EXACT',
        reasons: [{ reasonCode: 'CARE_COMPATIBILITY', reasonType: 'capability' }],
        differences: [],
      }],
      conditionalCandidates: [],
      noExactMatch: undefined,
      datasetVersion: 'institution-catalog-v1.2-test-20260901',
      datasetMode: 'MOCK_DEVELOPMENT_ONLY',
      evaluationAsOf: '2026-09-08T12:00:00.000Z',
      versions: {
        recommendationContractVersion: 'recommendation-contract-v2',
        recommendationRulesetVersion: 'recommendation-ruleset-v2',
        policyVersion: 'conservative-exact-with-conditional-v1',
        institutionContractVersion: 'institution-contract-v1.1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
      },
      poolManifest: {
        datasetVersion: 'institution-catalog-v1.2-test-20260901',
        datasetMode: 'MOCK_DEVELOPMENT_ONLY',
        evaluationAsOf: '2026-09-08T12:00:00.000Z',
        institutionContractVersion: 'institution-contract-v1.1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
        entries: [{
          institutionId: 'institution-a-mock',
          recordRevision: 1,
          recordProvenance: 'MOCK_DEVELOPMENT_ONLY',
          recordStatus: 'published',
          disposition: 'included',
        }],
      },
    },
  },
})

const runHomeAssessmentEntryHarness = () => {
  const typescript = loadWechatTypeScript()
  const calls = []
  const toasts = []
  let componentConfig = null
  const wxRuntime = {
    navigateTo(options) { calls.push({ api: 'navigateTo', options }) },
    redirectTo(options) { calls.push({ api: 'redirectTo', options }) },
    reLaunch(options) { calls.push({ api: 'reLaunch', options }) },
    showToast(options) { toasts.push(options) },
  }
  const guardModule = createRuntime(typescript, { globals: { wx: wxRuntime } }).load(path.join(root, 'miniprogram', 'utils', 'navigation-guard.ts'))
  const modulePath = (relativePath) => path.resolve(root, 'miniprogram', relativePath)
  const overrides = new Map([
    [modulePath('services/institution-list-detail-page.ts'), { buildInstitutionListPageSnapshot() { return Promise.resolve({ ok: false }) } }],
    [modulePath('pages/institution/list-view-model.ts'), { createInstitutionListPageViewModel() { return {} } }],
    [modulePath('utils/navigation-guard.ts'), guardModule],
    [modulePath('services/institution-detail-route.ts'), { serializeInstitutionDetailRoute() { return null } }],
  ])
  const runtime = createRuntime(typescript, {
    overrides,
    globals: {
      Component(config) { componentConfig = config },
      wx: wxRuntime,
      getCurrentPages: () => [],
    },
  })
  runtime.load(modulePath('pages/home/index.ts'))
  assert.ok(componentConfig, 'Home Component configuration was not registered')
  const page = {
    data: { ...componentConfig.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
    loadInstitutions() {}, // Directory behavior is exercised by the shared browsing gate.
  }
  const startAssessment = componentConfig.methods.startAssessment
  const guard = guardModule.getNavigationGuard(page)

  startAssessment.call(page)
  assert.equal(calls.length, 1, 'one Home action must issue one page push')
  assert.equal(calls[0].api, 'navigateTo', 'Home must remain the parent of Intro')
  assert.equal(calls[0].options.url, '/pages/assessment/intro')
  assert.equal(guard.isLocked('home.startAssessment'), true)
  calls[0].options.fail({ errMsg: 'navigateTo:fail' })
  calls[0].options.complete({ errMsg: 'navigateTo:fail' })
  assert.equal(guard.isLocked('home.startAssessment'), false, 'failed push must release the guard')
  assert.equal(toasts.length, 1, 'failed push must provide one visible retry cue')

  startAssessment.call(page)
  assert.equal(calls.length, 2, 'failed push must allow a retry')
  assert.equal(calls[1].api, 'navigateTo')
  calls[1].options.success({ errMsg: 'navigateTo:ok' })
  calls[1].options.complete({ errMsg: 'navigateTo:ok' })
  assert.equal(guard.isLocked('home.startAssessment'), true, 'successful push keeps the source action locked')
  componentConfig.pageLifetimes.show.call(page)
  assert.equal(guard.isLocked('home.startAssessment'), false, 'returning to Home resets its page guard')

  return { reLaunchCount: calls.filter((call) => call.api === 'reLaunch').length, navigateCount: calls.filter((call) => call.api === 'navigateTo').length, toastCount: toasts.length }
}

const runInstitutionRootBackHarness = () => {
  const typescript = loadWechatTypeScript()
  const componentCalls = []
  let componentConfig = null
  let componentPages = []
  let throwNextComponentSwitchTab = false
  const componentRuntime = createRuntime(typescript, {
    globals: {
      Component(config) { componentConfig = config },
      getCurrentPages: () => componentPages,
      wx: {
        navigateBack(options) { componentCalls.push({ api: 'navigateBack', options }) },
        redirectTo(options) { componentCalls.push({ api: 'redirectTo', options }) },
        switchTab(options) {
          componentCalls.push({ api: 'switchTab', options })
          if (throwNextComponentSwitchTab) {
            throwNextComponentSwitchTab = false
            throw new Error('switchTab synchronous failure')
          }
        },
      },
    },
  })
  componentRuntime.load(path.join(root, 'miniprogram', 'components', 'navigation-bar', 'navigation-bar.ts'))
  assert.ok(componentConfig, 'navigation-bar Component configuration was not registered')

  const rootTab = {
    data: { delta: 1, fallbackUrl: '/pages/home/index', fallbackIsTab: true },
    events: [],
    triggerEvent(name, detail, options) { this.events.push({ name, detail, options }) },
  }
  componentPages = []
  componentConfig.methods.back.call(rootTab)
  componentConfig.methods.back.call(rootTab)
  assert.equal(componentCalls.length, 1, 'rapid root Tab Back taps must issue one navigation call')
  assert.equal(componentCalls[0].api, 'switchTab')
  assert.equal(componentCalls[0].options.url, '/pages/home/index')
  assert.equal(componentCalls.filter((call) => call.api === 'redirectTo').length, 0)
  assert.equal(componentCalls.filter((call) => call.api === 'navigateTo').length, 0)
  componentCalls[0].options.fail({ errMsg: 'switchTab:fail' })
  componentCalls[0].options.complete({ errMsg: 'switchTab:fail' })
  assert.equal(rootTab.events.filter((event) => event.name === 'navigationfail').length, 1, 'fail and complete must report one retry cue')

  componentConfig.methods.back.call(rootTab)
  assert.equal(componentCalls.length, 2, 'switchTab failure must release the root action lock')
  componentCalls[1].options.complete({ errMsg: 'switchTab:complete' })
  assert.equal(rootTab.events.filter((event) => event.name === 'navigationfail').length, 2, 'complete without success must release and report failure once')

  componentConfig.methods.back.call(rootTab)
  assert.equal(componentCalls.length, 3, 'complete without success must permit retry')
  componentCalls[2].options.success({ errMsg: 'switchTab:ok' })
  componentCalls[2].options.complete({ errMsg: 'switchTab:ok' })
  componentConfig.methods.back.call(rootTab)
  assert.equal(componentCalls.length, 3, 'success must keep rapid duplicate root navigation locked')

  const syncFailureRoot = {
    data: { delta: 1, fallbackUrl: '/pages/home/index', fallbackIsTab: true },
    events: [],
    triggerEvent(name, detail, options) { this.events.push({ name, detail, options }) },
  }
  throwNextComponentSwitchTab = true
  componentConfig.methods.back.call(syncFailureRoot)
  assert.equal(componentCalls.length, 4, 'synchronous switchTab exception must be reported')
  assert.equal(syncFailureRoot.events.filter((event) => event.name === 'navigationfail').length, 1)
  componentConfig.methods.back.call(syncFailureRoot)
  assert.equal(componentCalls.length, 5, 'synchronous switchTab exception must release the lock for retry')
  componentCalls[4].options.success({ errMsg: 'switchTab:ok' })
  componentCalls[4].options.complete({ errMsg: 'switchTab:ok' })

  componentPages = [{ route: 'pages/home/index' }, { route: 'pages/institution/index' }]
  const withParent = {
    data: { delta: 1, fallbackUrl: '/pages/home/index', fallbackIsTab: true },
    events: [],
    triggerEvent(name, detail, options) { this.events.push({ name, detail, options }) },
  }
  componentConfig.methods.back.call(withParent)
  assert.equal(componentCalls.at(-1).api, 'navigateBack', 'valid parent must retain navigateBack even with a Tab fallback declaration')

  componentPages = []
  const ordinaryRoot = {
    data: { delta: 1, fallbackUrl: '/pages/assessment/preference', fallbackIsTab: false },
    events: [],
    triggerEvent(name, detail, options) { this.events.push({ name, detail, options }) },
  }
  componentConfig.methods.back.call(ordinaryRoot)
  assert.equal(componentCalls.at(-1).api, 'redirectTo', 'non-Tab root fallbacks must preserve redirectTo')

  const pageCalls = []
  const guardModule = createRuntime(typescript).load(path.join(root, 'miniprogram', 'utils', 'navigation-guard.ts'))
  let pageConfig = null
  let pageStack = []
  let authOrNetworkCalls = 0
  let throwNextPageSwitchTab = false
  const modulePath = (relativePath) => path.resolve(root, 'miniprogram', relativePath)
  const overrides = new Map([
    [modulePath('services/institution-list-detail-page.ts'), {
      buildInstitutionListPageSnapshot() { return Promise.resolve({ ok: false }) },
    }],
    [modulePath('pages/institution/list-view-model.ts'), {
      createInstitutionListErrorViewModel() { return {} },
      createInstitutionListLoadingViewModel() { return {} },
      createInstitutionListPageViewModel() { return {} },
    }],
    [modulePath('utils/navigation-guard.ts'), guardModule],
    [modulePath('services/institution-detail-route.ts'), { serializeInstitutionDetailRoute() { return null } }],
  ])
  const pageRuntime = createRuntime(typescript, {
    overrides,
    globals: {
      Page(config) { pageConfig = config },
      getCurrentPages: () => pageStack,
      wx: {
        navigateBack(options) { pageCalls.push({ api: 'navigateBack', options }) },
        redirectTo(options) { pageCalls.push({ api: 'redirectTo', options }) },
        switchTab(options) {
          pageCalls.push({ api: 'switchTab', options })
          if (throwNextPageSwitchTab) {
            throwNextPageSwitchTab = false
            throw new Error('switchTab synchronous failure')
          }
        },
        request() { authOrNetworkCalls += 1 },
        login() { authOrNetworkCalls += 1 },
        getPhoneNumber() { authOrNetworkCalls += 1 },
      },
    },
  })
  pageRuntime.load(modulePath('pages/institution/index.ts'))
  assert.ok(pageConfig, 'Institution List Page configuration was not registered')
  const page = {
    ...pageConfig,
    data: { ...pageConfig.data, viewModel: { pageState: 'empty' } },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  const originalViewModel = page.data.viewModel
  pageStack = [{ route: 'pages/home/index' }, { route: 'pages/institution/index' }]
  page.onBackToHome()
  assert.equal(pageCalls.length, 1)
  assert.equal(pageCalls[0].api, 'navigateBack', 'empty/error Back with a parent must navigateBack')
  pageCalls[0].options.fail({ errMsg: 'navigateBack:fail' })
  assert.equal(page.data.actionErrorMessage, '暂时无法返回，请稍后重试。', 'parent failure must retain visible retry feedback')
  page.onShow()

  pageStack = [{ route: 'pages/institution/index' }]
  page.onBackToHome()
  page.onBackToHome()
  assert.equal(pageCalls.length, 2, 'rapid root empty/error Back actions must issue one call')
  assert.equal(pageCalls[1].api, 'switchTab')
  assert.equal(pageCalls[1].options.url, '/pages/home/index')
  assert.equal(pageCalls.filter((call) => call.api === 'redirectTo').length, 0, 'Institution List root must not redirectTo Home Tab')
  pageCalls[1].options.fail({ errMsg: 'switchTab:fail' })
  pageCalls[1].options.complete({ errMsg: 'switchTab:fail' })
  assert.equal(page.data.actionErrorMessage, '暂时无法返回，请稍后重试。')
  assert.equal(page.data.viewModel, originalViewModel, 'Back must not mutate Institution List data')
  page.onBackToHome()
  assert.equal(pageCalls.length, 3, 'root switchTab failure must release the page guard for retry')
  assert.equal(pageCalls[2].api, 'switchTab')
  pageCalls[2].options.success({ errMsg: 'switchTab:ok' })
  pageCalls[2].options.complete({ errMsg: 'switchTab:ok' })
  page.onShow()
  throwNextPageSwitchTab = true
  page.onBackToHome()
  assert.equal(pageCalls.length, 4, 'synchronous root switchTab exception must be attempted once')
  assert.equal(page.data.actionErrorMessage, '暂时无法返回，请稍后重试。', 'synchronous switchTab exception must provide visible retry feedback')
  page.onBackToHome()
  assert.equal(pageCalls.length, 5, 'synchronous root switchTab exception must release the page guard')
  assert.equal(pageCalls[4].api, 'switchTab')
  pageCalls[4].options.success({ errMsg: 'switchTab:ok' })
  pageCalls[4].options.complete({ errMsg: 'switchTab:ok' })
  assert.equal(authOrNetworkCalls, 0, 'Back must not call auth, phone, or network APIs')

  return {
    componentRootTabCalls: componentCalls.filter((call) => call.api === 'switchTab').length,
    componentParentBackCalls: componentCalls.filter((call) => call.api === 'navigateBack').length,
    componentNonTabRedirectCalls: componentCalls.filter((call) => call.api === 'redirectTo').length,
    pageRootTabCalls: pageCalls.filter((call) => call.api === 'switchTab').length,
    pageParentBackCalls: pageCalls.filter((call) => call.api === 'navigateBack').length,
    pageHomeRedirectCalls: pageCalls.filter((call) => call.api === 'redirectTo').length,
    authOrNetworkCalls,
  }
}

const runExecutableNavigationHarness = () => {
  const typescript = loadWechatTypeScript()
  const domainRuntime = createRuntime(typescript)
  const sourceModule = domainRuntime.load(path.join(root, 'miniprogram', 'services', 'institution-recommendation-source.ts'))
  const registryModule = domainRuntime.load(path.join(root, 'miniprogram', 'services', 'institution-source-context.ts'))
  const routeModule = domainRuntime.load(path.join(root, 'miniprogram', 'services', 'institution-detail-route.ts'))
  const guardModule = domainRuntime.load(path.join(root, 'miniprogram', 'utils', 'navigation-guard.ts'))
  const baseRegistry = registryModule.createInstitutionSourceContextRegistry({
    tokenFactory: (() => { let value = 0; return () => `a0-4-harness-${++value}` })(),
  })
  let registerCount = 0
  let resolveCount = 0
  let clearCount = 0
  const registry = {
    register(input) { registerCount += 1; return baseRegistry.register(input) },
    resolve(ref) { resolveCount += 1; return baseRegistry.resolve(ref) },
    clear(ref) { clearCount += 1; return baseRegistry.clear(ref) },
    clearAll() { baseRegistry.clearAll() },
  }
  const snapshot = makeResultSnapshot()
  let applicationVersion = 2
  let evaluatorInvocationCount = 0
  const immediateResult = (value) => ({
    then(callback) {
      let caught = null
      try {
        callback(value)
      } catch (error) {
        caught = error
      }
      return {
        catch(handler) {
          if (caught !== null) handler(caught)
        },
      }
    },
  })
  const buildSnapshot = () => {
    evaluatorInvocationCount += 1
    return immediateResult(applicationVersion === 2
      ? { ok: true, version: 2, value: snapshot }
      : { ok: true, version: 1, value: {} })
  }
  const v2ViewModel = {
    state: 'ready_exact',
    cards: [{ institutionId: 'institution-a-mock', recordRevision: 1 }],
    conditionalCards: [],
  }
  const legacyViewModel = { state: 'ready_exact', cards: [], conditionalCards: [] }
  let pageConfig = null
  const navigations = []
  const wxRuntime = {
    navigateTo(options) { navigations.push(options) },
    navigateBack() {},
    redirectTo() {},
    switchTab() {},
  }
  const modulePath = (relativePath) => path.resolve(root, 'miniprogram', relativePath)
  const overrides = new Map([
    [modulePath('services/recommendation-result-application.ts'), {
      buildRecommendationResultApplicationSnapshot: buildSnapshot,
    }],
    [modulePath('services/institution-list-detail-page.ts'), {
      institutionSourceContextRegistry: registry,
    }],
    [modulePath('services/institution-recommendation-source.ts'), sourceModule],
    [modulePath('services/institution-detail-route.ts'), routeModule],
    [modulePath('utils/navigation-guard.ts'), guardModule],
    [modulePath('pages/recommendation/result-v2-view-model.ts'), {
      createRecommendationResultViewModelV2: () => v2ViewModel,
    }],
    [modulePath('pages/recommendation/result-view-model.ts'), {
      createRecommendationResultViewModel: () => legacyViewModel,
    }],
  ])
  const pageRuntime = createRuntime(typescript, {
    overrides,
    globals: {
      Page(config) { pageConfig = config },
      wx: wxRuntime,
      getCurrentPages: () => [],
    },
  })
  pageRuntime.load(modulePath('pages/recommendation/result.ts'))
  assert.ok(pageConfig, 'result Page configuration was not registered')
  const page = {
    ...pageConfig,
    data: { ...pageConfig.data },
    setData(patch, callback) {
      this.data = { ...this.data, ...patch }
      if (typeof callback === 'function') callback()
    },
  }
  const cardEvent = {
    currentTarget: {
      dataset: { institutionId: 'institution-a-mock', recordRevision: 1 },
    },
  }

  page.onShow()
  assert.equal(evaluatorInvocationCount, 1, 'one Result load must invoke the application evaluator boundary once')

  const evaluationBeforeCard = evaluatorInvocationCount
  page.onRecommendationCardTap(cardEvent)
  const cardClickEvaluationDelta = evaluatorInvocationCount - evaluationBeforeCard
  assert.equal(cardClickEvaluationDelta, 0, 'card tap must not rebuild Recommendation')
  assert.equal(registerCount, 1)
  assert.equal(navigations.length, 1)
  assert.match(navigations[0].url, /^\/pages\/institution\/detail\?institutionId=/)
  assert.match(navigations[0].url, /&recordRevision=1&source=recommendation&sourceContextRef=/)
  assert.doesNotMatch(navigations[0].url, /[?&]id=|reason=|difference=|tier=/)
  const firstUrl = new URL(navigations[0].url, 'https://a0-4.invalid')
  const firstRef = firstUrl.searchParams.get('sourceContextRef')
  assert.ok(firstRef)
  const firstContext = registry.resolve(firstRef)
  assert.equal(firstContext.ok, true)
  assert.equal(firstContext.value.datasetVersion, snapshot.sourceContext.datasetVersion)
  assert.equal(firstContext.value.evaluationAsOf, snapshot.sourceContext.evaluationAsOf)
  assert.equal(firstContext.value.recommendationRulesetVersion, snapshot.preview.semantics.versions.recommendationRulesetVersion)
  assert.deepEqual(
    JSON.parse(JSON.stringify(firstContext.value.manifest)),
    JSON.parse(JSON.stringify(snapshot.preview.semantics.poolManifest.entries.map((entry) => ({
      identity: { institutionId: entry.institutionId, recordRevision: entry.recordRevision },
      recordProvenance: entry.recordProvenance,
      recordStatus: entry.recordStatus,
      disposition: entry.disposition,
    })))),
  )

  page.onRecommendationCardTap(cardEvent)
  page.onRecommendationListTap()
  assert.equal(registerCount, 1, 'rapid card/list cross-actions must share one guard')
  assert.equal(navigations.length, 1, 'rapid card/list cross-actions must navigate once')
  assert.equal(evaluatorInvocationCount, 1)

  navigations[0].fail()
  navigations[0].complete()
  assert.equal(clearCount, 1, 'navigate failure must discard exactly one registered context')
  assert.equal(registry.resolve(firstRef).ok, false)

  const evaluationBeforeRetry = evaluatorInvocationCount
  page.onRecommendationCardTap(cardEvent)
  assert.equal(evaluatorInvocationCount - evaluationBeforeRetry, 0)
  assert.equal(registerCount, 2)
  assert.equal(navigations.length, 2, 'failure must release the guard for retry')
  const retryUrl = new URL(navigations[1].url, 'https://a0-4.invalid')
  const retryRef = retryUrl.searchParams.get('sourceContextRef')
  assert.ok(retryRef)
  navigations[1].success()
  navigations[1].complete()
  page.onRecommendationListTap()
  assert.equal(registerCount, 2, 'successful navigation stays locked until source page returns')
  assert.equal(navigations.length, 2)

  page.onShow()
  assert.equal(evaluatorInvocationCount, 2, 'returning to Result rebuilds exactly once under the frozen load contract')
  assert.equal(registry.resolve(retryRef).ok, false, 'return refresh must clear the prior session context')
  const evaluationBeforeList = evaluatorInvocationCount
  page.onRecommendationListTap()
  const listClickEvaluationDelta = evaluatorInvocationCount - evaluationBeforeList
  assert.equal(listClickEvaluationDelta, 0, 'list tap must not rebuild Recommendation')
  assert.equal(registerCount, 3)
  assert.equal(navigations.length, 3)
  assert.match(navigations[2].url, /^\/pages\/institution\/index\?sourceContextRef=/)
  const listRef = new URL(navigations[2].url, 'https://a0-4.invalid').searchParams.get('sourceContextRef')
  assert.ok(listRef)
  assert.equal(registry.resolve(listRef).ok, true)
  navigations[2].fail()
  navigations[2].complete()
  assert.equal(registry.resolve(listRef).ok, false)

  applicationVersion = 1
  page.onShow()
  assert.equal(evaluatorInvocationCount, 3)
  const registrationsBeforeLegacyActions = registerCount
  const navigationsBeforeLegacyActions = navigations.length
  page.onRecommendationCardTap(cardEvent)
  page.onRecommendationListTap()
  assert.equal(registerCount, registrationsBeforeLegacyActions, 'legacy Result must not register a V2 source context')
  assert.equal(navigations.length, navigationsBeforeLegacyActions, 'legacy Result must remain explicitly non-navigating')
  assert.match(page.data.actionErrorMessage, /本次候选列表已失效/)

  return {
    registerCount,
    resolveCount,
    clearCount,
    navigateCount: navigations.length,
    evaluatorInvocationCount,
    cardClickEvaluationDelta,
    listClickEvaluationDelta,
  }
}

const functionBody = (source, name) => {
  const match = new RegExp(`^\\s*(?:async\\s+)?${name}\\([^\\n]*\\)\\s*\\{`, 'm').exec(source)
  const start = match ? match.index : -1
  if (start < 0) return ''
  const open = source.indexOf('{', start)
  if (open < 0) return ''
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, index + 1)
    }
  }
  return source.slice(open)
}

const homeListBody = functionBody(homeTs, 'openInstitutions')
const homeCardBody = functionBody(homeTs, 'openInstitution')
const homeAssessmentBody = functionBody(homeTs, 'startAssessment')
const listCardBody = functionBody(listTs, 'onCardTap')
const resultCardBody = functionBody(resultTs, 'onRecommendationCardTap')

const matrix = Object.freeze([
  ['HOME-CTA', 'home.openInstitutions', 'ready', 'clickable', 'none', 'navigateTo /pages/institution/index', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['HOME-ASSESSMENT-ENTRY', 'home.startAssessment', 'Home root', 'clickable', 'none', 'navigateTo Intro; parent Back returns Home; root-only Back switches Home Tab', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['HOME-FEATURED', 'home.openInstitution', 'loaded canonical item', 'clickable', 'identity validation', 'direct_link detail', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['LIST-CARD', 'institution.list.onCardTap', 'ready canonical item', 'clickable', 'identity serialization', 'direct_list / recommendation detail', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['RESULT-EXACT', 'recommendation.result.onRecommendationCardTap', 'ready_exact V2 snapshot', 'clickable', 'snapshot identity gate', 'recommendation detail', 'guarded', 'rapid <= 1', 'context discard on fail'],
  ['RESULT-SOFT', 'recommendation.result.onRecommendationCardTap', 'ready_soft_near V2 snapshot', 'clickable', 'snapshot identity gate', 'recommendation detail', 'guarded', 'rapid <= 1', 'context discard on fail'],
  ['RESULT-CONDITIONAL', 'recommendation.result.onRecommendationCardTap', 'ready_conditional V2 snapshot', 'clickable', 'snapshot identity gate', 'recommendation detail', 'guarded', 'rapid <= 1', 'context discard on fail'],
  ['LIST-BACK', 'institution.list.back', 'visible page', 'clickable', 'none', 'navigateBack / home fallback', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['DETAIL-BACK', 'institution.detail.back', 'visible page', 'clickable', 'none', 'navigateBack / list fallback', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['RESULT-BACK', 'recommendation.result.back', 'visible page', 'clickable', 'none', 'existing back contract', 'guarded', 'rapid <= 1', 'visible fail feedback'],
  ['LIST-NAV-FAIL', 'institution.list.openDetail', 'navigation pending', 'one accepted action', 'none', 'none', 'release guard', 'retry allowed', 'inline error'],
  ['RESULT-NAV-FAIL', 'recommendation.result.openDetail', 'navigation pending', 'one accepted action', 'none', 'none', 'release guard + clear context', 'retry allowed', 'inline error'],
  ['RESULT-CONTEXT-LOSS', 'institution.detail source context', 'missing/expired ref', 'n/a', 'fail closed', 'source_context_error', 'n/a', 'n/a', 'no direct fallback'],
  ['DIRECT-DETAIL', 'institution.detail', 'direct route', 'n/a', 'canonical identity', 'DIRECT_CURRENT', 'n/a', 'n/a', 'no recommendation copy'],
  ['RECOMMENDATION-DETAIL', 'institution.detail', 'recommendation route', 'n/a', 'identity + context', 'RECOMMENDATION_PINNED', 'n/a', 'n/a', 'reason/difference visible'],
  ['RAPID-HOME', 'home.openInstitutions/openInstitution', 'pending', 'one physical action', 'guard', '<= 1 navigateTo', 'release on fail', 'retry after return', 'no duplicate push'],
  ['RAPID-LIST', 'institution.list.onCardTap', 'pending', 'one physical action', 'guard', '<= 1 navigateTo', 'release on fail', 'retry after return', 'no duplicate push'],
  ['RAPID-RESULT', 'recommendation.result.onRecommendationCardTap', 'pending', 'one physical action', 'guard', '<= 1 register + navigate', 'clear on fail', 'retry after return', 'no duplicate push'],
  ['RESULT-EVALUATION', 'recommendation.result card tap', 'snapshot already loaded', 'clickable', 'none', 'detail only', 'n/a', 'n/a', 'evaluator delta = 0'],
  ['VR-UNKNOWN', 'institution.detail VR', 'unknown', 'visible but unavailable', 'none', 'no fake VR route', 'n/a', 'n/a', 'honest unavailable state'],
  ['RETURN-RETRY', 'all source pages', 'returned from detail', 'clickable', 'guard reset onShow', 'same canonical route can retry', 'reset onShow', 'allowed', 'no stale lock'],
])

const failures = []
const executed = []
const run = (id, description, callback) => {
  assert.ok(!executed.includes(id), `duplicate case ${id}`)
  try {
    callback()
    executed.push(id)
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = () => {
  run('NAV-001', 'Interaction matrix covers all A0-4 actions', () => {
    assert.ok(matrix.length >= 15)
    assert.ok(matrix.some((entry) => entry[0] === 'RESULT-CONDITIONAL'))
    assert.ok(matrix.some((entry) => entry[0] === 'RESULT-CONTEXT-LOSS'))
    assert.ok(matrix.some((entry) => entry[0] === 'RESULT-EVALUATION'))
  })
  run('NAV-002', 'Home CTA reaches canonical list without auth or network', () => {
    assert.match(homeListBody, /getNavigationGuard/)
    assert.match(homeListBody, /wx\.navigateTo/)
    assert.match(homeListBody, /pages\/institution\/index/)
    assert.doesNotMatch(homeListBody, /wx\.request|wx\.login|getPhoneNumber/)
  })
  run('NAV-003', 'Home featured card uses canonical direct-link identity', () => {
    assert.match(homeCardBody, /serializeInstitutionDetailRoute/)
    assert.match(homeCardBody, /direct_link/)
    assert.match(homeCardBody, /item\.navigationIntent/)
    assert.doesNotMatch(homeCardBody, /\?id=|array|index|name lookup/i)
  })
  run('NAV-004', 'Home card WXML carries canonical view-model key only', () => {
    assert.match(homeWxml, /data-item-key="\{\{item\.key\}\}"/)
    assert.match(homeWxml, /bindtap="onCardTap"/)
    assert.doesNotMatch(homeWxml, /data-id=|detail\?id=/)
  })
  run('NAV-005', 'List card consumes existing ViewModel navigation intent', () => {
    assert.match(listCardBody, /viewModel\.items\.find/)
    assert.match(listCardBody, /item\.navigationIntent/)
    assert.match(listCardBody, /serializeInstitutionDetailRoute/)
    assert.match(listCardBody, /intent\.source/)
    assert.match(listCardBody, /intent\.sourceContextRef/)
  })
  run('NAV-006', 'List card has one guarded navigateTo and failure release', () => {
    assert.match(listCardBody, /getNavigationGuard/)
    assert.match(listCardBody, /institution\.list\.openDetail/)
    assert.match(listCardBody, /wx\.navigateTo/)
    assert.match(listCardBody, /guard\.release\('institution\.list\.openDetail'\)/)
    assert.match(listCardBody, /暂时无法打开机构详情/)
  })
  run('NAV-007', 'List WXML exposes one physical card action', () => {
    assert.equal((listWxml.match(/bindtap="onCardTap"/g) || []).length, 1)
    assert.match(listWxml, /data-institution-id="\{\{item\.navigationIntent\.institutionId\}\}"/)
    assert.match(listWxml, /data-record-revision="\{\{item\.navigationIntent\.recordRevision\}\}"/)
  })
  run('NAV-008', 'Result exact and soft cards use the same explicit handler', () => {
    assert.equal((resultWxml.match(/bindtap="onRecommendationCardTap"/g) || []).length, 2)
    assert.match(resultWxml, /data-institution-id="\{\{item\.institutionId\}\}"/)
    assert.match(resultWxml, /data-record-revision="\{\{item\.recordRevision\}\}"/)
  })
  run('NAV-009', 'Result conditional card is also canonical and not silently direct', () => {
    assert.match(resultWxml, /institution-card--conditional[\s\S]*bindtap="onRecommendationCardTap"/)
    assert.match(resultCardBody, /hasRecommendationIdentity/)
    assert.match(resultCardBody, /sourceContextRef/)
  })
  run('NAV-010', 'Result keeps current V2 application snapshot per page instance', () => {
    assert.match(resultTs, /resultSnapshots = new WeakMap/)
    assert.match(resultTs, /resultSnapshots\.delete\(this\)/)
    assert.match(resultTs, /resultSnapshots\.set\(this, result\.value\)/)
    assert.doesNotMatch(resultCardBody, /buildRecommendationResultApplicationSnapshot/)
  })
  run('NAV-011', 'Result registers source context only after guard acceptance', () => {
    const guardIndex = resultCardBody.indexOf("guard.acquire('recommendation.result.openInstitution')")
    const registerIndex = resultCardBody.indexOf('registerInstitutionRecommendationSourceContextV2(')
    assert.ok(guardIndex >= 0 && registerIndex > guardIndex)
    assert.match(resultCardBody, /institutionSourceContextRegistry/)
  })
  run('NAV-012', 'Result navigation keeps query data minimal and canonical', () => {
    assert.match(resultCardBody, /serializeInstitutionDetailRoute/)
    assert.match(resultCardBody, /'recommendation'/)
    assert.doesNotMatch(resultCardBody, /\brecommendationId\b/i)
    assert.doesNotMatch(resultCardBody, /\?id=|array index|name lookup/i)
  })
  run('NAV-013', 'Result navigation failure explicitly discards context and releases guard', () => {
    assert.match(resultCardBody, /institutionSourceContextRegistry\.clear\(sourceContextRef\)/)
    assert.match(resultCardBody, /guard\.release\('recommendation\.result\.openInstitution'\)/)
    assert.match(resultCardBody, /暂时无法打开机构详情/)
  })
  run('NAV-014', 'Result evaluator is not re-run by card action', () => {
    assert.doesNotMatch(resultCardBody, /refreshRecommendation|buildRecommendationResultApplicationSnapshot|deriveRecommendation|loadCatalog|readInitialDraft/)
    assert.match(resultTs, /resultSnapshots\.set\(this, result\.value\)/)
  })
  run('NAV-015', 'Detail route keeps direct and recommendation source contracts separate', () => {
    assert.match(routeTs, /source === 'recommendation' && sourceContextRef === null/)
    assert.match(routeTs, /source === 'direct' && sourceContextRef !== null/)
    assert.match(detailTs, /parseInstitutionDetailRouteQuery/)
    assert.match(detailTs, /buildInstitutionDetailPageSnapshot/)
  })
  run('NAV-016', 'Source context loss fails closed without direct fallback', () => {
    assert.match(registryTs, /SOURCE_CONTEXT_NOT_FOUND/)
    assert.match(registryTs, /SOURCE_CONTEXT_EXPIRED/)
    assert.match(detailTs, /source_context_error/)
    assert.doesNotMatch(detailTs, /fallback.*latest|current.*fallback/i)
  })
  run('NAV-017', 'Recommendation context projection consumes frozen snapshot only', () => {
    assert.match(sourceTs, /RecommendationResultApplicationSnapshotV2/)
    assert.match(sourceTs, /projectInstitutionNavigationSourceContextV2/)
    assert.match(sourceTs, /registerInstitutionRecommendationSourceContextV2/)
    assert.doesNotMatch(sourceTs, /from ['"].*assessment|deriveElderProfile|deriveRecommendation|loadCatalog|institutionCatalogService/i)
  })
  run('NAV-018', 'Back uses existing guard and is reset after returning', () => {
    assert.match(listTs, /resetNavigationGuard\(this\)/)
    assert.match(detailTs, /resetNavigationGuard\(this\)/)
    assert.match(navGuardTs, /release\(/)
    assert.match(navGuardTs, /reset\(/)
  })
  run('NAV-019', 'VR unknown remains unavailable and does not create fake route', () => {
    const vrAction = functionBody(detailTs, 'onVrTap')
    assert.match(vrAction, /!this\.data\.viewModel\.media\.canOpenVr/)
    assert.match(vrAction, /serializeInstitutionDetailRoute/)
    assert.match(vrAction, /if \(!route\) return/)
  })
  run('NAV-020', 'Canonical navigation code contains no legacy id-only route', () => {
    const all = `${homeTs}\n${homeWxml}\n${listTs}\n${listWxml}\n${resultTs}\n${resultWxml}`
    assert.doesNotMatch(all, /detail\?id=|\?id=|data-id=|item\.id|name lookup/i)
    assert.doesNotMatch(all, /机构详情入口正在开发验证中|不会打开详情页面/)
  })
  run('NAV-021', 'No public navigation handler introduces auth or network calls', () => {
    const all = `${homeTs}\n${listTs}\n${resultTs}`
    assert.doesNotMatch(all, /wx\.request|wx\.login|getPhoneNumber|phoneNumber/)
  })
  run('NAV-022', 'New page changes retain real-device class-field rule', () => {
    const all = `${homeTs}\n${listTs}\n${resultTs}`
    assert.doesNotMatch(all, /class\s+[A-Za-z_$][\w$]*\s*\{[^}]*\b[A-Za-z_$][\w$]*\s*=/s)
    assert.doesNotMatch(all, /\?\./)
  })
  run('NAV-023', 'Executable Result card/list harness proves shared guard and context lifecycle', () => {
    const metrics = runExecutableNavigationHarness()
    assert.equal(metrics.navigateCount, 3)
    assert.equal(metrics.registerCount, 3)
    assert.equal(metrics.evaluatorInvocationCount, 3)
    assert.equal(metrics.cardClickEvaluationDelta, 0)
    assert.equal(metrics.listClickEvaluationDelta, 0)
    assert.ok(metrics.resolveCount >= 5)
    assert.ok(metrics.clearCount >= 3)
  })
  run('NAV-024', 'Home assessment entry preserves its parent and legal root Back fallback', () => {
    assert.equal((homeWxml.match(/(?:bind:action|bindtap)="startAssessment"/g) || []).length, 1, 'Home exposes one primary Assessment action')
    assert.match(homeAssessmentBody, /navigateToWithGuard/)
    assert.doesNotMatch(homeAssessmentBody, /wx\.(?:reLaunch|redirectTo)/)
    assert.match(homeAssessmentBody, /无法开始评估/)
    assert.match(introWxml, /fallbackUrl="\/pages\/home\/index"/)
    assert.match(introWxml, /fallbackIsTab="\{\{true\}\}"/)
    assert.match(navigationBarTs, /pages\.length <= 1 && data\.fallbackUrl[\s\S]*data\.fallbackIsTab[\s\S]*wx\.switchTab[\s\S]*wx\.redirectTo/)
    const metrics = runHomeAssessmentEntryHarness()
    assert.deepEqual(metrics, { reLaunchCount: 0, navigateCount: 2, toastCount: 1 })
  })
  run('NAV-025', 'Institution List root Back uses Home Tab and preserves parent/failure semantics', () => {
    assert.match(listWxml, /fallbackUrl="\/pages\/home\/index"/)
    assert.match(listWxml, /fallbackIsTab="\{\{true\}\}"/)
    const metrics = runInstitutionRootBackHarness()
    assert.deepEqual(metrics, {
      componentRootTabCalls: 5,
      componentParentBackCalls: 1,
      componentNonTabRedirectCalls: 1,
      pageRootTabCalls: 4,
      pageParentBackCalls: 1,
      pageHomeRedirectCalls: 0,
      authOrNetworkCalls: 0,
    })
  })
  assert.equal(executed.length, 25)
  assert.equal(failures.length, 0, failures.join('\n'))
  console.log(`A0_4_INTERACTION_MATRIX_CASES: ${matrix.length}`)
  console.log(`A0_4_INTERACTION_CASES: ${executed.length}/25 PASS`)
  console.log('INSTITUTION_NAVIGATION_A0_4_INTERACTIONS = PASS')
}

try {
  main()
} catch (error) {
  console.error('INSTITUTION_NAVIGATION_A0_4_INTERACTIONS = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
}
