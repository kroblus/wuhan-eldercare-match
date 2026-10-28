/** Default client provider remains separate from the reusable pure catalog boundary. */
import { readModeCatalog } from '../runtime/institution-catalog-provider'
import { createInstitutionCatalogServiceV121, createInstitutionCatalogServiceV11Adapter } from './institution-catalog-validation-v121'
export * from './institution-catalog-validation-v121'
export const mockInstitutionCatalogProviderV121 = {
  loadCatalog: () => Promise.resolve(JSON.parse(JSON.stringify(readModeCatalog()))),
}
export const institutionCatalogServiceV121 = createInstitutionCatalogServiceV121(mockInstitutionCatalogProviderV121)
export const institutionCatalogServiceV11Adapter = createInstitutionCatalogServiceV11Adapter(institutionCatalogServiceV121)
export const createRecommendationInstitutionCatalogServiceV11 = createInstitutionCatalogServiceV11Adapter
