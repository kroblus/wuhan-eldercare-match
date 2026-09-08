import { deriveElderProfilePreviewV2 } from '../domain/elder-profile/v2'
import { evaluateRecommendationPreviewV2 } from '../domain/recommendation/v2'
import { assessmentDraftStore } from '../store/assessment-draft'
import type {
  RecommendationPreviewApplicationResultV2,
  RecommendationPreviewServiceDependenciesV2,
  RecommendationPreviewServiceV2,
} from '../types/recommendation-preview-v2'
import { institutionCatalogServiceV11 } from './institution-catalog-v1-1'

export const createRecommendationPreviewServiceV2 = (
  dependencies: RecommendationPreviewServiceDependenciesV2,
): RecommendationPreviewServiceV2 => ({
  build: async (evaluationAsOf: string): Promise<RecommendationPreviewApplicationResultV2> => {
    const draft = dependencies.draftSource.getDraft()
    const profileResult = deriveElderProfilePreviewV2(draft)
    if (!profileResult.ok) {
      return {
        ok: false,
        error: {
          code: 'ASSESSMENT_PROFILE_V2_ERROR',
          causeCode: profileResult.error.code,
        },
      }
    }
    const catalogResult = await dependencies.institutionCatalog.loadCatalog()
    if (!catalogResult.ok) {
      return {
        ok: false,
        error: {
          code: 'INSTITUTION_CATALOG_V11_ERROR',
          causeCode: catalogResult.error.code,
        },
      }
    }
    const recommendationResult = evaluateRecommendationPreviewV2({
      profile: profileResult.preview,
      institutions: catalogResult.value.records,
      datasetVersion: catalogResult.value.datasetVersion,
      datasetMode: catalogResult.value.datasetMode,
      evaluationAsOf,
      contractVersion: 'recommendation-contract-v2',
      rulesetVersion: 'recommendation-ruleset-v2',
      policyVersion: 'conservative-exact-with-conditional-v1',
    })
    if (!recommendationResult.ok) {
      return {
        ok: false,
        error: {
          code: 'RECOMMENDATION_V2_ERROR',
          causeCode: recommendationResult.error.code,
          paths: recommendationResult.error.paths.slice(),
        },
      }
    }
    return { ok: true, value: recommendationResult.value }
  },
})

export const recommendationPreviewServiceV2 = createRecommendationPreviewServiceV2({
  draftSource: assessmentDraftStore,
  institutionCatalog: institutionCatalogServiceV11,
})
