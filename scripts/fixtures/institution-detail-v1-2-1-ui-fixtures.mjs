/**
 * Test-only V1.2.1 Detail presentation fixtures.
 *
 * These values are intentionally synthetic.  They must never be added to the
 * live catalog or used as production institution facts.
 */

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const fact = (value, effectiveVerification = 'current_verified', availability = 'provided') => ({
  availability,
  value,
  effectiveVerification,
})

const unknownFact = () => fact(null, 'unverified', 'unknown')

const unavailableFact = () => fact(null, 'unverified', 'unavailable')

const blankCare = (status = 'unknown', makeFact = unknownFact) => ({
  status,
  careRecord: {
    presence: makeFact(),
    completeness: makeFact(),
    frequency: makeFact(),
    traceability: makeFact(),
  },
  shiftHandover24h: {
    presence: makeFact(),
    contents: {
      vital_signs: makeFact(),
      abnormal_events: makeFact(),
      interventions_recorded: makeFact(),
      follow_up: makeFact(),
      family_communication: makeFact(),
      medical_transfer: makeFact(),
    },
  },
})

const blankFuture = () => ({
  publicIntroduction: {
    status: 'hidden_no_current_head',
    contentRevision: null,
    text: null,
    sourceType: null,
    updatedAt: null,
  },
  officialContact: {
    status: 'unknown',
    directory: unknownFact(),
    phones: [],
  },
  officialAddress: {
    status: 'unknown',
    formattedAddress: null,
    effectiveVerification: 'unverified',
  },
  mapLocation: {
    status: 'address_unknown',
    institutionName: '测试机构',
    formattedAddress: null,
    latitude: null,
    longitude: null,
    coordinateSystem: null,
    addressVerification: null,
    geoVerification: null,
    mapActionAvailable: false,
  },
  careProcess: blankCare(),
})

const intro = () => ({
  status: 'ready',
  contentRevision: 7,
  text: '这是仅用于 Detail UI 测试的机构简介。\n换行内容仍保持为普通文本。',
  sourceType: 'institution_supplied',
  updatedAt: '2026-09-01T00:00:00.000Z',
})

const address = (verification = 'current_verified') => ({
  status: 'provided',
  formattedAddress: '湖北省武汉市武昌区测试路 1 号',
  effectiveVerification: verification,
})

const readyMap = () => ({
  status: 'available',
  institutionName: '测试机构 · 地图 Ready',
  formattedAddress: '湖北省武汉市武昌区测试路 1 号',
  latitude: 30.521234,
  longitude: 114.356789,
  coordinateSystem: 'gcj02',
  addressVerification: 'current_verified',
  geoVerification: 'current_verified',
  mapActionAvailable: true,
})

const phone = ({
  key,
  purpose,
  displayValue,
  dialValue,
  status,
  verifiedDate = null,
  callActionAvailable = status === 'current_verified',
}) => ({
  officialPhoneKey: key,
  purpose,
  displayValue,
  dialValue,
  extension: null,
  status,
  verifiedDate,
  callActionAvailable,
})

const phoneDirectory = (phones) => ({
  status: 'provided',
  directory: fact('present'),
  phones,
})

const fullCare = () => ({
  status: 'provided',
  careRecord: {
    presence: fact('present'),
    completeness: fact('complete'),
    frequency: fact(['per_shift', 'daily']),
    traceability: fact('traceable'),
  },
  shiftHandover24h: {
    presence: fact('present'),
    contents: {
      vital_signs: fact('present'),
      abnormal_events: fact('present'),
      interventions_recorded: fact('present'),
      follow_up: fact('present'),
      family_communication: fact('present'),
      medical_transfer: fact('absent'),
    },
  },
})

const partialCare = () => ({
  status: 'provided',
  careRecord: {
    presence: fact('present'),
    completeness: unknownFact(),
    frequency: fact(['event_based']),
    traceability: unknownFact(),
  },
  shiftHandover24h: {
    presence: unknownFact(),
    contents: {
      vital_signs: fact('present'),
      abnormal_events: unknownFact(),
      interventions_recorded: fact('absent'),
      follow_up: unknownFact(),
      family_communication: unknownFact(),
      medical_transfer: unknownFact(),
    },
  },
})

const expiredCare = () => ({
  status: 'provided',
  careRecord: {
    presence: fact('present', 'expired'),
    completeness: fact('partial', 'expired'),
    frequency: fact(['daily'], 'expired'),
    traceability: fact('traceable', 'expired'),
  },
  shiftHandover24h: {
    presence: fact('present', 'expired'),
    contents: {
      vital_signs: fact('present', 'expired'),
      abnormal_events: fact('present', 'expired'),
      interventions_recorded: fact('present', 'expired'),
      follow_up: fact('present', 'expired'),
      family_communication: fact('present', 'expired'),
      medical_transfer: fact('absent', 'expired'),
    },
  },
})

export const createDetailUiFutureFixtures = () => {
  const allUnknown = blankFuture()

  const mapReady = blankFuture()
  mapReady.publicIntroduction = intro()
  mapReady.officialAddress = address()
  mapReady.mapLocation = readyMap()

  const addressReadyGeoUnknown = blankFuture()
  addressReadyGeoUnknown.officialAddress = address()
  addressReadyGeoUnknown.mapLocation = {
    status: 'geo_unknown',
    institutionName: '测试机构 · 地图待确认',
    formattedAddress: '湖北省武汉市武昌区测试路 1 号',
    latitude: null,
    longitude: null,
    coordinateSystem: null,
    addressVerification: 'current_verified',
    geoVerification: 'unverified',
    mapActionAvailable: false,
  }

  const verifiedPhone = blankFuture()
  verifiedPhone.officialContact = phoneDirectory([
    phone({
      key: 'test-main',
      purpose: 'main',
      displayValue: '027-88886666',
      dialValue: '02788886666',
      status: 'current_verified',
      verifiedDate: '2026-09-02',
    }),
  ])

  const multiplePhones = blankFuture()
  multiplePhones.officialContact = phoneDirectory([
    phone({ key: 'test-main', purpose: 'main', displayValue: '027-88886666', dialValue: '02788886666', status: 'current_verified' }),
    phone({ key: 'test-admission', purpose: 'admission_consultation', displayValue: '027-77775555', dialValue: '02777775555', status: 'current_verified' }),
    phone({ key: 'test-service', purpose: 'service', displayValue: '027-66664444', dialValue: '02766664444', status: 'current_verified' }),
    phone({ key: 'test-other', purpose: 'other', displayValue: '027-55553333', dialValue: '02755553333', status: 'current_verified' }),
  ])

  const unverifiedPhone = blankFuture()
  unverifiedPhone.officialContact = phoneDirectory([
    phone({
      key: 'test-unverified',
      purpose: 'main',
      displayValue: '027-11112222',
      dialValue: '02711112222',
      status: 'unverified_with_source',
      callActionAvailable: false,
    }),
  ])

  const expiredPhone = blankFuture()
  expiredPhone.officialContact = phoneDirectory([
    phone({
      key: 'test-expired',
      purpose: 'main',
      displayValue: null,
      dialValue: null,
      status: 'expired',
      verifiedDate: '2025-01-01',
      callActionAvailable: false,
    }),
  ])

  const unknownPhone = blankFuture()
  unknownPhone.officialContact = phoneDirectory([
    phone({
      key: 'test-unknown',
      purpose: 'main',
      displayValue: null,
      dialValue: null,
      status: 'unverified_without_source',
      callActionAvailable: false,
    }),
  ])

  const fullCareFixture = blankFuture()
  fullCareFixture.careProcess = fullCare()

  const partialCareFixture = blankFuture()
  partialCareFixture.careProcess = partialCare()

  const expiredCareFixture = blankFuture()
  expiredCareFixture.careProcess = expiredCare()

  const unverifiedAbsentCare = blankFuture()
  unverifiedAbsentCare.careProcess.status = 'provided'
  unverifiedAbsentCare.careProcess.careRecord.presence = fact('absent', 'unverified')

  const unavailable = blankFuture()
  unavailable.officialContact = {
    status: 'unavailable',
    directory: unavailableFact(),
    phones: [],
  }
  unavailable.officialAddress = {
    status: 'unavailable',
    formattedAddress: null,
    effectiveVerification: 'unverified',
  }
  unavailable.mapLocation = {
    status: 'unavailable',
    institutionName: '',
    formattedAddress: null,
    latitude: null,
    longitude: null,
    coordinateSystem: null,
    addressVerification: null,
    geoVerification: null,
    mapActionAvailable: false,
  }
  unavailable.careProcess = blankCare('unavailable', unavailableFact)

  return {
    allUnknown,
    mapReady,
    addressReadyGeoUnknown,
    verifiedPhone,
    multiplePhones,
    unverifiedPhone,
    expiredPhone,
    unknownPhone,
    fullCare: fullCareFixture,
    partialCare: partialCareFixture,
    expiredCare: expiredCareFixture,
    unverifiedAbsentCare,
    unavailable,
  }
}

export const createDetailUiSnapshot = (baseSnapshot, future, options = {}) => {
  const snapshot = clone(baseSnapshot)
  snapshot.sourceContractVersion = 'institution-contract-v1.2.1'
  snapshot.sections.careProcess = { state: 'available_for_schema' }
  snapshot.sections.futureV121 = clone(future)
  if (Object.prototype.hasOwnProperty.call(options, 'sourceContractVersion')) {
    snapshot.sourceContractVersion = options.sourceContractVersion
  }
  if (Object.prototype.hasOwnProperty.call(options, 'careProcessState')) {
    snapshot.sections.careProcess = { state: options.careProcessState }
  }
  if (Object.prototype.hasOwnProperty.call(options, 'contextKind')) {
    snapshot.contextKind = options.contextKind
  }
  if (Object.prototype.hasOwnProperty.call(options, 'recommendationContext')) {
    snapshot.recommendationContext = clone(options.recommendationContext)
  }
  return snapshot
}

export const makePinnedRecommendationContext = () => ({
  group: 'cards',
  order: 0,
  tier: 'EXACT',
  reasons: [{ code: 'MEAL_SCHEDULE_MATCH', reference: 'meal_schedule' }],
  differences: [{ code: 'MODIFIED_FOOD_SUPPORT_UNKNOWN', reference: 'nutrition' }],
})
