/**
 * SYNTHETIC_TEST_ONLY — NOT REAL INSTITUTION DATA.
 *
 * These builders are owned by runtime tests. Application code must never
 * import this file and no value represents a Wuhan institution fact.
 */
import {
  cloneInstitutionV11Record,
  validInstitutionV11Fixtures,
} from './institution-v1-1-fixtures.mjs'

export const INSTITUTION_V121_FIXTURE_POLICY = 'SYNTHETIC_TEST_ONLY'
export const INSTITUTION_V121_DATA_LABEL = 'NOT_REAL_INSTITUTION_DATA'
export const INSTITUTION_V121_AS_OF = '2026-09-12T08:00:00.000Z'
export const INSTITUTION_V121_VALID_UNTIL = '2027-09-12T08:00:00.000Z'
export const INSTITUTION_V121_EVALUATION_AS_OF = '2026-09-13T08:00:00.000Z'
export const SYNTHETIC_COMPLETENESS_CRITERIA_REF = 'test-only-care-record-criteria-v1'

export const unknownField = () => ({
  availability: 'unknown',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

export const unavailableField = () => ({
  availability: 'unavailable',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

export const unverifiedField = (value) => ({
  availability: 'provided',
  value,
  verification: { status: 'unverified', evidenceIds: [] },
})

export const makeUnknownCareProcess = () => ({
  schemaVersion: 'institution-care-process-v1',
  careRecord: {
    presence: unknownField(),
    completeness: unknownField(),
    completenessCriteriaRef: unknownField(),
    frequency: unknownField(),
    otherFrequencyNote: unknownField(),
    traceability: unknownField(),
  },
  shiftHandover24h: {
    presence: unknownField(),
    processNote: unknownField(),
    contents: {
      vital_signs: unknownField(),
      abnormal_events: unknownField(),
      interventions_recorded: unknownField(),
      follow_up: unknownField(),
      family_communication: unknownField(),
      medical_transfer: unknownField(),
    },
  },
})

export const makeUnknownOfficialContact = () => ({
  schemaVersion: 'institution-official-contact-v1',
  phoneDirectoryPresence: unknownField(),
  officialPhones: [],
})

export const makeUnknownPublicLocation = () => ({
  schemaVersion: 'institution-public-location-v1',
  address: unknownField(),
  geo: unknownField(),
})

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

export const cloneInstitutionV121Record = clone

export const makeValidInstitutionV12 = () => {
  const record = cloneInstitutionV11Record(validInstitutionV11Fixtures[0].record)
  record.contractVersion = 'institution-contract-v1.2'
  record.careProcess = makeUnknownCareProcess()
  return record
}

export const makeValidInstitutionV121 = () => {
  const record = makeValidInstitutionV12()
  record.contractVersion = 'institution-contract-v1.2.1'
  record.officialContact = makeUnknownOfficialContact()
  record.publicLocation = makeUnknownPublicLocation()
  return record
}

const nextEvidenceId = (record) => `ev-v121-test-${record.evidence.length + 1}`

export const makeEvidenceField = (
  record,
  fieldPath,
  value,
  valueType,
  status = 'verified',
  sourceType = 'official_document',
) => {
  const evidenceId = nextEvidenceId(record)
  const verification = status === 'unverified'
    ? { status, evidenceIds: [evidenceId] }
    : status === 'expired'
      ? {
          status,
          evidenceIds: [evidenceId],
          verifiedAt: INSTITUTION_V121_AS_OF,
          validUntil: '2026-09-12T23:59:59.000Z',
        }
      : {
          status,
          evidenceIds: [evidenceId],
          verifiedAt: INSTITUTION_V121_AS_OF,
          validUntil: INSTITUTION_V121_VALID_UNTIL,
        }
  const evidence = {
    evidenceId,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath,
    valueSnapshot: { valueType, value: clone(value) },
    observedAt: INSTITUTION_V121_AS_OF,
    sourceType,
    sourceNote: `${INSTITUTION_V121_FIXTURE_POLICY}; ${INSTITUTION_V121_DATA_LABEL}`,
    verificationStatus: status,
  }
  if (status !== 'unverified') evidence.verifiedAt = verification.verifiedAt
  if (status === 'expired' || status === 'verified') evidence.validUntil = verification.validUntil
  record.evidence.push(evidence)
  return {
    availability: 'provided',
    value: clone(value),
    asOf: INSTITUTION_V121_AS_OF,
    verification,
  }
}

export const SYNTHETIC_ADDRESS = Object.freeze({
  countryCode: 'CN',
  province: { code: 'test-province', displayName: '测试省' },
  city: { code: 'test-city', displayName: '测试市' },
  district: { code: 'test-district', displayName: '测试区' },
  addressLine: '测试大道一号测试园区',
  postalCode: 'TEST-100',
})

export const SYNTHETIC_GEO = Object.freeze({
  latitude: 31.234567,
  longitude: 114.345678,
  coordinateSystem: 'gcj02',
})

export const SYNTHETIC_MOBILE = Object.freeze({
  purpose: 'main',
  otherPurposeNote: null,
  number: {
    kind: 'mainland_mobile',
    countryCallingCode: '+86',
    nationalNumber: '13900000001',
    extension: null,
  },
})

export const SYNTHETIC_LANDLINE = Object.freeze({
  purpose: 'service',
  otherPurposeNote: null,
  number: {
    kind: 'mainland_landline',
    countryCallingCode: '+86',
    areaCode: '0999',
    subscriberNumber: '12345678',
    extension: '123',
  },
})

export const enrichInstitutionV121 = (input = makeValidInstitutionV121(), options = {}) => {
  const record = clone(input)
  if (options.careProcess !== false) {
    record.careProcess.careRecord.presence = makeEvidenceField(
      record, 'careProcess.careRecord.presence', 'present', 'stable_code',
    )
    record.careProcess.careRecord.frequency = makeEvidenceField(
      record, 'careProcess.careRecord.frequency', ['daily', 'event_based'], 'stable_code_list',
    )
    record.careProcess.careRecord.traceability = makeEvidenceField(
      record, 'careProcess.careRecord.traceability', 'traceable', 'stable_code',
    )
    record.careProcess.shiftHandover24h.presence = makeEvidenceField(
      record, 'careProcess.shiftHandover24h.presence', 'present', 'stable_code',
    )
    record.careProcess.shiftHandover24h.processNote = makeEvidenceField(
      record, 'careProcess.shiftHandover24h.processNote', '仅用于测试的交接说明', 'text',
    )
    record.careProcess.shiftHandover24h.contents.vital_signs = makeEvidenceField(
      record, 'careProcess.shiftHandover24h.contents.vital_signs', 'present', 'stable_code',
    )
  }
  if (options.contact !== false) {
    record.officialContact.phoneDirectoryPresence = makeEvidenceField(
      record, 'officialContact.phoneDirectoryPresence', 'present', 'stable_code',
    )
    record.officialContact.officialPhones = [
      {
        officialPhoneKey: 'phone-main-001',
        phone: makeEvidenceField(
          record,
          'officialContact.officialPhones.phone-main-001.phone',
          SYNTHETIC_MOBILE,
          'official_phone',
        ),
      },
      {
        officialPhoneKey: 'phone-service-001',
        phone: makeEvidenceField(
          record,
          'officialContact.officialPhones.phone-service-001.phone',
          SYNTHETIC_LANDLINE,
          'official_phone',
        ),
      },
    ]
  }
  if (options.location !== false) {
    record.publicLocation.address = makeEvidenceField(
      record, 'publicLocation.address', SYNTHETIC_ADDRESS, 'structured_address',
    )
    record.publicLocation.geo = makeEvidenceField(
      record, 'publicLocation.geo', SYNTHETIC_GEO, 'geo_location',
    )
  }
  return record
}

export const SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER = Object.freeze({
  isValidHierarchy: (address) => address.countryCode === 'CN'
    && address.province.code === 'test-province'
    && address.province.displayName === '测试省'
    && address.city.code === 'test-city'
    && address.city.displayName === '测试市'
    && address.district.code === 'test-district'
    && address.district.displayName === '测试区',
})

export const SYNTHETIC_COMPLETENESS_CRITERIA_RESOLVER = Object.freeze({
  isApprovedCriteriaRef: (criteriaRef) => criteriaRef === SYNTHETIC_COMPLETENESS_CRITERIA_REF,
})

export const makePublicContent = (overrides = {}) => ({
  schemaVersion: 'institution-public-content-v1',
  institutionId: 'institution-v11-001-mock',
  contentRevision: 1,
  publicationStatus: 'published',
  introduction: {
    availability: 'provided',
    text: '仅用于自动化测试的机构简介。',
    sourceType: 'platform_edited',
  },
  updatedAt: INSTITUTION_V121_AS_OF,
  ...overrides,
})
