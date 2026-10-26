import {
  validateInstitutionCatalogPayloadV121,
} from '../../../services/institution-catalog-v1-2-1'
import {
  compareIsoTimestamps,
  isValidIsoTimestamp,
} from '../../institution/primitives'
import { isVerificationCurrentAt } from '../../institution/verification'
import type {
  InstitutionField,
  InstitutionRecordProvenance,
} from '../../../types/institution'
import type {
  InstitutionCatalogCurrentPointerV121,
  InstitutionCatalogErrorCodeV121,
  InstitutionCatalogPayloadV121,
} from '../../../types/institution-catalog-v1-2-1'
import type {
  InstitutionEvidenceV121,
  InstitutionRecordV121,
} from '../../../types/institution-v1-2-1'
import type {
  InitialReferenceFactsProjectionErrorV1,
  InitialReferenceFactsProjectionResultV1,
  ReferenceEffectiveFieldStatusV1,
  ReferenceFieldFactV1,
  ReferenceInstitutionFactsV1,
  ReferenceInstitutionPoolFactsV1,
} from '../../../types/initial-reference-v1'

const dataError = (
  code: InitialReferenceFactsProjectionErrorV1['code'],
  causeCode?: InstitutionCatalogErrorCodeV121,
  recordIndex?: number,
  pointerIndex?: number,
): InitialReferenceFactsProjectionResultV1 => ({
  ok: false,
  error: {
    state: 'DATA_ERROR',
    code,
    ...(causeCode === undefined ? {} : { causeCode }),
    ...(recordIndex === undefined ? {} : { recordIndex }),
    ...(pointerIndex === undefined ? {} : { pointerIndex }),
  },
})

const effectiveStatusAt = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): ReferenceEffectiveFieldStatusV1 => {
  if (field.availability === 'unknown') return 'unknown'
  if (field.availability === 'unavailable') return 'unavailable'

  if (field.verification.status === 'expired') return 'expired'
  if (field.verification.status === 'verified'
    && field.verification.validUntil !== undefined
    && compareIsoTimestamps(field.verification.validUntil, evaluationAsOf) < 0) {
    return 'expired'
  }

  if (!isVerificationCurrentAt(field.verification, evaluationAsOf)) return 'unverified'
  if (field.asOf !== undefined && compareIsoTimestamps(field.asOf, evaluationAsOf) > 0) {
    return 'unverified'
  }
  return 'current_verified'
}

const evidenceForField = <T>(
  record: InstitutionRecordV121,
  fieldPath: string,
  field: InstitutionField<T>,
): InstitutionEvidenceV121[] | null => {
  const evidence: InstitutionEvidenceV121[] = []
  const evidenceIds = field.verification.evidenceIds
  for (let index = 0; index < evidenceIds.length; index += 1) {
    const evidenceId = evidenceIds[index]
    const matches = record.evidence.filter((item) => item.evidenceId === evidenceId)
    if (matches.length !== 1) return null
    const item = matches[0]
    const verifiedAt = field.verification.status === 'unverified'
      ? undefined
      : field.verification.verifiedAt
    const validUntil = field.verification.status === 'unverified'
      ? undefined
      : field.verification.validUntil
    if (item.institutionId !== record.institutionId
      || item.recordRevision !== record.recordRevision
      || item.fieldPath !== fieldPath
      || item.verificationStatus !== field.verification.status
      || item.verifiedAt !== verifiedAt
      || item.validUntil !== validUntil) {
      return null
    }
    evidence.push(item)
  }
  return evidence
}

const fieldFact = <T>(
  record: InstitutionRecordV121,
  fieldPath: string,
  field: InstitutionField<T>,
  evaluationAsOf: string,
): ReferenceFieldFactV1<T> | null => {
  const evidence = evidenceForField(record, fieldPath, field)
  if (evidence === null) return null
  const effectiveStatus = effectiveStatusAt(field, evaluationAsOf)
  return {
    fieldPath,
    raw: field,
    verification: field.verification,
    effectiveStatus,
    effectiveValue: effectiveStatus === 'current_verified' && field.availability === 'provided'
      ? field.value
      : null,
    evidence,
  }
}

const institutionFacts = (
  record: InstitutionRecordV121,
  pointer: InstitutionCatalogCurrentPointerV121,
  catalog: InstitutionCatalogPayloadV121,
  recordIndex: number,
  evaluationAsOf: string,
): ReferenceInstitutionFactsV1 | InitialReferenceFactsProjectionErrorV1 => {
  const regionCode = fieldFact(record, 'identity.regionCode', record.identity.regionCode, evaluationAsOf)
  const referenceMonthlyPrice = fieldFact(
    record,
    'price.referenceMonthlyPrice',
    record.price.referenceMonthlyPrice,
    evaluationAsOf,
  )
  const mealSchedule = fieldFact(record, 'meal.mealSchedule', record.meal.mealSchedule, evaluationAsOf)
  const easyChewSupport = fieldFact(
    record,
    'meal.easyChewSupport',
    record.meal.easyChewSupport,
    evaluationAsOf,
  )
  const modifiedFoodSupport = fieldFact(
    record,
    'meal.modifiedFoodSupport',
    record.meal.modifiedFoodSupport,
    evaluationAsOf,
  )
  if (regionCode === null || referenceMonthlyPrice === null || mealSchedule === null
    || easyChewSupport === null || modifiedFoodSupport === null) {
    return {
      state: 'DATA_ERROR',
      code: 'INVALID_CATALOG',
      causeCode: 'INVALID_INSTITUTION_RECORD',
      recordIndex,
    }
  }

  const rooms: ReferenceInstitutionFactsV1['rooms'][number][] = []
  for (let roomIndex = 0; roomIndex < record.rooms.length; roomIndex += 1) {
    const room = record.rooms[roomIndex]
    const fieldPath = `rooms.${roomIndex}.roomType` as const
    const roomType = fieldFact(record, fieldPath, room.roomType, evaluationAsOf)
    if (roomType === null) {
      return {
        state: 'DATA_ERROR',
        code: 'INVALID_CATALOG',
        causeCode: 'INVALID_INSTITUTION_RECORD',
        recordIndex,
      }
    }
    rooms.push({ roomId: room.roomId, fieldPath, roomType })
  }

  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    recordProvenance: record.recordProvenance as InstitutionRecordProvenance,
    recordStatus: 'published',
    datasetVersion: catalog.datasetVersion,
    datasetMode: catalog.datasetMode,
    evaluationAsOf,
    currentPointer: {
      institutionId: pointer.institutionId,
      recordRevision: pointer.recordRevision,
    },
    identity: { regionCode },
    price: { referenceMonthlyPrice },
    rooms,
    meal: { mealSchedule, easyChewSupport, modifiedFoodSupport },
  }
}

/**
 * Validate the whole V1.2.1 current catalog with its frozen validator, then
 * project only the C1 whitelist. This function is pure and uses one explicit T.
 */
export const projectReferenceInstitutionFactsV1 = (
  catalog: unknown,
  evaluationAsOf: string,
): InitialReferenceFactsProjectionResultV1 => {
  if (!isValidIsoTimestamp(evaluationAsOf)) {
    return dataError('INVALID_EVALUATION_AS_OF')
  }

  const validated = validateInstitutionCatalogPayloadV121(catalog)
  if (!validated.ok) {
    return dataError(
      'INVALID_CATALOG',
      validated.error.code,
      validated.error.recordIndex,
      validated.error.pointerIndex,
    )
  }

  const institutions: ReferenceInstitutionFactsV1[] = []
  for (let recordIndex = 0; recordIndex < validated.value.records.length; recordIndex += 1) {
    const record = validated.value.records[recordIndex]
    if (record.recordStatus !== 'published') continue

    const pointer = validated.value.currentPointers.find((item) =>
      item.institutionId === record.institutionId
        && item.recordRevision === record.recordRevision)
    if (pointer === undefined) {
      return dataError('INVALID_CATALOG', 'CURRENT_POINTER_NOT_FOUND', recordIndex)
    }

    const projected = institutionFacts(
      record,
      pointer,
      validated.value,
      recordIndex,
      evaluationAsOf,
    )
    if ('state' in projected) {
      return {
        ok: false,
        error: projected,
      }
    }
    institutions.push(projected)
  }

  const value: ReferenceInstitutionPoolFactsV1 = {
    kind: 'initial_reference_institution_facts_v1',
    policyVersion: 'initial-reference-policy-v1',
    datasetVersion: validated.value.datasetVersion,
    datasetMode: validated.value.datasetMode,
    evaluationAsOf,
    institutions,
  }
  return { ok: true, value }
}
