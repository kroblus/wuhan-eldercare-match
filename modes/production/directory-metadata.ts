import { readModeCatalog } from './catalog'
import { reviewedDistricts } from './administrative-divisions'
import { publicDirectoryEntries } from './directory-data'
import { buildPublicDirectoryEntry, isCurrentPublicField } from './record-builder'
export { directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-options'
const natureLabels = { public: '公办', public_built_private_operated: '公建民营', private: '民办' }
export const readDirectoryMetadata = () => readModeCatalog().records.map(record => {
  const { institutionId, recordRevision } = record
  const address = record.publicLocation.address
  const current = isCurrentPublicField(institutionId, recordRevision, 'publicLocation.address', address, record.evidence)
  const district = current && address.value ? reviewedDistricts.find(row => row.code === address.value!.district.code) : undefined
  const entry = publicDirectoryEntries.find(row => row.institutionId === institutionId && row.recordRevision === recordRevision)
  const supplemental = entry ? buildPublicDirectoryEntry(entry) : null
  const nature = supplemental && isCurrentPublicField(institutionId, recordRevision, 'directory.nature', supplemental.nature, supplemental.natureEvidence) && supplemental.nature.availability === 'provided' ? supplemental.nature.value : 'unknown'
  return { institutionId, recordRevision, nature, natureLabel: nature === 'unknown' ? '' : natureLabels[nature], district: district ? district.searchKey : 'unknown' }
})
