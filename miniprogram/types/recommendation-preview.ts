import type { AssessmentQuestionId } from './assessment'
import type {
  RecommendationErrorCode,
  RecommendationAdvisoryAttachment,
  RecommendationDatasetMode,
  RecommendationPreview,
} from './recommendation'
import type { InstitutionRecord } from './institution'
import type {
  ElderProfilePreviewDerivationErrorCode,
} from './elder-profile'
import type {
  InstitutionCatalogErrorCauseCode,
} from './institution-catalog'

export interface RecommendationPreviewBuildOptions {
  evaluationAsOf: string
}

export type RecommendationPreviewApplicationErrorCode =
  | 'ASSESSMENT_PREVIEW_ERROR'
  | 'INSTITUTION_CATALOG_ERROR'
  | 'INVALID_INSTITUTION_RECORD'
  | 'NO_INSTITUTIONS_AVAILABLE'
  | 'RECOMMENDATION_DERIVATION_ERROR'

export type RecommendationPreviewApplicationErrorCauseCode =
  | 'DRAFT_READ_FAILED'
  | 'DRAFT_DERIVATION_FAILED'
  | ElderProfilePreviewDerivationErrorCode
  | InstitutionCatalogErrorCauseCode
  | 'CATALOG_SERVICE_FAILED'
  | RecommendationErrorCode
  | 'EVALUATOR_FAILED'

export interface RecommendationPreviewApplicationError {
  code: RecommendationPreviewApplicationErrorCode
  causeCode: RecommendationPreviewApplicationErrorCauseCode
  questionIds?: readonly AssessmentQuestionId[]
  recordIndex?: number
}

export interface RecommendationPreviewApplicationSuccess {
  ok: true
  value: RecommendationPreview
}

export interface RecommendationPreviewApplicationFailure {
  ok: false
  error: RecommendationPreviewApplicationError
}

export type RecommendationPreviewApplicationResult =
  | RecommendationPreviewApplicationSuccess
  | RecommendationPreviewApplicationFailure

/**
 * Page-facing additive snapshot.  The frozen RecommendationPreview remains a
 * semantic result; display facts are joined from the same validated catalog
 * snapshot at the application boundary.
 */
export interface RecommendationResultApplicationSnapshot {
  preview: RecommendationPreview
  institutionRecords: readonly InstitutionRecord[]
  advisories: readonly RecommendationAdvisoryAttachment[]
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
}

export interface RecommendationResultApplicationSuccess {
  ok: true
  value: RecommendationResultApplicationSnapshot
}

export interface RecommendationResultApplicationFailure {
  ok: false
  error: RecommendationPreviewApplicationError
}

export type RecommendationResultApplicationResult =
  | RecommendationResultApplicationSuccess
  | RecommendationResultApplicationFailure
