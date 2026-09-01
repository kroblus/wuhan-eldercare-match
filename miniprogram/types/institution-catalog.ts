import type {
  InstitutionRecord,
} from './institution'
import type { InstitutionValidationErrorCode } from '../domain/institution'
import type { RecommendationDatasetMode } from './recommendation'

/** The complete catalog envelope consumed by the application layer. */
export interface InstitutionCatalogPayload {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  records: readonly InstitutionRecord[]
}

export interface InstitutionCatalogProvider {
  loadCatalog(): Promise<InstitutionCatalogPayload>
}

export type InstitutionCatalogErrorCode =
  | 'INSTITUTION_CATALOG_ERROR'
  | 'INVALID_INSTITUTION_RECORD'
  | 'NO_INSTITUTIONS_AVAILABLE'

/** Stable causes intentionally contain no provider exception text or payload paths. */
export type InstitutionCatalogErrorCauseCode =
  | 'PROVIDER_LOAD_FAILED'
  | 'INVALID_CATALOG_ENVELOPE'
  | 'INVALID_DATASET_VERSION'
  | 'INVALID_DATASET_MODE'
  | 'INVALID_RECORDS'
  | 'DUPLICATE_INSTITUTION_ID'
  | 'EMPTY_CATALOG'
  | InstitutionValidationErrorCode

export interface InstitutionCatalogError {
  ok: false
  error: {
    code: InstitutionCatalogErrorCode
    causeCode: InstitutionCatalogErrorCauseCode
    recordIndex?: number
  }
}

export interface InstitutionCatalogSuccess {
  ok: true
  value: InstitutionCatalogPayload
}

export type InstitutionCatalogResult = InstitutionCatalogSuccess | InstitutionCatalogError

export interface InstitutionCatalogService {
  loadCatalog(): Promise<InstitutionCatalogResult>
}
