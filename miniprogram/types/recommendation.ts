import type {
  AssessmentAnswerValueMap,
  PreferenceRegionAnswer,
} from './assessment'
import type {
  CareCapabilityRequirementStatus,
  DerivationEvidence,
  DerivationEvidenceId,
  ElderProfile,
  ElderProfileDerivedField,
  ElderProfileIdentity,
  ElderProfilePreview,
  ProfileClarification,
} from './elder-profile'
import type {
  InstitutionEffectiveCapabilityStatus,
  InstitutionEvidence,
  InstitutionEvidenceValueSnapshot,
  InstitutionMatchingCriticalFieldPath,
  InstitutionRecord,
} from './institution'

export type RecommendationContractVersion = 'recommendation-contract-v1'
export type RecommendationRulesetVersion = 'recommendation-ruleset-v1'
export type RecommendationPolicyVersion = 'conservative-exact-with-conditional-v1'
export type RecommendationPolicy = 'CONSERVATIVE_EXACT_WITH_CONDITIONAL'
export type RecommendationDatasetMode = 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'

export type ProfileRawFactEvidenceRef =
  | {
    kind: 'profile_raw_fact'
    profilePath: 'preference.rawFacts.preferredInstitutionType'
    sourceQuestionId: 'preference.careType'
    valueSnapshot: AssessmentAnswerValueMap['preference.careType']
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'preference.rawFacts.priorities'
    sourceQuestionId: 'preference.priorities'
    valueSnapshot: AssessmentAnswerValueMap['preference.priorities']
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'preference.rawFacts.regionPreference'
    sourceQuestionId: 'preference.region'
    presence: 'provided' | 'absent'
    valueSnapshot: PreferenceRegionAnswer | null
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'financial.rawFacts.monthlyBudget'
    sourceQuestionId: 'budget.monthlyRange'
    valueSnapshot: AssessmentAnswerValueMap['budget.monthlyRange']
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'financial.rawFacts.depositTolerance'
    sourceQuestionId: 'budget.upfrontCostAcceptance'
    valueSnapshot: AssessmentAnswerValueMap['budget.upfrontCostAcceptance']
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'intent.rawFacts.moveInTiming'
    sourceQuestionId: 'budget.moveInTiming'
    valueSnapshot: AssessmentAnswerValueMap['budget.moveInTiming']
  }
  | {
    kind: 'profile_raw_fact'
    profilePath: 'intent.rawFacts.consultantIntent'
    sourceQuestionId: 'budget.consultantSupport'
    valueSnapshot: AssessmentAnswerValueMap['budget.consultantSupport']
  }

export type ElderEvidenceRef =
  | {
    kind: 'derived_evidence'
    derivedField: ElderProfileDerivedField
    evidenceId: DerivationEvidenceId
  }
  | ProfileRawFactEvidenceRef

export interface RecommendationElderSemanticSnapshot {
  adl: ElderProfile['adl']['derivedFacts']
  mobility: ElderProfile['mobility']['derivedFacts']
  health: ElderProfile['health']['derivedFacts']
  cognition: ElderProfile['cognition']['derivedFacts']
  specialCare: ElderProfile['specialCare']['derivedFacts']
  preference: ElderProfile['preference']['rawFacts']
  financial: ElderProfile['financial']['rawFacts']
  intent: ElderProfile['intent']['rawFacts']
  evidence: readonly DerivationEvidence[]
  clarifications: readonly ProfileClarification[]
}

export type InstitutionProjectionReason =
  | 'raw_value_currently_verified'
  | 'raw_value_unknown'
  | 'raw_value_unverified'
  | 'raw_value_expired'
  | 'raw_value_past_valid_until'
  | 'verification_in_future'
  | 'raw_field_unavailable'

export interface InstitutionEffectiveEvidenceRef {
  institutionId: string
  recordRevision: number
  fieldPath: InstitutionMatchingCriticalFieldPath
  rawSnapshot: InstitutionEvidenceValueSnapshot | null
  effectiveSnapshot: InstitutionEvidenceValueSnapshot | null
  projectionReason: InstitutionProjectionReason
  evidenceIds: readonly string[]
  verificationStatus: 'verified' | 'expired' | 'unverified'
  verifiedAt?: string
  validUntil?: string
  evaluationAsOf: string
}

export type RecommendationInstitutionEvidenceSnapshot = Pick<
  InstitutionEvidence,
  'evidenceId' | 'institutionId' | 'recordRevision' | 'fieldPath'
  | 'valueSnapshot' | 'sourceType' | 'observedAt' | 'verificationStatus'
  | 'verifiedAt' | 'validUntil'
>

export type RecommendationPoolManifestEntry = {
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecord['recordProvenance']
  recordStatus: InstitutionRecord['recordStatus']
  matchingFields: readonly InstitutionEffectiveEvidenceRef[]
  evidence: readonly RecommendationInstitutionEvidenceSnapshot[]
} & (
  | { disposition: 'included'; exclusionReasonCode?: never }
  | {
    disposition: 'excluded'
    exclusionReasonCode:
      | 'RECORD_NOT_PUBLISHED'
      | 'MOCK_DATA_NOT_PRODUCTION'
      | 'NON_MOCK_DATA_IN_SYNTHETIC_MODE'
  }
)

export interface RecommendationPoolManifest {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  institutionContractVersion: 'institution-contract-v1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
  entries: readonly RecommendationPoolManifestEntry[]
}

export type RecommendationElderReadiness = 'ready' | 'blocked_by_required_clarification'

export type RecommendationRequirementDisposition =
  | 'unresolved'
  | 'soft_fit_data_gap'
  | 'informational'

export type RecommendationReadinessCode =
  | 'ELDER_CLASSIFICATION_NEEDS_CONFIRMATION'
  | 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION'
  | 'REHABILITATION_SOFT_DATA_GAP'
  | 'PRIORITY_NOT_SCORABLE'
  | 'PRIORITY_UNVERIFIED'

export interface RequirementReadiness {
  code: RecommendationReadinessCode
  sourceDerivedField: ElderProfileDerivedField
  disposition: RecommendationRequirementDisposition
  blocksEligibility: boolean
  clarificationIds: readonly string[]
  elderEvidenceRefs: readonly ElderEvidenceRef[]
}

export type HardConstraintOutcome =
  | 'satisfied'
  | 'conditional'
  | 'unverified'
  | 'conflict'
  | 'not_applicable'

export interface HardConstraintResult {
  constraintCode: string
  sourceDerivedField: ElderProfileDerivedField
  elderRequirementStatus: CareCapabilityRequirementStatus | 'known_care_level' | 'known_mobility'
  institutionId: string
  recordRevision: number
  institutionFieldPath: InstitutionMatchingCriticalFieldPath | null
  institutionEffectiveStatus: InstitutionEffectiveCapabilityStatus | 'not_evaluated'
  outcome: HardConstraintOutcome
  blocksExact: boolean
  blocksEligibility: boolean
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
  clarificationIds: readonly string[]
}

export type RecommendationMatchTier = 'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL' | 'UNVERIFIED' | 'INELIGIBLE'

export type RecommendationDifferenceCategory =
  | 'HARD_CONFLICT'
  | 'SOFT_DIFFERENCE'
  | 'CONDITIONAL_REQUIREMENT'
  | 'UNVERIFIED_DATA_GAP'

export type RecommendationDifferenceType =
  | 'hard_conflict'
  | 'requires_assessment'
  | 'unknown_capability'
  | 'budget'
  | 'region'
  | 'institution_type'
  | 'priority'
  | 'data_quality'

export interface RecommendationDifference {
  differenceCode: RecommendationDifferenceCode
  differenceCategory: RecommendationDifferenceCategory
  differenceType: RecommendationDifferenceType
  severity: 'blocking' | 'important' | 'advisory'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
}

export type RecommendationReasonType =
  | 'care_capability'
  | 'medical_rehabilitation'
  | 'budget'
  | 'region'
  | 'institution_type'
  | 'priority'
  | 'data_quality'

export type RecommendationReasonCode =
  | 'CARE_LEVEL_SUPPORTED'
  | 'MOBILITY_SUPPORTED'
  | 'TRANSFER_SUPPORTED'
  | 'COGNITIVE_ACCEPTANCE_SUPPORTED'
  | 'WANDERING_SUPPORT_SUPPORTED'
  | 'SPECIAL_CARE_SUPPORTED'
  | 'REHABILITATION_SUPPORTED'
  | 'REQUIREMENT_REQUIRES_ASSESSMENT'
  | 'REQUIREMENT_UNVERIFIED'
  | 'REQUIREMENT_UNSUPPORTED'
  | 'BUDGET_WITHIN_RANGE'
  | 'BUDGET_PARTIAL_OVERLAP'
  | 'BUDGET_ABOVE_RANGE'
  | 'BUDGET_BELOW_DECLARED_RANGE'
  | 'BUDGET_CEILING_UNSPECIFIED'
  | 'BUDGET_UNKNOWN'
  | 'REGION_MATCH'
  | 'REGION_DIFFERENT'
  | 'REGION_UNKNOWN'
  | 'TYPE_MATCH'
  | 'TYPE_DIFFERENT'
  | 'TYPE_UNKNOWN'
  | 'PRIORITY_STRUCTURED_MATCH'
  | 'PRIORITY_NOT_MET'
  | 'PRIORITY_UNVERIFIED'
  | 'PRIORITY_NOT_SCORABLE'
  | 'DATA_NOT_VERIFIED'

export type RecommendationDifferenceCode =
  | 'HARD_CAPABILITY_UNSUPPORTED'
  | 'CAPABILITY_REQUIRES_ASSESSMENT'
  | 'CAPABILITY_NOT_VERIFIED'
  | 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION'
  | 'BUDGET_PARTIAL_OVERLAP'
  | 'BUDGET_ABOVE_RANGE'
  | 'BUDGET_BELOW_DECLARED_RANGE'
  | 'BUDGET_UNKNOWN'
  | 'PRICE_UPPER_BOUND_UNKNOWN'
  | 'REGION_DIFFERENT'
  | 'REGION_UNKNOWN'
  | 'TYPE_DIFFERENT'
  | 'TYPE_UNKNOWN'
  | 'PRIORITY_NOT_MET'
  | 'PRIORITY_UNVERIFIED'
  | 'PRIORITY_NOT_SCORABLE'
  | 'REHABILITATION_SOFT_DATA_GAP'

export interface RecommendationReason {
  reasonCode: RecommendationReasonCode
  reasonType: RecommendationReasonType
  polarity: 'supported' | 'conditional' | 'unverified' | 'difference' | 'conflict'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
}

export type RecommendationFactorRankParticipation =
  | 'baseline'
  | 'selected_priority'
  | 'consumed_by_priority'
  | 'consumed_by_hard'
  | 'not_applicable'
  | 'not_scorable'

export type BudgetFit =
  | 'within_budget'
  | 'partially_overlapping'
  | 'above_budget'
  | 'below_declared_range'
  | 'unknown'

export type TypeFit = 'match' | 'mismatch' | 'unknown' | 'not_applicable'
export type RegionFit = 'same' | 'different' | 'unknown' | 'not_applicable'
export type RehabilitationFit = InstitutionEffectiveCapabilityStatus | 'not_applicable'
export type PriorityFitStatus =
  | 'match'
  | 'partial'
  | 'mismatch'
  | 'unknown'
  | 'not_scorable'
  | 'not_applicable'

export type NamedFactorResult = {
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
  rankParticipation: RecommendationFactorRankParticipation
} & (
  | { factorCode: 'care_compatibility_tier'; status: RecommendationMatchTier | null }
  | { factorCode: 'budget_fit'; status: BudgetFit }
  | { factorCode: 'region_fit'; status: RegionFit }
  | { factorCode: 'institution_type_fit'; status: TypeFit }
  | { factorCode: 'rehabilitation_fit'; status: RehabilitationFit }
  | {
    factorCode: 'priority_fit'
    priorityCode: AssessmentAnswerValueMap['preference.priorities'][number]
    status: PriorityFitStatus
    subStatuses?: readonly RecommendationPrioritySubStatus[]
  }
)

export interface RecommendationPrioritySubStatus {
  fieldPath: InstitutionMatchingCriticalFieldPath
  status: InstitutionEffectiveCapabilityStatus
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
}

export interface RecommendationSoftFit {
  factors: readonly NamedFactorResult[]
}

export interface PriorityFitVector {
  matchedCount: number
  partialCount: number
  knownMismatchCount: number
  unknownCount: number
}

export interface RecommendationRankParticipation {
  priority: RecommendationFactorRankParticipation
  budget: RecommendationFactorRankParticipation
  type: RecommendationFactorRankParticipation
  region: RecommendationFactorRankParticipation
  rehabilitation: RecommendationFactorRankParticipation
}

export interface RecommendationRankTuple {
  tier: RecommendationMatchTier | null
  priorityFitVector: PriorityFitVector
  budgetFit: BudgetFit | null
  institutionTypeFit: TypeFit | null
  regionFit: RegionFit | null
  rehabilitationSoftFit: RehabilitationFit | null
  institutionId: string
}

export interface RecommendationItem {
  institutionId: string
  recordRevision: number
  matchTier: RecommendationMatchTier | null
  constraintResults: readonly HardConstraintResult[]
  softFit: RecommendationSoftFit
  rankTuple: RecommendationRankTuple | null
  rankParticipation: RecommendationRankParticipation | null
  reasons: readonly RecommendationReason[]
  differences: readonly RecommendationDifference[]
}

export type NoExactMatchReasonCode =
  | 'NO_VERIFIED_INSTITUTION_POOL'
  | 'ALL_CANDIDATES_HAVE_HARD_CONFLICT'
  | 'REQUIRED_CAPABILITY_UNRESOLVED'
  | 'ONLY_SOFT_NEAR_MATCHES'
  | 'ONLY_CONDITIONAL_CANDIDATES'
  | 'NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES'

export interface NoExactMatch {
  code: 'NO_EXACT_MATCH'
  reasonCode: NoExactMatchReasonCode
  unmetHardRequirements: readonly HardConstraintResult[]
  unverifiedRequirements: readonly HardConstraintResult[]
  nearMatches: readonly RecommendationItem[]
  differences: readonly RecommendationDifference[]
  elderClarifications: readonly ProfileClarification[]
}

export interface RecommendationVersions {
  recommendationContractVersion: RecommendationContractVersion
  recommendationRulesetVersion: RecommendationRulesetVersion
  policyVersion: RecommendationPolicyVersion
  elderProfileContractVersion: 'elder-profile-contract-v1'
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v1'
  adlRulesetVersion: 'adl-ruleset-v1'
  institutionContractVersion: 'institution-contract-v1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

export interface RecommendationSemanticResult {
  versions: RecommendationVersions
  policy: RecommendationPolicy
  evaluationAsOf: string
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  elderSnapshot: RecommendationElderSemanticSnapshot
  poolManifest: RecommendationPoolManifest
  elderReadiness: RecommendationElderReadiness
  requirementReadiness: readonly RequirementReadiness[]
  elderClarifications: readonly ProfileClarification[]
  items: readonly RecommendationItem[]
  conditionalCandidates: readonly RecommendationItem[]
  candidateEvaluations: readonly RecommendationItem[]
  exactMatch: boolean
  noExactMatch?: NoExactMatch
}

export interface RecommendationPreview {
  kind: 'recommendation_preview'
  source: ElderProfilePreview['source']
  profileContractVersion: ElderProfilePreview['profileContractVersion']
  derivationRulesetVersion: ElderProfilePreview['derivationRulesetVersion']
  adlRulesetVersion: ElderProfilePreview['adl']['derivedFacts']['rulesetVersion']
  semantics: RecommendationSemanticResult
}

export interface FormalRecommendation {
  kind: 'recommendation'
  identity: ElderProfileIdentity
  semantics: RecommendationSemanticResult
}

export type RecommendationProfile = ElderProfile | ElderProfilePreview

export interface RecommendationEvaluationInput<P extends RecommendationProfile = RecommendationProfile> {
  profile: P
  institutions: readonly InstitutionRecord[]
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  rulesetVersion: RecommendationRulesetVersion
  policyVersion: RecommendationPolicyVersion
}

export type RecommendationErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_PROFILE_ENVELOPE'
  | 'INVALID_PROFILE_SNAPSHOT'
  | 'INVALID_PROFILE_EVIDENCE'
  | 'INVALID_PROFILE_CLARIFICATION'
  | 'INVALID_RECOMMENDATION_VERSION'
  | 'INVALID_EVALUATION_AS_OF'
  | 'INVALID_DATASET'
  | 'INVALID_INSTITUTION_RECORD'
  | 'DUPLICATE_INSTITUTION_ID'
  | 'MIXED_INSTITUTION_REVISION'
  | 'INVALID_INSTITUTION_PROVENANCE'
  | 'INVALID_POOL_MANIFEST'

export interface RecommendationError {
  code: RecommendationErrorCode
  paths: readonly string[]
}

export type RecommendationEvaluationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RecommendationError }

export type InstitutionAdvisoryEvidenceRef =
  | {
    institutionId: string
    recordRevision: number
    evaluationAsOf: string
    evidenceIds: readonly string[]
    fieldPath: 'price.deposit'
    snapshot: InstitutionRecord['price']['deposit']
  }
  | {
    institutionId: string
    recordRevision: number
    evaluationAsOf: string
    evidenceIds: readonly []
    fieldPath: 'price.oneTimeFees'
    scope: 'list_presence'
    snapshot: InstitutionRecord['price']['oneTimeFees']
  }
  | {
    institutionId: string
    recordRevision: number
    evaluationAsOf: string
    evidenceIds: readonly string[]
    fieldPath: 'price.oneTimeFees'
    scope: 'fee_amount'
    feeId: string
    snapshot: InstitutionRecord['price']['oneTimeFees'][number]['referenceAmount']
  }
  | {
    institutionId: string
    recordRevision: number
    evaluationAsOf: string
    evidenceIds: readonly string[]
    fieldPath: 'operations.bedAvailability'
    snapshot: InstitutionRecord['operations']['bedAvailability']
  }

export interface RecommendationAdvisoryAttachment {
  institutionId: string
  recordRevision: number
  advisoryCode: 'UPFRONT_COST_NEEDS_INQUIRY' | 'AVAILABILITY_DISPLAY_ONLY'
  advisoryCategory: 'OPERATIONAL_ADVISORY'
  severity: 'advisory'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  advisoryEvidenceRefs: readonly InstitutionAdvisoryEvidenceRef[]
}

export interface RecommendationAdvisoryInput {
  profile: RecommendationProfile
  institutions: readonly InstitutionRecord[]
  evaluationAsOf: string
}

export const RECOMMENDATION_CARD_LIMIT = 3 as const
export const RECOMMENDATION_CONTRACT_VERSION: RecommendationContractVersion = 'recommendation-contract-v1'
export const RECOMMENDATION_RULESET_VERSION: RecommendationRulesetVersion = 'recommendation-ruleset-v1'
export const RECOMMENDATION_POLICY_VERSION: RecommendationPolicyVersion = 'conservative-exact-with-conditional-v1'
export const RECOMMENDATION_POLICY: RecommendationPolicy = 'CONSERVATIVE_EXACT_WITH_CONDITIONAL'
