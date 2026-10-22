import {
  findFirstIncompleteAssessmentStepV2,
  getFirstIncompleteAssessmentQuestionIdV2,
} from '../types/assessment-v2'
import type {
  AssessmentDraftV2,
  AssessmentQuestionIdV2,
  AssessmentStepIdV2,
} from '../types/assessment-v2'

export interface AssessmentResumeDestinationV2 {
  step: AssessmentStepIdV2
  questionId?: AssessmentQuestionIdV2
  route: string
}

const STEP_ROUTES: Record<AssessmentStepIdV2, string> = {
  basic: '/pages/assessment/basic',
  health: '/pages/assessment/health',
  adl: '/pages/assessment/adl',
  cognitive: '/pages/assessment/cognitive',
  preference: '/pages/assessment/preference',
  budget: '/pages/assessment/budget',
}

export const getAssessmentResumeDestinationV2 = (
  draft: AssessmentDraftV2,
): AssessmentResumeDestinationV2 | undefined => {
  const step = findFirstIncompleteAssessmentStepV2(draft)
  if (!step) {
    return undefined
  }
  return {
    step,
    questionId: getFirstIncompleteAssessmentQuestionIdV2(draft),
    route: STEP_ROUTES[step],
  }
}

export const getAssessmentResumeRouteV2 = (draft: AssessmentDraftV2): string => {
  const destination = getAssessmentResumeDestinationV2(draft)
  return destination ? destination.route : STEP_ROUTES.basic
}
