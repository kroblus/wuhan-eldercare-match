import directory from '../demo/directory.json'
import { isDemoReady } from '../demo/session'
export const readDirectoryMetadata = () => isDemoReady() ? directory : []
export { directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-options'
