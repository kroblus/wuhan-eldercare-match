// Portable tests. Positive service claims below are SYNTHETIC ONLY.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeResultV2UiDraft } from './fixtures/recommendation-result-v2-ui-fixtures.mjs'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eldercare-cap-evidence-'))
const clone = value => JSON.parse(JSON.stringify(value))
try {
  const filter = name => fs.statSync(name).isDirectory() || /\.(ts|json)$/.test(name)
  fs.cpSync('miniprogram', root, { recursive: true, filter })
  fs.cpSync('modes/production', path.join(root, 'production'), { recursive: true, filter })
  const rt = createWechatTsRuntime(loadWechatTypeScript().ts, { wx: { getStorageSync() {} }, Page() {}, Component() {}, getCurrentPages: () => [] })
  const load = file => rt.load(path.join(root, file + '.ts'))
  const { buildCapabilityRevision: revise, buildCapabilityHistory, validateCapabilityRow, capabilityFieldPaths } = load('production/capability-evidence')
  const { capabilityResearchCases, capabilitySources, productionCapabilityRevisions } = load('production/capability-reviews')
  const { readCapabilityReviewMatrix, readCapabilityReview } = load('production/capability-review-matrix')
  const { administrativeDivisionResolver } = load('production/administrative-divisions')
  const validate = value => load('domain/institution/v1-2-1/validate-institution-v1-2-1').validateInstitutionRecordV121(value, { administrativeDivisionResolver })
  const project = value => load('domain/institution/v1-2-1/project-to-v1-1').projectInstitutionRecordV121ToV11(value, { administrativeDivisionResolver })
  const effective = load('domain/institution/verification').resolveEffectiveCapability
  const at = '2026-10-23T12:00:00.000Z'
  const source = { institutionIds: load('mock/institution-catalog.mock').MOCK_INSTITUTION_CATALOG_V121.records.map(record => record.institutionId), title: 'TEST_SYNTHETIC_NOT_REAL', publisher: 'Synthetic test publisher', url: 'https://example.invalid/synthetic-evidence', publishedOn: '2026-10-20', reviewedOn: '2026-10-23', reviewDueOn: '2026-11-22', reviewState: 'available', sourceType: 'official_document' }
  const sources = { test: source }
  const row = (fieldPath = 'capabilities.specialCare.round_the_clock_care', status = 'supported', verificationStatus = 'verified') => ({ fieldPath, status, verificationStatus, valueSnapshot: { valueType: 'stable_code', value: status }, sourceKeys: ['test'], originalStatement: 'TEST_SYNTHETIC explicit field statement; not real institution data', basis: 'direct_current_statement', verifiedAt: '2026-10-23T00:00:00.000Z', validUntil: '2026-11-22T23:59:59.000Z', question: 'Synthetic test only' })
  const base = load('mock/institution-catalog.mock').MOCK_INSTITUTION_CATALOG_V121.records[0]
  const change = rows => ({ institutionId: base.institutionId, parentRevision: base.recordRevision, recordRevision: base.recordRevision + 1, reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', rows })
  const get = (object, field) => field.split('.').reduce((value, key) => value[key], object)
  const before = JSON.stringify(base)
  assert.equal(effective('supported', { status: 'unverified', evidenceIds: [] }, at), 'unknown')
  assert.ok(revise(base, change([row()]), { test: { ...source, institutionIds: ['different-institution'] } }).issues.includes('SOURCE_INSTITUTION_MISMATCH'))
  for (const status of ['supported', 'requires_assessment', 'unsupported']) {
    const result = revise(base, change([row(undefined, status)]), sources)
    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(validate(result.record).ok, true)
    assert.equal(project(result.record).ok, true)
    const fact = get(result.record, row().fieldPath)
    assert.equal(effective(fact.status, fact.verification, at), status)
    assert.equal(effective(fact.status, fact.verification, '2026-11-23T00:00:00.000Z'), 'unknown')
    assert.equal(JSON.stringify(base), before, 'old revision immutable')
    assert.ok(result.record.evidence.every(item => item.recordRevision === result.record.recordRevision && item.institutionId === base.institutionId))
    assert.equal(new Set(result.record.evidence.map(item => item.evidenceId)).size, result.record.evidence.length)
    const inheritedPhone = result.record.officialContact.officialPhones[0]
    if (inheritedPhone) assert.deepEqual(clone(inheritedPhone.phone.value), clone(base.officialContact.officialPhones[0].phone.value))
  }
  const expired = revise(base, change([row(undefined, 'supported', 'expired')]), sources)
  assert.equal(expired.ok, true)
  assert.equal(effective(get(expired.record, row().fieldPath).status, get(expired.record, row().fieldPath).verification, at), 'unknown')
  for (const [patch, expected] of [
    [{ fieldPath: 'capabilities.specialCare.fake' }, 'INVALID_FIELD_PATH'],
    [{ valueSnapshot: { valueType: 'stable_code', value: 'unsupported' } }, 'VALUE_SNAPSHOT_MISMATCH'],
    [{ validUntil: '2026-10-22T00:00:00.000Z' }, 'INVALID_VERIFICATION_DATES'],
    [{ verificationStatus: 'unverified' }, 'PENDING_REVIEW_ONLY'],
    [{ status: 'unknown', valueSnapshot: { valueType: 'stable_code', value: 'unknown' } }, 'PENDING_REVIEW_ONLY'],
    [{ basis: 'general_description' }, 'PENDING_REVIEW_ONLY'],
    [{ sourceKeys: ['missing'] }, 'SOURCE_NOT_FOUND'],
  ]) assert.ok(validateCapabilityRow({ ...row(), ...patch }, sources).includes(expected), expected)
  for (const [patch, expected] of [
    [{ url: '' }, 'INVALID_SOURCE'], [{ publishedOn: null }, 'PUBLICATION_DATE_UNCONFIRMED'],
    [{ reviewedOn: '2026-02-30' }, 'INVALID_SOURCE_DATES'], [{ reviewState: 'unavailable' }, 'SOURCE_UNAVAILABLE'],
    [{ reviewState: 'conflicting' }, 'SOURCE_CONFLICT'], [{ reviewDueOn: '2026-10-22' }, 'INVALID_SOURCE_DATES'],
  ]) assert.ok(validateCapabilityRow(row(), { test: { ...source, ...patch } }).includes(expected), expected)
  const good = revise(base, change([row()]), sources).record
  for (const tamper of [
    record => { record.evidence[0].recordRevision++ },
    record => { record.evidence.push(clone(record.evidence[0])) },
    record => { record.evidence.at(-1).valueSnapshot.value = 'unsupported' },
  ]) { const broken = clone(good); tamper(broken); assert.equal(validate(broken).ok, false); assert.equal(project(broken).ok, false) }
  const history = buildCapabilityHistory([base], [change([row()])], sources)
  assert.equal(history.records.length, 2)
  assert.equal(JSON.stringify(history.records[0]), before)
  assert.equal(history.currentRecords[0].recordRevision, change([]).recordRevision)
  assert.equal(history.currentPointers[0].recordRevision, change([]).recordRevision)
  const validateCatalog = load('services/institution-catalog-v1-2-1').validateInstitutionCatalogPayloadV121
  const historyPayload = { datasetVersion: 'SYNTHETIC_REVISION_TEST', datasetMode: 'MOCK_DEVELOPMENT_ONLY', records: history.currentRecords, currentPointers: history.currentPointers, presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] } }
  assert.equal(validateCatalog(historyPayload).ok, true)
  const wrongPointer = clone(historyPayload); wrongPointer.currentPointers[0].recordRevision = base.recordRevision
  assert.equal(validateCatalog(wrongPointer).ok, false, 'a historical revision cannot be silently chosen as current')
  const mixedRevisions = clone(historyPayload); mixedRevisions.records.push(clone(base))
  assert.equal(validateCatalog(mixedRevisions).ok, false, 'current pool must never contain two revisions of one institution')
  assert.throws(() => buildCapabilityHistory([base], [change([row()]), change([row()])], sources))
  assert.throws(() => buildCapabilityHistory([base], [{ ...change([row()]), parentRevision: 999 }], sources))
  console.log('PASS evidence: exact field/value/source/date closure, four capability values, independent verification, source outage/conflict, expiry, immutable revisions and current pointers')

  // Real research remains a separate unknown-only queue. Never publish it as
  // evidence or use it to fill missing capabilities in the actual provider.
  assert.equal(capabilityResearchCases.length, 4)
  assert.equal(productionCapabilityRevisions.length, 0)
  const matrix = readCapabilityReviewMatrix()
  assert.equal(matrix.length, 81)
  assert.ok(matrix.every(item => item.status === 'unknown' && !item.entersMatching && !item.sufficientForCurrentConclusion))
  for (const review of capabilityResearchCases) {
    assert.equal(review.reviewMethod, 'PUBLIC_DOCUMENT_REVIEW_ONLY')
    assert.ok(readCapabilityReview(review.institutionId, review.recordRevision, Date.parse(at)).questions.length)
    assert.equal(readCapabilityReview(review.institutionId, 999), null)
    assert.ok(readCapabilityReview(review.institutionId, review.recordRevision, Date.parse('2026-11-23')).stateLabel.includes('复核期限'))
  }
  for (const item of matrix) for (const key of item.sourceKeys) {
    const doc = capabilitySources[key]; assert.ok(doc && new URL(doc.url).protocol === 'https:')
    assert.ok(doc.institutionIds.includes(item.institutionId), 'review source must belong to the same institution')
    assert.ok(doc.publishedOn === null || doc.publishedOn <= doc.reviewedOn)
    assert.equal(doc.reviewedOn, '2026-10-23')
  }
  const first = load('production/first-record').createFirstRecord()
  const catalog = load('production/catalog').readModeCatalog()
  assert.equal(catalog.records.length, 11)
  assert.equal(JSON.stringify(load('production/catalog').readProductionRevision(first.institutionId, 1)), JSON.stringify(first))
  assert.equal(load('production/catalog').readProductionRevision(first.institutionId, 999), null)
  assert.ok(catalog.records.every(record => Object.values(record.capabilities).every(group => Object.values(group).every(fact => fact.status === 'unknown'))))
  console.log('PASS research: 4 existing institutions, 81 individually scoped pending fields, publication dates never inferred, production facts unchanged')

  // Exercise the real frozen evaluator via V1.2.1 -> V1.1 -> Catalog -> service.
  const { createRecommendationPreviewServiceV2 } = load('services/recommendation-preview-v2')
  const { createInstitutionCatalogServiceV11 } = load('services/institution-catalog-v1-1')
  const build = async records => {
    const projected = records.map(record => { const result = project(record); assert.equal(result.ok, true); return result.value })
    return createRecommendationPreviewServiceV2({ draftSource: { getDraft: () => makeResultV2UiDraft({ 'cognitive.specialCareNeeds': ['round_the_clock_care', 'one_to_one_caregiver'] }) }, institutionCatalog: createInstitutionCatalogServiceV11({ loadCatalog: async () => ({ datasetVersion: 'SYNTHETIC_CAPABILITY_TEST_ONLY', datasetMode: 'MOCK_DEVELOPMENT_ONLY', records: projected }) }) }).buildResultSnapshot(at)
  }
  const patchAll = (parent, status = 'supported') => {
    const rows = capabilityFieldPaths.filter(field => field.startsWith('capabilities.')).map(field => row(field, status))
    const result = revise(parent, { ...change(rows), institutionId: parent.institutionId, parentRevision: parent.recordRevision, recordRevision: parent.recordRevision + 1 }, sources)
    assert.equal(result.ok, true, JSON.stringify(result.issues)); return result.record
  }
  const complete = patchAll(base)
  const exact = await build([complete]); assert.equal(exact.ok, true)
  assert.equal(exact.value.preview.semantics.candidateEvaluations[0].matchTier, 'EXACT')
  const careField = 'capabilities.careLevelAcceptance.independent'
  const withdrawal = { fieldPath: careField, disposition: 'withdraw_to_unknown', status: 'unknown', verificationStatus: 'unverified', valueSnapshot: { valueType: 'stable_code', value: 'unknown' }, sourceKeys: [], originalStatement: 'TEST_SYNTHETIC: previous source unavailable or conflicting; withdraw current conclusion', basis: 'not_stated', question: 'Recheck current source' }
  const withdrawn = revise(complete, { institutionId: complete.institutionId, parentRevision: complete.recordRevision, recordRevision: complete.recordRevision + 1, reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', rows: [withdrawal] }, sources)
  assert.equal(withdrawn.ok, true)
  assert.equal(get(complete, careField).status, 'supported', 'withdrawal never overwrites historical support')
  assert.equal(get(withdrawn.record, careField).status, 'unknown')
  assert.equal(withdrawn.record.evidence.some(item => item.fieldPath === careField), false)
  const withdrawnResult = await build([withdrawn.record]); assert.equal(withdrawnResult.ok, true)
  assert.equal(withdrawnResult.value.preview.semantics.candidateEvaluations[0].matchTier, 'UNVERIFIED')
  const timeExpired = revise(complete, { institutionId: complete.institutionId, parentRevision: complete.recordRevision, recordRevision: complete.recordRevision + 1, reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', rows: [{ ...row(careField), validUntil: '2026-10-23T00:01:00.000Z' }] }, sources)
  assert.equal(timeExpired.ok, true)
  const expiredSnapshot = await build([timeExpired.record]); assert.equal(expiredSnapshot.ok, true)
  assert.equal(expiredSnapshot.value.preview.semantics.candidateEvaluations[0].matchTier, 'UNVERIFIED')
  assert.equal(expiredSnapshot.value.preview.semantics.cards.length, 0)
  for (const [status, expected] of [['requires_assessment', 'CONDITIONAL'], ['unsupported', 'INELIGIBLE']]) {
    const result = revise(complete, { institutionId: complete.institutionId, parentRevision: complete.recordRevision, recordRevision: complete.recordRevision + 1, reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', rows: [row(careField, status)] }, sources)
    assert.equal(result.ok, true)
    const snapshot = await build([result.record]); assert.equal(snapshot.ok, true)
    assert.equal(snapshot.value.preview.semantics.candidateEvaluations[0].matchTier, expected)
  }
  const unknownParent = clone(base)
  for (const group of Object.values(unknownParent.capabilities)) for (const fact of Object.values(group)) {
    unknownParent.evidence = unknownParent.evidence.filter(item => !fact.verification.evidenceIds.includes(item.evidenceId))
    fact.status = 'unknown'; fact.verification = { status: 'unverified', evidenceIds: [] }; delete fact.asOf
  }
  const partial = revise(unknownParent, change([row(careField)]), sources)
  assert.equal(partial.ok, true)
  const unresolved = await build([partial.record]); assert.equal(unresolved.ok, true)
  assert.equal(unresolved.value.preview.semantics.candidateEvaluations[0].matchTier, 'UNVERIFIED')
  assert.equal(unresolved.value.preview.semantics.cards.length, 0)
  const candidates = load('mock/institution-catalog.mock').MOCK_INSTITUTION_CATALOG_V121.records.slice(0, 4).map(parent => patchAll(parent))
  const forward = await build(candidates), reversed = await build([...candidates].reverse())
  assert.equal(forward.ok, true); assert.equal(reversed.ok, true)
  assert.ok(forward.value.preview.semantics.cards.length <= 3)
  assert.deepEqual(clone(forward.value.preview.semantics.cards), clone(reversed.value.preview.semantics.cards))
  assert.deepEqual(clone(forward), clone(await build(candidates)))
  console.log('PASS frozen matching: partial evidence cannot match, complete evidence EXACT, conditional/unsupported preserved, MAX_3, determinism and pool-order invariance')
  if (process.argv.includes('--with-build')) {
    let definition
    const compiled = createWechatTsRuntime(loadWechatTypeScript().ts, { Page(value) { definition = value }, Component() {}, getCurrentPages: () => [], wx: { getStorageSync() {}, nextTick(fn) { fn() }, request() { throw Error('Unexpected real request') } } })
    const loadBuilt = file => compiled.load(path.resolve('dist/production/miniprogram', file + '.js'))
    loadBuilt('pages/institution/detail')
    const actual = loadBuilt('production/catalog').readModeCatalog()
    for (const record of actual.records) {
      const page = { ...definition, data: clone(definition.data), setData(patch) { Object.assign(this.data, patch) } }
      page.onLoad({ institutionId: record.institutionId, recordRevision: String(record.recordRevision), source: 'direct_list' })
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0))
      assert.equal(page.data.pageState, 'ready')
      const researched = capabilityResearchCases.some(review => review.institutionId === record.institutionId && review.recordRevision === record.recordRevision)
      assert.equal(!!page.data.capabilityReview, researched)
      assert.equal(page.data.canRequestService, false)
      if (researched) {
        assert.ok(page.data.capabilityReview.summary.includes('未电话或现场确认'))
        assert.ok(page.data.capabilityReview.sources.length)
        assert.ok(page.data.capabilityReview.questions.length)
        assert.ok(!JSON.stringify(page.data.capabilityReview).includes('fieldPath'))
      }
    }
    const demo = createWechatTsRuntime(loadWechatTypeScript().ts)
    assert.equal(demo.load(path.resolve('dist/demo/miniprogram/runtime/institution-source-notes.js')).readInstitutionCapabilityReview('wh-taibao-hanyang', 1), null)
    assert.equal(fs.existsSync('dist/demo/miniprogram/production/capability-reviews.js'), false)
    console.log('PASS built detail pages: 4 exact-version review summaries, 7 institutions without false research claims, contextual questions, no booking and no production research in demo')
  }
} finally {
  const absolute = path.resolve(root)
  assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()))
  assert.ok(path.basename(absolute).startsWith('eldercare-cap-evidence-'))
  fs.rmSync(absolute, { recursive: true, force: true })
}
