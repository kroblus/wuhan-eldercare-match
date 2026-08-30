import type { AdlRequiredQuestionId } from '../../types/assessment'
import type {
  AdlCareLevel,
  AdlCareModeCode,
  CareCapabilityCode,
  DerivationRuleId,
} from '../../types/elder-profile'

/** Frozen versions owned by the contract, kept in one runtime module. */
export const PROFILE_CONTRACT_VERSION = 'elder-profile-contract-v1' as const
export const PROFILE_DERIVATION_RULESET_VERSION = 'elder-profile-ruleset-v1' as const
export const ADL_RULESET_VERSION = 'adl-ruleset-v1' as const
export const SUMMARY_SCHEMA_VERSION = 'elder-profile-summary-input-v1' as const

export const ADL_QUESTION_ORDER: readonly AdlRequiredQuestionId[] = [
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.bathing',
  'adl.dressing',
  'adl.transfer',
  'adl.stairs',
]

export const CARE_CAPABILITY_ORDER: readonly CareCapabilityCode[] = [
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

export const ADL_CARE_MODE_ORDER: readonly AdlCareModeCode[] = [
  'feeding_minor',
  'feeding_dependence',
  'special_feeding_review',
  'walking_aid',
  'wheelchair',
  'bedridden',
  'toileting_minor',
  'incontinence',
  'toileting_full_assistance',
  'catheter_or_stoma_review',
  'bathing_partial',
  'bathing_full_assistance',
  'dressing_partial',
  'dressing_full_assistance',
  'transfer_minor',
  'transfer_support',
  'fully_dependent_transfer',
  'stairs_assistance',
  'stairs_unable',
  'no_stairs_context',
]

export const ADL_CORE_QUESTION_IDS: readonly AdlRequiredQuestionId[] = [
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.transfer',
]

/** Named Proposal C thresholds; keep classification boundaries auditable. */
export const ADL_REQUIRED_HALF_COUNT_FOR_ESCALATION = 2 as const
export const ADL_SINGLE_HALF_COUNT = 1 as const
export const ADL_REQUIRED_LIGHT_COUNT_FOR_ESCALATION = 2 as const
export const ADL_SINGLE_LIGHT_COUNT = 1 as const

export type AdlCareLevelRuleId =
  | 'C_UNKNOWN_BLOCK'
  | 'C_SEVERE_OVERRIDE'
  | 'C_DEPENDENT_FLOOR'
  | 'C_TWO_HALF_ESCALATION'
  | 'C_NON_CORE_HALF_FALLBACK'
  | 'C_HALF_FLOOR'
  | 'C_TWO_LIGHT_ESCALATION'
  | 'C_NO_BURDEN'
  | 'C_PROJECT_CARE_MODE'
  | 'C_NO_STAIRS_NEUTRAL'

export const adlRuleId = (rule: AdlCareLevelRuleId): DerivationRuleId =>
  `adl-ruleset-v1:${rule}` as DerivationRuleId

export const derivedRuleId = (rule: 'MOBILITY_DIRECT' | 'REHABILITATION' | 'COGNITIVE_CONCERN' | 'REPORTED_DIAGNOSIS' | 'WANDERING_RISK' | 'BEHAVIORAL_RISK' | 'SLEEP_CYCLE' | 'CARE_CAPABILITY'): DerivationRuleId =>
  `elder-profile-ruleset-v1:${rule}` as DerivationRuleId

export const adlCareLevelOrder: readonly AdlCareLevel[] = [
  'independent',
  'light_care',
  'semi_disabled',
  'disabled',
  'severely_disabled',
]
