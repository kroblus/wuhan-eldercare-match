/**
 * Recommendation V1 runtime fixtures.
 *
 * These records and assessment answers are deliberately synthetic. They are
 * only for the deterministic runtime gate and must never be consumed by a
 * Page, service, or production data provider.
 */

import {
  INSTITUTION_FIXTURE_AS_OF,
  INSTITUTION_FIXTURE_EVALUATION_AS_OF,
  INSTITUTION_FIXTURE_EXPIRED_AT,
  INSTITUTION_FIXTURE_EXPIRED_UNTIL,
  INSTITUTION_FIXTURE_POLICY,
  INSTITUTION_FIXTURE_VALID_UNTIL,
  NOT_REAL_INSTITUTION_DATA,
  TEST_SYNTHETIC_VERIFIED,
  cloneInstitutionRecord,
  institutionFixtures,
} from './institution-fixtures.mjs'
import {
  REHABILITATION_CONFLICT_ANSWERS,
  elderProfileFixtures,
  makeCompletedAssessment,
} from './elder-profile-fixtures.mjs'
import { makePreviewDraft } from './elder-profile-preview-fixtures.mjs'

export const RECOMMENDATION_FIXTURE_POLICY = 'MOCK_DEVELOPMENT_ONLY'
export const RECOMMENDATION_FIXTURE_DATA = NOT_REAL_INSTITUTION_DATA
export const RECOMMENDATION_FIXTURE_VERIFICATION = TEST_SYNTHETIC_VERIFIED
export const RECOMMENDATION_FIXTURE_DATASET_VERSION = 'recommendation-runtime-fixtures-v1'
export const RECOMMENDATION_FIXTURE_EVALUATION_AS_OF = INSTITUTION_FIXTURE_EVALUATION_AS_OF
export const RECOMMENDATION_FIXTURE_RULESET_VERSION = 'recommendation-ruleset-v1'
export const RECOMMENDATION_FIXTURE_POLICY_VERSION = 'conservative-exact-with-conditional-v1'
export const RECOMMENDATION_FIXTURE_DATASET_MODE = 'MOCK_DEVELOPMENT_ONLY'

const ADL_SHORT_KEY_TO_QUESTION_ID = Object.freeze({
  eating: 'adl.eating',
  mobility: 'adl.mobility',
  toileting: 'adl.toileting',
  bathing: 'adl.bathing',
  dressing: 'adl.dressing',
  transfer: 'adl.transfer',
  stairs: 'adl.stairs',
})

const INSTITUTION_FIXTURE_BY_ID = new Map(institutionFixtures.map((fixture) => [fixture.id, fixture]))
const ELDER_FIXTURE_BY_ID = new Map(elderProfileFixtures.map((fixture) => [fixture.id, fixture]))

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const pathParts = (fieldPath) => fieldPath.split('.')

const readPath = (value, fieldPath) => pathParts(fieldPath).reduce((current, part) => current && current[part], value)

const writePath = (value, fieldPath, nextValue) => {
  const parts = pathParts(fieldPath)
  const leaf = parts.pop()
  let cursor = value
  parts.forEach((part) => {
    cursor = cursor[part]
  })
  cursor[leaf] = nextValue
}

const removeEvidenceForPath = (record, fieldPath) => {
  record.evidence = record.evidence.filter((entry) => entry.fieldPath !== fieldPath)
}

const findEvidence = (record, fieldPath) => record.evidence.find((entry) => entry.fieldPath === fieldPath)

const setEvidenceVerification = (record, fieldPath, status) => {
  const field = readPath(record, fieldPath)
  let existingEvidence = findEvidence(record, fieldPath)
  if (status === 'unverified') {
    field.verification = { status: 'unverified', evidenceIds: [] }
    removeEvidenceForPath(record, fieldPath)
    return
  }

  if (!existingEvidence) {
    const valueType = fieldPath === 'typeProfile.supportedTypes' ? 'stable_code_list'
      : fieldPath === 'price.referenceMonthlyPrice' ? 'reference_monthly_price' : 'stable_code'
    existingEvidence = {
      evidenceId: `ev-rec-${record.institutionId}-${fieldPath.split('.').map((part) => part.slice(0, 4)).join('-').toLowerCase()}`,
      institutionId: record.institutionId, recordRevision: record.recordRevision, fieldPath,
      valueSnapshot: { valueType, value: deepClone(fieldPath.startsWith('capabilities.') ? field.status : field.value) },
      sourceType: 'official_document', sourceNote: `${TEST_SYNTHETIC_VERIFIED}; ${NOT_REAL_INSTITUTION_DATA}`,
      observedAt: INSTITUTION_FIXTURE_AS_OF, verificationStatus: status,
    }
    record.evidence.push(existingEvidence)
  }
  existingEvidence.recordRevision = record.recordRevision
  existingEvidence.institutionId = record.institutionId
  existingEvidence.verificationStatus = status
  if (status === 'expired') {
    existingEvidence.verifiedAt = INSTITUTION_FIXTURE_EXPIRED_AT
    existingEvidence.validUntil = INSTITUTION_FIXTURE_EXPIRED_UNTIL
    field.verification = {
      status: 'expired',
      evidenceIds: [existingEvidence.evidenceId],
      verifiedAt: INSTITUTION_FIXTURE_EXPIRED_AT,
      validUntil: INSTITUTION_FIXTURE_EXPIRED_UNTIL,
    }
    return
  }
  existingEvidence.verifiedAt = INSTITUTION_FIXTURE_AS_OF
  existingEvidence.validUntil = INSTITUTION_FIXTURE_VALID_UNTIL
  field.verification = {
    status: 'verified',
    evidenceIds: [existingEvidence.evidenceId],
    verifiedAt: INSTITUTION_FIXTURE_AS_OF,
    validUntil: INSTITUTION_FIXTURE_VALID_UNTIL,
  }
}

const syncEvidenceSnapshot = (record, fieldPath, valueSnapshot) => {
  const evidence = findEvidence(record, fieldPath)
  if (!evidence) {
    throw new Error(`fixture mutation needs evidence for ${record.institutionId}:${fieldPath}`)
  }
  evidence.recordRevision = record.recordRevision
  evidence.institutionId = record.institutionId
  evidence.valueSnapshot = deepClone(valueSnapshot)
}

const setCapability = (record, group, code, status, verificationStatus = 'verified') => {
  const fieldPath = `capabilities.${group}.${code}`
  const field = readPath(record, fieldPath)
  if (!field) {
    throw new Error(`unknown capability fixture path ${fieldPath}`)
  }
  field.status = status
  setEvidenceVerification(record, fieldPath, verificationStatus)
  if (verificationStatus !== 'unverified') {
    syncEvidenceSnapshot(record, fieldPath, { valueType: 'stable_code', value: status })
  }
}

const setRegion = (record, regionCode, verificationStatus = 'verified') => {
  const fieldPath = 'identity.regionCode'
  record.identity.regionCode.availability = 'provided'
  record.identity.regionCode.value = regionCode
  if (!findEvidence(record, fieldPath) && verificationStatus !== 'unverified') {
    record.evidence.push({
      evidenceId: `ev-recommendation-${record.institutionId}-region-code`,
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      fieldPath,
      valueSnapshot: { valueType: 'stable_code', value: regionCode },
      observedAt: INSTITUTION_FIXTURE_AS_OF,
      sourceType: 'official_document',
      sourceNote: `${TEST_SYNTHETIC_VERIFIED}; ${NOT_REAL_INSTITUTION_DATA}`,
      verificationStatus,
      ...(verificationStatus === 'expired'
        ? { verifiedAt: INSTITUTION_FIXTURE_EXPIRED_AT, validUntil: INSTITUTION_FIXTURE_EXPIRED_UNTIL }
        : { verifiedAt: INSTITUTION_FIXTURE_AS_OF, validUntil: INSTITUTION_FIXTURE_VALID_UNTIL }),
    })
  }
  setEvidenceVerification(record, fieldPath, verificationStatus)
  if (verificationStatus !== 'unverified') {
    syncEvidenceSnapshot(record, fieldPath, { valueType: 'stable_code', value: regionCode })
  }
}

const setSupportedTypes = (record, supportedTypes, verificationStatus = 'verified') => {
  const fieldPath = 'typeProfile.supportedTypes'
  record.typeProfile.supportedTypes = {
    availability: 'provided',
    value: supportedTypes.slice(),
    asOf: INSTITUTION_FIXTURE_AS_OF,
    verification: record.typeProfile.supportedTypes.verification,
  }
  setEvidenceVerification(record, fieldPath, verificationStatus)
  if (verificationStatus !== 'unverified') {
    syncEvidenceSnapshot(record, fieldPath, { valueType: 'stable_code_list', value: supportedTypes.slice() })
  }
}

const setSupportedTypesUnknown = (record) => {
  const fieldPath = 'typeProfile.supportedTypes'
  // `primaryType` is optional, but when present the Institution validator
  // requires it to be contained in the effective supported type list. An
  // unknown list cannot satisfy that relation, so remove the optional field
  // rather than manufacturing a stable code.
  delete record.typeProfile.primaryType
  record.typeProfile.supportedTypes = {
    availability: 'unknown',
    value: null,
    asOf: INSTITUTION_FIXTURE_AS_OF,
    verification: { status: 'unverified', evidenceIds: [] },
  }
  removeEvidenceForPath(record, fieldPath)
}

const setPriceRange = (record, minAmountMinor, maxAmountMinor, kind = 'bounded', verificationStatus = 'verified') => {
  const fieldPath = 'price.referenceMonthlyPrice'
  const range = {
    kind,
    min: { amountMinor: minAmountMinor, currency: 'CNY' },
    max: kind === 'starting_at' ? null : { amountMinor: maxAmountMinor, currency: 'CNY' },
    period: 'month',
  }
  record.price.referenceMonthlyPrice = {
    availability: 'provided',
    value: { basis: 'reference_total', range },
    asOf: INSTITUTION_FIXTURE_AS_OF,
    verification: record.price.referenceMonthlyPrice.verification,
  }
  setEvidenceVerification(record, fieldPath, verificationStatus)
  if (verificationStatus !== 'unverified') {
    syncEvidenceSnapshot(record, fieldPath, {
      valueType: 'reference_monthly_price',
      value: record.price.referenceMonthlyPrice.value,
    })
  }
}

const setPriceUnknown = (record) => {
  const fieldPath = 'price.referenceMonthlyPrice'
  record.price.referenceMonthlyPrice = {
    availability: 'unknown',
    value: null,
    verification: { status: 'unverified', evidenceIds: [] },
  }
  removeEvidenceForPath(record, fieldPath)
}

const setRecordRevision = (record, recordRevision) => {
  record.recordRevision = recordRevision
  record.evidence.forEach((entry) => {
    entry.recordRevision = recordRevision
  })
}

const setAvailability = (record, status) => {
  record.operations.bedAvailability = {
    status,
    asOf: INSTITUTION_FIXTURE_AS_OF,
    verification: { status: 'unverified', evidenceIds: [] },
  }
}

const setRecordStatus = (record, status) => {
  record.recordStatus = status
}

const setRecordProvenance = (record, provenance) => {
  record.recordProvenance = provenance
}

const setValidUntil = (record, fieldPath, validUntil) => {
  const field = readPath(record, fieldPath)
  const evidence = findEvidence(record, fieldPath)
  if (!field || !evidence || field.verification.status !== 'verified') {
    throw new Error(`fixture mutation needs a verified field for valid-until ${record.institutionId}:${fieldPath}`)
  }
  field.verification.validUntil = validUntil
  evidence.validUntil = validUntil
}

const setInstitutionId = (record, institutionId) => {
  const previousId = record.institutionId
  record.institutionId = institutionId
  record.evidence.forEach((entry) => {
    entry.institutionId = institutionId
    // Evidence IDs are stable fixture locators, not institution identities.
    // Keep them unchanged to prove the record revision/id binding is checked
    // from the evidence owner rather than inferred from a label.
  })
  if (previousId === institutionId) {
    return
  }
}

const applyPatch = (record, patch) => {
  switch (patch.op) {
    case 'capability':
      setCapability(record, patch.group, patch.code, patch.status, patch.verificationStatus || 'verified')
      return
    case 'region':
      setRegion(record, patch.value, patch.verificationStatus || 'verified')
      return
    case 'supported_types':
      setSupportedTypes(record, patch.value, patch.verificationStatus || 'verified')
      return
    case 'supported_types_unknown':
      setSupportedTypesUnknown(record)
      return
    case 'price':
      setPriceRange(record, patch.minAmountMinor, patch.maxAmountMinor, patch.kind || 'bounded', patch.verificationStatus || 'verified')
      return
    case 'price_unknown':
      setPriceUnknown(record)
      return
    case 'revision':
      setRecordRevision(record, patch.value)
      return
    case 'availability':
      setAvailability(record, patch.value)
      return
    case 'record_status':
      setRecordStatus(record, patch.value)
      return
    case 'record_provenance':
      setRecordProvenance(record, patch.value)
      return
    case 'valid_until':
      setValidUntil(record, patch.fieldPath, patch.value)
      return
    case 'institution_id':
      setInstitutionId(record, patch.value)
      return
    default:
      throw new Error(`unknown recommendation fixture patch ${patch.op}`)
  }
}

export const cloneRecommendationInstitution = (fixtureId, patches = []) => {
  const fixture = INSTITUTION_FIXTURE_BY_ID.get(fixtureId)
  if (!fixture) {
    throw new Error(`unknown institution fixture ${fixtureId}`)
  }
  const record = cloneInstitutionRecord(fixture.record)
  patches.forEach((patch) => applyPatch(record, patch))
  return record
}

export const makeInstitutionPool = (definitions = [{ fixtureId: 'INSTITUTION_A_MOCK' }]) => definitions.map((definition) =>
  cloneRecommendationInstitution(definition.fixtureId, definition.patches || []))

const profileAnswerOverrides = (profileFixtureId, overrides = {}) => {
  const fixture = ELDER_FIXTURE_BY_ID.get(profileFixtureId)
  if (!fixture) {
    throw new Error(`unknown elder profile fixture ${profileFixtureId}`)
  }
  const result = {}
  Object.keys(ADL_SHORT_KEY_TO_QUESTION_ID).forEach((shortKey) => {
    if (hasOwn(fixture.answers, shortKey)) {
      result[ADL_SHORT_KEY_TO_QUESTION_ID[shortKey]] = fixture.answers[shortKey]
    }
  })
  Object.assign(result, overrides)
  return result
}

/** Build a valid CompletedAssessment; the runtime invokes the real deriver. */
export const makeRecommendationAssessment = (spec, identityOverrides = {}) => {
  const profileFixtureId = spec.profileFixtureId || 'C01'
  const answerOverrides = profileAnswerOverrides(profileFixtureId, spec.answerOverrides || {})
  return makeCompletedAssessment(answerOverrides, {
    id: identityOverrides.id || `recommendation-${spec.id.toLowerCase()}-assessment`,
    elderId: identityOverrides.elderId || `recommendation-${spec.id.toLowerCase()}-elder`,
    completedAt: identityOverrides.completedAt || '2026-08-30T09:00:00.000Z',
  })
}

/** Build a valid local draft; the runtime invokes the real Preview deriver. */
export const makeRecommendationPreviewDraft = (spec, localDraftId = `recommendation-${spec.id.toLowerCase()}-draft`) => {
  const assessment = makeRecommendationAssessment(spec)
  return makePreviewDraft(assessment.answers, localDraftId)
}

const base = (id, description, expected, extra = {}) => {
  const { answerOverrides: additionalAnswers, conflictCodes, unverifiedCodes, conditionalCodes, readinessCodes, expected: expectedOverrides, ...rest } = extra
  const fixture = {
    id,
    description,
    assertionCount: 6,
    kind: 'formal',
    profileFixtureId: 'C01',
    answerOverrides: {
      'budget.monthlyRange': 'cny_8000_12000',
      ...(additionalAnswers || {}),
    },
    pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }],
    expected: {
      elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'],
      conditionalCandidates: [], itemTiers: { 'institution-a-mock': 'EXACT' }, noExactReason: null,
      ...expected, ...expectedOverrides,
      ...(conflictCodes ? { conflictCodes } : {}),
      ...(unverifiedCodes ? { unverifiedCodes } : {}),
      ...(conditionalCodes ? { conditionalCodes } : {}),
      ...(readinessCodes ? { readinessCodes } : {}),
    },
    ...rest,
  }
  // Fixed fixture identity oracle; no engine output is used to form expectations.
  const ids = { INSTITUTION_A_MOCK: 'institution-a-mock', INSTITUTION_B_MOCK: 'institution-b-mock', INSTITUTION_C_MOCK: 'institution-c-mock', INSTITUTION_D_MOCK: 'institution-d-mock', INSTITUTION_E_MOCK: 'institution-e-mock' }
  if (fixture.pool.length === 1 && fixture.pool[0].fixtureId !== 'INSTITUTION_A_MOCK') {
    const target = ids[fixture.pool[0].fixtureId]
    fixture.expected.items = fixture.expected.items.map((item) => item === 'institution-a-mock' ? target : item)
    fixture.expected.conditionalCandidates = fixture.expected.conditionalCandidates.map((item) => item === 'institution-a-mock' ? target : item)
    if (Object.prototype.hasOwnProperty.call(fixture.expected.itemTiers, 'institution-a-mock')) {
      const tier = fixture.expected.itemTiers['institution-a-mock']
      delete fixture.expected.itemTiers['institution-a-mock']
      fixture.expected.itemTiers[target] = tier
    }
  }
  return fixture
}

const exact = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: true,
  items: ['institution-a-mock'],
  itemTiers: { 'institution-a-mock': 'EXACT' },
  conditionalCandidates: [],
  noExactReason: null,
}, extra)

const near = (id, description, expected = {}, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: false,
  items: ['institution-a-mock'],
  itemTiers: { 'institution-a-mock': 'SOFT_NEAR' },
  conditionalCandidates: [],
  noExactReason: 'ONLY_SOFT_NEAR_MATCHES',
  ...expected,
}, extra)

const hardConflict = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: false,
  items: [],
  conditionalCandidates: [],
  itemTiers: { 'institution-a-mock': 'INELIGIBLE' },
  noExactReason: 'ALL_CANDIDATES_HAVE_HARD_CONFLICT',
  conflictCodes: ['tube_feeding'],
}, extra)

const unverified = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: false,
  items: [],
  conditionalCandidates: [],
  itemTiers: { 'institution-a-mock': 'UNVERIFIED' },
  noExactReason: 'REQUIRED_CAPABILITY_UNRESOLVED',
  unverifiedCodes: ['tube_feeding'],
}, extra)

const conditional = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: false,
  items: [],
  conditionalCandidates: ['institution-a-mock'],
  itemTiers: { 'institution-a-mock': 'CONDITIONAL' },
  noExactReason: 'ONLY_CONDITIONAL_CANDIDATES',
  conditionalCodes: ['tube_feeding'],
}, extra)

const readinessBlocked = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'blocked_by_required_clarification',
  exactMatch: false,
  items: [],
  conditionalCandidates: [],
  itemTiers: { 'institution-a-mock': null },
  noExactReason: 'REQUIRED_CAPABILITY_UNRESOLVED',
  readinessCodes: ['ELDER_REQUIREMENT_NEEDS_CONFIRMATION'],
}, extra)

const poolNoExact = (id, description, extra = {}) => base(id, description, {
  ok: true,
  elderReadiness: 'ready',
  exactMatch: false,
  items: [],
  conditionalCandidates: [],
  itemTiers: {},
  noExactReason: 'NO_VERIFIED_INSTITUTION_POOL',
  poolEntryCount: 0,
}, extra)

const directCapabilityAnswers = (capability) => ({
  'cognitive.specialCareNeeds': [capability],
})

const tubeRequired = directCapabilityAnswers('tube_feeding')

const finalHistoricalScenario = Object.freeze({
  1: exact('A01', 'all required care supported and preferences fit'),
  2: hardConflict('A02', 'verified unsupported required capability', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_C_MOCK' }],
  }),
  3: unverified('A03', 'effective unknown required capability', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_D_MOCK' }],
  }),
  4: conditional('A04', 'requires assessment required capability', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_B_MOCK' }],
  }),
  5: near('A05', 'reference price above selected budget', {
    budgetStatus: 'above_budget',
  }, { answerOverrides: { 'budget.monthlyRange': 'cny_3500_5000' } }),
  6: near('A06', 'region differs while care is safe', {
    regionStatus: 'different',
  }, { answerOverrides: { 'preference.region': { kind: 'institution_region', regionCode: 'wuchang', regionLabelSnapshot: '武昌区', catalogVersion: 'institution-catalog-v1' } }, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'region', value: 'jianghan' }, { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }] }),
  7: near('A07', 'preferred institution type differs', {
    typeStatus: 'mismatch',
  }, { answerOverrides: { 'preference.careType': 'active_aging' } }),
  8: near('A08', 'reference price unknown', {
    budgetStatus: 'unknown',
  }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price_unknown' }] }] }),
  9: hardConflict('A09', 'wandering support conflict cannot be rescued', {
    answerOverrides: { 'cognitive.symptoms': ['wandering_risk'] },
    pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'capability', group: 'cognitiveSupport', code: 'wandering_risk_support', status: 'unsupported' }] }],
    conflictCodes: ['wandering_risk_support'],
    expected: { elderReadiness: 'blocked_by_required_clarification', noExactReason: 'REQUIRED_CAPABILITY_UNRESOLVED' },
  }),
  10: unverified('A10', 'dementia unit required but unknown', {
    answerOverrides: directCapabilityAnswers('dementia_unit'),
    pool: [{ fixtureId: 'INSTITUTION_D_MOCK' }],
    unverifiedCodes: ['dementia_unit'],
  }),
  11: exact('A11', 'tube feeding is explicitly supported', {
    answerOverrides: tubeRequired,
  }),
  12: readinessBlocked('A12', 'special feeding clue blocks required clarification', {
    profileFixtureId: 'C06',
  }),
  13: readinessBlocked('A13', 'catheter clue blocks required clarification', {
    profileFixtureId: 'C10',
  }),
  14: base('A14', 'all candidates have hard conflicts', {
    ok: true,
    elderReadiness: 'ready',
    exactMatch: false,
    items: [],
    conditionalCandidates: [],
    itemTiers: { 'institution-a-mock': 'INELIGIBLE', 'institution-c-mock': 'INELIGIBLE' },
    noExactReason: 'ALL_CANDIDATES_HAVE_HARD_CONFLICT',
    conflictCodes: ['tube_feeding'],
  }, {
    answerOverrides: tubeRequired,
    pool: [
      { fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'capability', group: 'specialCare', code: 'tube_feeding', status: 'unsupported' }] },
      { fixtureId: 'INSTITUTION_C_MOCK' },
    ],
  }),
  15: near('A15', 'budget partially overlaps', {
    budgetStatus: 'partially_overlapping',
  }, { answerOverrides: { 'budget.monthlyRange': 'cny_5000_8000' } }),
  16: near('A16', 'region differs only', {
    regionStatus: 'different',
  }, { answerOverrides: { 'preference.region': { kind: 'institution_region', regionCode: 'wuchang', regionLabelSnapshot: '武昌区', catalogVersion: 'institution-catalog-v1' } }, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'region', value: 'jianghan' }, { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }] }),
  17: hardConflict('A17', 'hard conflict remains below any priority', {
    answerOverrides: { ...tubeRequired, 'preference.priorities': ['living_environment'] },
    pool: [{ fixtureId: 'INSTITUTION_C_MOCK' }],
  }),
  18: unverified('A18', 'expired raw support projects to unknown', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_E_MOCK' }],
  }),
  19: exact('A19', 'unavailable operations do not change semantic result', {
    availability: 'unavailable',
    pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'availability', value: 'unavailable' }] }],
  }),
  20: exact('A20', 'same input repeats deterministically', {
    repeat: true,
  }),
})

const cloneHistorical = (sourceId, id) => ({ ...deepClone(finalHistoricalScenario[Number(sourceId.slice(1))]), id, assertionCount: 6, description: `${id} final V1 replay` })

const historicalCases = [
  ...Object.values(finalHistoricalScenario),
  ...Array.from({ length: 20 }, (_, index) => cloneHistorical(`A${String(index + 1).padStart(2, '0')}`, `B${String(index + 1).padStart(2, '0')}`)),
]

const recommendationBoundaryCases = [
  exact('C01', 'exact all-safe baseline'),
  base('C02', 'semi-disabled care level has direct acceptance', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null,
  }, { profileFixtureId: 'C04' }),
  base('C03', 'disabled care level has direct acceptance', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null,
  }, { profileFixtureId: 'C05' }),
  base('C04', 'severely disabled care level has direct acceptance', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null,
  }, { profileFixtureId: 'C07' }),
  readinessBlocked('C05', 'reported diagnosis maps acceptance but preserves unresolved unit clarification', { answerOverrides: { 'cognitive.symptoms': ['diagnosed_dementia'] } }),
  hardConflict('C06', 'wandering risk hard conflict', {
    expected: { elderReadiness: 'blocked_by_required_clarification', noExactReason: 'REQUIRED_CAPABILITY_UNRESOLVED' },
    answerOverrides: { 'cognitive.symptoms': ['wandering_risk'] },
    pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'capability', group: 'cognitiveSupport', code: 'wandering_risk_support', status: 'unsupported' }] }],
    conflictCodes: ['wandering_risk_support'],
  }),
  unverified('C07', 'direct dementia unit unknown', {
    answerOverrides: directCapabilityAnswers('dementia_unit'),
    pool: [{ fixtureId: 'INSTITUTION_D_MOCK' }],
    unverifiedCodes: ['dementia_unit'],
  }),
  exact('C08', 'direct tube feeding supported', { answerOverrides: tubeRequired }),
  exact('C09', 'direct catheter care supported', { answerOverrides: directCapabilityAnswers('catheter_care') }),
  exact('C10', 'direct pressure injury care supported', { answerOverrides: directCapabilityAnswers('pressure_injury_care') }),
  exact('C11', 'direct incontinence care supported', { answerOverrides: directCapabilityAnswers('incontinence_care') }),
  base('C12', 'all nine direct special-care capabilities remain distinct', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, requiredSpecialCareCount: 9,
  }, { answerOverrides: { 'cognitive.specialCareNeeds': ['round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit', 'rehabilitation_training', 'tube_feeding', 'catheter_care', 'pressure_injury_care', 'incontinence_care'], 'health.rehabilitationNeed': 'definite' } }),
  exact('C13', 'explicit rehabilitation training is hard and supported', { answerOverrides: { 'cognitive.specialCareNeeds': ['rehabilitation_training'], 'health.rehabilitationNeed': 'definite' } }),
  base('C14', 'health rehabilitation required is strong soft fit', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, rehabilitationNeed: 'required', rehabilitationStatus: 'supported',
  }, { answerOverrides: { 'health.rehabilitationNeed': 'definite', 'cognitive.specialCareNeeds': ['none'] } }),
  base('C15', 'health rehabilitation possible is soft fit', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, rehabilitationNeed: 'possible', rehabilitationStatus: 'supported',
  }, { answerOverrides: { 'health.rehabilitationNeed': 'possible', 'cognitive.specialCareNeeds': ['none'] } }),
  conditional('C16', 'explicit rehabilitation training requires assessment', {
    answerOverrides: { 'cognitive.specialCareNeeds': ['rehabilitation_training'], 'health.rehabilitationNeed': 'definite' },
    pool: [{ fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'capability', group: 'specialCare', code: 'rehabilitation_training', status: 'requires_assessment' }] }],
    conditionalCodes: ['rehabilitation_training'],
  }),
  readinessBlocked('C17', 'ADL unknown blocks elder readiness', { profileFixtureId: 'C14', readinessCodes: ['adl.careLevel'] }),
  unverified('C18', 'raw unsupported plus unverified projects effective unknown', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_D_MOCK', patches: [{ op: 'capability', group: 'specialCare', code: 'tube_feeding', status: 'unsupported', verificationStatus: 'unverified' }] }],
  }),
  unverified('C19', 'expired capability is unverified at explicit evaluation time', {
    answerOverrides: tubeRequired,
    pool: [{ fixtureId: 'INSTITUTION_E_MOCK' }],
  }),
  base('C20', 'five care levels have no monotonic inheritance', {
    ok: true, elderReadiness: 'ready', exactMatch: false, items: [], conditionalCandidates: [], itemTiers: { 'institution-c-mock': 'INELIGIBLE' }, noExactReason: 'ALL_CANDIDATES_HAVE_HARD_CONFLICT', careLevelMatrix: true,
  }, { profileFixtureId: 'C01', pool: [{ fixtureId: 'INSTITUTION_C_MOCK' }] }),
  base('C21', 'formal and preview core semantics parity', {
    ok: true, elderReadiness: 'ready', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, previewParity: true,
  }, { kind: 'preview', profileFixtureId: 'C04' }),
  poolNoExact('C22', 'empty verified pool has stable no-exact reason', { pool: [] }),
]

const rankCases = [
  base('RANK-001', 'institution input order cannot change ranking', { ok: true, pairwiseInvariant: 'institution_order', items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-b-mock': 'EXACT' } }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }], pairwise: 'institution_order' }),
  base('RANK-002', 'priority array order is a set', { ok: true, pairwiseInvariant: 'priority_order' }, { pairwise: 'priority_order', priorityPair: [['price', 'close_to_family'], ['close_to_family', 'price']] }),
  near('RANK-003', 'price priority has one rank owner', { rankParticipation: { budget: 'consumed_by_priority' }, pairwiseInvariant: 'price_dedup', items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'SOFT_NEAR', 'institution-b-mock': 'SOFT_NEAR' } }, { pairwise: 'price_dedup', answerOverrides: { 'preference.priorities': ['price'] }, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 500000, maxAmountMinor: 800000 }] }, { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 650000, maxAmountMinor: 980000 }] }] }),
  base('RANK-004', 'rehabilitation priority has one rank owner', { ok: true, rankParticipation: { rehabilitation: 'consumed_by_priority' }, pairwiseInvariant: 'rehab_dedup', items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-b-mock': 'EXACT' } }, { pairwise: 'rehab_dedup', answerOverrides: { 'preference.priorities': ['rehabilitation_capability'], 'health.rehabilitationNeed': 'none' }, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'capability', group: 'specialCare', code: 'rehabilitation_training', status: 'unsupported' }] }] }),
  base('RANK-005', 'not-yet-scorable priority is neutral', { ok: true, pairwiseInvariant: 'not_scorable_priority', items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-b-mock': 'EXACT' } }, { pairwise: 'not_scorable_priority', priorityPair: [['living_environment'], ['food_quality']], pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }] }),
  base('RANK-006', 'stable institution ID is final tie break', { ok: true, sortedIds: ['institution-a-mock', 'institution-b-mock'], items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-b-mock': 'EXACT' } }, { answerOverrides: { 'preference.priorities': ['living_environment'] }, pool: [{ fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }] }),
  hardConflict('RANK-007', 'hard conflict beats every soft factor', { answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_C_MOCK' }], conflictCodes: ['tube_feeding'] }),
  conditional('RANK-008', 'conditional cannot promote to exact', { answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_B_MOCK' }], conditionalCodes: ['tube_feeding'] }),
  unverified('RANK-009', 'unverified cannot promote to exact', { answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_D_MOCK' }], unverifiedCodes: ['tube_feeding'] }),
  base('RANK-010', 'availability does not enter ranking', { ok: true, pairwiseInvariant: 'availability', exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null }, { pairwise: 'availability', pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'availability', value: 'unavailable' }] }] }),
  base('RANK-011', 'one safe candidate returns one card', { ok: true, exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-c-mock': 'INELIGIBLE' }, conditionalCandidates: [], noExactReason: null, cardCount: 1 }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_C_MOCK', patches: [{ op: 'capability', group: 'specialCare', code: 'tube_feeding', status: 'unsupported' }] }], answerOverrides: tubeRequired }),
  base('RANK-012', 'two safe candidates returns two cards', { ok: true, exactMatch: true, items: ['institution-a-mock', 'institution-b-mock'], itemTiers: { 'institution-a-mock': 'EXACT', 'institution-b-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, cardCount: 2 }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }, { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] }], answerOverrides: { 'preference.priorities': ['living_environment'] } }),
  base('RANK-013', 'zero safe candidates does not fill cards', { ok: true, exactMatch: false, items: [], conditionalCandidates: [], itemTiers: { 'institution-c-mock': 'INELIGIBLE', 'institution-d-mock': 'UNVERIFIED' }, noExactReason: 'REQUIRED_CAPABILITY_UNRESOLVED' }, { answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_C_MOCK' }, { fixtureId: 'INSTITUTION_D_MOCK' }] }),
  base('RANK-014', 'repeat invocation is deep equal', { ok: true, exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null, repeat: true }, { repeat: true }),
]

const edgeCases = [
  base('BOUNDARY-5X4-CAPABILITY-MATRIX', 'five care-level rows and four effective states', { ok: true, matrix5x4: true }, { matrix5x4: true }),
  base('BOUNDARY-CARE-LEVEL-NO-INHERITANCE', 'care-level support is not inherited', { ok: true, noCareLevelInheritance: true }, { careLevelMatrix: true }),
  base('BOUNDARY-SPECIAL-CARE-NINE', 'all nine direct special-care rows remain separate', { ok: true, requiredSpecialCareCount: 9 }, { answerOverrides: { ...directCapabilityAnswers('round_the_clock_care'), 'cognitive.specialCareNeeds': ['round_the_clock_care', 'one_to_one_caregiver', 'night_care', 'dementia_unit', 'rehabilitation_training', 'tube_feeding', 'catheter_care', 'pressure_injury_care', 'incontinence_care'], 'health.rehabilitationNeed': 'definite' } }),
  unverified('BOUNDARY-RAW-UNSUPPORTED-UNVERIFIED', 'raw unsupported is effective unknown when unverified', { expected: { effectiveCapability: 'unknown', itemTier: 'UNVERIFIED' }, answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_D_MOCK', patches: [{ op: 'capability', group: 'specialCare', code: 'tube_feeding', status: 'unsupported', verificationStatus: 'unverified' }] }] }),
  unverified('BOUNDARY-EXPIRY', 'valid-until and expired evidence use evaluationAsOf', { expected: { expiredEffective: 'unknown', boundaryEffective: 'supported' }, answerOverrides: tubeRequired, expiry: true, pool: [{ fixtureId: 'INSTITUTION_E_MOCK' }] }),
  base('BOUNDARY-TIME', 'explicit evaluation time is deterministic and required', { ok: true, stableEvaluationAsOf: RECOMMENDATION_FIXTURE_EVALUATION_AS_OF }, { time: true }),
  base('BOUNDARY-REHAB-HARD', 'explicit rehabilitation training is hard', { ok: true, rehabRole: 'HARD' }, { answerOverrides: { 'cognitive.specialCareNeeds': ['rehabilitation_training'], 'health.rehabilitationNeed': 'definite' } }),
  base('BOUNDARY-REHAB-STRONG-SOFT', 'health definite rehabilitation is strong soft', { ok: true, rehabRole: 'STRONG_SOFT_FIT' }, { answerOverrides: { 'health.rehabilitationNeed': 'definite', 'cognitive.specialCareNeeds': ['none'] } }),
  base('BOUNDARY-REHAB-SOFT', 'health possible rehabilitation is soft', { ok: true, rehabRole: 'SOFT_FIT' }, { answerOverrides: { 'health.rehabilitationNeed': 'possible', 'cognitive.specialCareNeeds': ['none'] } }),
  readinessBlocked('BOUNDARY-READINESS', 'clarification blocks eligibility without relabeling institution unknown', { expected: { itemTier: null }, readinessCodes: ['adl.careLevel'], profileFixtureId: 'C14' }),
  base('BOUNDARY-PREVIEW-FORMAL-CORE-PARITY', 'preview and formal share core semantics', { ok: true, previewParity: true }, { kind: 'preview', profileFixtureId: 'C04' }),
  base('BOUNDARY-NO-IDENTITY-CACHE-PERSISTENCE', 'preview has no formal identity or persistence', { ok: true, noFormalIdentity: true }, { kind: 'preview', profileFixtureId: 'C01' }),
  base('BOUNDARY-MANIFEST-EVIDENCE-CLOSURE', 'pool manifest closes every field and evidence reference', { ok: true, manifestEvidenceClosure: true }, {}),
  base('BOUNDARY-MALFORMED-INPUT', 'malformed input returns stable error', { ok: false, errorCode: 'INVALID_PROFILE_ENVELOPE' }, { malformed: true }),
  base('BOUNDARY-MALFORMED-KNOWN-VALUE', 'invalid known derived value is rejected', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { malformedProfile: 'known_value' }),
  base('BOUNDARY-MALFORMED-SPECIAL-STATUS', 'invalid special-care status is rejected', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { malformedProfile: 'special_status' }),
  base('BOUNDARY-MALFORMED-DANGLING-EVIDENCE', 'dangling derived evidence is rejected', { ok: false, errorCode: 'INVALID_PROFILE_EVIDENCE' }, { malformedProfile: 'dangling_evidence' }),
  base('BOUNDARY-MALFORMED-WRONG-FIELD-EVIDENCE', 'cross-field derived evidence is rejected', { ok: false, errorCode: 'INVALID_PROFILE_EVIDENCE' }, { malformedProfile: 'wrong_field_evidence', profileFixtureId: 'C06' }),
  base('BOUNDARY-MALFORMED-DANGLING-CLARIFICATION', 'dangling clarification reference is rejected', { ok: false, errorCode: 'INVALID_PROFILE_CLARIFICATION' }, { malformedProfile: 'dangling_clarification', profileFixtureId: 'C14' }),
  base('BOUNDARY-MALFORMED-WRONG-FIELD-CLARIFICATION', 'cross-field clarification reference is rejected', { ok: false, errorCode: 'INVALID_PROFILE_CLARIFICATION' }, { malformedProfile: 'wrong_field_clarification', profileFixtureId: 'C14', answerOverrides: { 'health.rehabilitationNeed': 'unknown' } }),
  base('BOUNDARY-ADVISORY-ISOLATED', 'availability and upfront advisory are outside semantic core', { ok: true, advisoryIsolated: true }, { advisory: true, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'availability', value: 'unavailable' }] }] }),
  base('BOUNDARY-SNAPSHOT-IMMUTABILITY', 'input and prior snapshots remain unchanged', { ok: true, snapshotImmutable: true }, { snapshotImmutable: true, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'revision', value: 2 }] }] }),
  base('BOUNDARY-PRODUCTION-MOCK-EXCLUSION', 'production mode excludes synthetic records', { ok: true, productionMockExcluded: true, exactMatch: false, items: [], conditionalCandidates: [], itemTiers: {}, noExactReason: 'NO_VERIFIED_INSTITUTION_POOL' }, { datasetMode: 'PRODUCTION' }),
  base('BOUNDARY-MOCKMODE-NONMOCK-EXCLUSION', 'mock mode excludes records explicitly marked non-mock', { ok: true, mockModeNonMockExcluded: true, exactMatch: false, items: [], conditionalCandidates: [], itemTiers: {}, noExactReason: 'NO_VERIFIED_INSTITUTION_POOL' }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'record_provenance', value: 'PRODUCTION_CANDIDATE' }] }] }),
  base('BOUNDARY-RECORD-STATUS-MIXED-MANIFEST', 'draft suspended archived records stay in a closed excluded manifest', { ok: true, recordStatusExclusions: true, exactMatch: true, items: ['institution-a-mock'], itemTiers: { 'institution-a-mock': 'EXACT' }, conditionalCandidates: [], noExactReason: null }, { pool: [
    { fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }] },
    { fixtureId: 'INSTITUTION_B_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'record_status', value: 'draft' }] },
    { fixtureId: 'INSTITUTION_C_MOCK', patches: [{ op: 'record_status', value: 'suspended' }] },
    { fixtureId: 'INSTITUTION_D_MOCK', patches: [{ op: 'record_status', value: 'archived' }] },
  ] }),
  base('BOUNDARY-TIME-OFFSET-EQUIVALENCE', 'equivalent ISO offsets preserve effective status', { ok: true, offsetEquivalent: true }, { answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 }, { op: 'valid_until', fieldPath: 'capabilities.specialCare.tube_feeding', value: RECOMMENDATION_FIXTURE_EVALUATION_AS_OF }] }] }),
  near('BOUNDARY-UNKNOWN-SNAPSHOT-NULL', 'unknown price/type snapshots remain null', { unknownSnapshotsNull: true }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price_unknown' }, { op: 'supported_types_unknown' }] }] }),
  near('BOUNDARY-STARTING-AT-PRICE', 'starting-at price cannot claim exact budget fit', { budgetStatus: 'above_budget', differenceCodes: ['PRICE_UPPER_BOUND_UNKNOWN'] }, { pool: [{ fixtureId: 'INSTITUTION_A_MOCK', patches: [{ op: 'price', minAmountMinor: 1300000, maxAmountMinor: 1300000, kind: 'starting_at' }] }] }),
  base('BOUNDARY-PREVIEW-EXTRA-SOURCE', 'anonymous source rejects undeclared identity/time fields', { ok: false, errorCode: 'INVALID_PROFILE_ENVELOPE' }, { kind: 'preview', malformedProfile: 'extra_preview_source' }),
  base('BOUNDARY-FORMAL-EXTRA-IDENTITY', 'formal identity rejects undeclared extension fields', { ok: false, errorCode: 'INVALID_PROFILE_ENVELOPE' }, { malformedProfile: 'extra_formal_identity' }),
  readinessBlocked('BOUNDARY-REHAB-UNKNOWN-NOT-SOFT-EXCEPTION', 'unknown training requirement cannot use the needs-confirmation-only soft exception', { malformedProfile: 'rehab_unknown', answerOverrides: { 'health.rehabilitationNeed': 'definite', 'cognitive.specialCareNeeds': ['none'] }, readinessCodes: ['specialCare.requiredCareCapabilities.rehabilitation_training'] }),
  base('BOUNDARY-CARD-LIMIT-MAX3', 'four equally eligible synthetic records return exactly three cards and keep four audit entries', {
    ok: true, items: ['institution-top-a-mock', 'institution-top-b-mock', 'institution-top-c-mock'], cardCount: 3,
    sortedIds: ['institution-top-a-mock', 'institution-top-b-mock', 'institution-top-c-mock', 'institution-top-d-mock'],
    itemTiers: { 'institution-top-a-mock': 'EXACT', 'institution-top-b-mock': 'EXACT', 'institution-top-c-mock': 'EXACT', 'institution-top-d-mock': 'EXACT' },
  }, { answerOverrides: { 'preference.priorities': ['living_environment'] }, pool: ['d', 'c', 'b', 'a'].map((suffix) => ({
    fixtureId: 'INSTITUTION_A_MOCK', patches: [
      { op: 'price', minAmountMinor: 800000, maxAmountMinor: 980000 },
      { op: 'institution_id', value: `institution-top-${suffix}-mock` },
    ],
  })) }),
  conditional('BOUNDARY-CONDITIONAL-SUMMARY', 'NO_EXACT_MATCH keeps requires-assessment in unresolved summary with conditional outcome', { expected: { conditionalSummary: true }, answerOverrides: tubeRequired, pool: [{ fixtureId: 'INSTITUTION_B_MOCK' }] }),
  base('BOUNDARY-FORMAL-MISSING-BASIC', 'formal envelope cannot omit basic even though core excludes it', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { malformedProfile: 'missing_basic' }),
  base('BOUNDARY-PREVIEW-MISSING-BASIC', 'preview envelope cannot omit basic even though core excludes it', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { kind: 'preview', malformedProfile: 'missing_basic' }),
  base('BOUNDARY-FORMAL-MISSING-SUMMARY', 'formal envelope cannot omit summary even though core excludes it', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { malformedProfile: 'missing_summary' }),
  base('BOUNDARY-PREVIEW-MISSING-SUMMARY', 'preview envelope cannot omit summary even though core excludes it', { ok: false, errorCode: 'INVALID_PROFILE_SNAPSHOT' }, { kind: 'preview', malformedProfile: 'missing_summary' }),
]

const antiFakeGreenCases = [
  { id: 'ANTI-FAKE-GREEN-MISSING', description: 'manifest rejects a missing fixture', assertionCount: 6, antiFake: 'missing' },
  { id: 'ANTI-FAKE-GREEN-DUPLICATE', description: 'manifest rejects a duplicate fixture id', assertionCount: 6, antiFake: 'duplicate' },
  { id: 'ANTI-FAKE-GREEN-SKIPPED', description: 'manifest rejects an unexecuted fixture', assertionCount: 6, antiFake: 'skipped' },
  { id: 'ANTI-FAKE-GREEN-COUNT-DRIFT', description: 'manifest rejects assertion count drift', assertionCount: 6, antiFake: 'count_drift' },
]

export const recommendationFixtures = Object.freeze([
  ...historicalCases,
  ...recommendationBoundaryCases,
  ...rankCases,
  ...edgeCases,
  ...antiFakeGreenCases,
])

export const RECOMMENDATION_FIXTURE_CASE_IDS = Object.freeze(recommendationFixtures.map((fixture) => fixture.id))

export const makeRawUnsupportedUnverifiedInstitution = () => cloneRecommendationInstitution('INSTITUTION_D_MOCK', [
  { op: 'capability', group: 'specialCare', code: 'tube_feeding', status: 'unsupported', verificationStatus: 'unverified' },
])

export const makeRevisionChangedInstitution = (revision = 2) => cloneRecommendationInstitution('INSTITUTION_A_MOCK', [
  { op: 'revision', value: revision },
])

export const makeExpiredInstitution = () => cloneRecommendationInstitution('INSTITUTION_E_MOCK')

export const makeValidUntilBoundaryInstitution = () => cloneRecommendationInstitution('INSTITUTION_A_MOCK', [
  { op: 'revision', value: 3 },
  { op: 'valid_until', fieldPath: 'capabilities.specialCare.tube_feeding', value: RECOMMENDATION_FIXTURE_EVALUATION_AS_OF },
])

export const FIXTURE_ASSERTION_COUNT = 6

// Keep these exports explicit so the harness can prove it did not silently
// turn a synthetic fixture into production data.
export const FIXTURE_PROVENANCE_ASSERTIONS = Object.freeze({
  recordProvenance: INSTITUTION_FIXTURE_POLICY,
  datasetMode: RECOMMENDATION_FIXTURE_DATASET_MODE,
  dataLabel: RECOMMENDATION_FIXTURE_DATA,
  verificationLabel: RECOMMENDATION_FIXTURE_VERIFICATION,
})

// Imported solely to keep the RESUME fixture dependency visible to reviewers.
export const RESUME_REHABILITATION_CONFLICT_ANSWERS = REHABILITATION_CONFLICT_ANSWERS
