/**
 * Targeted B3 Consultant Page/ViewModel interaction gate.
 *
 * This harness uses only synthetic public-safe Application results. It does
 * not claim DevTools, Simulator, or Android evidence and never imports a
 * fixture from the production graph.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
      const ts = require(file)
      if (ts.version === '4.1.2') return ts
    }
  }
  throw new Error('WeChat TypeScript 4.1.2 parser is required')
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
      localRequire,
      module,
      module.exports,
    )
    return module.exports
  }
  return { load }
}

const makeConsultant = (phone, qr, serviceStatus = 'active') => ({
  consultantId: 'consultant-b3-test',
  displayName: '测试顾问（仅自动化）',
  serviceStatus,
  serviceAreaDisplayName: '测试服务区域（仅自动化）',
  phone,
  enterpriseWechatQr: qr,
})

const phoneAvailable = {
  status: 'available',
  label: '养老顾问电话',
  displayValue: '00000000000',
  dialValue: '00000000000',
  actionAvailable: true,
}
const phoneMissing = {
  status: 'missing',
  label: '养老顾问电话',
  actionAvailable: false,
}
const qrAvailable = {
  status: 'available',
  label: '企业微信养老顾问',
  publicImageUrl: 'https://example.test/b3-qr.png',
  actionAvailable: true,
}
const qrMissing = {
  status: 'missing',
  label: '企业微信养老顾问',
  actionAvailable: false,
}

const snapshotResult = (consultant, resolutionStatus = 'available') => ({
  ok: true,
  value: {
    kind: 'global_consultant_public_application_snapshot_v1',
    contractVersion: 'global-consultant-snapshot-contract-v1',
    context: {
      kind: 'platform_global_consultant',
      selectionRole: 'platform_primary_consultant',
      selectionSource: 'platform_configuration',
    },
    snapshotAsOf: '2026-09-16T00:00:00.000Z',
    dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    selectionStatus: 'configured',
    resolutionStatus,
    consultant,
  },
})

const failureResult = () => ({
  ok: false,
  error: {
    kind: 'global_consultant_public_application_failure_v1',
    status: 'unavailable',
  },
})

const runViewModelCases = (typescript) => {
  const runtime = createRuntime(typescript)
  const module = runtime.load(path.join(repositoryRoot, 'miniprogram', 'pages', 'consultant', 'index-view-model.ts'))
  const createViewModel = module.createConsultantPageViewModelV1
  const both = createViewModel(snapshotResult(makeConsultant(phoneAvailable, qrAvailable)))
  assert.equal(both.pageState, 'available')
  assert.equal(both.showPhoneAction, true)
  assert.equal(both.showQrImage, true)
  assert.equal(both.qr.allowLongPress, true)

  const phoneOnly = createViewModel(snapshotResult(makeConsultant(phoneAvailable, qrMissing)))
  assert.equal(phoneOnly.pageState, 'phone_only')
  assert.equal(phoneOnly.showPhoneAction, true)
  assert.equal(phoneOnly.showQrImage, false)

  const qrOnly = createViewModel(snapshotResult(makeConsultant(phoneMissing, qrAvailable)))
  assert.equal(qrOnly.pageState, 'qr_only')
  assert.equal(qrOnly.showPhoneAction, false)
  assert.equal(qrOnly.showQrImage, true)

  const expired = createViewModel(snapshotResult(makeConsultant(phoneMissing, {
    status: 'expired',
    label: '企业微信养老顾问',
    actionAvailable: false,
  }), 'expired'))
  assert.equal(expired.pageState, 'expired')
  assert.equal(expired.showQrImage, false)

  const inactive = createViewModel(snapshotResult(null, 'inactive'))
  assert.equal(inactive.pageState, 'inactive')
  assert.equal(inactive.showIdentity, false)

  const unknown = createViewModel(snapshotResult(null, 'unknown'))
  assert.equal(unknown.pageState, 'unknown')
  assert.equal(unknown.showIdentity, false)

  const unavailable = createViewModel(snapshotResult(null, 'unavailable'))
  assert.equal(unavailable.pageState, 'unavailable')
  assert.equal(unavailable.showIdentity, false)
  assert.equal(unavailable.showReloadAction, true)

  const missing = createViewModel({
    ...snapshotResult(null, 'missing'),
    value: { ...snapshotResult(null, 'missing').value, selectionStatus: 'missing' },
  })
  assert.equal(missing.pageState, 'missing')
  assert.equal(missing.showIdentity, false)
  assert.equal(missing.showReloadAction, true)
  const failure = createViewModel(failureResult())
  assert.equal(failure.pageState, 'failure')
  assert.equal(failure.showReloadAction, true)
  return { both, phoneOnly, qrOnly, expired, missing }
}

const runPageInteractionCases = (typescript, applicationResult) => {
  let currentApplicationResult = applicationResult.value
  let applicationLoads = 0
  let componentConfig = null
  const phoneCalls = []
  const navigations = []
  const wxRuntime = {
    makePhoneCall(options) { phoneCalls.push(options) },
    navigateTo(options) { navigations.push(options) },
  }
  const modulePath = (relativePath) => path.resolve(repositoryRoot, 'miniprogram', relativePath)
  const pageRuntime = createRuntime(typescript, {
    globals: {
      Component(config) { componentConfig = config },
      wx: wxRuntime,
    },
    overrides: new Map([
      [modulePath('services/consultant-global-page.ts'), {
        buildGlobalConsultantPageApplicationV1: () => {
          applicationLoads += 1
          return currentApplicationResult
        },
      }],
    ]),
  })
  pageRuntime.load(modulePath('pages/consultant/index.ts'))
  assert.ok(componentConfig)
  const page = {
    ...componentConfig,
    ...componentConfig.methods,
    data: { ...componentConfig.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
  page.lifetimes.attached.call(page)
  assert.equal(page.data.pageState, 'available')
  page.onPhoneTap()
  page.onPhoneTap()
  assert.equal(phoneCalls.length, 1)
  phoneCalls[0].fail()
  phoneCalls[0].complete()
  assert.equal(page.data.actionErrorKey, 'phone')
  page.onPhoneTap()
  assert.equal(phoneCalls.length, 2)
  phoneCalls[1].success()
  phoneCalls[1].complete()

  currentApplicationResult = snapshotResult(null, 'missing')
  page.loadConsultant()
  const loadsBeforeRetry = applicationLoads
  page.onRetry()
  assert.equal(applicationLoads, loadsBeforeRetry + 1)
  assert.equal(page.data.pageState, 'missing')
  const callsBeforeUnavailable = phoneCalls.length
  page.onPhoneTap()
  assert.equal(phoneCalls.length, callsBeforeUnavailable)

  page.onAppointmentTap()
  page.onAppointmentTap()
  assert.equal(navigations.length, 1)
  navigations[0].fail()
  navigations[0].complete()
  assert.equal(page.data.actionErrorKey, 'appointment')
  page.onAppointmentTap()
  assert.equal(navigations.length, 2)
  navigations[1].success()
  navigations[1].complete()

  return {
    applicationLoads,
    phoneCalls: phoneCalls.length,
    navigations: navigations.length,
  }
}

const runStaticIsolationCases = () => {
  const pageSource = read('miniprogram/pages/consultant/index.ts')
  const applicationSource = read('miniprogram/services/consultant-global-page.ts')
  const wxml = read('miniprogram/pages/consultant/index.wxml')
  const appConfig = read('miniprogram/app.json')
  const homeSource = read('miniprogram/pages/home/index.ts')
  const recommendationResultSource = read('miniprogram/pages/recommendation/result.ts')
  const institutionVrSource = read('miniprogram/pages/institution/vr.ts')
  assert.match(pageSource, /buildGlobalConsultantPageApplicationV1/)
  assert.doesNotMatch(pageSource, /institutionId|recordRevision|loadAssignments|loadDefaultConsultant|resolveForInstitution/)
  assert.doesNotMatch(applicationSource, /scripts[\\/]fixtures|miniprogram[\\/]mock/)
  assert.match(applicationSource, /sourceState: 'missing'/)
  assert.doesNotMatch(wxml, /institutionId|recordRevision|wechatQrMediaId|internalMediaId/)
  assert.match(wxml, /show-menu-by-longpress/)
  assert.match(wxml, /bind:action="onPhoneTap"/)
  assert.match(wxml, /bind:action="onAppointmentTap"/)
  assert.match(homeSource, /wx\.switchTab\(\{[\s\S]*?url: '\/pages\/consultant\/index'/)
  assert.match(recommendationResultSource, /wx\.switchTab\(\{[\s\S]*?url: '\/pages\/consultant\/index'/)
  assert.match(institutionVrSource, /nextUrl: '\/pages\/consultant\/index'/)
  assert.match(institutionVrSource, /nextIsTab: true/)
  assert.match(appConfig, /pages\/consultant\/index/)
  const productionConsultantSurface = `${pageSource}\n${applicationSource}\n${wxml}\n${appConfig}`
  assert.doesNotMatch(productionConsultantSurface, /User\.phone/)
  assert.doesNotMatch(productionConsultantSurface, /(?:institutionOfficialPhone|officialPhoneFallback|institution_official_phone)/i)
  assert.doesNotMatch(productionConsultantSurface, /(?:internalMediaId|wechatQrMediaId)/)
  ;[
    '解读老人画像与照护需求',
    '解释推荐结果与机构差异',
    '协助确认最新床位与价格信息',
    '协助预约带看',
    '跟进入住沟通',
  ].forEach((serviceCopy) => assert.match(wxml, new RegExp(serviceCopy)))
}

const run = () => {
  const typescript = loadWechatTypeScript()
  const viewModels = runViewModelCases(typescript)
  const interactions = runPageInteractionCases(typescript, {
    value: snapshotResult(makeConsultant(phoneAvailable, qrAvailable)),
  })
  runStaticIsolationCases()
  console.log('CONSULTANT_B3_VIEWMODEL_STATES: PASS')
  console.log('CONSULTANT_B3_PHONE_INTERACTION: PASS')
  console.log('CONSULTANT_B3_RELOAD_INTERACTION: PASS')
  console.log('CONSULTANT_B3_APPOINTMENT_NAVIGATION: PASS')
  console.log('CONSULTANT_B3_GLOBAL_UI_CONTEXT_ISOLATION: PASS')
  console.log(`PHONE_API_CALLS: ${interactions.phoneCalls}`)
  console.log(`APPLICATION_LOADS: ${interactions.applicationLoads}`)
  console.log(`APPOINTMENT_NAVIGATIONS: ${interactions.navigations}`)
  console.log(`VIEWMODEL_CASES: ${Object.keys(viewModels).length}`)
}

try {
  run()
} catch (error) {
  console.error('CONSULTANT_B3_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
}
