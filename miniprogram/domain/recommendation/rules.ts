import type {
  InstitutionMatchingCriticalFieldPath,
  InstitutionSpecialCareCapabilityCode,
} from '../../types/institution'
import type { PreferencePriority } from '../../types/assessment'
import type {
  RecommendationDifferenceCategory,
  RecommendationFactorRankParticipation,
  RecommendationMatchTier,
  RecommendationReasonCode,
  RecommendationReadinessCode,
} from '../../types/recommendation'

export const RECOMMENDATION_PRIORITY_CODES: readonly PreferencePriority[] = [
  'caregiver_attitude',
  'close_to_family',
  'dementia_care',
  'food_quality',
  'living_environment',
  'medical_conditions',
  'nursing_professionalism',
  'overall_quality',
  'price',
  'recreational_activities',
  'rehabilitation_capability',
  'transportation',
]

export const RECOMMENDATION_TIER_ORDER: readonly RecommendationMatchTier[] = [
  'EXACT',
  'SOFT_NEAR',
  'CONDITIONAL',
  'UNVERIFIED',
  'INELIGIBLE',
]

export const SPECIAL_CARE_CAPABILITY_CODES: readonly InstitutionSpecialCareCapabilityCode[] = [
  'round_the_clock_care',
  'one_to_one_caregiver',
  'night_care',
  'dementia_unit',
  'rehabilitation_training',
  'tube_feeding',
  'catheter_care',
  'pressure_injury_care',
  'incontinence_care',
]

export const RECOMMENDATION_MATCHING_FIELD_PATHS: readonly InstitutionMatchingCriticalFieldPath[] = [
  'identity.regionCode',
  'typeProfile.supportedTypes',
  'capabilities.careLevelAcceptance.independent',
  'capabilities.careLevelAcceptance.light_care',
  'capabilities.careLevelAcceptance.semi_disabled',
  'capabilities.careLevelAcceptance.disabled',
  'capabilities.careLevelAcceptance.severely_disabled',
  'capabilities.mobilitySupport.wheelchair_support',
  'capabilities.mobilitySupport.bedbound_support',
  'capabilities.mobilitySupport.transfer_support',
  'capabilities.cognitiveSupport.dementia_acceptance',
  'capabilities.cognitiveSupport.wandering_risk_support',
  'capabilities.specialCare.round_the_clock_care',
  'capabilities.specialCare.one_to_one_caregiver',
  'capabilities.specialCare.night_care',
  'capabilities.specialCare.dementia_unit',
  'capabilities.specialCare.rehabilitation_training',
  'capabilities.specialCare.tube_feeding',
  'capabilities.specialCare.catheter_care',
  'capabilities.specialCare.pressure_injury_care',
  'capabilities.specialCare.incontinence_care',
  'price.referenceMonthlyPrice',
]

export const RECOMMENDATION_REASON_CODES: readonly RecommendationReasonCode[] = [
  'CARE_LEVEL_SUPPORTED',
  'MOBILITY_SUPPORTED',
  'TRANSFER_SUPPORTED',
  'COGNITIVE_ACCEPTANCE_SUPPORTED',
  'WANDERING_SUPPORT_SUPPORTED',
  'SPECIAL_CARE_SUPPORTED',
  'REHABILITATION_SUPPORTED',
  'REQUIREMENT_REQUIRES_ASSESSMENT',
  'REQUIREMENT_UNVERIFIED',
  'REQUIREMENT_UNSUPPORTED',
  'BUDGET_WITHIN_RANGE',
  'BUDGET_PARTIAL_OVERLAP',
  'BUDGET_ABOVE_RANGE',
  'BUDGET_BELOW_DECLARED_RANGE',
  'BUDGET_CEILING_UNSPECIFIED',
  'BUDGET_UNKNOWN',
  'REGION_MATCH',
  'REGION_DIFFERENT',
  'REGION_UNKNOWN',
  'TYPE_MATCH',
  'TYPE_DIFFERENT',
  'TYPE_UNKNOWN',
  'PRIORITY_STRUCTURED_MATCH',
  'PRIORITY_NOT_MET',
  'PRIORITY_UNVERIFIED',
  'PRIORITY_NOT_SCORABLE',
  'DATA_NOT_VERIFIED',
]

export const RECOMMENDATION_READINESS_CODES: readonly RecommendationReadinessCode[] = [
  'ELDER_CLASSIFICATION_NEEDS_CONFIRMATION',
  'ELDER_REQUIREMENT_NEEDS_CONFIRMATION',
  'REHABILITATION_SOFT_DATA_GAP',
  'PRIORITY_NOT_SCORABLE',
  'PRIORITY_UNVERIFIED',
]

export const RECOMMENDATION_DIFFERENCE_CATEGORIES: readonly RecommendationDifferenceCategory[] = [
  'HARD_CONFLICT',
  'SOFT_DIFFERENCE',
  'CONDITIONAL_REQUIREMENT',
  'UNVERIFIED_DATA_GAP',
]

export const ACTIVE_RANK_PARTICIPATION: RecommendationFactorRankParticipation = 'baseline'
export const NEUTRAL_RANK_PARTICIPATION: RecommendationFactorRankParticipation = 'not_applicable'

export const compareAscii = (left: string, right: string): number => {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

export const sortAscii = <T>(values: readonly T[], getValue: (value: T) => string): T[] =>
  values.slice().sort((left, right) => compareAscii(getValue(left), getValue(right)))

export const sortByStablePriorityCode = (values: readonly PreferencePriority[]): PreferencePriority[] =>
  values.slice().sort((left, right) => RECOMMENDATION_PRIORITY_CODES.indexOf(left) - RECOMMENDATION_PRIORITY_CODES.indexOf(right))

export const isPriorityCode = (value: unknown): value is PreferencePriority =>
  typeof value === 'string' && RECOMMENDATION_PRIORITY_CODES.indexOf(value as PreferencePriority) >= 0

export const isMatchingFieldPath = (value: unknown): value is InstitutionMatchingCriticalFieldPath =>
  typeof value === 'string'
    && RECOMMENDATION_MATCHING_FIELD_PATHS.indexOf(value as InstitutionMatchingCriticalFieldPath) >= 0

export const hasUniqueStrings = (values: readonly string[]): boolean =>
  values.every((value, index) => values.indexOf(value) === index)

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Detach already-validated JSON-domain snapshots from caller-owned inputs. */
export const copyDomainData = <T>(value: T): T => {
  if (Array.isArray(value)) return (value as readonly unknown[]).map((item) => copyDomainData(item)) as unknown as T
  if (isPlainRecord(value)) {
    const copy: Record<string, unknown> = {}
    Object.keys(value).forEach((key) => { copy[key] = copyDomainData(value[key]) })
    return copy as T
  }
  return value
}

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)

export const isObjectValue = (value: unknown, key: string): value is Record<string, unknown> =>
  isPlainRecord(value) && key in value
