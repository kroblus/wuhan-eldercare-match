/** Pure current-catalog validation and explicit V1.2.1 -> V1.1 projection. */
import {
  validateInstitutionRecordByVersion,
} from './schema-dispatch'
import {
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  hasExactKeys,
} from '../primitives'
import { projectInstitutionRecordV121ToV11 } from './project-to-v1-1'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import type {
  InstitutionCatalogResultV11,
} from '../../../types/institution-catalog-v1-1'
import type {
  InstitutionCatalogCurrentPointerV121,
  InstitutionCatalogDisplayOrderEntryV121,
  InstitutionCatalogErrorCodeV121,
  InstitutionCatalogOrderingPolicyV121,
  InstitutionCatalogPayloadV121,
  InstitutionCatalogResultV121,
} from '../../../types/institution-catalog-v1-2-1'
import type { InstitutionRecordV121 } from '../../../types/institution-v1-2-1'

import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'

const isAllowedDatasetMode = (value: unknown): value is 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY' =>
  value === 'PRODUCTION' || value === 'MOCK_DEVELOPMENT_ONLY'

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

const identityKey = (institutionId: string, recordRevision: number): string =>
  `${institutionId}#${recordRevision}`

const validatePointer = (value: unknown): value is InstitutionCatalogCurrentPointerV121 =>
  isPlainRecord(value)
  && hasExactKeys(value, ['institutionId', 'recordRevision'])
  && isStableIdentifier(value.institutionId)
  && isPositiveInteger(value.recordRevision)

const validateDisplayOrderEntry = (
  value: unknown,
): value is InstitutionCatalogDisplayOrderEntryV121 =>
  isPlainRecord(value)
  && hasExactKeys(value, ['institutionId', 'recordRevision', 'displayOrder'])
  && isStableIdentifier(value.institutionId)
  && isPositiveInteger(value.recordRevision)
  && Number.isSafeInteger(value.displayOrder)
  && (value.displayOrder as number) >= 0

const invalid = (
  code: InstitutionCatalogErrorCodeV121,
  recordIndex?: number,
  pointerIndex?: number,
): InstitutionCatalogResultV121 => ({
  ok: false,
  error: {
    code,
    ...(recordIndex === undefined ? {} : { recordIndex }),
    ...(pointerIndex === undefined ? {} : { pointerIndex }),
  },
})

/**
 * Validate an exact V1.2.1 current-catalog envelope.  A V1.1 or V1.2 record
 * is accepted by the version dispatcher for generic callers, but is rejected
 * by this current service because the live current pool must be V1.2.1 only.
 */
export const validateInstitutionCatalogPayloadV121 = (
  input: unknown,
  options: InstitutionV121ValidationOptions = {},
): InstitutionCatalogResultV121 => {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, [
      'datasetVersion', 'datasetMode', 'records', 'currentPointers', 'presentation',
    ])
    || typeof input.datasetVersion !== 'string'
    || input.datasetVersion.trim().length === 0
    || !isAllowedDatasetMode(input.datasetMode)
    || !Array.isArray(input.records)
    || !Array.isArray(input.currentPointers)
    || !isPlainRecord(input.presentation)) {
    return invalid('INVALID_CATALOG_ENVELOPE')
  }

  const records: InstitutionRecordV121[] = []
  const institutionIds: string[] = []
  const identities: string[] = []
  for (let index = 0; index < input.records.length; index += 1) {
    const dispatched = validateInstitutionRecordByVersion(input.records[index], options)
    if (!dispatched.ok) {
      return invalid(
        dispatched.code === 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
          ? 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION'
          : 'INVALID_INSTITUTION_RECORD',
        index,
      )
    }
    if (dispatched.contractVersion !== 'institution-contract-v1.2.1') {
      return invalid('UNSUPPORTED_INSTITUTION_CONTRACT_VERSION', index)
    }
    const record = dispatched.value
    if ((input.datasetMode === 'MOCK_DEVELOPMENT_ONLY'
        && record.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY')
      || (input.datasetMode === 'PRODUCTION'
        && record.recordProvenance !== 'PRODUCTION_CANDIDATE')) {
      return invalid('DATASET_PROVENANCE_MISMATCH', index)
    }
    const key = identityKey(record.institutionId, record.recordRevision)
    if (institutionIds.indexOf(record.institutionId) >= 0) {
      return invalid('DUPLICATE_CURRENT_INSTITUTION_ID', index)
    }
    if (identities.indexOf(key) >= 0) {
      return invalid('DUPLICATE_CANONICAL_IDENTITY', index)
    }
    institutionIds.push(record.institutionId)
    identities.push(key)
    records.push(record)
  }

  const pointers: InstitutionCatalogCurrentPointerV121[] = []
  const pointerKeys: string[] = []
  for (let index = 0; index < input.currentPointers.length; index += 1) {
    const rawPointer = input.currentPointers[index]
    if (!validatePointer(rawPointer)) return invalid('INVALID_CATALOG_ENVELOPE', undefined, index)
    const pointer = rawPointer as InstitutionCatalogCurrentPointerV121
    const key = identityKey(pointer.institutionId, pointer.recordRevision)
    if (pointerKeys.indexOf(key) >= 0
      || pointers.some((item) => item.institutionId === pointer.institutionId)) {
      return invalid('DUPLICATE_CURRENT_POINTER', undefined, index)
    }
    const record = records.find((item) => identityKey(item.institutionId, item.recordRevision) === key)
    if (record === undefined) return invalid('CURRENT_POINTER_NOT_FOUND', undefined, index)
    pointerKeys.push(key)
    pointers.push({ institutionId: pointer.institutionId, recordRevision: pointer.recordRevision })
  }
  if (pointers.length !== records.length || !records.every((record) =>
    pointerKeys.indexOf(identityKey(record.institutionId, record.recordRevision)) >= 0)) {
    return invalid('CURRENT_POINTER_MISMATCH')
  }

  const presentation = input.presentation
  if (!hasExactKeys(presentation, ['orderingPolicy', 'displayOrder'])
    || (presentation.orderingPolicy !== 'CURATED_DISPLAY_ORDER_V1'
      && presentation.orderingPolicy !== 'CANONICAL_IDENTITY_ASC_V1')
    || !Array.isArray(presentation.displayOrder)) {
    return invalid('INVALID_PRESENTATION_METADATA')
  }
  const orderingPolicy = presentation.orderingPolicy as InstitutionCatalogOrderingPolicyV121
  const displayOrder: InstitutionCatalogDisplayOrderEntryV121[] = []
  if (orderingPolicy === 'CANONICAL_IDENTITY_ASC_V1') {
    if (presentation.displayOrder.length !== 0) return invalid('INVALID_PRESENTATION_METADATA')
  } else {
    const orderNumbers: number[] = []
    const orderKeys: string[] = []
    for (let index = 0; index < presentation.displayOrder.length; index += 1) {
      const rawEntry = presentation.displayOrder[index]
      if (!validateDisplayOrderEntry(rawEntry)) {
        return invalid('INVALID_PRESENTATION_METADATA', undefined, index)
      }
      const entry = rawEntry as InstitutionCatalogDisplayOrderEntryV121
      const key = identityKey(entry.institutionId, entry.recordRevision)
      if (pointerKeys.indexOf(key) < 0) return invalid('PRESENTATION_IDENTITY_NOT_FOUND', undefined, index)
      if (orderKeys.indexOf(key) >= 0 || orderNumbers.indexOf(entry.displayOrder) >= 0) {
        return invalid('DUPLICATE_DISPLAY_ORDER', undefined, index)
      }
      orderKeys.push(key)
      orderNumbers.push(entry.displayOrder)
      displayOrder.push({
        institutionId: entry.institutionId,
        recordRevision: entry.recordRevision,
        displayOrder: entry.displayOrder,
      })
    }
    if (displayOrder.length !== records.length || !pointerKeys.every((key) => orderKeys.indexOf(key) >= 0)) {
      return invalid('INVALID_PRESENTATION_METADATA')
    }
  }

  return {
    ok: true,
    value: {
      datasetVersion: input.datasetVersion,
      datasetMode: input.datasetMode,
      records: cloneValue(records),
      currentPointers: cloneValue(pointers),
      presentation: {
        orderingPolicy,
        displayOrder: cloneValue(displayOrder),
      },
    },
  }
}

/** Explicit direct V1.2.1 -> V1.1 Recommendation catalog projection. */
export const projectInstitutionCatalogV121ToV11 = (
  catalog: InstitutionCatalogPayloadV121,
  options: InstitutionV121ValidationOptions = {},
): InstitutionCatalogResultV11 => {
  const validated = validateInstitutionCatalogPayloadV121(catalog, options)
  if (!validated.ok) {
    return {
      ok: false,
      error: {
        code: validated.error.code === 'V121_TO_V11_PROJECTION_ERROR'
          ? 'INVALID_INSTITUTION_RECORD'
          : validated.error.code === 'PROVIDER_LOAD_FAILED'
            ? 'PROVIDER_LOAD_FAILED'
            : 'INVALID_CATALOG_ENVELOPE',
        ...(validated.error.recordIndex === undefined ? {} : { recordIndex: validated.error.recordIndex }),
      },
    }
  }
  const records: InstitutionRecordV11[] = []
  for (let index = 0; index < validated.value.records.length; index += 1) {
    const projected = projectInstitutionRecordV121ToV11(validated.value.records[index], options)
    if (!projected.ok) {
      return { ok: false, error: { code: 'INVALID_INSTITUTION_RECORD', recordIndex: index } }
    }
    records.push(projected.value)
  }
  return {
    ok: true,
    value: {
      datasetVersion: validated.value.datasetVersion,
      datasetMode: validated.value.datasetMode,
      records: cloneValue(records),
    },
  }
}
