import type { InstitutionCatalogPayloadV121 } from '../types/institution-catalog-v1-2-1'
import { createFirstRecord } from './first-record'
import { publicDirectoryEntries } from './directory-data'
import { buildPublicDirectoryEntry } from './record-builder'
import { publicSources } from './sources'
import type { PublicSource, PublicSourceKey } from './sources'
import type { PublicDirectoryEntry } from './directory-data'
import { buildCapabilityHistory } from './capability-evidence'
import { capabilitySources, productionCapabilityRevisions } from './capability-reviews'
export { firstInstitutionId, verificationDate } from './first-record'
export const buildProductionCatalog = (entries: readonly PublicDirectoryEntry[] = publicDirectoryEntries, sources: Record<PublicSourceKey, PublicSource> = publicSources): InstitutionCatalogPayloadV121 => {
  const additions = entries.map(entry => buildPublicDirectoryEntry(entry, sources).record)
    .filter(record => record.identity.name.availability === 'provided' && record.identity.regionCode.availability === 'provided' && record.identity.regionDisplayName.availability === 'provided' && record.publicLocation.address.availability === 'provided')
  const history = buildCapabilityHistory([createFirstRecord(), ...additions], productionCapabilityRevisions, capabilitySources)
  return { datasetVersion: 'wuhan-public-directory-20261023-r3', datasetMode: 'PRODUCTION', records: history.currentRecords,
    currentPointers: history.currentPointers,
    presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] } }
}
export const readModeCatalog = (): InstitutionCatalogPayloadV121 => buildProductionCatalog()
// Exact lookup only; no latest/max-revision fallback and no mixed-revision pool.
export const readProductionRevision = (institutionId: string, recordRevision: number) => {
  const base = [createFirstRecord(), ...publicDirectoryEntries.map(entry => buildPublicDirectoryEntry(entry).record)]
  const history = buildCapabilityHistory(base, productionCapabilityRevisions, capabilitySources)
  return history.records.find(row => row.institutionId === institutionId && row.recordRevision === recordRevision) || null
}
// A public telephone or listing does not establish a partnership or a booking service.
export const canRequestInstitutionService = (_institutionId: string): boolean => false
