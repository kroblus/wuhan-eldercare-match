import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  makeRecommendationPreviewV2IntegrationDraft,
  REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF,
  REC_V2_INTEGRATION_CASE_IDS,
  REC_V2_INTEGRATION_EVALUATION_AS_OF,
  REC_V2_INTEGRATION_FIXTURE_MANIFEST,
} from './fixtures/recommendation-preview-v2-integration-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repositoryRoot, 'miniprogram')
const serviceEntry = path.join(appRoot, 'services', 'recommendation-preview-v2.ts')
const catalogServiceEntry = path.join(appRoot, 'services', 'institution-catalog-v1-1.ts')
const recommendationEntry = path.join(appRoot, 'domain', 'recommendation', 'v2', 'evaluate-recommendation-preview-v2.ts')
const profileEntry = path.join(appRoot, 'domain', 'elder-profile', 'v2', 'derive-elder-profile-preview-v2.ts')

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value))

const relative = (filePath) => path.relative(repositoryRoot, filePath).split(path.sep).join('/')

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const filePath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(filePath) : [filePath]
})

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    assert.ok(existsSync(parserPath), `WECHAT_TYPESCRIPT_PATH does not exist: ${parserPath}`)
    const parser = require(parserPath)
    assert.equal(parser.version, '4.1.2', `expected WeChat TypeScript 4.1.2, got ${parser.version}`)
    return { parser, parserPath, parserSource: 'WECHAT_TYPESCRIPT_PATH' }
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat TypeScript 4.1.2 not found; set WECHAT_TYPESCRIPT_PATH explicitly')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) throw new Error('WeChat DevTools profile directory not found')
  const candidates = []
  for (const profile of readdirSync(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) continue
    for (const runtime of readdirSync(packageRoot, { withFileTypes: true })) {
      const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: statSync(parserPath).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  const selected = candidates.find((candidate) => require(candidate.parserPath).version === '4.1.2')
  if (!selected) throw new Error('WeChat TypeScript 4.1.2 parser not found; open DevTools first')
  return {
    parser: require(selected.parserPath),
    parserPath: selected.parserPath,
    parserSource: 'WeChat DevTools mptslib',
  }
}

const formatDiagnostics = (typescript, filePath, diagnostics) => diagnostics.map((diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) return message
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${relative(filePath)}:${location.line + 1}:${location.character + 1} ${message}`
}).join('; ')

const createRuntime = (typescript) => {
  const cache = new Map()
  const loaded = new Set()
  const sources = new Map()
  const calls = {
    draftReads: 0,
    catalogLoads: 0,
    profile: 0,
    recommendation: [],
    storageReads: 0,
    storageWrites: 0,
    logs: 0,
  }

  const context = vm.createContext({
    wx: {
      getStorageSync: () => {
        calls.storageReads += 1
        return ''
      },
      setStorageSync: () => {
        calls.storageWrites += 1
        throw new Error('storage writes are forbidden in application integration')
      },
      removeStorageSync: () => {
        calls.storageWrites += 1
        throw new Error('storage writes are forbidden in application integration')
      },
    },
    console: {
      log: () => { calls.logs += 1 },
      warn: () => { calls.logs += 1 },
      error: () => { calls.logs += 1 },
    },
  })

  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [
      `${base}.ts`,
      `${base}.js`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.js'),
      base,
    ]
    const resolved = candidates.find((filePath) => existsSync(filePath))
    assert.ok(resolved, `cannot resolve ${request} from ${relative(importer)}`)
    return resolved
  }

  const load = (filePath) => {
    const resolved = path.resolve(filePath)
    assert.ok(resolved.startsWith(`${appRoot}${path.sep}`), `application imported outside miniprogram: ${relative(resolved)}`)
    if (cache.has(resolved)) return cache.get(resolved).exports

    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    loaded.add(relative(resolved))
    sources.set(resolved, source)
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }

    const transpiled = resolved.endsWith('.ts')
      ? typescript.transpileModule(source, {
        fileName: resolved,
        reportDiagnostics: true,
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          strict: true,
          esModuleInterop: true,
        },
      })
      : { outputText: source, diagnostics: [] }
    const errors = (transpiled.diagnostics || [])
      .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, formatDiagnostics(typescript, resolved, errors))

    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external application runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    const factory = vm.runInContext(
      `(function(require,module,exports,__filename,__dirname){\n${transpiled.outputText}\n})`,
      context,
      { filename: resolved },
    )
    factory(localRequire, module, module.exports, resolved, path.dirname(resolved))

    if (resolved === recommendationEntry && typeof module.exports.evaluateRecommendationPreviewV2 === 'function') {
      const original = module.exports.evaluateRecommendationPreviewV2
      module.exports = {
        ...module.exports,
        evaluateRecommendationPreviewV2: (input) => {
          calls.recommendation.push(clone(input))
          return original(input)
        },
      }
    }
    if (resolved === profileEntry && typeof module.exports.deriveElderProfilePreviewV2 === 'function') {
      const original = module.exports.deriveElderProfilePreviewV2
      module.exports = {
        ...module.exports,
        deriveElderProfilePreviewV2: (input) => {
          calls.profile += 1
          return original(input)
        },
      }
    }
    return module.exports
  }

  return { calls, loaded, sources, load: (name) => load(path.join(appRoot, name)) }
}

const createApplicationService = (runtime, draftSource, catalogSource) => {
  const app = runtime.load('services/recommendation-preview-v2.ts')
  const catalogModule = runtime.load('services/institution-catalog-v1-1.ts')
  const catalogService = catalogModule.createInstitutionCatalogServiceV11({
    loadCatalog: async () => {
      runtime.calls.catalogLoads += 1
      return clone(await catalogSource())
    },
  })
  return app.createRecommendationPreviewServiceV2({
    draftSource: {
      getDraft: () => {
        runtime.calls.draftReads += 1
        return clone(typeof draftSource === 'function' ? draftSource() : draftSource)
      },
    },
    institutionCatalog: catalogService,
  })
}

const getDevelopmentCatalog = async (runtime) => {
  const catalogModule = runtime.load('services/institution-catalog-v1-1.ts')
  const result = await catalogModule.institutionCatalogServiceV11.loadCatalog()
  assert.equal(result.ok, true, `development catalog must validate: ${JSON.stringify(result.error || null)}`)
  return clone(result.value)
}

const makePayloadSource = (catalog) => async () => clone(catalog)

const assertApplicationError = (check, result, code, causeCode) => {
  check.equal(result.ok, false)
  check.equal(result.error.code, code)
  if (causeCode !== undefined) check.equal(result.error.causeCode, causeCode)
  check.ok(typeof result.error.causeCode === 'string' && result.error.causeCode.length > 0)
  check.ok(!Object.prototype.hasOwnProperty.call(result, 'value'))
}

const containsForbiddenIdentity = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  const forbidden = new Set([
    'assessmentId',
    'elderId',
    'recommendationId',
    'previewId',
    'completedAt',
    'generatedAt',
  ])
  if (Object.keys(value).some((key) => forbidden.has(key))) return true
  return Object.values(value).some((child) => containsForbiddenIdentity(child, seen))
}

const failures = []
const executed = []
const assertionCounts = new Map()

const runCase = async (id, description, callback) => {
  assert.ok(REC_V2_INTEGRATION_CASE_IDS.includes(id), `unexpected integration case ${id}`)
  assert.ok(!executed.includes(id), `duplicate integration case ${id}`)
  executed.push(id)
  let assertions = 0
  const check = {
    equal: (...args) => { assertions += 1; assert.equal(...args) },
    same: (actual, expected, message) => { assertions += 1; assert.deepEqual(clone(actual), clone(expected), message) },
    ok: (...args) => { assertions += 1; assert.ok(...args) },
  }
  try {
    await callback(check)
    assert.ok(assertions >= REC_V2_INTEGRATION_FIXTURE_MANIFEST.minimumAssertionsPerCase,
      `${id} must perform at least ${REC_V2_INTEGRATION_FIXTURE_MANIFEST.minimumAssertionsPerCase} assertions`)
    assertionCounts.set(id, assertions)
    console.log(`PASS ${id} ${description} (${assertions} assertions)`)
  } catch (error) {
    assertionCounts.set(id, assertions)
    failures.push(`${id}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    console.error(`FAIL ${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = async () => {
  const { parser: typescript, parserPath, parserSource } = await loadWechatTypeScript()
  const runtimes = []
  const newRuntime = () => {
    const runtime = createRuntime(typescript)
    runtimes.push(runtime)
    return runtime
  }

  await runCase('INTEGRATION-V2-001', 'complete V2 Draft + validated development catalog', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const draft = makeRecommendationPreviewV2IntegrationDraft()
    const service = createApplicationService(runtime, draft, makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(result.value.kind, 'recommendation_preview_v2')
    c.equal(result.value.persistence, 'FORBIDDEN')
    c.equal(result.value.source.localDraftId, draft.localDraftId)
    c.equal(result.value.semantics.poolManifest.entries.length, REC_V2_INTEGRATION_FIXTURE_MANIFEST.completePoolSize)
    c.ok(result.value.semantics.cards.length <= 3)
  })

  await runCase('INTEGRATION-V2-002', 'incomplete Draft short-circuits before catalog', async (c) => {
    const runtime = newRuntime()
    const draft = makeRecommendationPreviewV2IntegrationDraft({ 'health.chewingAbility': undefined })
    const service = createApplicationService(runtime, draft, async () => { throw new Error('catalog must not load') })
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'ASSESSMENT_PROFILE_V2_ERROR')
    c.equal(runtime.calls.draftReads, 1)
    c.equal(runtime.calls.catalogLoads, 0)
    c.equal(runtime.calls.recommendation.length, 0)
  })

  await runCase('INTEGRATION-V2-003', 'one invalid institution rejects the complete catalog', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.records[0].recordRevision = 0
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'INVALID_INSTITUTION_RECORD')
    c.equal(runtime.calls.catalogLoads, 1)
    c.equal(runtime.calls.recommendation.length, 0)
  })

  await runCase('INTEGRATION-V2-004', 'empty catalog yields stable no-data semantics', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.records = []
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(result.value.semantics.poolManifest.entries.length, 0)
    c.equal(result.value.semantics.candidateEvaluations.length, 0)
    c.equal(result.value.semantics.cards.length, 0)
    c.equal(result.value.semantics.noExactMatch.reasonCode, 'NO_VERIFIED_INSTITUTION_POOL')
  })

  await runCase('INTEGRATION-V2-005', 'all eight catalog records reach the Domain', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(runtime.calls.catalogLoads, 1)
    c.equal(runtime.calls.recommendation.length, 1)
    c.equal(runtime.calls.recommendation[0].institutions.length, 8)
    c.equal(result.value.semantics.candidateEvaluations.length, 8)
  })

  await runCase('INTEGRATION-V2-006', 'provider order is passed through without prefilter, prerank, or truncate', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.records = catalog.records.slice().reverse()
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.same(runtime.calls.recommendation[0].institutions.map((record) => record.institutionId),
      catalog.records.map((record) => record.institutionId))
    c.equal(runtime.calls.recommendation[0].institutions.length, catalog.records.length)
    c.equal(result.value.semantics.poolManifest.entries.length, catalog.records.length)
    c.ok(result.value.semantics.candidateEvaluations.length <= catalog.records.length)
  })

  await runCase('INTEGRATION-V2-007', 'explicit evaluationAsOf crosses the application boundary', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(runtime.calls.recommendation[0].evaluationAsOf, REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF)
    c.equal(result.value.semantics.evaluationAsOf, REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF)
    c.equal(result.value.semantics.poolManifest.evaluationAsOf, REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF)
  })

  await runCase('INTEGRATION-V2-008', 'same Draft, pool, and time are deterministic', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const first = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    const second = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.same(second, first)
    c.equal(runtime.calls.draftReads, 2)
    c.equal(runtime.calls.catalogLoads, 2)
    c.equal(runtime.calls.recommendation.length, 2)
  })

  await runCase('INTEGRATION-V2-009', 'changed Draft is rederived with no stale Preview', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    let draft = makeRecommendationPreviewV2IntegrationDraft()
    const service = createApplicationService(runtime, () => draft, makePayloadSource(catalog))
    const first = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    draft = makeRecommendationPreviewV2IntegrationDraft({ 'budget.monthlyRange': 'cny_12000_15000' })
    const second = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(first.ok, true)
    c.equal(second.ok, true)
    c.equal(second.value.semantics.elderSnapshot.financial.rawFacts.monthlyBudget, 'cny_12000_15000')
    c.ok(JSON.stringify(first) !== JSON.stringify(second))
    c.equal(runtime.calls.profile, 2)
  })

  await runCase('INTEGRATION-V2-010', 'invalid Draft never invokes catalog or Recommendation', async (c) => {
    const runtime = newRuntime()
    const draft = makeRecommendationPreviewV2IntegrationDraft({ 'preference.priorities': [] })
    const service = createApplicationService(runtime, draft, async () => { throw new Error('catalog must not load') })
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'ASSESSMENT_PROFILE_V2_ERROR')
    c.equal(runtime.calls.catalogLoads, 0)
    c.equal(runtime.calls.recommendation.length, 0)
    c.equal(runtime.calls.storageWrites, 0)
  })

  await runCase('INTEGRATION-V2-011', 'provider load failure is stable and sanitized', async (c) => {
    const runtime = newRuntime()
    const secret = 'PRIVATE_HEALTH_PAYLOAD_SECRET'
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), async () => {
      throw new Error(secret)
    })
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'PROVIDER_LOAD_FAILED')
    c.ok(!JSON.stringify(result).includes(secret))
    c.equal(runtime.calls.recommendation.length, 0)
  })

  await runCase('INTEGRATION-V2-012', 'invalid catalog envelope does not become empty success', async (c) => {
    const runtime = newRuntime()
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), async () => ({}))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'INVALID_CATALOG_ENVELOPE')
    c.equal(runtime.calls.recommendation.length, 0)
    c.equal(runtime.calls.catalogLoads, 1)
  })

  await runCase('INTEGRATION-V2-013', 'invalid institution error exposes only stable metadata', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.records[0].recordRevision = 0
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'INVALID_INSTITUTION_RECORD')
    c.ok(!JSON.stringify(result).includes('PRIVATE_HEALTH_PAYLOAD_SECRET'))
    c.ok(!Object.prototype.hasOwnProperty.call(result.error, 'record'))
  })

  await runCase('INTEGRATION-V2-014', 'duplicate institution identity is rejected before Domain semantics', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.records = [catalog.records[0], clone(catalog.records[0])]
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'INSTITUTION_CATALOG_V11_ERROR', 'DUPLICATE_INSTITUTION_ID')
    c.equal(runtime.calls.recommendation.length, 0)
    c.equal(runtime.calls.catalogLoads, 1)
  })

  await runCase('INTEGRATION-V2-015', 'dataset/provenance mismatch is not silently downgraded', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    catalog.datasetMode = 'PRODUCTION'
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'RECOMMENDATION_V2_ERROR', 'INVALID_DATASET_MODE_OR_PROVENANCE')
    c.equal(runtime.calls.recommendation.length, 1)
    c.equal(runtime.calls.recommendation[0].datasetMode, 'PRODUCTION')
  })

  await runCase('INTEGRATION-V2-016', 'Preview is identity-free and write-free', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(containsForbiddenIdentity(result), false)
    c.equal(runtime.calls.storageWrites, 0)
    c.equal(runtime.calls.logs, 0)
    c.ok(runtime.calls.storageReads >= 1)
  })

  await runCase('INTEGRATION-V2-017', 'application source graph never imports test fixtures', async (c) => {
    const sources = walk(appRoot).filter((filePath) => filePath.endsWith('.ts'))
    const violations = []
    for (const filePath of sources) {
      const source = readFileSync(filePath, 'utf8')
      if (/(?:from\s+|import\s*\(|require\s*\()[^'"\n]*['"][^'"\n]*(?:scripts[\\/]|fixtures[\\/])/.test(source)) {
        violations.push(relative(filePath))
      }
    }
    c.ok(sources.length > 0)
    c.same(violations, [])
  })

  await runCase('INTEGRATION-V2-018', 'catalog provider is called once and preserves full pool', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    let providerCalls = 0
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), async () => {
      providerCalls += 1
      return clone(catalog)
    })
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    c.equal(result.ok, true)
    c.equal(providerCalls, 1)
    c.equal(runtime.calls.catalogLoads, 1)
    c.equal(runtime.calls.recommendation[0].institutions.length, 8)
  })

  await runCase('INTEGRATION-V2-019', 'invalid explicit time returns stable Domain error', async (c) => {
    const runtime = newRuntime()
    const catalog = await getDevelopmentCatalog(runtime)
    const service = createApplicationService(runtime, makeRecommendationPreviewV2IntegrationDraft(), makePayloadSource(catalog))
    const result = await service.build('not-a-valid-timestamp')
    assertApplicationError(c, result, 'RECOMMENDATION_V2_ERROR', 'INVALID_EVALUATION_AS_OF')
    c.equal(runtime.calls.catalogLoads, 1)
    c.equal(runtime.calls.recommendation.length, 1)
  })

  await runCase('INTEGRATION-V2-020', 'V1/raw Draft cannot cross the V2 application boundary', async (c) => {
    const runtime = newRuntime()
    const draft = makeRecommendationPreviewV2IntegrationDraft({}, { schemaVersion: 1 })
    const service = createApplicationService(runtime, draft, async () => { throw new Error('catalog must not load') })
    const result = await service.build(REC_V2_INTEGRATION_EVALUATION_AS_OF)
    assertApplicationError(c, result, 'ASSESSMENT_PROFILE_V2_ERROR')
    c.equal(runtime.calls.catalogLoads, 0)
    c.equal(runtime.calls.recommendation.length, 0)
  })

  assert.deepEqual(executed, REC_V2_INTEGRATION_CASE_IDS, 'fixed integration manifest must execute in order')
  assert.equal(new Set(executed).size, REC_V2_INTEGRATION_FIXTURE_MANIFEST.expectedCount)
  REC_V2_INTEGRATION_CASE_IDS.forEach((id) => {
    assert.ok((assertionCounts.get(id) || 0) >= REC_V2_INTEGRATION_FIXTURE_MANIFEST.minimumAssertionsPerCase,
      `${id} did not meet minimum assertion count`)
  })
  runtimes.forEach((runtime) => {
    assert.equal(runtime.calls.storageWrites, 0, 'application integration must not persist Preview')
    assert.equal(runtime.calls.logs, 0, 'application integration must not log sensitive payloads')
  })

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`- ${failure}`))
    throw new Error(`${failures.length} integration case(s) failed`)
  }
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: WeChat TypeScript ${typescript.version} (${parserPath})`)
  console.log(`FIXED_INTEGRATION_CASES: ${executed.length}/${REC_V2_INTEGRATION_FIXTURE_MANIFEST.expectedCount} PASS`)
  console.log(`MIN_ASSERTIONS_PER_CASE: ${REC_V2_INTEGRATION_FIXTURE_MANIFEST.minimumAssertionsPerCase} PASS`)
  console.log(`RUNTIMES: ${runtimes.length}; STORAGE_WRITES: 0; APP_LOGS: 0`)
  console.log('FULL_POOL_BEFORE_DOMAIN_SEMANTICS: PASS')
  console.log('NO_PREVIEW_PERSISTENCE: PASS')
  console.log('RECOMMENDATION_PREVIEW_V2_INTEGRATION_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('RECOMMENDATION_PREVIEW_V2_INTEGRATION_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
