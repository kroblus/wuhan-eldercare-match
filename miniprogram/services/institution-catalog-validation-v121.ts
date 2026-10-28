/** Client catalog boundary: runtime options and provider failures stay outside the domain. */
import {
  validateInstitutionCatalogPayloadV121 as validateCatalog,
  projectInstitutionCatalogV121ToV11 as projectCatalog,
} from '../domain/institution/v1-2-1/catalog'
import { institutionValidationOptions } from '../runtime/institution-validation'
import type { InstitutionCatalogResultV11, InstitutionCatalogServiceV11 } from '../types/institution-catalog-v1-1'
import type {
  InstitutionCatalogPayloadV121, InstitutionCatalogProviderV121,
  InstitutionCatalogResultV121, InstitutionCatalogServiceV121,
} from '../types/institution-catalog-v1-2-1'

// Compatibility entry points preserve the existing application signatures.
export const validateInstitutionCatalogPayloadV121 = (input: unknown): InstitutionCatalogResultV121 =>
  validateCatalog(input, institutionValidationOptions)

export const projectInstitutionCatalogV121ToV11 = (catalog: InstitutionCatalogPayloadV121): InstitutionCatalogResultV11 =>
  projectCatalog(catalog, institutionValidationOptions)

export const createInstitutionCatalogServiceV121 = (
  provider: InstitutionCatalogProviderV121,
): InstitutionCatalogServiceV121 => ({
  loadCatalog: async (): Promise<InstitutionCatalogResultV121> => {
    let payload: InstitutionCatalogPayloadV121
    try {
      payload = await provider.loadCatalog()
    } catch (_error) {
      return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
    }
    return validateInstitutionCatalogPayloadV121(payload)
  },
})

/**
 * Adapter used by frozen Recommendation V1/V2 consumers. It projects the
 * complete validated current pool and never pre-filters or ranks records.
 */
export const createInstitutionCatalogServiceV11Adapter = (
  service: InstitutionCatalogServiceV121,
): InstitutionCatalogServiceV11 => ({
  loadCatalog: async (): Promise<InstitutionCatalogResultV11> => {
    let result: InstitutionCatalogResultV121
    try {
      result = await service.loadCatalog()
    } catch (_error) {
      return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
    }
    if (!result.ok) {
      const code = result.error.code === 'DUPLICATE_CURRENT_INSTITUTION_ID'
        || result.error.code === 'DUPLICATE_CURRENT_POINTER'
        ? 'DUPLICATE_INSTITUTION_ID'
        : result.error.code === 'INVALID_CATALOG_ENVELOPE'
          || result.error.code === 'INVALID_INSTITUTION_RECORD'
          || result.error.code === 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
          || result.error.code === 'DATASET_PROVENANCE_MISMATCH'
          || result.error.code === 'CURRENT_POINTER_NOT_FOUND'
          || result.error.code === 'CURRENT_POINTER_MISMATCH'
          || result.error.code === 'DUPLICATE_CANONICAL_IDENTITY'
          || result.error.code === 'INVALID_PRESENTATION_METADATA'
          || result.error.code === 'PRESENTATION_IDENTITY_NOT_FOUND'
          || result.error.code === 'DUPLICATE_DISPLAY_ORDER'
          ? 'INVALID_CATALOG_ENVELOPE'
          : 'PROVIDER_LOAD_FAILED'
      return {
        ok: false,
        error: {
          code,
          ...(result.error.recordIndex === undefined ? {} : { recordIndex: result.error.recordIndex }),
        },
      }
    }
    return projectInstitutionCatalogV121ToV11(result.value)
  },
})

