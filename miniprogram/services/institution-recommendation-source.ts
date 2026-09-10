/**
 * Narrow Recommendation Result V2 into the session-only Institution
 * navigation context. This module consumes frozen output only; it never
 * derives a profile, evaluates a recommendation, or reads AssessmentDraft.
 */

import { isPlainRecord } from '../domain/institution/primitives'
import type {
  InstitutionContextManifestEntry,
  InstitutionNavigationSourceContextInput,
  InstitutionRecommendationCandidateGroup,
  InstitutionRecommendationCandidateProjection,
} from '../types/institution-list-detail'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import type { RecommendationCandidateEvaluationV2 } from '../types/recommendation-v2'
import {
  institutionCanonicalKey,
  validateInstitutionCanonicalIdentity,
} from './institution-record-resolver'
import type { InstitutionSourceContextRegistry } from './institution-source-context'

export type InstitutionRecommendationSourceErrorCode =
  | 'RECOMMENDATION_SOURCE_INVALID'
  | 'RECOMMENDATION_SOURCE_CONTEXT_MISMATCH'
  | 'RECOMMENDATION_SOURCE_CANDIDATE_INVALID'
  | 'RECOMMENDATION_SOURCE_CANDIDATE_DUPLICATE'

export type InstitutionRecommendationSourceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: InstitutionRecommendationSourceErrorCode } }

const failure = (
  code: InstitutionRecommendationSourceErrorCode,
): InstitutionRecommendationSourceResult<never> => ({ ok: false, error: { code } })

const projectCandidate = (
  candidate: RecommendationCandidateEvaluationV2,
  group: InstitutionRecommendationCandidateGroup,
  order: number,
): InstitutionRecommendationSourceResult<InstitutionRecommendationCandidateProjection> => {
  const identity = validateInstitutionCanonicalIdentity({
    institutionId: candidate.institutionId,
    recordRevision: candidate.recordRevision,
  })
  if (!identity.ok || candidate.matchTier === null
    || (candidate.matchTier !== 'EXACT'
      && candidate.matchTier !== 'SOFT_NEAR'
      && candidate.matchTier !== 'CONDITIONAL')) {
    return failure('RECOMMENDATION_SOURCE_CANDIDATE_INVALID')
  }
  if ((group === 'conditionalCandidates' && candidate.matchTier !== 'CONDITIONAL')
    || (group === 'nearMatches' && candidate.matchTier !== 'SOFT_NEAR')
    || (group === 'cards' && candidate.matchTier === 'CONDITIONAL')) {
    return failure('RECOMMENDATION_SOURCE_CANDIDATE_INVALID')
  }
  return {
    ok: true,
    value: {
      identity: identity.value,
      group,
      order,
      tier: candidate.matchTier,
      reasons: candidate.reasons.map((reason) => ({
        code: reason.reasonCode,
        reference: reason.reasonType,
      })),
      differences: candidate.differences.map((difference) => ({
        code: difference.differenceCode,
        reference: difference.differenceType,
      })),
    },
  }
}

/**
 * Build a data-minimal context input from an already validated Result V2
 * snapshot. Pool evidence, raw records, profile data and Assessment data are
 * intentionally projected away.
 */
export const projectInstitutionNavigationSourceContextV2 = (
  snapshot: RecommendationResultApplicationSnapshotV2,
): InstitutionRecommendationSourceResult<InstitutionNavigationSourceContextInput> => {
  if (!isPlainRecord(snapshot)
    || snapshot.kind !== 'recommendation_result_application_snapshot_v2'
    || !isPlainRecord(snapshot.preview)
    || !isPlainRecord(snapshot.preview.semantics)
    || !isPlainRecord(snapshot.preview.semantics.versions)
    || !isPlainRecord(snapshot.preview.semantics.poolManifest)
    || !isPlainRecord(snapshot.sourceContext)) {
    return failure('RECOMMENDATION_SOURCE_INVALID')
  }
  const semantics = snapshot.preview.semantics
  const versions = semantics.versions
  const poolManifest = semantics.poolManifest
  const source = snapshot.sourceContext
  if (versions.recommendationContractVersion !== 'recommendation-contract-v2'
    || versions.recommendationRulesetVersion !== 'recommendation-ruleset-v2'
    || versions.policyVersion !== 'conservative-exact-with-conditional-v1'
    || versions.institutionContractVersion !== 'institution-contract-v1.1'
    || versions.institutionCapabilityContractVersion !== 'institution-capability-contract-v1'
    || source.institutionContractVersion !== versions.institutionContractVersion
    || source.institutionCapabilityContractVersion !== versions.institutionCapabilityContractVersion
    || source.datasetVersion !== semantics.datasetVersion
    || source.datasetMode !== semantics.datasetMode
    || source.evaluationAsOf !== semantics.evaluationAsOf
    || poolManifest.datasetVersion !== semantics.datasetVersion
    || poolManifest.datasetMode !== semantics.datasetMode
    || poolManifest.evaluationAsOf !== semantics.evaluationAsOf
    || poolManifest.institutionContractVersion !== versions.institutionContractVersion
    || poolManifest.institutionCapabilityContractVersion !== versions.institutionCapabilityContractVersion
    || !Array.isArray(poolManifest.entries)
    || !Array.isArray(semantics.cards)
    || !Array.isArray(semantics.conditionalCandidates)
    || typeof semantics.exactMatch !== 'boolean'
    || (semantics.exactMatch && semantics.noExactMatch !== undefined)
    || (!semantics.exactMatch
      && (!isPlainRecord(semantics.noExactMatch)
        || !Array.isArray(semantics.noExactMatch.nearMatches)))) {
    return failure('RECOMMENDATION_SOURCE_CONTEXT_MISMATCH')
  }

  const manifest: InstitutionContextManifestEntry[] = []
  for (let index = 0; index < poolManifest.entries.length; index += 1) {
    const entry = poolManifest.entries[index]
    const identity = validateInstitutionCanonicalIdentity({
      institutionId: entry.institutionId,
      recordRevision: entry.recordRevision,
    })
    if (!identity.ok) return failure('RECOMMENDATION_SOURCE_INVALID')
    manifest.push({
      identity: identity.value,
      recordProvenance: entry.recordProvenance,
      recordStatus: entry.recordStatus,
      disposition: entry.disposition,
    })
  }

  const primaryGroup: InstitutionRecommendationCandidateGroup = semantics.cards.length > 0
    ? 'cards'
    : 'nearMatches'
  const primaryCandidates = semantics.cards.length > 0
    ? semantics.cards
    : semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches
  const candidates: InstitutionRecommendationCandidateProjection[] = []
  const seen = new Set<string>()
  const append = (
    sourceCandidates: readonly RecommendationCandidateEvaluationV2[],
    group: InstitutionRecommendationCandidateGroup,
  ): InstitutionRecommendationSourceErrorCode | null => {
    for (let index = 0; index < sourceCandidates.length; index += 1) {
      const projected = projectCandidate(sourceCandidates[index], group, index)
      if (!projected.ok) return projected.error.code
      const key = institutionCanonicalKey(projected.value.identity)
      if (seen.has(key)) return 'RECOMMENDATION_SOURCE_CANDIDATE_DUPLICATE'
      seen.add(key)
      candidates.push(projected.value)
    }
    return null
  }
  const primaryError = append(primaryCandidates, primaryGroup)
  if (primaryError !== null) return failure(primaryError)
  const conditionalError = append(semantics.conditionalCandidates, 'conditionalCandidates')
  if (conditionalError !== null) return failure(conditionalError)

  return {
    ok: true,
    value: {
      datasetVersion: semantics.datasetVersion,
      datasetMode: semantics.datasetMode,
      evaluationAsOf: semantics.evaluationAsOf,
      recommendationContractVersion: versions.recommendationContractVersion,
      recommendationRulesetVersion: versions.recommendationRulesetVersion,
      recommendationPolicyVersion: versions.policyVersion,
      institutionContractVersion: versions.institutionContractVersion,
      institutionCapabilityContractVersion: versions.institutionCapabilityContractVersion,
      manifest,
      candidates,
    },
  }
}

export type RegisterInstitutionRecommendationContextResult =
  | { ok: true; value: { sourceContextRef: string } }
  | {
    ok: false
    error: {
      code: 'INSTITUTION_RECOMMENDATION_SOURCE_ERROR' | 'INSTITUTION_SOURCE_CONTEXT_ERROR'
      causeCode: string
    }
  }

export const registerInstitutionRecommendationSourceContextV2 = (
  snapshot: RecommendationResultApplicationSnapshotV2,
  registry: InstitutionSourceContextRegistry,
): RegisterInstitutionRecommendationContextResult => {
  const projected = projectInstitutionNavigationSourceContextV2(snapshot)
  if (!projected.ok) {
    return {
      ok: false,
      error: { code: 'INSTITUTION_RECOMMENDATION_SOURCE_ERROR', causeCode: projected.error.code },
    }
  }
  const registered = registry.register(projected.value)
  if (!registered.ok) {
    return {
      ok: false,
      error: { code: 'INSTITUTION_SOURCE_CONTEXT_ERROR', causeCode: registered.error.code },
    }
  }
  return { ok: true, value: { sourceContextRef: registered.value } }
}
