import {
  ASSESSMENT_SCHEMA_VERSION,
  isAssessmentQuestionId,
  isValidAnswerForQuestion,
} from '../types/assessment'
import type {
  AssessmentDraft,
  AssessmentStepId,
} from '../types/assessment'
import {
  ASSESSMENT_SCHEMA_VERSION_V2,
  ASSESSMENT_QUESTION_DEFINITIONS_V2,
  isAssessmentQuestionIdV2,
  isIsoTimestampV2,
  validateAssessmentDraftV2,
  V1_AMBIGUOUS_PRIORITY_CODES,
  V2_SAFE_PRIORITY_CODES,
} from '../types/assessment-v2'
import type {
  AssessmentDraftAnswersV2,
  AssessmentDraftV2,
  AssessmentMigrationNoticeV2,
  AssessmentQuestionIdV2,
  AssessmentStepIdV2,
  PreferencePriorityV1,
  PreferencePriorityV2,
} from '../types/assessment-v2'

export type AssessmentDraftMigrationErrorCode =
  | 'SOURCE_NOT_ASSESSMENT_DRAFT'
  | 'UNSUPPORTED_SOURCE_SCHEMA_VERSION'
  | 'INVALID_SOURCE_DRAFT'
  | 'COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN'
  | 'MIGRATION_INVARIANT_VIOLATION'

export type AssessmentDraftMigrationResult =
  | {
      ok: true
      sourceSchemaVersion: 1
      targetSchemaVersion: 2
      draft: AssessmentDraftV2
    }
  | {
      ok: false
      code: AssessmentDraftMigrationErrorCode
    }

const STEP_IDS: readonly AssessmentStepId[] = ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']

const UNCHANGED_QUESTION_IDS: readonly AssessmentQuestionIdV2[] = [
  'basic.relationship',
  'basic.elderName',
  'basic.gender',
  'basic.age',
  'basic.livingStatus',
  'basic.primaryCaregiver',
  'basic.hasInstitutionExperience',
  'basic.institutionExitReasons',
  'health.conditions',
  'health.recentEvents',
  'health.rehabilitationNeed',
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
  'preference.region',
  'budget.monthlyRange',
  'budget.upfrontCostAcceptance',
  'budget.moveInTiming',
  'budget.consultantSupport',
]

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isStepId = (value: unknown): value is AssessmentStepId =>
  typeof value === 'string' && STEP_IDS.indexOf(value as AssessmentStepId) >= 0

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item))
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {}
    Object.keys(value).forEach((key) => {
      result[key] = cloneValue(value[key])
    })
    return result
  }
  return value
}

const isCompletedIdentity = (value: Record<string, unknown>): boolean =>
  value.kind === 'completed_assessment'
  || (value.status === 'completed' && isNonEmptyString(value.id) && isNonEmptyString(value.elderId))

const sourceEnvelopeIsValid = (source: Record<string, unknown>): source is Record<string, unknown> & {
  kind: 'assessment_draft'
  schemaVersion: 1
  localDraftId: string
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY'
  currentStep: AssessmentStepId
  answers: Record<string, unknown>
  startedAt: string
  updatedAt: string
} => {
  if (source.kind !== 'assessment_draft'
    || source.schemaVersion !== ASSESSMENT_SCHEMA_VERSION
    || source.persistence !== 'LOCAL_DEVICE_DEVELOPMENT_ONLY'
    || !isNonEmptyString(source.localDraftId)
    || !isStepId(source.currentStep)
    || !isPlainRecord(source.answers)
    || !isIsoTimestampV2(source.startedAt)
    || !isIsoTimestampV2(source.updatedAt)) {
    return false
  }
  const answers = source.answers
  return Object.keys(answers).every((key) => {
    if (!isAssessmentQuestionId(key)) {
      return false
    }
    return isValidAnswerForQuestion(key, answers[key])
  })
}

const sourcePriorityManifest: readonly PreferencePriorityV1[] = [
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

const isPriorityV1 = (value: unknown): value is PreferencePriorityV1 =>
  typeof value === 'string' && sourcePriorityManifest.indexOf(value as PreferencePriorityV1) >= 0

const normalizedPriorityCodes = (values: readonly PreferencePriorityV1[]): PreferencePriorityV1[] =>
  sourcePriorityManifest.filter((code) => values.indexOf(code) >= 0)

const migratePriorities = (
  sourceValue: unknown,
): { ok: true, value?: PreferencePriorityV2[], notice?: AssessmentMigrationNoticeV2 } | { ok: false } => {
  if (!Array.isArray(sourceValue)
    || sourceValue.length === 0
    || sourceValue.length > 3
    || sourceValue.some((value) => !isPriorityV1(value))) {
    return { ok: false }
  }
  const sourceCodes = normalizedPriorityCodes(sourceValue)
  if (sourceCodes.some((code) => V1_AMBIGUOUS_PRIORITY_CODES.indexOf(code as never) >= 0)) {
    return {
      ok: true,
      notice: {
        originalQuestionId: 'preference.priorities',
        originalOptionCodes: sourceCodes,
        sourceSchemaVersion: 1,
        targetSchemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
        reasonCode: 'PRIORITIES_REQUIRE_RESELECTION_V2',
      },
    }
  }
  const safeCodes = V2_SAFE_PRIORITY_CODES.filter((code) => sourceCodes.indexOf(code as PreferencePriorityV1) >= 0)
  return { ok: true, value: safeCodes.slice() }
}

const copyUnchangedAnswers = (
  sourceAnswers: Record<string, unknown>,
  targetAnswers: AssessmentDraftAnswersV2,
): boolean => {
  for (const questionId of UNCHANGED_QUESTION_IDS) {
    if (!Object.prototype.hasOwnProperty.call(sourceAnswers, questionId)) {
      continue
    }
    // V1 permitted a stale value for this optional conditional question to
    // remain in a draft after the controlling answer changed.  Migration
    // canonicalises the target by dropping inactive answers; it must not
    // make that stale value a reason to reject the otherwise valid source.
    if (questionId === 'basic.institutionExitReasons'
      && sourceAnswers['basic.hasInstitutionExperience'] !== 'true') {
      continue
    }
    const value = sourceAnswers[questionId]
    if (!isAssessmentQuestionId(questionId)
      || !isValidAnswerForQuestion(questionId, value)
      || !isAssessmentQuestionIdV2(questionId)) {
      return false
    }
    ;(targetAnswers as Record<string, unknown>)[questionId] = cloneValue(value)
  }
  return true
}

const hasOnlyValidV2Answers = (draft: AssessmentDraftV2): boolean => {
  const validation = validateAssessmentDraftV2(draft)
  return validation.valid
    && draft.schemaVersion === ASSESSMENT_SCHEMA_VERSION_V2
    && Object.keys(draft.answers).every((key) => isAssessmentQuestionIdV2(key))
}

/**
 * V1 current-edit Draft -> V2 current-edit Draft pure migrator.
 * It never reads storage/time, creates identity, or mutates its source.
 */
export const migrateAssessmentDraftV1ToV2 = (source: unknown): AssessmentDraftMigrationResult => {
  if (!isPlainRecord(source)) {
    return { ok: false, code: 'SOURCE_NOT_ASSESSMENT_DRAFT' }
  }
  if (isCompletedIdentity(source)) {
    return { ok: false, code: 'COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN' }
  }
  if (source.kind !== 'assessment_draft') {
    return { ok: false, code: 'SOURCE_NOT_ASSESSMENT_DRAFT' }
  }
  if (source.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    return { ok: false, code: 'UNSUPPORTED_SOURCE_SCHEMA_VERSION' }
  }
  if (!sourceEnvelopeIsValid(source)) {
    return { ok: false, code: 'INVALID_SOURCE_DRAFT' }
  }

  const sourceAnswers = source.answers
  const migratedAnswers: AssessmentDraftAnswersV2 = {}
  if (!copyUnchangedAnswers(sourceAnswers, migratedAnswers)) {
    return { ok: false, code: 'INVALID_SOURCE_DRAFT' }
  }

  if (Object.prototype.hasOwnProperty.call(sourceAnswers, 'preference.priorities')) {
    const priorityResult = migratePriorities(sourceAnswers['preference.priorities'])
    if (!priorityResult.ok) {
      return { ok: false, code: 'INVALID_SOURCE_DRAFT' }
    }
    if (priorityResult.value) {
      migratedAnswers['preference.priorities'] = priorityResult.value
    }
    const draftWithNotice: AssessmentDraftV2 = {
      kind: 'assessment_draft',
      schemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
      localDraftId: source.localDraftId,
      persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
      currentStep: source.currentStep,
      answers: migratedAnswers,
      startedAt: source.startedAt,
      updatedAt: source.updatedAt,
      ...(priorityResult.notice ? { migrationNotice: priorityResult.notice } : {}),
    }
    if (!hasOnlyValidV2Answers(draftWithNotice)) {
      return { ok: false, code: 'MIGRATION_INVARIANT_VIOLATION' }
    }
    return { ok: true, sourceSchemaVersion: 1, targetSchemaVersion: 2, draft: draftWithNotice }
  }

  const draft: AssessmentDraftV2 = {
    kind: 'assessment_draft',
    schemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
    localDraftId: source.localDraftId,
    persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
    currentStep: source.currentStep,
    answers: migratedAnswers,
    startedAt: source.startedAt,
    updatedAt: source.updatedAt,
  }
  if (!hasOnlyValidV2Answers(draft)) {
    return { ok: false, code: 'MIGRATION_INVARIANT_VIOLATION' }
  }
  return { ok: true, sourceSchemaVersion: 1, targetSchemaVersion: 2, draft }
}

export const isAssessmentDraftV1 = (value: unknown): value is AssessmentDraft =>
  isPlainRecord(value)
  && value.kind === 'assessment_draft'
  && value.schemaVersion === ASSESSMENT_SCHEMA_VERSION
  && sourceEnvelopeIsValid(value)

export const V1_UNCHANGED_QUESTION_IDS = UNCHANGED_QUESTION_IDS
export const ASSESSMENT_V2_QUESTION_DEFINITIONS_FOR_MIGRATION = ASSESSMENT_QUESTION_DEFINITIONS_V2
export type { AssessmentStepIdV2 }
