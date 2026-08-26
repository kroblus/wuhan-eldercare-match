import {
  ASSESSMENT_SCHEMA_VERSION,
  applyAssessmentConditionalRules,
  isAssessmentQuestionId,
  isValidAnswerForQuestion,
  normalizeMultiChoiceValue,
  type AssessmentAnswerValueMap,
  type AssessmentDraft,
  type AssessmentDraftAnswers,
  type AssessmentQuestionId,
  type AssessmentStepId,
  LOCAL_ASSESSMENT_PERSISTENCE,
} from '../types/assessment'

const STORAGE_KEY = 'wuhan-eldercare-match.assessment-draft.v1'
const STEP_IDS: readonly AssessmentStepId[] = ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isAssessmentStepId = (value: unknown): value is AssessmentStepId =>
  typeof value === 'string' && STEP_IDS.indexOf(value as AssessmentStepId) >= 0

const createLocalDraftId = (): string => {
  const entropy = Math.floor(Math.random() * 1000000).toString(36)
  return `local-draft-${Date.now().toString(36)}-${entropy}`
}

const cloneAnswers = (answers: AssessmentDraftAnswers): AssessmentDraftAnswers => {
  const copied: AssessmentDraftAnswers = {}
  Object.keys(answers).forEach((key) => {
    if (!isAssessmentQuestionId(key)) {
      return
    }
    const value = answers[key]
    if (Array.isArray(value)) {
      ;(copied as Record<string, unknown>)[key] = [...value]
    } else if (isPlainRecord(value)) {
      ;(copied as Record<string, unknown>)[key] = Object.assign({}, value)
    } else {
      ;(copied as Record<string, unknown>)[key] = value
    }
  })
  return applyAssessmentConditionalRules(copied)
}

const createEmptyDraft = (): AssessmentDraft => {
  const now = new Date().toISOString()
  return {
    kind: 'assessment_draft',
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    localDraftId: createLocalDraftId(),
    persistence: LOCAL_ASSESSMENT_PERSISTENCE,
    currentStep: 'basic',
    answers: {},
    startedAt: now,
    updatedAt: now,
  }
}

const isStoredDraft = (value: unknown): value is AssessmentDraft => {
  if (!isPlainRecord(value)
    || value.kind !== 'assessment_draft'
    || value.schemaVersion !== ASSESSMENT_SCHEMA_VERSION
    || value.persistence !== LOCAL_ASSESSMENT_PERSISTENCE
    || typeof value.localDraftId !== 'string'
    || value.localDraftId.length === 0
    || !isAssessmentStepId(value.currentStep)
    || !isPlainRecord(value.answers)
    || typeof value.startedAt !== 'string'
    || typeof value.updatedAt !== 'string') {
    return false
  }

  const storedAnswers = value.answers as Record<string, unknown>
  return Object.keys(storedAnswers).every((key) => {
    if (!isAssessmentQuestionId(key)) {
      return false
    }
    return isValidAnswerForQuestion(key, storedAnswers[key])
  })
}

const readInitialDraft = (): AssessmentDraft => {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY) as unknown
    if (saved === undefined || saved === null || saved === '') {
      return createEmptyDraft()
    }
    if (!isStoredDraft(saved)) {
      wx.removeStorageSync(STORAGE_KEY)
      return createEmptyDraft()
    }
    const storedDraft = saved as AssessmentDraft
    return {
      ...storedDraft,
      answers: cloneAnswers(storedDraft.answers),
    }
  } catch (_error) {
    return createEmptyDraft()
  }
}

const cloneDraft = (draft: AssessmentDraft): AssessmentDraft => ({
  ...draft,
  answers: cloneAnswers(draft.answers),
})

export type AssessmentDraftPersistenceStatus = 'saved' | 'cleared' | 'failed'
export type AssessmentDraftPersistenceFailureReason =
  | 'write_failed'
  | 'remove_failed'
  | 'invalid_answer'
  | 'invalid_step'

export interface AssessmentDraftPersistenceResult {
  ok: boolean
  status: AssessmentDraftPersistenceStatus
  reason?: AssessmentDraftPersistenceFailureReason
}

export interface AssessmentDraftMutationResult {
  draft: AssessmentDraft
  persistence: AssessmentDraftPersistenceResult
}

export type AssessmentDraftListener = (draft: AssessmentDraft) => void

export class AssessmentDraftStore {
  private draft: AssessmentDraft = readInitialDraft()
  private listeners: AssessmentDraftListener[] = []
  private lastPersistenceResult: AssessmentDraftPersistenceResult = { ok: true, status: 'saved' }

  getDraft(): AssessmentDraft {
    return cloneDraft(this.draft)
  }

  hasAnswers(): boolean {
    return Object.keys(this.draft.answers).length > 0
  }

  getAnswer<K extends AssessmentQuestionId>(questionId: K): AssessmentAnswerValueMap[K] | undefined {
    return this.draft.answers[questionId]
  }

  setAnswer<K extends AssessmentQuestionId>(questionId: K, value: AssessmentAnswerValueMap[K]): AssessmentDraftMutationResult {
    const normalizedValue = normalizeMultiChoiceValue(questionId, value)
    if (!isValidAnswerForQuestion(questionId, normalizedValue)) {
      return {
        draft: this.getDraft(),
        persistence: { ok: false, status: 'failed', reason: 'invalid_answer' },
      }
    }

    const answers = cloneAnswers(this.draft.answers)
    ;(answers as Record<string, unknown>)[questionId] = Array.isArray(normalizedValue)
      ? [...normalizedValue]
      : isPlainRecord(normalizedValue)
        ? Object.assign({}, normalizedValue)
        : normalizedValue
    this.draft = {
      ...this.draft,
      answers: applyAssessmentConditionalRules(answers),
      updatedAt: new Date().toISOString(),
    }
    const persistence = this.persistAndNotify()
    return { draft: this.getDraft(), persistence }
  }

  clearAnswer(questionId: AssessmentQuestionId): AssessmentDraftMutationResult {
    const answers = cloneAnswers(this.draft.answers)
    delete answers[questionId]
    this.draft = {
      ...this.draft,
      answers: applyAssessmentConditionalRules(answers),
      updatedAt: new Date().toISOString(),
    }
    const persistence = this.persistAndNotify()
    return { draft: this.getDraft(), persistence }
  }

  setCurrentStep(step: AssessmentStepId): AssessmentDraftMutationResult {
    if (!isAssessmentStepId(step)) {
      return {
        draft: this.getDraft(),
        persistence: { ok: false, status: 'failed', reason: 'invalid_step' },
      }
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
      wx.removeStorageSync(STORAGE_KEY)
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
    this.notify()
    return { draft: this.getDraft(), persistence }
  }

  getLastPersistenceResult(): AssessmentDraftPersistenceResult {
    return { ...this.lastPersistenceResult }
  }

  subscribe(listener: AssessmentDraftListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  private persistAndNotify(): AssessmentDraftPersistenceResult {
    let persistence: AssessmentDraftPersistenceResult
    try {
      wx.setStorageSync(STORAGE_KEY, this.draft)
      persistence = { ok: true, status: 'saved' }
    } catch (_error) {
      persistence = { ok: false, status: 'failed', reason: 'write_failed' }
    }
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
export const assessmentDraftStorageKey = STORAGE_KEY
