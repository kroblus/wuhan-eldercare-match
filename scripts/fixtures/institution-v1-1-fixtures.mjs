/**
 * Institution Contract V1.1 runtime fixtures.
 *
 * This module is test-only. Every record is synthetic and intentionally
 * labelled as development data; it must never be imported by app code.
 */
import {
  cloneInstitutionRecord,
  institutionFixtures,
} from './institution-fixtures.mjs'

export const INSTITUTION_V11_FIXTURE_POLICY = 'TEST_FIXTURE_ONLY'
export const INSTITUTION_V11_DATA_PROVENANCE = 'MOCK_DEVELOPMENT_ONLY'
export const INSTITUTION_V11_DATA_LABEL = 'NOT_REAL_INSTITUTION_DATA'
export const INSTITUTION_V11_SYNTHETIC_VERIFICATION = 'TEST_SYNTHETIC_VERIFICATION'
export const INSTITUTION_V11_AS_OF = '2026-08-30T09:00:00.000Z'
export const INSTITUTION_V11_VALID_UNTIL = '2027-08-30T09:00:00.000Z'
export const INSTITUTION_V11_EVALUATION_AS_OF = '2026-08-31T09:00:00.000Z'

const V1_CAPABILITY_CODES = Object.freeze({
  careLevelAcceptance: Object.freeze([
    'independent', 'light_care', 'semi_disabled', 'disabled', 'severely_disabled',
  ]),
  mobilitySupport: Object.freeze([
    'wheelchair_support', 'bedbound_support', 'transfer_support',
  ]),
  cognitiveSupport: Object.freeze([
    'dementia_acceptance', 'wandering_risk_support',
  ]),
  specialCare: Object.freeze([
    'round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit',
    'rehabilitation_training', 'tube_feeding', 'catheter_care',
    'pressure_injury_care', 'incontinence_care',
  ]),
})

const V11_FIXTURE_IDS = Object.freeze([
  'INST-V11-001', 'INST-V11-002', 'INST-V11-003', 'INST-V11-004', 'INST-V11-005',
  'INST-V11-006', 'INST-V11-007', 'INST-V11-008', 'INST-V11-009', 'INST-V11-010',
  'INST-V11-011', 'INST-V11-012', 'INST-V11-013', 'INST-V11-014', 'INST-V11-015',
  'INST-V11-016', 'INST-V11-017', 'INST-V11-018', 'INST-V11-019', 'INST-V11-020',
])

const slug = (value) => String(value).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()

const unknownField = () => ({
  availability: 'unknown',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

const unavailableField = () => ({
  availability: 'unavailable',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

const setAt = (root, dottedPath, value) => {
  const parts = dottedPath.split('.')
  let cursor = root
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor[part]
  })
  cursor[parts[parts.length - 1]] = value
}

const remapEvidenceReferences = (value, evidenceIdMap) => {
  if (Array.isArray(value)) {
    value.forEach((item) => remapEvidenceReferences(item, evidenceIdMap))
    return
  }
  if (value === null || typeof value !== 'object') {
    return
  }
  Object.keys(value).forEach((key) => {
    if (key === 'evidenceIds' && Array.isArray(value[key])) {
      value[key] = value[key].map((id) => evidenceIdMap.get(id) || id)
    } else {
      remapEvidenceReferences(value[key], evidenceIdMap)
    }
  })
}

const makeBaseRecord = (fixtureId) => {
  const record = cloneInstitutionRecord(institutionFixtures[0].record)
  const oldInstitutionId = record.institutionId
  const institutionId = `institution-v11-${fixtureId.slice(-3).toLowerCase()}-mock`
  const evidenceIdMap = new Map()

  record.institutionId = institutionId
  record.contractVersion = 'institution-contract-v1.1'
  record.capabilityContractVersion = 'institution-capability-contract-v1'
  record.recordProvenance = INSTITUTION_V11_DATA_PROVENANCE
  record.identity.name.value = `示例机构 ${fixtureId.slice(-3)}（Mock）`
  record.identity.regionDisplayName.value = `开发示例区域 ${fixtureId.slice(-3)}（Mock）`

  record.evidence = record.evidence.map((evidence, index) => {
    const remappedId = `ev-${slug(fixtureId)}-${index + 1}`
    evidenceIdMap.set(evidence.evidenceId, remappedId)
    return {
      ...evidence,
      evidenceId: remappedId,
      institutionId,
    }
  })
  remapEvidenceReferences(record, evidenceIdMap)

  // V1.1 development fixtures must never imply real VR availability.
  record.vr = {
    status: 'unknown',
    url: null,
    coverMediaId: null,
    scenes: [],
    verification: { status: 'unverified', evidenceIds: [] },
  }

  const extensionFeatures = {
    electricCurtain: unknownField(),
    refrigerator: unknownField(),
    bedsideTableOrFoldBoard: unknownField(),
    wheelchairOrAssistiveEquipment: unknownField(),
    smartSpeakerOrRadio: unknownField(),
    magnifier: unknownField(),
    calligraphyOrPersonalItems: unknownField(),
  }
  record.rooms = record.rooms.map((room) => ({
    ...room,
    features: { ...room.features, ...extensionFeatures },
  }))

  record.staffing = {
    ...record.staffing,
    caregiverCertification: {
      certifiedCaregiverCount: unknownField(),
      observedCaregiverCount: unknownField(),
      certifiedRatioBasisPoints: unknownField(),
      certificateTypes: unknownField(),
      rawStatement: unknownField(),
    },
    caregiverExperienceDistribution: {
      less_than_one_year: unknownField(),
      one_to_three_years: unknownField(),
      three_to_five_years: unknownField(),
      five_years_or_more: unknownField(),
    },
    caregiverExperienceStatement: unknownField(),
    nurseResponseTime: makeResponseTime(),
    caregiverResponseTime: makeResponseTime(),
    dutyStaffing24h: {
      availability: unknownField(),
      staffedRoles: unknownField(),
      coverageNote: unknownField(),
    },
  }
  record.medicalSupport = {
    ...record.medicalSupport,
    clinic: unknownField(),
    relationships: [],
    medicalDuty24h: unknownField(),
    medicalDuty24hNote: unknownField(),
  }
  record.healthMonitoring = {
    bloodPressure: makeMonitoringItem(),
    bloodOxygen: makeMonitoringItem(),
    bloodGlucose: makeMonitoringItem(),
  }
  record.meal = {
    mealSchedule: unknownField(),
    easyChewSupport: unknownField(),
    modifiedFoodSupport: unknownField(),
    mealFee: unknownField(),
    specialDietExtraFee: unknownField(),
    serviceNote: unknownField(),
  }
  record.activity = {
    indoorSpace: unknownField(),
    outdoorSpace: unknownField(),
    offerings: [],
    zones: {
      publicActivityZone: unknownField(),
      activeAgingZone: unknownField(),
      careZone: unknownField(),
      dementiaZone: unknownField(),
    },
  }
  record.transportation = {
    metro: {
      nearestStationName: unknownField(),
      distanceMeters: unknownField(),
      routeNote: unknownField(),
    },
    busStops: [],
    vehicleAccess: {
      availability: unknownField(),
      accessNote: unknownField(),
    },
  }
  record.majorHospitalAccess = []

  // Keep the inherited V1 record evidence internally consistent after the ID
  // rewrite. The old ID is intentionally referenced to document the boundary.
  void oldInstitutionId
  return record
}

const makeResponseTime = () => ({
  responseTimeMinutes: unknownField(),
  scenario: unknownField(),
  statistic: unknownField(),
  measurementNote: unknownField(),
})

const makeMonitoringItem = () => ({
  availability: unknownField(),
  frequency: unknownField(),
  serviceNote: unknownField(),
})

const makeEvidenceField = (record, fieldPath, value, valueType) => {
  // Evidence IDs use a short per-record sequence so long nested field paths
  // remain valid stable identifiers under the frozen V1 length constraint.
  const evidenceId = `ev-${slug(record.institutionId)}-${record.evidence.length + 1}`
  const verification = {
    status: 'verified',
    evidenceIds: [evidenceId],
    verifiedAt: INSTITUTION_V11_AS_OF,
    validUntil: INSTITUTION_V11_VALID_UNTIL,
  }
  record.evidence.push({
    evidenceId,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath,
    valueSnapshot: { valueType, value },
    observedAt: INSTITUTION_V11_AS_OF,
    sourceType: 'official_document',
    sourceNote: `${INSTITUTION_V11_SYNTHETIC_VERIFICATION}; ${INSTITUTION_V11_DATA_LABEL}`,
    verificationStatus: 'verified',
    verifiedAt: INSTITUTION_V11_AS_OF,
    validUntil: INSTITUTION_V11_VALID_UNTIL,
  })
  return {
    availability: 'provided',
    value,
    asOf: INSTITUTION_V11_AS_OF,
    verification,
  }
}

const setSyntheticField = (record, fieldPath, value, valueType) => {
  setAt(record, fieldPath, makeEvidenceField(record, fieldPath, value, valueType))
}

const monthlyRange = (min, max = null) => ({
  kind: max === null ? 'starting_at' : 'bounded',
  min: { amountMinor: min, currency: 'CNY' },
  max: max === null ? null : { amountMinor: max, currency: 'CNY' },
  period: 'month',
})

const oneTimeRange = (min, max = null) => ({
  kind: max === null ? 'starting_at' : 'bounded',
  min: { amountMinor: min, currency: 'CNY' },
  max: max === null ? null : { amountMinor: max, currency: 'CNY' },
  period: 'one_time',
})

const makeMealScheduleFixture = (fixtureId, schedule) => {
  const record = makeBaseRecord(fixtureId)
  setSyntheticField(record, 'meal.mealSchedule', schedule, 'stable_code')
  return record
}

const makeFixture = (id, category, record, expectedValid = true, expectedCodes = []) => ({
  id,
  category,
  record,
  expectedValid,
  expectedCodes: Object.freeze(expectedCodes),
  labels: Object.freeze({
    fixturePolicy: INSTITUTION_V11_FIXTURE_POLICY,
    dataProvenance: INSTITUTION_V11_DATA_PROVENANCE,
    data: INSTITUTION_V11_DATA_LABEL,
  }),
})

const staffingComplete = () => {
  const record = makeBaseRecord('INST-V11-002')
  setSyntheticField(record, 'staffing.counts', [
    { role: 'caregiver', count: 12 },
    { role: 'nurse', count: 3 },
    { role: 'doctor', count: 1 },
    { role: 'rehabilitation_therapist', count: 2 },
  ], 'staff_count_list')
  setSyntheticField(record, 'staffing.caregiverResidentRatio', { caregiverCount: 3, residentCount: 12 }, 'caregiver_resident_ratio')
  setSyntheticField(record, 'staffing.caregiverCertification.certifiedCaregiverCount', 10, 'integer')
  setSyntheticField(record, 'staffing.caregiverCertification.observedCaregiverCount', 12, 'integer')
  setSyntheticField(record, 'staffing.caregiverCertification.certifiedRatioBasisPoints', 8333, 'integer')
  setSyntheticField(record, 'staffing.caregiverCertification.certificateTypes', ['eldercare_caregiver_certificate'], 'stable_code_list')
  setSyntheticField(record, 'staffing.caregiverExperienceDistribution.one_to_three_years', 4, 'integer')
  setSyntheticField(record, 'staffing.caregiverExperienceDistribution.three_to_five_years', 5, 'integer')
  setSyntheticField(record, 'staffing.caregiverExperienceDistribution.five_years_or_more', 3, 'integer')
  setSyntheticField(record, 'staffing.caregiverExperienceStatement', 'TEST synthetic documented distribution', 'text')
  setSyntheticField(record, 'staffing.nurseResponseTime.responseTimeMinutes', 12, 'integer')
  setSyntheticField(record, 'staffing.nurseResponseTime.scenario', 'resident_call_to_nurse_arrival', 'stable_code')
  setSyntheticField(record, 'staffing.nurseResponseTime.statistic', 'documented_median', 'stable_code')
  setSyntheticField(record, 'staffing.nurseResponseTime.measurementNote', 'TEST synthetic roster observation', 'text')
  setSyntheticField(record, 'staffing.dutyStaffing24h.availability', 'available', 'stable_code')
  setSyntheticField(record, 'staffing.dutyStaffing24h.staffedRoles', ['caregiver', 'nurse'], 'stable_code_list')
  setSyntheticField(record, 'staffing.dutyStaffing24h.coverageNote', 'TEST synthetic coverage fact', 'text')
  return record
}

const medicalConfiguration = () => {
  const record = makeBaseRecord('INST-V11-004')
  setSyntheticField(record, 'medicalSupport.clinic', 'present', 'stable_code')
  setSyntheticField(record, 'medicalSupport.medicalDuty24h', 'requires_inquiry', 'stable_code')
  setSyntheticField(record, 'medicalSupport.medicalDuty24hNote', 'TEST synthetic duty fact', 'text')
  record.medicalSupport.relationships = [{
    relationshipId: 'relationship-v11-004-chc',
    relationshipType: makeEvidenceField(record, 'medicalSupport.relationships.0.relationshipType', 'community_health_center', 'stable_code'),
    organizationName: makeEvidenceField(record, 'medicalSupport.relationships.0.organizationName', '测试社区卫生服务中心', 'text'),
    relationshipNote: makeEvidenceField(record, 'medicalSupport.relationships.0.relationshipNote', 'TEST synthetic relationship', 'text'),
  }]
  return record
}

const healthMonitoring = () => {
  const record = makeBaseRecord('INST-V11-005')
  ;[['bloodPressure', 'daily'], ['bloodOxygen', 'weekly'], ['bloodGlucose', 'on_demand']].forEach(([item, frequency]) => {
    setSyntheticField(record, `healthMonitoring.${item}.availability`, 'available', 'stable_code')
    setSyntheticField(record, `healthMonitoring.${item}.frequency`, frequency, 'stable_code')
    setSyntheticField(record, `healthMonitoring.${item}.serviceNote`, 'TEST synthetic frequency fact', 'text')
  })
  return record
}

const roomFacilities = () => {
  const record = makeBaseRecord('INST-V11-006')
  const fields = [
    ['electricCurtain', 'present'], ['refrigerator', 'absent'],
    ['bedsideTableOrFoldBoard', 'present'], ['wheelchairOrAssistiveEquipment', 'present'],
    ['smartSpeakerOrRadio', 'unknown'], ['magnifier', 'present'],
    ['calligraphyOrPersonalItems', 'present'],
  ]
  fields.forEach(([field, value]) => {
    if (value === 'unknown') {
      return
    }
    setSyntheticField(record, `rooms.0.features.${field}`, value, 'stable_code')
  })
  return record
}

const mealSupport = (fixtureId, field, value) => {
  const record = makeBaseRecord(fixtureId)
  setSyntheticField(record, `meal.${field}`, value, 'stable_code')
  return record
}

const activityFacts = () => {
  const record = makeBaseRecord('INST-V11-012')
  setSyntheticField(record, 'activity.indoorSpace', 'present', 'stable_code')
  setSyntheticField(record, 'activity.outdoorSpace', 'present', 'stable_code')
  record.activity.offerings = [
    {
      activityId: 'activity-v11-012-dance',
      code: 'dance',
      availability: makeEvidenceField(record, 'activity.offerings.0.availability', 'available', 'stable_code'),
      scheduleNote: makeEvidenceField(record, 'activity.offerings.0.scheduleNote', 'TEST synthetic weekly activity', 'text'),
    },
    {
      activityId: 'activity-v11-012-music',
      code: 'music',
      availability: makeEvidenceField(record, 'activity.offerings.1.availability', 'requires_inquiry', 'stable_code'),
      scheduleNote: makeEvidenceField(record, 'activity.offerings.1.scheduleNote', 'TEST synthetic schedule', 'text'),
    },
  ]
  setSyntheticField(record, 'activity.zones.publicActivityZone', 'present', 'stable_code')
  setSyntheticField(record, 'activity.zones.activeAgingZone', 'present', 'stable_code')
  setSyntheticField(record, 'activity.zones.careZone', 'present', 'stable_code')
  setSyntheticField(record, 'activity.zones.dementiaZone', 'present', 'stable_code')
  return record
}

const transportFacts = () => {
  const record = makeBaseRecord('INST-V11-013')
  setSyntheticField(record, 'transportation.metro.nearestStationName', '测试地铁站', 'text')
  setSyntheticField(record, 'transportation.metro.distanceMeters', 850, 'integer')
  setSyntheticField(record, 'transportation.metro.routeNote', 'TEST synthetic route', 'text')
  record.transportation.busStops = [{
    busStopId: 'bus-v11-013-a',
    stopName: makeEvidenceField(record, 'transportation.busStops.0.stopName', '测试公交站', 'text'),
    distanceMeters: makeEvidenceField(record, 'transportation.busStops.0.distanceMeters', 420, 'integer'),
    routeSummary: makeEvidenceField(record, 'transportation.busStops.0.routeSummary', 'TEST synthetic route', 'text'),
  }]
  setSyntheticField(record, 'transportation.vehicleAccess.availability', 'available', 'stable_code')
  setSyntheticField(record, 'transportation.vehicleAccess.accessNote', 'TEST synthetic vehicle access', 'text')
  return record
}

const majorHospital = () => {
  const record = makeBaseRecord('INST-V11-014')
  record.majorHospitalAccess = [{
    hospitalAccessId: 'hospital-v11-014-a',
    hospitalName: makeEvidenceField(record, 'majorHospitalAccess.0.hospitalName', '测试三甲医院', 'text'),
    hospitalCategory: makeEvidenceField(record, 'majorHospitalAccess.0.hospitalCategory', 'tertiary_grade_a', 'stable_code'),
    distanceMeters: makeEvidenceField(record, 'majorHospitalAccess.0.distanceMeters', 3200, 'integer'),
    distanceMethod: makeEvidenceField(record, 'majorHospitalAccess.0.distanceMethod', 'road_route', 'stable_code'),
    distanceSource: makeEvidenceField(record, 'majorHospitalAccess.0.distanceSource', 'TEST synthetic route source', 'text'),
    travelTimeMinutes: makeEvidenceField(record, 'majorHospitalAccess.0.travelTimeMinutes', 15, 'integer'),
    travelMode: makeEvidenceField(record, 'majorHospitalAccess.0.travelMode', 'driving', 'stable_code'),
  }]
  return record
}

const priceBreakdown = () => {
  const record = makeBaseRecord('INST-V11-015')
  const components = [
    ['bed_fee', 280000], ['meal_fee', 90000], ['care_fee', 160000],
    ['management_fee', 30000], ['special_care_fee', 50000], ['other_fee', 10000],
  ]
  record.price.recurringComponents = components.map(([component, amount], index) => ({
    component,
    referenceAmount: makeEvidenceField(
      record,
      `price.recurringComponents.${index}.referenceAmount`,
      monthlyRange(amount, amount + 20000),
      'money_range',
    ),
  }))
  record.price.deposit = makeEvidenceField(record, 'price.deposit', oneTimeRange(100000, 200000), 'money_range')
  record.price.oneTimeFees = [{
    feeId: 'fee-v11-015-registration',
    label: 'TEST synthetic one-time fee',
    referenceAmount: makeEvidenceField(record, 'price.oneTimeFees.0.referenceAmount', oneTimeRange(10000, 20000), 'money_range'),
  }]
  return record
}

const unknownPrice = () => {
  const record = makeBaseRecord('INST-V11-016')
  record.price.referenceMonthlyPrice = unknownField()
  record.evidence = record.evidence.filter((entry) => entry.fieldPath !== 'price.referenceMonthlyPrice')
  record.price.recurringComponents = []
  record.price.deposit = unknownField()
  record.price.oneTimeFees = []
  return record
}

const invalidNegativeCount = () => {
  const record = makeBaseRecord('INST-V11-017')
  setSyntheticField(record, 'staffing.caregiverCertification.certifiedCaregiverCount', -1, 'integer')
  return record
}

const invalidNegativeDistance = () => {
  const record = makeBaseRecord('INST-V11-018')
  setSyntheticField(record, 'transportation.metro.distanceMeters', -1, 'integer')
  return record
}

const invalidMoney = () => {
  const record = makeBaseRecord('INST-V11-019')
  record.price.recurringComponents = [{
    component: 'bed_fee',
    referenceAmount: makeEvidenceField(record, 'price.recurringComponents.0.referenceAmount', monthlyRange(0, 20000), 'money_range'),
  }]
  return record
}

const capabilitySemantics = () => {
  const record = makeBaseRecord('INST-V11-020')
  return record
}

export const institutionV11Fixtures = Object.freeze([
  makeFixture('INST-V11-001', 'minimal valid extension', makeBaseRecord('INST-V11-001')),
  makeFixture('INST-V11-002', 'complete synthetic staffing', staffingComplete()),
  makeFixture('INST-V11-003', 'unknown staffing', makeBaseRecord('INST-V11-003')),
  makeFixture('INST-V11-004', 'medical configuration', medicalConfiguration()),
  makeFixture('INST-V11-005', 'health monitoring frequencies', healthMonitoring()),
  makeFixture('INST-V11-006', 'room extended facilities', roomFacilities()),
  makeFixture('INST-V11-007', 'meal schedule three meals', makeMealScheduleFixture('INST-V11-007', 'three_meals')),
  makeFixture('INST-V11-008', 'meal schedule three meals one snack', makeMealScheduleFixture('INST-V11-008', 'three_meals_one_snack')),
  makeFixture('INST-V11-009', 'meal schedule three meals two snacks', makeMealScheduleFixture('INST-V11-009', 'three_meals_two_snacks')),
  makeFixture('INST-V11-010', 'easy chew support', mealSupport('INST-V11-010', 'easyChewSupport', 'available')),
  makeFixture('INST-V11-011', 'modified food support', mealSupport('INST-V11-011', 'modifiedFoodSupport', 'available')),
  makeFixture('INST-V11-012', 'activity facts', activityFacts()),
  makeFixture('INST-V11-013', 'transport facts', transportFacts()),
  makeFixture('INST-V11-014', 'major hospital distance', majorHospital()),
  makeFixture('INST-V11-015', 'price component breakdown', priceBreakdown()),
  makeFixture('INST-V11-016', 'unknown price components', unknownPrice()),
  makeFixture('INST-V11-017', 'invalid negative count', invalidNegativeCount(), false, ['INVALID_V11_STAFFING']),
  makeFixture('INST-V11-018', 'invalid negative distance', invalidNegativeDistance(), false, ['INVALID_TRANSPORTATION_FACT']),
  makeFixture('INST-V11-019', 'invalid money', invalidMoney(), false, ['INVALID_PRICE', 'INVALID_FIELD']),
  makeFixture('INST-V11-020', 'V1 frozen capability semantics unchanged', capabilitySemantics()),
])

export const validInstitutionV11Fixtures = Object.freeze(
  institutionV11Fixtures.filter((fixture) => fixture.expectedValid),
)

export const invalidInstitutionV11Fixtures = Object.freeze(
  institutionV11Fixtures.filter((fixture) => !fixture.expectedValid),
)

/**
 * Anti-fake-green manifest. The runtime must assert this exact ID/category
 * inventory, reject the three negative fixtures, and inspect frozen V1
 * capability semantics independently of the V1.1 extension assertions.
 */
export const INSTITUTION_V11_FIXTURE_MANIFEST = Object.freeze({
  fixturePolicy: INSTITUTION_V11_FIXTURE_POLICY,
  dataProvenance: INSTITUTION_V11_DATA_PROVENANCE,
  dataLabel: INSTITUTION_V11_DATA_LABEL,
  expectedCount: 20,
  expectedIds: V11_FIXTURE_IDS,
  expectedInvalidIds: Object.freeze(['INST-V11-017', 'INST-V11-018', 'INST-V11-019']),
  capabilityPreservationFixtureId: 'INST-V11-020',
  expectedCategories: Object.freeze(institutionV11Fixtures.map((fixture) => fixture.category)),
  appImportBoundary: 'scripts/fixtures -> test-only; app source import count must remain zero',
})

export const V1_FROZEN_CAPABILITY_CODES = V1_CAPABILITY_CODES

export const cloneInstitutionV11Record = (record) => cloneInstitutionRecord(record)
