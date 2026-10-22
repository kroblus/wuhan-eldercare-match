import type { InstitutionListItemViewModel } from '../pages/institution/list-view-model'
import { readDirectoryMetadata, directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-metadata'

// The existing directory predicate, shared by Home and the standalone directory.
// Preserve input order and canonical identities. This does not rank or recommend.
export const filterInstitutionDirectory = (
  items: readonly InstitutionListItemViewModel[], keywordInput: string, natureIndex: number, districtIndex: number,
): readonly InstitutionListItemViewModel[] => {
  const keyword = keywordInput.trim().toLowerCase()
  const metadata = readDirectoryMetadata()
  const nature = directoryNatureOptions[natureIndex] || directoryNatureOptions[0]
  const district = directoryDistrictOptions[districtIndex] || directoryDistrictOptions[0]
  return items.filter(item => {
    if (keyword && item.name.toLowerCase().indexOf(keyword) < 0) return false
    const entry = metadata.find(row => row.institutionId === item.institutionId)
    return (nature.value === 'all' || !!entry && entry.nature === nature.value)
      && (district.value === 'all' || !!entry && entry.district === district.value)
  })
}
