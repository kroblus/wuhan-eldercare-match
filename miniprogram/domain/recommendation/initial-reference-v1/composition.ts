import { isValidIsoTimestamp } from '../../institution/primitives'
import { validateInstitutionCatalogPayloadV121 } from '../../../services/institution-catalog-v1-2-1'
import { compareAsciiV2, copyDomainDataV2 } from '../v2/rules-v2'
import { projectReferenceInstitutionFactsV1 } from './institution-facts'
import { evaluateInitialReferenceEligibilityV1 } from './eligibility'
import type { InstitutionRecordV121 } from '../../../types/institution-v1-2-1'
import type {
  InstitutionEvidenceRefV2,
  RecommendationCandidateEvaluationV2,
  RecommendationPoolManifestEntryV2,
  RecommendationSemanticResultV2,
} from '../../../types/recommendation-v2'
import type {
  InitialReferenceApplicationResultV1,
  InitialReferenceDisplayCardV1,
  InitialReferenceEligibilityDecisionV1,
  InitialReferenceEligibleCandidateV1,
  RecommendationResultPageStateSnapshotV2,
  ReferenceCompositionInputV1,
  ReferenceCompositionV1,
} from '../../../types/initial-reference-v1'

const fail = (cause: string): never => { throw new Error(cause) }
const sameValue = (left: unknown, right: unknown): boolean => {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]))
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  return Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]))
}

const keyFor = (item: { institutionId: string; recordRevision: number }): string =>
  `${item.institutionId}#${item.recordRevision}`

const assertUnique = (rows: ReadonlyArray<{ institutionId: string; recordRevision: number }>): void => {
  if (new Set(rows.map((row) => row.institutionId)).size !== rows.length) fail('REFERENCE_SOURCE_DUPLICATE')
}

const assertRef = (
  ref: InstitutionEvidenceRefV2,
  entry: RecommendationPoolManifestEntryV2,
  evaluationAsOf: string,
): void => {
  const expected = [...entry.matchingFields, ...entry.extensionFields]
    .filter((field) => field.fieldPath === ref.fieldPath)
  if (keyFor(ref) !== keyFor(entry) || ref.evaluationAsOf !== evaluationAsOf
    || expected.length !== 1 || !sameValue(ref, expected[0])) fail('REFERENCE_EVIDENCE_ASSOCIATION_ERROR')
  for (const id of ref.evidenceIds) {
    if (entry.evidence.filter((evidence) => evidence.evidenceId === id).length !== 1) {
      fail('REFERENCE_EVIDENCE_ASSOCIATION_ERROR')
    }
  }
}

const assertManifestEvidence = (
  entry: RecommendationPoolManifestEntryV2,
  record: InstitutionRecordV121,
  evaluationAsOf: string,
): void => {
  if (new Set(entry.evidence.map((item) => item.evidenceId)).size !== entry.evidence.length) {
    fail('REFERENCE_EVIDENCE_ASSOCIATION_ERROR')
  }
  for (const item of entry.evidence) {
    const matches = record.evidence.filter((source) => source.evidenceId === item.evidenceId)
    if (matches.length !== 1) fail('REFERENCE_EVIDENCE_ASSOCIATION_ERROR')
    const source = matches[0]
    const expected = {
      evidenceId: source.evidenceId,
      institutionId: source.institutionId,
      recordRevision: source.recordRevision,
      fieldPath: source.fieldPath,
      valueSnapshot: source.valueSnapshot,
      sourceType: source.sourceType,
      ...(source.observedAt === undefined ? {} : { observedAt: source.observedAt }),
      verificationStatus: source.verificationStatus,
      ...(source.verifiedAt === undefined ? {} : { verifiedAt: source.verifiedAt }),
      ...(source.validUntil === undefined ? {} : { validUntil: source.validUntil }),
    }
    if (!sameValue(item, expected)) fail('REFERENCE_EVIDENCE_ASSOCIATION_ERROR')
  }
  for (const ref of [...entry.matchingFields, ...entry.extensionFields]) assertRef(ref, entry, evaluationAsOf)
}

const assertCandidate = (
  candidate: RecommendationCandidateEvaluationV2,
  entry: RecommendationPoolManifestEntryV2,
  evaluationAsOf: string,
): void => {
  if (keyFor(candidate) !== keyFor(entry)) fail('REFERENCE_CANDIDATE_ASSOCIATION_ERROR')
  for (const constraint of candidate.constraintResults) {
    if (keyFor(constraint) !== keyFor(entry)) fail('REFERENCE_CONSTRAINT_ASSOCIATION_ERROR')
    for (const ref of constraint.institutionEvidenceRefs) assertRef(ref, entry, evaluationAsOf)
  }
  const outputs = [...candidate.reasons, ...candidate.differences,
    ...candidate.priorityFactors, candidate.roomFit, candidate.mealScheduleFit, candidate.nutrition]
  for (const output of outputs) {
    for (const ref of output.institutionEvidenceRefs) assertRef(ref, entry, evaluationAsOf)
  }
  for (const fact of candidate.activityFit.displayFacts) assertRef(fact.institutionEvidenceRef, entry, evaluationAsOf)
}

const assertSources = (input: ReferenceCompositionInputV1): void => {
  const { catalog, legacyV2, evaluationAsOf } = input
  const semantics = legacyV2.preview.semantics
  const manifest = semantics.poolManifest
  if (catalog.datasetMode !== input.expectedDatasetMode
    || legacyV2.kind !== 'recommendation_result_application_snapshot_v2'
    || legacyV2.preview.kind !== 'recommendation_preview_v2'
    || legacyV2.preview.persistence !== 'FORBIDDEN'
    || semantics.versions.recommendationContractVersion !== 'recommendation-contract-v2'
    || semantics.versions.recommendationRulesetVersion !== 'recommendation-ruleset-v2'
    || semantics.versions.policyVersion !== 'conservative-exact-with-conditional-v1'
    || !sameValue(legacyV2.source, legacyV2.preview.source)
    || legacyV2.source.assessmentSchemaVersion !== 2) fail('REFERENCE_SOURCE_CONTEXT_MISMATCH')
  for (const context of [semantics, manifest, legacyV2.sourceContext]) {
    if (context.datasetVersion !== catalog.datasetVersion || context.datasetMode !== catalog.datasetMode
      || context.evaluationAsOf !== evaluationAsOf) fail('REFERENCE_SOURCE_CONTEXT_MISMATCH')
  }
  if (manifest.institutionContractVersion !== 'institution-contract-v1.1'
    || manifest.institutionCapabilityContractVersion !== 'institution-capability-contract-v1'
    || legacyV2.sourceContext.institutionContractVersion !== manifest.institutionContractVersion
    || legacyV2.sourceContext.institutionCapabilityContractVersion !== manifest.institutionCapabilityContractVersion) {
    fail('REFERENCE_SOURCE_CONTEXT_MISMATCH')
  }
  assertUnique(manifest.entries)
  assertUnique(semantics.candidateEvaluations)
  assertUnique(legacyV2.institutionDisplays)
  if (manifest.entries.length !== catalog.records.length
    || legacyV2.institutionDisplays.length !== catalog.records.length) fail('REFERENCE_SOURCE_MISSING')
  const published = catalog.records.filter((record) => record.recordStatus === 'published')
  if (semantics.candidateEvaluations.length !== published.length) fail('REFERENCE_CANDIDATE_MISSING')
  for (const record of catalog.records) {
    const entries = manifest.entries.filter((entry) => keyFor(entry) === keyFor(record))
    const displays = legacyV2.institutionDisplays.filter((display) => keyFor(display) === keyFor(record))
    if (entries.length !== 1 || displays.length !== 1) fail('REFERENCE_SOURCE_REVISION_MISMATCH')
    const entry = entries[0]
    if (entry.recordProvenance !== record.recordProvenance || entry.recordStatus !== record.recordStatus
      || displays[0].recordProvenance !== record.recordProvenance || displays[0].recordStatus !== record.recordStatus
      || (record.recordStatus === 'published' ? entry.disposition !== 'included' : entry.disposition !== 'excluded')) {
      fail('REFERENCE_SOURCE_PROVENANCE_MISMATCH')
    }
    assertManifestEvidence(entry, record, evaluationAsOf)
    const candidates = semantics.candidateEvaluations.filter((candidate) => keyFor(candidate) === keyFor(record))
    if (record.recordStatus === 'published') {
      if (candidates.length !== 1) fail('REFERENCE_CANDIDATE_MISSING')
      assertCandidate(candidates[0], entry, evaluationAsOf)
    } else if (candidates.length !== 0) fail('REFERENCE_CANDIDATE_ASSOCIATION_ERROR')
  }
  for (const card of [...semantics.cards, ...semantics.conditionalCandidates,
    ...(semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches)]) {
    const candidates = semantics.candidateEvaluations.filter((candidate) => keyFor(candidate) === keyFor(card))
    if (candidates.length !== 1 || !sameValue(card, candidates[0])) fail('REFERENCE_CARD_ASSOCIATION_ERROR')
  }
}

/** Mirrors the frozen VM's selection/state without a domain -> pages dependency. */
export const deriveLegacyPresentationStateV1 = (
  semantics: RecommendationSemanticResultV2,
): RecommendationResultPageStateSnapshotV2 => {
  if (semantics.elderReadiness !== 'ready') return 'no_safe_recommendation'
  const cards = semantics.cards.length > 0 ? semantics.cards
    : semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches
  if (cards.length > 0) return semantics.exactMatch ? 'ready_exact' : 'ready_soft_near'
  if (semantics.conditionalCandidates.length > 0) return 'ready_conditional'
  return 'no_safe_recommendation'
}

const displayCard = (
  candidate: InitialReferenceEligibleCandidateV1,
  input: ReferenceCompositionInputV1,
): InitialReferenceDisplayCardV1 => {
  const semantics = input.legacyV2.preview.semantics
  const evaluation = semantics.candidateEvaluations.find((item) => keyFor(item) === keyFor(candidate))
  const display = input.legacyV2.institutionDisplays.find((item) => keyFor(item) === keyFor(candidate))
  if (evaluation === undefined || display === undefined) return fail('REFERENCE_SOURCE_MISSING')
  const snapshot = semantics.elderSnapshot
  const capabilityUnknowns = evaluation.constraintResults.filter((constraint) => constraint.outcome === 'unverified')
  const warningCodes: Array<'G0' | 'K0' | 'I0'> = ['G0', 'I0']
  if (capabilityUnknowns.length > 0) warningCodes.push('K0')
  return {
    kind: 'initial_reference_candidate_v1',
    category: 'INITIAL_REFERENCE',
    institutionId: candidate.institutionId,
    recordRevision: candidate.recordRevision,
    recordProvenance: candidate.institutionFacts.recordProvenance,
    source: 'direct_link',
    matchedCategories: candidate.matchedCategories,
    basisEvaluations: candidate.basisEvaluations,
    referenceReasons: candidate.basisEvaluations.filter((basis) => basis.status === 'MATCHED'),
    institutionFacts: candidate.institutionFacts,
    institutionDisplay: display,
    elderRiskFacts: {
      adl: snapshot.adl, mobility: snapshot.mobility, health: snapshot.health,
      nutrition: snapshot.nutrition, cognition: snapshot.cognition, specialCare: snapshot.specialCare,
    },
    elderClarifications: semantics.elderClarifications,
    requirementReadiness: semantics.requirementReadiness,
    institutionCapabilityUnknowns: capabilityUnknowns,
    ordinaryDataGaps: candidate.basisEvaluations.filter((basis) => basis.status !== 'MATCHED'),
    warningCodes,
    publicDetailTarget: {
      institutionId: candidate.institutionId, recordRevision: candidate.recordRevision, routeSource: 'direct_link',
    },
  }
}

/** Additive C1 composition. No new tier, old-result mutation, IO, or persistence. */
export const composeReferenceResultV1 = (
  input: ReferenceCompositionInputV1,
): InitialReferenceApplicationResultV1 => {
  const error = (causeCode: string): InitialReferenceApplicationResultV1 => ({
    ok: false,
    error: {
      state: 'DATA_ERROR', code: 'REFERENCE_COMPOSITION_ERROR', causeCode,
      legacyV2: copyDomainDataV2(input.legacyV2),
    },
  })
  try {
    if (!isValidIsoTimestamp(input.evaluationAsOf)) return error('INVALID_EVALUATION_AS_OF')
    const validated = validateInstitutionCatalogPayloadV121(input.catalog)
    if (!validated.ok) return {
      ok: false,
      error: {
        state: 'DATA_ERROR', code: 'REFERENCE_CATALOG_ERROR', causeCode: validated.error.code,
        ...(validated.error.recordIndex === undefined ? {} : { recordIndex: validated.error.recordIndex }),
        ...(validated.error.pointerIndex === undefined ? {} : { pointerIndex: validated.error.pointerIndex }),
        legacyV2: copyDomainDataV2(input.legacyV2),
      },
    }
    assertSources(input)
    const legacyPresentationState = deriveLegacyPresentationStateV1(input.legacyV2.preview.semantics)
    const evaluations: InitialReferenceEligibilityDecisionV1[] = []
    const eligible: InitialReferenceEligibleCandidateV1[] = []
    if (legacyPresentationState === 'no_safe_recommendation') {
      const facts = projectReferenceInstitutionFactsV1(validated.value, input.evaluationAsOf)
      if (!facts.ok) return error(facts.error.causeCode || facts.error.code)
      for (const institutionFacts of facts.value.institutions) {
        const legacyCandidate = input.legacyV2.preview.semantics.candidateEvaluations.find((item) =>
          keyFor(item) === keyFor(institutionFacts))
        if (legacyCandidate === undefined) return error('REFERENCE_CANDIDATE_MISSING')
        const decision = evaluateInitialReferenceEligibilityV1({
          institutionFacts, legacyCandidate, elderSnapshot: input.legacyV2.preview.semantics.elderSnapshot,
        })
        evaluations.push(decision)
        if (decision.candidate !== null) eligible.push(decision.candidate)
      }
    }
    const sorted = eligible.slice().sort((left, right) =>
      right.matchedCategories.length - left.matchedCategories.length
        || compareAsciiV2(left.institutionId, right.institutionId))
    const cards = sorted.slice(0, 3).map((candidate) => displayCard(candidate, input))
    const value: ReferenceCompositionV1 = {
      kind: 'reference_composition_v1', persistence: 'FORBIDDEN',
      compositionVersion: 'reference-composition-v1', policyVersion: 'initial-reference-policy-v1',
      state: legacyPresentationState !== 'no_safe_recommendation' ? 'LEGACY_V2_DISPLAY'
        : cards.length > 0 ? 'INITIAL_REFERENCE_ONLY' : 'NO_PERSONALIZED_CANDIDATE',
      evaluationAsOf: input.evaluationAsOf,
      datasetVersion: input.catalog.datasetVersion, datasetMode: input.catalog.datasetMode,
      legacyV2: input.legacyV2, legacyPresentationState,
      eligibleReferenceCandidates: sorted, displayedReferenceCards: cards,
      referenceEvaluations: evaluations,
      directoryBrowseAvailable: validated.value.records.some((record) => record.recordStatus === 'published'),
    }
    return { ok: true, value: copyDomainDataV2(value) }
  } catch (caught) {
    const cause = caught instanceof Error && /^(REFERENCE_|INITIAL_REFERENCE_)[A-Z_]+$/.test(caught.message)
      ? caught.message : 'REFERENCE_SOURCE_INVALID'
    return error(cause)
  }
}
