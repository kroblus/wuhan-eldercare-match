/** TEST_ONLY capture parity: formal Domain output, current approved catalog projection, no Preview persistence. */
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript()
const runtime = createWechatTsRuntime(ts, { wx: new Proxy({}, { get() { throw new Error('pure capture must never access wx/Draft') } }) })
const { MOCK_INSTITUTION_CATALOG_V121: catalog } = runtime.load(path.resolve('miniprogram/mock/institution-catalog.mock.ts'))
const { projectInstitutionRecordV121ToV11: project } = runtime.load(path.resolve('miniprogram/domain/institution/v1-2-1/project-to-v1-1.ts'))
const records = catalog.records.map(record => { const result = project(record); assert.equal(result.ok, true); return result.value })
const source = { records, datasetVersion: catalog.datasetVersion, datasetMode: catalog.datasetMode }
const fixturePath = 'server/src/test/resources/assessment-history/test-only-server-recommendation-catalog-v1.json'
if (process.argv.includes('--prepare-source')) {
  assert.equal(existsSync(fixturePath), false, 'never overwrite an existing fixture')
  writeFileSync(fixturePath, JSON.stringify(source))
  console.log('TEST_ONLY server input prepared from current validated V1.2.1 -> V1.1 catalog; no history output fixture')
}
const { captureHistoricalRecommendationV1: capture } = runtime.load(path.resolve('miniprogram/domain/assessment-history/recommendation-display.ts'))
const { deriveElderProfileV2: profile } = runtime.load(path.resolve('miniprogram/domain/elder-profile/v2/derive-elder-profile-v2.ts'))
const { evaluateFormalRecommendationV2: evaluate } = runtime.load(path.resolve('miniprogram/domain/recommendation/v2/index.ts'))
const answers = JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json', 'utf8'))
const completed = { kind: 'completed_assessment', id: '11111111-1111-4111-8111-111111111111', elderId: 'TEST_ONLY_ELDER', status: 'completed', schemaVersion: 2, completedAt: '2026-10-14T00:00:00Z', answers }
const input = { completed, catalog: source, evaluationAsOf: '2026-10-14T00:00:01Z', sourceReference: 'TEST_ONLY_SERVER_CATALOG_CURRENT_V121', sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex') }
const saved = capture(input); assert.equal(saved.ok, true)
const formal = evaluate({ profile: profile(completed).profile, institutions: records, datasetVersion: source.datasetVersion, datasetMode: source.datasetMode,
  evaluationAsOf: input.evaluationAsOf, contractVersion: 'recommendation-contract-v2', rulesetVersion: 'recommendation-ruleset-v2', policyVersion: 'conservative-exact-with-conditional-v1' })
assert.equal(formal.ok, true)
const s = formal.value.semantics
assert.equal(saved.display.assessmentId, formal.value.identity.assessmentId)
assert.equal(saved.display.assessmentCompletedAt, completed.completedAt)
assert.equal(JSON.stringify(saved.display.versions), JSON.stringify(s.versions))
const assertCandidates = (actual, expected) => {
  assert.equal(JSON.stringify(actual.map(c => [c.institutionId, c.recordRevision, c.matchTier])), JSON.stringify(expected.map(c => [c.institutionId, c.recordRevision, c.matchTier])))
  actual.forEach((row, index) => {
    assert.equal(JSON.stringify(row.reasons.map(r => r.reasonCode)), JSON.stringify(expected[index].reasons.map(r => r.reasonCode)))
    assert.equal(JSON.stringify(row.differences.map(r => [r.differenceCode, r.differenceCategory])), JSON.stringify(expected[index].differences.map(r => [r.differenceCode, r.differenceCategory])))
    assert.equal(row.display.institutionId, row.institutionId); assert.equal(row.display.recordRevision, row.recordRevision)
  })
}
assertCandidates(saved.display.cards, s.cards); assertCandidates(saved.display.conditionalCandidates, s.conditionalCandidates)
assertCandidates(saved.display.nearMatches, s.noExactMatch?.nearMatches || [])
const blocked = capture({ ...input, completed: { ...completed, answers: { ...answers, 'cognitive.symptoms': ['unknown'] } } })
assert.equal(blocked.ok, true); assert.equal(blocked.display.state, 'no_safe_recommendation'); assert.equal(blocked.display.cards.length, 0)
assert.ok(blocked.display.noExactMatch, 'business no-safe is a saved result, not absent history')
assert.equal(capture({ ...input, catalog: { ...source, records: [{ forged: true }] } }).ok, false)
assert.equal(capture({ ...input, catalog: { ...source, datasetMode: 'PRODUCTION' } }).ok, false)
const before = JSON.stringify(saved.display)
const { validHistoricalRecommendationV1: valid, historicalRecommendationViewV1: view } = runtime.load(path.resolve('miniprogram/domain/assessment-history/recommendation-view.ts'))
assert.equal(valid(saved.display, { id: completed.id, completedAt: completed.completedAt }), true)
assert.equal(valid({ ...saved.display, answers: {} }, { id: completed.id, completedAt: completed.completedAt }), false)
assert.equal(valid(saved.display, { id: 'another', completedAt: completed.completedAt }), false)
assert.equal(valid({ ...saved.display, versions: { ...saved.display.versions, recommendationRulesetVersion: 'future' } }, { id: completed.id, completedAt: completed.completedAt }), false)
assert.ok(view(blocked.display).title.includes('没有'))
const { createCompletedAssessmentUserLoopV1: client } = runtime.load(path.resolve('miniprogram/services/completed-assessment-user-loop.ts'))
const item = { kind: 'completed_assessment', id: completed.id, status: 'completed', schemaVersion: 2, completedAt: completed.completedAt,
  assessmentContractVersion: 'assessment-schema-v2', source: 'COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1', snapshotRevision: 1 }
const envelope = (availability, display) => ({ contractVersion: 'completed-assessment-history-api-v1', kind: 'historical_recommendation_result_v1', item, availability, display })
const read = async (data, statusCode = 200) => client(() => { throw new Error('readonly may not access Draft') }, {
  environment: () => 'develop', developmentBackendOrigin: () => 'https://test-only.example', login: async () => 'TEST_ONLY',
  request: async request => {
    if (request.url.endsWith('/user-loop-capability')) return { statusCode: 200, data: { contractVersion: 'completed-assessment-history-api-v1', kind: 'completed_assessment_user_loop_capability_v1', availability: 'ready', source: item.source } }
    if (request.url.endsWith('/auth/wechat')) return { statusCode: 200, data: { contractVersion: 'wechat-authenticated-principal-contract-v1', kind: 'wechat_authentication_result_v1', outcome: 'AUTHENTICATED', code: 'AUTHENTICATED', sessionEvidence: 'TEST_ONLY', expiresAt: new Date(Date.now() + 60000).toISOString() } }
    if (request.url.endsWith('/save-intents/scope')) return { statusCode: 200, data: {
      contractVersion: 'completed-assessment-history-api-v1', kind: 'history_save_recovery_v1', scopeId: '33333333-3333-4333-8333-333333333333',
      intentId: null, createdAt: null, state: 'SCOPE', item: null, sessionId: null,
    } }
    if (data instanceof Error) throw data
    return { statusCode, data }
  },
}).readRecommendation(item.id)
assert.equal((await read(envelope('ready', saved.display))).state, 'READY')
assert.equal((await read(envelope('ready', blocked.display))).state, 'READY')
assert.equal((await read(envelope('unavailable', null))).state, 'UNAVAILABLE')
assert.equal((await read(envelope('unsupported_version', null))).state, 'UNSUPPORTED_VERSION')
assert.equal((await read(new Error('TEST_ONLY_NETWORK'))).state, 'ERROR')
assert.equal((await read({ ...envelope('ready', saved.display), answers: {} })).state, 'ERROR')
assert.equal((await read(envelope('ready', saved.display), 404)).message, (await read({}, 404)).message)
completed.answers['basic.age'] = 77; source.records[0].recordRevision += 1
assert.equal(JSON.stringify(saved.display), before)
for (const secret of ['elderId', 'answers', 'elderSnapshot', 'elderEvidenceRefs', 'rankTuple', 'ruleId', 'localDraftId', 'recommendation_preview_v2']) assert.ok(!before.includes(secret), secret)
console.log('PASS: server-bound Formal Recommendation V2 capture; exact order/reasons/differences/gaps/source revisions and version parity')
console.log('PASS: legitimate no-safe, invalid source refusal, no Preview persistence, immutable projection after Draft/Catalog changes')
