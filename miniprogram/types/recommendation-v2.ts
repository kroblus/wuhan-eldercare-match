import type {
  ActivityPreference,
  MealSchedule,
  PreferencePriorityV2,
  RoomType,
} from './assessment-v2'
import type {
  BudgetAdvisoryTriggerCodeV2,
  DerivationEvidenceV2,
  ElderProfileDerivedFieldV2,
  ElderProfileIdentityV2,
  ElderProfilePreviewV2,
  ElderProfileV2,
  ProfileClarificationV2,
} from './elder-profile-v2'
import type {
  InstitutionEvidenceValueSnapshot,
  InstitutionRecord,
} from './institution'
import type { InstitutionRecordV11 } from './institution-v1-1'
import type {
  BudgetFit,
  ElderEvidenceRef,
  HardConstraintResult,
  InstitutionEffectiveEvidenceRef,
  NoExactMatchReasonCode,
  RecommendationDatasetMode,
  RecommendationDifferenceCategory,
  RecommendationDifferenceCode,
  RecommendationDifferenceType,
  RecommendationFactorRankParticipation,
  RecommendationInstitutionEvidenceSnapshot,
  RecommendationMatchTier,
  RecommendationPolicy,
  RecommendationPolicyVersion,
  RecommendationReasonCode,
  RecommendationReasonType,
  RehabilitationFit,
  RegionFit,
  RequirementReadiness,
  TypeFit,
} from './recommendation'

export type RecommendationContractVersionV2 = 'recommendation-contract-v2'
export type RecommendationRulesetVersionV2 = 'recommendation-ruleset-v2'

export interface RecommendationVersionsV2 {
  recommendationContractVersion: RecommendationContractVersionV2
  recommendationRulesetVersion: RecommendationRulesetVersionV2
  policyVersion: RecommendationPolicyVersion
  elderProfileContractVersion: 'elder-profile-contract-v2'
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v2'
  adlRulesetVersion: 'adl-ruleset-v1'
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

export type RecommendationProfileV2 = ElderProfileV2 | ElderProfilePreviewV2

export interface RecommendationEvaluationInputV2<
  P extends RecommendationProfileV2 = RecommendationProfileV2,
> {
  profile: P
  institutions: readonly InstitutionRecordV11[]
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  contractVersion: RecommendationContractVersionV2
  rulesetVersion: RecommendationRulesetVersionV2
  policyVersion: RecommendationPolicyVersion
}

export type RecommendationProfileRawFactEvidenceRefV2 =
  | {
    kind: 'profile_raw_fact_v2'
    profilePath: 'preference.rawFacts.roomTypePreference'
    sourceQuestionId: 'preference.roomType'
    valueSnapshot: RoomType
  }
  | {
    kind: 'profile_raw_fact_v2'
    profilePath: 'preference.rawFacts.mealSchedulePreference'
    sourceQuestionId: 'preference.mealSchedule'
    valueSnapshot: MealSchedule
  }
  | {
    kind: 'profile_raw_fact_v2'
    profilePath: 'preference.rawFacts.activityPreference'
    sourceQuestionId: 'preference.activityPreference'
    valueSnapshot: ActivityPreference
  }
  | {
    kind: 'profile_raw_fact_v2'
    profilePath: 'preference.rawFacts.priorities'
    sourceQuestionId: 'preference.priorities'
    valueSnapshot: readonly PreferencePriorityV2[]
  }

export type RecommendationDerivedEvidenceRefV2 = {
  kind: 'derived_evidence_v2'
  derivedField: ElderProfileDerivedFieldV2
  evidenceId: string
}

export type ElderEvidenceRefV2 =
  | ElderEvidenceRef
  | RecommendationProfileRawFactEvidenceRefV2
  | RecommendationDerivedEvidenceRefV2

export interface RecommendationElderSemanticSnapshotV2 {
  adl: ElderProfileV2['adl']['derivedFacts']
  mobility: ElderProfileV2['mobility']['derivedFacts']
  health: ElderProfileV2['health']['derivedFacts']
  cognition: ElderProfileV2['cognition']['derivedFacts']
  specialCare: ElderProfileV2['specialCare']['derivedFacts']
  nutrition: ElderProfileV2['nutrition']['derivedFacts']
  preference: ElderProfileV2['preference']['rawFacts']
  financial: {
    rawFacts: ElderProfileV2['financial']['rawFacts']
    derivedFacts: ElderProfileV2['financial']['derivedFacts']
  }
  intent: ElderProfileV2['intent']['rawFacts']
  evidence: readonly DerivationEvidenceV2[]
  clarifications: readonly ProfileClarificationV2[]
}

export type RecommendationInstitutionExtensionFieldPathV2 =
  | `rooms.${number}.roomType`
  | 'meal.mealSchedule'
  | 'meal.easyChewSupport'
  | 'meal.modifiedFoodSupport'
  | 'activity.indoorSpace'
  | 'activity.outdoorSpace'

export interface InstitutionExtensionEvidenceRefV2 {
  institutionId: string
  recordRevision: number
  fieldPath: RecommendationInstitutionExtensionFieldPathV2
  rawAvailability: 'provided' | 'unknown' | 'unavailable'
  rawSnapshot: InstitutionEvidenceValueSnapshot | null
  effectiveSnapshot: InstitutionEvidenceValueSnapshot | null
  projectionReason:
    | 'raw_value_currently_verified'
    | 'raw_value_unknown'
    | 'raw_value_unverified'
    | 'raw_value_expired'
    | 'raw_value_past_valid_until'
    | 'verification_in_future'
    | 'raw_field_unknown'
    | 'raw_field_unavailable'
  evidenceIds: readonly string[]
  verificationStatus: 'verified' | 'expired' | 'unverified'
  verifiedAt?: string
  validUntil?: string
  evaluationAsOf: string
}

export type InstitutionEvidenceRefV2 =
  | InstitutionEffectiveEvidenceRef
  | InstitutionExtensionEvidenceRefV2

export type RecommendationPoolManifestEntryV2 = {
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecord['recordProvenance']
  recordStatus: InstitutionRecord['recordStatus']
  matchingFields: readonly InstitutionEffectiveEvidenceRef[]
  extensionFields: readonly InstitutionExtensionEvidenceRefV2[]
  evidence: readonly RecommendationInstitutionEvidenceSnapshot[]
} & (
  | { disposition: 'included'; exclusionReasonCode?: never }
  | { disposition: 'excluded'; exclusionReasonCode: 'RECORD_NOT_PUBLISHED' }
)

export interface RecommendationPoolManifestV2 {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
  entries: readonly RecommendationPoolManifestEntryV2[]
}

export type RoomFitV2 = 'match' | 'unknown' | 'mismatch' | 'not_applicable'
export type MealScheduleFitV2 = 'match' | 'unknown' | 'mismatch' | 'not_applicable'

export interface RoomFitEvaluationV2 {
  fit: RoomFitV2
  rankParticipation: RecommendationFactorRankParticipation
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionExtensionEvidenceRefV2[]
}

export interface MealScheduleFitEvaluationV2 {
  fit: MealScheduleFitV2
  sourceState: 'known' | 'data_unavailable' | 'unknown' | 'not_applicable'
  rankParticipation: RecommendationFactorRankParticipation
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionExtensionEvidenceRefV2[]
}

export interface ActivityDisplayFactV2 {
  fieldPath: 'activity.indoorSpace' | 'activity.outdoorSpace'
  value: 'present' | 'absent'
  institutionEvidenceRef: InstitutionExtensionEvidenceRefV2
}

export interface ActivityFitV2 {
  preference: ActivityPreference
  displayFacts: readonly ActivityDisplayFactV2[]
  rankParticipation: 'not_scorable'
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
}

export type NutritionDisplayStatusV2 =
  | 'supported'
  | 'unavailable'
  | 'requires_inquiry'
  | 'unknown'
  | 'not_applicable'

export interface NutritionDisplayEvaluationV2 {
  texture: 'standard' | 'easy_chew' | 'modified_food'
  status: NutritionDisplayStatusV2
  rankParticipation: 'not_applicable'
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionExtensionEvidenceRefV2[]
}

export type PriorityFitStatusV2 =
  | 'match'
  | 'partial'
  | 'mismatch'
  | 'unknown'
  | 'not_scorable'
  | 'not_applicable'

export interface PriorityFactorResultV2 {
  priorityCode: PreferencePriorityV2
  role: 'STRUCTURED_SCORABLE' | 'SAFETY_OWNER' | 'DISPLAY_ONLY_NOT_SCORABLE'
  status: PriorityFitStatusV2
  rankParticipation: RecommendationFactorRankParticipation
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionEvidenceRefV2[]
}

export interface PriorityFitVectorV2 {
  matchedCount: number
  partialCount: number
  knownMismatchCount: number
  unknownCount: number
}

export interface RecommendationRankParticipationV2 {
  priority: RecommendationFactorRankParticipation
  budget: RecommendationFactorRankParticipation
  type: RecommendationFactorRankParticipation
  region: RecommendationFactorRankParticipation
  rehabilitation: RecommendationFactorRankParticipation
  room: RecommendationFactorRankParticipation
  mealSchedule: RecommendationFactorRankParticipation
  activity: 'not_scorable'
  nutrition: 'not_applicable'
}

export interface RecommendationRankTupleV2 {
  tier: RecommendationMatchTier | null
  priorityFitVector: PriorityFitVectorV2
  budgetFit: BudgetFit | null
  institutionTypeFit: TypeFit | null
  regionFit: RegionFit | null
  rehabilitationSoftFit: RehabilitationFit | null
  roomFit: Exclude<RoomFitV2, 'not_applicable'> | null
  mealScheduleFit: Exclude<MealScheduleFitV2, 'not_applicable'> | null
  institutionId: string
}

export type RecommendationReasonCodeV2 = RecommendationReasonCode
  | 'ROOM_TYPE_MATCH'
  | 'MEAL_SCHEDULE_MATCH'
  | 'EASY_CHEW_SUPPORT'
  | 'MODIFIED_FOOD_SUPPORT'

export type RecommendationDifferenceCodeV2 = RecommendationDifferenceCode
  | 'ROOM_TYPE_MISMATCH'
  | 'ROOM_TYPE_UNKNOWN'
  | 'MEAL_SCHEDULE_MISMATCH'
  | 'MEAL_SCHEDULE_DATA_UNAVAILABLE'
  | 'MEAL_SCHEDULE_UNKNOWN'
  | 'EASY_CHEW_SUPPORT_UNAVAILABLE'
  | 'EASY_CHEW_SUPPORT_REQUIRES_INQUIRY'
  | 'EASY_CHEW_SUPPORT_UNKNOWN'
  | 'MODIFIED_FOOD_SUPPORT_UNAVAILABLE'
  | 'MODIFIED_FOOD_SUPPORT_REQUIRES_INQUIRY'
  | 'MODIFIED_FOOD_SUPPORT_UNKNOWN'

export interface RecommendationReasonV2 {
  reasonCode: RecommendationReasonCodeV2
  reasonType: RecommendationReasonType | 'room_type' | 'meal_schedule' | 'nutrition'
  polarity: 'supported' | 'conditional' | 'unverified' | 'difference' | 'conflict'
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionEvidenceRefV2[]
}

export interface RecommendationDifferenceV2 {
  differenceCode: RecommendationDifferenceCodeV2
  differenceCategory: RecommendationDifferenceCategory
  differenceType: RecommendationDifferenceType | 'room_type' | 'meal_schedule' | 'nutrition'
  severity: 'blocking' | 'important' | 'advisory'
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly InstitutionEvidenceRefV2[]
}

export interface RecommendationBaseFitsV2 {
  budget: BudgetFit
  type: TypeFit
  region: RegionFit
  rehabilitation: RehabilitationFit
}

export interface RecommendationCandidateEvaluationV2 {
  institutionId: string
  recordRevision: number
  matchTier: RecommendationMatchTier | null
  constraintResults: readonly HardConstraintResult[]
  baseFits: RecommendationBaseFitsV2
  roomFit: RoomFitEvaluationV2
  mealScheduleFit: MealScheduleFitEvaluationV2
  activityFit: ActivityFitV2
  nutrition: NutritionDisplayEvaluationV2
  priorityFactors: readonly PriorityFactorResultV2[]
  priorityFitVector: PriorityFitVectorV2
  rankTuple: RecommendationRankTupleV2 | null
  rankParticipation: RecommendationRankParticipationV2 | null
  reasons: readonly RecommendationReasonV2[]
  differences: readonly RecommendationDifferenceV2[]
}

export type RecommendationCardV2 = RecommendationCandidateEvaluationV2

export interface RecommendationNoExactMatchV2 {
  code: 'NO_EXACT_MATCH'
  reasonCode: NoExactMatchReasonCode
  unmetHardRequirements: readonly HardConstraintResult[]
  unverifiedRequirements: readonly HardConstraintResult[]
  nearMatches: readonly RecommendationCardV2[]
  differences: readonly RecommendationDifferenceV2[]
  elderClarifications: readonly ProfileClarificationV2[]
}

export interface RecommendationAdvisoryV2 {
  code: 'HIGH_CARE_LOW_BUDGET'
  role: 'advisory_only'
  status: 'present'
  rankParticipation: 'not_applicable'
  triggerCodes: readonly BudgetAdvisoryTriggerCodeV2[]
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
  institutionEvidenceRefs: readonly []
}

export interface RequirementReadinessV2 extends Omit<RequirementReadiness, 'sourceDerivedField' | 'elderEvidenceRefs'> {
  sourceDerivedField: ElderProfileDerivedFieldV2
  elderEvidenceRefs: readonly ElderEvidenceRefV2[]
}

export interface RecommendationSemanticResultV2 {
  versions: RecommendationVersionsV2
  policy: RecommendationPolicy
  evaluationAsOf: string
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  elderSnapshot: RecommendationElderSemanticSnapshotV2
  poolManifest: RecommendationPoolManifestV2
  elderReadiness: 'ready' | 'blocked_by_required_clarification'
  requirementReadiness: readonly RequirementReadinessV2[]
  elderClarifications: readonly ProfileClarificationV2[]
  cards: readonly RecommendationCardV2[]
  conditionalCandidates: readonly RecommendationCandidateEvaluationV2[]
  candidateEvaluations: readonly RecommendationCandidateEvaluationV2[]
  advisories: readonly RecommendationAdvisoryV2[]
  exactMatch: boolean
  noExactMatch?: RecommendationNoExactMatchV2
}

export interface RecommendationPreviewV2 {
  kind: 'recommendation_preview_v2'
  source: ElderProfilePreviewV2['source']
  profileContractVersion: 'elder-profile-contract-v2'
  derivationRulesetVersion: 'elder-profile-ruleset-v2'
  adlRulesetVersion: 'adl-ruleset-v1'
  persistence: 'FORBIDDEN'
  semantics: RecommendationSemanticResultV2
}

export interface RecommendationV2 {
  kind: 'recommendation_v2'
  identity: ElderProfileIdentityV2
  semantics: RecommendationSemanticResultV2
}

export type RecommendationErrorCodeV2 =
  | 'UNSUPPORTED_RECOMMENDATION_CONTRACT'
  | 'UNSUPPORTED_RECOMMENDATION_RULESET'
  | 'UNSUPPORTED_PROFILE_VERSION'
  | 'UNSUPPORTED_INSTITUTION_VERSION'
  | 'INVALID_EVALUATION_AS_OF'
  | 'INVALID_PROFILE_SNAPSHOT'
  | 'INVALID_PROFILE_EVIDENCE'
  | 'INVALID_PROFILE_CLARIFICATION'
  | 'INVALID_INSTITUTION_RECORD'
  | 'DUPLICATE_INSTITUTION_ID'
  | 'INVALID_DATASET_MODE_OR_PROVENANCE'
  | 'INVALID_ROOM_MATCHING_INPUT'

export interface RecommendationErrorV2 {
  code: RecommendationErrorCodeV2
  paths: readonly string[]
}

export type RecommendationEvaluationResultV2<T> =
  | { ok: true; value: T }
  | { ok: false; error: RecommendationErrorV2 }

export const RECOMMENDATION_CONTRACT_VERSION_V2: RecommendationContractVersionV2 = 'recommendation-contract-v2'
export const RECOMMENDATION_RULESET_VERSION_V2: RecommendationRulesetVersionV2 = 'recommendation-ruleset-v2'
export const RECOMMENDATION_POLICY_VERSION_V2: RecommendationPolicyVersion = 'conservative-exact-with-conditional-v1'
export const RECOMMENDATION_CARD_LIMIT_V2 = 3 as const
