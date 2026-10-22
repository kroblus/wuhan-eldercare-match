import { makeV2Draft } from './assessment-v2-fixtures.mjs'

/**
 * Test-only inputs for Recommendation Result V2.  The catalog helpers clone
 * the validated development catalog supplied by the runtime script and add
 * only contract-shaped V1.1 facts.  They never become a production data
 * source.
 */
export const RESULT_V2_EVALUATION_AS_OF = '2026-09-08T12:00:00.000Z'
export const RESULT_V2_ALTERNATE_AS_OF = '2026-09-08T13:00:00.000Z'
export const RESULT_V2_FIXTURE_AS_OF = '2026-08-30T09:00:00.000Z'
export const RESULT_V2_FIXTURE_VALID_UNTIL = '2027-08-30T09:00:00.000Z'
export const RESULT_V2_SYNTHETIC_NOTE = 'TEST_SYNTHETIC_VERIFIED; NOT_REAL_INSTITUTION_DATA'

export const RESULT_V2_TARGET_IDS = Object.freeze([
  'institution-a-mock',
  'institution-b-mock',
  'institution-f-mock',
  'institution-h-mock',
])

export const makeResultV2UiDraft = (answerOverrides = {}, draftOverrides = {}) =>
  makeV2Draft({
    // Keep single-result UI scenarios ready unless the scenario explicitly
    // asks for an unresolved requirement. The generic assessment fixture's
    // rehabilitation clue is useful elsewhere but would mask result-card
    // semantics with a readiness clarification.
    'health.rehabilitationNeed': 'none',
    // The canonical mock pool intentionally leaves room and meal facts
    // unknown. Keep the baseline exact so each UI case can opt into the
    // room/meal comparator it is exercising.
    'preference.roomType': 'no_preference',
    'preference.mealSchedule': 'no_preference',
    ...answerOverrides,
  }, {
    localDraftId: 'result-v2-ui-fixture',
    ...draftOverrides,
  })

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const pathText = (parts) => parts.join('.')
const evidenceId = (record, fieldPath) =>
  `ev-${record.institutionId.replace(/^institution-/, '')}-${fieldPath.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-ui`

const removeEvidence = (record, ids) => {
  const oldIds = new Set(ids || [])
  if (oldIds.size === 0) return
  record.evidence = record.evidence.filter((item) => !oldIds.has(item.evidenceId))
}

const setAt = (value, parts, replacement) => {
  let current = value
  for (let index = 0; index < parts.length - 1; index += 1) current = current[parts[index]]
  current[parts[parts.length - 1]] = replacement
}

const getAt = (value, parts) => parts.reduce((current, part) => current[part], value)

const replaceVerifiedField = (record, parts, value, snapshotType = 'stable_code') => {
  const fieldPath = pathText(parts)
  const previous = getAt(record, parts)
  removeEvidence(record, previous && previous.verification ? previous.verification.evidenceIds : [])
  const id = evidenceId(record, fieldPath)
  setAt(record, parts, {
    availability: 'provided',
    value,
    asOf: RESULT_V2_FIXTURE_AS_OF,
    verification: {
      status: 'verified',
      evidenceIds: [id],
      verifiedAt: RESULT_V2_FIXTURE_AS_OF,
      validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
    },
  })
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath,
    valueSnapshot: { valueType: snapshotType, value },
    observedAt: RESULT_V2_FIXTURE_AS_OF,
    sourceType: 'official_document',
    sourceNote: RESULT_V2_SYNTHETIC_NOTE,
    verificationStatus: 'verified',
    verifiedAt: RESULT_V2_FIXTURE_AS_OF,
    validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
  })
}

const replaceUnavailableField = (record, parts, availability = 'unknown') => {
  const previous = getAt(record, parts)
  removeEvidence(record, previous && previous.verification ? previous.verification.evidenceIds : [])
  setAt(record, parts, {
    availability,
    value: null,
    verification: { status: 'unverified', evidenceIds: [] },
  })
}

const setCapabilityStatus = (record, group, code, status) => {
  const parts = ['capabilities', group, code]
  const fieldPath = pathText(parts)
  const previous = getAt(record, parts)
  removeEvidence(record, previous && previous.verification ? previous.verification.evidenceIds : [])
  const id = evidenceId(record, fieldPath)
  setAt(record, parts, {
    code,
    status,
    asOf: RESULT_V2_FIXTURE_AS_OF,
    verification: {
      status: 'verified',
      evidenceIds: [id],
      verifiedAt: RESULT_V2_FIXTURE_AS_OF,
      validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
    },
  })
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath,
    valueSnapshot: { valueType: 'stable_code', value: status },
    observedAt: RESULT_V2_FIXTURE_AS_OF,
    sourceType: 'official_document',
    sourceNote: RESULT_V2_SYNTHETIC_NOTE,
    verificationStatus: 'verified',
    verifiedAt: RESULT_V2_FIXTURE_AS_OF,
    validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
  })
}

const unknownField = () => ({
  availability: 'unknown',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

const makeRoom = (roomId, roomType) => ({
  roomId,
  name: unknownField(),
  roomType: unknownField(),
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
    electricCurtain: unknownField(),
    refrigerator: unknownField(),
    bedsideTableOrFoldBoard: unknownField(),
    wheelchairOrAssistiveEquipment: unknownField(),
    smartSpeakerOrRadio: unknownField(),
    magnifier: unknownField(),
    calligraphyOrPersonalItems: unknownField(),
  },
  referencePrice: unknownField(),
  mediaIds: [],
  __fixtureRoomType: roomType,
})

const setRoomType = (record, roomType) => {
  const room = makeRoom(`${record.institutionId}-room-1`, roomType)
  delete room.__fixtureRoomType
  record.rooms = [room]
  replaceVerifiedField(record, ['rooms', '0', 'name'], `${room.roomId}（测试房型）`, 'text')
  replaceVerifiedField(record, ['rooms', '0', 'roomType'], roomType, 'stable_code')
}

const setMealSchedule = (record, value) => {
  if (value === 'unknown' || value === 'unavailable') {
    replaceUnavailableField(record, ['meal', 'mealSchedule'], value === 'unavailable' ? 'unavailable' : 'unknown')
    return
  }
  replaceVerifiedField(record, ['meal', 'mealSchedule'], value, 'stable_code')
}

const setMealSupport = (record, fieldName, value) => {
  // Service availability is itself a verified enum value. The outer
  // InstitutionField remains `provided`; only a genuinely missing source
  // should use outer `unknown`/`unavailable`.
  replaceVerifiedField(record, ['meal', fieldName], value, 'stable_code')
}

const setActivitySpace = (record, fieldName, value) => {
  if (value === 'unknown' || value === 'unavailable') {
    replaceUnavailableField(record, ['activity', fieldName], value === 'unavailable' ? 'unavailable' : 'unknown')
    return
  }
  replaceVerifiedField(record, ['activity', fieldName], value, 'stable_code')
}

const setBedAvailability = (record, status) => {
  const previous = record.operations.bedAvailability
  removeEvidence(record, previous && previous.verification ? previous.verification.evidenceIds : [])
  const id = evidenceId(record, 'operations.bedAvailability')
  record.operations.bedAvailability = {
    status,
    asOf: RESULT_V2_FIXTURE_AS_OF,
    verification: {
      status: 'verified',
      evidenceIds: [id],
      verifiedAt: RESULT_V2_FIXTURE_AS_OF,
      validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
    },
  }
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath: 'operations.bedAvailability',
    valueSnapshot: { valueType: 'stable_code', value: status },
    observedAt: RESULT_V2_FIXTURE_AS_OF,
    sourceType: 'official_document',
    sourceNote: RESULT_V2_SYNTHETIC_NOTE,
    verificationStatus: 'verified',
    verifiedAt: RESULT_V2_FIXTURE_AS_OF,
    validUntil: RESULT_V2_FIXTURE_VALID_UNTIL,
  })
}

const forTargets = (records, callback) => records
  .filter((record) => RESULT_V2_TARGET_IDS.includes(record.institutionId))
  .forEach(callback)

/**
 * Return a validated-catalog-shaped payload for a named behavior fixture.
 * The result runtime still runs the production catalog validator over it.
 */
export const makeResultV2CatalogFixture = (catalog, variant = 'exact') => {
  const next = clone(catalog)
  const target = (callback) => forTargets(next.records, callback)
  if (variant === 'room-match') target((record) => setRoomType(record, 'single'))
  if (variant === 'room-mismatch-guard') target((record) => setRoomType(record, 'double'))
  if (variant === 'meal-match') target((record) => setMealSchedule(record, 'three_meals_one_snack'))
  if (variant === 'meal-mismatch') target((record) => setMealSchedule(record, 'three_meals'))
  if (variant === 'meal-unavailable') target((record) => setMealSchedule(record, 'unavailable'))
  if (variant === 'meal-unknown') target((record) => setMealSchedule(record, 'unknown'))
  if (variant === 'nutrition-supported') target((record) => setMealSupport(record, 'easyChewSupport', 'available'))
  if (variant === 'nutrition-unavailable') target((record) => setMealSupport(record, 'easyChewSupport', 'unavailable'))
  if (variant === 'nutrition-inquiry') target((record) => setMealSupport(record, 'easyChewSupport', 'requires_inquiry'))
  if (variant === 'nutrition-unknown') target((record) => setMealSupport(record, 'easyChewSupport', 'unknown'))
  if (variant === 'activity-present') target((record) => setActivitySpace(record, 'indoorSpace', 'present'))
  if (variant === 'operational-advisory') target((record) => setBedAvailability(record, 'unavailable'))
  if (variant === 'conditional') next.records.forEach((record) =>
    setCapabilityStatus(record, 'mobilitySupport', 'wheelchair_support', 'requires_assessment'))
  if (variant === 'hard-conflict') next.records.forEach((record) =>
    setCapabilityStatus(record, 'mobilitySupport', 'wheelchair_support', 'unsupported'))
  if (variant === 'price-unknown') target((record) =>
    replaceUnavailableField(record, ['price', 'referenceMonthlyPrice'], 'unknown'))
  return next
}

export const RESULT_V2_SNAPSHOT_CASES = Object.freeze([
  'RESULT-SNAPSHOT-V2-001', // exact
  'RESULT-SNAPSHOT-V2-002', // soft-near
  'RESULT-SNAPSHOT-V2-003', // conditional
  'RESULT-SNAPSHOT-V2-004', // incomplete Draft short-circuit
  'RESULT-SNAPSHOT-V2-005', // invalid catalog
  'RESULT-SNAPSHOT-V2-006', // empty catalog result error
  'RESULT-SNAPSHOT-V2-007', // full pool + one evaluator call
  'RESULT-SNAPSHOT-V2-008', // missing source
  'RESULT-SNAPSHOT-V2-009', // revision mismatch
  'RESULT-SNAPSHOT-V2-010', // duplicate source
  'RESULT-SNAPSHOT-V2-011', // provenance mismatch
  'RESULT-SNAPSHOT-V2-012', // context mismatch
  'RESULT-SNAPSHOT-V2-013', // one catalog load/no second lookup
  'RESULT-SNAPSHOT-V2-014', // no raw record
  'RESULT-SNAPSHOT-V2-015', // mock provenance
  'RESULT-SNAPSHOT-V2-016', // readiness blocked
  'RESULT-SNAPSHOT-V2-017', // deterministic fixed time
  'RESULT-SNAPSHOT-V2-018', // live dispatcher boundary
])

export const RESULT_V2_UI_CASES = Object.freeze([
  'RESULT-UI-V2-001', 'RESULT-UI-V2-002', 'RESULT-UI-V2-003',
  'RESULT-UI-V2-004', 'RESULT-UI-V2-005', 'RESULT-UI-V2-006',
  'RESULT-UI-V2-007', 'RESULT-UI-V2-008', 'RESULT-UI-V2-009',
  'RESULT-UI-V2-010', 'RESULT-UI-V2-011', 'RESULT-UI-V2-012',
  'RESULT-UI-V2-013', 'RESULT-UI-V2-014', 'RESULT-UI-V2-015',
  'RESULT-UI-V2-016', 'RESULT-UI-V2-017', 'RESULT-UI-V2-018',
  'RESULT-UI-V2-019', 'RESULT-UI-V2-020', 'RESULT-UI-V2-021',
  'RESULT-UI-V2-022', 'RESULT-UI-V2-023', 'RESULT-UI-V2-024',
  'RESULT-UI-V2-025', 'RESULT-UI-V2-026', 'RESULT-UI-V2-027',
  'RESULT-UI-V2-028', 'RESULT-UI-V2-029', 'RESULT-UI-V2-030',
])

export const RESULT_V2_UI_FIXTURE_MANIFEST = Object.freeze({
  snapshotCount: RESULT_V2_SNAPSHOT_CASES.length,
  uiCount: RESULT_V2_UI_CASES.length,
  completePoolSize: 8,
  maximumCards: 3,
  minimumAssertionsPerCase: 2,
})
