import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  REC_V2_DATASET_MODE,
  REC_V2_DATASET_VERSION,
  REC_V2_EVALUATION_AS_OF,
  REC_V2_EXPECTED_CASE_IDS,
  REC_V2_FIXTURE_MANIFEST,
  configureLifeFit,
  makeRoomChildPermutationPair,
  makeV2InstitutionPool,
  recommendationV2Fixtures,
  setCapabilityStatus,
  setReferencePrice,
  setStableField,
} from './fixtures/recommendation-v2-fixtures.mjs'
import {
  makeAssessmentDraftV2,
  makeCompletedAssessmentV2,
} from './fixtures/elder-profile-v2-fixtures.mjs'
import { makeCompletedAssessment } from './fixtures/elder-profile-fixtures.mjs'
import { makeV2Draft } from './fixtures/assessment-v2-fixtures.mjs'
import { institutionFixtures } from './fixtures/institution-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const v2Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation', 'v2', 'index.ts')
const v1Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation', 'index.ts')
const elderV2Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'v2', 'index.ts')
const elderV1Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'index.ts')
const failures = []
const executedIds = []
const assertionCounts = new Map()

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const deepFreeze = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  Object.freeze(value)
  Object.values(value).forEach((child) => deepFreeze(child, seen))
  return value
}

const formatDiagnostic = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) return message
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`
}

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parser = require(path.resolve(explicitPath))
    if (parser.version !== '4.1.2') throw new Error(`expected WeChat TypeScript 4.1.2, got ${parser.version}`)
    return { parser, parserPath: path.resolve(explicitPath), source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat TypeScript 4.1.2 not found')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) continue
    for (const runtime of await readdir(packageRoot, { withFileTypes: true })) {
      const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  const selected = candidates.find((candidate) => require(candidate.parserPath).version === '4.1.2')
  if (!selected) throw new Error('WeChat TypeScript 4.1.2 parser not found')
  return { parser: require(selected.parserPath), parserPath: selected.parserPath, source: 'WeChat DevTools mptslib' }
}

const createLoader = (typescript, loadedSources) => {
  const cache = new Map()
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [`${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js'), base]
    const resolved = candidates.find(existsSync)
    if (!resolved) throw new Error(`cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (filePath) => {
    const resolved = path.resolve(filePath)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    loadedSources.set(resolved, source)
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = resolved.endsWith('.ts') ? typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
      fileName: resolved,
      reportDiagnostics: true,
    }) : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((diagnostic) =>
      diagnostic.category === typescript.DiagnosticCategory.Error)
    if (errors.length > 0) throw new Error(errors.map((item) => formatDiagnostic(typescript, item)).join('\n'))
    const localRequire = (request) => {
      if (!request.startsWith('.')) throw new Error(`runtime dependency forbidden: ${request}`)
      return load(resolve(request, resolved))
    }
    const factory = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){\n${output.outputText}\n})`, { filename: resolved })
    factory(localRequire, module, module.exports, resolved, path.dirname(resolved))
    return module.exports
  }
  return load
}

const containsKey = (value, keys, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  if (Object.keys(value).some((key) => keys.includes(key))) return true
  return Object.values(value).some((child) => containsKey(child, keys, seen))
}

const normalizeRoomLocators = (value) => {
  const normalized = clone(value)
  const visit = (node, seen = new Set()) => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (typeof node.fieldPath === 'string' && /^rooms\.\d+\.roomType$/.test(node.fieldPath)) {
      const evidenceKey = Array.isArray(node.evidenceIds) && node.evidenceIds.length > 0
        ? node.evidenceIds.join('|')
        : typeof node.evidenceId === 'string' ? node.evidenceId : node.fieldPath
      node.fieldPath = `rooms.<${evidenceKey}>.roomType`
    }
    Object.values(node).forEach((child) => visit(child, seen))
  }
  visit(normalized)
  return normalized
}

const baseAnswers = (overrides = {}) => ({
  'preference.careType': 'medical_nursing_integrated',
  'preference.roomType': 'no_preference',
  'preference.mealSchedule': 'no_preference',
  'preference.activityPreference': 'no_preference',
  'preference.priorities': ['price'],
  'budget.monthlyRange': 'cny_5000_8000',
  ...overrides,
})

const makeInput = (profile, institutions, overrides = {}) => ({
  profile,
  institutions,
  datasetVersion: REC_V2_DATASET_VERSION,
  datasetMode: REC_V2_DATASET_MODE,
  evaluationAsOf: REC_V2_EVALUATION_AS_OF,
  contractVersion: 'recommendation-contract-v2',
  rulesetVersion: 'recommendation-ruleset-v2',
  policyVersion: 'conservative-exact-with-conditional-v1',
  ...overrides,
})

const configurePool = (count = 1, options = {}) =>
  makeV2InstitutionPool(count).map((record) => configureLifeFit(record, options))

const scenarioAnswers = (scenario) => {
  if (scenario.includes('room_') || scenario === 'exact_room_unknown_soft' || scenario === 'parity_room_unknown') {
    return baseAnswers({ 'preference.roomType': scenario === 'room_not_applicable' ? 'no_preference' : 'single' })
  }
  if (scenario.includes('meal_') || scenario === 'exact_meal_mismatch_soft' || scenario === 'exact_meal_unknown_soft'
    || scenario === 'parity_meal_mismatch') {
    return baseAnswers({ 'preference.mealSchedule': scenario === 'meal_not_applicable' ? 'no_preference' : 'three_meals' })
  }
  if (scenario.includes('easy_chew')) return baseAnswers({ 'health.chewingAbility': 'easy_chew' })
  if (scenario.includes('modified_food') || scenario === 'parity_nutrition') {
    return baseAnswers({ 'health.chewingAbility': 'modified_food' })
  }
  return baseAnswers()
}

const semanticsOnly = (value) => value.semantics

const run = async () => {
  const { parser: typescript, parserPath, source: parserSource } = await loadWechatTypeScript()
  const loadedSources = new Map()
  const load = createLoader(typescript, loadedSources)
  const recommendationV2 = load(v2Entry)
  const recommendationV1 = load(v1Entry)
  const elderV2 = load(elderV2Entry)
  const elderV1 = load(elderV1Entry)

  const derivePreview = (answers = {}) => {
    const result = elderV2.deriveElderProfilePreviewV2(makeAssessmentDraftV2(baseAnswers(answers)))
    assert.equal(result.ok, true, 'V2 preview fixture must derive')
    return result.preview
  }
  const deriveFormal = (answers = {}) => {
    const result = elderV2.deriveElderProfileV2(makeCompletedAssessmentV2(baseAnswers(answers)))
    assert.equal(result.ok, true, 'V2 formal fixture must derive')
    return result.profile
  }
  const evaluate = (profile, pool, overrides = {}) => {
    const input = makeInput(profile, pool, overrides)
    return profile.kind === 'elder_profile'
      ? recommendationV2.evaluateFormalRecommendationV2(input)
      : recommendationV2.evaluateRecommendationPreviewV2(input)
  }

  // Additional synthetic regression cases are separate from the frozen 68-case
  // manifest below; no historical fixture or expectation is replaced.
  const ancillaryRows = []
  const careQuestion = 'cognitive.specialCareNeeds'
  const otherId = 'cl:other_without_detail:cognitive.specialCareNeeds'
  const careCodes = ['round_the_clock_care', 'one_to_one_caregiver', 'night_care',
    'dementia_unit', 'rehabilitation_training', 'tube_feeding', 'catheter_care',
    'pressure_injury_care', 'incontinence_care']
  const profileValidator = load(path.join(repositoryRoot, 'miniprogram/domain/recommendation/v2/profile-v2.ts'))
  const assessment = load(path.join(repositoryRoot, 'miniprogram/types/assessment-v2.ts'))
  const ancillaryCase = (id, expectation, check, historicalFailure = false) => {
    try {
      const details = check() || {}
      ancillaryRows.push({ id, expectation, actualClassification: expectation, status: 'PASS', historicalFailure, ...details })
    } catch (error) {
      ancillaryRows.push({ id, expectation, status: 'FAIL', historicalFailure,
        actualClassification: error.actualClassification || 'ASSERTION_FAILED', error: error.message })
      failures.push(`${id}: ${error.stack || error.message}`)
    }
  }
  const accepted = (profile, pool = configurePool(1)) => {
    const before = clone({ profile, pool })
    const result = evaluate(profile, pool)
    if (!result.ok) {
      const error = new Error(`VALID_WRONGLY_REJECTED: ${JSON.stringify(result.error)}`)
      error.actualClassification = 'VALID_WRONGLY_REJECTED'
      throw error
    }
    assert.deepEqual(clone({ profile, pool }), before, 'valid input is immutable')
    assert.equal(result.value.semantics.elderSnapshot.specialCare.requiredCareCapabilities.length, 9)
    assert.deepEqual(clone(result.value.semantics.elderSnapshot.specialCare), clone(profile.specialCare.derivedFacts))
    return result.value.semantics
  }
  const rejected = (profile, code) => {
    const before = clone(profile)
    const result = profileValidator.validateAndSnapshotProfileV2(profile, profile.kind)
    if (result.ok) {
      const error = new Error('INVALID_WRONGLY_ACCEPTED')
      error.actualClassification = 'INVALID_WRONGLY_ACCEPTED'
      throw error
    }
    assert.equal(result.error.code, code, 'correct stable rejection code')
    assert.ok(result.error.paths.length > 0, 'rejection identifies a path')
    assert.equal(Object.hasOwn(result, 'value'), false, 'no partial result')
    assert.deepEqual(clone(profile), before, 'invalid input is immutable')
    return { rejection: clone(result.error) }
  }
  const validCare = (needs) => {
    const profile = derivePreview({ [careQuestion]: needs })
    const semantics = accepted(profile)
    assert.deepEqual(clone(profile.specialCare.rawFacts.answers), needs, 'other/none/unknown raw answer preserved')
    profile.specialCare.derivedFacts.requiredCareCapabilities.forEach((fact) => {
      assert.equal(fact.status, needs.includes('unknown') ? 'unknown' : needs.includes('none')
        ? 'not_required' : needs.includes(fact.capability) ? 'required' : 'not_reported')
    })
    const other = profile.clarifications.find((entry) => entry.clarificationId === otherId)
    assert.equal(Boolean(other), needs.includes('other'))
    if (other) {
      assert.equal(other.reasonCode, 'other_without_detail')
      assert.equal(other.priority, 'recommended')
      assert.equal(other.affectedDerivedFields.length, 9)
      assert.equal(profile.specialCare.derivedFacts.requiredCareCapabilities
        .some((fact) => (fact.clarificationIds || []).includes(otherId)), false)
      assert.deepEqual(clone(semantics.elderSnapshot.clarifications), clone(profile.clarifications))
    }
    return { elderReadiness: semantics.elderReadiness }
  }
  ancillaryCase('ANC-A01-OTHER', 'VALID_ACCEPTED', () => validCare(['other']), true)
  careCodes.forEach((code) => {
    ancillaryCase(`ANC-A02-OTHER-${code}`, 'VALID_ACCEPTED', () => validCare(['other', code]), true)
    ancillaryCase(`ANC-A03-${code}`, 'VALID_ACCEPTED', () => validCare([code]))
  })
  for (let i = 0; i < careCodes.length; i += 1) {
    for (let j = i + 1; j < careCodes.length; j += 1) {
      ancillaryCase(`ANC-A04-${i}-${j}`, 'VALID_ACCEPTED', () => validCare([careCodes[i], careCodes[j]]))
    }
  }
  ancillaryCase('ANC-A05-ALL-NINE', 'VALID_ACCEPTED', () => validCare(careCodes))
  ancillaryCase('ANC-A06-ALL-NINE-AND-OTHER', 'VALID_ACCEPTED', () => validCare([...careCodes, 'other']))
  ancillaryCase('ANC-A07-NONE', 'VALID_ACCEPTED', () => validCare(['none']))
  ancillaryCase('ANC-A08-UNKNOWN', 'VALID_ACCEPTED', () => {
    const details = validCare(['unknown'])
    assert.equal(details.elderReadiness, 'blocked_by_required_clarification')
    return details
  })
  ancillaryCase('ANC-A09-HISTORICAL-T11', 'VALID_ACCEPTED', () => {
    const draft = makeV2Draft({ 'basic.elderName': undefined, 'health.conditions': ['none'],
      'health.recentEvents': ['none'], 'health.rehabilitationNeed': 'none', [careQuestion]: ['other'] },
    { localDraftId: 'TEST_ONLY_ANCILLARY001_T11' })
    assert.equal(assessment.validateAssessmentAnswersV2(draft.answers, true).valid, true)
    const derived = elderV2.deriveElderProfilePreviewV2(draft)
    assert.equal(derived.ok, true)
    const semantics = accepted(derived.preview)
    assert.equal(derived.preview.clarifications.length, 1)
    assert.equal(semantics.elderReadiness, 'ready')
    assert.deepEqual(clone(derived.preview.specialCare.rawFacts.answers), ['other'])
  }, true)
  ancillaryCase('ANC-A10-FORMAL-OTHER-PARITY', 'VALID_ACCEPTED', () => {
    const answers = { [careQuestion]: ['other'] }
    assert.deepEqual(clone(accepted(deriveFormal(answers))), clone(accepted(derivePreview(answers))))
  }, true)
  ancillaryCase('ANC-A11-FORMAL-COMBINED-PARITY', 'VALID_ACCEPTED', () => {
    const answers = { [careQuestion]: ['other', 'tube_feeding'] }
    assert.deepEqual(clone(accepted(deriveFormal(answers))), clone(accepted(derivePreview(answers))))
  })
  ancillaryCase('ANC-A12-V1-PREVIEW-OTHER', 'VALID_ACCEPTED', () => {
    const completed = makeCompletedAssessment(baseAnswers({ [careQuestion]: ['other'] }))
    const answers = clone(completed.answers)
    for (const key of ['preference.roomType', 'preference.mealSchedule', 'preference.activityPreference']) delete answers[key]
    const preview = elderV1.deriveElderProfilePreview({ kind: 'assessment_draft', schemaVersion: 1,
      localDraftId: 'TEST_ONLY_ANCILLARY001_V1', persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
      currentStep: 'budget', answers, startedAt: completed.completedAt, updatedAt: completed.completedAt })
    assert.equal(preview.ok, true)
    const checked = load(path.join(repositoryRoot, 'miniprogram/domain/recommendation/profile.ts'))
      .validateAndSnapshotProfile(preview.preview, 'elder_profile_preview')
    assert.equal(checked.ok, true)
    assert.equal(checked.value.elderReadiness, 'ready')
    assert.deepEqual(clone(preview.preview.specialCare.rawFacts.answers), ['other'])
  })
  const clarificationMutations = [
    ['missing', (p) => { p.clarifications = [] }],
    ['duplicate', (p) => { p.clarifications.push(clone(p.clarifications[0])) }],
    ['priority-required', (p) => { p.clarifications[0].priority = 'required_before_hard_filter' }],
    ['priority-informational', (p) => { p.clarifications[0].priority = 'informational' }],
    ['source', (p) => { p.clarifications[0].sources[0].sourceOptionCode = 'none' }],
    ['source-missing', (p) => { p.clarifications[0].sources = [] }],
    ['affected-fields', (p) => { p.clarifications[0].affectedDerivedFields.pop() }],
    ['affected-fields-empty', (p) => { p.clarifications[0].affectedDerivedFields = [] }],
    ['code', (p) => { p.clarifications[0].reasonCode = 'unknown_answer' }],
    ['id', (p) => { p.clarifications[0].clarificationId = 'cl:other_without_detail:health.conditions' }],
    ['status', (p) => { p.clarifications[0].status = 'resolved' }],
    ['forged-orphan-recommended', (p) => { p.clarifications.push({ ...clone(p.clarifications[0]),
      clarificationId: 'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.night_care',
      reasonCode: 'risk_signal_needs_confirmation', priority: 'recommended' }) }],
    ['forged-other-code-priority-only', (p) => { p.clarifications[0].affectedDerivedFields = ['health.rehabilitationNeed'] }],
    ['forged-orphan-required', (p) => { p.clarifications.push({ ...clone(p.clarifications[0]),
      clarificationId: 'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.night_care',
      reasonCode: 'risk_signal_needs_confirmation', priority: 'required_before_hard_filter' }) }],
  ]
  clarificationMutations.forEach(([name, mutate]) => ancillaryCase(`ANC-B01-${name}`, 'INVALID_REJECTED', () => {
    const p = clone(derivePreview({ [careQuestion]: ['other'] }))
    mutate(p)
    return rejected(p, 'INVALID_PROFILE_CLARIFICATION')
  }))
  ancillaryCase('ANC-B02-FORGED-OTHER-WITHOUT-ANSWER', 'INVALID_REJECTED', () => {
    const p = clone(derivePreview())
    p.clarifications = clone(derivePreview({ [careQuestion]: ['other'] }).clarifications)
    return rejected(p, 'INVALID_PROFILE_CLARIFICATION')
  })
  for (const needs of [['not_a_frozen_code'], ['other', 'none'], ['unknown', 'other'], ['other', 'other']]) {
    ancillaryCase(`ANC-B03-ENUM-${needs.join('-')}`, 'INVALID_REJECTED', () => {
      const p = clone(derivePreview({ [careQuestion]: ['other'] }))
      p.specialCare.rawFacts.answers = needs
      assert.equal(assessment.isValidAnswerForQuestionV2(careQuestion, needs), false)
      return rejected(p, 'INVALID_PROFILE_SNAPSHOT')
    })
  }
  ancillaryCase('ANC-B04-MUTATED-EVIDENCE', 'INVALID_REJECTED', () => {
    const p = clone(derivePreview({ [careQuestion]: ['other'] }))
    p.evidence.find((e) => e.derivedField.startsWith('specialCare.')).ruleId = 'elder-profile-ruleset-v1:FORGED'
    return rejected(p, 'INVALID_PROFILE_EVIDENCE')
  })
  for (const [name, mutate] of [
    ['missing-required-link', (p) => { delete p.specialCare.derivedFacts.requiredCareCapabilities[0].clarificationIds }],
    ['wrong-required-link', (p) => { p.specialCare.derivedFacts.requiredCareCapabilities[0].clarificationIds = [otherId] }],
    ['missing-required-clarification', (p) => { p.clarifications = [] }],
    ['promote-required-to-recommended', (p) => { p.clarifications[0].priority = 'recommended' }],
  ]) ancillaryCase(`ANC-B05-${name}`, 'INVALID_REJECTED', () => {
    const p = clone(derivePreview({ [careQuestion]: ['unknown'] }))
    mutate(p)
    return rejected(p, name.includes('link') ? 'INVALID_PROFILE_SNAPSHOT' : 'INVALID_PROFILE_CLARIFICATION')
  })
  ancillaryCase('ANC-B06-FORGED-REVERSE-LINK', 'INVALID_REJECTED', () => {
    const p = clone(derivePreview({ [careQuestion]: ['other'] }))
    p.specialCare.derivedFacts.requiredCareCapabilities[0].clarificationIds = [otherId]
    return rejected(p, 'INVALID_PROFILE_SNAPSHOT')
  })
  const blockedCases = [
    ['other-chewing-unknown', { [careQuestion]: ['other'], 'health.chewingAbility': 'unknown' }],
    ['other-pressure-injury', { [careQuestion]: ['other', 'round_the_clock_care'], 'health.recentEvents': ['pressure_injury'] }],
    ['unknown-care', { [careQuestion]: ['unknown'] }],
    ['other-night-care', { [careQuestion]: ['other'], 'cognitive.symptoms': ['sleep_wake_disorder'] }],
  ]
  blockedCases.forEach(([name, answers]) => ancillaryCase(`ANC-C01-${name}`, 'VALID_ACCEPTED', () => {
    const p = derivePreview(answers)
    const semantics = accepted(p)
    assert.equal(semantics.elderReadiness, 'blocked_by_required_clarification')
    assert.equal(semantics.cards.length, 0)
    assert.equal(semantics.conditionalCandidates.length, 0)
    assert.ok(p.clarifications.some((entry) => entry.priority === 'required_before_hard_filter'))
    assert.deepEqual(clone(semantics.elderSnapshot.clarifications), clone(p.clarifications))
    assert.equal(semantics.noExactMatch.reasonCode, 'REQUIRED_CAPABILITY_UNRESOLVED')
  }))
  ancillaryCase('ANC-C02-EXCLUSIVITY', 'VALID_ACCEPTED', () => {
    for (const exclusive of ['none', 'unknown']) {
      assert.deepEqual(clone(assessment.normalizeMultiChoiceValueV2(careQuestion, ['other', 'night_care', exclusive])), [exclusive])
      assert.deepEqual(clone(assessment.normalizeMultiChoiceValueV2(careQuestion, [exclusive, 'other'])), ['other'])
    }
  })
  ancillaryCase('ANC-C03-UNSAFE-INSTITUTION-EMPTY', 'VALID_ACCEPTED', () => {
    const p = derivePreview({ [careQuestion]: ['other', 'tube_feeding'] })
    const pool = configurePool(1)
    setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'unsupported')
    const semantics = accepted(p, pool)
    assert.equal(semantics.cards.length, 0)
    assert.equal(semantics.conditionalCandidates.length, 0)
    assert.equal(semantics.candidateEvaluations[0].matchTier, 'INELIGIBLE')
    assert.equal(semantics.noExactMatch.reasonCode, 'ALL_CANDIDATES_HAVE_HARD_CONFLICT')
  })
  ancillaryCase('ANC-C04-EMPTY-POOL', 'VALID_ACCEPTED', () => {
    const semantics = accepted(derivePreview({ [careQuestion]: ['other'] }), [])
    assert.equal(semantics.cards.length, 0)
    assert.equal(semantics.noExactMatch.reasonCode, 'NO_VERIFIED_INSTITUTION_POOL')
  })
  assert.equal(ancillaryRows.filter((row) => row.historicalFailure).length, 12)
  assert.equal(new Set(ancillaryRows.map((row) => row.id)).size, ancillaryRows.length)
  console.log(`ANCILLARY_001_RESULTS: ${JSON.stringify({ provenance: 'TEST_ONLY_SYNTHETIC',
    pass: ancillaryRows.filter((row) => row.status === 'PASS').length,
    fail: ancillaryRows.filter((row) => row.status === 'FAIL').length, cases: ancillaryRows })}`)
  if (process.argv.includes('--ancillary-only')) {
    process.exitCode = ancillaryRows.some((row) => row.status === 'FAIL') ? 1 : 0
    return
  }

  const runFixture = (fixture) => {
    executedIds.push(fixture.id)
    let count = 0
    const check = (condition, message) => {
      count += 1
      assert.ok(condition, message)
    }
    const equal = (actual, expected, message) => {
      count += 1
      assert.deepEqual(clone(actual), clone(expected), message)
    }
    const validCommon = (result, expectedPoolSize) => {
      check(result.ok, `expected success: ${JSON.stringify(result.error || null)}`)
      if (!result.ok) return null
      check(result.value.semantics.versions.recommendationContractVersion === 'recommendation-contract-v2', 'contract version')
      check(result.value.semantics.versions.recommendationRulesetVersion === 'recommendation-ruleset-v2', 'ruleset version')
      check(result.value.semantics.poolManifest.entries.length === expectedPoolSize, 'complete pool manifest')
      check(result.value.semantics.candidateEvaluations.length
        === result.value.semantics.poolManifest.entries.filter((entry) => entry.disposition === 'included').length,
      'candidate/manifest inclusion parity')
      check(result.value.semantics.cards.length <= 3, 'max three cards')
      check(!containsKey(result.value, ['recommendationId', 'generatedAt', 'previewId']), 'no fake recommendation identity')
      check(!containsKey(result.value, ['record']), 'no complete raw institution record in output')
      check(result.value.semantics.candidateEvaluations.every((candidate) => candidate.reasons
        .filter((reason) => reason.polarity === 'supported')
        .every((reason) => reason.institutionEvidenceRefs.every((ref) =>
          ref.projectionReason === 'raw_value_currently_verified'
          && ref.verificationStatus === 'verified'
          && ref.evidenceIds.length > 0))), 'all positive institution reasons use current verified evidence')
      return result.value.semantics
    }
    const invalidCommon = (result, expectedCode, before, after) => {
      check(!result.ok, 'expected stable rejection')
      check(result.error?.code === expectedCode, `expected ${expectedCode}, got ${result.error?.code}`)
      check(Array.isArray(result.error?.paths) && result.error.paths.length > 0, 'minimal paths')
      check(!Object.prototype.hasOwnProperty.call(result, 'value'), 'no partial value')
      equal(after, before, 'invalid input not mutated')
      check(typeof result.error?.code === 'string' && result.error.code.length > 0, 'stable code present')
    }

    try {
      const scenario = fixture.scenario
      const answers = scenarioAnswers(scenario)
      let profile = derivePreview(answers)
      let pool = configurePool(1)

      if (scenario === 'room_noncompatible_unknown' || scenario === 'exact_room_unknown_soft' || scenario === 'parity_room_unknown') {
        setStableField(pool[0], 'rooms.0.roomType', 'provided', 'double', 'verified')
      } else if (scenario === 'room_empty_unknown') {
        pool[0].evidence = pool[0].evidence.filter((entry) => !entry.fieldPath.startsWith('rooms.'))
        pool[0].rooms = []
      } else if (scenario === 'room_unverified_unknown') {
        setStableField(pool[0], 'rooms.0.roomType', 'provided', 'single', 'unverified')
      } else if (scenario === 'meal_known_mismatch' || scenario === 'exact_meal_mismatch_soft' || scenario === 'parity_meal_mismatch') {
        setStableField(pool[0], 'meal.mealSchedule', 'provided', 'three_meals_one_snack', 'verified')
      } else if (scenario === 'meal_data_unavailable') {
        setStableField(pool[0], 'meal.mealSchedule', 'unavailable', null)
      } else if (scenario === 'meal_unknown' || scenario === 'exact_meal_unknown_soft') {
        setStableField(pool[0], 'meal.mealSchedule', 'unknown', null)
      } else if (scenario === 'easy_chew_unavailable' || scenario === 'exact_nutrition_neutral') {
        setStableField(pool[0], 'meal.easyChewSupport', 'provided', 'unavailable', 'verified')
      } else if (scenario === 'easy_chew_inquiry') {
        setStableField(pool[0], 'meal.easyChewSupport', 'provided', 'requires_inquiry', 'verified')
      } else if (scenario === 'easy_chew_unknown') {
        setStableField(pool[0], 'meal.easyChewSupport', 'provided', 'unknown', 'verified')
      } else if (scenario === 'modified_food_unavailable') {
        setStableField(pool[0], 'meal.modifiedFoodSupport', 'provided', 'unavailable', 'verified')
      }

      if (scenario.startsWith('invalid_')) {
        if (scenario === 'invalid_contract') {
          const input = makeInput(profile, pool, { contractVersion: 'recommendation-contract-v1' })
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'UNSUPPORTED_RECOMMENDATION_CONTRACT', before, input)
        } else if (scenario === 'invalid_ruleset') {
          const input = makeInput(profile, pool, { rulesetVersion: 'recommendation-ruleset-v1' })
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'UNSUPPORTED_RECOMMENDATION_RULESET', before, input)
        } else if (scenario === 'invalid_v1_profile') {
          const v1ProfileResult = elderV1.deriveElderProfile(makeCompletedAssessment())
          check(v1ProfileResult.ok, 'V1 profile derives')
          const input = makeInput(v1ProfileResult.profile, pool)
          const before = clone(input)
          const result = recommendationV2.evaluateFormalRecommendationV2(input)
          invalidCommon(result, 'UNSUPPORTED_PROFILE_VERSION', before, input)
          const reverseInput = {
            profile: deriveFormal(), institutions: [institutionFixtures[0].record],
            datasetVersion: 'v1-cross', datasetMode: 'MOCK_DEVELOPMENT_ONLY', evaluationAsOf: REC_V2_EVALUATION_AS_OF,
            rulesetVersion: 'recommendation-ruleset-v1', policyVersion: 'conservative-exact-with-conditional-v1',
          }
          check(!recommendationV1.evaluateFormalRecommendation(reverseInput).ok, 'V1 evaluator rejects V2 profile')
        } else if (scenario === 'invalid_v1_institution') {
          const input = makeInput(profile, [clone(institutionFixtures[0].record)])
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'UNSUPPORTED_INSTITUTION_VERSION', before, input)
          const v1ProfileResult = elderV1.deriveElderProfile(makeCompletedAssessment())
          check(v1ProfileResult.ok, 'V1 profile derives for reverse institution boundary')
          const reverseResult = recommendationV1.evaluateFormalRecommendation({
            profile: v1ProfileResult.profile,
            institutions: [pool[0]],
            datasetVersion: 'v1-cross-institution',
            datasetMode: 'MOCK_DEVELOPMENT_ONLY',
            evaluationAsOf: REC_V2_EVALUATION_AS_OF,
            rulesetVersion: 'recommendation-ruleset-v1',
            policyVersion: 'conservative-exact-with-conditional-v1',
          })
          check(!reverseResult.ok, 'V1 evaluator rejects raw Institution V1.1 extension shape')
        } else if (scenario === 'invalid_time') {
          const input = makeInput(profile, pool, { evaluationAsOf: 'not-a-time' })
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_EVALUATION_AS_OF', before, input)
        } else if (scenario === 'invalid_duplicate_id') {
          const input = makeInput(profile, [pool[0], clone(pool[0])])
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'DUPLICATE_INSTITUTION_ID', before, input)
        } else if (scenario === 'invalid_institution_shape') {
          pool[0].recordRevision = 0
          const input = makeInput(profile, pool)
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_INSTITUTION_RECORD', before, input)
        } else if (scenario === 'invalid_profile_evidence') {
          const assertInvalidProfile = (mutate, expectedCode, label) => {
            const invalidProfile = clone(profile)
            mutate(invalidProfile)
            const input = makeInput(invalidProfile, clone(pool))
            const before = clone(input)
            invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), expectedCode, before, input)
            check(true, label)
          }
          assertInvalidProfile((value) => { value.evidence = value.evidence.slice(1) }, 'INVALID_PROFILE_EVIDENCE', 'missing evidence rejected')
          assertInvalidProfile((value) => { value.evidence[0].evidenceId = 'ev:forged' }, 'INVALID_PROFILE_EVIDENCE', 'forged evidence id rejected')
          assertInvalidProfile((value) => { value.evidence[0].ruleId = 'elder-profile-ruleset-v2:FORGED' }, 'INVALID_PROFILE_EVIDENCE', 'forged rule rejected')
          assertInvalidProfile((value) => { value.evidence[0].outcomeCode = 'forged' }, 'INVALID_PROFILE_EVIDENCE', 'forged outcome rejected')
          assertInvalidProfile((value) => {
            value.evidence[0].sources = [{
              sourceKind: 'assessment_option', sourceQuestionId: 'health.chewingAbility',
              sourceOptionCode: 'easy_chew', contribution: 'supports',
            }]
          }, 'INVALID_PROFILE_EVIDENCE', 'valid-shaped but nonmatching source rejected')
          const assertInvalidCareModeEvidence = (mutate, label) => {
            const invalidProfile = clone(derivePreview({ 'adl.eating': 'needs_feeding' }))
            const evidence = invalidProfile.evidence.find((entry) =>
              entry.derivedField === 'adl.careModes.feeding_dependence')
            mutate(evidence)
            const input = makeInput(invalidProfile, clone(pool))
            const before = clone(input)
            invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_PROFILE_EVIDENCE', before, input)
            check(true, label)
          }
          assertInvalidCareModeEvidence((evidence) => {
            evidence.sources = [{
              sourceKind: 'assessment_option', sourceQuestionId: 'adl.stairs',
              sourceOptionCode: 'no_stairs', contribution: 'care_mode',
            }]
          }, 'cross-question care-mode evidence rejected')
          assertInvalidCareModeEvidence((evidence) => {
            evidence.ruleId = 'adl-ruleset-v1:C_NO_STAIRS_NEUTRAL'
          }, 'care-mode rule cannot cross semantic field')
          const assertInvalidCausalEvidence = (answers, derivedField, source, label) => {
            const invalidProfile = clone(derivePreview(answers))
            const evidence = invalidProfile.evidence.find((entry) => entry.derivedField === derivedField)
            evidence.sources = [source]
            const input = makeInput(invalidProfile, clone(pool))
            const before = clone(input)
            invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_PROFILE_EVIDENCE', before, input)
            check(true, label)
          }
          assertInvalidCausalEvidence(
            { 'adl.eating': 'needs_feeding' },
            'adl.careLevel',
            {
              sourceKind: 'assessment_option', sourceQuestionId: 'adl.stairs',
              sourceOptionCode: 'independent', contribution: 'supports',
            },
            'care-level evidence must preserve the causal ADL source set',
          )
          assertInvalidCausalEvidence(
            { 'cognitive.specialCareNeeds': ['tube_feeding', 'one_to_one_caregiver'] },
            'specialCare.requiredCareCapabilities.tube_feeding',
            {
              sourceKind: 'assessment_option', sourceQuestionId: 'cognitive.specialCareNeeds',
              sourceOptionCode: 'one_to_one_caregiver', contribution: 'supports',
            },
            'capability evidence cannot borrow another selected capability',
          )
          assertInvalidCausalEvidence(
            {
              'health.rehabilitationNeed': 'definite',
              'cognitive.specialCareNeeds': ['tube_feeding'],
            },
            'health.rehabilitationNeed',
            {
              sourceKind: 'assessment_option', sourceQuestionId: 'cognitive.specialCareNeeds',
              sourceOptionCode: 'tube_feeding', contribution: 'supports',
            },
            'rehabilitation evidence cannot borrow an unrelated special-care answer',
          )
          assertInvalidProfile((value) => {
            value.adl.derivedFacts.careLevel.confidence = 'medium'
          }, 'INVALID_PROFILE_SNAPSHOT', 'derived-fact confidence must match canonical semantics')
          assertInvalidProfile((value) => {
            value.userFacingSummary.sections[0].items[0].summaryCode = 'forged.summary'
          }, 'INVALID_PROFILE_SNAPSHOT', 'summary semantics must match canonical profile output')
          assertInvalidProfile((value) => { delete value.basic }, 'INVALID_PROFILE_SNAPSHOT', 'missing basic rejected')
          assertInvalidProfile((value) => { delete value.userFacingSummary }, 'INVALID_PROFILE_SNAPSHOT', 'missing summary rejected')
        } else if (scenario === 'invalid_profile_clarification') {
          profile = derivePreview({ 'health.chewingAbility': 'unknown' })
          const assertInvalidClarification = (mutate, label) => {
            const invalidProfile = clone(profile)
            mutate(invalidProfile)
            const input = makeInput(invalidProfile, clone(pool))
            const before = clone(input)
            invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_PROFILE_CLARIFICATION', before, input)
            check(true, label)
          }
          assertInvalidClarification((value) => { value.clarifications[0].priority = 'not-a-priority' }, 'invalid priority rejected')
          assertInvalidClarification((value) => { value.clarifications[0].clarificationId = 'cl:forged:id' }, 'non-deterministic id rejected')
          assertInvalidClarification((value) => { value.clarifications[0].affectedDerivedFields = ['not.a.field'] }, 'invalid affected field rejected')
          const invalidNightProfile = clone(derivePreview({
            'cognitive.symptoms': ['memory_decline', 'sleep_wake_disorder'],
          }))
          const nightClarification = invalidNightProfile.clarifications.find((entry) =>
            entry.affectedDerivedFields.includes('specialCare.requiredCareCapabilities.night_care'))
          nightClarification.sources = [{
            sourceKind: 'assessment_option', sourceQuestionId: 'cognitive.symptoms',
            sourceOptionCode: 'memory_decline', contribution: 'requires_clarification',
          }]
          const invalidNightInput = makeInput(invalidNightProfile, clone(pool))
          const invalidNightBefore = clone(invalidNightInput)
          invalidCommon(
            recommendationV2.evaluateRecommendationPreviewV2(invalidNightInput),
            'INVALID_PROFILE_CLARIFICATION',
            invalidNightBefore,
            invalidNightInput,
          )
          check(true, 'clarification source must remain causally bound to affected field')
        } else if (scenario === 'invalid_priority') {
          profile.preference.rawFacts.priorities = ['caregiver_attitude']
          const input = makeInput(profile, pool)
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_PROFILE_SNAPSHOT', before, input)
        } else if (scenario === 'invalid_dataset_provenance') {
          const input = makeInput(profile, pool, { datasetMode: 'PRODUCTION' })
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_DATASET_MODE_OR_PROVENANCE', before, input)
        } else if (scenario === 'invalid_legacy_dto') {
          const input = makeInput(profile, [{ id: 'legacy', name: 'legacy' }])
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'INVALID_INSTITUTION_RECORD', before, input)
        } else if (scenario === 'invalid_raw_draft') {
          const input = makeInput(makeAssessmentDraftV2(baseAnswers()), pool)
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'UNSUPPORTED_PROFILE_VERSION', before, input)
        } else if (scenario === 'invalid_bare_semantics') {
          const { kind: _kind, source: _source, profileContractVersion: _pcv, derivationRulesetVersion: _drv, ...bare } = profile
          const input = makeInput(bare, pool)
          const before = clone(input)
          invalidCommon(recommendationV2.evaluateRecommendationPreviewV2(input), 'UNSUPPORTED_PROFILE_VERSION', before, input)
        }
        assertionCounts.set(fixture.id, count)
        return
      }

      if (scenario.startsWith('parity_')) {
        const parityAnswers = scenario === 'parity_room_unknown' ? { 'preference.roomType': 'single' }
          : scenario === 'parity_meal_mismatch' ? { 'preference.mealSchedule': 'three_meals' }
            : scenario === 'parity_nutrition' ? { 'health.chewingAbility': 'modified_food' }
              : scenario === 'parity_conditional' ? { 'cognitive.specialCareNeeds': ['tube_feeding'] }
                : scenario === 'parity_advisory' ? { 'adl.eating': 'needs_feeding', 'budget.monthlyRange': 'cny_3500_5000' } : {}
        if (scenario === 'parity_conditional') setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'requires_assessment')
        const previewResult = evaluate(derivePreview(parityAnswers), clone(pool))
        const formalResult = evaluate(deriveFormal(parityAnswers), clone(pool))
        const previewSemantics = validCommon(previewResult, pool.length)
        const formalSemantics = validCommon(formalResult, pool.length)
        equal(previewSemantics, formalSemantics, 'formal/preview shared semantic core')
        check(previewResult.value.source.localDraftId === 'local-v2-fixture-001', 'real localDraftId copied')
        check(formalResult.value.identity.assessmentId === 'assessment-v2-fixture-001', 'formal identity copied')
        assertionCounts.set(fixture.id, count)
        return
      }

      if (scenario === 'priority_caregiver_not_scorable') profile = derivePreview({ 'preference.priorities': ['caregiver_quality'] })
      if (scenario === 'priority_hospital_not_scorable') profile = derivePreview({ 'preference.priorities': ['near_major_hospital'] })
      if (scenario === 'priority_transport_not_scorable') profile = derivePreview({ 'preference.priorities': ['transportation'] })
      if (scenario === 'dedup_price') profile = derivePreview({ 'preference.priorities': ['price'] })
      if (scenario === 'dedup_region') {
        profile = derivePreview({
          'preference.priorities': ['region'],
          'preference.region': { kind: 'institution_region', regionCode: 'mock-region-a', regionLabelSnapshot: 'Mock', catalogVersion: 'test' },
        })
        setStableField(pool[0], 'identity.regionCode', 'provided', 'mock-region-a', 'verified')
      }
      if (scenario === 'dedup_rehab') profile = derivePreview({
        'health.rehabilitationNeed': 'definite', 'preference.priorities': ['rehabilitation_capability'],
      })
      if (scenario === 'dedup_rehab_hard') profile = derivePreview({
        'health.rehabilitationNeed': 'definite',
        'cognitive.specialCareNeeds': ['rehabilitation_training'],
        'preference.priorities': ['rehabilitation_capability'],
      })
      if (scenario === 'dedup_rehab_hard') {
        setCapabilityStatus(pool[0], 'capabilities.specialCare.rehabilitation_training', 'supported')
      }
      if (scenario === 'dedup_care_safety') profile = derivePreview({ 'preference.priorities': ['care_capability'] })
      if (scenario === 'exact_all_match') profile = derivePreview({
        'preference.roomType': 'single', 'preference.mealSchedule': 'three_meals',
      })
      if (scenario === 'exact_activity_neutral') {
        profile = derivePreview({ 'preference.activityPreference': 'indoor' })
        setStableField(pool[0], 'activity.indoorSpace', 'provided', 'present', 'unverified')
      }
      if (scenario === 'exact_nutrition_neutral') profile = derivePreview({ 'health.chewingAbility': 'easy_chew' })
      if (scenario === 'exact_not_scorable_priority_neutral') profile = derivePreview({ 'preference.priorities': ['caregiver_quality'] })
      if (scenario === 'safety_unsupported' || scenario === 'safety_unverified' || scenario === 'safety_conditional') {
        profile = derivePreview({ 'cognitive.specialCareNeeds': ['tube_feeding'] })
        if (scenario === 'safety_unsupported') setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'unsupported')
        if (scenario === 'safety_unverified') setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'unknown', 'unverified')
        if (scenario === 'safety_conditional') setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'requires_assessment')
      }
      if (scenario === 'elder_readiness_blocked') profile = derivePreview({ 'health.chewingAbility': 'unknown' })
      if (scenario === 'cards_five_exact') pool = configurePool(5)
      if (scenario === 'cards_two_exact') pool = configurePool(2)
      if (scenario === 'cards_four_soft') {
        profile = derivePreview({ 'preference.roomType': 'single' })
        pool = configurePool(4)
        pool.forEach((record) => setStableField(record, 'rooms.0.roomType', 'provided', 'double', 'verified'))
      }
      if (scenario === 'cards_only_conditional') {
        profile = derivePreview({ 'cognitive.specialCareNeeds': ['tube_feeding'] })
        pool = configurePool(4)
        pool.forEach((record) => setCapabilityStatus(record, 'capabilities.specialCare.tube_feeding', 'requires_assessment'))
      }
      if (scenario === 'cards_no_unverified_ineligible') {
        profile = derivePreview({ 'cognitive.specialCareNeeds': ['tube_feeding'] })
        pool = configurePool(2)
        setCapabilityStatus(pool[0], 'capabilities.specialCare.tube_feeding', 'unknown', 'unverified')
        setCapabilityStatus(pool[1], 'capabilities.specialCare.tube_feeding', 'unsupported')
      }
      if (scenario === 'deterministic_pool_permutation') {
        profile = derivePreview({ 'preference.mealSchedule': 'three_meals' })
        pool = configurePool(3)
        setStableField(pool[1], 'meal.mealSchedule', 'provided', 'three_meals_one_snack', 'verified')
        setStableField(pool[2], 'meal.mealSchedule', 'unknown', null)
      }
      if (scenario === 'deterministic_priority_order') {
        profile = derivePreview({
          'preference.priorities': ['region', 'caregiver_quality', 'price'],
        })
        pool = configurePool(4)
        const unknownEvidenceIds = pool[0].price.referenceMonthlyPrice.verification.evidenceIds
        pool[0].evidence = pool[0].evidence.filter((entry) => !unknownEvidenceIds.includes(entry.evidenceId))
        pool[0].price.referenceMonthlyPrice = {
          availability: 'unknown', value: null, verification: { status: 'unverified', evidenceIds: [] },
        }
        setReferencePrice(pool[1], 900000, 1000000)
        setReferencePrice(pool[2], 700000, 900000)
      }
      if (scenario === 'input_immutability') {
        profile = deepFreeze(profile)
        pool = deepFreeze(pool)
      }
      if (scenario === 'full_pool_manifest') pool = configurePool(8)
      if (scenario === 'budget_advisory') profile = derivePreview({
        'adl.eating': 'needs_feeding', 'budget.monthlyRange': 'cny_3500_5000',
      })

      if (scenario === 'deterministic_repeat') {
        const first = evaluate(profile, clone(pool))
        const second = evaluate(clone(profile), clone(pool))
        validCommon(first, pool.length)
        validCommon(second, pool.length)
        equal(first, second, 'same input repeated deepEqual')
      } else if (scenario === 'deterministic_pool_permutation') {
        const first = evaluate(profile, clone(pool))
        const second = evaluate(profile, clone(pool).reverse())
        const firstSemantics = validCommon(first, pool.length)
        validCommon(second, pool.length)
        equal(first, second, 'institution permutation stable')
        equal(firstSemantics.candidateEvaluations.map((entry) => entry.institutionId), [
          pool[0].institutionId, pool[2].institutionId, pool[1].institutionId,
        ], 'meal match ranks before unknown, and unknown before mismatch')
      } else if (scenario === 'deterministic_evidence_permutation') {
        const first = evaluate(profile, clone(pool))
        const permuted = clone(pool)
        permuted[0].evidence.reverse()
        const second = evaluate(profile, permuted)
        validCommon(first, pool.length)
        validCommon(second, pool.length)
        equal(first, second, 'evidence input order stable')

        const roomPair = makeRoomChildPermutationPair(pool[0])
        const roomProfile = derivePreview({ 'preference.roomType': 'single' })
        const roomFirst = evaluate(roomProfile, [roomPair.original])
        const roomSecond = evaluate(roomProfile, [roomPair.permuted])
        validCommon(roomFirst, 1)
        validCommon(roomSecond, 1)
        const firstRoomRefs = roomFirst.value.semantics.candidateEvaluations[0].roomFit.institutionEvidenceRefs
        const secondRoomRefs = roomSecond.value.semantics.candidateEvaluations[0].roomFit.institutionEvidenceRefs
        equal(firstRoomRefs[0].evidenceIds, [roomPair.expectedEvidenceId], 'stable roomId selects evidence before input order')
        equal(secondRoomRefs[0].evidenceIds, [roomPair.expectedEvidenceId], 'stable roomId selection survives child permutation')
        equal(
          normalizeRoomLocators(roomFirst),
          normalizeRoomLocators(roomSecond),
          'room child permutation preserves semantics apart from contract-bound current index locators',
        )
      } else {
        const beforeProfile = clone(profile)
        const beforePool = clone(pool)
        const result = evaluate(profile, pool)
        const semantics = validCommon(result, pool.length)
        equal(profile, beforeProfile, 'profile input immutable')
        equal(pool, beforePool, 'institution input immutable')
        const item = semantics?.candidateEvaluations[0]

        if (scenario === 'room_match') {
          check(item.roomFit.fit === 'match', 'verified compatible room matches')
          check(item.roomFit.institutionEvidenceRefs.every((ref) =>
            ref.projectionReason === 'raw_value_currently_verified' && ref.evidenceIds.length > 0), 'room match evidence current')
        }
        if (scenario === 'room_noncompatible_unknown' || scenario === 'room_empty_unknown' || scenario === 'room_unverified_unknown') {
          check(item.roomFit.fit === 'unknown', 'absence/noncompatible/unverified stays unknown')
          check(item.differences.some((entry) => entry.differenceCode === 'ROOM_TYPE_UNKNOWN'), 'room unknown gap')
        }
        if (scenario === 'room_not_applicable') check(item.roomFit.fit === 'not_applicable', 'room no preference neutral')
        if (scenario === 'meal_exact') check(item.mealScheduleFit.fit === 'match', 'meal exact stable code match')
        if (scenario === 'meal_known_mismatch') {
          check(item.mealScheduleFit.fit === 'mismatch', 'no meal containment')
          check(item.differences.some((entry) => entry.differenceCode === 'MEAL_SCHEDULE_MISMATCH'), 'meal mismatch code')
        }
        if (scenario === 'meal_data_unavailable') {
          check(item.mealScheduleFit.fit === 'unknown', 'unavailable fit unknown')
          check(item.mealScheduleFit.sourceState === 'data_unavailable', 'unavailable source preserved')
          check(item.mealScheduleFit.institutionEvidenceRefs[0].rawAvailability === 'unavailable', 'raw unavailable evidence preserved')
          check(item.differences.some((entry) => entry.differenceCode === 'MEAL_SCHEDULE_DATA_UNAVAILABLE'), 'unavailable code distinct')
        }
        if (scenario === 'meal_unknown') {
          check(item.mealScheduleFit.sourceState === 'unknown', 'unknown source preserved')
          check(item.mealScheduleFit.institutionEvidenceRefs[0].rawAvailability === 'unknown', 'raw unknown evidence preserved')
          check(item.differences.some((entry) => entry.differenceCode === 'MEAL_SCHEDULE_UNKNOWN'), 'unknown code distinct')
        }
        if (scenario === 'meal_not_applicable') check(item.mealScheduleFit.fit === 'not_applicable', 'meal no preference neutral')
        if (scenario === 'easy_chew_supported') check(item.reasons.some((entry) => entry.reasonCode === 'EASY_CHEW_SUPPORT'), 'easy chew reason')
        if (scenario === 'easy_chew_unavailable') check(item.differences.some((entry) => entry.differenceCode === 'EASY_CHEW_SUPPORT_UNAVAILABLE'), 'easy chew unavailable')
        if (scenario === 'easy_chew_inquiry') check(item.differences.some((entry) => entry.differenceCode === 'EASY_CHEW_SUPPORT_REQUIRES_INQUIRY'), 'easy chew inquiry')
        if (scenario === 'easy_chew_unknown') check(item.differences.some((entry) => entry.differenceCode === 'EASY_CHEW_SUPPORT_UNKNOWN'), 'easy chew unknown')
        if (scenario === 'modified_food_supported') {
          check(item.reasons.some((entry) => entry.reasonCode === 'MODIFIED_FOOD_SUPPORT'), 'modified food reason')
          check(!item.constraintResults.some((entry) => entry.constraintCode.includes('tube_feeding') && entry.elderRequirementStatus === 'required'), 'no tube feeding inference')
        }
        if (scenario === 'modified_food_unavailable') {
          check(item.differences.some((entry) => entry.differenceCode === 'MODIFIED_FOOD_SUPPORT_UNAVAILABLE'), 'modified food unavailable')
          check(item.matchTier === 'EXACT', 'nutrition does not change Safety or exact')
        }
        if (scenario === 'activity_display_only') {
          check(item.activityFit.rankParticipation === 'not_scorable', 'activity not scorable')
          check(item.rankTuple && !Object.prototype.hasOwnProperty.call(item.rankTuple, 'activityFit'), 'activity absent from rank tuple')
          check(!item.reasons.some((entry) => entry.reasonCode === 'ACTIVITY_SPACE_MATCH'), 'inactive activity reason not emitted')
        }
        if (scenario.startsWith('priority_')) {
          check(item.priorityFactors[0].status === 'not_scorable', 'priority not scorable')
          check(item.priorityFitVector.unknownCount === 0 && item.priorityFitVector.knownMismatchCount === 0, 'not scorable excluded from vector')
        }
        if (scenario === 'dedup_price') {
          check(item.rankParticipation.budget === 'consumed_by_priority', 'price consumes baseline')
          check(item.rankTuple.budgetFit === null && item.priorityFitVector.matchedCount === 1, 'price vector owner only')
          check(item.matchTier === 'EXACT', 'exact still checks real budget fit')
        }
        if (scenario === 'dedup_region') {
          check(item.rankParticipation.region === 'consumed_by_priority', 'region consumes baseline')
          check(item.rankTuple.regionFit === null && item.priorityFitVector.matchedCount === 1, 'region vector owner only')
        }
        if (scenario === 'dedup_rehab') {
          check(item.rankParticipation.rehabilitation === 'consumed_by_priority', 'rehab priority owner')
          check(item.rankTuple.rehabilitationSoftFit === null, 'rehab baseline neutral')
        }
        if (scenario === 'dedup_rehab_hard') {
          check(item.rankParticipation.rehabilitation === 'consumed_by_hard', 'rehab hard owner')
          check(item.priorityFitVector.matchedCount === 0, 'hard rehab excluded from vector')
        }
        if (scenario === 'dedup_care_safety') {
          check(item.priorityFactors[0].rankParticipation === 'consumed_by_hard', 'care priority Safety only')
          check(item.priorityFitVector.matchedCount === 0, 'care not double scored')
        }
        if (scenario === 'exact_all_match') check(item.matchTier === 'EXACT' && semantics.exactMatch, 'all structured match exact')
        if (scenario === 'exact_room_unknown_soft') check(item.matchTier === 'SOFT_NEAR', 'room unknown downgrades exact')
        if (scenario === 'exact_meal_mismatch_soft') check(item.matchTier === 'SOFT_NEAR', 'meal mismatch soft near')
        if (scenario === 'exact_meal_unknown_soft') check(item.matchTier === 'SOFT_NEAR', 'meal unknown soft near')
        if (scenario === 'exact_activity_neutral') check(item.matchTier === 'EXACT', 'activity unresolved exact neutral')
        if (scenario === 'exact_nutrition_neutral') check(item.matchTier === 'EXACT', 'nutrition unavailable exact neutral')
        if (scenario === 'exact_not_scorable_priority_neutral') check(item.matchTier === 'EXACT', 'not-scorable priority exact neutral')
        if (scenario === 'safety_unsupported') {
          check(item.matchTier === 'INELIGIBLE' && semantics.cards.length === 0, 'hard conflict wins')
          check(semantics.noExactMatch?.reasonCode === 'ALL_CANDIDATES_HAVE_HARD_CONFLICT', 'hard-conflict no-exact priority')
        }
        if (scenario === 'safety_unverified') check(item.matchTier === 'UNVERIFIED' && semantics.cards.length === 0, 'hard unknown wins')
        if (scenario === 'safety_conditional') check(item.matchTier === 'CONDITIONAL' && semantics.cards.length === 0, 'conditional separate')
        if (scenario === 'elder_readiness_blocked') {
          check(semantics.elderReadiness === 'blocked_by_required_clarification', 'nutrition readiness inherited')
          check(semantics.cards.length === 0, 'blocked readiness no cards')
          check(semantics.noExactMatch?.reasonCode === 'REQUIRED_CAPABILITY_UNRESOLVED', 'readiness no-exact priority')
          check(!item.differences.some((entry) => entry.differenceCode.startsWith('MODIFIED_FOOD_SUPPORT_')),
            'unknown chewing does not fabricate a modified-food need')
        }
        if (scenario === 'cards_five_exact') check(semantics.cards.length === 3, 'five exact top three')
        if (scenario === 'cards_two_exact') check(semantics.cards.length === 2, 'two exact means two cards')
        if (scenario === 'cards_four_soft') {
          check(semantics.cards.length === 3 && semantics.cards.every((entry) => entry.matchTier === 'SOFT_NEAR'), 'soft top three')
          check(semantics.noExactMatch?.reasonCode === 'ONLY_SOFT_NEAR_MATCHES', 'soft-near no-exact priority')
        }
        if (scenario === 'cards_only_conditional') {
          check(semantics.cards.length === 0 && semantics.conditionalCandidates.length === 3, 'conditional separate')
          check(semantics.noExactMatch?.reasonCode === 'ONLY_CONDITIONAL_CANDIDATES', 'conditional no-exact priority')
        }
        if (scenario === 'cards_no_unverified_ineligible') check(semantics.cards.length === 0
          && semantics.candidateEvaluations.some((entry) => entry.matchTier === 'UNVERIFIED')
          && semantics.candidateEvaluations.some((entry) => entry.matchTier === 'INELIGIBLE'), 'unverified/ineligible audit only')
        if (scenario === 'deterministic_priority_order') {
          equal(semantics.elderSnapshot.preference.priorities,
            ['caregiver_quality', 'price', 'region'], 'priority order canonical')
          equal(semantics.candidateEvaluations.map((entry) => entry.institutionId), [
            pool[3].institutionId, pool[2].institutionId, pool[0].institutionId, pool[1].institutionId,
          ], 'priority vector orders match, partial, unknown, mismatch')
        }
        if (scenario === 'input_immutability') check(true, 'deep-frozen input accepted without mutation')
        if (scenario === 'full_pool_manifest') {
          check(semantics.poolManifest.entries.length === 8 && semantics.candidateEvaluations.length === 8, 'full pool evaluated')
          check(semantics.poolManifest.entries.every((entry) => entry.extensionFields.some((ref) => ref.fieldPath === 'meal.mealSchedule')), 'extension refs manifest')
          check(semantics.poolManifest.entries.every((entry) => {
            const manifestEvidenceIds = entry.evidence.map((evidence) => evidence.evidenceId)
            return [...entry.matchingFields, ...entry.extensionFields].every((ref) =>
              ref.evidenceIds.every((id) => manifestEvidenceIds.includes(id)))
          }), 'manifest evidence closure')
          const emptyResult = evaluate(profile, [])
          const emptySemantics = validCommon(emptyResult, 0)
          check(emptySemantics.cards.length === 0, 'empty pool produces no cards')
          check(emptySemantics.noExactMatch?.reasonCode === 'NO_VERIFIED_INSTITUTION_POOL', 'empty pool no-exact priority')
        }
        if (scenario === 'budget_advisory') {
          check(semantics.advisories.length === 1 && semantics.advisories[0].code === 'HIGH_CARE_LOW_BUDGET', 'advisory copied')
          check(semantics.advisories[0].rankParticipation === 'not_applicable', 'advisory rank neutral')
          check(semantics.advisories[0].institutionEvidenceRefs.length === 0, 'advisory result-level only')
        }
      }
      assertionCounts.set(fixture.id, count)
    } catch (error) {
      failures.push(`${fixture.id}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
      assertionCounts.set(fixture.id, count)
    }
  }

  recommendationV2Fixtures.forEach(runFixture)

  try {
    assert.deepEqual(recommendationV2Fixtures.map((fixture) => fixture.id), REC_V2_EXPECTED_CASE_IDS)
    assert.equal(recommendationV2Fixtures.length, REC_V2_FIXTURE_MANIFEST.expectedCount)
    assert.equal(new Set(executedIds).size, REC_V2_FIXTURE_MANIFEST.expectedCount)
    assert.deepEqual(executedIds, REC_V2_EXPECTED_CASE_IDS)
    REC_V2_EXPECTED_CASE_IDS.forEach((id) => {
      assert.ok((assertionCounts.get(id) || 0) >= REC_V2_FIXTURE_MANIFEST.minimumAssertionsPerCase,
        `${id} executed only ${assertionCounts.get(id) || 0} assertions`)
    })
  } catch (error) {
    failures.push(`ANTI-FAKE-GREEN: ${error instanceof Error ? error.message : String(error)}`)
  }

  for (const [filePath, source] of loadedSources) {
    if (!filePath.includes(`${path.sep}domain${path.sep}recommendation${path.sep}v2${path.sep}`)) continue
    if (/\b(?:Date\.now|new\s+Date|Math\.random)\s*\(/.test(source)) failures.push(`FORBIDDEN_TIME_RANDOM: ${filePath}`)
    if (/\bwx\s*\./.test(source)) failures.push(`FORBIDDEN_WX: ${filePath}`)
    if (/(?:from|require\s*\()\s*['"][^'"]*(?:pages|services|store|scripts\/fixtures)/.test(source)) {
      failures.push(`FORBIDDEN_DOMAIN_DEPENDENCY: ${filePath}`)
    }
    if (/\b(?:setStorage|getStorage|localStorage)\b/.test(source)) failures.push(`FORBIDDEN_PERSISTENCE: ${filePath}`)
  }

  if (failures.length > 0) {
    console.error('RECOMMENDATION_V2_RUNTIME = FAIL')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${typescript.version} (${parserPath})`)
  console.log(`REC_V2_FIXED_FIXTURES: ${executedIds.length}/${REC_V2_FIXTURE_MANIFEST.expectedCount} PASS`)
  console.log(`MIN_ASSERTIONS_PER_CASE: ${REC_V2_FIXTURE_MANIFEST.minimumAssertionsPerCase} PASS`)
  console.log('FORMAL_PREVIEW_PARITY: 6/6 PASS')
  console.log('DETERMINISM_PERMUTATION_IMMUTABILITY: PASS')
  console.log(`LOADED_SOURCE_MODULES: ${loadedSources.size}`)
  console.log('RECOMMENDATION_V2_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('RECOMMENDATION_V2_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
