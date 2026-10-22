import {
  ASSESSMENT_SCHEMA_VERSION,
  LOCAL_ASSESSMENT_PERSISTENCE,
  validateAssessmentDraftForCompletion,
} from '../../types/assessment'
import type {
  AssessmentAnswerSnapshot,
  AssessmentDraftAnswers,
  AssessmentPersistence,
  AssessmentQuestionId,
  AssessmentSchemaVersion,
  AssessmentStepId,
} from '../../types/assessment'
import type {
  ElderProfilePreview,
  ElderProfilePreviewDerivationErrorCode,
  ElderProfilePreviewDerivationResult,
} from '../../types/elder-profile'
import {
  deriveProfileSemantics,
  isValidIso8601Timestamp,
  validateAssessmentAnswersForProfileDerivation,
} from './derive-elder-profile'
import {
  PROFILE_CONTRACT_VERSION,
  PROFILE_DERIVATION_RULESET_VERSION,
} from './rules'

type RawRecord = Record<string, unknown>

interface ValidatedLocalAssessmentSnapshot {
  kind: 'validated_assessment_snapshot'
  source: {
    kind: 'local_draft'
    localDraftId: string
    persistence: AssessmentPersistence
  }
  schemaVersion: AssessmentSchemaVersion
  answers: AssessmentAnswerSnapshot
}

type LocalSnapshotValidationResult =
  | { ok: true, snapshot: ValidatedLocalAssessmentSnapshot }
  | { ok: false, result: ElderProfilePreviewDerivationResult }

const ASSESSMENT_STEP_IDS: readonly AssessmentStepId[] = [
  'basic',
  'health',
  'adl',
  'cognitive',
  'preference',
  'budget',
]

const ASSESSMENT_DRAFT_KEYS: readonly string[] = [
  'kind',
  'schemaVersion',
  'localDraftId',
  'persistence',
  'currentStep',
  'answers',
  'startedAt',
  'updatedAt',
]

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isAssessmentStepId = (value: unknown): value is AssessmentStepId =>
  typeof value === 'string' && ASSESSMENT_STEP_IDS.indexOf(value as AssessmentStepId) >= 0

const makeFailure = (
  code: ElderProfilePreviewDerivationErrorCode,
  questionIds: readonly AssessmentQuestionId[] = [],
): ElderProfilePreviewDerivationResult => ({
  ok: false,
  error: { code, questionIds: questionIds.slice() },
})

const validateLocalAssessmentDraft = (input: unknown): LocalSnapshotValidationResult => {
  if (!isPlainRecord(input)
    || input.kind !== 'assessment_draft'
    || typeof input.schemaVersion !== 'number') {
    return { ok: false, result: makeFailure('INVALID_DRAFT_STRUCTURE') }
  }
  if (input.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    return { ok: false, result: makeFailure('UNSUPPORTED_ASSESSMENT_SCHEMA') }
  }
  if (Object.keys(input).some((key) => ASSESSMENT_DRAFT_KEYS.indexOf(key) < 0)
    || !isNonEmptyString(input.localDraftId)
    || input.persistence !== LOCAL_ASSESSMENT_PERSISTENCE
    || !isAssessmentStepId(input.currentStep)
    || !isPlainRecord(input.answers)
    || !isValidIso8601Timestamp(input.startedAt)
    || !isValidIso8601Timestamp(input.updatedAt)) {
    return { ok: false, result: makeFailure('INVALID_DRAFT_STRUCTURE') }
  }

  const draftAnswers = input.answers as AssessmentDraftAnswers
  const completion = validateAssessmentDraftForCompletion(draftAnswers)
  if (!completion.valid) {
    return {
      ok: false,
      result: makeFailure('INCOMPLETE_ASSESSMENT_NOT_DERIVABLE', completion.invalidQuestionIds),
    }
  }

  const answerValidation = validateAssessmentAnswersForProfileDerivation(draftAnswers)
  if (!answerValidation.ok) {
    const code = answerValidation.reason === 'incomplete'
      ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
      : 'INVALID_DRAFT_STRUCTURE'
    return {
      ok: false,
      result: makeFailure(code, answerValidation.questionIds),
    }
  }

  return {
    ok: true,
    snapshot: {
      kind: 'validated_assessment_snapshot',
      source: {
        kind: 'local_draft',
        localDraftId: input.localDraftId,
        persistence: LOCAL_ASSESSMENT_PERSISTENCE,
      },
      schemaVersion: ASSESSMENT_SCHEMA_VERSION,
      answers: answerValidation.answers,
    },
  }
}

/** Pure, ephemeral AssessmentDraft -> ElderProfilePreview adapter. */
export const deriveElderProfilePreview = (input: unknown): ElderProfilePreviewDerivationResult => {
  const validation = validateLocalAssessmentDraft(input)
  if (!validation.ok) {
    return validation.result
  }

  const snapshot = validation.snapshot
  const semanticResult = deriveProfileSemantics(snapshot.answers)
  if (!semanticResult.ok) {
    const code = semanticResult.error.code === 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
      ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
      : 'INVALID_DRAFT_STRUCTURE'
    return makeFailure(code, semanticResult.error.questionIds)
  }

  const preview: ElderProfilePreview = {
    kind: 'elder_profile_preview',
    source: {
      kind: 'local_assessment_preview',
      localDraftId: snapshot.source.localDraftId,
      assessmentSchemaVersion: snapshot.schemaVersion,
    },
    profileContractVersion: PROFILE_CONTRACT_VERSION,
    derivationRulesetVersion: PROFILE_DERIVATION_RULESET_VERSION,
    ...semanticResult.semantics,
  }
  return { ok: true, preview }
}
