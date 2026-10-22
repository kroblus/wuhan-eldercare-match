import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const failures = []
const caseCounts = { runtime: 0, structural: 0 }

const readText = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

const getDevToolsTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    return { parser: require(path.resolve(explicitPath)), parserPath: path.resolve(explicitPath) }
  }

  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch {
    // The repository intentionally does not add a TypeScript runtime dependency.
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

const makeRuntimeLoader = (typescript) => {
  const moduleCache = new Map()

  const resolveModule = (request, importer) => {
    if (!request.startsWith('.')) {
      return request
    }
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.js`,
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

    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    const source = readFileSync(resolvedPath, 'utf8')
    const output = resolvedPath.endsWith('.ts')
      ? typescript.transpileModule(source, {
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          esModuleInterop: true,
        },
        fileName: resolvedPath,
      }).outputText
      : source

    const localRequire = (request) => {
      const dependency = resolveModule(request, resolvedPath)
      return dependency.startsWith('.') ? require(dependency) : loadModule(dependency)
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }

  return loadModule
}

const componentDefinitions = []
const pageDefinitions = []
const runtimeState = {
  storage: Object.create(null),
  pageStack: [],
  navigationCalls: [],
  modalCalls: [],
  toastCalls: [],
  removeStorageCalls: 0,
  scrollCalls: [],
  setDataCalls: [],
  failNextNavigateTo: false,
  failNextNavigateBack: false,
  throwNextNavigateBack: false,
  failNextRedirectTo: false,
  failNextReLaunch: false,
  failNextSwitchTab: false,
}
const previousComponent = globalThis.Component
const previousPage = globalThis.Page
const previousWx = globalThis.wx
const previousGetCurrentPages = globalThis.getCurrentPages
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
  showToast(options) {
    runtimeState.toastCalls.push(options)
  },
  nextTick(callback) {
    callback()
  },
  pageScrollTo(options) {
    runtimeState.scrollCalls.push({ selector: options.selector, duration: options.duration })
  },
  navigateTo(options) {
    runtimeState.navigationCalls.push({ type: 'navigateTo', url: options.url, options })
    if (runtimeState.failNextNavigateTo) {
      runtimeState.failNextNavigateTo = false
      if (options.fail) {
        options.fail({ errMsg: 'navigateTo:fail test' })
      }
      if (options.complete) {
        options.complete({ errMsg: 'navigateTo:fail test' })
      }
      return
    }
    if (options.success) {
      options.success()
    }
    if (options.complete) {
      options.complete()
    }
  },
  navigateBack(options) {
    runtimeState.navigationCalls.push({ type: 'navigateBack', options })
    if (runtimeState.throwNextNavigateBack) {
      runtimeState.throwNextNavigateBack = false
      throw new Error('navigateBack:throw test')
    }
    if (runtimeState.failNextNavigateBack) {
      runtimeState.failNextNavigateBack = false
      if (options.fail) options.fail({ errMsg: 'navigateBack:fail test' })
      if (options.complete) options.complete({ errMsg: 'navigateBack:fail test' })
      return
    }
    if (options.success) options.success({ errMsg: 'navigateBack:ok' })
    if (options.complete) options.complete({ errMsg: 'navigateBack:ok' })
  },
  redirectTo(options) {
    runtimeState.navigationCalls.push({ type: 'redirectTo', url: options.url, options })
    if (runtimeState.failNextRedirectTo) {
      runtimeState.failNextRedirectTo = false
      if (options.fail) options.fail({ errMsg: 'redirectTo:fail test' })
      if (options.complete) options.complete({ errMsg: 'redirectTo:fail test' })
      return
    }
    if (options.success) options.success({ errMsg: 'redirectTo:ok' })
    if (options.complete) options.complete({ errMsg: 'redirectTo:ok' })
  },
  reLaunch(options) {
    runtimeState.navigationCalls.push({ type: 'reLaunch', url: options.url, options })
    if (runtimeState.failNextReLaunch) {
      runtimeState.failNextReLaunch = false
      if (options.fail) options.fail({ errMsg: 'reLaunch:fail test' })
      if (options.complete) options.complete({ errMsg: 'reLaunch:fail test' })
      return
    }
    if (options.success) options.success({ errMsg: 'reLaunch:ok' })
    if (options.complete) options.complete({ errMsg: 'reLaunch:ok' })
  },
  switchTab(options) {
    runtimeState.navigationCalls.push({ type: 'switchTab', url: options.url, options })
    if (runtimeState.failNextSwitchTab) {
      runtimeState.failNextSwitchTab = false
      if (options.fail) options.fail({ errMsg: 'switchTab:fail test' })
      if (options.complete) options.complete({ errMsg: 'switchTab:fail test' })
      return
    }
    if (options.success) options.success({ errMsg: 'switchTab:ok' })
    if (options.complete) options.complete({ errMsg: 'switchTab:ok' })
  },
}

const mountComponent = (definition) => {
  const data = {}
  for (const [name, property] of Object.entries(definition.properties || {})) {
    if (Object.prototype.hasOwnProperty.call(property, 'value')) {
      data[name] = property.value
    }
  }
  const instance = {
    data,
    events: [],
    triggerEvent(name, detail, options) {
      this.events.push({ name, detail, options })
    },
  }
  for (const [name, handler] of Object.entries(definition.methods || {})) {
    instance[name] = handler.bind(instance)
  }
  return instance
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

const mountPage = (definition, route = '') => {
  const instance = {
    route,
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
  for (const [name, handler] of Object.entries(definition)) {
    if (typeof handler === 'function') {
      instance[name] = handler.bind(instance)
    }
  }
  return instance
}

const invokePageHandler = (page, name, ...args) => {
  page.handlerCalls[name] = (page.handlerCalls[name] || 0) + 1
  return page[name](...args)
}

const loadDefinition = (loadModule, relativePath) => {
  const before = componentDefinitions.length
  loadModule(path.join(repositoryRoot, relativePath))
  assert.equal(componentDefinitions.length, before + 1, `${relativePath} did not register exactly one component`)
  return componentDefinitions.at(-1)
}

const loadPageDefinition = (loadModule, relativePath) => {
  const before = pageDefinitions.length
  loadModule(path.join(repositoryRoot, relativePath))
  assert.equal(pageDefinitions.length, before + 1, `${relativePath} did not register exactly one page`)
  return pageDefinitions.at(-1)
}

const runCase = (name, precondition, callback, kind = 'runtime') => {
  caseCounts[kind] += 1
  console.log(`CASE ${name}`)
  console.log(`PRECONDITION: ${precondition}`)
  try {
    callback()
    console.log('RESULT: PASS')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${name}: ${message}`)
    console.log(`RESULT: FAIL — ${message}`)
  }
}

const pageSpecs = [
  {
    step: 'basic',
    questions: ['basic.relationship', 'basic.gender', 'basic.age'],
    validatorName: 'validateBasicAnswersV2',
    complete: { 'basic.relationship': 'father', 'basic.gender': 'male', 'basic.age': 72 },
    partial: { 'basic.relationship': 'father' },
    invalid: { 'basic.relationship': 'father', 'basic.gender': 'male', 'basic.age': 49 },
  },
  {
    step: 'health',
    questions: [
      'health.conditions',
      'health.recentEvents',
      'health.rehabilitationNeed',
      'health.chewingAbility',
      'health.swallowingAbility',
    ],
    validatorName: 'validateHealthAnswersV2',
    complete: {
      'health.conditions': ['none'],
      'health.recentEvents': ['none'],
      'health.rehabilitationNeed': 'unknown',
      'health.chewingAbility': 'unknown',
      'health.swallowingAbility': 'unknown',
    },
    partial: { 'health.conditions': ['unknown'] },
    invalid: { 'health.conditions': ['hypertension', 'none'], 'health.recentEvents': ['none'], 'health.rehabilitationNeed': 'unknown' },
  },
  {
    step: 'adl',
    questions: ['adl.eating', 'adl.mobility', 'adl.toileting', 'adl.bathing', 'adl.dressing', 'adl.transfer', 'adl.stairs'],
    validatorName: 'validateAdlAnswersV2',
    complete: {
      'adl.eating': 'independent',
      'adl.mobility': 'independent',
      'adl.toileting': 'independent',
      'adl.bathing': 'independent',
      'adl.dressing': 'independent',
      'adl.transfer': 'independent',
      'adl.stairs': 'independent',
    },
    partial: { 'adl.eating': 'unknown' },
    invalid: { 'adl.eating': 'independent', 'adl.mobility': 'not-a-contract-code' },
  },
  {
    step: 'cognitive',
    questions: ['cognitive.symptoms', 'cognitive.specialCareNeeds'],
    validatorName: 'validateCognitiveAnswersV2',
    complete: { 'cognitive.symptoms': ['none'], 'cognitive.specialCareNeeds': ['none'] },
    partial: { 'cognitive.symptoms': ['unknown'] },
    invalid: { 'cognitive.symptoms': ['memory_decline', 'unknown'], 'cognitive.specialCareNeeds': ['none'] },
  },
  {
    step: 'preference',
    questions: [
      'preference.careType',
      'preference.roomType',
      'preference.mealSchedule',
      'preference.activityPreference',
      'preference.priorities',
    ],
    validatorName: 'validatePreferenceAnswersV2',
    complete: {
      'preference.careType': 'unknown',
      'preference.roomType': 'no_preference',
      'preference.mealSchedule': 'no_preference',
      'preference.activityPreference': 'no_preference',
      'preference.priorities': ['price'],
    },
    partial: { 'preference.careType': 'unknown' },
    invalid: { 'preference.careType': 'unknown', 'preference.priorities': [] },
  },
  {
    step: 'budget',
    questions: [
      'budget.monthlyRange',
      'budget.upfrontCostAcceptance',
      'budget.moveInTiming',
      'budget.consultantSupport',
    ],
    validatorName: 'validateBudgetAnswersV2',
    complete: {
      'budget.monthlyRange': 'unknown',
      'budget.upfrontCostAcceptance': 'unknown',
      'budget.moveInTiming': 'research_only',
      'budget.consultantSupport': 'recommendation_first',
    },
    partial: { 'budget.monthlyRange': 'unknown' },
    invalid: {
      'budget.monthlyRange': 'not-a-contract-code',
      'budget.upfrontCostAcceptance': 'unknown',
      'budget.moveInTiming': 'research_only',
      'budget.consultantSupport': 'recommendation_first',
    },
  },
]

const detail = (value) => ({ detail: value })

/** 页面输入路径：测试通过真实 Page handler 写入真实 AssessmentDraft，而不是直接替换答案 map。 */
const pageInteractionSpecs = {
  basic: {
    partialInputs: [
      ['onRelationshipChange', detail({ value: 'father' })],
    ],
    completeInputs: [
      ['onRelationshipChange', detail({ value: 'father' })],
      ['onGenderChange', detail({ value: 'male' })],
      ['onAgeInput', detail({ value: '72' })],
    ],
    restore: { relationship: 'father', gender: 'male', ageInput: '72' },
    firstErrorDataKey: 'relationshipError',
    secondErrorDataKey: 'genderError',
    nextRoute: '/pages/assessment/health',
    nextStep: 'health',
  },
  health: {
    partialInputs: [
      ['onConditionsChange', detail({ values: ['unknown'] })],
    ],
    completeInputs: [
      ['onConditionsChange', detail({ values: ['none'] })],
      ['onRecentEventsChange', detail({ values: ['none'] })],
      ['onRehabilitationNeedChange', detail({ value: 'unknown' })],
      ['onChewingAbilityChange', detail({ value: 'unknown' })],
      ['onSwallowingAbilityChange', detail({ value: 'unknown' })],
    ],
    restore: {
      conditions: ['none'],
      recentEvents: ['none'],
      rehabilitationNeed: 'unknown',
      chewingAbility: 'unknown',
      swallowingAbility: 'unknown',
    },
    firstErrorDataKey: 'conditionsError',
    secondErrorDataKey: 'recentEventsError',
    nextRoute: '/pages/assessment/adl',
    nextStep: 'adl',
  },
  adl: {
    partialInputs: [
      ['onEatingChange', detail({ value: 'unknown' })],
    ],
    completeInputs: [
      ['onEatingChange', detail({ value: 'independent' })],
      ['onMobilityChange', detail({ value: 'independent' })],
      ['onToiletingChange', detail({ value: 'independent' })],
      ['onBathingChange', detail({ value: 'independent' })],
      ['onDressingChange', detail({ value: 'independent' })],
      ['onTransferChange', detail({ value: 'independent' })],
      ['onStairsChange', detail({ value: 'independent' })],
    ],
    restore: {
      eating: 'independent',
      mobility: 'independent',
      toileting: 'independent',
      bathing: 'independent',
      dressing: 'independent',
      transfer: 'independent',
      stairs: 'independent',
    },
    firstErrorDataKey: 'eatingError',
    secondErrorDataKey: 'mobilityError',
    nextRoute: '/pages/assessment/cognitive',
    nextStep: 'cognitive',
  },
  cognitive: {
    partialInputs: [
      ['onSymptomsChange', detail({ values: ['unknown'] })],
    ],
    completeInputs: [
      ['onSymptomsChange', detail({ values: ['none'] })],
      ['onSpecialCareNeedsChange', detail({ values: ['none'] })],
    ],
    restore: { symptoms: ['none'], specialCareNeeds: ['none'] },
    firstErrorDataKey: 'symptomsError',
    secondErrorDataKey: 'specialCareNeedsError',
    nextRoute: '/pages/assessment/preference',
    nextStep: 'preference',
  },
  preference: {
    partialInputs: [
      ['onCareTypeChange', detail({ value: 'unknown' })],
    ],
    completeInputs: [
      ['onCareTypeChange', detail({ value: 'unknown' })],
      ['onRoomTypeChange', detail({ value: 'no_preference' })],
      ['onMealScheduleChange', detail({ value: 'no_preference' })],
      ['onActivityPreferenceChange', detail({ value: 'no_preference' })],
      ['onPrioritiesChange', detail({ values: ['price'] })],
    ],
    restore: {
      careType: 'unknown',
      roomType: 'no_preference',
      mealSchedule: 'no_preference',
      activityPreference: 'no_preference',
      priorities: ['price'],
    },
    firstErrorDataKey: 'careTypeError',
    secondErrorDataKey: 'prioritiesError',
    nextRoute: '/pages/assessment/budget',
    nextStep: 'budget',
  },
  budget: {
    partialInputs: [
      ['onMonthlyRangeChange', detail({ value: 'unknown' })],
    ],
    completeInputs: [
      ['onMonthlyRangeChange', detail({ value: 'unknown' })],
      ['onUpfrontCostChange', detail({ value: 'unknown' })],
      ['onMoveInTimingChange', detail({ value: 'research_only' })],
      ['onConsultantSupportChange', detail({ value: 'recommendation_first' })],
    ],
    restore: {
      monthlyRange: 'unknown',
      upfrontCostAcceptance: 'unknown',
      moveInTiming: 'research_only',
      consultantSupport: 'recommendation_first',
    },
    firstErrorDataKey: 'monthlyRangeError',
    secondErrorDataKey: 'upfrontCostError',
    nextRoute: '/pages/assessment/profile',
    nextStep: 'budget',
  },
}

const allPrerequisiteAnswers = {
  'basic.relationship': 'father',
  'basic.gender': 'male',
  'basic.age': 72,
  'health.conditions': ['none'],
  'health.recentEvents': ['none'],
  'health.rehabilitationNeed': 'unknown',
  'health.chewingAbility': 'unknown',
  'health.swallowingAbility': 'unknown',
  'adl.eating': 'independent',
  'adl.mobility': 'independent',
  'adl.toileting': 'independent',
  'adl.bathing': 'independent',
  'adl.dressing': 'independent',
  'adl.transfer': 'independent',
  'adl.stairs': 'independent',
  'cognitive.symptoms': ['none'],
  'cognitive.specialCareNeeds': ['none'],
  'preference.careType': 'unknown',
  'preference.roomType': 'no_preference',
  'preference.mealSchedule': 'no_preference',
  'preference.activityPreference': 'no_preference',
  'preference.priorities': ['price'],
}

const rootBackRoutes = {
  basic: '/pages/assessment/intro',
  health: '/pages/assessment/basic',
  adl: '/pages/assessment/health',
  cognitive: '/pages/assessment/adl',
  preference: '/pages/assessment/cognitive',
  budget: '/pages/assessment/preference',
}

const navigationBarFallbacks = {
  intro: '/pages/home/index',
  basic: '/pages/assessment/intro',
  health: '/pages/assessment/basic',
  adl: '/pages/assessment/health',
  cognitive: '/pages/assessment/adl',
  preference: '/pages/assessment/cognitive',
  budget: '/pages/assessment/preference',
}

const run = async () => {
  const { parser, parserPath } = await getDevToolsTypeScriptParser()
  const loadModule = makeRuntimeLoader(parser)
  const assessmentV2 = loadModule(path.join(miniprogramRoot, 'types', 'assessment-v2.ts'))
  const draftModule = loadModule(path.join(miniprogramRoot, 'store', 'assessment-draft.ts'))
  const primaryDefinition = loadDefinition(loadModule, 'miniprogram/components/primary-button/primary-button.ts')
  const footerDefinition = loadDefinition(loadModule, 'miniprogram/components/assessment-footer/assessment-footer.ts')
  const navigationBarDefinition = loadDefinition(loadModule, 'miniprogram/components/navigation-bar/navigation-bar.ts')
  const introDefinition = loadPageDefinition(loadModule, 'miniprogram/pages/assessment/intro.ts')
  const pageDefinitionsByStep = Object.fromEntries(pageSpecs.map((spec) => [
    spec.step,
    loadPageDefinition(loadModule, `miniprogram/pages/assessment/${spec.step}.ts`),
  ]))
  const draftStore = draftModule.assessmentDraftStore
  const draftStorageKey = draftModule.assessmentDraftStorageKey

  console.log(`PARSER: TypeScript ${parser.version} (${parserPath})`)

  const resetRuntime = (step) => {
    const cleared = draftStore.clear()
    assert.equal(cleared.persistence.ok, true, 'test Draft reset must persist successfully')
    runtimeState.navigationCalls.length = 0
    runtimeState.modalCalls.length = 0
    runtimeState.toastCalls.length = 0
    runtimeState.removeStorageCalls = 0
    runtimeState.scrollCalls.length = 0
    runtimeState.setDataCalls.length = 0
    runtimeState.failNextNavigateTo = false
    runtimeState.failNextNavigateBack = false
    runtimeState.throwNextNavigateBack = false
    runtimeState.failNextRedirectTo = false
    runtimeState.failNextReLaunch = false
    runtimeState.failNextSwitchTab = false
    runtimeState.pageStack = [
      { route: 'pages/assessment/intro' },
      { route: `pages/assessment/${step}` },
    ]
  }

  const preparePage = (spec) => {
    resetRuntime(spec.step)
    const page = mountPage(pageDefinitionsByStep[spec.step], `pages/assessment/${spec.step}`)
    runtimeState.pageStack[runtimeState.pageStack.length - 1] = page
    invokePageHandler(page, 'onShow')
    return page
  }

  const applyInputs = (page, inputs) => {
    inputs.forEach(([handlerName, event]) => invokePageHandler(page, handlerName, event))
  }

  const seedAnswers = (answers) => {
    Object.entries(answers).forEach(([questionId, value]) => {
      const result = draftStore.setAnswer(questionId, value)
      assert.equal(result.persistence.ok, true, `seed answer rejected: ${questionId}`)
    })
  }

  const prepareIntroWithDraft = (rootStack = false) => {
    resetRuntime('intro')
    seedAnswers({ 'basic.relationship': 'father' })
    runtimeState.navigationCalls.length = 0
    runtimeState.modalCalls.length = 0
    runtimeState.removeStorageCalls = 0
    runtimeState.pageStack = rootStack
      ? [{ route: 'pages/assessment/intro' }]
      : [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
      ]
    const page = mountPage(introDefinition, 'pages/assessment/intro')
    runtimeState.pageStack[runtimeState.pageStack.length - 1] = page
    invokePageHandler(page, 'onShow')
    assert.equal(page.data.hasDraft, true, 'Intro must expose Continue and Restart for an incomplete Draft')
    return page
  }

  const prepareForCompleteNext = (spec, page) => {
    if (spec.step === 'budget') {
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
    }
    applyInputs(page, pageInteractionSpecs[spec.step].completeInputs)
  }

  const assertDraftPersistedAndRestored = (spec, page) => {
    const expectedAnswers = spec.complete
    const draft = draftStore.getDraft()
    Object.entries(expectedAnswers).forEach(([questionId, expected]) => {
      assert.deepEqual(draft.answers[questionId], expected, `Draft missing ${questionId}`)
    })
    const storedDraft = runtimeState.storage[draftStorageKey]
    assert.ok(storedDraft && storedDraft.answers, 'no local Draft was written')
    Object.entries(expectedAnswers).forEach(([questionId, expected]) => {
      assert.deepEqual(storedDraft.answers[questionId], expected, `persisted Draft missing ${questionId}`)
    })

    const restoredStore = new draftModule.AssessmentDraftStore()
    assert.deepEqual(restoredStore.getDraft().answers, draft.answers, 'new store did not recover persisted Draft')

    const restoredPage = mountPage(pageDefinitionsByStep[spec.step], `pages/assessment/${spec.step}`)
    invokePageHandler(restoredPage, 'onShow')
    Object.entries(pageInteractionSpecs[spec.step].restore).forEach(([dataKey, expected]) => {
      assert.deepEqual(restoredPage.data[dataKey], expected, `page restore mismatch: ${spec.step}.${dataKey}`)
    })
    assert.ok(page, 'page handler was not mounted')
  }

  runCase(
    'RESTART-001_CONTINUE_EXISTING_DRAFT',
    'An incomplete Draft exists with a parent page and Intro continues through navigateTo',
    () => {
      const introWxml = readText('miniprogram/pages/assessment/intro.wxml')
      const continueButton = introWxml.match(/<button[^>]*class="draft-continue"[^>]*>/)?.[0] || ''
      assert.match(continueButton, /bindtap="startAssessment"/)
      assert.match(continueButton, /disabled="\{\{restartPending\}\}"/, 'Continue is disabled only during the existing restart action')

      const page = prepareIntroWithDraft()
      const draftBefore = draftStore.getDraft()
      invokePageHandler(page, 'startAssessment')

      assert.equal(page.handlerCalls.startAssessment, 1)
      assert.equal(runtimeState.modalCalls.length, 0)
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'navigateTo', url: '/pages/assessment/basic' }],
      )
      assert.deepEqual(draftStore.getDraft().answers, draftBefore.answers)
    },
  )

  runCase(
    'INTRO_ROOT_CONTINUE_REDIRECT_RETRY',
    'An incomplete Draft exists on root Intro; failed redirectTo releases the guard, retry succeeds, and Draft remains intact',
    () => {
      const page = prepareIntroWithDraft(true)
      const draftBefore = draftStore.getDraft()
      runtimeState.failNextRedirectTo = true

      invokePageHandler(page, 'startAssessment')
      assert.equal(runtimeState.navigationCalls.length, 1)
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/basic' }],
      )
      assert.deepEqual(runtimeState.toastCalls, [{ title: '暂时无法进入评估，请重试。', icon: 'none' }])
      assert.deepEqual(draftStore.getDraft().answers, draftBefore.answers)

      invokePageHandler(page, 'startAssessment')
      assert.equal(runtimeState.navigationCalls.length, 2, 'failed root navigation must release the action guard')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [
          { type: 'redirectTo', url: '/pages/assessment/basic' },
          { type: 'redirectTo', url: '/pages/assessment/basic' },
        ],
      )
      assert.equal(runtimeState.toastCalls.length, 1, 'successful retry must not repeat failure feedback')
      assert.deepEqual(draftStore.getDraft().answers, draftBefore.answers)
    },
  )

  runCase(
    'INTRO_NESTED_CONTINUE_NAVIGATION_FAILURE_VISIBLE_RETRY',
    'An incomplete Draft exists on nested Intro; failed navigateTo shows feedback, releases the guard, and retry uses the ordinary stack path',
    () => {
      const page = prepareIntroWithDraft(false)
      const draftBefore = draftStore.getDraft()
      runtimeState.failNextNavigateTo = true

      invokePageHandler(page, 'startAssessment')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'navigateTo', url: '/pages/assessment/basic' }],
      )
      assert.deepEqual(runtimeState.toastCalls, [{ title: '暂时无法进入评估，请重试。', icon: 'none' }])
      assert.deepEqual(draftStore.getDraft().answers, draftBefore.answers)

      invokePageHandler(page, 'startAssessment')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [
          { type: 'navigateTo', url: '/pages/assessment/basic' },
          { type: 'navigateTo', url: '/pages/assessment/basic' },
        ],
      )
      assert.equal(runtimeState.toastCalls.length, 1, 'successful nested retry must not repeat failure feedback')
      assert.deepEqual(draftStore.getDraft().answers, draftBefore.answers)
    },
  )

  runCase(
    'RESTART-002_CONFIRM_CLEAR_AND_START',
    'An incomplete Draft exists; Restart opens one valid confirmation, then confirmation clears the old Draft and navigates once',
    () => {
      const introWxml = readText('miniprogram/pages/assessment/intro.wxml')
      const restartButton = introWxml.match(/<button[^>]*class="restart-button"[^>]*>/)?.[0] || ''
      assert.match(restartButton, /bindtap="restartAssessment"/)
      assert.match(restartButton, /disabled="\{\{restartPending\}\}"/)
      assert.match(restartButton, /loading="\{\{restartPending\}\}"/)

      const page = prepareIntroWithDraft()
      const draftBefore = draftStore.getDraft()
      invokePageHandler(page, 'restartAssessment')

      assert.equal(page.handlerCalls.restartAssessment, 1)
      assert.equal(runtimeState.modalCalls.length, 1)
      const modal = runtimeState.modalCalls[0]
      assert.ok(Array.from(modal.confirmText || '').length <= 4, 'showModal.confirmText must be at most 4 characters')
      assert.equal(page.data.restartPending, true)
      assert.deepEqual(draftStore.getDraft(), draftBefore, 'Draft must remain until the user confirms')
      assert.equal(runtimeState.navigationCalls.length, 0)

      modal.success({ confirm: true, cancel: false })

      const draftAfter = draftStore.getDraft()
      assert.notEqual(draftAfter.localDraftId, draftBefore.localDraftId)
      assert.deepEqual(draftAfter.answers, {})
      assert.equal(runtimeState.removeStorageCalls, 1)
      assert.equal(page.data.restartPending, false)
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'navigateTo', url: '/pages/assessment/basic' }],
      )
    },
  )

  runCase(
    'RESUME_FIRST_INCOMPLETE_V2_QUESTION',
    'A root Intro V2 Draft resumes at the first missing V2 question with redirectTo, independent of currentStep',
    () => {
      resetRuntime('intro')
      seedAnswers({
        'basic.relationship': 'father',
        'basic.gender': 'male',
        'basic.age': 72,
        'health.conditions': ['none'],
        'health.recentEvents': ['none'],
        'health.rehabilitationNeed': 'unknown',
        'health.chewingAbility': 'unknown',
        'health.swallowingAbility': 'unknown',
        'adl.eating': 'independent',
        'adl.mobility': 'independent',
        'adl.toileting': 'independent',
        'adl.bathing': 'independent',
        'adl.dressing': 'independent',
        'adl.transfer': 'independent',
        'adl.stairs': 'independent',
        'cognitive.symptoms': ['none'],
        'cognitive.specialCareNeeds': ['none'],
        'preference.careType': 'unknown',
      })
      assert.equal(draftStore.setCurrentStep('budget').persistence.ok, true)
      runtimeState.navigationCalls.length = 0
      runtimeState.pageStack = [{ route: 'pages/assessment/intro' }]
      const page = mountPage(introDefinition, 'pages/assessment/intro')
      runtimeState.pageStack[0] = page
      invokePageHandler(page, 'onShow')
      invokePageHandler(page, 'startAssessment')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/preference' }],
      )
      assert.equal(draftStore.getDraft().currentStep, 'budget')
    },
  )

  runCase(
    'ASSESSMENT_CAPACITY_RESET_ONE_TIME_INTENT',
    'A full actual stack asks before reset, cancellation preserves Draft, confirmation opens only root Intro, and one explicit action consumes a local one-time intent',
    () => {
      const basicSpec = pageSpecs.find((spec) => spec.step === 'basic')
      const page = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, page)
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
      runtimeState.pageStack = [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
        { route: 'pages/appointment/index' },
        { route: 'pages/mine/index' },
        { route: 'pages/elder/index' },
        page,
      ]
      const before = draftStore.getDraft()
      invokePageHandler(page, 'onNext')
      assert.equal(runtimeState.modalCalls.length, 1)
      assert.equal(runtimeState.navigationCalls.length, 0)
      const modal = runtimeState.modalCalls[0]
      assert.ok(Array.from(modal.confirmText || '').length <= 4)
      assert.ok(Array.from(modal.cancelText || '').length <= 4)
      modal.success({ confirm: false, cancel: true })
      assert.deepEqual(draftStore.getDraft(), before, 'cancel must not update currentStep or clear Draft')
      assert.equal(runtimeState.navigationCalls.length, 0)

      invokePageHandler(page, 'onNext')
      assert.equal(runtimeState.modalCalls.length, 2, 'cancel releases the page action lease')
      const confirmedModal = runtimeState.modalCalls[1]
      let introPage
      const originalReLaunch = wx.reLaunch
      wx.reLaunch = (options) => {
        runtimeState.navigationCalls.push({ type: 'reLaunch', url: options.url, options })
        introPage = mountPage(introDefinition, 'pages/assessment/intro')
        runtimeState.pageStack = [introPage]
        invokePageHandler(page, 'onHide')
        const query = Object.fromEntries(new URLSearchParams(options.url.split('?')[1]))
        invokePageHandler(introPage, 'onLoad', query)
        if (options.success) options.success({ errMsg: 'reLaunch:ok' })
        if (options.complete) options.complete({ errMsg: 'reLaunch:ok' })
      }
      try {
        confirmedModal.success({ confirm: true, cancel: false })
        confirmedModal.success({ confirm: true, cancel: false })
      } finally {
        wx.reLaunch = originalReLaunch
      }
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'reLaunch', url: '/pages/assessment/intro?phaseStep=health&phaseSource=assessment-forward' }],
        'a duplicate modal confirmation cannot launch a second Intro reset',
      )
      assert.deepEqual(draftStore.getDraft().answers, before.answers)
      assert.equal(draftStore.getDraft().currentStep, 'health')

      runtimeState.navigationCalls.length = 0
      assert.equal(introPage.data.phaseIntentStep, 'health')
      assert.match(introPage.data.phaseIntentActionLabel, /继续填写/)
      assert.equal(runtimeState.navigationCalls.length, 0,
        'Intro acceptance must wait for a second explicit user action')

      runtimeState.failNextNavigateTo = true
      invokePageHandler(introPage, 'startAssessment')
      assert.equal(introPage.data.phaseIntentStep, 'health',
        'an async navigation failure keeps a still-valid intent retryable')
      assert.match(introPage.data.phaseIntentError, /暂时无法进入目标步骤/)

      const retryNavigateTo = wx.navigateTo
      wx.navigateTo = () => { throw new Error('navigateTo:throw test') }
      try {
        invokePageHandler(introPage, 'startAssessment')
      } finally {
        wx.navigateTo = retryNavigateTo
      }
      assert.equal(introPage.data.phaseIntentStep, 'health',
        'a synchronous navigation exception also keeps the intent retryable')
      assert.match(introPage.data.phaseIntentError, /暂时无法进入目标步骤/)

      runtimeState.navigationCalls.length = 0
      const originalNavigateTo = wx.navigateTo
      wx.navigateTo = (options) => {
        runtimeState.navigationCalls.push({ type: 'navigateTo', url: options.url, options })
        runtimeState.pageStack.push({ route: 'pages/assessment/health' })
        invokePageHandler(introPage, 'onHide')
        if (options.success) options.success({ errMsg: 'navigateTo:ok' })
        if (options.complete) options.complete({ errMsg: 'navigateTo:ok' })
      }
      try {
        invokePageHandler(introPage, 'startAssessment')
      } finally {
        wx.navigateTo = originalNavigateTo
      }
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'navigateTo', url: '/pages/assessment/health' }],
      )
      invokePageHandler(introPage, 'onShow')
      assert.equal(introPage.data.phaseIntentStep, '')
      assert.match(introPage.data.phaseIntentError, /已结束/)

      const replayPage = mountPage(introDefinition, 'pages/assessment/intro')
      runtimeState.pageStack = [replayPage]
      invokePageHandler(replayPage, 'onLoad', { phaseStep: 'health', phaseSource: 'assessment-forward' })
      assert.equal(replayPage.data.phaseIntentStep, '')
      assert.match(replayPage.data.phaseIntentError, /无效或已过期/,
        'the consumed URL cannot recreate the one-time intent')
      assert.equal(runtimeState.navigationCalls.length, 1)

      resetRuntime('intro')
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
      assert.equal(draftStore.setCurrentStep('budget').persistence.ok, true)
      const ordinaryIntro = mountPage(introDefinition, 'pages/assessment/intro')
      runtimeState.pageStack = [ordinaryIntro]
      invokePageHandler(ordinaryIntro, 'onLoad', {})
      assert.equal(ordinaryIntro.data.phaseIntentError, '',
        'ordinary Intro without an outstanding handoff has no invalid-intent warning')
      invokePageHandler(ordinaryIntro, 'onShow')
      invokePageHandler(ordinaryIntro, 'startAssessment')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/basic' }],
        'ordinary complete-Draft Continue remains the approved Basic restart route',
      )

      const deepStackForSource = (sourcePage) => [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
        { route: 'pages/appointment/index' },
        { route: 'pages/mine/index' },
        { route: 'pages/elder/index' },
        sourcePage,
      ]

      const hiddenSource = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, hiddenSource)
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
      runtimeState.pageStack = deepStackForSource(hiddenSource)
      const hiddenDraft = draftStore.getDraft()
      invokePageHandler(hiddenSource, 'onNext')
      assert.equal(runtimeState.modalCalls.length, 1)
      invokePageHandler(hiddenSource, 'onHide')
      runtimeState.modalCalls[0].success({ confirm: true, cancel: false })
      assert.equal(runtimeState.navigationCalls.length, 0,
        'a confirmation delivered after source onHide must not create a handoff or navigate')
      assert.deepEqual(draftStore.getDraft(), hiddenDraft)

      const displacedSource = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, displacedSource)
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
      runtimeState.pageStack = deepStackForSource(displacedSource)
      const displacedDraft = draftStore.getDraft()
      invokePageHandler(displacedSource, 'onNext')
      assert.equal(runtimeState.modalCalls.length, 1)
      runtimeState.pageStack[runtimeState.pageStack.length - 1] = { route: 'pages/appointment/index' }
      runtimeState.modalCalls[0].success({ confirm: true, cancel: false })
      assert.equal(runtimeState.navigationCalls.length, 0,
        'a delayed confirmation cannot act after the source has left the actual stack')
      assert.deepEqual(draftStore.getDraft(), displacedDraft)

      const changedSource = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, changedSource)
      seedAnswers(Object.assign({}, ...pageSpecs.map((spec) => spec.complete)))
      runtimeState.pageStack = deepStackForSource(changedSource)
      invokePageHandler(changedSource, 'onNext')
      assert.equal(runtimeState.modalCalls.length, 1)
      assert.equal(draftStore.setCurrentStep('budget').persistence.ok, true)
      const changedDraft = draftStore.getDraft()
      runtimeState.modalCalls[0].success({ confirm: true, cancel: false })
      assert.equal(runtimeState.navigationCalls.length, 0,
        'confirmation must not reset after the source Draft context changes')
      assert.deepEqual(draftStore.getDraft(), changedDraft,
        'a stale confirmation preserves the latest locally saved Draft')
      assert.match(changedSource.data.formError, /暂时无法进入下一步/)

      const lateFailureSource = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, lateFailureSource)
      runtimeState.pageStack = [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
        { route: 'pages/appointment/index' },
        { route: 'pages/mine/index' },
        { route: 'pages/elder/index' },
        lateFailureSource,
      ]
      invokePageHandler(lateFailureSource, 'onNext')
      let lateIntroPage
      let lateFailureOptions
      const savedReLaunch = wx.reLaunch
      wx.reLaunch = (options) => {
        runtimeState.navigationCalls.push({ type: 'reLaunch', url: options.url, options })
        lateFailureOptions = options
        lateIntroPage = mountPage(introDefinition, 'pages/assessment/intro')
        runtimeState.pageStack = [lateIntroPage]
        invokePageHandler(lateFailureSource, 'onHide')
        invokePageHandler(lateIntroPage, 'onLoad', {})
      }
      try {
        runtimeState.modalCalls[0].success({ confirm: true, cancel: false })
      } finally {
        wx.reLaunch = savedReLaunch
      }
      assert.equal(lateIntroPage.data.phaseIntentStep, '')
      assert.match(lateIntroPage.data.phaseIntentError, /无效或已过期/,
        'an authorized reset without its expected query must not expose an intent')
      runtimeState.pageStack = [{ route: 'pages/home/index' }]
      invokePageHandler(lateIntroPage, 'onHide')
      lateFailureOptions.fail({ errMsg: 'reLaunch:fail late test' })
      lateFailureOptions.complete({ errMsg: 'reLaunch:fail late test' })

      const lateReplayPage = mountPage(introDefinition, 'pages/assessment/intro')
      runtimeState.pageStack = [lateReplayPage]
      invokePageHandler(lateReplayPage, 'onLoad', {
        phaseStep: 'health',
        phaseSource: 'assessment-forward',
      })
      assert.equal(lateReplayPage.data.phaseIntentStep, '')
      assert.match(lateReplayPage.data.phaseIntentError, /无效或已过期/,
        'a late failed reLaunch cannot restore a handoff after Intro exits')
    },
  )

  runCase(
    'INTRO_ROOT_RESTART_REDIRECT',
    'Confirming Restart from root Intro clears the incomplete local Draft and replaces Intro with Basic',
    () => {
      const page = prepareIntroWithDraft(true)
      const draftBefore = draftStore.getDraft()
      invokePageHandler(page, 'restartAssessment')
      const modal = runtimeState.modalCalls[0]

      modal.success({ confirm: true, cancel: false })

      assert.notEqual(draftStore.getDraft().localDraftId, draftBefore.localDraftId)
      assert.deepEqual(draftStore.getDraft().answers, {})
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/basic' }],
      )
    },
  )

  runCase(
    'RESTART-003_RAPID_RESTART_GUARD',
    'Two rapid Restart taps share one pending confirmation and can clear/navigate at most once',
    () => {
      const page = prepareIntroWithDraft()
      invokePageHandler(page, 'restartAssessment')
      invokePageHandler(page, 'restartAssessment')

      assert.equal(page.handlerCalls.restartAssessment, 2)
      assert.equal(runtimeState.modalCalls.length, 1)
      assert.equal(runtimeState.removeStorageCalls, 0)
      assert.equal(runtimeState.navigationCalls.length, 0)

      const modal = runtimeState.modalCalls[0]
      modal.success({ confirm: true, cancel: false })

      assert.equal(runtimeState.removeStorageCalls, 1)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
      assert.deepEqual(draftStore.getDraft().answers, {})
    },
  )

  runCase(
    'RESTART_CANCEL_PRESERVES_DRAFT',
    'Cancelling the existing Restart confirmation preserves the Draft and releases the pending action state',
    () => {
      const page = prepareIntroWithDraft()
      const draftBefore = draftStore.getDraft()
      invokePageHandler(page, 'restartAssessment')
      const modal = runtimeState.modalCalls[0]

      modal.success({ confirm: false, cancel: true })

      assert.deepEqual(draftStore.getDraft(), draftBefore)
      assert.equal(runtimeState.removeStorageCalls, 0)
      assert.equal(runtimeState.navigationCalls.length, 0)
      assert.equal(page.data.restartPending, false)
    },
  )

  runCase(
    'FOOTER_SINGLE_ACTION_CHANNEL',
    'Footer WXML delegates to PrimaryButton action; no native tap handler is present',
    () => {
      const wxml = readText('miniprogram/components/assessment-footer/assessment-footer.wxml')
      assert.match(wxml, /<primary-button/)
      assert.doesNotMatch(wxml, /(?:bind:?tap|catch:?tap)/)
      assert.match(wxml, /bind:action="onBackAction"/)
      assert.match(wxml, /bind:action="onNextAction"/)
      assert.equal(footerDefinition.properties.backDisabled.value, false)
      assert.equal(footerDefinition.properties.nextDisabled.value, false)

      const footer = mountComponent(footerDefinition)
      const deliveredActions = []
      const nextButton = mountComponent(primaryDefinition)
      nextButton.triggerEvent = (name, detail, options) => {
        assert.equal(name, 'action')
        deliveredActions.push({ name, detail, options })
        footer.onNextAction()
      }
      nextButton.handleAction()

      assert.equal(deliveredActions.length, 1)
      assert.deepEqual(deliveredActions[0].options, { bubbles: false, composed: false })
      assert.deepEqual(footer.events.map((event) => event.name), ['next'])
      assert.deepEqual(footer.events[0].options, { bubbles: false, composed: false })

      footer.data.nextDisabled = true
      footer.onNextAction()
      assert.deepEqual(footer.events.map((event) => event.name), ['next'])

      nextButton.data.disabled = true
      nextButton.handleAction()
      assert.equal(deliveredActions.length, 1)

      const deliveredBackActions = []
      const backButton = mountComponent(primaryDefinition)
      backButton.triggerEvent = (name, detail, options) => {
        assert.equal(name, 'action')
        deliveredBackActions.push({ name, detail, options })
        footer.onBackAction()
      }
      backButton.handleAction()
      assert.equal(deliveredBackActions.length, 1)
      assert.deepEqual(deliveredBackActions[0].options, { bubbles: false, composed: false })
      assert.deepEqual(footer.events.map((event) => event.name), ['next', 'back'])
      assert.deepEqual(footer.events[1].options, { bubbles: false, composed: false })

      footer.data.backDisabled = true
      footer.onBackAction()
      assert.deepEqual(footer.events.map((event) => event.name), ['next', 'back'])

      const basicSpec = pageSpecs[0]
      const basicPage = preparePage(basicSpec)
      prepareForCompleteNext(basicSpec, basicPage)
      const pageFooter = mountComponent(footerDefinition)
      const pageNextButton = mountComponent(primaryDefinition)
      pageFooter.triggerEvent = (name, detail, options) => {
        pageFooter.events.push({ name, detail, options })
        if (name === 'next') {
          invokePageHandler(basicPage, 'onNext')
        }
      }
      pageNextButton.triggerEvent = (name, detail, options) => {
        assert.equal(name, 'action')
        pageFooter.onNextAction()
      }
      pageNextButton.handleAction()
      assert.equal(basicPage.handlerCalls.onNext, 1)
      assert.deepEqual(
        runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').map((call) => call.url),
        ['/pages/assessment/health'],
      )
      assert.deepEqual(pageFooter.events.map((event) => event.name), ['next'])
    },
  )

  runCase(
    'NAVIGATION_BAR_BACK_RUNTIME',
    'A real NavigationBar instance uses navigateBack for normal stacks, configured root fallback APIs, and emits one non-bubbling back event',
    () => {
      const navigationBar = mountComponent(navigationBarDefinition)
      navigationBar.data.delta = 1
      navigationBar.data.fallbackUrl = '/pages/assessment/intro'

      runtimeState.navigationCalls.length = 0
      navigationBar.events.length = 0
      runtimeState.pageStack = [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
      ]
      navigationBar.back()
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
        [{ type: 'navigateBack', url: undefined }],
      )
      assert.deepEqual(navigationBar.events, [
        { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
      ])

      runtimeState.navigationCalls.length = 0
      navigationBar.events.length = 0
      runtimeState.pageStack = [{ route: 'pages/assessment/intro' }]
      navigationBar.data.fallbackUrl = '/pages/home/index'
      navigationBar.data.fallbackIsTab = true
      const introPage = mountPage(introDefinition, 'pages/assessment/intro')
      runtimeState.pageStack[runtimeState.pageStack.length - 1] = introPage
      navigationBar.triggerEvent = (name, detail, options) => {
        navigationBar.events.push({ name, detail, options })
        if (name === 'navigationfail') {
          invokePageHandler(introPage, 'onNavigationFailure')
        }
      }
      runtimeState.failNextSwitchTab = true
      navigationBar.back()
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
        [{ type: 'switchTab', url: '/pages/home/index' }],
      )
      assert.deepEqual(runtimeState.toastCalls, [{ title: '暂时无法返回，请稍后重试。', icon: 'none' }])
      assert.equal(introPage.handlerCalls.onNavigationFailure, 1)
      runtimeState.navigationCalls.length = 0
      navigationBar.back()
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
        [{ type: 'switchTab', url: '/pages/home/index' }],
      )
      assert.equal(runtimeState.toastCalls.length, 1, 'successful retry must not show another failure toast')
      assert.deepEqual(navigationBar.events, [
        { name: 'navigationfail', detail: { action: 'back' }, options: { bubbles: false, composed: false } },
        { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
        { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
      ])

      runtimeState.navigationCalls.length = 0
      navigationBar.events.length = 0
      navigationBar.data.fallbackIsTab = false
      navigationBar.data.fallbackUrl = '/pages/assessment/basic'
      navigationBar.back()
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/basic' }],
      )
      assert.deepEqual(navigationBar.events, [
        { name: 'back', detail: { delta: 1 }, options: { bubbles: false, composed: false } },
      ])

      runtimeState.navigationCalls.length = 0
      navigationBar.events.length = 0
      navigationBar.data.fallbackUrl = ''
      navigationBar.back()
      assert.equal(runtimeState.navigationCalls.length, 0)
      assert.equal(navigationBar.events.length, 1)

      const guardedPage = preparePage(pageSpecs.find((spec) => spec.step === 'basic'))
      navigationBar.data.guardBack = true
      navigationBar.data.fallbackUrl = '/pages/assessment/intro'
      navigationBar.data.fallbackIsTab = false
      navigationBar.events.length = 0
      runtimeState.toastCalls.length = 0
      runtimeState.navigationCalls.length = 0
      runtimeState.pageStack = [
        { route: 'pages/assessment/intro' },
        { route: 'pages/assessment/basic' },
      ]
      navigationBar.triggerEvent = (name, detail, options) => {
        navigationBar.events.push({ name, detail, options })
        if (name === 'navigationfail') invokePageHandler(guardedPage, 'onNavigationFailure')
      }
      runtimeState.failNextNavigateBack = true
      navigationBar.back()
      assert.equal(navigationBar.events.length, 1, 'guarded Back emits one failure event after fail+complete')
      assert.equal(navigationBar.events[0].name, 'navigationfail')
      assert.equal(runtimeState.toastCalls.length, 1)
      navigationBar.back()
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateBack').length, 2,
        'guarded Back failure releases the component action for retry')
      assert.equal(runtimeState.toastCalls.length, 1)

      navigationBarDefinition.pageLifetimes.show.call(navigationBar)
      navigationBar.events.length = 0
      runtimeState.throwNextNavigateBack = true
      navigationBar.back()
      assert.equal(navigationBar.events.length, 1, 'synchronous wx exception also emits one failure event')
      assert.equal(navigationBar.events[0].name, 'navigationfail')
      assert.equal(runtimeState.toastCalls.length, 2)
    },
  )

  runCase(
    'NAVIGATION_BAR_ASSESSMENT_FALLBACKS',
    'Intro and all six Assessment step WXML mounts pass explicit previous business route and Intro marks Home as a tab fallback',
    () => {
      Object.entries(navigationBarFallbacks).forEach(([step, fallbackUrl]) => {
        const wxml = readText(`miniprogram/pages/assessment/${step}.wxml`)
        const escapedUrl = fallbackUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        assert.match(
          wxml,
          new RegExp(`<navigation-bar[^>]*fallbackUrl="${escapedUrl}"`),
          `${step} must declare fallbackUrl`,
        )
        if (step === 'intro') {
          assert.match(wxml, /fallbackIsTab="\{\{true\}\}"/, 'Intro Home fallback must use the tab route API')
          assert.match(wxml, /bind:navigationfail="onNavigationFailure"/, 'Intro must show feedback if Home fallback fails')
        } else {
          assert.doesNotMatch(wxml, /fallbackIsTab/, `${step} keeps the ordinary page fallback API`)
          assert.match(wxml, /guardBack="\{\{true\}\}"/, `${step} opts into guarded navigation-bar Back`)
          assert.match(wxml, /bind:navigationfail="onNavigationFailure"/, `${step} must show feedback if header Back fails`)
        }
      })
    },
    'structural',
  )

  for (const spec of pageSpecs) {
    const pageSource = readText(`miniprogram/pages/assessment/${spec.step}.ts`)
    const pageWxml = readText(`miniprogram/pages/assessment/${spec.step}.wxml`)
    const validator = assessmentV2[spec.validatorName]
    const interaction = pageInteractionSpecs[spec.step]
    const forwardNavigationType = spec.step === 'budget' ? 'reLaunch' : 'navigateTo'
    const expectedErrorSelector = (questionId) =>
      `#assessment-question-${questionId.replace(/[^a-zA-Z0-9]+/g, '-')}`

    runCase(
      `${spec.step.toUpperCase()}_UNANSWERED`,
      `${spec.step} Page is mounted, onShow restores an empty Draft, then the real onNext handler is invoked`,
      () => {
        assert.equal(typeof validator, 'function')
        const page = preparePage(spec)
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 1)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 0)
        assert.equal(runtimeState.scrollCalls.length, 1)
        assert.equal(runtimeState.scrollCalls[0].selector, expectedErrorSelector(spec.questions[0]))
        assert.ok(page.data[interaction.firstErrorDataKey])
        assert.deepEqual(draftStore.getDraft().answers, {})
        assert.match(pageSource, new RegExp(`navigateBackFromAssessment\\('${spec.step}'\\)`))
        assert.match(pageWxml, /<assessment-footer[\s\S]*bindback="onBack"[\s\S]*bindnext="onNext"/)
        assert.match(pageWxml, /<assessment-footer[^>]*backText="\{\{backText\}\}"/)
      },
    )

    runCase(
      `${spec.step.toUpperCase()}_PARTIAL_AND_FIRST_ERROR`,
      `${spec.step} Page receives only the first answer through its real input handler, then onNext is invoked`,
      () => {
        const page = preparePage(spec)
        applyInputs(page, interaction.partialInputs)
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 1)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 0)
        assert.equal(runtimeState.scrollCalls.length, 1)
        assert.equal(runtimeState.scrollCalls[0].selector, expectedErrorSelector(spec.questions[1]))
        assert.ok(page.data[interaction.secondErrorDataKey])
        Object.entries(spec.partial).forEach(([questionId, expected]) => {
          assert.deepEqual(draftStore.getDraft().answers[questionId], expected)
        })
      },
    )

    runCase(
      `${spec.step.toUpperCase()}_VALID`,
      `${spec.step} Page receives every valid answer through real input handlers, then onNext navigates once`,
      () => {
        const page = preparePage(spec)
        prepareForCompleteNext(spec, page)
        assert.equal(page.data[interaction.firstErrorDataKey], '')
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 1)
        assert.deepEqual(
          runtimeState.navigationCalls.filter((call) => call.type === forwardNavigationType).map((call) => call.url),
          [interaction.nextRoute],
        )
        assert.equal(runtimeState.scrollCalls.length, 0)
        assert.equal(page.data[interaction.firstErrorDataKey], '')
        assert.equal(draftStore.getDraft().currentStep, interaction.nextStep)
        assertDraftPersistedAndRestored(spec, page)
      },
    )

    runCase(
      `${spec.step.toUpperCase()}_INVALID_FIX_AND_DRAFT_RETURN`,
      'The real page first reports an invalid/incomplete state, then accepts fixed inputs and preserves the resulting Draft on Back',
      () => {
        const page = preparePage(spec)
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 1)
        assert.equal(runtimeState.scrollCalls.length, 1)
        assert.ok(page.data[interaction.firstErrorDataKey])

        prepareForCompleteNext(spec, page)
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 2)
        assert.deepEqual(
          runtimeState.navigationCalls.filter((call) => call.type === forwardNavigationType).map((call) => call.url),
          [interaction.nextRoute],
        )
        const beforeReturn = JSON.stringify(draftStore.getDraft().answers)
        invokePageHandler(page, 'onBack')
        assert.equal(page.handlerCalls.onBack, 1)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateBack').length, 1)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'redirectTo').length, 0)
        assert.equal(JSON.stringify(draftStore.getDraft().answers), beforeReturn)
        assertDraftPersistedAndRestored(spec, page)
      },
    )

    runCase(
      `${spec.step.toUpperCase()}_RAPID_NEXT_GUARD`,
      'Two rapid calls to the real page onNext handler share one page instance while the first forward transition remains guarded',
      () => {
        const page = preparePage(spec)
        prepareForCompleteNext(spec, page)
        invokePageHandler(page, 'onNext')
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 2)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === forwardNavigationType).length, 1)
        assert.equal(runtimeState.scrollCalls.length, 0)

        invokePageHandler(page, 'onShow')
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onShow, 2)
        assert.equal(page.handlerCalls.onNext, 3)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === forwardNavigationType).length, 2)
        assertDraftPersistedAndRestored(spec, page)
      },
    )
  }

  runCase(
    'ROOT_STACK_BACK_FALLBACK',
    'Each real Assessment Page onBack handler is invoked as the only stack entry and redirects to its explicit previous route',
    () => {
      for (const spec of pageSpecs) {
        const page = preparePage(spec)
        runtimeState.pageStack = [{ route: `pages/assessment/${spec.step}` }]
        invokePageHandler(page, 'onShow')
        assert.match(page.data.backText, /^返回/)
        runtimeState.navigationCalls.length = 0
        invokePageHandler(page, 'onBack')
        assert.equal(page.handlerCalls.onBack, 1)
        assert.deepEqual(
          runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
          [{ type: 'redirectTo', url: rootBackRoutes[spec.step] }],
        )
        assert.deepEqual(draftStore.getDraft().answers, {})
      }
    },
  )

  runCase(
    'ASSESSMENT_BACK_LABEL_FOLLOWS_ACTUAL_PARENT',
    'Each Assessment footer label reflects its actual stack parent, including Resume from Intro, while root fallback names the configured route',
    () => {
      const labels = {
        intro: '评估说明', basic: '老人基本情况', health: '健康情况', adl: '生活自理情况',
        cognitive: '认知情况', preference: '入住偏好', budget: '预算安排',
      }
      for (const spec of pageSpecs) {
        const page = preparePage(spec)
        assert.equal(page.data.backText, '返回评估说明', `${spec.step} Resume from Intro label`)
        const parentStep = spec.step === 'basic' ? null : pageSpecs[pageSpecs.findIndex((item) => item.step === spec.step) - 1]
        if (parentStep) {
          runtimeState.pageStack = [
            { route: `pages/assessment/${parentStep.step}` },
            { route: `pages/assessment/${spec.step}` },
          ]
          invokePageHandler(page, 'onShow')
          assert.equal(page.data.backText, `返回${labels[parentStep.step]}`, `${spec.step} actual parent label`)
        }
        runtimeState.pageStack = [{ route: `pages/assessment/${spec.step}` }]
        invokePageHandler(page, 'onShow')
        assert.equal(page.data.backText, `返回${labels[spec.step === 'basic' ? 'intro' : parentStep.step]}`)
      }
    },
  )

  runCase(
    'ASSESSMENT_BACK_FAILURE_VISIBLE_AND_RETRY',
    'Footer and navigation-bar Back failures are visible, do not validate Next, preserve Draft, and allow retry',
    () => {
      const spec = pageSpecs.find((item) => item.step === 'health')
      const page = preparePage(spec)
      seedAnswers({ 'basic.relationship': 'father' })
      const answersBefore = JSON.stringify(draftStore.getDraft().answers)
      runtimeState.failNextNavigateBack = true
      invokePageHandler(page, 'onBack')
      assert.equal(runtimeState.toastCalls.length, 1)
      assert.match(runtimeState.toastCalls[0].title, /无法返回/)
      assert.equal(runtimeState.scrollCalls.length, 0, 'Back must not trigger Next validation')
      assert.equal(JSON.stringify(draftStore.getDraft().answers), answersBefore)
      invokePageHandler(page, 'onBack')
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateBack').length, 2)
      invokePageHandler(page, 'onNavigationFailure')
      assert.equal(runtimeState.toastCalls.length, 2, 'header failure handler must surface feedback')

      runtimeState.pageStack = [{ route: 'pages/assessment/health' }]
      runtimeState.failNextRedirectTo = true
      invokePageHandler(page, 'onBack')
      assert.equal(runtimeState.toastCalls.length, 3)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'redirectTo').length, 1)
      assert.equal(JSON.stringify(draftStore.getDraft().answers), answersBefore)
    },
  )

  runCase(
    'BUDGET_NAVIGATION_FAILURE_VISIBLE_AND_RETRY',
    'Budget valid Next receives reLaunch failure, shows an actionable footer error, releases the guard, then retries successfully',
    () => {
      const budgetSpec = pageSpecs.find((spec) => spec.step === 'budget')
      const page = preparePage(budgetSpec)
      prepareForCompleteNext(budgetSpec, page)
      runtimeState.failNextReLaunch = true

      invokePageHandler(page, 'onNext')
      assert.equal(page.handlerCalls.onNext, 1)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'reLaunch').length, 1)
      assert.match(page.data.formError, /无法打开老人需求画像/)

      invokePageHandler(page, 'onNext')
      assert.equal(page.handlerCalls.onNext, 2)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'reLaunch').length, 2)
      assert.equal(page.data.formError, '')
    },
  )

  runCase(
    'BUDGET_GLOBAL_COMPLETION_GATE',
    'Budget Page has all local answers but no prerequisite step answers; real onNext must show an actionable error and not navigate',
    () => {
      const budgetSpec = pageSpecs.find((spec) => spec.step === 'budget')
      const page = preparePage(budgetSpec)
      applyInputs(page, pageInteractionSpecs.budget.completeInputs)
      invokePageHandler(page, 'onNext')

      assert.equal(page.handlerCalls.onNext, 1)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 0)
      assert.equal(runtimeState.scrollCalls.length, 0)
      assert.match(page.data.formError, /老人基本情况/)
      Object.entries(budgetSpec.complete).forEach(([questionId, expected]) => {
        assert.deepEqual(draftStore.getDraft().answers[questionId], expected)
        assert.deepEqual(runtimeState.storage[draftStorageKey].answers[questionId], expected)
      })
    },
  )

  runCase(
    'BUDGET_INVALID_DRAFT_ENVELOPE_GATE',
    'Budget Page must not navigate when completion validation rejects a damaged Draft without a locatable question ID',
    () => {
      const budgetSpec = pageSpecs.find((spec) => spec.step === 'budget')
      const page = preparePage(budgetSpec)
      seedAnswers(allPrerequisiteAnswers)
      applyInputs(page, pageInteractionSpecs.budget.completeInputs)

      const originalGetDraft = draftStore.getDraft.bind(draftStore)
      draftStore.getDraft = () => {
        const draft = originalGetDraft()
        draft.answers['unknown.question'] = 'damaged-answer'
        return draft
      }
      try {
        invokePageHandler(page, 'onNext')
      } finally {
        draftStore.getDraft = originalGetDraft
      }

      assert.equal(page.handlerCalls.onNext, 1)
      assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 0)
      assert.equal(runtimeState.scrollCalls.length, 0)
      assert.match(page.data.formError, /无法识别的答案/)
    },
  )

  runCase(
    'BUDGET_BOTTOM_GATE_FEEDBACK_STRUCTURE',
    'The runtime Budget global-gate error has a WXML outlet after save status and immediately before the footer action area',
    () => {
      const wxml = readText('miniprogram/pages/assessment/budget.wxml')
      const errorIndex = wxml.indexOf('form-error--footer')
      const statusIndex = wxml.indexOf('class="save-status"')
      const footerIndex = wxml.indexOf('<assessment-footer')
      assert.ok(errorIndex >= 0)
      assert.ok(statusIndex >= 0 && statusIndex < errorIndex)
      assert.ok(errorIndex < footerIndex)
      assert.equal((wxml.match(/class="form-error"/g) || []).length, 0)
      assert.equal((wxml.match(/class="form-error form-error--footer"/g) || []).length, 1)
    },
    'structural',
  )

  if (failures.length > 0) {
    console.error(`INTERACTIONS FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }

  console.log(`INTERACTIONS PASS: ${caseCounts.runtime} runtime behavior cases + ${caseCounts.structural} structural contract checks`)
}

try {
  await run()
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
