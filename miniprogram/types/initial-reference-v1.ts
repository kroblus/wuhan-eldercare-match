/**
 * V1.3-C1 initial-reference types.
 *
 * This module is additive and intentionally depends on frozen V2 types only
 * through type imports. It does not widen or alter Recommendation V2.
 */
import type {
  InstitutionEvidenceV121,
  InstitutionRecordV121,
} from './institution-v1-2-1'
import type {
  InstitutionField,
  InstitutionFieldVerification,
  InstitutionRecordProvenance,
  InstitutionRoomTypeCode,
  ReferenceMonthlyPrice,
} from './institution'
import type {
  InstitutionCatalogCurrentPointerV121,
  InstitutionCatalogPayloadV121,
  InstitutionCatalogServiceV121,
  InstitutionCatalogErrorCodeV121,
} from './institution-catalog-v1-2-1'
import type { InstitutionCatalogServiceV11 } from './institution-catalog-v1-1'
import type { AssessmentDraftV2 } from './assessment-v2'
import type {
  AssessmentDraftSourceV2,
  RecommendationPreviewServiceV2,
} from './recommendation-preview-v2'
import type {
  RecommendationCandidateEvaluationV2,
  RecommendationElderSemanticSnapshotV2,
  ElderEvidenceRefV2,
} from './recommendation-v2'
import type {
  HardConstraintResult,
  RecommendationDatasetMode,
  RecommendationMatchTier,
} from './recommendation'
import type {
  RecommendationResultApplicationSnapshotV2,
  InstitutionDisplaySnapshotV11,
} from './recommendation-result-v2'

export const INITIAL_REFERENCE_POLICY_VERSION_V1 = 'initial-reference-policy-v1' as const
export const REFERENCE_COMPOSITION_VERSION_V1 = 'reference-composition-v1' as const

export type InitialReferencePolicyVersionV1 = typeof INITIAL_REFERENCE_POLICY_VERSION_V1
export type ReferenceCompositionVersionV1 = typeof REFERENCE_COMPOSITION_VERSION_V1

export type ReferenceEffectiveFieldStatusV1 =
  | 'current_verified'
  | 'unverified'
  | 'expired'
  | 'unknown'
  | 'unavailable'

/**
 * A source field is kept intact. effectiveValue is populated only when the
 * raw field is provided and current verified at the caller's explicit T.
 */
export interface ReferenceFieldFactV1<T> {
  fieldPath: string
  raw: InstitutionField<T>
  verification: InstitutionFieldVerification
  effectiveStatus: ReferenceEffectiveFieldStatusV1
  effectiveValue: T | null
  evidence: readonly InstitutionEvidenceV121[]
}

export interface ReferenceRoomTypeFactV1 {
  roomId: string
  fieldPath: `rooms.${number}.roomType`
  roomType: ReferenceFieldFactV1<InstitutionRoomTypeCode>
}

/** Minimum whitelist projection from one exact published current revision. */
export interface ReferenceInstitutionFactsV1 {
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecordProvenance
  recordStatus: 'published'
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  currentPointer: InstitutionCatalogCurrentPointerV121
  identity: {
    regionCode: ReferenceFieldFactV1<string>
  }
  price: {
    referenceMonthlyPrice: ReferenceFieldFactV1<ReferenceMonthlyPrice>
  }
  rooms: readonly ReferenceRoomTypeFactV1[]
  meal: {
    mealSchedule: ReferenceFieldFactV1<InstitutionRecordV121['meal']['mealSchedule']['value']>
    easyChewSupport: ReferenceFieldFactV1<InstitutionRecordV121['meal']['easyChewSupport']['value']>
    modifiedFoodSupport: ReferenceFieldFactV1<InstitutionRecordV121['meal']['modifiedFoodSupport']['value']>
  }
}

export interface ReferenceInstitutionPoolFactsV1 {
  kind: 'initial_reference_institution_facts_v1'
  policyVersion: InitialReferencePolicyVersionV1
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  institutions: readonly ReferenceInstitutionFactsV1[]
}

export type InitialReferenceFactsProjectionErrorCodeV1 =
  | 'INVALID_CATALOG'
  | 'INVALID_EVALUATION_AS_OF'

export interface InitialReferenceFactsProjectionErrorV1 {
  state: 'DATA_ERROR'
  code: InitialReferenceFactsProjectionErrorCodeV1
  causeCode?: InstitutionCatalogErrorCodeV121
  recordIndex?: number
  pointerIndex?: number
}

export type InitialReferenceFactsProjectionResultV1 =
  | { ok: true; value: ReferenceInstitutionPoolFactsV1 }
  | { ok: false; error: InitialReferenceFactsProjectionErrorV1 }

export type InitialReferenceBasisCategoryV1 = 'AREA' | 'BUDGET' | 'BASIC_SERVICE'
export type InitialReferenceBasisStatusV1 =
  | 'MATCHED'
  | 'NOT_MATCHED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE'

export type InitialReferenceExclusionCodeV1 =
  | 'LEGACY_CONSTRAINT_CONFLICT'
  | 'LEGACY_INELIGIBLE'
  | 'REFERENCE_FOOD_TEXTURE_UNSUPPORTED'

export interface InitialReferenceBasisEvaluationV1 {
  category: InitialReferenceBasisCategoryV1
  status: InitialReferenceBasisStatusV1
  fieldPaths: readonly string[]
  /** Only the institution fields that actually support a MATCHED result. */
  matchedFieldPaths: readonly string[]
  evidence: readonly InstitutionEvidenceV121[]
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
}

/** Inputs consumed by the separate C1 eligibility policy. */
export interface InitialReferenceEligibilityInputV1 {
  institutionFacts: ReferenceInstitutionFactsV1
  legacyCandidate: RecommendationCandidateEvaluationV2
  elderSnapshot: RecommendationElderSemanticSnapshotV2
}

export interface InitialReferenceEligibleCandidateV1 {
  institutionId: string
  recordRevision: number
  matchedCategories: readonly InitialReferenceBasisCategoryV1[]
  basisEvaluations: readonly InitialReferenceBasisEvaluationV1[]
  institutionFacts: ReferenceInstitutionFactsV1
}

export interface InitialReferenceEligibilityDecisionV1 {
  institutionId: string
  recordRevision: number
  eligible: boolean
  legacyMatchTier: RecommendationMatchTier | null
  legacyConstraintResults: readonly HardConstraintResult[]
  matchedCategories: readonly InitialReferenceBasisCategoryV1[]
  basisEvaluations: readonly InitialReferenceBasisEvaluationV1[]
  exclusionCodes: readonly InitialReferenceExclusionCodeV1[]
  exclusionEvidence: readonly InstitutionEvidenceV121[]
  exclusionElderEvidenceRefs: readonly ElderEvidenceRefV2[]
  candidate: InitialReferenceEligibleCandidateV1 | null
}

export type RecommendationResultPageStateSnapshotV2 =
  | 'ready_exact'
  | 'ready_soft_near'
  | 'ready_conditional'
  | 'no_safe_recommendation'

export interface InitialReferenceDisplayCardV1 {
  kind: 'initial_reference_candidate_v1'
  category: 'INITIAL_REFERENCE'
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecordProvenance
  source: 'direct_link'
  matchedCategories: readonly InitialReferenceBasisCategoryV1[]
  basisEvaluations: readonly InitialReferenceBasisEvaluationV1[]
  referenceReasons: readonly InitialReferenceBasisEvaluationV1[]
  institutionFacts: ReferenceInstitutionFactsV1
  institutionDisplay: InstitutionDisplaySnapshotV11
  elderRiskFacts: Pick<RecommendationElderSemanticSnapshotV2,
    'adl' | 'mobility' | 'health' | 'nutrition' | 'cognition' | 'specialCare'>
  elderClarifications: RecommendationResultApplicationSnapshotV2['preview']['semantics']['elderClarifications']
  requirementReadiness: RecommendationResultApplicationSnapshotV2['preview']['semantics']['requirementReadiness']
  institutionCapabilityUnknowns: readonly HardConstraintResult[]
  ordinaryDataGaps: readonly InitialReferenceBasisEvaluationV1[]
  warningCodes: readonly ('G0' | 'K0' | 'I0')[]
  publicDetailTarget: {
    institutionId: string
    recordRevision: number
    routeSource: 'direct_link'
  }
}

export type InitialReferenceCompositionStateV1 =
  | 'LEGACY_V2_DISPLAY'
  | 'INITIAL_REFERENCE_ONLY'
  | 'NO_PERSONALIZED_CANDIDATE'

export interface ReferenceCompositionV1 {
  kind: 'reference_composition_v1'
  persistence: 'FORBIDDEN'
  compositionVersion: ReferenceCompositionVersionV1
  policyVersion: InitialReferencePolicyVersionV1
  state: InitialReferenceCompositionStateV1
  evaluationAsOf: string
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  legacyV2: RecommendationResultApplicationSnapshotV2
  legacyPresentationState: RecommendationResultPageStateSnapshotV2
  eligibleReferenceCandidates: readonly InitialReferenceEligibleCandidateV1[]
  displayedReferenceCards: readonly InitialReferenceDisplayCardV1[]
  referenceEvaluations: readonly InitialReferenceEligibilityDecisionV1[]
  directoryBrowseAvailable: boolean
}

export interface ReferenceCompositionInputV1 {
  catalog: InstitutionCatalogPayloadV121
  legacyV2: RecommendationResultApplicationSnapshotV2
  evaluationAsOf: string
  expectedDatasetMode: RecommendationDatasetMode
}

export type InitialReferenceApplicationErrorStateV1 =
  | 'ASSESSMENT_ERROR'
  | 'DATA_ERROR'
  | 'SERVICE_ERROR'

export interface InitialReferenceApplicationErrorV1 {
  state: InitialReferenceApplicationErrorStateV1
  code: string
  causeCode: string
  paths?: readonly string[]
  recordIndex?: number
  pointerIndex?: number
  legacyV2?: RecommendationResultApplicationSnapshotV2
}

export type InitialReferenceApplicationResultV1 =
  | { ok: true; value: ReferenceCompositionV1 }
  | { ok: false; error: InitialReferenceApplicationErrorV1 }

export interface InitialReferenceLegacyV2ServiceDependenciesV1 {
  draftSource: AssessmentDraftSourceV2
  institutionCatalog: InstitutionCatalogServiceV11
}

export type InitialReferenceLegacyV2ServiceFactoryV1 = (
  dependencies: InitialReferenceLegacyV2ServiceDependenciesV1,
) => RecommendationPreviewServiceV2

export interface InitialReferencePreviewServiceDependenciesV1 {
  draftSource: AssessmentDraftSourceV2
  institutionCatalogV121: InstitutionCatalogServiceV121
  expectedDatasetMode: RecommendationDatasetMode
  createLegacyV2Service: InitialReferenceLegacyV2ServiceFactoryV1
}

export interface InitialReferencePreviewServiceV1 {
  build(evaluationAsOf: string): Promise<InitialReferenceApplicationResultV1>
}

export type InitialReferenceAssessmentDraftV2 = AssessmentDraftV2
