import { readDemo, readDemoEvaluation, saveDemoEvaluationDraft, commitDemoEvaluation } from '../demo/session'
import type { VisitEvaluationUiApplicationDependenciesV1 } from '../pages/visit/visit-evaluation-application'
import directory from '../demo/directory.json'
import { storyDisplayName } from '../demo/story-name'
export { readDemoEvaluation as readEvaluationSession, saveDemoEvaluationDraft as saveEvaluationSession }
export const readEvaluationDisplay = (visitId: string) => {
  const state = readDemo(), flow = state.flows.find(f => f.visitId === visitId)
  if (!flow) return null
  const institution = directory.find(r => r.institutionId === flow.institutionId)
  const elder = state.elders.find(e => e.elderId === flow.demoElderRef)
  return { institutionName: institution ? storyDisplayName(institution.institutionId, institution.displayName) : '机构名称待确认', elderName: elder ? elder.name.replace(/^演示老人[·・]/, '') : '老人姓名未填写' }
}
export const isolatedEvaluationProviders = (): VisitEvaluationUiApplicationDependenciesV1 => {
  const epoch = readDemo().epoch
  return {
    testOnlyContextProvider: { loadContext(visitId) {
      const flow = readDemo().flows.find(f => f.visitId === visitId && f.epoch === epoch && f.appointmentStatus === 'completed')
      return flow ? { provenance: 'TEST_ONLY', visitId: flow.visitId, institutionId: flow.institutionId,
        institutionRecordRevision: String(flow.recordRevision), ownerUserId: flow.ownerUserId, visitStatus: 'completed' } : null
    } },
    testOnlySubmitProvider: { submit(input) {
      const flow = readDemo().flows.find(f => f.visitId === input.context.visitId && f.epoch === epoch)
      if (!flow || input.context.institutionId !== flow.institutionId || input.context.institutionRecordRevision !== String(flow.recordRevision)
        || input.context.ownerUserId !== flow.ownerUserId) throw new Error('DEMO_EVALUATION_CONTEXT_INVALID')
      commitDemoEvaluation(input.context.visitId, epoch, input.draft)
      return { provenance: 'TEST_ONLY', outcome: 'submitted' }
    } },
  }
}
