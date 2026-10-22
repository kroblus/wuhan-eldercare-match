import example from './assessment-example.json'
import directory from './directory.json'
import { activateDemoCatalog, readModeCatalog } from './catalog'
import { resetDemoMemory } from '../runtime/draft-storage'
import { assessmentDraftStore } from '../store/assessment-draft'
import { isAssessmentQuestionIdV2, validateAssessmentAnswersV2 } from '../types/assessment-v2'
import { buildRecommendationResultApplicationSnapshot } from '../services/recommendation-result-application'
import { registerInstitutionRecommendationSourceContextV2, institutionSourceContextRegistry } from '../services/institution-list-detail-page'
import { createEmptyVisitEvaluationDraft, validateVisitEvaluationDraft } from '../pages/visit/evaluation-view-model'
import type { VisitEvaluationDraftV1 } from '../pages/visit/evaluation-view-model'

interface DemoFlow {
  kind: 'demo_service_state'
  epoch: number
  demoElderRef: string
  institutionId: string
  recordRevision: number
  state: 'appointment_simulated' | 'visit_simulated' | 'evaluation_simulated'
  evaluation: VisitEvaluationDraftV1 | null
}
let epoch = 0
let ready = false
let contextRef: string | null = null
let flows: DemoFlow[] = []
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
export const readDemo = () => ({ epoch, ready, contextRef, flows: clone(flows), count: ready ? directory.length : 0 })
export const resetDemo = (): void => {
  epoch++
  ready = false
  contextRef = null
  flows = []
  institutionSourceContextRegistry.clearAll()
  activateDemoCatalog(false)
  resetDemoMemory()
  assessmentDraftStore.clear()
}
export const loadDemo = async (): Promise<void> => {
  resetDemo()
  const captured = epoch
  const answers = example.answers
  if (!validateAssessmentAnswersV2(answers, true).valid) throw new Error('DEMO_ASSESSMENT_INVALID')
  for (const key of Object.keys(answers)) {
    if (!isAssessmentQuestionIdV2(key)) throw new Error('DEMO_QUESTION_INVALID')
    const result = assessmentDraftStore.setAnswer(key, (answers as { [key: string]: any })[key])
    if (!result.persistence.ok) throw new Error('DEMO_DRAFT_FAILED')
  }
  activateDemoCatalog(true)
  const result = await buildRecommendationResultApplicationSnapshot({ evaluationAsOf: new Date().toISOString() })
  if (captured !== epoch) return
  if (!result.ok || result.version !== 2) { resetDemo(); throw new Error('DEMO_CONTEXT_INVALID') }
  const registered = registerInstitutionRecommendationSourceContextV2(result.value)
  if (!registered.ok) { resetDemo(); throw new Error('DEMO_CONTEXT_INVALID') }
  contextRef = registered.value.sourceContextRef
  ready = true
  // Preset examples belong to this epoch and the validated synthetic pool only.
  // They remain demo_service_state, never formal Appointment/Visit records.
  simulateAppointment(directory[0].institutionId, epoch)
  simulateAppointment(directory[1].institutionId, epoch)
  simulateVisit(directory[1].institutionId, epoch)
  simulateAppointment(directory[2].institutionId, epoch)
  simulateVisit(directory[2].institutionId, epoch)
  simulateEvaluation(directory[2].institutionId, epoch, 4)
}
export const simulateAppointment = (institutionId: string, expectedEpoch: number): void => {
  if (!ready || expectedEpoch !== epoch || !readModeCatalog().records.some(r => r.institutionId === institutionId)) throw new Error('DEMO_CONTEXT_STALE')
  if (flows.some(f => f.institutionId === institutionId)) return
  flows.push({ kind: 'demo_service_state', epoch, demoElderRef: 'demo-elder-' + epoch, institutionId, recordRevision: 1, state: 'appointment_simulated', evaluation: null })
}
export const simulateVisit = (institutionId: string, expectedEpoch: number): void => {
  const flow = flows.find(f => f.institutionId === institutionId && f.epoch === expectedEpoch && expectedEpoch === epoch)
  if (!flow || flow.state !== 'appointment_simulated') throw new Error('DEMO_VISIT_CONTEXT_INVALID')
  flow.state = 'visit_simulated'
}
export const simulateEvaluation = (institutionId: string, expectedEpoch: number, rating: number): void => {
  const flow = flows.find(f => f.institutionId === institutionId && f.epoch === expectedEpoch && expectedEpoch === epoch)
  if (!flow || flow.state !== 'visit_simulated') throw new Error('DEMO_EVALUATION_CONTEXT_INVALID')
  const draft = createEmptyVisitEvaluationDraft()
  draft.overallRating = rating
  draft.consideration = 'compare'
  draft.careRecordLearned = 'unconfirmed'
  draft.handoverLearned = 'unconfirmed'
  if (validateVisitEvaluationDraft(draft).length) throw new Error('DEMO_EVALUATION_INVALID')
  flow.evaluation = clone(draft)
  flow.state = 'evaluation_simulated'
}
