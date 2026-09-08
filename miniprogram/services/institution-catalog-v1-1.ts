import { MOCK_INSTITUTION_CATALOG_V11 } from '../mock/institution-catalog.mock'
import { validateInstitutionRecordV11 } from '../domain/institution/v1-1'
import type {
  InstitutionCatalogPayloadV11,
  InstitutionCatalogProviderV11,
  InstitutionCatalogResultV11,
  InstitutionCatalogServiceV11,
} from '../types/institution-catalog-v1-1'

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    ;(value as unknown as readonly unknown[]).forEach((item: unknown) => {
      copy.push(cloneValue(item))
    })
    return copy as unknown as T
  }
  if (isPlainRecord(value)) {
    const copy: Record<string, unknown> = {}
    Object.keys(value).forEach((key) => { copy[key] = cloneValue(value[key]) })
    return copy as T
  }
  return value
}

const defaultProviderV11: InstitutionCatalogProviderV11 = {
  loadCatalog: (): Promise<InstitutionCatalogPayloadV11> =>
    Promise.resolve(cloneValue(MOCK_INSTITUTION_CATALOG_V11)),
}

export const createInstitutionCatalogServiceV11 = (
  provider: InstitutionCatalogProviderV11,
): InstitutionCatalogServiceV11 => ({
  loadCatalog: async (): Promise<InstitutionCatalogResultV11> => {
    let payload: InstitutionCatalogPayloadV11
    try {
      payload = await provider.loadCatalog()
    } catch (_error) {
      return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
    }
    if (!isPlainRecord(payload)
      || typeof payload.datasetVersion !== 'string' || payload.datasetVersion.trim().length === 0
      || (payload.datasetMode !== 'PRODUCTION' && payload.datasetMode !== 'MOCK_DEVELOPMENT_ONLY')
      || !Array.isArray(payload.records)) {
      return { ok: false, error: { code: 'INVALID_CATALOG_ENVELOPE' } }
    }
    const records = [] as InstitutionCatalogPayloadV11['records'][number][]
    for (let index = 0; index < payload.records.length; index += 1) {
      const validation = validateInstitutionRecordV11(payload.records[index])
      if (!validation.ok) {
        return { ok: false, error: { code: 'INVALID_INSTITUTION_RECORD', recordIndex: index } }
      }
      records.push(validation.value)
    }
    const ids = records.map((record) => record.institutionId)
    if (ids.some((id, index) => ids.indexOf(id) !== index)) {
      return { ok: false, error: { code: 'DUPLICATE_INSTITUTION_ID' } }
    }
    return {
      ok: true,
      value: {
        datasetVersion: payload.datasetVersion,
        datasetMode: payload.datasetMode,
        records: cloneValue(records),
      },
    }
  },
})

export const institutionCatalogServiceV11 = createInstitutionCatalogServiceV11(defaultProviderV11)
