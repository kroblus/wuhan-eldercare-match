import type { InstitutionListItemViewModel } from '../pages/institution/list-view-model'
import { readDirectoryMetadata, directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-metadata'

// The existing directory predicate, shared by Home and the standalone directory.
// Preserve input order and canonical identities. This does not rank or recommend.
export const filterInstitutionDirectory = (
  items: readonly InstitutionListItemViewModel[], keywordInput: string, natureIndex: number, districtIndex: number,
): readonly InstitutionListItemViewModel[] => {
  const keyword = keywordInput.trim().toLowerCase()
  const nature = directoryNatureOptions[natureIndex] || directoryNatureOptions[0]
  const district = directoryDistrictOptions[districtIndex] || directoryDistrictOptions[0]
  // Name-only search does not consult time-sensitive nature/address facts.
  const needsMetadata = nature.value !== 'all' || district.value !== 'all'
  const metadata = needsMetadata ? readDirectoryMetadata() : []
  return items.filter(item => {
    if (keyword && item.name.toLowerCase().indexOf(keyword) < 0) return false
    if (!needsMetadata) return true
    const entry = metadata.find(row => row.institutionId === item.institutionId && (row.recordRevision === undefined || row.recordRevision === item.recordRevision))
    return (nature.value === 'all' || (entry ? entry.nature : 'unknown') === nature.value)
      && (district.value === 'all' || (entry ? entry.district : 'unknown') === district.value)
  })
}
