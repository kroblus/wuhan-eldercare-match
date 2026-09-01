import { deriveElderProfilePreview } from '../domain/elder-profile'
import { evaluateRecommendationPreview } from '../domain/recommendation'
import { isAssessmentQuestionId } from '../types/assessment'
import type { AssessmentQuestionId } from '../types/assessment'
import type { ElderProfilePreviewDerivationResult } from '../types/elder-profile'
import type {
  InstitutionCatalogPayload,
  InstitutionCatalogErrorCauseCode,
  InstitutionCatalogErrorCode,
  InstitutionCatalogResult,
  InstitutionCatalogService,
} from '../types/institution-catalog'
import type {
  ElderProfilePreview,
  ElderProfilePreviewDerivationErrorCode,
} from '../types/elder-profile'
import type {
  RecommendationError,
  RecommendationEvaluationInput,
  RecommendationPreview,
} from '../types/recommendation'
import {
  RECOMMENDATION_POLICY_VERSION,
  RECOMMENDATION_RULESET_VERSION,
} from '../types/recommendation'
import type {
  RecommendationPreviewApplicationError,
  RecommendationPreviewApplicationResult,
  RecommendationPreviewBuildOptions,
  RecommendationPreviewApplicationErrorCauseCode,
} from '../types/recommendation-preview'
import { assessmentDraftStore } from '../store/assessment-draft'
import { institutionCatalogService } from './institution-catalog'

export type {
  RecommendationPreviewApplicationError,
  RecommendationPreviewApplicationResult,
  RecommendationPreviewBuildOptions,
} from '../types/recommendation-preview'

export interface RecommendationPreviewServiceDependencies {
  readDraftSnapshot: () => unknown
  catalogService: InstitutionCatalogService
}

export interface RecommendationPreviewService {
  buildRecommendationPreview(
    options: RecommendationPreviewBuildOptions,
  ): Promise<RecommendationPreviewApplicationResult>
}

type RawRecord = Record<string, unknown>

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const CATALOG_ERROR_CODES: readonly InstitutionCatalogErrorCode[] = [
  'INSTITUTION_CATALOG_ERROR',
  'INVALID_INSTITUTION_RECORD',
  'NO_INSTITUTIONS_AVAILABLE',
]

const CATALOG_CAUSE_CODES: readonly InstitutionCatalogErrorCauseCode[] = [
  'PROVIDER_LOAD_FAILED',
  'INVALID_CATALOG_ENVELOPE',
  'INVALID_DATASET_VERSION',
  'INVALID_DATASET_MODE',
  'INVALID_RECORDS',
  'DUPLICATE_INSTITUTION_ID',
  'EMPTY_CATALOG',
  'INVALID_RECORD_SHAPE',
  'INVALID_CONTRACT_VERSION',
  'INVALID_CAPABILITY_CONTRACT_VERSION',
  'INVALID_INSTITUTION_ID',
  'INVALID_RECORD_REVISION',
  'INVALID_RECORD_PROVENANCE',
  'INVALID_MOCK_LABEL',
  'INVALID_COORDINATES',
  'INVALID_RECORD_STATUS',
  'INVALID_FIELD',
  'INVALID_VERIFICATION',
  'INVALID_TYPE_PROFILE',
  'INVALID_CAPABILITY_MATRIX',
  'INVALID_CAPABILITY',
  'INVALID_SERVICE',
  'INVALID_MEDICAL_SUPPORT',
  'INVALID_REHABILITATION_SUPPORT',
  'INVALID_STAFFING',
  'INVALID_PRICE',
  'INVALID_AVAILABILITY',
  'INVALID_ROOM',
  'INVALID_MEDIA',
  'INVALID_VR',
  'INVALID_QUALIFICATION',
  'INVALID_EVIDENCE',
  'DUPLICATE_ID',
  'BROKEN_REFERENCE',
  'EVIDENCE_REVISION_MISMATCH',
  'EVIDENCE_STATUS_MISMATCH',
  'EVIDENCE_VALUE_MISMATCH',
  'EVIDENCE_VERIFICATION_MISMATCH',
]

const isKnownCatalogErrorCode = (value: unknown): value is InstitutionCatalogErrorCode =>
  typeof value === 'string'
  && CATALOG_ERROR_CODES.indexOf(value as InstitutionCatalogErrorCode) >= 0

const isKnownCatalogCauseCode = (value: unknown): value is InstitutionCatalogErrorCauseCode =>
  typeof value === 'string'
  && CATALOG_CAUSE_CODES.indexOf(value as InstitutionCatalogErrorCauseCode) >= 0

const DERIVATION_ERROR_CODES: readonly ElderProfilePreviewDerivationErrorCode[] = [
  'INVALID_DRAFT_STRUCTURE',
  'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE',
  'UNSUPPORTED_ASSESSMENT_SCHEMA',
]

const isKnownDerivationErrorCode = (value: unknown): value is ElderProfilePreviewDerivationErrorCode =>
  typeof value === 'string'
  && DERIVATION_ERROR_CODES.indexOf(value as ElderProfilePreviewDerivationErrorCode) >= 0

const stableQuestionIds = (value: unknown): readonly AssessmentQuestionId[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is AssessmentQuestionId => isAssessmentQuestionId(item)).slice()
}

const makeError = (
  code: RecommendationPreviewApplicationError['code'],
  causeCode: RecommendationPreviewApplicationErrorCauseCode,
  questionIds?: readonly AssessmentQuestionId[],
  recordIndex?: number,
): RecommendationPreviewApplicationResult => ({
  ok: false,
  error: {
    code,
    causeCode,
    ...(questionIds === undefined ? {} : { questionIds: stableQuestionIds(questionIds) }),
    ...(recordIndex === undefined ? {} : { recordIndex }),
  },
})

const mapDraftFailure = (result: ElderProfilePreviewDerivationResult): RecommendationPreviewApplicationResult => {
  if (result.ok) {
    return makeError('ASSESSMENT_PREVIEW_ERROR', 'DRAFT_DERIVATION_FAILED')
  }
  const rawError: unknown = result.error
  const safeError = isPlainRecord(rawError) ? rawError : undefined
  const causeCode = safeError !== undefined && isKnownDerivationErrorCode(safeError.code)
    ? safeError.code
    : 'DRAFT_DERIVATION_FAILED'
  const questionIds = safeError === undefined ? [] : stableQuestionIds(safeError.questionIds)
  return makeError(
    'ASSESSMENT_PREVIEW_ERROR',
    causeCode,
    questionIds,
  )
}

const isCatalogResult = (value: unknown): value is InstitutionCatalogResult => {
  if (!isPlainRecord(value) || (value.ok !== true && value.ok !== false)) {
    return false
  }
  if (value.ok === false) {
    return isPlainRecord(value.error)
      && typeof value.error.code === 'string'
      && typeof value.error.causeCode === 'string'
  }
  if (!isPlainRecord(value.value)) {
    return false
  }
  return typeof value.value.datasetVersion === 'string'
    && (value.value.datasetMode === 'PRODUCTION' || value.value.datasetMode === 'MOCK_DEVELOPMENT_ONLY')
    && Array.isArray(value.value.records)
}

const mapCatalogFailure = (result: InstitutionCatalogResult): RecommendationPreviewApplicationResult => {
  if (result.ok) {
    return makeError('INSTITUTION_CATALOG_ERROR', 'CATALOG_SERVICE_FAILED')
  }
  const error = result.error
  if (!isKnownCatalogErrorCode(error.code) || !isKnownCatalogCauseCode(error.causeCode)) {
    return makeError('INSTITUTION_CATALOG_ERROR', 'CATALOG_SERVICE_FAILED')
  }
  const recordIndex = typeof error.recordIndex === 'number'
    && Number.isInteger(error.recordIndex)
    && error.recordIndex >= 0
    ? error.recordIndex
    : undefined
  if (error.code === 'NO_INSTITUTIONS_AVAILABLE') {
    return makeError('NO_INSTITUTIONS_AVAILABLE', error.causeCode, undefined, recordIndex)
  }
  if (error.code === 'INVALID_INSTITUTION_RECORD') {
    return makeError('INVALID_INSTITUTION_RECORD', error.causeCode, undefined, recordIndex)
  }
  return makeError('INSTITUTION_CATALOG_ERROR', error.causeCode, undefined, recordIndex)
}

const isKnownRecommendationErrorCode = (value: unknown): value is RecommendationError['code'] =>
  typeof value === 'string' && [
    'INVALID_INPUT',
    'INVALID_PROFILE_ENVELOPE',
    'INVALID_PROFILE_SNAPSHOT',
    'INVALID_PROFILE_EVIDENCE',
    'INVALID_PROFILE_CLARIFICATION',
    'INVALID_RECOMMENDATION_VERSION',
    'INVALID_EVALUATION_AS_OF',
    'INVALID_DATASET',
    'INVALID_INSTITUTION_RECORD',
    'DUPLICATE_INSTITUTION_ID',
    'MIXED_INSTITUTION_REVISION',
    'INVALID_INSTITUTION_PROVENANCE',
    'INVALID_POOL_MANIFEST',
  ].indexOf(value) >= 0

const mapRecommendationFailure = (error: unknown): RecommendationPreviewApplicationResult => {
  const causeCode = isPlainRecord(error) && isKnownRecommendationErrorCode(error.code)
    ? error.code
    : 'EVALUATOR_FAILED'
  return makeError('RECOMMENDATION_DERIVATION_ERROR', causeCode)
}

const isPreviewDerivationResult = (value: unknown): value is ElderProfilePreviewDerivationResult =>
  isPlainRecord(value) && typeof value.ok === 'boolean'

const isCatalogPayload = (value: unknown): value is InstitutionCatalogPayload =>
  isPlainRecord(value)
    && typeof value.datasetVersion === 'string'
    && (value.datasetMode === 'PRODUCTION' || value.datasetMode === 'MOCK_DEVELOPMENT_ONLY')
    && Array.isArray(value.records)

const buildWithDependencies = (
  dependencies: RecommendationPreviewServiceDependencies,
): RecommendationPreviewService => ({
  buildRecommendationPreview: async (
    options: RecommendationPreviewBuildOptions,
  ): Promise<RecommendationPreviewApplicationResult> => {
    let draftSnapshot: unknown
    try {
      draftSnapshot = dependencies.readDraftSnapshot()
    } catch (_error) {
      return makeError('ASSESSMENT_PREVIEW_ERROR', 'DRAFT_READ_FAILED')
    }

    let profileResult: ElderProfilePreviewDerivationResult
    try {
      profileResult = deriveElderProfilePreview(draftSnapshot)
    } catch (_error) {
      return makeError('ASSESSMENT_PREVIEW_ERROR', 'DRAFT_DERIVATION_FAILED')
    }
    if (!isPreviewDerivationResult(profileResult)) {
      return makeError('ASSESSMENT_PREVIEW_ERROR', 'DRAFT_DERIVATION_FAILED')
    }
    if (!profileResult.ok) {
      return mapDraftFailure(profileResult)
    }

    let catalogResult: unknown
    try {
      catalogResult = await dependencies.catalogService.loadCatalog()
    } catch (_error) {
      return makeError('INSTITUTION_CATALOG_ERROR', 'CATALOG_SERVICE_FAILED')
    }
    if (!isCatalogResult(catalogResult)) {
      return makeError('INSTITUTION_CATALOG_ERROR', 'CATALOG_SERVICE_FAILED')
    }
    if (!catalogResult.ok) {
      return mapCatalogFailure(catalogResult)
    }
    if (!isCatalogPayload(catalogResult.value)) {
      return makeError('INSTITUTION_CATALOG_ERROR', 'CATALOG_SERVICE_FAILED')
    }

    const request: RawRecord = isPlainRecord(options) ? options : {}
    const evaluationInput: RecommendationEvaluationInput<ElderProfilePreview> = {
      profile: profileResult.preview,
      institutions: catalogResult.value.records,
      datasetVersion: catalogResult.value.datasetVersion,
      datasetMode: catalogResult.value.datasetMode,
      evaluationAsOf: request.evaluationAsOf as string,
      rulesetVersion: RECOMMENDATION_RULESET_VERSION,
      policyVersion: RECOMMENDATION_POLICY_VERSION,
    }

    let recommendationResult: {
      ok: true
      value: RecommendationPreview
    } | {
      ok: false
      error: RecommendationError
    }
    try {
      recommendationResult = evaluateRecommendationPreview(evaluationInput)
    } catch (error) {
      return mapRecommendationFailure(error)
    }
    if (!recommendationResult.ok) {
      return mapRecommendationFailure(recommendationResult.error)
    }
    return { ok: true, value: recommendationResult.value }
  },
})

/** Explicit test seam; only the Draft reader and catalog service are injectable. */
export const createRecommendationPreviewService = (
  dependencies: RecommendationPreviewServiceDependencies,
): RecommendationPreviewService => buildWithDependencies(dependencies)

const defaultRecommendationPreviewService = createRecommendationPreviewService({
  readDraftSnapshot: (): unknown => assessmentDraftStore.getDraft(),
  catalogService: institutionCatalogService,
})

export const recommendationPreviewService: RecommendationPreviewService =
  defaultRecommendationPreviewService

/** Default application entry for the future recommendation page. */
export const buildRecommendationPreview = (
  options: RecommendationPreviewBuildOptions,
): Promise<RecommendationPreviewApplicationResult> =>
  defaultRecommendationPreviewService.buildRecommendationPreview(options)
