// Proposed API; isolated server provenance is deliberately distinct from local fixtures.
export const HISTORY_API_CONTRACT_V1 = 'completed-assessment-history-api-v1' as const
export const HISTORY_SERVER_TEST_ONLY_SOURCE_V1 = 'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1' as const
export interface CompletedAssessmentHistoryMetadataV1 {
  kind: 'completed_assessment'
  id: string
  status: 'completed'
  schemaVersion: 2
  completedAt: string
  assessmentContractVersion: 'assessment-schema-v2'
  source: typeof HISTORY_SERVER_TEST_ONLY_SOURCE_V1
  snapshotRevision: 1
}
export type CompletedAssessmentHistoryReadV1 =
  | { state: 'UNAVAILABLE' }
  | { state: 'ERROR'; reason: 'identity' | 'permission' | 'read_failed' }
  | { state: 'READY'; records: CompletedAssessmentHistoryMetadataV1[]; nextCursor: string | null }

export interface HistoricalProfileDisplayV1 {
  kind: 'historical_profile_display_v1'
  snapshotVersion: 1
  assessmentId: string
  assessmentCompletedAt: string
  assessmentSchemaVersion: 2
  profileContractVersion: 'elder-profile-contract-v2'
  derivationRulesetVersion: 'elder-profile-ruleset-v2'
  rows: Array<{ label: string; value: string }>
}
export type HistoricalDetailReadV1 =
  | { state: 'READY'; item: CompletedAssessmentHistoryMetadataV1; profile: HistoricalProfileDisplayV1 | null }
  | { state: 'ERROR'; message: string }
