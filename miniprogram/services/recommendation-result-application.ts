import { assessmentDraftStore } from '../store/assessment-draft'
import type { AssessmentDraftV2 } from '../types/assessment-v2'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import type { RecommendationResultApplicationErrorV2 } from '../types/recommendation-result-v2'
import type { RecommendationResultApplicationSnapshot } from '../types/recommendation-preview'
import type {
  InitialReferenceApplicationErrorV1,
  InitialReferenceLegacyV2ServiceFactoryV1,
  ReferenceCompositionV1,
} from '../types/initial-reference-v1'
import type { InstitutionCatalogServiceV121 } from '../types/institution-catalog-v1-2-1'
import { buildRecommendationResultSnapshot } from './recommendation-preview'
import {
  createRecommendationPreviewServiceV2,
} from './recommendation-preview-v2'
import { institutionCatalogServiceV121 } from './institution-catalog-v1-2-1'
import { createInitialReferencePreviewServiceV1 } from './initial-reference-preview-v1'
import { EXPECTED_RECOMMENDATION_DATASET_MODE } from '../runtime/recommendation-mode'

export type RecommendationResultApplication =
  | { version: 1, value: RecommendationResultApplicationSnapshot }
  | { version: 2, value: RecommendationResultApplicationSnapshotV2, reference?: ReferenceCompositionV1 }

export type RecommendationResultApplicationFailure = {
  ok: false
  version: 1 | 2
  error: RecommendationResultApplicationErrorV2 | InitialReferenceApplicationErrorV1 | {
    code: string
    causeCode?: string
    state?: InitialReferenceApplicationErrorV1['state']
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
  institutionCatalogV121?: InstitutionCatalogServiceV121
  createLegacyV2Service?: InitialReferenceLegacyV2ServiceFactoryV1
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
      // Keep explicit snapshot-builder injection as a compatibility test seam.
      // The live path composes through C1, sharing the captured Draft and one
      // provider read between C1 and the frozen V2 snapshot builder.
      if (dependencies.v2Builder !== undefined) {
        const result = await dependencies.v2Builder(evaluationAsOf)
        return result.ok
          ? { ok: true, version: 2, value: result.value }
          : { ok: false, version: 2, error: result.error }
      }
      const reference = await createInitialReferencePreviewServiceV1({
        draftSource: { getDraft: () => draft as AssessmentDraftV2 },
        institutionCatalogV121: dependencies.institutionCatalogV121 || institutionCatalogServiceV121,
        expectedDatasetMode: EXPECTED_RECOMMENDATION_DATASET_MODE,
        createLegacyV2Service: dependencies.createLegacyV2Service || (serviceDependencies =>
          createRecommendationPreviewServiceV2(serviceDependencies)),
      }).build(evaluationAsOf)
      return reference.ok
        ? {
          ok: true,
          version: 2,
          value: reference.value.legacyV2,
          reference: reference.value,
        }
        : { ok: false, version: 2, error: reference.error }
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
