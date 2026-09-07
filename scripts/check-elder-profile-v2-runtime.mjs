import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  elderProfileV2Fixtures,
  elderProfileV2ParityFixtures,
  makeAssessmentDraftV2,
  makeCompletedAssessmentV2,
} from './fixtures/elder-profile-v2-fixtures.mjs'
import {
  elderProfileFixtures,
  makeCompletedAssessment,
} from './fixtures/elder-profile-fixtures.mjs'
import { makePreviewDraft } from './fixtures/elder-profile-preview-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const v2EntryPath = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'v2', 'index.ts')
const v1EntryPath = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'index.ts')
const v2DomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'v2')
const v2TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'elder-profile-v2.ts')
const failures = []
const caseIds = []

const EXPECTED_PROFILE_FIXTURE_IDS = Object.freeze(Array.from(
  { length: 18 },
  (_, index) => `PROFILE-V2-${String(index + 1).padStart(3, '0')}`,
))
const EXPECTED_PARITY_FIXTURE_IDS = Object.freeze(Array.from(
  { length: 5 },
  (_, index) => `PARITY-V2-${String(index + 1).padStart(3, '0')}`,
))
const SUMMARY_SECTION_ORDER_V2 = Object.freeze([
  'basic',
  'health',
  'nutrition',
  'adl',
  'mobility',
  'cognition',
  'special_care',
  'preference',
  'financial_intent',
])
const V2_NEW_EVIDENCE_FIELDS = Object.freeze([
  'nutrition.foodTextureSupport',
  'nutrition.swallowingConcern',
  'preference.roomTypePreference',
  'preference.mealSchedulePreference',
  'preference.activityPreference',
  'preference.priorities',
])
const V1_LEGACY_PRIORITY_CODES = Object.freeze([
  'nursing_professionalism',
  'caregiver_attitude',
  'overall_quality',
  'recreational_activities',
  'close_to_family',
  'dementia_care',
])
const ADL_SHORT_TO_QUESTION = Object.freeze({
  eating: 'adl.eating',
  mobility: 'adl.mobility',
  toileting: 'adl.toileting',
  bathing: 'adl.bathing',
  dressing: 'adl.dressing',
  transfer: 'adl.transfer',
  stairs: 'adl.stairs',
})
const RAW_TARGET_MAPPINGS_V2 = Object.freeze([
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
  ['health.chewingAbility', ['nutrition', 'rawFacts', 'chewingAbilityAnswer']],
  ['health.swallowingAbility', ['nutrition', 'rawFacts', 'swallowingAbilityAnswer']],
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
  ['preference.roomType', ['preference', 'rawFacts', 'roomTypePreference']],
  ['preference.mealSchedule', ['preference', 'rawFacts', 'mealSchedulePreference']],
  ['preference.activityPreference', ['preference', 'rawFacts', 'activityPreference']],
  ['preference.priorities', ['preference', 'rawFacts', 'priorities']],
  ['preference.region', ['preference', 'rawFacts', 'regionPreference']],
  ['budget.monthlyRange', ['financial', 'rawFacts', 'monthlyBudget']],
  ['budget.upfrontCostAcceptance', ['financial', 'rawFacts', 'depositTolerance']],
  ['budget.moveInTiming', ['intent', 'rawFacts', 'moveInTiming']],
  ['budget.consultantSupport', ['intent', 'rawFacts', 'consultantIntent']],
])

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const getAtPath = (value, segments) => segments.reduce((current, segment) => current?.[segment], value)

const formatDiagnostic = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) {
    return message
  }
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1} ${message}`
}

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    return { parser: require(parserPath), parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  try {
    const parserPath = require.resolve('typescript')
    return { parser: require(parserPath), parserPath, source: 'local typescript' }
  } catch {
    // The repository intentionally does not depend on TypeScript at runtime.
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
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) {
      continue
    }
    for (const runtime of await readdir(packageRoot, { withFileTypes: true })) {
      const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('WeChat DevTools TypeScript parser not found')
  }
  return {
    parser: require(candidates[0].parserPath),
    parserPath: candidates[0].parserPath,
    source: 'WeChat DevTools mptslib',
  }
}

const createSourceLoader = (typescript, loadedSourcePaths, loadedSourceTexts) => {
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
      throw new Error(`V2 runtime must not load tmp artifact: ${resolvedPath}`)
    }
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    loadedSourcePaths.add(resolvedPath)
    const source = readFileSync(resolvedPath, 'utf8')
    loadedSourceTexts.set(resolvedPath, source)
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
        reportDiagnostics: true,
      })
      : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((diagnostic) =>
      diagnostic.category === typescript.DiagnosticCategory.Error,
    )
    if (errors.length > 0) {
      throw new Error(errors.map((diagnostic) => formatDiagnostic(typescript, diagnostic)).join('\n'))
    }
    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        throw new Error(`Pure V2 profile runtime forbids external import ${request} from ${resolvedPath}`)
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

const runCase = (id, test) => {
  caseIds.push(id)
  try {
    test()
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const findEvidence = (profile, derivedField) =>
  profile.evidence.find((item) => item.derivedField === derivedField)

const findCapability = (profile, capability) =>
  profile.specialCare.derivedFacts.requiredCareCapabilities.find((item) => item.capability === capability)

const semanticFromFormal = (profile) => {
  const { kind: _kind, identity: _identity, ...semantics } = profile
  return semantics
}

const semanticFromPreview = (preview) => {
  const {
    kind: _kind,
    source: _source,
    profileContractVersion: _profileContractVersion,
    derivationRulesetVersion: _derivationRulesetVersion,
    ...semantics
  } = preview
  return semantics
}

const assertNoKeyDeep = (value, forbiddenKeys, location = 'preview') => {
  if (!value || typeof value !== 'object') {
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoKeyDeep(item, forbiddenKeys, `${location}[${index}]`))
    return
  }
  Object.entries(value).forEach(([key, child]) => {
    assert.equal(forbiddenKeys.includes(key), false, `${location} contains forbidden key ${key}`)
    assertNoKeyDeep(child, forbiddenKeys, `${location}.${key}`)
  })
}

const assertProfileEnvelope = (profile) => {
  assert.equal(profile.kind, 'elder_profile')
  assert.equal(profile.identity.assessmentSchemaVersion, 2)
  assert.equal(profile.identity.profileContractVersion, 'elder-profile-contract-v2')
  assert.equal(profile.identity.derivationRulesetVersion, 'elder-profile-ruleset-v2')
  assert.equal(profile.adl.derivedFacts.rulesetVersion, 'adl-ruleset-v1')
  assert.equal(profile.userFacingSummary.summarySchemaVersion, 'elder-profile-summary-input-v2')
  assert.deepEqual(profile.userFacingSummary.sections.map((section) => section.section), SUMMARY_SECTION_ORDER_V2)
  const evidenceIds = profile.evidence.map((item) => item.evidenceId)
  assert.equal(new Set(evidenceIds).size, evidenceIds.length, 'evidence IDs must be unique')
  V2_NEW_EVIDENCE_FIELDS.forEach((field) => {
    const evidence = findEvidence(profile, field)
    assert.ok(evidence, `missing V2 evidence ${field}`)
    assert.ok(evidence.sources.length > 0, `${field} evidence must have sources`)
  })
  assert.equal(
    profile.preference.rawFacts.priorities.some((code) => V1_LEGACY_PRIORITY_CODES.includes(code)),
    false,
    'V1 legacy priority must not appear in V2 output',
  )
}

const assertFixtureExpectation = (profile, expected) => {
  if (expected.foodTexture) {
    const fact = profile.nutrition.derivedFacts.foodTextureSupport
    assert.equal(fact.status, expected.foodTexture.status)
    if (expected.foodTexture.value !== undefined) {
      assert.equal(fact.value, expected.foodTexture.value)
    }
  }
  if (expected.swallowing) {
    const fact = profile.nutrition.derivedFacts.swallowingConcern
    assert.equal(fact.status, expected.swallowing.status)
    if (expected.swallowing.value !== undefined) {
      assert.equal(fact.value, expected.swallowing.value)
    }
    if (expected.swallowing.candidateValue !== undefined) {
      assert.equal(fact.candidateValue, expected.swallowing.candidateValue)
    }
  }
  if (expected.clarificationId) {
    assert.ok(profile.clarifications.some((item) => item.clarificationId === expected.clarificationId))
  }
  if (expected.tubeFeedingStatus) {
    assert.equal(findCapability(profile, 'tube_feeding').status, expected.tubeFeedingStatus)
  }
  if (expected.roomType) {
    assert.equal(profile.preference.rawFacts.roomTypePreference, expected.roomType)
  }
  if (expected.mealSchedule) {
    assert.equal(profile.preference.rawFacts.mealSchedulePreference, expected.mealSchedule)
  }
  if (expected.activityPreference) {
    assert.equal(profile.preference.rawFacts.activityPreference, expected.activityPreference)
  }
  if (expected.priorities) {
    assert.deepEqual(profile.preference.rawFacts.priorities, expected.priorities)
    const priorityEvidence = findEvidence(profile, 'preference.priorities')
    assert.deepEqual(
      priorityEvidence.sources.map((source) => source.sourceOptionCode),
      expected.priorities,
    )
  }
  if (expected.advisory !== undefined) {
    const advisories = profile.financial.derivedFacts.budgetAdvisories
    assert.equal(advisories.length === 1, expected.advisory)
    const evidence = findEvidence(profile, 'financial.budgetAdvisory.highCareLowBudget')
    assert.equal(Boolean(evidence), expected.advisory)
    if (expected.advisory) {
      assert.equal(advisories[0].code, 'HIGH_CARE_LOW_BUDGET')
      assert.equal(advisories[0].role, 'advisory_only')
      assert.deepEqual(advisories[0].triggerCodes, expected.triggers)
      assert.equal(
        evidence.sources.some((source) =>
          source.sourceQuestionId === 'budget.monthlyRange'
          && source.sourceOptionCode === 'cny_3500_5000'),
        true,
      )
      assert.ok(advisories[0].triggerEvidenceIds.length === expected.triggers.length)
      advisories[0].triggerEvidenceIds.forEach((evidenceId) => {
        const triggerEvidence = profile.evidence.find((item) => item.evidenceId === evidenceId)
        assert.ok(triggerEvidence)
        triggerEvidence.sources.forEach((source) => {
          assert.equal(
            evidence.sources.some((candidate) => JSON.stringify(candidate) === JSON.stringify(source)),
            true,
            `advisory evidence must retain sources from ${evidenceId}`,
          )
        })
      })
    }
  }
}

const optionalRawMappingCase = (deriveElderProfileV2) => {
  const assessment = makeCompletedAssessmentV2({
    'basic.elderName': '示例老人',
    'basic.livingStatus': 'with_children',
    'basic.primaryCaregiver': 'children',
    'basic.hasInstitutionExperience': 'true',
    'basic.institutionExitReasons': ['too_far', 'unsatisfactory_food'],
    'preference.region': {
      kind: 'institution_region',
      regionCode: 'mock-region-v2',
      regionLabelSnapshot: '示例区域',
      catalogVersion: 'fixture-catalog-v2',
    },
  })
  const before = clone(assessment)
  const result = deriveElderProfileV2(assessment)
  assert.equal(result.ok, true)
  assert.deepEqual(assessment, before)
  const profile = result.profile
  assert.equal(RAW_TARGET_MAPPINGS_V2.length, 32)
  RAW_TARGET_MAPPINGS_V2.forEach(([questionId, targetPath]) => {
    assert.deepEqual(getAtPath(profile, targetPath), assessment.answers[questionId], `${questionId} raw mapping`)
  })
  assert.notEqual(profile.basic.rawFacts.institutionExitReasons, assessment.answers['basic.institutionExitReasons'])
  assert.deepEqual(profile.preference.rawFacts.regionPreference, assessment.answers['preference.region'])
  assert.notEqual(profile.preference.rawFacts.regionPreference, assessment.answers['preference.region'])
}

const run = async () => {
  assert.deepEqual(elderProfileV2Fixtures.map((fixture) => fixture.id), EXPECTED_PROFILE_FIXTURE_IDS)
  assert.deepEqual(elderProfileV2ParityFixtures.map((fixture) => fixture.id), EXPECTED_PARITY_FIXTURE_IDS)

  const { parser: typescript, parserPath, source: parserSource } = await getTypeScriptParser()
  const loadedSourcePaths = new Set()
  const loadedSourceTexts = new Map()
  const loadModule = createSourceLoader(typescript, loadedSourcePaths, loadedSourceTexts)
  const v2Domain = loadModule(v2EntryPath)
  const v1Domain = loadModule(v1EntryPath)
  const { deriveElderProfileV2, deriveElderProfilePreviewV2 } = v2Domain
  const { deriveElderProfile, deriveElderProfilePreview } = v1Domain
  assert.equal(typeof deriveElderProfileV2, 'function')
  assert.equal(typeof deriveElderProfilePreviewV2, 'function')

  elderProfileV2Fixtures.forEach((fixture) => runCase(fixture.id, () => {
    const assessment = makeCompletedAssessmentV2(fixture.answers, {
      id: `assessment-${fixture.id.toLowerCase()}`,
      elderId: `elder-${fixture.id.toLowerCase()}`,
    })
    const before = clone(assessment)
    const result = deriveElderProfileV2(assessment)
    assert.equal(result.ok, true)
    assert.deepEqual(assessment, before, 'formal derivation must not mutate input')
    assertProfileEnvelope(result.profile)
    assertFixtureExpectation(result.profile, fixture.expected)
    if (fixture.expected.deterministicRepeat) {
      assert.deepEqual(deriveElderProfileV2(clone(assessment)), result)
    }
  }))

  elderProfileV2ParityFixtures.forEach((fixture) => runCase(fixture.id, () => {
    const assessment = makeCompletedAssessmentV2(clone(fixture.answers), {
      id: `assessment-${fixture.id.toLowerCase()}`,
      elderId: `elder-${fixture.id.toLowerCase()}`,
    })
    const draft = makeAssessmentDraftV2(clone(fixture.answers), {
      localDraftId: `local-${fixture.id.toLowerCase()}`,
    })
    const assessmentBefore = clone(assessment)
    const draftBefore = clone(draft)
    const formal = deriveElderProfileV2(assessment)
    const preview = deriveElderProfilePreviewV2(draft)
    assert.equal(formal.ok, true)
    assert.equal(preview.ok, true)
    assert.deepEqual(assessment, assessmentBefore)
    assert.deepEqual(draft, draftBefore)
    assert.deepEqual(semanticFromFormal(formal.profile), semanticFromPreview(preview.preview))
    assert.equal(preview.preview.kind, 'elder_profile_preview')
    assert.deepEqual(preview.preview.source, {
      kind: 'local_assessment_preview',
      localDraftId: `local-${fixture.id.toLowerCase()}`,
      assessmentSchemaVersion: 2,
    })
    assert.equal(preview.preview.profileContractVersion, 'elder-profile-contract-v2')
    assert.equal(preview.preview.derivationRulesetVersion, 'elder-profile-ruleset-v2')
    assertNoKeyDeep(preview.preview, [
      'assessmentId',
      'elderId',
      'completedAt',
      'assessmentCompletedAt',
      'generatedAt',
      'previewId',
      'recommendationId',
      'serverId',
    ])
    assert.deepEqual(deriveElderProfilePreviewV2(clone(draft)), preview)
  }))

  runCase('V2-RAW-001', () => optionalRawMappingCase(deriveElderProfileV2))

  runCase('V2-INPUT-001', () => {
    const v1FormalInV2 = deriveElderProfileV2(makeCompletedAssessment())
    assert.equal(v1FormalInV2.ok, false)
    assert.equal(v1FormalInV2.error.code, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    const v2FormalInV1 = deriveElderProfile(makeCompletedAssessmentV2())
    assert.equal(v2FormalInV1.ok, false)
    assert.equal(v2FormalInV1.error.code, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
  })

  runCase('V2-INPUT-002', () => {
    const v1Draft = makePreviewDraft(makeCompletedAssessment().answers, 'v1-local')
    const v1DraftInV2 = deriveElderProfilePreviewV2(v1Draft)
    assert.equal(v1DraftInV2.ok, false)
    assert.equal(v1DraftInV2.error.code, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    const v2DraftInV1 = deriveElderProfilePreview(makeAssessmentDraftV2())
    assert.equal(v2DraftInV1.ok, false)
    assert.equal(v2DraftInV1.error.code, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
  })

  runCase('V2-INPUT-003', () => {
    const incomplete = makeCompletedAssessmentV2()
    delete incomplete.answers['health.chewingAbility']
    const incompleteResult = deriveElderProfileV2(incomplete)
    assert.equal(incompleteResult.ok, false)
    assert.equal(incompleteResult.error.code, 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE')
    assert.deepEqual(incompleteResult.error.questionIds, ['health.chewingAbility'])

    const invalid = makeCompletedAssessmentV2({ 'health.chewingAbility': 'unsupported-code' })
    const invalidResult = deriveElderProfileV2(invalid)
    assert.equal(invalidResult.ok, false)
    assert.equal(invalidResult.error.code, 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE')
    assert.deepEqual(invalidResult.error.questionIds, ['health.chewingAbility'])

    const badTimestamp = deriveElderProfileV2(makeCompletedAssessmentV2({}, { completedAt: '2026-02-30T10:00:00Z' }))
    assert.equal(badTimestamp.ok, false)
    assert.equal(badTimestamp.error.code, 'INVALID_COMPLETED_AT_TIMESTAMP')
  })

  runCase('V2-INPUT-004', () => {
    const incomplete = makeAssessmentDraftV2()
    delete incomplete.answers['preference.roomType']
    const result = deriveElderProfilePreviewV2(incomplete)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE')
    assert.deepEqual(result.error.questionIds, ['preference.roomType'])

    const invalid = makeAssessmentDraftV2()
    invalid.extra = true
    const invalidResult = deriveElderProfilePreviewV2(invalid)
    assert.equal(invalidResult.ok, false)
    assert.equal(invalidResult.error.code, 'INVALID_DRAFT_STRUCTURE')
  })

  runCase('V2-ADL-PARITY-001', () => {
    let compared = 0
    elderProfileFixtures.filter((fixture) => fixture.id !== 'C15').forEach((fixture) => {
      const answerOverrides = {}
      Object.entries(ADL_SHORT_TO_QUESTION).forEach(([shortKey, questionId]) => {
        answerOverrides[questionId] = fixture.answers[shortKey]
      })
      const v1Result = deriveElderProfile(makeCompletedAssessment(answerOverrides))
      const v2Result = deriveElderProfileV2(makeCompletedAssessmentV2(answerOverrides))
      assert.equal(v1Result.ok, true, `${fixture.id} V1 derivation`)
      assert.equal(v2Result.ok, true, `${fixture.id} V2 derivation`)
      assert.deepEqual(v2Result.profile.adl, v1Result.profile.adl, `${fixture.id} ADL parity`)
      assert.deepEqual(v2Result.profile.mobility, v1Result.profile.mobility, `${fixture.id} mobility parity`)
      compared += 1
    })
    assert.equal(compared, 22)
  })

  runCase('V2-NUTRITION-ADL-ISOLATION-001', () => {
    const variants = [
      {},
      { 'health.chewingAbility': 'easy_chew' },
      { 'health.chewingAbility': 'modified_food' },
      { 'health.swallowingAbility': 'occasional_difficulty' },
      { 'health.swallowingAbility': 'significant_difficulty' },
      { 'health.chewingAbility': 'unknown', 'health.swallowingAbility': 'unknown' },
    ]
    const profiles = variants.map((answers) => deriveElderProfileV2(makeCompletedAssessmentV2(answers)))
    profiles.forEach((result) => assert.equal(result.ok, true))
    const baseline = profiles[0].profile.adl
    profiles.slice(1).forEach((result) => assert.deepEqual(result.profile.adl, baseline))
  })

  runCase('V2-NUTRITION-CLARIFICATION-001', () => {
    const result = deriveElderProfileV2(makeCompletedAssessmentV2({
      'health.chewingAbility': 'unknown',
      'health.swallowingAbility': 'unknown',
    }))
    assert.equal(result.ok, true)
    const profile = result.profile
    assert.equal(profile.nutrition.derivedFacts.foodTextureSupport.status, 'unknown')
    assert.equal(profile.nutrition.derivedFacts.swallowingConcern.status, 'unknown')
    ;[
      'cl:unknown_answer:health.chewingAbility',
      'cl:unknown_answer:health.swallowingAbility',
    ].forEach((clarificationId) => {
      const clarification = profile.clarifications.find((item) => item.clarificationId === clarificationId)
      assert.ok(clarification, `missing ${clarificationId}`)
      assert.equal(clarification.priority, 'required_before_hard_filter')
    })
    const foodEvidence = findEvidence(profile, 'nutrition.foodTextureSupport')
    const swallowingEvidence = findEvidence(profile, 'nutrition.swallowingConcern')
    assert.equal(foodEvidence.sources[0].sourceQuestionId, 'health.chewingAbility')
    assert.equal(foodEvidence.sources[0].sourceOptionCode, 'unknown')
    assert.equal(swallowingEvidence.sources[0].sourceQuestionId, 'health.swallowingAbility')
    assert.equal(swallowingEvidence.sources[0].sourceOptionCode, 'unknown')
  })

  runCase('V2-TUBE-FEEDING-BOUNDARY-001', () => {
    ;['normal', 'occasional_difficulty', 'significant_difficulty', 'unknown'].forEach((swallowing) => {
      const result = deriveElderProfileV2(makeCompletedAssessmentV2({
        'health.swallowingAbility': swallowing,
        'cognitive.specialCareNeeds': ['none'],
      }))
      assert.equal(result.ok, true)
      assert.equal(findCapability(result.profile, 'tube_feeding').status, 'not_required')
    })
    const specialFeeding = deriveElderProfileV2(makeCompletedAssessmentV2({
      'adl.eating': 'special_feeding',
      'cognitive.specialCareNeeds': ['night_care'],
    }))
    assert.equal(specialFeeding.ok, true)
    assert.equal(findCapability(specialFeeding.profile, 'tube_feeding').status, 'needs_confirmation')
    const explicit = deriveElderProfileV2(makeCompletedAssessmentV2({
      'cognitive.specialCareNeeds': ['tube_feeding'],
    }))
    assert.equal(explicit.ok, true)
    assert.equal(findCapability(explicit.profile, 'tube_feeding').status, 'required')
  })

  runCase('V2-PURITY-001', () => {
    assert.equal(v2Domain.ADL_RULESET_VERSION_V2, 'adl-ruleset-v1')
    assert.equal(v2Domain.MEAL_TEXTURE_MATCHING_ROLE_V2, 'DISPLAY_EXPLAINABLE_V1_1')
    assert.equal(v2Domain.PREVIEW_PERSISTENCE_POLICY_V2, 'FORBIDDEN')
    const v2SourceEntries = [...loadedSourceTexts.entries()].filter(([filePath]) =>
      filePath.startsWith(v2DomainRoot) || filePath === v2TypePath,
    )
    assert.ok(v2SourceEntries.length >= 5)
    v2SourceEntries.forEach(([filePath, source]) => {
      assert.equal(/\bwx\s*\./.test(source), false, `${filePath} must not use wx.*`)
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bMath\.random\s*\(/.test(source), false, `${filePath} must not read time/random`)
      assert.equal(/(?:from|require\s*\()\s*['"][^'"]*(?:institution|recommendation|pages|services|store|mock|scripts\/fixtures)/i.test(source), false, `${filePath} forbidden dependency`)
      assert.equal(/\b(?:setStorage|getStorage|localStorage)\b/.test(source), false, `${filePath} must not persist preview`)
      assert.equal(/console\.(?:log|debug|info)\s*\(/.test(source), false, `${filePath} must not log domain objects`)
    })
  })

  if (failures.length > 0) {
    console.error('ELDER_PROFILE_V2_RUNTIME = FAIL')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }

  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${typescript.version} (${parserPath})`)
  console.log(`PROFILE_V2_FIXTURES: ${elderProfileV2Fixtures.length}/18 PASS`)
  console.log(`FORMAL_PREVIEW_V2_PARITY: ${elderProfileV2ParityFixtures.length}/5 PASS`)
  console.log('ADL_V1_V2_PARITY: 22 valid frozen V1 fixtures PASS')
  console.log(`BOUNDARY_CASES: ${caseIds.length - elderProfileV2Fixtures.length - elderProfileV2ParityFixtures.length} PASS`)
  console.log(`LOADED_SOURCE_MODULES: ${loadedSourcePaths.size}`)
  console.log('ELDER_PROFILE_V2_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('ELDER_PROFILE_V2_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
