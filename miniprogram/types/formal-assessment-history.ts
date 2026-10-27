import type { AssessmentAnswerSnapshotV2 } from './assessment-v2'
import type { RecommendationVersionsV2 } from './recommendation-v2'
import type { InitialReferenceResultViewModel } from '../pages/recommendation/initial-reference-view-model'
import type { RecommendationResultPageViewModelV2 } from '../pages/recommendation/result-v2-view-model'
import type { ProfilePageViewModelV2 } from '../pages/assessment/profile-v2-view-model'

/** C2-B wire types only. No provider, upload, page hook, or Storage side effects. */
export type FormalHistoryState = 'LEGACY_V2_DISPLAY' | 'INITIAL_REFERENCE_ONLY' | 'NO_PERSONALIZED_CANDIDATE'
export interface FormalHistoryItem {
  recordId: string
  savedAt: string
  state: FormalHistoryState
  trustedStatus: 'SERVER_SAVED'
}
export interface FormalHistoryDisplay {
  snapshotVersion: 1
  resultVersion: string
  state: FormalHistoryState
  evaluationAsOf: string
  assessmentVersion: 'assessment-contract-v2'
  versions: RecommendationVersionsV2
  compositionVersion: 'reference-composition-v1'
  referencePolicyVersion: 'initial-reference-policy-v1'
  datasetVersion: string
  datasetMode: 'PRODUCTION'
  sourceRelease: string
  sourceReference: string
  poolRevisions: ReadonlyArray<{
    institutionId: string; recordRevision: number; recordProvenance: string
    recordStatus: string; disposition: string
  }>
  profileView: ProfilePageViewModelV2
  resultView: InitialReferenceResultViewModel | RecommendationResultPageViewModelV2
}
export interface FormalHistoryPrepareRequest {
  /** Allocate once at explicit save; persist the original intent across uncertain retries. */
  intentId: string
  assessmentVersion: 'assessment-contract-v2'
  answers: AssessmentAnswerSnapshotV2
  consentId: string
}
export interface FormalHistoryPrepared {
  status: 'REQUIRES_REDISPLAY_AND_CONFIRMATION' | 'SAVED' | 'RESULT_EXPIRED'
  intentId: string
  resultVersion: string | null
  displayBinding: string | null
  expiresAt: string | null
  display: FormalHistoryDisplay | null
  receipt: FormalHistoryItem | null
}
export interface FormalHistoryEnvelope<T> { contractVersion: 'formal-single-elder-history-v1'; result: T }
export interface FormalHistoryDetail { availability: 'READY' | 'UNSUPPORTED_VERSION'; item: FormalHistoryItem; display: FormalHistoryDisplay | null }
export interface FormalHistoryPage { items: FormalHistoryItem[]; nextCursor: string | null }
