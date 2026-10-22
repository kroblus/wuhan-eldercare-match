import directory from '../demo/directory.json'
import { readDemo } from '../demo/session'
import { readSearchCatalogNatureOptions, readSearchCatalogDistrictOptions } from '../demo/search-catalog'
export const readDirectoryMetadata = () => readDemo().ready ? directory : []
export const directoryNatureOptions = [{ value: 'all', label: '全部性质' }, ...readSearchCatalogNatureOptions()]
export const directoryDistrictOptions = [{ value: 'all', label: '全部区域' }, ...readSearchCatalogDistrictOptions()]
