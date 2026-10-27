// SYNTHETIC_TEST_ONLY. Exercises the live application composition and its page boundary.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeAssessmentDraftV2 } from './fixtures/elder-profile-v2-fixtures.mjs'
import {
  makeInitialReferenceCatalogWithRecordsV121,
  makeInitialReferenceRecordV121,
  makeInitialReferenceUnknownMealScheduleRecordV121,
  reidentifyInitialReferenceRecordV121,
  setInitialReferenceRegion,
} from './fixtures/initial-reference-v1-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const T = '2026-10-26T04:00:00.000Z'
const clone = value => JSON.parse(JSON.stringify(value))
const area = { kind: 'institution_region', regionCode: '420105', regionLabelSnapshot: '汉阳区', catalogVersion: 'institution-region-catalog-v1' }
const draftFor = (answers = {}) => makeAssessmentDraftV2(answers)
const riskDraft = (answers = {}) => draftFor({ 'health.swallowingAbility': 'occasional_difficulty', ...answers })

let fixtureSequence = 0
const withCapabilities = (record, status) => {
  for (const [group, fields] of Object.entries(record.capabilities)) {
    for (const name of Object.keys(fields)) {
      const fieldPath = `capabilities.${group}.${name}`
      record.evidence = record.evidence.filter(item => item.fieldPath !== fieldPath)
      if (status === 'unknown') {
        record.capabilities[group][name] = { code: name, status, verification: { status: 'unverified', evidenceIds: [] } }
      } else {
        const evidenceId = `ev-c1-page-${++fixtureSequence}`
        const verifiedAt = '2026-10-25T00:00:00.000Z'
        const validUntil = '2027-10-26T00:00:00.000Z'
        record.capabilities[group][name] = {
          code: name,
          status,
          verification: { status: 'verified', evidenceIds: [evidenceId], verifiedAt, validUntil },
        }
        record.evidence.push({
          evidenceId,
          institutionId: record.institutionId,
          recordRevision: record.recordRevision,
          fieldPath,
          valueSnapshot: { valueType: 'stable_code', value: status },
          sourceType: 'official_document',
          sourceReference: 'https://example.invalid/SYNTHETIC_TEST_ONLY',
          verificationStatus: 'verified',
          verifiedAt,
          validUntil,
        })
      }
    }
  }
  return record
}

const unknownRecord = (id = 'c1-page-reference') => setInitialReferenceRegion(
  reidentifyInitialReferenceRecordV121(withCapabilities(makeInitialReferenceRecordV121(), 'unknown'), id),
  '420105',
)
const knownRecord = (id = 'c1-page-legacy') => setInitialReferenceRegion(
  reidentifyInitialReferenceRecordV121(withCapabilities(makeInitialReferenceRecordV121(), 'supported'), id),
  '420105',
)
const catalogFor = (...records) => makeInitialReferenceCatalogWithRecordsV121(records)

const createRuntime = ts => {
  const calls = { storageReads: 0, navigation: [], forbidden: [] }
  const pageDefinitions = []
  const wx = {
    getStorageSync: () => { calls.storageReads += 1; return '' },
    setStorageSync: () => {},
    removeStorageSync: () => {},
    navigateTo: options => { calls.navigation.push({ type: 'navigateTo', options }) },
    navigateBack: options => { calls.navigation.push({ type: 'navigateBack', options }) },
    redirectTo: options => { calls.navigation.push({ type: 'redirectTo', options }) },
    switchTab: options => { calls.navigation.push({ type: 'switchTab', options }) },
    request: () => { calls.forbidden.push('request'); throw new Error('request forbidden') },
    login: () => { calls.forbidden.push('login'); throw new Error('login forbidden') },
    getPhoneNumber: () => { calls.forbidden.push('phone'); throw new Error('phone forbidden') },
  }
  const runtime = createWechatTsRuntime(ts, {
    wx,
    Page: definition => { pageDefinitions.push(definition); return definition },
    getCurrentPages: () => [{ route: 'pages/assessment/profile' }, { route: 'pages/recommendation/result' }],
  })
  return { ...runtime, calls, pageDefinitions }
}

const makeApplication = (runtime, {
  draft,
  catalog,
  counters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] },
  providerFailure = false,
  providerPayload = catalog,
} = {}) => {
  const catalogModule = runtime.load(path.join(appRoot, 'services', 'institution-catalog-v1-2-1.ts'))
  const legacyModule = runtime.load(path.join(appRoot, 'services', 'recommendation-preview-v2.ts'))
  const applicationModule = runtime.load(path.join(appRoot, 'services', 'recommendation-result-application.ts'))
  const port = catalogModule.createInstitutionCatalogServiceV121({
    loadCatalog: async () => {
      counters.provider += 1
      if (providerFailure) throw new Error('SYNTHETIC_PROVIDER_FAILURE')
      return clone(providerPayload)
    },
  })
  const service = applicationModule.createRecommendationResultApplicationService({
    draftSource: { getDraft: () => { counters.draft += 1; return clone(draft) } },
    institutionCatalogV121: port,
    createLegacyV2Service: dependencies => {
      counters.factory += 1
      const legacy = legacyModule.createRecommendationPreviewServiceV2(dependencies)
      return {
        ...legacy,
        buildResultSnapshot: async at => {
          counters.build += 1
          counters.times.push(at)
          return legacy.buildResultSnapshot(at)
        },
      }
    },
  })
  return { service, applicationModule, counters }
}

const expectCounts = (counters, expected = { draft: 1, provider: 1, factory: 1, build: 1, times: [T] }) => {
  assert.deepStrictEqual(counters, expected)
}

const flush = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const testPage = async (runtime, appModule, results) => {
  const saveCalls = { activate: 0, begin: 0, verify: 0, preview: 0, confirm: 0, reconcile: 0, close: 0 }
  const saveModule = runtime.load(path.join(appRoot, 'services', 'recommendation-result-save.ts'))
  saveModule.recommendationResultSaveController = () => ({
    close: () => { saveCalls.close += 1 },
    activate: () => { saveCalls.activate += 1 },
    begin: () => { saveCalls.begin += 1 },
    verify: () => { saveCalls.verify += 1 },
    obtainPreview: () => { saveCalls.preview += 1 },
    confirm: () => { saveCalls.confirm += 1 },
    reconcile: () => { saveCalls.reconcile += 1 },
    cancel: () => {},
    canOpenHistory: async () => { saveCalls.history = (saveCalls.history || 0) + 1; return true },
  })
  runtime.load(path.join(appRoot, 'pages', 'recommendation', 'result.ts'))
  assert.equal(runtime.pageDefinitions.length, 1, 'result page registers once')
  let nextResult = results.referenceResult
  let appCalls = 0
  appModule.buildRecommendationResultApplicationSnapshot = async input => {
    appCalls += 1
    assert.equal(typeof input.evaluationAsOf, 'string')
    return nextResult
  }
  const definition = runtime.pageDefinitions[0]
  const mount = () => {
    const page = {
      data: clone(definition.data),
      setData(patch) { Object.assign(this.data, patch) },
    }
    Object.keys(definition).forEach(key => {
      if (typeof definition[key] === 'function') page[key] = definition[key].bind(page)
    })
    return page
  }

  const referencePage = mount()
  referencePage.refreshRecommendation()
  await flush()
  assert.equal(referencePage.data.pageState, 'initial_reference_only')
  assert.equal(referencePage.data.viewModel.referenceCards.length, 1)
  const mappedReferenceCard = referencePage.data.viewModel.referenceCards[0]
  const sourceReferenceCard = results.referenceResult.reference.displayedReferenceCards[0]
  assert.ok(mappedReferenceCard.reasons.length > 0, 'reference reasons come from established C1 matches')
  const expectedUnknownWarningLabels = {
    'mobility.level': '行动支持',
    'cognition.wanderingRisk': '走失风险支持',
  }
  assert.equal(sourceReferenceCard.institutionCapabilityUnknowns.length, 2)
  for (const unknown of sourceReferenceCard.institutionCapabilityUnknowns) {
    const label = expectedUnknownWarningLabels[unknown.sourceDerivedField]
    assert.ok(label, `unexpected unknown capability source field ${unknown.sourceDerivedField}`)
    assert.ok(mappedReferenceCard.institutionWarnings.includes(`${label}：护理能力未知或未核实，需向机构确认。`),
      `unknown ${unknown.sourceDerivedField} stays unknown in the reference card`)
  }
  assert.ok(mappedReferenceCard.riskFacts.length > 3, 'important risks are not truncated to a small tag subset')
  const profileViewModel = runtime.load(path.join(appRoot, 'pages', 'assessment', 'profile-v2-view-model.ts'))
  const expectedClarifications = sourceReferenceCard.elderClarifications.map(profileViewModel.clarificationText)
  assert.deepStrictEqual(clone(mappedReferenceCard.clarifications), clone(expectedClarifications),
    'all source clarifications are preserved with the established wording')
  assert.ok(mappedReferenceCard.clarifications.length > 3, 'all clarification items are mapped')
  assert.ok(mappedReferenceCard.riskFacts.some(item => item.includes('吞咽')))
  assert.ok(mappedReferenceCard.riskFacts.some(item => item.includes('使用轮椅')))
  assert.ok(mappedReferenceCard.riskFacts.some(item => item.includes('走失风险')))
  assert.equal(mappedReferenceCard.reasons.some(item => /护理能力.*支持/.test(item)), false)
  const pageMarkup = fs.readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  assert.match(referencePage.data.viewModel.summary, /暂无可核实匹配；下列仅为初步参考/)
  for (const required of ['viewModel.summary', '初步参考', 'institutionWarnings', 'riskFacts', 'clarifications', 'differences', 'data-reference-generation']) {
    assert.ok(pageMarkup.includes(required), `reference page markup must render ${required}`)
  }
  assert.equal(saveCalls.activate, 0, 'reference-only result does not activate assessment saving')
  referencePage.onSaveAssessment()
  referencePage.onVerifyAssessmentSave()
  referencePage.onObtainTrustedAssessmentPreview()
  referencePage.onConfirmAssessmentSave()
  referencePage.onReconcileAssessmentSave()
  await referencePage.onAssessmentHistory()
  assert.equal(saveCalls.activate, 0)
  assert.equal(saveCalls.begin, 0)
  assert.equal(saveCalls.verify, 0)
  assert.equal(saveCalls.preview, 0)
  assert.equal(saveCalls.confirm, 0)
  assert.equal(saveCalls.reconcile, 0)
  assert.equal(saveCalls.history || 0, 0)

  const referenceCard = referencePage.data.viewModel.referenceCards[0]
  const cardEvent = (revision = referenceCard.recordRevision, id = referenceCard.institutionId,
    generation = referencePage.data.referenceGeneration) => ({
    currentTarget: { dataset: { institutionId: id, recordRevision: revision, referenceGeneration: generation } },
  })
  referencePage.onReferenceCardTap(cardEvent(referenceCard.recordRevision + 1))
  assert.equal(runtime.calls.navigation.length, 0, 'stale record revision is rejected')
  referencePage.onReferenceCardTap(cardEvent())
  referencePage.onReferenceCardTap(cardEvent())
  assert.equal(runtime.calls.navigation.length, 1, 'rapid double tap creates only one navigation')
  const firstNavigation = runtime.calls.navigation[0]
  assert.match(firstNavigation.options.url, /source=direct_link/)
  assert.doesNotMatch(firstNavigation.options.url, /sourceContextRef/)
  firstNavigation.options.fail({ errMsg: 'synthetic fail' })
  firstNavigation.options.complete({ errMsg: 'synthetic fail' })
  assert.equal(referencePage.data.actionErrorKey, 'reference-detail')
  referencePage.onReferenceCardTap(cardEvent())
  assert.equal(runtime.calls.navigation.length, 2, 'navigation guard releases after a failed detail route')
  runtime.calls.navigation[1].options.success({})
  runtime.calls.navigation[1].options.complete({})
  const staleGenerationEvent = cardEvent()
  nextResult = results.referenceResult
  referencePage.refreshRecommendation()
  const currentActionError = referencePage.data.actionErrorKey
  referencePage.onReferenceCardTap(staleGenerationEvent)
  assert.equal(runtime.calls.navigation.length, 2, 'a prior refresh generation cannot open a card')
  assert.equal(referencePage.data.actionErrorKey, currentActionError, 'a stale tap does not show an obsolete error in the new refresh')
  await flush()
  assert.equal(referencePage.data.pageState, 'initial_reference_only')
  referencePage.onHide()
  referencePage.onReferenceCardTap(staleGenerationEvent)
  assert.equal(runtime.calls.navigation.length, 2, 'onHide invalidates the prior reference snapshot')

  const emptyPage = mount()
  nextResult = results.emptyResult
  emptyPage.refreshRecommendation()
  await flush()
  assert.equal(emptyPage.data.pageState, 'no_personalized_candidate')
  assert.equal(emptyPage.data.viewModel.referenceCards.length, 0)
  emptyPage.onBrowseDirectory()
  assert.equal(runtime.calls.navigation.length, 3)
  assert.equal(runtime.calls.navigation[2].options.url, '/pages/institution/index')

  for (const [label, multiResult, expectedCount] of [
    ['two', results.twoReferenceResult, 2],
    ['three', results.threeReferenceResult, 3],
  ]) {
    nextResult = multiResult
    const multiPage = mount()
    multiPage.refreshRecommendation()
    await flush()
    assert.equal(multiPage.data.pageState, 'initial_reference_only')
    const displayed = multiPage.data.viewModel.referenceCards.map(card => ({
      institutionId: card.institutionId,
      recordRevision: card.recordRevision,
    }))
    const composed = multiResult.reference.displayedReferenceCards.map(card => ({
      institutionId: card.institutionId,
      recordRevision: card.recordRevision,
    }))
    assert.equal(displayed.length, expectedCount, `${label}-reference composition is fully rendered`)
    assert.deepStrictEqual(clone(displayed), clone(composed), `${label}-reference VM preserves C1 order without truncation or re-ranking`)
  }

  nextResult = results.mealUnknownResult
  const mealUnknownPage = mount()
  mealUnknownPage.refreshRecommendation()
  await flush()
  assert.equal(mealUnknownPage.data.pageState, 'initial_reference_only')
  assert.equal(mealUnknownPage.data.viewModel.referenceCards.length, 1)
  assert.ok(mealUnknownPage.data.viewModel.referenceCards[0].reasons.some(item => item.startsWith('普通安排：已核验房型')))
  assert.ok(mealUnknownPage.data.viewModel.referenceCards[0].differences.includes(results.mealUnknownDifferenceText),
    'unknown meal schedule remains visible even when the combined BASIC_SERVICE basis matches by room')

  nextResult = results.legacyResult
  const legacyPage = mount()
  legacyPage.refreshRecommendation()
  await flush()
  assert.equal(legacyPage.data.pageState, 'ready_soft_near')
  assert.equal(legacyPage.data.viewModel.cards.length, 1)
  assert.equal(legacyPage.data.viewModel.referenceCards, undefined)
  assert.equal(saveCalls.activate, 1, 'legacy V2 result retains its existing save activation')

  nextResult = { ok: false, version: 2, error: { state: 'DATA_ERROR', code: 'REFERENCE_CATALOG_ERROR', causeCode: 'INVALID_CATALOG_ENVELOPE' } }
  const dataErrorPage = mount()
  dataErrorPage.refreshRecommendation()
  await flush()
  assert.equal(dataErrorPage.data.pageState, 'catalog_error')
  assert.match(dataErrorPage.data.stateMessage, /不能据此判断机构是否适合老人/)
  nextResult = results.referenceResult
  const beforeDataRetry = appCalls
  dataErrorPage.onRetry()
  await flush()
  assert.equal(appCalls, beforeDataRetry + 1)
  assert.equal(dataErrorPage.data.pageState, 'initial_reference_only')

  nextResult = { ok: false, version: 2, error: { state: 'SERVICE_ERROR', code: 'REFERENCE_CATALOG_ERROR', causeCode: 'PROVIDER_LOAD_FAILED' } }
  const serviceErrorPage = mount()
  serviceErrorPage.refreshRecommendation()
  await flush()
  assert.equal(serviceErrorPage.data.pageState, 'recommendation_error')
  assert.match(serviceErrorPage.data.stateMessage, /不代表机构不适合/)
  nextResult = results.emptyResult
  serviceErrorPage.onRetry()
  await flush()
  assert.equal(serviceErrorPage.data.pageState, 'no_personalized_candidate')

  const oldRequest = deferred()
  const latestRequest = deferred()
  const stalePage = mount()
  let requestIndex = 0
  appModule.buildRecommendationResultApplicationSnapshot = () => {
    requestIndex += 1
    return requestIndex === 1 ? oldRequest.promise : latestRequest.promise
  }
  stalePage.refreshRecommendation()
  stalePage.refreshRecommendation()
  latestRequest.resolve(results.emptyResult)
  await flush()
  oldRequest.resolve(results.referenceResult)
  await flush()
  assert.equal(stalePage.data.pageState, 'no_personalized_candidate', 'old asynchronous result cannot replace a newer refresh')
  const unloadRequest = deferred()
  appModule.buildRecommendationResultApplicationSnapshot = () => unloadRequest.promise
  const unloadedPage = mount()
  unloadedPage.refreshRecommendation()
  unloadedPage.setData({ pageState: 'unloaded-test-sentinel' })
  unloadedPage.onUnload()
  unloadRequest.resolve(results.referenceResult)
  await flush()
  assert.equal(unloadedPage.data.pageState, 'unloaded-test-sentinel', 'unload invalidates pending results')
  assert.equal(runtime.calls.forbidden.length, 0)
  return { appCalls, saveCalls }
}

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createRuntime(ts)
  const sourceMode = runtime.load(path.join(appRoot, 'runtime', 'recommendation-mode.ts'))
  assert.equal(sourceMode.EXPECTED_RECOMMENDATION_DATASET_MODE, 'MOCK_DEVELOPMENT_ONLY')

  const referenceCatalog = catalogFor(unknownRecord())
  const referenceCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const referenceApp = makeApplication(runtime, {
    draft: riskDraft({
      'preference.region': area,
      'budget.monthlyRange': 'cny_5000_8000',
      'cognitive.symptoms': ['wandering_risk', 'mood_instability'],
      'adl.mobility': 'wheelchair',
      'adl.eating': 'unknown',
    }),
    catalog: referenceCatalog,
    counters: referenceCounters,
  })
  const referenceResult = await referenceApp.service.build(T)
  assert.equal(referenceResult.ok, true)
  assert.equal(referenceResult.version, 2)
  assert.ok(referenceResult.reference)
  assert.strictEqual(referenceResult.value, referenceResult.reference.legacyV2)
  assert.equal(referenceResult.value.sourceContext.evaluationAsOf, T)
  assert.equal(referenceResult.reference.evaluationAsOf, T)
  assert.equal(referenceResult.reference.state, 'INITIAL_REFERENCE_ONLY')
  assert.equal(referenceResult.reference.legacyV2.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
  assert.equal(referenceResult.reference.displayedReferenceCards.length, 1)
  expectCounts(referenceCounters)
  assert.deepStrictEqual(referenceResult.value, referenceResult.reference.legacyV2, 'full legacy V2 snapshot is retained')

  const legacyCatalog = catalogFor(knownRecord())
  const legacyCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const legacyApp = makeApplication(runtime, {
    draft: draftFor({ 'preference.region': area, 'budget.monthlyRange': 'cny_5000_8000' }),
    catalog: legacyCatalog,
    counters: legacyCounters,
  })
  const legacyResult = await legacyApp.service.build(T)
  assert.equal(legacyResult.ok, true)
  assert.equal(legacyResult.reference.state, 'LEGACY_V2_DISPLAY')
  assert.equal(legacyResult.value.preview.semantics.cards.length, 1)
  assert.equal(legacyResult.reference.displayedReferenceCards.length, 0)
  expectCounts(legacyCounters)

  const emptyCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const emptyApp = makeApplication(runtime, { draft: draftFor(), catalog: referenceCatalog, counters: emptyCounters })
  const emptyResult = await emptyApp.service.build(T)
  assert.equal(emptyResult.ok, true)
  assert.equal(emptyResult.reference.state, 'NO_PERSONALIZED_CANDIDATE')
  assert.equal(emptyResult.reference.displayedReferenceCards.length, 0)
  expectCounts(emptyCounters)

  const multiReferenceDraft = riskDraft({
    'preference.region': area,
    'budget.monthlyRange': 'cny_5000_8000',
    'cognitive.symptoms': ['wandering_risk', 'mood_instability'],
    'adl.mobility': 'wheelchair',
    'adl.eating': 'unknown',
  })
  const buildMultipleReferences = async ids => {
    const counters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
    const application = makeApplication(runtime, {
      draft: multiReferenceDraft,
      catalog: catalogFor(...ids.map(id => unknownRecord(id))),
      counters,
    })
    const result = await application.service.build(T)
    assert.equal(result.ok, true)
    assert.equal(result.reference.state, 'INITIAL_REFERENCE_ONLY')
    assert.equal(result.reference.legacyV2.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
    assert.deepStrictEqual(result.value, result.reference.legacyV2, 'multiple references preserve the complete legacy result')
    assert.equal(result.reference.displayedReferenceCards.length, ids.length)
    expectCounts(counters)
    return result
  }
  const twoReferenceResult = await buildMultipleReferences(['c1-page-two-z', 'c1-page-two-a'])
  const threeReferenceResult = await buildMultipleReferences(['c1-page-three-z', 'c1-page-three-a', 'c1-page-three-m'])

  const mealUnknownRecord = setInitialReferenceRegion(
    reidentifyInitialReferenceRecordV121(makeInitialReferenceUnknownMealScheduleRecordV121(), 'c1-page-meal-unknown'),
    '420105',
  )
  const mealUnknownCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const mealUnknownApplication = makeApplication(runtime, {
    draft: draftFor({
      'health.chewingAbility': 'unknown',
      'preference.region': area,
      'budget.monthlyRange': 'cny_5000_8000',
      'preference.roomType': 'single',
      'preference.mealSchedule': 'three_meals',
    }),
    catalog: catalogFor(mealUnknownRecord),
    counters: mealUnknownCounters,
  })
  const mealUnknownResult = await mealUnknownApplication.service.build(T)
  assert.equal(mealUnknownResult.ok, true)
  assert.equal(mealUnknownResult.reference.state, 'INITIAL_REFERENCE_ONLY')
  assert.equal(mealUnknownResult.reference.legacyV2.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
  assert.equal(mealUnknownResult.reference.displayedReferenceCards.length, 1)
  const mealUnknownReferenceCard = mealUnknownResult.reference.displayedReferenceCards[0]
  const basicServiceBasis = mealUnknownReferenceCard.basisEvaluations.find(item => item.category === 'BASIC_SERVICE')
  assert.equal(basicServiceBasis.status, 'MATCHED')
  assert.ok(basicServiceBasis.matchedFieldPaths.includes('rooms.0.roomType'))
  const legacyMealDifference = mealUnknownResult.value.preview.semantics.candidateEvaluations[0].differences.find(item =>
    item.differenceType === 'meal_schedule')
  assert.equal(legacyMealDifference.differenceCode, 'MEAL_SCHEDULE_UNKNOWN')
  assert.equal(legacyMealDifference.differenceCategory, 'UNVERIFIED_DATA_GAP')
  const displaySemantics = runtime.load(path.join(appRoot, 'pages', 'recommendation', 'recommendation-display-semantics.ts'))
  const mealUnknownDifferenceText = `普通偏好资料待核验：${displaySemantics.recommendationDifferenceLabelV2(legacyMealDifference.differenceCode)}`
  expectCounts(mealUnknownCounters)

  const malformedCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const malformedApp = makeApplication(runtime, {
    draft: draftFor(), catalog: referenceCatalog, counters: malformedCounters,
    providerPayload: { ...referenceCatalog, datasetMode: 'PRODUCTION' },
  })
  const malformed = await malformedApp.service.build(T)
  assert.equal(malformed.ok, false)
  assert.equal(malformed.error.state, 'DATA_ERROR')
  expectCounts(malformedCounters, { draft: 1, provider: 1, factory: 1, build: 1, times: [T] })

  const providerCounters = { draft: 0, provider: 0, factory: 0, build: 0, times: [] }
  const failedProviderApp = makeApplication(runtime, {
    draft: draftFor(), catalog: referenceCatalog, counters: providerCounters, providerFailure: true,
  })
  const providerFailure = await failedProviderApp.service.build(T)
  assert.equal(providerFailure.ok, false)
  assert.equal(providerFailure.error.state, 'SERVICE_ERROR')
  expectCounts(providerCounters, { draft: 1, provider: 1, factory: 1, build: 1, times: [T] })

  let legacyCalls = 0
  let v2Calls = 0
  const v1 = makeApplication(runtime, { draft: { schemaVersion: 1 }, catalog: referenceCatalog })
  const v1App = v1.applicationModule.createRecommendationResultApplicationService({
    draftSource: { getDraft: () => ({ schemaVersion: 1 }) },
    legacyBuilder: async () => { legacyCalls += 1; return { ok: true, value: { kind: 'legacy-v1-test' } } },
    v2Builder: async () => { v2Calls += 1; throw new Error('V2 must not run for V1') },
  })
  const v1Result = await v1App.build(T)
  assert.equal(v1Result.ok, true)
  assert.equal(v1Result.version, 1)
  assert.equal(Object.prototype.hasOwnProperty.call(v1Result, 'reference'), false)
  assert.equal(legacyCalls, 1)
  assert.equal(v2Calls, 0)

  const pageRuntime = createRuntime(ts)
  const pageApplication = pageRuntime.load(path.join(appRoot, 'services', 'recommendation-result-application.ts'))
  const pageResults = { referenceResult, emptyResult, legacyResult, twoReferenceResult, threeReferenceResult, mealUnknownResult, mealUnknownDifferenceText }
  const pageCalls = await testPage(pageRuntime, pageApplication, pageResults)

  console.log(`PASS C1-APP-001 single captured draft/provider, one evaluation time, complete legacy snapshot; ${parserFile}`)
  console.log('PASS C1-APP-002 legacy candidate priority, initial-reference-only blocked state, and honest empty state')
  console.log('PASS C1-APP-003 provider data/service errors and V1 dispatch isolation')
  console.log('PASS C1-APP-004 two and three legal references render in the exact C1 composition order')
  console.log('PASS C1-PAGE-002 matched room keeps legacy unknown-meal difference visible under BASIC_SERVICE match')
  console.log(`PASS C1-PAGE-001 reference-only/empty/legacy states, direct-link identity, deduplication, retry, freshness, errors, and save isolation (${pageCalls.appCalls} page builds)`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
