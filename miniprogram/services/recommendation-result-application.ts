import { assessmentDraftStore } from '../store/assessment-draft'
import type { AssessmentDraftV2 } from '../types/assessment-v2'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import type { RecommendationResultApplicationErrorV2 } from '../types/recommendation-result-v2'
import type { RecommendationResultApplicationSnapshot } from '../types/recommendation-preview'
import { buildRecommendationResultSnapshot } from './recommendation-preview'
import {
  createRecommendationPreviewServiceV2,
} from './recommendation-preview-v2'
import { institutionCatalogServiceV11 } from './institution-catalog-v1-1'

export type RecommendationResultApplication =
  | { version: 1, value: RecommendationResultApplicationSnapshot }
  | { version: 2, value: RecommendationResultApplicationSnapshotV2 }

export type RecommendationResultApplicationFailure = {
  ok: false
  version: 1 | 2
  error: RecommendationResultApplicationErrorV2 | {
    code: string
    causeCode?: string
  }
}

export type RecommendationResultApplicationResult =
  | ({ ok: true } & RecommendationResultApplication)
  | RecommendationResultApplicationFailure

export interface RecommendationResultApplicationServiceDependencies {
  draftSource: { getDraft(): unknown }
  legacyBuilder?: typeof buildRecommendationResultSnapshot
  v2Builder?: (evaluationAsOf: string) => Promise<{
    ok: true
    value: RecommendationResultApplicationSnapshotV2
  } | { ok: false, error: RecommendationResultApplicationErrorV2 }>
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object'
  && value !== null
  && !Array.isArray(value)

const isV2Draft = (draft: unknown): boolean => isPlainRecord(draft)
  && draft.schemaVersion === 2

export const createRecommendationResultApplicationService = (
  dependencies: RecommendationResultApplicationServiceDependencies,
) => ({
  build: async (evaluationAsOf: string): Promise<RecommendationResultApplicationResult> => {
    let draft: unknown
    try {
      draft = dependencies.draftSource.getDraft()
    } catch (_error) {
      return {
        ok: false,
        version: 2,
        error: { code: 'ASSESSMENT_PROFILE_V2_ERROR', causeCode: 'DRAFT_READ_FAILED' },
      }
    }
    if (isV2Draft(draft)) {
      const v2Builder = dependencies.v2Builder || createRecommendationPreviewServiceV2({
        draftSource: { getDraft: () => draft as AssessmentDraftV2 },
        institutionCatalog: institutionCatalogServiceV11,
      }).buildResultSnapshot
      const result = await v2Builder(evaluationAsOf)
      return result.ok
        ? { ok: true, version: 2, value: result.value }
        : { ok: false, version: 2, error: result.error }
    }
    if (isPlainRecord(draft) && draft.schemaVersion !== undefined && draft.schemaVersion !== 1) {
      return {
        ok: false,
        version: 2,
        error: {
          code: 'ASSESSMENT_PROFILE_V2_ERROR',
          causeCode: 'UNSUPPORTED_ASSESSMENT_SCHEMA',
        },
      }
    }
    const legacyBuilder = dependencies.legacyBuilder || buildRecommendationResultSnapshot
    const legacyResult = await legacyBuilder({ evaluationAsOf })
    return legacyResult.ok
      ? { ok: true, version: 1, value: legacyResult.value }
      : { ok: false, version: 1, error: legacyResult.error }
  },
})

const defaultService = createRecommendationResultApplicationService({
  draftSource: assessmentDraftStore,
})

export const buildRecommendationResultApplicationSnapshot = (
  input: { evaluationAsOf: string },
): Promise<RecommendationResultApplicationResult> => defaultService.build(input.evaluationAsOf)
