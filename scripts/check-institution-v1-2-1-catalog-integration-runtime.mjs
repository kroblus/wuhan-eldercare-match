import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  A13_EVALUATION_AS_OF,
  A13_EXPECTED_CURRENT_REVISION,
  A13_EXPECTED_RECORD_COUNT,
  A13_REQUIRED_CASE_IDS,
  A13_V121_DATASET_VERSION,
  cloneCatalogForMutation,
  cloneIntegrationValue,
  makeCurrentIdentity,
  makeIntegrationDraftV2,
  makeDirectRouteQuery,
} from './fixtures/institution-v1-2-1-catalog-integration-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repositoryRoot, 'miniprogram')
const relative = (filePath) => path.relative(repositoryRoot, filePath).split(path.sep).join('/')

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    const parser = require(parserPath)
    if (parser.version !== '4.1.2') throw new Error(`expected WeChat TypeScript 4.1.2, got ${parser.version}`)
    return { parser, parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat TypeScript 4.1.2 not found; set WECHAT_TYPESCRIPT_PATH explicitly')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) throw new Error('WeChat DevTools profile directory not found')
  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) continue
    for (const runtime of await readdir(packageRoot, { withFileTypes: true })) {
      const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  const selected = candidates.find((candidate) => require(candidate.parserPath).version === '4.1.2')
  if (!selected) throw new Error('WeChat TypeScript 4.1.2 parser not found')
  return {
    parser: require(selected.parserPath),
    parserPath: selected.parserPath,
    source: 'WeChat DevTools mptslib',
  }
}

const createRuntime = (typescript) => {
  const cache = new Map()
  const loaded = new Set()
  const sources = new Map()
  const calls = { storageReads: 0, storageWrites: 0, logs: 0 }
  const context = vm.createContext({
    wx: {
      getStorageSync: () => { calls.storageReads += 1; return '' },
      setStorageSync: () => { calls.storageWrites += 1; throw new Error('storage write forbidden') },
      removeStorageSync: () => { calls.storageWrites += 1; throw new Error('storage write forbidden') },
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
      `${base}.ts`, `${base}.js`, `${base}.json`,
      path.join(base, 'index.ts'), path.join(base, 'index.js'), path.join(base, 'index.json'), base,
    ]
    const resolved = candidates.find(existsSync)
    assert.ok(resolved, `cannot resolve ${request} from ${relative(importer)}`)
    return resolved
  }
  const load = (filePath) => {
    const resolved = path.resolve(filePath)
    assert.ok(resolved.startsWith(`${appRoot}${path.sep}`), `application imported outside miniprogram: ${relative(resolved)}`)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    loaded.add(relative(resolved))
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(readFileSync(resolved, 'utf8'))
      sources.set(resolved, readFileSync(resolved, 'utf8'))
      return module.exports
    }
    const source = readFileSync(resolved, 'utf8')
    sources.set(resolved, source)
    const output = resolved.endsWith('.ts')
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
    const errors = (output.diagnostics || [])
      .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
    if (errors.length > 0) {
      throw new Error(errors.map((diagnostic) => {
        const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        if (!diagnostic.file || diagnostic.start === undefined) return message
        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        return `${relative(resolved)}:${position.line + 1}:${position.character + 1} ${message}`
      }).join('\n'))
    }
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external application runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    const factory = vm.runInContext(
      `(function(require,module,exports,__filename,__dirname){\n${output.outputText}\n})`,
      context,
      { filename: resolved },
    )
    factory(localRequire, module, module.exports, resolved, path.dirname(resolved))
    return module.exports
  }
  return { load, loaded, sources, calls }
}

const walkFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const filePath = path.join(directory, entry.name)
  return entry.isDirectory() ? walkFiles(filePath) : [filePath]
})

const clone = (value) => cloneIntegrationValue(value)

const createContextInput = (catalog, candidateCount = 1, publicContentPins = true) => {
  const records = catalog.records
  const manifest = records.map((record) => ({
    identity: makeCurrentIdentity(record.institutionId, record.recordRevision),
    recordProvenance: record.recordProvenance,
    recordStatus: record.recordStatus,
    disposition: 'included',
  }))
  const candidates = records.slice(0, candidateCount).map((record, index) => ({
    identity: makeCurrentIdentity(record.institutionId, record.recordRevision),
    group: 'cards',
    order: index,
    tier: 'EXACT',
    reasons: [{ code: 'TEST_REASON', reference: 'synthetic' }],
    differences: [],
  }))
  return {
    datasetVersion: catalog.datasetVersion,
    datasetMode: catalog.datasetMode,
    evaluationAsOf: A13_EVALUATION_AS_OF,
    recommendationContractVersion: 'recommendation-contract-v2',
    recommendationRulesetVersion: 'recommendation-ruleset-v2',
    recommendationPolicyVersion: 'conservative-exact-with-conditional-v1',
    institutionContractVersion: 'institution-contract-v1.1',
    institutionCapabilityContractVersion: 'institution-capability-contract-v1',
    manifest,
    candidates,
    ...(publicContentPins ? {
      publicContentPins: candidates.map((candidate) => ({ ...candidate, contentRevision: 1 }))
        .map(({ identity, contentRevision }) => ({ identity, contentRevision })),
    } : {}),
  }
}

const main = async () => {
  const wechat = await loadWechatTypeScript()
  const runtime = createRuntime(wechat.parser)
  const catalogModule = runtime.load(path.join(appRoot, 'services', 'institution-catalog-v1-2-1.ts'))
  const resolverModule = runtime.load(path.join(appRoot, 'services', 'institution-record-resolver.ts'))
  const listDetailModule = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-application.ts'))
  const publicModule = runtime.load(path.join(appRoot, 'services', 'institution-public-content-v1.ts'))
  const presentationModule = runtime.load(path.join(appRoot, 'services', 'institution-v1-2-1-presentation.ts'))
  const sourceModule = runtime.load(path.join(appRoot, 'services', 'institution-source-context.ts'))
  const recommendationSourceModule = runtime.load(path.join(appRoot, 'services', 'institution-recommendation-source.ts'))
  const routeModule = runtime.load(path.join(appRoot, 'services', 'institution-detail-route.ts'))
  const recommendationModule = runtime.load(path.join(appRoot, 'services', 'recommendation-preview-v2.ts'))
  const mockModule = runtime.load(path.join(appRoot, 'mock', 'institution-catalog.mock.ts'))

  const liveResult = await catalogModule.institutionCatalogServiceV121.loadCatalog()
  assert.equal(liveResult.ok, true, JSON.stringify(liveResult))
  const catalog = clone(liveResult.value)
  assert.equal(catalog.records.length, A13_EXPECTED_RECORD_COUNT)

  const adapter = catalogModule.institutionCatalogServiceV11Adapter
  const projectedResult = await adapter.loadCatalog()
  assert.equal(projectedResult.ok, true, JSON.stringify(projectedResult))
  const projectedCatalog = clone(projectedResult.value)

  const serviceFor = (payloadOrFactory = catalog) => catalogModule.createInstitutionCatalogServiceV121({
    loadCatalog: async () => typeof payloadOrFactory === 'function'
      ? payloadOrFactory()
      : clone(payloadOrFactory),
  })

  const resolverFor = (payload = catalog) => resolverModule.createInstitutionCurrentCatalogResolverV121(serviceFor(payload))
  const buildApps = (payload = catalog, historical = resolverModule.createNotConfiguredHistoricalRevisionResolver(), publicResolver = publicModule.institutionPublicContentServiceV1) => {
    const resolver = resolverFor(payload)
    const registry = sourceModule.createInstitutionSourceContextRegistry({
      tokenFactory: (() => { let sequence = 0; return () => `a13-context-${++sequence}` })(),
      clock: () => 1,
    })
    const list = listDetailModule.createInstitutionListApplicationServiceV12({
      currentCatalogResolver: resolver,
      historicalRevisionResolver: historical,
      sourceContextRegistry: registry,
    })
    const detail = listDetailModule.createInstitutionDetailApplicationServiceV12({
      currentCatalogResolver: resolver,
      historicalRevisionResolver: historical,
      sourceContextRegistry: registry,
      publicContentCurrentResolver: publicResolver,
      publicContentExactResolver: publicResolver,
    })
    return { resolver, registry, list, detail }
  }

  const completeDraft = makeIntegrationDraftV2()
  const recommendationService = recommendationModule.createRecommendationPreviewServiceV2({
    draftSource: { getDraft: () => clone(completeDraft) },
    institutionCatalog: adapter,
  })
  const recommendationSnapshotResult = await recommendationService.buildResultSnapshot(A13_EVALUATION_AS_OF)
  assert.equal(recommendationSnapshotResult.ok, true, JSON.stringify(recommendationSnapshotResult))
  const recommendationSnapshot = recommendationSnapshotResult.value

  const failures = []
  const executed = []
  const counts = new Map()
  const caseRun = async (id, fn) => {
    assert.ok(A13_REQUIRED_CASE_IDS.includes(id), `unexpected case ${id}`)
    assert.ok(!executed.includes(id), `duplicate case ${id}`)
    executed.push(id)
    const category = id.split('-')[0]
    counts.set(category, (counts.get(category) || 0) + 1)
    let assertions = 0
    const c = {
      equal: (...args) => { assertions += 1; assert.equal(...args) },
      same: (actual, expected, message) => {
        assertions += 1
        assert.equal(JSON.stringify(clone(actual)), JSON.stringify(clone(expected)), message)
      },
      ok: (...args) => { assertions += 1; assert.ok(...args) },
      rejects: async (...args) => { assertions += 1; return assert.rejects(...args) },
    }
    try {
      await fn(c)
      assert.ok(assertions >= 2, `${id} needs at least two independent assertions`)
    } catch (error) {
      failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const currentIds = catalog.records.map((record) => record.institutionId)
  const currentKeys = catalog.records.map((record) => `${record.institutionId}#${record.recordRevision}`)
  const firstIdentity = makeCurrentIdentity(catalog.records[0].institutionId, catalog.records[0].recordRevision)

  const explicitMap = mockModule.MOCK_INSTITUTION_V11_TO_V121_IDENTITY_MAP
  const v121Records = catalogModule.MOCK_INSTITUTION_CATALOG_V121_RECORDS || mockModule.MOCK_INSTITUTION_CATALOG_V121_RECORDS

  const specific = new Map()
  specific.set('CATALOG-001-explicit-successor-migration', async (c) => {
    c.equal(explicitMap.length, A13_EXPECTED_RECORD_COUNT)
    c.ok(explicitMap.every((item) => item.old.recordRevision === 1 && item.current.recordRevision === 2))
  })
  specific.set('CATALOG-002-no-revision-arithmetic', async (c) => {
    c.ok(explicitMap.every((item) => currentKeys.includes(`${item.current.institutionId}#${item.current.recordRevision}`)))
    c.ok(catalog.currentPointers.every((pointer) => pointer.recordRevision === A13_EXPECTED_CURRENT_REVISION))
  })
  specific.set('CATALOG-003-current-pointer-must-exist', async (c) => {
    const invalid = cloneCatalogForMutation(catalog, { currentPointers: [{ institutionId: 'not-current', recordRevision: 2 }, ...catalog.currentPointers.slice(1)] })
    const result = await serviceFor(invalid).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'CURRENT_POINTER_NOT_FOUND')
  })
  specific.set('CATALOG-004-one-current-entry-per-institution', async (c) => {
    const invalid = cloneCatalogForMutation(catalog, { records: [...catalog.records, clone(catalog.records[0])] })
    const result = await serviceFor(invalid).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'DUPLICATE_CURRENT_INSTITUTION_ID')
  })
  specific.set('CATALOG-005-v121-only-current-pool', async (c) => {
    const result = await serviceFor(catalog).loadCatalog()
    c.equal(result.ok, true)
    c.ok(result.value.records.every((record) => record.contractVersion === 'institution-contract-v1.2.1'))
    c.same(result.value.records.map((record) => `${record.institutionId}#${record.recordRevision}`),
      result.value.currentPointers.map((pointer) => `${pointer.institutionId}#${pointer.recordRevision}`))
  })
  specific.set('CATALOG-006-malformed-record-fails', async (c) => {
    const records = catalog.records.map(clone); records[0].recordRevision = 0
    const result = await serviceFor(cloneCatalogForMutation(catalog, { records })).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'INVALID_INSTITUTION_RECORD')
  })
  specific.set('CATALOG-007-unknown-contract-fails', async (c) => {
    const records = catalog.records.map(clone); records[0].contractVersion = 'institution-contract-v9'
    const result = await serviceFor(cloneCatalogForMutation(catalog, { records })).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION')
  })
  specific.set('CATALOG-008-provenance-must-match-dataset', async (c) => {
    const invalid = cloneCatalogForMutation(catalog, { datasetMode: 'PRODUCTION' })
    const result = await serviceFor(invalid).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'DATASET_PROVENANCE_MISMATCH')
  })
  specific.set('CATALOG-009-presentation-must-match-current-revision', async (c) => {
    const presentation = clone(catalog.presentation)
    presentation.displayOrder[0].recordRevision = 1
    const result = await serviceFor(cloneCatalogForMutation(catalog, { presentation })).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'PRESENTATION_IDENTITY_NOT_FOUND')
  })
  specific.set('CATALOG-010-complete-current-pointer-set', async (c) => {
    const invalid = cloneCatalogForMutation(catalog, { currentPointers: catalog.currentPointers.slice(0, -1) })
    const result = await serviceFor(invalid).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'CURRENT_POINTER_MISMATCH')
  })
  specific.set('CATALOG-011-provider-detaches-result', async (c) => {
    const provider = catalogModule.mockInstitutionCatalogProviderV121
    const first = await provider.loadCatalog(); first.records[0].identity.name.value = 'poisoned'
    const second = await provider.loadCatalog()
    c.ok(second.records[0].identity.name.value !== 'poisoned')
    c.equal(second.records.length, A13_EXPECTED_RECORD_COUNT)
  })
  specific.set('CATALOG-012-provider-failure-is-stable', async (c) => {
    const result = await serviceFor(async () => { throw new Error('private payload') }).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'PROVIDER_LOAD_FAILED')
  })
  specific.set('CATALOG-013-v121-to-v11-explicit-projection', async (c) => {
    c.equal(projectedResult.ok, true)
    c.ok(projectedCatalog.records.every((record) => record.contractVersion === 'institution-contract-v1.1'))
  })
  specific.set('CATALOG-014-projection-preserves-eight-records', async (c) => {
    c.equal(projectedCatalog.records.length, catalog.records.length)
    c.same(projectedCatalog.records.map((record) => record.institutionId), currentIds)
  })
  specific.set('CATALOG-015-projection-keeps-record-status', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.recordStatus), catalog.records.map((record) => record.recordStatus))
    c.ok(projectedCatalog.records.every((record) => record.recordStatus === 'published'))
  })
  specific.set('CATALOG-016-projection-keeps-provenance', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.recordProvenance), catalog.records.map((record) => record.recordProvenance))
    c.ok(projectedCatalog.records.every((record) => record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'))
  })
  specific.set('CATALOG-017-dataset-version-is-explicit', async (c) => {
    c.equal(catalog.datasetVersion, A13_V121_DATASET_VERSION)
    c.equal(projectedCatalog.datasetVersion, A13_V121_DATASET_VERSION)
  })
  specific.set('CATALOG-018-current-pointers-are-explicit', async (c) => {
    c.equal(catalog.currentPointers.length, catalog.records.length)
    c.ok(catalog.currentPointers.every((pointer) => currentKeys.includes(`${pointer.institutionId}#${pointer.recordRevision}`)))
  })
  specific.set('CATALOG-019-presentation-order-is-explicit', async (c) => {
    c.equal(catalog.presentation.orderingPolicy, 'CURATED_DISPLAY_ORDER_V1')
    c.same(catalog.presentation.displayOrder.map((entry) => entry.displayOrder), [0, 1, 2, 3, 4, 5, 6, 7])
  })
  specific.set('CATALOG-020-no-current-from-max-revision', async (c) => {
    const pointers = catalog.currentPointers.map(clone)
    pointers[0].recordRevision = 3
    const invalid = cloneCatalogForMutation(catalog, { currentPointers: pointers })
    const result = await serviceFor(invalid).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'CURRENT_POINTER_NOT_FOUND')
  })
  specific.set('CATALOG-021-no-current-from-array-order', async (c) => {
    const reversed = cloneCatalogForMutation(catalog, { records: catalog.records.slice().reverse() })
    const result = await serviceFor(reversed).loadCatalog()
    c.equal(result.ok, true)
    c.same(result.value.currentPointers, catalog.currentPointers)
  })
  specific.set('CATALOG-022-repeated-load-is-stable', async (c) => {
    const service = serviceFor(catalog)
    const first = await service.loadCatalog()
    c.equal(first.ok, true)
    first.value.records[0].identity.name.value = 'test-only mutation'
    const second = await service.loadCatalog()
    c.equal(second.ok, true)
    c.ok(second.value.records[0].identity.name.value !== 'test-only mutation')
  })
  specific.set('CATALOG-023-invalid-envelope-fails-closed', async (c) => {
    const service = catalogModule.createInstitutionCatalogServiceV121({ loadCatalog: async () => null })
    const result = await service.loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'INVALID_CATALOG_ENVELOPE')
    const adapted = await catalogModule.createInstitutionCatalogServiceV11Adapter(service).loadCatalog()
    c.equal(adapted.ok, false); c.equal(adapted.error.code, 'INVALID_CATALOG_ENVELOPE')
  })
  specific.set('CATALOG-024-empty-pool-is-valid-catalog', async (c) => {
    const empty = cloneCatalogForMutation(catalog, { records: [], currentPointers: [], presentation: { orderingPolicy: 'CURATED_DISPLAY_ORDER_V1', displayOrder: [] } })
    const result = await serviceFor(empty).loadCatalog()
    c.equal(result.ok, true); c.equal(result.value.records.length, 0)
  })
  specific.set('CATALOG-025-legacy-record-is-rejected', async (c) => {
    const legacy = clone(projectedCatalog.records)
    const result = await serviceFor(cloneCatalogForMutation(catalog, { records: legacy })).loadCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION')
  })
  specific.set('POINTER-001-eight-current-pointers', async (c) => {
    c.equal(catalog.currentPointers.length, A13_EXPECTED_RECORD_COUNT)
    c.equal(new Set(catalog.currentPointers.map((pointer) => pointer.institutionId)).size, A13_EXPECTED_RECORD_COUNT)
  })
  specific.set('POINTER-002-pointer-identity-revision', async (c) => {
    c.ok(catalog.currentPointers.every((pointer) => pointer.recordRevision === A13_EXPECTED_CURRENT_REVISION))
    c.same(catalog.currentPointers.map((pointer) => `${pointer.institutionId}#${pointer.recordRevision}`), currentKeys)
  })
  specific.set('POINTER-003-pointer-order-not-selection', async (c) => {
    const reversedPointers = catalog.currentPointers.slice().reverse()
    const result = await serviceFor(cloneCatalogForMutation(catalog, { currentPointers: reversedPointers })).loadCatalog()
    c.equal(result.ok, true)
    c.same(result.value.records.map((record) => record.institutionId), currentIds)
    c.same(result.value.currentPointers.map((pointer) => pointer.institutionId), reversedPointers.map((pointer) => pointer.institutionId))
  })
  specific.set('POINTER-004-pointer-duplicate-key', async (c) => {
    const pointers = catalog.currentPointers.map(clone)
    pointers[1] = clone(pointers[0])
    const result = await serviceFor(cloneCatalogForMutation(catalog, { currentPointers: pointers })).loadCatalog()
    c.equal(result.ok, false)
    c.equal(result.error.code, 'DUPLICATE_CURRENT_POINTER')
    c.equal(result.error.pointerIndex, 1)
  })
  specific.set('POINTER-005-pointer-duplicate-institution', async (c) => {
    const pointers = catalog.currentPointers.map(clone)
    pointers[1].institutionId = pointers[0].institutionId
    const result = await serviceFor(cloneCatalogForMutation(catalog, { currentPointers: pointers })).loadCatalog()
    c.equal(result.ok, false)
    c.equal(result.error.code, 'DUPLICATE_CURRENT_POINTER')
    c.equal(result.error.pointerIndex, 1)
  })
  specific.set('POINTER-006-pointer-unknown-identity', async (c) => {
    const pointers = catalog.currentPointers.map(clone)
    pointers[0].institutionId = 'institution-not-in-catalog'
    const result = await serviceFor(cloneCatalogForMutation(catalog, { currentPointers: pointers })).loadCatalog()
    c.equal(result.ok, false)
    c.equal(result.error.code, 'CURRENT_POINTER_NOT_FOUND')
    c.equal(result.error.pointerIndex, 0)
  })
  specific.set('POINTER-007-pointer-mismatched-revision', async (c) => {
    const pointers = catalog.currentPointers.map(clone)
    pointers[0].recordRevision = 1
    const result = await serviceFor(cloneCatalogForMutation(catalog, { currentPointers: pointers })).loadCatalog()
    c.equal(result.ok, false)
    c.equal(result.error.code, 'CURRENT_POINTER_NOT_FOUND')
    c.equal(result.error.pointerIndex, 0)
  })
  specific.set('POINTER-008-current-record-revision-two', async (c) => {
    c.ok(catalog.records.every((record) => record.recordRevision === A13_EXPECTED_CURRENT_REVISION))
    c.ok(catalog.currentPointers.every((pointer) => pointer.recordRevision === A13_EXPECTED_CURRENT_REVISION))
  })
  specific.set('POINTER-009-current-ids-unique', async (c) => {
    c.equal(new Set(catalog.records.map((record) => record.institutionId)).size, catalog.records.length)
    c.same(catalog.records.map((record) => record.institutionId).slice().sort(),
      catalog.currentPointers.map((pointer) => pointer.institutionId).slice().sort())
  })
  specific.set('POINTER-010-presentation-order-unique', async (c) => {
    const orders = catalog.presentation.displayOrder.map((entry) => entry.displayOrder)
    c.equal(new Set(orders).size, orders.length)
    c.equal(new Set(catalog.presentation.displayOrder.map((entry) => `${entry.institutionId}#${entry.recordRevision}`)).size,
      catalog.presentation.displayOrder.length)
  })
  specific.set('POINTER-011-presentation-order-zero-based', async (c) => {
    const orders = catalog.presentation.displayOrder.map((entry) => entry.displayOrder).slice().sort((left, right) => left - right)
    c.same(orders, Array.from({ length: A13_EXPECTED_RECORD_COUNT }, (_value, index) => index))
    c.equal(Math.min(...orders), 0)
  })
  specific.set('POINTER-012-catalog-has-one-dataset-version', async (c) => {
    c.equal(catalog.datasetVersion, A13_V121_DATASET_VERSION)
    c.equal(projectedCatalog.datasetVersion, catalog.datasetVersion)
  })
  specific.set('POINTER-013-catalog-mode-is-development', async (c) => {
    c.equal(catalog.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
    c.ok(catalog.records.every((record) => record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'))
  })
  specific.set('POINTER-014-current-pool-is-v121', async (c) => {
    c.ok(catalog.records.every((record) => record.contractVersion === 'institution-contract-v1.2.1'))
    c.same(catalog.currentPointers.map((pointer) => `${pointer.institutionId}#${pointer.recordRevision}`).slice().sort(), currentKeys.slice().sort())
  })
  specific.set('POINTER-015-no-v11-union', async (c) => {
    c.ok(!catalog.records.some((record) => record.contractVersion === 'institution-contract-v1.1'))
    c.equal(catalog.records.length, projectedCatalog.records.length)
  })
  specific.set('PARITY-001-eight-records', async (c) => {
    c.equal(projectedCatalog.records.length, A13_EXPECTED_RECORD_COUNT)
    c.equal(catalog.records.length, projectedCatalog.records.length)
  })
  specific.set('PARITY-002-id-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.institutionId), catalog.records.map((record) => record.institutionId))
    c.same(projectedCatalog.records.map((record) => record.recordRevision), catalog.records.map((record) => record.recordRevision))
  })
  specific.set('PARITY-003-status-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.recordStatus), catalog.records.map((record) => record.recordStatus))
    c.ok(projectedCatalog.records.every((record) => record.recordStatus === 'published'))
  })
  specific.set('PARITY-004-provenance-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.recordProvenance), catalog.records.map((record) => record.recordProvenance))
    c.ok(projectedCatalog.records.every((record) => record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'))
  })
  specific.set('PARITY-005-price-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.price), catalog.records.map((record) => record.price))
    c.same(projectedCatalog.records.map((record) => record.price.referenceMonthlyPrice), catalog.records.map((record) => record.price.referenceMonthlyPrice))
  })
  specific.set('PARITY-006-capability-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => record.capabilities), catalog.records.map((record) => record.capabilities))
    c.same(projectedCatalog.records.map((record) => record.capabilityContractVersion), catalog.records.map((record) => record.capabilityContractVersion))
  })
  specific.set('PARITY-007-record-order-parity', async (c) => {
    c.same(projectedCatalog.records.map((record) => `${record.institutionId}#${record.recordRevision}`), currentKeys)
    c.same(catalog.records.map((record) => `${record.institutionId}#${record.recordRevision}`), currentKeys)
  })
  specific.set('PARITY-008-recommendation-input-parity', async (c) => {
    const poolEntries = recommendationSnapshot.preview.semantics.poolManifest.entries
    c.same(poolEntries.map((entry) => `${entry.institutionId}#${entry.recordRevision}`).slice().sort(),
      projectedCatalog.records.map((record) => `${record.institutionId}#${record.recordRevision}`).slice().sort())
    c.equal(recommendationSnapshot.preview.semantics.poolManifest.datasetVersion, projectedCatalog.datasetVersion)
  })
  specific.set('RESOLVER-002-exact-current-revision', async (c) => {
    const result = await resolverFor().resolveExactCurrentRevision(firstIdentity)
    c.equal(result.ok, true); c.equal(result.value.record.recordRevision, A13_EXPECTED_CURRENT_REVISION)
  })
  specific.set('RESOLVER-003-wrong-revision-rejected', async (c) => {
    const result = await resolverFor().resolveExactCurrentRevision({ institutionId: firstIdentity.institutionId, recordRevision: 1 })
    c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_REVISION_NOT_FOUND')
  })
  specific.set('RESOLVER-004-wrong-institution-rejected', async (c) => {
    const result = await resolverFor().resolveExactCurrentRevision({ institutionId: 'not-current', recordRevision: 2 })
    c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_NOT_FOUND')
  })
  specific.set('RESOLVER-005-current-record-is-projected', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.equal(result.ok, true); c.ok(result.value.records.every((record) => record.contractVersion === 'institution-contract-v1.1'))
  })
  specific.set('RESOLVER-006-raw-v121-record-is-retained', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.equal(result.ok, true); c.equal(result.value.sourceRecordsV121.length, A13_EXPECTED_RECORD_COUNT)
  })
  specific.set('RESOLVER-007-pointer-bundle-retained', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.equal(result.ok, true); c.same(result.value.currentPointersV121, catalog.currentPointers)
  })
  specific.set('RESOLVER-008-presentation-bundle-retained', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.equal(result.ok, true); c.same(result.value.presentationV121, catalog.presentation)
  })
  specific.set('RESOLVER-009-source-revision-two', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.ok(result.ok); c.ok(result.value.sourceRecordsV121.every((record) => record.recordRevision === 2))
  })
  specific.set('RESOLVER-010-source-provenance-matches', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.ok(result.ok); c.same(result.value.sourceRecordsV121.map((record) => record.recordProvenance), result.value.records.map((record) => record.recordProvenance))
  })
  specific.set('RESOLVER-011-source-status-matches', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.ok(result.ok); c.same(result.value.sourceRecordsV121.map((record) => record.recordStatus), result.value.records.map((record) => record.recordStatus))
  })
  specific.set('RESOLVER-001-v121-source-bundle', async (c) => {
    const result = await resolverFor().loadCurrentCatalog()
    c.equal(result.ok, true)
    c.equal(result.value.sourceContractVersion, 'institution-contract-v1.2.1')
    c.equal(result.value.sourceRecordsV121.length, A13_EXPECTED_RECORD_COUNT)
  })
  specific.set('RESOLVER-012-custom-provider-validates', async (c) => {
    const result = await resolverFor(cloneCatalogForMutation(catalog)).loadCurrentCatalog()
    c.equal(result.ok, true)
    c.equal(result.value.sourceRecordsV121.length, A13_EXPECTED_RECORD_COUNT)
    c.ok(result.value.sourceRecordsV121.every((record) => record.recordRevision === A13_EXPECTED_CURRENT_REVISION))
  })
  specific.set('RESOLVER-013-custom-provider-invalidates', async (c) => {
    const records = catalog.records.map(clone); records[0].recordRevision = 0
    const result = await resolverFor(cloneCatalogForMutation(catalog, { records })).loadCurrentCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'INVALID_INSTITUTION_RECORD')
  })
  specific.set('RESOLVER-014-provider-error-mapped', async (c) => {
    const result = await resolverFor(async () => { throw new Error('private') }).loadCurrentCatalog()
    c.equal(result.ok, false); c.equal(result.error.code, 'PROVIDER_LOAD_FAILED')
  })
  specific.set('RESOLVER-015-resolver-repeat-is-stable', async (c) => {
    const resolver = resolverFor()
    const first = await resolver.loadCurrentCatalog(); const second = await resolver.loadCurrentCatalog()
    c.same(first, second); c.equal(second.value.records.length, A13_EXPECTED_RECORD_COUNT)
  })

  const apps = buildApps()
  const directList = await apps.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef: null })
  assert.equal(directList.ok, true, JSON.stringify(directList))
  const directDetail = await apps.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF })
  assert.equal(directDetail.ok, true, JSON.stringify(directDetail))

  specific.set('LIST-001-direct-build', async (c) => { c.equal(directList.ok, true); c.equal(directList.value.source, 'direct') })
  specific.set('LIST-002-list-is-v121-sourced', async (c) => { c.ok(directList.value.displayInstitutions.length > 0); c.ok(directList.value.displayInstitutions.every((item) => item.sourceContractVersion === 'institution-contract-v1.2.1')) })
  specific.set('LIST-003-list-is-development-disclosed', async (c) => { c.equal(directList.value.dataDisclosure.kind, 'MOCK_DEVELOPMENT_ONLY'); c.ok(directList.value.dataDisclosure.text.includes('开发')) })
  specific.set('LIST-004-list-records-are-published', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => item.recordStatus === 'published')); c.equal(directList.value.displayInstitutions.length, A13_EXPECTED_RECORD_COUNT) })
  specific.set('LIST-005-list-count-is-complete', async (c) => { c.equal(directList.value.otherCurrentPartners.length, A13_EXPECTED_RECORD_COUNT); c.equal(directList.value.displayInstitutions.length, A13_EXPECTED_RECORD_COUNT) })
  specific.set('LIST-006-list-canonical-identities', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => item.recordRevision === 2)); c.equal(new Set(directList.value.displayInstitutions.map((item) => item.institutionId)).size, A13_EXPECTED_RECORD_COUNT) })
  specific.set('LIST-007-list-order-is-curated', async (c) => { c.equal(directList.value.ordering.kind, 'CURATED_DISPLAY_ORDER_V1'); c.same(directList.value.displayInstitutions.map((item) => item.institutionId), currentIds) })
  specific.set('LIST-008-list-order-independent-of-array', async (c) => {
    const reversed = buildApps(cloneCatalogForMutation(catalog, { records: catalog.records.slice().reverse() }))
    const result = await reversed.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef: null })
    c.equal(result.ok, true); c.same(result.value.displayInstitutions.map((item) => item.institutionId), currentIds)
  })
  specific.set('LIST-009-list-evaluation-time-explicit', async (c) => { c.equal(directList.value.evaluationAsOf, A13_EVALUATION_AS_OF); c.equal(directList.value.displayInstitutions.length, 8) })
  specific.set('LIST-010-list-source-is-direct', async (c) => { c.equal(directList.value.sourceContextRef, null); c.equal(directList.value.ordering.source, 'direct') })
  specific.set('LIST-011-list-other-partners-preserved', async (c) => { c.equal(directList.value.recommendedCandidates.length, 0); c.equal(directList.value.otherCurrentPartners.length, 8) })
  specific.set('LIST-012-list-recommendation-placements-empty-direct', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => item.recommendationPlacement === null)); c.equal(directList.value.ordering.groups[0].group, 'other') })
  specific.set('LIST-013-list-no-raw-v121-fields', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => !('evidence' in item) && !('careProcess' in item))); c.ok(!('sourceRecordsV121' in directList.value)) })
  specific.set('LIST-014-list-price-is-v11-projection', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => 'referenceMonthlyPrice' in item)); c.ok(directList.value.displayInstitutions.every((item) => !('price' in item))) })
  specific.set('LIST-015-list-vr-is-safe', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => item.vr.canNavigate === false)); c.ok(directList.value.displayInstitutions.every((item) => item.vr.state !== 'available')) })
  specific.set('LIST-016-invalid-time-rejected', async (c) => { const result = await apps.list.build({ evaluationAsOf: 'not-ISO', sourceContextRef: null }); c.equal(result.ok, false); c.equal(result.error.causeCode, 'INVALID_EVALUATION_AS_OF') })
  specific.set('LIST-017-invalid-order-rejected', async (c) => { const result = await apps.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef: null, presentationMetadata: { entries: [] } }); c.equal(result.ok, false); c.equal(result.error.causeCode, 'INVALID_LIST_ORDER_METADATA') })
  specific.set('LIST-018-catalog-failure-mapped', async (c) => { const failing = buildApps(async () => { throw new Error('private') }); const result = await failing.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef: null }); c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_CATALOG_ERROR') })
  specific.set('LIST-019-context-mode-mismatch-rejected', async (c) => {
    const mismatched = createContextInput(catalog, 1, false)
    mismatched.datasetMode = 'PRODUCTION'
    mismatched.manifest = mismatched.manifest.map((entry) => ({ ...entry, recordProvenance: 'PRODUCTION_CANDIDATE' }))
    const isolated = buildApps()
    const registeredContext = isolated.registry.register(mismatched)
    c.equal(registeredContext.ok, true)
    const result = await isolated.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef: registeredContext.value })
    c.equal(result.ok, false)
    c.equal(result.error.causeCode, 'SOURCE_CONTEXT_DATASET_MODE_MISMATCH')
  })
  specific.set('LIST-020-context-time-mismatch-rejected', async (c) => {
    const isolated = buildApps()
    const registeredContext = isolated.registry.register(createContextInput(catalog, 1, false))
    c.equal(registeredContext.ok, true)
    const result = await isolated.list.build({
      evaluationAsOf: '2026-09-13T08:00:01.000Z',
      sourceContextRef: registeredContext.value,
    })
    c.equal(result.ok, false)
    c.equal(result.error.causeCode, 'SOURCE_CONTEXT_EVALUATION_TIME_MISMATCH')
  })

  specific.set('DETAIL-001-direct-build', async (c) => { c.equal(directDetail.ok, true); c.equal(directDetail.value.source, 'direct') })
  specific.set('DETAIL-002-detail-is-v121-sourced', async (c) => { c.equal(directDetail.value.sourceContractVersion, 'institution-contract-v1.2.1'); c.equal(directDetail.value.identity.recordRevision, 2) })
  specific.set('DETAIL-003-detail-identity-current', async (c) => { c.same(directDetail.value.identity, firstIdentity); c.equal(directDetail.value.revisionContext.state, 'current') })
  specific.set('DETAIL-004-detail-record-published', async (c) => { c.equal(directDetail.value.recordStatus, 'published'); c.equal(directDetail.value.actions.canViewCurrentRevision, false) })
  specific.set('DETAIL-005-detail-legacy-sections-present', async (c) => { c.ok(directDetail.value.sections.basic); c.ok(directDetail.value.sections.media) })
  specific.set('DETAIL-006-detail-future-sections-present', async (c) => { c.ok(directDetail.value.sections.futureV121); c.same(Object.keys(directDetail.value.sections.futureV121), ['publicIntroduction', 'officialContact', 'officialAddress', 'mapLocation', 'careProcess']) })
  specific.set('DETAIL-007-address-unknown-safe', async (c) => { c.equal(directDetail.value.sections.futureV121.officialAddress.status, 'unknown'); c.equal(directDetail.value.sections.futureV121.officialAddress.formattedAddress, null) })
  specific.set('DETAIL-008-phone-unknown-safe', async (c) => { c.equal(directDetail.value.sections.futureV121.officialContact.status, 'unknown'); c.equal(directDetail.value.sections.futureV121.officialContact.phones.length, 0) })
  specific.set('DETAIL-009-care-process-unknown-safe', async (c) => { c.equal(directDetail.value.sections.futureV121.careProcess.status, 'unknown'); c.equal(directDetail.value.sections.futureV121.careProcess.careRecord.presence.value, null) })
  specific.set('DETAIL-010-map-not-ready', async (c) => { c.equal(directDetail.value.sections.futureV121.mapLocation.mapActionAvailable, false); c.notReady = true; c.equal(directDetail.value.sections.futureV121.mapLocation.formattedAddress, null) })
  specific.set('DETAIL-011-no-fabricated-phone', async (c) => { c.equal(directDetail.value.sections.futureV121.officialContact.phones.length, 0); c.ok(!JSON.stringify(directDetail.value).includes('13900000001')) })
  specific.set('DETAIL-012-no-fabricated-address', async (c) => { c.equal(directDetail.value.sections.futureV121.officialAddress.formattedAddress, null); c.ok(!JSON.stringify(directDetail.value).includes('测试大道')) })
  specific.set('DETAIL-013-no-fabricated-care', async (c) => { c.equal(directDetail.value.sections.futureV121.careProcess.careRecord.presence.value, null); c.equal(directDetail.value.sections.futureV121.careProcess.careRecord.presence.availability, 'unknown') })
  specific.set('DETAIL-014-public-content-sidecar-independent', async (c) => { c.equal(directDetail.value.sections.futureV121.publicIntroduction.status, 'ready'); c.equal(directDetail.value.sections.futureV121.publicIntroduction.contentRevision, 1) })
  specific.set('DETAIL-015-wrong-revision-rejected', async (c) => { const result = await apps.detail.build({ identity: { ...firstIdentity, recordRevision: 1 }, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_REVISION_NOT_FOUND') })
  specific.set('DETAIL-016-wrong-institution-rejected', async (c) => { const result = await apps.detail.build({ identity: { institutionId: 'not-current', recordRevision: 2 }, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_NOT_FOUND') })
  specific.set('DETAIL-017-direct-context-forbidden', async (c) => { const result = await apps.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: 'a13-context-1', evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.equal(result.error.causeCode, 'DIRECT_CONTEXT_REF_FORBIDDEN') })
  specific.set('DETAIL-018-invalid-time-rejected', async (c) => { const result = await apps.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: 'bad' }); c.equal(result.ok, false); c.equal(result.error.causeCode, 'INVALID_EVALUATION_AS_OF') })
  specific.set('DETAIL-019-not-found-stable', async (c) => { const result = await apps.detail.build({ identity: { institutionId: 'not-current', recordRevision: 2 }, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.ok(result.error.code === 'INSTITUTION_NOT_FOUND') })
  specific.set('DETAIL-020-catalog-failure-stable', async (c) => { const failing = buildApps(async () => { throw new Error('private') }); const result = await failing.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_CATALOG_ERROR') })
  specific.set('DETAIL-021-one-detail-identity', async (c) => { c.equal(directDetail.value.identity.institutionId, firstIdentity.institutionId); c.equal(directDetail.value.identity.recordRevision, firstIdentity.recordRevision) })
  specific.set('DETAIL-022-repeated-detail-stable', async (c) => { const second = await apps.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.same(second, directDetail); c.equal(second.value.evaluationAsOf, A13_EVALUATION_AS_OF) })
  specific.set('DETAIL-023-v121-source-not-exposed', async (c) => { c.ok(!('sourceRecordsV121' in directDetail.value)); c.ok(!('evidence' in directDetail.value.sections)) })
  specific.set('DETAIL-024-no-recommendation-on-direct', async (c) => { c.equal(directDetail.value.recommendationContext, null); c.equal(directDetail.value.contextKind, 'DIRECT_CURRENT') })
  specific.set('DETAIL-025-no-map-api', async (c) => { c.equal(directDetail.value.sections.futureV121.mapLocation.mapActionAvailable, false); c.ok(!runtime.loaded.has('miniprogram/services/location.ts')) })
  specific.set('DETAIL-026-same-source-fact-mismatch-rejected', async (c) => {
    const baseResolver = resolverFor()
    const inconsistentResolver = {
      loadCurrentCatalog: async () => {
        const result = await baseResolver.loadCurrentCatalog()
        if (result.ok) result.value.records[0].identity.name.value = '篡改机构名称（测试）'
        return result
      },
      resolveExactCurrentRevision: async (identity) => {
        const result = await baseResolver.resolveExactCurrentRevision(identity)
        if (result.ok) {
          result.value.dataset.records[0].identity.name.value = '篡改机构名称（测试）'
          result.value.record.identity.name.value = '篡改机构名称（测试）'
        }
        return result
      },
    }
    const service = listDetailModule.createInstitutionDetailApplicationServiceV12({
      currentCatalogResolver: inconsistentResolver,
      historicalRevisionResolver: resolverModule.createNotConfiguredHistoricalRevisionResolver(),
      sourceContextRegistry: sourceModule.createInstitutionSourceContextRegistry(),
      publicContentCurrentResolver: publicModule.institutionPublicContentServiceV1,
      publicContentExactResolver: publicModule.institutionPublicContentServiceV1,
    })
    const result = await service.build({
      identity: firstIdentity,
      source: 'direct',
      sourceContextRef: null,
      evaluationAsOf: A13_EVALUATION_AS_OF,
    })
    c.equal(result.ok, false)
    c.equal(result.error.code, 'INSTITUTION_DETAIL_PROJECTION_ERROR')
    c.equal(result.error.causeCode, 'V121_SOURCE_RECORD_MISMATCH')
  })

  const future = directDetail.value.sections.futureV121
  specific.set('FUTURE-001-five-sections', async (c) => { c.equal(Object.keys(future).length, 5); c.ok(future.publicIntroduction && future.careProcess) })
  specific.set('FUTURE-002-public-intro-status', async (c) => { c.equal(future.publicIntroduction.status, 'ready'); c.ok(future.publicIntroduction.text.includes('开发演示资料')) })
  specific.set('FUTURE-003-contact-status', async (c) => { c.equal(future.officialContact.status, 'unknown'); c.equal(future.officialContact.phones.length, 0) })
  specific.set('FUTURE-004-address-status', async (c) => { c.equal(future.officialAddress.status, 'unknown'); c.equal(future.officialAddress.effectiveVerification, 'unverified') })
  specific.set('FUTURE-005-map-status', async (c) => { c.equal(future.mapLocation.status, 'address_unknown'); c.equal(future.mapLocation.mapActionAvailable, false) })
  specific.set('FUTURE-006-care-status', async (c) => { c.equal(future.careProcess.status, 'unknown'); c.equal(future.careProcess.shiftHandover24h.presence.availability, 'unknown') })
  specific.set('FUTURE-007-unknown-address-null', async (c) => { c.equal(future.officialAddress.formattedAddress, null); c.equal(future.mapLocation.formattedAddress, null) })
  specific.set('FUTURE-008-unknown-geo-null', async (c) => { c.equal(future.mapLocation.latitude, null); c.equal(future.mapLocation.longitude, null) })
  specific.set('FUTURE-009-unknown-phone-empty', async (c) => { c.equal(future.officialContact.phones.length, 0); c.equal(future.officialContact.directory.value, null) })
  specific.set('FUTURE-010-unknown-care-not-absent', async (c) => { c.equal(future.careProcess.careRecord.presence.availability, 'unknown'); c.equal(future.careProcess.careRecord.presence.value, null) })
  specific.set('FUTURE-011-no-evidence-ids', async (c) => { c.ok(!JSON.stringify(future).includes('evidenceIds')); c.ok(!JSON.stringify(future).includes('evidenceId')) })
  specific.set('FUTURE-012-no-raw-evidence', async (c) => { c.ok(!('evidence' in future)); c.ok(!('sourceLocator' in future)) })
  specific.set('FUTURE-013-fixed-time-deterministic', async (c) => { const again = presentationModule.projectInstitutionFutureSectionsV121(catalog.records[0], A13_EVALUATION_AS_OF, { status: 'hidden_no_current_head', value: null }); c.same(again, presentationModule.projectInstitutionFutureSectionsV121(catalog.records[0], A13_EVALUATION_AS_OF, { status: 'hidden_no_current_head', value: null })); c.equal(again.mapLocation.mapActionAvailable, false) })
  specific.set('FUTURE-014-record-pure-function', async (c) => { const record = clone(catalog.records[0]); const before = JSON.stringify(record); presentationModule.projectInstitutionFutureSectionsV121(record, A13_EVALUATION_AS_OF); c.equal(JSON.stringify(record), before); c.ok(record.contractVersion === 'institution-contract-v1.2.1') })
  specific.set('FUTURE-015-public-content-pure-function', async (c) => { const content = await publicModule.institutionPublicContentServiceV1.resolveCurrent(firstIdentity.institutionId); const before = JSON.stringify(content); presentationModule.projectInstitutionPublicIntroductionV121({ status: 'ready', value: content.value }, firstIdentity.institutionId); c.equal(JSON.stringify(content), before); c.ok(content.ok) })
  specific.set('FUTURE-016-public-content-ready', async (c) => { c.equal(future.publicIntroduction.status, 'ready'); c.equal(future.publicIntroduction.contentRevision, 1) })
  specific.set('FUTURE-017-public-content-mismatch-hidden', async (c) => { const content = await publicModule.institutionPublicContentServiceV1.resolveCurrent(firstIdentity.institutionId); const projection = presentationModule.projectInstitutionPublicIntroductionV121({ status: 'ready', value: { ...content.value, institutionId: 'wrong' } }, firstIdentity.institutionId); c.equal(projection.status, 'hidden_not_found'); c.equal(projection.text, null) })
  specific.set('FUTURE-018-public-content-unavailable-safe', async (c) => { const projection = presentationModule.projectInstitutionPublicIntroductionV121({ status: 'unavailable', value: null }, firstIdentity.institutionId); c.equal(projection.status, 'unavailable'); c.equal(projection.text, null) })
  specific.set('FUTURE-019-unknown-map-not-ready', async (c) => { c.equal(future.mapLocation.status, 'address_unknown'); c.equal(future.mapLocation.mapActionAvailable, false) })
  specific.set('FUTURE-020-no-vr-fabrication', async (c) => { c.ok(catalog.records.every((record) => record.vr.url === null)); c.ok(catalog.records.every((record) => record.vr.scenes.length === 0)) })

  const contentCatalog = runtime.load(path.join(appRoot, 'mock', 'institution-public-content.mock.ts'))
  const contentProvider = publicModule.createInstitutionPublicContentProviderV1(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG)
  specific.set('CONTENT-001-eight-records', async (c) => { c.equal(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.records.length, 8); c.equal(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.currentHeads.length, 8) })
  specific.set('CONTENT-002-explicit-current-heads', async (c) => { c.ok(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.currentHeads.every((head) => head.contentRevision === 1)); c.ok(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.currentHeads.every((head) => currentIds.includes(head.institutionId))) })
  specific.set('CONTENT-003-current-head-resolves', async (c) => { const result = contentProvider.resolveCurrent(firstIdentity.institutionId); c.equal(result.ok, true); c.equal(result.value.contentRevision, 1) })
  specific.set('CONTENT-004-exact-revision-resolves', async (c) => { const result = contentProvider.resolveExact(firstIdentity.institutionId, 1); c.equal(result.ok, true); c.equal(result.value.institutionId, firstIdentity.institutionId) })
  specific.set('CONTENT-005-wrong-revision-does-not-fallback', async (c) => { const result = contentProvider.resolveExact(firstIdentity.institutionId, 2); c.equal(result.ok, false); c.equal(result.code, 'PUBLIC_CONTENT_REVISION_NOT_FOUND') })
  specific.set('CONTENT-006-wrong-institution-does-not-fallback', async (c) => { const result = contentProvider.resolveExact('not-current', 1); c.equal(result.ok, false); c.equal(result.code, 'PUBLIC_CONTENT_REVISION_NOT_FOUND') })
  specific.set('CONTENT-007-missing-head-is-null', async (c) => { const source = clone(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG); source.currentHeads = source.currentHeads.slice(1); const provider = publicModule.createInstitutionPublicContentProviderV1(source); const result = provider.resolveCurrent(firstIdentity.institutionId); c.equal(result.ok, true); c.equal(result.value, null) })
  specific.set('CONTENT-008-invalid-id-fails', async (c) => { const result = contentProvider.resolveCurrent(''); c.equal(result.ok, false); c.equal(result.code, 'PUBLIC_CONTENT_VALIDATION_ERROR') })
  specific.set('CONTENT-009-invalid-revision-fails', async (c) => { const result = contentProvider.resolveExact(firstIdentity.institutionId, 0); c.equal(result.ok, false); c.equal(result.code, 'PUBLIC_CONTENT_VALIDATION_ERROR') })
  specific.set('CONTENT-010-provider-clones', async (c) => { const result = contentProvider.resolveCurrent(firstIdentity.institutionId); result.value.introduction.text = 'poison'; const second = contentProvider.resolveCurrent(firstIdentity.institutionId); c.ok(!second.value.introduction.text.includes('poison')); c.equal(second.value.contentRevision, 1) })
  specific.set('CONTENT-011-source-validation', async (c) => { const result = contentProvider.resolveCurrent(firstIdentity.institutionId); c.equal(result.ok, true); c.equal(result.value.schemaVersion, 'institution-public-content-v1') })
  specific.set('CONTENT-012-publication-status', async (c) => { c.ok(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.records.every((record) => record.publicationStatus === 'published')); c.ok(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG.records.every((record) => record.introduction.availability === 'provided')) })
  specific.set('CONTENT-013-current-and-exact-separate', async (c) => { c.same(contentProvider.resolveCurrent(firstIdentity.institutionId), contentProvider.resolveExact(firstIdentity.institutionId, 1)); c.ok(typeof contentProvider.resolveExact === 'function') })
  specific.set('CONTENT-014-provider-failure-safe', async (c) => { const failing = { resolveCurrent: () => { throw new Error('private') } }; const result = runtime.load(path.join(appRoot, 'domain', 'institution', 'v1-2-1', 'public-content.ts')).resolveCurrentPublishedPublicContent(failing, firstIdentity.institutionId); c.equal(result.ok, false); c.equal(result.code, 'PUBLIC_CONTENT_VALIDATION_ERROR') })
  specific.set('CONTENT-015-no-latest-inference', async (c) => { const source = clone(contentCatalog.MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG); source.records.push({ ...source.records[0], contentRevision: 2 }); const provider = publicModule.createInstitutionPublicContentProviderV1(source); const result = provider.resolveCurrent(firstIdentity.institutionId); c.equal(result.ok, true); c.equal(result.value.contentRevision, 1) })

  const contextInput = createContextInput(catalog, 1, true)
  const registered = apps.registry.register(contextInput)
  assert.equal(registered.ok, true, JSON.stringify(registered))
  const sourceContextRef = registered.value
  const recommendationList = await apps.list.build({ evaluationAsOf: A13_EVALUATION_AS_OF, sourceContextRef })
  const recommendationDetail = await apps.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef, evaluationAsOf: A13_EVALUATION_AS_OF })
  assert.equal(recommendationList.ok, true, JSON.stringify(recommendationList))
  assert.equal(recommendationDetail.ok, true, JSON.stringify(recommendationDetail))
  specific.set('PIN-001-context-pins-optional', async (c) => { const noPins = apps.registry.register(createContextInput(catalog, 1, false)); c.equal(noPins.ok, true); c.ok(!('publicContentPins' in apps.registry.resolve(noPins.value).value)) })
  specific.set('PIN-002-context-pins-identity-bound', async (c) => { c.equal(contextInput.publicContentPins[0].identity.institutionId, firstIdentity.institutionId); c.equal(contextInput.publicContentPins[0].identity.recordRevision, 2) })
  specific.set('PIN-003-context-pins-revision-bound', async (c) => { c.equal(contextInput.publicContentPins[0].contentRevision, 1); c.equal(recommendationDetail.value.sections.futureV121.publicIntroduction.contentRevision, 1) })
  specific.set('PIN-004-context-pins-no-duplicate', async (c) => { const input = createContextInput(catalog, 1, true); input.publicContentPins.push(clone(input.publicContentPins[0])); const result = apps.registry.register(input); c.equal(result.ok, false); c.equal(result.error.code, 'SOURCE_CONTEXT_PRESENTATION_PIN_DUPLICATE') })
  specific.set('PIN-005-missing-exact-hidden', async (c) => { const source = clone(contextInput); source.publicContentPins[0].contentRevision = 9; const result = apps.registry.register(source); c.equal(result.ok, true); const missing = await apps.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: result.value, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(missing.ok, true); c.equal(missing.value.sections.futureV121.publicIntroduction.status, 'hidden_not_found') })
  specific.set('PIN-006-wrong-exact-hidden', async (c) => { const source = clone(contextInput); source.publicContentPins[0].identity.institutionId = 'wrong'; const result = apps.registry.register(source); c.equal(result.ok, false); c.equal(result.error.code, 'SOURCE_CONTEXT_IDENTITY_MISMATCH') })
  specific.set('PIN-007-pinned-intro-ready', async (c) => { c.equal(recommendationDetail.value.sections.futureV121.publicIntroduction.status, 'ready'); c.equal(recommendationDetail.value.contextKind, 'RECOMMENDATION_PINNED') })
  specific.set('PIN-008-pinned-intro-not-current', async (c) => { c.equal(recommendationDetail.value.sections.futureV121.publicIntroduction.contentRevision, 1); c.ok(recommendationDetail.value.sections.futureV121.publicIntroduction.text.includes('开发演示')) })
  specific.set('PIN-009-history-context-preserved', async (c) => { c.equal(recommendationDetail.value.sourceContextRef || sourceContextRef, sourceContextRef); c.equal(recommendationDetail.value.datasetVersion, catalog.datasetVersion) })
  specific.set('PIN-010-no-latest-fallback', async (c) => { const source = clone(contextInput); source.publicContentPins[0].contentRevision = 9; const result = apps.registry.register(source); c.ok(result.ok); const detail = await apps.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: result.value, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(detail.ok, true); c.equal(detail.value.sections.futureV121.publicIntroduction.status, 'hidden_not_found') })
  specific.set('PIN-011-no-catalog-error-on-content-failure', async (c) => { const failingApps = buildApps(catalog, undefined, { resolveCurrent: () => ({ ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }), resolveExact: () => ({ ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }) }); const result = await failingApps.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, true); c.equal(result.value.sections.futureV121.publicIntroduction.status, 'unavailable') })
  specific.set('PIN-012-content-not-in-recommendation-manifest', async (c) => { c.ok(!recommendationDetail.value.recommendationContext.reasons.some((item) => item.code === 'contentRevision')); c.ok(!JSON.stringify(recommendationSnapshot.preview.semantics.poolManifest).includes('contentRevision')) })
  specific.set('PIN-013-content-not-in-ranking', async (c) => { c.ok(!JSON.stringify(recommendationSnapshot.preview).includes('publicIntroduction')); c.equal(recommendationSnapshot.preview.semantics.versions.recommendationRulesetVersion, 'recommendation-ruleset-v2') })
  specific.set('PIN-014-content-not-in-identity', async (c) => { c.equal(recommendationDetail.value.identity.recordRevision, 2); c.ok(!('contentRevision' in recommendationDetail.value.identity)) })
  specific.set('PIN-015-content-pin-repeat-stable', async (c) => { const first = await apps.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef, evaluationAsOf: A13_EVALUATION_AS_OF }); const second = await apps.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef, evaluationAsOf: A13_EVALUATION_AS_OF }); c.same(first, second); c.equal(second.value.sections.futureV121.publicIntroduction.contentRevision, 1) })

  specific.set('PROJECTION-001-full-pool-to-engine', async (c) => { const calls = []; const service = recommendationModule.createRecommendationPreviewServiceV2({ draftSource: { getDraft: () => clone(completeDraft) }, institutionCatalog: { loadCatalog: async () => { calls.push(projectedCatalog.records.length); return clone(projectedResult) } } }); const result = await service.build(A13_EVALUATION_AS_OF); c.equal(result.ok, true); c.equal(calls[0], 8) })
  specific.set('PROJECTION-002-no-pre-filter', async (c) => { c.equal(recommendationSnapshot.preview.semantics.poolManifest.entries.length, 8); c.equal(projectedCatalog.records.length, 8) })
  specific.set('PROJECTION-003-no-pre-rank', async (c) => { c.equal(recommendationSnapshot.preview.semantics.poolManifest.entries.length, projectedCatalog.records.length); c.ok(recommendationSnapshot.preview.semantics.poolManifest.entries.every((entry) => entry.institutionId)) })
  specific.set('PROJECTION-004-no-pre-truncate', async (c) => { c.equal(recommendationSnapshot.preview.semantics.poolManifest.entries.length, 8); c.ok(recommendationSnapshot.preview.semantics.cards.length <= 3) })
  specific.set('PROJECTION-005-v11-records-only', async (c) => { c.ok(projectedCatalog.records.every((record) => record.contractVersion === 'institution-contract-v1.1')); c.ok(!projectedCatalog.records.some((record) => record.contractVersion === 'institution-contract-v1.2.1')) })
  specific.set('PROJECTION-006-v121-not-exposed', async (c) => { c.ok(!('sourceRecordsV121' in recommendationSnapshot.preview)); c.ok(!JSON.stringify(recommendationSnapshot.preview).includes('careProcess')) })
  specific.set('PROJECTION-007-dataset-preserved', async (c) => { c.equal(recommendationSnapshot.preview.semantics.datasetVersion, A13_V121_DATASET_VERSION); c.equal(recommendationSnapshot.preview.semantics.poolManifest.datasetVersion, A13_V121_DATASET_VERSION) })
  specific.set('PROJECTION-008-mode-preserved', async (c) => { c.equal(recommendationSnapshot.preview.semantics.datasetMode, 'MOCK_DEVELOPMENT_ONLY'); c.equal(recommendationSnapshot.preview.semantics.poolManifest.datasetMode, 'MOCK_DEVELOPMENT_ONLY') })
  specific.set('PROJECTION-009-time-explicit', async (c) => { c.equal(recommendationSnapshot.preview.semantics.evaluationAsOf, A13_EVALUATION_AS_OF); c.equal(recommendationSnapshot.preview.semantics.poolManifest.evaluationAsOf, A13_EVALUATION_AS_OF) })
  specific.set('PROJECTION-010-ruleset-preserved', async (c) => { c.equal(recommendationSnapshot.preview.semantics.versions.recommendationRulesetVersion, 'recommendation-ruleset-v2'); c.equal(recommendationSnapshot.preview.semantics.versions.recommendationContractVersion, 'recommendation-contract-v2') })
  specific.set('PROJECTION-011-policy-preserved', async (c) => { c.equal(recommendationSnapshot.preview.semantics.versions.policyVersion, 'conservative-exact-with-conditional-v1'); c.ok(recommendationSnapshot.preview.semantics.versions.institutionContractVersion === 'institution-contract-v1.1') })
  specific.set('PROJECTION-012-manifest-complete', async (c) => { c.equal(recommendationSnapshot.preview.semantics.poolManifest.entries.length, 8); c.equal(new Set(recommendationSnapshot.preview.semantics.poolManifest.entries.map((entry) => entry.institutionId)).size, 8) })
  specific.set('PROJECTION-013-output-max-three', async (c) => { c.ok(recommendationSnapshot.preview.semantics.cards.length <= 3); c.ok(recommendationSnapshot.preview.semantics.conditionalCandidates.length <= 3) })
  specific.set('PROJECTION-014-invalid-catalog-short-circuits', async (c) => { const bad = clone(projectedResult); bad.value.records[0].recordRevision = 0; const service = recommendationModule.createRecommendationPreviewServiceV2({ draftSource: { getDraft: () => clone(completeDraft) }, institutionCatalog: { loadCatalog: async () => bad } }); const result = await service.build(A13_EVALUATION_AS_OF); c.equal(result.ok, false); c.equal(result.error.code, 'RECOMMENDATION_V2_ERROR') })
  specific.set('PROJECTION-015-draft-change-recalculates', async (c) => { let draft = clone(completeDraft); const service = recommendationModule.createRecommendationPreviewServiceV2({ draftSource: { getDraft: () => clone(draft) }, institutionCatalog: adapter }); const first = await service.build(A13_EVALUATION_AS_OF); draft.answers['budget.monthlyRange'] = 'cny_12000_15000'; const second = await service.build(A13_EVALUATION_AS_OF); c.equal(first.ok, true); c.equal(second.ok, true); c.ok(JSON.stringify(first) !== JSON.stringify(second)) })

  const projectedContext = recommendationSourceModule.projectInstitutionNavigationSourceContextV2(recommendationSnapshot, { publicContentResolver: contentProvider })
  assert.equal(projectedContext.ok, true, JSON.stringify(projectedContext))
  const sourceContextFromResultRegistry = sourceModule.createInstitutionSourceContextRegistry({ tokenFactory: () => 'result-context', clock: () => 1 })
  specific.set('SOURCE-001-context-registers', async (c) => { const result = recommendationSourceModule.registerInstitutionRecommendationSourceContextV2(recommendationSnapshot, sourceContextFromResultRegistry, { publicContentResolver: contentProvider }); c.equal(result.ok, true); c.ok(typeof result.value.sourceContextRef === 'string') })
  specific.set('SOURCE-002-context-manifest-complete', async (c) => { c.equal(projectedContext.value.manifest.length, recommendationSnapshot.preview.semantics.poolManifest.entries.length); c.equal(projectedContext.value.manifest.length, 8) })
  specific.set('SOURCE-003-context-candidates-bound', async (c) => { c.ok(projectedContext.value.candidates.length >= 0); c.ok(projectedContext.value.candidates.every((candidate) => projectedContext.value.manifest.some((entry) => entry.identity.institutionId === candidate.identity.institutionId && entry.identity.recordRevision === candidate.identity.recordRevision))) })
  specific.set('SOURCE-004-context-time-preserved', async (c) => { c.equal(projectedContext.value.evaluationAsOf, A13_EVALUATION_AS_OF); c.equal(projectedContext.value.evaluationAsOf, recommendationSnapshot.preview.semantics.evaluationAsOf) })
  specific.set('SOURCE-005-context-dataset-preserved', async (c) => { c.equal(projectedContext.value.datasetVersion, A13_V121_DATASET_VERSION); c.equal(projectedContext.value.datasetMode, 'MOCK_DEVELOPMENT_ONLY') })
  specific.set('SOURCE-006-context-contract-preserved', async (c) => { c.equal(projectedContext.value.recommendationContractVersion, 'recommendation-contract-v2'); c.equal(projectedContext.value.institutionContractVersion, 'institution-contract-v1.1') })
  specific.set('SOURCE-007-context-ruleset-preserved', async (c) => { c.equal(projectedContext.value.recommendationRulesetVersion, 'recommendation-ruleset-v2'); c.equal(projectedContext.value.recommendationPolicyVersion, 'conservative-exact-with-conditional-v1') })
  specific.set('SOURCE-008-context-policy-preserved', async (c) => { c.equal(projectedContext.value.institutionCapabilityContractVersion, 'institution-capability-contract-v1'); c.ok(projectedContext.value.manifest.every((entry) => entry.disposition === 'included' || entry.disposition === 'excluded')) })
  specific.set('SOURCE-009-context-pin-optional', async (c) => { const without = recommendationSourceModule.projectInstitutionNavigationSourceContextV2(recommendationSnapshot); c.equal(without.ok, true); c.ok(without.value.publicContentPins === undefined || Array.isArray(without.value.publicContentPins)) })
  specific.set('SOURCE-010-context-loss-errors', async (c) => { c.equal(sourceContextFromResultRegistry.resolve('missing').ok, false); c.equal(sourceContextFromResultRegistry.resolve('missing').error.code, 'SOURCE_CONTEXT_NOT_FOUND') })
  specific.set('SOURCE-011-context-identity-loss-errors', async (c) => { const bad = clone(projectedContext.value); bad.candidates[0].identity.recordRevision = 1; const result = sourceModule.validateInstitutionSourceContextInput(bad); c.equal(result.ok, false); c.equal(result.error.code, 'SOURCE_CONTEXT_IDENTITY_MISMATCH') })
  specific.set('SOURCE-012-context-no-reconstruction', async (c) => { c.ok(!('records' in projectedContext.value)); c.ok(!('answers' in projectedContext.value)) })
  specific.set('SOURCE-013-context-no-raw-records', async (c) => { c.ok(!JSON.stringify(projectedContext.value).includes('careProcess')); c.ok(!JSON.stringify(projectedContext.value).includes('evidenceIds')) })
  specific.set('SOURCE-014-context-candidate-order-stable', async (c) => { c.same(projectedContext.value.candidates.map((candidate) => candidate.order), projectedContext.value.candidates.map((candidate) => candidate.order).slice().sort((a, b) => a - b)); c.ok(projectedContext.value.candidates.every((candidate) => candidate.order >= 0)) })
  specific.set('SOURCE-015-context-duplicate-rejected', async (c) => { const bad = clone(projectedContext.value); if (bad.candidates.length > 0) bad.candidates.push(clone(bad.candidates[0])); else bad.manifest.push(clone(bad.manifest[0])); const result = sourceModule.validateInstitutionSourceContextInput(bad); c.equal(result.ok, false); c.ok(result.error.code === 'SOURCE_CONTEXT_CANDIDATE_DUPLICATE' || result.error.code === 'SOURCE_CONTEXT_MANIFEST_MISMATCH') })

  const routeIdentity = firstIdentity
  const routeUrl = routeModule.serializeInstitutionDetailRoute(routeIdentity, 'direct_link')
  const routeParsed = routeModule.parseInstitutionDetailRoute(makeDirectRouteQuery(routeIdentity))
  specific.set('ROUTE-001-canonical-v121-identity', async (c) => { c.equal(routeParsed.ok, true); c.same(routeParsed.value.identity, routeIdentity) })
  specific.set('ROUTE-002-old-revision-not-live', async (c) => { const result = await apps.detail.build({ identity: { ...routeIdentity, recordRevision: 1 }, source: 'direct', sourceContextRef: null, evaluationAsOf: A13_EVALUATION_AS_OF }); c.equal(result.ok, false); c.equal(result.error.code, 'INSTITUTION_REVISION_NOT_FOUND') })
  specific.set('ROUTE-003-route-serializes-revision', async (c) => { c.ok(routeUrl.includes('recordRevision=2')); c.ok(routeUrl.includes('institutionId=')) })
  specific.set('ROUTE-004-route-parses-revision', async (c) => { c.equal(routeParsed.value.identity.recordRevision, 2); c.equal(routeParsed.value.source, 'direct') })
  specific.set('ROUTE-005-id-only-route-rejected', async (c) => { const result = routeModule.parseInstitutionDetailRoute({ id: routeIdentity.institutionId }); c.equal(result.ok, false); c.equal(result.error.code, 'ROUTE_IDENTITY_MISSING') })
  specific.set('ROUTE-006-recommendation-context-required', async (c) => { const result = routeModule.parseInstitutionDetailRoute({ ...makeDirectRouteQuery(routeIdentity), source: 'recommendation' }); c.equal(result.ok, false); c.equal(result.error.code, 'ROUTE_CONTEXT_REF_INVALID') })
  specific.set('ROUTE-007-direct-context-forbidden', async (c) => { const result = routeModule.parseInstitutionDetailRoute({ ...makeDirectRouteQuery(routeIdentity), sourceContextRef: 'bad' }); c.equal(result.ok, false); c.equal(result.error.code, 'ROUTE_CONTEXT_REF_INVALID') })
  specific.set('ROUTE-008-list-items-revision-two', async (c) => { c.ok(directList.value.displayInstitutions.every((item) => item.recordRevision === 2)); c.equal(directList.value.displayInstitutions.length, 8) })
  specific.set('ROUTE-009-detail-revision-two', async (c) => { c.equal(directDetail.value.identity.recordRevision, 2); c.equal(directDetail.value.revisionContext.currentIdentity.recordRevision, 2) })
  specific.set('ROUTE-010-no-legacy-route-id', async (c) => { c.ok(routeUrl.includes('institutionId=')); c.ok(!routeUrl.includes('id=')) })

  for (const id of A13_REQUIRED_CASE_IDS) {
    const handler = specific.get(id)
    assert.equal(typeof handler, 'function', `missing case-specific handler ${id}`)
    await caseRun(id, handler)
  }

  assert.deepEqual(executed, [...A13_REQUIRED_CASE_IDS], 'fixed A1-3 case manifest must execute in order')
  const minimums = { CATALOG: 25, POINTER: 15, PARITY: 8, RESOLVER: 15, LIST: 20, DETAIL: 25, FUTURE: 20, CONTENT: 15, PIN: 15, PROJECTION: 15, SOURCE: 15, ROUTE: 10 }
  for (const [category, minimum] of Object.entries(minimums)) {
    assert.ok((counts.get(category) || 0) >= minimum, `${category} cases below minimum`)
  }
  assert.equal(runtime.calls.storageWrites, 0, 'application integration must not persist')
  assert.equal(runtime.calls.logs, 0, 'application integration must not log sensitive objects')

  const pageSourceViolations = []
  const appFixtureImports = []
  for (const filePath of walkFiles(appRoot).filter((filePath) => filePath.endsWith('.ts'))) {
    const source = readFileSync(filePath, 'utf8')
    if (/(?:scripts|fixtures)[\\/]/.test(source) && !filePath.includes(`${path.sep}scripts${path.sep}`)) {
      appFixtureImports.push(relative(filePath))
    }
    if (filePath.includes(`${path.sep}pages${path.sep}`)
      && /(?:institution-catalog-v1-2-1|types[\\/]institution-v1-2-1|domain[\\/]institution[\\/]v1-2-1|institution-public-content-v1)/.test(source)) {
      pageSourceViolations.push(relative(filePath))
    }
  }
  assert.deepEqual(appFixtureImports, [], 'miniprogram may not import scripts fixtures')
  assert.deepEqual(pageSourceViolations, [], 'pages may not import raw V1.2.1/schema modules')

  if (failures.length > 0) {
    console.error('INSTITUTION_V1_2_1_CATALOG_INTEGRATION_RUNTIME = FAIL')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log('INSTITUTION_V1_2_1_CATALOG_INTEGRATION_RUNTIME = PASS')
  console.log(`WECHAT_TYPESCRIPT_RUNTIME = ${wechat.parser.version} (${wechat.source})`)
  console.log(`CASES = ${executed.length}`)
  Object.entries(minimums).forEach(([category]) => console.log(`${category}_CASES = ${counts.get(category)}`))
  console.log(`CURRENT_CATALOG_RECORDS = ${catalog.records.length}`)
  console.log(`CURRENT_DATASET_VERSION = ${catalog.datasetVersion}`)
  console.log('MIGRATION = explicit V1.1 -> V1.2.1 pointers; direct V1.2.1 -> V1.1 projection')
  console.log('RECOMMENDATION_POOL = complete validated pool; no service pre-filter/rank/truncate')
  console.log('PUBLIC_CONTENT = presentation-only exact/current pin boundary')
  console.log('PERSISTENCE = 0')
  console.log('PAGE_RAW_V121_IMPORTS = 0')
}

main().catch((error) => {
  console.error('INSTITUTION_V1_2_1_CATALOG_INTEGRATION_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
