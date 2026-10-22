/**
 * Institution Contract V1 fixtures.
 *
 * Every record in this file is deliberately synthetic.  It is not a provider,
 * does not name a real Wuhan institution, and must never be imported by a
 * Page, Service, or production data source.
 */

export const INSTITUTION_FIXTURE_POLICY = 'MOCK_DEVELOPMENT_ONLY'
export const TEST_SYNTHETIC_VERIFIED = 'TEST_SYNTHETIC_VERIFIED'
export const NOT_REAL_INSTITUTION_DATA = 'NOT_REAL_INSTITUTION_DATA'

export const INSTITUTION_FIXTURE_AS_OF = '2026-08-30T09:00:00.000Z'
export const INSTITUTION_FIXTURE_VALID_UNTIL = '2027-08-30T09:00:00.000Z'
export const INSTITUTION_FIXTURE_EXPIRED_AT = '2025-08-30T09:00:00.000Z'
export const INSTITUTION_FIXTURE_EXPIRED_UNTIL = '2025-12-31T09:00:00.000Z'
export const INSTITUTION_FIXTURE_EVALUATION_AS_OF = '2026-08-31T09:00:00.000Z'

export const CARE_LEVEL_CODES = Object.freeze([
  'independent',
  'light_care',
  'semi_disabled',
  'disabled',
  'severely_disabled',
])

export const MOBILITY_CODES = Object.freeze([
  'wheelchair_support',
  'bedbound_support',
  'transfer_support',
])

export const COGNITIVE_CODES = Object.freeze([
  'dementia_acceptance',
  'wandering_risk_support',
])

export const SPECIAL_CARE_CODES = Object.freeze([
  'round_the_clock_care',
  'one_to_one_caregiver',
  'night_care',
  'dementia_unit',
  'rehabilitation_training',
  'tube_feeding',
  'catheter_care',
  'pressure_injury_care',
  'incontinence_care',
])

export const REHABILITATION_FEATURE_CODES = Object.freeze([
  'rehabilitation_therapist',
  'rehabilitation_room',
  'postoperative_rehabilitation',
  'limb_function_training',
  'cognitive_training',
])

export const MATCHING_CRITICAL_FIELD_PATHS = Object.freeze([
  'identity.regionCode',
  'typeProfile.supportedTypes',
  'capabilities.careLevelAcceptance.independent',
  'capabilities.careLevelAcceptance.light_care',
  'capabilities.careLevelAcceptance.semi_disabled',
  'capabilities.careLevelAcceptance.disabled',
  'capabilities.careLevelAcceptance.severely_disabled',
  'capabilities.mobilitySupport.wheelchair_support',
  'capabilities.mobilitySupport.bedbound_support',
  'capabilities.mobilitySupport.transfer_support',
  'capabilities.cognitiveSupport.dementia_acceptance',
  'capabilities.cognitiveSupport.wandering_risk_support',
  'capabilities.specialCare.round_the_clock_care',
  'capabilities.specialCare.one_to_one_caregiver',
  'capabilities.specialCare.night_care',
  'capabilities.specialCare.dementia_unit',
  'capabilities.specialCare.rehabilitation_training',
  'capabilities.specialCare.tube_feeding',
  'capabilities.specialCare.catheter_care',
  'capabilities.specialCare.pressure_injury_care',
  'capabilities.specialCare.incontinence_care',
  'price.referenceMonthlyPrice',
])

export const CAPABILITY_COVERAGE_MATRIX = Object.freeze([
  { source: 'careLevel=independent', docTarget: 'careLevelAcceptance.independent', target: 'capabilities.careLevelAcceptance.independent', coverage: 'DIRECT' },
  { source: 'careLevel=light_care', docTarget: 'careLevelAcceptance.light_care', target: 'capabilities.careLevelAcceptance.light_care', coverage: 'DIRECT' },
  { source: 'careLevel=semi_disabled', docTarget: 'careLevelAcceptance.semi_disabled', target: 'capabilities.careLevelAcceptance.semi_disabled', coverage: 'DIRECT' },
  { source: 'careLevel=disabled', docTarget: 'careLevelAcceptance.disabled', target: 'capabilities.careLevelAcceptance.disabled', coverage: 'DIRECT' },
  { source: 'careLevel=severely_disabled', docTarget: 'careLevelAcceptance.severely_disabled', target: 'capabilities.careLevelAcceptance.severely_disabled', coverage: 'DIRECT' },
  { source: 'mobility=wheelchair', docTarget: 'mobilitySupport.wheelchair_support', target: 'capabilities.mobilitySupport.wheelchair_support', coverage: 'REQUIRES_MAPPING' },
  { source: 'mobility=bedbound', docTarget: 'mobilitySupport.bedbound_support', target: 'capabilities.mobilitySupport.bedbound_support', coverage: 'REQUIRES_MAPPING' },
  { source: 'careMode=transfer_support/fully_dependent_transfer', docTarget: 'mobilitySupport.transfer_support', target: 'capabilities.mobilitySupport.transfer_support', coverage: 'REQUIRES_MAPPING' },
  { source: 'rehabilitation required/possible', docTarget: 'specialCare.rehabilitation_training', target: 'capabilities.specialCare.rehabilitation_training', coverage: 'REQUIRES_MAPPING' },
  { source: 'reported dementia diagnosis', docTarget: 'cognitiveSupport.dementia_acceptance', target: 'capabilities.cognitiveSupport.dementia_acceptance', coverage: 'REQUIRES_MAPPING' },
  { source: 'cognitive concern without diagnosis', docTarget: 'cognitiveSupport.dementia_acceptance', target: 'capabilities.cognitiveSupport.dementia_acceptance', coverage: 'REQUIRES_MAPPING' },
  { source: 'wandering risk present', docTarget: 'cognitiveSupport.wandering_risk_support', target: 'capabilities.cognitiveSupport.wandering_risk_support', coverage: 'REQUIRES_MAPPING' },
  { source: 'round_the_clock_care', docTarget: 'specialCare.round_the_clock_care', target: 'capabilities.specialCare.round_the_clock_care', coverage: 'DIRECT' },
  { source: 'one_to_one_caregiver', docTarget: 'specialCare.one_to_one_caregiver', target: 'capabilities.specialCare.one_to_one_caregiver', coverage: 'DIRECT' },
  { source: 'night_care', docTarget: 'specialCare.night_care', target: 'capabilities.specialCare.night_care', coverage: 'DIRECT' },
  { source: 'dementia_unit', docTarget: 'specialCare.dementia_unit', target: 'capabilities.specialCare.dementia_unit', coverage: 'DIRECT' },
  { source: 'rehabilitation_training', docTarget: 'specialCare.rehabilitation_training', target: 'capabilities.specialCare.rehabilitation_training', coverage: 'DIRECT' },
  { source: 'tube_feeding', docTarget: 'specialCare.tube_feeding', target: 'capabilities.specialCare.tube_feeding', coverage: 'DIRECT' },
  { source: 'catheter_care', docTarget: 'specialCare.catheter_care', target: 'capabilities.specialCare.catheter_care', coverage: 'DIRECT' },
  { source: 'pressure_injury_care', docTarget: 'specialCare.pressure_injury_care', target: 'capabilities.specialCare.pressure_injury_care', coverage: 'DIRECT' },
  { source: 'incontinence_care', docTarget: 'specialCare.incontinence_care', target: 'capabilities.specialCare.incontinence_care', coverage: 'DIRECT' },
  { source: 'ADL special_feeding clue', docTarget: 'none', target: 'none', coverage: 'NOT_APPLICABLE' },
  { source: 'ADL catheter_or_stoma clue', docTarget: 'none', target: 'none', coverage: 'NOT_APPLICABLE' },
])

export const CAPABILITY_MAPPING_INTENTS = Object.freeze([
  { source: 'mobility.level = wheelchair', target: 'capabilities.mobilitySupport.wheelchair_support' },
  { source: 'mobility.level = bedbound', target: 'capabilities.mobilitySupport.bedbound_support' },
  { source: 'adl.careModes = transfer_support / fully_dependent_transfer', target: 'capabilities.mobilitySupport.transfer_support' },
  { source: 'health rehabilitation required / possible', target: 'capabilities.specialCare.rehabilitation_training' },
  { source: 'reported cognitive diagnosis/concern', target: 'capabilities.cognitiveSupport.dementia_acceptance' },
  { source: 'cognition.wanderingRisk = present', target: 'capabilities.cognitiveSupport.wandering_risk_support' },
])

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const stableEvidenceId = (fixtureKey, fieldPath) =>
  `ev-${fixtureKey}-${fieldPath.replace(/[^a-zA-Z0-9]+/g, '-')}`.toLowerCase()

const unverified = () => ({ status: 'unverified', evidenceIds: [] })

const makeEvidence = (fixtureKey, institutionId, fieldPath, valueSnapshot, status, evidenceIds) => {
  const evidenceId = stableEvidenceId(fixtureKey, fieldPath)
  evidenceIds.push({
    evidenceId,
    institutionId,
    recordRevision: 1,
    fieldPath,
    valueSnapshot,
    observedAt: INSTITUTION_FIXTURE_AS_OF,
    sourceType: 'official_document',
    ...(fieldPath.endsWith('supportedTypes')
      ? { sourceReference: `synthetic://${fixtureKey}/${evidenceId}` }
      : { sourceNote: `${TEST_SYNTHETIC_VERIFIED}; ${NOT_REAL_INSTITUTION_DATA}` }),
    verificationStatus: status,
    ...(status === 'unverified'
      ? {}
      : {
        verifiedAt: status === 'expired' ? INSTITUTION_FIXTURE_EXPIRED_AT : INSTITUTION_FIXTURE_AS_OF,
        ...(status === 'expired' ? { validUntil: INSTITUTION_FIXTURE_EXPIRED_UNTIL } : { validUntil: INSTITUTION_FIXTURE_VALID_UNTIL }),
      }),
  })
  return evidenceId
}

const verificationFor = (fixtureKey, institutionId, fieldPath, valueSnapshot, mode, evidence) => {
  if (mode === 'unverified') {
    return unverified()
  }
  const evidenceId = makeEvidence(fixtureKey, institutionId, fieldPath, valueSnapshot, mode, evidence)
  if (mode === 'expired') {
    return {
      status: 'expired',
      evidenceIds: [evidenceId],
      verifiedAt: INSTITUTION_FIXTURE_EXPIRED_AT,
      validUntil: INSTITUTION_FIXTURE_EXPIRED_UNTIL,
    }
  }
  return {
    status: 'verified',
    evidenceIds: [evidenceId],
    verifiedAt: INSTITUTION_FIXTURE_AS_OF,
    validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
  }
}

const providedField = (value, verification = unverified(), asOf = INSTITUTION_FIXTURE_AS_OF) => ({
  availability: 'provided',
  value,
  asOf,
  verification,
})

const unknownField = (verification = unverified()) => ({
  availability: 'unknown',
  value: null,
  verification,
})

const unavailableField = (verification = unverified()) => ({
  availability: 'unavailable',
  value: null,
  verification,
})

const makeCapability = (fixtureKey, institutionId, path, code, status, verificationMode, evidence) => ({
  code,
  status,
  asOf: INSTITUTION_FIXTURE_AS_OF,
  verification: verificationFor(
    fixtureKey,
    institutionId,
    path,
    { valueType: 'stable_code', value: status },
    verificationMode,
    evidence,
  ),
})

const makeCapabilityMatrix = (fixtureKey, institutionId, path, codes, status, verificationMode, overrides, evidence) => {
  const matrix = {}
  codes.forEach((code) => {
    const itemStatus = Object.prototype.hasOwnProperty.call(overrides, code) ? overrides[code] : status
    matrix[code] = makeCapability(
      fixtureKey,
      institutionId,
      `${path}.${code}`,
      code,
      itemStatus,
      verificationMode,
      evidence,
    )
  })
  return matrix
}

const makeMedia = (mediaId) => ({
  mediaId,
  category: 'exterior',
  role: 'cover',
  sortOrder: providedField(0),
  url: providedField(`https://example.invalid/${mediaId}.jpg`),
  caption: providedField('Synthetic exterior image'),
  capturedAt: providedField(INSTITUTION_FIXTURE_AS_OF),
})

const makeAReferencePrice = (fixtureKey, institutionId, verificationMode, evidence) => {
  const range = {
    kind: 'bounded',
    min: { amountMinor: 650000, currency: 'CNY' },
    max: { amountMinor: 980000, currency: 'CNY' },
    period: 'month',
  }
  return providedField(
    { basis: 'reference_total', range },
    verificationFor(
      fixtureKey,
      institutionId,
      'price.referenceMonthlyPrice',
      { valueType: 'reference_monthly_price', value: { basis: 'reference_total', range } },
      verificationMode,
      evidence,
    ),
  )
}

const makeStartingAtPrice = () => providedField({
  basis: 'reference_total',
  range: {
    kind: 'starting_at',
    min: { amountMinor: 480000, currency: 'CNY' },
    max: null,
    period: 'month',
  },
})

const makeARecord = () => {
  const fixtureKey = 'a-mock'
  const institutionId = 'institution-a-mock'
  const evidence = []
  const mediaId = 'media-a-cover'
  const supportedTypes = ['medical_nursing_integrated', 'disability_care']
  const supportedTypesVerification = verificationFor(
    fixtureKey,
    institutionId,
    'typeProfile.supportedTypes',
    { valueType: 'stable_code_list', value: supportedTypes },
    'verified',
    evidence,
  )

  return {
    contractVersion: 'institution-contract-v1',
    capabilityContractVersion: 'institution-capability-contract-v1',
    institutionId,
    recordRevision: 1,
    recordProvenance: INSTITUTION_FIXTURE_POLICY,
    recordStatus: 'published',
    identity: {
      name: providedField('Institution A Mock'),
      regionCode: providedField('mock-region-a'),
      regionDisplayName: providedField('Mock Region A'),
      address: providedField('Mock Address A'),
      coordinates: providedField({ latitude: 30.5001, longitude: 114.3001 }),
      establishedDate: providedField('2018-06-01'),
      bedCapacity: providedField(200),
      publicContact: providedField('mock-contact-a'),
      coverMediaId: providedField(mediaId),
    },
    typeProfile: {
      primaryType: providedField('medical_nursing_integrated'),
      supportedTypes: providedField(supportedTypes, supportedTypesVerification),
    },
    capabilities: {
      careLevelAcceptance: makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.careLevelAcceptance', CARE_LEVEL_CODES, 'supported', 'verified', {}, evidence),
      mobilitySupport: makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.mobilitySupport', MOBILITY_CODES, 'supported', 'verified', {}, evidence),
      cognitiveSupport: makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.cognitiveSupport', COGNITIVE_CODES, 'supported', 'verified', {}, evidence),
      specialCare: makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.specialCare', SPECIAL_CARE_CODES, 'supported', 'verified', {}, evidence),
    },
    services: [{
      serviceId: 'service-a-daily-support',
      code: 'daily_living_support',
      name: providedField('Synthetic daily support'),
      availability: 'available',
      priceTreatment: 'included',
      scheduleNote: unknownField(),
      description: unknownField(),
      verification: unverified(),
    }],
    medicalSupport: {
      doctorRounds: unknownField(),
      nurseStaff: unknownField(),
      nurseStation: unknownField(),
      partnerHospitals: unknownField(),
      emergencyTransferSupport: {
        code: 'emergency_transfer_support',
        status: 'unknown',
        verification: unverified(),
      },
    },
    rehabilitationSupport: {
      features: makeCapabilityMatrix(fixtureKey, institutionId, 'rehabilitationSupport.features', REHABILITATION_FEATURE_CODES, 'unknown', 'unverified', {}, evidence),
    },
    staffing: {
      counts: unknownField(),
      caregiverResidentRatio: unknownField(),
    },
    price: {
      referenceMonthlyPrice: makeAReferencePrice(fixtureKey, institutionId, 'verified', evidence),
      recurringComponents: [],
      deposit: unknownField(),
      oneTimeFees: [],
      adjustmentFactors: unknownField(),
      priceNote: unknownField(),
    },
    operations: {
      bedAvailability: {
        status: 'available',
        asOf: INSTITUTION_FIXTURE_AS_OF,
        verification: unverified(),
      },
      acceptingNewResidents: providedField('yes'),
      estimatedWait: unknownField(),
      earliestMoveInDate: unknownField(),
    },
    rooms: [{
      roomId: 'room-a-single',
      name: providedField('Synthetic single room'),
      roomType: providedField('single'),
      areaSquareMeters: unknownField(),
      bedType: unknownField(),
      features: {
        privateBathroom: unknownField(),
        airConditioner: unknownField(),
        wardrobe: unknownField(),
        television: unknownField(),
        callSystem: unknownField(),
        balcony: unknownField(),
        accessibility: unknownField(),
      },
      referencePrice: unknownField(),
      mediaIds: [mediaId],
    }],
    media: [makeMedia(mediaId)],
    vr: {
      status: 'available',
      url: providedField('https://example.invalid/institution-a-vr'),
      coverMediaId: providedField(mediaId),
      scenes: [{
        sceneId: 'scene-a-exterior',
        sceneCode: 'exterior',
        name: providedField('Synthetic exterior scene'),
        url: providedField('https://example.invalid/institution-a-vr/exterior'),
        coverMediaId: providedField(mediaId),
      }],
      verification: unverified(),
    },
    qualifications: [{
      qualificationId: 'qualification-a-license',
      type: 'business_license',
      certificateName: providedField('Synthetic qualification'),
      documentUrl: unknownField(),
      validity: 'valid',
      validFrom: providedField('2024-01-01'),
      validUntil: providedField('2028-01-01'),
      verification: unverified(),
    }],
    evidence,
  }
}

const makeSimpleRecord = ({
  fixtureKey,
  institutionId,
  name,
  regionCode,
  capabilityStatus,
  capabilityOverrides = {},
  capabilityVerification = 'verified',
  supportedTypes = ['active_aging'],
  supportedTypesAvailability = 'provided',
  supportedTypesVerification = capabilityVerification,
  primaryType,
  priceMode = 'provided',
  priceVerification = 'unverified',
  availabilityStatus = 'unknown',
  qualificationValidity = 'unknown',
}) => {
  const evidence = []
  const supportedTypesField = supportedTypesAvailability === 'provided'
    ? providedField(
      supportedTypes,
      verificationFor(
        fixtureKey,
        institutionId,
        'typeProfile.supportedTypes',
        { valueType: 'stable_code_list', value: supportedTypes },
        supportedTypesVerification,
        evidence,
      ),
    )
    : unknownField()
  const primaryTypeField = primaryType === undefined ? undefined : providedField(primaryType)
  const referenceMonthlyPrice = priceMode === 'unknown'
    ? unknownField()
    : makeAReferencePrice(fixtureKey, institutionId, priceVerification, evidence)
  const allCapabilities = Object.fromEntries([
    ['careLevelAcceptance', makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.careLevelAcceptance', CARE_LEVEL_CODES, capabilityStatus, capabilityVerification, capabilityOverrides.careLevelAcceptance || {}, evidence)],
    ['mobilitySupport', makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.mobilitySupport', MOBILITY_CODES, capabilityStatus, capabilityVerification, capabilityOverrides.mobilitySupport || {}, evidence)],
    ['cognitiveSupport', makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.cognitiveSupport', COGNITIVE_CODES, capabilityStatus, capabilityVerification, capabilityOverrides.cognitiveSupport || {}, evidence)],
    ['specialCare', makeCapabilityMatrix(fixtureKey, institutionId, 'capabilities.specialCare', SPECIAL_CARE_CODES, capabilityStatus, capabilityVerification, capabilityOverrides.specialCare || {}, evidence)],
  ])

  return {
    contractVersion: 'institution-contract-v1',
    capabilityContractVersion: 'institution-capability-contract-v1',
    institutionId,
    recordRevision: 1,
    recordProvenance: INSTITUTION_FIXTURE_POLICY,
    recordStatus: 'published',
    identity: {
      name: providedField(name),
      regionCode: providedField(regionCode),
      regionDisplayName: providedField(`Mock ${regionCode}`),
      address: unknownField(),
      coordinates: unknownField(),
      establishedDate: unknownField(),
      bedCapacity: unknownField(),
      publicContact: unknownField(),
      coverMediaId: unknownField(),
    },
    typeProfile: {
      ...(primaryType === undefined ? {} : { primaryType: primaryTypeField }),
      supportedTypes: supportedTypesField,
    },
    capabilities: allCapabilities,
    services: [],
    medicalSupport: {
      doctorRounds: unknownField(),
      nurseStaff: unknownField(),
      nurseStation: unknownField(),
      partnerHospitals: unknownField(),
      emergencyTransferSupport: {
        code: 'emergency_transfer_support',
        status: 'unknown',
        verification: unverified(),
      },
    },
    rehabilitationSupport: {
      features: makeCapabilityMatrix(fixtureKey, institutionId, 'rehabilitationSupport.features', REHABILITATION_FEATURE_CODES, 'unknown', 'unverified', {}, evidence),
    },
    staffing: {
      counts: unknownField(),
      caregiverResidentRatio: unknownField(),
    },
    price: {
      referenceMonthlyPrice: referenceMonthlyPrice,
      recurringComponents: [],
      deposit: unknownField(),
      oneTimeFees: [],
      adjustmentFactors: unknownField(),
      priceNote: unknownField(),
    },
    operations: {
      bedAvailability: availabilityStatus === 'unknown'
        ? { status: 'unknown', verification: unverified() }
        : { status: availabilityStatus, asOf: INSTITUTION_FIXTURE_AS_OF, verification: unverified() },
      acceptingNewResidents: unknownField(),
      estimatedWait: unknownField(),
      earliestMoveInDate: unknownField(),
    },
    rooms: [],
    media: [],
    vr: { status: 'unknown', url: null, coverMediaId: null, scenes: [], verification: unverified() },
    qualifications: qualificationValidity === 'unknown' ? [] : [{
      qualificationId: `${fixtureKey}-qualification`,
      type: 'other_certification',
      certificateName: unknownField(),
      documentUrl: unknownField(),
      validity: qualificationValidity,
      validFrom: unknownField(),
      validUntil: qualificationValidity === 'expired' ? providedField('2025-01-01') : unknownField(),
      verification: unverified(),
    }],
    evidence,
  }
}

const makeExpiredRecord = () => makeSimpleRecord({
  fixtureKey: 'e-mock',
  institutionId: 'institution-e-mock',
  name: 'Institution E Mock',
  regionCode: 'mock-region-e',
  capabilityStatus: 'supported',
  capabilityVerification: 'expired',
  supportedTypes: ['rehabilitation_care'],
  supportedTypesVerification: 'expired',
  primaryType: 'rehabilitation_care',
  priceVerification: 'expired',
  availabilityStatus: 'inquiry_required',
  qualificationValidity: 'expired',
})

export const institutionFixtures = Object.freeze([
  {
    id: 'INSTITUTION_A_MOCK',
    description: 'all matching-critical capabilities synthetically verified and supported',
    labels: Object.freeze({
      fixturePolicy: INSTITUTION_FIXTURE_POLICY,
      verification: TEST_SYNTHETIC_VERIFIED,
      data: NOT_REAL_INSTITUTION_DATA,
    }),
    record: makeARecord(),
  },
  {
    id: 'INSTITUTION_B_MOCK',
    description: 'mixed supported and requires_assessment capabilities',
    labels: Object.freeze({
      fixturePolicy: INSTITUTION_FIXTURE_POLICY,
      verification: TEST_SYNTHETIC_VERIFIED,
      data: NOT_REAL_INSTITUTION_DATA,
    }),
    record: makeSimpleRecord({
      fixtureKey: 'b-mock',
      institutionId: 'institution-b-mock',
      name: 'Institution B Mock',
      regionCode: 'mock-region-b',
      capabilityStatus: 'supported',
      capabilityOverrides: {
        mobilitySupport: { wheelchair_support: 'requires_assessment' },
        cognitiveSupport: { dementia_acceptance: 'requires_assessment' },
        specialCare: { tube_feeding: 'requires_assessment' },
      },
      primaryType: 'active_aging',
      priceMode: 'provided',
    }),
  },
  {
    id: 'INSTITUTION_C_MOCK',
    description: 'explicitly unsupported capability facts and optional primaryType absent',
    labels: Object.freeze({
      fixturePolicy: INSTITUTION_FIXTURE_POLICY,
      verification: TEST_SYNTHETIC_VERIFIED,
      data: NOT_REAL_INSTITUTION_DATA,
    }),
    record: makeSimpleRecord({
      fixtureKey: 'c-mock',
      institutionId: 'institution-c-mock',
      name: 'Institution C Mock',
      regionCode: 'mock-region-c',
      capabilityStatus: 'unsupported',
      supportedTypes: ['active_aging', 'rehabilitation_care'],
      priceMode: 'unknown',
      availabilityStatus: 'unavailable',
    }),
  },
  {
    id: 'INSTITUTION_D_MOCK',
    description: 'unknown facts are represented explicitly and are never false',
    labels: Object.freeze({
      fixturePolicy: INSTITUTION_FIXTURE_POLICY,
      verification: 'TEST_SYNTHETIC_UNVERIFIED',
      data: NOT_REAL_INSTITUTION_DATA,
    }),
    record: makeSimpleRecord({
      fixtureKey: 'd-mock',
      institutionId: 'institution-d-mock',
      name: 'Institution D Mock',
      regionCode: 'mock-region-d',
      capabilityStatus: 'unknown',
      capabilityVerification: 'unverified',
      supportedTypesAvailability: 'unknown',
      primaryType: undefined,
      priceMode: 'unknown',
      availabilityStatus: 'unknown',
    }),
  },
  {
    id: 'INSTITUTION_E_MOCK',
    description: 'expired verification is retained as raw data but projects to unknown',
    labels: Object.freeze({
      fixturePolicy: INSTITUTION_FIXTURE_POLICY,
      verification: TEST_SYNTHETIC_VERIFIED,
      data: NOT_REAL_INSTITUTION_DATA,
    }),
    record: makeExpiredRecord(),
  },
])

export const validInstitutionFixtures = institutionFixtures

const mutate = (fixture, mutation) => {
  const record = deepClone(fixture.record)
  mutation(record)
  return record
}

const fixtureA = institutionFixtures[0]
const fixtureD = institutionFixtures[3]

const addVerifiedCompoundEvidence = (record, fieldPath, field, valueSnapshot) => {
  const evidenceIds = []
  const evidenceId = stableEvidenceId('a-mock', fieldPath)
  field.verification = {
    status: 'verified',
    evidenceIds: [evidenceId],
    verifiedAt: INSTITUTION_FIXTURE_AS_OF,
    validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
  }
  record.evidence.push({
    evidenceId,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath,
    valueSnapshot,
    observedAt: INSTITUTION_FIXTURE_AS_OF,
    sourceType: 'official_document',
    sourceNote: `${TEST_SYNTHETIC_VERIFIED}; ${NOT_REAL_INSTITUTION_DATA}`,
    verificationStatus: 'verified',
    verifiedAt: INSTITUTION_FIXTURE_AS_OF,
    validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
  })
  evidenceIds.push(evidenceId)
}

export const compoundSnapshotFixture = (() => {
  const record = deepClone(fixtureA.record)
  record.identity.coordinates = providedField(
    { latitude: 30.5001, longitude: 114.3001 },
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'identity.coordinates',
    record.identity.coordinates,
    { valueType: 'coordinates', value: { latitude: 30.5001, longitude: 114.3001 } },
  )
  record.medicalSupport.partnerHospitals = providedField(
    [{ name: 'Synthetic Partner Hospital' }],
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'medicalSupport.partnerHospitals',
    record.medicalSupport.partnerHospitals,
    { valueType: 'partner_hospital_list', value: [{ name: 'Synthetic Partner Hospital' }] },
  )
  record.staffing.counts = providedField(
    [{ role: 'nurse', count: 2 }, { role: 'caregiver', count: 4 }],
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'staffing.counts',
    record.staffing.counts,
    { valueType: 'staff_count_list', value: [{ role: 'nurse', count: 2 }, { role: 'caregiver', count: 4 }] },
  )
  record.staffing.caregiverResidentRatio = providedField(
    { caregiverCount: 4, residentCount: 20 },
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'staffing.caregiverResidentRatio',
    record.staffing.caregiverResidentRatio,
    { valueType: 'caregiver_resident_ratio', value: { caregiverCount: 4, residentCount: 20 } },
  )
  record.price.adjustmentFactors = providedField(
    [{ factor: 'care_level', note: 'Synthetic factor' }],
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'price.adjustmentFactors',
    record.price.adjustmentFactors,
    { valueType: 'price_adjustment_factor_list', value: [{ factor: 'care_level', note: 'Synthetic factor' }] },
  )
  record.operations.estimatedWait = providedField(
    { minDays: 2, maxDays: 7 },
    unverified(),
  )
  addVerifiedCompoundEvidence(
    record,
    'operations.estimatedWait',
    record.operations.estimatedWait,
    { valueType: 'estimated_wait_range', value: { minDays: 2, maxDays: 7 } },
  )
  return record
})()

export const invalidInstitutionFixtures = Object.freeze([
  {
    id: 'INVALID_INSTITUTION_ID',
    expectedCodes: ['INVALID_INSTITUTION_ID'],
    record: mutate(fixtureA, (record) => { record.institutionId = 'not a stable id' }),
  },
  {
    id: 'INVALID_RECORD_REVISION',
    expectedCodes: ['INVALID_RECORD_REVISION'],
    record: mutate(fixtureA, (record) => { record.recordRevision = 0 }),
  },
  {
    id: 'INVALID_RECORD_REVISION_FRACTION',
    expectedCodes: ['INVALID_RECORD_REVISION'],
    record: mutate(fixtureA, (record) => { record.recordRevision = 1.5 }),
  },
  {
    id: 'INVALID_REGION_CODE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.identity.regionCode.value = '武汉市' }),
  },
  {
    id: 'INVALID_SUPPORTED_TYPE_CODE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.typeProfile.supportedTypes.value[0] = 'unknown_type' }),
  },
  {
    id: 'INVALID_CAPABILITY_STATUS',
    expectedCodes: ['INVALID_CAPABILITY'],
    record: mutate(fixtureA, (record) => { record.capabilities.specialCare.night_care.status = 'not_a_status' }),
  },
  {
    id: 'INVALID_CARE_LEVEL_MATRIX_MISSING',
    expectedCodes: ['INVALID_CAPABILITY_MATRIX'],
    record: mutate(fixtureA, (record) => { delete record.capabilities.careLevelAcceptance.disabled }),
  },
  {
    id: 'INVALID_SPECIAL_CARE_MATRIX_EXTRA',
    expectedCodes: ['INVALID_CAPABILITY_MATRIX'],
    record: mutate(fixtureA, (record) => { record.capabilities.specialCare.extra_capability = record.capabilities.specialCare.night_care }),
  },
  {
    id: 'INVALID_SUPPORTED_TYPE_DUPLICATE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.typeProfile.supportedTypes.value.push('medical_nursing_integrated') }),
  },
  {
    id: 'INVALID_PRIMARY_TYPE_OUTSIDE_SUPPORTED_TYPES',
    expectedCodes: ['INVALID_TYPE_PROFILE'],
    record: mutate(fixtureA, (record) => { record.typeProfile.primaryType.value = 'dementia_care' }),
  },
  {
    id: 'INVALID_NEGATIVE_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = -1 }),
  },
  {
    id: 'INVALID_INFINITY_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = Infinity }),
  },
  {
    id: 'INVALID_ZERO_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = 0 }),
  },
  {
    id: 'INVALID_BOUNDED_PRICE_ORDER',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => {
      record.price.referenceMonthlyPrice.value.range.min.amountMinor = 900000
      record.price.referenceMonthlyPrice.value.range.max.amountMinor = 800000
    }),
  },
  {
    id: 'INVALID_STARTING_AT_PRICE_MAX',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => {
      record.price.referenceMonthlyPrice.value.range.kind = 'starting_at'
      record.price.referenceMonthlyPrice.value.range.max = { amountMinor: 900000, currency: 'CNY' }
    }),
  },
  {
    id: 'INVALID_PRICE_PERIOD',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.period = 'one_time' }),
  },
  {
    id: 'INVALID_NAN_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = NaN }),
  },
  {
    id: 'INVALID_FRACTIONAL_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = 650000.5 }),
  },
  {
    id: 'INVALID_UNSAFE_INTEGER_PRICE',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.amountMinor = 9007199254740992 }),
  },
  {
    id: 'INVALID_PRICE_CURRENCY',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.price.referenceMonthlyPrice.value.range.min.currency = 'USD' }),
  },
  {
    id: 'INVALID_UNKNOWN_PRICE_NON_NULL',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureD, (record) => { record.price.referenceMonthlyPrice.value = { basis: 'reference_total' } }),
  },
  {
    id: 'INVALID_AVAILABILITY_AS_OF',
    expectedCodes: ['INVALID_AVAILABILITY'],
    record: mutate(fixtureA, (record) => { record.operations.bedAvailability.asOf = 'not-an-iso-time' }),
  },
  {
    id: 'INVALID_EVIDENCE_REVISION',
    expectedCodes: ['EVIDENCE_REVISION_MISMATCH'],
    record: mutate(fixtureA, (record) => { record.evidence[0].recordRevision = 2 }),
  },
  {
    id: 'INVALID_EVIDENCE_STATUS',
    expectedCodes: ['INVALID_EVIDENCE', 'EVIDENCE_STATUS_MISMATCH'],
    record: mutate(fixtureA, (record) => { record.evidence[0].verificationStatus = 'expired'; record.evidence[0].validUntil = INSTITUTION_FIXTURE_VALID_UNTIL }),
  },
  {
    id: 'INVALID_EVIDENCE_VALUE',
    expectedCodes: ['EVIDENCE_VALUE_MISMATCH'],
    record: mutate(fixtureA, (record) => { record.evidence[0].valueSnapshot.value = ['active_aging'] }),
  },
  {
    id: 'INVALID_EVIDENCE_NONCRITICAL_VALUE',
    expectedCodes: ['EVIDENCE_VALUE_MISMATCH'],
    record: mutate(fixtureA, (record) => {
      const evidenceId = 'ev-a-mock-identity-name'
      record.identity.name.verification = {
        status: 'verified',
        evidenceIds: [evidenceId],
        verifiedAt: INSTITUTION_FIXTURE_AS_OF,
        validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
      }
      record.evidence.push({
        evidenceId,
        institutionId: record.institutionId,
        recordRevision: record.recordRevision,
        fieldPath: 'identity.name',
        valueSnapshot: { valueType: 'stable_code', value: 'Institution A Mock' },
        observedAt: INSTITUTION_FIXTURE_AS_OF,
        sourceType: 'official_document',
        sourceNote: `${TEST_SYNTHETIC_VERIFIED}; ${NOT_REAL_INSTITUTION_DATA}`,
        verificationStatus: 'verified',
        verifiedAt: INSTITUTION_FIXTURE_AS_OF,
        validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
      })
    }),
  },
  {
    id: 'INVALID_EVIDENCE_VERIFIED_AT_MISMATCH',
    expectedCodes: ['EVIDENCE_VERIFICATION_MISMATCH'],
    record: mutate(fixtureA, (record) => { record.evidence[0].verifiedAt = '2026-08-29T09:00:00.000Z' }),
  },
  {
    id: 'INVALID_EVIDENCE_VALID_UNTIL_MISMATCH',
    expectedCodes: ['EVIDENCE_VERIFICATION_MISMATCH'],
    record: mutate(fixtureA, (record) => { record.evidence[0].validUntil = '2027-08-29T09:00:00.000Z' }),
  },
  {
    id: 'INVALID_EVIDENCE_SOURCE',
    expectedCodes: ['INVALID_EVIDENCE'],
    record: mutate(fixtureA, (record) => { delete record.evidence[0].sourceReference; record.evidence[0].sourceNote = '' }),
  },
  {
    id: 'INVALID_EVIDENCE_FIELD_PATH',
    expectedCodes: ['INVALID_EVIDENCE'],
    record: mutate(fixtureA, (record) => { record.evidence[0].fieldPath = 'identity.notAField' }),
  },
  {
    id: 'INVALID_EVIDENCE_SNAPSHOT_DISCRIMINATOR',
    expectedCodes: ['INVALID_EVIDENCE'],
    record: mutate(fixtureA, (record) => { record.evidence[0].valueSnapshot = { valueType: 'not_a_snapshot', value: 'synthetic' } }),
  },
  {
    id: 'INVALID_EVIDENCE_ISO_TIMESTAMP',
    expectedCodes: ['INVALID_EVIDENCE'],
    record: mutate(fixtureA, (record) => { record.evidence[0].observedAt = '2026-02-30T09:00:00.000Z' }),
  },
  {
    id: 'INVALID_EVIDENCE_SOURCE_REFERENCE_TYPE',
    expectedCodes: ['INVALID_EVIDENCE'],
    record: mutate(fixtureA, (record) => {
      record.evidence[0].sourceReference = 42
      record.evidence[0].sourceNote = 'synthetic source note remains present'
    }),
  },
  {
    id: 'INVALID_VR_MISSING_SCENES',
    expectedCodes: ['INVALID_VR'],
    record: mutate(fixtureA, (record) => { record.vr.scenes = [] }),
  },
  {
    id: 'INVALID_VR_BROKEN_MEDIA',
    expectedCodes: ['BROKEN_REFERENCE'],
    record: mutate(fixtureA, (record) => { record.vr.coverMediaId.value = 'missing-media' }),
  },
  {
    id: 'INVALID_VR_DUPLICATE_SCENE',
    expectedCodes: ['INVALID_VR'],
    record: mutate(fixtureA, (record) => { record.vr.scenes.push(deepClone(record.vr.scenes[0])) }),
  },
  {
    id: 'INVALID_MEDIA_URL_NO_HOST',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.media[0].url.value = 'https://?' }),
  },
  {
    id: 'INVALID_MEDIA_URL_CREDENTIALS',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.media[0].url.value = 'https://user:pass@mock.example.com/image.jpg' }),
  },
  {
    id: 'INVALID_MEDIA_URL_PORT',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => { record.media[0].url.value = 'https://mock.example.com:99999/image.jpg' }),
  },
  {
    id: 'INVALID_VR_UNAVAILABLE_WITH_SCENE',
    expectedCodes: ['INVALID_VR'],
    record: mutate(fixtureA, (record) => {
      record.vr.status = 'unavailable'
      record.vr.url = null
      record.vr.coverMediaId = null
    }),
  },
  {
    id: 'INVALID_IDENTITY_COVER_GALLERY',
    expectedCodes: ['BROKEN_REFERENCE'],
    record: mutate(fixtureA, (record) => { record.media[0].role = 'gallery' }),
  },
  {
    id: 'INVALID_QUALIFICATION_EXPIRY',
    expectedCodes: ['INVALID_QUALIFICATION'],
    record: mutate(fixtureA, (record) => {
      record.qualifications[0].validity = 'expired'
      record.qualifications[0].validUntil = unknownField()
    }),
  },
  {
    id: 'INVALID_QUALIFICATION_DATE_ORDER',
    expectedCodes: ['INVALID_QUALIFICATION'],
    record: mutate(fixtureA, (record) => {
      record.qualifications[0].validFrom = providedField('2024-01-01')
      record.qualifications[0].validUntil = providedField('2023-12-31')
    }),
  },
  {
    id: 'INVALID_ACCEPTING_RESIDENTS_WITHOUT_AS_OF',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => {
      record.operations.acceptingNewResidents = { availability: 'provided', value: 'yes', verification: unverified() }
    }),
  },
  {
    id: 'INVALID_ESTIMATED_WAIT_WITHOUT_AS_OF',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => {
      record.operations.estimatedWait = {
        availability: 'provided',
        value: { minDays: 1, maxDays: 2 },
        verification: unverified(),
      }
    }),
  },
  {
    id: 'INVALID_EARLIEST_MOVE_IN_WITHOUT_AS_OF',
    expectedCodes: ['INVALID_FIELD'],
    record: mutate(fixtureA, (record) => {
      record.operations.earliestMoveInDate = {
        availability: 'provided',
        value: '2027-01-01',
        verification: unverified(),
      }
    }),
  },
])

export const cloneInstitutionRecord = deepClone
