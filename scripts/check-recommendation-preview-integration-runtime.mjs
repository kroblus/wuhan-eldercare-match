import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  INTEGRATION_CASE_IDS,
  INTEGRATION_EVALUATION_AS_OF,
  makeIntegrationDraft,
} from './fixtures/recommendation-preview-integration-fixtures.mjs'
import { makeV2Draft } from './fixtures/assessment-v2-fixtures.mjs'

/** In-memory runtime: real application/provider/domain modules, no built cache. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const require = createRequire(import.meta.url)
const clone = (value) => structuredClone(value)
const time = { evaluationAsOf: INTEGRATION_EVALUATION_AS_OF }
const relative = (file) => path.relative(root, file).split(path.sep).join('/')
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(file) : [file]
})

function loadTypeScript() {
  if (process.env.WECHAT_TYPESCRIPT_PATH) {
    const file = path.resolve(process.env.WECHAT_TYPESCRIPT_PATH)
    return { ts: require(file), file }
  }
  const directory = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const candidates = []
  for (const profile of readdirSync(directory, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const packages = path.join(directory, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packages)) continue
    for (const entry of readdirSync(packages, { withFileTypes: true })) {
      const file = path.join(packages, entry.name, 'lib', 'typescript.js')
      if (existsSync(file)) candidates.push(file)
    }
  }
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  assert.ok(candidates.length, 'actual WeChat TypeScript installation required')
  return { ts: require(candidates[0]), file: candidates[0] }
}

function createRuntime(ts, initialDraft = makeV2Draft()) {
  const cache = new Map()
  const loaded = new Set()
  const calls = { profile: 0, recommendation: [], validation: 0, storageRead: 0, writes: 0, logs: 0 }
  const forbidden = (kind) => () => { calls[kind] += 1; throw new Error(`forbidden ${kind}`) }
  class ExplicitDate extends Date {
    constructor(...args) {
      if (args.length === 0) throw new Error('implicit current time forbidden')
      super(...args)
    }
    static now() { throw new Error('Date.now forbidden') }
  }
  const deterministicMath = Object.create(Math)
  deterministicMath.random = () => { throw new Error('random forbidden') }
  const initialStorage = Object.create(null)
  if (initialDraft && initialDraft.schemaVersion === 2) {
    initialStorage['wuhan-eldercare-match.assessment-draft.active'] = 'v2'
    initialStorage['wuhan-eldercare-match.assessment-draft.v2'] = clone(initialDraft)
  } else {
    initialStorage['wuhan-eldercare-match.assessment-draft.active'] = 'v1'
    initialStorage['wuhan-eldercare-match.assessment-draft.v1'] = clone(initialDraft)
  }
  const context = vm.createContext({
    Date: ExplicitDate, Math: deterministicMath,
    wx: new Proxy({
      getStorageSync: (key) => {
        calls.storageRead += 1
        return Object.prototype.hasOwnProperty.call(initialStorage, key)
          ? clone(initialStorage[key])
          : ''
      },
      setStorageSync: forbidden('writes'), removeStorageSync: forbidden('writes'),
    }, { get(target, key) { if (!(key in target)) throw new Error(`unexpected wx API: ${String(key)}`); return target[key] } }),
    console: { log: forbidden('logs'), error: forbidden('logs'), warn: forbidden('logs') },
  })

  function load(file) {
    file = path.resolve(file)
    assert.ok(file.startsWith(`${appRoot}${path.sep}`), 'App imported outside miniprogram')
    if (cache.has(file)) return cache.get(file).exports
    const source = readFileSync(file, 'utf8')
    loaded.add(relative(file))
    const result = ts.transpileModule(source, {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
    })
    const diagnostics = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error)
    assert.equal(diagnostics.length, 0, `${relative(file)}: ${diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}`)
    const module = { exports: {} }
    cache.set(file, module)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import ${request}`)
      const base = path.resolve(path.dirname(file), request)
      const resolved = [`${base}.ts`, path.join(base, 'index.ts')].find(existsSync)
      assert.ok(resolved, `missing module ${request}`)
      return load(resolved)
    }
    vm.runInContext(`(function(require,module,exports){${result.outputText}\n})`, context, { filename: file })(localRequire, module, module.exports)
    if (relative(file) === 'miniprogram/domain/elder-profile/index.ts') {
      const original = module.exports.deriveElderProfilePreview
      const exports = { ...module.exports }
      exports.deriveElderProfilePreview = (...args) => { calls.profile += 1; return original(...args) }
      module.exports = exports
    }
    if (relative(file) === 'miniprogram/domain/recommendation/index.ts') {
      const original = module.exports.evaluateRecommendationPreview
      module.exports.evaluateRecommendationPreview = (input) => { calls.recommendation.push(clone(input)); return original(input) }
    }
    if (relative(file) === 'miniprogram/domain/institution/index.ts') {
      const original = module.exports.validateInstitutionRecord
      module.exports = { ...module.exports, validateInstitutionRecord: (input) => { calls.validation += 1; return original(input) } }
    }
    return module.exports
  }
  return { load: (name) => load(path.join(appRoot, name)), loaded, calls }
}

const failures = []
const executed = []
async function runCase(id, description, fn) {
  assert.ok(INTEGRATION_CASE_IDS.includes(id), `unexpected case ${id}`)
  assert.ok(!executed.includes(id), `duplicate case ${id}`)
  executed.push(id)
  let assertions = 0
  const check = {
    equal: (...args) => { assertions += 1; assert.equal(...args) },
    same: (actual, expected, message) => { assertions += 1; assert.deepEqual(clone(actual), clone(expected), message) },
    ok: (...args) => { assertions += 1; assert.ok(...args) },
  }
  try {
    await fn(check)
    assert.ok(assertions >= 2, `${id} must perform at least two independent assertions`)
    console.log(`PASS ${id} ${description} (${assertions} assertions)`)
  } catch (error) {
    failures.push(`${id}: ${error.message}`)
    console.error(`FAIL ${id}: ${error.message}`)
  }
}

async function main() {
  const { ts, file } = loadTypeScript()
  console.log(`PARSER: WeChat TypeScript ${ts.version} (${file})`)
  const runtimes = []
  const newRuntime = () => {
    const runtime = createRuntime(ts)
    runtimes.push(runtime)
    return runtime
  }
  const app = (runtime) => runtime.load('services/recommendation-preview.ts')
  const catalogs = (runtime) => runtime.load('services/institution-catalog.ts')
  const getCatalog = async (runtime) => {
    const result = await catalogs(runtime).institutionCatalogService.loadCatalog()
    assert.equal(result.ok, true, `development catalog must validate: ${JSON.stringify(result.error)}`)
    return result.value
  }
  function service(runtime, draft, catalogOrLoader) {
    let reads = 0
    let loads = 0
    const getDraft = typeof draft === 'function' ? draft : () => clone(draft)
    const loadCatalog = typeof catalogOrLoader === 'function' ? catalogOrLoader : async () => clone(catalogOrLoader)
    const catalogService = catalogs(runtime).createInstitutionCatalogService({
      loadCatalog: async () => { loads += 1; return loadCatalog() },
    })
    const instance = app(runtime).createRecommendationPreviewService({
      readDraftSnapshot: () => { reads += 1; return getDraft() }, catalogService,
    })
    return { build: (input = time) => instance.buildRecommendationPreview(input), counts: () => ({ reads, loads }) }
  }
  const assertError = (check, result, code) => {
    check.equal(result.ok, false)
    check.equal(result.error.code, code)
  }

  await runCase('INTEGRATION-001', 'complete Draft + valid catalog, real Domain parity', async c => {
    const rt = newRuntime()
    const catalog = await getCatalog(rt)
    const draft = makeIntegrationDraft()
    const s = service(rt, draft, catalog)
    const result = await s.build()
    c.equal(result.ok, true)
    c.equal(result.value.kind, 'recommendation_preview')
    c.equal(result.value.source.localDraftId, draft.localDraftId)
    const profile = rt.load('domain/elder-profile/index.ts').deriveElderProfilePreview(draft)
    const direct = rt.load('domain/recommendation/index.ts').evaluateRecommendationPreview({
      profile: profile.preview, institutions: catalog.records, datasetVersion: catalog.datasetVersion,
      datasetMode: catalog.datasetMode, ...time, rulesetVersion: 'recommendation-ruleset-v1',
      policyVersion: 'conservative-exact-with-conditional-v1',
    })
    c.same(result, direct, 'application must not change Domain results')
  })
  await runCase('INTEGRATION-002', 'incomplete Draft short circuits before catalog/engine', async c => {
    const rt = newRuntime(), draft = makeIntegrationDraft()
    delete draft.answers['adl.eating']
    const s = service(rt, draft, async () => { throw new Error('must not load') })
    assertError(c, await s.build(), 'ASSESSMENT_PREVIEW_ERROR')
    c.same(s.counts(), { reads: 1, loads: 0 })
    c.equal(rt.calls.recommendation.length, 0)
  })
  await runCase('INTEGRATION-003', 'one invalid record rejects entire catalog', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    catalog.records[4].recordRevision = 0
    assertError(c, await service(rt, makeIntegrationDraft(), catalog).build(), 'INVALID_INSTITUTION_RECORD')
    c.equal(rt.calls.recommendation.length, 0)
  })
  await runCase('INTEGRATION-004', 'empty catalog is stable no-data, not NO_EXACT_MATCH', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    catalog.records = []
    assertError(c, await service(rt, makeIntegrationDraft(), catalog).build(), 'NO_INSTITUTIONS_AVAILABLE')
    c.equal(rt.calls.recommendation.length, 0)
  })
  await runCase('INTEGRATION-005', 'full eight records/revisions reach Engine unchanged', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const result = await service(rt, makeIntegrationDraft(), catalog).build()
    c.equal(catalog.records.length, 8)
    c.same(rt.calls.recommendation[0].institutions, catalog.records)
    c.equal(result.value.semantics.poolManifest.entries.length, 8)
    c.same(result.value.semantics.poolManifest.entries.map(e => [e.institutionId, e.recordRevision]).sort(), catalog.records.map(e => [e.institutionId, e.recordRevision]).sort())
  })
  await runCase('INTEGRATION-006', 'Engine max three cards, no pre-truncation', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const result = await service(rt, makeIntegrationDraft({ 'budget.monthlyRange': 'unknown' }), catalog).build()
    const semantics = result.value.semantics
    c.ok(semantics.items.length + semantics.conditionalCandidates.length <= 3)
    c.equal(semantics.items.length, 3, 'must exercise actual max3 truncation')
    c.ok(semantics.candidateEvaluations.filter(e => e.matchTier === 'SOFT_NEAR').length > 3)
    c.equal(semantics.candidateEvaluations.length, 8)
  })
  await runCase('INTEGRATION-007', 'Unverified remains evaluated but never a card', async c => {
    const rt = newRuntime(), result = await service(rt, makeIntegrationDraft(), await getCatalog(rt)).build()
    const semantics = result.value.semantics
    const ids = semantics.candidateEvaluations.filter(e => e.matchTier === 'UNVERIFIED').map(e => e.institutionId)
    c.ok(ids.length > 0, 'catalog must exercise unverified')
    c.ok([...semantics.items, ...semantics.conditionalCandidates].every(e => !ids.includes(e.institutionId)))
  })
  await runCase('INTEGRATION-008', 'Ineligible remains evaluated but never a card', async c => {
    const rt = newRuntime(), result = await service(rt, makeIntegrationDraft(), await getCatalog(rt)).build()
    const semantics = result.value.semantics
    const ids = semantics.candidateEvaluations.filter(e => e.matchTier === 'INELIGIBLE').map(e => e.institutionId)
    c.ok(ids.length > 0, 'catalog must exercise ineligible')
    c.ok([...semantics.items, ...semantics.conditionalCandidates].every(e => !ids.includes(e.institutionId)))
  })
  await runCase('INTEGRATION-009', 'Conditional retains own tier and independent output list', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const full = await service(rt, makeIntegrationDraft(), catalog).build()
    const conditional = full.value.semantics.candidateEvaluations.filter(e => e.matchTier === 'CONDITIONAL')
    c.ok(conditional.length > 0)
    // Test-only input subset, NOT a provider/service filtering policy.
    catalog.records = catalog.records.filter(record => conditional.some(e => e.institutionId === record.institutionId))
    const result = await service(rt, makeIntegrationDraft(), catalog).build()
    c.equal(result.value.semantics.items.length, 0)
    c.ok(result.value.semantics.conditionalCandidates.length > 0)
    c.ok(result.value.semantics.conditionalCandidates.every(e => e.matchTier === 'CONDITIONAL'))
  })
  await runCase('INTEGRATION-010', 'operational availability never changes semantics/ranking', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const before = await service(rt, makeIntegrationDraft(), catalog).build()
    for (const record of catalog.records) {
      record.evidence = record.evidence.filter(e => !e.fieldPath.startsWith('operations.'))
      record.operations = { bedAvailability: { status: 'unavailable', asOf: time.evaluationAsOf, verification: { status: 'unverified', evidenceIds: [] } } }
    }
    const after = await service(rt, makeIntegrationDraft(), catalog).build()
    c.equal(after.ok, true)
    c.same(after, before)
  })
  await runCase('INTEGRATION-011', 'fixed explicit time produces repeated deepEqual', async c => {
    const rt = newRuntime(), s = service(rt, makeIntegrationDraft(), await getCatalog(rt))
    c.same(await s.build(), await s.build())
    c.same(s.counts(), { reads: 2, loads: 2 })
    c.ok(rt.calls.recommendation.every(input => input.evaluationAsOf === time.evaluationAsOf))
  })
  await runCase('INTEGRATION-012', 'catalog permutation does not change domain result', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const first = await service(rt, makeIntegrationDraft(), catalog).build()
    catalog.records.reverse()
    c.same(await service(rt, makeIntegrationDraft(), catalog).build(), first)
    catalog.records.push(catalog.records.shift())
    c.same(await service(rt, makeIntegrationDraft(), catalog).build(), first)
  })
  await runCase('INTEGRATION-013', 'changed Draft is rederived without stale Preview', async c => {
    const rt = newRuntime(), draft = makeIntegrationDraft()
    const s = service(rt, () => clone(draft), await getCatalog(rt))
    const first = await s.build()
    draft.answers['budget.monthlyRange'] = 'cny_12000_15000'
    const second = await s.build()
    c.equal(second.ok, true)
    c.ok(JSON.stringify(first) !== JSON.stringify(second))
    c.equal(second.value.semantics.elderSnapshot.financial.monthlyBudget, 'cny_12000_15000')
    c.equal(rt.calls.profile, 2)
  })
  await runCase('INTEGRATION-014', 'real Store exposes active V2 safely without Preview persistence or V1 semantic leakage', async c => {
    const rt = createRuntime(ts, makeV2Draft())
    const store = rt.load('store/assessment-draft.ts').assessmentDraftStore
    const before = clone(store.getDraft())
    const result = await app(rt).buildRecommendationPreview(time)
    assertError(c, result, 'ASSESSMENT_PREVIEW_ERROR', 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    c.same(store.getDraft(), before)
    c.equal(rt.calls.writes, 0)
    c.equal(rt.calls.logs, 0)
    c.equal(rt.calls.recommendation.length, 0)
  })
  await runCase('INTEGRATION-015', 'App source graph never imports scripts fixtures', async c => {
    const sources = walk(appRoot).filter(file => file.endsWith('.ts'))
    const violations = []
    for (const file of sources) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node) {
        let request
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) request = node.moduleSpecifier.text
        if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) request = node.arguments[0].text
        if (request && /(?:^|[\\/])(?:scripts|fixtures)(?:[\\/]|$)/.test(request)) violations.push(`${relative(file)}:${request}`)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    c.ok(sources.length > 0)
    c.same(violations, [])
  })
  await runCase('INTEGRATION-016', 'provider load failure sanitized and not swallowed as empty', async c => {
    const rt = newRuntime()
    const result = await service(rt, makeIntegrationDraft(), async () => { throw new Error('PRIVATE_HEALTH_PAYLOAD_SECRET') }).build()
    assertError(c, result, 'INSTITUTION_CATALOG_ERROR')
    c.ok(!JSON.stringify(result).includes('PRIVATE_HEALTH_PAYLOAD_SECRET'))
    c.equal(rt.calls.recommendation.length, 0)
    const invalidService = app(rt).createRecommendationPreviewService({
      readDraftSnapshot: makeIntegrationDraft,
      catalogService: { loadCatalog: async () => ({ ok: false, error: { code: 'INSTITUTION_CATALOG_ERROR', causeCode: 'PRIVATE_HEALTH_PAYLOAD_SECRET' } }) },
    })
    const badError = await invalidService.buildRecommendationPreview(time)
    assertError(c, badError, 'INSTITUTION_CATALOG_ERROR')
    c.ok(!JSON.stringify(badError).includes('PRIVATE_HEALTH_PAYLOAD_SECRET'))
  })
  await runCase('INTEGRATION-017', 'malformed catalog envelope rejected', async c => {
    const cyclic = { datasetMode: 'MOCK_DEVELOPMENT_ONLY', datasetVersion: 'cyclic-test', records: [] }
    cyclic.records.push(cyclic)
    for (const payload of [null, {}, { datasetMode: 'MOCK_DEVELOPMENT_ONLY', datasetVersion: '', records: [] }, cyclic]) {
      const rt = newRuntime()
      assertError(c, await service(rt, makeIntegrationDraft(), async () => payload).build(), 'INSTITUTION_CATALOG_ERROR')
      c.equal(rt.calls.recommendation.length, 0)
    }
  })
  await runCase('INTEGRATION-018', 'duplicate identity rejects whole pool before evaluation', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    catalog.records.push(clone(catalog.records[0]))
    assertError(c, await service(rt, makeIntegrationDraft(), catalog).build(), 'INVALID_INSTITUTION_RECORD')
    c.equal(rt.calls.recommendation.length, 0)
  })
  await runCase('INTEGRATION-019', 'explicit time rejected by frozen timestamp gate', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    for (const input of [{}, { evaluationAsOf: '' }, { evaluationAsOf: 'not-ISO' }, { evaluationAsOf: '2026-02-30T12:00:00Z' }]) {
      const result = await service(rt, makeIntegrationDraft(), catalog).build(input)
      assertError(c, result, 'RECOMMENDATION_DERIVATION_ERROR')
      c.equal(result.error.causeCode, 'INVALID_EVALUATION_AS_OF')
    }
  })
  await runCase('INTEGRATION-020', 'mock provenance, facts only, empty VR and detached provider loads', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    for (const record of catalog.records) {
      c.equal(record.recordProvenance, 'MOCK_DEVELOPMENT_ONLY')
      c.ok(/^示例机构 [A-H]（Mock）$/.test(record.identity.name.value))
      c.same([record.vr.url, record.vr.coverMediaId, record.vr.scenes], [null, null, []])
      c.ok(record.evidence.every(e => e.verificationStatus !== 'verified' || (e.sourceNote.includes('DEVELOPMENT_SYNTHETIC_VERIFICATION') && e.sourceNote.includes('NOT_REAL_INSTITUTION_DATA'))))
      c.ok(!('matchingTier' in record) && !('recommended' in record))
      if (record.price.referenceMonthlyPrice.availability !== 'provided') c.equal(record.price.referenceMonthlyPrice.value, null)
      c.equal(record.operations.bedAvailability.status, 'unknown')
    }
    const before = clone(catalog)
    catalog.records[0].identity.name.value = 'poisoned consumer'
    c.same(await getCatalog(rt), before)
    const provider = rt.load('mock/institution-catalog.mock.ts').mockInstitutionCatalogProvider
    const providerFirst = await provider.loadCatalog()
    providerFirst.records[0].capabilities.specialCare.tube_feeding.status = 'unknown'
    c.same(await provider.loadCatalog(), before, 'provider direct loads must be detached')
  })
  await runCase('INTEGRATION-021', 'one Draft snapshot per asynchronous request', async c => {
    const rt = newRuntime(), draft = makeIntegrationDraft(), catalog = await getCatalog(rt)
    let release
    const wait = new Promise(resolve => { release = resolve })
    const s = service(rt, () => clone(draft), async () => { await wait; return catalog })
    const pending = s.build()
    draft.answers['budget.monthlyRange'] = 'cny_8000_12000'
    release()
    const result = await pending
    c.same(s.counts(), { reads: 1, loads: 1 })
    c.equal(result.value.semantics.elderSnapshot.financial.monthlyBudget, 'cny_5000_8000')
  })
  await runCase('INTEGRATION-022', 'no fabricated formal identities or sensitive errors', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    const result = await service(rt, makeIntegrationDraft(), catalog).build()
    const forbiddenKeys = new Set(['assessmentId', 'elderId', 'recommendationId', 'completedAt', 'identity', 'generatedAt'])
    const found = []
    const visit = (value) => { if (!value || typeof value !== 'object') return; for (const key of Object.keys(value)) { if (forbiddenKeys.has(key)) found.push(key); visit(value[key]) } }
    visit(result)
    c.same(found, [])
    catalog.records[0].evidence[0].fieldPath = 'PRIVATE_HEALTH_PAYLOAD_SECRET'
    const invalid = await service(rt, makeIntegrationDraft(), catalog).build()
    assertError(c, invalid, 'INVALID_INSTITUTION_RECORD')
    c.ok(!JSON.stringify(invalid).includes('PRIVATE_HEALTH_PAYLOAD_SECRET'))
  })
  await runCase('INTEGRATION-023', 'provider has no publication/provenance pre-filter', async c => {
    const rt = newRuntime(), catalog = await getCatalog(rt)
    catalog.records[0].recordStatus = 'suspended'
    const result = await service(rt, makeIntegrationDraft(), catalog).build()
    c.equal(result.ok, true)
    c.equal(rt.calls.recommendation[0].institutions.length, 8)
    const entry = result.value.semantics.poolManifest.entries.find(e => e.institutionId === catalog.records[0].institutionId)
    c.equal(entry.disposition, 'excluded')
    c.equal(entry.exclusionReasonCode, 'RECORD_NOT_PUBLISHED')
  })
  await runCase('INTEGRATION-024', 'legacy data stays isolated, synthetic regions do not enter Assessment', async c => {
    const rt = newRuntime()
    await app(rt).buildRecommendationPreview(time)
    c.ok(!rt.loaded.has('miniprogram/mock/institutions.mock.ts'))
    c.ok(!rt.loaded.has('miniprogram/services/institution.service.ts'))
    const legacy = rt.load('mock/institutions.mock.ts').MOCK_INSTITUTIONS
    c.ok(legacy.every(record => record.regionCode === null && record.regionDisplayName === null && record.monthlyFee === null))
    const regions = rt.load('services/institution-region-catalog.ts').buildInstitutionRegionCatalog(legacy)
    c.same(regions.catalog.options, [])
    const catalog = await getCatalog(rt)
    catalog.records = legacy
    const before = rt.calls.recommendation.length
    assertError(c, await service(rt, makeIntegrationDraft(), catalog).build(), 'INVALID_INSTITUTION_RECORD')
    c.equal(rt.calls.recommendation.length, before, 'legacy DTO may not be silently upgraded')
  })

  assert.deepEqual(executed, [...INTEGRATION_CASE_IDS], 'fixed manifest must execute fully in order')
  assert.equal(new Set(executed).size, INTEGRATION_CASE_IDS.length, 'duplicate/missing case')
  assert.ok(runtimes.every(runtime => runtime.calls.writes === 0 && runtime.calls.logs === 0), 'all success/error paths must remain write-free and log-free')
  const loaded = [...new Set(runtimes.flatMap(runtime => [...runtime.loaded]))].sort()
  console.log(`REAL_APPLICATION_MODULES_LOADED: ${loaded.length}`)
  console.log('SIDE_EFFECTS: storage writes = 0; application logs = 0')
  console.log(`CASES: ${executed.length}; FAILED: ${failures.length}`)
  if (failures.length) throw new Error(failures.join('\n'))
  console.log('RECOMMENDATION_PREVIEW_INTEGRATION_RUNTIME = PASS')
}

main().catch(error => {
  console.error('RECOMMENDATION_PREVIEW_INTEGRATION_RUNTIME = FAIL')
  console.error(error.message)
  process.exitCode = 1
})
