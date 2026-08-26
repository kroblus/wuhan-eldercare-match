export const ASSESSMENT_SCHEMA_VERSION = 1 as const
export const LOCAL_ASSESSMENT_PERSISTENCE = 'LOCAL_DEVICE_DEVELOPMENT_ONLY' as const

export type AssessmentSchemaVersion = typeof ASSESSMENT_SCHEMA_VERSION
export type AssessmentPersistence = typeof LOCAL_ASSESSMENT_PERSISTENCE

export type AssessmentStepId =
  | 'basic'
  | 'health'
  | 'adl'
  | 'cognitive'
  | 'preference'
  | 'budget'

/** 发布后不可改义的六步评估问题 ID。 */
export type AssessmentQuestionId =
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
  | 'preference.priorities'
  | 'preference.region'
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

export type BasicRelationship =
  | 'father'
  | 'mother'
  | 'paternal_grandfather'
  | 'paternal_grandmother'
  | 'maternal_grandfather'
  | 'maternal_grandmother'
  | 'spouse'
  | 'self'
  | 'other'

export type BasicGender = 'male' | 'female'

export type BasicLivingStatus =
  | 'alone'
  | 'with_spouse'
  | 'with_children'
  | 'with_other_relatives'
  | 'hospitalized'
  | 'in_eldercare_institution'
  | 'other'

export type BasicPrimaryCaregiver =
  | 'spouse'
  | 'children'
  | 'nanny'
  | 'care_worker'
  | 'community_care'
  | 'no_fixed_caregiver'
  | 'other'

export type BasicInstitutionExperience = 'true' | 'false'

export type BasicInstitutionExitReason =
  | 'poor_nursing'
  | 'poor_service_attitude'
  | 'high_cost'
  | 'too_far'
  | 'insufficient_medical_capability'
  | 'unsatisfactory_environment'
  | 'unsatisfactory_food'
  | 'elder_not_adapted'
  | 'other'

export type HealthCondition =
  | 'hypertension'
  | 'diabetes'
  | 'coronary_heart_disease'
  | 'stroke_sequelae'
  | 'parkinson_disease'
  | 'alzheimers_disease'
  | 'other_cognitive_impairment'
  | 'chronic_respiratory_disease'
  | 'osteoarticular_disease'
  | 'tumor'
  | 'other_chronic_disease'
  | 'none'
  | 'unknown'

export type HealthRecentEvent =
  | 'fall_within_6_months'
  | 'fracture_within_6_months'
  | 'frequent_hospitalization_within_6_months'
  | 'recently_discharged'
  | 'postoperative_recovery'
  | 'long_term_bedridden'
  | 'pressure_injury'
  | 'none'
  | 'unknown'

export type RehabilitationNeed = 'definite' | 'possible' | 'none' | 'unknown'

export type AdlEating = 'independent' | 'minor_assistance' | 'needs_feeding' | 'special_feeding' | 'unknown'
export type AdlMobility = 'independent' | 'walking_aid' | 'wheelchair' | 'bedridden' | 'unknown'
export type AdlToileting =
  | 'independent'
  | 'occasional_assistance'
  | 'frequent_incontinence'
  | 'full_assistance'
  | 'catheter_or_stoma'
  | 'unknown'
export type AdlAssistance = 'independent' | 'partial_assistance' | 'full_assistance' | 'unknown'
export type AdlTransfer = 'independent' | 'minor_assistance' | 'needs_support' | 'fully_dependent' | 'unknown'
export type AdlStairs = 'independent' | 'needs_assistance' | 'unable' | 'no_stairs' | 'unknown'

export type CognitiveSymptom =
  | 'memory_decline'
  | 'repetitive_questioning'
  | 'gets_lost'
  | 'wandering_risk'
  | 'sleep_wake_disorder'
  | 'mood_instability'
  | 'agitation'
  | 'aggression'
  | 'diagnosed_dementia'
  | 'none'
  | 'unknown'

export type CognitiveSpecialCareNeed =
  | 'round_the_clock_care'
  | 'one_to_one_caregiver'
  | 'night_care'
  | 'dementia_unit'
  | 'rehabilitation_training'
  | 'tube_feeding'
  | 'catheter_care'
  | 'pressure_injury_care'
  | 'incontinence_care'
  | 'other'
  | 'none'
  | 'unknown'

export type PreferredCareType =
  | 'active_aging'
  | 'medical_nursing_integrated'
  | 'disability_care'
  | 'dementia_care'
  | 'rehabilitation_care'
  | 'unknown'

export type PreferencePriority =
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

export interface NoPreferenceRegionAnswer {
  kind: 'no_preference'
  regionCode: 'no_preference'
  regionLabelSnapshot: '不限制'
  catalogVersion: string
}

export interface InstitutionRegionAnswer {
  kind: 'institution_region'
  regionCode: string
  regionLabelSnapshot: string
  catalogVersion: string
}

/** 区域答案保存稳定 code，同时保留作答时的展示快照。 */
export type PreferenceRegionAnswer = NoPreferenceRegionAnswer | InstitutionRegionAnswer

export type MonthlyRange =
  | 'cny_3500_5000'
  | 'cny_5000_8000'
  | 'cny_8000_12000'
  | 'cny_12000_15000'
  | 'cny_15000_plus'
  | 'unknown'

export type UpfrontCostAcceptance = 'acceptable' | 'depends_on_amount' | 'avoid_high_one_time_fee' | 'unknown'
export type MoveInTiming = 'as_soon_as_possible' | 'within_1_month' | 'within_1_to_3_months' | 'after_3_months' | 'research_only'
export type ConsultantSupport = 'request_contact' | 'recommendation_first'

/** question ID 到答案类型的一一映射；未回答只由 key 缺失表示。 */
export interface AssessmentAnswerValueMap {
  'basic.relationship': BasicRelationship
  'basic.elderName': string
  'basic.gender': BasicGender
  'basic.age': number
  'basic.livingStatus': BasicLivingStatus
  'basic.primaryCaregiver': BasicPrimaryCaregiver
  'basic.hasInstitutionExperience': BasicInstitutionExperience
  'basic.institutionExitReasons': BasicInstitutionExitReason[]
  'health.conditions': HealthCondition[]
  'health.recentEvents': HealthRecentEvent[]
  'health.rehabilitationNeed': RehabilitationNeed
  'adl.eating': AdlEating
  'adl.mobility': AdlMobility
  'adl.toileting': AdlToileting
  'adl.bathing': AdlAssistance
  'adl.dressing': AdlAssistance
  'adl.transfer': AdlTransfer
  'adl.stairs': AdlStairs
  'cognitive.symptoms': CognitiveSymptom[]
  'cognitive.specialCareNeeds': CognitiveSpecialCareNeed[]
  'preference.careType': PreferredCareType
  'preference.priorities': PreferencePriority[]
  'preference.region': PreferenceRegionAnswer
  'budget.monthlyRange': MonthlyRange
  'budget.upfrontCostAcceptance': UpfrontCostAcceptance
  'budget.moveInTiming': MoveInTiming
  'budget.consultantSupport': ConsultantSupport
}

export type AssessmentDraftAnswers = Partial<AssessmentAnswerValueMap>

/** 已完成评估必须包含全部 required 题；选填/条件题只在用户作答时进入快照。 */
export type RequiredAssessmentQuestionId =
  | 'basic.relationship'
  | 'basic.gender'
  | 'basic.age'
  | 'health.conditions'
  | 'health.recentEvents'
  | 'health.rehabilitationNeed'
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
  | 'preference.priorities'
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

export type OptionalAssessmentQuestionId = Exclude<AssessmentQuestionId, RequiredAssessmentQuestionId>
export type RequiredAssessmentAnswerSnapshot = {
  [K in RequiredAssessmentQuestionId]: AssessmentAnswerValueMap[K]
}
export type AssessmentAnswerSnapshot = RequiredAssessmentAnswerSnapshot & Partial<Pick<AssessmentAnswerValueMap, OptionalAssessmentQuestionId>>

export interface AssessmentDraft {
  kind: 'assessment_draft'
  schemaVersion: AssessmentSchemaVersion
  localDraftId: string
  persistence: AssessmentPersistence
  currentStep: AssessmentStepId
  answers: AssessmentDraftAnswers
  startedAt: string
  updatedAt: string
}

export interface CompletedAssessment {
  kind: 'completed_assessment'
  id: string
  elderId: string
  status: 'completed'
  schemaVersion: AssessmentSchemaVersion
  answers: AssessmentAnswerSnapshot
  completedAt: string
}

export type AssessmentQuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'integer'
  | 'dynamic_single_choice'

export interface AssessmentQuestionDefinition {
  id: AssessmentQuestionId
  step: AssessmentStepId
  type: AssessmentQuestionType
  required: boolean
  allowUnknown?: boolean
  allowedValues?: readonly string[]
  maxSelections?: number
  min?: number
  max?: number
  condition?: {
    questionId: AssessmentQuestionId
    equals: string
  }
}

const values = <T extends readonly string[]>(items: T): T => items

export const ASSESSMENT_QUESTION_DEFINITIONS: Record<AssessmentQuestionId, AssessmentQuestionDefinition> = {
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
  'preference.priorities': { id: 'preference.priorities', step: 'preference', type: 'multi_choice', required: true, maxSelections: 3, allowedValues: values(['medical_conditions', 'nursing_professionalism', 'caregiver_attitude', 'rehabilitation_capability', 'food_quality', 'living_environment', 'overall_quality', 'recreational_activities', 'close_to_family', 'transportation', 'price', 'dementia_care'] as const) },
  'preference.region': { id: 'preference.region', step: 'preference', type: 'dynamic_single_choice', required: false },
  'budget.monthlyRange': { id: 'budget.monthlyRange', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['cny_3500_5000', 'cny_5000_8000', 'cny_8000_12000', 'cny_12000_15000', 'cny_15000_plus', 'unknown'] as const) },
  'budget.upfrontCostAcceptance': { id: 'budget.upfrontCostAcceptance', step: 'budget', type: 'single_choice', required: true, allowUnknown: true, allowedValues: values(['acceptable', 'depends_on_amount', 'avoid_high_one_time_fee', 'unknown'] as const) },
  'budget.moveInTiming': { id: 'budget.moveInTiming', step: 'budget', type: 'single_choice', required: true, allowedValues: values(['as_soon_as_possible', 'within_1_month', 'within_1_to_3_months', 'after_3_months', 'research_only'] as const) },
  'budget.consultantSupport': { id: 'budget.consultantSupport', step: 'budget', type: 'single_choice', required: true, allowedValues: values(['request_contact', 'recommendation_first'] as const) },
}

const ASSESSMENT_QUESTION_ID_LIST = Object.keys(ASSESSMENT_QUESTION_DEFINITIONS) as AssessmentQuestionId[]

export const isAssessmentQuestionId = (value: unknown): value is AssessmentQuestionId =>
  typeof value === 'string' && ASSESSMENT_QUESTION_ID_LIST.indexOf(value as AssessmentQuestionId) >= 0

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPreferenceRegionAnswer = (value: unknown): value is PreferenceRegionAnswer => {
  if (!isPlainRecord(value) || typeof value.kind !== 'string' || typeof value.catalogVersion !== 'string') {
    return false
  }
  if (value.kind === 'no_preference') {
    return value.regionCode === 'no_preference' && value.regionLabelSnapshot === '不限制'
  }
  return value.kind === 'institution_region'
    && typeof value.regionCode === 'string'
    && value.regionCode.length > 0
    && typeof value.regionLabelSnapshot === 'string'
    && value.regionLabelSnapshot.length > 0
}

const isAllowedString = (definition: AssessmentQuestionDefinition, value: string): boolean =>
  Array.isArray(definition.allowedValues) && definition.allowedValues.indexOf(value) >= 0

const hasExclusiveMultiChoice = (valuesToCheck: readonly string[]): boolean => {
  const uniqueValues = Array.from(new Set(valuesToCheck))
  if (uniqueValues.length !== valuesToCheck.length) {
    return true
  }
  return (valuesToCheck.indexOf('none') >= 0 || valuesToCheck.indexOf('unknown') >= 0) && valuesToCheck.length > 1
}

export const isValidAnswerForQuestion = <K extends AssessmentQuestionId>(
  questionId: K,
  value: unknown,
): value is AssessmentAnswerValueMap[K] => {
  const definition = ASSESSMENT_QUESTION_DEFINITIONS[questionId]
  if (definition.type === 'text') {
    return typeof value === 'string'
  }
  if (definition.type === 'integer') {
    return typeof value === 'number'
      && Number.isInteger(value)
      && value >= (definition.min as number)
      && value <= (definition.max as number)
  }
  if (definition.type === 'dynamic_single_choice') {
    return isPreferenceRegionAnswer(value)
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

/** 将多选值按集合保存，并执行契约中的 none/unknown 互斥规则。 */
export const normalizeMultiChoiceValue = <K extends AssessmentQuestionId>(
  questionId: K,
  value: AssessmentAnswerValueMap[K],
): AssessmentAnswerValueMap[K] => {
  const definition = ASSESSMENT_QUESTION_DEFINITIONS[questionId]
  if (definition.type !== 'multi_choice' || !Array.isArray(value)) {
    return value
  }
  const uniqueValues = Array.from(new Set(value))
  const latestValue = value[value.length - 1]
  const exclusive = latestValue === 'none' || latestValue === 'unknown'
    ? [latestValue]
    : uniqueValues.filter((item) => item !== 'none' && item !== 'unknown')
  return exclusive as AssessmentAnswerValueMap[K]
}

/** 仅清理已失活的条件题，不生成任何业务答案。 */
export const applyAssessmentConditionalRules = (answers: AssessmentDraftAnswers): AssessmentDraftAnswers => {
  const nextAnswers: AssessmentDraftAnswers = { ...answers }
  if (nextAnswers['basic.hasInstitutionExperience'] !== 'true') {
    delete nextAnswers['basic.institutionExitReasons']
  }
  return nextAnswers
}

export type BasicRequiredQuestionId = 'basic.relationship' | 'basic.gender' | 'basic.age'

export interface BasicValidationResult {
  valid: boolean
  errors: Partial<Record<BasicRequiredQuestionId, string>>
}

export const validateBasicAnswers = (answers: AssessmentDraftAnswers): BasicValidationResult => {
  const errors: Partial<Record<BasicRequiredQuestionId, string>> = {}
  if (!isValidAnswerForQuestion('basic.relationship', answers['basic.relationship'])) {
    errors['basic.relationship'] = '请选择老人与您的关系'
  }
  if (!isValidAnswerForQuestion('basic.gender', answers['basic.gender'])) {
    errors['basic.gender'] = '请选择老人的性别'
  }
  const age = answers['basic.age']
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 50 || age > 110) {
    errors['basic.age'] = '请输入 50–110 岁的整数年龄'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export type AssessmentEvidenceKind =
  | 'direct_requirement'
  | 'direct_observation'
  | 'risk_signal'
  | 'care_clue'
  | 'preference'

export interface AssessmentEvidenceMetadata {
  kind: AssessmentEvidenceKind
  description: string
  sourceQuestionIds: readonly AssessmentQuestionId[]
  sourceCodes: readonly string[]
}

/** 仅冻结证据类别与来源，不执行过滤、计分或推荐。 */
export const ASSESSMENT_EVIDENCE_METADATA: readonly AssessmentEvidenceMetadata[] = [
  {
    kind: 'direct_requirement',
    description: '用户明确提出的护理服务需求，可供后续硬性条件规则引用。',
    sourceQuestionIds: ['cognitive.specialCareNeeds'],
    sourceCodes: ['tube_feeding', 'catheter_care', 'pressure_injury_care', 'night_care', 'dementia_unit'],
  },
  {
    kind: 'direct_observation',
    description: '用户明确报告的疾病、身体状态或功能事实。',
    sourceQuestionIds: ['health.conditions', 'health.recentEvents', 'adl.eating', 'adl.mobility', 'adl.toileting', 'cognitive.symptoms'],
    sourceCodes: ['diagnosed_dementia', 'pressure_injury', 'wheelchair', 'bedridden', 'catheter_or_stoma'],
  },
  {
    kind: 'risk_signal',
    description: '风险或症状信号，只能作为风险解释与后续规则输入。',
    sourceQuestionIds: ['cognitive.symptoms', 'health.recentEvents'],
    sourceCodes: ['wandering_risk', 'gets_lost', 'sleep_wake_disorder', 'frequent_hospitalization_within_6_months'],
  },
  {
    kind: 'care_clue',
    description: '需要进一步确认的照护线索，不能独立触发硬过滤。',
    sourceQuestionIds: ['adl.eating', 'health.rehabilitationNeed'],
    sourceCodes: ['special_feeding', 'possible'],
  },
  {
    kind: 'preference',
    description: '家庭主观偏好，用于后续排序与理由主题，不覆盖护理硬约束。',
    sourceQuestionIds: ['preference.careType', 'preference.priorities', 'preference.region', 'budget.monthlyRange'],
    sourceCodes: ['care_type', 'priority', 'region', 'monthly_range'],
  },
]
