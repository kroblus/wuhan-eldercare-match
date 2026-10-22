import type {
  AdlRulesetVersionV2,
  ElderProfileContractVersionV2,
  ElderProfileDerivationRulesetVersionV2,
  ElderProfileSummarySchemaVersionV2,
} from '../../../types/elder-profile-v2'

export const PROFILE_CONTRACT_VERSION_V2: ElderProfileContractVersionV2 = 'elder-profile-contract-v2'
export const PROFILE_DERIVATION_RULESET_VERSION_V2: ElderProfileDerivationRulesetVersionV2 = 'elder-profile-ruleset-v2'
export const PROFILE_SUMMARY_SCHEMA_VERSION_V2: ElderProfileSummarySchemaVersionV2 = 'elder-profile-summary-input-v2'
export const ADL_RULESET_VERSION_V2: AdlRulesetVersionV2 = 'adl-ruleset-v1'

export const MEAL_TEXTURE_MATCHING_ROLE_V2 = 'DISPLAY_EXPLAINABLE_V1_1' as const
export const PREVIEW_PERSISTENCE_POLICY_V2 = 'FORBIDDEN' as const

export const HIGH_CARE_BUDGET_CAPABILITY_ORDER_V2 = [
  'round_the_clock_care',
  'one_to_one_caregiver',
  'tube_feeding',
  'pressure_injury_care',
] as const

export const V2_PROFILE_RULE_IDS = {
  nutritionFoodTexture: 'elder-profile-ruleset-v2:NUTRITION_FOOD_TEXTURE',
  nutritionSwallowingConcern: 'elder-profile-ruleset-v2:NUTRITION_SWALLOWING_CONCERN',
  preferenceFact: 'elder-profile-ruleset-v2:PREFERENCE_FACT',
  highCareLowBudgetAdvisory: 'elder-profile-ruleset-v2:HIGH_CARE_LOW_BUDGET_ADVISORY',
} as const
