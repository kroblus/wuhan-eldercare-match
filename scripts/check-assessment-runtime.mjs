import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

/**
 * Assessment input/domain runtime gate.
 *
 * This script deliberately transpiles and executes the current miniprogram
 * TypeScript source in memory. It does not use WeChat generated JavaScript,
 * stale files under tmp/, or write any cache/artifact.
 */

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const failures = []
let caseCount = 0

const assessmentSteps = ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']

const questionSpecs = [
  { id: 'basic.relationship', step: 'basic', type: 'single_choice', required: true, values: ['father', 'mother', 'paternal_grandfather', 'paternal_grandmother', 'maternal_grandfather', 'maternal_grandmother', 'spouse', 'self', 'other'] },
  { id: 'basic.elderName', step: 'basic', type: 'text', required: false },
  { id: 'basic.gender', step: 'basic', type: 'single_choice', required: true, values: ['male', 'female'] },
  { id: 'basic.age', step: 'basic', type: 'integer', required: true, min: 50, max: 110 },
  { id: 'basic.livingStatus', step: 'basic', type: 'single_choice', required: false, values: ['alone', 'with_spouse', 'with_children', 'with_other_relatives', 'hospitalized', 'in_eldercare_institution', 'other'] },
  { id: 'basic.primaryCaregiver', step: 'basic', type: 'single_choice', required: false, values: ['spouse', 'children', 'nanny', 'care_worker', 'community_care', 'no_fixed_caregiver', 'other'] },
  { id: 'basic.hasInstitutionExperience', step: 'basic', type: 'single_choice', required: false, values: ['true', 'false'] },
  { id: 'basic.institutionExitReasons', step: 'basic', type: 'multi_choice', required: false, values: ['poor_nursing', 'poor_service_attitude', 'high_cost', 'too_far', 'insufficient_medical_capability', 'unsatisfactory_environment', 'unsatisfactory_food', 'elder_not_adapted', 'other'], condition: { questionId: 'basic.hasInstitutionExperience', equals: 'true' } },
  { id: 'health.conditions', step: 'health', type: 'multi_choice', required: true, allowUnknown: true, values: ['hypertension', 'diabetes', 'coronary_heart_disease', 'stroke_sequelae', 'parkinson_disease', 'alzheimers_disease', 'other_cognitive_impairment', 'chronic_respiratory_disease', 'osteoarticular_disease', 'tumor', 'other_chronic_disease', 'none', 'unknown'] },
  { id: 'health.recentEvents', step: 'health', type: 'multi_choice', required: true, allowUnknown: true, values: ['fall_within_6_months', 'fracture_within_6_months', 'frequent_hospitalization_within_6_months', 'recently_discharged', 'postoperative_recovery', 'long_term_bedridden', 'pressure_injury', 'none', 'unknown'] },
  { id: 'health.rehabilitationNeed', step: 'health', type: 'single_choice', required: true, allowUnknown: true, values: ['definite', 'possible', 'none', 'unknown'] },
  { id: 'adl.eating', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'minor_assistance', 'needs_feeding', 'special_feeding', 'unknown'] },
  { id: 'adl.mobility', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'walking_aid', 'wheelchair', 'bedridden', 'unknown'] },
  { id: 'adl.toileting', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'occasional_assistance', 'frequent_incontinence', 'full_assistance', 'catheter_or_stoma', 'unknown'] },
  { id: 'adl.bathing', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'partial_assistance', 'full_assistance', 'unknown'] },
  { id: 'adl.dressing', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'partial_assistance', 'full_assistance', 'unknown'] },
  { id: 'adl.transfer', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'minor_assistance', 'needs_support', 'fully_dependent', 'unknown'] },
  { id: 'adl.stairs', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, values: ['independent', 'needs_assistance', 'unable', 'no_stairs', 'unknown'] },
  { id: 'cognitive.symptoms', step: 'cognitive', type: 'multi_choice', required: true, allowUnknown: true, values: ['memory_decline', 'repetitive_questioning', 'gets_lost', 'wandering_risk', 'sleep_wake_disorder', 'mood_instability', 'agitation', 'aggression', 'diagnosed_dementia', 'none', 'unknown'] },
  { id: 'cognitive.specialCareNeeds', step: 'cognitive', type: 'multi_choice', required: true, allowUnknown: true, values: ['round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit', 'rehabilitation_training', 'tube_feeding', 'catheter_care', 'pressure_injury_care', 'incontinence_care', 'other', 'none', 'unknown'] },
  { id: 'preference.careType', step: 'preference', type: 'single_choice', required: true, allowUnknown: true, values: ['active_aging', 'medical_nursing_integrated', 'disability_care', 'dementia_care', 'rehabilitation_care', 'unknown'] },
  { id: 'preference.priorities', step: 'preference', type: 'multi_choice', required: true, maxSelections: 3, values: ['medical_conditions', 'nursing_professionalism', 'caregiver_attitude', 'rehabilitation_capability', 'food_quality', 'living_environment', 'overall_quality', 'recreational_activities', 'close_to_family', 'transportation', 'price', 'dementia_care'] },
  { id: 'preference.region', step: 'preference', type: 'dynamic_single_choice', required: false },
  { id: 'budget.monthlyRange', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, values: ['cny_3500_5000', 'cny_5000_8000', 'cny_8000_12000', 'cny_12000_15000', 'cny_15000_plus', 'unknown'] },
  { id: 'budget.upfrontCostAcceptance', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, values: ['acceptable', 'depends_on_amount', 'avoid_high_one_time_fee', 'unknown'] },
  { id: 'budget.moveInTiming', step: 'budget', type: 'single_choice', required: true, values: ['as_soon_as_possible', 'within_1_month', 'within_1_to_3_months', 'after_3_months', 'research_only'] },
  { id: 'budget.consultantSupport', step: 'budget', type: 'single_choice', required: true, values: ['request_contact', 'recommendation_first'] },
]

const questionIds = questionSpecs.map(({ id }) => id)
const requiredQuestionIds = questionSpecs.filter(({ required }) => required).map(({ id }) => id)
const v2HealthAdditionalOptionSpecs = {
  chewingOptions: ['normal', 'easy_chew', 'modified_food', 'unknown'],
  swallowingOptions: ['normal', 'occasional_difficulty', 'significant_difficulty', 'unknown'],
}
const v2PriorityOptions = [
  'care_capability',
  'caregiver_quality',
  'medical_conditions',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'room_facilities',
  'activity_space',
  'transportation',
  'near_major_hospital',
  'price',
  'region',
]

const pageOptionSpecs = {
  basic: {
    relationshipOptions: questionSpecs[0].values,
    genderOptions: questionSpecs[2].values,
    livingStatusOptions: questionSpecs[4].values,
    caregiverOptions: questionSpecs[5].values,
    experienceOptions: questionSpecs[6].values,
    exitReasonOptions: questionSpecs[7].values,
  },
  health: {
    conditionsOptions: questionSpecs[8].values,
    recentEventOptions: questionSpecs[9].values,
    rehabilitationOptions: questionSpecs[10].values,
    chewingOptions: v2HealthAdditionalOptionSpecs.chewingOptions,
    swallowingOptions: v2HealthAdditionalOptionSpecs.swallowingOptions,
  },
  adl: {
    eatingOptions: questionSpecs[11].values,
    mobilityOptions: questionSpecs[12].values,
    toiletingOptions: questionSpecs[13].values,
    bathingOptions: questionSpecs[14].values,
    dressingOptions: questionSpecs[15].values,
    transferOptions: questionSpecs[16].values,
    stairsOptions: questionSpecs[17].values,
  },
  cognitive: {
    symptomsOptions: questionSpecs[18].values,
    specialCareNeedsOptions: questionSpecs[19].values,
  },
  preference: {
    careTypeOptions: questionSpecs[20].values,
    priorityOptions: v2PriorityOptions,
  },
  budget: {
    monthlyRangeOptions: questionSpecs[23].values,
    upfrontCostOptions: questionSpecs[24].values,
    moveInTimingOptions: questionSpecs[25].values,
    consultantSupportOptions: questionSpecs[26].values,
  },
}

const completeAnswers = {
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
  'budget.monthlyRange': 'unknown',
  'budget.upfrontCostAcceptance': 'unknown',
  'budget.moveInTiming': 'research_only',
  'budget.consultantSupport': 'recommendation_first',
}

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const runtime = {
  storage: Object.create(null),
  pageStack: [],
  navigationCalls: [],
  scrollCalls: [],
}

const loadedSourcePaths = new Set()
const previousGlobals = {
  wx: globalThis.wx,
  Page: globalThis.Page,
  Component: globalThis.Component,
  getCurrentPages: globalThis.getCurrentPages,
}

const detail = (value) => ({ detail: value })

const resetNavigationRuntime = () => {
  runtime.navigationCalls.length = 0
  runtime.scrollCalls.length = 0
  runtime.pageStack = [{ route: 'pages/assessment/intro' }, { route: 'pages/assessment/basic' }]
}

globalThis.getCurrentPages = () => runtime.pageStack
globalThis.wx = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(runtime.storage, key) ? clone(runtime.storage[key]) : ''
  },
  setStorageSync(key, value) {
    runtime.storage[key] = clone(value)
  },
  removeStorageSync(key) {
    delete runtime.storage[key]
  },
  nextTick(callback) {
    callback()
  },
  pageScrollTo(options) {
    runtime.scrollCalls.push({ selector: options.selector, duration: options.duration })
  },
  navigateTo(options) {
    runtime.navigationCalls.push({ type: 'navigateTo', url: options.url })
    if (options.success) {
      options.success({})
    }
    if (options.complete) {
      options.complete({})
    }
  },
  navigateBack(options) {
    runtime.navigationCalls.push({ type: 'navigateBack', delta: options?.delta })
  },
  redirectTo(options) {
    runtime.navigationCalls.push({ type: 'redirectTo', url: options.url })
  },
}

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    return { parser: require(parserPath), parserPath }
  }

  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch {
    // The repository intentionally does not add TypeScript as a runtime dependency.
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
    for (const runtimePackage of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtimePackage.name, 'lib', 'typescript.js')
      if (runtimePackage.isDirectory() && existsSync(parserPath)) {
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

const createSourceLoader = (typescript) => {
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
      throw new Error(`Formal runtime must not load tmp artifact: ${resolvedPath}`)
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
      }).outputText
      : source

    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        return require(request)
      }
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }

  return loadModule
}

const mountPage = (definition) => {
  const page = {
    data: clone(definition.data || {}),
    setData(updates, callback) {
      Object.assign(this.data, updates)
      if (callback) {
        callback()
      }
    },
  }
  Object.entries(definition).forEach(([name, handler]) => {
    if (typeof handler === 'function') {
      page[name] = handler.bind(page)
    }
  })
  return page
}

const runCase = async (name, callback) => {
  caseCount += 1
  try {
    await callback()
    console.log(`PASS ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${name}: ${message}`)
    console.error(`FAIL ${name}: ${message}`)
  }
}

const run = async () => {
  const { parser, parserPath } = await getTypeScriptParser()
  const loadModule = createSourceLoader(parser)
  const assessment = loadModule(path.join(miniprogramRoot, 'types', 'assessment.ts'))
  const assessmentV2 = loadModule(path.join(miniprogramRoot, 'types', 'assessment-v2.ts'))
  const draftModule = loadModule(path.join(miniprogramRoot, 'store', 'assessment-draft.ts'))
  const regionCatalogModule = loadModule(path.join(miniprogramRoot, 'services', 'institution-region-catalog.ts'))
  const pageDefinitions = {}

  for (const step of assessmentSteps) {
    let definition
    globalThis.Page = (registeredDefinition) => {
      definition = registeredDefinition
      return registeredDefinition
    }
    loadModule(path.join(miniprogramRoot, 'pages', 'assessment', `${step}.ts`))
    assert.ok(definition, `${step} page did not register from current TypeScript source`)
    pageDefinitions[step] = definition
  }

  const draftStore = draftModule.assessmentDraftStore

  const resetDraft = (step = 'basic') => {
    const result = draftStore.clear()
    assert.equal(result.persistence.ok, true, 'runtime Draft reset failed')
    resetNavigationRuntime()
    runtime.pageStack = [{ route: 'pages/assessment/intro' }, { route: `pages/assessment/${step}` }]
  }

  const restoreDraft = () => {
    const restoredStore = new draftModule.AssessmentDraftStore()
    assert.deepEqual(restoredStore.getDraft().answers, draftStore.getDraft().answers, 'new Draft store did not recover local answers')
    assert.equal(restoredStore.getDraft().kind, 'assessment_draft')
    assert.equal(restoredStore.getDraft().persistence, 'LOCAL_DEVICE_DEVELOPMENT_ONLY')
    return restoredStore
  }

  console.log(`PARSER: TypeScript ${parser.version || 'unknown'} (${parserPath})`)

  await runCase('CONTRACT_QUESTION_REGISTRY', () => {
    const definitions = assessment.ASSESSMENT_QUESTION_DEFINITIONS
    assert.deepEqual(Object.keys(definitions), questionIds, 'question ID registry changed')
    questionSpecs.forEach((spec) => {
      const definition = definitions[spec.id]
      assert.equal(definition.id, spec.id)
      assert.equal(definition.step, spec.step)
      assert.equal(definition.type, spec.type)
      assert.equal(definition.required, spec.required)
      assert.equal(definition.allowUnknown, spec.allowUnknown)
      if (spec.values) {
        assert.deepEqual(definition.allowedValues, spec.values, `${spec.id} allowed values changed`)
      } else {
        assert.equal(definition.allowedValues, undefined, `${spec.id} must not invent choice values`)
      }
      if (spec.min !== undefined || spec.max !== undefined) {
        assert.equal(definition.min, spec.min)
        assert.equal(definition.max, spec.max)
      }
      if (spec.maxSelections !== undefined) {
        assert.equal(definition.maxSelections, spec.maxSelections)
      }
      if (spec.condition) {
        assert.deepEqual(definition.condition, spec.condition)
      }
    })
    assert.deepEqual(
      assessment.REQUIRED_ASSESSMENT_QUESTION_ORDER,
      requiredQuestionIds,
      'required completion order changed',
    )
    assert.equal(requiredQuestionIds.length, 21)
    assert.deepEqual(
      questionSpecs.filter(({ required }) => !required).map(({ id }) => id),
      ['basic.elderName', 'basic.livingStatus', 'basic.primaryCaregiver', 'basic.hasInstitutionExperience', 'basic.institutionExitReasons', 'preference.region'],
    )
  })

  await runCase('PAGE_OPTION_CODES_MATCH_CONTRACT', () => {
    Object.entries(pageOptionSpecs).forEach(([step, fields]) => {
      Object.entries(fields).forEach(([field, expectedValues]) => {
        const actualOptions = pageDefinitions[step].data[field]
        assert.ok(Array.isArray(actualOptions), `${step}.${field} is not an option array`)
        assert.deepEqual(actualOptions.map((option) => option.value), expectedValues, `${step}.${field} code order changed`)
        actualOptions.forEach((option) => assert.equal(typeof option.label, 'string'))
      })
    })
  })

  await runCase('VALIDATORS_AND_ANSWER_TYPES', () => {
    const validators = {
      basic: assessment.validateBasicAnswers,
      health: assessment.validateHealthAnswers,
      adl: assessment.validateAdlAnswers,
      cognitive: assessment.validateCognitiveAnswers,
      preference: assessment.validatePreferenceAnswers,
      budget: assessment.validateBudgetAnswers,
    }
    const firstQuestionByStep = Object.fromEntries(
      assessmentSteps.map((step) => [step, requiredQuestionIds.find((questionId) => questionId.startsWith(`${step}.`))]),
    )
    assessmentSteps.forEach((step) => {
      const emptyResult = validators[step]({})
      assert.equal(emptyResult.valid, false, `${step} empty input must be invalid`)
      assert.equal(emptyResult.firstErrorQuestionId, firstQuestionByStep[step])
      const stepRequiredCount = requiredQuestionIds.filter((questionId) => questionId.startsWith(`${step}.`)).length
      assert.equal(Object.keys(emptyResult.errors).length, stepRequiredCount)
    })
    assert.equal(assessment.validateBasicAnswers(completeAnswers).valid, true)
    assert.equal(assessment.validateHealthAnswers(completeAnswers).valid, true)
    assert.equal(assessment.validateAdlAnswers(completeAnswers).valid, true)
    assert.equal(assessment.validateCognitiveAnswers(completeAnswers).valid, true)
    assert.equal(assessment.validatePreferenceAnswers(completeAnswers).valid, true)
    assert.equal(assessment.validateBudgetAnswers(completeAnswers).valid, true)

    assert.equal(assessment.isValidAnswerForQuestion('basic.elderName', '  '), false)
    assert.equal(assessment.isValidAnswerForQuestion('basic.elderName', '王叔叔'), true)
    assert.equal(assessment.isValidAnswerForQuestion('basic.age', 50), true)
    assert.equal(assessment.isValidAnswerForQuestion('basic.age', 110), true)
    assert.equal(assessment.isValidAnswerForQuestion('basic.age', 49), false)
    assert.equal(assessment.isValidAnswerForQuestion('basic.age', 111), false)
    assert.equal(assessment.isValidAnswerForQuestion('basic.age', 72.5), false)
  })

  await runCase('BASIC_PAGE_INPUT_AND_CONDITION_CLEANUP', () => {
    resetDraft('basic')
    const page = mountPage(pageDefinitions.basic)
    page.syncFromDraft()

    page.onNameInput(detail({ value: '  ' }))
    assert.equal(draftStore.getAnswer('basic.elderName'), undefined)
    page.onNameInput(detail({ value: '  王叔叔  ' }))
    assert.equal(draftStore.getAnswer('basic.elderName'), '  王叔叔  ')
    page.onRelationshipChange(detail({ value: 'father' }))
    page.onGenderChange(detail({ value: 'male' }))
    page.onAgeInput(detail({ value: '49' }))
    assert.equal(draftStore.getAnswer('basic.age'), undefined)
    page.onAgeInput(detail({ value: '50' }))
    page.onAgeInput(detail({ value: '110' }))
    assert.equal(draftStore.getAnswer('basic.age'), 110)
    page.onLivingStatusChange(detail({ value: 'alone' }))
    page.onCaregiverChange(detail({ value: 'children' }))
    page.onExperienceChange(detail({ value: 'true' }))
    page.onExitReasonChange(detail({ values: ['poor_nursing', 'too_far'] }))
    assert.deepEqual(draftStore.getAnswer('basic.institutionExitReasons'), ['poor_nursing', 'too_far'])
    page.onExperienceChange(detail({ value: 'false' }))
    assert.equal(draftStore.getAnswer('basic.hasInstitutionExperience'), 'false')
    assert.equal(draftStore.getAnswer('basic.institutionExitReasons'), undefined)
    assert.deepEqual(page.data.institutionExitReasons, [])

    const restoredStore = restoreDraft()
    assert.equal(restoredStore.getAnswer('basic.elderName'), '  王叔叔  ')
    assert.equal(restoredStore.getAnswer('basic.age'), 110)
    assert.equal(restoredStore.getAnswer('basic.hasInstitutionExperience'), 'false')
    assert.equal(restoredStore.getAnswer('basic.institutionExitReasons'), undefined)
    const restoredPage = mountPage(pageDefinitions.basic)
    restoredPage.syncFromDraft()
    assert.equal(restoredPage.data.elderName, '  王叔叔  ')
    assert.equal(restoredPage.data.ageInput, '110')
    assert.deepEqual(restoredPage.data.institutionExitReasons, [])
  })

  await runCase('HEALTH_EXCLUSIVITY_AND_DRAFT_RECOVERY', () => {
    resetDraft('health')
    const page = mountPage(pageDefinitions.health)
    page.syncFromDraft()

    page.onConditionsChange(detail({ values: ['hypertension', 'none'] }))
    assert.deepEqual(page.data.conditions, ['none'])
    assert.deepEqual(draftStore.getAnswer('health.conditions'), ['none'])
    page.onConditionsChange(detail({ values: ['none', 'diabetes'] }))
    assert.deepEqual(draftStore.getAnswer('health.conditions'), ['diabetes'])
    page.onConditionsChange(detail({ values: ['diabetes', 'unknown'] }))
    assert.deepEqual(draftStore.getAnswer('health.conditions'), ['unknown'])
    page.onRecentEventsChange(detail({ values: ['pressure_injury', 'unknown'] }))
    assert.deepEqual(draftStore.getAnswer('health.recentEvents'), ['unknown'])
    page.onRecentEventsChange(detail({ values: ['unknown', 'recently_discharged'] }))
    assert.deepEqual(draftStore.getAnswer('health.recentEvents'), ['recently_discharged'])
    page.onRehabilitationNeedChange(detail({ value: 'possible' }))
    page.onChewingAbilityChange(detail({ value: 'easy_chew' }))
    page.onSwallowingAbilityChange(detail({ value: 'unknown' }))

    assert.deepEqual(
      assessment.normalizeMultiChoiceValue('health.conditions', ['diabetes', 'diabetes']),
      ['diabetes'],
    )
    assert.equal(assessment.isValidAnswerForQuestion('health.conditions', ['none', 'diabetes']), false)
    const invalidMutation = draftStore.setAnswer('health.conditions', ['not-a-contract-code'])
    assert.equal(invalidMutation.persistence.ok, false)
    assert.deepEqual(draftStore.getAnswer('health.conditions'), ['unknown'])

    const restored = restoreDraft()
    assert.deepEqual(restored.getAnswer('health.conditions'), ['unknown'])
    assert.deepEqual(restored.getAnswer('health.recentEvents'), ['recently_discharged'])
    assert.equal(restored.getAnswer('health.rehabilitationNeed'), 'possible')
    assert.equal(restored.getAnswer('health.chewingAbility'), 'easy_chew')
    assert.equal(restored.getAnswer('health.swallowingAbility'), 'unknown')
    const restoredPage = mountPage(pageDefinitions.health)
    restoredPage.syncFromDraft()
    assert.deepEqual(restoredPage.data.conditions, ['unknown'])
    assert.deepEqual(restoredPage.data.recentEvents, ['recently_discharged'])
    assert.equal(restoredPage.data.rehabilitationNeed, 'possible')
    assert.equal(restoredPage.data.chewingAbility, 'easy_chew')
    assert.equal(restoredPage.data.swallowingAbility, 'unknown')
  })

  await runCase('ADL_RAW_ANSWERS_ONLY_AND_RECOVERY', () => {
    resetDraft('adl')
    const page = mountPage(pageDefinitions.adl)
    page.syncFromDraft()
    page.onEatingChange(detail({ value: 'special_feeding' }))
    page.onMobilityChange(detail({ value: 'wheelchair' }))
    page.onToiletingChange(detail({ value: 'catheter_or_stoma' }))
    page.onBathingChange(detail({ value: 'partial_assistance' }))
    page.onDressingChange(detail({ value: 'full_assistance' }))
    page.onTransferChange(detail({ value: 'needs_support' }))
    page.onStairsChange(detail({ value: 'no_stairs' }))

    const answers = draftStore.getDraft().answers
    assert.equal(answers['adl.eating'], 'special_feeding')
    assert.equal(answers['adl.mobility'], 'wheelchair')
    assert.equal(answers['adl.toileting'], 'catheter_or_stoma')
    assert.equal(answers['adl.bathing'], 'partial_assistance')
    assert.equal(answers['adl.dressing'], 'full_assistance')
    assert.equal(answers['adl.transfer'], 'needs_support')
    assert.equal(answers['adl.stairs'], 'no_stairs')
    assert.equal('adl.score' in answers, false)
    assert.equal('adl.careLevel' in answers, false)
    assert.equal(assessment.validateAdlAnswers(answers).valid, true)

    const restored = restoreDraft()
    assert.equal(restored.getAnswer('adl.eating'), 'special_feeding')
    assert.equal(restored.getAnswer('adl.toileting'), 'catheter_or_stoma')
    const restoredPage = mountPage(pageDefinitions.adl)
    restoredPage.syncFromDraft()
    assert.equal(restoredPage.data.eating, 'special_feeding')
    assert.equal(restoredPage.data.stairs, 'no_stairs')
    assert.equal('adl.score' in restored.getDraft().answers, false)
  })

  await runCase('COGNITIVE_EXCLUSIVITY_AND_RECOVERY', () => {
    resetDraft('cognitive')
    const page = mountPage(pageDefinitions.cognitive)
    page.syncFromDraft()
    page.onSymptomsChange(detail({ values: ['memory_decline', 'none'] }))
    assert.deepEqual(page.data.symptoms, ['none'])
    page.onSymptomsChange(detail({ values: ['none', 'wandering_risk'] }))
    assert.deepEqual(page.data.symptoms, ['wandering_risk'])
    page.onSymptomsChange(detail({ values: ['wandering_risk', 'unknown'] }))
    assert.deepEqual(page.data.symptoms, ['unknown'])
    page.onSpecialCareNeedsChange(detail({ values: ['tube_feeding', 'none'] }))
    assert.deepEqual(page.data.specialCareNeeds, ['none'])
    page.onSpecialCareNeedsChange(detail({ values: ['none', 'night_care'] }))
    assert.deepEqual(page.data.specialCareNeeds, ['night_care'])
    page.onSpecialCareNeedsChange(detail({ values: ['night_care', 'tube_feeding'] }))
    assert.deepEqual(page.data.specialCareNeeds, ['night_care', 'tube_feeding'])
    assert.deepEqual(draftStore.getAnswer('cognitive.symptoms'), ['unknown'])
    assert.deepEqual(draftStore.getAnswer('cognitive.specialCareNeeds'), ['night_care', 'tube_feeding'])
    assert.equal(assessment.isValidAnswerForQuestion('cognitive.symptoms', ['unknown', 'gets_lost']), false)
    assert.equal(assessment.validateCognitiveAnswers(draftStore.getDraft().answers).valid, true)

    const restored = restoreDraft()
    assert.deepEqual(restored.getAnswer('cognitive.symptoms'), ['unknown'])
    assert.deepEqual(restored.getAnswer('cognitive.specialCareNeeds'), ['night_care', 'tube_feeding'])
    const restoredPage = mountPage(pageDefinitions.cognitive)
    restoredPage.syncFromDraft()
    assert.deepEqual(restoredPage.data.symptoms, ['unknown'])
    assert.deepEqual(restoredPage.data.specialCareNeeds, ['night_care', 'tube_feeding'])
  })

  await runCase('PREFERENCE_MAX3_REGION_NO_PREFERENCE', () => {
    resetDraft('preference')
    const page = mountPage(pageDefinitions.preference)
    page.syncFromDraft()
    page.onCareTypeChange(detail({ value: 'unknown' }))
    page.onRoomTypeChange(detail({ value: 'double' }))
    page.onMealScheduleChange(detail({ value: 'three_meals_one_snack' }))
    page.onActivityPreferenceChange(detail({ value: 'indoor_and_outdoor' }))
    page.onPrioritiesChange(detail({ values: ['price', 'transportation', 'food_quality', 'care_capability'] }))
    assert.deepEqual(page.data.priorities, ['price', 'transportation', 'food_quality'])
    assert.deepEqual(draftStore.getAnswer('preference.priorities'), ['price', 'transportation', 'food_quality'])
    assert.equal(page.data.priorityLimitMessage, '最多选择 3 项')
    const tooMany = draftStore.setAnswer('preference.priorities', ['price', 'transportation', 'food_quality', 'care_capability'])
    assert.equal(tooMany.persistence.ok, false)
    assert.deepEqual(draftStore.getAnswer('preference.priorities'), ['price', 'transportation', 'food_quality'])

    const verifiedCatalog = regionCatalogModule.buildInstitutionRegionCatalog([
      { dataProvenance: 'VERIFIED', regionCode: 'jianghan', regionDisplayName: '江汉区' },
      { dataProvenance: 'VERIFIED', regionCode: 'jiangan', regionDisplayName: '江岸区' },
      { dataProvenance: 'MOCK_DEVELOPMENT_ONLY', regionCode: 'mock', regionDisplayName: 'Mock 区' },
    ])
    assert.equal(verifiedCatalog.ok, true)
    assert.deepEqual(verifiedCatalog.catalog.options, [
      { value: 'jiangan', label: '江岸区' },
      { value: 'jianghan', label: '江汉区' },
    ])
    assert.deepEqual(regionCatalogModule.buildInstitutionRegionCatalog([
      { dataProvenance: 'VERIFIED', regionCode: 'jianghan', regionDisplayName: '江汉区' },
      { dataProvenance: 'VERIFIED', regionCode: 'jianghan', regionDisplayName: '汉阳区' },
    ]), { ok: false, reason: 'conflicting_label', regionCode: 'jianghan' })

    page.setData({
      regionCatalogStatus: 'empty',
      regionCatalogVersion: 'institution-region-catalog-v1-empty',
      regionOptions: [{ value: 'no_preference', label: '不限制' }],
    })
    page.onRegionChange(detail({ value: 'no_preference' }))
    const regionAnswer = draftStore.getAnswer('preference.region')
    assert.deepEqual(regionAnswer, {
      kind: 'no_preference',
      regionCode: 'no_preference',
      regionLabelSnapshot: '不限制',
      catalogVersion: 'institution-region-catalog-v1-empty',
    })
    assert.equal(assessment.isValidAnswerForQuestion('preference.region', regionAnswer), true)
    assert.equal(assessment.isValidAnswerForQuestion('preference.region', {
      kind: 'institution_region',
      regionCode: 'no_preference',
      regionLabelSnapshot: '不限制',
      catalogVersion: 'v1',
    }), false)

    const restored = restoreDraft()
    assert.deepEqual(restored.getAnswer('preference.region'), regionAnswer)
    assert.equal(assessment.validatePreferenceAnswers(restored.getDraft().answers).valid, true)
    const restoredPage = mountPage(pageDefinitions.preference)
    restoredPage.syncFromDraft()
    assert.equal(restoredPage.data.regionCode, 'no_preference')
    assert.equal(restoredPage.data.roomType, 'double')
    assert.equal(restoredPage.data.mealSchedule, 'three_meals_one_snack')
    assert.equal(restoredPage.data.activityPreference, 'indoor_and_outdoor')
  })

  await runCase('BUDGET_INPUT_AND_DRAFT_RECOVERY', () => {
    resetDraft('budget')
    const page = mountPage(pageDefinitions.budget)
    page.syncFromDraft()
    page.onMonthlyRangeChange(detail({ value: 'cny_5000_8000' }))
    page.onUpfrontCostChange(detail({ value: 'depends_on_amount' }))
    page.onMoveInTimingChange(detail({ value: 'within_1_to_3_months' }))
    page.onConsultantSupportChange(detail({ value: 'request_contact' }))
    assert.equal(assessment.validateBudgetAnswers(draftStore.getDraft().answers).valid, true)
    const restored = restoreDraft()
    assert.equal(restored.getAnswer('budget.monthlyRange'), 'cny_5000_8000')
    assert.equal(restored.getAnswer('budget.upfrontCostAcceptance'), 'depends_on_amount')
    assert.equal(restored.getAnswer('budget.moveInTiming'), 'within_1_to_3_months')
    assert.equal(restored.getAnswer('budget.consultantSupport'), 'request_contact')
    const restoredPage = mountPage(pageDefinitions.budget)
    restoredPage.syncFromDraft()
    assert.equal(restoredPage.data.monthlyRange, 'cny_5000_8000')
    assert.equal(restoredPage.data.consultantSupport, 'request_contact')
  })

  await runCase('SIX_STEP_COMPLETION_GATE', () => {
    const validResult = assessment.validateAssessmentDraftForCompletion(clone(completeAnswers))
    assert.equal(validResult.valid, true)
    assert.deepEqual(validResult.invalidQuestionIds, [])
    assert.equal(validResult.firstInvalidQuestionId, undefined)

    requiredQuestionIds.forEach((questionId) => {
      const answers = clone(completeAnswers)
      delete answers[questionId]
      const result = assessment.validateAssessmentDraftForCompletion(answers)
      assert.equal(result.valid, false, `${questionId} missing must block completion`)
      assert.equal(result.firstInvalidQuestionId, questionId)
      assert.deepEqual(result.invalidQuestionIds, [questionId])
    })

    const invalidAnswers = clone(completeAnswers)
    invalidAnswers['basic.age'] = 111
    const invalidAgeResult = assessment.validateAssessmentDraftForCompletion(invalidAnswers)
    assert.equal(invalidAgeResult.valid, false)
    assert.deepEqual(invalidAgeResult.invalidQuestionIds, ['basic.age'])

    const regionOptionalAnswers = clone(completeAnswers)
    regionOptionalAnswers['preference.region'] = {
      kind: 'no_preference',
      regionCode: 'no_preference',
      regionLabelSnapshot: '不限制',
      catalogVersion: 'institution-region-catalog-v1-empty',
    }
    assert.equal(assessment.validateAssessmentDraftForCompletion(regionOptionalAnswers).valid, true)
    assert.equal(Object.prototype.hasOwnProperty.call(validResult, 'profile'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(validResult, 'recommendation'), false)

    const validV2Result = assessmentV2.validateAssessmentDraftForCompletionV2(clone(completeAnswers))
    assert.equal(validV2Result.valid, true)
    assert.deepEqual(validV2Result.invalidQuestionIds, [])
    assert.equal(validV2Result.firstInvalidQuestionId, undefined)

    assessmentV2.REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.forEach((questionId) => {
      const answers = clone(completeAnswers)
      delete answers[questionId]
      const result = assessmentV2.validateAssessmentDraftForCompletionV2(answers)
      assert.equal(result.valid, false, `${questionId} missing must block V2 completion`)
      assert.equal(result.firstInvalidQuestionId, questionId)
      assert.deepEqual(result.invalidQuestionIds, [questionId])
    })

    const invalidV2AgeAnswers = clone(completeAnswers)
    invalidV2AgeAnswers['basic.age'] = 111
    const invalidV2AgeResult = assessmentV2.validateAssessmentDraftForCompletionV2(invalidV2AgeAnswers)
    assert.equal(invalidV2AgeResult.valid, false)
    assert.deepEqual(invalidV2AgeResult.invalidQuestionIds, ['basic.age'])
  })

  await runCase('DRAFT_INVALID_STATE_AND_CONDITIONAL_RULES', () => {
    resetDraft('basic')
    const conditional = {
      'basic.hasInstitutionExperience': 'false',
      'basic.institutionExitReasons': ['poor_nursing'],
    }
    assert.deepEqual(assessment.applyAssessmentConditionalRules(conditional), {
      'basic.hasInstitutionExperience': 'false',
    })
    const beforeInvalid = draftStore.getDraft().answers
    const mutation = draftStore.setAnswer('health.conditions', ['invalid-code'])
    assert.equal(mutation.persistence.ok, false)
    assert.deepEqual(draftStore.getDraft().answers, beforeInvalid)
    assert.equal(draftStore.setCurrentStep('health').persistence.ok, true)
    assert.equal(draftStore.getDraft().currentStep, 'health')
    const restored = restoreDraft()
    assert.equal(restored.getDraft().currentStep, 'health')
    assert.deepEqual(restored.getDraft().answers, beforeInvalid)
  })

  await runCase('FORMAL_SCOPE_BOUNDARY', () => {
    const loadedSources = Array.from(loadedSourcePaths)
    assert.equal(loadedSources.some((sourcePath) => sourcePath.endsWith(`${path.sep}pages${path.sep}assessment${path.sep}profile.ts`)), false)
    assert.equal(loadedSources.some((sourcePath) => sourcePath.includes(`${path.sep}matching`)), false)
    assert.equal(loadedSources.some((sourcePath) => sourcePath.includes(`${path.sep}tmp${path.sep}`)), false)
  })

  if (failures.length > 0) {
    console.error(`ASSESSMENT RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`ASSESSMENT RUNTIME PASS: ${caseCount} source runtime cases`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`ASSESSMENT RUNTIME FAIL: ${message}`)
  process.exitCode = 1
} finally {
  if (previousGlobals.wx === undefined) {
    delete globalThis.wx
  } else {
    globalThis.wx = previousGlobals.wx
  }
  if (previousGlobals.Page === undefined) {
    delete globalThis.Page
  } else {
    globalThis.Page = previousGlobals.Page
  }
  if (previousGlobals.Component === undefined) {
    delete globalThis.Component
  } else {
    globalThis.Component = previousGlobals.Component
  }
  if (previousGlobals.getCurrentPages === undefined) {
    delete globalThis.getCurrentPages
  } else {
    globalThis.getCurrentPages = previousGlobals.getCurrentPages
  }
}
