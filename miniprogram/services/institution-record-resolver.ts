/**
 * Canonical Institution identity and revision resolvers for V1.2-A0-2.
 *
 * This module intentionally keeps current-catalog selection separate from
 * historical-revision lookup. It does not read wx, storage, Recommendation,
 * or the device clock.
 */

import { isPlainRecord, isPositiveInteger, isStableIdentifier } from '../domain/institution/primitives'
import { validateInstitutionRecordV11 } from '../domain/institution/v1-1/validate-institution-v1-1'
import type {
  InstitutionCanonicalIdentity,
  InstitutionCurrentCatalogDataset,
} from '../types/institution-list-detail'
import type { InstitutionRecordV11 } from '../types/institution-v1-1'
import type {
  InstitutionCatalogPayloadV11,
  InstitutionCatalogServiceV11,
} from '../types/institution-catalog-v1-1'
import type {
  InstitutionCatalogPayloadV121,
  InstitutionCatalogResultV121,
  InstitutionCatalogServiceV121,
  InstitutionCatalogErrorCodeV121,
} from '../types/institution-catalog-v1-2-1'
import type { InstitutionRecordV121 } from '../types/institution-v1-2-1'

export type InstitutionIdentityErrorCode =
  | 'INSTITUTION_ID_INVALID'
  | 'RECORD_REVISION_INVALID'
  | 'IDENTITY_SHAPE_INVALID'

export type InstitutionIdentityResult =
  | { ok: true; value: InstitutionCanonicalIdentity }
  | { ok: false; error: { code: InstitutionIdentityErrorCode } }

const identityKeys = ['institutionId', 'recordRevision'] as const

const hasOnlyIdentityKeys = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value).sort()
  return keys.length === identityKeys.length
    && keys[0] === identityKeys[0]
    && keys[1] === identityKeys[1]
}

/**
 * Create a canonical identity from untrusted values. The two-argument form is
 * accepted for small callers, while object input keeps route/application
 * call-sites explicit.
 */
export const createInstitutionCanonicalIdentity = (
  input: unknown,
  recordRevision?: unknown,
): InstitutionIdentityResult => {
  const value = isPlainRecord(input) && recordRevision === undefined
    ? input
    : { institutionId: input, recordRevision }
  if (!isPlainRecord(value) || !hasOnlyIdentityKeys(value)) {
    return { ok: false, error: { code: 'IDENTITY_SHAPE_INVALID' } }
  }
  if (!isStableIdentifier(value.institutionId)) {
    return { ok: false, error: { code: 'INSTITUTION_ID_INVALID' } }
  }
  if (!isPositiveInteger(value.recordRevision)) {
    return { ok: false, error: { code: 'RECORD_REVISION_INVALID' } }
  }
  return {
    ok: true,
    value: {
      institutionId: value.institutionId,
      recordRevision: value.recordRevision,
    },
  }
}

export const validateInstitutionCanonicalIdentity = (
  value: unknown,
): InstitutionIdentityResult => createInstitutionCanonicalIdentity(value)

export const equalInstitutionCanonicalIdentity = (
  left: InstitutionCanonicalIdentity,
  right: InstitutionCanonicalIdentity,
): boolean => left.institutionId === right.institutionId
  && left.recordRevision === right.recordRevision

export const compareInstitutionCanonicalIdentity = (
  left: InstitutionCanonicalIdentity,
  right: InstitutionCanonicalIdentity,
): number => {
  if (left.institutionId < right.institutionId) return -1
  if (left.institutionId > right.institutionId) return 1
  if (left.recordRevision < right.recordRevision) return -1
  if (left.recordRevision > right.recordRevision) return 1
  return 0
}

/** A presentation/map key only; it is not a third domain identity. */
export const institutionCanonicalKey = (
  identity: InstitutionCanonicalIdentity,
): string => `${identity.institutionId}#${identity.recordRevision}`

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

export type InstitutionCurrentCatalogErrorCode =
  | 'PROVIDER_LOAD_FAILED'
  | 'INVALID_CATALOG_ENVELOPE'
  | 'INVALID_INSTITUTION_RECORD'
  | 'DATASET_PROVENANCE_MISMATCH'
  | 'DUPLICATE_CURRENT_INSTITUTION_ID'
  | 'DUPLICATE_CANONICAL_IDENTITY'
  | 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
  | 'CURRENT_POINTER_NOT_FOUND'
  | 'CURRENT_POINTER_MISMATCH'
  | 'DUPLICATE_CURRENT_POINTER'
  | 'INVALID_PRESENTATION_METADATA'
  | 'PRESENTATION_IDENTITY_NOT_FOUND'
  | 'DUPLICATE_DISPLAY_ORDER'
  | 'V121_TO_V11_PROJECTION_ERROR'

export type InstitutionCurrentCatalogResult =
  | { ok: true; value: InstitutionCurrentCatalogDataset }
  | { ok: false; error: { code: InstitutionCurrentCatalogErrorCode; recordIndex?: number } }

export interface InstitutionCurrentCatalogResolver {
  loadCurrentCatalog(): Promise<InstitutionCurrentCatalogResult>
  resolveExactCurrentRevision(
    identity: InstitutionCanonicalIdentity,
  ): Promise<InstitutionCurrentRevisionResult>
}

export type CurrentInstitutionCatalogResolver = InstitutionCurrentCatalogResolver

export type InstitutionExactRecordErrorCode =
  | 'INSTITUTION_NOT_FOUND'
  | 'INSTITUTION_REVISION_NOT_FOUND'
  | 'EXACT_IDENTITY_MISMATCH'
  | 'DUPLICATE_CANONICAL_IDENTITY'
  | 'IDENTITY_INVALID'

export type InstitutionExactRecordResult =
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; error: { code: InstitutionExactRecordErrorCode } }

export type InstitutionHistoricalRevisionErrorCode =
  | InstitutionExactRecordErrorCode
  | 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED'
  | 'HISTORICAL_REVISION_PROVIDER_FAILED'
  | 'INVALID_HISTORICAL_INSTITUTION_RECORD'

export type InstitutionHistoricalRevisionResult =
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; error: { code: InstitutionHistoricalRevisionErrorCode } }

export interface InstitutionHistoricalRevisionResolver {
  resolveExactRevision(
    identity: InstitutionCanonicalIdentity,
  ): Promise<InstitutionHistoricalRevisionResult>
}

export type HistoricalInstitutionRevisionResolver = InstitutionHistoricalRevisionResolver

export type InstitutionCurrentRevisionResult =
  | {
    ok: true
    value: {
      dataset: InstitutionCurrentCatalogDataset
      record: InstitutionRecordV11
    }
  }
  | {
    ok: false
    error: {
      code: InstitutionCurrentCatalogErrorCode | InstitutionExactRecordErrorCode
      recordIndex?: number
    }
  }

const validateCatalogPayload = (
  payload: unknown,
): InstitutionCurrentCatalogResult => {
  if (!isPlainRecord(payload)
    || typeof payload.datasetVersion !== 'string'
    || payload.datasetVersion.trim().length === 0
    || (payload.datasetMode !== 'PRODUCTION' && payload.datasetMode !== 'MOCK_DEVELOPMENT_ONLY')
    || !Array.isArray(payload.records)) {
    return { ok: false, error: { code: 'INVALID_CATALOG_ENVELOPE' } }
  }
  const records: InstitutionRecordV11[] = []
  const institutionIds: string[] = []
  const identityKeys: string[] = []
  for (let index = 0; index < payload.records.length; index += 1) {
    const validation = validateInstitutionRecordV11(payload.records[index])
    if (!validation.ok) {
      return { ok: false, error: { code: 'INVALID_INSTITUTION_RECORD', recordIndex: index } }
    }
    const record = validation.value
    if ((payload.datasetMode === 'MOCK_DEVELOPMENT_ONLY'
        && record.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY')
      || (payload.datasetMode === 'PRODUCTION'
        && record.recordProvenance !== 'PRODUCTION_CANDIDATE')) {
      return { ok: false, error: { code: 'DATASET_PROVENANCE_MISMATCH', recordIndex: index } }
    }
    const key = institutionCanonicalKey(record)
    if (institutionIds.indexOf(record.institutionId) >= 0) {
      return { ok: false, error: { code: 'DUPLICATE_CURRENT_INSTITUTION_ID' } }
    }
    if (identityKeys.indexOf(key) >= 0) {
      return { ok: false, error: { code: 'DUPLICATE_CANONICAL_IDENTITY' } }
    }
    institutionIds.push(record.institutionId)
    identityKeys.push(key)
    records.push(record)
  }
  return {
    ok: true,
    value: {
      datasetVersion: payload.datasetVersion,
      datasetMode: payload.datasetMode,
      records: cloneValue(records),
    },
  }
}

/** Adapt the existing V1.1 catalog service without changing its contract. */
export const createInstitutionCurrentCatalogResolver = (
  service: InstitutionCatalogServiceV11,
): InstitutionCurrentCatalogResolver => {
  const loadCurrentCatalog = async (): Promise<InstitutionCurrentCatalogResult> => {
    let payload: InstitutionCatalogPayloadV11
    try {
      const result = await service.loadCatalog()
      if (!result.ok) {
        return {
          ok: false,
          error: {
            code: result.error.code === 'DUPLICATE_INSTITUTION_ID'
              ? 'DUPLICATE_CURRENT_INSTITUTION_ID'
              : result.error.code,
            ...(result.error.recordIndex === undefined ? {} : { recordIndex: result.error.recordIndex }),
          },
        }
      }
      payload = result.value
    } catch (_error) {
      return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
    }
    return validateCatalogPayload(payload)
  }
  return {
    loadCurrentCatalog,
    resolveExactCurrentRevision: async (
      identity: InstitutionCanonicalIdentity,
    ): Promise<InstitutionCurrentRevisionResult> => {
      const catalog = await loadCurrentCatalog()
      if (!catalog.ok) return catalog
      const resolved = resolveExactCurrentInstitutionRecord(catalog.value.records, identity)
      if (!resolved.ok) return resolved
      return {
        ok: true,
        value: {
          dataset: cloneValue(catalog.value),
          record: cloneValue(resolved.value),
        },
      }
    },
  }
}

const mapV121CatalogError = (
  code: InstitutionCatalogErrorCodeV121,
): InstitutionCurrentCatalogErrorCode => {
  if (code === 'PROVIDER_LOAD_FAILED') return 'PROVIDER_LOAD_FAILED'
  if (code === 'INVALID_INSTITUTION_RECORD') return 'INVALID_INSTITUTION_RECORD'
  if (code === 'DATASET_PROVENANCE_MISMATCH') return 'DATASET_PROVENANCE_MISMATCH'
  if (code === 'DUPLICATE_CURRENT_INSTITUTION_ID') return 'DUPLICATE_CURRENT_INSTITUTION_ID'
  if (code === 'DUPLICATE_CANONICAL_IDENTITY') return 'DUPLICATE_CANONICAL_IDENTITY'
  if (code === 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION') return 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
  if (code === 'CURRENT_POINTER_NOT_FOUND') return 'CURRENT_POINTER_NOT_FOUND'
  if (code === 'CURRENT_POINTER_MISMATCH') return 'CURRENT_POINTER_MISMATCH'
  if (code === 'DUPLICATE_CURRENT_POINTER') return 'DUPLICATE_CURRENT_POINTER'
  if (code === 'INVALID_PRESENTATION_METADATA') return 'INVALID_PRESENTATION_METADATA'
  if (code === 'PRESENTATION_IDENTITY_NOT_FOUND') return 'PRESENTATION_IDENTITY_NOT_FOUND'
  if (code === 'DUPLICATE_DISPLAY_ORDER') return 'DUPLICATE_DISPLAY_ORDER'
  if (code === 'V121_TO_V11_PROJECTION_ERROR') return 'V121_TO_V11_PROJECTION_ERROR'
  return 'INVALID_CATALOG_ENVELOPE'
}

const mapV121ResultError = (
  result: Extract<InstitutionCatalogResultV121, { ok: false }>,
): InstitutionCurrentCatalogResult => ({
  ok: false,
  error: {
    code: mapV121CatalogError(result.error.code),
    ...(result.error.recordIndex === undefined ? {} : { recordIndex: result.error.recordIndex }),
  },
})

/**
 * Current-catalog resolver for the V1.2.1 live provider. The provider owns
 * the explicit current pointer; this adapter never derives current from a
 * revision number, array order, or a max/latest lookup. Existing A0 callers
 * receive the explicit V1.2.1 -> V1.1 projection, while the same validated
 * dataset retains the raw V1.2.1 records for future application sections.
 */
export const createInstitutionCurrentCatalogResolverV121 = (
  service: InstitutionCatalogServiceV121,
  options: { sharePendingLoads?: boolean } = {},
): InstitutionCurrentCatalogResolver => {
  const readCurrentCatalog = async (): Promise<InstitutionCurrentCatalogResult> => {
    let result: InstitutionCatalogResultV121
    try {
      result = await service.loadCatalog()
    } catch (_error) {
      return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
    }
    if (!result.ok) return mapV121ResultError(result)

    // Re-run the exact envelope validation at this application boundary so a
    // custom/injected service cannot bypass the V1.2.1 contract gate.
    // Keep the V1.2.1 provider (and its development mock) out of the frozen
    // A0 V1.1 runtime graph.  This module is loaded lazily only when a caller
    // explicitly composes the V1.2.1 resolver.
    const v121CatalogModule = require('./institution-catalog-v1-2-1') as {
      validateInstitutionCatalogPayloadV121: (value: unknown) => InstitutionCatalogResultV121
      projectInstitutionCatalogV121ToV11: (
        value: InstitutionCatalogPayloadV121,
      ) => {
        ok: true
        value: { datasetVersion: string; datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'; records: readonly InstitutionRecordV11[] }
      } | { ok: false; error: { code: string; recordIndex?: number } }
    }
    const validated = v121CatalogModule.validateInstitutionCatalogPayloadV121(result.value)
    if (!validated.ok) return mapV121ResultError(validated)
    const projected = v121CatalogModule.projectInstitutionCatalogV121ToV11(validated.value)
    if (!projected.ok) {
      return {
        ok: false,
        error: { code: 'V121_TO_V11_PROJECTION_ERROR' },
      }
    }
    const payload: InstitutionCatalogPayloadV121 = validated.value
    return {
      ok: true,
      value: {
        datasetVersion: projected.value.datasetVersion,
        datasetMode: projected.value.datasetMode,
        records: cloneValue(projected.value.records),
        sourceContractVersion: 'institution-contract-v1.2.1',
        sourceRecordsV121: cloneValue(payload.records),
        currentPointersV121: cloneValue(payload.currentPointers),
        presentationV121: cloneValue(payload.presentation),
      },
    }
  }

  // Only overlapping reads share boundary validation. Discard on settlement,
  // including failure: a later refresh must read current pointers/facts again.
  let pending: Promise<InstitutionCurrentCatalogResult> | null = null
  const loadCurrentCatalog = (): Promise<InstitutionCurrentCatalogResult> => {
    if (!options.sharePendingLoads) return readCurrentCatalog()
    if (pending === null) pending = readCurrentCatalog().finally(() => { pending = null })
    return pending
  }
  return {
    loadCurrentCatalog: async () => cloneValue(await loadCurrentCatalog()),
    resolveExactCurrentRevision: async (
      identity: InstitutionCanonicalIdentity,
    ): Promise<InstitutionCurrentRevisionResult> => {
      const catalog = await loadCurrentCatalog()
      if (!catalog.ok) return catalog
      const resolved = resolveExactCurrentInstitutionRecord(catalog.value.records, identity)
      if (!resolved.ok) return resolved
      return {
        ok: true,
        value: {
          dataset: cloneValue(catalog.value),
          record: cloneValue(resolved.value),
        },
      }
    },
  }
}

/** Compatibility alias with the more explicit V1.2.1 naming used by callers. */
export const createInstitutionCurrentV121CatalogResolver =
  createInstitutionCurrentCatalogResolverV121

/** Find the V1.2.1 source record attached to the same loaded A0 dataset. */
export const resolveExactCurrentInstitutionRecordV121 = (
  dataset: InstitutionCurrentCatalogDataset,
  identity: InstitutionCanonicalIdentity,
): InstitutionRecordV121 | null => {
  if (dataset.sourceContractVersion !== 'institution-contract-v1.2.1'
    || dataset.sourceRecordsV121 === undefined) return null
  const identityResult = validateInstitutionCanonicalIdentity(identity)
  if (!identityResult.ok) return null
  const matches = dataset.sourceRecordsV121.filter((record) =>
    equalInstitutionCanonicalIdentity(record, identityResult.value))
  return matches.length === 1 ? cloneValue(matches[0]) : null
}

export const resolveExactCurrentInstitutionRecord = (
  records: readonly InstitutionRecordV11[],
  identity: InstitutionCanonicalIdentity,
): InstitutionExactRecordResult => {
  const identityResult = validateInstitutionCanonicalIdentity(identity)
  if (!identityResult.ok) return { ok: false, error: { code: 'IDENTITY_INVALID' } }
  const byInstitution = records.filter((record) => record.institutionId === identity.institutionId)
  if (byInstitution.length === 0) return { ok: false, error: { code: 'INSTITUTION_NOT_FOUND' } }
  const exact = byInstitution.filter((record) =>
    equalInstitutionCanonicalIdentity(record, identityResult.value))
  if (exact.length === 0) return { ok: false, error: { code: 'INSTITUTION_REVISION_NOT_FOUND' } }
  if (exact.length > 1) return { ok: false, error: { code: 'DUPLICATE_CANONICAL_IDENTITY' } }
  const record = exact[0]
  if (!equalInstitutionCanonicalIdentity(record, identity)) {
    return { ok: false, error: { code: 'EXACT_IDENTITY_MISMATCH' } }
  }
  return { ok: true, value: cloneValue(record) }
}

/**
 * Historical data is intentionally not fabricated in the app. Production
 * callers must inject a provider once its immutable-history contract exists.
 */
export const createNotConfiguredHistoricalRevisionResolver = (): InstitutionHistoricalRevisionResolver => ({
  resolveExactRevision: async (
    _identity: InstitutionCanonicalIdentity,
  ): Promise<InstitutionHistoricalRevisionResult> => ({
    ok: false,
    error: { code: 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED' },
  }),
})

export const resolveExactHistoricalInstitutionRecord = async (
  resolver: InstitutionHistoricalRevisionResolver,
  identity: InstitutionCanonicalIdentity,
): Promise<InstitutionHistoricalRevisionResult> => {
  const identityResult = validateInstitutionCanonicalIdentity(identity)
  if (!identityResult.ok) return { ok: false, error: { code: 'IDENTITY_INVALID' } }
  let resolved: InstitutionHistoricalRevisionResult
  try {
    resolved = await resolver.resolveExactRevision(identityResult.value)
  } catch (_error) {
    return { ok: false, error: { code: 'HISTORICAL_REVISION_PROVIDER_FAILED' } }
  }
  if (!resolved.ok) return resolved
  const validation = validateInstitutionRecordV11(resolved.value)
  if (!validation.ok) {
    return { ok: false, error: { code: 'INVALID_HISTORICAL_INSTITUTION_RECORD' } }
  }
  if (!equalInstitutionCanonicalIdentity(validation.value, identityResult.value)) {
    return { ok: false, error: { code: 'EXACT_IDENTITY_MISMATCH' } }
  }
  return { ok: true, value: cloneValue(validation.value) }
}

export const notConfiguredHistoricalRevisionResolver =
  createNotConfiguredHistoricalRevisionResolver()

export const validateInstitutionCurrentCatalogPayload = validateCatalogPayload
