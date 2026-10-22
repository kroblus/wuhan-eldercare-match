import type { PreferencePriorityV2 } from '../../../types/assessment-v2'
import type {
  RecommendationDifferenceCodeV2,
  RecommendationReasonCodeV2,
} from '../../../types/recommendation-v2'

export const RECOMMENDATION_PRIORITY_CODES_V2: readonly PreferencePriorityV2[] = [
  'care_capability',
  'caregiver_quality',
  'medical_conditions',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'room_facilities',
  'activity_space',
  'transportation',
  'near_major_hospital',
  'price',
  'region',
]

export const STRUCTURED_SCORABLE_PRIORITY_CODES_V2: readonly PreferencePriorityV2[] = [
  'rehabilitation_capability',
  'price',
  'region',
]

export const RECOMMENDATION_REASON_CODES_V2: readonly RecommendationReasonCodeV2[] = [
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
  'ROOM_TYPE_MATCH',
  'MEAL_SCHEDULE_MATCH',
  'EASY_CHEW_SUPPORT',
  'MODIFIED_FOOD_SUPPORT',
]

export const RECOMMENDATION_DIFFERENCE_CODES_V2: readonly RecommendationDifferenceCodeV2[] = [
  'HARD_CAPABILITY_UNSUPPORTED',
  'CAPABILITY_REQUIRES_ASSESSMENT',
  'CAPABILITY_NOT_VERIFIED',
  'ELDER_REQUIREMENT_NEEDS_CONFIRMATION',
  'BUDGET_PARTIAL_OVERLAP',
  'BUDGET_ABOVE_RANGE',
  'BUDGET_BELOW_DECLARED_RANGE',
  'BUDGET_UNKNOWN',
  'PRICE_UPPER_BOUND_UNKNOWN',
  'REGION_DIFFERENT',
  'REGION_UNKNOWN',
  'TYPE_DIFFERENT',
  'TYPE_UNKNOWN',
  'PRIORITY_NOT_MET',
  'PRIORITY_UNVERIFIED',
  'PRIORITY_NOT_SCORABLE',
  'REHABILITATION_SOFT_DATA_GAP',
  'ROOM_TYPE_MISMATCH',
  'ROOM_TYPE_UNKNOWN',
  'MEAL_SCHEDULE_MISMATCH',
  'MEAL_SCHEDULE_DATA_UNAVAILABLE',
  'MEAL_SCHEDULE_UNKNOWN',
  'EASY_CHEW_SUPPORT_UNAVAILABLE',
  'EASY_CHEW_SUPPORT_REQUIRES_INQUIRY',
  'EASY_CHEW_SUPPORT_UNKNOWN',
  'MODIFIED_FOOD_SUPPORT_UNAVAILABLE',
  'MODIFIED_FOOD_SUPPORT_REQUIRES_INQUIRY',
  'MODIFIED_FOOD_SUPPORT_UNKNOWN',
]

export const compareAsciiV2 = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export const sortAsciiV2 = <T>(values: readonly T[], getValue: (value: T) => string): T[] =>
  values.slice().sort((left, right) => compareAsciiV2(getValue(left), getValue(right)))

export const sortPrioritiesV2 = (
  values: readonly PreferencePriorityV2[],
): PreferencePriorityV2[] => values.slice().sort((left, right) =>
  RECOMMENDATION_PRIORITY_CODES_V2.indexOf(left) - RECOMMENDATION_PRIORITY_CODES_V2.indexOf(right))

export const isPriorityCodeV2 = (value: unknown): value is PreferencePriorityV2 =>
  typeof value === 'string'
  && RECOMMENDATION_PRIORITY_CODES_V2.indexOf(value as PreferencePriorityV2) >= 0

export const isPlainRecordV2 = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isNonEmptyStringV2 = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const hasUniqueStringsV2 = (values: readonly string[]): boolean =>
  values.every((value, index) => values.indexOf(value) === index)

export const copyDomainDataV2 = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    ;(value as unknown as readonly unknown[]).forEach((item: unknown) => {
      copy.push(copyDomainDataV2(item))
    })
    return copy as unknown as T
  }
  if (isPlainRecordV2(value)) {
    const copy: Record<string, unknown> = {}
    Object.keys(value).forEach((key) => {
      copy[key] = copyDomainDataV2(value[key])
    })
    return copy as T
  }
  return value
}

export const hasExactKeysV2 = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort()
  const expected = keys.slice().sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}
