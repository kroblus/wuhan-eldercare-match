import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  ADL_QUESTION_ORDER,
  CARE_CAPABILITY_ORDER,
  completedAtValidationFixtures,
  elderProfileFixtures,
  makeCompletedAssessment,
} from './fixtures/elder-profile-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const failures = []
let caseCount = 0
const caseIds = []

const EXPECTED_FIXTURE_IDS = Object.freeze([
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11',
  'C12a', 'C12b', 'C13a', 'C13b', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21',
])

const EXPECTED_CASE_IDS = Object.freeze([
  ...EXPECTED_FIXTURE_IDS,
  'DERIVE_27_OF_27_AND_OPTIONAL_ABSENT',
  'OPTIONAL_SNAPSHOT_MAPPING',
  'INPUT_GATE_DRAFT_SCHEMA_MISSING_INVALID_UNKNOWN_CONDITIONAL',
  ...completedAtValidationFixtures.map((fixture) => fixture.id),
  'ADL_INPUT_GATE',
  'UNKNOWN_NONORDINAL_NO_STAIRS_BOUNDARIES',
  'CARE_LEVEL_EVIDENCE_ONLY_INFLUENCING_BURDENS',
  'REHABILITATION_CONFLICT',
  'MULTIPLE_UNKNOWN_FACTS_REMAIN_UNKNOWN',
  'LOW_AND_HIGH_BUDGET_SNAPSHOTS',
  'ALZHEIMERS_AND_COGNITIVE_NONE_CONFLICT',
  'UNKNOWN_HEALTH_NOT_ABSENCE_EVIDENCE',
  'DIRECT_CAPABILITY_VS_ADL_CLUE',
  'FULL_ANSWER_SET_ABSENCE_EVIDENCE',
  'EVIDENCE_CLARIFICATION_SUMMARY_CONTRACT',
  'DETERMINISTIC_REPEAT_AND_NO_SIDE_EFFECTS',
  'ONE_FINAL_EVIDENCE_PER_DERIVED_FIELD',
])

const ALL_ASSESSMENT_QUESTION_IDS = Object.freeze([
  'basic.relationship', 'basic.elderName', 'basic.gender', 'basic.age',
  'basic.livingStatus', 'basic.primaryCaregiver', 'basic.hasInstitutionExperience',
  'basic.institutionExitReasons', 'health.conditions', 'health.recentEvents',
  'health.rehabilitationNeed', ...ADL_QUESTION_ORDER, 'cognitive.symptoms',
  'cognitive.specialCareNeeds', 'preference.careType', 'preference.priorities',
  'preference.region', 'budget.monthlyRange', 'budget.upfrontCostAcceptance',
  'budget.moveInTiming', 'budget.consultantSupport',
])

const MULTI_CHOICE_QUESTION_IDS = Object.freeze([
  'basic.institutionExitReasons', 'health.conditions', 'health.recentEvents',
  'cognitive.symptoms', 'cognitive.specialCareNeeds', 'preference.priorities',
])

const MULTI_CHOICE_ALLOWED_OPTION_CODES = Object.freeze({
  'basic.institutionExitReasons': Object.freeze([
    'poor_nursing', 'poor_service_attitude', 'high_cost', 'too_far',
    'insufficient_medical_capability', 'unsatisfactory_environment', 'unsatisfactory_food',
    'elder_not_adapted', 'other',
  ]),
  'health.conditions': Object.freeze([
    'hypertension', 'diabetes', 'coronary_heart_disease', 'stroke_sequelae', 'parkinson_disease',
    'alzheimers_disease', 'other_cognitive_impairment', 'chronic_respiratory_disease',
    'osteoarticular_disease', 'tumor', 'other_chronic_disease', 'none', 'unknown',
  ]),
  'health.recentEvents': Object.freeze([
    'fall_within_6_months', 'fracture_within_6_months', 'frequent_hospitalization_within_6_months',
    'recently_discharged', 'postoperative_recovery', 'long_term_bedridden', 'pressure_injury',
    'none', 'unknown',
  ]),
  'cognitive.symptoms': Object.freeze([
    'memory_decline', 'repetitive_questioning', 'gets_lost', 'wandering_risk',
    'sleep_wake_disorder', 'mood_instability', 'agitation', 'aggression', 'diagnosed_dementia',
    'none', 'unknown',
  ]),
  'cognitive.specialCareNeeds': Object.freeze([
    'round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit',
    'rehabilitation_training', 'tube_feeding', 'catheter_care', 'pressure_injury_care',
    'incontinence_care', 'other', 'none', 'unknown',
  ]),
  'preference.priorities': Object.freeze([
    'medical_conditions', 'nursing_professionalism', 'caregiver_attitude',
    'rehabilitation_capability', 'food_quality', 'living_environment', 'overall_quality',
    'recreational_activities', 'close_to_family', 'transportation', 'price', 'dementia_care',
  ]),
})

const ADL_SHORT_KEY_BY_QUESTION = Object.freeze({
  'adl.eating': 'eating',
  'adl.mobility': 'mobility',
  'adl.toileting': 'toileting',
  'adl.bathing': 'bathing',
  'adl.dressing': 'dressing',
  'adl.transfer': 'transfer',
  'adl.stairs': 'stairs',
})

const ALL_ADL_MODE_CODES = Object.freeze([
  'feeding_minor', 'feeding_dependence', 'special_feeding_review', 'walking_aid', 'wheelchair',
  'bedridden', 'toileting_minor', 'incontinence', 'toileting_full_assistance',
  'catheter_or_stoma_review', 'bathing_partial', 'bathing_full_assistance', 'dressing_partial',
  'dressing_full_assistance', 'transfer_minor', 'transfer_support', 'fully_dependent_transfer',
  'stairs_assistance', 'stairs_unable', 'no_stairs_context',
])

const REQUIRED_CORE_DERIVED_FIELDS = Object.freeze([
  'health.rehabilitationNeed',
  'adl.careLevel',
  'mobility.level',
  'cognition.cognitiveConcern',
  'cognition.reportedDiagnosis',
  'cognition.wanderingRisk',
  'cognition.behavioralRisk',
  'cognition.sleepCycleIssue',
  'specialCare.requiredCareCapabilities.round_the_clock_care',
  'specialCare.requiredCareCapabilities.one_to_one_caregiver',
  'specialCare.requiredCareCapabilities.night_care',
  'specialCare.requiredCareCapabilities.dementia_unit',
  'specialCare.requiredCareCapabilities.rehabilitation_training',
  'specialCare.requiredCareCapabilities.tube_feeding',
  'specialCare.requiredCareCapabilities.catheter_care',
  'specialCare.requiredCareCapabilities.pressure_injury_care',
  'specialCare.requiredCareCapabilities.incontinence_care',
])

const ALL_DERIVED_FIELDS = Object.freeze([
  ...REQUIRED_CORE_DERIVED_FIELDS.slice(0, 2),
  ...ALL_ADL_MODE_CODES.map((code) => `adl.careModes.${code}`),
  ...REQUIRED_CORE_DERIVED_FIELDS.slice(2),
])

const RAW_TARGET_MAPPINGS = Object.freeze([
  ['basic.relationship', ['basic', 'rawFacts', 'relation']],
  ['basic.elderName', ['basic', 'rawFacts', 'name']],
  ['basic.gender', ['basic', 'rawFacts', 'sex']],
  ['basic.age', ['basic', 'rawFacts', 'age']],
  ['basic.livingStatus', ['basic', 'rawFacts', 'livingStatus']],
  ['basic.primaryCaregiver', ['basic', 'rawFacts', 'primaryCaregiver']],
  ['basic.hasInstitutionExperience', ['basic', 'rawFacts', 'hasInstitutionExperience']],
  ['basic.institutionExitReasons', ['basic', 'rawFacts', 'institutionExitReasons']],
  ['health.conditions', ['health', 'rawFacts', 'reportedDiseases']],
  ['health.recentEvents', ['health', 'rawFacts', 'recentHealthRisks']],
  ['health.rehabilitationNeed', ['health', 'rawFacts', 'rehabilitationNeedAnswer']],
  ['adl.eating', ['adl', 'rawAnswers', 'eating']],
  ['adl.mobility', ['adl', 'rawAnswers', 'mobility']],
  ['adl.toileting', ['adl', 'rawAnswers', 'toileting']],
  ['adl.bathing', ['adl', 'rawAnswers', 'bathing']],
  ['adl.dressing', ['adl', 'rawAnswers', 'dressing']],
  ['adl.transfer', ['adl', 'rawAnswers', 'transfer']],
  ['adl.stairs', ['adl', 'rawAnswers', 'stairs']],
  ['cognitive.symptoms', ['cognition', 'rawFacts', 'reportedSymptoms']],
  ['cognitive.specialCareNeeds', ['specialCare', 'rawFacts', 'answers']],
  ['preference.careType', ['preference', 'rawFacts', 'preferredInstitutionType']],
  ['preference.priorities', ['preference', 'rawFacts', 'priorities']],
  ['preference.region', ['preference', 'rawFacts', 'regionPreference']],
  ['budget.monthlyRange', ['financial', 'rawFacts', 'monthlyBudget']],
  ['budget.upfrontCostAcceptance', ['financial', 'rawFacts', 'depositTolerance']],
  ['budget.moveInTiming', ['intent', 'rawFacts', 'moveInTiming']],
  ['budget.consultantSupport', ['intent', 'rawFacts', 'consultantIntent']],
])

const SUMMARY_SECTION_ORDER = Object.freeze([
  'basic', 'health', 'adl', 'mobility', 'cognition', 'special_care', 'preference', 'financial_intent',
])

const SUMMARY_RAW_SOURCE_BY_CODE = Object.freeze({
  'basic.relationship': 'basic.relationship', 'basic.name': 'basic.elderName',
  'basic.gender': 'basic.gender', 'basic.age': 'basic.age',
  'basic.living_status': 'basic.livingStatus', 'basic.primary_caregiver': 'basic.primaryCaregiver',
  'basic.institution_experience': 'basic.hasInstitutionExperience',
  'basic.institution_exit_reasons': 'basic.institutionExitReasons',
  'health.reported_diseases': 'health.conditions', 'health.recent_risks': 'health.recentEvents',
  'preference.care_type': 'preference.careType', 'preference.priorities': 'preference.priorities',
  'preference.region': 'preference.region', 'financial.monthly_budget': 'budget.monthlyRange',
  'financial.deposit_tolerance': 'budget.upfrontCostAcceptance',
  'intent.move_in_timing': 'budget.moveInTiming', 'intent.consultant_support': 'budget.consultantSupport',
})

const SUMMARY_DERIVED_FIELD_BY_CODE = Object.freeze({
  'health.rehabilitation_need': 'health.rehabilitationNeed',
  'adl.care_level': 'adl.careLevel', 'mobility.level': 'mobility.level',
  'cognition.concern': 'cognition.cognitiveConcern',
  'cognition.reported_diagnosis': 'cognition.reportedDiagnosis',
  'cognition.wandering_risk': 'cognition.wanderingRisk',
  'cognition.behavioral_risk': 'cognition.behavioralRisk',
  'cognition.sleep_cycle_issue': 'cognition.sleepCycleIssue',
})

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
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
        throw new Error(`Pure elder-profile runtime forbids external import ${request} from ${resolvedPath}`)
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

const runCase = (name, callback) => {
  caseCount += 1
  if (caseIds.indexOf(name) >= 0) {
    throw new Error(`duplicate runtime case id ${name}`)
  }
  caseIds.push(name)
  try {
    callback()
    console.log(`PASS ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${name}: ${message}`)
    console.error(`FAIL ${name}: ${message}`)
  }
}

const fieldEvidence = (profile, field) => {
  const records = profile.evidence.filter((item) => item.derivedField === field)
  assert.equal(records.length, 1, `expected one evidence record for ${field}`)
  assert.equal(records[0].evidenceId, `ev:${field}`)
  assert.ok(records[0].sources.length > 0, `evidence sources missing for ${field}`)
  return records[0]
}

const profileEvidenceFields = (expectedModeCodes) => [
  REQUIRED_CORE_DERIVED_FIELDS[0],
  REQUIRED_CORE_DERIVED_FIELDS[1],
  ...expectedModeCodes.map((code) => `adl.careModes.${code}`),
  ...REQUIRED_CORE_DERIVED_FIELDS.slice(2),
]

const adlEvidenceFields = (expectedModeCodes) => [
  ...expectedModeCodes.map((code) => `adl.careModes.${code}`),
  'adl.careLevel',
]

const getAtPath = (value, segments) => segments.reduce((current, segment) => current?.[segment], value)

const hasAtPath = (value, segments) => {
  if (segments.length === 0) {
    return true
  }
  if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(value, segments[0])) {
    return false
  }
  return hasAtPath(value[segments[0]], segments.slice(1))
}

const assertRawMapping = (profile, assessment) => {
  RAW_TARGET_MAPPINGS.forEach(([questionId, targetPath]) => {
    const answerPresent = Object.prototype.hasOwnProperty.call(assessment.answers, questionId)
    const targetPresent = hasAtPath(profile, targetPath)
    assert.equal(targetPresent, answerPresent, `${questionId} optional presence was not preserved`)
    if (answerPresent) {
      assert.deepEqual(getAtPath(profile, targetPath), assessment.answers[questionId], `${questionId} raw value changed`)
    }
  })
}

const makeAssessmentForAdlFixture = (fixture) => {
  const overrides = {}
  ADL_QUESTION_ORDER.forEach((questionId) => {
    const shortKey = ADL_SHORT_KEY_BY_QUESTION[questionId]
    if (Object.prototype.hasOwnProperty.call(fixture.answers, shortKey)) {
      overrides[questionId] = fixture.answers[shortKey]
    }
  })
  const assessment = makeCompletedAssessment(overrides)
  ADL_QUESTION_ORDER.forEach((questionId) => {
    const shortKey = ADL_SHORT_KEY_BY_QUESTION[questionId]
    if (!Object.prototype.hasOwnProperty.call(fixture.answers, shortKey)) {
      delete assessment.answers[questionId]
    }
  })
  return assessment
}

const assertExactEvidenceFieldSet = (profile, expectedModeCodes) => {
  const expectedFields = profileEvidenceFields(expectedModeCodes)
  const actualFields = profile.evidence.map((item) => item.derivedField)
  assert.deepEqual(actualFields, expectedFields, 'profile evidence field set/order drifted')
  assert.equal(new Set(actualFields).size, actualFields.length, 'profile evidence has duplicate derived fields')
  expectedFields.forEach((field) => fieldEvidence(profile, field))
}

const assertExactAdlEvidenceFieldSet = (classification, expectedModeCodes) => {
  const expectedFields = adlEvidenceFields(expectedModeCodes)
  const actualFields = classification.evidence.map((item) => item.derivedField)
  assert.deepEqual(actualFields, expectedFields, 'ADL evidence field set/order drifted')
  assert.equal(new Set(actualFields).size, actualFields.length, 'ADL evidence has duplicate derived fields')
  classification.evidence.forEach((item) => {
    assert.equal(item.evidenceId, `ev:${item.derivedField}`)
    assert.ok(item.sources.length > 0)
  })
}

const assertEvidenceSources = (records, assessment, label) => {
  records.forEach((record) => {
    assert.ok(record.sources.length > 0, `${label} ${record.evidenceId || record.clarificationId} has no sources`)
    record.sources.forEach((source) => {
      assert.ok(ALL_ASSESSMENT_QUESTION_IDS.indexOf(source.sourceQuestionId) >= 0,
        `${label} has unknown source question ${source.sourceQuestionId}`)
      assert.ok(Object.prototype.hasOwnProperty.call(assessment.answers, source.sourceQuestionId),
        `${label} cites absent source question ${source.sourceQuestionId}`)
      const answer = assessment.answers[source.sourceQuestionId]
      if (source.sourceKind === 'assessment_option') {
        assert.equal(typeof source.sourceOptionCode, 'string', `${label} option source has no option code`)
        assert.notEqual(source.contribution, 'establishes_not_reported',
          `${label} positive option uses answer-set contribution`)
        assert.ok(Array.isArray(answer)
          ? answer.indexOf(source.sourceOptionCode) >= 0
          : answer === source.sourceOptionCode,
        `${label} cites an option not in the Assessment snapshot`)
        return
      }
      if (source.sourceKind !== 'assessment_answer_set') {
        assert.fail(`${label} has illegal sourceKind ${String(source.sourceKind)}`)
      }
      assert.ok(MULTI_CHOICE_QUESTION_IDS.indexOf(source.sourceQuestionId) >= 0,
        `${label} answer-set source is not a frozen multi-choice question`)
      assert.ok(Array.isArray(answer), `${label} answer-set source is not multi-choice`)
      assert.ok(Array.isArray(source.sourceOptionCodes), `${label} answer-set source has no snapshot`)
      assert.ok(MULTI_CHOICE_ALLOWED_OPTION_CODES[source.sourceQuestionId].indexOf(source.targetOptionCode) >= 0,
        `${label} answer-set target option is illegal for ${source.sourceQuestionId}`)
      assert.deepEqual(source.sourceOptionCodes, answer, `${label} answer-set order or values changed`)
      assert.equal(source.contribution, 'establishes_not_reported',
        `${label} answer-set contribution drifted`)
      assert.equal(source.sourceOptionCodes.indexOf('unknown'), -1,
        `${label} must not use [unknown] answer-set absence`)
      assert.equal(source.sourceOptionCodes.indexOf('none'), -1,
        `${label} must not use [none] answer-set absence`)
      assert.equal(source.sourceOptionCodes.indexOf(source.targetOptionCode), -1,
        `${label} answer-set target is present`)
    })
  })
}

const assertSourceSnapshots = (profile, assessment) => {
  assertEvidenceSources(profile.evidence, assessment, 'evidence')
  assertEvidenceSources(profile.clarifications, assessment, 'clarification')
}

const expectedClarificationPriority = (reasonCode, clarificationId) => {
  if (reasonCode === 'other_without_detail') {
    return 'recommended'
  }
  if (reasonCode === 'unknown_answer' && clarificationId.startsWith('cl:unknown_answer:adl.')) {
    return 'required_before_classification'
  }
  return 'required_before_hard_filter'
}

const assertClarificationReferences = (profile, assessment) => {
  const evidenceIds = new Set(profile.evidence.map((item) => item.evidenceId))
  const clarificationIds = new Set(profile.clarifications.map((item) => item.clarificationId))
  assert.equal(clarificationIds.size, profile.clarifications.length, 'duplicate clarification id')
  profile.evidence.forEach((item) => {
    assert.ok(item.evidenceId.startsWith('ev:'), `unstable evidence id ${item.evidenceId}`)
  })
  const checkFact = (fact, label) => {
    fact.evidenceIds.forEach((id) => assert.ok(evidenceIds.has(id), `${label} references missing evidence ${id}`))
    if (fact.status === 'unknown' || fact.status === 'needs_confirmation') {
      assert.ok(fact.clarificationIds.length > 0, `${label} confirmation has no clarification`)
      fact.clarificationIds.forEach((id) => assert.ok(clarificationIds.has(id), `${label} references missing clarification ${id}`))
    }
  }
  checkFact(profile.health.derivedFacts.rehabilitationNeed, 'rehabilitation')
  checkFact(profile.adl.derivedFacts.careLevel, 'careLevel')
  profile.mobility.derivedFacts.level && checkFact(profile.mobility.derivedFacts.level, 'mobility')
  Object.values(profile.cognition.derivedFacts).forEach((fact) => checkFact(fact, 'cognition'))
  profile.specialCare.derivedFacts.requiredCareCapabilities.forEach((fact) => checkFact(fact, fact.capability))
  profile.adl.derivedFacts.careModes.forEach((mode) => {
    mode.evidenceIds.forEach((id) => assert.ok(evidenceIds.has(id), `${mode.code} references missing evidence`))
    if (mode.status === 'needs_confirmation') {
      assert.ok(Array.isArray(mode.clarificationIds) && mode.clarificationIds.length > 0,
        `${mode.code} needs confirmation but has no clarification ids`)
      mode.clarificationIds.forEach((id) => assert.ok(clarificationIds.has(id), `${mode.code} references missing clarification`))
    } else if (mode.clarificationIds) {
      mode.clarificationIds.forEach((id) => assert.ok(clarificationIds.has(id), `${mode.code} references missing clarification`))
    }
  })

  profile.clarifications.forEach((clarification) => {
    assert.equal(clarification.status, 'open')
    assert.match(clarification.clarificationId, /^cl:(other_without_detail|unknown_answer|non_ordinal_adl_answer|cross_answer_conflict|risk_signal_needs_confirmation):.+$/)
    assert.ok(clarification.sources.length > 0, `${clarification.clarificationId} has no sources`)
    assert.ok(clarification.affectedDerivedFields.length > 0, `${clarification.clarificationId} has no affected fields`)
    clarification.affectedDerivedFields.forEach((field) => assert.ok(ALL_DERIVED_FIELDS.indexOf(field) >= 0,
      `${clarification.clarificationId} references unknown derived field ${field}`))
    assert.equal(clarification.priority, expectedClarificationPriority(clarification.reasonCode, clarification.clarificationId),
      `${clarification.clarificationId} priority drifted`)

    const idParts = clarification.clarificationId.split(':')
    const payload = idParts.slice(2).join(':')
    if (clarification.reasonCode === 'unknown_answer') {
      assert.equal(idParts[1], 'unknown_answer')
      assert.ok(ALL_ASSESSMENT_QUESTION_IDS.indexOf(payload) >= 0, `${clarification.clarificationId} has invalid question id`)
    } else if (clarification.reasonCode === 'non_ordinal_adl_answer') {
      assert.equal(idParts[1], 'non_ordinal_adl_answer')
      assert.ok(ADL_QUESTION_ORDER.indexOf(payload) >= 0, `${clarification.clarificationId} has invalid ADL question id`)
    } else if (clarification.reasonCode === 'other_without_detail') {
      assert.equal(clarification.clarificationId, 'cl:other_without_detail:cognitive.specialCareNeeds')
    } else {
      assert.ok(clarification.reasonCode === 'cross_answer_conflict' || clarification.reasonCode === 'risk_signal_needs_confirmation')
      assert.equal(idParts[1], clarification.reasonCode)
      assert.ok(ALL_DERIVED_FIELDS.indexOf(payload) >= 0, `${clarification.clarificationId} has invalid derived field id`)
    }
  })
  assertEvidenceSources(profile.clarifications, assessment, 'clarification')
}

const assertAdlClarificationShape = (clarifications, assessment) => {
  const ids = new Set(clarifications.map((item) => item.clarificationId))
  assert.equal(ids.size, clarifications.length, 'duplicate ADL clarification id')
  clarifications.forEach((clarification) => {
    assert.equal(clarification.status, 'open')
    assert.ok(clarification.sources.length > 0)
    assert.ok(clarification.affectedDerivedFields.length > 0)
    clarification.affectedDerivedFields.forEach((field) => assert.ok(ALL_DERIVED_FIELDS.indexOf(field) >= 0))
    assert.equal(clarification.priority, expectedClarificationPriority(clarification.reasonCode, clarification.clarificationId))
    const idParts = clarification.clarificationId.split(':')
    const payload = idParts.slice(2).join(':')
    if (clarification.reasonCode === 'unknown_answer') {
      assert.equal(idParts[1], 'unknown_answer')
      assert.ok(ALL_ASSESSMENT_QUESTION_IDS.indexOf(payload) >= 0)
    } else if (clarification.reasonCode === 'non_ordinal_adl_answer') {
      assert.equal(idParts[1], 'non_ordinal_adl_answer')
      assert.ok(ADL_QUESTION_ORDER.indexOf(payload) >= 0)
    } else {
      assert.fail(`unexpected ADL clarification reason ${clarification.reasonCode}`)
    }
  })
  assertEvidenceSources(clarifications, assessment, 'ADL clarification')
}

const expectedSummaryCodes = (assessment, expectedModeCodes) => {
  const basic = ['basic.relationship']
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'basic.elderName')) basic.push('basic.name')
  basic.push('basic.gender', 'basic.age')
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'basic.livingStatus')) basic.push('basic.living_status')
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'basic.primaryCaregiver')) basic.push('basic.primary_caregiver')
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'basic.hasInstitutionExperience')) basic.push('basic.institution_experience')
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'basic.institutionExitReasons')) basic.push('basic.institution_exit_reasons')
  const preference = ['preference.care_type', 'preference.priorities']
  if (Object.prototype.hasOwnProperty.call(assessment.answers, 'preference.region')) preference.push('preference.region')
  return [
    basic,
    ['health.reported_diseases', 'health.recent_risks', 'health.rehabilitation_need'],
    ['adl.care_level', ...expectedModeCodes.map((code) => `adl.care_mode.${code}`)],
    ['mobility.level'],
    ['cognition.concern', 'cognition.reported_diagnosis', 'cognition.wandering_risk', 'cognition.behavioral_risk', 'cognition.sleep_cycle_issue'],
    CARE_CAPABILITY_ORDER.map((code) => `special_care.capability.${code}`),
    preference,
    ['financial.monthly_budget', 'financial.deposit_tolerance', 'intent.move_in_timing', 'intent.consultant_support'],
  ]
}

const summarySourceForCode = (summaryCode) => {
  if (summaryCode.startsWith('adl.care_mode.')) {
    const mode = summaryCode.slice('adl.care_mode.'.length)
    return { kind: 'derived_fact', derivedField: `adl.careModes.${mode}`, evidenceIds: [`ev:adl.careModes.${mode}`] }
  }
  if (summaryCode.startsWith('special_care.capability.')) {
    const capability = summaryCode.slice('special_care.capability.'.length)
    const derivedField = `specialCare.requiredCareCapabilities.${capability}`
    return { kind: 'derived_fact', derivedField, evidenceIds: [`ev:${derivedField}`] }
  }
  const rawQuestionId = SUMMARY_RAW_SOURCE_BY_CODE[summaryCode]
  if (rawQuestionId) {
    return { kind: 'raw_fact', sourceQuestionId: rawQuestionId }
  }
  const derivedField = SUMMARY_DERIVED_FIELD_BY_CODE[summaryCode]
  assert.ok(derivedField, `summary code has no frozen source mapping: ${summaryCode}`)
  return { kind: 'derived_fact', derivedField, evidenceIds: [`ev:${derivedField}`] }
}

const assertSummaryContract = (profile, assessment, expectedModeCodes) => {
  const summary = profile.userFacingSummary
  assert.equal(summary.summarySchemaVersion, 'elder-profile-summary-input-v1')
  assert.deepEqual(summary.sections.map((section) => section.section), SUMMARY_SECTION_ORDER)
  const expectedSections = expectedSummaryCodes(assessment, expectedModeCodes)
  summary.sections.forEach((section, index) => {
    assert.ok(section.items.length > 0, `${section.section} summary section is empty`)
    const actualCodes = section.items.map((item) => item.summaryCode)
    assert.deepEqual(actualCodes, expectedSections[index], `${section.section} summary item order drifted`)
    section.items.forEach((item) => {
      assert.deepEqual(item.sources, [summarySourceForCode(item.summaryCode)], `${item.summaryCode} summary source drifted`)
    })
  })
}

const assertCapabilityOrder = (profile) => {
  assert.deepEqual(
    profile.specialCare.derivedFacts.requiredCareCapabilities.map((item) => item.capability),
    CARE_CAPABILITY_ORDER,
    'capability set/order drifted',
  )
}

const assertAdlFixture = (fixture, adlModule) => {
  const assessment = makeAssessmentForAdlFixture(fixture)
  const result = adlModule.classifyAdl(clone(fixture.answers))
  if (fixture.expected.error) {
    assert.equal(result.ok, false)
    assert.deepEqual(result.error, fixture.expected.error, `${fixture.id} error contract drifted`)
    return
  }
  assert.equal(result.ok, true)
  const classification = result.classification
  const expected = fixture.expected
  const careLevel = classification.derivedFacts.careLevel
  assert.equal(careLevel.status, expected.careLevelStatus)
  assert.equal(careLevel.confidence, expected.confidence)
  if (expected.careLevelStatus === 'known') {
    assert.equal(careLevel.value, expected.careLevel)
    assert.equal(Object.prototype.hasOwnProperty.call(careLevel, 'clarificationIds'), false)
  } else {
    assert.equal(Object.prototype.hasOwnProperty.call(careLevel, 'value'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(careLevel, 'candidateValue'), false)
    assert.deepEqual(careLevel.clarificationIds, expected.careLevelClarificationIds)
  }
  assert.deepEqual(classification.derivedFacts.observationCoverage, expected.coverage)
  assert.deepEqual(classification.derivedFacts.unknownQuestionIds, expected.unknownQuestionIds)
  assert.deepEqual(
    classification.derivedFacts.careModes.map((mode) => ({
      code: mode.code,
      status: mode.status,
      clarificationIds: mode.clarificationIds || [],
    })),
    expected.careModes,
    `${fixture.id} care mode set/order/status/clarifications drifted`,
  )
  const careLevelEvidence = classification.evidence.find((item) => item.derivedField === 'adl.careLevel')
  assert.ok(careLevelEvidence)
  assert.equal(careLevelEvidence.ruleId, `adl-ruleset-v1:${expected.rule}`)
  assertExactAdlEvidenceFieldSet(classification, expected.careModes.map((mode) => mode.code))
  assertEvidenceSources(classification.evidence, assessment, `${fixture.id} ADL evidence`)
  const expectedClarificationIds = [
    ...(expected.careLevelClarificationIds || []),
    ...expected.careModes.flatMap((mode) => mode.clarificationIds),
  ]
  assert.deepEqual(
    classification.clarifications.map((item) => item.clarificationId),
    expectedClarificationIds,
    `${fixture.id} clarification set/order drifted`,
  )
  assertAdlClarificationShape(classification.clarifications, assessment)
}

const assertCompleteProfileContract = (profile, assessment, expectedModeCodes) => {
  assertRawMapping(profile, assessment)
  assertExactEvidenceFieldSet(profile, expectedModeCodes)
  assertCapabilityOrder(profile)
  assertSourceSnapshots(profile, assessment)
  assertClarificationReferences(profile, assessment)
  assertSummaryContract(profile, assessment, expectedModeCodes)
}

const assertProfileFixture = (fixture, profile, assessment) => {
  const expected = fixture.expected
  const expectedModeCodes = expected.careModes.map((mode) => mode.code)
  assertRawMapping(profile, assessment)
  assert.equal(profile.adl.derivedFacts.careLevel.status, expected.careLevelStatus)
  assert.equal(profile.adl.derivedFacts.careLevel.confidence, expected.confidence)
  if (expected.careLevelStatus === 'known') {
    assert.equal(profile.adl.derivedFacts.careLevel.value, expected.careLevel)
  } else {
    assert.equal(Object.prototype.hasOwnProperty.call(profile.adl.derivedFacts.careLevel, 'value'), false)
    assert.deepEqual(profile.adl.derivedFacts.careLevel.clarificationIds, expected.careLevelClarificationIds)
  }
  assert.deepEqual(profile.adl.derivedFacts.observationCoverage, expected.coverage)
  assert.deepEqual(profile.adl.derivedFacts.unknownQuestionIds, expected.unknownQuestionIds)
  assert.deepEqual(
    profile.adl.derivedFacts.careModes.map((mode) => ({
      code: mode.code,
      status: mode.status,
      clarificationIds: mode.clarificationIds || [],
    })),
    expected.careModes,
    `${fixture.id} profile care mode set/order/status/clarifications drifted`,
  )
  const careLevelEvidence = fieldEvidence(profile, 'adl.careLevel')
  assert.equal(careLevelEvidence.ruleId, `adl-ruleset-v1:${expected.rule}`)
  const expectedClarificationIds = [
    ...(expected.careLevelClarificationIds || []),
    ...expected.careModes.flatMap((mode) => mode.clarificationIds),
  ]
  assert.deepEqual(
    profile.clarifications.map((item) => item.clarificationId),
    expected.profileClarificationIds || expectedClarificationIds,
    `${fixture.id} profile clarification set/order drifted`,
  )
  assertCompleteProfileContract(profile, assessment, expectedModeCodes)
}

const assertPureDependencyGraph = (loadedSourcePaths) => {
  const domainRoot = `${path.join(miniprogramRoot, 'domain', 'elder-profile')}${path.sep}`
  const allowedTypePaths = new Set([
    path.join(miniprogramRoot, 'types', 'assessment.ts'),
    path.join(miniprogramRoot, 'types', 'elder-profile.ts'),
  ])
  const businessSourcePaths = [...loadedSourcePaths].filter((filePath) => filePath.endsWith('.ts') || filePath.endsWith('.js'))
  assert.ok(businessSourcePaths.length > 0, 'runtime loader did not record business source files')
  businessSourcePaths.forEach((filePath) => {
    assert.ok(filePath.startsWith(domainRoot) || allowedTypePaths.has(filePath),
      `forbidden import graph edge outside pure domain/types: ${filePath}`)
    assert.equal(filePath.includes(`${path.sep}tmp${path.sep}`), false, `tmp artifact loaded: ${filePath}`)
    // External typings are intentionally not included in businessSourcePaths;
    // these checks apply only to actual loaded implementation sources.
    const source = readFileSync(filePath, 'utf8')
    assert.doesNotMatch(source, /\bclass\s+[A-Za-z_$]/)
    assert.doesNotMatch(source, /\b(?:Institution|InstitutionService|InstitutionProvider|InstitutionCapability|Recommendation|Ranking)\b/)
    assert.doesNotMatch(source, /\b(?:Page|Component|Store)\b/)
    assert.doesNotMatch(source, /\bwx\s*\./)
    assert.doesNotMatch(source, /Date\.now\s*\(/)
    assert.doesNotMatch(source, /new\s+Date\s*\(/)
    assert.doesNotMatch(source, /(?<![A-Za-z0-9_$])Date\s*\(/)
    assert.doesNotMatch(source, /Math\.random\s*\(/)
    assert.doesNotMatch(source, /\b(?:crypto|randomUUID)\b/)
  })
}

const run = async () => {
  const { parser, parserPath } = await getTypeScriptParser()
  const loadedSourcePaths = new Set()
  const loadModule = createSourceLoader(parser, loadedSourcePaths)
  const adlModule = loadModule(path.join(miniprogramRoot, 'domain', 'elder-profile', 'adl-classifier.ts'))
  const deriveModule = loadModule(path.join(miniprogramRoot, 'domain', 'elder-profile', 'derive-elder-profile.ts'))
  const rulesModule = loadModule(path.join(miniprogramRoot, 'domain', 'elder-profile', 'rules.ts'))
  const indexModule = loadModule(path.join(miniprogramRoot, 'domain', 'elder-profile', 'index.ts'))
  const assessmentModule = loadModule(path.join(miniprogramRoot, 'types', 'assessment.ts'))
  assert.equal(typeof indexModule.classifyAdl, 'function')
  assert.equal(typeof indexModule.deriveElderProfile, 'function')
  console.log(`PARSER: TypeScript ${parser.version || 'unknown'} (${parserPath})`)

  assert.equal(ALL_ASSESSMENT_QUESTION_IDS.length, 27, 'frozen Assessment question manifest is not 27/27')
  assert.deepEqual(Object.keys(assessmentModule.ASSESSMENT_QUESTION_DEFINITIONS), ALL_ASSESSMENT_QUESTION_IDS,
    'runtime Assessment registry drifted from the 27/27 manifest')
  assert.deepEqual(RAW_TARGET_MAPPINGS.map(([questionId]) => questionId), ALL_ASSESSMENT_QUESTION_IDS,
    'raw target mapping does not cover the exact 27/27 manifest')
  MULTI_CHOICE_QUESTION_IDS.forEach((questionId) => {
    assert.deepEqual(
      MULTI_CHOICE_ALLOWED_OPTION_CODES[questionId],
      assessmentModule.ASSESSMENT_QUESTION_DEFINITIONS[questionId].allowedValues,
      `${questionId} evidence option manifest drifted from Assessment Contract`,
    )
  })

  assert.deepEqual(elderProfileFixtures.map((fixture) => fixture.id), EXPECTED_FIXTURE_IDS,
    'fixture IDs/order drifted from the frozen C01-C21 matrix')
  assert.equal(new Set(elderProfileFixtures.map((fixture) => fixture.id)).size, EXPECTED_FIXTURE_IDS.length,
    'fixture IDs are not unique')

  elderProfileFixtures.forEach((fixture) => {
    runCase(fixture.id, () => {
      assertAdlFixture(fixture, adlModule)
      if (fixture.expected.error) {
        return
      }
      const assessment = makeAssessmentForAdlFixture(fixture)
      const profileResult = deriveModule.deriveElderProfile(assessment)
      assert.equal(profileResult.ok, true, `${fixture.id} profile derivation failed`)
      assertProfileFixture(fixture, profileResult.profile, assessment)
    })
  })

  runCase('DERIVE_27_OF_27_AND_OPTIONAL_ABSENT', () => {
    const assessment = makeCompletedAssessment()
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const profile = result.profile
    assertRawMapping(profile, assessment)
    assert.deepEqual(profile.basic.rawFacts, { relation: 'father', sex: 'male', age: 72 })
    assert.deepEqual(profile.health.rawFacts, {
      reportedDiseases: ['none'], recentHealthRisks: ['none'], rehabilitationNeedAnswer: 'none',
    })
    assert.deepEqual(profile.adl.rawAnswers, {
      eating: 'independent', mobility: 'independent', toileting: 'independent',
      bathing: 'independent', dressing: 'independent', transfer: 'independent', stairs: 'independent',
    })
    assert.deepEqual(profile.cognition.rawFacts, { reportedSymptoms: ['none'] })
    assert.deepEqual(profile.specialCare.rawFacts, { answers: ['none'] })
    assert.deepEqual(profile.preference.rawFacts, { preferredInstitutionType: 'unknown', priorities: ['price'] })
    assert.deepEqual(profile.financial.rawFacts, { monthlyBudget: 'unknown', depositTolerance: 'unknown' })
    assert.deepEqual(profile.intent.rawFacts, { moveInTiming: 'research_only', consultantIntent: 'recommendation_first' })
    assert.deepEqual(profile.identity, {
      elderId: 'elder-fixture-001',
      assessmentId: 'assessment-fixture-001',
      assessmentSchemaVersion: 1,
      assessmentCompletedAt: '2026-08-30T09:00:00.000Z',
      profileContractVersion: 'elder-profile-contract-v1',
      derivationRulesetVersion: 'elder-profile-ruleset-v1',
    })
    assertExactEvidenceFieldSet(profile, [])
    assertCapabilityOrder(profile)
    assertSourceSnapshots(profile, assessment)
    assertClarificationReferences(profile, assessment)
    assertSummaryContract(profile, assessment, [])
  })

  runCase('OPTIONAL_SNAPSHOT_MAPPING', () => {
    const assessment = makeCompletedAssessment({
      'basic.elderName': '王明',
      'basic.livingStatus': 'alone',
      'basic.primaryCaregiver': 'children',
      'basic.hasInstitutionExperience': 'true',
      'basic.institutionExitReasons': ['high_cost', 'too_far'],
      'preference.region': {
        kind: 'institution_region',
        regionCode: 'wuchang',
        regionLabelSnapshot: '武昌区',
        catalogVersion: 'region-v1',
      },
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const profile = result.profile
    assertRawMapping(profile, assessment)
    assert.deepEqual(profile.basic.rawFacts, {
      relation: 'father', name: '王明', sex: 'male', age: 72, livingStatus: 'alone',
      primaryCaregiver: 'children', hasInstitutionExperience: 'true', institutionExitReasons: ['high_cost', 'too_far'],
    })
    assert.deepEqual(profile.preference.rawFacts, {
      preferredInstitutionType: 'unknown', priorities: ['price'], regionPreference: assessment.answers['preference.region'],
    })
    assertExactEvidenceFieldSet(profile, [])
    assertCapabilityOrder(profile)
    assertSourceSnapshots(profile, assessment)
    assertClarificationReferences(profile, assessment)
    assertSummaryContract(profile, assessment, [])
  })

  runCase('INPUT_GATE_DRAFT_SCHEMA_MISSING_INVALID_UNKNOWN_CONDITIONAL', () => {
    const complete = makeCompletedAssessment()
    const draft = { kind: 'assessment_draft', status: 'draft', schemaVersion: 1, answers: {} }
    assert.equal(deriveModule.deriveElderProfile(draft).error.code, 'NOT_COMPLETED_ASSESSMENT')
    assert.equal(deriveModule.deriveElderProfile({ ...complete, schemaVersion: 2 }).error.code, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    const missing = clone(complete)
    delete missing.answers['adl.transfer']
    assert.equal(deriveModule.deriveElderProfile(missing).error.code, 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE')
    const invalid = clone(complete)
    invalid.answers['adl.transfer'] = 'invalid'
    assert.equal(deriveModule.deriveElderProfile(invalid).error.code, 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE')
    const unknownKey = clone(complete)
    unknownKey.answers['adl.notAQuestion'] = 'independent'
    assert.equal(deriveModule.deriveElderProfile(unknownKey).error.code, 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE')
    const inactive = clone(complete)
    inactive.answers['basic.institutionExitReasons'] = ['high_cost']
    assert.equal(deriveModule.deriveElderProfile(inactive).error.code, 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE')
  })

  completedAtValidationFixtures.forEach((fixture) => {
    runCase(fixture.id, () => {
      const assessment = makeCompletedAssessment({}, { completedAt: fixture.completedAt })
      const result = deriveModule.deriveElderProfile(assessment)
      if (fixture.expectedErrorCode === null) {
        assert.equal(result.ok, true)
        assert.equal(result.profile.identity.assessmentCompletedAt, fixture.completedAt)
        return
      }
      assert.deepEqual(result.error, {
        code: fixture.expectedErrorCode,
        questionIds: [],
      })
    })
  })

  runCase('ADL_INPUT_GATE', () => {
    const base = elderProfileFixtures[0].answers
    const missing = clone(base)
    delete missing.transfer
    assert.equal(adlModule.classifyAdl(missing).error.code, 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE')
    const invalid = clone(base)
    invalid.transfer = 'invalid'
    assert.equal(adlModule.classifyAdl(invalid).error.code, 'INVALID_ADL_ANSWER_NOT_DERIVABLE')
    assert.equal(adlModule.classifyAdl({ ...base, extra: 'unexpected' }).error.code, 'INVALID_ADL_ANSWER_NOT_DERIVABLE')
  })

  runCase('UNKNOWN_NONORDINAL_NO_STAIRS_BOUNDARIES', () => {
    const unknown = adlModule.classifyAdl(elderProfileFixtures.find((item) => item.id === 'C14').answers).classification
    assert.equal(unknown.derivedFacts.careLevel.status, 'unknown')
    assert.equal(Object.prototype.hasOwnProperty.call(unknown.derivedFacts.careLevel, 'value'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(unknown.derivedFacts.careLevel, 'candidateValue'), false)
    assert.deepEqual(unknown.derivedFacts.unknownQuestionIds, ['adl.bathing'])
    assert.equal(unknown.derivedFacts.observationCoverage.status, 'unknown')
    const special = adlModule.classifyAdl(elderProfileFixtures.find((item) => item.id === 'C06').answers).classification
    assert.equal(special.derivedFacts.observationCoverage.status, 'limited')
    assert.equal(special.derivedFacts.careModes[0].status, 'needs_confirmation')
    assert.equal(special.evidence.find((item) => item.derivedField === 'adl.careLevel').sources[0].contribution, 'limits_confidence')
    const noStairs = adlModule.classifyAdl(elderProfileFixtures.find((item) => item.id === 'C11').answers).classification
    assert.deepEqual(noStairs.derivedFacts.observationCoverage.issues, ['stairs_not_applicable'])
    assert.equal(noStairs.derivedFacts.careModes[0].status, 'context')
    assert.equal(noStairs.evidence.find((item) => item.derivedField === 'adl.careModes.no_stairs_context').ruleId, 'adl-ruleset-v1:C_NO_STAIRS_NEUTRAL')
    assert.equal(noStairs.evidence.find((item) => item.derivedField === 'adl.careModes.no_stairs_context').sources[0].contribution, 'excluded_not_applicable')
  })

  runCase('CARE_LEVEL_EVIDENCE_ONLY_INFLUENCING_BURDENS', () => {
    const result = adlModule.classifyAdl({
      eating: 'independent',
      mobility: 'wheelchair',
      toileting: 'independent',
      bathing: 'independent',
      dressing: 'independent',
      transfer: 'independent',
      stairs: 'no_stairs',
    })
    assert.equal(result.ok, true)
    const sources = result.classification.evidence.find((item) => item.derivedField === 'adl.careLevel').sources
    assert.deepEqual(sources.map((source) => source.sourceQuestionId), ['adl.mobility', 'adl.stairs'])
    assert.deepEqual(sources.map((source) => source.sourceOptionCode), ['wheelchair', 'no_stairs'])
    assert.deepEqual(sources.map((source) => source.contribution), ['supports', 'excluded_not_applicable'])

    const noStairsAcrossRules = [
      { rule: 'C_SEVERE_OVERRIDE', mobility: 'bedridden' },
      { rule: 'C_DEPENDENT_FLOOR', eating: 'needs_feeding' },
      { rule: 'C_TWO_HALF_ESCALATION', mobility: 'wheelchair', bathing: 'full_assistance' },
      { rule: 'C_NON_CORE_HALF_FALLBACK', bathing: 'full_assistance', dressing: 'full_assistance' },
      { rule: 'C_HALF_FLOOR', mobility: 'wheelchair' },
      { rule: 'C_TWO_LIGHT_ESCALATION', mobility: 'walking_aid', bathing: 'partial_assistance' },
      { rule: 'C_TWO_LIGHT_ESCALATION', mobility: 'walking_aid' },
    ]
    noStairsAcrossRules.forEach((fixture) => {
      const branch = adlModule.classifyAdl({
        eating: fixture.eating || 'independent',
        mobility: fixture.mobility || 'independent',
        toileting: 'independent',
        bathing: fixture.bathing || 'independent',
        dressing: fixture.dressing || 'independent',
        transfer: 'independent',
        stairs: 'no_stairs',
      })
      assert.equal(branch.ok, true)
      const branchEvidence = branch.classification.evidence.find((item) => item.derivedField === 'adl.careLevel')
      assert.equal(branchEvidence.ruleId, `adl-ruleset-v1:${fixture.rule}`)
      const stairsSource = branchEvidence.sources.find((source) => source.sourceQuestionId === 'adl.stairs')
      assert.deepEqual(stairsSource, {
        sourceKind: 'assessment_option',
        sourceQuestionId: 'adl.stairs',
        sourceOptionCode: 'no_stairs',
        contribution: 'excluded_not_applicable',
      })
    })
  })

  runCase('REHABILITATION_CONFLICT', () => {
    const assessment = makeCompletedAssessment({
      'health.rehabilitationNeed': 'none',
      'cognitive.specialCareNeeds': ['rehabilitation_training'],
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const fact = result.profile.health.derivedFacts.rehabilitationNeed
    assert.equal(fact.status, 'needs_confirmation')
    assert.equal(fact.candidateValue, 'required')
    const clarification = result.profile.clarifications.find((item) =>
      item.clarificationId === 'cl:cross_answer_conflict:health.rehabilitationNeed')
    assert.ok(clarification)
    assert.deepEqual(clarification.sources.map((source) => source.sourceQuestionId), [
      'health.rehabilitationNeed', 'cognitive.specialCareNeeds',
    ])
    assert.deepEqual(clarification.affectedDerivedFields, ['health.rehabilitationNeed'])
    assertCompleteProfileContract(result.profile, assessment, [])
  })

  runCase('MULTIPLE_UNKNOWN_FACTS_REMAIN_UNKNOWN', () => {
    const assessment = makeCompletedAssessment({
      'health.conditions': ['unknown'],
      'health.recentEvents': ['unknown'],
      'adl.mobility': 'unknown',
      'adl.toileting': 'unknown',
      'cognitive.symptoms': ['unknown'],
      'cognitive.specialCareNeeds': ['unknown'],
      'health.rehabilitationNeed': 'unknown',
      'budget.monthlyRange': 'unknown',
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    assert.equal(result.profile.adl.derivedFacts.careLevel.status, 'unknown')
    assert.deepEqual(result.profile.adl.derivedFacts.unknownQuestionIds, ['adl.mobility', 'adl.toileting'])
    assert.equal(result.profile.mobility.derivedFacts.level.status, 'unknown')
    assert.equal(result.profile.cognition.derivedFacts.cognitiveConcern.status, 'unknown')
    assert.equal(result.profile.health.derivedFacts.rehabilitationNeed.status, 'unknown')
    assert.equal(result.profile.specialCare.derivedFacts.requiredCareCapabilities.every((item) => item.status === 'unknown'), true)
    result.profile.evidence.forEach((item) => item.sources.forEach((source) => {
      if (source.sourceKind === 'assessment_answer_set') {
        assert.equal(source.sourceOptionCodes.indexOf('unknown'), -1, `${item.evidenceId} must not use unknown answer-set absence`)
      }
    }))
    assertExactEvidenceFieldSet(result.profile, [])
    assertCapabilityOrder(result.profile)
    assertSourceSnapshots(result.profile, assessment)
    assertClarificationReferences(result.profile, assessment)
    assertSummaryContract(result.profile, assessment, [])
  })

  runCase('LOW_AND_HIGH_BUDGET_SNAPSHOTS', () => {
    const lowAssessment = makeCompletedAssessment({ 'budget.monthlyRange': 'cny_3500_5000' })
    const highAssessment = makeCompletedAssessment({ 'budget.monthlyRange': 'cny_15000_plus' })
    const low = deriveModule.deriveElderProfile(lowAssessment)
    const high = deriveModule.deriveElderProfile(highAssessment)
    assert.equal(low.ok, true)
    assert.equal(high.ok, true)
    assert.equal(low.profile.financial.rawFacts.monthlyBudget, 'cny_3500_5000')
    assert.equal(high.profile.financial.rawFacts.monthlyBudget, 'cny_15000_plus')
    assertCompleteProfileContract(low.profile, lowAssessment, [])
    assertCompleteProfileContract(high.profile, highAssessment, [])
  })

  runCase('ALZHEIMERS_AND_COGNITIVE_NONE_CONFLICT', () => {
    const assessment = makeCompletedAssessment({
      'health.conditions': ['alzheimers_disease'],
      'cognitive.symptoms': ['none'],
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    assert.equal(result.profile.cognition.derivedFacts.cognitiveConcern.status, 'needs_confirmation')
    assert.equal(result.profile.cognition.derivedFacts.cognitiveConcern.candidateValue, 'present')
    assert.equal(result.profile.cognition.derivedFacts.reportedDiagnosis.value, 'reported')
    const clarification = result.profile.clarifications.find((item) =>
      item.clarificationId === 'cl:cross_answer_conflict:cognition.cognitiveConcern')
    assert.ok(clarification)
    assert.deepEqual(clarification.sources.map((source) => source.sourceQuestionId), [
      'health.conditions', 'cognitive.symptoms',
    ])
    assert.deepEqual(clarification.affectedDerivedFields, ['cognition.cognitiveConcern'])
    assertCompleteProfileContract(result.profile, assessment, [])
  })

  runCase('UNKNOWN_HEALTH_NOT_ABSENCE_EVIDENCE', () => {
    const assessment = makeCompletedAssessment({
      'health.conditions': ['unknown'],
      'cognitive.symptoms': ['memory_decline'],
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    assert.equal(result.profile.cognition.derivedFacts.cognitiveConcern.value, 'present')
    assert.equal(result.profile.cognition.derivedFacts.reportedDiagnosis.value, 'not_reported')
    const diagnosisEvidence = fieldEvidence(result.profile, 'cognition.reportedDiagnosis')
    assert.equal(diagnosisEvidence.sources.some((source) => source.sourceKind === 'assessment_answer_set' && source.sourceQuestionId === 'health.conditions'), false)
    const dementiaUnit = result.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) =>
      item.capability === 'dementia_unit')
    assert.equal(dementiaUnit.status, 'not_required', 'memory decline must not become a required dementia unit')
    assertCompleteProfileContract(result.profile, assessment, [])
  })

  runCase('DIRECT_CAPABILITY_VS_ADL_CLUE', () => {
    const directTubeAssessment = makeCompletedAssessment({
      'adl.eating': 'special_feeding',
      'cognitive.specialCareNeeds': ['tube_feeding'],
    })
    const directTube = deriveModule.deriveElderProfile(directTubeAssessment)
    assert.equal(directTube.ok, true)
    const tube = directTube.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) => item.capability === 'tube_feeding')
    assert.equal(tube.status, 'required')
    assert.equal(directTube.profile.adl.derivedFacts.careModes.some((item) => item.code === 'special_feeding_review' && item.status === 'needs_confirmation'), true)
    assertCompleteProfileContract(directTube.profile, directTubeAssessment, ['special_feeding_review'])

    const clueTubeAssessment = makeCompletedAssessment({
      'adl.eating': 'special_feeding',
    })
    const clueTube = deriveModule.deriveElderProfile(clueTubeAssessment)
    assert.equal(clueTube.ok, true)
    const clueTubeFact = clueTube.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) => item.capability === 'tube_feeding')
    assert.equal(clueTubeFact.status, 'needs_confirmation')
    assertCompleteProfileContract(clueTube.profile, clueTubeAssessment, ['special_feeding_review'])

    const directCatheterAssessment = makeCompletedAssessment({
      'adl.toileting': 'catheter_or_stoma',
      'cognitive.specialCareNeeds': ['catheter_care'],
    })
    const directCatheter = deriveModule.deriveElderProfile(directCatheterAssessment)
    assert.equal(directCatheter.ok, true)
    assert.equal(directCatheter.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) => item.capability === 'catheter_care').status, 'required')
    assert.equal(directCatheter.profile.adl.derivedFacts.careModes.some((item) => item.code === 'catheter_or_stoma_review'), true)
    assertCompleteProfileContract(directCatheter.profile, directCatheterAssessment, ['catheter_or_stoma_review'])

    const clueCatheterAssessment = makeCompletedAssessment({
      'adl.toileting': 'catheter_or_stoma',
    })
    const clueCatheter = deriveModule.deriveElderProfile(clueCatheterAssessment)
    assert.equal(clueCatheter.ok, true)
    const clueCatheterFact = clueCatheter.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) => item.capability === 'catheter_care')
    assert.equal(clueCatheterFact.status, 'needs_confirmation')
    assert.deepEqual(clueCatheterFact.clarificationIds, ['cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.catheter_care'])
    assertCompleteProfileContract(clueCatheter.profile, clueCatheterAssessment, ['catheter_or_stoma_review'])

    const noAutoCapabilityAssessment = makeCompletedAssessment({
      'basic.age': 110,
      'basic.livingStatus': 'alone',
      'adl.mobility': 'bedridden',
      'cognitive.specialCareNeeds': ['night_care'],
    })
    const noAutoCapability = deriveModule.deriveElderProfile(noAutoCapabilityAssessment)
    assert.equal(noAutoCapability.ok, true)
    assert.equal(noAutoCapability.profile.adl.derivedFacts.careLevel.value, 'severely_disabled')
    assert.equal(noAutoCapability.profile.cognition.derivedFacts.reportedDiagnosis.value, 'not_reported')
    assert.equal(noAutoCapability.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) =>
      item.capability === 'round_the_clock_care').status, 'not_reported')
    assert.equal(noAutoCapability.profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) =>
      item.capability === 'one_to_one_caregiver').status, 'not_reported')
    assertCompleteProfileContract(noAutoCapability.profile, noAutoCapabilityAssessment, ['bedridden'])
  })

  runCase('FULL_ANSWER_SET_ABSENCE_EVIDENCE', () => {
    const assessment = makeCompletedAssessment({
      'cognitive.specialCareNeeds': ['night_care'],
      'cognitive.symptoms': ['memory_decline'],
      'health.conditions': ['hypertension'],
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const tubeEvidence = fieldEvidence(result.profile, 'specialCare.requiredCareCapabilities.tube_feeding')
    assert.deepEqual(tubeEvidence.sources, [{
      sourceKind: 'assessment_answer_set',
      sourceQuestionId: 'cognitive.specialCareNeeds',
      sourceOptionCodes: ['night_care'],
      targetOptionCode: 'tube_feeding',
      contribution: 'establishes_not_reported',
    }])
    const wanderingEvidence = fieldEvidence(result.profile, 'cognition.wanderingRisk')
    assert.equal(wanderingEvidence.sources[0].sourceKind, 'assessment_answer_set')
    assert.deepEqual(wanderingEvidence.sources[0].sourceOptionCodes, ['memory_decline'])
    assert.equal(wanderingEvidence.sources[0].targetOptionCode, 'wandering_risk')
    assertCompleteProfileContract(result.profile, assessment, [])
  })

  runCase('EVIDENCE_CLARIFICATION_SUMMARY_CONTRACT', () => {
    const assessment = makeCompletedAssessment({
      'adl.bathing': 'unknown',
      'cognitive.specialCareNeeds': ['other'],
      'cognitive.symptoms': ['gets_lost'],
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const profile = result.profile
    assertExactEvidenceFieldSet(profile, [])
    assertCapabilityOrder(profile)
    assertClarificationReferences(profile, assessment)
    assertSourceSnapshots(profile, assessment)
    assertSummaryContract(profile, assessment, [])
  })

  runCase('DETERMINISTIC_REPEAT_AND_NO_SIDE_EFFECTS', () => {
    const assessment = makeCompletedAssessment({ 'adl.mobility': 'wheelchair' })
    const before = clone(assessment)
    const first = deriveModule.deriveElderProfile(assessment)
    const second = deriveModule.deriveElderProfile(assessment)
    assert.deepEqual(first, second)
    assert.deepEqual(assessment, before)
    assert.equal(first.ok, true)
    assertCompleteProfileContract(first.profile, assessment, ['wheelchair'])
    assertPureDependencyGraph(loadedSourcePaths)
    assert.equal(rulesModule.ADL_RULESET_VERSION, 'adl-ruleset-v1')
  })

  // Every emitted evidence record is exactly one final record for its field.
  runCase('ONE_FINAL_EVIDENCE_PER_DERIVED_FIELD', () => {
    const assessment = makeCompletedAssessment({
      'adl.eating': 'special_feeding',
      'adl.toileting': 'catheter_or_stoma',
      'adl.stairs': 'no_stairs',
      'cognitive.symptoms': ['gets_lost', 'mood_instability', 'sleep_wake_disorder'],
      'cognitive.specialCareNeeds': ['night_care'],
      'health.rehabilitationNeed': 'possible',
    })
    const result = deriveModule.deriveElderProfile(assessment)
    assert.equal(result.ok, true)
    const expectedModes = ['special_feeding_review', 'catheter_or_stoma_review', 'no_stairs_context']
    assertExactEvidenceFieldSet(result.profile, expectedModes)
    assertCapabilityOrder(result.profile)
    assertRawMapping(result.profile, assessment)
    assertSourceSnapshots(result.profile, assessment)
    assertClarificationReferences(result.profile, assessment)
    assertSummaryContract(result.profile, assessment, expectedModes)
  })

  assert.deepEqual(caseIds, EXPECTED_CASE_IDS, 'formal runtime case ID set/order drifted')
  assert.equal(new Set(caseIds).size, caseIds.length, 'formal runtime case IDs are not unique')

  if (failures.length > 0) {
    console.error(`ELDER PROFILE RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`ELDER PROFILE RUNTIME PASS: ${caseCount} cases`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`ELDER PROFILE RUNTIME ERROR: ${message}`)
  process.exitCode = 1
}
