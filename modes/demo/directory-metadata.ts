import directory from '../demo/directory.json'
import { readDemo } from '../demo/session'
export const readDirectoryMetadata = () => readDemo().ready ? directory : []
export { directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-options'
