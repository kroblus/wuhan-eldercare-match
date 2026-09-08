import type { AssessmentDraftV2 } from './assessment-v2'
import type { InstitutionCatalogServiceV11 } from './institution-catalog-v1-1'
import type { RecommendationErrorV2, RecommendationPreviewV2 } from './recommendation-v2'

export interface AssessmentDraftSourceV2 {
  getDraft(): AssessmentDraftV2
}

export type RecommendationPreviewApplicationErrorCodeV2 =
  | 'ASSESSMENT_PROFILE_V2_ERROR'
  | 'INSTITUTION_CATALOG_V11_ERROR'
  | 'RECOMMENDATION_V2_ERROR'

export type RecommendationPreviewApplicationErrorV2 = {
  code: RecommendationPreviewApplicationErrorCodeV2
  causeCode: string
  paths?: readonly string[]
}

export type RecommendationPreviewApplicationResultV2 =
  | { ok: true; value: RecommendationPreviewV2 }
  | { ok: false; error: RecommendationPreviewApplicationErrorV2 }

export interface RecommendationPreviewServiceDependenciesV2 {
  draftSource: AssessmentDraftSourceV2
  institutionCatalog: InstitutionCatalogServiceV11
}

export interface RecommendationPreviewServiceV2 {
  build(evaluationAsOf: string): Promise<RecommendationPreviewApplicationResultV2>
}

export const recommendationErrorPathsV2 = (
  error: RecommendationErrorV2,
): readonly string[] => error.paths.slice()
