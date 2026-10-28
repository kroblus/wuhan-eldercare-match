// SYNTHETIC_TEST_ONLY. Produces test-classpath fixtures, never a production catalog.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeCompletedAssessmentV2 } from './fixtures/elder-profile-v2-fixtures.mjs'
import { makeInitialReferenceRecordV121, makeInitialReferenceCatalogWithRecordsV121 } from './fixtures/initial-reference-v1-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const asOf = '2026-10-27T04:00:00Z'
const region = { kind: 'institution_region', regionCode: '420105', regionLabelSnapshot: '汉阳区', catalogVersion: 'institution-region-catalog-v1' }
const record = makeInitialReferenceRecordV121()
record.recordProvenance = 'PRODUCTION_CANDIDATE'
record.identity.name.value = 'C2 SYNTHETIC TEST ONLY - NOT REAL'
const catalog = makeInitialReferenceCatalogWithRecordsV121([record], { datasetMode: 'PRODUCTION', datasetVersion: 'C2_SYNTHETIC_TEST_ONLY' })
const unknownCatalog = structuredClone(catalog)
for (const group of Object.values(unknownCatalog.records[0].capabilities)) {
  for (const [name, value] of Object.entries(group)) {
    group[name] = { code: value.code, status: 'unknown', verification: { status: 'unverified', evidenceIds: [] } }
  }
}
unknownCatalog.records[0].evidence = unknownCatalog.records[0].evidence.filter(item => !item.fieldPath.startsWith('capabilities.'))
const cases = [
  ['legacy', makeCompletedAssessmentV2(), 'LEGACY_V2_DISPLAY', catalog],
  ['reference', makeCompletedAssessmentV2({ 'health.swallowingAbility': 'occasional_difficulty', 'preference.region': region, 'preference.roomType': 'double' }), 'INITIAL_REFERENCE_ONLY', unknownCatalog],
  ['zero', makeCompletedAssessmentV2({ 'health.swallowingAbility': 'occasional_difficulty' }), 'NO_PERSONALIZED_CANDIDATE', unknownCatalog],
]
const run = input => {
  const result = spawnSync(process.execPath, ['--no-warnings', path.join(root,'server/tools/derive-c2-snapshot.mjs'), '--source-root', path.join(root,'miniprogram')],
    { input: JSON.stringify(input), encoding: 'utf8', timeout: 12000, maxBuffer: 1048576 })
  return { result, value: JSON.parse(result.stdout || '{}') }
}
const fixtures = []
const { ts } = loadWechatTypeScript()
let bootstrap = true
const runtime = createWechatTsRuntime(ts, { wx: new Proxy({}, { get(_target, key) {
  return () => { if (bootstrap && key==='getStorageSync') return undefined; throw new Error('Real side effect forbidden') }
} }) })
const load = file => runtime.load(path.join(root,'miniprogram',`${file}.ts`))
const legacyApi = load('services/recommendation-preview-v2')
const wrapper = load('services/initial-reference-preview-v1')
const catalogApi = load('services/institution-catalog-validation-v121')
const view = load('presentation/recommendation/initial-reference-view-model')
const profileApi = load('domain/elder-profile/v2/derive-elder-profile-preview-v2')
const profileView = load('presentation/assessment/profile-v2-view-model')
bootstrap = false
for (const [name, completed, expected, source] of cases) {
  const input = { completed, catalog: source, evaluationAsOf: asOf }
  const { result, value } = run(input)
  assert.equal(result.status,0, `${name}: bridge failed ${result.stderr}`)
  assert.equal(value.ok,true)
  assert.equal(value.snapshot.publicDisplay.state, expected)
  assert.deepEqual(value.snapshot.completed,completed)
  assert.ok(value.snapshot.profile.identity.derivationRulesetVersion)
  const display = value.snapshot.publicDisplay
  const draft = { kind:'assessment_draft', schemaVersion:2, localDraftId:completed.id,
    persistence:'LOCAL_DEVICE_DEVELOPMENT_ONLY', currentStep:'budget', answers:completed.answers, startedAt:asOf, updatedAt:asOf }
  const oracle = await wrapper.createInitialReferencePreviewServiceV1({
    draftSource: { getDraft: () => structuredClone(draft) },
    institutionCatalogV121: catalogApi.createInstitutionCatalogServiceV121({ loadCatalog: async () => structuredClone(source) }),
    expectedDatasetMode: 'PRODUCTION', createLegacyV2Service: legacyApi.createRecommendationPreviewServiceV2,
  }).build(asOf)
  assert.equal(oracle.ok,true)
  const expectedResult = view.createInitialReferenceResultViewModel(oracle.value)
  const expectedProfile = profileView.createProfilePageViewModelV2(profileApi.deriveElderProfilePreviewV2(draft).preview)
  assert.deepEqual(display.resultView, JSON.parse(JSON.stringify(expectedResult)), 'complete public result parity')
  assert.deepEqual(display.profileView, JSON.parse(JSON.stringify(expectedProfile)), 'complete public profile parity')
  for (const privateKey of ['answers','rankTuple','priorityFitVector','ownerId','elderId','sourceDigest']) {
    assert.ok(!JSON.stringify(display).includes(`"${privateKey}"`), `private field ${privateKey}`)
  }
  assert.equal(display.poolRevisions[0].recordRevision, record.recordRevision)
  if (name==='reference') {
    assert.equal(display.resultView.cards.length,0)
    assert.ok(display.resultView.referenceCards[0].riskFacts.some(text => text.includes('吞咽')))
    assert.ok(display.resultView.referenceCards[0].clarifications.length>0)
    assert.ok(display.resultView.referenceCards[0].differences.length>0)
  }
  if (name==='zero') assert.ok(display.resultView.summary.length>0)
  fixtures.push({ name, expected, input })
  console.log(`PASS C2 real domain + public snapshot: ${name}`)
}
for (const [name, change] of [
  ['invalid answers', input => { input.completed.answers={} }],
  ['mock catalog', input => { input.catalog.datasetMode='MOCK_DEVELOPMENT_ONLY' }],
  ['source revision mismatch', input => { input.catalog.currentPointers[0].recordRevision=999 }],
  ['unsupported assessment', input => { input.completed.schemaVersion=3 }],
]) {
  const input=structuredClone(fixtures[0].input); change(input)
  assert.equal(run(input).value.ok,false,name)
  console.log(`PASS C2 rejects ${name}`)
}
const destination=path.join(root,'server/src/test/resources/c2-history/synthetic-inputs.json')
fs.mkdirSync(path.dirname(destination),{recursive:true})
fs.writeFileSync(destination,JSON.stringify({ policy:'SYNTHETIC_TEST_ONLY_NOT_REAL', fixtures },null,2)+'\n')
