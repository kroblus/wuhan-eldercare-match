/** Exact current-source association shared by lightweight reads and detail builds. */
import { equalInstitutionCanonicalIdentity } from './institution-record-resolver'
import { projectInstitutionRecordV121ToV11 } from '../domain/institution/v1-2-1/project-to-v1-1'
import { institutionValidationOptions } from '../runtime/institution-validation'
import type { InstitutionV121ValidationOptions } from '../domain/institution/v1-2-1/validate-institution-v1-2-1'
import type { InstitutionCanonicalIdentity, InstitutionCurrentCatalogDataset } from '../types/institution-list-detail'
import type { InstitutionRecordV121 } from '../types/institution-v1-2-1'

export const stableStructuralSignature = (value: unknown): string => {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStructuralSignature(item)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStructuralSignature(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export const sourceV121ForDataset = (
  dataset: InstitutionCurrentCatalogDataset,
  identity: InstitutionCanonicalIdentity,
  options: InstitutionV121ValidationOptions = institutionValidationOptions,
):
  | { ok: true; value: InstitutionRecordV121 }
  | { ok: false; error: { code: string } } => {
  if (dataset.sourceContractVersion !== 'institution-contract-v1.2.1') {
    return { ok: false, error: { code: 'LEGACY_DATASET_WITHOUT_V121_SOURCE' } }
  }

  const projectedRecordIsPresent = dataset.records.some((record) =>
    equalInstitutionCanonicalIdentity(record, identity))
  const sourceRecords = dataset.sourceRecordsV121
  if (sourceRecords === undefined) {
    return {
      ok: false,
      error: {
        code: projectedRecordIsPresent
          ? 'V121_SOURCE_RECORD_MISSING'
          : 'HISTORICAL_V11_SOURCE_NOT_IN_CURRENT_DATASET',
      },
    }
  }
  const matches = sourceRecords.filter((record) =>
    equalInstitutionCanonicalIdentity(record, identity))
  if (matches.length === 0) {
    return {
      ok: false,
      error: {
        code: projectedRecordIsPresent
          ? 'V121_SOURCE_RECORD_MISSING'
          : 'HISTORICAL_V11_SOURCE_NOT_IN_CURRENT_DATASET',
      },
    }
  }
  if (matches.length !== 1) {
    return { ok: false, error: { code: 'V121_SOURCE_RECORD_DUPLICATE' } }
  }

  const projected = projectInstitutionRecordV121ToV11(matches[0], options)
  if (!projected.ok) {
    return { ok: false, error: { code: 'V121_TO_V11_PROJECTION_ERROR' } }
  }
  if (!equalInstitutionCanonicalIdentity(projected.value, identity)) {
    return { ok: false, error: { code: 'V121_SOURCE_IDENTITY_MISMATCH' } }
  }
  const expectedRecord = dataset.records.find((record) =>
    equalInstitutionCanonicalIdentity(record, identity))
  if (expectedRecord === undefined
    || stableStructuralSignature(projected.value) !== stableStructuralSignature(expectedRecord)) {
    return { ok: false, error: { code: 'V121_SOURCE_RECORD_MISMATCH' } }
  }
  return { ok: true, value: matches[0] }
}
