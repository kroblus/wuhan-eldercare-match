import {
  ASSESSMENT_QUESTION_ID_LIST_V2,
  REQUIRED_ASSESSMENT_QUESTION_ORDER_V2,
  validateAssessmentAnswersV2,
} from '../../../types/assessment-v2'
import type {
  AssessmentAnswerSnapshotV2,
  AssessmentQuestionIdV2,
  PreferencePriorityV2,
} from '../../../types/assessment-v2'
import type {
  AssessmentAnswerSnapshot,
  AssessmentDraftAnswers,
  PreferencePriority,
} from '../../../types/assessment'
import type {
  AssessmentEvidenceSource,
  DerivationEvidence,
  ElderProfileSemanticPayload,
  ProfileClarification,
} from '../../../types/elder-profile'
import type {
  AssessmentEvidenceSourceV2,
  AssessmentOptionEvidenceSourceV2,
  BudgetAdvisoryTriggerCodeV2,
  BudgetAdvisoryV2,
  CodedAssessmentQuestionIdV2,
  DerivationEvidenceExtensionV2,
  DerivationEvidenceV2,
  ElderProfileDerivedFieldExtensionV2,
  ElderProfileSemanticPayloadV2,
  FinancialIntentProfileSummaryCodeV2,
  NutritionProfileDerivedFactsV2,
  NutritionProfileSummaryCodeV2,
  PreferenceProfileSummaryCodeV2,
  ProfileClarificationExtensionV2,
  ProfileClarificationV2,
  ProfileSummaryItemV2,
  ProfileSummarySectionV2,
} from '../../../types/elder-profile-v2'
import { deriveProfileSemantics } from '../derive-elder-profile'
import {
  HIGH_CARE_BUDGET_CAPABILITY_ORDER_V2,
  PROFILE_SUMMARY_SCHEMA_VERSION_V2,
  V2_PROFILE_RULE_IDS,
} from './rules-v2'

type RawRecord = Record<string, unknown>

export type V2AnswerSnapshotValidationResult =
  | { ok: true, answers: AssessmentAnswerSnapshotV2 }
  | {
    ok: false
    reason: 'incomplete' | 'invalid'
    questionIds: readonly AssessmentQuestionIdV2[]
  }

export type ProfileSemanticDerivationResultV2 =
  | { ok: true, semantics: ElderProfileSemanticPayloadV2 }
  | {
    ok: false
    error: {
      code: 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE' | 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE'
      questionIds: readonly AssessmentQuestionIdV2[]
    }
  }

type SharedPriorityCode = Extract<PreferencePriorityV2, PreferencePriority>

const SHARED_V1_PRIORITY_CODES: readonly SharedPriorityCode[] = [
  'medical_conditions',
  'rehabilitation_capability',
  'food_quality',
  'living_environment',
  'transportation',
  'price',
]

const hasOwn = (value: RawRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneSnapshotValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (isPlainRecord(value)) {
    return { ...value }
  }
  return value
}

export const validateAndCloneAssessmentAnswersV2 = (
  input: unknown,
): V2AnswerSnapshotValidationResult => {
  if (!isPlainRecord(input)) {
    return { ok: false, reason: 'invalid', questionIds: [] }
  }

  const missingRequired = REQUIRED_ASSESSMENT_QUESTION_ORDER_V2.filter((questionId) =>
    !hasOwn(input, questionId),
  )
  if (missingRequired.length > 0) {
    return { ok: false, reason: 'incomplete', questionIds: missingRequired }
  }

  const validation = validateAssessmentAnswersV2(input, false)
  if (!validation.valid) {
    return {
      ok: false,
      reason: 'invalid',
      questionIds: validation.invalidQuestionIds.slice(),
    }
  }

  const cloned: RawRecord = {}
  ASSESSMENT_QUESTION_ID_LIST_V2.forEach((questionId) => {
    if (hasOwn(input, questionId)) {
      cloned[questionId] = cloneSnapshotValue(input[questionId])
    }
  })
  return { ok: true, answers: cloned as AssessmentAnswerSnapshotV2 }
}

const isSharedV1Priority = (value: PreferencePriorityV2): value is SharedPriorityCode =>
  SHARED_V1_PRIORITY_CODES.indexOf(value as SharedPriorityCode) >= 0

/**
 * Explicit version-isolation projection used only to reuse unchanged V1 base
 * semantics. Its V1 preference and summary outputs are discarded and rebuilt
 * from the untouched V2 answers below.
 */
const projectV2AnswersToFrozenV1Core = (
  answers: AssessmentAnswerSnapshotV2,
): AssessmentAnswerSnapshot => {
  const projected: AssessmentDraftAnswers = {
    'basic.relationship': answers['basic.relationship'],
    'basic.gender': answers['basic.gender'],
    'basic.age': answers['basic.age'],
    'health.conditions': answers['health.conditions'].slice(),
    'health.recentEvents': answers['health.recentEvents'].slice(),
    'health.rehabilitationNeed': answers['health.rehabilitationNeed'],
    'adl.eating': answers['adl.eating'],
    'adl.mobility': answers['adl.mobility'],
    'adl.toileting': answers['adl.toileting'],
    'adl.bathing': answers['adl.bathing'],
    'adl.dressing': answers['adl.dressing'],
    'adl.transfer': answers['adl.transfer'],
    'adl.stairs': answers['adl.stairs'],
    'cognitive.symptoms': answers['cognitive.symptoms'].slice(),
    'cognitive.specialCareNeeds': answers['cognitive.specialCareNeeds'].slice(),
    'preference.careType': answers['preference.careType'],
    'preference.priorities': answers['preference.priorities'].filter(isSharedV1Priority),
    'budget.monthlyRange': answers['budget.monthlyRange'],
    'budget.upfrontCostAcceptance': answers['budget.upfrontCostAcceptance'],
    'budget.moveInTiming': answers['budget.moveInTiming'],
    'budget.consultantSupport': answers['budget.consultantSupport'],
  }

  if (answers['basic.elderName'] !== undefined) {
    projected['basic.elderName'] = answers['basic.elderName']
  }
  if (answers['basic.livingStatus'] !== undefined) {
    projected['basic.livingStatus'] = answers['basic.livingStatus']
  }
  if (answers['basic.primaryCaregiver'] !== undefined) {
    projected['basic.primaryCaregiver'] = answers['basic.primaryCaregiver']
  }
  if (answers['basic.hasInstitutionExperience'] !== undefined) {
    projected['basic.hasInstitutionExperience'] = answers['basic.hasInstitutionExperience']
  }
  if (answers['basic.institutionExitReasons'] !== undefined) {
    projected['basic.institutionExitReasons'] = answers['basic.institutionExitReasons'].slice()
  }
  if (answers['preference.region'] !== undefined) {
    projected['preference.region'] = { ...answers['preference.region'] }
  }
  return projected as AssessmentAnswerSnapshot
}

const optionSourceV2 = (
  sourceQuestionId: CodedAssessmentQuestionIdV2,
  sourceOptionCode: string,
  contribution: AssessmentOptionEvidenceSourceV2['contribution'],
): AssessmentOptionEvidenceSourceV2 => ({
  sourceKind: 'assessment_option',
  sourceQuestionId,
  sourceOptionCode,
  contribution,
} as AssessmentOptionEvidenceSourceV2)

const createEvidenceV2 = (
  derivedField: ElderProfileDerivedFieldExtensionV2,
  outcomeCode: DerivationEvidenceExtensionV2['outcomeCode'],
  ruleId: DerivationEvidenceExtensionV2['ruleId'],
  sources: readonly [AssessmentEvidenceSourceV2, ...AssessmentEvidenceSourceV2[]],
): DerivationEvidenceExtensionV2 => ({
  evidenceId: `ev:${derivedField}` as DerivationEvidenceExtensionV2['evidenceId'],
  derivedField,
  outcomeCode,
  ruleId,
  sources,
})

const createClarificationV2 = (
  clarificationId: ProfileClarificationExtensionV2['clarificationId'],
  reasonCode: ProfileClarificationExtensionV2['reasonCode'],
  sources: readonly [AssessmentEvidenceSourceV2, ...AssessmentEvidenceSourceV2[]],
  affectedDerivedFields: readonly [ElderProfileDerivedFieldExtensionV2, ...ElderProfileDerivedFieldExtensionV2[]],
): ProfileClarificationExtensionV2 => ({
  clarificationId,
  status: 'open',
  reasonCode,
  priority: 'required_before_hard_filter',
  sources,
  affectedDerivedFields,
})

const deriveNutrition = (
  answers: AssessmentAnswerSnapshotV2,
): {
  derivedFacts: NutritionProfileDerivedFactsV2
  evidence: readonly DerivationEvidenceExtensionV2[]
  clarifications: readonly ProfileClarificationExtensionV2[]
} => {
  const chewing = answers['health.chewingAbility']
  const swallowing = answers['health.swallowingAbility']
  const foodTextureField = 'nutrition.foodTextureSupport' as const
  const swallowingField = 'nutrition.swallowingConcern' as const
  const foodTextureEvidenceId = `ev:${foodTextureField}`
  const swallowingEvidenceId = `ev:${swallowingField}`
  const clarifications: ProfileClarificationExtensionV2[] = []

  let foodTextureSupport: NutritionProfileDerivedFactsV2['foodTextureSupport']
  const chewingSource = optionSourceV2(
    'health.chewingAbility',
    chewing,
    chewing === 'unknown' ? 'requires_clarification' : 'supports',
  )
  if (chewing === 'unknown') {
    const clarificationId = 'cl:unknown_answer:health.chewingAbility' as const
    clarifications.push(createClarificationV2(
      clarificationId,
      'unknown_answer',
      [chewingSource],
      [foodTextureField],
    ))
    foodTextureSupport = {
      status: 'unknown',
      confidence: 'needs_confirmation',
      evidenceIds: [foodTextureEvidenceId],
      clarificationIds: [clarificationId],
    }
  } else {
    foodTextureSupport = {
      status: 'known',
      value: chewing === 'normal' ? 'standard' : chewing,
      confidence: 'high',
      evidenceIds: [foodTextureEvidenceId],
    }
  }
  const foodTextureEvidence = createEvidenceV2(
    foodTextureField,
    chewing === 'unknown' ? 'unknown' : foodTextureSupport.status === 'known' ? foodTextureSupport.value : 'unknown',
    V2_PROFILE_RULE_IDS.nutritionFoodTexture,
    [chewingSource],
  )

  let swallowingConcern: NutritionProfileDerivedFactsV2['swallowingConcern']
  const swallowingSource = optionSourceV2(
    'health.swallowingAbility',
    swallowing,
    swallowing === 'normal' ? 'supports' : 'requires_clarification',
  )
  if (swallowing === 'normal') {
    swallowingConcern = {
      status: 'known',
      value: 'normal',
      confidence: 'high',
      evidenceIds: [swallowingEvidenceId],
    }
  } else if (swallowing === 'unknown') {
    const clarificationId = 'cl:unknown_answer:health.swallowingAbility' as const
    clarifications.push(createClarificationV2(
      clarificationId,
      'unknown_answer',
      [swallowingSource],
      [swallowingField],
    ))
    swallowingConcern = {
      status: 'unknown',
      confidence: 'needs_confirmation',
      evidenceIds: [swallowingEvidenceId],
      clarificationIds: [clarificationId],
    }
  } else {
    const clarificationId = 'cl:risk_signal_needs_confirmation:nutrition.swallowingConcern' as const
    clarifications.push(createClarificationV2(
      clarificationId,
      'risk_signal_needs_confirmation',
      [swallowingSource],
      [swallowingField],
    ))
    swallowingConcern = {
      status: 'needs_confirmation',
      confidence: 'needs_confirmation',
      candidateValue: swallowing,
      evidenceIds: [swallowingEvidenceId],
      clarificationIds: [clarificationId],
    }
  }
  const swallowingEvidence = createEvidenceV2(
    swallowingField,
    swallowing === 'normal'
      ? 'normal'
      : swallowing === 'unknown'
        ? 'unknown'
        : 'needs_confirmation',
    V2_PROFILE_RULE_IDS.nutritionSwallowingConcern,
    [swallowingSource],
  )

  return {
    derivedFacts: { foodTextureSupport, swallowingConcern },
    evidence: [foodTextureEvidence, swallowingEvidence],
    clarifications,
  }
}

const derivePreferenceEvidence = (
  answers: AssessmentAnswerSnapshotV2,
): readonly DerivationEvidenceExtensionV2[] => {
  const priorities = answers['preference.priorities']
  const prioritySources = priorities.map((priority) =>
    optionSourceV2('preference.priorities', priority, 'supports'),
  ) as [AssessmentOptionEvidenceSourceV2, ...AssessmentOptionEvidenceSourceV2[]]
  return [
    createEvidenceV2(
      'preference.roomTypePreference',
      answers['preference.roomType'],
      V2_PROFILE_RULE_IDS.preferenceFact,
      [optionSourceV2('preference.roomType', answers['preference.roomType'], 'supports')],
    ),
    createEvidenceV2(
      'preference.mealSchedulePreference',
      answers['preference.mealSchedule'],
      V2_PROFILE_RULE_IDS.preferenceFact,
      [optionSourceV2('preference.mealSchedule', answers['preference.mealSchedule'], 'supports')],
    ),
    createEvidenceV2(
      'preference.activityPreference',
      answers['preference.activityPreference'],
      V2_PROFILE_RULE_IDS.preferenceFact,
      [optionSourceV2('preference.activityPreference', answers['preference.activityPreference'], 'supports')],
    ),
    createEvidenceV2(
      'preference.priorities',
      'reported',
      V2_PROFILE_RULE_IDS.preferenceFact,
      prioritySources,
    ),
  ]
}

const cloneEvidenceSource = (source: AssessmentEvidenceSource): AssessmentEvidenceSourceV2 => {
  if (source.sourceKind === 'assessment_answer_set') {
    return {
      ...source,
      sourceOptionCodes: source.sourceOptionCodes.slice(),
    } as unknown as AssessmentEvidenceSourceV2
  }
  return { ...source } as AssessmentEvidenceSourceV2
}

const sourceSignature = (source: AssessmentEvidenceSourceV2): string =>
  JSON.stringify(source)

const uniqueEvidenceSources = (
  sources: readonly AssessmentEvidenceSourceV2[],
): AssessmentEvidenceSourceV2[] => {
  const result: AssessmentEvidenceSourceV2[] = []
  sources.forEach((source) => {
    const signature = sourceSignature(source)
    if (!result.some((candidate) => sourceSignature(candidate) === signature)) {
      result.push(source)
    }
  })
  return result
}

const findEvidenceById = (
  evidence: readonly DerivationEvidence[],
  evidenceId: string,
): DerivationEvidence | undefined => evidence.find((item) => item.evidenceId === evidenceId)

const deriveBudgetAdvisory = (
  answers: AssessmentAnswerSnapshotV2,
  baseSemantics: ElderProfileSemanticPayload,
): {
  advisories: readonly BudgetAdvisoryV2[]
  evidence: readonly DerivationEvidenceExtensionV2[]
} => {
  if (answers['budget.monthlyRange'] !== 'cny_3500_5000') {
    return { advisories: [], evidence: [] }
  }

  const triggerCodes: BudgetAdvisoryTriggerCodeV2[] = []
  const triggerEvidenceIds: string[] = []
  const careLevel = baseSemantics.adl.derivedFacts.careLevel
  if (careLevel.status === 'known'
    && (careLevel.value === 'disabled' || careLevel.value === 'severely_disabled')) {
    triggerCodes.push(`care_level.${careLevel.value}` as BudgetAdvisoryTriggerCodeV2)
    triggerEvidenceIds.push(careLevel.evidenceIds[0])
  }

  HIGH_CARE_BUDGET_CAPABILITY_ORDER_V2.forEach((capabilityCode) => {
    const requirement = baseSemantics.specialCare.derivedFacts.requiredCareCapabilities.find((item) =>
      item.capability === capabilityCode,
    )
    if (requirement && requirement.status === 'required') {
      triggerCodes.push(`special_care.${capabilityCode}` as BudgetAdvisoryTriggerCodeV2)
      triggerEvidenceIds.push(requirement.evidenceIds[0])
    }
  })

  if (triggerCodes.length === 0) {
    return { advisories: [], evidence: [] }
  }

  const budgetSource = optionSourceV2(
    'budget.monthlyRange',
    'cny_3500_5000',
    'supports',
  )
  const inheritedSources: AssessmentEvidenceSourceV2[] = []
  triggerEvidenceIds.forEach((evidenceId) => {
    const evidence = findEvidenceById(baseSemantics.evidence, evidenceId)
    if (evidence) {
      evidence.sources.forEach((source) => inheritedSources.push(cloneEvidenceSource(source)))
    }
  })
  const sources = uniqueEvidenceSources([budgetSource, ...inheritedSources]) as [
    AssessmentEvidenceSourceV2,
    ...AssessmentEvidenceSourceV2[],
  ]
  const advisoryField = 'financial.budgetAdvisory.highCareLowBudget' as const
  const advisoryEvidence = createEvidenceV2(
    advisoryField,
    'present',
    V2_PROFILE_RULE_IDS.highCareLowBudgetAdvisory,
    sources,
  )
  const advisory: BudgetAdvisoryV2 = {
    code: 'HIGH_CARE_LOW_BUDGET',
    role: 'advisory_only',
    status: 'present',
    triggerCodes: triggerCodes as [BudgetAdvisoryTriggerCodeV2, ...BudgetAdvisoryTriggerCodeV2[]],
    triggerEvidenceIds: triggerEvidenceIds as [string, ...string[]],
    evidenceIds: [advisoryEvidence.evidenceId],
  }
  return { advisories: [advisory], evidence: [advisoryEvidence] }
}

const rawSummaryItem = <C extends NutritionProfileSummaryCodeV2 | PreferenceProfileSummaryCodeV2 | FinancialIntentProfileSummaryCodeV2>(
  summaryCode: C,
  sourceQuestionId: AssessmentQuestionIdV2,
): ProfileSummaryItemV2<C> => ({
  summaryCode,
  sources: [{ kind: 'raw_fact', sourceQuestionId }],
})

const derivedSummaryItem = <C extends NutritionProfileSummaryCodeV2 | FinancialIntentProfileSummaryCodeV2>(
  summaryCode: C,
  derivedField: ElderProfileDerivedFieldExtensionV2,
  evidenceId: string,
): ProfileSummaryItemV2<C> => ({
  summaryCode,
  sources: [{ kind: 'derived_fact', derivedField, evidenceIds: [evidenceId] }],
})

const widenBaseSummarySection = <S extends ProfileSummarySectionV2['section']>(
  section: unknown,
): ProfileSummarySectionV2<S> => section as ProfileSummarySectionV2<S>

const makeSummaryV2 = (
  answers: AssessmentAnswerSnapshotV2,
  baseSemantics: ElderProfileSemanticPayload,
  hasBudgetAdvisory: boolean,
): ElderProfileSemanticPayloadV2['userFacingSummary'] => {
  const baseSections = baseSemantics.userFacingSummary.sections
  const nutritionItems: ProfileSummaryItemV2<NutritionProfileSummaryCodeV2>[] = [
    rawSummaryItem('nutrition.chewing_ability', 'health.chewingAbility'),
    rawSummaryItem('nutrition.swallowing_ability', 'health.swallowingAbility'),
    derivedSummaryItem(
      'nutrition.food_texture_support',
      'nutrition.foodTextureSupport',
      'ev:nutrition.foodTextureSupport',
    ),
    derivedSummaryItem(
      'nutrition.swallowing_concern',
      'nutrition.swallowingConcern',
      'ev:nutrition.swallowingConcern',
    ),
  ]
  const preferenceItems: ProfileSummaryItemV2<PreferenceProfileSummaryCodeV2>[] = [
    rawSummaryItem('preference.care_type', 'preference.careType'),
    rawSummaryItem('preference.room_type', 'preference.roomType'),
    rawSummaryItem('preference.meal_schedule', 'preference.mealSchedule'),
    rawSummaryItem('preference.activity_preference', 'preference.activityPreference'),
    rawSummaryItem('preference.priorities', 'preference.priorities'),
  ]
  if (answers['preference.region'] !== undefined) {
    preferenceItems.push(rawSummaryItem('preference.region', 'preference.region'))
  }
  const financialItems: ProfileSummaryItemV2<FinancialIntentProfileSummaryCodeV2>[] = [
    rawSummaryItem('financial.monthly_budget', 'budget.monthlyRange'),
    rawSummaryItem('financial.deposit_tolerance', 'budget.upfrontCostAcceptance'),
    rawSummaryItem('intent.move_in_timing', 'budget.moveInTiming'),
    rawSummaryItem('intent.consultant_support', 'budget.consultantSupport'),
  ]
  if (hasBudgetAdvisory) {
    financialItems.push(derivedSummaryItem(
      'financial.budget_advisory.high_care_low_budget',
      'financial.budgetAdvisory.highCareLowBudget',
      'ev:financial.budgetAdvisory.highCareLowBudget',
    ))
  }

  return {
    summarySchemaVersion: PROFILE_SUMMARY_SCHEMA_VERSION_V2,
    sections: [
      widenBaseSummarySection<'basic'>(baseSections[0]),
      widenBaseSummarySection<'health'>(baseSections[1]),
      { section: 'nutrition', items: nutritionItems },
      widenBaseSummarySection<'adl'>(baseSections[2]),
      widenBaseSummarySection<'mobility'>(baseSections[3]),
      widenBaseSummarySection<'cognition'>(baseSections[4]),
      widenBaseSummarySection<'special_care'>(baseSections[5]),
      { section: 'preference', items: preferenceItems },
      { section: 'financial_intent', items: financialItems },
    ],
  }
}

const sortClarifications = (
  clarifications: readonly ProfileClarificationV2[],
): ProfileClarificationV2[] => clarifications.slice().sort((left, right) => {
  if (left.clarificationId < right.clarificationId) {
    return -1
  }
  if (left.clarificationId > right.clarificationId) {
    return 1
  }
  return 0
})

/** @internal Shared by only the formal and anonymous V2 adapters. */
export const deriveProfileSemanticsV2 = (
  answers: AssessmentAnswerSnapshotV2,
): ProfileSemanticDerivationResultV2 => {
  const baseResult = deriveProfileSemantics(projectV2AnswersToFrozenV1Core(answers))
  if (!baseResult.ok) {
    return {
      ok: false,
      error: {
        code: baseResult.error.code,
        questionIds: baseResult.error.questionIds as readonly AssessmentQuestionIdV2[],
      },
    }
  }

  const base = baseResult.semantics
  const nutrition = deriveNutrition(answers)
  const preferenceEvidence = derivePreferenceEvidence(answers)
  const budgetAdvisory = deriveBudgetAdvisory(answers, base)
  const evidence: DerivationEvidenceV2[] = [
    ...base.evidence,
    ...nutrition.evidence,
    ...preferenceEvidence,
    ...budgetAdvisory.evidence,
  ]

  const preferenceRawFacts: ElderProfileSemanticPayloadV2['preference']['rawFacts'] = {
    preferredInstitutionType: answers['preference.careType'],
    roomTypePreference: answers['preference.roomType'],
    mealSchedulePreference: answers['preference.mealSchedule'],
    activityPreference: answers['preference.activityPreference'],
    priorities: answers['preference.priorities'].slice(),
  }
  if (answers['preference.region'] !== undefined) {
    preferenceRawFacts.regionPreference = { ...answers['preference.region'] }
  }

  return {
    ok: true,
    semantics: {
      basic: base.basic,
      health: base.health,
      nutrition: {
        rawFacts: {
          chewingAbilityAnswer: answers['health.chewingAbility'],
          swallowingAbilityAnswer: answers['health.swallowingAbility'],
        },
        derivedFacts: nutrition.derivedFacts,
      },
      adl: base.adl,
      mobility: base.mobility,
      cognition: base.cognition,
      specialCare: base.specialCare,
      preference: { rawFacts: preferenceRawFacts },
      financial: {
        rawFacts: base.financial.rawFacts,
        derivedFacts: { budgetAdvisories: budgetAdvisory.advisories },
      },
      intent: base.intent,
      userFacingSummary: makeSummaryV2(
        answers,
        base,
        budgetAdvisory.advisories.length > 0,
      ),
      evidence,
      clarifications: sortClarifications([
        ...(base.clarifications as readonly ProfileClarification[]),
        ...nutrition.clarifications,
      ]),
    },
  }
}
