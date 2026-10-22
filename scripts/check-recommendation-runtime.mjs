import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import {
  FIXTURE_ASSERTION_COUNT,
  FIXTURE_PROVENANCE_ASSERTIONS,
  RECOMMENDATION_FIXTURE_DATASET_MODE,
  RECOMMENDATION_FIXTURE_DATASET_VERSION,
  RECOMMENDATION_FIXTURE_EVALUATION_AS_OF,
  RECOMMENDATION_FIXTURE_POLICY_VERSION,
  RECOMMENDATION_FIXTURE_RULESET_VERSION,
  cloneRecommendationInstitution,
  makeExpiredInstitution,
  makeInstitutionPool,
  makeRecommendationAssessment,
  makeRecommendationPreviewDraft,
  makeValidUntilBoundaryInstitution,
  recommendationFixtures,
} from './fixtures/recommendation-fixtures.mjs'
import { MATCHING_CRITICAL_FIELD_PATHS } from './fixtures/institution-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recommendationDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation')
const elderProfileDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile')
const institutionDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution')
const typesRoot = path.join(repositoryRoot, 'miniprogram', 'types')
const recommendationEntryPath = path.join(recommendationDomainRoot, 'index.ts')
const elderProfileEntryPath = path.join(elderProfileDomainRoot, 'index.ts')
const institutionEntryPath = path.join(institutionDomainRoot, 'index.ts')

const failures = []
const executedCaseIds = []
const executedAssertionCounts = new Map()

// This list is intentionally independent of recommendationFixtures. A fixture
// can disappear, duplicate, or be skipped without shrinking the expected set.
const EXPECTED_CASE_IDS = Object.freeze([
  'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10',
  'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20',
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10',
  'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10',
  'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20',
  'C21', 'C22',
  'RANK-001', 'RANK-002', 'RANK-003', 'RANK-004', 'RANK-005', 'RANK-006',
  'RANK-007', 'RANK-008', 'RANK-009', 'RANK-010', 'RANK-011', 'RANK-012',
  'RANK-013', 'RANK-014',
  'BOUNDARY-5X4-CAPABILITY-MATRIX',
  'BOUNDARY-CARE-LEVEL-NO-INHERITANCE',
  'BOUNDARY-SPECIAL-CARE-NINE',
  'BOUNDARY-RAW-UNSUPPORTED-UNVERIFIED',
  'BOUNDARY-EXPIRY',
  'BOUNDARY-TIME',
  'BOUNDARY-REHAB-HARD',
  'BOUNDARY-REHAB-STRONG-SOFT',
  'BOUNDARY-REHAB-SOFT',
  'BOUNDARY-READINESS',
  'BOUNDARY-PREVIEW-FORMAL-CORE-PARITY',
  'BOUNDARY-NO-IDENTITY-CACHE-PERSISTENCE',
  'BOUNDARY-MANIFEST-EVIDENCE-CLOSURE',
  'BOUNDARY-MALFORMED-INPUT',
  'BOUNDARY-MALFORMED-KNOWN-VALUE',
  'BOUNDARY-MALFORMED-SPECIAL-STATUS',
  'BOUNDARY-MALFORMED-DANGLING-EVIDENCE',
  'BOUNDARY-MALFORMED-WRONG-FIELD-EVIDENCE',
  'BOUNDARY-MALFORMED-DANGLING-CLARIFICATION',
  'BOUNDARY-MALFORMED-WRONG-FIELD-CLARIFICATION',
  'BOUNDARY-ADVISORY-ISOLATED',
  'BOUNDARY-SNAPSHOT-IMMUTABILITY',
  'BOUNDARY-PRODUCTION-MOCK-EXCLUSION',
  'BOUNDARY-MOCKMODE-NONMOCK-EXCLUSION',
  'BOUNDARY-RECORD-STATUS-MIXED-MANIFEST',
  'BOUNDARY-TIME-OFFSET-EQUIVALENCE',
  'BOUNDARY-UNKNOWN-SNAPSHOT-NULL',
  'BOUNDARY-STARTING-AT-PRICE',
  'BOUNDARY-PREVIEW-EXTRA-SOURCE',
  'BOUNDARY-FORMAL-EXTRA-IDENTITY',
  'BOUNDARY-REHAB-UNKNOWN-NOT-SOFT-EXCEPTION',
  'BOUNDARY-CARD-LIMIT-MAX3',
  'BOUNDARY-CONDITIONAL-SUMMARY',
  'BOUNDARY-FORMAL-MISSING-BASIC',
  'BOUNDARY-PREVIEW-MISSING-BASIC',
  'BOUNDARY-FORMAL-MISSING-SUMMARY',
  'BOUNDARY-PREVIEW-MISSING-SUMMARY',
  'ANTI-FAKE-GREEN-MISSING',
  'ANTI-FAKE-GREEN-DUPLICATE',
  'ANTI-FAKE-GREEN-SKIPPED',
  'ANTI-FAKE-GREEN-COUNT-DRIFT',
])

const EXPECTED_ASSERTION_COUNT = 6
const EXPECTED_CASE_MANIFEST = Object.freeze(
  EXPECTED_CASE_IDS.map((id) => ({ id, assertionCount: EXPECTED_ASSERTION_COUNT })),
)

const normalizePath = (filePath) => path.resolve(filePath).toLowerCase()

const isWithin = (filePath, root) => {
  const file = normalizePath(filePath)
  const base = normalizePath(root)
  return file === base || file.startsWith(`${base}${path.sep}`)
}

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const deepEqual = (left, right) => {
  try {
    // VM realm prototypes are not part of the serialized domain contract.
    assert.deepEqual(deepClone(left), deepClone(right))
    return true
  } catch {
    return false
  }
}

const containsKey = (value, forbiddenKeys, seen = new Set()) => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  if (seen.has(value)) {
    return false
  }
  seen.add(value)
  if (Object.keys(value).some((key) => forbiddenKeys.has(key))) {
    return true
  }
  return Object.values(value).some((child) => containsKey(child, forbiddenKeys, seen))
}

const diagnosticText = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || typeof diagnostic.start !== 'number') {
    return message
  }
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`
}

const loadWechatTypeScript = async () => {
  const accept = (parserPath, source) => {
    const parser = require(parserPath)
    if (!parser || parser.version !== '4.1.2') {
      throw new Error(`Recommendation runtime requires TypeScript 4.1.2; got ${parser && parser.version ? parser.version : 'unknown'} from ${parserPath}`)
    }
    return { parser, parserPath, source }
  }

  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    if (!existsSync(parserPath)) {
      throw new Error(`WECHAT_TYPESCRIPT_PATH does not exist: ${parserPath}`)
    }
    return accept(parserPath, 'WECHAT_TYPESCRIPT_PATH')
  }

  try {
    const parserPath = require.resolve('typescript')
    return accept(parserPath, 'project TypeScript parser')
  } catch {
    // The project intentionally does not install TypeScript as a runtime dep.
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat DevTools TypeScript 4.1.2 not found; set WECHAT_TYPESCRIPT_PATH explicitly')
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
    throw new Error('WeChat DevTools TypeScript 4.1.2 not found; open DevTools or set WECHAT_TYPESCRIPT_PATH')
  }
  const errors = []
  for (const candidate of candidates) {
    try {
      return accept(candidate.parserPath, 'WeChat DevTools mptslib')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`No TypeScript 4.1.2 parser found in WeChat DevTools:\n${errors.join('\n')}`)
}

const createSourceLoader = (typescript, loadedSourcePaths, loadedSourceTexts, externalImports) => {
  const moduleCache = new Map()
  const allowedRoots = [recommendationDomainRoot, elderProfileDomainRoot, institutionDomainRoot, typesRoot]
  const resolveModule = (request, importer) => {
    const requestWithoutExtension = request.endsWith('.ts') || request.endsWith('.js')
      ? request.slice(0, -3)
      : request
    const basePath = path.resolve(path.dirname(importer), requestWithoutExtension)
    const candidates = [
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
    if (!allowedRoots.some((root) => isWithin(resolvedPath, root))) {
      throw new Error(`Recommendation runtime loaded a file outside its pure dependency boundary: ${path.relative(repositoryRoot, resolvedPath)}`)
    }
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    const source = readFileSync(resolvedPath, 'utf8')
    loadedSourcePaths.add(resolvedPath)
    loadedSourceTexts.set(resolvedPath, source)
    const output = resolvedPath.endsWith('.ts')
      ? (() => {
        const result = typescript.transpileModule(source, {
          compilerOptions: {
            module: typescript.ModuleKind.CommonJS,
            target: typescript.ScriptTarget.ES2019,
            esModuleInterop: true,
          },
          fileName: resolvedPath,
          reportDiagnostics: true,
        })
        const errors = (result.diagnostics || [])
          .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
        if (errors.length > 0) {
          throw new Error(`WeChat TypeScript parser rejected ${path.relative(repositoryRoot, resolvedPath)}:\n${errors.map((diagnostic) => diagnosticText(typescript, diagnostic)).join('\n')}`)
        }
        return result.outputText
      })()
      : source
    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        externalImports.push(`${path.relative(repositoryRoot, resolvedPath)} -> ${request}`)
        throw new Error(`Pure Recommendation runtime forbids external import ${request} from ${resolvedPath}`)
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

const makeManifestError = (message) => {
  throw new Error(message)
}

/**
 * The manifest gate is deliberately exported through the local closure only:
 * production code cannot use it to decide which tests exist.
 */
const validateCaseManifest = (expectedManifest, fixtures, executedIds = null) => {
  const expectedIds = expectedManifest.map((entry) => entry.id)
  if (new Set(expectedIds).size !== expectedIds.length) {
    makeManifestError('expected manifest contains duplicate case IDs')
  }
  const actualIds = fixtures.map((fixture) => fixture.id)
  const actualDuplicates = actualIds.filter((id, index) => actualIds.indexOf(id) !== index)
  if (actualDuplicates.length > 0) {
    makeManifestError(`fixture manifest contains duplicate case ID(s): ${actualDuplicates.join(', ')}`)
  }
  if (actualIds.length !== expectedIds.length) {
    const missing = expectedIds.filter((id) => !actualIds.includes(id))
    const unexpected = actualIds.filter((id) => !expectedIds.includes(id))
    makeManifestError(`fixture manifest set drifted; missing=${missing.join(',') || '-'} unexpected=${unexpected.join(',') || '-'}`)
  }
  expectedIds.forEach((id, index) => {
    if (actualIds[index] !== id) {
      makeManifestError(`fixture manifest order/set drifted at ${index}: expected ${id}, got ${actualIds[index]}`)
    }
  })
  expectedManifest.forEach((entry, index) => {
    if (!Number.isInteger(entry.assertionCount) || entry.assertionCount <= 0) {
      makeManifestError(`expected assertion count invalid for ${entry.id}`)
    }
    if (fixtures[index].assertionCount !== entry.assertionCount) {
      makeManifestError(`assertion count drift for ${entry.id}: expected ${entry.assertionCount}, got ${fixtures[index].assertionCount}`)
    }
  })
  if (executedIds !== null) {
    if (new Set(executedIds).size !== executedIds.length) {
      makeManifestError('executed case IDs contain duplicates')
    }
    if (executedIds.length !== expectedIds.length) {
      makeManifestError(`executed case count drift: expected ${expectedIds.length}, got ${executedIds.length}`)
    }
    expectedIds.forEach((id, index) => {
      if (executedIds[index] !== id) {
        makeManifestError(`case skipped or reordered at ${index}: expected ${id}, got ${executedIds[index]}`)
      }
    })
  }
  return true
}

const errorMessage = (error) => error instanceof Error ? error.message : String(error)

const safe = (callback, fallback = undefined) => {
  try {
    return callback()
  } catch {
    return fallback
  }
}

const isPlainRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const isSnapshot = (value) => value === null || (isPlainRecord(value)
  && typeof value.valueType === 'string'
  && Object.prototype.hasOwnProperty.call(value, 'value'))

const PROJECTION_REASONS = new Set([
  'raw_value_currently_verified',
  'raw_value_unknown',
  'raw_value_unverified',
  'raw_value_expired',
  'raw_value_past_valid_until',
  'verification_in_future',
  'raw_field_unavailable',
])

const profileForSpec = (spec, deriveElderProfile, deriveElderProfilePreview, options = {}) => {
  const effectiveSpec = {
    ...spec,
    answerOverrides: {
      ...(spec.answerOverrides || {}),
      ...(options.answerOverrides || {}),
    },
  }
  if (spec.kind === 'preview') {
    const draft = makeRecommendationPreviewDraft(effectiveSpec, options.localDraftId || `recommendation-${spec.id.toLowerCase()}-draft`)
    const result = deriveElderProfilePreview(draft)
    if (!result.ok) {
      throw new Error(`preview fixture ${spec.id} did not derive: ${JSON.stringify(result)}`)
    }
    return { profile: result.preview, assessment: null, draft }
  }
  const assessment = makeRecommendationAssessment(effectiveSpec)
  const result = deriveElderProfile(assessment)
  if (!result.ok) {
    throw new Error(`formal fixture ${spec.id} did not derive: ${JSON.stringify(result)}`)
  }
  return { profile: result.profile, assessment, draft: null }
}

const makeInputForSpec = (spec, deriveElderProfile, deriveElderProfilePreview, overrides = {}) => {
  const profileResult = profileForSpec(spec, deriveElderProfile, deriveElderProfilePreview, overrides)
  const poolDefinitions = overrides.poolDefinitions || spec.pool || []
  const institutions = overrides.institutions || makeInstitutionPool(poolDefinitions)
  const input = {
    profile: profileResult.profile,
    institutions,
    datasetVersion: overrides.datasetVersion || spec.datasetVersion || RECOMMENDATION_FIXTURE_DATASET_VERSION,
    datasetMode: overrides.datasetMode || spec.datasetMode || RECOMMENDATION_FIXTURE_DATASET_MODE,
    evaluationAsOf: overrides.evaluationAsOf || spec.evaluationAsOf || RECOMMENDATION_FIXTURE_EVALUATION_AS_OF,
    rulesetVersion: overrides.rulesetVersion || RECOMMENDATION_FIXTURE_RULESET_VERSION,
    policyVersion: overrides.policyVersion || RECOMMENDATION_FIXTURE_POLICY_VERSION,
  }
  return { ...profileResult, institutions, input }
}

const makeEvaluatorResult = (spec, modules, overrides = {}) => {
  const context = makeInputForSpec(spec, modules.deriveElderProfile, modules.deriveElderProfilePreview, overrides)
  const evaluator = spec.kind === 'preview'
    ? modules.evaluateRecommendationPreview
    : modules.evaluateFormalRecommendation
  if (typeof evaluator !== 'function') {
    throw new Error(`${spec.kind === 'preview' ? 'evaluateRecommendationPreview' : 'evaluateFormalRecommendation'} export is missing`)
  }
  if (spec.malformed) {
    context.input.profile = null
  }
  if (spec.malformedProfile) {
    mutateMalformedProfile(context.input.profile, spec.malformedProfile)
  }
  const inputBefore = deepClone(context.input)
  const result = evaluator(context.input)
  return { ...context, inputBefore, result, spec }
}

const mutateMalformedProfile = (profile, kind) => {
  if (!profile) {
    return
  }
  if (kind === 'missing_basic') {
    delete profile.basic
    return
  }
  if (kind === 'missing_summary') {
    delete profile.userFacingSummary
    return
  }
  if (kind === 'extra_preview_source') {
    profile.source.assessmentCompletedAt = 'fixture-only-extra-field'
    return
  }
  if (kind === 'extra_formal_identity') {
    profile.identity.extraLocalField = 'fixture-only-extra-field'
    return
  }
  if (kind === 'rehab_unknown') {
    const requirement = profile.specialCare.derivedFacts.requiredCareCapabilities.find((entry) => entry.capability === 'rehabilitation_training')
    requirement.status = 'unknown'
    profile.evidence.find((entry) => requirement.evidenceIds.includes(entry.evidenceId)).outcomeCode = 'unknown'
    return
  }
  if (kind === 'known_value') {
    profile.adl.derivedFacts.careLevel = {
      ...profile.adl.derivedFacts.careLevel,
      status: 'known',
      value: 'invalid_care_level',
      confidence: 'high',
    }
    return
  }
  if (kind === 'special_status') {
    profile.specialCare.derivedFacts.requiredCareCapabilities[0].status = 'invalid_status'
    return
  }
  if (kind === 'dangling_evidence') {
    profile.adl.derivedFacts.careLevel.evidenceIds = ['ev:dangling:careLevel']
    return
  }
  if (kind === 'wrong_field_evidence') {
    const wrongEvidence = profile.evidence.find((entry) => entry.derivedField === 'specialCare.requiredCareCapabilities.tube_feeding')
    profile.adl.derivedFacts.careLevel.evidenceIds = [wrongEvidence ? wrongEvidence.evidenceId : 'ev:wrong-field:tube-feeding']
    return
  }
  if (kind === 'dangling_clarification') {
    profile.adl.derivedFacts.careLevel.clarificationIds = ['cl:dangling:clarification']
    return
  }
  if (kind === 'wrong_field_clarification') {
    const wrongClarification = profile.clarifications.find((entry) => entry.affectedDerivedFields.indexOf('adl.careLevel') < 0)
    profile.adl.derivedFacts.careLevel.clarificationIds = [wrongClarification
      ? wrongClarification.clarificationId
      : 'cl:wrong-field:clarification']
  }
}

const semanticsOf = (result) => result && result.ok && result.value && result.value.semantics
  ? result.value.semantics
  : null

const idsOf = (items) => Array.isArray(items) ? items.map((item) => item.institutionId) : []

const candidateMap = (semantics) => Object.fromEntries(
  (semantics && Array.isArray(semantics.candidateEvaluations) ? semantics.candidateEvaluations : [])
    .map((item) => [item.institutionId, item]),
)

const factorOf = (item, factorCode) => item && item.softFit && Array.isArray(item.softFit.factors)
  ? item.softFit.factors.find((factor) => factor.factorCode === factorCode)
  : undefined

const constraintsOf = (semantics) => (semantics && Array.isArray(semantics.candidateEvaluations)
  ? semantics.candidateEvaluations
  : []).flatMap((item) => Array.isArray(item.constraintResults) ? item.constraintResults : [])

const constraintForCode = (semantics, code) => constraintsOf(semantics).find((constraint) =>
  String(constraint.institutionFieldPath || '').endsWith(`.${code}`)
  || String(constraint.constraintCode || '').includes(code))

const verifyManifestClosure = (semantics, input) => {
  if (!semantics || !semantics.poolManifest || !Array.isArray(semantics.poolManifest.entries)) {
    return false
  }
  const manifest = semantics.poolManifest
  if (manifest.datasetVersion !== input.datasetVersion
    || manifest.datasetMode !== input.datasetMode
    || manifest.evaluationAsOf !== input.evaluationAsOf
    || manifest.entries.length !== input.institutions.length) {
    return false
  }
  const inputIds = input.institutions.map((record) => record.institutionId).sort()
  const manifestIds = manifest.entries.map((entry) => entry.institutionId).sort()
  const manifestOrder = manifest.entries.map((entry) => entry.institutionId)
  if (!deepEqual(inputIds, manifestIds)
    || !deepEqual(manifestOrder, manifestOrder.slice().sort())) {
    return false
  }
  const pathSet = new Set(MATCHING_CRITICAL_FIELD_PATHS)
  return manifest.entries.every((entry) => {
    const inputRecord = entry && input.institutions.find((record) => record.institutionId === entry.institutionId)
    if (!entry || !Number.isInteger(entry.recordRevision)
      || !inputRecord
      || entry.recordRevision !== inputRecord.recordRevision
      || entry.recordProvenance !== inputRecord.recordProvenance
      || entry.recordStatus !== inputRecord.recordStatus
      || !Array.isArray(entry.matchingFields)
      || entry.matchingFields.length !== MATCHING_CRITICAL_FIELD_PATHS.length
      || new Set(entry.matchingFields.map((ref) => ref.fieldPath)).size !== MATCHING_CRITICAL_FIELD_PATHS.length
      || !deepEqual(entry.matchingFields.map((ref) => ref.fieldPath), MATCHING_CRITICAL_FIELD_PATHS)
      || !entry.matchingFields.every((ref) => pathSet.has(ref.fieldPath)
        && ref.institutionId === entry.institutionId
        && ref.recordRevision === entry.recordRevision
        && ref.evaluationAsOf === input.evaluationAsOf
        && Array.isArray(ref.evidenceIds)
        && isSnapshot(ref.rawSnapshot)
        && isSnapshot(ref.effectiveSnapshot)
        && PROJECTION_REASONS.has(ref.projectionReason)
        && (ref.verificationStatus === 'unverified' || ref.verificationStatus === 'verified' || ref.verificationStatus === 'expired'))
      || !Array.isArray(entry.evidence)
      || !entry.evidence.every((evidence) => evidence.institutionId === entry.institutionId
        && evidence.recordRevision === entry.recordRevision
        && pathSet.has(evidence.fieldPath)
        && typeof evidence.evidenceId === 'string'
        && isPlainRecord(inputRecord.evidence.find((source) => source.evidenceId === evidence.evidenceId))
        && deepEqual(evidence.valueSnapshot, inputRecord.evidence.find((source) => source.evidenceId === evidence.evidenceId).valueSnapshot)
        && evidence.verificationStatus === inputRecord.evidence.find((source) => source.evidenceId === evidence.evidenceId).verificationStatus)) {
      return false
    }
    if (entry.disposition === 'included' && entry.exclusionReasonCode !== undefined) {
      return false
    }
    if (entry.disposition === 'excluded' && typeof entry.exclusionReasonCode !== 'string') {
      return false
    }
    const expectedExclusionReason = inputRecord.recordStatus !== 'published'
      ? 'RECORD_NOT_PUBLISHED'
      : input.datasetMode === 'PRODUCTION' && inputRecord.recordProvenance !== 'PRODUCTION_CANDIDATE'
        ? 'MOCK_DATA_NOT_PRODUCTION'
        : input.datasetMode === 'MOCK_DEVELOPMENT_ONLY' && inputRecord.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY'
          ? 'NON_MOCK_DATA_IN_SYNTHETIC_MODE'
          : null
    if (expectedExclusionReason === null && entry.disposition !== 'included') {
      return false
    }
    if (expectedExclusionReason !== null
      && (entry.disposition !== 'excluded' || entry.exclusionReasonCode !== expectedExclusionReason)) {
      return false
    }
    const evidenceIds = new Set(entry.evidence.map((evidence) => evidence.evidenceId))
    const evidenceOrder = entry.evidence.map((evidence) => evidence.evidenceId)
    const sortedEvidenceOrder = evidenceOrder.slice().sort()
    return deepEqual(evidenceOrder, sortedEvidenceOrder)
      && entry.matchingFields.every((ref) => ref.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId)))
  })
}

const verifyResultRefs = (semantics) => {
  if (!semantics || !semantics.poolManifest) {
    return false
  }
  const pathSet = new Set(MATCHING_CRITICAL_FIELD_PATHS)
  const items = [
    ...(semantics.candidateEvaluations || []),
    ...(semantics.items || []),
    ...(semantics.conditionalCandidates || []),
  ]
  return items.every((item) => {
    if (!item || !Number.isInteger(item.recordRevision)) {
      return false
    }
    const refs = [
      ...(item.constraintResults || []).flatMap((constraint) => constraint.institutionEvidenceRefs || []),
      ...(item.softFit && item.softFit.factors || []).flatMap((factor) => factor.institutionEvidenceRefs || []),
      ...(item.reasons || []).flatMap((reason) => reason.institutionEvidenceRefs || []),
      ...(item.differences || []).flatMap((difference) => difference.institutionEvidenceRefs || []),
    ]
    return refs.every((ref) => {
      const manifestEntry = semantics.poolManifest.entries.find((entry) => entry.institutionId === item.institutionId)
      const manifestRef = manifestEntry && manifestEntry.matchingFields.find((candidate) => candidate.fieldPath === ref.fieldPath)
      return ref.institutionId === item.institutionId
        && ref.recordRevision === item.recordRevision
        && pathSet.has(ref.fieldPath)
        && ref.evaluationAsOf === semantics.evaluationAsOf
        && manifestRef !== undefined
        && deepEqual(ref, manifestRef)
    })
  })
}

const verifyNoHiddenScore = (value) => !containsKey(value, new Set([
  'score', 'globalScore', 'matchingScore', 'weightedSum', 'percentage', 'matchingPercentage',
]))

const verifyReasons = (semantics) => {
  const items = [
    ...(semantics && semantics.candidateEvaluations || []),
    ...(semantics && semantics.items || []),
    ...(semantics && semantics.conditionalCandidates || []),
  ]
  return items.every((item) => (item.reasons || []).every((reason) => {
    if (reason.polarity !== 'supported') {
      return true
    }
    return (reason.institutionEvidenceRefs || []).length > 0
      && reason.institutionEvidenceRefs.every((ref) => ref.effectiveSnapshot !== null
        && ref.projectionReason === 'raw_value_currently_verified'
        && (!ref.fieldPath.startsWith('capabilities.') || ref.effectiveSnapshot.value === 'supported'))
  }))
}

const normalizedCore = (value) => value && value.semantics ? value.semantics : value

const runPairwiseInvariant = (spec, context, modules) => {
  const evaluate = (alternateSpec, overrides = {}) => makeEvaluatorResult(alternateSpec, modules, overrides).result
  if (spec.pairwise === 'institution_order') {
    const reversed = { ...spec, pool: [...spec.pool].reverse() }
    return deepEqual(normalizedCore(context.result.value), normalizedCore(evaluate(reversed).value))
  }
  if (spec.pairwise === 'priority_order') {
    const priorities = spec.priorityPair || [['price', 'close_to_family'], ['close_to_family', 'price']]
    const left = { ...spec, answerOverrides: { ...(spec.answerOverrides || {}), 'preference.priorities': priorities[0] } }
    const right = { ...spec, answerOverrides: { ...(spec.answerOverrides || {}), 'preference.priorities': priorities[1] } }
    const leftResult = evaluate(left)
    const rightResult = evaluate(right)
    const leftSemantics = semanticsOf(leftResult)
    const rightSemantics = semanticsOf(rightResult)
    return Boolean(leftResult.ok && rightResult.ok && leftSemantics && rightSemantics)
      && deepEqual(leftResult.value, rightResult.value)
  }
  if (spec.pairwise === 'price_dedup') {
    const noPriority = { ...spec, answerOverrides: { ...(spec.answerOverrides || {}), 'preference.priorities': ['living_environment'] } }
    const baseResult = evaluate(noPriority)
    const current = semanticsOf(context.result)
    const baseline = semanticsOf(baseResult)
    const currentItems = current && current.items || []
    const baselineItems = baseline && baseline.items || []
    // Both prices are known mismatches in the selected-priority bucket. The
    // consumed baseline must not secretly prefer B's below-range price to A's
    // above-range price; without price priority, the frozen baseline does.
    const mismatchPool = [
      { fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 1300000, maxAmountMinor: 1400000 }] },
      { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 500000, maxAmountMinor: 600000 }] },
    ]
    const priorityTie = semanticsOf(evaluate({ ...spec, pool: mismatchPool }))
    const baselineOrder = semanticsOf(evaluate({ ...noPriority, pool: mismatchPool }))
    return currentItems.length > 0
      && deepEqual(idsOf(currentItems), idsOf(baselineItems))
      && currentItems.every((item) => item.rankParticipation?.budget === 'consumed_by_priority'
        && item.rankTuple?.budgetFit === null)
      && deepEqual(idsOf(priorityTie?.items), ['institution-a-mock', 'institution-b-mock'])
      && deepEqual(idsOf(baselineOrder?.items), ['institution-b-mock', 'institution-a-mock'])
  }
  if (spec.pairwise === 'rehab_dedup') {
    const current = semanticsOf(context.result)
    const items = current && current.items || []
    const healthSoft = semanticsOf(evaluate({ ...spec,
      answerOverrides: { ...spec.answerOverrides, 'health.rehabilitationNeed': 'possible' },
    }))
    return items.length >= 2
      && items[0].institutionId === 'institution-a-mock'
      && items.every((item) => item.rankParticipation?.rehabilitation === 'consumed_by_priority'
        && item.rankTuple?.rehabilitationSoftFit === null)
      && healthSoft?.elderReadiness === 'ready'
      && healthSoft.candidateEvaluations.length === 2
      && healthSoft.candidateEvaluations.every((item) => item.rankParticipation?.rehabilitation === 'consumed_by_priority'
        && item.rankTuple?.rehabilitationSoftFit === null)
  }
  if (spec.pairwise === 'not_scorable_priority') {
    const priorities = spec.priorityPair || [['living_environment'], ['food_quality']]
    const left = evaluate({ ...spec, answerOverrides: { ...(spec.answerOverrides || {}), 'preference.priorities': priorities[0] } })
    const right = evaluate({ ...spec, answerOverrides: { ...(spec.answerOverrides || {}), 'preference.priorities': priorities[1] } })
    const leftSemantics = semanticsOf(left)
    const rightSemantics = semanticsOf(right)
    // Different priority sets legitimately change snapshot/explanation data.
    // Only rank participation, tuple, tier and card selection must be neutral.
    const ranking = (semantics) => ({
      candidates: semantics.candidateEvaluations.map((item) => ({
        id: item.institutionId, tier: item.matchTier,
        tuple: item.rankTuple, participation: item.rankParticipation,
      })),
      items: idsOf(semantics.items), conditional: idsOf(semantics.conditionalCandidates),
    })
    return Boolean(left.ok && right.ok && leftSemantics && rightSemantics)
      && deepEqual(ranking(leftSemantics), ranking(rightSemantics))
  }
  if (spec.pairwise === 'availability') {
    const available = { ...spec, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }] }
    const availableResult = evaluate(available)
    return deepEqual(normalizedCore(context.result.value), normalizedCore(availableResult.value))
  }
  return false
}

const runCareLevelMatrix = (spec, modules) => {
  const careCases = [
    ['C01', 'independent'],
    ['C17', 'light_care'],
    ['C04', 'semi_disabled'],
    ['C05', 'disabled'],
    ['C07', 'severely_disabled'],
  ]
  const statuses = [
    ['supported', 'satisfied'],
    ['requires_assessment', 'conditional'],
    ['unsupported', 'conflict'],
    ['unknown', 'unverified'],
  ]
  return careCases.every(([profileFixtureId, careLevel]) => statuses.every(([status, outcome]) => {
    const caseSpec = {
      ...spec,
      id: `${spec.id}-${profileFixtureId}-${status}`,
      profileFixtureId,
      pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [
        { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 },
        { op: 'capability', group: 'careLevelAcceptance', code: careLevel, status, verificationStatus: status === 'unknown' ? 'unverified' : 'verified' },
      ] }],
    }
    const result = makeEvaluatorResult(caseSpec, modules).result
    const semantics = semanticsOf(result)
    const constraint = semantics && constraintForCode(semantics, careLevel)
    return Boolean(result.ok && constraint && constraint.outcome === outcome)
  }))
}

const runRequirementStatusMatrix = (spec, modules) => {
  const requirementAnswers = {
    required: { 'cognitive.specialCareNeeds': ['tube_feeding'] },
    not_required: { 'cognitive.specialCareNeeds': ['none'] },
    not_reported: { 'cognitive.specialCareNeeds': ['other'] },
    unknown: { 'cognitive.specialCareNeeds': ['unknown'] },
    needs_confirmation: { 'adl.eating': 'special_feeding', 'cognitive.specialCareNeeds': ['none'] },
  }
  const capabilityStatuses = [
    ['supported', 'satisfied'],
    ['requires_assessment', 'conditional'],
    ['unsupported', 'conflict'],
    ['unknown', 'unverified'],
  ]
  return Object.entries(requirementAnswers).every(([requirementStatus, answerOverrides]) => capabilityStatuses.every(([status, outcome]) => {
    const caseSpec = {
      ...spec,
      id: `${spec.id}-requirement-${requirementStatus}-${status}`,
      profileFixtureId: 'C01',
      answerOverrides: { ...spec.answerOverrides, ...answerOverrides },
      pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [
        { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 },
        { op: 'capability', group: 'specialCare', code: 'tube_feeding', status, verificationStatus: status === 'unknown' ? 'unverified' : 'verified' },
      ] }],
    }
    const result = makeEvaluatorResult(caseSpec, modules).result
    const semantics = semanticsOf(result)
    const requirement = safe(() => semantics.elderSnapshot.specialCare.requiredCareCapabilities.find((entry) => entry.capability === 'tube_feeding'))
    const constraint = semantics && constraintForCode(semantics, 'tube_feeding')
    if (requirementStatus === 'required') {
      return Boolean(result.ok && requirement && requirement.status === 'required' && constraint && constraint.outcome === outcome)
    }
    if (requirementStatus === 'unknown' || requirementStatus === 'needs_confirmation') {
      return Boolean(result.ok && requirement && requirement.status === requirementStatus
        && semantics.elderReadiness === 'blocked_by_required_clarification'
        && !constraint
        && semantics.items.length === 0
        && semantics.conditionalCandidates.length === 0)
    }
    return Boolean(result.ok && requirement && requirement.status === requirementStatus
      && semantics.elderReadiness === 'ready'
      && constraint && constraint.outcome === 'not_applicable'
      && semantics.exactMatch === true)
  }))
}

const runCareMatrix = (spec, modules) => runCareLevelMatrix(spec, modules) && runRequirementStatusMatrix(spec, modules)

const runNoInheritance = (spec, modules) => {
  const careLevels = ['independent', 'light_care', 'semi_disabled', 'disabled', 'severely_disabled']
  const profileFixturesByCareLevel = {
    independent: 'C01',
    light_care: 'C17',
    semi_disabled: 'C04',
    disabled: 'C05',
    severely_disabled: 'C07',
  }
  const patches = [
    { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 },
    ...careLevels.map((code) => ({ op: 'capability', group: 'careLevelAcceptance', code, status: 'unsupported' })),
    { op: 'capability', group: 'careLevelAcceptance', code: 'independent', status: 'supported' },
  ]
  const outcomes = careLevels.map((careLevel) => {
    const result = makeEvaluatorResult({
      ...spec,
      id: `${spec.id}-${careLevel}`,
      profileFixtureId: profileFixturesByCareLevel[careLevel],
      pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches }],
    }, modules).result
    const semantics = semanticsOf(result)
    return semantics && semantics.candidateEvaluations[0] && semantics.candidateEvaluations[0].matchTier
  })
  return outcomes.length === careLevels.length
    && outcomes[0] === 'EXACT'
    && outcomes.slice(1).every((tier) => tier === 'INELIGIBLE')
}

const runExpiry = (spec, modules) => {
  const expiredSpec = { ...spec, id: `${spec.id}-expired`, answerOverrides: { ...(spec.answerOverrides || {}), 'cognitive.specialCareNeeds': ['tube_feeding'] }, pool: [{ fixtureId: 'INSTITUTION_E_MOCK' }] }
  const boundarySpec = { ...spec, id: `${spec.id}-boundary`, answerOverrides: { ...(spec.answerOverrides || {}), 'cognitive.specialCareNeeds': ['tube_feeding'] }, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'valid_until', fieldPath: 'capabilities.specialCare.tube_feeding', value: RECOMMENDATION_FIXTURE_EVALUATION_AS_OF }] }] }
  const expired = makeEvaluatorResult(expiredSpec, modules).result
  const boundary = makeEvaluatorResult(boundarySpec, modules).result
  const expiredConstraint = constraintForCode(semanticsOf(expired), 'tube_feeding')
  const boundaryConstraint = constraintForCode(semanticsOf(boundary), 'tube_feeding')
  const expiredRef = safe(() => expiredConstraint.institutionEvidenceRefs[0])
  const boundaryRef = safe(() => boundaryConstraint.institutionEvidenceRefs[0])
  return Boolean(expiredConstraint && boundaryConstraint
    && expiredConstraint.institutionEffectiveStatus === 'unknown'
    && expiredConstraint.outcome === 'unverified'
    && expiredRef && expiredRef.projectionReason === 'raw_value_expired'
    && expiredRef.rawSnapshot !== null
    && expiredRef.effectiveSnapshot && expiredRef.effectiveSnapshot.value === 'unknown'
    && boundaryConstraint.institutionEffectiveStatus === 'supported'
    && boundaryConstraint.outcome === 'satisfied'
    && boundaryRef && boundaryRef.projectionReason === 'raw_value_currently_verified'
    && boundaryRef.rawSnapshot !== null && boundaryRef.effectiveSnapshot !== null)
}

const runOffsetTime = (spec, modules, context) => {
  const offsetEvaluationAsOf = '2026-08-31T17:00:00.000+08:00'
  const offsetResult = makeEvaluatorResult(spec, modules, { evaluationAsOf: offsetEvaluationAsOf }).result
  const currentSemantics = semanticsOf(context.result)
  const offsetSemantics = semanticsOf(offsetResult)
  if (!currentSemantics || !offsetSemantics) {
    return false
  }
  const currentItems = currentSemantics.candidateEvaluations || []
  const offsetItems = offsetSemantics.candidateEvaluations || []
  const projectionReasons = (semanticsValue) => Object.fromEntries(
    semanticsValue.poolManifest.entries
      .slice()
      .sort((left, right) => left.institutionId < right.institutionId ? -1 : left.institutionId > right.institutionId ? 1 : 0)
      .flatMap((entry) => entry.matchingFields
        .slice()
        .sort((left, right) => left.fieldPath < right.fieldPath ? -1 : left.fieldPath > right.fieldPath ? 1 : 0)
        .map((ref) => [`${entry.institutionId}|${ref.fieldPath}`, ref.projectionReason])),
  )
  return deepEqual(currentItems.map((item) => item.matchTier), offsetItems.map((item) => item.matchTier))
    && deepEqual(projectionReasons(currentSemantics), projectionReasons(offsetSemantics))
    && offsetSemantics.poolManifest.entries.every((entry) => entry.matchingFields.every((ref) => ref.evaluationAsOf === offsetEvaluationAsOf))
}

const runAdvisoryIsolation = (spec, modules, context) => {
  if (typeof modules.buildRecommendationAdvisories !== 'function') {
    return false
  }
  const before = deepClone(context.result.value)
  const advisoryResult = modules.buildRecommendationAdvisories({
    profile: context.profile,
    institutions: context.institutions,
    evaluationAsOf: context.input.evaluationAsOf,
  })
  const attachments = advisoryResult && advisoryResult.ok ? advisoryResult.value : advisoryResult
  const hasTypedAttachment = Array.isArray(attachments)
    && attachments.every((attachment) => attachment.advisoryCode === 'AVAILABILITY_DISPLAY_ONLY' || attachment.advisoryCode === 'UPFRONT_COST_NEEDS_INQUIRY')
    && attachments.every((attachment) => !(attachment.advisoryEvidenceRefs || []).some((ref) => MATCHING_CRITICAL_FIELD_PATHS.includes(ref.fieldPath)))
  return hasTypedAttachment && deepEqual(before, context.result.value)
}

const runSnapshotIsolation = (context, modules) => {
  // Use an independent evaluation input so this focused mutation check does
  // not weaken the generic input-immutability assertion for the main call.
  const isolated = makeEvaluatorResult(context.spec, modules)
  if (!isolated.result.ok) {
    return false
  }
  const firstValue = deepClone(isolated.result.value)
  const isolatedInput = isolated.input
  const profile = isolatedInput.profile
  const careLevel = safe(() => profile.adl.derivedFacts.careLevel)
  const careEvidenceId = careLevel && careLevel.evidenceIds && careLevel.evidenceIds[0]
  const careEvidence = careEvidenceId
    ? profile.evidence.find((entry) => entry.evidenceId === careEvidenceId)
    : null
  if (!careLevel || careLevel.status !== 'known' || !careEvidence) {
    return false
  }
  const originalCareValue = careLevel.value
  careLevel.value = originalCareValue === 'independent' ? 'light_care' : 'independent'
  // Keep the corresponding elder evidence record mutated as part of the same
  // caller-owned input mutation; no derived/evidence reference may alias the
  // returned semantic snapshot.
  careEvidence.outcomeCode = `${careEvidence.outcomeCode}:mutated`

  const firstInstitution = isolatedInput.institutions[0]
  const price = firstInstitution && firstInstitution.price.referenceMonthlyPrice
  const priceEvidence = firstInstitution && firstInstitution.evidence.find((entry) => entry.fieldPath === 'price.referenceMonthlyPrice')
  if (!price || !price.value || !price.value.range || !priceEvidence) {
    return false
  }
  // Mutate existing nested objects, not only replace the caller's properties:
  // otherwise a shallow-copy snapshot can falsely pass this isolation gate.
  price.value.range.min.amountMinor += 10000
  if (price.value.range.max) {
    price.value.range.max.amountMinor += 10000
  }
  priceEvidence.valueSnapshot.value.range.min.amountMinor += 20000
  firstInstitution.typeProfile.supportedTypes.value[0] = 'general_eldercare'
  const typeEvidence = firstInstitution.evidence.find((entry) => entry.fieldPath === 'typeProfile.supportedTypes')
  if (typeEvidence) typeEvidence.valueSnapshot.value[0] = 'mutated-after-evaluation'
  const afterMutation = isolated.result.value
  return deepEqual(firstValue, afterMutation)
}

const runMalformedStable = (spec, modules) => {
  const first = makeEvaluatorResult(spec, modules).result
  const second = makeEvaluatorResult(spec, modules).result
  return !first.ok && !second.ok && deepEqual(first, second)
}

const runAntiFakeCase = (spec, check) => {
  const baseFixtures = recommendationFixtures.slice()
  let caught = null
  try {
    if (spec.antiFake === 'missing') {
      validateCaseManifest(EXPECTED_CASE_MANIFEST, baseFixtures.slice(0, -1))
    } else if (spec.antiFake === 'duplicate') {
      validateCaseManifest(EXPECTED_CASE_MANIFEST, [...baseFixtures, baseFixtures[0]])
    } else if (spec.antiFake === 'skipped') {
      validateCaseManifest(EXPECTED_CASE_MANIFEST, baseFixtures, EXPECTED_CASE_IDS.slice(0, -1))
    } else if (spec.antiFake === 'count_drift') {
      const drifted = baseFixtures.slice()
      drifted[0] = { ...drifted[0], assertionCount: drifted[0].assertionCount + 1 }
      validateCaseManifest(EXPECTED_CASE_MANIFEST, drifted)
    }
  } catch (error) {
    caught = error
  }
  check(Boolean(caught), `${spec.id} should catch its simulated drift`)
  check(typeof (caught && caught.message) === 'string', `${spec.id} reports a stable error message`)
  check(validateCaseManifest(EXPECTED_CASE_MANIFEST, baseFixtures) === true, `${spec.id} leaves the real manifest valid`)
  check(new Set(EXPECTED_CASE_IDS).size === EXPECTED_CASE_IDS.length, `${spec.id} expected IDs are unique`)
  check(baseFixtures.length === EXPECTED_CASE_MANIFEST.length, `${spec.id} baseline count is fixed`)
  check(EXPECTED_ASSERTION_COUNT === 6
    && FIXTURE_ASSERTION_COUNT === EXPECTED_ASSERTION_COUNT
    && recommendationFixtures.every((fixture) => fixture.assertionCount === EXPECTED_ASSERTION_COUNT),
  `${spec.id} uses fixed assertion count and rejects fixture-global drift`)
}

const runCase = (fixture, callback, expectedAssertionCount) => {
  executedCaseIds.push(fixture.id)
  let observed = 0
  const assertionErrors = []
  const check = (condition, message) => {
    observed += 1
    try {
      assert.equal(Boolean(condition), true, message)
    } catch (error) {
      assertionErrors.push(errorMessage(error))
    }
  }
  try {
    callback(check)
  } catch (error) {
    assertionErrors.push(errorMessage(error))
  }
  executedAssertionCounts.set(fixture.id, observed)
  if (observed !== expectedAssertionCount) {
    assertionErrors.push(`assertion count drift: expected ${expectedAssertionCount}, got ${observed}`)
  }
  if (assertionErrors.length > 0) {
    failures.push(`${fixture.id}: ${assertionErrors.join(' | ')}`)
    console.error(`FAIL ${fixture.id}: ${assertionErrors.join(' | ')}`)
  } else {
    console.log(`PASS ${fixture.id} (${observed} assertions)`)
  }
}

const runFixtureAssertions = (fixture, context, modules, check) => {
  const expected = fixture.expected || {}
  const result = context.result
  const semantics = semanticsOf(result)
  const value = result && result.ok ? result.value : null
  const candidateItems = semantics && semantics.candidateEvaluations || []
  const candidateTiers = Object.fromEntries(candidateItems.map((item) => [item.institutionId, item.matchTier]))
  const itemIds = idsOf(semantics && semantics.items)
  const conditionalIds = idsOf(semantics && semantics.conditionalCandidates)

  // (1) Top-level result status is a fixed contract assertion.
  check(Boolean(result && result.ok) === Boolean(expected.ok), `${fixture.id} result.ok`)

  // (2) Envelope/error shape and the actual two evaluator boundary.
  if (expected.ok) {
    check(Boolean(value && semantics && value.kind === (fixture.kind === 'preview' ? 'recommendation_preview' : 'recommendation')),
      `${fixture.id} returns the correct recommendation envelope`)
  } else {
    check(Boolean(result && result.error && result.error.code === expected.errorCode),
      `${fixture.id} stable error code`)
  }

  // (3) Safety/readiness and exactness are checked independently from cards.
  if (expected.ok) {
    check(Boolean(semantics)
      && semantics.elderReadiness === expected.elderReadiness
      && semantics.exactMatch === expected.exactMatch,
    `${fixture.id} readiness/exactness`)
  } else {
    check(Boolean(result && !result.value && Array.isArray(result.error.paths) && result.error.paths.length > 0),
      `${fixture.id} rejected result has stable paths and no value`)
  }

  // (4) Card count and independent conditional list must not be conflated.
  if (expected.ok) {
    check(deepEqual(itemIds, expected.items || [])
      && deepEqual(conditionalIds, expected.conditionalCandidates || [])
      && itemIds.length <= 3
      && conditionalIds.length <= 3,
    `${fixture.id} card/conditional IDs and MAX_3`)
  } else {
    check(Boolean(result.error && !('value' in result)), `${fixture.id} failure has no value field`)
  }

  // (5) Fixed expected tier/reason plus scenario-specific safety invariant.
  if (expected.ok) {
    const expectedReason = expected.noExactReason === null
      ? undefined
      : safe(() => semantics.noExactMatch.reasonCode)
    const tierOkay = deepEqual(candidateTiers, expected.itemTiers || {})
      || (expected.itemTiers === undefined && Object.keys(candidateTiers).length === 0)
    check(tierOkay
      && (expected.noExactReason === null ? semantics.noExactMatch === undefined : expectedReason === expected.noExactReason)
      && runSpecificExpectation(fixture, context, modules, semantics),
    `${fixture.id} fixed tier/reason/scenario expectation`)
  } else {
    check(runMalformedStable(fixture, modules), `${fixture.id} deterministic malformed rejection`)
  }

  // (6) Provenance, evidence closure, no hidden score, and immutability.
  if (expected.ok) {
    check(verifyManifestClosure(semantics, context.input)
      && verifyResultRefs(semantics)
      && verifyReasons(semantics)
      && verifyNoHiddenScore(value)
      && deepEqual(context.input, context.inputBefore),
    `${fixture.id} provenance/ref closure, no score, input immutable`)
  } else {
    check(Array.isArray(result.error.paths) && result.error.paths.every((item) => typeof item === 'string'),
      `${fixture.id} stable error paths`)
  }
}

const runSpecificExpectation = (fixture, context, modules, semantics) => {
  const expected = fixture.expected || {}
  if (expected.conditionalSummary) {
    const requirements = semantics.noExactMatch?.unverifiedRequirements
    if (!Array.isArray(requirements) || requirements.length !== 1
      || requirements[0].constraintCode !== 'SPECIAL_CARE_tube_feeding'
      || requirements[0].outcome !== 'conditional'
      || requirements[0].institutionId !== 'institution-b-mock') return false
  }
  const candidate = candidateMap(semantics)['institution-a-mock'] || (semantics.candidateEvaluations || [])[0]
  if (expected.budgetStatus && factorOf(candidate, 'budget_fit')?.status !== expected.budgetStatus) {
    return false
  }
  if (expected.regionStatus && factorOf(candidate, 'region_fit')?.status !== expected.regionStatus) {
    return false
  }
  if (expected.typeStatus && factorOf(candidate, 'institution_type_fit')?.status !== expected.typeStatus) {
    return false
  }
  if (expected.rehabilitationStatus && factorOf(candidate, 'rehabilitation_fit')?.status !== expected.rehabilitationStatus) {
    return false
  }
  if (expected.rehabilitationNeed && safe(() => semantics.elderSnapshot.health.rehabilitationNeed.value) !== expected.rehabilitationNeed) {
    return false
  }
  if (expected.rehabRole) {
    const rehabilitationRequirement = safe(() => semantics.elderSnapshot.specialCare.requiredCareCapabilities
      .find((entry) => entry.capability === 'rehabilitation_training'))
    const rehabilitationConstraint = constraintForCode(semantics, 'rehabilitation_training')
    const rehabilitationFactor = factorOf(candidate, 'rehabilitation_fit')
    if (expected.rehabRole === 'HARD' && (!rehabilitationRequirement
      || rehabilitationRequirement.status !== 'required'
      || !rehabilitationConstraint
      || rehabilitationConstraint.outcome !== 'satisfied'
      || rehabilitationFactor?.rankParticipation !== 'consumed_by_hard')) {
      return false
    }
    if (expected.rehabRole === 'STRONG_SOFT_FIT' && (!rehabilitationRequirement
      || rehabilitationRequirement.status !== 'needs_confirmation'
      || rehabilitationConstraint
      || rehabilitationFactor?.status !== 'supported')) {
      return false
    }
    if (expected.rehabRole === 'SOFT_FIT' && (!rehabilitationRequirement
      || rehabilitationRequirement.status !== 'needs_confirmation'
      || rehabilitationConstraint
      || rehabilitationFactor?.status !== 'supported')) {
      return false
    }
  }
  if (expected.requiredSpecialCareCount !== undefined) {
    const requirements = safe(() => semantics.elderSnapshot.specialCare.requiredCareCapabilities, [])
    if (requirements.filter((requirement) => requirement.status === 'required').length !== expected.requiredSpecialCareCount) {
      return false
    }
  }
  if (expected.readinessCodes
    && !expected.readinessCodes.every((code) => semantics.requirementReadiness.some((entry) =>
      entry.code === code || entry.sourceDerivedField === code))) {
    return false
  }
  if (expected.conflictCodes && !expected.conflictCodes.every((code) => constraintForCode(semantics, code)?.outcome === 'conflict')) {
    return false
  }
  if (expected.unverifiedCodes && !expected.unverifiedCodes.every((code) => {
    const constraint = constraintForCode(semantics, code)
    return constraint && constraint.outcome === 'unverified' && constraint.institutionEffectiveStatus === 'unknown'
  })) {
    return false
  }
  if (expected.conditionalCodes && !expected.conditionalCodes.every((code) => constraintForCode(semantics, code)?.outcome === 'conditional')) {
    return false
  }
  if (expected.cardCount !== undefined && semantics.items.length !== expected.cardCount) {
    return false
  }
  if (expected.rankParticipation) {
    const first = (semantics.items || [])[0]
    if (!first || Object.entries(expected.rankParticipation).some(([key, value]) => first.rankParticipation[key] !== value)) {
      return false
    }
  }
  if (expected.effectiveCapability) {
    const constraint = constraintForCode(semantics, 'tube_feeding')
    if (!constraint || constraint.institutionEffectiveStatus !== expected.effectiveCapability) {
      return false
    }
  }
  if (expected.differenceCodes) {
    const differenceCodes = (semantics.items || [])
      .concat(semantics.conditionalCandidates || [], semantics.noExactMatch?.nearMatches || [])
      .flatMap((item) => item.differences || [])
      .map((difference) => difference.differenceCode)
    if (!expected.differenceCodes.every((code) => differenceCodes.includes(code))) {
      return false
    }
  }
  if (expected.itemTier !== undefined) {
    const expectedTier = expected.itemTier
    const actualTier = candidate && candidate.matchTier
    if (actualTier !== expectedTier) {
      return false
    }
  }
  if (expected.pairwiseInvariant && !runPairwiseInvariant(fixture, context, modules)) {
    return false
  }
  if (expected.stableEvaluationAsOf && semantics.evaluationAsOf !== expected.stableEvaluationAsOf) {
    return false
  }
  if (expected.poolEntryCount !== undefined && semantics.poolManifest.entries.length !== expected.poolEntryCount) {
    return false
  }
  if (expected.sortedIds && !deepEqual(idsOf(semantics.candidateEvaluations), expected.sortedIds)) {
    return false
  }
  if (expected.matrix5x4 && !runCareMatrix(fixture, modules)) {
    return false
  }
  if (expected.noCareLevelInheritance && !runNoInheritance(fixture, modules)) {
    return false
  }
  if (expected.careLevelMatrix && !runNoInheritance(fixture, modules)) {
    return false
  }
  if (fixture.expiry && !runExpiry(fixture, modules)) {
    return false
  }
  if (fixture.time) {
    const invalid = makeEvaluatorResult(fixture, modules, { evaluationAsOf: 'not-a-timestamp' }).result
    if (!invalid || invalid.ok || invalid.error.code !== 'INVALID_EVALUATION_AS_OF') {
      return false
    }
  }
  if (expected.previewParity && !runPreviewFormalParity(fixture, modules)) {
    return false
  }
  if (expected.noFormalIdentity && !verifyNoFormalIdentity(context.result.value)) {
    return false
  }
  if (expected.manifestEvidenceClosure && !verifyManifestClosure(semantics, context.input)) {
    return false
  }
  if (expected.advisoryIsolated && !runAdvisoryIsolation(fixture, modules, context)) {
    return false
  }
  if (expected.snapshotImmutable && !runSnapshotIsolation(context, modules)) {
    return false
  }
  if (expected.productionMockExcluded) {
    const entry = semantics.poolManifest.entries[0]
    if (!entry || entry.disposition !== 'excluded' || entry.exclusionReasonCode !== 'MOCK_DATA_NOT_PRODUCTION') {
      return false
    }
  }
  if (expected.mockModeNonMockExcluded) {
    const entries = semantics.poolManifest.entries
    if (entries.length !== 1
      || entries[0].disposition !== 'excluded'
      || entries[0].exclusionReasonCode !== 'NON_MOCK_DATA_IN_SYNTHETIC_MODE') {
      return false
    }
  }
  if (expected.recordStatusExclusions) {
    const entries = semantics.poolManifest.entries
    const byId = Object.fromEntries(entries.map((entry) => [entry.institutionId, entry]))
    if (entries.length !== 4
      || byId['institution-a-mock']?.disposition !== 'included'
      || ['institution-b-mock', 'institution-c-mock', 'institution-d-mock'].some((id) =>
        byId[id]?.disposition !== 'excluded' || byId[id]?.exclusionReasonCode !== 'RECORD_NOT_PUBLISHED')) {
      return false
    }
  }
  if (expected.offsetEquivalent && !runOffsetTime(fixture, modules, context)) {
    return false
  }
  if (expected.unknownSnapshotsNull) {
    const refs = semantics.poolManifest.entries[0].matchingFields
    const price = refs.find((ref) => ref.fieldPath === 'price.referenceMonthlyPrice')
    const type = refs.find((ref) => ref.fieldPath === 'typeProfile.supportedTypes')
    if (!price || price.rawSnapshot !== null || price.effectiveSnapshot !== null
      || !type || type.rawSnapshot !== null || type.effectiveSnapshot !== null) {
      return false
    }
  }
  if (fixture.repeat) {
    const repeated = makeEvaluatorResult(fixture, modules).result
    if (!deepEqual(context.result, repeated)) {
      return false
    }
  }
  return true
}

const runPreviewFormalParity = (fixture, modules) => {
  const formalSpec = { ...fixture, kind: 'formal' }
  const previewSpec = { ...fixture, kind: 'preview' }
  const formal = makeEvaluatorResult(formalSpec, modules).result
  const preview = makeEvaluatorResult(previewSpec, modules).result
  return formal.ok && preview.ok && deepEqual(formal.value.semantics, preview.value.semantics)
}

const verifyNoFormalIdentity = (value) => {
  if (!value || value.kind !== 'recommendation_preview') {
    return false
  }
  const forbidden = new Set(['recommendationId', 'assessmentId', 'elderId', 'generatedAt', 'persistence'])
  return !containsKey(value, forbidden)
    && Boolean(value.source && value.source.localDraftId)
    && !('assessmentId' in value)
    && !('elderId' in value)
}

const run = async () => {
  validateCaseManifest(EXPECTED_CASE_MANIFEST, recommendationFixtures)
  const { parser: typescript, parserPath, source: parserSource } = await loadWechatTypeScript()
  const loadedSourcePaths = new Set()
  const loadedSourceTexts = new Map()
  const externalImports = []
  const loadModule = createSourceLoader(typescript, loadedSourcePaths, loadedSourceTexts, externalImports)
  const elderDomain = loadModule(elderProfileEntryPath)
  const institutionDomain = loadModule(institutionEntryPath)
  const recommendationDomain = loadModule(recommendationEntryPath)
  const modules = {
    ...recommendationDomain,
    deriveElderProfile: elderDomain.deriveElderProfile,
    deriveElderProfilePreview: elderDomain.deriveElderProfilePreview,
  }
  if (typeof modules.evaluateRecommendationPreview !== 'function'
    || typeof modules.evaluateFormalRecommendation !== 'function') {
    throw new Error('Recommendation domain must export both frozen evaluator entry points')
  }
  if (typeof modules.validateInstitutionRecord !== 'function' && typeof institutionDomain.validateInstitutionRecord !== 'function') {
    throw new Error('Institution validator is not available to the Recommendation runtime')
  }
  recommendationFixtures.forEach((fixture) => {
    const expectedEntry = EXPECTED_CASE_MANIFEST.find((entry) => entry.id === fixture.id)
    runCase(fixture, (check) => {
      if (fixture.antiFake) {
        runAntiFakeCase(fixture, check)
        return
      }
      const context = makeEvaluatorResult(fixture, modules)
      runFixtureAssertions(fixture, context, modules, check)
    }, expectedEntry.assertionCount)
  })
  validateCaseManifest(EXPECTED_CASE_MANIFEST, recommendationFixtures, executedCaseIds)
  if (executedAssertionCounts.size !== EXPECTED_CASE_MANIFEST.length) {
    throw new Error(`executed assertion-count manifest drift: expected ${EXPECTED_CASE_MANIFEST.length}, got ${executedAssertionCounts.size}`)
  }
  const emittedSource = [...loadedSourceTexts.values()].join('\n')
  if (externalImports.length > 0 || /\bDate\.now\s*\(/.test(emittedSource)) {
    throw new Error('Recommendation pure graph contains external imports or implicit current-time access')
  }
  const forbiddenRoots = [path.join(repositoryRoot, 'server'), path.join(repositoryRoot, 'miniprogram', 'pages'), path.join(repositoryRoot, 'miniprogram', 'components'), path.join(repositoryRoot, 'miniprogram', 'services')]
  loadedSourcePaths.forEach((filePath) => {
    if (forbiddenRoots.some((root) => isWithin(filePath, root))) {
      throw new Error(`Recommendation runtime loaded forbidden UI/backend file: ${path.relative(repositoryRoot, filePath)}`)
    }
  })
  if (failures.length > 0) {
    console.error(`RECOMMENDATION RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${typescript.version} (${parserPath})`)
  console.log(`LOADED_PURE_MODULES: ${loadedSourcePaths.size}`)
  console.log(`EXTERNAL_RUNTIME_IMPORTS: ${externalImports.length}`)
  console.log(`FIXED_CASE_MANIFEST: ${EXPECTED_CASE_MANIFEST.length} cases x ${EXPECTED_ASSERTION_COUNT} assertions`)
  console.log(`FIXTURE_PROVENANCE: ${JSON.stringify(FIXTURE_PROVENANCE_ASSERTIONS)}`)
  console.log(`RECOMMENDATION RUNTIME PASS: ${executedCaseIds.length} cases`)
}

try {
  await run()
} catch (error) {
  console.error(`RECOMMENDATION RUNTIME ERROR: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exitCode = 1
}
