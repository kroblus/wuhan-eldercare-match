import { isValidAnswerForQuestion } from '../../types/assessment'
import type { AdlRequiredQuestionId } from '../../types/assessment'
import type {
  AdlCareLevel,
  AdlCareModeCode,
  AdlCareModeFact,
  AdlClassificationResult,
  AdlObservationCoverageIssue,
  AdlProfileRawAnswers,
  AssessmentEvidenceSource,
  DerivationEvidence,
  DerivationEvidenceId,
  ElderProfileDerivedField,
  ProfileClarification,
} from '../../types/elder-profile'
import { createClarification, createEvidence, hasOwn } from './evidence'
import {
  ADL_CORE_QUESTION_IDS,
  ADL_QUESTION_ORDER,
  ADL_REQUIRED_HALF_COUNT_FOR_ESCALATION,
  ADL_REQUIRED_LIGHT_COUNT_FOR_ESCALATION,
  ADL_SINGLE_HALF_COUNT,
  ADL_SINGLE_LIGHT_COUNT,
  ADL_RULESET_VERSION,
  adlRuleId,
} from './rules'

type FunctionalContribution =
  | 'none'
  | 'light'
  | 'half'
  | 'dependent'
  | 'severe'
  | 'non_ordinal'
  | 'not_applicable'

type ModeStatus = 'reported' | 'context' | 'needs_confirmation'
type CareLevelSourceRole = 'care_level' | 'care_mode'
type OptionEvidenceContribution =
  | 'supports'
  | 'overrides'
  | 'context'
  | 'limits_confidence'
  | 'excluded_not_applicable'
  | 'requires_clarification'

interface AdlOptionRule {
  contribution: FunctionalContribution
  mode?: AdlCareModeCode
}

/**
 * Profile raw answers intentionally use short axis keys. This is the only
 * boundary map from the frozen full Assessment question IDs.
 */
const RAW_KEY_BY_QUESTION: Record<AdlRequiredQuestionId, keyof AdlProfileRawAnswers> = {
  'adl.eating': 'eating',
  'adl.mobility': 'mobility',
  'adl.toileting': 'toileting',
  'adl.bathing': 'bathing',
  'adl.dressing': 'dressing',
  'adl.transfer': 'transfer',
  'adl.stairs': 'stairs',
}

const ADL_OPTION_RULES: Record<AdlRequiredQuestionId, Record<string, AdlOptionRule>> = {
  'adl.eating': {
    independent: { contribution: 'none' },
    minor_assistance: { contribution: 'light', mode: 'feeding_minor' },
    needs_feeding: { contribution: 'dependent', mode: 'feeding_dependence' },
    special_feeding: { contribution: 'non_ordinal', mode: 'special_feeding_review' },
    unknown: { contribution: 'none' },
  },
  'adl.mobility': {
    independent: { contribution: 'none' },
    walking_aid: { contribution: 'light', mode: 'walking_aid' },
    wheelchair: { contribution: 'half', mode: 'wheelchair' },
    bedridden: { contribution: 'severe', mode: 'bedridden' },
    unknown: { contribution: 'none' },
  },
  'adl.toileting': {
    independent: { contribution: 'none' },
    occasional_assistance: { contribution: 'light', mode: 'toileting_minor' },
    frequent_incontinence: { contribution: 'half', mode: 'incontinence' },
    full_assistance: { contribution: 'dependent', mode: 'toileting_full_assistance' },
    catheter_or_stoma: { contribution: 'non_ordinal', mode: 'catheter_or_stoma_review' },
    unknown: { contribution: 'none' },
  },
  'adl.bathing': {
    independent: { contribution: 'none' },
    partial_assistance: { contribution: 'light', mode: 'bathing_partial' },
    full_assistance: { contribution: 'half', mode: 'bathing_full_assistance' },
    unknown: { contribution: 'none' },
  },
  'adl.dressing': {
    independent: { contribution: 'none' },
    partial_assistance: { contribution: 'light', mode: 'dressing_partial' },
    full_assistance: { contribution: 'half', mode: 'dressing_full_assistance' },
    unknown: { contribution: 'none' },
  },
  'adl.transfer': {
    independent: { contribution: 'none' },
    minor_assistance: { contribution: 'light', mode: 'transfer_minor' },
    needs_support: { contribution: 'half', mode: 'transfer_support' },
    fully_dependent: { contribution: 'severe', mode: 'fully_dependent_transfer' },
    unknown: { contribution: 'none' },
  },
  'adl.stairs': {
    independent: { contribution: 'none' },
    needs_assistance: { contribution: 'light', mode: 'stairs_assistance' },
    unable: { contribution: 'half', mode: 'stairs_unable' },
    no_stairs: { contribution: 'not_applicable', mode: 'no_stairs_context' },
    unknown: { contribution: 'none' },
  },
}

const ADL_MODE_FIELDS: Record<AdlCareModeCode, ElderProfileDerivedField> = {
  feeding_minor: 'adl.careModes.feeding_minor',
  feeding_dependence: 'adl.careModes.feeding_dependence',
  special_feeding_review: 'adl.careModes.special_feeding_review',
  walking_aid: 'adl.careModes.walking_aid',
  wheelchair: 'adl.careModes.wheelchair',
  bedridden: 'adl.careModes.bedridden',
  toileting_minor: 'adl.careModes.toileting_minor',
  incontinence: 'adl.careModes.incontinence',
  toileting_full_assistance: 'adl.careModes.toileting_full_assistance',
  catheter_or_stoma_review: 'adl.careModes.catheter_or_stoma_review',
  bathing_partial: 'adl.careModes.bathing_partial',
  bathing_full_assistance: 'adl.careModes.bathing_full_assistance',
  dressing_partial: 'adl.careModes.dressing_partial',
  dressing_full_assistance: 'adl.careModes.dressing_full_assistance',
  transfer_minor: 'adl.careModes.transfer_minor',
  transfer_support: 'adl.careModes.transfer_support',
  fully_dependent_transfer: 'adl.careModes.fully_dependent_transfer',
  stairs_assistance: 'adl.careModes.stairs_assistance',
  stairs_unable: 'adl.careModes.stairs_unable',
  no_stairs_context: 'adl.careModes.no_stairs_context',
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const evidenceIdFor = (field: ElderProfileDerivedField): DerivationEvidenceId =>
  `ev:${field}` as DerivationEvidenceId

const valueForQuestion = (
  answers: AdlProfileRawAnswers,
  questionId: AdlRequiredQuestionId,
): string => answers[RAW_KEY_BY_QUESTION[questionId]] as string

const sourceForAdlOption = (
  questionId: AdlRequiredQuestionId,
  optionCode: string,
  contribution: OptionEvidenceContribution,
): AssessmentEvidenceSource => ({
  sourceKind: 'assessment_option',
  sourceQuestionId: questionId,
  sourceOptionCode: optionCode,
  contribution,
} as AssessmentEvidenceSource)

/** Contribution depends on whether the source explains a mode or the level. */
const sourceContributionForOption = (
  questionId: AdlRequiredQuestionId,
  optionCode: string,
  role: CareLevelSourceRole,
): OptionEvidenceContribution => {
  if (optionCode === 'unknown') {
    return 'requires_clarification'
  }
  if (optionCode === 'special_feeding' || optionCode === 'catheter_or_stoma') {
    return role === 'care_level' ? 'limits_confidence' : 'requires_clarification'
  }
  if (questionId === 'adl.stairs' && optionCode === 'no_stairs') {
    return 'excluded_not_applicable'
  }
  const rule = ADL_OPTION_RULES[questionId][optionCode]
  if (rule.contribution === 'severe') {
    return 'overrides'
  }
  if (
    rule.contribution === 'dependent'
    || rule.contribution === 'half'
    || rule.contribution === 'light'
    || rule.contribution === 'none'
  ) {
    return 'supports'
  }
  return 'context'
}

const sourceForQuestion = (
  answers: AdlProfileRawAnswers,
  questionId: AdlRequiredQuestionId,
  role: CareLevelSourceRole,
): AssessmentEvidenceSource => {
  const optionCode = valueForQuestion(answers, questionId)
  return sourceForAdlOption(
    questionId,
    optionCode,
    sourceContributionForOption(questionId, optionCode, role),
  )
}

const modeClarificationId = (
  questionId: AdlRequiredQuestionId,
  optionCode: string,
): string | undefined => {
  if (optionCode === 'unknown') {
    return `cl:unknown_answer:${questionId}`
  }
  if (optionCode === 'special_feeding' || optionCode === 'catheter_or_stoma') {
    return `cl:non_ordinal_adl_answer:${questionId}`
  }
  return undefined
}

const modeFact = (
  mode: AdlCareModeCode,
  status: ModeStatus,
  evidenceId: DerivationEvidenceId,
  clarificationId?: string,
): AdlCareModeFact => {
  if (status === 'needs_confirmation') {
    return {
      code: mode,
      status,
      evidenceIds: [evidenceId],
      clarificationIds: [clarificationId as string],
    }
  }
  if (clarificationId) {
    return { code: mode, status, evidenceIds: [evidenceId], clarificationIds: [clarificationId] }
  }
  return { code: mode, status, evidenceIds: [evidenceId] }
}

const createAdlClarifications = (answers: AdlProfileRawAnswers): ProfileClarification[] => {
  const result: ProfileClarification[] = []
  ADL_QUESTION_ORDER.forEach((questionId) => {
    const optionCode = valueForQuestion(answers, questionId)
    if (optionCode === 'unknown') {
      const affectedFields: ElderProfileDerivedField[] = ['adl.careLevel']
      if (questionId === 'adl.mobility') {
        affectedFields.push('mobility.level')
      }
      result.push(createClarification(
        `cl:unknown_answer:${questionId}` as ProfileClarification['clarificationId'],
        'unknown_answer',
        'required_before_classification',
        [sourceForQuestion(answers, questionId, 'care_level')],
        affectedFields,
      ))
      return
    }
    if (optionCode === 'special_feeding' || optionCode === 'catheter_or_stoma') {
      const mode = ADL_OPTION_RULES[questionId][optionCode].mode as AdlCareModeCode
      const affectedFields: ElderProfileDerivedField[] = ['adl.careLevel', ADL_MODE_FIELDS[mode]]
      if (optionCode === 'special_feeding') {
        affectedFields.push('specialCare.requiredCareCapabilities.tube_feeding')
      } else {
        affectedFields.push('specialCare.requiredCareCapabilities.catheter_care')
      }
      result.push(createClarification(
        `cl:non_ordinal_adl_answer:${questionId}` as ProfileClarification['clarificationId'],
        'non_ordinal_adl_answer',
        'required_before_hard_filter',
        [sourceForQuestion(answers, questionId, 'care_mode')],
        affectedFields,
      ))
    }
  })
  return result
}

const sourcesForCareLevel = (
  answers: AdlProfileRawAnswers,
  ruleId: ReturnType<typeof adlRuleId>,
  unknownQuestionIds: readonly AdlRequiredQuestionId[],
): AssessmentEvidenceSource[] => {
  if (ruleId === adlRuleId('C_UNKNOWN_BLOCK')) {
    return unknownQuestionIds.map((questionId) => sourceForQuestion(answers, questionId, 'care_level'))
  }

  // C_NO_BURDEN is a conclusion about all seven observed axes, so every
  // answer is evidence. Non-applicable stairs and non-ordinal clues retain
  // their special contribution while independent answers support the absence
  // of a functional burden.
  if (ruleId === adlRuleId('C_NO_BURDEN')) {
    return ADL_QUESTION_ORDER.map((questionId) => sourceForQuestion(answers, questionId, 'care_level'))
  }

  const contributingLevels: readonly FunctionalContribution[] = ruleId === adlRuleId('C_SEVERE_OVERRIDE')
    ? ['severe']
    : ruleId === adlRuleId('C_DEPENDENT_FLOOR')
      ? ['dependent']
      : ruleId === adlRuleId('C_TWO_HALF_ESCALATION') || ruleId === adlRuleId('C_NON_CORE_HALF_FALLBACK') || ruleId === adlRuleId('C_HALF_FLOOR')
        ? ['half']
        : ['light']

  return ADL_QUESTION_ORDER
    .filter((questionId) => {
      const optionCode = valueForQuestion(answers, questionId)
      const rule = ADL_OPTION_RULES[questionId][optionCode]
      return optionCode === 'special_feeding'
        || optionCode === 'catheter_or_stoma'
        || optionCode === 'no_stairs'
        || contributingLevels.indexOf(rule.contribution) >= 0
    })
    .map((questionId) => sourceForQuestion(answers, questionId, 'care_level'))
}

const careLevelFromAnswers = (
  answers: AdlProfileRawAnswers,
  unknownQuestionIds: readonly AdlRequiredQuestionId[],
): { value?: AdlCareLevel, ruleId: ReturnType<typeof adlRuleId> } => {
  const severe = valueForQuestion(answers, 'adl.mobility') === 'bedridden'
    || valueForQuestion(answers, 'adl.transfer') === 'fully_dependent'
  const dependent = valueForQuestion(answers, 'adl.eating') === 'needs_feeding'
    || valueForQuestion(answers, 'adl.toileting') === 'full_assistance'
  const halfQuestionIds = ADL_QUESTION_ORDER.filter((questionId) =>
    ADL_OPTION_RULES[questionId][valueForQuestion(answers, questionId)].contribution === 'half',
  )
  const coreHalfQuestionIds = halfQuestionIds.filter((questionId) =>
    ADL_CORE_QUESTION_IDS.indexOf(questionId) >= 0,
  )
  const lightQuestionIds = ADL_QUESTION_ORDER.filter((questionId) =>
    ADL_OPTION_RULES[questionId][valueForQuestion(answers, questionId)].contribution === 'light',
  )

  if (unknownQuestionIds.length > 0) {
    return { ruleId: adlRuleId('C_UNKNOWN_BLOCK') }
  }
  if (severe) {
    return { value: 'severely_disabled', ruleId: adlRuleId('C_SEVERE_OVERRIDE') }
  }
  if (dependent) {
    return { value: 'disabled', ruleId: adlRuleId('C_DEPENDENT_FLOOR') }
  }
  if (
    halfQuestionIds.length >= ADL_REQUIRED_HALF_COUNT_FOR_ESCALATION
    && coreHalfQuestionIds.length >= ADL_SINGLE_HALF_COUNT
  ) {
    return { value: 'disabled', ruleId: adlRuleId('C_TWO_HALF_ESCALATION') }
  }
  if (halfQuestionIds.length >= ADL_REQUIRED_HALF_COUNT_FOR_ESCALATION) {
    return { value: 'semi_disabled', ruleId: adlRuleId('C_NON_CORE_HALF_FALLBACK') }
  }
  if (halfQuestionIds.length === ADL_SINGLE_HALF_COUNT) {
    return { value: 'semi_disabled', ruleId: adlRuleId('C_HALF_FLOOR') }
  }
  if (lightQuestionIds.length >= ADL_REQUIRED_LIGHT_COUNT_FOR_ESCALATION) {
    return { value: 'semi_disabled', ruleId: adlRuleId('C_TWO_LIGHT_ESCALATION') }
  }
  if (lightQuestionIds.length === ADL_SINGLE_LIGHT_COUNT) {
    // V1 has one named light-rule boundary; the same rule ID covers its
    // one-light and two-light branches.
    return { value: 'light_care', ruleId: adlRuleId('C_TWO_LIGHT_ESCALATION') }
  }
  return { value: 'independent', ruleId: adlRuleId('C_NO_BURDEN') }
}

const adlRawKeyList = Object.values(RAW_KEY_BY_QUESTION) as readonly string[]

/** Pure Proposal C classifier. It consumes the seven raw ADL axis answers only. */
export const classifyAdl = (rawAnswers: Partial<AdlProfileRawAnswers>): AdlClassificationResult => {
  if (!isPlainRecord(rawAnswers)) {
    return {
      ok: false,
      error: {
        code: 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE',
        questionIds: ADL_QUESTION_ORDER.slice(),
      },
    }
  }

  const hasUnknownKey = Object.keys(rawAnswers).some((key) => adlRawKeyList.indexOf(key) < 0)
  const missingQuestionIds = ADL_QUESTION_ORDER.filter((questionId) =>
    !hasOwn(rawAnswers, RAW_KEY_BY_QUESTION[questionId]),
  )
  const invalidQuestionIds = ADL_QUESTION_ORDER.filter((questionId) =>
    hasOwn(rawAnswers, RAW_KEY_BY_QUESTION[questionId])
      && !isValidAnswerForQuestion(questionId, rawAnswers[RAW_KEY_BY_QUESTION[questionId]]),
  )

  if (missingQuestionIds.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE',
        questionIds: ADL_QUESTION_ORDER.filter((questionId) =>
          missingQuestionIds.indexOf(questionId) >= 0 || invalidQuestionIds.indexOf(questionId) >= 0,
        ),
      },
    }
  }
  if (invalidQuestionIds.length > 0 || hasUnknownKey) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ADL_ANSWER_NOT_DERIVABLE',
        questionIds: invalidQuestionIds.length > 0 ? invalidQuestionIds : ADL_QUESTION_ORDER.slice(),
      },
    }
  }

  const answers = { ...rawAnswers } as AdlProfileRawAnswers
  const unknownQuestionIds = ADL_QUESTION_ORDER.filter((questionId) =>
    valueForQuestion(answers, questionId) === 'unknown',
  )
  const coverageIssues: AdlObservationCoverageIssue[] = []
  if (valueForQuestion(answers, 'adl.eating') === 'special_feeding') {
    coverageIssues.push('special_feeding_non_ordinal')
  }
  if (valueForQuestion(answers, 'adl.toileting') === 'catheter_or_stoma') {
    coverageIssues.push('catheter_or_stoma_non_ordinal')
  }
  if (valueForQuestion(answers, 'adl.stairs') === 'no_stairs') {
    coverageIssues.push('stairs_not_applicable')
  }
  if (unknownQuestionIds.length > 0) {
    coverageIssues.push('unknown_input')
  }

  const evidence: DerivationEvidence[] = []
  const careModes: AdlCareModeFact[] = []
  ADL_QUESTION_ORDER.forEach((questionId) => {
    const optionCode = valueForQuestion(answers, questionId)
    const rule = ADL_OPTION_RULES[questionId][optionCode]
    if (!rule.mode) {
      return
    }
    const mode = rule.mode
    const field = ADL_MODE_FIELDS[mode]
    const evidenceId = evidenceIdFor(field)
    const status: ModeStatus = optionCode === 'special_feeding' || optionCode === 'catheter_or_stoma'
      ? 'needs_confirmation'
      : optionCode === 'no_stairs' ? 'context' : 'reported'
    const ruleId = optionCode === 'no_stairs'
      ? adlRuleId('C_NO_STAIRS_NEUTRAL')
      : adlRuleId('C_PROJECT_CARE_MODE')
    evidence.push(createEvidence(
      evidenceId,
      field,
      status,
      ruleId,
      [sourceForQuestion(answers, questionId, 'care_mode')],
    ))
    careModes.push(modeFact(mode, status, evidenceId, modeClarificationId(questionId, optionCode)))
  })

  const careLevelResult = careLevelFromAnswers(answers, unknownQuestionIds)
  const careLevelField: ElderProfileDerivedField = 'adl.careLevel'
  const careLevelEvidenceId = evidenceIdFor(careLevelField)
  const careLevelSources = sourcesForCareLevel(answers, careLevelResult.ruleId, unknownQuestionIds)
  evidence.push(createEvidence(
    careLevelEvidenceId,
    careLevelField,
    careLevelResult.value === undefined ? 'unknown' : careLevelResult.value,
    careLevelResult.ruleId,
    careLevelSources,
  ))

  const adlClarifications = createAdlClarifications(answers)
  const coverageStatus: 'complete' | 'limited' | 'unknown' = unknownQuestionIds.length > 0
    ? 'unknown'
    : coverageIssues.length > 0 ? 'limited' : 'complete'
  const careLevelFact = careLevelResult.value === undefined
    ? {
      status: 'unknown' as const,
      confidence: 'needs_confirmation' as const,
      evidenceIds: [careLevelEvidenceId] as [DerivationEvidenceId, ...DerivationEvidenceId[]],
      clarificationIds: adlClarifications
        .filter((item) => item.reasonCode === 'unknown_answer')
        .map((item) => item.clarificationId) as [string, ...string[]],
    }
    : {
      status: 'known' as const,
      value: careLevelResult.value,
      confidence: coverageStatus === 'limited' ? 'medium' as const : 'high' as const,
      evidenceIds: [careLevelEvidenceId] as [DerivationEvidenceId, ...DerivationEvidenceId[]],
    }

  return {
    ok: true,
    classification: {
      rawAnswers: answers,
      derivedFacts: {
        rulesetVersion: ADL_RULESET_VERSION,
        careLevel: careLevelFact,
        careModes,
        observationCoverage: { status: coverageStatus, issues: coverageIssues },
        unknownQuestionIds,
      },
      evidence,
      clarifications: adlClarifications,
    },
  }
}
