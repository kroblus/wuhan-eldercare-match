import { deriveElderProfileV2 } from '../elder-profile/v2/derive-elder-profile-v2'
import { evaluateFormalRecommendationV2 } from '../recommendation/v2'
import { projectInstitutionDisplaySnapshotV11Pure } from '../../services/institution-display-projection-v11'
import type { InstitutionRecordV11 } from '../../types/institution-v1-1'
import type { RecommendationCandidateEvaluationV2, RecommendationDifferenceV2 } from '../../types/recommendation-v2'

// Save-time only. Formal identity comes from the server CompletedAssessment, never Preview/Draft.
const differences = (rows: readonly RecommendationDifferenceV2[]) => rows.map(row => ({
  differenceCode: row.differenceCode, differenceCategory: row.differenceCategory,
  differenceType: row.differenceType, severity: row.severity,
}))
export const captureHistoricalRecommendationV1 = (input: {
  completed: unknown; catalog: { records: readonly InstitutionRecordV11[]; datasetVersion: string; datasetMode: 'MOCK_DEVELOPMENT_ONLY' }
  evaluationAsOf: string; sourceReference: string; sourceDigest: string
}) => {
  const derived = deriveElderProfileV2(input.completed)
  if (!derived.ok || input.catalog.datasetMode !== 'MOCK_DEVELOPMENT_ONLY'
    || !/^[0-9a-f]{64}$/.test(input.sourceDigest) || !input.sourceReference || input.sourceReference.length > 200)
    return { ok: false as const }
  const result = evaluateFormalRecommendationV2({ profile: derived.profile, institutions: input.catalog.records,
    datasetVersion: input.catalog.datasetVersion, datasetMode: input.catalog.datasetMode, evaluationAsOf: input.evaluationAsOf,
    contractVersion: 'recommendation-contract-v2', rulesetVersion: 'recommendation-ruleset-v2', policyVersion: 'conservative-exact-with-conditional-v1' })
  if (!result.ok) return { ok: false as const }
  const { identity, semantics: s } = result.value
  const displays = input.catalog.records.map(record => projectInstitutionDisplaySnapshotV11Pure(record, input.evaluationAsOf))
  const project = (candidate: RecommendationCandidateEvaluationV2) => {
    const display = displays.find(row => row.institutionId === candidate.institutionId && row.recordRevision === candidate.recordRevision)
    const manifest = s.poolManifest.entries.find(row => row.institutionId === candidate.institutionId && row.recordRevision === candidate.recordRevision)
    if (!display || !manifest || display.recordProvenance !== manifest.recordProvenance || display.recordStatus !== manifest.recordStatus) throw new Error('source association')
    return { institutionId: candidate.institutionId, recordRevision: candidate.recordRevision, matchTier: candidate.matchTier,
      display, reasons: candidate.reasons.map(row => ({ reasonCode: row.reasonCode, reasonType: row.reasonType, polarity: row.polarity })),
      differences: differences(candidate.differences) }
  }
  // Projection retains the exact Domain sequence; no comparator, rank tuple, raw answers or evidence dump.
  const cards = s.cards.map(project), conditionalCandidates = s.conditionalCandidates.map(project)
  const nearMatches = s.noExactMatch ? s.noExactMatch.nearMatches.map(project) : []
  const state = cards.some(row => row.matchTier === 'EXACT') ? 'ready_exact' : cards.length ? 'ready_soft_near'
    : conditionalCandidates.length ? 'ready_conditional' : 'no_safe_recommendation'
  return { ok: true as const, display: {
    kind: 'historical_recommendation_display_v1', snapshotVersion: 1,
    assessmentId: identity.assessmentId, assessmentCompletedAt: identity.assessmentCompletedAt, assessmentSchemaVersion: 2,
    versions: s.versions, evaluationAsOf: s.evaluationAsOf,
    source: { kind: 'SERVER_FORMAL_RECOMMENDATION_CAPTURE_TEST_ONLY_V1', reference: input.sourceReference,
      digest: input.sourceDigest, datasetVersion: s.datasetVersion, datasetMode: s.datasetMode },
    state, elderReadiness: s.elderReadiness, exactMatch: s.exactMatch,
    noExactMatch: s.noExactMatch ? { code: s.noExactMatch.code, reasonCode: s.noExactMatch.reasonCode,
      differences: differences(s.noExactMatch.differences) } : null,
    cards, conditionalCandidates, nearMatches,
    advisories: s.advisories.map(row => ({ code: row.code, role: row.role, rankParticipation: row.rankParticipation })),
    poolRevisions: s.poolManifest.entries.map(row => ({ institutionId: row.institutionId, recordRevision: row.recordRevision,
      recordProvenance: row.recordProvenance, recordStatus: row.recordStatus, disposition: row.disposition })),
  } }
}
