import type { VisitEvaluationDraftV1 } from '../pages/visit/evaluation-view-model'
import type { VisitEvaluationUiApplicationDependenciesV1 } from '../pages/visit/visit-evaluation-application'
export interface EvaluationSession {
  epoch: number; draft: VisitEvaluationDraftV1; step: number; submitted: boolean; evaluationId: string
}
// Production never reads a synthetic session or registers a test provider.
export const isolatedEvaluationProviders = (): VisitEvaluationUiApplicationDependenciesV1 => ({})
export const readEvaluationSession = (_visitId: string): EvaluationSession | null => null
export const saveEvaluationSession = (_visitId: string, _epoch: number, _draft: VisitEvaluationDraftV1, _step: number): boolean => true
export const readEvaluationDisplay = (_visitId: string): { institutionName: string; elderName: string } | null => null
