// DEMO ONLY: shape-compatible memory source. Never imports the production store.
import {
  applyAssessmentConditionalRulesV2, isAssessmentQuestionIdV2,
  isValidAnswerForQuestionV2, normalizeMultiChoiceValueV2,
} from '../types/assessment-v2'
import type {
  AssessmentDraftV2, AssessmentQuestionIdV2, AssessmentStepIdV2,
  AssessmentAnswerValueMapV2,
} from '../types/assessment-v2'
import { SYNTHETIC_ANSWERS, DEMO_AS_OF } from '../demo/data'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
let sessionNumber = 1
const emptyDraft = (): AssessmentDraftV2 => ({
  kind: 'assessment_draft', schemaVersion: 2,
  localDraftId: `TEST_ONLY_demo_session_${sessionNumber}`,
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY', currentStep: 'basic',
  answers: {}, startedAt: DEMO_AS_OF, updatedAt: DEMO_AS_OF,
})
let draft = emptyDraft()
let listeners: Array<(value: AssessmentDraftV2) => void> = []
let persistence = { ok: true, status: 'saved' }
const result = (status = 'saved') => {
  persistence = { ok: true, status }
  listeners.slice().forEach((listener) => listener(clone(draft)))
  return { draft: clone(draft), persistence: { ...persistence } }
}
export const assessmentDraftStore = {
  provenance: 'TEST_ONLY_MEMORY',
  getDraft: (): AssessmentDraftV2 => clone(draft),
  hasAnswers: (): boolean => Object.keys(draft.answers).length > 0,
  requiresLegacyRecovery: (): boolean => false,
  getAnswer: <K extends AssessmentQuestionIdV2>(id: K): AssessmentAnswerValueMapV2[K] | undefined =>
    draft.answers[id] === undefined ? undefined : clone(draft.answers[id]) as AssessmentAnswerValueMapV2[K],
  setAnswer: <K extends AssessmentQuestionIdV2>(id: K, value: AssessmentAnswerValueMapV2[K]) => {
    const normalized = normalizeMultiChoiceValueV2(id, value)
    if (!isAssessmentQuestionIdV2(id) || !isValidAnswerForQuestionV2(id, normalized)) {
      persistence = { ok: false, status: 'failed' }
      return { draft: clone(draft), persistence: { ...persistence, reason: 'invalid_answer' } }
    }
    draft.answers = applyAssessmentConditionalRulesV2({ ...draft.answers, [id]: clone(normalized) })
    return result()
  },
  clearAnswer: (id: AssessmentQuestionIdV2) => {
    delete draft.answers[id]
    draft.answers = applyAssessmentConditionalRulesV2(draft.answers)
    return result()
  },
  setCurrentStep: (step: AssessmentStepIdV2) => {
    if (['basic', 'health', 'adl', 'cognitive', 'preference', 'budget'].indexOf(step) < 0) {
      return { draft: clone(draft), persistence: { ok: false, status: 'failed', reason: 'invalid_step' } }
    }
    draft.currentStep = step
    return result()
  },
  clear: () => { sessionNumber += 1; draft = emptyDraft(); return result('cleared') },
  getLastPersistenceResult: () => ({ ...persistence }),
  getLastMigrationResult: () => undefined,
  subscribe: (listener: (value: AssessmentDraftV2) => void) => {
    listeners.push(listener)
    return () => { listeners = listeners.filter((entry) => entry !== listener) }
  },
  loadSyntheticAnswers: () => {
    sessionNumber += 1
    draft = { ...emptyDraft(), answers: clone(SYNTHETIC_ANSWERS) }
    return result()
  },
}
export const assessmentDraftSchemaVersion = 2
