import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  makeResultV2CatalogFixture,
  makeResultV2UiDraft,
  RESULT_V2_ALTERNATE_AS_OF,
  RESULT_V2_EVALUATION_AS_OF,
  RESULT_V2_SNAPSHOT_CASES,
  RESULT_V2_TARGET_IDS,
  RESULT_V2_UI_CASES,
  RESULT_V2_UI_FIXTURE_MANIFEST,
} from './fixtures/recommendation-result-v2-ui-fixtures.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const evaluatorEntry = path.join(appRoot, 'domain', 'recommendation', 'v2', 'evaluate-recommendation-preview-v2.ts')

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const file = path.resolve(explicitPath)
    assert.ok(existsSync(file), `WECHAT_TYPESCRIPT_PATH does not exist: ${file}`)
    const ts = require(file)
    assert.equal(ts.version, '4.1.2', `expected WeChat TypeScript 4.1.2, got ${ts.version}`)
    return { ts, file }
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const candidates = []
  if (existsSync(profileRoot)) {
    readdirSync(profileRoot, { withFileTypes: true }).forEach((profile) => {
      if (!profile.isDirectory()) return
      const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(packageRoot)) return
      readdirSync(packageRoot, { withFileTypes: true }).forEach((runtime) => {
        const file = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(file)) candidates.push({ file, mtime: statSync(file).mtimeMs })
      })
    })
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  const selected = candidates.find((candidate) => require(candidate.file).version === '4.1.2')
  assert.ok(selected, 'WeChat TypeScript 4.1.2 parser is required')
  return { ts: require(selected.file), file: selected.file }
}

const createRuntime = (typescript) => {
  const cache = new Map()
  const calls = {
    catalogLoads: 0,
    draftReads: 0,
    evaluatorCalls: 0,
    evaluationInputs: [],
  }
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    wx: {
      getStorageSync: () => '',
      setStorageSync: () => { throw new Error('storage writes are forbidden') },
      removeStorageSync: () => { throw new Error('storage writes are forbidden') },
    },
  })
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.js')]
    const resolved = candidates.find((file) => existsSync(file) && statSync(file).isFile())
    assert.ok(resolved, `cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (file) => {
    const resolved = path.resolve(file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = resolved.endsWith('.ts')
      ? typescript.transpileModule(source, {
        fileName: resolved,
        reportDiagnostics: true,
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          strict: true,
        },
      })
      : { outputText: source, diagnostics: [] }
    const diagnostics = (output.diagnostics || []).filter((item) => item.category === typescript.DiagnosticCategory.Error)
    assert.equal(diagnostics.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire, module, module.exports,
    )
    if (resolved === evaluatorEntry && typeof module.exports.evaluateRecommendationPreviewV2 === 'function') {
      const original = module.exports.evaluateRecommendationPreviewV2
      module.exports = {
        ...module.exports,
        evaluateRecommendationPreviewV2: (input) => {
          calls.evaluatorCalls += 1
          calls.evaluationInputs.push(clone(input))
          return original(input)
        },
      }
    }
    return module.exports
  }
  return { calls, load }
}

const containsForbiddenIdentity = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  const forbidden = ['assessmentId', 'elderId', 'recommendationId', 'previewId', 'completedAt', 'generatedAt']
  if (Object.keys(value).some((key) => forbidden.includes(key))) return true
  return Object.values(value).some((child) => containsForbiddenIdentity(child, seen))
}

const containsRawInstitutionRecord = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  const forbidden = ['records', 'rawRecord', 'capabilities', 'sourceNote']
  if (Object.keys(value).some((key) => forbidden.includes(key))) return true
  return Object.values(value).some((child) => containsRawInstitutionRecord(child, seen))
}

const assertResultError = (check, result, code, causeCode) => {
  check.equal(result.ok, false)
  check.equal(result.error.code, code)
  if (causeCode !== undefined) check.equal(result.error.causeCode, causeCode)
  check.ok(typeof result.error.causeCode === 'string')
  check.equal(Object.prototype.hasOwnProperty.call(result, 'value'), false)
}

const failures = []
const executedSnapshots = []
const executedUi = []

const run = async (id, description, fn, collection, manifest) => {
  const declared = collection === executedSnapshots ? RESULT_V2_SNAPSHOT_CASES : RESULT_V2_UI_CASES
  assert.ok(declared.includes(id), `unexpected fixture ${id}`)
  assert.ok(!collection.includes(id), `duplicate fixture ${id}`)
  let assertions = 0
  const check = {
    equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message) },
    deepEqual(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message) },
    ok(value, message) { assertions += 1; assert.ok(value, message) },
  }
  try {
    await fn(check)
    assert.ok(assertions >= manifest.minimumAssertionsPerCase,
      `${id} must have at least ${manifest.minimumAssertionsPerCase} assertions`)
    collection.push(id)
    console.log(`PASS ${id} ${description} (${assertions} assertions)`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const noReasonCode = (candidate, code) => !candidate.reasons.some((item) => item.reasonCode === code)
  && !candidate.differences.some((item) => item.differenceCode === code)

const cardWithFact = (viewModel, key) => viewModel.cards.find((card) =>
  card.compactFacts.some((fact) => fact.key === key))

const cardWithPrice = (viewModel, predicate) => viewModel.cards.find((card) => predicate(card.price))

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createRuntime(ts)
  const catalogModule = runtime.load(path.join(appRoot, 'services', 'institution-catalog-v1-1.ts'))
  const resultServiceModule = runtime.load(path.join(appRoot, 'services', 'recommendation-preview-v2.ts'))
  const vmModule = runtime.load(path.join(appRoot, 'pages', 'recommendation', 'result-v2-view-model.ts'))
  const applicationModule = runtime.load(path.join(appRoot, 'services', 'recommendation-result-application.ts'))
  const resultSource = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.ts'), 'utf8')
  const wxml = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')

  const catalogResult = await catalogModule.institutionCatalogServiceV11.loadCatalog()
  assert.equal(catalogResult.ok, true, 'development catalog must validate')
  const canonicalCatalog = clone(catalogResult.value)
  assert.equal(canonicalCatalog.records.length, RESULT_V2_UI_FIXTURE_MANIFEST.completePoolSize)

  const build = async ({
    draft = makeResultV2UiDraft(),
    variant = 'exact',
    customCatalog = null,
    evaluationAsOf = RESULT_V2_EVALUATION_AS_OF,
    evaluatorOverride = null,
    directCatalogService = null,
  } = {}) => {
    const evaluatorModule = runtime.load(evaluatorEntry)
    const originalEvaluator = evaluatorModule.evaluateRecommendationPreviewV2
    if (evaluatorOverride !== null) evaluatorModule.evaluateRecommendationPreviewV2 = evaluatorOverride(originalEvaluator)
    const providerCatalog = customCatalog || makeResultV2CatalogFixture(canonicalCatalog, variant)
    const catalogService = directCatalogService || catalogModule.createInstitutionCatalogServiceV11({
      loadCatalog: async () => {
        runtime.calls.catalogLoads += 1
        return clone(providerCatalog)
      },
    })
    const service = resultServiceModule.createRecommendationPreviewServiceV2({
      draftSource: {
        getDraft: () => {
          runtime.calls.draftReads += 1
          return clone(draft)
        },
      },
      institutionCatalog: catalogService,
    })
    try {
      return await service.buildResultSnapshot(evaluationAsOf)
    } finally {
      if (evaluatorOverride !== null) evaluatorModule.evaluateRecommendationPreviewV2 = originalEvaluator
    }
  }

  await run('RESULT-SNAPSHOT-V2-001', 'exact semantics and same-source displays remain aligned', async (c) => {
    const result = await build()
    c.equal(result.ok, true)
    c.equal(result.value.preview.semantics.exactMatch, true)
    c.ok(result.value.preview.semantics.cards.length > 0)
    c.equal(result.value.preview.semantics.cards.every((item) => item.matchTier === 'EXACT'), true)
    c.equal(result.value.institutionDisplays.length, RESULT_V2_UI_FIXTURE_MANIFEST.completePoolSize)
    c.equal(result.value.institutionDisplays.every((display) =>
      result.value.preview.semantics.poolManifest.entries.some((entry) =>
        entry.institutionId === display.institutionId && entry.recordRevision === display.recordRevision)), true)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-002', 'room uncertainty produces real SoftNear semantics', async (c) => {
    const result = await build({
      draft: makeResultV2UiDraft({ 'preference.roomType': 'single' }),
      variant: 'exact',
    })
    c.equal(result.ok, true)
    c.equal(result.value.preview.semantics.exactMatch, false)
    c.ok(result.value.preview.semantics.cards.length > 0)
    c.equal(result.value.preview.semantics.cards.every((item) => item.matchTier === 'SOFT_NEAR'), true)
    c.equal(result.value.preview.semantics.cards.every((item) => item.roomFit.fit === 'unknown'), true)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-003', 'conditional candidates remain separate from cards', async (c) => {
    const result = await build({
      draft: makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }),
      variant: 'conditional',
    })
    c.equal(result.ok, true)
    c.equal(result.value.preview.semantics.cards.length, 0)
    c.ok(result.value.preview.semantics.conditionalCandidates.length > 0)
    c.equal(result.value.preview.semantics.conditionalCandidates.every((item) => item.matchTier === 'CONDITIONAL'), true)
    c.equal(result.value.preview.semantics.noExactMatch.reasonCode, 'ONLY_CONDITIONAL_CANDIDATES')
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-004', 'incomplete V2 Draft short-circuits the catalog', async (c) => {
    const beforeLoads = runtime.calls.catalogLoads
    const beforeEvaluations = runtime.calls.evaluatorCalls
    const result = await build({
      draft: makeResultV2UiDraft({ 'health.chewingAbility': undefined }),
    })
    c.equal(result.ok, false)
    c.equal(result.error.code, 'ASSESSMENT_PROFILE_V2_ERROR')
    c.equal(runtime.calls.catalogLoads, beforeLoads)
    c.equal(runtime.calls.evaluatorCalls, beforeEvaluations)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-005', 'invalid catalog is a stable catalog error', async (c) => {
    const beforeEvaluations = runtime.calls.evaluatorCalls
    const result = await build({
      customCatalog: { datasetVersion: 'invalid', datasetMode: 'MOCK_DEVELOPMENT_ONLY', records: [{}] },
    })
    assertResultError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'INVALID_INSTITUTION_RECORD')
    c.equal(runtime.calls.evaluatorCalls, beforeEvaluations)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-006', 'empty catalog fails closed for Result Snapshot', async (c) => {
    const result = await build({ customCatalog: { ...canonicalCatalog, records: [] } })
    assertResultError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'NO_INSTITUTIONS_AVAILABLE')
    c.equal(result.error.causeCode, 'NO_INSTITUTIONS_AVAILABLE')
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-007', 'the complete pool reaches exactly one evaluator call with one time', async (c) => {
    const beforeEvaluations = runtime.calls.evaluatorCalls
    const beforeLoads = runtime.calls.catalogLoads
    const result = await build()
    const input = runtime.calls.evaluationInputs[runtime.calls.evaluationInputs.length - 1]
    c.equal(result.ok, true)
    c.equal(runtime.calls.catalogLoads - beforeLoads, 1)
    c.equal(runtime.calls.evaluatorCalls - beforeEvaluations, 1)
    c.equal(input.institutions.length, RESULT_V2_UI_FIXTURE_MANIFEST.completePoolSize)
    c.equal(input.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
    c.equal(result.value.preview.semantics.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
    c.equal(result.value.preview.semantics.poolManifest.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-008', 'missing same-source candidate fails atomically', async (c) => {
    const result = await build({
      evaluatorOverride: (original) => (input) => {
        const evaluated = original(input)
        if (!evaluated.ok) return evaluated
        const next = clone(evaluated)
        next.value.semantics.cards[0].institutionId = 'missing-ui-source'
        return next
      },
    })
    assertResultError(c, result, 'RESULT_SOURCE_ASSOCIATION_ERROR', 'DISPLAY_SOURCE_MISSING')
    c.equal(result.error.candidateIndex, 0)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-009', 'revision mismatch cannot fall back to another record', async (c) => {
    const result = await build({
      evaluatorOverride: (original) => (input) => {
        const evaluated = original(input)
        if (!evaluated.ok) return evaluated
        const next = clone(evaluated)
        next.value.semantics.cards[0].recordRevision += 1
        return next
      },
    })
    assertResultError(c, result, 'RESULT_SOURCE_ASSOCIATION_ERROR', 'DISPLAY_SOURCE_REVISION_MISMATCH')
    c.equal(result.error.candidateIndex, 0)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-010', 'duplicate display source fails at the join boundary', async (c) => {
    const duplicateCatalog = {
      ...canonicalCatalog,
      records: [canonicalCatalog.records[0], ...canonicalCatalog.records],
    }
    const evaluatorModule = runtime.load(evaluatorEntry)
    const originalEvaluator = evaluatorModule.evaluateRecommendationPreviewV2
    evaluatorModule.evaluateRecommendationPreviewV2 = (input) => originalEvaluator({
      ...input,
      institutions: canonicalCatalog.records,
    })
    const directCatalogService = {
      loadCatalog: async () => {
        runtime.calls.catalogLoads += 1
        return { ok: true, value: clone(duplicateCatalog) }
      },
    }
    let result
    try {
      result = await build({ directCatalogService })
    } finally {
      evaluatorModule.evaluateRecommendationPreviewV2 = originalEvaluator
    }
    assertResultError(c, result, 'RESULT_SOURCE_ASSOCIATION_ERROR', 'DISPLAY_SOURCE_DUPLICATE')
    c.equal(runtime.calls.catalogLoads > 0, true)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-011', 'candidate and display provenance must be identical', async (c) => {
    const result = await build({
      evaluatorOverride: (original) => (input) => {
        const evaluated = original(input)
        if (!evaluated.ok) return evaluated
        const next = clone(evaluated)
        const id = next.value.semantics.cards[0].institutionId
        const entry = next.value.semantics.poolManifest.entries.find((item) => item.institutionId === id)
        entry.recordProvenance = 'PRODUCTION_CANDIDATE'
        return next
      },
    })
    assertResultError(c, result, 'RESULT_SOURCE_ASSOCIATION_ERROR', 'DISPLAY_SOURCE_PROVENANCE_MISMATCH')
    c.equal(result.error.candidateIndex, 0)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-012', 'candidate/display context mismatch is not silently corrected', async (c) => {
    const result = await build({
      evaluatorOverride: (original) => (input) => {
        const evaluated = original(input)
        if (!evaluated.ok) return evaluated
        const next = clone(evaluated)
        next.value.semantics.evaluationAsOf = RESULT_V2_ALTERNATE_AS_OF
        return next
      },
    })
    assertResultError(c, result, 'RESULT_SOURCE_ASSOCIATION_ERROR', 'DISPLAY_SOURCE_CONTEXT_MISMATCH')
    c.equal(Object.prototype.hasOwnProperty.call(result.error, 'preview'), false)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-013', 'one catalog load and no second lookup build the same snapshot', async (c) => {
    const beforeLoads = runtime.calls.catalogLoads
    const beforeEvaluations = runtime.calls.evaluatorCalls
    const result = await build({ variant: 'operational-advisory' })
    c.equal(result.ok, true)
    c.equal(runtime.calls.catalogLoads - beforeLoads, 1)
    c.equal(runtime.calls.evaluatorCalls - beforeEvaluations, 1)
    c.equal(result.value.institutionDisplays.length, RESULT_V2_UI_FIXTURE_MANIFEST.completePoolSize)
    c.ok(result.value.operationalDisplayAdvisories.some((item) => item.code === 'AVAILABILITY_DISPLAY_ONLY'))
    c.equal(result.value.preview.semantics.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-014', 'application snapshot carries projections, never raw InstitutionRecord', async (c) => {
    const result = await build()
    c.equal(result.ok, true)
    c.equal(containsRawInstitutionRecord(result.value), false)
    c.equal(result.value.institutionDisplays.every((display) =>
      !Object.prototype.hasOwnProperty.call(display, 'evidence')
      && !Object.prototype.hasOwnProperty.call(display, 'capabilities')), true)
    c.equal(result.value.institutionDisplays[0].kind, 'institution_display_snapshot_v1_1')
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-015', 'Mock provenance is retained in the source context and displays', async (c) => {
    const result = await build()
    c.equal(result.ok, true)
    c.equal(result.value.sourceContext.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
    c.equal(result.value.institutionDisplays.every((display) => display.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'), true)
    c.equal(result.value.preview.semantics.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-016', 'readiness-blocked preview is a successful no-card semantic result', async (c) => {
    const result = await build({ draft: makeResultV2UiDraft({ 'health.swallowingAbility': 'unknown' }) })
    c.equal(result.ok, true)
    c.equal(result.value.preview.semantics.elderReadiness, 'blocked_by_required_clarification')
    c.equal(result.value.preview.semantics.cards.length, 0)
    c.equal(result.value.preview.semantics.conditionalCandidates.length, 0)
    c.equal(result.value.preview.semantics.noExactMatch.reasonCode, 'REQUIRED_CAPABILITY_UNRESOLVED')
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-017', 'fixed evaluation time keeps two snapshots deep-equal', async (c) => {
    const first = await build()
    const second = await build()
    c.equal(first.ok, true)
    c.deepEqual(second, first)
    c.equal(first.value.sourceContext.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-SNAPSHOT-V2-018', 'live application dispatches schema-2 Draft to Result V2', async (c) => {
    const expected = await build()
    const service = applicationModule.createRecommendationResultApplicationService({
      draftSource: { getDraft: () => makeResultV2UiDraft() },
      legacyBuilder: async () => { throw new Error('V1 builder must not run') },
      v2Builder: async () => expected,
    })
    const result = await service.build(RESULT_V2_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(result.version, 2)
    c.equal(result.value.kind, 'recommendation_result_application_snapshot_v2')
    c.equal(result.value.sourceContext.evaluationAsOf, RESULT_V2_EVALUATION_AS_OF)
    c.equal(result.value.preview.semantics.datasetMode, 'MOCK_DEVELOPMENT_ONLY')

    let legacyCalls = 0
    const unsupportedService = applicationModule.createRecommendationResultApplicationService({
      draftSource: { getDraft: () => ({ ...makeResultV2UiDraft(), schemaVersion: 99 }) },
      legacyBuilder: async () => {
        legacyCalls += 1
        throw new Error('unsupported schema must not fall back to V1')
      },
      v2Builder: async () => { throw new Error('unsupported schema must not run V2') },
    })
    const unsupported = await unsupportedService.build(RESULT_V2_EVALUATION_AS_OF)
    c.equal(unsupported.ok, false)
    c.equal(unsupported.version, 2)
    c.equal(unsupported.error.code, 'ASSESSMENT_PROFILE_V2_ERROR')
    c.equal(unsupported.error.causeCode, 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    c.equal(legacyCalls, 0)
  }, executedSnapshots, RESULT_V2_UI_FIXTURE_MANIFEST)

  const scenarioCache = new Map()
  const scenario = async (name) => {
    if (!scenarioCache.has(name)) {
      const definitions = {
        exact: {},
        softNear: { draft: makeResultV2UiDraft({ 'preference.roomType': 'single' }) },
        conditional: { draft: makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }), variant: 'conditional' },
        readiness: { draft: makeResultV2UiDraft({ 'health.swallowingAbility': 'unknown' }) },
        otherNoSafe: { draft: makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }), variant: 'hard-conflict' },
        roomMatch: { draft: makeResultV2UiDraft({ 'preference.roomType': 'single' }), variant: 'room-match' },
        roomUnknown: { draft: makeResultV2UiDraft({ 'preference.roomType': 'single' }), variant: 'exact' },
        roomMismatchGuard: { draft: makeResultV2UiDraft({ 'preference.roomType': 'single' }), variant: 'room-mismatch-guard' },
        mealMatch: { draft: makeResultV2UiDraft({ 'preference.mealSchedule': 'three_meals_one_snack' }), variant: 'meal-match' },
        mealMismatch: { draft: makeResultV2UiDraft({ 'preference.mealSchedule': 'three_meals_one_snack' }), variant: 'meal-mismatch' },
        mealUnavailable: { draft: makeResultV2UiDraft({ 'preference.mealSchedule': 'three_meals_one_snack' }), variant: 'meal-unavailable' },
        mealUnknown: { draft: makeResultV2UiDraft({ 'preference.mealSchedule': 'three_meals_one_snack' }), variant: 'meal-unknown' },
        nutritionSupported: { draft: makeResultV2UiDraft({ 'health.chewingAbility': 'easy_chew' }), variant: 'nutrition-supported' },
        nutritionUnavailable: { draft: makeResultV2UiDraft({ 'health.chewingAbility': 'easy_chew' }), variant: 'nutrition-unavailable' },
        nutritionInquiry: { draft: makeResultV2UiDraft({ 'health.chewingAbility': 'easy_chew' }), variant: 'nutrition-inquiry' },
        nutritionUnknown: { draft: makeResultV2UiDraft({ 'health.chewingAbility': 'easy_chew' }), variant: 'nutrition-unknown' },
        budget: {
          draft: makeResultV2UiDraft({
            'adl.eating': 'needs_feeding',
            'adl.mobility': 'bedridden',
            'adl.toileting': 'full_assistance',
            'adl.bathing': 'full_assistance',
            'adl.dressing': 'full_assistance',
            'adl.transfer': 'fully_dependent',
            'adl.stairs': 'unable',
            'budget.monthlyRange': 'cny_3500_5000',
          }),
        },
        activity: { draft: makeResultV2UiDraft({ 'preference.activityPreference': 'indoor' }), variant: 'activity-present' },
        priorityNotScorable: { draft: makeResultV2UiDraft({ 'preference.priorities': ['activity_space'] }) },
        operational: { variant: 'operational-advisory' },
        boundedPrice: {},
        startingPrice: { draft: makeResultV2UiDraft({ 'budget.monthlyRange': 'cny_3500_5000' }) },
        unknownPrice: { variant: 'price-unknown' },
      }
      assert.ok(Object.prototype.hasOwnProperty.call(definitions, name), `unknown UI scenario ${name}`)
      scenarioCache.set(name, await build(definitions[name]))
    }
    return scenarioCache.get(name)
  }

  const view = async (name) => {
    const result = await scenario(name)
    assert.equal(result.ok, true, `${name} scenario must build`)
    return { result, vm: vmModule.createRecommendationResultViewModelV2(result.value) }
  }

  await run('RESULT-UI-V2-001', 'Exact has a ready_exact state and cards', async (c) => {
    const { result, vm } = await view('exact')
    c.equal(result.value.preview.semantics.exactMatch, true)
    c.equal(vm.state, 'ready_exact')
    c.ok(vm.cards.length > 0)
    c.equal(vm.emptyReason, null)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-002', 'SoftNear retains cards and explains preference uncertainty', async (c) => {
    const { result, vm } = await view('softNear')
    c.equal(result.value.preview.semantics.exactMatch, false)
    c.equal(vm.state, 'ready_soft_near')
    c.ok(vm.cards.some((card) => card.compactFacts.some((fact) => fact.key === 'room')))
    c.equal(vm.cards.every((card) => card.isConditional === false), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-003', 'Conditional is a separate ready_conditional section', async (c) => {
    const { vm } = await view('conditional')
    c.equal(vm.state, 'ready_conditional')
    c.equal(vm.cards.length, 0)
    c.ok(vm.conditionalCards.length > 0)
    c.equal(vm.conditionalCards.every((card) => card.isConditional === true), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-004', 'readiness no-safe state never exposes recommendation cards', async (c) => {
    const { vm } = await view('readiness')
    c.equal(vm.state, 'no_safe_recommendation')
    c.equal(vm.emptyReason, 'ELDER_READINESS_BLOCKED')
    c.equal(vm.cards.length, 0)
    c.equal(vm.conditionalCards.length, 0)
    c.ok(vm.headline.includes('补充或确认老人信息'))
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-005', 'other no-safe state explains hard conflict without pretending empty data', async (c) => {
    const { vm } = await view('otherNoSafe')
    c.equal(vm.state, 'no_safe_recommendation')
    c.equal(vm.emptyReason, 'NO_SAFE_RECOMMENDATION')
    c.equal(vm.cards.length, 0)
    c.equal(vm.conditionalCards.length, 0)
    c.ok(vm.summary.includes('关键护理需求'))
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-006', 'room match is rendered as a positive compact fact', async (c) => {
    const { result, vm } = await view('roomMatch')
    c.ok(result.value.preview.semantics.cards.some((item) => item.roomFit.fit === 'match'))
    const card = cardWithFact(vm, 'room')
    c.ok(card)
    c.equal(card.compactFacts.find((fact) => fact.key === 'room').text, '符合所选房型偏好')
    c.equal(card.compactFacts.find((fact) => fact.key === 'room').tone, 'positive')
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-007', 'room unknown remains unknown and downgrades Exact', async (c) => {
    const { result, vm } = await view('roomUnknown')
    c.equal(result.value.preview.semantics.cards.every((item) => item.roomFit.fit === 'unknown'), true)
    c.equal(vm.state, 'ready_soft_near')
    const card = cardWithFact(vm, 'room')
    c.equal(card.compactFacts.find((fact) => fact.key === 'room').text, '当前核验资料不足，需要进一步确认')
    c.equal(card.compactFacts.find((fact) => fact.key === 'room').tone, 'warning')
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-008', 'current ruleset guards room mismatch as non-producible', async (c) => {
    const { result, vm } = await view('roomMismatchGuard')
    c.equal(result.value.preview.semantics.candidateEvaluations.some((item) => item.roomFit.fit === 'mismatch'), false)
    c.equal(result.value.preview.semantics.cards.every((item) => item.roomFit.fit !== 'mismatch'), true)
    c.equal(vm.cards.some((card) => card.compactFacts.some((fact) => fact.text === '房型偏好存在差异')), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-009', 'meal match is a positive compact fact', async (c) => {
    const { result, vm } = await view('mealMatch')
    c.ok(result.value.preview.semantics.cards.some((item) => item.mealScheduleFit.fit === 'match'))
    const card = cardWithFact(vm, 'meal')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').text, '餐次安排与所选偏好一致')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').tone, 'positive')
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-010', 'known meal mismatch is a soft difference', async (c) => {
    const { result, vm } = await view('mealMismatch')
    c.equal(result.value.preview.semantics.cards.every((item) => item.mealScheduleFit.fit === 'mismatch'), true)
    c.equal(vm.state, 'ready_soft_near')
    c.ok(vm.cards.some((card) => card.differences.some((item) => item.text.includes('该项安排与您的偏好存在差异'))))
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-011', 'meal unavailable keeps data_unavailable wording', async (c) => {
    const { result, vm } = await view('mealUnavailable')
    c.equal(result.value.preview.semantics.cards.every((item) => item.mealScheduleFit.sourceState === 'data_unavailable'), true)
    const card = cardWithFact(vm, 'meal')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').text, '当前资料显示该项服务暂不可用')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').tone, 'warning')
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-012', 'meal unknown keeps unknown wording distinct from unavailable', async (c) => {
    const { result, vm } = await view('mealUnknown')
    c.equal(result.value.preview.semantics.cards.every((item) => item.mealScheduleFit.sourceState === 'unknown'), true)
    const card = cardWithFact(vm, 'meal')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').text, '当前核验资料不足，需进一步确认')
    c.equal(card.compactFacts.find((fact) => fact.key === 'meal').text.includes('暂不可用'), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-013', 'nutrition supported is displayed as rank-neutral support', async (c) => {
    const { result, vm } = await view('nutritionSupported')
    c.equal(result.value.preview.semantics.cards.every((item) => item.nutrition.status === 'supported'), true)
    const card = cardWithFact(vm, 'nutrition')
    c.equal(card.compactFacts.find((fact) => fact.key === 'nutrition').text, '易咀嚼饮食支持已核验')
    c.ok(card.reasons.some((item) => item.text === '易咀嚼饮食支持已核验'))
    c.equal(result.value.preview.semantics.cards[0].nutrition.rankParticipation, 'not_applicable')
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-014', 'nutrition unavailable is a display difference', async (c) => {
    const { result, vm } = await view('nutritionUnavailable')
    c.equal(result.value.preview.semantics.cards.every((item) => item.nutrition.status === 'unavailable'), true)
    const card = cardWithFact(vm, 'nutrition')
    c.equal(card.compactFacts.find((fact) => fact.key === 'nutrition').text, '当前资料显示该项服务暂不可用')
    c.ok(card.differences.some((item) => item.text.includes('当前资料显示该项服务暂不可用')))
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-015', 'nutrition inquiry remains an explicit inquiry', async (c) => {
    const { result, vm } = await view('nutritionInquiry')
    c.equal(result.value.preview.semantics.cards.every((item) => item.nutrition.status === 'requires_inquiry'), true)
    const card = cardWithFact(vm, 'nutrition')
    c.equal(card.compactFacts.find((fact) => fact.key === 'nutrition').text, '该项服务需要进一步向机构确认')
    c.ok(card.differences.some((item) => item.text.includes('需要进一步向机构确认')))
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-016', 'nutrition unknown remains unverified', async (c) => {
    const { result, vm } = await view('nutritionUnknown')
    c.equal(result.value.preview.semantics.cards.every((item) => item.nutrition.status === 'unknown'), true)
    const card = cardWithFact(vm, 'nutrition')
    c.equal(card.compactFacts.find((fact) => fact.key === 'nutrition').text, '当前核验资料不足，需进一步确认')
    c.equal(card.compactFacts.find((fact) => fact.key === 'nutrition').text.includes('支持已核验'), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-017', 'budget advisory is shown once at result level', async (c) => {
    const { result, vm } = await view('budget')
    c.equal(result.value.preview.semantics.advisories.filter((item) => item.code === 'HIGH_CARE_LOW_BUDGET').length, 1)
    c.equal(vm.resultAdvisories.length, 1)
    c.equal(vm.resultAdvisories[0].includes('建议预留一定预算空间'), true)
    c.equal(vm.cards.every((card) => card.reasons.every((item) => !item.text.includes('预留一定预算'))), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-018', 'activity is displayed but never becomes a reason', async (c) => {
    const { result, vm } = await view('activity')
    c.equal(result.value.preview.semantics.cards.every((item) => item.activityFit.rankParticipation === 'not_scorable'), true)
    c.ok(vm.cards.some((card) => card.compactFacts.some((fact) => fact.key === 'activity.indoorSpace')))
    c.equal(result.value.preview.semantics.cards.every((item) => noReasonCode(item, 'ACTIVITY_SPACE_MATCH')), true)
    c.equal(result.value.preview.semantics.cards.every((item) => noReasonCode(item, 'ACTIVITY_SPACE_MISMATCH')), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-019', 'not-scorable priority remains a user focus fact', async (c) => {
    const { result, vm } = await view('priorityNotScorable')
    const candidate = result.value.preview.semantics.cards[0]
    const factor = candidate.priorityFactors.find((item) => item.priorityCode === 'activity_space')
    c.equal(factor.status, 'not_scorable')
    c.equal(factor.rankParticipation, 'not_scorable')
    c.ok(vm.focusTags.some((tag) => tag.text === '您关注：活动空间'))
    c.equal(vm.cards.some((card) => card.reasons.some((item) => item.text.includes('活动空间'))), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-020', 'empty VR has no badge or fake navigation', async (c) => {
    const { vm } = await view('exact')
    c.equal(vm.cards.every((card) => card.vrLabel === ''), true)
    c.equal(vm.cards.every((card) => card.compactFacts.some((fact) => fact.key === 'vr' && fact.text === 'VR 信息暂未提供')), true)
    c.equal(wxml.includes('pages/institution/vr'), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-021', 'detail action exposes the canonical navigation label', async (c) => {
    const { vm } = await view('exact')
    c.equal(vm.actions.detailLabel, '查看机构详情')
    c.equal(wxml.includes('bindtap="onRecommendationCardTap"'), true)
    c.equal(vm.cards.every((card) => card.detailLabel === '查看机构详情'), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-022', 'list action exposes the canonical source-context path', async (c) => {
    const { vm } = await view('exact')
    c.equal(vm.actions.listLabel, '查看合作机构列表')
    c.equal(wxml.includes('bindtap="onRecommendationListTap"'), true)
    c.equal(wxml.includes('viewModel.actions.listLabel'), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-023', 'Mock dataset disclosure is visible and truthful', async (c) => {
    const { result, vm } = await view('exact')
    c.equal(result.value.sourceContext.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
    c.equal(vm.hasMockDisclosure, true)
    c.equal(vm.mockDisclosure, '以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。')
    c.equal(vm.datasetLabel, '开发 Mock 数据')
    c.equal(vm.cards.every((card) => /^示例机构 [A-H]（Mock）$/.test(card.name)), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-024', 'bounded monthly price preserves both verified bounds', async (c) => {
    const { vm } = await view('boundedPrice')
    const card = cardWithPrice(vm, (price) => price.includes('–') && price.includes('/ 月'))
    c.ok(card)
    c.ok(/^¥\d+–¥\d+ \/ 月$/.test(card.price))
    c.equal(card.price.includes('¥0'), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-025', 'starting-at monthly price does not invent an upper bound', async (c) => {
    const { vm } = await view('startingPrice')
    const card = vm.cards.find((item) => item.institutionId === 'institution-f-mock')
    c.ok(card)
    c.ok(/^¥\d+ 起 \/ 月$/.test(card.price))
    c.equal(card.price.includes('–'), false)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-026', 'unknown price remains unknown rather than zero', async (c) => {
    const { vm } = await view('unknownPrice')
    c.ok(vm.cards.some((card) => RESULT_V2_TARGET_IDS.includes(card.institutionId)
      && card.price === '参考费用暂未提供'))
    c.equal(vm.cards.some((card) => card.price.includes('¥0')), false)
    c.equal(vm.cards.every((card) => !card.price.includes('最终')), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-027', 'card order is exactly Domain order', async (c) => {
    const { result, vm } = await view('exact')
    c.deepEqual(vm.cards.map((card) => `${card.institutionId}#${card.recordRevision}`),
      result.value.preview.semantics.cards.map((card) => `${card.institutionId}#${card.recordRevision}`))
    c.equal(vm.cards.length, result.value.preview.semantics.cards.length)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-028', 'the Result UI keeps the Domain maximum of three cards', async (c) => {
    const { result, vm } = await view('exact')
    c.equal(result.value.preview.semantics.candidateEvaluations.length, RESULT_V2_UI_FIXTURE_MANIFEST.completePoolSize)
    c.equal(vm.cards.length <= RESULT_V2_UI_FIXTURE_MANIFEST.maximumCards, true)
    c.equal(vm.conditionalCards.length <= RESULT_V2_UI_FIXTURE_MANIFEST.maximumCards, true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-029', 'unverified candidates never become default cards', async (c) => {
    const { result, vm } = await view('exact')
    c.equal(result.value.preview.semantics.candidateEvaluations.some((item) => item.matchTier === 'UNVERIFIED'), true)
    c.equal(vm.cards.some((card) => card.institutionId === 'institution-d-mock' || card.institutionId === 'institution-e-mock'), false)
    c.equal(vm.cards.every((card) => card.isConditional === false), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  await run('RESULT-UI-V2-030', 'ineligible candidates never become default cards', async (c) => {
    const { result, vm } = await view('exact')
    c.equal(result.value.preview.semantics.candidateEvaluations.some((item) => item.matchTier === 'INELIGIBLE'), true)
    c.equal(vm.cards.some((card) => card.institutionId === 'institution-c-mock'), false)
    c.equal(vm.cards.every((card) => card.institutionId !== 'institution-c-mock'), true)
  }, executedUi, RESULT_V2_UI_FIXTURE_MANIFEST)

  assert.deepEqual(executedSnapshots, RESULT_V2_SNAPSHOT_CASES)
  assert.deepEqual(executedUi, RESULT_V2_UI_CASES)
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure))
    throw new Error(`${failures.length} V2 Result runtime case(s) failed`)
  }
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`RESULT_SNAPSHOT_CASES: ${executedSnapshots.length}/${RESULT_V2_UI_FIXTURE_MANIFEST.snapshotCount} PASS`)
  console.log(`RESULT_UI_CASES: ${executedUi.length}/${RESULT_V2_UI_FIXTURE_MANIFEST.uiCount} PASS`)
  console.log('RESULT_SOURCE_SAME_SOURCE_ATOMIC_VALIDATION: PASS')
  console.log('RECOMMENDATION_RESULT_V2_UI_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('RECOMMENDATION_RESULT_V2_UI_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
