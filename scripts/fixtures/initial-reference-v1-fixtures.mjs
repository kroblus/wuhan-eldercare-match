/**
 * SYNTHETIC_TEST_ONLY — NOT REAL INSTITUTION DATA.
 *
 * C1 runtime fixtures are built from the existing valid V1.2.1 record builder
 * and must be passed through the production V1.2.1 catalog validator before
 * any projection/policy assertion. Nothing here represents a Wuhan provider.
 */
import {
  cloneInstitutionV121Record,
  makeEvidenceField,
  unverifiedField,
  makeValidInstitutionV121,
  unknownField,
} from './institution-v1-2-1-fixtures.mjs'

export const INITIAL_REFERENCE_FIXTURE_POLICY = 'SYNTHETIC_TEST_ONLY'
export const INITIAL_REFERENCE_FIXTURE_LABEL = 'NOT_REAL_INSTITUTION_DATA'
export const INITIAL_REFERENCE_EVALUATION_AS_OF = '2026-10-26T04:00:00.000Z'
export const INITIAL_REFERENCE_DATASET_VERSION = 'initial-reference-test-v1'
export const INITIAL_REFERENCE_REGION_CODE = '420105'
export const INITIAL_REFERENCE_EVIDENCE_AS_OF = '2026-09-12T08:00:00.000Z'
export const INITIAL_REFERENCE_EXPIRED_AT = '2026-10-25T23:59:59.000Z'

const clone = cloneInstitutionV121Record

const slug = (value) => String(value).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()

const evidenceField = (record, fieldPath, value, valueType = 'stable_code', status = 'verified') => {
  const knownIds = new Set(record.evidence.map((item) => item.evidenceId))
  const field = makeEvidenceField(record, fieldPath, value, valueType, status)
  const appended = record.evidence[record.evidence.length - 1]
  if (knownIds.has(appended.evidenceId)) {
    let suffix = 1
    let uniqueId = `ev-c1-fixture-${record.recordRevision}-${suffix}`
    while (record.evidence.some((item, index) =>
      index !== record.evidence.length - 1 && item.evidenceId === uniqueId)) {
      suffix += 1
      uniqueId = `ev-c1-fixture-${record.recordRevision}-${suffix}`
    }
    appended.evidenceId = uniqueId
    field.verification.evidenceIds = [uniqueId]
  }
  return field
}

const discardEvidenceFor = (record, fieldPath) => {
  record.evidence = record.evidence.filter((item) => item.fieldPath !== fieldPath)
}

/**
 * A legal V1.2.1 current record containing current, evidence-bound values for
 * every C1-readable category. Its provenance is explicitly test-only Mock.
 */
export const makeInitialReferenceRecordV121 = (overrides = {}) => {
  const record = makeValidInstitutionV121()
  discardEvidenceFor(record, 'identity.regionCode')
  discardEvidenceFor(record, 'price.referenceMonthlyPrice')
  discardEvidenceFor(record, 'rooms.0.roomType')
  discardEvidenceFor(record, 'meal.mealSchedule')
  discardEvidenceFor(record, 'meal.easyChewSupport')
  discardEvidenceFor(record, 'meal.modifiedFoodSupport')
  record.identity.regionCode = evidenceField(
    record,
    'identity.regionCode',
    INITIAL_REFERENCE_REGION_CODE,
  )
  record.price.referenceMonthlyPrice = evidenceField(
    record,
    'price.referenceMonthlyPrice',
    {
      basis: 'reference_total',
      range: {
        kind: 'bounded',
        min: { amountMinor: 650000, currency: 'CNY' },
        max: { amountMinor: 980000, currency: 'CNY' },
        period: 'month',
      },
    },
    'reference_monthly_price',
  )
  record.rooms[0].roomType = evidenceField(
    record,
    'rooms.0.roomType',
    'single',
  )
  record.meal.mealSchedule = evidenceField(
    record,
    'meal.mealSchedule',
    'three_meals',
  )
  record.meal.easyChewSupport = evidenceField(
    record,
    'meal.easyChewSupport',
    'available',
  )
  record.meal.modifiedFoodSupport = evidenceField(
    record,
    'meal.modifiedFoodSupport',
    'available',
  )
  return { ...record, ...clone(overrides) }
}

export const makeInitialReferenceUnverifiedRegionRecordV121 = (overrides = {}) => {
  const record = makeInitialReferenceRecordV121(overrides)
  discardEvidenceFor(record, 'identity.regionCode')
  record.identity.regionCode = unverifiedField(INITIAL_REFERENCE_REGION_CODE)
  return record
}

export const makeInitialReferenceUnknownMealScheduleRecordV121 = () => {
  const record = makeInitialReferenceRecordV121()
  discardEvidenceFor(record, 'meal.mealSchedule')
  record.meal.mealSchedule = unknownField()
  return record
}

export const setInitialReferenceMealSupport = (record, key, value, status = 'verified') => {
  if (key !== 'easyChewSupport' && key !== 'modifiedFoodSupport') {
    throw new Error(`unsupported fixture meal field: ${key}`)
  }
  const fieldPath = `meal.${key}`
  discardEvidenceFor(record, fieldPath)
  record.meal[key] = value === 'unknown'
    ? unknownField()
    : evidenceField(record, fieldPath, value, 'stable_code', status)
  return record
}

export const setInitialReferenceRegion = (record, regionCode, status = 'verified') => {
  const fieldPath = 'identity.regionCode'
  discardEvidenceFor(record, fieldPath)
  record.identity.regionCode = status === 'unverified'
    ? unverifiedField(regionCode)
    : evidenceField(record, fieldPath, regionCode, 'stable_code', status)
  return record
}

export const setInitialReferenceRoomType = (record, roomType, roomIndex = 0, status = 'verified') => {
  const fieldPath = `rooms.${roomIndex}.roomType`
  discardEvidenceFor(record, fieldPath)
  record.rooms[roomIndex].roomType = status === 'unverified'
    ? unverifiedField(roomType)
    : evidenceField(record, fieldPath, roomType, 'stable_code', status)
  return record
}

export const setInitialReferenceMealSchedule = (record, mealSchedule, status = 'verified') => {
  const fieldPath = 'meal.mealSchedule'
  discardEvidenceFor(record, fieldPath)
  record.meal.mealSchedule = status === 'unverified'
    ? unverifiedField(mealSchedule)
    : evidenceField(record, fieldPath, mealSchedule, 'stable_code', status)
  return record
}

export const makeInitialReferenceCatalogV121 = (
  record = makeInitialReferenceRecordV121(),
  overrides = {},
) => makeInitialReferenceCatalogWithRecordsV121([record], overrides)

export const makeInitialReferenceCatalogWithRecordsV121 = (records, overrides = {}) => ({
  datasetVersion: INITIAL_REFERENCE_DATASET_VERSION,
  datasetMode: 'MOCK_DEVELOPMENT_ONLY',
  records,
  currentPointers: records.map((record) => ({
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
  })),
  presentation: {
    orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1',
    displayOrder: [],
  },
  ...clone(overrides),
})

export const makeInitialReferenceFutureRegionAsOfRecordV121 = () => {
  const record = makeInitialReferenceRecordV121()
  record.identity.regionCode.asOf = '2026-10-26T04:00:00.001Z'
  return record
}

export const setInitialReferencePrice = (record, {
  minAmountMinor = 650000,
  maxAmountMinor = 980000,
  rangeKind = 'bounded',
  verificationStatus = 'verified',
  asOf = INITIAL_REFERENCE_EVIDENCE_AS_OF,
  validUntil,
} = {}) => {
  const fieldPath = 'price.referenceMonthlyPrice'
  discardEvidenceFor(record, fieldPath)
  const range = rangeKind === 'starting_at'
    ? {
      kind: 'starting_at',
      min: { amountMinor: minAmountMinor, currency: 'CNY' },
      max: null,
      period: 'month',
    }
    : {
      kind: 'bounded',
      min: { amountMinor: minAmountMinor, currency: 'CNY' },
      max: { amountMinor: maxAmountMinor, currency: 'CNY' },
      period: 'month',
    }
  const field = evidenceField(
    record,
    fieldPath,
    { basis: 'reference_total', range },
    'reference_monthly_price',
    verificationStatus,
  )
  field.asOf = asOf
  if (validUntil !== undefined || verificationStatus === 'expired') {
    const expiry = validUntil === undefined ? INITIAL_REFERENCE_EXPIRED_AT : validUntil
    field.verification.validUntil = expiry
    const evidenceId = field.verification.evidenceIds[0]
    const evidence = record.evidence.find((item) =>
      item.evidenceId === evidenceId && item.fieldPath === fieldPath)
    if (evidence) {
      evidence.validUntil = expiry
    }
  }
  record.price.referenceMonthlyPrice = field
  return record
}

export const makeInitialReferenceArchiveCurrentSidecarPair = () => {
  const archiveRevisionOne = makeInitialReferenceRecordV121()
  const currentRevisionTwo = clone(archiveRevisionOne)
  currentRevisionTwo.recordRevision = 2
  currentRevisionTwo.evidence.forEach((item) => { item.recordRevision = 2 })
  return { archiveRevisionOne, currentRevisionTwo }
}

export const makeInitialReferenceWanderingCapabilityRecordV121 = ({
  status = 'unsupported',
  verificationStatus = 'verified',
} = {}) => {
  const record = makeInitialReferenceRecordV121()
  const field = record.capabilities.cognitiveSupport.wandering_risk_support
  field.status = status
  if (verificationStatus === 'expired') {
    field.verification.status = 'expired'
    field.verification.validUntil = INITIAL_REFERENCE_EXPIRED_AT
  }
  const evidenceId = field.verification.evidenceIds[0]
  const evidence = record.evidence.find((item) => item.evidenceId === evidenceId)
  if (evidence) {
    evidence.valueSnapshot.value = status
    evidence.verificationStatus = verificationStatus
    if (verificationStatus === 'expired') evidence.validUntil = INITIAL_REFERENCE_EXPIRED_AT
  }
  return record
}

/** Rebind a legal record's identity and every evidence identity reference. */
export const reidentifyInitialReferenceRecordV121 = (
  input,
  institutionId,
  recordRevision = input.recordRevision,
) => {
  const record = clone(input)
  const evidenceIdMap = new Map()
  record.evidence.forEach((item, index) => {
    evidenceIdMap.set(item.evidenceId, `ev-c1-${slug(institutionId)}-${recordRevision}-${index + 1}`)
  })
  record.institutionId = institutionId
  record.recordRevision = recordRevision
  record.evidence.forEach((item) => {
    item.institutionId = institutionId
    item.recordRevision = recordRevision
    item.evidenceId = evidenceIdMap.get(item.evidenceId)
  })
  const rebindEvidenceReferences = (value) => {
    if (Array.isArray(value)) {
      value.forEach(rebindEvidenceReferences)
      return
    }
    if (value === null || typeof value !== 'object') return
    Object.keys(value).forEach((key) => {
      if (key === 'evidenceIds' && Array.isArray(value[key])) {
        value[key] = value[key].map((evidenceId) => evidenceIdMap.get(evidenceId) || evidenceId)
      } else {
        rebindEvidenceReferences(value[key])
      }
    })
  }
  rebindEvidenceReferences(record)
  return record
}

export const makeInitialReferenceBrokenEvidenceCatalogV121 = () => {
  const catalog = makeInitialReferenceCatalogV121()
  const record = catalog.records[0]
  record.identity.regionCode.verification.evidenceIds = ['missing-c1-test-evidence']
  return catalog
}

export const makeInitialReferenceUnpublishedCatalogV121 = () => {
  const catalog = makeInitialReferenceCatalogV121()
  catalog.records[0].recordStatus = 'draft'
  return catalog
}

export const cloneInitialReferenceCatalogV121 = (catalog) => clone(catalog)
