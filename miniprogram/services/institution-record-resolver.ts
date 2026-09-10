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
