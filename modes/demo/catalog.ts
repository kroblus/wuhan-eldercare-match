import data from './institutions.json'
import type { InstitutionCatalogPayloadV121 } from '../types/institution-catalog-v1-2-1'

let active = false
export const activateDemoCatalog = (value: boolean): void => { active = value }
export const readModeCatalog = (): InstitutionCatalogPayloadV121 => JSON.parse(JSON.stringify(active
  ? data : { ...data, records: [], currentPointers: [], presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] } }))
