// Public ownership/nature is not inferred from care type or from an institution name.
export interface DirectoryMetadata { institutionId: string; nature: string; district: string }
export const readDirectoryMetadata = (): readonly DirectoryMetadata[] => []
export { directoryNatureOptions, directoryDistrictOptions } from './directory-options'
