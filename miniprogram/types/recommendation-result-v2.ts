import type {
  InstitutionRecordProvenance,
  InstitutionRecordStatus,
  InstitutionRoomTypeCode,
  InstitutionTypeCode,
} from './institution'
import type {
  InstitutionMealScheduleCodeV11,
  InstitutionServiceAvailabilityV11,
} from './institution-v1-1'
import type { ElderProfilePreviewV2 } from './elder-profile-v2'
import type {
  RecommendationPreviewApplicationErrorV2,
} from './recommendation-preview-v2'
import type { RecommendationPreviewV2 } from './recommendation-v2'

export type EffectiveVerificationStateV11 =
  | 'current_verified'
  | 'unverified'
  | 'expired'

export type InstitutionDisplayFactV11<T> =
  | {
    availability: 'provided'
    value: T
    effectiveVerification: EffectiveVerificationStateV11
  }
  | {
    availability: 'unknown' | 'unavailable'
    value: null
    effectiveVerification: EffectiveVerificationStateV11
  }

export type ReferenceMonthlyPriceDisplayValueV11 =
  | {
    kind: 'bounded'
    minAmountMinor: number
    maxAmountMinor: number
    currency: 'CNY'
    period: 'month'
    basis: 'reference_total'
  }
  | {
    kind: 'starting_at'
    minAmountMinor: number
    currency: 'CNY'
    period: 'month'
    basis: 'reference_total'
  }

export interface InstitutionRoomDisplayFactV11 {
  roomId: string
  roomType: InstitutionDisplayFactV11<InstitutionRoomTypeCode>
}

export interface InstitutionMealDisplayFactsV11 {
  mealSchedule: InstitutionDisplayFactV11<InstitutionMealScheduleCodeV11>
  easyChewSupport: InstitutionDisplayFactV11<InstitutionServiceAvailabilityV11>
  modifiedFoodSupport: InstitutionDisplayFactV11<InstitutionServiceAvailabilityV11>
}

export interface InstitutionOperationalDisplayAdvisoryV11 {
  institutionId: string
  recordRevision: number
  code: 'AVAILABILITY_DISPLAY_ONLY'
}

export interface InstitutionDisplaySnapshotV11 {
  kind: 'institution_display_snapshot_v1_1'
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecordProvenance
  recordStatus: InstitutionRecordStatus
  identity: {
    name: InstitutionDisplayFactV11<string>
    regionDisplayName: InstitutionDisplayFactV11<string>
  }
  type: {
    primaryType: InstitutionDisplayFactV11<InstitutionTypeCode>
    supportedTypes: InstitutionDisplayFactV11<readonly InstitutionTypeCode[]>
  }
  price: {
    referenceMonthlyPrice: InstitutionDisplayFactV11<ReferenceMonthlyPriceDisplayValueV11>
  }
  media: {
    cover: {
      state: 'current_verified' | 'placeholder'
      mediaId: string | null
      url: string | null
    }
    vr: {
      state: 'current_verified_available' | 'unavailable' | 'unknown'
    }
  }
  roomFacts: readonly InstitutionRoomDisplayFactV11[]
  mealFacts: InstitutionMealDisplayFactsV11
}

export interface RecommendationResultSourceContextV2 {
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

export interface RecommendationResultApplicationSnapshotV2 {
  kind: 'recommendation_result_application_snapshot_v2'
  preview: RecommendationPreviewV2
  institutionDisplays: readonly InstitutionDisplaySnapshotV11[]
  operationalDisplayAdvisories: readonly InstitutionOperationalDisplayAdvisoryV11[]
  sourceContext: RecommendationResultSourceContextV2
  source: ElderProfilePreviewV2['source']
}

export type RecommendationResultSourceAssociationErrorCauseV2 =
  | 'DISPLAY_SOURCE_MISSING'
  | 'DISPLAY_SOURCE_DUPLICATE'
  | 'DISPLAY_SOURCE_REVISION_MISMATCH'
  | 'DISPLAY_SOURCE_CONTEXT_MISMATCH'
  | 'DISPLAY_SOURCE_PROVENANCE_MISMATCH'
  | 'DISPLAY_SOURCE_PROJECTION_INVALID'

export interface RecommendationResultSourceAssociationErrorV2 {
  code: 'RESULT_SOURCE_ASSOCIATION_ERROR'
  causeCode: RecommendationResultSourceAssociationErrorCauseV2
  candidateIndex?: number
}

export type RecommendationResultApplicationErrorV2 =
  | RecommendationPreviewApplicationErrorV2
  | RecommendationResultSourceAssociationErrorV2

export type RecommendationResultApplicationResultV2 =
  | { ok: true; value: RecommendationResultApplicationSnapshotV2 }
  | { ok: false; error: RecommendationResultApplicationErrorV2 }
