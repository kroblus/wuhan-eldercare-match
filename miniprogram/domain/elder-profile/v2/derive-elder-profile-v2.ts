import {
  ASSESSMENT_SCHEMA_VERSION_V2,
  isIsoTimestampV2,
} from '../../../types/assessment-v2'
import type {
  AssessmentQuestionIdV2,
  CompletedAssessmentV2,
} from '../../../types/assessment-v2'
import type {
  ElderProfileDerivationErrorCodeV2,
  ElderProfileDerivationResultV2,
  ElderProfileV2,
} from '../../../types/elder-profile-v2'
import {
  deriveProfileSemanticsV2,
  validateAndCloneAssessmentAnswersV2,
} from './semantic-core-v2'
import {
  PROFILE_CONTRACT_VERSION_V2,
  PROFILE_DERIVATION_RULESET_VERSION_V2,
} from './rules-v2'

type RawRecord = Record<string, unknown>

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const makeFailure = (
  code: ElderProfileDerivationErrorCodeV2,
  questionIds: readonly AssessmentQuestionIdV2[] = [],
): ElderProfileDerivationResultV2 => ({
  ok: false,
  error: { code, questionIds: questionIds.slice() },
})

type CompletedAssessmentValidationResultV2 =
  | { ok: true, assessment: CompletedAssessmentV2 }
  | { ok: false, result: ElderProfileDerivationResultV2 }

const validateCompletedAssessmentV2 = (
  input: unknown,
): CompletedAssessmentValidationResultV2 => {
  if (!isPlainRecord(input)
    || input.kind !== 'completed_assessment'
    || input.status !== 'completed') {
    return { ok: false, result: makeFailure('NOT_COMPLETED_ASSESSMENT') }
  }
  if (input.schemaVersion !== ASSESSMENT_SCHEMA_VERSION_V2) {
    return { ok: false, result: makeFailure('UNSUPPORTED_ASSESSMENT_SCHEMA') }
  }
  if (!isNonEmptyString(input.id) || !isNonEmptyString(input.elderId)) {
    return { ok: false, result: makeFailure('NOT_COMPLETED_ASSESSMENT') }
  }
  if (!isIsoTimestampV2(input.completedAt)) {
    return { ok: false, result: makeFailure('INVALID_COMPLETED_AT_TIMESTAMP') }
  }

  const answerValidation = validateAndCloneAssessmentAnswersV2(input.answers)
  if (!answerValidation.ok) {
    return {
      ok: false,
      result: makeFailure(
        answerValidation.reason === 'incomplete'
          ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
          : 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE',
        answerValidation.questionIds,
      ),
    }
  }

  return {
    ok: true,
    assessment: {
      kind: 'completed_assessment',
      id: input.id,
      elderId: input.elderId,
      status: 'completed',
      schemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
      answers: answerValidation.answers,
      completedAt: input.completedAt,
    },
  }
}

/** Pure, deterministic CompletedAssessmentV2 -> ElderProfileV2 adapter. */
export const deriveElderProfileV2 = (input: unknown): ElderProfileDerivationResultV2 => {
  const validation = validateCompletedAssessmentV2(input)
  if (!validation.ok) {
    return validation.result
  }

  const semanticResult = deriveProfileSemanticsV2(validation.assessment.answers)
  if (!semanticResult.ok) {
    return makeFailure(semanticResult.error.code, semanticResult.error.questionIds)
  }

  const profile: ElderProfileV2 = {
    kind: 'elder_profile',
    identity: {
      elderId: validation.assessment.elderId,
      assessmentId: validation.assessment.id,
      assessmentSchemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
      assessmentCompletedAt: validation.assessment.completedAt,
      profileContractVersion: PROFILE_CONTRACT_VERSION_V2,
      derivationRulesetVersion: PROFILE_DERIVATION_RULESET_VERSION_V2,
    },
    ...semanticResult.semantics,
  }
  return { ok: true, profile }
}
