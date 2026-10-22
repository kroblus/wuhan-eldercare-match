import {
  ASSESSMENT_SCHEMA_VERSION_V2,
  LOCAL_ASSESSMENT_PERSISTENCE_V2,
  validateAssessmentDraftV2,
} from '../../../types/assessment-v2'
import type {
  AssessmentAnswerSnapshotV2,
  AssessmentQuestionIdV2,
  AssessmentSchemaVersionV2,
} from '../../../types/assessment-v2'
import type {
  ElderProfilePreviewDerivationErrorCodeV2,
  ElderProfilePreviewDerivationResultV2,
  ElderProfilePreviewV2,
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

interface ValidatedLocalAssessmentSnapshotV2 {
  kind: 'validated_assessment_snapshot'
  source: {
    kind: 'local_draft'
    localDraftId: string
    persistence: typeof LOCAL_ASSESSMENT_PERSISTENCE_V2
  }
  schemaVersion: AssessmentSchemaVersionV2
  answers: AssessmentAnswerSnapshotV2
}

type LocalSnapshotValidationResultV2 =
  | { ok: true, snapshot: ValidatedLocalAssessmentSnapshotV2 }
  | { ok: false, result: ElderProfilePreviewDerivationResultV2 }

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const makeFailure = (
  code: ElderProfilePreviewDerivationErrorCodeV2,
  questionIds: readonly AssessmentQuestionIdV2[] = [],
): ElderProfilePreviewDerivationResultV2 => ({
  ok: false,
  error: { code, questionIds: questionIds.slice() },
})

const validateLocalAssessmentDraftV2 = (
  input: unknown,
): LocalSnapshotValidationResultV2 => {
  if (!isPlainRecord(input)
    || input.kind !== 'assessment_draft'
    || typeof input.schemaVersion !== 'number') {
    return { ok: false, result: makeFailure('INVALID_DRAFT_STRUCTURE') }
  }
  if (input.schemaVersion !== ASSESSMENT_SCHEMA_VERSION_V2) {
    return { ok: false, result: makeFailure('UNSUPPORTED_ASSESSMENT_SCHEMA') }
  }

  const draftValidation = validateAssessmentDraftV2(input)
  if (!draftValidation.valid || !draftValidation.draft) {
    return {
      ok: false,
      result: makeFailure('INVALID_DRAFT_STRUCTURE', draftValidation.invalidQuestionIds),
    }
  }

  const answerValidation = validateAndCloneAssessmentAnswersV2(draftValidation.draft.answers)
  if (!answerValidation.ok) {
    return {
      ok: false,
      result: makeFailure(
        answerValidation.reason === 'incomplete'
          ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
          : 'INVALID_DRAFT_STRUCTURE',
        answerValidation.questionIds,
      ),
    }
  }

  return {
    ok: true,
    snapshot: {
      kind: 'validated_assessment_snapshot',
      source: {
        kind: 'local_draft',
        localDraftId: draftValidation.draft.localDraftId,
        persistence: LOCAL_ASSESSMENT_PERSISTENCE_V2,
      },
      schemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
      answers: answerValidation.answers,
    },
  }
}

/** Pure, ephemeral AssessmentDraftV2 -> ElderProfilePreviewV2 adapter. */
export const deriveElderProfilePreviewV2 = (
  input: unknown,
): ElderProfilePreviewDerivationResultV2 => {
  const validation = validateLocalAssessmentDraftV2(input)
  if (!validation.ok) {
    return validation.result
  }

  const semanticResult = deriveProfileSemanticsV2(validation.snapshot.answers)
  if (!semanticResult.ok) {
    return makeFailure(
      semanticResult.error.code === 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
        ? 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
        : 'INVALID_DRAFT_STRUCTURE',
      semanticResult.error.questionIds,
    )
  }

  const preview: ElderProfilePreviewV2 = {
    kind: 'elder_profile_preview',
    source: {
      kind: 'local_assessment_preview',
      localDraftId: validation.snapshot.source.localDraftId,
      assessmentSchemaVersion: validation.snapshot.schemaVersion,
    },
    profileContractVersion: PROFILE_CONTRACT_VERSION_V2,
    derivationRulesetVersion: PROFILE_DERIVATION_RULESET_VERSION_V2,
    ...semanticResult.semantics,
  }
  return { ok: true, preview }
}
