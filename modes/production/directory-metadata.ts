import { readModeCatalog } from './catalog'
export { directoryNatureOptions, directoryDistrictOptions } from '../runtime/directory-options'
// Address evidence from catalog.ts; do not infer ownership/nature from the name.
export const readDirectoryMetadata = () => readModeCatalog().records.map(record => {
  const address = record.publicLocation.address
  const current = address.availability === 'provided' && address.value !== null
    && address.verification.status === 'verified' && !!address.verification.validUntil
    && Date.parse(address.verification.validUntil) >= Date.now()
  return { institutionId: record.institutionId, nature: 'unknown',
    district: current && address.value && address.value.district.code === '420103' ? 'jianghan' : 'unknown' }
})
