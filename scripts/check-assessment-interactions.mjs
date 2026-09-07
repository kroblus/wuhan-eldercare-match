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
  removeStorageCalls: 0,
  scrollCalls: [],
  setDataCalls: [],
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
  nextTick(callback) {
    callback()
  },
  pageScrollTo(options) {
    runtimeState.scrollCalls.push({ selector: options.selector, duration: options.duration })
  },
  navigateTo(options) {
    runtimeState.navigationCalls.push({ type: 'navigateTo', url: options.url, options })
    if (options.success) {
      options.success()
    }
    if (options.complete) {
      options.complete()
    }
  },
  navigateBack(options) {
    runtimeState.navigationCalls.push({ type: 'navigateBack', options })
  },
  redirectTo(options) {
    runtimeState.navigationCalls.push({ type: 'redirectTo', options })
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
    runtimeState.removeStorageCalls = 0
    runtimeState.scrollCalls.length = 0
    runtimeState.setDataCalls.length = 0
    runtimeState.pageStack = [
      { route: 'pages/assessment/intro' },
      { route: `pages/assessment/${step}` },
    ]
  }

  const preparePage = (spec) => {
    resetRuntime(spec.step)
    const page = mountPage(pageDefinitionsByStep[spec.step])
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

  const prepareIntroWithDraft = () => {
    resetRuntime('intro')
    seedAnswers({ 'basic.relationship': 'father' })
    runtimeState.navigationCalls.length = 0
    runtimeState.modalCalls.length = 0
    runtimeState.removeStorageCalls = 0
    runtimeState.pageStack = [
      { route: 'pages/home/index' },
      { route: 'pages/assessment/intro' },
    ]
    const page = mountPage(introDefinition)
    invokePageHandler(page, 'onShow')
    assert.equal(page.data.hasDraft, true, 'Intro must expose Continue and Restart for an incomplete Draft')
    return page
  }

  const prepareForCompleteNext = (spec, page) => {
    if (spec.step === 'budget') {
      seedAnswers(allPrerequisiteAnswers)
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

    const restoredPage = mountPage(pageDefinitionsByStep[spec.step])
    invokePageHandler(restoredPage, 'onShow')
    Object.entries(pageInteractionSpecs[spec.step].restore).forEach(([dataKey, expected]) => {
      assert.deepEqual(restoredPage.data[dataKey], expected, `page restore mismatch: ${spec.step}.${dataKey}`)
    })
    assert.ok(page, 'page handler was not mounted')
  }

  runCase(
    'RESTART-001_CONTINUE_EXISTING_DRAFT',
    'An incomplete Draft exists and the real Intro Continue handler is invoked once',
    () => {
      const introWxml = readText('miniprogram/pages/assessment/intro.wxml')
      const continueButton = introWxml.match(/<button[^>]*class="draft-continue"[^>]*>/)?.[0] || ''
      assert.match(continueButton, /bindtap="startAssessment"/)
      assert.doesNotMatch(continueButton, /\bdisabled\s*=/)

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
    'RESTART-002_CONFIRM_CLEAR_AND_START',
    'An incomplete Draft exists; Restart opens one valid confirmation, then confirmation clears the old Draft and navigates once',
    () => {
      const introWxml = readText('miniprogram/pages/assessment/intro.wxml')
      const restartButton = introWxml.match(/<button[^>]*class="restart-button"[^>]*>/)?.[0] || ''
      assert.match(restartButton, /bindtap="restartAssessment"/)
      assert.doesNotMatch(restartButton, /\bdisabled\s*=/)

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
      modal.complete({})

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
    'A V2 Draft with all earlier required answers complete resumes at the first missing V2 question step, independent of currentStep',
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
      runtimeState.pageStack = [
        { route: 'pages/home/index' },
        { route: 'pages/assessment/intro' },
      ]
      const page = mountPage(introDefinition)
      invokePageHandler(page, 'onShow')
      invokePageHandler(page, 'startAssessment')
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.url })),
        [{ type: 'navigateTo', url: '/pages/assessment/preference' }],
      )
      assert.equal(draftStore.getDraft().currentStep, 'budget')
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
      modal.complete({})

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
      modal.complete({})

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
    'A real NavigationBar instance uses navigateBack once for a normal stack and redirectTo once at the root, then emits one non-bubbling back event',
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
      navigationBar.back()
      assert.deepEqual(
        runtimeState.navigationCalls.map((call) => ({ type: call.type, url: call.options?.url })),
        [{ type: 'redirectTo', url: '/pages/assessment/intro' }],
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
    },
  )

  runCase(
    'NAVIGATION_BAR_ASSESSMENT_FALLBACKS',
    'Intro and all six Assessment step WXML mounts pass an explicit previous business route to NavigationBar',
    () => {
      Object.entries(navigationBarFallbacks).forEach(([step, fallbackUrl]) => {
        const wxml = readText(`miniprogram/pages/assessment/${step}.wxml`)
        const escapedUrl = fallbackUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        assert.match(
          wxml,
          new RegExp(`<navigation-bar[^>]*fallbackUrl="${escapedUrl}"`),
          `${step} must declare fallbackUrl`,
        )
      })
    },
    'structural',
  )

  for (const spec of pageSpecs) {
    const pageSource = readText(`miniprogram/pages/assessment/${spec.step}.ts`)
    const pageWxml = readText(`miniprogram/pages/assessment/${spec.step}.wxml`)
    const validator = assessmentV2[spec.validatorName]
    const interaction = pageInteractionSpecs[spec.step]
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
          runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').map((call) => call.url),
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
          runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').map((call) => call.url),
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
      'Two rapid calls to the real page onNext handler share one page instance while the first navigateTo remains guarded',
      () => {
        const page = preparePage(spec)
        prepareForCompleteNext(spec, page)
        invokePageHandler(page, 'onNext')
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onNext, 2)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
        assert.equal(runtimeState.scrollCalls.length, 0)

        invokePageHandler(page, 'onShow')
        invokePageHandler(page, 'onNext')
        assert.equal(page.handlerCalls.onShow, 2)
        assert.equal(page.handlerCalls.onNext, 3)
        assert.equal(runtimeState.navigationCalls.filter((call) => call.type === 'navigateTo').length, 2)
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
