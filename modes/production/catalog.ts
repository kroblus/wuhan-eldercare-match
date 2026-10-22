import type { InstitutionCatalogPayloadV121 } from '../types/institution-catalog-v1-2-1'
import { createFirstRecord } from './first-record'
import { publicDirectoryEntries } from './directory-data'
import { buildPublicDirectoryEntry } from './record-builder'
import { publicSources } from './sources'
import type { PublicSource, PublicSourceKey } from './sources'
import type { PublicDirectoryEntry } from './directory-data'
export { firstInstitutionId, verificationDate } from './first-record'
export const buildProductionCatalog = (entries: readonly PublicDirectoryEntry[] = publicDirectoryEntries, sources: Record<PublicSourceKey, PublicSource> = publicSources): InstitutionCatalogPayloadV121 => {
  const additions = entries.map(entry => buildPublicDirectoryEntry(entry, sources).record)
    .filter(record => record.identity.name.availability === 'provided' && record.identity.regionCode.availability === 'provided' && record.identity.regionDisplayName.availability === 'provided' && record.publicLocation.address.availability === 'provided')
  const records = [createFirstRecord(), ...additions]
  return { datasetVersion: 'wuhan-public-directory-20261022-r2', datasetMode: 'PRODUCTION', records,
    currentPointers: records.map(row => ({ institutionId: row.institutionId, recordRevision: row.recordRevision })),
    presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] } }
}
export const readModeCatalog = (): InstitutionCatalogPayloadV121 => buildProductionCatalog()
// A public telephone or listing does not establish a partnership or a booking service.
export const canRequestInstitutionService = (_institutionId: string): boolean => false
