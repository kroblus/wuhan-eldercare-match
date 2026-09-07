import {
  applyAssessmentConditionalRulesV2,
  ASSESSMENT_SCHEMA_VERSION_V2,
  isAssessmentQuestionIdV2,
  isValidAnswerForQuestionV2,
  isAssessmentDraftV2,
  normalizeMultiChoiceValueV2,
  LOCAL_ASSESSMENT_PERSISTENCE_V2,
} from '../types/assessment-v2'
import type {
  AssessmentAnswerValueMapV2,
  AssessmentDraftAnswersV2,
  AssessmentDraftV2,
  AssessmentQuestionIdV2,
  AssessmentStepIdV2,
} from '../types/assessment-v2'
import {
  migrateAssessmentDraftV1ToV2,
} from '../utils/assessment-migration'
import type { AssessmentDraftMigrationResult } from '../utils/assessment-migration'

const STORAGE_KEY_V2 = 'wuhan-eldercare-match.assessment-draft.v2'
const STORAGE_KEY_V1 = 'wuhan-eldercare-match.assessment-draft.v1'
const ACTIVE_POINTER_KEY = 'wuhan-eldercare-match.assessment-draft.active'
const ACTIVE_V2_POINTER = 'v2'
const ACTIVE_V1_POINTER = 'v1'
const STEP_IDS: readonly AssessmentStepIdV2[] = ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isAssessmentStepId = (value: unknown): value is AssessmentStepIdV2 =>
  typeof value === 'string' && STEP_IDS.indexOf(value as AssessmentStepIdV2) >= 0

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

const cloneAnswers = (answers: AssessmentDraftAnswersV2): AssessmentDraftAnswersV2 => {
  const copied: AssessmentDraftAnswersV2 = {}
  Object.keys(answers).forEach((key) => {
    if (!isAssessmentQuestionIdV2(key)) {
      return
    }
    ;(copied as Record<string, unknown>)[key] = cloneValue(answers[key])
  })
  return applyAssessmentConditionalRulesV2(copied)
}

const createLocalDraftId = (): string => {
  const entropy = Math.floor(Math.random() * 1000000).toString(36)
  return `local-draft-${Date.now().toString(36)}-${entropy}`
}

const createEmptyDraft = (): AssessmentDraftV2 => {
  const now = new Date().toISOString()
  return {
    kind: 'assessment_draft',
    schemaVersion: ASSESSMENT_SCHEMA_VERSION_V2,
    localDraftId: createLocalDraftId(),
    persistence: LOCAL_ASSESSMENT_PERSISTENCE_V2,
    currentStep: 'basic',
    answers: {},
    startedAt: now,
    updatedAt: now,
  }
}

const cloneDraft = (draft: AssessmentDraftV2): AssessmentDraftV2 => ({
  ...draft,
  answers: cloneAnswers(draft.answers),
  ...(draft.migrationNotice
    ? {
        migrationNotice: {
          ...draft.migrationNotice,
          originalOptionCodes: [...draft.migrationNotice.originalOptionCodes],
        },
      }
    : {}),
})

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]))
  }
  if (isPlainRecord(left) && isPlainRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]))
  }
  return false
}

const readStorage = (key: string): unknown => {
  try {
    return wx.getStorageSync(key) as unknown
  } catch (_error) {
    return undefined
  }
}

const readPointer = (): string | undefined => {
  const pointer = readStorage(ACTIVE_POINTER_KEY)
  return pointer === ACTIVE_V2_POINTER || pointer === ACTIVE_V1_POINTER ? pointer : undefined
}

const isStoredDraftV2 = (value: unknown): value is AssessmentDraftV2 => {
  if (!isAssessmentDraftV2(value)) {
    return false
  }
  const record = value as unknown as Record<string, unknown>
  const allowedKeys = ['kind', 'schemaVersion', 'localDraftId', 'persistence', 'currentStep', 'answers', 'startedAt', 'updatedAt', 'migrationNotice']
  if (Object.keys(record).some((key) => allowedKeys.indexOf(key) < 0)) {
    return false
  }
  if (!record.migrationNotice) {
    return true
  }
  const notice = record.migrationNotice
  if (!isPlainRecord(notice)
    || notice.originalQuestionId !== 'preference.priorities'
    || notice.sourceSchemaVersion !== 1
    || notice.targetSchemaVersion !== 2
    || notice.reasonCode !== 'PRIORITIES_REQUIRE_RESELECTION_V2'
    || !Array.isArray(notice.originalOptionCodes)
    || notice.originalOptionCodes.length === 0) {
    return false
  }
  return notice.originalOptionCodes.every((code) => typeof code === 'string')
}

const persistAndVerifyDraft = (draft: AssessmentDraftV2): AssessmentDraftPersistenceResult => {
  try {
    wx.setStorageSync(STORAGE_KEY_V2, cloneDraft(draft))
    const saved = readStorage(STORAGE_KEY_V2)
    if (!isStoredDraftV2(saved) || !deepEqual(saved, draft)) {
      return { ok: false, status: 'failed', reason: 'read_back_invalid' }
    }
    wx.setStorageSync(ACTIVE_POINTER_KEY, ACTIVE_V2_POINTER)
    const active = readPointer()
    if (active !== ACTIVE_V2_POINTER) {
      return { ok: false, status: 'failed', reason: 'active_pointer_failed' }
    }
    return { ok: true, status: 'saved' }
  } catch (_error) {
    return { ok: false, status: 'failed', reason: 'write_failed' }
  }
}

/**
 * A migrated V2 value is not active until both read-back validation and the
 * pointer switch succeed. Failed attempts are removed best-effort while the
 * preserved V1 source remains the recovery authority.
 */
const rollbackUncommittedMigration = (): void => {
  try {
    wx.setStorageSync(ACTIVE_POINTER_KEY, ACTIVE_V1_POINTER)
  } catch (_error) {
    // Removing the uncommitted V2 value still prevents a stale V2 pointer
    // from resolving to a half-written Draft on the next launch.
  }
  try {
    wx.removeStorageSync(STORAGE_KEY_V2)
  } catch (_error) {
    // The caller still returns a stable failure and never treats V2 as active.
  }
}

const persistAndVerifyMigratedDraft = (draft: AssessmentDraftV2): AssessmentDraftPersistenceResult => {
  try {
    wx.setStorageSync(STORAGE_KEY_V2, cloneDraft(draft))
  } catch (_error) {
    rollbackUncommittedMigration()
    return { ok: false, status: 'failed', reason: 'write_failed' }
  }

  const saved = readStorage(STORAGE_KEY_V2)
  if (!isStoredDraftV2(saved) || !deepEqual(saved, draft)) {
    rollbackUncommittedMigration()
    return { ok: false, status: 'failed', reason: 'read_back_invalid' }
  }

  try {
    wx.setStorageSync(ACTIVE_POINTER_KEY, ACTIVE_V2_POINTER)
  } catch (_error) {
    rollbackUncommittedMigration()
    return { ok: false, status: 'failed', reason: 'active_pointer_failed' }
  }
  if (readPointer() !== ACTIVE_V2_POINTER) {
    rollbackUncommittedMigration()
    return { ok: false, status: 'failed', reason: 'active_pointer_failed' }
  }
  return { ok: true, status: 'saved' }
}

interface InitialDraftRead {
  draft: AssessmentDraftV2
  migration?: AssessmentDraftMigrationResult
  persistence?: AssessmentDraftPersistenceResult
  legacyRecoveryBlocked?: boolean
}

const readInitialDraft = (): InitialDraftRead => {
  const pointer = readPointer()
  const storedV2 = readStorage(STORAGE_KEY_V2)
  const storedV1 = readStorage(STORAGE_KEY_V1)
  const hasStoredV1 = storedV1 !== undefined && storedV1 !== ''
  // An unpointed V2 value may be a partially committed migration.  Only use
  // it when no preserved V1 source exists; a valid active pointer is the
  // commit marker once a legacy source is present.
  if ((pointer === ACTIVE_V2_POINTER || (pointer === undefined && !hasStoredV1))
    && isStoredDraftV2(storedV2)) {
    return { draft: { ...storedV2, answers: cloneAnswers(storedV2.answers) } }
  }

  if (hasStoredV1) {
    const migration = migrateAssessmentDraftV1ToV2(storedV1)
    if (migration.ok) {
      const persistence = persistAndVerifyMigratedDraft(migration.draft)
      if (persistence.ok) {
        return {
          draft: cloneDraft(migration.draft),
          migration,
          persistence,
        }
      }
      return {
        // Keep the validated migration in memory so the current session can
        // show/recover the user's answers, while the failed persistence
        // result prevents callers from treating it as durable V2 state.
        draft: cloneDraft(migration.draft),
        migration,
        persistence,
      }
    }
    return {
      draft: createEmptyDraft(),
      migration,
      persistence: { ok: false, status: 'failed', reason: 'migration_failed' },
      legacyRecoveryBlocked: true,
    }
  }
  return { draft: createEmptyDraft() }
}

export type AssessmentDraftPersistenceStatus = 'saved' | 'cleared' | 'failed'
export type AssessmentDraftPersistenceFailureReason =
  | 'write_failed'
  | 'read_back_invalid'
  | 'active_pointer_failed'
  | 'remove_failed'
  | 'invalid_answer'
  | 'invalid_step'
  | 'migration_failed'

export interface AssessmentDraftPersistenceResult {
  ok: boolean
  status: AssessmentDraftPersistenceStatus
  reason?: AssessmentDraftPersistenceFailureReason
}

export interface AssessmentDraftMutationResult {
  draft: AssessmentDraftV2
  persistence: AssessmentDraftPersistenceResult
}

export type AssessmentDraftListener = (draft: AssessmentDraftV2) => void

export class AssessmentDraftStore {
  private draft: AssessmentDraftV2
  private listeners: AssessmentDraftListener[]
  private lastPersistenceResult: AssessmentDraftPersistenceResult
  private lastMigrationResult: AssessmentDraftMigrationResult | undefined
  private legacyRecoveryBlocked: boolean

  constructor() {
    const initial = readInitialDraft()
    this.draft = initial.draft
    this.listeners = []
    this.lastPersistenceResult = initial.persistence || { ok: true, status: 'saved' }
    this.lastMigrationResult = initial.migration
    this.legacyRecoveryBlocked = initial.legacyRecoveryBlocked === true
  }

  getDraft(): AssessmentDraftV2 {
    return cloneDraft(this.draft)
  }

  hasAnswers(): boolean {
    return this.legacyRecoveryBlocked || Object.keys(this.draft.answers).length > 0
  }

  requiresLegacyRecovery(): boolean {
    return this.legacyRecoveryBlocked
  }

  getAnswer<K extends AssessmentQuestionIdV2>(questionId: K): AssessmentAnswerValueMapV2[K] | undefined {
    const value = this.draft.answers[questionId]
    return value === undefined ? undefined : cloneValue(value) as AssessmentAnswerValueMapV2[K]
  }

  setAnswer<K extends AssessmentQuestionIdV2>(
    questionId: K,
    value: AssessmentAnswerValueMapV2[K],
  ): AssessmentDraftMutationResult {
    if (this.legacyRecoveryBlocked) {
      return this.blockedMutation()
    }
    const normalizedValue = normalizeMultiChoiceValueV2(questionId, value)
    if (!isValidAnswerForQuestionV2(questionId, normalizedValue)) {
      const persistence: AssessmentDraftPersistenceResult = { ok: false, status: 'failed', reason: 'invalid_answer' }
      this.lastPersistenceResult = persistence
      return { draft: this.getDraft(), persistence }
    }

    const answers = cloneAnswers(this.draft.answers)
    ;(answers as Record<string, unknown>)[questionId] = cloneValue(normalizedValue)
    const migrationNotice = questionId === 'preference.priorities' ? undefined : this.draft.migrationNotice
    const nextDraft: AssessmentDraftV2 = {
      ...this.draft,
      answers: applyAssessmentConditionalRulesV2(answers),
      updatedAt: new Date().toISOString(),
    }
    if (migrationNotice) {
      nextDraft.migrationNotice = migrationNotice
    } else {
      delete nextDraft.migrationNotice
    }
    this.draft = nextDraft
    const persistence = this.persistAndNotify()
    return { draft: this.getDraft(), persistence }
  }

  clearAnswer(questionId: AssessmentQuestionIdV2): AssessmentDraftMutationResult {
    if (this.legacyRecoveryBlocked) {
      return this.blockedMutation()
    }
    const answers = cloneAnswers(this.draft.answers)
    delete answers[questionId]
    this.draft = {
      ...this.draft,
      answers: applyAssessmentConditionalRulesV2(answers),
      updatedAt: new Date().toISOString(),
    }
    const persistence = this.persistAndNotify()
    return { draft: this.getDraft(), persistence }
  }

  setCurrentStep(step: AssessmentStepIdV2): AssessmentDraftMutationResult {
    if (this.legacyRecoveryBlocked) {
      return this.blockedMutation()
    }
    if (!isAssessmentStepId(step)) {
      const persistence: AssessmentDraftPersistenceResult = { ok: false, status: 'failed', reason: 'invalid_step' }
      this.lastPersistenceResult = persistence
      return { draft: this.getDraft(), persistence }
    }
    this.draft = {
      ...this.draft,
      currentStep: step,
      updatedAt: new Date().toISOString(),
    }
    const persistence = this.persistAndNotify()
    return { draft: this.getDraft(), persistence }
  }

  /** 仅在用户明确选择重新开始，或未来完成流程显式调用时清理。 */
  clear(): AssessmentDraftMutationResult {
    const previousDraft = this.getDraft()
    try {
      wx.removeStorageSync(STORAGE_KEY_V2)
      wx.setStorageSync(STORAGE_KEY_V1, '')
      wx.setStorageSync(ACTIVE_POINTER_KEY, '')
    } catch (_error) {
      this.draft = previousDraft
      const persistence: AssessmentDraftPersistenceResult = { ok: false, status: 'failed', reason: 'remove_failed' }
      this.lastPersistenceResult = persistence
      this.notify()
      return { draft: this.getDraft(), persistence }
    }
    this.draft = createEmptyDraft()
    const persistence: AssessmentDraftPersistenceResult = { ok: true, status: 'cleared' }
    this.lastPersistenceResult = persistence
    this.lastMigrationResult = undefined
    this.legacyRecoveryBlocked = false
    this.notify()
    return { draft: this.getDraft(), persistence }
  }

  getLastPersistenceResult(): AssessmentDraftPersistenceResult {
    return { ...this.lastPersistenceResult }
  }

  getLastMigrationResult(): AssessmentDraftMigrationResult | undefined {
    return this.lastMigrationResult
  }

  subscribe(listener: AssessmentDraftListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  private blockedMutation(): AssessmentDraftMutationResult {
    const persistence: AssessmentDraftPersistenceResult = {
      ok: false,
      status: 'failed',
      reason: 'migration_failed',
    }
    this.lastPersistenceResult = persistence
    return { draft: this.getDraft(), persistence }
  }

  private persistAndNotify(): AssessmentDraftPersistenceResult {
    const persistence = persistAndVerifyDraft(this.draft)
    this.lastPersistenceResult = persistence
    this.notify()
    return persistence
  }

  private notify(): void {
    const snapshot = this.getDraft()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}

export const assessmentDraftStore = new AssessmentDraftStore()
export const assessmentDraftStorageKey = STORAGE_KEY_V2
export const assessmentDraftLegacyStorageKey = STORAGE_KEY_V1
export const assessmentDraftActivePointerKey = ACTIVE_POINTER_KEY
export const assessmentDraftSchemaVersion = ASSESSMENT_SCHEMA_VERSION_V2
