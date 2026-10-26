// SYNTHETIC_TEST_ONLY. Real directory facts are read, never rewritten or promoted.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeAssessmentDraftV2 } from './fixtures/elder-profile-v2-fixtures.mjs'
import {
  INITIAL_REFERENCE_EVALUATION_AS_OF as T,
  makeInitialReferenceRecordV121 as makeRecord,
  makeInitialReferenceCatalogWithRecordsV121 as makeCatalog,
  reidentifyInitialReferenceRecordV121 as reidentify,
  setInitialReferenceMealSupport as mealSupport,
  setInitialReferencePrice as price,
  setInitialReferenceRoomType as room,
  setInitialReferenceMealSchedule as meal,
  setInitialReferenceRegion as region,
} from './fixtures/initial-reference-v1-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { ts } = loadWechatTypeScript()
const clone = value => JSON.parse(JSON.stringify(value))
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}
const area = { kind: 'institution_region', regionCode: '420105', regionLabelSnapshot: '汉阳区', catalogVersion: 'institution-region-catalog-v1' }
const draftFor = (answers = {}) => makeAssessmentDraftV2(answers)
const riskDraft = (answers = {}) => draftFor({ 'health.swallowingAbility': 'occasional_difficulty', ...answers })
const unknownField = () => ({ availability: 'unknown', value: null, verification: { status: 'unverified', evidenceIds: [] } })
let sequence = 0
const capability = (record, group, name, status, verificationStatus = 'verified') => {
  const fieldPath = `capabilities.${group}.${name}`
  record.evidence = record.evidence.filter(item => item.fieldPath !== fieldPath)
  if (status === 'unknown') {
    record.capabilities[group][name] = { code: name, status, verification: { status: 'unverified', evidenceIds: [] } }
    return record
  }
  const evidenceId = `ev-c1-app-${++sequence}`
  const verification = { status: verificationStatus, evidenceIds: [evidenceId], verifiedAt: '2026-10-25T00:00:00.000Z', validUntil: verificationStatus === 'expired' ? '2026-10-25T23:00:00.000Z' : '2027-10-26T00:00:00.000Z' }
  record.capabilities[group][name] = { code: name, status, verification }
  record.evidence.push({ evidenceId, institutionId: record.institutionId, recordRevision: record.recordRevision,
    fieldPath, valueSnapshot: { valueType: 'stable_code', value: status }, sourceType: 'official_document',
    sourceReference: 'https://example.invalid/SYNTHETIC_TEST_ONLY', verificationStatus,
    verifiedAt: verification.verifiedAt, validUntil: verification.validUntil })
  return record
}
const allCapabilities = (record, status) => {
  for (const [group, fields] of Object.entries(record.capabilities)) {
    for (const name of Object.keys(fields)) capability(record, group, name, status)
  }
  return record
}
const unknownRecord = (id = 'c1-app-reference') => reidentify(allCapabilities(makeRecord(), 'unknown'), id)
const knownRecord = (id = 'c1-app-legacy') => reidentify(allCapabilities(makeRecord(), 'supported'), id)
const removeFact = (record, fieldPath) => {
  const parts = fieldPath.split('.'), key = parts.pop()
  const owner = parts.reduce((value, part) => value[part], record)
  owner[key] = unknownField()
  record.evidence = record.evidence.filter(item => item.fieldPath !== fieldPath)
  return record
}

function createHost(appRoot = path.join(root, 'miniprogram')) {
  const realCalls = []
  let initializingOldStore = false, memoryBootstrapReads = 0
  const wx = new Proxy({}, { get(_target, key) {
    return () => {
      if (initializingOldStore && key === 'getStorageSync') { memoryBootstrapReads++; return undefined }
      realCalls.push(String(key)); throw Error(`Real side effect forbidden: ${String(key)}`)
    }
  } })
  const runtime = createWechatTsRuntime(ts, { wx })
  const load = file => runtime.load(path.join(appRoot, `${file}.ts`))
  const wrapper = load('services/initial-reference-preview-v1')
  assert.equal(realCalls.length, 0, 'C1 module import must not initialize store or wx')
  const catalogApi = load('services/institution-catalog-v1-2-1')
  const composition = load('domain/recommendation/initial-reference-v1/composition')
  initializingOldStore = true
  const legacyApi = load('services/recommendation-preview-v2')
  initializingOldStore = false
  const vm = load('pages/recommendation/result-v2-view-model')
  const buildOracle = async (catalog, draft, at) => legacyApi.createRecommendationPreviewServiceV2({
    draftSource: { getDraft: () => clone(draft) },
    institutionCatalog: catalogApi.createInstitutionCatalogServiceV11Adapter(catalogApi.createInstitutionCatalogServiceV121({ loadCatalog: async () => clone(catalog) })),
  }).buildResultSnapshot(at)
  const run = async (catalog, draft = riskDraft({ 'preference.region': area }), options = {}) => {
    const at = options.at || T
    const before = JSON.stringify({ catalog, draft })
    freeze(catalog); freeze(draft)
    const counts = { provider: 0, draft: 0, factory: 0, engine: 0, times: [] }
    const port = options.catalogPort || catalogApi.createInstitutionCatalogServiceV121({ loadCatalog: async () => {
      counts.provider++; if (options.rejectProvider) throw Error('synthetic provider failure')
      return catalog
    } })
    const service = wrapper.createInitialReferencePreviewServiceV1({
      draftSource: { getDraft: () => { counts.draft++; if (options.rejectDraft) throw Error('synthetic draft failure'); return draft } },
      institutionCatalogV121: port,
      expectedDatasetMode: options.expectedMode || catalog.datasetMode,
      createLegacyV2Service: deps => {
        counts.factory++
        const original = legacyApi.createRecommendationPreviewServiceV2(deps)
        return { ...original, buildResultSnapshot: async time => { counts.engine++; counts.times.push(time); return original.buildResultSnapshot(time) } }
      },
    })
    const result = await service.build(at)
    assert.equal(JSON.stringify({ catalog, draft }), before, 'C1 input immutable')
    assert.equal(counts.draft, 1, 'capture one draft')
    assert.equal(counts.factory, options.rejectDraft ? 0 : 1)
    assert.equal(counts.engine, options.rejectDraft ? 0 : 1, 'invoke old snapshot builder once')
    if (!options.rejectDraft) assert.deepStrictEqual(counts.times, [at])
    assert.deepStrictEqual(realCalls, [], 'zero real storage/login/network/phone/location/booking/payment calls')
    if (result.ok) {
      assert.equal(counts.provider, 1)
      const oracle = await buildOracle(catalog, draft, at)
      assert.equal(oracle.ok, true)
      assert.deepStrictEqual(clone(result.value.legacyV2), clone(oracle.value), 'COMPLETE independent legacyV2 oracle')
      assert.equal(result.value.legacyPresentationState, vm.createRecommendationResultViewModelV2(oracle.value).state)
      assert.equal(result.value.evaluationAsOf, at)
      assert.equal(result.value.legacyV2.sourceContext.evaluationAsOf, at)
      assert.equal(result.value.persistence, 'FORBIDDEN')
      assert.ok(result.value.displayedReferenceCards.length <= 3)
      for (const card of result.value.displayedReferenceCards) {
        assert.equal(card.category, 'INITIAL_REFERENCE')
        assert.equal(card.publicDetailTarget.recordRevision, card.recordRevision)
        assert.deepStrictEqual(clone(card.elderClarifications), clone(oracle.value.preview.semantics.elderClarifications))
        assert.deepStrictEqual(clone(card.requirementReadiness), clone(oracle.value.preview.semantics.requirementReadiness))
        assert.equal(card.institutionFacts.evaluationAsOf, at)
        assert.ok(card.referenceReasons.every(reason => reason.status === 'MATCHED'))
      }
      const originalJSON = JSON.stringify({ catalog, draft })
      result.value.legacyV2.preview.semantics.datasetVersion = 'consumer-local-mutation'
      assert.equal(JSON.stringify({ catalog, draft }), originalJSON, 'returned data cannot write through to source')
      result.value.legacyV2.preview.semantics.datasetVersion = oracle.value.preview.semantics.datasetVersion
    } else {
      assert.equal(Object.prototype.hasOwnProperty.call(result.error, 'legacyV2'), false, 'pre-composition failures must not fake a successful legacy snapshot')
    }
    return { result, counts }
  }
  return { runtime, load, catalogApi, composition, wrapper, legacyApi, vm, run, buildOracle, realCalls,
    getBootstrapReads: () => memoryBootstrapReads }
}

let branches = 0
const groups = new Set()
const check = async (id, action) => { await action(); branches++; groups.add(id); console.log(`PASS ${id} branch ${branches}`) }
const expectState = (result, state) => { assert.equal(result.ok, true, result.error?.causeCode); assert.equal(result.value.state, state); return result.value }
const categories = card => clone(card.matchedCategories)
const host = createHost()

await check('R01', async () => {
  const { result } = await host.run(makeCatalog([unknownRecord()]), draftFor({ 'preference.region': area }))
  const value = expectState(result, 'INITIAL_REFERENCE_ONLY')
  assert.deepStrictEqual(categories(value.displayedReferenceCards[0]), ['AREA'])
  assert.ok(value.displayedReferenceCards[0].institutionCapabilityUnknowns.length > 0)
  assert.ok(value.displayedReferenceCards[0].warningCodes.includes('K0'))
})
await check('R02', async () => {
  const record = unknownRecord()
  removeFact(record, 'meal.easyChewSupport'); removeFact(record, 'meal.modifiedFoodSupport')
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'budget.monthlyRange': 'cny_5000_8000' }))
  const card = expectState(result, 'INITIAL_REFERENCE_ONLY').displayedReferenceCards[0]
  assert.deepStrictEqual(categories(card), ['BUDGET'])
  assert.equal(card.institutionFacts.meal.modifiedFoodSupport.raw.availability, 'unknown')
  assert.ok(card.elderClarifications.some(item => item.clarificationId.includes('swallowing') || JSON.stringify(item).includes('swallowing')))
})
await check('R03', async () => {
  const record = unknownRecord()
  capability(record, 'cognitiveSupport', 'wandering_risk_support', 'unsupported')
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'preference.region': area, 'cognitive.symptoms': ['wandering_risk'] }))
  const value = expectState(result, 'NO_PERSONALIZED_CANDIDATE')
  assert.ok(value.referenceEvaluations[0].exclusionCodes.includes('LEGACY_CONSTRAINT_CONFLICT'))
})
for (const [need, field] of [['easy_chew', 'easyChewSupport'], ['modified_food', 'modifiedFoodSupport']]) {
  for (const verification of ['verified', 'unverified', 'expired']) await check('R03', async () => {
    const record = mealSupport(unknownRecord(), field, 'unavailable', verification)
    const { result } = await host.run(makeCatalog([record]), riskDraft({ 'preference.region': area, 'health.chewingAbility': need }))
    const value = expectState(result, verification === 'verified' ? 'NO_PERSONALIZED_CANDIDATE' : 'INITIAL_REFERENCE_ONLY')
    assert.equal(value.referenceEvaluations[0].exclusionCodes.includes('REFERENCE_FOOD_TEXTURE_UNSUPPORTED'), verification === 'verified')
  })
}
for (const kind of ['requires_inquiry', 'raw_unavailable', 'future_verified']) await check('R03', async () => {
  const record = unknownRecord()
  if (kind === 'raw_unavailable') {
    removeFact(record, 'meal.easyChewSupport')
    record.meal.easyChewSupport.availability = 'unavailable'
  } else {
    mealSupport(record, 'easyChewSupport', kind === 'requires_inquiry' ? kind : 'unavailable')
    if (kind === 'future_verified') {
      const field = record.meal.easyChewSupport
      field.verification.verifiedAt = '2026-10-27T00:00:00.000Z'
      record.evidence.find(item => item.evidenceId === field.verification.evidenceIds[0]).verifiedAt = field.verification.verifiedAt
    }
  }
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'preference.region': area, 'health.chewingAbility': 'easy_chew' }))
  expectState(result, 'INITIAL_REFERENCE_ONLY')
})
await check('R03', async () => {
  const record = capability(unknownRecord(), 'cognitiveSupport', 'wandering_risk_support', 'unsupported', 'expired')
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'preference.region': area, 'cognitive.symptoms': ['wandering_risk'] }))
  expectState(result, 'INITIAL_REFERENCE_ONLY')
})
await check('R04', async () => {
  const { result } = await host.run(makeCatalog([unknownRecord()]), riskDraft({ 'preference.region': area, 'cognitive.symptoms': ['wandering_risk', 'mood_instability'], 'adl.mobility': 'wheelchair', 'adl.eating': 'unknown' }))
  const value = expectState(result, 'INITIAL_REFERENCE_ONLY')
  assert.ok(value.displayedReferenceCards[0].elderClarifications.length > 3, 'all multi-risk warnings retained')
  assert.equal(value.legacyV2.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
})
await check('R05', async () => {
  const { result } = await host.run(makeCatalog([unknownRecord()]), draftFor())
  expectState(result, 'NO_PERSONALIZED_CANDIDATE')
})
for (const tier of ['EXACT', 'SOFT_NEAR', 'CONDITIONAL']) await check('R06', async () => {
  const record = knownRecord()
  price(record, { minAmountMinor: tier === 'SOFT_NEAR' ? 900000 : 650000, maxAmountMinor: tier === 'SOFT_NEAR' ? 1000000 : 700000 })
  if (tier === 'CONDITIONAL') capability(record, 'careLevelAcceptance', 'independent', 'requires_assessment')
  mealSupport(record, 'modifiedFoodSupport', 'unavailable')
  const { result } = await host.run(makeCatalog([record, unknownRecord('c1-other-reference')]), draftFor({ 'budget.monthlyRange': 'cny_5000_8000', 'health.chewingAbility': 'modified_food' }))
  const value = expectState(result, 'LEGACY_V2_DISPLAY')
  const semantics = value.legacyV2.preview.semantics
  const cards = semantics.cards.length ? semantics.cards : semantics.conditionalCandidates
  assert.equal(cards.length, 1)
  assert.equal(cards[0].matchTier, tier)
  assert.equal(value.referenceEvaluations.length, 0, 'do not evaluate references to fill old cards')
  assert.equal(value.displayedReferenceCards.length, 0)
})
await check('R07', async () => {
  const make = (id, count) => {
    const record = unknownRecord(id)
    if (count === 3) { room(record, 'single'); meal(record, 'three_meals') }
    else { room(record, 'double'); meal(record, 'three_meals_one_snack') }
    price(record, count === 1 ? { minAmountMinor: 1000000, maxAmountMinor: 1100000 } : { minAmountMinor: 650000, maxAmountMinor: 700000 })
    return record
  }
  const records = [make('c1-rank-z', 2), make('c1-rank-c', 1), make('c1-rank-a', 2), make('c1-rank-top', 3)]
  const permutations = items => items.length === 0 ? [[]] : items.flatMap((item, index) => permutations(items.filter((_v, i) => i !== index)).map(rest => [item, ...rest]))
  for (const permutation of permutations(records)) {
    const { result } = await host.run(makeCatalog(permutation), draftFor({ 'preference.region': area, 'budget.monthlyRange': 'cny_5000_8000', 'preference.roomType': 'single', 'preference.mealSchedule': 'three_meals' }))
    const value = expectState(result, 'INITIAL_REFERENCE_ONLY')
    assert.deepStrictEqual(clone(value.displayedReferenceCards.map(card => card.institutionId)), ['c1-rank-top', 'c1-rank-a', 'c1-rank-z'])
    assert.deepStrictEqual(clone(value.eligibleReferenceCandidates.map(card => card.matchedCategories.length)), [3, 2, 2, 1])
  }
  console.log('R07_PERMUTATIONS: 24/24 PASS')
})
await check('R08', async () => {
  const archive = unknownRecord(), current = reidentify(archive, archive.institutionId, archive.recordRevision + 1)
  const catalog = makeCatalog([current])
  const draft = riskDraft({ 'preference.region': area })
  const { result } = await host.run(catalog, draft)
  const value = expectState(result, 'INITIAL_REFERENCE_ONLY')
  assert.equal(value.displayedReferenceCards[0].recordRevision, current.recordRevision)
  const oracle = await host.buildOracle(catalog, draft, T)
  for (const mutate of [
    snapshot => { snapshot.preview.semantics.candidateEvaluations = [] },
    snapshot => { snapshot.preview.semantics.candidateEvaluations.push(clone(snapshot.preview.semantics.candidateEvaluations[0])) },
    snapshot => { snapshot.preview.semantics.candidateEvaluations[0].recordRevision = archive.recordRevision },
    snapshot => { snapshot.preview.semantics.poolManifest.entries[0].recordRevision = archive.recordRevision },
    snapshot => { snapshot.institutionDisplays[0].recordRevision = archive.recordRevision },
    snapshot => { snapshot.preview.semantics.candidateEvaluations[0].constraintResults[0].institutionEvidenceRefs[0].recordRevision = archive.recordRevision },
    snapshot => { snapshot.sourceContext.evaluationAsOf = '2026-10-27T00:00:00.000Z' },
    snapshot => { snapshot.preview.semantics.poolManifest.entries[0].evidence[0].recordRevision = archive.recordRevision },
    snapshot => { snapshot.preview.semantics.poolManifest.entries.push(clone(snapshot.preview.semantics.poolManifest.entries[0])) },
  ]) {
    const bad = clone(oracle.value); mutate(bad)
    const failure = host.composition.composeReferenceResultV1({ catalog, legacyV2: bad, evaluationAsOf: T, expectedDatasetMode: catalog.datasetMode })
    assert.equal(failure.ok, false); assert.equal(failure.error.state, 'DATA_ERROR')
    assert.deepStrictEqual(clone(failure.error.legacyV2), bad)
  }
  for (const broken of [makeCatalog([archive, current]), { ...clone(catalog), currentPointers: [{ institutionId: current.institutionId, recordRevision: 999 }] }]) {
    const { result: bad } = await host.run(broken, draft)
    assert.equal(bad.ok, false); assert.equal(bad.error.state, 'DATA_ERROR')
  }
})
await check('R09', async () => {
  const bad = unknownRecord('c1-bad'); bad.evidence[0].recordRevision += 99
  const { result } = await host.run(makeCatalog([unknownRecord('c1-good'), bad]))
  assert.equal(result.ok, false); assert.equal(result.error.state, 'DATA_ERROR')
  assert.equal(result.error.recordIndex, 1, 'retain original invalid-record index')
  const rejected = await host.run(makeCatalog([unknownRecord()]), undefined, { rejectProvider: true })
  assert.equal(rejected.result.error.state, 'SERVICE_ERROR'); assert.equal(rejected.counts.provider, 1)
  const empty = await host.run(makeCatalog([]))
  assert.equal(empty.result.error.causeCode, 'NO_INSTITUTIONS_AVAILABLE')
  const missing = await host.run(makeCatalog([unknownRecord()]), draftFor({ 'basic.gender': undefined }))
  assert.equal(missing.result.error.state, 'ASSESSMENT_ERROR'); assert.equal(missing.counts.provider, 0)
  const v1 = await host.run(makeCatalog([unknownRecord()]), { schemaVersion: 1 })
  assert.equal(v1.result.error.state, 'ASSESSMENT_ERROR'); assert.equal(v1.counts.provider, 0)
  const failedDraft = await host.run(makeCatalog([unknownRecord()]), undefined, { rejectDraft: true })
  assert.equal(failedDraft.result.error.causeCode, 'DRAFT_READ_FAILED'); assert.equal(failedDraft.counts.provider, 0)
  const returnedFailure = await host.run(makeCatalog([unknownRecord()]), undefined, { catalogPort: { loadCatalog: async () => ({ ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }) } })
  assert.equal(returnedFailure.result.error.state, 'SERVICE_ERROR')
  const invalidTime = await host.run(makeCatalog([unknownRecord()]), undefined, { at: 'invalid-time' })
  assert.equal(invalidTime.result.error.causeCode, 'INVALID_EVALUATION_AS_OF')
})
await check('R10', async () => {
  const { result } = await host.run(makeCatalog([unknownRecord('c1-nosafe-a'), unknownRecord('c1-nosafe-b')]))
  const value = expectState(result, 'INITIAL_REFERENCE_ONLY')
  assert.equal(value.displayedReferenceCards.length, 2)
  assert.equal(value.legacyPresentationState, 'no_safe_recommendation')
  assert.equal(value.legacyV2.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
})
for (const options of [
  { verificationStatus: 'expired' }, { rangeKind: 'starting_at' }, { asOf: '2026-10-27T00:00:00.000Z' },
]) await check('R11', async () => {
  const record = price(unknownRecord(), options)
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'budget.monthlyRange': 'cny_5000_8000' }))
  expectState(result, 'NO_PERSONALIZED_CANDIDATE')
})
for (const [budget, min, max] of [['cny_5000_8000', 800000, 900000], ['cny_15000_plus', 1500000, 1800000]]) await check('R11', async () => {
  const record = price(unknownRecord(), { minAmountMinor: min, maxAmountMinor: max, validUntil: T })
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'budget.monthlyRange': budget }))
  assert.deepStrictEqual(categories(expectState(result, 'INITIAL_REFERENCE_ONLY').displayedReferenceCards[0]), ['BUDGET'])
})
await check('R11', async () => {
  const record = removeFact(unknownRecord(), 'price.referenceMonthlyPrice')
  removeFact(record, 'price.priceNote')
  record.price.priceNote = { availability: 'provided', value: 'SYNTHETIC 首月优惠/单项床费/押金 1 元，不是常态月总价', verification: { status: 'unverified', evidenceIds: [] } }
  const { result } = await host.run(makeCatalog([record]), riskDraft({ 'budget.monthlyRange': 'cny_5000_8000' }))
  expectState(result, 'NO_PERSONALIZED_CANDIDATE')
  for (const mutate of [field => { field.value.basis = 'first_month' }, field => { field.value.range.period = 'one_time' }, field => { delete field.value.range.max }, field => { field.value.range.min.amountMinor = Number.MAX_SAFE_INTEGER + 1 }]) {
    const invalid = unknownRecord(); mutate(invalid.price.referenceMonthlyPrice)
    const { result: bad } = await host.run(makeCatalog([invalid]), riskDraft({ 'budget.monthlyRange': 'cny_5000_8000' }))
    assert.equal(bad.ok, false); assert.equal(bad.error.state, 'DATA_ERROR')
  }
})

await check('R12', async () => {
  const mock = makeCatalog([unknownRecord()])
  const rejected = await host.run(mock, undefined, { expectedMode: 'PRODUCTION' })
  assert.equal(rejected.result.error.state, 'DATA_ERROR')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c1-reference-'))
  try {
    const filter = file => fs.statSync(file).isDirectory() || /\.(ts|json)$/.test(file)
    fs.cpSync(path.join(root, 'miniprogram'), tmp, { recursive: true, filter })
    fs.cpSync(path.join(root, 'modes/production'), path.join(tmp, 'production'), { recursive: true, filter })
    const prod = createHost(tmp)
    const resolver = prod.load('production/administrative-divisions').administrativeDivisionResolver
    prod.load('runtime/institution-validation').institutionValidationOptions.administrativeDivisionResolver = resolver
    const catalog = prod.load('production/catalog').buildProductionCatalog()
    assert.equal(catalog.records.length, 11)
    assert.equal(catalog.datasetMode, 'PRODUCTION')
    assert.equal(prod.catalogApi.validateInstitutionCatalogPayloadV121(catalog).ok, true)
    const facts = prod.load('domain/recommendation/initial-reference-v1/institution-facts').projectReferenceInstitutionFactsV1(catalog, T)
    assert.equal(facts.ok, true)
    assert.equal(facts.value.institutions.filter(item => item.price.referenceMonthlyPrice.effectiveValue !== null).length, 0)
    assert.equal(facts.value.institutions.filter(item => item.meal.mealSchedule.effectiveValue !== null).length, 0)
    assert.equal(facts.value.institutions.flatMap(item => item.rooms).filter(item => item.roomType.effectiveValue !== null).length, 0)
    const accepted = await prod.run(catalog, riskDraft({ 'preference.region': area }), { expectedMode: 'PRODUCTION' })
    for (const card of expectState(accepted.result, 'INITIAL_REFERENCE_ONLY').displayedReferenceCards) assert.deepStrictEqual(categories(card), ['AREA'])
    expectState((await prod.run(catalog, riskDraft(), { expectedMode: 'PRODUCTION' })).result, 'NO_PERSONALIZED_CANDIDATE')
    assert.equal((await prod.run(catalog, undefined, { expectedMode: 'MOCK_DEVELOPMENT_ONLY' })).result.error.state, 'DATA_ERROR')
    const mixed = clone(catalog); mixed.records.push(unknownRecord('c1-mixed-mock')); mixed.currentPointers.push({ institutionId: 'c1-mixed-mock', recordRevision: mixed.records[mixed.records.length - 1].recordRevision })
    assert.equal((await prod.run(mixed, undefined, { expectedMode: 'PRODUCTION' })).result.error.state, 'DATA_ERROR')
    const demo = JSON.parse(fs.readFileSync(path.join(root, 'modes/demo/institutions.json'), 'utf8'))
    expectState((await host.run(demo, riskDraft({ 'budget.monthlyRange': 'cny_5000_8000' }), { expectedMode: 'MOCK_DEVELOPMENT_ONLY' })).result, 'INITIAL_REFERENCE_ONLY')
    assert.equal((await host.run(demo, undefined, { expectedMode: 'PRODUCTION' })).result.error.state, 'DATA_ERROR')
    console.log('R12_PRODUCTION: 11 validated real-source records; AREA only; no synthetic provenance upgrade')
  } finally {
    const resolved = fs.realpathSync(tmp), parent = fs.realpathSync(os.tmpdir())
    assert.equal(path.dirname(resolved), parent); assert.ok(path.basename(resolved).startsWith('c1-reference-'))
    fs.rmSync(resolved, { recursive: true, force: true })
  }
})

await check('R09', async () => {
  const catalog = makeCatalog([unknownRecord()]), draft = riskDraft({ 'preference.region': area })
  let providerReads = 0, draftReads = 0, builds = 0
  const times = [T, '2026-10-26T05:00:00.000Z']
  const service = host.wrapper.createInitialReferencePreviewServiceV1({
    draftSource: { getDraft() { draftReads++; return draft } },
    institutionCatalogV121: host.catalogApi.createInstitutionCatalogServiceV121({ loadCatalog: async () => { providerReads++; await new Promise(resolve => setTimeout(resolve, 1)); return catalog } }),
    expectedDatasetMode: 'MOCK_DEVELOPMENT_ONLY',
    createLegacyV2Service: deps => { const old = host.legacyApi.createRecommendationPreviewServiceV2(deps); return { ...old, buildResultSnapshot: time => { builds++; return old.buildResultSnapshot(time) } } },
  })
  const results = await Promise.all(times.map(time => service.build(time)))
  assert.equal(providerReads, 2); assert.equal(draftReads, 2); assert.equal(builds, 2)
  for (let i = 0; i < 2; i++) {
    const value = expectState(results[i], 'INITIAL_REFERENCE_ONLY')
    assert.deepStrictEqual(clone(value.legacyV2), clone((await host.buildOracle(catalog, draft, times[i])).value))
    assert.equal(value.evaluationAsOf, times[i])
  }
})

// Complete program diagnostics + official WeChat typings, then ES5 JS AST checks.
const newSources = ['types/initial-reference-v1.ts', 'domain/recommendation/initial-reference-v1/institution-facts.ts', 'domain/recommendation/initial-reference-v1/eligibility.ts', 'domain/recommendation/initial-reference-v1/composition.ts', 'services/initial-reference-preview-v1.ts'].map(file => path.join(root, 'miniprogram', file))
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const options = { ...parsed.options, noEmit: false, target: ts.ScriptTarget.ES5, skipLibCheck: false, noEmitOnError: true }
const program = ts.createProgram([...newSources, path.join(root, 'typings/index.d.ts')], options)
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n' }))
let emitted = 0
const output = program.emit(undefined, (file, text) => {
  if (!file.endsWith('.js')) return
  emitted++
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.ES5, true, ts.ScriptKind.JS)
  assert.equal(ast.parseDiagnostics.length, 0)
  const visit = node => {
    assert.ok(!ts.isPropertyDeclaration(node), `class field emitted in ${file}`)
    assert.ok(node.kind !== ts.SyntaxKind.QuestionDotToken, `optional-chain token emitted in ${file}`)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('.'), 'no external runtime imports')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
})
assert.equal(output.emitSkipped, false); assert.ok(emitted >= 5)
assert.deepStrictEqual(host.realCalls, [])
assert.deepStrictEqual([...groups].sort(), Array.from({ length: 12 }, (_v, i) => `R${String(i + 1).padStart(2, '0')}`).sort())
console.log(`R01_R12: 12/12 PASS; ${branches} branch groups, plus 24 permutations and association/error subcases`)
console.log(`C1_FULL_TYPECHECK: PASS; official WeChat typings; TypeScript ${ts.version}; ${emitted} transitive JS modules emitted in memory`)
console.log('C1_ES5_EMITTED_COMPATIBILITY: PASS; class fields/optional chains/external runtime imports = 0')
console.log(`OLD_STORE_ISOLATED_MEMORY_BOOTSTRAP_READS: ${host.getBootstrapReads()}; C1_REAL_SIDE_EFFECTS: 0`)
console.log('C1_REFERENCE_COMPOSITION_RUNTIME = PASS')
