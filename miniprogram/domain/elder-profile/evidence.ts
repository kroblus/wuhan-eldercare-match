import type {
  AssessmentAnswerSetEvidenceSource,
  AssessmentEvidenceSource,
  AssessmentMultiChoiceQuestionId,
  AssessmentOptionCode,
  AssessmentOptionEvidenceSource,
  CodedAssessmentQuestionId,
  ClarificationPriority,
  ClarificationReasonCode,
  DerivationEvidenceId,
  DerivationEvidenceOutcomeCode,
  DerivationEvidence,
  DerivationRuleId,
  ElderProfileDerivedField,
  ProfileClarification,
} from '../../types/elder-profile'

/** Create a typed positive option source without translating a stable code. */
export const optionSource = <Q extends CodedAssessmentQuestionId>(
  sourceQuestionId: Q,
  sourceOptionCode: AssessmentOptionCode<Q>,
  contribution: Exclude<AssessmentOptionEvidenceSource['contribution'], 'establishes_not_reported'>,
): AssessmentOptionEvidenceSource => ({
  sourceKind: 'assessment_option',
  sourceQuestionId,
  sourceOptionCode,
  contribution,
}) as AssessmentOptionEvidenceSource

/**
 * Create the complete answer-set source required for a not-reported claim.
 * The caller passes the exact persisted array; this helper copies its order.
 */
export const answerSetSource = <Q extends AssessmentMultiChoiceQuestionId>(
  sourceQuestionId: Q,
  sourceOptionCodes: readonly AssessmentOptionCode<Q>[],
  targetOptionCode: AssessmentOptionCode<Q>,
): AssessmentAnswerSetEvidenceSource => ({
  sourceKind: 'assessment_answer_set',
  sourceQuestionId,
  sourceOptionCodes: sourceOptionCodes.slice(),
  targetOptionCode,
  contribution: 'establishes_not_reported',
}) as AssessmentAnswerSetEvidenceSource

export const createEvidence = (
  evidenceId: DerivationEvidenceId,
  derivedField: ElderProfileDerivedField,
  outcomeCode: DerivationEvidenceOutcomeCode,
  ruleId: DerivationRuleId,
  sources: readonly AssessmentEvidenceSource[],
): DerivationEvidence => ({
  evidenceId,
  derivedField,
  outcomeCode,
  ruleId,
  sources: sources.slice() as [AssessmentEvidenceSource, ...AssessmentEvidenceSource[]],
})

export const createClarification = (
  clarificationId: ProfileClarification['clarificationId'],
  reasonCode: ClarificationReasonCode,
  priority: ClarificationPriority,
  sources: readonly AssessmentEvidenceSource[],
  affectedDerivedFields: readonly ElderProfileDerivedField[],
): ProfileClarification => ({
  clarificationId,
  status: 'open',
  reasonCode,
  priority,
  sources: sources.slice() as [AssessmentEvidenceSource, ...AssessmentEvidenceSource[]],
  affectedDerivedFields: affectedDerivedFields.slice() as [ElderProfileDerivedField, ...ElderProfileDerivedField[]],
})

export const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

export const uniqueStable = <T>(values: readonly T[]): T[] => {
  const result: T[] = []
  values.forEach((value) => {
    if (result.indexOf(value) < 0) {
      result.push(value)
    }
  })
  return result
}
