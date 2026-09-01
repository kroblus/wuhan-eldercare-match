import { validateInstitutionRecord } from '../domain/institution'
import { mockInstitutionCatalogProvider } from '../mock/institution-catalog.mock'
import type { InstitutionRecord } from '../types/institution'
import type {
  InstitutionCatalogError,
  InstitutionCatalogPayload,
  InstitutionCatalogProvider,
  InstitutionCatalogResult,
  InstitutionCatalogService,
} from '../types/institution-catalog'

export type {
  InstitutionCatalogError,
  InstitutionCatalogErrorCauseCode,
  InstitutionCatalogPayload,
  InstitutionCatalogProvider,
  InstitutionCatalogResult,
  InstitutionCatalogService,
} from '../types/institution-catalog'

type RawRecord = Record<string, unknown>

const isPlainRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneValue = (value: unknown, ancestors: readonly unknown[] = []): unknown => {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (ancestors.indexOf(value) >= 0) {
    throw new Error('cyclic catalog payload')
  }
  const nextAncestors = ancestors.concat([value])
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item, nextAncestors))
  }
  const record = value as RawRecord
  const copy: RawRecord = Object.create(null) as RawRecord
  Object.keys(record).forEach((key) => {
    copy[key] = cloneValue(record[key], nextAncestors)
  })
  return copy
}

const makeError = (
  code: InstitutionCatalogError['error']['code'],
  causeCode: InstitutionCatalogError['error']['causeCode'],
  recordIndex?: number,
): InstitutionCatalogError => ({
  ok: false,
  error: {
    code,
    causeCode,
    ...(recordIndex === undefined ? {} : { recordIndex }),
  },
})

const validateEnvelope = (value: unknown):
  | { ok: true, value: InstitutionCatalogPayload }
  | { ok: false, error: InstitutionCatalogError } => {
  if (!isPlainRecord(value)) {
    return { ok: false, error: makeError('INSTITUTION_CATALOG_ERROR', 'INVALID_CATALOG_ENVELOPE') }
  }
  if (typeof value.datasetVersion !== 'string' || value.datasetVersion.trim().length === 0) {
    return { ok: false, error: makeError('INSTITUTION_CATALOG_ERROR', 'INVALID_DATASET_VERSION') }
  }
  if (value.datasetMode !== 'PRODUCTION' && value.datasetMode !== 'MOCK_DEVELOPMENT_ONLY') {
    return { ok: false, error: makeError('INSTITUTION_CATALOG_ERROR', 'INVALID_DATASET_MODE') }
  }
  if (!Array.isArray(value.records)) {
    return { ok: false, error: makeError('INSTITUTION_CATALOG_ERROR', 'INVALID_RECORDS') }
  }
  return {
    ok: true,
    value: {
      datasetVersion: value.datasetVersion,
      datasetMode: value.datasetMode,
      records: value.records as readonly InstitutionRecord[],
    },
  }
}

/**
 * Validates the complete provider envelope and the complete institution pool.
 * A single invalid or duplicate record rejects the whole catalog.
 */
export const createInstitutionCatalogService = (
  provider: InstitutionCatalogProvider,
): InstitutionCatalogService => ({
  loadCatalog: async (): Promise<InstitutionCatalogResult> => {
    let providerPayload: unknown
    try {
      if (!provider || typeof provider.loadCatalog !== 'function') {
        return makeError('INSTITUTION_CATALOG_ERROR', 'PROVIDER_LOAD_FAILED')
      }
      providerPayload = await provider.loadCatalog()
    } catch (_error) {
      return makeError('INSTITUTION_CATALOG_ERROR', 'PROVIDER_LOAD_FAILED')
    }

    let isolatedPayload: unknown
    try {
      isolatedPayload = cloneValue(providerPayload)
    } catch (_error) {
      return makeError('INSTITUTION_CATALOG_ERROR', 'INVALID_CATALOG_ENVELOPE')
    }

    const envelope = validateEnvelope(isolatedPayload)
    if (!envelope.ok) {
      return envelope.error
    }

    const records: InstitutionRecord[] = []
    for (let index = 0; index < envelope.value.records.length; index += 1) {
      let validation
      try {
        validation = validateInstitutionRecord(envelope.value.records[index])
      } catch (_error) {
        return makeError('INVALID_INSTITUTION_RECORD', 'INVALID_RECORD_SHAPE', index)
      }
      if (!validation.ok) {
        const firstIssue = validation.issues[0]
        return makeError(
          'INVALID_INSTITUTION_RECORD',
          firstIssue === undefined ? 'INVALID_RECORD_SHAPE' : firstIssue.code,
          index,
        )
      }
      records.push(validation.value)
    }

    const seenIds: string[] = []
    for (let index = 0; index < records.length; index += 1) {
      const institutionId = records[index].institutionId
      if (seenIds.indexOf(institutionId) >= 0) {
        return makeError('INVALID_INSTITUTION_RECORD', 'DUPLICATE_INSTITUTION_ID', index)
      }
      seenIds.push(institutionId)
    }

    if (records.length === 0) {
      return makeError('NO_INSTITUTIONS_AVAILABLE', 'EMPTY_CATALOG')
    }

    return {
      ok: true,
      value: {
        datasetVersion: envelope.value.datasetVersion,
        datasetMode: envelope.value.datasetMode,
        records,
      },
    }
  },
})

/** Development-only catalog service. It never falls back to a production source. */
export const institutionCatalogService: InstitutionCatalogService =
  createInstitutionCatalogService(mockInstitutionCatalogProvider)
