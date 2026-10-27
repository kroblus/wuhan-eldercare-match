/** Default client provider remains separate from the reusable pure catalog boundary. */
import { MOCK_INSTITUTION_CATALOG_V121 } from '../mock/institution-catalog.mock'
import { createInstitutionCatalogServiceV121, createInstitutionCatalogServiceV11Adapter } from './institution-catalog-validation-v121'
export * from './institution-catalog-validation-v121'
export const mockInstitutionCatalogProviderV121 = {
  loadCatalog: () => Promise.resolve(JSON.parse(JSON.stringify(MOCK_INSTITUTION_CATALOG_V121))),
}
export const institutionCatalogServiceV121 = createInstitutionCatalogServiceV121(mockInstitutionCatalogProviderV121)
export const institutionCatalogServiceV11Adapter = createInstitutionCatalogServiceV11Adapter(institutionCatalogServiceV121)
export const createRecommendationInstitutionCatalogServiceV11 = createInstitutionCatalogServiceV11Adapter
