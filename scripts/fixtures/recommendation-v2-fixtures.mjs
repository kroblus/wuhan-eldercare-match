/**
 * TEST_FIXTURE_ONLY — synthetic Recommendation V2 facts.
 * These records are not real Wuhan institutions and must never be imported by App code.
 */
import {
  cloneInstitutionV11Record,
  validInstitutionV11Fixtures,
} from './institution-v1-1-fixtures.mjs'

export const REC_V2_EVALUATION_AS_OF = '2026-08-31T09:00:00.000Z'
export const REC_V2_DATASET_VERSION = 'recommendation-v2-test-dataset-1'
export const REC_V2_DATASET_MODE = 'MOCK_DEVELOPMENT_ONLY'
export const REC_V2_FIXTURE_POLICY = 'TEST_FIXTURE_ONLY_NOT_REAL_INSTITUTION_DATA'

const VERIFIED_AT = '2026-08-30T09:00:00.000Z'
const VALID_UNTIL = '2027-08-30T09:00:00.000Z'
const EXPIRED_AT = '2026-01-01T09:00:00.000Z'

const getAt = (root, dottedPath) => dottedPath.split('.').reduce((value, key) => value[Number.isInteger(Number(key)) ? Number(key) : key], root)
const setAt = (root, dottedPath, next) => {
  const keys = dottedPath.split('.')
  const parent = keys.slice(0, -1).reduce((value, key) => value[Number.isInteger(Number(key)) ? Number(key) : key], root)
  const leaf = keys[keys.length - 1]
  parent[Number.isInteger(Number(leaf)) ? Number(leaf) : leaf] = next
}

const removeEvidence = (record, ids) => {
  record.evidence = record.evidence.filter((entry) => !ids.includes(entry.evidenceId))
}

const stableHash = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

// Institution evidence IDs are contract-bound stable identifiers with a 64-character
// ceiling. Keep fixture IDs short while deriving them from the complete binding key.
const evidenceId = (record, path, suffix = 'verified') => {
  const recordToken = record.institutionId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 24)
  return `ev2-${recordToken}-${stableHash(`${record.institutionId}|${path}|${suffix}`)}`
}

export const setStableField = (record, path, availability, value, mode = 'verified') => {
  const existing = getAt(record, path)
  removeEvidence(record, existing?.verification?.evidenceIds || [])
  if (availability !== 'provided') {
    setAt(record, path, {
      availability,
      value: null,
      verification: { status: 'unverified', evidenceIds: [] },
    })
    return record
  }
  if (mode === 'unverified') {
    setAt(record, path, {
      availability: 'provided',
      value,
      verification: { status: 'unverified', evidenceIds: [] },
    })
    return record
  }
  const id = evidenceId(record, path, mode)
  const expired = mode === 'expired'
  const verifiedAt = expired ? '2025-08-30T09:00:00.000Z' : VERIFIED_AT
  const validUntil = expired ? EXPIRED_AT : VALID_UNTIL
  const verificationStatus = expired ? 'expired' : 'verified'
  setAt(record, path, {
    availability: 'provided',
    value,
    asOf: VERIFIED_AT,
    verification: { status: verificationStatus, evidenceIds: [id], verifiedAt, validUntil },
  })
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath: path,
    valueSnapshot: { valueType: 'stable_code', value },
    observedAt: VERIFIED_AT,
    sourceType: 'official_document',
    sourceNote: 'TEST_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA',
    verificationStatus,
    verifiedAt,
    validUntil,
  })
  return record
}

export const setCapabilityStatus = (record, path, status, mode = 'verified') => {
  const existing = getAt(record, path)
  removeEvidence(record, existing?.verification?.evidenceIds || [])
  if (mode === 'unverified') {
    setAt(record, path, {
      ...existing,
      status,
      verification: { status: 'unverified', evidenceIds: [] },
    })
    return record
  }
  const id = evidenceId(record, path, mode)
  const expired = mode === 'expired'
  const verifiedAt = expired ? '2025-08-30T09:00:00.000Z' : VERIFIED_AT
  const validUntil = expired ? EXPIRED_AT : VALID_UNTIL
  const verificationStatus = expired ? 'expired' : 'verified'
  setAt(record, path, {
    ...existing,
    status,
    asOf: VERIFIED_AT,
    verification: { status: verificationStatus, evidenceIds: [id], verifiedAt, validUntil },
  })
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath: path,
    valueSnapshot: { valueType: 'stable_code', value: status },
    observedAt: VERIFIED_AT,
    sourceType: 'official_document',
    sourceNote: 'TEST_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA',
    verificationStatus,
    verifiedAt,
    validUntil,
  })
  return record
}

export const setReferencePrice = (record, minAmountMinor = 600000, maxAmountMinor = 700000) => {
  const path = 'price.referenceMonthlyPrice'
  const existing = getAt(record, path)
  removeEvidence(record, existing?.verification?.evidenceIds || [])
  const id = evidenceId(record, path)
  const value = {
    basis: 'reference_total',
    range: {
      kind: 'bounded',
      min: { amountMinor: minAmountMinor, currency: 'CNY' },
      max: { amountMinor: maxAmountMinor, currency: 'CNY' },
      period: 'month',
    },
  }
  setAt(record, path, {
    availability: 'provided',
    value,
    asOf: VERIFIED_AT,
    verification: { status: 'verified', evidenceIds: [id], verifiedAt: VERIFIED_AT, validUntil: VALID_UNTIL },
  })
  record.evidence.push({
    evidenceId: id,
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath: path,
    valueSnapshot: { valueType: 'reference_monthly_price', value },
    observedAt: VERIFIED_AT,
    sourceType: 'official_document',
    sourceNote: 'TEST_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA',
    verificationStatus: 'verified',
    verifiedAt: VERIFIED_AT,
    validUntil: VALID_UNTIL,
  })
  return record
}

export const makeV2InstitutionPool = (count = 1) =>
  validInstitutionV11Fixtures.slice(0, count).map((fixture) => cloneInstitutionV11Record(fixture.record))

export const configureLifeFit = (record, {
  room = 'single',
  roomMode = 'verified',
  meal = 'three_meals',
  mealAvailability = 'provided',
  mealMode = 'verified',
  easyChew = 'available',
  easyChewMode = 'verified',
  modifiedFood = 'available',
  modifiedFoodMode = 'verified',
  indoor = 'present',
  outdoor = 'present',
} = {}) => {
  setReferencePrice(record)
  if (record.rooms.length === 0) {
    return record
  }
  setStableField(record, 'rooms.0.roomType', 'provided', room, roomMode)
  setStableField(record, 'meal.mealSchedule', mealAvailability, mealAvailability === 'provided' ? meal : null, mealMode)
  setStableField(record, 'meal.easyChewSupport', 'provided', easyChew, easyChewMode)
  setStableField(record, 'meal.modifiedFoodSupport', 'provided', modifiedFood, modifiedFoodMode)
  setStableField(record, 'activity.indoorSpace', 'provided', indoor, 'verified')
  setStableField(record, 'activity.outdoorSpace', 'provided', outdoor, 'verified')
  return record
}

/**
 * TEST_FIXTURE_ONLY — creates two semantically identical room catalogs whose
 * child order differs. Evidence stays attached to the same stable roomId while
 * its contract-bound current-revision fieldPath is rewritten to the new index.
 */
export const makeRoomChildPermutationPair = (record) => {
  const original = cloneInstitutionV11Record(record)
  const appended = cloneInstitutionV11Record(record).rooms[0]
  appended.roomId = 'room-0-stable-single'
  appended.roomType = {
    availability: 'provided',
    value: 'single',
    verification: { status: 'unverified', evidenceIds: [] },
  }
  original.rooms.push(appended)
  setStableField(original, 'rooms.1.roomType', 'provided', 'single', 'verified')

  const expectedEvidenceId = original.rooms[1].roomType.verification.evidenceIds[0]
  const permuted = cloneInstitutionV11Record(original)
  permuted.rooms.reverse()
  permuted.rooms.forEach((room, index) => {
    room.roomType.verification.evidenceIds.forEach((id) => {
      const evidence = permuted.evidence.find((entry) => entry.evidenceId === id)
      if (evidence) evidence.fieldPath = `rooms.${index}.roomType`
    })
  })
  return { expectedEvidenceId, original, permuted }
}

export const REC_V2_EXPECTED_CASE_IDS = Object.freeze(Array.from(
  { length: 68 },
  (_, index) => `REC-V2-${String(index + 1).padStart(3, '0')}`,
))

export const recommendationV2Fixtures = Object.freeze([
  { id: 'REC-V2-001', scenario: 'room_match' },
  { id: 'REC-V2-002', scenario: 'room_noncompatible_unknown' },
  { id: 'REC-V2-003', scenario: 'room_empty_unknown' },
  { id: 'REC-V2-004', scenario: 'room_unverified_unknown' },
  { id: 'REC-V2-005', scenario: 'room_not_applicable' },
  { id: 'REC-V2-006', scenario: 'meal_exact' },
  { id: 'REC-V2-007', scenario: 'meal_known_mismatch' },
  { id: 'REC-V2-008', scenario: 'meal_data_unavailable' },
  { id: 'REC-V2-009', scenario: 'meal_unknown' },
  { id: 'REC-V2-010', scenario: 'meal_not_applicable' },
  { id: 'REC-V2-011', scenario: 'easy_chew_supported' },
  { id: 'REC-V2-012', scenario: 'easy_chew_unavailable' },
  { id: 'REC-V2-013', scenario: 'easy_chew_inquiry' },
  { id: 'REC-V2-014', scenario: 'easy_chew_unknown' },
  { id: 'REC-V2-015', scenario: 'modified_food_supported' },
  { id: 'REC-V2-016', scenario: 'modified_food_unavailable' },
  { id: 'REC-V2-017', scenario: 'activity_display_only' },
  { id: 'REC-V2-018', scenario: 'priority_caregiver_not_scorable' },
  { id: 'REC-V2-019', scenario: 'priority_hospital_not_scorable' },
  { id: 'REC-V2-020', scenario: 'priority_transport_not_scorable' },
  { id: 'REC-V2-021', scenario: 'dedup_price' },
  { id: 'REC-V2-022', scenario: 'dedup_region' },
  { id: 'REC-V2-023', scenario: 'dedup_rehab' },
  { id: 'REC-V2-024', scenario: 'dedup_rehab_hard' },
  { id: 'REC-V2-025', scenario: 'dedup_care_safety' },
  { id: 'REC-V2-026', scenario: 'exact_all_match' },
  { id: 'REC-V2-027', scenario: 'exact_room_unknown_soft' },
  { id: 'REC-V2-028', scenario: 'exact_meal_mismatch_soft' },
  { id: 'REC-V2-029', scenario: 'exact_meal_unknown_soft' },
  { id: 'REC-V2-030', scenario: 'exact_activity_neutral' },
  { id: 'REC-V2-031', scenario: 'exact_nutrition_neutral' },
  { id: 'REC-V2-032', scenario: 'exact_not_scorable_priority_neutral' },
  { id: 'REC-V2-033', scenario: 'safety_unsupported' },
  { id: 'REC-V2-034', scenario: 'safety_unverified' },
  { id: 'REC-V2-035', scenario: 'safety_conditional' },
  { id: 'REC-V2-036', scenario: 'elder_readiness_blocked' },
  { id: 'REC-V2-037', scenario: 'cards_five_exact' },
  { id: 'REC-V2-038', scenario: 'cards_two_exact' },
  { id: 'REC-V2-039', scenario: 'cards_four_soft' },
  { id: 'REC-V2-040', scenario: 'cards_only_conditional' },
  { id: 'REC-V2-041', scenario: 'cards_no_unverified_ineligible' },
  { id: 'REC-V2-042', scenario: 'deterministic_repeat' },
  { id: 'REC-V2-043', scenario: 'deterministic_pool_permutation' },
  { id: 'REC-V2-044', scenario: 'deterministic_evidence_permutation' },
  { id: 'REC-V2-045', scenario: 'deterministic_priority_order' },
  { id: 'REC-V2-046', scenario: 'parity_exact' },
  { id: 'REC-V2-047', scenario: 'parity_room_unknown' },
  { id: 'REC-V2-048', scenario: 'parity_meal_mismatch' },
  { id: 'REC-V2-049', scenario: 'parity_nutrition' },
  { id: 'REC-V2-050', scenario: 'parity_conditional' },
  { id: 'REC-V2-051', scenario: 'parity_advisory' },
  { id: 'REC-V2-052', scenario: 'invalid_contract' },
  { id: 'REC-V2-053', scenario: 'invalid_ruleset' },
  { id: 'REC-V2-054', scenario: 'invalid_v1_profile' },
  { id: 'REC-V2-055', scenario: 'invalid_v1_institution' },
  { id: 'REC-V2-056', scenario: 'invalid_time' },
  { id: 'REC-V2-057', scenario: 'invalid_duplicate_id' },
  { id: 'REC-V2-058', scenario: 'invalid_institution_shape' },
  { id: 'REC-V2-059', scenario: 'invalid_profile_evidence' },
  { id: 'REC-V2-060', scenario: 'invalid_profile_clarification' },
  { id: 'REC-V2-061', scenario: 'invalid_priority' },
  { id: 'REC-V2-062', scenario: 'invalid_dataset_provenance' },
  { id: 'REC-V2-063', scenario: 'invalid_legacy_dto' },
  { id: 'REC-V2-064', scenario: 'invalid_raw_draft' },
  { id: 'REC-V2-065', scenario: 'invalid_bare_semantics' },
  { id: 'REC-V2-066', scenario: 'input_immutability' },
  { id: 'REC-V2-067', scenario: 'full_pool_manifest' },
  { id: 'REC-V2-068', scenario: 'budget_advisory' },
])

export const REC_V2_FIXTURE_MANIFEST = Object.freeze({
  fixturePolicy: REC_V2_FIXTURE_POLICY,
  expectedCount: 68,
  expectedIds: REC_V2_EXPECTED_CASE_IDS,
  minimumAssertionsPerCase: 6,
  parityCaseIds: Object.freeze(REC_V2_EXPECTED_CASE_IDS.slice(45, 51)),
  invalidCaseIds: Object.freeze(REC_V2_EXPECTED_CASE_IDS.slice(51, 65)),
})
