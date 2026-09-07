import type {
  AdlAssistance,
  AdlEating,
  AdlMobility,
  AdlStairs,
  AdlToileting,
  AdlTransfer,
  AssessmentStepId,
  BasicGender,
  BasicInstitutionExperience,
  BasicInstitutionExitReason,
  BasicLivingStatus,
  BasicPrimaryCaregiver,
  BasicRelationship,
  CognitiveSpecialCareNeed,
  CognitiveSymptom,
  HealthCondition,
  HealthRecentEvent,
  InstitutionRegionAnswer,
  MonthlyRange,
  PreferenceRegionAnswer,
  PreferredCareType,
  RehabilitationNeed,
  UpfrontCostAcceptance,
  MoveInTiming,
  ConsultantSupport,
  AssessmentDraft,
  CompletedAssessment,
} from './assessment'

export const ASSESSMENT_SCHEMA_VERSION_V2 = 2 as const
export const LOCAL_ASSESSMENT_PERSISTENCE_V2 = 'LOCAL_DEVICE_DEVELOPMENT_ONLY' as const

export type AssessmentSchemaVersionV2 = typeof ASSESSMENT_SCHEMA_VERSION_V2
export type AssessmentPersistenceV2 = typeof LOCAL_ASSESSMENT_PERSISTENCE_V2
export type AssessmentStepIdV2 = AssessmentStepId

export type AssessmentQuestionIdV2 =
  | 'basic.relationship'
  | 'basic.elderName'
  | 'basic.gender'
  | 'basic.age'
  | 'basic.livingStatus'
  | 'basic.primaryCaregiver'
  | 'basic.hasInstitutionExperience'
  | 'basic.institutionExitReasons'
  | 'health.conditions'
  | 'health.recentEvents'
  | 'health.rehabilitationNeed'
  | 'health.chewingAbility'
  | 'health.swallowingAbility'
  | 'adl.eating'
  | 'adl.mobility'
  | 'adl.toileting'
  | 'adl.bathing'
  | 'adl.dressing'
  | 'adl.transfer'
  | 'adl.stairs'
  | 'cognitive.symptoms'
  | 'cognitive.specialCareNeeds'
  | 'preference.careType'
  | 'preference.roomType'
  | 'preference.mealSchedule'
  | 'preference.activityPreference'
  | 'preference.priorities'
  | 'preference.region'
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

export type BasicRelationshipV2 = BasicRelationship
export type BasicGenderV2 = BasicGender
export type BasicLivingStatusV2 = BasicLivingStatus
export type BasicPrimaryCaregiverV2 = BasicPrimaryCaregiver
export type BasicInstitutionExperienceV2 = BasicInstitutionExperience
export type BasicInstitutionExitReasonV2 = BasicInstitutionExitReason
export type HealthConditionV2 = HealthCondition
export type HealthRecentEventV2 = HealthRecentEvent
export type RehabilitationNeedV2 = RehabilitationNeed
export type AdlEatingV2 = AdlEating
export type AdlMobilityV2 = AdlMobility
export type AdlToiletingV2 = AdlToileting
export type AdlAssistanceV2 = AdlAssistance
export type AdlTransferV2 = AdlTransfer
export type AdlStairsV2 = AdlStairs
export type CognitiveSymptomV2 = CognitiveSymptom
export type CognitiveSpecialCareNeedV2 = CognitiveSpecialCareNeed
export type PreferredCareTypeV2 = PreferredCareType
export type PreferenceRegionAnswerV2 = PreferenceRegionAnswer | InstitutionRegionAnswer
export type MonthlyRangeV2 = MonthlyRange
export type UpfrontCostAcceptanceV2 = UpfrontCostAcceptance
export type MoveInTimingV2 = MoveInTiming
export type ConsultantSupportV2 = ConsultantSupport

export type ChewingAbility = 'normal' | 'easy_chew' | 'modified_food' | 'unknown'
export type SwallowingAbility = 'normal' | 'occasional_difficulty' | 'significant_difficulty' | 'unknown'
export type RoomType = 'no_preference' | 'single' | 'double' | 'triple_or_more'
export type MealSchedule = 'no_preference' | 'three_meals' | 'three_meals_one_snack' | 'three_meals_two_snacks'
export type ActivityPreference = 'no_preference' | 'indoor' | 'outdoor' | 'indoor_and_outdoor'

export type PreferencePriorityV2 =
  | 'care_capability'
  | 'caregiver_quality'
  | 'medical_conditions'
  | 'rehabilitation_capability'
  | 'food_quality'
  | 'living_environment'
  | 'room_facilities'
  | 'activity_space'
  | 'transportation'
  | 'near_major_hospital'
  | 'price'
  | 'region'

export const V2_SAFE_PRIORITY_CODES: readonly PreferencePriorityV2[] = [
  'medical_conditions',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'transportation',
  'price',
]

export type PreferencePriorityV1 =
  | 'medical_conditions'
  | 'nursing_professionalism'
  | 'caregiver_attitude'
  | 'rehabilitation_capability'
  | 'food_quality'
  | 'living_environment'
  | 'overall_quality'
  | 'recreational_activities'
  | 'close_to_family'
  | 'transportation'
  | 'price'
  | 'dementia_care'

export const V1_AMBIGUOUS_PRIORITY_CODES: readonly Exclude<PreferencePriorityV1, 'medical_conditions' | 'rehabilitation_capability' | 'food_quality' | 'living_environment' | 'transportation' | 'price'>[] = [
  'nursing_professionalism',
  'caregiver_attitude',
  'overall_quality',
  'recreational_activities',
  'close_to_family',
  'dementia_care',
]

export interface AssessmentAnswerValueMapV2 {
  'basic.relationship': BasicRelationshipV2
  'basic.elderName': string
  'basic.gender': BasicGenderV2
  'basic.age': number
  'basic.livingStatus': BasicLivingStatusV2
  'basic.primaryCaregiver': BasicPrimaryCaregiverV2
  'basic.hasInstitutionExperience': BasicInstitutionExperienceV2
  'basic.institutionExitReasons': BasicInstitutionExitReasonV2[]
  'health.conditions': HealthConditionV2[]
  'health.recentEvents': HealthRecentEventV2[]
  'health.rehabilitationNeed': RehabilitationNeedV2
  'health.chewingAbility': ChewingAbility
  'health.swallowingAbility': SwallowingAbility
  'adl.eating': AdlEatingV2
  'adl.mobility': AdlMobilityV2
  'adl.toileting': AdlToiletingV2
  'adl.bathing': AdlAssistanceV2
  'adl.dressing': AdlAssistanceV2
  'adl.transfer': AdlTransferV2
  'adl.stairs': AdlStairsV2
  'cognitive.symptoms': CognitiveSymptomV2[]
  'cognitive.specialCareNeeds': CognitiveSpecialCareNeedV2[]
  'preference.careType': PreferredCareTypeV2
  'preference.roomType': RoomType
  'preference.mealSchedule': MealSchedule
  'preference.activityPreference': ActivityPreference
  'preference.priorities': PreferencePriorityV2[]
  'preference.region': PreferenceRegionAnswerV2
  'budget.monthlyRange': MonthlyRangeV2
  'budget.upfrontCostAcceptance': UpfrontCostAcceptanceV2
  'budget.moveInTiming': MoveInTimingV2
  'budget.consultantSupport': ConsultantSupportV2
}

export type AssessmentDraftAnswersV2 = Partial<AssessmentAnswerValueMapV2>

export interface AssessmentMigrationNoticeV2 {
  originalQuestionId: 'preference.priorities'
  originalOptionCodes: readonly PreferencePriorityV1[]
  sourceSchemaVersion: 1
  targetSchemaVersion: 2
  reasonCode: 'PRIORITIES_REQUIRE_RESELECTION_V2'
}

export interface AssessmentDraftV2 {
  kind: 'assessment_draft'
  schemaVersion: AssessmentSchemaVersionV2
  localDraftId: string
  persistence: AssessmentPersistenceV2
  currentStep: AssessmentStepIdV2
  answers: AssessmentDraftAnswersV2
  startedAt: string
  updatedAt: string
  migrationNotice?: AssessmentMigrationNoticeV2
}

/** Explicit versioned boundaries; the historical V1 shapes remain unchanged. */
export type AssessmentDraftV1 = AssessmentDraft
export type CompletedAssessmentV1 = CompletedAssessment
export type AssessmentDraftBySchema = AssessmentDraftV1 | AssessmentDraftV2

export type RequiredAssessmentQuestionIdV2 =
  | 'basic.relationship'
  | 'basic.gender'
  | 'basic.age'
  | 'health.conditions'
  | 'health.recentEvents'
  | 'health.rehabilitationNeed'
  | 'health.chewingAbility'
  | 'health.swallowingAbility'
  | 'adl.eating'
  | 'adl.mobility'
  | 'adl.toileting'
  | 'adl.bathing'
  | 'adl.dressing'
  | 'adl.transfer'
  | 'adl.stairs'
  | 'cognitive.symptoms'
  | 'cognitive.specialCareNeeds'
  | 'preference.careType'
  | 'preference.roomType'
  | 'preference.mealSchedule'
  | 'preference.activityPreference'
  | 'preference.priorities'
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

export const REQUIRED_ASSESSMENT_QUESTION_ORDER_V2: readonly RequiredAssessmentQuestionIdV2[] = [
  'basic.relationship',
  'basic.gender',
  'basic.age',
  'health.conditions',
  'health.recentEvents',
  'health.rehabilitationNeed',
  'health.chewingAbility',
  'health.swallowingAbility',
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.bathing',
  'adl.dressing',
  'adl.transfer',
  'adl.stairs',
  'cognitive.symptoms',
  'cognitive.specialCareNeeds',
  'preference.careType',
  'preference.roomType',
  'preference.mealSchedule',
  'preference.activityPreference',
  'preference.priorities',
  'budget.monthlyRange',
  'budget.upfrontCostAcceptance',
  'budget.moveInTiming',
  'budget.consultantSupport',
]

export type ConditionalOptionalAssessmentQuestionIdV2 = 'basic.institutionExitReasons'

export type OptionalAssessmentQuestionIdV2 = Exclude<
  AssessmentQuestionIdV2,
  RequiredAssessmentQuestionIdV2 | ConditionalOptionalAssessmentQuestionIdV2
>

export const OPTIONAL_ASSESSMENT_QUESTION_IDS_V2: readonly OptionalAssessmentQuestionIdV2[] = [
  'basic.elderName',
  'basic.livingStatus',
  'basic.primaryCaregiver',
  'basic.hasInstitutionExperience',
  'preference.region',
]

export const CONDITIONAL_OPTIONAL_ASSESSMENT_QUESTION_IDS_V2: readonly ConditionalOptionalAssessmentQuestionIdV2[] = [
  'basic.institutionExitReasons',
]

export type RequiredAssessmentAnswerSnapshotV2 = {
  [K in RequiredAssessmentQuestionIdV2]: AssessmentAnswerValueMapV2[K]
}

export type AssessmentAnswerSnapshotV2 = RequiredAssessmentAnswerSnapshotV2
  & Partial<Pick<
    AssessmentAnswerValueMapV2,
    OptionalAssessmentQuestionIdV2 | ConditionalOptionalAssessmentQuestionIdV2
  >>

export interface CompletedAssessmentV2 {
  kind: 'completed_assessment'
  id: string
  elderId: string
  status: 'completed'
  schemaVersion: AssessmentSchemaVersionV2
  answers: AssessmentAnswerSnapshotV2
  completedAt: string
}

export type CompletedAssessmentBySchema = CompletedAssessmentV1 | CompletedAssessmentV2

export type AssessmentQuestionTypeV2 =
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'integer'
  | 'dynamic_single_choice'

export interface AssessmentQuestionDefinitionV2 {
  id: AssessmentQuestionIdV2
  step: AssessmentStepIdV2
  type: AssessmentQuestionTypeV2
  required: boolean
  allowUnknown?: boolean
  allowedValues?: readonly string[]
  maxSelections?: number
  min?: number
  max?: number
  condition?: {
    questionId: AssessmentQuestionIdV2
    equals: string
  }
}

const values = <T extends readonly string[]>(items: T): T => items

export const ASSESSMENT_QUESTION_DEFINITIONS_V2: Record<AssessmentQuestionIdV2, AssessmentQuestionDefinitionV2> = {
  'basic.relationship': { id: 'basic.relationship', step: 'basic', type: 'single_choice', required: true, allowedValues: values(['father', 'mother', 'paternal_grandfather', 'paternal_grandmother', 'maternal_grandfather', 'maternal_grandmother', 'spouse', 'self', 'other'] as const) },
  'basic.elderName': { id: 'basic.elderName', step: 'basic', type: 'text', required: false },
  'basic.gender': { id: 'basic.gender', step: 'basic', type: 'single_choice', required: true, allowedValues: values(['male', 'female'] as const) },
  'basic.age': { id: 'basic.age', step: 'basic', type: 'integer', required: true, min: 50, max: 110 },
  'basic.livingStatus': { id: 'basic.livingStatus', step: 'basic', type: 'single_choice', required: false, allowedValues: values(['alone', 'with_spouse', 'with_children', 'with_other_relatives', 'hospitalized', 'in_eldercare_institution', 'other'] as const) },
  'basic.primaryCaregiver': { id: 'basic.primaryCaregiver', step: 'basic', type: 'single_choice', required: false, allowedValues: values(['spouse', 'children', 'nanny', 'care_worker', 'community_care', 'no_fixed_caregiver', 'other'] as const) },
  'basic.hasInstitutionExperience': { id: 'basic.hasInstitutionExperience', step: 'basic', type: 'single_choice', required: false, allowedValues: values(['true', 'false'] as const) },
  'basic.institutionExitReasons': { id: 'basic.institutionExitReasons', step: 'basic', type: 'multi_choice', required: false, allowedValues: values(['poor_nursing', 'poor_service_attitude', 'high_cost', 'too_far', 'insufficient_medical_capability', 'unsatisfactory_environment', 'unsatisfactory_food', 'elder_not_adapted', 'other'] as const), condition: { questionId: 'basic.hasInstitutionExperience', equals: 'true' } },
  'health.conditions': { id: 'health.conditions', step: 'health', type: 'multi_choice', required: true, allowUnknown: true, allowedValues: values(['hypertension', 'diabetes', 'coronary_heart_disease', 'stroke_sequelae', 'parkinson_disease', 'alzheimers_disease', 'other_cognitive_impairment', 'chronic_respiratory_disease', 'osteoarticular_disease', 'tumor', 'other_chronic_disease', 'none', 'unknown'] as const) },
  'health.recentEvents': { id: 'health.recentEvents', step: 'health', type: 'multi_choice', required: true, allowUnknown: true, allowedValues: values(['fall_within_6_months', 'fracture_within_6_months', 'frequent_hospitalization_within_6_months', 'recently_discharged', 'postoperative_recovery', 'long_term_bedridden', 'pressure_injury', 'none', 'unknown'] as const) },
  'health.rehabilitationNeed': { id: 'health.rehabilitationNeed', step: 'health', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['definite', 'possible', 'none', 'unknown'] as const) },
  'health.chewingAbility': { id: 'health.chewingAbility', step: 'health', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['normal', 'easy_chew', 'modified_food', 'unknown'] as const) },
  'health.swallowingAbility': { id: 'health.swallowingAbility', step: 'health', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['normal', 'occasional_difficulty', 'significant_difficulty', 'unknown'] as const) },
  'adl.eating': { id: 'adl.eating', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'minor_assistance', 'needs_feeding', 'special_feeding', 'unknown'] as const) },
  'adl.mobility': { id: 'adl.mobility', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'walking_aid', 'wheelchair', 'bedridden', 'unknown'] as const) },
  'adl.toileting': { id: 'adl.toileting', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'occasional_assistance', 'frequent_incontinence', 'full_assistance', 'catheter_or_stoma', 'unknown'] as const) },
  'adl.bathing': { id: 'adl.bathing', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'partial_assistance', 'full_assistance', 'unknown'] as const) },
  'adl.dressing': { id: 'adl.dressing', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'partial_assistance', 'full_assistance', 'unknown'] as const) },
  'adl.transfer': { id: 'adl.transfer', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'minor_assistance', 'needs_support', 'fully_dependent', 'unknown'] as const) },
  'adl.stairs': { id: 'adl.stairs', step: 'adl', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['independent', 'needs_assistance', 'unable', 'no_stairs', 'unknown'] as const) },
  'cognitive.symptoms': { id: 'cognitive.symptoms', step: 'cognitive', type: 'multi_choice', required: true, allowUnknown: true, allowedValues: values(['memory_decline', 'repetitive_questioning', 'gets_lost', 'wandering_risk', 'sleep_wake_disorder', 'mood_instability', 'agitation', 'aggression', 'diagnosed_dementia', 'none', 'unknown'] as const) },
  'cognitive.specialCareNeeds': { id: 'cognitive.specialCareNeeds', step: 'cognitive', type: 'multi_choice', required: true, allowUnknown: true, allowedValues: values(['round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit', 'rehabilitation_training', 'tube_feeding', 'catheter_care', 'pressure_injury_care', 'incontinence_care', 'other', 'none', 'unknown'] as const) },
  'preference.careType': { id: 'preference.careType', step: 'preference', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['active_aging', 'medical_nursing_integrated', 'disability_care', 'dementia_care', 'rehabilitation_care', 'unknown'] as const) },
  'preference.roomType': { id: 'preference.roomType', step: 'preference', type: 'single_choice', required: true, allowedValues: values(['no_preference', 'single', 'double', 'triple_or_more'] as const) },
  'preference.mealSchedule': { id: 'preference.mealSchedule', step: 'preference', type: 'single_choice', required: true, allowedValues: values(['no_preference', 'three_meals', 'three_meals_one_snack', 'three_meals_two_snacks'] as const) },
  'preference.activityPreference': { id: 'preference.activityPreference', step: 'preference', type: 'single_choice', required: true, allowedValues: values(['no_preference', 'indoor', 'outdoor', 'indoor_and_outdoor'] as const) },
  'preference.priorities': { id: 'preference.priorities', step: 'preference', type: 'multi_choice', required: true, maxSelections: 3, allowedValues: values(['care_capability', 'caregiver_quality', 'medical_conditions', 'rehabilitation_capability', 'food_quality', 'living_environment', 'room_facilities', 'activity_space', 'transportation', 'near_major_hospital', 'price', 'region'] as const) },
  'preference.region': { id: 'preference.region', step: 'preference', type: 'dynamic_single_choice', required: false },
  'budget.monthlyRange': { id: 'budget.monthlyRange', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['cny_3500_5000', 'cny_5000_8000', 'cny_8000_12000', 'cny_12000_15000', 'cny_15000_plus', 'unknown'] as const) },
  'budget.upfrontCostAcceptance': { id: 'budget.upfrontCostAcceptance', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['acceptable', 'depends_on_amount', 'avoid_high_one_time_fee', 'unknown'] as const) },
  'budget.moveInTiming': { id: 'budget.moveInTiming', step: 'budget', type: 'single_choice', required: true, allowedValues: values(['as_soon_as_possible', 'within_1_month', 'within_1_to_3_months', 'after_3_months', 'research_only'] as const) },
  'budget.consultantSupport': { id: 'budget.consultantSupport', step: 'budget', type: 'single_choice', required: true, allowedValues: values(['request_contact', 'recommendation_first'] as const) },
}

export const ASSESSMENT_QUESTION_ID_LIST_V2 = Object.keys(ASSESSMENT_QUESTION_DEFINITIONS_V2) as AssessmentQuestionIdV2[]

export const isAssessmentQuestionIdV2 = (value: unknown): value is AssessmentQuestionIdV2 =>
  typeof value === 'string' && ASSESSMENT_QUESTION_ID_LIST_V2.indexOf(value as AssessmentQuestionIdV2) >= 0

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

export const isIsoTimestampV2 = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_TIMESTAMP_PATTERN.exec(value)
  if (!match) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const timezone = match[7]
  const timezoneHour = timezone === 'Z' ? 0 : Number(timezone.slice(1, 3))
  const timezoneMinute = timezone === 'Z' ? 0 : Number(timezone.slice(4, 6))
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour >= 0
    && hour <= 23
    && minute >= 0
    && minute <= 59
    && second >= 0
    && second <= 59
    && timezoneHour >= 0
    && timezoneHour <= 23
    && timezoneMinute >= 0
    && timezoneMinute <= 59
    && !Number.isNaN(Date.parse(value))
}

const V2_DRAFT_KEYS: readonly string[] = [
  'kind',
  'schemaVersion',
  'localDraftId',
  'persistence',
  'currentStep',
  'answers',
  'startedAt',
  'updatedAt',
  'migrationNotice',
]
const V2_MIGRATION_NOTICE_KEYS: readonly string[] = [
  'originalQuestionId',
  'originalOptionCodes',
  'sourceSchemaVersion',
  'targetSchemaVersion',
  'reasonCode',
]

const V1_PRIORITY_CODES: readonly string[] = [
  'medical_conditions',
  'nursing_professionalism',
  'caregiver_attitude',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'overall_quality',
  'recreational_activities',
  'close_to_family',
  'transportation',
  'price',
  'dementia_care',
]

const isAssessmentMigrationNoticeV2 = (
  value: unknown,
): value is AssessmentMigrationNoticeV2 => {
  if (!isPlainRecord(value)
    || Object.keys(value).some((key) => V2_MIGRATION_NOTICE_KEYS.indexOf(key) < 0)
    || value.originalQuestionId !== 'preference.priorities'
    || value.sourceSchemaVersion !== 1
    || value.targetSchemaVersion !== ASSESSMENT_SCHEMA_VERSION_V2
    || value.reasonCode !== 'PRIORITIES_REQUIRE_RESELECTION_V2'
    || !Array.isArray(value.originalOptionCodes)
    || value.originalOptionCodes.length === 0
    || value.originalOptionCodes.length > 3) {
    return false
  }
  const optionCodes = value.originalOptionCodes
  const allCodesValid = optionCodes.every((code) =>
    typeof code === 'string' && V1_PRIORITY_CODES.indexOf(code) >= 0)
  if (!allCodesValid || new Set(optionCodes).size !== optionCodes.length) {
    return false
  }
  const canonicalCodes = V1_PRIORITY_CODES.filter((code) => optionCodes.indexOf(code) >= 0)
  const hasAmbiguousCode = optionCodes.some((code) =>
    (V1_AMBIGUOUS_PRIORITY_CODES as readonly string[]).indexOf(code) >= 0)
  return hasAmbiguousCode
    && canonicalCodes.length === optionCodes.length
    && canonicalCodes.every((code, index) => optionCodes[index] === code)
}

const isPreferenceRegionAnswerV2 = (value: unknown): value is PreferenceRegionAnswerV2 => {
  if (!isPlainRecord(value)
    || typeof value.kind !== 'string'
    || typeof value.catalogVersion !== 'string'
    || value.catalogVersion.trim().length === 0) {
    return false
  }
  if (value.kind === 'no_preference') {
    return value.regionCode === 'no_preference' && value.regionLabelSnapshot === '不限制'
  }
  return value.kind === 'institution_region'
    && typeof value.regionCode === 'string'
    && value.regionCode.trim().length > 0
    && value.regionCode.trim() !== 'no_preference'
    && typeof value.regionLabelSnapshot === 'string'
    && value.regionLabelSnapshot.trim().length > 0
}

const isAllowedString = (definition: AssessmentQuestionDefinitionV2, value: string): boolean =>
  Array.isArray(definition.allowedValues) && definition.allowedValues.indexOf(value) >= 0

const hasExclusiveMultiChoice = (valuesToCheck: readonly string[]): boolean => {
  const uniqueValues = Array.from(new Set(valuesToCheck))
  if (uniqueValues.length !== valuesToCheck.length) {
    return true
  }
  return (valuesToCheck.indexOf('none') >= 0 || valuesToCheck.indexOf('unknown') >= 0) && valuesToCheck.length > 1
}

export const normalizeMultiChoiceValueV2 = <K extends AssessmentQuestionIdV2>(
  questionId: K,
  value: AssessmentAnswerValueMapV2[K],
): AssessmentAnswerValueMapV2[K] => {
  const definition = ASSESSMENT_QUESTION_DEFINITIONS_V2[questionId]
  if (definition.type !== 'multi_choice' || !Array.isArray(value)) {
    return value
  }
  const uniqueValues = Array.from(new Set(value))
  const latestValue = value[value.length - 1]
  const exclusive = latestValue === 'none' || latestValue === 'unknown'
    ? [latestValue]
    : uniqueValues.filter((item) => item !== 'none' && item !== 'unknown')
  return exclusive as AssessmentAnswerValueMapV2[K]
}

export const isValidAnswerForQuestionV2 = <K extends AssessmentQuestionIdV2>(
  questionId: K,
  value: unknown,
): value is AssessmentAnswerValueMapV2[K] => {
  const definition = ASSESSMENT_QUESTION_DEFINITIONS_V2[questionId]
  if (definition.type === 'text') {
    return typeof value === 'string' && value.trim().length > 0
  }
  if (definition.type === 'integer') {
    return typeof value === 'number'
      && Number.isInteger(value)
      && value >= (definition.min as number)
      && value <= (definition.max as number)
  }
  if (definition.type === 'dynamic_single_choice') {
    return isPreferenceRegionAnswerV2(value)
  }
  if (definition.type === 'single_choice') {
    return typeof value === 'string'
      && isAllowedString(definition, value)
      && (value !== 'unknown' || definition.allowUnknown === true)
  }
  if (!Array.isArray(value)
    || value.length === 0
    || (definition.maxSelections !== undefined && value.length > definition.maxSelections)
    || hasExclusiveMultiChoice(value)) {
    return false
  }
  return value.every((item) => typeof item === 'string' && isAllowedString(definition, item))
}

export const applyAssessmentConditionalRulesV2 = (answers: AssessmentDraftAnswersV2): AssessmentDraftAnswersV2 => {
  const nextAnswers: AssessmentDraftAnswersV2 = { ...answers }
  if (nextAnswers['basic.hasInstitutionExperience'] !== 'true') {
    delete nextAnswers['basic.institutionExitReasons']
  }
  return nextAnswers
}

export type AssessmentValidationErrorCodeV2 =
  | 'REQUIRED_ANSWER_MISSING'
  | 'INVALID_ANSWER'
  | 'UNKNOWN_QUESTION_ID'
  | 'INACTIVE_CONDITIONAL_ANSWER'
  | 'DUPLICATE_MULTI_CHOICE'
  | 'MUTUALLY_EXCLUSIVE_ANSWER'
  | 'PRIORITY_SELECTION_LIMIT'
  | 'INVALID_DRAFT_ENVELOPE'
  | 'INVALID_DRAFT_TIMESTAMP'

export interface AssessmentValidationIssueV2 {
  questionId?: AssessmentQuestionIdV2
  code: AssessmentValidationErrorCodeV2
}

export interface AssessmentAnswersValidationResultV2 {
  valid: boolean
  invalidQuestionIds: AssessmentQuestionIdV2[]
  firstInvalidQuestionId?: AssessmentQuestionIdV2
  errors: Partial<Record<AssessmentQuestionIdV2, string>>
  errorCodes: Partial<Record<AssessmentQuestionIdV2, AssessmentValidationErrorCodeV2>>
  issues: AssessmentValidationIssueV2[]
}

const QUESTION_ERROR_MESSAGES: Record<AssessmentValidationErrorCodeV2, string> = {
  REQUIRED_ANSWER_MISSING: '请完成这道题',
  INVALID_ANSWER: '当前答案不符合题目选项',
  UNKNOWN_QUESTION_ID: '当前题目版本无法识别',
  INACTIVE_CONDITIONAL_ANSWER: '这道题当前不适用',
  DUPLICATE_MULTI_CHOICE: '请不要重复选择',
  MUTUALLY_EXCLUSIVE_ANSWER: '“无”或“暂不清楚”不能与其他选项同时选择',
  PRIORITY_SELECTION_LIMIT: '最多选择 3 项',
  INVALID_DRAFT_ENVELOPE: '草稿结构不完整',
  INVALID_DRAFT_TIMESTAMP: '草稿时间格式无效',
}

const issueCodeForAnswer = (questionId: AssessmentQuestionIdV2, value: unknown): AssessmentValidationErrorCodeV2 => {
  const definition = ASSESSMENT_QUESTION_DEFINITIONS_V2[questionId]
  if (Array.isArray(value)) {
    const uniqueValues = Array.from(new Set(value))
    if (uniqueValues.length !== value.length) {
      return 'DUPLICATE_MULTI_CHOICE'
    }
    if ((value.indexOf('none') >= 0 || value.indexOf('unknown') >= 0) && value.length > 1) {
      return 'MUTUALLY_EXCLUSIVE_ANSWER'
    }
    if (definition.maxSelections !== undefined && value.length > definition.maxSelections) {
      return 'PRIORITY_SELECTION_LIMIT'
    }
  }
  return 'INVALID_ANSWER'
}

export const validateAssessmentAnswersV2 = (
  answers: unknown,
  requireCompletion = false,
): AssessmentAnswersValidationResultV2 => {
  const errors: Partial<Record<AssessmentQuestionIdV2, string>> = {}
  const errorCodes: Partial<Record<AssessmentQuestionIdV2, AssessmentValidationErrorCodeV2>> = {}
  const issues: AssessmentValidationIssueV2[] = []
  const invalidQuestionIds: AssessmentQuestionIdV2[] = []
  const addIssue = (questionId: AssessmentQuestionIdV2, code: AssessmentValidationErrorCodeV2) => {
    if (!Object.prototype.hasOwnProperty.call(errorCodes, questionId)) {
      invalidQuestionIds.push(questionId)
      errorCodes[questionId] = code
      errors[questionId] = QUESTION_ERROR_MESSAGES[code]
      issues.push({ questionId, code })
    }
  }

  if (!isPlainRecord(answers)) {
    return {
      valid: false,
      invalidQuestionIds: [],
      errors: {},
      errorCodes: {},
      issues: [{ code: 'INVALID_DRAFT_ENVELOPE' }],
    }
  }

  Object.keys(answers).forEach((key) => {
    if (!isAssessmentQuestionIdV2(key)) {
      issues.push({ code: 'UNKNOWN_QUESTION_ID' })
      return
    }
    const questionId = key as AssessmentQuestionIdV2
    const definition = ASSESSMENT_QUESTION_DEFINITIONS_V2[questionId]
    const value = answers[questionId]
    if (definition.condition
      && answers[definition.condition.questionId] !== definition.condition.equals) {
      addIssue(questionId, 'INACTIVE_CONDITIONAL_ANSWER')
      return
    }
    if (!isValidAnswerForQuestionV2(questionId, value)) {
      addIssue(questionId, issueCodeForAnswer(questionId, value))
    }
  })

  if (requireCompletion) {
    REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.forEach((questionId) => {
      if (!Object.prototype.hasOwnProperty.call(answers, questionId)) {
        addIssue(questionId, 'REQUIRED_ANSWER_MISSING')
      }
    })
  }

  const orderedInvalidQuestionIds = [
    ...REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.filter((questionId) => invalidQuestionIds.indexOf(questionId) >= 0),
    ...invalidQuestionIds.filter((questionId) => REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.indexOf(questionId as RequiredAssessmentQuestionIdV2) < 0),
  ]
  return {
    valid: issues.length === 0,
    invalidQuestionIds: orderedInvalidQuestionIds,
    firstInvalidQuestionId: orderedInvalidQuestionIds[0],
    errors,
    errorCodes,
    issues,
  }
}

export interface AssessmentCompletionValidationResultV2 {
  valid: boolean
  invalidQuestionIds: AssessmentQuestionIdV2[]
  firstInvalidQuestionId?: AssessmentQuestionIdV2
  errors: Partial<Record<AssessmentQuestionIdV2, string>>
  errorCodes: Partial<Record<AssessmentQuestionIdV2, AssessmentValidationErrorCodeV2>>
}

export const validateAssessmentDraftForCompletionV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentCompletionValidationResultV2 => {
  const result = validateAssessmentAnswersV2(answers, true)
  const invalidQuestionIds = result.invalidQuestionIds.slice()
  const errors: Partial<Record<AssessmentQuestionIdV2, string>> = {}
  const errorCodes: Partial<Record<AssessmentQuestionIdV2, AssessmentValidationErrorCodeV2>> = {}
  invalidQuestionIds.forEach((questionId) => {
    if (result.errors[questionId]) {
      errors[questionId] = result.errors[questionId]
    }
    if (result.errorCodes[questionId]) {
      errorCodes[questionId] = result.errorCodes[questionId]
    }
  })
  return {
    valid: invalidQuestionIds.length === 0 && result.issues.length === 0,
    invalidQuestionIds,
    firstInvalidQuestionId: result.firstInvalidQuestionId,
    errors,
    errorCodes,
  }
}

export interface AssessmentDraftValidationResultV2 extends AssessmentAnswersValidationResultV2 {
  draft?: AssessmentDraftV2
}

export const isAssessmentDraftV2 = (value: unknown): value is AssessmentDraftV2 => {
  if (!isPlainRecord(value)
    || value.kind !== 'assessment_draft'
    || value.schemaVersion !== ASSESSMENT_SCHEMA_VERSION_V2
    || value.persistence !== LOCAL_ASSESSMENT_PERSISTENCE_V2
    || !isNonEmptyString(value.localDraftId)
    || !['basic', 'health', 'adl', 'cognitive', 'preference', 'budget'].includes(value.currentStep as string)
    || !isPlainRecord(value.answers)
    || !isIsoTimestampV2(value.startedAt)
    || !isIsoTimestampV2(value.updatedAt)
    || Object.keys(value).some((key) => V2_DRAFT_KEYS.indexOf(key) < 0)
    || (value.migrationNotice !== undefined && !isAssessmentMigrationNoticeV2(value.migrationNotice))
    || (value.migrationNotice !== undefined
      && Object.prototype.hasOwnProperty.call(value.answers, 'preference.priorities'))) {
    return false
  }
  const answersResult = validateAssessmentAnswersV2(value.answers, false)
  return answersResult.valid
}

export const validateAssessmentDraftV2 = (value: unknown): AssessmentDraftValidationResultV2 => {
  if (!isPlainRecord(value)
    || value.kind !== 'assessment_draft'
    || value.schemaVersion !== ASSESSMENT_SCHEMA_VERSION_V2
    || value.persistence !== LOCAL_ASSESSMENT_PERSISTENCE_V2
    || !isNonEmptyString(value.localDraftId)
    || !['basic', 'health', 'adl', 'cognitive', 'preference', 'budget'].includes(value.currentStep as string)
    || !isPlainRecord(value.answers)
    || Object.keys(value).some((key) => V2_DRAFT_KEYS.indexOf(key) < 0)
    || (value.migrationNotice !== undefined && !isAssessmentMigrationNoticeV2(value.migrationNotice))
    || (value.migrationNotice !== undefined
      && Object.prototype.hasOwnProperty.call(value.answers, 'preference.priorities'))) {
    return {
      valid: false,
      invalidQuestionIds: [],
      errors: {},
      errorCodes: {},
      issues: [{ code: 'INVALID_DRAFT_ENVELOPE' }],
    }
  }
  if (!isIsoTimestampV2(value.startedAt) || !isIsoTimestampV2(value.updatedAt)) {
    return {
      valid: false,
      invalidQuestionIds: [],
      errors: {},
      errorCodes: {},
      issues: [{ code: 'INVALID_DRAFT_TIMESTAMP' }],
    }
  }
  const answersResult = validateAssessmentAnswersV2(value.answers, false)
  return {
    ...answersResult,
    draft: answersResult.valid ? value as unknown as AssessmentDraftV2 : undefined,
  }
}

const stepOf = (questionId: AssessmentQuestionIdV2): AssessmentStepIdV2 =>
  ASSESSMENT_QUESTION_DEFINITIONS_V2[questionId].step

const isDraftValue = (
  value: AssessmentDraftV2 | AssessmentDraftAnswersV2,
): value is AssessmentDraftV2 =>
  'kind' in value && value.kind === 'assessment_draft'

export const findFirstIncompleteAssessmentStepV2 = (
  draftOrAnswers: AssessmentDraftV2 | AssessmentDraftAnswersV2,
): AssessmentStepIdV2 | undefined => {
  const answers = isDraftValue(draftOrAnswers)
    ? draftOrAnswers.answers
    : draftOrAnswers as AssessmentDraftAnswersV2
  const validation = validateAssessmentAnswersV2(answers, true)
  const firstQuestionId = validation.firstInvalidQuestionId
  return firstQuestionId ? stepOf(firstQuestionId) : undefined
}

export const getFirstIncompleteAssessmentQuestionIdV2 = (
  draftOrAnswers: AssessmentDraftV2 | AssessmentDraftAnswersV2,
): AssessmentQuestionIdV2 | undefined => {
  const answers = isDraftValue(draftOrAnswers)
    ? draftOrAnswers.answers
    : draftOrAnswers as AssessmentDraftAnswersV2
  return validateAssessmentAnswersV2(answers, true).firstInvalidQuestionId
}

const stepQuestionIds = (step: AssessmentStepIdV2): AssessmentQuestionIdV2[] =>
  ASSESSMENT_QUESTION_ID_LIST_V2.filter((questionId) => stepOf(questionId) === step)

export interface AssessmentStepValidationResultV2<Q extends AssessmentQuestionIdV2 = AssessmentQuestionIdV2> {
  valid: boolean
  errors: Partial<Record<Q, string>>
  errorCodes: Partial<Record<Q, AssessmentValidationErrorCodeV2>>
  firstErrorQuestionId?: Q
}

export const validateAssessmentStepAnswersV2 = <Q extends AssessmentQuestionIdV2>(
  step: AssessmentStepIdV2,
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<Q> => {
  const questionIds = stepQuestionIds(step)
  const relevantAnswers: AssessmentDraftAnswersV2 = {}
  questionIds.forEach((questionId) => {
    if (Object.prototype.hasOwnProperty.call(answers, questionId)) {
      ;(relevantAnswers as Record<string, unknown>)[questionId] = answers[questionId]
    }
  })
  const result = validateAssessmentAnswersV2(relevantAnswers, false)
  const requiredInStep = questionIds.filter((questionId) =>
    REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.indexOf(questionId as RequiredAssessmentQuestionIdV2) >= 0)
  requiredInStep.forEach((questionId) => {
    if (!Object.prototype.hasOwnProperty.call(relevantAnswers, questionId)) {
      result.invalidQuestionIds.push(questionId)
      result.errorCodes[questionId] = 'REQUIRED_ANSWER_MISSING'
      result.errors[questionId] = QUESTION_ERROR_MESSAGES.REQUIRED_ANSWER_MISSING
    }
  })
  const firstQuestionId = [
    ...requiredInStep,
    ...questionIds.filter((questionId) =>
      requiredInStep.indexOf(questionId) < 0),
  ].find((questionId) => result.invalidQuestionIds.indexOf(questionId) >= 0)
  const errors = {} as Partial<Record<Q, string>>
  const errorCodes = {} as Partial<Record<Q, AssessmentValidationErrorCodeV2>>
  questionIds.forEach((questionId) => {
    if (result.errors[questionId]) {
      ;(errors as Record<string, string>)[questionId] = result.errors[questionId] as string
      ;(errorCodes as Record<string, AssessmentValidationErrorCodeV2>)[questionId] = result.errorCodes[questionId] as AssessmentValidationErrorCodeV2
    }
  })
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    errorCodes,
    firstErrorQuestionId: firstQuestionId as Q | undefined,
  }
}

export type HealthQuestionIdV2 =
  | 'health.conditions'
  | 'health.recentEvents'
  | 'health.rehabilitationNeed'
  | 'health.chewingAbility'
  | 'health.swallowingAbility'

export const validateHealthAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<HealthQuestionIdV2> =>
  validateAssessmentStepAnswersV2<HealthQuestionIdV2>('health', answers)

export type BasicQuestionIdV2 =
  | 'basic.relationship'
  | 'basic.elderName'
  | 'basic.gender'
  | 'basic.age'
  | 'basic.livingStatus'
  | 'basic.primaryCaregiver'
  | 'basic.hasInstitutionExperience'
  | 'basic.institutionExitReasons'

export const validateBasicAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<BasicQuestionIdV2> =>
  validateAssessmentStepAnswersV2<BasicQuestionIdV2>('basic', answers)

export type AdlQuestionIdV2 =
  | 'adl.eating'
  | 'adl.mobility'
  | 'adl.toileting'
  | 'adl.bathing'
  | 'adl.dressing'
  | 'adl.transfer'
  | 'adl.stairs'

export const validateAdlAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<AdlQuestionIdV2> =>
  validateAssessmentStepAnswersV2<AdlQuestionIdV2>('adl', answers)

export type CognitiveQuestionIdV2 =
  | 'cognitive.symptoms'
  | 'cognitive.specialCareNeeds'

export const validateCognitiveAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<CognitiveQuestionIdV2> =>
  validateAssessmentStepAnswersV2<CognitiveQuestionIdV2>('cognitive', answers)

export type PreferenceQuestionIdV2 =
  | 'preference.careType'
  | 'preference.roomType'
  | 'preference.mealSchedule'
  | 'preference.activityPreference'
  | 'preference.priorities'
  | 'preference.region'

export const validatePreferenceAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<PreferenceQuestionIdV2> =>
  validateAssessmentStepAnswersV2<PreferenceQuestionIdV2>('preference', answers)

export type BudgetQuestionIdV2 =
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

export const validateBudgetAnswersV2 = (
  answers: AssessmentDraftAnswersV2,
): AssessmentStepValidationResultV2<BudgetQuestionIdV2> =>
  validateAssessmentStepAnswersV2<BudgetQuestionIdV2>('budget', answers)

export const ASSESSMENT_V2_QUESTION_DEFINITIONS = ASSESSMENT_QUESTION_DEFINITIONS_V2
export const REQUIRED_ASSESSMENT_QUESTION_ORDER = REQUIRED_ASSESSMENT_QUESTION_ORDER_V2
export const isValidAnswerForQuestion = isValidAnswerForQuestionV2
