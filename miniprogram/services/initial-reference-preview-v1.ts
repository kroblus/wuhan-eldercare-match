import { institutionValidationOptions } from '../runtime/institution-validation'
import { createInstitutionCatalogServiceV11Adapter, validateInstitutionCatalogPayloadV121 } from './institution-catalog-v1-2-1'
import { composeReferenceResultV1 } from '../domain/recommendation/initial-reference-v1/composition'
import { copyDomainDataV2 } from '../domain/recommendation/v2/rules-v2'
import type { AssessmentDraftV2 } from '../types/assessment-v2'
import type { InstitutionCatalogResultV121 } from '../types/institution-catalog-v1-2-1'
import type {
  InitialReferenceApplicationResultV1,
  InitialReferencePreviewServiceDependenciesV1,
  InitialReferencePreviewServiceV1,
} from '../types/initial-reference-v1'

/**
 * The old V2 factory is deliberately injected: importing this module must not
 * import/initialize the default Assessment Draft Store or perform storage IO.
 * The capture promise belongs to one build, including concurrent build calls.
 */
export const createInitialReferencePreviewServiceV1 = (
  dependencies: InitialReferencePreviewServiceDependenciesV1,
): InitialReferencePreviewServiceV1 => ({
  build: async (evaluationAsOf: string): Promise<InitialReferenceApplicationResultV1> => {
    if (dependencies.expectedDatasetMode !== 'PRODUCTION'
      && dependencies.expectedDatasetMode !== 'MOCK_DEVELOPMENT_ONLY') {
      return { ok: false, error: { state: 'DATA_ERROR', code: 'REFERENCE_CATALOG_ERROR', causeCode: 'INVALID_EXPECTED_DATASET_MODE' } }
    }
    let draft: AssessmentDraftV2
    try {
      draft = copyDomainDataV2(dependencies.draftSource.getDraft())
    } catch (_error) {
      return {
        ok: false,
        error: { state: 'ASSESSMENT_ERROR', code: 'ASSESSMENT_PROFILE_V2_ERROR', causeCode: 'DRAFT_READ_FAILED' },
      }
    }
    const capture: { pending?: Promise<InstitutionCatalogResultV121>; result?: InstitutionCatalogResultV121 } = {}
    const loadCaptured = (): Promise<InstitutionCatalogResultV121> => {
      if (capture.pending === undefined) {
        capture.pending = (async (): Promise<InstitutionCatalogResultV121> => {
          try {
            const result = await dependencies.institutionCatalogV121.loadCatalog()
            if (!result.ok) {
              capture.result = copyDomainDataV2(result)
            } else {
              const validated = validateInstitutionCatalogPayloadV121(result.value)
              capture.result = validated.ok && validated.value.datasetMode !== dependencies.expectedDatasetMode
                ? { ok: false, error: { code: 'DATASET_PROVENANCE_MISMATCH' } }
                : validated
            }
          } catch (_error) {
            capture.result = { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
          }
          return capture.result
        })()
      }
      return capture.pending
    }
    try {
      const legacyService = dependencies.createLegacyV2Service({
        draftSource: { getDraft: () => copyDomainDataV2(draft) },
        institutionCatalog: createInstitutionCatalogServiceV11Adapter({ loadCatalog: loadCaptured }),
      })
      const result = await legacyService.buildResultSnapshot(evaluationAsOf)
      if (!result.ok) {
        const original = result.error
        const catalogFailure = capture.result !== undefined && !capture.result.ok ? capture.result.error : null
        if (catalogFailure !== null) {
          return {
            ok: false,
            error: {
              state: catalogFailure.code === 'PROVIDER_LOAD_FAILED' ? 'SERVICE_ERROR' : 'DATA_ERROR',
              code: 'REFERENCE_CATALOG_ERROR', causeCode: catalogFailure.code,
              ...(catalogFailure.recordIndex === undefined ? {} : { recordIndex: catalogFailure.recordIndex }),
              ...(catalogFailure.pointerIndex === undefined ? {} : { pointerIndex: catalogFailure.pointerIndex }),
            },
          }
        }
        return {
          ok: false,
          error: {
            state: original.code === 'ASSESSMENT_PROFILE_V2_ERROR' ? 'ASSESSMENT_ERROR' : 'DATA_ERROR',
            code: original.code, causeCode: original.causeCode,
            ...('paths' in original && original.paths !== undefined ? { paths: original.paths.slice() } : {}),
          },
        }
      }
      if (capture.result === undefined || !capture.result.ok) {
        return {
          ok: false,
          error: { state: 'DATA_ERROR', code: 'REFERENCE_CATALOG_ERROR', causeCode: 'CAPTURED_CATALOG_MISSING' },
        }
      }
      return composeReferenceResultV1({
        catalog: capture.result.value, legacyV2: result.value,
        evaluationAsOf, expectedDatasetMode: dependencies.expectedDatasetMode,
      }, institutionValidationOptions)
    } catch (_error) {
      return {
        ok: false,
        error: { state: 'SERVICE_ERROR', code: 'REFERENCE_APPLICATION_ERROR', causeCode: 'LEGACY_SERVICE_FAILED' },
      }
    }
  },
})
