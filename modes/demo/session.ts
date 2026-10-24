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
import { demoScenario } from './scenario'
import { deriveElderProfileV2 } from '../domain/elder-profile/v2/derive-elder-profile-v2'
import { createRecommendationResultApplicationService } from '../services/recommendation-result-application'
import type { CompletedAssessmentV2, AssessmentAnswerSnapshotV2 } from '../types/assessment-v2'
import type { ElderProfileV2 } from '../types/elder-profile-v2'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import { mapVisitEvaluationDraftToWriteContentV1 } from '../pages/visit/visit-evaluation-write-content'

export interface DemoAssessment {
  provenance: 'TEST_ONLY'; demoCaseId: string; elderId: string; assessmentId: string
  assessmentSnapshot: CompletedAssessmentV2; profileSnapshot: ElderProfileV2
  recommendationSnapshot: RecommendationResultApplicationSnapshotV2
}
let assessments: DemoAssessment[] = []
let loading: Promise<void> | null = null
let evaluations: Record<string, { epoch: number; draft: VisitEvaluationDraftV1; step: number; submitted: boolean; evaluationId: string }> = {}
let evaluationRecords: Record<string, unknown> = {}

interface DemoFlow {
  kind: 'demo_service_state'
  epoch: number
  demoElderRef: string
  institutionId: string
  recordRevision: number
  state: 'appointment_simulated' | 'visit_simulated' | 'evaluation_simulated'
  evaluation: VisitEvaluationDraftV1 | null
  demoCaseId: string
  appointmentId: string
  visitId: string
  appointmentStatus: 'requested' | 'contacting' | 'scheduled' | 'completed' | 'cancelled'
  evaluationId: string
  ownerUserId: string
  provenance: 'TEST_ONLY'
}
let epoch = 0
let ready = false
let contextRef: string | null = null
let flows: DemoFlow[] = []
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
export const readDemo = () => ({ epoch, ready, contextRef, flows: clone(flows), assessments: clone(assessments),
  elders: ready ? demoScenario.elders.map(e => ({ ...e })) : [], evaluations: clone(evaluationRecords), demoCaseId: demoScenario.demoCaseId, count: ready ? directory.length : 0 })
export const resetDemo = (): void => {
  epoch++
  ready = false
  contextRef = null
  flows = []
  assessments = []
  evaluations = {}
  evaluationRecords = {}
  loading = null
  institutionSourceContextRegistry.clearAll()
  activateDemoCatalog(false)
  resetDemoMemory()
  assessmentDraftStore.clear()
}
const initializeDemo = async (): Promise<void> => {
  const captured = epoch
  const answers = example.answers
  if (!validateAssessmentAnswersV2(answers, true).valid) throw new Error('DEMO_ASSESSMENT_INVALID')
  for (const key of Object.keys(answers)) {
    if (!isAssessmentQuestionIdV2(key)) throw new Error('DEMO_QUESTION_INVALID')
    const result = assessmentDraftStore.setAnswer(key, (answers as { [key: string]: any })[key])
    if (!result.persistence.ok) throw new Error('DEMO_DRAFT_FAILED')
  }
  activateDemoCatalog(true)
  const result = await buildRecommendationResultApplicationSnapshot({ evaluationAsOf: demoScenario.completedAt })
  if (captured !== epoch) return
  if (!result.ok || result.version !== 2) { resetDemo(); throw new Error('DEMO_CONTEXT_INVALID') }
  const registered = registerInstitutionRecommendationSourceContextV2(result.value)
  if (!registered.ok) { resetDemo(); throw new Error('DEMO_CONTEXT_INVALID') }
  contextRef = registered.value.sourceContextRef
  assessments = demoScenario.elders.map(elder => {
    const assessmentSnapshot: CompletedAssessmentV2 = { kind: 'completed_assessment', id: elder.assessmentId,
      elderId: elder.elderId, status: 'completed', schemaVersion: 2, answers: clone(answers) as AssessmentAnswerSnapshotV2,
      completedAt: demoScenario.completedAt }
    const profile = deriveElderProfileV2(assessmentSnapshot)
    if (!profile.ok) throw new Error('DEMO_PROFILE_INVALID')
    return { provenance: 'TEST_ONLY', demoCaseId: demoScenario.demoCaseId, elderId: elder.elderId,
      assessmentId: elder.assessmentId, assessmentSnapshot, profileSnapshot: profile.profile, recommendationSnapshot: clone(result.value) }
  })
  ready = true
  // Preset examples belong to this epoch and the validated synthetic pool only.
  // They remain demo_service_state, never formal Appointment/Visit records.
  for (const fixture of demoScenario.appointments) {
    simulateAppointment(fixture.institutionId, epoch)
    if (fixture.status === 'completed') simulateVisit(fixture.institutionId, epoch)
  }
  simulateEvaluation('demo-inst-chunhe-garden', epoch, 4)
}
export const loadDemo = (): Promise<void> => {
  if (ready) return Promise.resolve()
  if (loading) return loading
  const flight = initializeDemo()
  loading = flight
  return flight.then(() => { if (loading === flight) loading = null }, error => {
    if (loading === flight) resetDemo()
    throw error
  })
}
export const saveDemoReassessment = async (elderId: string): Promise<void> => {
  if (!ready || !demoScenario.elders.some(e => e.elderId === elderId)) throw new Error('DEMO_ELDER_INVALID')
  const captured = epoch, draft = clone(assessmentDraftStore.getDraft())
  const result = await createRecommendationResultApplicationService({ draftSource: { getDraft: () => draft } }).build(new Date().toISOString())
  if (captured !== epoch || !ready || !result.ok || result.version !== 2) throw new Error('DEMO_ASSESSMENT_INVALID')
  const assessmentId = 'demo-assessment-' + elderId + '-' + (assessments.length + 1)
  const assessmentSnapshot: CompletedAssessmentV2 = { kind: 'completed_assessment', id: assessmentId,
    elderId, status: 'completed', schemaVersion: 2, answers: clone(draft.answers) as AssessmentAnswerSnapshotV2,
    completedAt: result.value.sourceContext.evaluationAsOf }
  const profile = deriveElderProfileV2(assessmentSnapshot)
  if (!profile.ok) throw new Error('DEMO_PROFILE_INVALID')
  assessments.push({ provenance: 'TEST_ONLY', demoCaseId: demoScenario.demoCaseId, elderId, assessmentId,
    assessmentSnapshot, profileSnapshot: profile.profile, recommendationSnapshot: clone(result.value) })
}
export const simulateAppointment = (institutionId: string, expectedEpoch: number): void => {
  if (!ready || expectedEpoch !== epoch || !readModeCatalog().records.some(r => r.institutionId === institutionId)) throw new Error('DEMO_CONTEXT_STALE')
  if (flows.some(f => f.institutionId === institutionId)) return
  const record = readModeCatalog().records.find(r => r.institutionId === institutionId)!
  flows.push({ kind: 'demo_service_state', epoch, demoElderRef: 'demo-elder-lin', institutionId,
    recordRevision: record.recordRevision, state: 'appointment_simulated', evaluation: null,
    demoCaseId: demoScenario.demoCaseId, appointmentId: 'demo-appointment-' + institutionId,
    visitId: 'demo-visit-' + institutionId, appointmentStatus: 'requested',
    evaluationId: 'demo-evaluation-' + institutionId, ownerUserId: demoScenario.userId, provenance: 'TEST_ONLY' })
}
export const simulateVisit = (institutionId: string, expectedEpoch: number): void => {
  const flow = flows.find(f => f.institutionId === institutionId && f.epoch === expectedEpoch && expectedEpoch === epoch)
  if (!flow || flow.state !== 'appointment_simulated') throw new Error('DEMO_VISIT_CONTEXT_INVALID')
  flow.state = 'visit_simulated'
  flow.appointmentStatus = 'completed'
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
  commitDemoEvaluation(flow.visitId, expectedEpoch, draft)
}

export const readDemoEvaluation = (visitId: string) => {
  const flow = flows.find(f => f.visitId === visitId && f.appointmentStatus === 'completed')
  if (!ready || !flow) return null
  return clone(evaluations[visitId] || { epoch, draft: createEmptyVisitEvaluationDraft(), step: 1, submitted: false, evaluationId: flow.evaluationId })
}
export const saveDemoEvaluationDraft = (visitId: string, expectedEpoch: number, draft: VisitEvaluationDraftV1, step: number): boolean => {
  const current = readDemoEvaluation(visitId)
  if (!current || current.epoch !== expectedEpoch || current.submitted) return false
  evaluations[visitId] = { ...current, draft: clone(draft), step }
  return true
}
export const commitDemoEvaluation = (visitId: string, expectedEpoch: number, draft: VisitEvaluationDraftV1): void => {
  const current = readDemoEvaluation(visitId)
  const flow = flows.find(f => f.visitId === visitId && f.epoch === expectedEpoch)
  const mapped = mapVisitEvaluationDraftToWriteContentV1(draft)
  if (!current || current.epoch !== expectedEpoch || !flow || mapped.kind !== 'valid') throw new Error('DEMO_EVALUATION_INVALID')
  if (current.submitted) {
    if (JSON.stringify(current.draft) !== JSON.stringify(draft)) throw new Error('DEMO_EVALUATION_IMMUTABLE')
    return
  }
  evaluations[visitId] = { ...current, draft: clone(draft), step: 3, submitted: true }
  evaluationRecords[flow.evaluationId] = { ...clone(mapped.content), evaluationId: flow.evaluationId, visitId,
    institutionId: flow.institutionId, institutionRecordRevision: flow.recordRevision, userId: flow.ownerUserId,
    demoCaseId: flow.demoCaseId, provenance: 'TEST_ONLY', dataOwnership: 'USER_REPORTED_DATA' }
  flow.evaluation = clone(draft)
  flow.state = 'evaluation_simulated'
}
