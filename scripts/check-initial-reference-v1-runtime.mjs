import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INITIAL_REFERENCE_EVALUATION_AS_OF,
  cloneInitialReferenceCatalogV121,
  makeInitialReferenceArchiveCurrentSidecarPair,
  makeInitialReferenceBrokenEvidenceCatalogV121,
  makeInitialReferenceCatalogV121,
  makeInitialReferenceCatalogWithRecordsV121,
  makeInitialReferenceFutureRegionAsOfRecordV121,
  makeInitialReferenceRecordV121,
  makeInitialReferenceUnpublishedCatalogV121,
  makeInitialReferenceUnknownMealScheduleRecordV121,
  makeInitialReferenceUnverifiedRegionRecordV121,
  makeInitialReferenceWanderingCapabilityRecordV121,
  reidentifyInitialReferenceRecordV121,
  setInitialReferenceMealSchedule,
  setInitialReferenceMealSupport,
  setInitialReferencePrice,
  setInitialReferenceRegion,
  setInitialReferenceRoomType,
} from './fixtures/initial-reference-v1-fixtures.mjs'
import { makeV2Draft } from './fixtures/assessment-v2-fixtures.mjs'
import {
  createWechatTsRuntime,
  loadWechatTypeScript,
} from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repositoryRoot, 'miniprogram')
const factsOnly = process.argv.includes('--facts-only')
const policyOnly = process.argv.includes('--policy-only')

const clone = (value) => JSON.parse(JSON.stringify(value))

const main = async () => {
  assert.equal(factsOnly && policyOnly, false, 'choose one C1 gate mode')
  const { ts, file: typescriptPath } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts)
  const catalogApi = runtime.load(path.join(appRoot, 'services', 'institution-catalog-v1-2-1.ts'))
  const factsApi = runtime.load(path.join(
    appRoot,
    'domain',
    'recommendation',
    'initial-reference-v1',
    'institution-facts.ts',
  ))
  assert.equal(
    typeof factsApi.projectReferenceInstitutionFactsV1,
    'function',
    'A1 projection export must be available',
  )

  const validateFixture = (catalog, label) => {
    const result = catalogApi.validateInstitutionCatalogPayloadV121(catalog)
    assert.equal(result.ok, true, `${label} must pass original V1.2.1 validator`)
    return result.value
  }
  const project = (catalog, evaluationAsOf = INITIAL_REFERENCE_EVALUATION_AS_OF) =>
    factsApi.projectReferenceInstitutionFactsV1(catalog, evaluationAsOf)

  const legalCatalog = validateFixture(makeInitialReferenceCatalogV121(), 'base fixture')
  const sourceBefore = JSON.stringify(legalCatalog)
  const projected = project(legalCatalog)
  assert.equal(projected.ok, true, 'legal fixture projection')
  assert.equal(projected.value.kind, 'initial_reference_institution_facts_v1')
  assert.equal(projected.value.policyVersion, 'initial-reference-policy-v1')
  assert.equal(projected.value.datasetVersion, legalCatalog.datasetVersion)
  assert.equal(projected.value.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
  assert.equal(projected.value.evaluationAsOf, INITIAL_REFERENCE_EVALUATION_AS_OF)
  assert.equal(projected.value.institutions.length, 1)

  const institution = projected.value.institutions[0]
  assert.equal(institution.institutionId, legalCatalog.records[0].institutionId)
  assert.equal(institution.recordRevision, legalCatalog.currentPointers[0].recordRevision)
  assert.equal(institution.currentPointer.institutionId, institution.institutionId)
  assert.equal(institution.identity.regionCode.effectiveStatus, 'current_verified')
  assert.equal(institution.identity.regionCode.effectiveValue, '420105')
  assert.equal(institution.price.referenceMonthlyPrice.effectiveStatus, 'current_verified')
  assert.equal(institution.rooms[0].fieldPath, 'rooms.0.roomType')
  assert.equal(institution.rooms[0].roomType.effectiveValue, 'single')
  assert.equal(institution.meal.mealSchedule.effectiveValue, 'three_meals')
  assert.ok(institution.identity.regionCode.evidence.length > 0)
  assert.ok(institution.identity.regionCode.evidence.every((item) =>
    item.institutionId === institution.institutionId
    && item.recordRevision === institution.recordRevision
    && item.fieldPath === 'identity.regionCode'))
  assert.equal(JSON.stringify(legalCatalog), sourceBefore, 'projection must not mutate the validated catalog')
  assert.deepEqual(
    Object.keys(institution).sort(),
    [
      'currentPointer', 'datasetMode', 'datasetVersion', 'evaluationAsOf',
      'identity', 'institutionId', 'meal', 'price', 'recordProvenance',
      'recordRevision', 'recordStatus', 'rooms',
    ].sort(),
    'projection must expose only the C1 fact whitelist',
  )
  assert.ok(!Object.hasOwn(institution, 'publicLocation'))
  assert.ok(!Object.hasOwn(institution, 'officialContact'))

  const unverifiedCatalog = validateFixture(
    makeInitialReferenceCatalogV121(makeInitialReferenceUnverifiedRegionRecordV121()),
    'unverified region fixture',
  )
  const unverifiedProjection = project(unverifiedCatalog)
  assert.equal(unverifiedProjection.ok, true, 'legal unverified region fact remains a usable projection')
  assert.equal(unverifiedProjection.value.institutions[0].identity.regionCode.effectiveStatus, 'unverified')
  assert.equal(unverifiedProjection.value.institutions[0].identity.regionCode.effectiveValue, null)

  const unknownCatalog = validateFixture(
    makeInitialReferenceCatalogV121(makeInitialReferenceUnknownMealScheduleRecordV121()),
    'unknown meal schedule fixture',
  )
  const unknownProjection = project(unknownCatalog)
  assert.equal(unknownProjection.ok, true, 'legal unknown fact remains a usable projection')
  assert.equal(unknownProjection.value.institutions[0].meal.mealSchedule.effectiveStatus, 'unknown')
  assert.equal(unknownProjection.value.institutions[0].meal.mealSchedule.effectiveValue, null)
  assert.deepEqual(
    clone(unknownProjection.value.institutions[0].meal.mealSchedule.evidence),
    [],
  )

  const futureAsOfCatalog = validateFixture(
    makeInitialReferenceCatalogV121(makeInitialReferenceFutureRegionAsOfRecordV121()),
    'future asOf fixture',
  )
  const futureAsOfProjection = project(futureAsOfCatalog)
  assert.equal(futureAsOfProjection.ok, true, 'a valid future-dated field does not invalidate its record')
  assert.notEqual(
    futureAsOfProjection.value.institutions[0].identity.regionCode.effectiveStatus,
    'current_verified',
    'future asOf cannot provide positive evidence at T',
  )
  assert.equal(futureAsOfProjection.value.institutions[0].identity.regionCode.effectiveValue, null)

  const unpublishedCatalog = validateFixture(
    makeInitialReferenceUnpublishedCatalogV121(),
    'unpublished current fixture',
  )
  const unpublishedProjection = project(unpublishedCatalog)
  assert.equal(unpublishedProjection.ok, true)
  assert.equal(
    unpublishedProjection.value.institutions.length,
    0,
    'valid non-published current records are skipped from the C1 facts projection',
  )

  const brokenEvidenceCatalog = makeInitialReferenceBrokenEvidenceCatalogV121()
  const brokenEvidenceValidation = catalogApi.validateInstitutionCatalogPayloadV121(brokenEvidenceCatalog)
  assert.equal(brokenEvidenceValidation.ok, false, 'original V1.2.1 validator must reject broken evidence closure')
  const brokenEvidenceProjection = project(brokenEvidenceCatalog)
  assert.equal(brokenEvidenceProjection.ok, false)
  assert.equal(brokenEvidenceProjection.error.state, 'DATA_ERROR')
  assert.equal(brokenEvidenceProjection.error.code, 'INVALID_CATALOG')
  assert.ok(brokenEvidenceProjection.error.causeCode)

  const invalidTime = project(legalCatalog, 'not-an-iso-timestamp')
  assert.equal(invalidTime.ok, false)
  assert.equal(invalidTime.error.state, 'DATA_ERROR')
  assert.equal(invalidTime.error.code, 'INVALID_EVALUATION_AS_OF')

  const detachedCatalog = cloneInitialReferenceCatalogV121(legalCatalog)
  const detachedInput = clone(detachedCatalog)
  const secondProjection = project(detachedCatalog)
  assert.equal(secondProjection.ok, true)
  assert.deepEqual(detachedCatalog, detachedInput, 'projection input stays unchanged on repeated use')

  console.log(`WECHAT_TYPESCRIPT: ${typescriptPath}`)
  console.log('A1_VALID_V121_FIXTURE: PASS')
  console.log('A1_C1_FACT_WHITELIST_AND_EVIDENCE_BINDING: PASS')
  console.log('A1_UNKNOWN_AND_FUTURE_ASOF_PROJECTION: PASS')
  console.log('A1_INVALID_CATALOG_AND_UNPUBLISHED_NEGATIVES: PASS')
  console.log('A1_INPUT_IMMUTABILITY: PASS')

  if (factsOnly) {
    console.log('FACTS_ONLY: YES')
    console.log('A2_POLICY_EXECUTION: NOT_RUN')
    console.log('A3_COMPOSITION_EXECUTION: NOT_RUN')
    return
  }

  const wxCalls = []
  const policyRuntime = createWechatTsRuntime(ts, {
    wx: {
      getStorageSync(key) { wxCalls.push(`get:${key}`); return undefined },
      setStorageSync(key) { wxCalls.push(`set:${key}`) },
      removeStorageSync(key) { wxCalls.push(`remove:${key}`) },
    },
  })
  const policyCatalogApi = policyRuntime.load(path.join(appRoot, 'services', 'institution-catalog-v1-2-1.ts'))
  const policyFactsApi = policyRuntime.load(path.join(
    appRoot,
    'domain',
    'recommendation',
    'initial-reference-v1',
    'institution-facts.ts',
  ))
  const eligibilityApi = policyRuntime.load(path.join(
    appRoot,
    'domain',
    'recommendation',
    'initial-reference-v1',
    'eligibility.ts',
  ))
  const legacyV2Api = policyRuntime.load(path.join(appRoot, 'services', 'recommendation-preview-v2.ts'))
  assert.equal(typeof eligibilityApi.evaluateInitialReferenceEligibilityV1, 'function')

  const policyAnswers = (overrides = {}) => ({
    'preference.region': {
      kind: 'no_preference',
      regionCode: 'no_preference',
      regionLabelSnapshot: '不限制',
      catalogVersion: 'institution-region-catalog-v1',
    },
    'budget.monthlyRange': 'unknown',
    'preference.roomType': 'no_preference',
    'preference.mealSchedule': 'no_preference',
    ...overrides,
  })
  const institutionRegionAnswer = {
    kind: 'institution_region',
    regionCode: '420105',
    regionLabelSnapshot: '汉阳区',
    catalogVersion: 'institution-catalog-v1',
  }
  const validCatalog = (records, label) => {
    const catalog = makeInitialReferenceCatalogWithRecordsV121(records)
    return validateFixture(catalog, label)
  }
  const projectFacts = (catalog, label) => {
    const result = policyFactsApi.projectReferenceInstitutionFactsV1(catalog, INITIAL_REFERENCE_EVALUATION_AS_OF)
    assert.equal(result.ok, true, `${label}: C1 facts projection succeeds`)
    return result.value
  }
  const buildLegacySnapshot = async (catalog, answers, label) => {
    const v121Service = policyCatalogApi.createInstitutionCatalogServiceV121({
      loadCatalog: async () => catalog,
    })
    const legacyService = legacyV2Api.createRecommendationPreviewServiceV2({
      draftSource: { getDraft: () => makeV2Draft(answers) },
      institutionCatalog: policyCatalogApi.createInstitutionCatalogServiceV11Adapter(v121Service),
    })
    const result = await legacyService.buildResultSnapshot(INITIAL_REFERENCE_EVALUATION_AS_OF)
    assert.equal(
      result.ok,
      true,
      `${label}: original V2 factory snapshot; ${result.error?.code || 'OK'}/${result.error?.causeCode || 'OK'}`,
    )
    return result.value
  }
  const getLegacyCandidate = (legacySnapshot, institutionId, label) => {
    const candidates = legacySnapshot.preview.semantics.candidateEvaluations
    const candidate = candidates.find((item) => item.institutionId === institutionId)
    assert.ok(candidate, `${label}: original V2 candidate exists`)
    return candidate
  }
  const evaluatePolicy = (factsPool, legacySnapshot, institutionId, label) => {
    const institutionFacts = factsPool.institutions.find((item) => item.institutionId === institutionId)
    assert.ok(institutionFacts, `${label}: exact current C1 facts exist`)
    const legacyCandidate = getLegacyCandidate(legacySnapshot, institutionId, label)
    const elderSnapshot = legacySnapshot.preview.semantics.elderSnapshot
    const factsBefore = JSON.stringify(institutionFacts)
    const candidateBefore = JSON.stringify(legacyCandidate)
    const elderBefore = JSON.stringify(elderSnapshot)
    const decision = eligibilityApi.evaluateInitialReferenceEligibilityV1({
      institutionFacts,
      legacyCandidate,
      elderSnapshot,
    })
    assert.equal(JSON.stringify(institutionFacts) === factsBefore, true, `${label}: facts input unchanged`)
    assert.equal(JSON.stringify(legacyCandidate) === candidateBefore, true, `${label}: legacy candidate unchanged`)
    assert.equal(JSON.stringify(elderSnapshot) === elderBefore, true, `${label}: elder snapshot unchanged`)
    return { decision, institutionFacts, legacyCandidate, elderSnapshot }
  }
  const basisByCategory = (decision, category) =>
    decision.basisEvaluations.find((item) => item.category === category)
  const expectCategories = (decision, expected, label) =>
    assert.deepEqual(clone(decision.matchedCategories), expected, `${label}: matched categories`)
  const expectExclusions = (decision, expected, label) =>
    assert.deepEqual(clone(decision.exclusionCodes), expected, `${label}: exclusion codes`)

  // R01 — explicit region preference produces only the AREA reference basis.
  {
    const record = setInitialReferenceRegion(makeInitialReferenceRecordV121(), '420105')
    const catalog = validCatalog([record], 'R01 area fixture')
    const factsPool = projectFacts(catalog, 'R01')
    const legacy = await buildLegacySnapshot(catalog, policyAnswers({ 'preference.region': institutionRegionAnswer }), 'R01')
    const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, 'R01')
    assert.equal(decision.eligible, true, 'R01: direct region preference is eligible')
    expectCategories(decision, ['AREA'], 'R01')
    assert.equal(basisByCategory(decision, 'AREA').status, 'MATCHED', 'R01: area match')
    assert.equal(basisByCategory(decision, 'BUDGET').status, 'NOT_APPLICABLE', 'R01: unknown budget is not a claim')
  }

  // R02 — budget evidence can qualify while independent legacy clarification remains visible.
  {
    const record = setInitialReferenceMealSupport(
      setInitialReferenceMealSupport(makeInitialReferenceRecordV121(), 'easyChewSupport', 'unknown'),
      'modifiedFoodSupport',
      'unknown',
    )
    const catalog = validCatalog([record], 'R02 budget fixture')
    const factsPool = projectFacts(catalog, 'R02')
    const legacy = await buildLegacySnapshot(catalog, policyAnswers({
      'budget.monthlyRange': 'cny_5000_8000',
      'health.swallowingAbility': 'occasional_difficulty',
    }), 'R02')
    const semantics = legacy.preview.semantics
    const swallowingClarificationId = 'cl:risk_signal_needs_confirmation:nutrition.swallowingConcern'
    assert.ok(semantics.elderClarifications.some((item) =>
      item.clarificationId === swallowingClarificationId), 'R02: swallowing risk clarification is preserved')
    const swallowingReadiness = semantics.requirementReadiness.find((item) =>
      item.sourceDerivedField === 'nutrition.swallowingConcern')
    assert.ok(swallowingReadiness, 'R02: unresolved swallowing requirement remains visible')
    assert.equal(swallowingReadiness.disposition, 'unresolved')
    assert.equal(swallowingReadiness.blocksEligibility, false, 'R02: current V2 swallowing clarification alone does not block readiness')
    assert.ok(swallowingReadiness.clarificationIds.includes(swallowingClarificationId))
    assert.equal(semantics.elderReadiness, 'ready')
    for (const field of ['easyChewSupport', 'modifiedFoodSupport']) {
      assert.equal(factsPool.institutions[0].meal[field].effectiveStatus, 'unknown', 'R02: unknown food support stays unknown')
      assert.equal(factsPool.institutions[0].meal[field].effectiveValue, null, 'R02: unknown food support cannot imply support')
    }
    const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, 'R02')
    assert.equal(decision.eligible, true, 'R02: a matched budget basis can qualify')
    expectCategories(decision, ['BUDGET'], 'R02')
    assert.equal(basisByCategory(decision, 'BUDGET').status, 'MATCHED', 'R02: budget overlap')
    assert.equal(basisByCategory(decision, 'BASIC_SERVICE').status, 'NOT_APPLICABLE', 'R02: no basic-service preference')
  }

  // R03 — legacy hard conflict vetoes first; expired conflict and food evidence stay conservative.
  {
    const conflictRecord = setInitialReferenceRegion(
      makeInitialReferenceWanderingCapabilityRecordV121({ status: 'unsupported' }),
      '420105',
    )
    const conflictCatalog = validCatalog([conflictRecord], 'R03 conflict fixture')
    const conflictFacts = projectFacts(conflictCatalog, 'R03 conflict')
    const riskAnswers = policyAnswers({
      'preference.region': institutionRegionAnswer,
      'cognitive.symptoms': ['wandering_risk'],
    })
    const conflictLegacy = await buildLegacySnapshot(conflictCatalog, riskAnswers, 'R03 conflict')
    const oldConflictCandidate = getLegacyCandidate(conflictLegacy, conflictRecord.institutionId, 'R03 conflict')
    assert.ok(oldConflictCandidate.constraintResults.some((item) => item.outcome === 'conflict'), 'R03: old V2 emits a real conflict')
    const { decision: conflictDecision } = evaluatePolicy(conflictFacts, conflictLegacy, conflictRecord.institutionId, 'R03 conflict')
    expectExclusions(
      conflictDecision,
      ['LEGACY_CONSTRAINT_CONFLICT', 'LEGACY_INELIGIBLE'],
      'R03 conflict',
    )
    expectCategories(conflictDecision, [], 'R03 conflict')
    assert.equal(conflictDecision.basisEvaluations.length, 0, 'R03: veto precedes ordinary basis evaluation')

    const expiredRecord = setInitialReferenceRegion(
      makeInitialReferenceWanderingCapabilityRecordV121({ status: 'unsupported', verificationStatus: 'expired' }),
      '420105',
    )
    const expiredCatalog = validCatalog([expiredRecord], 'R03 expired capability fixture')
    const expiredFacts = projectFacts(expiredCatalog, 'R03 expired capability')
    const expiredLegacy = await buildLegacySnapshot(expiredCatalog, riskAnswers, 'R03 expired capability')
    const expiredOldCandidate = getLegacyCandidate(expiredLegacy, expiredRecord.institutionId, 'R03 expired capability')
    assert.equal(expiredOldCandidate.constraintResults.some((item) => item.outcome === 'conflict'), false, 'R03: expired evidence is not a legacy conflict')
    const { decision: expiredDecision } = evaluatePolicy(expiredFacts, expiredLegacy, expiredRecord.institutionId, 'R03 expired capability')
    expectExclusions(expiredDecision, [], 'R03 expired capability')
    expectCategories(expiredDecision, ['AREA'], 'R03 expired capability')

    const foodRecord = setInitialReferenceMealSupport(
      setInitialReferenceRegion(makeInitialReferenceRecordV121(), '420105'),
      'easyChewSupport',
      'unavailable',
    )
    const foodCatalog = validCatalog([foodRecord], 'R03 food veto fixture')
    const foodFacts = projectFacts(foodCatalog, 'R03 food veto')
    const foodLegacy = await buildLegacySnapshot(foodCatalog, policyAnswers({
      'preference.region': institutionRegionAnswer,
      'health.chewingAbility': 'easy_chew',
    }), 'R03 food veto')
    const { decision: foodDecision } = evaluatePolicy(foodFacts, foodLegacy, foodRecord.institutionId, 'R03 food veto')
    expectExclusions(foodDecision, ['REFERENCE_FOOD_TEXTURE_UNSUPPORTED'], 'R03 food veto')
    expectCategories(foodDecision, [], 'R03 food veto')
    assert.deepEqual(
      clone(foodDecision.exclusionEvidence.map((item) => item.fieldPath)),
      ['meal.easyChewSupport'],
      'R03: food veto keeps only its exact institution evidence path',
    )
    assert.equal(foodDecision.exclusionElderEvidenceRefs.length, 1, 'R03: food veto keeps its derived need evidence reference')

    const expiredFoodRecord = setInitialReferenceMealSupport(
      setInitialReferenceRegion(makeInitialReferenceRecordV121(), '420105'),
      'easyChewSupport',
      'unavailable',
      'expired',
    )
    const expiredFoodCatalog = validCatalog([expiredFoodRecord], 'R03 expired food fixture')
    const expiredFoodFacts = projectFacts(expiredFoodCatalog, 'R03 expired food')
    const expiredFoodLegacy = await buildLegacySnapshot(expiredFoodCatalog, policyAnswers({
      'preference.region': institutionRegionAnswer,
      'health.chewingAbility': 'easy_chew',
    }), 'R03 expired food')
    const { decision: expiredFoodDecision } = evaluatePolicy(expiredFoodFacts, expiredFoodLegacy, expiredFoodRecord.institutionId, 'R03 expired food')
    expectExclusions(expiredFoodDecision, [], 'R03 expired food')
    expectCategories(expiredFoodDecision, ['AREA'], 'R03 expired food')

    const partialBasicRecord = setInitialReferenceMealSchedule(
      setInitialReferenceRoomType(makeInitialReferenceRecordV121(), 'double'),
      'three_meals',
    )
    const partialBasicCatalog = validCatalog([partialBasicRecord], 'R03 partial basic fixture')
    const partialBasicFacts = projectFacts(partialBasicCatalog, 'R03 partial basic')
    const partialBasicLegacy = await buildLegacySnapshot(partialBasicCatalog, policyAnswers({
      'preference.roomType': 'double',
      'preference.mealSchedule': 'three_meals_one_snack',
    }), 'R03 partial basic')
    const { decision: partialBasicDecision } = evaluatePolicy(partialBasicFacts, partialBasicLegacy, partialBasicRecord.institutionId, 'R03 partial basic')
    const basicBasis = basisByCategory(partialBasicDecision, 'BASIC_SERVICE')
    assert.equal(basicBasis.status, 'MATCHED', 'R03: one successful basic service field is sufficient')
    assert.deepEqual(clone(basicBasis.fieldPaths), ['rooms.0.roomType', 'meal.mealSchedule'])
    assert.deepEqual(clone(basicBasis.matchedFieldPaths), ['rooms.0.roomType'])
    assert.deepEqual(clone(basicBasis.evidence.map((item) => item.fieldPath)), ['rooms.0.roomType'])
    assert.deepEqual(
      clone(basicBasis.elderEvidenceRefs.map((item) => item.profilePath)),
      ['preference.rawFacts.roomTypePreference'],
    )

    const openRoomRecord = makeInitialReferenceRecordV121()
    const openRoomCatalog = validCatalog([openRoomRecord], 'R03 open room fixture')
    const openRoomFacts = projectFacts(openRoomCatalog, 'R03 open room')
    const openRoomLegacy = await buildLegacySnapshot(openRoomCatalog, policyAnswers({ 'preference.roomType': 'double' }), 'R03 open room')
    const { decision: openRoomDecision } = evaluatePolicy(openRoomFacts, openRoomLegacy, openRoomRecord.institutionId, 'R03 open room')
    assert.equal(basisByCategory(openRoomDecision, 'BASIC_SERVICE').status, 'UNKNOWN', 'R03: an unlisted requested room remains unknown')
    assert.equal(openRoomDecision.eligible, false, 'R03: unknown open-list room does not create positive eligibility')
  }

  // R04 — multiple risk inputs remain owned by the old V2 snapshot and do not create a C1 exclusion.
  {
    const record = setInitialReferenceRegion(
      makeInitialReferenceWanderingCapabilityRecordV121({ status: 'supported' }),
      '420105',
    )
    const catalog = validCatalog([record], 'R04 risk fixture')
    const factsPool = projectFacts(catalog, 'R04')
    const legacy = await buildLegacySnapshot(catalog, policyAnswers({
      'preference.region': institutionRegionAnswer,
      'cognitive.symptoms': ['wandering_risk', 'mood_instability'],
      'health.swallowingAbility': 'occasional_difficulty',
      'adl.mobility': 'wheelchair',
    }), 'R04')
    const oldCandidate = getLegacyCandidate(legacy, record.institutionId, 'R04')
    assert.equal(oldCandidate.constraintResults.some((item) => item.outcome === 'conflict'), false, 'R04: supported/unknown V2 risks are not rewritten as conflict')
    const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, 'R04')
    expectExclusions(decision, [], 'R04')
    expectCategories(decision, ['AREA'], 'R04')
  }

  // R05 — no applicable preference yields no personalized candidate.
  {
    const record = makeInitialReferenceRecordV121()
    const catalog = validCatalog([record], 'R05 no preference fixture')
    const factsPool = projectFacts(catalog, 'R05')
    const legacy = await buildLegacySnapshot(catalog, policyAnswers(), 'R05')
    const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, 'R05')
    assert.equal(decision.eligible, false, 'R05: no applicable basis is not eligible')
    expectCategories(decision, [], 'R05')
    assert.equal(decision.candidate, null, 'R05: no candidate object without a matched category')
    assert.deepEqual(
      clone(decision.basisEvaluations.map((item) => item.status)),
      ['NOT_APPLICABLE', 'NOT_APPLICABLE', 'NOT_APPLICABLE'],
      'R05: all three categories remain not applicable',
    )
  }

  // R07 — category cardinality is stable when room and meal both match.
  {
    const buildRecord = (id, patch) => {
      const record = makeInitialReferenceRecordV121()
      patch(record)
      return reidentifyInitialReferenceRecordV121(record, id)
    }
    const records = [
      buildRecord('c1-r07-01', (record) => {
        setInitialReferenceRegion(record, '420105')
        setInitialReferenceRoomType(record, 'double')
        setInitialReferenceMealSchedule(record, 'three_meals_one_snack')
        setInitialReferencePrice(record, { minAmountMinor: 650000, maxAmountMinor: 780000 })
      }),
      buildRecord('c1-r07-02', (record) => {
        setInitialReferenceRegion(record, '420105')
        setInitialReferenceRoomType(record, 'single')
        setInitialReferenceMealSchedule(record, 'three_meals')
        setInitialReferencePrice(record, { minAmountMinor: 650000, maxAmountMinor: 780000 })
      }),
      buildRecord('c1-r07-03', (record) => {
        setInitialReferenceRegion(record, '420105')
        setInitialReferenceRoomType(record, 'double')
        setInitialReferenceMealSchedule(record, 'three_meals_one_snack')
        setInitialReferencePrice(record, { minAmountMinor: 900000, maxAmountMinor: 1100000 })
      }),
      buildRecord('c1-r07-04', (record) => {
        setInitialReferenceRegion(record, '420104')
        setInitialReferenceRoomType(record, 'single')
        setInitialReferenceMealSchedule(record, 'three_meals')
        setInitialReferencePrice(record, { minAmountMinor: 650000, maxAmountMinor: 780000 })
      }),
    ]
    const catalog = validCatalog(records, 'R07 multi-record fixture')
    const factsPool = projectFacts(catalog, 'R07')
    const legacy = await buildLegacySnapshot(catalog, policyAnswers({
      'preference.region': institutionRegionAnswer,
      'budget.monthlyRange': 'cny_5000_8000',
      'preference.roomType': 'double',
      'preference.mealSchedule': 'three_meals_one_snack',
    }), 'R07')
    const expected = [
      ['AREA', 'BUDGET', 'BASIC_SERVICE'],
      ['AREA', 'BUDGET'],
      ['AREA', 'BASIC_SERVICE'],
      ['BUDGET'],
    ]
    records.forEach((record, index) => {
      const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, `R07-${index + 1}`)
      expectCategories(decision, expected[index], `R07-${index + 1}`)
    })
    const bothBasic = evaluatePolicy(factsPool, legacy, records[0].institutionId, 'R07 both basic fields').decision
    const basicBasis = basisByCategory(bothBasic, 'BASIC_SERVICE')
    assert.equal(bothBasic.matchedCategories.length, 3, 'R07: room and meal contribute one BASIC_SERVICE category')
    assert.deepEqual(clone(basicBasis.matchedFieldPaths), ['rooms.0.roomType', 'meal.mealSchedule'])
    assert.deepEqual(
      clone(basicBasis.evidence.map((item) => item.fieldPath)),
      ['rooms.0.roomType', 'meal.mealSchedule'],
      'R07: only matched room and meal evidence is credited',
    )
    assert.deepEqual(
      clone(basicBasis.elderEvidenceRefs.map((item) => item.profilePath)),
      ['preference.rawFacts.roomTypePreference', 'preference.rawFacts.mealSchedulePreference'],
    )
  }

  // R08 — the old oracle's archived revision cannot be paired with current facts.
  {
    const pair = makeInitialReferenceArchiveCurrentSidecarPair()
    const archiveCatalog = validateFixture(
      makeInitialReferenceCatalogV121(pair.archiveRevisionOne),
      'R08 archive-sidecar fixture',
    )
    const currentCatalog = validateFixture(
      makeInitialReferenceCatalogV121(pair.currentRevisionTwo),
      'R08 current fixture',
    )
    const currentFacts = projectFacts(currentCatalog, 'R08')
    assert.equal(currentFacts.institutions.length, 1, 'R08: only current pointer is projected')
    assert.equal(currentFacts.institutions[0].recordRevision, 2, 'R08: projection binds the current revision')
    const legacy = await buildLegacySnapshot(archiveCatalog, policyAnswers(), 'R08 archive legacy oracle')
    const legacyCandidate = getLegacyCandidate(legacy, pair.archiveRevisionOne.institutionId, 'R08 archive legacy oracle')
    let identityError
    try {
      eligibilityApi.evaluateInitialReferenceEligibilityV1({
        institutionFacts: currentFacts.institutions[0],
        legacyCandidate,
        elderSnapshot: legacy.preview.semantics.elderSnapshot,
      })
    } catch (error) {
      identityError = error
    }
    assert.equal(
      identityError?.message,
      'INITIAL_REFERENCE_CANDIDATE_IDENTITY_MISMATCH',
      'R08: exact archived/current revision mismatch is rejected',
    )
  }

  // R11 — price evidence and interval boundaries retain conservative semantics.
  {
    const runBudgetCase = async (label, record, answers, expectedStatus, expectedCategories) => {
      const catalog = validCatalog([record], `${label} fixture`)
      const factsPool = projectFacts(catalog, label)
      const legacy = await buildLegacySnapshot(catalog, policyAnswers(answers), label)
      const { decision } = evaluatePolicy(factsPool, legacy, record.institutionId, label)
      assert.equal(basisByCategory(decision, 'BUDGET').status, expectedStatus, `${label}: budget status`)
      expectCategories(decision, expectedCategories, label)
    }
    const budgetAnswer = { 'budget.monthlyRange': 'cny_5000_8000' }

    await runBudgetCase(
      'R11 expired price',
      setInitialReferencePrice(makeInitialReferenceRecordV121(), { verificationStatus: 'expired' }),
      budgetAnswer,
      'UNKNOWN',
      [],
    )
    await runBudgetCase(
      'R11 starting-at price',
      setInitialReferencePrice(makeInitialReferenceRecordV121(), { rangeKind: 'starting_at' }),
      budgetAnswer,
      'UNKNOWN',
      [],
    )
    await runBudgetCase(
      'R11 future price asOf',
      setInitialReferencePrice(makeInitialReferenceRecordV121(), {
        asOf: '2026-10-26T04:00:00.001Z',
      }),
      budgetAnswer,
      'UNKNOWN',
      [],
    )
    await runBudgetCase(
      'R11 inclusive budget boundary',
      setInitialReferencePrice(makeInitialReferenceRecordV121(), {
        minAmountMinor: 500000,
        maxAmountMinor: 500000,
      }),
      budgetAnswer,
      'MATCHED',
      ['BUDGET'],
    )
    await runBudgetCase(
      'R11 open-ended upper budget',
      setInitialReferencePrice(makeInitialReferenceRecordV121(), {
        minAmountMinor: 1500000,
        maxAmountMinor: 1800000,
      }),
      { 'budget.monthlyRange': 'cny_15000_plus' },
      'MATCHED',
      ['BUDGET'],
    )
    const boundaryRecord = setInitialReferencePrice(makeInitialReferenceRecordV121(), {
      minAmountMinor: 500000,
      maxAmountMinor: 800000,
      validUntil: INITIAL_REFERENCE_EVALUATION_AS_OF,
    })
    const boundaryCatalog = validCatalog([boundaryRecord], 'R11 exact validUntil fixture')
    const boundaryFacts = projectFacts(boundaryCatalog, 'R11 exact validUntil')
    assert.equal(
      boundaryFacts.institutions[0].price.referenceMonthlyPrice.effectiveStatus,
      'current_verified',
      'R11: evidence valid exactly at T remains current',
    )
    const boundaryLegacy = await buildLegacySnapshot(boundaryCatalog, policyAnswers(budgetAnswer), 'R11 exact validUntil')
    const { decision: boundaryDecision } = evaluatePolicy(boundaryFacts, boundaryLegacy, boundaryRecord.institutionId, 'R11 exact validUntil')
    assert.equal(basisByCategory(boundaryDecision, 'BUDGET').status, 'MATCHED', 'R11: exact validUntil and budget endpoint remain inclusive')
    expectCategories(boundaryDecision, ['BUDGET'], 'R11 exact validUntil')
  }

  console.log(`POLICY_ONLY: ${policyOnly ? 'YES' : 'NO (FULL DOMAIN GATE)'}`)
  console.log('A2_R01_R02: PASS')
  console.log('A2_R03_VETO_ORDER_OPEN_ROOM_AND_MATCHED_EVIDENCE: PASS')
  console.log('A2_R04_R05: PASS')
  console.log('A2_R07_CATEGORY_CARDINALITY: PASS')
  console.log('A2_R08_ARCHIVE_CURRENT_IDENTITY: PASS')
  console.log('A2_R11_BUDGET_EVIDENCE_AND_BOUNDARIES: PASS')
  console.log(`A2_OLD_STORE_TEST_VM_WX_INIT_CALLS: ${wxCalls.length}`)
  console.log('A3_COMPOSITION_EXECUTION: SEPARATE check-reference-composition-v1-runtime.mjs')
  console.log('C1_INITIAL_REFERENCE_DOMAIN_RUNTIME = PASS')
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
