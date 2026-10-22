import type { AssessmentQuestionIdV2 } from './assessment-v2'
import type {
  ElderProfilePreviewDerivationErrorCodeV2,
  ElderProfilePreviewV2,
} from './elder-profile-v2'

export type ProfileApplicationDisplayStateV2 = 'ready'

export interface ProfileApplicationSnapshotV2 {
  kind: 'profile_application_snapshot_v2'
  preview: ElderProfilePreviewV2
  displayState: ProfileApplicationDisplayStateV2
  source: {
    kind: 'local_assessment_preview'
    localDraftId: string
    assessmentSchemaVersion: 2
  }
  versions: {
    assessmentSchemaVersion: 2
    profileContractVersion: 'elder-profile-contract-v2'
    derivationRulesetVersion: 'elder-profile-ruleset-v2'
    adlRulesetVersion: 'adl-ruleset-v1'
    summarySchemaVersion: 'elder-profile-summary-input-v2'
  }
}

export type ProfileApplicationErrorCodeV2 = 'PROFILE_APPLICATION_V2_ERROR'

export type ProfileApplicationErrorCauseCodeV2 =
  | 'DRAFT_READ_FAILED'
  | ElderProfilePreviewDerivationErrorCodeV2
  | 'SNAPSHOT_METADATA_MISMATCH'

export interface ProfileApplicationErrorV2 {
  code: ProfileApplicationErrorCodeV2
  causeCode: ProfileApplicationErrorCauseCodeV2
  questionIds?: readonly AssessmentQuestionIdV2[]
}

export type ProfileApplicationResultV2 =
  | { ok: true, value: ProfileApplicationSnapshotV2 }
  | { ok: false, error: ProfileApplicationErrorV2 }
