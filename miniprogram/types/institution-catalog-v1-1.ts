import type { InstitutionRecordV11 } from './institution-v1-1'
import type { RecommendationDatasetMode } from './recommendation'

export interface InstitutionCatalogPayloadV11 {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  records: readonly InstitutionRecordV11[]
}

export interface InstitutionCatalogProviderV11 {
  loadCatalog(): Promise<InstitutionCatalogPayloadV11>
}

export type InstitutionCatalogErrorCodeV11 =
  | 'PROVIDER_LOAD_FAILED'
  | 'INVALID_CATALOG_ENVELOPE'
  | 'INVALID_INSTITUTION_RECORD'
  | 'DUPLICATE_INSTITUTION_ID'

export type InstitutionCatalogResultV11 =
  | { ok: true; value: InstitutionCatalogPayloadV11 }
  | { ok: false; error: { code: InstitutionCatalogErrorCodeV11; recordIndex?: number } }

export interface InstitutionCatalogServiceV11 {
  loadCatalog(): Promise<InstitutionCatalogResultV11>
}
