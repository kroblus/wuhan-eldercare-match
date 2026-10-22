import type {
  AssessmentAnswerSnapshotV2,
  AssessmentQuestionIdV2,
  PreferencePriorityV2,
} from '../../../types/assessment-v2'
import {
  ASSESSMENT_QUESTION_DEFINITIONS_V2,
  isAssessmentQuestionIdV2,
  isValidAnswerForQuestionV2,
} from '../../../types/assessment-v2'
import type {
  DerivationEvidenceV2,
  ElderProfileDerivedFieldV2,
  ElderProfileSemanticPayloadV2,
  ProfileClarificationV2,
} from '../../../types/elder-profile-v2'
import type { ProfileClarification } from '../../../types/elder-profile'
import type {
  ElderEvidenceRefV2,
  RecommendationElderSemanticSnapshotV2,
  RecommendationErrorV2,
  RecommendationEvaluationResultV2,
  RecommendationProfileV2,
  RecommendationProfileRawFactEvidenceRefV2,
  RequirementReadinessV2,
} from '../../../types/recommendation-v2'
import { deriveProfileSemanticsV2 } from '../../elder-profile/v2/semantic-core-v2'
import { isValidIsoTimestamp } from '../../institution/primitives'
import {
  evaluateFrozenSafetyReadiness,
} from '../profile'
import {
  copyDomainDataV2,
  hasUniqueStringsV2,
  isNonEmptyStringV2,
  isPlainRecordV2,
  isPriorityCodeV2,
  sortAsciiV2,
  sortPrioritiesV2,
} from './rules-v2'

export interface ValidatedProfileSnapshotV2 {
  profile: RecommendationProfileV2
  snapshot: RecommendationElderSemanticSnapshotV2
  elderReadiness: 'ready' | 'blocked_by_required_clarification'
  requirementReadiness: readonly RequirementReadinessV2[]
  elderClarifications: readonly ProfileClarificationV2[]
}

const makeError = (
  code: RecommendationErrorV2['code'],
  paths: readonly string[],
): RecommendationErrorV2 => ({
  code,
  paths: paths.length > 0 ? sortAsciiV2(paths, (path) => path) : ['$'],
})

const DERIVED_FACT_STATUSES = ['known', 'unknown', 'needs_confirmation'] as const
const CARE_LEVELS = ['independent', 'light_care', 'semi_disabled', 'disabled', 'severely_disabled'] as const
const MOBILITY_LEVELS = ['independent', 'walking_aid', 'wheelchair', 'bedbound'] as const
const REHABILITATION_VALUES = ['required', 'possible', 'not_required'] as const
const COGNITIVE_VALUES = ['present', 'absent', 'not_reported'] as const
const DIAGNOSIS_VALUES = ['reported', 'not_reported'] as const
const RISK_VALUES = ['present', 'not_reported'] as const
const FOOD_TEXTURE_VALUES = ['standard', 'easy_chew', 'modified_food'] as const
const SWALLOWING_VALUES = ['normal', 'occasional_difficulty', 'significant_difficulty'] as const
const CARE_CAPABILITIES = [
  'round_the_clock_care',
  'one_to_one_caregiver',
  'night_care',
  'dementia_unit',
  'rehabilitation_training',
  'tube_feeding',
  'catheter_care',
  'pressure_injury_care',
  'incontinence_care',
] as const
const CARE_REQUIREMENT_STATUSES = ['required', 'not_required', 'not_reported', 'unknown', 'needs_confirmation'] as const
const CARE_TYPE_VALUES = ['active_aging', 'medical_nursing_integrated', 'disability_care', 'dementia_care', 'rehabilitation_care', 'unknown'] as const
const ROOM_VALUES = ['no_preference', 'single', 'double', 'triple_or_more'] as const
const MEAL_VALUES = ['no_preference', 'three_meals', 'three_meals_one_snack', 'three_meals_two_snacks'] as const
const ACTIVITY_VALUES = ['no_preference', 'indoor', 'outdoor', 'indoor_and_outdoor'] as const
const BUDGET_VALUES = ['cny_3500_5000', 'cny_5000_8000', 'cny_8000_12000', 'cny_12000_15000', 'cny_15000_plus', 'unknown'] as const
const DEPOSIT_VALUES = ['acceptable', 'depends_on_amount', 'avoid_high_one_time_fee', 'unknown'] as const
const MOVE_IN_VALUES = ['as_soon_as_possible', 'within_1_month', 'within_1_to_3_months', 'after_3_months', 'research_only'] as const
const CONSULTANT_VALUES = ['request_contact', 'recommendation_first'] as const
const CLARIFICATION_PRIORITIES = ['required_before_classification', 'required_before_hard_filter', 'recommended', 'informational'] as const
const CLARIFICATION_REASONS = ['other_without_detail', 'unknown_answer', 'non_ordinal_adl_answer', 'cross_answer_conflict', 'risk_signal_needs_confirmation'] as const
const CARE_MODE_CODES = [
  'feeding_minor', 'feeding_dependence', 'special_feeding_review', 'walking_aid',
  'wheelchair', 'bedridden', 'toileting_minor', 'incontinence', 'toileting_full_assistance',
  'catheter_or_stoma_review', 'bathing_partial', 'bathing_full_assistance',
  'dressing_partial', 'dressing_full_assistance', 'transfer_minor', 'transfer_support',
  'fully_dependent_transfer', 'stairs_assistance', 'stairs_unable', 'no_stairs_context',
] as const
const SUMMARY_SECTIONS_V2 = [
  'basic', 'health', 'nutrition', 'adl', 'mobility', 'cognition', 'special_care',
  'preference', 'financial_intent',
] as const
const EVIDENCE_CONTRIBUTIONS = [
  'supports', 'overrides', 'context', 'limits_confidence', 'excluded_not_applicable',
  'requires_clarification',
] as const

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

const isOneOf = (value: unknown, values: readonly string[]): boolean =>
  typeof value === 'string' && values.indexOf(value) >= 0

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isNonEmptyStringV2)

const isAcyclicData = (value: unknown, ancestors: readonly object[] = []): boolean => {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || value === null) return false
  const objectValue = value as object
  if (ancestors.indexOf(objectValue) >= 0 || ancestors.length > 64) return false
  const next = ancestors.slice()
  next.push(objectValue)
  return Object.keys(objectValue).every((key) =>
    isAcyclicData((objectValue as Record<string, unknown>)[key], next))
}

const validateQuestion = (
  questionId: AssessmentQuestionIdV2,
  value: unknown,
  path: string,
  issues: string[],
): void => {
  if (!isValidAnswerForQuestionV2(questionId, value)) issues.push(path)
}

const isKnownDerivedFieldV2 = (value: string): boolean => [
  'adl.careLevel',
  'mobility.level',
  'health.rehabilitationNeed',
  'cognition.cognitiveConcern',
  'cognition.reportedDiagnosis',
  'cognition.wanderingRisk',
  'cognition.behavioralRisk',
  'cognition.sleepCycleIssue',
  'nutrition.foodTextureSupport',
  'nutrition.swallowingConcern',
  'preference.roomTypePreference',
  'preference.mealSchedulePreference',
  'preference.activityPreference',
  'preference.priorities',
  'financial.budgetAdvisory.highCareLowBudget',
].indexOf(value) >= 0
  || CARE_MODE_CODES.some((code) => value === `adl.careModes.${code}`)
  || CARE_CAPABILITIES.some((code) => value === `specialCare.requiredCareCapabilities.${code}`)

const factIds = (
  value: unknown,
  allowedValues: readonly string[],
  path: string,
  issues: string[],
  references: Map<string, string>,
): void => {
  if (!isPlainRecordV2(value)
    || !isOneOf(value.status, DERIVED_FACT_STATUSES)
    || !isStringArray(value.evidenceIds)
    || value.evidenceIds.length === 0
    || !hasUniqueStringsV2(value.evidenceIds)) {
    issues.push(path)
    return
  }
  if (value.status === 'known' && !isOneOf(value.value, allowedValues)) {
    issues.push(`${path}.value`)
  }
  if (value.status === 'known') {
    if ((value.confidence !== 'high' && value.confidence !== 'medium')
      || hasOwn(value, 'candidateValue') || hasOwn(value, 'clarificationIds')) {
      issues.push(path)
    }
  } else {
    if (value.confidence !== 'needs_confirmation'
      || hasOwn(value, 'value')
      || !isStringArray(value.clarificationIds)
      || value.clarificationIds.length === 0
      || !hasUniqueStringsV2(value.clarificationIds)) {
      issues.push(`${path}.clarificationIds`)
    }
    if (value.status === 'unknown' && hasOwn(value, 'candidateValue')) issues.push(`${path}.candidateValue`)
    if (value.status === 'needs_confirmation' && hasOwn(value, 'candidateValue')
      && !isOneOf(value.candidateValue, allowedValues)) issues.push(`${path}.candidateValue`)
  }
  value.evidenceIds.forEach((id) => references.set(id, path))
}

const validateEnvelope = (
  input: unknown,
  expectedKind: RecommendationProfileV2['kind'],
  issues: string[],
): input is RecommendationProfileV2 => {
  if (!isPlainRecordV2(input) || input.kind !== expectedKind) {
    issues.push('profile.kind')
    return false
  }
  const forbiddenIdentityKeys = ['recommendationId', 'previewId', 'generatedAt']
  if (forbiddenIdentityKeys.some((key) => hasOwn(input, key))) {
    issues.push('profile.identityBoundary')
    return false
  }
  if (expectedKind === 'elder_profile') {
    if (!isPlainRecordV2(input.identity)
      || Object.keys(input.identity).some((key) => [
        'elderId', 'assessmentId', 'assessmentSchemaVersion', 'assessmentCompletedAt',
        'profileContractVersion', 'derivationRulesetVersion',
      ].indexOf(key) < 0)
      || !isNonEmptyStringV2(input.identity.elderId)
      || !isNonEmptyStringV2(input.identity.assessmentId)
      || input.identity.assessmentSchemaVersion !== 2
      || input.identity.profileContractVersion !== 'elder-profile-contract-v2'
      || input.identity.derivationRulesetVersion !== 'elder-profile-ruleset-v2'
      || !isValidIsoTimestamp(input.identity.assessmentCompletedAt)
      || hasOwn(input, 'source')) {
      issues.push('profile.identity')
      return false
    }
  } else if (!isPlainRecordV2(input.source)
    || Object.keys(input.source).some((key) => [
      'kind', 'localDraftId', 'assessmentSchemaVersion',
    ].indexOf(key) < 0)
    || input.source.kind !== 'local_assessment_preview'
    || !isNonEmptyStringV2(input.source.localDraftId)
    || input.source.assessmentSchemaVersion !== 2
    || input.profileContractVersion !== 'elder-profile-contract-v2'
    || input.derivationRulesetVersion !== 'elder-profile-ruleset-v2'
    || hasOwn(input, 'identity')
    || ['assessmentId', 'elderId', 'completedAt'].some((key) =>
      hasOwn(input, key) || hasOwn(input.source as object, key))) {
    issues.push('profile.source')
    return false
  }
  return true
}

const validateSnapshot = (
  profile: RecommendationProfileV2,
): { issues: readonly string[], references: Map<string, string> } => {
  const issues: string[] = []
  const references = new Map<string, string>()
  const requiredSections = [
    'basic', 'health', 'nutrition', 'adl', 'mobility', 'cognition', 'specialCare',
    'preference', 'financial', 'intent', 'userFacingSummary',
  ]
  requiredSections.forEach((section) => {
    if (!isPlainRecordV2((profile as unknown as Record<string, unknown>)[section])) {
      issues.push(`profile.${section}`)
    }
  })

  if (!isPlainRecordV2(profile.basic) || !isPlainRecordV2(profile.basic.rawFacts)) {
    issues.push('profile.basic.rawFacts')
  } else {
    const basic = profile.basic.rawFacts
    validateQuestion('basic.relationship', basic.relation, 'basic.rawFacts.relation', issues)
    validateQuestion('basic.gender', basic.sex, 'basic.rawFacts.sex', issues)
    validateQuestion('basic.age', basic.age, 'basic.rawFacts.age', issues)
    const optionalBasic: readonly [keyof typeof basic, AssessmentQuestionIdV2][] = [
      ['name', 'basic.elderName'],
      ['livingStatus', 'basic.livingStatus'],
      ['primaryCaregiver', 'basic.primaryCaregiver'],
      ['hasInstitutionExperience', 'basic.hasInstitutionExperience'],
      ['institutionExitReasons', 'basic.institutionExitReasons'],
    ]
    optionalBasic.forEach((item) => {
      if (hasOwn(basic, item[0])) validateQuestion(item[1], basic[item[0]], `basic.rawFacts.${item[0]}`, issues)
    })
  }

  if (!isPlainRecordV2(profile.adl) || !isPlainRecordV2(profile.adl.rawAnswers)
    || !isPlainRecordV2(profile.adl.derivedFacts)
    || profile.adl.derivedFacts.rulesetVersion !== 'adl-ruleset-v1') {
    issues.push('profile.adl')
  } else {
    ;(['eating', 'mobility', 'toileting', 'bathing', 'dressing', 'transfer', 'stairs'] as const)
      .forEach((field) => validateQuestion(
        `adl.${field}` as AssessmentQuestionIdV2,
        profile.adl.rawAnswers[field],
        `adl.rawAnswers.${field}`,
        issues,
      ))
    factIds(profile.adl.derivedFacts.careLevel, CARE_LEVELS, 'adl.careLevel', issues, references)
    if (!Array.isArray(profile.adl.derivedFacts.careModes)) {
      issues.push('adl.careModes')
    } else {
      const careModeCodes: string[] = []
      profile.adl.derivedFacts.careModes.forEach((mode, index) => {
        if (!isPlainRecordV2(mode) || !isOneOf(mode.code, CARE_MODE_CODES)
          || !isOneOf(mode.status, ['reported', 'context', 'needs_confirmation'])
          || !isStringArray(mode.evidenceIds) || mode.evidenceIds.length === 0
          || !hasUniqueStringsV2(mode.evidenceIds)
          || (mode.status === 'needs_confirmation'
            && (!isStringArray(mode.clarificationIds) || mode.clarificationIds.length === 0))) {
          issues.push(`adl.careModes.${index}`)
          return
        }
        careModeCodes.push(String(mode.code))
        mode.evidenceIds.forEach((id) => references.set(id, `adl.careModes.${String(mode.code)}`))
      })
      if (!hasUniqueStringsV2(careModeCodes)) issues.push('adl.careModes.code')
    }
    const coverage = profile.adl.derivedFacts.observationCoverage
    if (!isPlainRecordV2(coverage) || !isOneOf(coverage.status, ['complete', 'limited', 'unknown'])
      || !isStringArray(coverage.issues) || !hasUniqueStringsV2(coverage.issues)
      || !coverage.issues.every((issue) => isOneOf(issue, [
        'stairs_not_applicable', 'special_feeding_non_ordinal',
        'catheter_or_stoma_non_ordinal', 'unknown_input',
      ]))) {
      issues.push('adl.observationCoverage')
    }
    const unknownQuestionIds = profile.adl.derivedFacts.unknownQuestionIds
    if (!isStringArray(unknownQuestionIds) || !hasUniqueStringsV2(unknownQuestionIds)
      || !unknownQuestionIds.every((questionId) => isOneOf(questionId, [
        'adl.eating', 'adl.mobility', 'adl.toileting', 'adl.bathing',
        'adl.dressing', 'adl.transfer', 'adl.stairs',
      ]))) {
      issues.push('adl.unknownQuestionIds')
    }
  }

  if (!isPlainRecordV2(profile.mobility) || !isPlainRecordV2(profile.mobility.derivedFacts)) {
    issues.push('profile.mobility.derivedFacts')
  } else {
    factIds(profile.mobility.derivedFacts.level, MOBILITY_LEVELS, 'mobility.level', issues, references)
  }
  if (!isPlainRecordV2(profile.health) || !isPlainRecordV2(profile.health.rawFacts)
    || !isPlainRecordV2(profile.health.derivedFacts)) {
    issues.push('profile.health')
  } else {
    validateQuestion('health.conditions', profile.health.rawFacts.reportedDiseases,
      'health.rawFacts.reportedDiseases', issues)
    validateQuestion('health.recentEvents', profile.health.rawFacts.recentHealthRisks,
      'health.rawFacts.recentHealthRisks', issues)
    validateQuestion('health.rehabilitationNeed', profile.health.rawFacts.rehabilitationNeedAnswer,
      'health.rawFacts.rehabilitationNeedAnswer', issues)
    factIds(profile.health.derivedFacts.rehabilitationNeed, REHABILITATION_VALUES,
      'health.rehabilitationNeed', issues, references)
  }
  if (!isPlainRecordV2(profile.cognition) || !isPlainRecordV2(profile.cognition.rawFacts)
    || !isPlainRecordV2(profile.cognition.derivedFacts)) {
    issues.push('profile.cognition')
  } else {
    validateQuestion('cognitive.symptoms', profile.cognition.rawFacts.reportedSymptoms,
      'cognition.rawFacts.reportedSymptoms', issues)
    factIds(profile.cognition.derivedFacts.cognitiveConcern, COGNITIVE_VALUES,
      'cognition.cognitiveConcern', issues, references)
    factIds(profile.cognition.derivedFacts.reportedDiagnosis, DIAGNOSIS_VALUES,
      'cognition.reportedDiagnosis', issues, references)
    factIds(profile.cognition.derivedFacts.wanderingRisk, RISK_VALUES,
      'cognition.wanderingRisk', issues, references)
    factIds(profile.cognition.derivedFacts.behavioralRisk, RISK_VALUES,
      'cognition.behavioralRisk', issues, references)
    factIds(profile.cognition.derivedFacts.sleepCycleIssue, RISK_VALUES,
      'cognition.sleepCycleIssue', issues, references)
  }
  if (!isPlainRecordV2(profile.specialCare)
    || !isPlainRecordV2(profile.specialCare.rawFacts)
    || !isPlainRecordV2(profile.specialCare.derivedFacts)
    || !Array.isArray(profile.specialCare.derivedFacts.requiredCareCapabilities)) {
    issues.push('profile.specialCare')
  } else {
    validateQuestion('cognitive.specialCareNeeds', profile.specialCare.rawFacts.answers,
      'specialCare.rawFacts.answers', issues)
    const capabilities = profile.specialCare.derivedFacts.requiredCareCapabilities
    const codes = capabilities.map((item) => item.capability)
    if (codes.length !== CARE_CAPABILITIES.length
      || CARE_CAPABILITIES.some((code) => codes.indexOf(code) < 0)
      || !hasUniqueStringsV2(codes)) {
      issues.push('specialCare.requiredCareCapabilities')
    }
    capabilities.forEach((item, index) => {
      if (!isOneOf(item.status, CARE_REQUIREMENT_STATUSES)
        || !isStringArray(item.evidenceIds) || item.evidenceIds.length === 0
        || !hasUniqueStringsV2(item.evidenceIds)
        || ((item.status === 'unknown' || item.status === 'needs_confirmation')
          && (!isStringArray(item.clarificationIds) || item.clarificationIds.length === 0))) {
        issues.push(`specialCare.requiredCareCapabilities.${index}`)
        return
      }
      item.evidenceIds.forEach((id: string) => references.set(id,
        `specialCare.requiredCareCapabilities.${item.capability}`))
    })
  }
  if (!isPlainRecordV2(profile.nutrition) || !isPlainRecordV2(profile.nutrition.rawFacts)
    || !isPlainRecordV2(profile.nutrition.derivedFacts)) {
    issues.push('profile.nutrition')
  } else {
    validateQuestion('health.chewingAbility', profile.nutrition.rawFacts.chewingAbilityAnswer,
      'nutrition.rawFacts.chewingAbilityAnswer', issues)
    validateQuestion('health.swallowingAbility', profile.nutrition.rawFacts.swallowingAbilityAnswer,
      'nutrition.rawFacts.swallowingAbilityAnswer', issues)
    factIds(profile.nutrition.derivedFacts.foodTextureSupport, FOOD_TEXTURE_VALUES,
      'nutrition.foodTextureSupport', issues, references)
    factIds(profile.nutrition.derivedFacts.swallowingConcern, SWALLOWING_VALUES,
      'nutrition.swallowingConcern', issues, references)
  }

  const preference = isPlainRecordV2(profile.preference) && isPlainRecordV2(profile.preference.rawFacts)
    ? profile.preference.rawFacts : null
  if (preference === null
    || !isOneOf(preference.preferredInstitutionType, CARE_TYPE_VALUES)
    || !isOneOf(preference.roomTypePreference, ROOM_VALUES)
    || !isOneOf(preference.mealSchedulePreference, MEAL_VALUES)
    || !isOneOf(preference.activityPreference, ACTIVITY_VALUES)
    || !Array.isArray(preference.priorities)
    || preference.priorities.length < 1 || preference.priorities.length > 3
    || !preference.priorities.every(isPriorityCodeV2)
    || !hasUniqueStringsV2(preference.priorities as readonly string[])) {
    issues.push('profile.preference.rawFacts')
  } else {
    validateQuestion('preference.careType', preference.preferredInstitutionType,
      'preference.rawFacts.preferredInstitutionType', issues)
    validateQuestion('preference.roomType', preference.roomTypePreference,
      'preference.rawFacts.roomTypePreference', issues)
    validateQuestion('preference.mealSchedule', preference.mealSchedulePreference,
      'preference.rawFacts.mealSchedulePreference', issues)
    validateQuestion('preference.activityPreference', preference.activityPreference,
      'preference.rawFacts.activityPreference', issues)
    validateQuestion('preference.priorities', preference.priorities,
      'preference.rawFacts.priorities', issues)
    if (preference.regionPreference !== undefined) {
      validateQuestion('preference.region', preference.regionPreference,
        'preference.rawFacts.regionPreference', issues)
    }
  }

  const financial = isPlainRecordV2(profile.financial)
    && isPlainRecordV2(profile.financial.rawFacts)
    && isPlainRecordV2(profile.financial.derivedFacts)
    ? profile.financial : null
  if (financial === null
    || !isOneOf(financial.rawFacts.monthlyBudget, BUDGET_VALUES)
    || !isOneOf(financial.rawFacts.depositTolerance, DEPOSIT_VALUES)
    || !Array.isArray(financial.derivedFacts.budgetAdvisories)) {
    issues.push('profile.financial')
  } else {
    validateQuestion('budget.monthlyRange', financial.rawFacts.monthlyBudget,
      'financial.rawFacts.monthlyBudget', issues)
    validateQuestion('budget.upfrontCostAcceptance', financial.rawFacts.depositTolerance,
      'financial.rawFacts.depositTolerance', issues)
    financial.derivedFacts.budgetAdvisories.forEach((advisory, index) => {
      if (advisory.code !== 'HIGH_CARE_LOW_BUDGET'
        || advisory.role !== 'advisory_only'
        || advisory.status !== 'present'
        || !isStringArray(advisory.triggerCodes) || advisory.triggerCodes.length === 0
        || !isStringArray(advisory.triggerEvidenceIds) || advisory.triggerEvidenceIds.length === 0
        || !isStringArray(advisory.evidenceIds) || advisory.evidenceIds.length === 0) {
        issues.push(`financial.derivedFacts.budgetAdvisories.${index}`)
        return
      }
      advisory.evidenceIds.forEach((id: string) => references.set(id,
        'financial.budgetAdvisory.highCareLowBudget'))
      advisory.triggerEvidenceIds.forEach((id: string) => references.set(id, 'financial.budgetAdvisory.trigger'))
    })
  }
  if (!isPlainRecordV2(profile.intent) || !isPlainRecordV2(profile.intent.rawFacts)
    || !isOneOf(profile.intent.rawFacts.moveInTiming, MOVE_IN_VALUES)
    || !isOneOf(profile.intent.rawFacts.consultantIntent, CONSULTANT_VALUES)) {
    issues.push('profile.intent.rawFacts')
  } else {
    validateQuestion('budget.moveInTiming', profile.intent.rawFacts.moveInTiming,
      'intent.rawFacts.moveInTiming', issues)
    validateQuestion('budget.consultantSupport', profile.intent.rawFacts.consultantIntent,
      'intent.rawFacts.consultantIntent', issues)
  }
  const summary = profile.userFacingSummary
  if (!isPlainRecordV2(summary)
    || summary.summarySchemaVersion !== 'elder-profile-summary-input-v2'
    || !Array.isArray(summary.sections)
    || summary.sections.length !== SUMMARY_SECTIONS_V2.length
    || !summary.sections.every((section, index) => isPlainRecordV2(section)
      && section.section === SUMMARY_SECTIONS_V2[index]
      && Array.isArray(section.items)
      && section.items.every((item) => isPlainRecordV2(item)
        && isNonEmptyStringV2(item.summaryCode)
        && Array.isArray(item.sources) && item.sources.length > 0
        && item.sources.every((source) => isPlainRecordV2(source)
          && (source.kind === 'raw_fact'
            ? isAssessmentQuestionIdV2(source.sourceQuestionId)
            : source.kind === 'derived_fact'
              && isNonEmptyStringV2(source.derivedField)
              && isKnownDerivedFieldV2(source.derivedField)
              && isStringArray(source.evidenceIds)
              && source.evidenceIds.length > 0))))) {
    issues.push('profile.userFacingSummary')
  }
  return { issues, references }
}

interface ProfileFactRowV2 {
  field: string
  outcome: string
  evidenceIds: readonly string[]
  clarificationIds?: readonly string[]
}

const profileFactRowsV2 = (profile: RecommendationProfileV2): ProfileFactRowV2[] => {
  const rows: ProfileFactRowV2[] = []
  const addFact = (field: string, fact: {
    status: string
    value?: unknown
    evidenceIds: readonly string[]
    clarificationIds?: readonly string[]
  }): void => {
    rows.push({
      field,
      outcome: fact.status === 'known' ? String(fact.value) : fact.status,
      evidenceIds: fact.evidenceIds,
      ...(fact.status === 'known' ? {} : { clarificationIds: fact.clarificationIds }),
    })
  }
  addFact('adl.careLevel', profile.adl.derivedFacts.careLevel)
  profile.adl.derivedFacts.careModes.forEach((mode) => rows.push({
    field: `adl.careModes.${mode.code}`,
    outcome: mode.status,
    evidenceIds: mode.evidenceIds,
    clarificationIds: mode.clarificationIds,
  }))
  addFact('mobility.level', profile.mobility.derivedFacts.level)
  addFact('health.rehabilitationNeed', profile.health.derivedFacts.rehabilitationNeed)
  ;(['cognitiveConcern', 'reportedDiagnosis', 'wanderingRisk', 'behavioralRisk', 'sleepCycleIssue'] as const)
    .forEach((field) => addFact(`cognition.${field}`, profile.cognition.derivedFacts[field]))
  profile.specialCare.derivedFacts.requiredCareCapabilities.forEach((requirement) => rows.push({
    field: `specialCare.requiredCareCapabilities.${requirement.capability}`,
    outcome: requirement.status,
    evidenceIds: requirement.evidenceIds,
    clarificationIds: requirement.clarificationIds,
  }))
  addFact('nutrition.foodTextureSupport', profile.nutrition.derivedFacts.foodTextureSupport)
  addFact('nutrition.swallowingConcern', profile.nutrition.derivedFacts.swallowingConcern)
  rows.push({
    field: 'preference.roomTypePreference',
    outcome: profile.preference.rawFacts.roomTypePreference,
    evidenceIds: ['ev:preference.roomTypePreference'],
  })
  rows.push({
    field: 'preference.mealSchedulePreference',
    outcome: profile.preference.rawFacts.mealSchedulePreference,
    evidenceIds: ['ev:preference.mealSchedulePreference'],
  })
  rows.push({
    field: 'preference.activityPreference',
    outcome: profile.preference.rawFacts.activityPreference,
    evidenceIds: ['ev:preference.activityPreference'],
  })
  rows.push({
    field: 'preference.priorities',
    outcome: 'reported',
    evidenceIds: ['ev:preference.priorities'],
  })
  profile.financial.derivedFacts.budgetAdvisories.forEach((advisory) => rows.push({
    field: 'financial.budgetAdvisory.highCareLowBudget',
    outcome: 'present',
    evidenceIds: advisory.evidenceIds,
  }))
  return rows
}

const profileSourceAnswersV2 = (profile: RecommendationProfileV2): Record<string, unknown> => {
  const answers: Record<string, unknown> = {
    'basic.relationship': profile.basic.rawFacts.relation,
    'basic.gender': profile.basic.rawFacts.sex,
    'basic.age': profile.basic.rawFacts.age,
    'health.conditions': profile.health.rawFacts.reportedDiseases,
    'health.recentEvents': profile.health.rawFacts.recentHealthRisks,
    'health.rehabilitationNeed': profile.health.rawFacts.rehabilitationNeedAnswer,
    'health.chewingAbility': profile.nutrition.rawFacts.chewingAbilityAnswer,
    'health.swallowingAbility': profile.nutrition.rawFacts.swallowingAbilityAnswer,
    'cognitive.symptoms': profile.cognition.rawFacts.reportedSymptoms,
    'cognitive.specialCareNeeds': profile.specialCare.rawFacts.answers,
    'preference.careType': profile.preference.rawFacts.preferredInstitutionType,
    'preference.roomType': profile.preference.rawFacts.roomTypePreference,
    'preference.mealSchedule': profile.preference.rawFacts.mealSchedulePreference,
    'preference.activityPreference': profile.preference.rawFacts.activityPreference,
    'preference.priorities': profile.preference.rawFacts.priorities,
    'budget.monthlyRange': profile.financial.rawFacts.monthlyBudget,
    'budget.upfrontCostAcceptance': profile.financial.rawFacts.depositTolerance,
    'budget.moveInTiming': profile.intent.rawFacts.moveInTiming,
    'budget.consultantSupport': profile.intent.rawFacts.consultantIntent,
  }
  ;(['eating', 'mobility', 'toileting', 'bathing', 'dressing', 'transfer', 'stairs'] as const)
    .forEach((field) => { answers[`adl.${field}`] = profile.adl.rawAnswers[field] })
  const basicOptional: readonly [keyof typeof profile.basic.rawFacts, AssessmentQuestionIdV2][] = [
    ['name', 'basic.elderName'],
    ['livingStatus', 'basic.livingStatus'],
    ['primaryCaregiver', 'basic.primaryCaregiver'],
    ['hasInstitutionExperience', 'basic.hasInstitutionExperience'],
    ['institutionExitReasons', 'basic.institutionExitReasons'],
  ]
  basicOptional.forEach((item) => {
    const value = profile.basic.rawFacts[item[0]]
    if (value !== undefined) answers[item[1]] = value
  })
  if (profile.preference.rawFacts.regionPreference !== undefined) {
    answers['preference.region'] = profile.preference.rawFacts.regionPreference
  }
  return answers
}

const isAssessmentEvidenceSourceV2 = (value: unknown): boolean => {
  if (!isPlainRecordV2(value) || !isAssessmentQuestionIdV2(value.sourceQuestionId)) return false
  const definition = ASSESSMENT_QUESTION_DEFINITIONS_V2[value.sourceQuestionId]
  const allowed = definition.allowedValues || []
  if (value.sourceKind === 'assessment_option') {
    return isOneOf(value.sourceOptionCode, allowed)
      && isOneOf(value.contribution, EVIDENCE_CONTRIBUTIONS)
  }
  if (value.sourceKind === 'assessment_answer_set') {
    return definition.type === 'multi_choice'
      && isStringArray(value.sourceOptionCodes)
      && value.sourceOptionCodes.length > 0
      && isValidAnswerForQuestionV2(value.sourceQuestionId, value.sourceOptionCodes)
      && isOneOf(value.targetOptionCode, allowed)
      && (value.sourceOptionCodes as readonly string[]).indexOf(value.targetOptionCode as string) < 0
      && value.contribution === 'establishes_not_reported'
  }
  return false
}

const sourceMatchesProfileV2 = (
  source: Record<string, unknown>,
  answers: Readonly<Record<string, unknown>>,
): boolean => {
  const answer = answers[source.sourceQuestionId as string]
  if (source.sourceKind === 'assessment_option') {
    return Array.isArray(answer)
      ? answer.indexOf(source.sourceOptionCode) >= 0
      : answer === source.sourceOptionCode
  }
  if (!Array.isArray(answer) || !Array.isArray(source.sourceOptionCodes)) return false
  const sourceOptionCodes = source.sourceOptionCodes as readonly unknown[]
  return answer.length === sourceOptionCodes.length
    && answer.every((code, index) => code === sourceOptionCodes[index])
}

const stableValueSignatureV2 = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValueSignatureV2(item)).join(',')}]`
  }
  if (isPlainRecordV2(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableValueSignatureV2(value[key])}`).join(',')}}`
  }
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

const sameUnorderedValuesV2 = (
  left: readonly unknown[],
  right: readonly unknown[],
): boolean => {
  if (left.length !== right.length) return false
  const leftSignatures = left.map(stableValueSignatureV2).sort()
  const rightSignatures = right.map(stableValueSignatureV2).sort()
  return leftSignatures.every((signature, index) => signature === rightSignatures[index])
}

const evidenceMatchesCanonicalV2 = (
  actual: DerivationEvidenceV2,
  expected: DerivationEvidenceV2,
): boolean => actual.evidenceId === expected.evidenceId
  && actual.derivedField === expected.derivedField
  && actual.outcomeCode === expected.outcomeCode
  && actual.ruleId === expected.ruleId
  && sameUnorderedValuesV2(actual.sources, expected.sources)

const clarificationMatchesCanonicalV2 = (
  actual: ProfileClarificationV2,
  expected: ProfileClarificationV2,
): boolean => actual.clarificationId === expected.clarificationId
  && actual.status === expected.status
  && actual.reasonCode === expected.reasonCode
  && actual.priority === expected.priority
  && sameUnorderedValuesV2(actual.sources, expected.sources)
  && sameUnorderedValuesV2(actual.affectedDerivedFields, expected.affectedDerivedFields)

const CANONICAL_SEMANTIC_SECTION_KEYS_V2: readonly (keyof ElderProfileSemanticPayloadV2)[] = [
  'basic', 'health', 'nutrition', 'adl', 'mobility', 'cognition', 'specialCare',
  'preference', 'financial', 'intent', 'userFacingSummary',
]

const canonicalSemanticIssuesV2 = (
  profile: RecommendationProfileV2,
  canonical: ElderProfileSemanticPayloadV2,
): readonly string[] => CANONICAL_SEMANTIC_SECTION_KEYS_V2
  .filter((key) => stableValueSignatureV2(profile[key]) !== stableValueSignatureV2(canonical[key]))
  .map((key) => `profile.${key}.canonical`)

interface CareModeEvidenceRequirementV2 {
  questionId: AssessmentQuestionIdV2
  optionCode: string
  ruleId: string
}

const CARE_MODE_EVIDENCE_REQUIREMENTS_V2: Readonly<Record<string, CareModeEvidenceRequirementV2>> = {
  feeding_minor: { questionId: 'adl.eating', optionCode: 'minor_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  feeding_dependence: { questionId: 'adl.eating', optionCode: 'needs_feeding', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  special_feeding_review: { questionId: 'adl.eating', optionCode: 'special_feeding', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  walking_aid: { questionId: 'adl.mobility', optionCode: 'walking_aid', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  wheelchair: { questionId: 'adl.mobility', optionCode: 'wheelchair', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  bedridden: { questionId: 'adl.mobility', optionCode: 'bedridden', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  toileting_minor: { questionId: 'adl.toileting', optionCode: 'occasional_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  incontinence: { questionId: 'adl.toileting', optionCode: 'frequent_incontinence', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  toileting_full_assistance: { questionId: 'adl.toileting', optionCode: 'full_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  catheter_or_stoma_review: { questionId: 'adl.toileting', optionCode: 'catheter_or_stoma', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  bathing_partial: { questionId: 'adl.bathing', optionCode: 'partial_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  bathing_full_assistance: { questionId: 'adl.bathing', optionCode: 'full_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  dressing_partial: { questionId: 'adl.dressing', optionCode: 'partial_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  dressing_full_assistance: { questionId: 'adl.dressing', optionCode: 'full_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  transfer_minor: { questionId: 'adl.transfer', optionCode: 'minor_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  transfer_support: { questionId: 'adl.transfer', optionCode: 'needs_support', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  fully_dependent_transfer: { questionId: 'adl.transfer', optionCode: 'fully_dependent', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  stairs_assistance: { questionId: 'adl.stairs', optionCode: 'needs_assistance', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  stairs_unable: { questionId: 'adl.stairs', optionCode: 'unable', ruleId: 'adl-ruleset-v1:C_PROJECT_CARE_MODE' },
  no_stairs_context: { questionId: 'adl.stairs', optionCode: 'no_stairs', ruleId: 'adl-ruleset-v1:C_NO_STAIRS_NEUTRAL' },
}

const ADL_SOURCE_QUESTIONS_V2: readonly AssessmentQuestionIdV2[] = [
  'adl.eating', 'adl.mobility', 'adl.toileting', 'adl.bathing',
  'adl.dressing', 'adl.transfer', 'adl.stairs',
]

const questionsForSpecialCareFieldV2 = (field: string): readonly AssessmentQuestionIdV2[] => {
  const capability = field.slice('specialCare.requiredCareCapabilities.'.length)
  const questions: AssessmentQuestionIdV2[] = ['cognitive.specialCareNeeds']
  if (capability === 'night_care') questions.push('cognitive.symptoms')
  if (capability === 'dementia_unit') questions.push('cognitive.symptoms', 'health.conditions')
  if (capability === 'rehabilitation_training') questions.push('health.rehabilitationNeed')
  if (capability === 'tube_feeding') questions.push('adl.eating')
  if (capability === 'catheter_care' || capability === 'incontinence_care') questions.push('adl.toileting')
  if (capability === 'pressure_injury_care') questions.push('health.recentEvents')
  return questions
}

const sourceMatchesDerivedFieldV2 = (
  field: string,
  source: Record<string, unknown>,
): boolean => {
  const questionId = source.sourceQuestionId as AssessmentQuestionIdV2
  if (field === 'adl.careLevel') return ADL_SOURCE_QUESTIONS_V2.indexOf(questionId) >= 0
  if (field.indexOf('adl.careModes.') === 0) {
    const mode = field.slice('adl.careModes.'.length)
    const requirement = CARE_MODE_EVIDENCE_REQUIREMENTS_V2[mode]
    return requirement !== undefined
      && source.sourceKind === 'assessment_option'
      && questionId === requirement.questionId
      && source.sourceOptionCode === requirement.optionCode
  }
  if (field === 'mobility.level') return questionId === 'adl.mobility'
  if (field === 'health.rehabilitationNeed') {
    return questionId === 'health.rehabilitationNeed' || questionId === 'cognitive.specialCareNeeds'
  }
  if (field === 'cognition.cognitiveConcern' || field === 'cognition.reportedDiagnosis') {
    return questionId === 'cognitive.symptoms' || questionId === 'health.conditions'
  }
  if (field === 'cognition.wanderingRisk'
    || field === 'cognition.behavioralRisk'
    || field === 'cognition.sleepCycleIssue') {
    return questionId === 'cognitive.symptoms'
  }
  if (field.indexOf('specialCare.requiredCareCapabilities.') === 0) {
    return questionsForSpecialCareFieldV2(field).indexOf(questionId) >= 0
  }
  if (field === 'nutrition.foodTextureSupport') return questionId === 'health.chewingAbility'
  if (field === 'nutrition.swallowingConcern') return questionId === 'health.swallowingAbility'
  if (field === 'preference.roomTypePreference') return questionId === 'preference.roomType'
  if (field === 'preference.mealSchedulePreference') return questionId === 'preference.mealSchedule'
  if (field === 'preference.activityPreference') return questionId === 'preference.activityPreference'
  if (field === 'preference.priorities') return questionId === 'preference.priorities'
  if (field === 'financial.budgetAdvisory.highCareLowBudget') {
    return questionId === 'budget.monthlyRange'
      || ADL_SOURCE_QUESTIONS_V2.indexOf(questionId) >= 0
      || questionId === 'cognitive.specialCareNeeds'
      || questionId === 'cognitive.symptoms'
      || questionId === 'health.conditions'
      || questionId === 'health.rehabilitationNeed'
      || questionId === 'health.recentEvents'
  }
  return false
}

const ruleMatchesFieldV2 = (field: string, ruleId: string): boolean => {
  if (field === 'adl.careLevel') return [
    'C_UNKNOWN_BLOCK', 'C_SEVERE_OVERRIDE', 'C_DEPENDENT_FLOOR', 'C_TWO_HALF_ESCALATION',
    'C_NON_CORE_HALF_FALLBACK', 'C_HALF_FLOOR', 'C_TWO_LIGHT_ESCALATION', 'C_NO_BURDEN',
  ].some((code) => ruleId === `adl-ruleset-v1:${code}`)
  if (field.indexOf('adl.careModes.') === 0) {
    const mode = field.slice('adl.careModes.'.length)
    const requirement = CARE_MODE_EVIDENCE_REQUIREMENTS_V2[mode]
    return requirement !== undefined && ruleId === requirement.ruleId
  }
  const baseRuleCodes: Record<string, string> = {
    'mobility.level': 'MOBILITY_DIRECT',
    'health.rehabilitationNeed': 'REHABILITATION',
    'cognition.cognitiveConcern': 'COGNITIVE_CONCERN',
    'cognition.reportedDiagnosis': 'REPORTED_DIAGNOSIS',
    'cognition.wanderingRisk': 'WANDERING_RISK',
    'cognition.behavioralRisk': 'BEHAVIORAL_RISK',
    'cognition.sleepCycleIssue': 'SLEEP_CYCLE',
  }
  if (field.indexOf('specialCare.requiredCareCapabilities.') === 0) {
    return ruleId === 'elder-profile-ruleset-v1:CARE_CAPABILITY'
  }
  if (baseRuleCodes[field] !== undefined) return ruleId === `elder-profile-ruleset-v1:${baseRuleCodes[field]}`
  if (field === 'nutrition.foodTextureSupport') return ruleId === 'elder-profile-ruleset-v2:NUTRITION_FOOD_TEXTURE'
  if (field === 'nutrition.swallowingConcern') return ruleId === 'elder-profile-ruleset-v2:NUTRITION_SWALLOWING_CONCERN'
  if (field.indexOf('preference.') === 0) return ruleId === 'elder-profile-ruleset-v2:PREFERENCE_FACT'
  return field === 'financial.budgetAdvisory.highCareLowBudget'
    && ruleId === 'elder-profile-ruleset-v2:HIGH_CARE_LOW_BUDGET_ADVISORY'
}

const validateEvidence = (
  profile: RecommendationProfileV2,
  _references: ReadonlyMap<string, string>,
  canonicalEvidence: readonly DerivationEvidenceV2[],
): readonly string[] => {
  const issues: string[] = []
  if (!Array.isArray(profile.evidence) || profile.evidence.length === 0) return ['profile.evidence']
  const evidenceIds: string[] = []
  profile.evidence.forEach((entry) => { evidenceIds.push(entry.evidenceId) })
  if (!evidenceIds.every(isNonEmptyStringV2) || !hasUniqueStringsV2(evidenceIds)) {
    issues.push('profile.evidence')
  }
  const rows = profileFactRowsV2(profile)
  const answers = profileSourceAnswersV2(profile)
  profile.evidence.forEach((entry, index) => {
    if (!isPlainRecordV2(entry) || !isNonEmptyStringV2(entry.evidenceId)
      || !isNonEmptyStringV2(entry.derivedField)
      || !isKnownDerivedFieldV2(entry.derivedField)
      || entry.evidenceId !== `ev:${entry.derivedField}`
      || !isNonEmptyStringV2(entry.outcomeCode)
      || !isNonEmptyStringV2(entry.ruleId)
      || !ruleMatchesFieldV2(entry.derivedField, entry.ruleId)
      || !Array.isArray(entry.sources) || entry.sources.length === 0
      || entry.sources.some((source) => !isAssessmentEvidenceSourceV2(source)
        || !sourceMatchesProfileV2(source as Record<string, unknown>, answers)
        || !sourceMatchesDerivedFieldV2(entry.derivedField as string, source as Record<string, unknown>))) {
      issues.push(`profile.evidence.${index}`)
    }
  })
  rows.forEach((row) => {
    row.evidenceIds.forEach((evidenceId) => {
      const evidence = profile.evidence.find((entry) => entry.evidenceId === evidenceId)
      if (!evidence || evidence.derivedField !== row.field || evidence.outcomeCode !== row.outcome) {
        issues.push(`${row.field}.evidenceIds`)
      }
    })
  })
  profile.evidence.forEach((entry) => {
    if (!rows.some((row) => row.field === entry.derivedField
      && row.evidenceIds.indexOf(entry.evidenceId) >= 0)) {
      issues.push(`profile.evidence.${entry.evidenceId}`)
    }
  })
  if (profile.evidence.length !== canonicalEvidence.length) issues.push('profile.evidence.canonical')
  profile.evidence.forEach((entry) => {
    const canonical = canonicalEvidence.find((candidate) => candidate.evidenceId === entry.evidenceId)
    if (!canonical || !evidenceMatchesCanonicalV2(entry, canonical)) {
      issues.push(`profile.evidence.${entry.evidenceId}.canonical`)
    }
  })
  canonicalEvidence.forEach((entry) => {
    if (!profile.evidence.some((candidate) => candidate.evidenceId === entry.evidenceId)) {
      issues.push(`profile.evidence.${entry.evidenceId}.missing`)
    }
  })
  profile.userFacingSummary.sections.forEach((section) => {
    section.items.forEach((item) => {
      item.sources.forEach((source) => {
        if (source.kind === 'raw_fact') {
          if (!hasOwn(answers, source.sourceQuestionId)) {
            issues.push(`profile.userFacingSummary.${item.summaryCode}`)
          }
        } else {
          source.evidenceIds.forEach((evidenceId) => {
            const evidence = profile.evidence.find((entry) => entry.evidenceId === evidenceId)
            if (!evidence || evidence.derivedField !== source.derivedField) {
              issues.push(`profile.userFacingSummary.${item.summaryCode}`)
            }
          })
        }
      })
    })
  })
  return issues
}

const validateClarifications = (
  profile: RecommendationProfileV2,
  canonicalClarifications: readonly ProfileClarificationV2[],
): readonly string[] => {
  if (!Array.isArray(profile.clarifications)) return ['profile.clarifications']
  const issues: string[] = []
  const ids: string[] = []
  profile.clarifications.forEach((entry) => { ids.push(entry.clarificationId) })
  if (!ids.every(isNonEmptyStringV2) || !hasUniqueStringsV2(ids)) issues.push('profile.clarifications')
  const answers = profileSourceAnswersV2(profile)
  const rows = profileFactRowsV2(profile)
  profile.clarifications.forEach((entry, index) => {
    const fields = entry.affectedDerivedFields as readonly string[]
    if (!isPlainRecordV2(entry)
      || !isNonEmptyStringV2(entry.clarificationId)
      || entry.status !== 'open'
      || !isOneOf(entry.reasonCode, CLARIFICATION_REASONS)
      || entry.clarificationId.indexOf(`cl:${entry.reasonCode}:`) !== 0
      || entry.clarificationId === `cl:${entry.reasonCode}:`
      || !isOneOf(entry.priority, CLARIFICATION_PRIORITIES)
      || !Array.isArray(entry.sources) || entry.sources.length === 0
      || entry.sources.some((source) => !isAssessmentEvidenceSourceV2(source)
        || !sourceMatchesProfileV2(source as Record<string, unknown>, answers))
      || !Array.isArray(entry.affectedDerivedFields) || fields.length === 0
      || !fields.every(isKnownDerivedFieldV2)
      || !hasUniqueStringsV2(fields)) {
      issues.push(`profile.clarifications.${index}`)
      return
    }
    if (fields.some(isV2ExtensionField)
      && (entry.priority !== 'required_before_hard_filter'
        || (entry.reasonCode !== 'unknown_answer' && entry.reasonCode !== 'risk_signal_needs_confirmation'))) {
      issues.push(`profile.clarifications.${index}`)
    }
    if (!fields.every((field) => rows.some((row) => row.field === field))) {
      issues.push(`profile.clarifications.${index}.affectedDerivedFields`)
    }
  })
  const referencedClarifications: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isPlainRecordV2(value)) return
    if (Array.isArray(value.clarificationIds)) {
      value.clarificationIds.forEach((id) => {
        if (typeof id === 'string' && referencedClarifications.indexOf(id) < 0) referencedClarifications.push(id)
      })
    }
    Object.keys(value).forEach((key) => visit(value[key]))
  }
  visit({
    adl: profile.adl.derivedFacts,
    mobility: profile.mobility.derivedFacts,
    health: profile.health.derivedFacts,
    cognition: profile.cognition.derivedFacts,
    specialCare: profile.specialCare.derivedFacts,
    nutrition: profile.nutrition.derivedFacts,
  })
  referencedClarifications.forEach((id) => {
    const clarification = profile.clarifications.find((entry) => entry.clarificationId === id)
    const row = rows.find((entry) => entry.clarificationIds !== undefined
      && entry.clarificationIds.indexOf(id) >= 0)
    if (!clarification || !row
      || (clarification.affectedDerivedFields as readonly string[]).indexOf(row.field) < 0) {
      issues.push(`profile.clarifications.${id}`)
    }
  })
  profile.clarifications.forEach((entry) => {
    const referenced = rows.some((row) => row.clarificationIds !== undefined
      && row.clarificationIds.indexOf(entry.clarificationId) >= 0)
    // Frozen other_without_detail is an independent recommended prompt, not a
    // fact's unresolved requirement. Only the exact canonical prompt is exempt.
    const canonicalOtherWithoutDetail = entry.reasonCode === 'other_without_detail'
      && entry.priority === 'recommended'
      && canonicalClarifications.some((canonical) => clarificationMatchesCanonicalV2(entry, canonical))
    if (!referenced && !canonicalOtherWithoutDetail) {
      issues.push(`profile.clarifications.${entry.clarificationId}`)
    }
  })
  if (profile.clarifications.length !== canonicalClarifications.length) {
    issues.push('profile.clarifications.canonical')
  }
  profile.clarifications.forEach((entry) => {
    const canonical = canonicalClarifications.find((candidate) =>
      candidate.clarificationId === entry.clarificationId)
    if (!canonical || !clarificationMatchesCanonicalV2(entry, canonical)) {
      issues.push(`profile.clarifications.${entry.clarificationId}.canonical`)
    }
  })
  canonicalClarifications.forEach((entry) => {
    if (!profile.clarifications.some((candidate) => candidate.clarificationId === entry.clarificationId)) {
      issues.push(`profile.clarifications.${entry.clarificationId}.missing`)
    }
  })
  return issues
}

const isV2ExtensionField = (value: string): boolean =>
  value.indexOf('nutrition.') === 0
  || value.indexOf('preference.') === 0
  || value.indexOf('financial.budgetAdvisory.') === 0

const isBaseClarification = (
  clarification: ProfileClarificationV2,
): clarification is ProfileClarification =>
  (clarification.affectedDerivedFields as readonly string[])
    .every((field: string) => !isV2ExtensionField(field))

const derivedRef = (
  derivedField: ElderProfileDerivedFieldV2,
  evidenceId: string,
): ElderEvidenceRefV2 => ({ kind: 'derived_evidence_v2', derivedField, evidenceId })

const buildReadinessV2 = (
  profile: RecommendationProfileV2,
): {
  elderReadiness: ValidatedProfileSnapshotV2['elderReadiness']
  requirementReadiness: readonly RequirementReadinessV2[]
} => {
  const baseClarifications = profile.clarifications.filter(isBaseClarification)
  const base = evaluateFrozenSafetyReadiness({
    adl: profile.adl,
    mobility: profile.mobility,
    health: profile.health,
    cognition: profile.cognition,
    specialCare: profile.specialCare,
    clarifications: baseClarifications,
  })
  const entries: RequirementReadinessV2[] = base.requirementReadiness.map((entry) =>
    copyDomainDataV2(entry) as RequirementReadinessV2)
  profile.clarifications.forEach((clarification) => {
    if (clarification.priority !== 'required_before_hard_filter'
      || !(clarification.affectedDerivedFields as readonly string[]).some(isV2ExtensionField)) return
    ;(clarification.affectedDerivedFields as readonly ElderProfileDerivedFieldV2[]).forEach((field) => {
      const evidence = profile.evidence.filter((entry) => entry.derivedField === field)
      entries.push({
        code: 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION',
        sourceDerivedField: field,
        disposition: 'unresolved',
        blocksEligibility: true,
        clarificationIds: [clarification.clarificationId],
        elderEvidenceRefs: evidence.map((entry) => derivedRef(field, entry.evidenceId)),
      })
    })
  })
  entries.sort((left, right) => {
    const code = left.code < right.code ? -1 : left.code > right.code ? 1 : 0
    if (code !== 0) return code
    return left.sourceDerivedField < right.sourceDerivedField ? -1
      : left.sourceDerivedField > right.sourceDerivedField ? 1 : 0
  })
  return {
    elderReadiness: entries.some((entry) => entry.blocksEligibility)
      ? 'blocked_by_required_clarification' : 'ready',
    requirementReadiness: entries,
  }
}

const createSnapshot = (profile: RecommendationProfileV2): RecommendationElderSemanticSnapshotV2 => ({
  adl: copyDomainDataV2(profile.adl.derivedFacts),
  mobility: copyDomainDataV2(profile.mobility.derivedFacts),
  health: copyDomainDataV2(profile.health.derivedFacts),
  cognition: copyDomainDataV2(profile.cognition.derivedFacts),
  specialCare: copyDomainDataV2(profile.specialCare.derivedFacts),
  nutrition: copyDomainDataV2(profile.nutrition.derivedFacts),
  preference: copyDomainDataV2({
    ...profile.preference.rawFacts,
    priorities: sortPrioritiesV2(profile.preference.rawFacts.priorities),
  }),
  financial: copyDomainDataV2({
    rawFacts: profile.financial.rawFacts,
    derivedFacts: profile.financial.derivedFacts,
  }),
  intent: copyDomainDataV2(profile.intent.rawFacts),
  evidence: sortAsciiV2(profile.evidence, (entry) => entry.evidenceId).map(copyDomainDataV2),
  clarifications: sortAsciiV2(profile.clarifications, (entry) => entry.clarificationId).map(copyDomainDataV2),
})

export const validateAndSnapshotProfileV2 = (
  input: unknown,
  expectedKind: RecommendationProfileV2['kind'],
): RecommendationEvaluationResultV2<ValidatedProfileSnapshotV2> => {
  const envelopeIssues: string[] = []
  if (!validateEnvelope(input, expectedKind, envelopeIssues)) {
    return { ok: false, error: makeError('UNSUPPORTED_PROFILE_VERSION', envelopeIssues) }
  }
  if (!isAcyclicData(input)) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', ['$']) }
  }
  const profile = input as RecommendationProfileV2
  const snapshotValidation = validateSnapshot(profile)
  if (snapshotValidation.issues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', snapshotValidation.issues) }
  }
  // Delegate provenance verification to the frozen upstream derivation. This
  // keeps Recommendation from copying ADL/profile rules while rejecting a
  // structurally valid envelope whose facts, evidence or summary were forged.
  const canonicalResult = deriveProfileSemanticsV2(
    profileSourceAnswersV2(profile) as unknown as AssessmentAnswerSnapshotV2,
  )
  if (!canonicalResult.ok) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', canonicalResult.error.questionIds) }
  }
  const semanticIssues = canonicalSemanticIssuesV2(profile, canonicalResult.semantics)
  if (semanticIssues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', semanticIssues) }
  }
  const evidenceIssues = validateEvidence(
    profile,
    snapshotValidation.references,
    canonicalResult.semantics.evidence,
  )
  if (evidenceIssues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_EVIDENCE', evidenceIssues) }
  }
  const clarificationIssues = validateClarifications(profile, canonicalResult.semantics.clarifications)
  if (clarificationIssues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_CLARIFICATION', clarificationIssues) }
  }
  const readiness = buildReadinessV2(profile)
  return {
    ok: true,
    value: {
      profile,
      snapshot: createSnapshot(profile),
      elderReadiness: readiness.elderReadiness,
      requirementReadiness: readiness.requirementReadiness,
      elderClarifications: sortAsciiV2(profile.clarifications, (entry) => entry.clarificationId)
        .map(copyDomainDataV2),
    },
  }
}

export const rawPreferenceEvidenceRefV2 = (
  profile: RecommendationProfileV2,
  field: 'room' | 'meal' | 'activity' | 'priorities',
): RecommendationProfileRawFactEvidenceRefV2 => {
  if (field === 'room') return {
    kind: 'profile_raw_fact_v2',
    profilePath: 'preference.rawFacts.roomTypePreference',
    sourceQuestionId: 'preference.roomType',
    valueSnapshot: profile.preference.rawFacts.roomTypePreference,
  }
  if (field === 'meal') return {
    kind: 'profile_raw_fact_v2',
    profilePath: 'preference.rawFacts.mealSchedulePreference',
    sourceQuestionId: 'preference.mealSchedule',
    valueSnapshot: profile.preference.rawFacts.mealSchedulePreference,
  }
  if (field === 'activity') return {
    kind: 'profile_raw_fact_v2',
    profilePath: 'preference.rawFacts.activityPreference',
    sourceQuestionId: 'preference.activityPreference',
    valueSnapshot: profile.preference.rawFacts.activityPreference,
  }
  return {
    kind: 'profile_raw_fact_v2',
    profilePath: 'preference.rawFacts.priorities',
    sourceQuestionId: 'preference.priorities',
    valueSnapshot: sortPrioritiesV2(profile.preference.rawFacts.priorities as readonly PreferencePriorityV2[]),
  }
}

export const derivedEvidenceRefsV2 = (
  derivedField: ElderProfileDerivedFieldV2,
  fact: { evidenceIds: readonly string[] },
): ElderEvidenceRefV2[] => sortAsciiV2(fact.evidenceIds, (id) => id)
  .map((evidenceId) => derivedRef(derivedField, evidenceId))
