import { createInstitutionCurrentCatalogResolverV121 } from './institution-record-resolver'
import { institutionCatalogServiceV121 } from './institution-catalog-v1-2-1'

// Share overlapping loads only. A later list/detail/call action always reads again.
export const institutionCurrentCatalogResolver = createInstitutionCurrentCatalogResolverV121(
  institutionCatalogServiceV121, { sharePendingLoads: true },
)
