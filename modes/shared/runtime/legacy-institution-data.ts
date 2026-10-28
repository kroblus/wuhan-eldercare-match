import type { InstitutionCatalogProvider } from '../types/institution-catalog'
import type { InstitutionPublicContentCatalogV1 } from '../types/institution-public-content-v1'
import type { Institution } from '../types/domain'
// Legacy fixtures are never a fallback for either deliverable mode.
export const legacyInstitutionCatalogProvider: InstitutionCatalogProvider = {
  loadCatalog: async () => ({ datasetVersion: 'legacy-provider-not-configured', datasetMode: 'PRODUCTION', records: [] }),
}
export const institutionPublicContentCatalog: InstitutionPublicContentCatalogV1 = { records: [], currentHeads: [] }
export const legacyInstitutions: Institution[] = []
