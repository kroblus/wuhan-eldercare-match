import { readModeCatalog as readBundledCatalog } from '../production/catalog'
import { institutionPublicationClient } from '../services/institution-publications'

export const readModeCatalog = async () => {
  const published = await institutionPublicationClient.load()
  if (!published) return readBundledCatalog()
  // Synthetic public profiles are browsable only in the marked P1 development page.
  // Never label a synthetic catalog as production in the ordinary directory/recommendations.
  if (published.dataEnvironment !== 'PRODUCTION') throw new Error('SYNTHETIC_PUBLIC_CATALOG_NOT_ALLOWED')
  return published.catalog
}
