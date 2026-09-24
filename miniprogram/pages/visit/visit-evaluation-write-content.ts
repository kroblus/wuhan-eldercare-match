import {
  VISIT_EVALUATION_FEE_TOPICS,
  VISIT_EVALUATION_RATING_SECTIONS,
  validateVisitEvaluationDraft,
} from './evaluation-view-model'
import type {
  VisitEvaluationConsiderationV1,
  VisitEvaluationDraftV1,
  VisitEvaluationFeeAnswerV1,
  VisitEvaluationFeeTopicKeyV1,
  VisitEvaluationHandoverTopicV1,
  VisitEvaluationObservationAnswerV1,
  VisitEvaluationRatingKeyV1,
  VisitEvaluationTagV1,
  VisitEvaluationValidationIssue,
} from './evaluation-view-model'

export interface VisitEvaluationCareProcessObservationsContentV1 {
  careRecordLearned?: Exclude<VisitEvaluationObservationAnswerV1, ''>
  handoverLearned?: Exclude<VisitEvaluationObservationAnswerV1, ''>
  handoverTopics?: VisitEvaluationHandoverTopicV1[]
}

/** Client supplied evaluation content only; server authority fields are intentionally absent. */
export interface VisitEvaluationWriteContentV1 {
  overallRating: number
  consideration: Exclude<VisitEvaluationConsiderationV1, ''>
  ratings?: Partial<Record<VisitEvaluationRatingKeyV1, number>>
  feeExplanationClear?: 'clear' | 'unclear'
  feeTopicExplanations?: Partial<Record<VisitEvaluationFeeTopicKeyV1, Exclude<VisitEvaluationFeeAnswerV1, ''>>>
  careProcessObservations?: VisitEvaluationCareProcessObservationsContentV1
  likedTags?: VisitEvaluationTagV1[]
  concernTags?: VisitEvaluationTagV1[]
  comment?: string
}

export type VisitEvaluationWriteContentMappingV1 =
  | { kind: 'valid'; content: VisitEvaluationWriteContentV1 }
  | { kind: 'invalid'; issues: VisitEvaluationValidationIssue[] }

const sortSetValues = <T extends string>(values: ReadonlyArray<T>): T[] => values.slice().sort()

/**
 * Validates and projects the local UI draft into the frozen V1 write-content shape.
 * It does not add route, session, idempotency, or server-authoritative fields.
 */
export const mapVisitEvaluationDraftToWriteContentV1 = (
  draft: VisitEvaluationDraftV1,
): VisitEvaluationWriteContentMappingV1 => {
  const issues = validateVisitEvaluationDraft(draft)
  if (issues.length > 0) return { kind: 'invalid', issues }

  const ratings: Partial<Record<VisitEvaluationRatingKeyV1, number>> = {}
  const ratingDraft = draft.ratings || {} as VisitEvaluationDraftV1['ratings']
  VISIT_EVALUATION_RATING_SECTIONS.forEach((section) => {
    const items = section.items as ReadonlyArray<{ key: VisitEvaluationRatingKeyV1 }>
    items.forEach((item) => {
      const value = ratingDraft[item.key]
      if (typeof value === 'number') ratings[item.key] = value
    })
  })

  const feeTopicExplanations: Partial<Record<VisitEvaluationFeeTopicKeyV1, Exclude<VisitEvaluationFeeAnswerV1, ''>>> = {}
  const feeTopicDraft = draft.feeTopicExplanations || {} as VisitEvaluationDraftV1['feeTopicExplanations']
  VISIT_EVALUATION_FEE_TOPICS.forEach((topic) => {
    const answer = feeTopicDraft[topic.key]
    if (answer !== undefined && answer !== '') feeTopicExplanations[topic.key] = answer
  })

  const careProcessObservations: VisitEvaluationCareProcessObservationsContentV1 = {}
  if (draft.careRecordLearned !== '') careProcessObservations.careRecordLearned = draft.careRecordLearned
  if (draft.handoverLearned !== '') careProcessObservations.handoverLearned = draft.handoverLearned
  if (draft.handoverTopics.length > 0) {
    careProcessObservations.handoverTopics = sortSetValues(draft.handoverTopics)
  }

  const content: VisitEvaluationWriteContentV1 = {
    overallRating: draft.overallRating as number,
    consideration: draft.consideration as Exclude<VisitEvaluationConsiderationV1, ''>,
  }
  if (Object.keys(ratings).length > 0) content.ratings = ratings
  if (draft.feeExplanationClear !== '') content.feeExplanationClear = draft.feeExplanationClear
  if (Object.keys(feeTopicExplanations).length > 0) content.feeTopicExplanations = feeTopicExplanations
  if (Object.keys(careProcessObservations).length > 0) content.careProcessObservations = careProcessObservations
  if (draft.likedTags.length > 0) content.likedTags = sortSetValues(draft.likedTags)
  if (draft.concernTags.length > 0) content.concernTags = sortSetValues(draft.concernTags)
  if (draft.comment !== '') content.comment = draft.comment

  return { kind: 'valid', content }
}
