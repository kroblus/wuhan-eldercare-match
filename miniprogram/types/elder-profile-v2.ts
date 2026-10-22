import type {
  ActivityPreference,
  AssessmentAnswerSnapshotV2,
  AssessmentAnswerValueMapV2,
  AssessmentQuestionIdV2,
  AssessmentSchemaVersionV2,
  ChewingAbility,
  MealSchedule,
  PreferencePriorityV2,
  RoomType,
  SwallowingAbility,
} from './assessment-v2'
import type {
  AdlProfileDerivedFacts,
  AdlProfileRawAnswers,
  AssessmentEvidenceSource,
  BasicProfileRawFacts,
  CognitionProfileDerivedFacts,
  CognitionProfileRawFacts,
  DerivationEvidence,
  DerivedFact,
  ElderProfileDerivedField,
  FinancialProfileRawFacts,
  HealthProfileDerivedFacts,
  HealthProfileRawFacts,
  IntentProfileRawFacts,
  MobilityProfileDerivedFacts,
  ProfileClarification,
  ProfileSummaryCode,
  ProfileSummarySource,
  SpecialCareProfileDerivedFacts,
  SpecialCareProfileRawFacts,
} from './elder-profile'
import type { PreferenceRegionAnswer } from './assessment'

export type ElderProfileContractVersionV2 = 'elder-profile-contract-v2'
export type ElderProfileDerivationRulesetVersionV2 = 'elder-profile-ruleset-v2'
export type ElderProfileSummarySchemaVersionV2 = 'elder-profile-summary-input-v2'
export type AdlRulesetVersionV2 = 'adl-ruleset-v1'

export type AssessmentAnswerOfV2<Q extends AssessmentQuestionIdV2> = AssessmentAnswerValueMapV2[Q]

export interface ElderProfileIdentityV2 {
  elderId: string
  assessmentId: string
  assessmentSchemaVersion: AssessmentSchemaVersionV2
  assessmentCompletedAt: string
  profileContractVersion: ElderProfileContractVersionV2
  derivationRulesetVersion: ElderProfileDerivationRulesetVersionV2
}

export interface NutritionProfileRawFactsV2 {
  chewingAbilityAnswer: ChewingAbility
  swallowingAbilityAnswer: SwallowingAbility
}

export type FoodTextureSupportV2 = 'standard' | 'easy_chew' | 'modified_food'
export type SwallowingConcernV2 = 'normal' | 'occasional_difficulty' | 'significant_difficulty'

export interface NutritionProfileDerivedFactsV2 {
  foodTextureSupport: DerivedFact<FoodTextureSupportV2>
  swallowingConcern: DerivedFact<SwallowingConcernV2>
}

export interface PreferenceProfileRawFactsV2 {
  preferredInstitutionType: AssessmentAnswerOfV2<'preference.careType'>
  roomTypePreference: RoomType
  mealSchedulePreference: MealSchedule
  activityPreference: ActivityPreference
  priorities: readonly PreferencePriorityV2[]
  regionPreference?: PreferenceRegionAnswer
}

export type BudgetAdvisoryCodeV2 = 'HIGH_CARE_LOW_BUDGET'
export type BudgetAdvisoryTriggerCodeV2 =
  | 'care_level.disabled'
  | 'care_level.severely_disabled'
  | 'special_care.round_the_clock_care'
  | 'special_care.one_to_one_caregiver'
  | 'special_care.tube_feeding'
  | 'special_care.pressure_injury_care'

export interface BudgetAdvisoryV2 {
  code: BudgetAdvisoryCodeV2
  role: 'advisory_only'
  status: 'present'
  triggerCodes: readonly [BudgetAdvisoryTriggerCodeV2, ...BudgetAdvisoryTriggerCodeV2[]]
  triggerEvidenceIds: readonly [string, ...string[]]
  evidenceIds: readonly [string, ...string[]]
}

export interface FinancialProfileDerivedFactsV2 {
  budgetAdvisories: readonly BudgetAdvisoryV2[]
}

export type ElderProfileDerivedFieldExtensionV2 =
  | 'nutrition.foodTextureSupport'
  | 'nutrition.swallowingConcern'
  | 'preference.roomTypePreference'
  | 'preference.mealSchedulePreference'
  | 'preference.activityPreference'
  | 'preference.priorities'
  | 'financial.budgetAdvisory.highCareLowBudget'

export type ElderProfileDerivedFieldV2 = ElderProfileDerivedField | ElderProfileDerivedFieldExtensionV2

export type ElderProfileRuleCodeV2 =
  | 'NUTRITION_FOOD_TEXTURE'
  | 'NUTRITION_SWALLOWING_CONCERN'
  | 'PREFERENCE_FACT'
  | 'HIGH_CARE_LOW_BUDGET_ADVISORY'

export type DerivationRuleIdExtensionV2 = `elder-profile-ruleset-v2:${ElderProfileRuleCodeV2}`

export type CodedAssessmentQuestionIdV2 = Exclude<
  AssessmentQuestionIdV2,
  'basic.elderName' | 'basic.age' | 'preference.region'
>

export type AssessmentMultiChoiceQuestionIdV2 =
  | 'basic.institutionExitReasons'
  | 'health.conditions'
  | 'health.recentEvents'
  | 'cognitive.symptoms'
  | 'cognitive.specialCareNeeds'
  | 'preference.priorities'

export type AssessmentOptionCodeV2<Q extends CodedAssessmentQuestionIdV2> =
  AssessmentAnswerValueMapV2[Q] extends readonly (infer Item)[]
    ? Extract<Item, string>
    : Extract<AssessmentAnswerValueMapV2[Q], string>

export type EvidenceContributionV2 =
  | 'supports'
  | 'overrides'
  | 'context'
  | 'limits_confidence'
  | 'excluded_not_applicable'
  | 'requires_clarification'
  | 'establishes_not_reported'

export type AssessmentOptionEvidenceSourceV2 = {
  [Q in CodedAssessmentQuestionIdV2]: {
    sourceKind: 'assessment_option'
    sourceQuestionId: Q
    sourceOptionCode: AssessmentOptionCodeV2<Q>
    contribution: Exclude<EvidenceContributionV2, 'establishes_not_reported'>
  }
}[CodedAssessmentQuestionIdV2]

export type AssessmentAnswerSetEvidenceSourceV2 = {
  [Q in AssessmentMultiChoiceQuestionIdV2]: {
    sourceKind: 'assessment_answer_set'
    sourceQuestionId: Q
    sourceOptionCodes: readonly AssessmentOptionCodeV2<Q>[]
    targetOptionCode: AssessmentOptionCodeV2<Q>
    contribution: 'establishes_not_reported'
  }
}[AssessmentMultiChoiceQuestionIdV2]

export type AssessmentEvidenceSourceV2 =
  | AssessmentEvidenceSource
  | AssessmentOptionEvidenceSourceV2
  | AssessmentAnswerSetEvidenceSourceV2

export type DerivationEvidenceOutcomeCodeExtensionV2 =
  | FoodTextureSupportV2
  | SwallowingConcernV2
  | RoomType
  | MealSchedule
  | ActivityPreference
  | 'reported'
  | 'present'
  | 'unknown'
  | 'needs_confirmation'

export interface DerivationEvidenceExtensionV2 {
  evidenceId: `ev:${ElderProfileDerivedFieldExtensionV2}`
  derivedField: ElderProfileDerivedFieldExtensionV2
  outcomeCode: DerivationEvidenceOutcomeCodeExtensionV2
  ruleId: DerivationRuleIdExtensionV2
  sources: readonly [AssessmentEvidenceSourceV2, ...AssessmentEvidenceSourceV2[]]
}

export type DerivationEvidenceV2 = DerivationEvidence | DerivationEvidenceExtensionV2

export interface ProfileClarificationExtensionV2 {
  clarificationId: `cl:${'unknown_answer' | 'risk_signal_needs_confirmation'}:${string}`
  status: 'open'
  reasonCode: 'unknown_answer' | 'risk_signal_needs_confirmation'
  priority: 'required_before_hard_filter'
  sources: readonly [AssessmentEvidenceSourceV2, ...AssessmentEvidenceSourceV2[]]
  affectedDerivedFields: readonly [ElderProfileDerivedFieldExtensionV2, ...ElderProfileDerivedFieldExtensionV2[]]
}

export type ProfileClarificationV2 = ProfileClarification | ProfileClarificationExtensionV2

export type NutritionProfileSummaryCodeV2 =
  | 'nutrition.chewing_ability'
  | 'nutrition.swallowing_ability'
  | 'nutrition.food_texture_support'
  | 'nutrition.swallowing_concern'

export type PreferenceProfileSummaryCodeV2 =
  | 'preference.care_type'
  | 'preference.room_type'
  | 'preference.meal_schedule'
  | 'preference.activity_preference'
  | 'preference.priorities'
  | 'preference.region'

export type FinancialIntentProfileSummaryCodeV2 =
  | 'financial.monthly_budget'
  | 'financial.deposit_tolerance'
  | 'financial.budget_advisory.high_care_low_budget'
  | 'intent.move_in_timing'
  | 'intent.consultant_support'

export type ProfileSummaryCodeV2 =
  | ProfileSummaryCode
  | NutritionProfileSummaryCodeV2
  | PreferenceProfileSummaryCodeV2
  | FinancialIntentProfileSummaryCodeV2

export type ProfileSummarySectionCodeV2 =
  | 'basic'
  | 'health'
  | 'nutrition'
  | 'adl'
  | 'mobility'
  | 'cognition'
  | 'special_care'
  | 'preference'
  | 'financial_intent'

export type ProfileSummarySourceExtensionV2 =
  | {
    kind: 'raw_fact'
    sourceQuestionId: AssessmentQuestionIdV2
  }
  | {
    kind: 'derived_fact'
    derivedField: ElderProfileDerivedFieldExtensionV2
    evidenceIds: readonly [string, ...string[]]
  }

export type ProfileSummarySourceV2 = ProfileSummarySource | ProfileSummarySourceExtensionV2

export interface ProfileSummaryItemV2<C extends ProfileSummaryCodeV2 = ProfileSummaryCodeV2> {
  summaryCode: C
  sources: readonly [ProfileSummarySourceV2, ...ProfileSummarySourceV2[]]
}

export interface ProfileSummarySectionV2<
  S extends ProfileSummarySectionCodeV2 = ProfileSummarySectionCodeV2,
  C extends ProfileSummaryCodeV2 = ProfileSummaryCodeV2
> {
  section: S
  items: readonly ProfileSummaryItemV2<C>[]
}

export interface ElderProfileUserFacingSummaryV2 {
  summarySchemaVersion: ElderProfileSummarySchemaVersionV2
  sections: readonly [
    ProfileSummarySectionV2<'basic'>,
    ProfileSummarySectionV2<'health'>,
    ProfileSummarySectionV2<'nutrition', NutritionProfileSummaryCodeV2>,
    ProfileSummarySectionV2<'adl'>,
    ProfileSummarySectionV2<'mobility'>,
    ProfileSummarySectionV2<'cognition'>,
    ProfileSummarySectionV2<'special_care'>,
    ProfileSummarySectionV2<'preference', PreferenceProfileSummaryCodeV2>,
    ProfileSummarySectionV2<'financial_intent', FinancialIntentProfileSummaryCodeV2>
  ]
}

export interface ElderProfileSemanticPayloadV2 {
  basic: {
    rawFacts: BasicProfileRawFacts
  }
  health: {
    rawFacts: HealthProfileRawFacts
    derivedFacts: HealthProfileDerivedFacts
  }
  nutrition: {
    rawFacts: NutritionProfileRawFactsV2
    derivedFacts: NutritionProfileDerivedFactsV2
  }
  adl: {
    rawAnswers: AdlProfileRawAnswers
    derivedFacts: AdlProfileDerivedFacts
  }
  mobility: {
    derivedFacts: MobilityProfileDerivedFacts
  }
  cognition: {
    rawFacts: CognitionProfileRawFacts
    derivedFacts: CognitionProfileDerivedFacts
  }
  specialCare: {
    rawFacts: SpecialCareProfileRawFacts
    derivedFacts: SpecialCareProfileDerivedFacts
  }
  preference: {
    rawFacts: PreferenceProfileRawFactsV2
  }
  financial: {
    rawFacts: FinancialProfileRawFacts
    derivedFacts: FinancialProfileDerivedFactsV2
  }
  intent: {
    rawFacts: IntentProfileRawFacts
  }
  userFacingSummary: ElderProfileUserFacingSummaryV2
  evidence: readonly DerivationEvidenceV2[]
  clarifications: readonly ProfileClarificationV2[]
}

export interface ElderProfileV2 extends ElderProfileSemanticPayloadV2 {
  kind: 'elder_profile'
  identity: ElderProfileIdentityV2
}

export interface ElderProfilePreviewSourceV2 {
  kind: 'local_assessment_preview'
  localDraftId: string
  assessmentSchemaVersion: AssessmentSchemaVersionV2
}

export interface ElderProfilePreviewV2 extends ElderProfileSemanticPayloadV2 {
  kind: 'elder_profile_preview'
  source: ElderProfilePreviewSourceV2
  profileContractVersion: ElderProfileContractVersionV2
  derivationRulesetVersion: ElderProfileDerivationRulesetVersionV2
}

export type ElderProfileDerivationErrorCodeV2 =
  | 'NOT_COMPLETED_ASSESSMENT'
  | 'UNSUPPORTED_ASSESSMENT_SCHEMA'
  | 'INVALID_COMPLETED_AT_TIMESTAMP'
  | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
  | 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE'

export type ElderProfilePreviewDerivationErrorCodeV2 =
  | 'INVALID_DRAFT_STRUCTURE'
  | 'UNSUPPORTED_ASSESSMENT_SCHEMA'
  | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'

export type ElderProfileDerivationResultV2 =
  | { ok: true, profile: ElderProfileV2 }
  | {
    ok: false
    error: {
      code: ElderProfileDerivationErrorCodeV2
      questionIds: readonly AssessmentQuestionIdV2[]
    }
  }

export type ElderProfilePreviewDerivationResultV2 =
  | { ok: true, preview: ElderProfilePreviewV2 }
  | {
    ok: false
    error: {
      code: ElderProfilePreviewDerivationErrorCodeV2
      questionIds: readonly AssessmentQuestionIdV2[]
    }
  }

/** Internal semantic core input; exported only as a named type for sibling modules. */
export type ElderProfileSemanticInputV2 = AssessmentAnswerSnapshotV2
