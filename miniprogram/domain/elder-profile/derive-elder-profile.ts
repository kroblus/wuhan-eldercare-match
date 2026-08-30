import {
  ASSESSMENT_QUESTION_DEFINITIONS,
  ASSESSMENT_SCHEMA_VERSION,
  isAssessmentQuestionId,
  isValidAnswerForQuestion,
  REQUIRED_ASSESSMENT_QUESTION_ORDER,
} from '../../types/assessment'
import type {
  AssessmentAnswerSnapshot,
  AssessmentAnswerValueMap,
  AssessmentQuestionId,
  CompletedAssessment,
  PreferenceRegionAnswer,
} from '../../types/assessment'
import type {
  AdlClassificationSuccess,
  AdlProfileRawAnswers,
  AssessmentEvidenceSource,
  AssessmentMultiChoiceQuestionId,
  AssessmentOptionCode,
  CareCapabilityCode,
  CareCapabilityRequirement,
  CognitionProfileDerivedFacts,
  CognitiveConcern,
  DerivationEvidence,
  DerivationEvidenceId,
  DerivedFact,
  ElderProfile,
  ElderProfileDerivedField,
  ElderProfileDerivationResult,
  ElderProfileUserFacingSummary,
  HealthProfileDerivedFacts,
  MobilityLevel,
  MobilityProfileDerivedFacts,
  ProfileClarification,
  ProfileSummaryCode,
  ProfileSummaryItem,
  ProfileSummarySection,
  RehabilitationRequirement,
  ReportedCognitiveDiagnosis,
  ReportedRiskState,
} from '../../types/elder-profile'
import { classifyAdl } from './adl-classifier'
import {
  answerSetSource,
  createClarification,
  createEvidence,
  hasOwn,
  optionSource,
} from './evidence'
import {
  ADL_CARE_MODE_ORDER,
  CARE_CAPABILITY_ORDER,
  PROFILE_CONTRACT_VERSION,
  PROFILE_DERIVATION_RULESET_VERSION,
  SUMMARY_SCHEMA_VERSION,
  derivedRuleId,
} from './rules'

type RawRecord = Record<string, unknown>
type OptionContribution = Exclude<AssessmentEvidenceSource['contribution'], 'establishes_not_reported'>
type DerivationSuccessOrFailure =
  | { ok: true, assessment: CompletedAssessment }
  | { ok: false, result: ElderProfileDerivationResult }

const QUESTION_IDS = Object.keys(ASSESSMENT_QUESTION_DEFINITIONS) as AssessmentQuestionId[]

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

// CompletedAssessment.completedAt is an ISO 8601 date-time, not merely a
// non-empty string. Keep this validator local and dependency-free so the gate
// remains deterministic in both the WeChat runtime and the node harness.
const ISO_8601_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const isLeapYear = (year: number): boolean => year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31
}

const isValidIso8601Timestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_8601_TIMESTAMP_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return false
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false
  }

  const timezone = match[8]
  if (timezone !== 'Z') {
    const offsetHour = Number(timezone.slice(1, 3))
    const offsetMinute = Number(timezone.slice(4, 6))
    if (offsetHour > 23 || offsetMinute > 59) {
      return false
    }
  }
  return true
}

const evidenceIdFor = (field: ElderProfileDerivedField): DerivationEvidenceId =>
  `ev:${field}` as DerivationEvidenceId

const asNonEmptyIds = (values: readonly string[]): [string, ...string[]] =>
  values.slice() as [string, ...string[]]

const assessmentOptionSource = <Q extends Exclude<AssessmentQuestionId, 'basic.elderName' | 'basic.age' | 'preference.region'>>(
  sourceQuestionId: Q,
  sourceOptionCode: AssessmentOptionCode<Q>,
  contribution: OptionContribution,
): AssessmentEvidenceSource => optionSource(sourceQuestionId, sourceOptionCode, contribution)

const completeAnswerSetSource = <Q extends AssessmentMultiChoiceQuestionId>(
  sourceQuestionId: Q,
  sourceOptionCodes: readonly AssessmentOptionCode<Q>[],
  targetOptionCode: AssessmentOptionCode<Q>,
): AssessmentEvidenceSource => answerSetSource(sourceQuestionId, sourceOptionCodes, targetOptionCode)

const answerSetSources = <Q extends AssessmentMultiChoiceQuestionId>(
  sourceQuestionId: Q,
  sourceOptionCodes: readonly AssessmentOptionCode<Q>[],
  targetOptionCodes: readonly AssessmentOptionCode<Q>[],
): AssessmentEvidenceSource[] => targetOptionCodes
  .filter((targetOptionCode) => sourceOptionCodes.indexOf(targetOptionCode) < 0)
  .map((targetOptionCode) => completeAnswerSetSource(sourceQuestionId, sourceOptionCodes, targetOptionCode))

const makeEvidence = (
  field: ElderProfileDerivedField,
  outcomeCode: DerivationEvidence['outcomeCode'],
  ruleId: DerivationEvidence['ruleId'],
  sources: readonly AssessmentEvidenceSource[],
): DerivationEvidence => createEvidence(
  evidenceIdFor(field),
  field,
  outcomeCode,
  ruleId,
  sources,
)

const makeKnown = <T>(
  value: T,
  confidence: 'high' | 'medium',
  evidenceId: DerivationEvidenceId,
): DerivedFact<T> => ({
  status: 'known',
  value,
  confidence,
  evidenceIds: [evidenceId],
})

const makeUnknown = <T>(
  evidenceId: DerivationEvidenceId,
  clarificationIds: readonly string[],
): DerivedFact<T> => ({
  status: 'unknown',
  confidence: 'needs_confirmation',
  evidenceIds: [evidenceId],
  clarificationIds: asNonEmptyIds(clarificationIds),
})

const makeNeedsConfirmation = <T>(
  evidenceId: DerivationEvidenceId,
  clarificationIds: readonly string[],
  candidateValue?: T,
): DerivedFact<T> => ({
  status: 'needs_confirmation',
  ...(candidateValue === undefined ? {} : { candidateValue }),
  confidence: 'needs_confirmation',
  evidenceIds: [evidenceId],
  clarificationIds: asNonEmptyIds(clarificationIds),
})

const addClarification = (
  target: ProfileClarification[],
  clarification: ProfileClarification,
): void => {
  const existing = target.find((item) => item.clarificationId === clarification.clarificationId)
  if (!existing) {
    target.push(clarification)
    return
  }
  const sourceKeys = existing.sources.map((source) => JSON.stringify(source))
  clarification.sources.forEach((source) => {
    const sourceKey = JSON.stringify(source)
    if (sourceKeys.indexOf(sourceKey) < 0) {
      existing.sources = [...existing.sources, source] as [AssessmentEvidenceSource, ...AssessmentEvidenceSource[]]
      sourceKeys.push(sourceKey)
    }
  })
  const affectedFields = existing.affectedDerivedFields.slice()
  clarification.affectedDerivedFields.forEach((field) => {
    if (affectedFields.indexOf(field) < 0) {
      affectedFields.push(field)
    }
  })
  existing.affectedDerivedFields = affectedFields as [ElderProfileDerivedField, ...ElderProfileDerivedField[]]
}

const addRiskClarification = (
  target: ProfileClarification[],
  field: ElderProfileDerivedField,
  sources: readonly AssessmentEvidenceSource[],
): string => {
  const clarificationId = `cl:risk_signal_needs_confirmation:${field}` as ProfileClarification['clarificationId']
  addClarification(target, createClarification(
    clarificationId,
    'risk_signal_needs_confirmation',
    'required_before_hard_filter',
    sources,
    [field],
  ))
  return clarificationId
}

const addUnknownClarification = (
  target: ProfileClarification[],
  questionId: AssessmentQuestionId,
  sources: readonly AssessmentEvidenceSource[],
  fields: readonly ElderProfileDerivedField[],
  priority: 'required_before_classification' | 'required_before_hard_filter' = 'required_before_hard_filter',
): string => {
  const clarificationId = `cl:unknown_answer:${questionId}` as ProfileClarification['clarificationId']
  addClarification(target, createClarification(
    clarificationId,
    'unknown_answer',
    priority,
    sources,
    fields,
  ))
  return clarificationId
}

const addConflictClarification = (
  target: ProfileClarification[],
  field: ElderProfileDerivedField,
  sources: readonly AssessmentEvidenceSource[],
): string => {
  const clarificationId = `cl:cross_answer_conflict:${field}` as ProfileClarification['clarificationId']
  addClarification(target, createClarification(
    clarificationId,
    'cross_answer_conflict',
    'required_before_hard_filter',
    sources,
    [field],
  ))
  return clarificationId
}

const addOtherClarification = (
  target: ProfileClarification[],
  source: AssessmentEvidenceSource,
): string => {
  const clarificationId = 'cl:other_without_detail:cognitive.specialCareNeeds' as ProfileClarification['clarificationId']
  addClarification(target, createClarification(
    clarificationId,
    'other_without_detail',
    'recommended',
    [source],
    CARE_CAPABILITY_ORDER.map((capability) =>
      `specialCare.requiredCareCapabilities.${capability}` as ElderProfileDerivedField,
    ) as [ElderProfileDerivedField, ...ElderProfileDerivedField[]],
  ))
  return clarificationId
}

const cloneSnapshotValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (isPlainRecord(value)) {
    return { ...value }
  }
  return value
}

const cloneAnswers = (answers: RawRecord): AssessmentAnswerSnapshot => {
  const result: RawRecord = {}
  QUESTION_IDS.forEach((questionId) => {
    if (hasOwn(answers, questionId)) {
      result[questionId] = cloneSnapshotValue(answers[questionId])
    }
  })
  return result as AssessmentAnswerSnapshot
}

const makeFailure = (
  code:
    | 'NOT_COMPLETED_ASSESSMENT'
    | 'UNSUPPORTED_ASSESSMENT_SCHEMA'
    | 'INVALID_COMPLETED_AT_TIMESTAMP'
    | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
    | 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE',
  questionIds: readonly AssessmentQuestionId[] = [],
): ElderProfileDerivationResult => ({
  ok: false,
  error: { code, questionIds: questionIds.slice() },
})

const validateCompletedAssessment = (input: unknown): DerivationSuccessOrFailure => {
  if (!isPlainRecord(input) || input.kind !== 'completed_assessment' || input.status !== 'completed') {
    return { ok: false, result: makeFailure('NOT_COMPLETED_ASSESSMENT') }
  }
  if (input.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    return { ok: false, result: makeFailure('UNSUPPORTED_ASSESSMENT_SCHEMA') }
  }
  if (!isNonEmptyString(input.id) || !isNonEmptyString(input.elderId)) {
    return { ok: false, result: makeFailure('NOT_COMPLETED_ASSESSMENT') }
  }
  if (!isValidIso8601Timestamp(input.completedAt)) {
    return { ok: false, result: makeFailure('INVALID_COMPLETED_AT_TIMESTAMP') }
  }
  if (!isPlainRecord(input.answers)) {
    return { ok: false, result: makeFailure('INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE') }
  }

  const answers = input.answers
  const unknownAnswerKeys = Object.keys(answers).filter((key) => !isAssessmentQuestionId(key))
  const missingRequired = REQUIRED_ASSESSMENT_QUESTION_ORDER.filter((questionId) => !hasOwn(answers, questionId))
  const invalidQuestionIds = QUESTION_IDS.filter((questionId) =>
    hasOwn(answers, questionId) && !isValidAnswerForQuestion(questionId, answers[questionId]),
  )

  // The conditional answer is not a free-standing optional field. It is
  // invalid when the controlling answer is absent or explicitly false.
  if (answers['basic.hasInstitutionExperience'] !== 'true' && hasOwn(answers, 'basic.institutionExitReasons')) {
    if (invalidQuestionIds.indexOf('basic.institutionExitReasons') < 0) {
      invalidQuestionIds.push('basic.institutionExitReasons')
    }
  }

  if (missingRequired.length > 0) {
    return { ok: false, result: makeFailure('INCOMPLETE_ASSESSMENT_NOT_DERIVABLE', missingRequired) }
  }
  if (unknownAnswerKeys.length > 0 || invalidQuestionIds.length > 0) {
    return {
      ok: false,
      result: makeFailure('INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE', invalidQuestionIds),
    }
  }

  return {
    ok: true,
    assessment: {
      kind: 'completed_assessment',
      id: input.id,
      elderId: input.elderId,
      status: 'completed',
      schemaVersion: ASSESSMENT_SCHEMA_VERSION,
      answers: cloneAnswers(answers),
      completedAt: input.completedAt,
    },
  }
}

const adlRawAnswersFromSnapshot = (answers: AssessmentAnswerSnapshot): AdlProfileRawAnswers => ({
  eating: answers['adl.eating'],
  mobility: answers['adl.mobility'],
  toileting: answers['adl.toileting'],
  bathing: answers['adl.bathing'],
  dressing: answers['adl.dressing'],
  transfer: answers['adl.transfer'],
  stairs: answers['adl.stairs'],
})

const deriveMobility = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): { derivedFacts: MobilityProfileDerivedFacts, evidence: DerivationEvidence } => {
  const field: ElderProfileDerivedField = 'mobility.level'
  const evidenceId = evidenceIdFor(field)
  const mobilityAnswer = answers['adl.mobility']
  const source = assessmentOptionSource(
    'adl.mobility',
    mobilityAnswer,
    mobilityAnswer === 'unknown' ? 'requires_clarification' : 'supports',
  )
  if (mobilityAnswer === 'unknown') {
    const clarificationId = addUnknownClarification(
      clarifications,
      'adl.mobility',
      [source],
      [field],
    )
    return {
      derivedFacts: { level: makeUnknown<MobilityLevel>(evidenceId, [clarificationId]) },
      evidence: makeEvidence(field, 'unknown', derivedRuleId('MOBILITY_DIRECT'), [source]),
    }
  }
  const level: MobilityLevel = mobilityAnswer === 'bedridden' ? 'bedbound' : mobilityAnswer
  return {
    derivedFacts: { level: makeKnown(level, 'high', evidenceId) },
    evidence: makeEvidence(field, level, derivedRuleId('MOBILITY_DIRECT'), [source]),
  }
}

const deriveRehabilitation = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): { derivedFacts: HealthProfileDerivedFacts, evidence: DerivationEvidence } => {
  const field: ElderProfileDerivedField = 'health.rehabilitationNeed'
  const evidenceId = evidenceIdFor(field)
  const healthAnswer = answers['health.rehabilitationNeed']
  const selectedSpecialNeeds = answers['cognitive.specialCareNeeds']
  const directSpecial = selectedSpecialNeeds.indexOf('rehabilitation_training') >= 0
  const healthSource = assessmentOptionSource(
    'health.rehabilitationNeed',
    healthAnswer,
    healthAnswer === 'unknown' ? 'requires_clarification' : 'supports',
  )
  const specialSource = assessmentOptionSource(
    'cognitive.specialCareNeeds',
    'rehabilitation_training',
    'supports',
  )

  if (directSpecial && (healthAnswer === 'none' || healthAnswer === 'unknown')) {
    const clarificationId = addConflictClarification(clarifications, field, [healthSource, specialSource])
    return {
      derivedFacts: { rehabilitationNeed: makeNeedsConfirmation(evidenceId, [clarificationId], 'required') },
      evidence: makeEvidence(field, 'needs_confirmation', derivedRuleId('REHABILITATION'), [healthSource, specialSource]),
    }
  }
  if (directSpecial) {
    return {
      derivedFacts: { rehabilitationNeed: makeKnown('required', 'high', evidenceId) },
      evidence: makeEvidence(field, 'required', derivedRuleId('REHABILITATION'), [healthSource, specialSource]),
    }
  }
  if (healthAnswer === 'unknown') {
    const clarificationId = addUnknownClarification(
      clarifications,
      'health.rehabilitationNeed',
      [healthSource],
      [field],
    )
    return {
      derivedFacts: { rehabilitationNeed: makeUnknown<RehabilitationRequirement>(evidenceId, [clarificationId]) },
      evidence: makeEvidence(field, 'unknown', derivedRuleId('REHABILITATION'), [healthSource]),
    }
  }
  const value: RehabilitationRequirement = healthAnswer === 'definite'
    ? 'required'
    : healthAnswer === 'possible' ? 'possible' : 'not_required'
  return {
    derivedFacts: { rehabilitationNeed: makeKnown(value, 'high', evidenceId) },
    evidence: makeEvidence(field, value, derivedRuleId('REHABILITATION'), [healthSource]),
  }
}

const hasCode = (values: readonly string[], code: string): boolean => values.indexOf(code) >= 0

const directCognitiveSignalCodes = [
  'memory_decline',
  'repetitive_questioning',
  'gets_lost',
  'wandering_risk',
  'diagnosed_dementia',
] as const

const healthCognitiveSignalCodes = ['alzheimers_disease', 'other_cognitive_impairment'] as const

const dementiaClueSymptomCodes = ['diagnosed_dementia', 'wandering_risk', 'gets_lost'] as const

const cognitionConcernAbsenceSources = (
  symptoms: readonly AssessmentAnswerValueMap['cognitive.symptoms'][number][],
  conditions: readonly AssessmentAnswerValueMap['health.conditions'][number][],
): AssessmentEvidenceSource[] => {
  const sources: AssessmentEvidenceSource[] = []
  if (hasCode(symptoms, 'none')) {
    sources.push(assessmentOptionSource('cognitive.symptoms', 'none', 'supports'))
  } else {
    sources.push(...answerSetSources('cognitive.symptoms', symptoms, directCognitiveSignalCodes))
  }
  if (hasCode(conditions, 'none')) {
    sources.push(assessmentOptionSource('health.conditions', 'none', 'supports'))
  } else {
    sources.push(...answerSetSources('health.conditions', conditions, healthCognitiveSignalCodes))
  }
  return sources
}

interface CognitionRiskPack {
  derivedFacts: Pick<CognitionProfileDerivedFacts, 'wanderingRisk' | 'behavioralRisk' | 'sleepCycleIssue'>
  evidence: DerivationEvidence[]
}

const makeUnknownSymptomClarification = (
  clarifications: ProfileClarification[],
  fields: readonly ElderProfileDerivedField[],
): string => addUnknownClarification(
  clarifications,
  'cognitive.symptoms',
  [assessmentOptionSource('cognitive.symptoms', 'unknown', 'requires_clarification')],
  fields,
)

const makeCognitionRiskFacts = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): CognitionRiskPack => {
  const symptoms = answers['cognitive.symptoms']
  const unknownSymptoms = hasCode(symptoms, 'unknown')
  const wanderingField: ElderProfileDerivedField = 'cognition.wanderingRisk'
  const behaviorField: ElderProfileDerivedField = 'cognition.behavioralRisk'
  const sleepField: ElderProfileDerivedField = 'cognition.sleepCycleIssue'
  const wanderingEvidenceId = evidenceIdFor(wanderingField)
  const behaviorEvidenceId = evidenceIdFor(behaviorField)
  const sleepEvidenceId = evidenceIdFor(sleepField)
  const evidence: DerivationEvidence[] = []

  if (unknownSymptoms) {
    const source = assessmentOptionSource('cognitive.symptoms', 'unknown', 'requires_clarification')
    const clarificationId = makeUnknownSymptomClarification(
      clarifications,
      [wanderingField, behaviorField, sleepField],
    )
    evidence.push(
      makeEvidence(wanderingField, 'unknown', derivedRuleId('WANDERING_RISK'), [source]),
      makeEvidence(behaviorField, 'unknown', derivedRuleId('BEHAVIORAL_RISK'), [source]),
      makeEvidence(sleepField, 'unknown', derivedRuleId('SLEEP_CYCLE'), [source]),
    )
    return {
      derivedFacts: {
        wanderingRisk: makeUnknown<ReportedRiskState>(wanderingEvidenceId, [clarificationId]),
        behavioralRisk: makeUnknown<ReportedRiskState>(behaviorEvidenceId, [clarificationId]),
        sleepCycleIssue: makeUnknown<ReportedRiskState>(sleepEvidenceId, [clarificationId]),
      },
      evidence,
    }
  }

  let wanderingRisk: DerivedFact<ReportedRiskState>
  if (hasCode(symptoms, 'wandering_risk')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'wandering_risk', 'supports')
    evidence.push(makeEvidence(wanderingField, 'present', derivedRuleId('WANDERING_RISK'), [source]))
    wanderingRisk = makeKnown('present', 'high', wanderingEvidenceId)
  } else if (hasCode(symptoms, 'gets_lost')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'gets_lost', 'requires_clarification')
    const clarificationId = addRiskClarification(clarifications, wanderingField, [source])
    evidence.push(makeEvidence(wanderingField, 'needs_confirmation', derivedRuleId('WANDERING_RISK'), [source]))
    wanderingRisk = makeNeedsConfirmation(wanderingEvidenceId, [clarificationId], 'present')
  } else if (hasCode(symptoms, 'none')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'none', 'supports')
    evidence.push(makeEvidence(wanderingField, 'not_reported', derivedRuleId('WANDERING_RISK'), [source]))
    wanderingRisk = makeKnown('not_reported', 'high', wanderingEvidenceId)
  } else {
    const sources = answerSetSources('cognitive.symptoms', symptoms, ['wandering_risk', 'gets_lost'])
    evidence.push(makeEvidence(wanderingField, 'not_reported', derivedRuleId('WANDERING_RISK'), sources))
    wanderingRisk = makeKnown('not_reported', 'high', wanderingEvidenceId)
  }

  const directBehaviorSources: AssessmentEvidenceSource[] = []
  if (hasCode(symptoms, 'aggression')) {
    directBehaviorSources.push(assessmentOptionSource('cognitive.symptoms', 'aggression', 'supports'))
  }
  if (hasCode(symptoms, 'agitation')) {
    directBehaviorSources.push(assessmentOptionSource('cognitive.symptoms', 'agitation', 'supports'))
  }
  let behavioralRisk: DerivedFact<ReportedRiskState>
  if (directBehaviorSources.length > 0) {
    evidence.push(makeEvidence(behaviorField, 'present', derivedRuleId('BEHAVIORAL_RISK'), directBehaviorSources))
    behavioralRisk = makeKnown('present', 'high', behaviorEvidenceId)
  } else if (hasCode(symptoms, 'mood_instability')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'mood_instability', 'requires_clarification')
    const clarificationId = addRiskClarification(clarifications, behaviorField, [source])
    evidence.push(makeEvidence(behaviorField, 'needs_confirmation', derivedRuleId('BEHAVIORAL_RISK'), [source]))
    behavioralRisk = makeNeedsConfirmation(behaviorEvidenceId, [clarificationId], 'present')
  } else if (hasCode(symptoms, 'none')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'none', 'supports')
    evidence.push(makeEvidence(behaviorField, 'not_reported', derivedRuleId('BEHAVIORAL_RISK'), [source]))
    behavioralRisk = makeKnown('not_reported', 'high', behaviorEvidenceId)
  } else {
    const sources = answerSetSources('cognitive.symptoms', symptoms, ['aggression', 'agitation', 'mood_instability'])
    evidence.push(makeEvidence(behaviorField, 'not_reported', derivedRuleId('BEHAVIORAL_RISK'), sources))
    behavioralRisk = makeKnown('not_reported', 'high', behaviorEvidenceId)
  }

  let sleepCycleIssue: DerivedFact<ReportedRiskState>
  if (hasCode(symptoms, 'sleep_wake_disorder')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'sleep_wake_disorder', 'supports')
    evidence.push(makeEvidence(sleepField, 'present', derivedRuleId('SLEEP_CYCLE'), [source]))
    sleepCycleIssue = makeKnown('present', 'high', sleepEvidenceId)
  } else if (hasCode(symptoms, 'none')) {
    const source = assessmentOptionSource('cognitive.symptoms', 'none', 'supports')
    evidence.push(makeEvidence(sleepField, 'not_reported', derivedRuleId('SLEEP_CYCLE'), [source]))
    sleepCycleIssue = makeKnown('not_reported', 'high', sleepEvidenceId)
  } else {
    const sources = answerSetSources('cognitive.symptoms', symptoms, ['sleep_wake_disorder'])
    evidence.push(makeEvidence(sleepField, 'not_reported', derivedRuleId('SLEEP_CYCLE'), sources))
    sleepCycleIssue = makeKnown('not_reported', 'high', sleepEvidenceId)
  }

  return {
    derivedFacts: { wanderingRisk, behavioralRisk, sleepCycleIssue },
    evidence,
  }
}

const deriveReportedDiagnosis = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): { fact: DerivedFact<ReportedCognitiveDiagnosis>, evidence: DerivationEvidence } => {
  const field: ElderProfileDerivedField = 'cognition.reportedDiagnosis'
  const evidenceId = evidenceIdFor(field)
  const symptoms = answers['cognitive.symptoms']
  const conditions = answers['health.conditions']
  const symptomDiagnosis = hasCode(symptoms, 'diagnosed_dementia')
  const alzheimers = hasCode(conditions, 'alzheimers_disease')
  const symptomUnknown = hasCode(symptoms, 'unknown')
  const healthUnknown = hasCode(conditions, 'unknown')
  const symptomHasNonDiagnosisCognitiveSignal = hasCode(symptoms, 'memory_decline')
    || hasCode(symptoms, 'repetitive_questioning')
    || hasCode(symptoms, 'gets_lost')
    || hasCode(symptoms, 'wandering_risk')

  if (symptomDiagnosis || alzheimers) {
    const sources: AssessmentEvidenceSource[] = []
    if (symptomDiagnosis) {
      sources.push(assessmentOptionSource('cognitive.symptoms', 'diagnosed_dementia', 'supports'))
    }
    if (alzheimers) {
      sources.push(assessmentOptionSource('health.conditions', 'alzheimers_disease', 'supports'))
    }
    return {
      fact: makeKnown('reported', 'high', evidenceId),
      evidence: makeEvidence(field, 'reported', derivedRuleId('REPORTED_DIAGNOSIS'), sources),
    }
  }

  if (symptomUnknown || (healthUnknown && !symptomHasNonDiagnosisCognitiveSignal)) {
    const sources: AssessmentEvidenceSource[] = []
    const clarificationIds: string[] = []
    if (symptomUnknown) {
      const source = assessmentOptionSource('cognitive.symptoms', 'unknown', 'requires_clarification')
      sources.push(source)
      clarificationIds.push(addUnknownClarification(clarifications, 'cognitive.symptoms', [source], [field]))
    }
    if (healthUnknown) {
      const source = assessmentOptionSource('health.conditions', 'unknown', 'requires_clarification')
      sources.push(source)
      clarificationIds.push(addUnknownClarification(clarifications, 'health.conditions', [source], [field]))
    }
    return {
      fact: makeUnknown<ReportedCognitiveDiagnosis>(evidenceId, clarificationIds),
      evidence: makeEvidence(field, 'unknown', derivedRuleId('REPORTED_DIAGNOSIS'), sources),
    }
  }

  const sources: AssessmentEvidenceSource[] = []
  if (hasCode(symptoms, 'none')) {
    sources.push(assessmentOptionSource('cognitive.symptoms', 'none', 'supports'))
  } else {
    sources.push(...answerSetSources('cognitive.symptoms', symptoms, ['diagnosed_dementia']))
  }
  if (hasCode(conditions, 'none')) {
    sources.push(assessmentOptionSource('health.conditions', 'none', 'supports'))
  } else if (!healthUnknown) {
    sources.push(...answerSetSources('health.conditions', conditions, ['alzheimers_disease']))
  }
  return {
    fact: makeKnown('not_reported', 'high', evidenceId),
    evidence: makeEvidence(field, 'not_reported', derivedRuleId('REPORTED_DIAGNOSIS'), sources),
  }
}

const deriveCognition = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): { derivedFacts: CognitionProfileDerivedFacts, evidence: DerivationEvidence[] } => {
  const symptoms = answers['cognitive.symptoms']
  const conditions = answers['health.conditions']
  const symptomsUnknown = hasCode(symptoms, 'unknown')
  const conditionsUnknown = hasCode(conditions, 'unknown')
  const symptomDirectSignals = directCognitiveSignalCodes.filter((code) => hasCode(symptoms, code))
  const healthDirectSignals = healthCognitiveSignalCodes.filter((code) => hasCode(conditions, code))
  const explicitCognitiveNone = hasCode(symptoms, 'none')
  const concernField: ElderProfileDerivedField = 'cognition.cognitiveConcern'
  const concernEvidenceId = evidenceIdFor(concernField)
  let concern: DerivedFact<CognitiveConcern>
  let concernEvidence: DerivationEvidence

  if (symptomDirectSignals.length > 0 && explicitCognitiveNone) {
    // Defensive branch for callers bypassing the Assessment validator.
    const sources = [
      ...symptomDirectSignals.map((code) => assessmentOptionSource('cognitive.symptoms', code, 'supports')),
      assessmentOptionSource('cognitive.symptoms', 'none', 'supports'),
    ]
    const clarificationId = addConflictClarification(clarifications, concernField, sources)
    concernEvidence = makeEvidence(concernField, 'needs_confirmation', derivedRuleId('COGNITIVE_CONCERN'), sources)
    concern = makeNeedsConfirmation(concernEvidenceId, [clarificationId], 'present')
  } else if (healthDirectSignals.length > 0 && explicitCognitiveNone) {
    const sources = [
      ...healthDirectSignals.map((code) => assessmentOptionSource('health.conditions', code, 'supports')),
      assessmentOptionSource('cognitive.symptoms', 'none', 'supports'),
    ]
    const clarificationId = addConflictClarification(clarifications, concernField, sources)
    concernEvidence = makeEvidence(concernField, 'needs_confirmation', derivedRuleId('COGNITIVE_CONCERN'), sources)
    concern = makeNeedsConfirmation(concernEvidenceId, [clarificationId], 'present')
  } else if (symptomDirectSignals.length > 0 || healthDirectSignals.length > 0) {
    const sources = [
      ...symptomDirectSignals.map((code) => assessmentOptionSource('cognitive.symptoms', code, 'supports')),
      ...healthDirectSignals.map((code) => assessmentOptionSource('health.conditions', code, 'supports')),
    ]
    concernEvidence = makeEvidence(concernField, 'present', derivedRuleId('COGNITIVE_CONCERN'), sources)
    concern = makeKnown('present', 'high', concernEvidenceId)
  } else if (symptomsUnknown || conditionsUnknown) {
    const sources: AssessmentEvidenceSource[] = []
    const clarificationIds: string[] = []
    if (symptomsUnknown) {
      const source = assessmentOptionSource('cognitive.symptoms', 'unknown', 'requires_clarification')
      sources.push(source)
      clarificationIds.push(addUnknownClarification(clarifications, 'cognitive.symptoms', [source], [concernField]))
    }
    if (conditionsUnknown) {
      const source = assessmentOptionSource('health.conditions', 'unknown', 'requires_clarification')
      sources.push(source)
      clarificationIds.push(addUnknownClarification(clarifications, 'health.conditions', [source], [concernField]))
    }
    concernEvidence = makeEvidence(concernField, 'unknown', derivedRuleId('COGNITIVE_CONCERN'), sources)
    concern = makeUnknown<CognitiveConcern>(concernEvidenceId, clarificationIds)
  } else {
    const concernValue: CognitiveConcern = explicitCognitiveNone ? 'absent' : 'not_reported'
    const sources = cognitionConcernAbsenceSources(symptoms, conditions)
    concernEvidence = makeEvidence(concernField, concernValue, derivedRuleId('COGNITIVE_CONCERN'), sources)
    concern = makeKnown(concernValue, 'high', concernEvidenceId)
  }

  const diagnosis = deriveReportedDiagnosis(answers, clarifications)
  const riskPack = makeCognitionRiskFacts(answers, clarifications)
  return {
    derivedFacts: {
      cognitiveConcern: concern,
      reportedDiagnosis: diagnosis.fact,
      wanderingRisk: riskPack.derivedFacts.wanderingRisk,
      behavioralRisk: riskPack.derivedFacts.behavioralRisk,
      sleepCycleIssue: riskPack.derivedFacts.sleepCycleIssue,
    },
    evidence: [concernEvidence, diagnosis.evidence, ...riskPack.evidence],
  }
}

interface CapabilityPack {
  requiredCareCapabilities: CareCapabilityRequirement[]
  evidence: DerivationEvidence[]
}

const capabilityField = (capability: CareCapabilityCode): ElderProfileDerivedField =>
  `specialCare.requiredCareCapabilities.${capability}` as ElderProfileDerivedField

const capabilityClueSources = (
  capability: CareCapabilityCode,
  answers: AssessmentAnswerSnapshot,
): AssessmentEvidenceSource[] => {
  const symptoms = answers['cognitive.symptoms']
  const conditions = answers['health.conditions']
  const sources: AssessmentEvidenceSource[] = []
  if (capability === 'night_care' && hasCode(symptoms, 'sleep_wake_disorder')) {
    sources.push(assessmentOptionSource('cognitive.symptoms', 'sleep_wake_disorder', 'requires_clarification'))
  }
  if (capability === 'dementia_unit') {
    dementiaClueSymptomCodes.forEach((code) => {
      if (hasCode(symptoms, code)) {
        sources.push(assessmentOptionSource('cognitive.symptoms', code, 'requires_clarification'))
      }
    })
    healthCognitiveSignalCodes.forEach((code) => {
      if (hasCode(conditions, code)) {
        sources.push(assessmentOptionSource('health.conditions', code, 'requires_clarification'))
      }
    })
  }
  if (capability === 'rehabilitation_training') {
    const rehabilitationNeed = answers['health.rehabilitationNeed']
    if (rehabilitationNeed === 'definite' || rehabilitationNeed === 'possible') {
      sources.push(assessmentOptionSource('health.rehabilitationNeed', rehabilitationNeed, 'requires_clarification'))
    }
  }
  if (capability === 'tube_feeding' && answers['adl.eating'] === 'special_feeding') {
    sources.push(assessmentOptionSource('adl.eating', 'special_feeding', 'requires_clarification'))
  }
  if (capability === 'catheter_care' && answers['adl.toileting'] === 'catheter_or_stoma') {
    sources.push(assessmentOptionSource('adl.toileting', 'catheter_or_stoma', 'requires_clarification'))
  }
  if (capability === 'pressure_injury_care' && hasCode(answers['health.recentEvents'], 'pressure_injury')) {
    sources.push(assessmentOptionSource('health.recentEvents', 'pressure_injury', 'requires_clarification'))
  }
  if (capability === 'incontinence_care' && answers['adl.toileting'] === 'frequent_incontinence') {
    sources.push(assessmentOptionSource('adl.toileting', 'frequent_incontinence', 'requires_clarification'))
  }
  return sources
}

const deriveCapabilities = (
  answers: AssessmentAnswerSnapshot,
  clarifications: ProfileClarification[],
): CapabilityPack => {
  const selected = answers['cognitive.specialCareNeeds']
  const hasUnknown = hasCode(selected, 'unknown')
  const hasNone = hasCode(selected, 'none')
  const unknownSource = assessmentOptionSource('cognitive.specialCareNeeds', 'unknown', 'requires_clarification')
  const noneSource = assessmentOptionSource('cognitive.specialCareNeeds', 'none', 'supports')
  if (hasCode(selected, 'other')) {
    addOtherClarification(
      clarifications,
      assessmentOptionSource('cognitive.specialCareNeeds', 'other', 'requires_clarification'),
    )
  }
  if (hasUnknown) {
    addUnknownClarification(
      clarifications,
      'cognitive.specialCareNeeds',
      [unknownSource],
      CARE_CAPABILITY_ORDER.map((capability) => capabilityField(capability)) as [ElderProfileDerivedField, ...ElderProfileDerivedField[]],
    )
  }

  const requiredCareCapabilities: CareCapabilityRequirement[] = []
  const evidence: DerivationEvidence[] = []
  CARE_CAPABILITY_ORDER.forEach((capability) => {
    const field = capabilityField(capability)
    const evidenceId = evidenceIdFor(field)
    const direct = hasCode(selected, capability)
    const clues = capabilityClueSources(capability, answers)
    let status: CareCapabilityRequirement['status']
    let sources: AssessmentEvidenceSource[]
    const clarificationIds: string[] = []

    if (hasUnknown) {
      status = 'unknown'
      sources = [unknownSource, ...clues]
      clarificationIds.push('cl:unknown_answer:cognitive.specialCareNeeds')
      if (clues.length > 0) {
        clarificationIds.push(addRiskClarification(clarifications, field, sources))
      }
    } else if (direct) {
      status = 'required'
      sources = [assessmentOptionSource('cognitive.specialCareNeeds', capability, 'supports')]
    } else if (clues.length > 0) {
      status = 'needs_confirmation'
      sources = hasNone
        ? [noneSource, ...clues]
        : [
          ...answerSetSources('cognitive.specialCareNeeds', selected, [capability]),
          ...clues,
        ]
      clarificationIds.push(addRiskClarification(clarifications, field, sources))
    } else if (hasNone) {
      status = 'not_required'
      sources = [noneSource]
    } else {
      status = 'not_reported'
      sources = answerSetSources('cognitive.specialCareNeeds', selected, [capability])
    }

    evidence.push(makeEvidence(field, status, derivedRuleId('CARE_CAPABILITY'), sources))
    const fact: CareCapabilityRequirement = status === 'unknown' || status === 'needs_confirmation'
      ? { capability, status, evidenceIds: [evidenceId], clarificationIds: asNonEmptyIds(clarificationIds) }
      : { capability, status, evidenceIds: [evidenceId] }
    requiredCareCapabilities.push(fact)
  })
  return { requiredCareCapabilities, evidence }
}

const rawSummaryItem = <C extends ProfileSummaryCode>(
  summaryCode: C,
  sourceQuestionId: AssessmentQuestionId,
): ProfileSummaryItem<C> => ({
  summaryCode,
  sources: [{ kind: 'raw_fact', sourceQuestionId }],
})

const derivedSummaryItem = <C extends ProfileSummaryCode>(
  summaryCode: C,
  derivedField: ElderProfileDerivedField,
): ProfileSummaryItem<C> => ({
  summaryCode,
  sources: [{ kind: 'derived_fact', derivedField, evidenceIds: [evidenceIdFor(derivedField)] }],
})

const makeSummary = (
  answers: AssessmentAnswerSnapshot,
  adl: AdlClassificationSuccess['classification'],
): ElderProfileUserFacingSummary => {
  const basicItems: ProfileSummaryItem[] = [rawSummaryItem('basic.relationship', 'basic.relationship')]
  if (hasOwn(answers, 'basic.elderName')) {
    basicItems.push(rawSummaryItem('basic.name', 'basic.elderName'))
  }
  basicItems.push(rawSummaryItem('basic.gender', 'basic.gender'), rawSummaryItem('basic.age', 'basic.age'))
  if (hasOwn(answers, 'basic.livingStatus')) {
    basicItems.push(rawSummaryItem('basic.living_status', 'basic.livingStatus'))
  }
  if (hasOwn(answers, 'basic.primaryCaregiver')) {
    basicItems.push(rawSummaryItem('basic.primary_caregiver', 'basic.primaryCaregiver'))
  }
  if (hasOwn(answers, 'basic.hasInstitutionExperience')) {
    basicItems.push(rawSummaryItem('basic.institution_experience', 'basic.hasInstitutionExperience'))
  }
  if (hasOwn(answers, 'basic.institutionExitReasons')) {
    basicItems.push(rawSummaryItem('basic.institution_exit_reasons', 'basic.institutionExitReasons'))
  }

  const healthItems: ProfileSummaryItem[] = [
    rawSummaryItem('health.reported_diseases', 'health.conditions'),
    rawSummaryItem('health.recent_risks', 'health.recentEvents'),
    derivedSummaryItem('health.rehabilitation_need', 'health.rehabilitationNeed'),
  ]
  const adlItems: ProfileSummaryItem[] = [derivedSummaryItem('adl.care_level', 'adl.careLevel')]
  adl.derivedFacts.careModes.forEach((mode) => {
    adlItems.push(derivedSummaryItem(
      `adl.care_mode.${mode.code}` as ProfileSummaryCode,
      `adl.careModes.${mode.code}` as ElderProfileDerivedField,
    ))
  })
  const cognitionItems: ProfileSummaryItem[] = [
    derivedSummaryItem('cognition.concern', 'cognition.cognitiveConcern'),
    derivedSummaryItem('cognition.reported_diagnosis', 'cognition.reportedDiagnosis'),
    derivedSummaryItem('cognition.wandering_risk', 'cognition.wanderingRisk'),
    derivedSummaryItem('cognition.behavioral_risk', 'cognition.behavioralRisk'),
    derivedSummaryItem('cognition.sleep_cycle_issue', 'cognition.sleepCycleIssue'),
  ]
  const specialCareItems = CARE_CAPABILITY_ORDER.map((capability) => derivedSummaryItem(
    `special_care.capability.${capability}` as ProfileSummaryCode,
    `specialCare.requiredCareCapabilities.${capability}` as ElderProfileDerivedField,
  ))
  const preferenceItems: ProfileSummaryItem[] = [
    rawSummaryItem('preference.care_type', 'preference.careType'),
    rawSummaryItem('preference.priorities', 'preference.priorities'),
  ]
  if (hasOwn(answers, 'preference.region')) {
    preferenceItems.push(rawSummaryItem('preference.region', 'preference.region'))
  }
  const financialIntentItems: ProfileSummaryItem[] = [
    rawSummaryItem('financial.monthly_budget', 'budget.monthlyRange'),
    rawSummaryItem('financial.deposit_tolerance', 'budget.upfrontCostAcceptance'),
    rawSummaryItem('intent.move_in_timing', 'budget.moveInTiming'),
    rawSummaryItem('intent.consultant_support', 'budget.consultantSupport'),
  ]

  const sections: [
    ProfileSummarySection<'basic'>,
    ProfileSummarySection<'health'>,
    ProfileSummarySection<'adl'>,
    ProfileSummarySection<'mobility'>,
    ProfileSummarySection<'cognition'>,
    ProfileSummarySection<'special_care'>,
    ProfileSummarySection<'preference'>,
    ProfileSummarySection<'financial_intent'>,
  ] = [
    { section: 'basic', items: basicItems },
    { section: 'health', items: healthItems },
    { section: 'adl', items: adlItems },
    { section: 'mobility', items: [derivedSummaryItem('mobility.level', 'mobility.level')] },
    { section: 'cognition', items: cognitionItems },
    { section: 'special_care', items: specialCareItems },
    { section: 'preference', items: preferenceItems },
    { section: 'financial_intent', items: financialIntentItems },
  ]
  return {
    summarySchemaVersion: SUMMARY_SCHEMA_VERSION,
    sections: sections as ElderProfileUserFacingSummary['sections'],
  }
}

const DERIVED_FIELD_ORDER: readonly ElderProfileDerivedField[] = [
  'health.rehabilitationNeed',
  'adl.careLevel',
  ...ADL_CARE_MODE_ORDER.map((mode) => `adl.careModes.${mode}` as ElderProfileDerivedField),
  'mobility.level',
  'cognition.cognitiveConcern',
  'cognition.reportedDiagnosis',
  'cognition.wanderingRisk',
  'cognition.behavioralRisk',
  'cognition.sleepCycleIssue',
  ...CARE_CAPABILITY_ORDER.map((capability) =>
    `specialCare.requiredCareCapabilities.${capability}` as ElderProfileDerivedField,
  ),
]

const sortEvidence = (evidence: readonly DerivationEvidence[]): DerivationEvidence[] => evidence.slice().sort((left, right) =>
  DERIVED_FIELD_ORDER.indexOf(left.derivedField) - DERIVED_FIELD_ORDER.indexOf(right.derivedField),
)

/** Lexical ID order is the stable output order; priority remains data. */
const sortClarifications = (clarifications: readonly ProfileClarification[]): ProfileClarification[] => clarifications.slice().sort((left, right) => {
  if (left.clarificationId < right.clarificationId) {
    return -1
  }
  if (left.clarificationId > right.clarificationId) {
    return 1
  }
  return 0
})

const cloneRegionAnswer = (value: PreferenceRegionAnswer): PreferenceRegionAnswer => ({ ...value })

/** Pure, deterministic CompletedAssessment -> ElderProfile derivation. */
export const deriveElderProfile = (input: unknown): ElderProfileDerivationResult => {
  const validation = validateCompletedAssessment(input)
  if (!validation.ok) {
    return validation.result
  }

  const assessment = validation.assessment
  const answers = assessment.answers
  const adlResult = classifyAdl(adlRawAnswersFromSnapshot(answers))
  if (!adlResult.ok) {
    const code = adlResult.error.code === 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
      ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
      : 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE'
    return makeFailure(code, adlResult.error.questionIds)
  }

  const adl = adlResult.classification
  const clarifications = adl.clarifications.slice()
  const rehabilitation = deriveRehabilitation(answers, clarifications)
  const mobility = deriveMobility(answers, clarifications)
  const cognition = deriveCognition(answers, clarifications)
  const capabilities = deriveCapabilities(answers, clarifications)
  const evidence = sortEvidence([
    ...adl.evidence,
    rehabilitation.evidence,
    mobility.evidence,
    ...cognition.evidence,
    ...capabilities.evidence,
  ])

  const basicRawFacts: ElderProfile['basic']['rawFacts'] = {
    relation: answers['basic.relationship'],
    sex: answers['basic.gender'],
    age: answers['basic.age'],
  }
  if (answers['basic.elderName'] !== undefined) {
    basicRawFacts.name = answers['basic.elderName']
  }
  if (answers['basic.livingStatus'] !== undefined) {
    basicRawFacts.livingStatus = answers['basic.livingStatus']
  }
  if (answers['basic.primaryCaregiver'] !== undefined) {
    basicRawFacts.primaryCaregiver = answers['basic.primaryCaregiver']
  }
  if (answers['basic.hasInstitutionExperience'] !== undefined) {
    basicRawFacts.hasInstitutionExperience = answers['basic.hasInstitutionExperience']
  }
  if (answers['basic.institutionExitReasons'] !== undefined) {
    basicRawFacts.institutionExitReasons = answers['basic.institutionExitReasons'].slice()
  }

  let regionPreference: PreferenceRegionAnswer | undefined
  if (answers['preference.region'] !== undefined) {
    regionPreference = cloneRegionAnswer(answers['preference.region'])
  }

  const profile: ElderProfile = {
    kind: 'elder_profile',
    identity: {
      elderId: assessment.elderId,
      assessmentId: assessment.id,
      assessmentSchemaVersion: assessment.schemaVersion,
      assessmentCompletedAt: assessment.completedAt,
      profileContractVersion: PROFILE_CONTRACT_VERSION,
      derivationRulesetVersion: PROFILE_DERIVATION_RULESET_VERSION,
    },
    basic: { rawFacts: basicRawFacts },
    health: {
      rawFacts: {
        reportedDiseases: answers['health.conditions'].slice(),
        recentHealthRisks: answers['health.recentEvents'].slice(),
        rehabilitationNeedAnswer: answers['health.rehabilitationNeed'],
      },
      derivedFacts: rehabilitation.derivedFacts,
    },
    adl: { rawAnswers: adl.rawAnswers, derivedFacts: adl.derivedFacts },
    mobility: { derivedFacts: mobility.derivedFacts },
    cognition: {
      rawFacts: { reportedSymptoms: answers['cognitive.symptoms'].slice() },
      derivedFacts: cognition.derivedFacts,
    },
    specialCare: {
      rawFacts: { answers: answers['cognitive.specialCareNeeds'].slice() },
      derivedFacts: { requiredCareCapabilities: capabilities.requiredCareCapabilities },
    },
    preference: {
      rawFacts: {
        preferredInstitutionType: answers['preference.careType'],
        priorities: answers['preference.priorities'].slice(),
        ...(regionPreference === undefined ? {} : { regionPreference }),
      },
    },
    financial: {
      rawFacts: {
        monthlyBudget: answers['budget.monthlyRange'],
        depositTolerance: answers['budget.upfrontCostAcceptance'],
      },
    },
    intent: {
      rawFacts: {
        moveInTiming: answers['budget.moveInTiming'],
        consultantIntent: answers['budget.consultantSupport'],
      },
    },
    userFacingSummary: makeSummary(answers, adl),
    evidence,
    clarifications: sortClarifications(clarifications),
  }
  return { ok: true, profile }
}
