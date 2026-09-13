/**
 * Current development catalog envelope for Institution V1.2.1.
 *
 * The Institution record remains the source of business facts.  The current
 * pointer and presentation metadata are catalog/application facts and must
 * never be inferred from array order or revision arithmetic.
 */
import type { RecommendationDatasetMode } from './recommendation'
import type { InstitutionRecordV11 } from './institution-v1-1'
import type { InstitutionRecordV12 } from './institution-v1-2'
import type { InstitutionRecordV121 } from './institution-v1-2-1'

export type InstitutionCatalogContractVersionV121 = 'institution-catalog-contract-v1.2.1'

export type InstitutionCatalogRecordVersioned =
  | InstitutionRecordV11
  | InstitutionRecordV12
  | InstitutionRecordV121

export interface InstitutionCatalogCurrentPointerV121 {
  institutionId: string
  recordRevision: number
}

export interface InstitutionCatalogDisplayOrderEntryV121
  extends InstitutionCatalogCurrentPointerV121 {
  displayOrder: number
}

export type InstitutionCatalogOrderingPolicyV121 =
  | 'CURATED_DISPLAY_ORDER_V1'
  | 'CANONICAL_IDENTITY_ASC_V1'

export interface InstitutionCatalogPresentationMetadataV121 {
  orderingPolicy: InstitutionCatalogOrderingPolicyV121
  displayOrder: readonly InstitutionCatalogDisplayOrderEntryV121[]
}

/**
 * The current catalog deliberately contains only V1.2.1 records.  The
 * versioned union above is used by dispatch/compatibility helpers and is not
 * a license to mix predecessor records into the current pool.
 */
export interface InstitutionCatalogPayloadV121 {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  records: readonly InstitutionRecordV121[]
  currentPointers: readonly InstitutionCatalogCurrentPointerV121[]
  presentation: InstitutionCatalogPresentationMetadataV121
}

export interface InstitutionCatalogProviderV121 {
  loadCatalog(): Promise<InstitutionCatalogPayloadV121>
}

export type InstitutionCatalogErrorCodeV121 =
  | 'PROVIDER_LOAD_FAILED'
  | 'INVALID_CATALOG_ENVELOPE'
  | 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
  | 'INVALID_INSTITUTION_RECORD'
  | 'DATASET_PROVENANCE_MISMATCH'
  | 'DUPLICATE_CURRENT_INSTITUTION_ID'
  | 'DUPLICATE_CANONICAL_IDENTITY'
  | 'CURRENT_POINTER_NOT_FOUND'
  | 'CURRENT_POINTER_MISMATCH'
  | 'DUPLICATE_CURRENT_POINTER'
  | 'INVALID_PRESENTATION_METADATA'
  | 'PRESENTATION_IDENTITY_NOT_FOUND'
  | 'DUPLICATE_DISPLAY_ORDER'
  | 'V121_TO_V11_PROJECTION_ERROR'

export type InstitutionCatalogResultV121 =
  | { ok: true; value: InstitutionCatalogPayloadV121 }
  | {
      ok: false
      error: {
        code: InstitutionCatalogErrorCodeV121
        recordIndex?: number
        pointerIndex?: number
      }
    }

export interface InstitutionCatalogServiceV121 {
  loadCatalog(): Promise<InstitutionCatalogResultV121>
}
