import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  elderProfilePreviewFixtures,
  elderProfilePreviewParityFixtures,
  makePreviewDraft,
  PREVIEW_REGION_SNAPSHOT,
} from './fixtures/elder-profile-preview-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const failures = []
const caseIds = []
let caseCount = 0

const EXPECTED_PROFILE_CASE_IDS = Object.freeze([
  'PROFILE-001', 'PROFILE-002', 'PROFILE-003', 'PROFILE-004', 'PROFILE-005',
  'PROFILE-006', 'PROFILE-007', 'PROFILE-008', 'PROFILE-009', 'PROFILE-010',
  'PROFILE-011', 'PROFILE-012', 'PROFILE-013', 'PROFILE-014', 'PROFILE-015',
  'PROFILE-016', 'PROFILE-017', 'PROFILE-018', 'PROFILE-019', 'PROFILE-020',
])

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const readText = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    return { parser: require(parserPath), parserPath }
  }

  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch {
    // The repository intentionally keeps TypeScript out of runtime dependencies.
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or open WeChat DevTools')
  }

  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) {
    throw new Error('WeChat DevTools profile directory not found')
  }

  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) {
      continue
    }
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) {
      continue
    }
    for (const runtime of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or open WeChat DevTools')
  }
  return { parser: require(candidates[0].parserPath), parserPath: candidates[0].parserPath }
}

/** Execute production TypeScript using the TypeScript parser shipped with WeChat DevTools. */
const createSourceLoader = (typescript, loadedSourcePaths) => {
  const moduleCache = new Map()

  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.js`,
      `${basePath}.json`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.js'),
    ]
    const resolved = candidates.find((candidate) => existsSync(candidate))
    if (!resolved) {
      throw new Error(`Cannot resolve ${request} from ${importer}`)
    }
    return resolved
  }

  const loadModule = (filePath) => {
    const resolvedPath = path.resolve(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }
    if (resolvedPath.includes(`${path.sep}tmp${path.sep}`)) {
      throw new Error(`Profile runtime must not load tmp artifact: ${resolvedPath}`)
    }

    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    loadedSourcePaths.add(resolvedPath)
    const source = readFileSync(resolvedPath, 'utf8')
    if (resolvedPath.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }

    const output = resolvedPath.endsWith('.ts')
      ? typescript.transpileModule(source, {
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          esModuleInterop: true,
        },
        fileName: resolvedPath,
      })
      : { outputText: source, diagnostics: [] }

    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        throw new Error(`Pure Profile runtime forbids external import ${request} from ${resolvedPath}`)
      }
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output.outputText}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }

  return loadModule
}

const runtimeState = {
  storage: Object.create(null),
  pageStack: [],
  navigationCalls: [],
  modalCalls: [],
  navigationModes: {
    navigateTo: 'success',
    navigateBack: 'success',
    redirectTo: 'success',
    switchTab: 'success',
  },
  authCalls: 0,
  requestCalls: 0,
  phoneCalls: 0,
  setDataCalls: [],
  removeStorageCalls: 0,
}

const previousComponent = globalThis.Component
const previousPage = globalThis.Page
const previousWx = globalThis.wx
const previousGetCurrentPages = globalThis.getCurrentPages

const componentDefinitions = []
const pageDefinitions = []

const invokeNavigation = (type, options) => {
  runtimeState.navigationCalls.push({
    type,
    url: options.url,
    delta: options.delta,
    options,
  })
  const mode = runtimeState.navigationModes[type]
  if (mode === 'throw') {
    throw new Error(`${type} failed synchronously`)
  }
  if (mode === 'fail') {
    if (options.fail) {
      options.fail({ errMsg: `${type}:fail` })
    }
    if (options.complete) {
      options.complete({ errMsg: `${type}:fail` })
    }
    return
  }
  if (options.success) {
    options.success({})
  }
  if (options.complete) {
    options.complete({})
  }
}

globalThis.Component = (definition) => {
  componentDefinitions.push(definition)
  return definition
}

globalThis.Page = (definition) => {
  pageDefinitions.push(definition)
  return definition
}

globalThis.getCurrentPages = () => runtimeState.pageStack

globalThis.wx = {
  getStorageSync(key) {
    return runtimeState.storage[key]
  },
  setStorageSync(key, value) {
    runtimeState.storage[key] = value
  },
  removeStorageSync(key) {
    runtimeState.removeStorageCalls += 1
    delete runtimeState.storage[key]
  },
  showModal(options) {
    runtimeState.modalCalls.push(options)
  },
  navigateTo(options) {
    invokeNavigation('navigateTo', options)
  },
  navigateBack(options) {
    invokeNavigation('navigateBack', options)
  },
  redirectTo(options) {
    invokeNavigation('redirectTo', options)
  },
  switchTab(options) {
    invokeNavigation('switchTab', options)
  },
  login() {
    runtimeState.authCalls += 1
  },
  request() {
    runtimeState.requestCalls += 1
  },
  getPhoneNumber() {
    runtimeState.phoneCalls += 1
  },
}

const cloneSerializable = (value) => {
  if (Array.isArray(value)) {
    return value.map(cloneSerializable)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSerializable(item)]))
  }
  return value
}

const mountPage = (definition) => {
  const instance = {
    data: cloneSerializable(definition.data || {}),
    handlerCalls: Object.create(null),
    setData(updates, callback) {
      runtimeState.setDataCalls.push({ instance: this, updates })
      Object.assign(this.data, updates)
      if (callback) {
        callback()
      }
    },
  }
  Object.entries(definition).forEach(([name, handler]) => {
    if (typeof handler === 'function') {
      instance[name] = handler.bind(instance)
    }
  })
  return instance
}

const mountComponent = (definition) => {
  const data = cloneSerializable(definition.data || {})
  Object.entries(definition.properties || {}).forEach(([name, property]) => {
    if (Object.prototype.hasOwnProperty.call(property, 'value')) {
      data[name] = cloneSerializable(property.value)
    }
  })
  const instance = {
    data,
    events: [],
    setData(updates, callback) {
      Object.assign(this.data, updates)
      if (callback) {
        callback()
      }
    },
    triggerEvent(name, detail, options) {
      this.events.push({ name, detail, options })
    },
  }
  Object.entries(definition.methods || {}).forEach(([name, handler]) => {
    instance[name] = handler.bind(instance)
  })
  return instance
}

const invoke = (instance, name, ...args) => {
  instance.handlerCalls[name] = (instance.handlerCalls[name] || 0) + 1
  return instance[name](...args)
}

const loadPageDefinition = (loadModule, relativePath) => {
  const before = pageDefinitions.length
  loadModule(path.join(repositoryRoot, relativePath))
  assert.equal(pageDefinitions.length, before + 1, `${relativePath} did not register exactly one page`)
  return pageDefinitions.at(-1)
}

const loadComponentDefinition = (loadModule, relativePath) => {
  const before = componentDefinitions.length
  loadModule(path.join(repositoryRoot, relativePath))
  assert.equal(componentDefinitions.length, before + 1, `${relativePath} did not register exactly one component`)
  return componentDefinitions.at(-1)
}

const runCase = (id, description, callback) => {
  caseCount += 1
  if (caseIds.indexOf(id) >= 0) {
    throw new Error(`duplicate profile runtime case id ${id}`)
  }
  caseIds.push(id)
  try {
    callback()
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${id}: ${message}`)
    console.error(`FAIL ${id} ${description}: ${message}`)
  }
}

const fixture = (id) => {
  const found = [...elderProfilePreviewFixtures, ...elderProfilePreviewParityFixtures]
    .find((item) => item.id === id)
  if (!found) {
    throw new Error(`unknown profile fixture ${id}`)
  }
  return found
}

const answersFor = (id, overrides = {}) => ({
  ...clone(fixture(id).answers),
  ...clone(overrides),
})

/**
 * Profile Phase 3B is frozen against Assessment V1. The production Draft
 * Store now owns active Schema V2 migration, so this historical regression
 * harness supplies an explicit V1 Draft boundary instead of pretending that
 * a V2 Draft is valid Profile V1 input.
 */
const installHistoricalV1DraftStoreHarness = (draftStore, draftStorageKey) => {
  const emptyDraft = () => ({
    kind: 'assessment_draft',
    schemaVersion: 1,
    localDraftId: 'profile-v1-runtime-draft',
    persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
    currentStep: 'basic',
    answers: {},
    startedAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
  })
  let activeDraft = emptyDraft()
  const snapshot = () => clone(activeDraft)
  const persist = (status = 'saved') => {
    runtimeState.storage[draftStorageKey] = snapshot()
    return { draft: snapshot(), persistence: { ok: true, status } }
  }

  draftStore.getDraft = snapshot
  draftStore.hasAnswers = () => Object.keys(activeDraft.answers).length > 0
  draftStore.getAnswer = (questionId) => clone(activeDraft.answers[questionId])
  draftStore.setAnswer = (questionId, value) => {
    activeDraft.answers[questionId] = clone(value)
    if (questionId === 'basic.hasInstitutionExperience' && value !== 'true') {
      delete activeDraft.answers['basic.institutionExitReasons']
    }
    return persist()
  }
  draftStore.clearAnswer = (questionId) => {
    delete activeDraft.answers[questionId]
    return persist()
  }
  draftStore.setCurrentStep = (step) => {
    activeDraft.currentStep = step
    return persist()
  }
  draftStore.clear = () => {
    activeDraft = emptyDraft()
    return persist('cleared')
  }
  draftStore.getLastPersistenceResult = () => ({ ok: true, status: 'saved' })
}

const resetRuntime = (draftStore) => {
  runtimeState.storage = Object.create(null)
  const cleared = draftStore.clear()
  assert.equal(cleared.persistence.ok, true, 'test Draft reset must persist successfully')
  runtimeState.navigationCalls.length = 0
  runtimeState.modalCalls.length = 0
  runtimeState.navigationModes.navigateTo = 'success'
  runtimeState.navigationModes.navigateBack = 'success'
  runtimeState.navigationModes.redirectTo = 'success'
  runtimeState.navigationModes.switchTab = 'success'
  runtimeState.authCalls = 0
  runtimeState.requestCalls = 0
  runtimeState.phoneCalls = 0
  runtimeState.setDataCalls.length = 0
  runtimeState.removeStorageCalls = 0
  runtimeState.pageStack = [
    { route: 'pages/assessment/intro' },
    { route: 'pages/assessment/profile' },
  ]
}

const seedAnswers = (draftStore, answers) => {
  Object.entries(answers).forEach(([questionId, value]) => {
    const result = draftStore.setAnswer(questionId, clone(value))
    assert.equal(result.persistence.ok, true, `seed answer rejected: ${questionId}`)
  })
  const stepResult = draftStore.setCurrentStep('budget')
  assert.equal(stepResult.persistence.ok, true, 'seed currentStep rejected')
}

const preparePage = (pageDefinition, draftStore, answers = null, pageStack = null) => {
  resetRuntime(draftStore)
  if (answers) {
    seedAnswers(draftStore, answers)
  }
  if (pageStack) {
    runtimeState.pageStack = pageStack
  }
  const page = mountPage(pageDefinition)
  page.route = 'pages/assessment/profile'
  if (runtimeState.pageStack.length > 0) {
    runtimeState.pageStack[runtimeState.pageStack.length - 1] = page
  }
  invoke(page, 'onShow')
  return page
}

const draftSnapshot = (draftStore, draftStorageKey) => ({
  draft: clone(draftStore.getDraft()),
  storage: clone(runtimeState.storage[draftStorageKey]),
})

const readyPage = (pageDefinition, draftStore, id = 'PREVIEW-001', overrides = {}, pageStack = null) =>
  preparePage(pageDefinition, draftStore, answersFor(id, overrides), pageStack)

const readyViewModel = (page) => {
  assert.equal(page.data.pageState, 'ready')
  assert.ok(page.data.viewModel)
  return page.data.viewModel
}

const rowByLabel = (rows, label) => {
  const row = rows.find((item) => item.label === label)
  assert.ok(row, `missing profile row ${label}`)
  return row
}

const rowValues = (rows) => rows.map((item) => item.value)

const assertNavigationSummary = (expected) => {
  assert.deepEqual(
    runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url, delta: call.delta })),
    expected,
  )
}

const assertNoSensitiveNavigationCode = () => {
  const sources = [
    'miniprogram/pages/assessment/profile.ts',
    'miniprogram/pages/assessment/profile-view-model.ts',
    'miniprogram/pages/assessment/profile.wxml',
  ]
  sources.forEach((relativePath) => {
    const source = readText(relativePath)
    assert.doesNotMatch(source, /wx\.(?:login|request)\s*\(/, `${relativePath} calls wx login/request`)
    assert.doesNotMatch(source, /getPhoneNumber|phoneNumber|requestPhoneNumber/i, `${relativePath} calls phone authorization API`)
  })
}

const assertPureProfileGraph = (loadedSourcePaths) => {
  const expectedFiles = [
    path.join(miniprogramRoot, 'pages', 'assessment', 'profile.ts'),
    path.join(miniprogramRoot, 'pages', 'assessment', 'profile-view-model.ts'),
    path.join(miniprogramRoot, 'store', 'assessment-draft.ts'),
    path.join(miniprogramRoot, 'utils', 'navigation-guard.ts'),
    path.join(miniprogramRoot, 'domain', 'elder-profile', 'derive-elder-profile-preview.ts'),
    path.join(miniprogramRoot, 'types', 'assessment.ts'),
  ]
  expectedFiles.forEach((filePath) => {
    assert.equal(loadedSourcePaths.has(filePath), true, `profile runtime did not load ${filePath}`)
  })
  loadedSourcePaths.forEach((filePath) => {
    assert.equal(filePath.startsWith(miniprogramRoot), true, `profile graph escaped miniprogram: ${filePath}`)
    assert.equal(filePath.includes(`${path.sep}tmp${path.sep}`), false, `tmp artifact loaded: ${filePath}`)
    // The current mode adapter only formats the headline. Keep actual domain /
    // service imports forbidden, while allowing this exact pure display seam.
    const isDisplayAdapter = filePath === path.join(miniprogramRoot, 'runtime', 'institution-display.ts')
    assert.equal(!isDisplayAdapter && /(?:institution|recommendation|appointment|consultant)/i.test(filePath), false,
      `profile graph loaded out-of-scope module: ${filePath}`)
  })
}

const run = async () => {
  const { parser, parserPath } = await getTypeScriptParser()
  const loadedSourcePaths = new Set()
  const loadModule = createSourceLoader(parser, loadedSourcePaths)
  const draftModule = loadModule(path.join(miniprogramRoot, 'store', 'assessment-draft.ts'))
  const previewModule = loadModule(path.join(miniprogramRoot, 'domain', 'elder-profile', 'derive-elder-profile-preview.ts'))
  const profileDefinition = loadPageDefinition(loadModule, 'miniprogram/pages/assessment/profile.ts')
  const navigationBarDefinition = loadComponentDefinition(loadModule, 'miniprogram/components/navigation-bar/navigation-bar.ts')
  const draftStore = draftModule.assessmentDraftStore
  const draftStorageKey = draftModule.assessmentDraftStorageKey
  installHistoricalV1DraftStoreHarness(draftStore, draftStorageKey)

  assert.equal(typeof profileDefinition.onShow, 'function')
  assert.equal(typeof profileDefinition.refreshProfile, 'function')
  assert.equal(typeof profileDefinition.onOpenRecommendation, 'function')
  assert.equal(typeof profileDefinition.onRecover, 'function')
  assert.equal(typeof navigationBarDefinition.methods.back, 'function')
  assert.equal(typeof previewModule.deriveElderProfilePreview, 'function')

  console.log(`PARSER: TypeScript ${parser.version || 'unknown'} (${parserPath})`)

  runCase('PROFILE-001', 'complete Draft ready', () => {
    const page = readyPage(profileDefinition, draftStore)
    const before = draftSnapshot(draftStore, draftStorageKey)
    const viewModel = readyViewModel(page)
    assert.equal(viewModel.headline, '父亲 · 72 岁')
    assert.equal(viewModel.relationshipLine, '根据本次评估生成')
    assert.equal(page.data.stateTitle, '')
    assert.equal(page.data.stateMessage, '')
    assert.equal(page.data.actionErrorKey, '')
    assert.equal(viewModel.financialRows.length, 4)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before,
      'deriving the Page Preview must not write back Draft or storage')
    assert.equal(runtimeState.navigationCalls.length, 0)
  })

  runCase('PROFILE-002', 'incomplete hides Preview and recovers to first missing step', () => {
    const incompleteAnswers = answersFor('PREVIEW-001')
    delete incompleteAnswers['adl.transfer']
    const page = preparePage(
      profileDefinition,
      draftStore,
      incompleteAnswers,
      [
        { route: 'pages/assessment/intro' },
        { route: 'pages/assessment/basic' },
        { route: 'pages/assessment/health' },
        { route: 'pages/assessment/adl' },
        { route: 'pages/assessment/cognitive' },
        { route: 'pages/assessment/preference' },
        { route: 'pages/assessment/budget' },
        { route: 'pages/assessment/profile' },
      ],
    )
    const before = draftSnapshot(draftStore, draftStorageKey)
    assert.equal(page.data.pageState, 'incomplete')
    assert.equal(page.data.viewModel, null)
    assert.equal(page.data.recoveryRoute, '/pages/assessment/adl')
    assert.match(page.data.recoveryLabel, /日常生活能力/)
    invoke(page, 'onRecover')
    assertNavigationSummary([{ type: 'navigateBack', url: undefined, delta: 4 }])
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before,
      'incomplete recovery must preserve Draft')

    const emptyPage = preparePage(profileDefinition, draftStore)
    assert.equal(emptyPage.data.pageState, 'incomplete')
    assert.equal(emptyPage.data.viewModel, null)
    assert.equal(emptyPage.data.recoveryRoute, '/pages/assessment/intro')
    assert.equal(emptyPage.data.recoveryLabel, '返回评估说明')
    assert.equal(runtimeState.navigationCalls.length, 0)
  })

  runCase('PROFILE-003', 'invalid and unsupported Draft show error state without stale Preview', () => {
    const page = readyPage(profileDefinition, draftStore)
    const validDraft = draftStore.getDraft()
    const hadOwnGetDraft = Object.prototype.hasOwnProperty.call(draftStore, 'getDraft')
    const previousGetDraft = draftStore.getDraft
    try {
      draftStore.getDraft = () => ({ ...clone(validDraft), kind: 'completed_assessment' })
      invoke(page, 'onShow')
      assert.equal(page.data.pageState, 'error')
      assert.equal(page.data.viewModel, null)
      assert.equal(page.data.recoveryRoute, '/pages/assessment/intro')
      assert.equal(page.data.stateTitle, '评估信息暂时无法读取')
      assert.match(page.data.stateMessage, /草稿结构不完整/)

      draftStore.getDraft = () => ({ ...clone(validDraft), schemaVersion: 99 })
      invoke(page, 'onShow')
      assert.equal(page.data.pageState, 'error')
      assert.equal(page.data.viewModel, null)
      assert.equal(page.data.stateTitle, '当前评估版本暂不支持')
      assert.match(page.data.stateMessage, /当前版本/)
    } finally {
      if (hadOwnGetDraft) {
        draftStore.getDraft = previousGetDraft
      } else {
        delete draftStore.getDraft
      }
    }
    assert.equal(runtimeState.navigationCalls.length, 0)
  })

  runCase('PROFILE-004', 'independent care level and no extra care mode', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PREVIEW-001'))
    assert.equal(rowByLabel(viewModel.dailyRows, '照护等级').value, '自理')
    assert.equal(rowByLabel(viewModel.dailyRows, '行动方式').value, '可独立行走')
    assert.deepEqual(viewModel.careModeTags, [])
    assert.ok(viewModel.overviewTags.some((item) => item.text === '自理'))
    assert.ok(viewModel.overviewTags.some((item) => item.text === '可独立行走'))
  })

  runCase('PROFILE-005', 'wheelchair mobility remains separate from care level', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PARITY-002'))
    const careLevel = rowByLabel(viewModel.dailyRows, '照护等级')
    const mobility = rowByLabel(viewModel.dailyRows, '行动方式')
    assert.equal(careLevel.value, '半失能')
    assert.equal(mobility.value, '轮椅辅助')
    assert.notEqual(careLevel.value, mobility.value)
    assert.deepEqual(viewModel.careModeTags.map((item) => item.text), ['轮椅辅助'])
  })

  runCase('PROFILE-006', 'ADL unknown remains unknown and visible as clarification', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PREVIEW-003'))
    const careLevel = rowByLabel(viewModel.dailyRows, '照护等级')
    const bathing = rowByLabel(viewModel.dailyRows, '洗澡')
    assert.equal(careLevel.value, '自理能力等级暂无法确定')
    assert.equal(careLevel.tone, 'attention')
    assert.equal(bathing.value, '暂不确定')
    assert.equal(bathing.tone, 'attention')
    assert.ok(viewModel.overviewTags.some((item) => item.text === '自理能力待确认'))
    assert.ok(viewModel.clarifications.some((item) => item.text.includes('洗澡能力暂不确定')))
    assert.equal(viewModel.careModeTags.length, 0)
  })

  runCase('PROFILE-007', 'special_feeding does not become tube feeding', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PREVIEW-004'))
    assert.equal(rowByLabel(viewModel.dailyRows, '进食').value, '特殊进食方式 · 具体情况待确认')
    assert.equal(rowByLabel(viewModel.dailyRows, '进食').tone, 'attention')
    assert.deepEqual(viewModel.careModeTags.map((item) => item.text), ['特殊进食方式 · 具体情况待确认'])
    assert.equal(viewModel.specialCareTags.some((item) => item.text === '鼻饲护理'), false)
    assert.ok(viewModel.clarifications.some((item) => item.text.includes('特殊进食方式')))
    assert.equal(viewModel.clarifications.some((item) => item.text.includes('鼻饲护理')), false)
  })

  runCase('PROFILE-008', 'catheter_or_stoma does not become catheter care', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PREVIEW-005'))
    assert.equal(rowByLabel(viewModel.dailyRows, '如厕').value, '导尿/造瘘情况 · 具体护理需求待确认')
    assert.equal(rowByLabel(viewModel.dailyRows, '如厕').tone, 'attention')
    assert.deepEqual(viewModel.careModeTags.map((item) => item.text), ['导尿/造瘘情况 · 具体护理需求待确认'])
    assert.equal(viewModel.specialCareTags.some((item) => item.text === '导尿护理'), false)
    assert.ok(viewModel.clarifications.some((item) => item.text.includes('导尿/造瘘情况')))
    assert.equal(viewModel.clarifications.some((item) => item.text.includes('导尿护理')), false)
  })

  runCase('PROFILE-009', 'explicit tube feeding displays required capability', () => {
    const viewModel = readyViewModel(readyPage(
      profileDefinition,
      draftStore,
      'PREVIEW-001',
      { 'cognitive.specialCareNeeds': ['tube_feeding'] },
    ))
    assert.ok(viewModel.specialCareTags.some((item) => item.text === '鼻饲护理' && item.tone === 'brand'))
    assert.equal(viewModel.clarifications.some((item) => item.text.includes('是否需要鼻饲护理')), false)
    assert.equal(rowByLabel(viewModel.dailyRows, '进食').value, '可以完全独立进食')
  })

  runCase('PROFILE-010', 'cognitive conflict shows clarification and not no-cognition claim', () => {
    const viewModel = readyViewModel(readyPage(profileDefinition, draftStore, 'PREVIEW-007'))
    const cognitionValues = rowValues(viewModel.cognitionRows)
    assert.ok(viewModel.clarifications.some((item) => item.text.includes('健康情况与认知问卷的相关回答不一致')))
    assert.ok(cognitionValues.includes('相关回答存在需要进一步核对的信息'))
    assert.equal(cognitionValues.includes('本次明确选择无以上认知与精神情况'), false)
    assert.equal(viewModel.overviewTags.some((item) => item.text === '本次未报告明显认知情况'), false)

    const getsLostAnswers = answersFor('PREVIEW-001', { 'cognitive.symptoms': ['gets_lost'] })
    const getsLostPreview = previewModule.deriveElderProfilePreview(
      makePreviewDraft(getsLostAnswers, 'profile-gets-lost-runtime'),
    )
    assert.equal(getsLostPreview.ok, true)
    assert.equal(getsLostPreview.preview.cognition.derivedFacts.wanderingRisk.status, 'needs_confirmation')
    assert.equal(getsLostPreview.preview.cognition.derivedFacts.wanderingRisk.candidateValue, 'present')
    const getsLostViewModel = readyViewModel(readyPage(
      profileDefinition,
      draftStore,
      'PREVIEW-001',
      { 'cognitive.symptoms': ['gets_lost'] },
    ))
    const getsLostRows = getsLostViewModel.cognitionRows
    const getsLostIndex = getsLostRows.findIndex((item) => item.value.includes('容易迷路'))
    assert.ok(getsLostIndex >= 0, 'gets_lost source should remain visible near its risk clarification')
    const wanderingRiskIndex = getsLostRows.findIndex((item, index) => {
      if (Math.abs(index - getsLostIndex) > 1) return false
      const text = `${item.label}${item.value}`
      return /走失风险/.test(text) && /确认/.test(text)
    })
    assert.ok(wanderingRiskIndex >= 0, 'wanderingRisk needs_confirmation should be shown near 容易迷路')
    assert.equal(getsLostRows.some((item) => item.value === '评估中已报告走失相关风险'), false)
    assert.ok(getsLostViewModel.clarifications.some((item) => /走失风险|容易迷路/.test(item.text)))
    assert.equal(getsLostViewModel.clarifications.some((item) => item.text.includes('专项护理需求')), false)

    const moodAnswers = answersFor('PREVIEW-001', { 'cognitive.symptoms': ['mood_instability'] })
    const moodPreview = previewModule.deriveElderProfilePreview(
      makePreviewDraft(moodAnswers, 'profile-mood-instability-runtime'),
    )
    assert.equal(moodPreview.ok, true)
    assert.equal(moodPreview.preview.cognition.derivedFacts.behavioralRisk.status, 'needs_confirmation')
    assert.equal(moodPreview.preview.cognition.derivedFacts.behavioralRisk.candidateValue, 'present')
    const moodViewModel = readyViewModel(readyPage(
      profileDefinition,
      draftStore,
      'PREVIEW-001',
      { 'cognitive.symptoms': ['mood_instability'] },
    ))
    const moodRows = moodViewModel.cognitionRows
    const moodIndex = moodRows.findIndex((item) => item.value.includes('情绪波动明显'))
    assert.ok(moodIndex >= 0, 'mood_instability source should remain visible near its behavior clarification')
    const behavioralRiskIndex = moodRows.findIndex((item, index) => {
      if (Math.abs(index - moodIndex) > 1) return false
      const text = `${item.label}${item.value}`
      return /行为(?:情况|风险)/.test(text) && /确认/.test(text)
    })
    assert.ok(behavioralRiskIndex >= 0, 'behavioralRisk needs_confirmation should be shown near 情绪波动明显')
    assert.equal(moodRows.some((item) => item.value === '评估中已报告躁动或攻击行为'), false)
    assert.ok(moodViewModel.clarifications.some((item) => /行为|情绪/.test(item.text)))
    assert.equal(moodViewModel.clarifications.some((item) => item.text.includes('专项护理需求')), false)
  })

  runCase('PROFILE-011', 'region uses saved label snapshot', () => {
    const answers = answersFor('PREVIEW-009')
    const page = readyPage(profileDefinition, draftStore, 'PREVIEW-009')
    const viewModel = readyViewModel(page)
    assert.equal(rowByLabel(viewModel.preferenceRows, '区域偏好').value, '武昌区')
    const directPreviewResult = previewModule.deriveElderProfilePreview(
      makePreviewDraft(answers, 'profile-region-runtime'),
    )
    assert.equal(directPreviewResult.ok, true)
    assert.deepEqual(directPreviewResult.preview.preference.rawFacts.regionPreference, PREVIEW_REGION_SNAPSHOT)
    assert.notStrictEqual(directPreviewResult.preview.preference.rawFacts.regionPreference, answers['preference.region'])
  })

  runCase('PROFILE-012', 'budget and intent are display-only with no side effect', () => {
    const page = readyPage(profileDefinition, draftStore, 'PREVIEW-001', {
      'budget.monthlyRange': 'cny_5000_8000',
      'budget.upfrontCostAcceptance': 'acceptable',
      'budget.moveInTiming': 'within_1_month',
      'budget.consultantSupport': 'request_contact',
    })
    const before = draftSnapshot(draftStore, draftStorageKey)
    const viewModel = readyViewModel(page)
    assert.equal(rowByLabel(viewModel.financialRows, '月度预算').value, '5000–8000 元/月')
    assert.equal(rowByLabel(viewModel.financialRows, '入住计划').value, '1 个月以内')
    assert.match(rowByLabel(viewModel.financialRows, '顾问协助意向').value, /仅记录意向，尚未发起联系/)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)
    assert.equal(runtimeState.navigationCalls.length, 0)
    assert.equal(runtimeState.authCalls, 0)
    assert.equal(runtimeState.requestCalls, 0)
    assert.equal(runtimeState.phoneCalls, 0)
  })

  runCase('PROFILE-013', 'editing Draft then onShow refreshes current ViewModel', () => {
    const page = readyPage(profileDefinition, draftStore)
    const initialViewModel = readyViewModel(page)
    assert.equal(initialViewModel.headline, '父亲 · 72 岁')
    const mutation = draftStore.setAnswer('basic.age', 88)
    assert.equal(mutation.persistence.ok, true)
    invoke(page, 'onShow')
    const refreshedViewModel = readyViewModel(page)
    assert.equal(refreshedViewModel.headline, '父亲 · 88 岁')
    assert.notStrictEqual(refreshedViewModel, initialViewModel)
    assert.equal(draftStore.getDraft().answers['basic.age'], 88)
  })

  runCase('PROFILE-014', 'repeated onShow derives without Preview cache', () => {
    const page = readyPage(profileDefinition, draftStore)
    const firstViewModel = readyViewModel(page)
    firstViewModel.headline = '缓存旧画像'
    const before = draftSnapshot(draftStore, draftStorageKey)
    invoke(page, 'onShow')
    const secondViewModel = readyViewModel(page)
    assert.notStrictEqual(secondViewModel, firstViewModel)
    assert.equal(secondViewModel.headline, '父亲 · 72 岁')
    invoke(page, 'onShow')
    const thirdViewModel = readyViewModel(page)
    assert.notStrictEqual(thirdViewModel, secondViewModel)
    assert.equal(thirdViewModel.headline, '父亲 · 72 岁')
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)
    assert.equal(runtimeState.navigationCalls.length, 0)
  })

  runCase('PROFILE-015', 'no login/request/phone API is invoked or wired', () => {
    assertNoSensitiveNavigationCode()
    const page = readyPage(profileDefinition, draftStore)
    readyViewModel(page)
    assert.equal(runtimeState.authCalls, 0)
    assert.equal(runtimeState.requestCalls, 0)
    assert.equal(runtimeState.phoneCalls, 0)
    const profileWxml = readText('miniprogram/pages/assessment/profile.wxml')
    assert.doesNotMatch(profileWxml, /<button[^>]*(?:bind|catch):?tap="onOpenRecommendation"/)
    assert.match(profileWxml, /<primary-button[^>]*text="查看机构推荐"[^>]*bind:action="onOpenRecommendation"/)
  })

  runCase('PROFILE-016', 'Primary CTA rapid taps navigate at most once per lifecycle', () => {
    const page = readyPage(profileDefinition, draftStore)
    invoke(page, 'onOpenRecommendation')
    invoke(page, 'onOpenRecommendation')
    assert.equal(page.handlerCalls.onOpenRecommendation, 2)
    assertNavigationSummary([{ type: 'navigateTo', url: '/pages/recommendation/result', delta: undefined }])
    assert.equal(page.data.actionErrorMessage, '')

    invoke(page, 'onShow')
    invoke(page, 'onOpenRecommendation')
    assertNavigationSummary([
      { type: 'navigateTo', url: '/pages/recommendation/result', delta: undefined },
      { type: 'navigateTo', url: '/pages/recommendation/result', delta: undefined },
    ])
  })

  runCase('PROFILE-017', 'Back contract emits one non-bubbling action and visible navigationfail feedback', () => {
    const profileWxml = readText('miniprogram/pages/assessment/profile.wxml')
    assert.match(profileWxml, /<navigation-bar[\s\S]*back="\{\{backEnabled\}\}"[\s\S]*fallbackUrl="\/pages\/home\/index"[\s\S]*fallbackIsTab="\{\{true\}\}"[\s\S]*bind:navigationfail="onBackNavigationFailure"/)
    assert.doesNotMatch(profileWxml, /<navigation-bar[^>]*bind:?back=/)

    runtimeState.navigationCalls.length = 0
    const navigationBar = mountComponent(navigationBarDefinition)
    navigationBar.data.delta = 1
    navigationBar.data.fallbackUrl = '/pages/home/index'
    navigationBar.data.fallbackIsTab = true
    runtimeState.navigationModes.navigateBack = 'success'
    runtimeState.pageStack = [
      { route: 'pages/assessment/budget' },
      { route: 'pages/assessment/profile' },
    ]
    navigationBar.back()
    assertNavigationSummary([{ type: 'navigateBack', url: undefined, delta: 1 }])
    assert.deepEqual(navigationBar.events, [
      { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
    ])

    runtimeState.navigationCalls.length = 0
    navigationBar.events.length = 0
    runtimeState.pageStack = [{ route: 'pages/assessment/profile' }]
    navigationBar.back()
    assertNavigationSummary([{ type: 'switchTab', url: '/pages/home/index', delta: undefined }])
    assert.deepEqual(navigationBar.events, [
      { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
    ])

    const page = readyPage(profileDefinition, draftStore)
    const failureBar = mountComponent(navigationBarDefinition)
    failureBar.data.delta = 1
    failureBar.data.fallbackUrl = '/pages/home/index'
    failureBar.data.fallbackIsTab = true
    failureBar.triggerEvent = (name, detail, options) => {
      failureBar.events.push({ name, detail, options })
      if (name === 'navigationfail') {
        invoke(page, 'onBackNavigationFailure', { detail })
      }
    }
    runtimeState.navigationCalls.length = 0
    runtimeState.pageStack = [
      { route: 'pages/assessment/budget' },
      { route: 'pages/assessment/profile' },
    ]
    runtimeState.navigationModes.navigateBack = 'fail'
    failureBar.back()
    assertNavigationSummary([{ type: 'navigateBack', url: undefined, delta: 1 }])
    assert.deepEqual(failureBar.events.map((event) => event.name), ['navigationfail', 'back'])
    assert.equal(failureBar.events.filter((event) => event.name === 'navigationfail').length, 1)
    assert.deepEqual(failureBar.events[0].options, { bubbles: false, composed: false })
    assert.deepEqual(failureBar.events[1].options, { bubbles: false, composed: false })
    assert.equal(page.handlerCalls.onBackNavigationFailure, 1)
    assert.equal(page.data.actionErrorKey, 'back')
    assert.match(page.data.actionErrorMessage, /暂时无法返回/)
  })

  runCase('PROFILE-018', 'Home is always available, preserves Draft, reports failures, and is root-labeled', () => {
    const profileWxml = readText('miniprogram/pages/assessment/profile.wxml')
    const homeButtonIndex = profileWxml.indexOf('catchtap="onHome"')
    const firstStateIndex = profileWxml.indexOf('wx:if="{{pageState ===')
    assert.ok(homeButtonIndex >= 0 && homeButtonIndex < firstStateIndex,
      'Home action must appear outside all four conditional Profile states')
    assert.match(profileWxml, /<button[^>]*catchtap="onHome"[^>]*aria-label="返回首页">返回首页<\/button>/)
    assert.match(profileWxml, /wx:if="\{\{isRootProfile\}\}" class="boundary-note">系统返回可能离开小程序/)
    assert.equal(typeof profileDefinition.onHome, 'function')

    const page = readyPage(profileDefinition, draftStore, 'PREVIEW-001', {}, [
      { route: 'pages/assessment/profile' },
    ])
    assert.equal(page.data.isRootProfile, true)
    assert.equal(page.data.backEnabled, true, 'root keeps the header fallback enabled')
    const before = draftSnapshot(draftStore, draftStorageKey)

    ;['loading', 'ready', 'incomplete', 'error'].forEach((state) => {
      page.setData({ pageState: state })
      runtimeState.navigationCalls.length = 0
      invoke(page, 'onHome')
      assertNavigationSummary([{ type: 'switchTab', url: '/pages/home/index', delta: undefined }])
      assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before,
        `Home from ${state} state must preserve Draft and storage`)
      invoke(page, 'onShow')
    })

    runtimeState.navigationCalls.length = 0
    runtimeState.navigationModes.switchTab = 'fail'
    invoke(page, 'onHome')
    assertNavigationSummary([{ type: 'switchTab', url: '/pages/home/index', delta: undefined }])
    assert.equal(page.data.actionErrorKey, 'home')
    assert.match(page.data.actionErrorMessage, /暂时无法返回首页/)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)

    runtimeState.navigationCalls.length = 0
    runtimeState.navigationModes.switchTab = 'pending'
    invoke(page, 'onHome')
    invoke(page, 'onOpenRecommendation')
    assertNavigationSummary([{ type: 'switchTab', url: '/pages/home/index', delta: undefined }])
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)
  })

  runCase('PROFILE-019', 'Six edit actions use safe full-trail ancestors and push a fresh step when ancestry is incomplete', () => {
    const sections = ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']
    const profileWxml = readText('miniprogram/pages/assessment/profile.wxml')
    const boundSections = Array.from(profileWxml.matchAll(/data-section="([a-z]+)"/g), (match) => match[1])
    assert.deepEqual(Array.from(new Set(boundSections)).sort(), sections.slice().sort())

    sections.forEach((section) => {
      const page = readyPage(profileDefinition, draftStore, 'PREVIEW-001', {}, [
        { route: 'pages/assessment/profile' },
      ])
      invoke(page, 'onEdit', { currentTarget: { dataset: { section } } })
      assertNavigationSummary([{
        type: 'navigateTo',
        url: `/pages/assessment/${section}`,
        delta: undefined,
      }])
    })

    sections.forEach((section, index) => {
      const stepNumber = index + 1
      const safeDepth = 10 - (7 - stepNumber)
      const stackAtDepth = (page, depth) =>
        Array.from({ length: depth - 1 }, (_, entry) => ({ route: `pages/test/${entry}` })).concat(page)

      const safePage = readyPage(profileDefinition, draftStore, 'PREVIEW-001')
      const safeDraft = draftSnapshot(draftStore, draftStorageKey)
      runtimeState.pageStack = stackAtDepth(safePage, safeDepth)
      invoke(safePage, 'onEdit', { currentTarget: { dataset: { section } } })
      assertNavigationSummary([{
        type: 'navigateTo',
        url: `/pages/assessment/${section}`,
        delta: undefined,
      }])
      assert.equal(runtimeState.modalCalls.length, 0,
        `${section} must fit at the exact predicted peak depth 10`)
      assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), safeDraft)

      const fullPage = readyPage(profileDefinition, draftStore, 'PREVIEW-001')
      const fullDraft = draftSnapshot(draftStore, draftStorageKey)
      runtimeState.pageStack = stackAtDepth(fullPage, safeDepth + 1)
      invoke(fullPage, 'onEdit', { currentTarget: { dataset: { section } } })
      assert.equal(runtimeState.navigationCalls.length, 0,
        `${section} must not push beyond the predicted peak depth 10`)
      assert.equal(runtimeState.modalCalls.length, 1,
        `${section} must request confirmation one level beyond its safe depth`)
      const modal = runtimeState.modalCalls[0]
      assert.ok(Array.from(modal.confirmText || '').length <= 4)
      assert.ok(Array.from(modal.cancelText || '').length <= 4)
      modal.success({ confirm: false, cancel: true })
      assert.equal(runtimeState.navigationCalls.length, 0)
      assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), fullDraft,
        `${section} capacity cancellation must preserve Draft and storage`)
    })

    const legalTrail = [
      { route: 'pages/assessment/intro' },
      { route: 'pages/assessment/basic' },
      { route: 'pages/assessment/health' },
      { route: 'pages/assessment/adl' },
      { route: 'pages/assessment/cognitive' },
      { route: 'pages/assessment/preference' },
      { route: 'pages/assessment/budget' },
      { route: 'pages/assessment/profile' },
    ]
    const ancestorPage = readyPage(profileDefinition, draftStore, 'PREVIEW-001', {}, legalTrail)
    invoke(ancestorPage, 'onEdit', { currentTarget: { dataset: { section: 'adl' } } })
    assertNavigationSummary([{ type: 'navigateBack', url: undefined, delta: 4 }])

    const incompleteTrail = [
      { route: 'pages/assessment/intro' },
      { route: 'pages/assessment/basic' },
      { route: 'pages/assessment/health' },
      { route: 'pages/assessment/adl' },
      { route: 'pages/assessment/profile' },
    ]
    const nonAncestorPage = readyPage(profileDefinition, draftStore, 'PREVIEW-001', {}, incompleteTrail)
    invoke(nonAncestorPage, 'onEdit', { currentTarget: { dataset: { section: 'adl' } } })
    assertNavigationSummary([{
      type: 'navigateTo',
      url: '/pages/assessment/adl',
      delta: undefined,
    }])
  })

  runCase('PROFILE-020', 'Recommendation entry refuses a full or changed actual stack without touching Draft or opening downstream flows', () => {
    const page = readyPage(profileDefinition, draftStore)
    const before = draftSnapshot(draftStore, draftStorageKey)
    runtimeState.pageStack = Array.from({ length: 9 }, (_, index) => ({ route: `pages/test/${index}` }))
      .concat(page)
    invoke(page, 'onOpenRecommendation')
    assert.equal(runtimeState.navigationCalls.length, 0,
      'the local result push must be refused at actual stack depth 10')
    assert.equal(page.data.actionErrorKey, 'recommendation')
    assert.match(page.data.actionErrorMessage, /页面层级已满/)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)
    assert.equal(runtimeState.authCalls, 0)
    assert.equal(runtimeState.requestCalls, 0)
    assert.equal(runtimeState.removeStorageCalls, 0)

    runtimeState.navigationCalls.length = 0
    runtimeState.pageStack = [page, { route: 'pages/appointment/index' }]
    invoke(page, 'onOpenRecommendation')
    assert.equal(runtimeState.navigationCalls.length, 0,
      'a Profile page that is no longer current must not push a result route')
    assert.match(page.data.actionErrorMessage, /页面状态已变化/)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)

    runtimeState.pageStack = [page]
    const previousGetCurrentPages = globalThis.getCurrentPages
    globalThis.getCurrentPages = () => { throw new Error('page stack unavailable') }
    try {
      invoke(page, 'onOpenRecommendation')
    } finally {
      globalThis.getCurrentPages = previousGetCurrentPages
    }
    assert.equal(runtimeState.navigationCalls.length, 0,
      'an unavailable actual stack must fail closed before downstream navigation')
    assert.match(page.data.actionErrorMessage, /页面状态已变化/)
    assert.deepEqual(draftSnapshot(draftStore, draftStorageKey), before)
  })

  assertPureProfileGraph(loadedSourcePaths)
  assert.deepEqual(caseIds, EXPECTED_PROFILE_CASE_IDS, 'profile runtime case ID set/order drifted')
  assert.equal(new Set(caseIds).size, caseIds.length, 'profile runtime case IDs are not unique')

  if (failures.length > 0) {
    console.error(`PROFILE PAGE RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`PROFILE PAGE RUNTIME PASS: ${caseCount} cases`)
  console.log(`TypeScript parser: ${parser.version || 'unknown'} (${parserPath})`)
  console.log(`Loaded production modules: ${loadedSourcePaths.size}`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`PROFILE PAGE RUNTIME ERROR: ${message}`)
  process.exitCode = 1
} finally {
  if (previousComponent === undefined) {
    delete globalThis.Component
  } else {
    globalThis.Component = previousComponent
  }
  if (previousPage === undefined) {
    delete globalThis.Page
  } else {
    globalThis.Page = previousPage
  }
  if (previousWx === undefined) {
    delete globalThis.wx
  } else {
    globalThis.wx = previousWx
  }
  if (previousGetCurrentPages === undefined) {
    delete globalThis.getCurrentPages
  } else {
    globalThis.getCurrentPages = previousGetCurrentPages
  }
}
