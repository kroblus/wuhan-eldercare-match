import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { assessmentV2Fixtures, makeCompleteV2Answers, makeV2Draft } from './fixtures/assessment-v2-fixtures.mjs'
import { migrationFixtures, makeV1Draft } from './fixtures/assessment-migration-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const failures = []
let caseCount = 0
const v1PriorityManifest = [
  'medical_conditions',
  'nursing_professionalism',
  'caregiver_attitude',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'overall_quality',
  'recreational_activities',
  'close_to_family',
  'transportation',
  'price',
  'dementia_care',
]

const v2QuestionManifest = [
  'basic.relationship',
  'basic.elderName',
  'basic.gender',
  'basic.age',
  'basic.livingStatus',
  'basic.primaryCaregiver',
  'basic.hasInstitutionExperience',
  'basic.institutionExitReasons',
  'health.conditions',
  'health.recentEvents',
  'health.rehabilitationNeed',
  'health.chewingAbility',
  'health.swallowingAbility',
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.bathing',
  'adl.dressing',
  'adl.transfer',
  'adl.stairs',
  'cognitive.symptoms',
  'cognitive.specialCareNeeds',
  'preference.careType',
  'preference.roomType',
  'preference.mealSchedule',
  'preference.activityPreference',
  'preference.priorities',
  'preference.region',
  'budget.monthlyRange',
  'budget.upfrontCostAcceptance',
  'budget.moveInTiming',
  'budget.consultantSupport',
]

const v2FixtureManifest = Array.from({ length: 12 }, (_value, index) =>
  `V2-${String(index + 1).padStart(3, '0')}`,
)

const migrationFixtureManifest = Array.from({ length: 12 }, (_value, index) =>
  `MIGRATION-${String(index + 1).padStart(3, '0')}`,
)

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return { parser: require(path.resolve(explicitPath)), parserPath: path.resolve(explicitPath) }
  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch (_error) {
    // The project intentionally does not install a second TypeScript runtime.
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or open WeChat DevTools')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  const candidates = []
  if (existsSync(profileRoot)) {
    for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(runtimeRoot)) continue
      for (const runtime of await readdir(runtimeRoot, { withFileTypes: true })) {
        const parserPath = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(parserPath)) {
          candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
        }
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) throw new Error('WeChat DevTools TypeScript not found; open DevTools or set WECHAT_TYPESCRIPT_PATH')
  return { parser: require(candidates[0].parserPath), parserPath: candidates[0].parserPath }
}

const createSourceLoader = (typescript) => {
  const moduleCache = new Map()
  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [basePath, `${basePath}.ts`, `${basePath}.js`, `${basePath}.json`, path.join(basePath, 'index.ts'), path.join(basePath, 'index.js')]
    const resolved = candidates.find((candidate) => existsSync(candidate))
    if (!resolved) throw new Error(`Cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const loadModule = (filePath) => {
    const resolvedPath = path.resolve(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) return cached.exports
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    const source = readFileSync(resolvedPath, 'utf8')
    if (resolvedPath.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
      fileName: resolvedPath,
    })
    const localRequire = (request) => {
      if (!request.startsWith('.')) throw new Error(`Runtime forbids external import ${request}`)
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output.outputText}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
  return loadModule
}

const runtime = {
  storage: Object.create(null),
  failV2Write: false,
  invalidV2ReadBack: false,
  failPointerWrite: false,
}

const previousWx = globalThis.wx
globalThis.wx = {
  getStorageSync(key) {
    if (runtime.invalidV2ReadBack && key.endsWith('.v2')) return { broken: true }
    return Object.prototype.hasOwnProperty.call(runtime.storage, key) ? clone(runtime.storage[key]) : ''
  },
  setStorageSync(key, value) {
    if (runtime.failV2Write && key.endsWith('.v2')) throw new Error('simulated V2 write failure')
    if (runtime.failPointerWrite && key.endsWith('.active')) throw new Error('simulated active pointer failure')
    runtime.storage[key] = clone(value)
  },
  removeStorageSync(key) {
    delete runtime.storage[key]
  },
}

const runCase = (id, callback) => {
  caseCount += 1
  try {
    callback()
    console.log(`PASS ${id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${id}: ${message}`)
    console.error(`FAIL ${id}: ${message}`)
  }
}

const resetStorage = () => {
  runtime.storage = Object.create(null)
  runtime.failV2Write = false
  runtime.invalidV2ReadBack = false
  runtime.failPointerWrite = false
}

const run = async () => {
  const { parser, parserPath } = await getTypeScriptParser()
  const loadModule = createSourceLoader(parser)
  const v2 = loadModule(path.join(miniprogramRoot, 'types', 'assessment-v2.ts'))
  const migration = loadModule(path.join(miniprogramRoot, 'utils', 'assessment-migration.ts'))
  const resume = loadModule(path.join(miniprogramRoot, 'utils', 'assessment-resume.ts'))
  const storeModule = loadModule(path.join(miniprogramRoot, 'store', 'assessment-draft.ts'))

  console.log(`PARSER: TypeScript ${parser.version || 'unknown'} (${parserPath})`)

  runCase('V2-CONTRACT-001', () => {
    assert.deepEqual(Object.keys(v2.ASSESSMENT_QUESTION_DEFINITIONS_V2), v2QuestionManifest)
    assert.equal(v2.REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.length, 26)
    assert.equal(v2.OPTIONAL_ASSESSMENT_QUESTION_IDS_V2.length, 5)
    assert.deepEqual(v2.CONDITIONAL_OPTIONAL_ASSESSMENT_QUESTION_IDS_V2, ['basic.institutionExitReasons'])
    assert.equal(
      Object.values(v2.ASSESSMENT_QUESTION_DEFINITIONS_V2).filter((definition) => definition.required).length,
      26,
    )
    assert.equal(
      Object.values(v2.ASSESSMENT_QUESTION_DEFINITIONS_V2).filter((definition) => definition.condition).length,
      1,
    )
    assert.equal(v2.ASSESSMENT_SCHEMA_VERSION_V2, 2)
  })

  runCase('V2-FIXTURE-MANIFEST', () => {
    assert.deepEqual(assessmentV2Fixtures.map((fixture) => fixture.id), v2FixtureManifest)
  })

  runCase('MIGRATION-FIXTURE-MANIFEST', () => {
    assert.deepEqual(migrationFixtures.map((fixture) => fixture.id), migrationFixtureManifest)
  })

  assessmentV2Fixtures.forEach((fixture) => {
    runCase(fixture.id, () => {
      const result = v2.validateAssessmentDraftForCompletionV2(fixture.answers)
      assert.equal(result.valid, fixture.expectedValid, fixture.description)
    })
  })

  runCase('V2-VALIDATION-001', () => {
    const missing = makeCompleteV2Answers()
    delete missing['health.chewingAbility']
    delete missing['health.swallowingAbility']
    const result = v2.validateAssessmentDraftForCompletionV2(missing)
    assert.equal(result.firstInvalidQuestionId, 'health.chewingAbility')
    assert.deepEqual(result.invalidQuestionIds.slice(0, 2), ['health.chewingAbility', 'health.swallowingAbility'])
  })

  runCase('V2-VALIDATION-002', () => {
    const normalized = v2.normalizeMultiChoiceValueV2('health.conditions', ['hypertension', 'none'])
    assert.deepEqual(normalized, ['none'])
    assert.equal(v2.isValidAnswerForQuestionV2('health.conditions', normalized), true)
    assert.equal(v2.isValidAnswerForQuestionV2('health.conditions', ['none', 'diabetes']), false)
  })

  runCase('V2-VALIDATION-003-CONDITIONAL-ERROR-LOCATION', () => {
    const invalidConditional = makeCompleteV2Answers({
      'basic.hasInstitutionExperience': 'false',
      'basic.institutionExitReasons': ['too_far'],
    })
    const completion = v2.validateAssessmentDraftForCompletionV2(invalidConditional)
    assert.equal(completion.valid, false)
    assert.deepEqual(completion.invalidQuestionIds, ['basic.institutionExitReasons'])
    assert.equal(completion.firstInvalidQuestionId, 'basic.institutionExitReasons')
    assert.equal(completion.errorCodes['basic.institutionExitReasons'], 'INACTIVE_CONDITIONAL_ANSWER')
    assert.equal(v2.findFirstIncompleteAssessmentStepV2(invalidConditional), 'basic')
    const basicStep = v2.validateBasicAnswersV2(invalidConditional)
    assert.equal(basicStep.valid, false)
    assert.equal(basicStep.firstErrorQuestionId, 'basic.institutionExitReasons')
  })

  runCase('V2-VALIDATION-004-RETIRED-PRIORITY-REJECTED', () => {
    const result = v2.validateAssessmentDraftForCompletionV2(
      makeCompleteV2Answers({ 'preference.priorities': ['nursing_professionalism'] }),
    )
    assert.equal(result.valid, false)
    assert.equal(result.firstInvalidQuestionId, 'preference.priorities')
    assert.equal(result.errorCodes['preference.priorities'], 'INVALID_ANSWER')
  })

  runCase('V2-MIGRATION-NOTICE-INVARIANT', () => {
    const validNoticeDraft = makeV2Draft(
      { 'preference.priorities': undefined },
      {
        migrationNotice: {
          originalQuestionId: 'preference.priorities',
          originalOptionCodes: ['caregiver_attitude', 'price'],
          sourceSchemaVersion: 1,
          targetSchemaVersion: 2,
          reasonCode: 'PRIORITIES_REQUIRE_RESELECTION_V2',
        },
      },
    )
    assert.equal(v2.isAssessmentDraftV2(validNoticeDraft), true)
    const activeAnswerAndNotice = clone(validNoticeDraft)
    activeAnswerAndNotice.answers['preference.priorities'] = ['price']
    assert.equal(v2.isAssessmentDraftV2(activeAnswerAndNotice), false)
    const safeOnlyNotice = clone(validNoticeDraft)
    safeOnlyNotice.migrationNotice.originalOptionCodes = ['price']
    assert.equal(v2.isAssessmentDraftV2(safeOnlyNotice), false)
    const nonCanonicalNotice = clone(validNoticeDraft)
    nonCanonicalNotice.migrationNotice.originalOptionCodes = ['price', 'caregiver_attitude']
    assert.equal(v2.isAssessmentDraftV2(nonCanonicalNotice), false)
  })

  runCase('V2-RESUME-001', () => {
    const draft = makeV2Draft()
    delete draft.answers['health.chewingAbility']
    assert.deepEqual(resume.getAssessmentResumeDestinationV2(draft), {
      step: 'health',
      questionId: 'health.chewingAbility',
      route: '/pages/assessment/health',
    })
    draft.answers['health.chewingAbility'] = 'normal'
    delete draft.answers['preference.roomType']
    assert.deepEqual(resume.getAssessmentResumeDestinationV2(draft), {
      step: 'preference',
      questionId: 'preference.roomType',
      route: '/pages/assessment/preference',
    })
  })

  runCase('MIGRATION-RESUME-FIRST-INCOMPLETE', () => {
    const source = makeV1Draft(
      { 'preference.priorities': ['medical_conditions', 'price'] },
      { currentStep: 'budget' },
    )
    const migrated = migration.migrateAssessmentDraftV1ToV2(source)
    assert.equal(migrated.ok, true)
    if (!migrated.ok) return
    assert.equal(migrated.draft.currentStep, 'budget', 'currentStep remains historical data')
    assert.deepEqual(resume.getAssessmentResumeDestinationV2(migrated.draft), {
      step: 'health',
      questionId: 'health.chewingAbility',
      route: '/pages/assessment/health',
    })
    migrated.draft.answers['health.chewingAbility'] = 'normal'
    migrated.draft.answers['health.swallowingAbility'] = 'normal'
    assert.deepEqual(resume.getAssessmentResumeDestinationV2(migrated.draft), {
      step: 'preference',
      questionId: 'preference.roomType',
      route: '/pages/assessment/preference',
    })
  })

  migrationFixtures.slice(0, 10).forEach((fixture) => {
    runCase(fixture.id, () => {
      const source = clone(fixture.input)
      const before = clone(source)
      const result = migration.migrateAssessmentDraftV1ToV2(source)
      assert.deepEqual(source, before, 'V1 source must not mutate')
      if (fixture.expected === 'invalid_source') {
        assert.deepEqual(result, { ok: false, code: 'INVALID_SOURCE_DRAFT' })
        return
      }
      if (fixture.expected === 'unsupported_schema') {
        assert.deepEqual(result, { ok: false, code: 'UNSUPPORTED_SOURCE_SCHEMA_VERSION' })
        return
      }
      if (fixture.expected === 'completed_forbidden') {
        assert.deepEqual(result, { ok: false, code: 'COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN' })
        return
      }
      assert.equal(result.ok, true)
      if (!result.ok) return
      assert.equal(result.draft.schemaVersion, 2)
      assert.equal(result.draft.localDraftId, source.localDraftId)
      assert.equal(result.draft.startedAt, source.startedAt)
      assert.equal(result.draft.updatedAt, source.updatedAt)
      assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'health.chewingAbility'), false)
      assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'health.swallowingAbility'), false)
      assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'preference.roomType'), false)
      assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'preference.mealSchedule'), false)
      assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'preference.activityPreference'), false)
      if (fixture.expected === 'success_no_notice') {
        assert.equal(result.draft.migrationNotice, undefined)
        assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'preference.priorities'), false)
      }
      if (fixture.expected === 'success_safe_priorities') {
        assert.deepEqual(result.draft.answers['preference.priorities'], ['medical_conditions', 'price'])
        assert.equal(result.draft.migrationNotice, undefined)
        assert.equal(v2.getFirstIncompleteAssessmentQuestionIdV2(result.draft), 'health.chewingAbility')
      }
      if (fixture.expected === 'success_notice') {
        assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'preference.priorities'), false)
        assert.equal(result.draft.migrationNotice.reasonCode, 'PRIORITIES_REQUIRE_RESELECTION_V2')
        assert.deepEqual(
          result.draft.migrationNotice.originalOptionCodes,
          v1PriorityManifest.filter((code) => source.answers['preference.priorities'].includes(code)),
        )
      }
      if (fixture.expected === 'conditional_cleanup') {
        assert.equal(Object.prototype.hasOwnProperty.call(result.draft.answers, 'basic.institutionExitReasons'), false)
      }
      if (fixture.expected === 'deterministic') {
        assert.deepEqual(
          result,
          migration.migrateAssessmentDraftV1ToV2(clone(fixture.input)),
        )
      }
      if (fixture.expected === 'deep_clone') {
        assert.notStrictEqual(result.draft.answers['health.conditions'], source.answers['health.conditions'])
        assert.notStrictEqual(result.draft.answers['preference.region'], source.answers['preference.region'])
      }
    })
  })

  runCase('MIGRATION-010-NON-DRAFT', () => {
    assert.deepEqual(migration.migrateAssessmentDraftV1ToV2({ kind: 'other' }), { ok: false, code: 'SOURCE_NOT_ASSESSMENT_DRAFT' })
    assert.deepEqual(migration.migrateAssessmentDraftV1ToV2({ kind: 'assessment_draft', schemaVersion: 2 }), { ok: false, code: 'UNSUPPORTED_SOURCE_SCHEMA_VERSION' })
  })

  runCase('MIGRATION-PURITY-BOUNDARY', () => {
    const source = readFileSync(path.join(miniprogramRoot, 'utils', 'assessment-migration.ts'), 'utf8')
    assert.doesNotMatch(source, /\b(?:Date\.now|Math\.random)\s*\(|\bnew\s+Date\s*\(|\bwx\s*\./)
    assert.doesNotMatch(source, /elder-profile|recommendation/i)
    const result = migration.migrateAssessmentDraftV1ToV2(makeV1Draft())
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal('id' in result.draft, false)
    assert.equal('assessmentId' in result.draft, false)
    assert.equal('elderId' in result.draft, false)
    assert.equal('recommendationId' in result.draft, false)
    assert.equal('completedAt' in result.draft, false)
  })

  runCase('MIGRATION-011', () => {
    resetStorage()
    const source = makeV1Draft()
    const sourceBytes = JSON.stringify(source)
    runtime.storage[storeModule.assessmentDraftLegacyStorageKey] = clone(source)
    runtime.failV2Write = true
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.getLastMigrationResult().ok, true)
    assert.equal(store.getLastPersistenceResult().ok, false)
    assert.equal(JSON.stringify(runtime.storage[storeModule.assessmentDraftLegacyStorageKey]), sourceBytes)
    assert.equal(runtime.storage[storeModule.assessmentDraftStorageKey], undefined)
    assert.equal(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v1')
  })

  runCase('MIGRATION-012', () => {
    resetStorage()
    const source = makeV1Draft({ 'preference.priorities': ['price', 'medical_conditions'] })
    runtime.storage[storeModule.assessmentDraftLegacyStorageKey] = clone(source)
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.getLastMigrationResult().ok, true)
    assert.equal(store.getLastPersistenceResult().ok, true)
    assert.equal(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v2')
    assert.deepEqual(runtime.storage[storeModule.assessmentDraftStorageKey], store.getDraft())
    assert.deepEqual(runtime.storage[storeModule.assessmentDraftLegacyStorageKey], source)
  })

  runCase('PERSIST-MIGRATION-001-V2-WRITE-FAIL', () => {
    resetStorage()
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = makeV1Draft()
    runtime.failV2Write = true
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.getLastMigrationResult().ok, true)
    assert.deepEqual(store.getLastPersistenceResult(), { ok: false, status: 'failed', reason: 'write_failed' })
    assert.deepEqual(runtime.storage[legacyKey], makeV1Draft())
    assert.equal(runtime.storage[storeModule.assessmentDraftStorageKey], undefined)
    assert.equal(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v1')
    assert.equal(store.getDraft().schemaVersion, 2)
  })

  runCase('PERSIST-MIGRATION-002-READBACK-FAIL', () => {
    resetStorage()
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = makeV1Draft()
    runtime.invalidV2ReadBack = true
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.getLastMigrationResult().ok, true)
    assert.deepEqual(store.getLastPersistenceResult(), { ok: false, status: 'failed', reason: 'read_back_invalid' })
    assert.deepEqual(runtime.storage[legacyKey], makeV1Draft())
    assert.equal(runtime.storage[storeModule.assessmentDraftStorageKey], undefined)
    assert.equal(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v1')
    assert.equal(store.getDraft().schemaVersion, 2)
  })

  runCase('PERSIST-MIGRATION-003-SUCCESS', () => {
    resetStorage()
    const source = makeV1Draft({ 'preference.priorities': ['price', 'medical_conditions'] })
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = clone(source)
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.getLastMigrationResult().ok, true)
    assert.equal(store.getDraft().schemaVersion, 2)
    assert.equal(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v2')
    assert.deepEqual(runtime.storage[legacyKey], source)
  })

  runCase('PERSIST-MIGRATION-004-RELAUNCH', () => {
    resetStorage()
    const source = makeV1Draft({ 'preference.priorities': ['price', 'medical_conditions'] })
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = clone(source)
    const migrated = new storeModule.AssessmentDraftStore()
    const restored = new storeModule.AssessmentDraftStore()
    assert.deepEqual(restored.getDraft(), migrated.getDraft())
    assert.equal(restored.getDraft().localDraftId, source.localDraftId)
    assert.deepEqual(restored.getDraft().answers['preference.priorities'], ['medical_conditions', 'price'])
  })

  runCase('PERSIST-MIGRATION-005-ACTIVE-POINTER-FAIL', () => {
    resetStorage()
    const source = makeV1Draft()
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = clone(source)
    runtime.failPointerWrite = true
    const store = new storeModule.AssessmentDraftStore()
    assert.deepEqual(store.getLastPersistenceResult(), { ok: false, status: 'failed', reason: 'active_pointer_failed' })
    assert.deepEqual(runtime.storage[legacyKey], source)
    assert.equal(runtime.storage[storeModule.assessmentDraftStorageKey], undefined)
    assert.notEqual(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v2')
  })

  runCase('PERSIST-MIGRATION-006-INVALID-SOURCE-BLOCKED', () => {
    resetStorage()
    const invalidSource = makeV1Draft({ 'health.conditions': ['not-a-code'] })
    const legacyKey = storeModule.assessmentDraftLegacyStorageKey
    runtime.storage[legacyKey] = clone(invalidSource)
    const sourceBytes = JSON.stringify(runtime.storage[legacyKey])
    const store = new storeModule.AssessmentDraftStore()
    assert.equal(store.requiresLegacyRecovery(), true)
    assert.equal(store.hasAnswers(), true)
    const mutation = store.setAnswer('basic.relationship', 'father')
    assert.deepEqual(mutation.persistence, { ok: false, status: 'failed', reason: 'migration_failed' })
    assert.equal(JSON.stringify(runtime.storage[legacyKey]), sourceBytes)
    assert.equal(runtime.storage[storeModule.assessmentDraftStorageKey], undefined)
    assert.notEqual(runtime.storage[storeModule.assessmentDraftActivePointerKey], 'v2')
    const restarted = store.clear()
    assert.equal(restarted.persistence.ok, true)
    assert.equal(store.requiresLegacyRecovery(), false)
    assert.equal(restarted.draft.schemaVersion, 2)
  })

  runCase('PERSIST-V2-NORMAL-MUTATION', () => {
    resetStorage()
    const store = new storeModule.AssessmentDraftStore()
    const result = store.setAnswer('health.chewingAbility', 'unknown')
    assert.equal(result.persistence.ok, true)
    assert.equal(store.getAnswer('health.chewingAbility'), 'unknown')
    const restored = new storeModule.AssessmentDraftStore()
    assert.equal(restored.getAnswer('health.chewingAbility'), 'unknown')
  })

  runCase('PERSIST-CLEAR-NEW-V2-DRAFT', () => {
    const store = new storeModule.AssessmentDraftStore()
    const result = store.clear()
    assert.equal(result.persistence.ok, true)
    assert.equal(result.draft.schemaVersion, 2)
    assert.deepEqual(result.draft.answers, {})
  })

  if (failures.length > 0) {
    console.error(`ASSESSMENT V2 RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`ASSESSMENT V2 RUNTIME PASS: ${caseCount} source runtime cases`)
}

try {
  await run()
} catch (error) {
  console.error('ASSESSMENT V2 RUNTIME FAIL:', error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
} finally {
  if (previousWx === undefined) delete globalThis.wx
  else globalThis.wx = previousWx
}
