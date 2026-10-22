// Public ownership/nature is not inferred from care type or from an institution name.
export interface DirectoryMetadata { institutionId: string; nature: string; district: string }
export const readDirectoryMetadata = (): readonly DirectoryMetadata[] => []
export const directoryNatureOptions = [{ value: 'all', label: '全部性质' }]
export const directoryDistrictOptions = [{ value: 'all', label: '全部区域' }]
