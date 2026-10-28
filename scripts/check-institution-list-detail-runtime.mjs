/**
 * Phase V1.2-A0-2 runtime gate.
 *
 * This is a test-only WeChat TypeScript 4.1.2 VM harness.  It loads the new
 * Institution List / Detail application boundary without importing a Page,
 * wx, an Assessment store, or the Recommendation evaluator.  The fixture and
 * application boundaries are intentionally kept separate.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  INSTITUTION_LIST_DETAIL_CURRENT_RECORDS,
  INSTITUTION_LIST_DETAIL_DATA_PROVENANCE,
  INSTITUTION_LIST_DETAIL_DATASET_VERSION,
  INSTITUTION_LIST_DETAIL_DATA_LABEL,
  INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
  INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST,
  INSTITUTION_LIST_DETAIL_FIXTURE_POLICY,
  INSTITUTION_LIST_DETAIL_HISTORICAL_RECORD,
  INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS,
  INSTITUTION_LIST_DETAIL_SYNTHETIC_VERIFICATION,
  cloneInstitutionListDetailRecord,
  cloneInstitutionListDetailRecords,
  makeCurrentCatalogPayload,
  makeHistoricalFixture,
} from './fixtures/institution-list-detail-fixtures.mjs'
import { institutionFixtures } from './fixtures/institution-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const servicesRoot = path.join(miniprogramRoot, 'services')
const typesRoot = path.join(miniprogramRoot, 'types')
const institutionDomainRoot = path.join(miniprogramRoot, 'domain', 'institution')
const failures = []
const cases = []
const categoryCounts = new Map()
const loadedSourcePaths = new Set()
const loadedSourceTexts = new Map()

const normalizePath = (filePath) => path.resolve(filePath).toLowerCase()

const isWithin = (filePath, root) => {
  const normalizedFile = normalizePath(filePath)
  const normalizedRoot = normalizePath(root)
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)
}

const diagnosticText = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || typeof diagnostic.start !== 'number') return message
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`
}

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    if (!existsSync(parserPath)) throw new Error(`WECHAT_TYPESCRIPT_PATH does not exist: ${parserPath}`)
    return { parser: require(parserPath), parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  try {
    const parserPath = require.resolve('typescript')
    return { parser: require(parserPath), parserPath, source: 'project TypeScript parser' }
  } catch {
    // TypeScript is intentionally not a project runtime dependency.
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat DevTools TypeScript not found; set WECHAT_TYPESCRIPT_PATH explicitly')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) throw new Error('WeChat DevTools profile directory not found')
  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) continue
    for (const runtimePackage of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtimePackage.name, 'lib', 'typescript.js')
      if (runtimePackage.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) throw new Error('WeChat DevTools TypeScript not found; open DevTools or set WECHAT_TYPESCRIPT_PATH')
  const parserPath = candidates[0].parserPath
  return { parser: require(parserPath), parserPath, source: 'WeChat DevTools mptslib' }
}

const createSourceLoader = (typescript) => {
  const moduleCache = new Map()
  // Only these inert build-time adapters belong to the application boundary;
  // other runtime modules, Pages, storage and Recommendation remain forbidden.
  const allowedRoots = [servicesRoot, typesRoot, institutionDomainRoot,
    path.join(miniprogramRoot, 'runtime', 'institution-validation.ts'),
    path.join(miniprogramRoot, 'runtime', 'presentation-copy.ts')]
  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [
      `${basePath}.ts`,
      `${basePath}.js`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.js'),
    ]
    const resolved = candidates.find((candidate) => existsSync(candidate))
    if (!resolved) throw new Error(`Cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const loadModule = (filePath) => {
    const resolvedPath = path.resolve(filePath)
    if (!allowedRoots.some((root) => isWithin(resolvedPath, root))) {
      throw new Error(`A0-2 runtime loaded outside boundary: ${path.relative(repositoryRoot, resolvedPath)}`)
    }
    const cached = moduleCache.get(resolvedPath)
    if (cached) return cached.exports
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    const source = readFileSync(resolvedPath, 'utf8')
    loadedSourcePaths.add(resolvedPath)
    loadedSourceTexts.set(resolvedPath, source)
    const output = resolvedPath.endsWith('.ts')
      ? (() => {
        const result = typescript.transpileModule(source, {
          compilerOptions: {
            module: typescript.ModuleKind.CommonJS,
            target: typescript.ScriptTarget.ES2019,
            esModuleInterop: true,
          },
          fileName: resolvedPath,
          reportDiagnostics: true,
        })
        const errors = (result.diagnostics || [])
          .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
        if (errors.length > 0) {
          throw new Error(`WeChat TypeScript parser rejected ${path.relative(repositoryRoot, resolvedPath)}:\n${errors.map((diagnostic) => diagnosticText(typescript, diagnostic)).join('\n')}`)
        }
        return result.outputText
      })()
      : source
    const localRequire = (request) => {
      if (!request.startsWith('.')) throw new Error(`A0-2 runtime forbids external import ${request}`)
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
  return loadModule
}

const equalIdentity = (left, right) => (
  left.institutionId === right.institutionId && left.recordRevision === right.recordRevision
)

const identityOf = (record) => ({
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
})

const identityKey = (identity) => `${identity.institutionId}#${identity.recordRevision}`

const makeCurrentService = (records = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, datasetVersion = INSTITUTION_LIST_DETAIL_DATASET_VERSION) => ({
  loadCatalog: async () => ({
    ok: true,
    value: makeCurrentCatalogPayload(records, datasetVersion),
  }),
})

const makeThrowingCurrentService = (message = 'synthetic provider failure') => ({
  loadCatalog: async () => { throw new Error(message) },
})

const makeHistoricalResolver = (record = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORD) => ({
  resolveExactRevision: async (identity) => equalIdentity(identity, identityOf(record))
    ? { ok: true, value: cloneInstitutionListDetailRecord(record) }
    : { ok: false, error: { code: 'INSTITUTION_REVISION_NOT_FOUND' } },
})

const makeThrowingHistoricalResolver = () => ({
  resolveExactRevision: async () => { throw new Error('synthetic history failure') },
})

const makeContextInput = (records = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, candidateDefinitions = [{ record: records[0], group: 'cards', order: 0, tier: 'EXACT' }], overrides = {}) => {
  const candidateKeys = new Set(candidateDefinitions.map((candidate) => identityKey(identityOf(candidate.record))))
  return {
    datasetVersion: INSTITUTION_LIST_DETAIL_DATASET_VERSION,
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
    recommendationContractVersion: 'recommendation-contract-v2',
    recommendationRulesetVersion: 'recommendation-ruleset-v2',
    recommendationPolicyVersion: 'conservative-exact-with-conditional-v1',
    institutionContractVersion: 'institution-contract-v1.1',
    institutionCapabilityContractVersion: 'institution-capability-contract-v1',
    manifest: records.map((record) => ({
      identity: identityOf(record),
      recordProvenance: record.recordProvenance,
      recordStatus: record.recordStatus,
      disposition: candidateKeys.has(identityKey(identityOf(record))) ? 'included' : 'excluded',
    })),
    candidates: candidateDefinitions.map((candidate) => ({
      identity: identityOf(candidate.record),
      group: candidate.group,
      order: candidate.order,
      tier: candidate.tier,
      reasons: candidate.reasons || [{ code: 'CARE_COMPATIBILITY', reference: 'TEST_FIXTURE_ONLY' }],
      differences: candidate.differences || [],
    })),
    ...overrides,
  }
}

const makeRegistry = (registryModule, token = 'a0-2-context-1', now = 1000, ttlMs) => registryModule.createInstitutionSourceContextRegistry({
  tokenFactory: () => token,
  clock: () => now,
  ...(ttlMs === undefined ? {} : { ttlMs }),
})

const createServices = (modules, options = {}) => {
  const currentResolver = modules.resolver.createInstitutionCurrentCatalogResolver(
    options.currentService || makeCurrentService(options.currentRecords),
  )
  const historicalResolver = options.historicalResolver || modules.resolver.createNotConfiguredHistoricalRevisionResolver()
  const registry = options.registry || modules.context.createInstitutionSourceContextRegistry({
    tokenFactory: () => `a0-2-context-${Math.random().toString(36).slice(2)}`,
  })
  return {
    currentResolver,
    historicalResolver,
    registry,
    list: modules.application.createInstitutionListApplicationServiceV12({
      currentCatalogResolver: currentResolver,
      historicalRevisionResolver: historicalResolver,
      sourceContextRegistry: registry,
    }),
    detail: modules.application.createInstitutionDetailApplicationServiceV12({
      currentCatalogResolver: currentResolver,
      historicalRevisionResolver: historicalResolver,
      sourceContextRegistry: registry,
    }),
  }
}

const runCase = async (id, category, callback) => {
  if (cases.includes(id)) throw new Error(`duplicate runtime case id ${id}`)
  cases.push(id)
  categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
  try {
    await callback()
    console.log(`PASS ${id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${id}: ${message}`)
    console.error(`FAIL ${id}: ${message}`)
  }
}

const expectFailure = (result, code) => {
  assert.equal(result.ok, false)
  assert.equal(result.error.code, code)
}

const snapshotIdentities = (items) => items.map((item) => `${item.institutionId}#${item.recordRevision}`)

const main = async () => {
  const parserInfo = await loadWechatTypeScript()
  const load = createSourceLoader(parserInfo.parser)
  const route = load(path.join(servicesRoot, 'institution-detail-route.ts'))
  const resolver = load(path.join(servicesRoot, 'institution-record-resolver.ts'))
  const context = load(path.join(servicesRoot, 'institution-source-context.ts'))
  const presentation = load(path.join(servicesRoot, 'institution-presentation.ts'))
  const displayProjection = load(path.join(servicesRoot, 'institution-display-projection-v11.ts'))
  const recommendationSource = load(path.join(servicesRoot, 'institution-recommendation-source.ts'))
  const application = load(path.join(servicesRoot, 'institution-list-detail-application.ts'))

  assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.fixturePolicy, INSTITUTION_LIST_DETAIL_FIXTURE_POLICY)
  assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.dataProvenance, 'MOCK_DEVELOPMENT_ONLY')
  assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.dataLabel, INSTITUTION_LIST_DETAIL_DATA_LABEL)
  assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.syntheticVerification, INSTITUTION_LIST_DETAIL_SYNTHETIC_VERIFICATION)
  assert.equal(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.length, 8)
  assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.historicalRecordIsNotCurrent, true)
  assert.equal(INSTITUTION_LIST_DETAIL_HISTORICAL_RECORD.recordRevision, 2)
  assert.ok(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.every((record) => record.recordRevision === 1))
  assert.ok(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.every((record) => record.vr.status === 'unknown'))

  const first = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0]
  const second = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[1]
  const firstIdentity = identityOf(first)
  const secondIdentity = identityOf(second)
  const firstKey = identityKey(firstIdentity)

  // Identity and route parser: invalid or ambiguous links fail closed.
  const identityCases = [
    ['ID-001', () => assert.equal(resolver.createInstitutionCanonicalIdentity(firstIdentity).ok, true)],
    ['ID-002', () => assert.equal(resolver.createInstitutionCanonicalIdentity(first.institutionId, first.recordRevision).ok, true)],
    ['ID-003', () => expectFailure(resolver.createInstitutionCanonicalIdentity({ institutionId: 'Bad ID', recordRevision: 1 }), 'INSTITUTION_ID_INVALID')],
    ['ID-004', () => expectFailure(resolver.createInstitutionCanonicalIdentity({ institutionId: first.institutionId, recordRevision: 0 }), 'RECORD_REVISION_INVALID')],
    ['ID-005', () => expectFailure(resolver.createInstitutionCanonicalIdentity({ ...firstIdentity, extra: true }), 'IDENTITY_SHAPE_INVALID')],
    ['ID-006', () => assert.equal(resolver.validateInstitutionCanonicalIdentity(firstIdentity).ok, true)],
    ['ID-007', () => assert.equal(resolver.equalInstitutionCanonicalIdentity(firstIdentity, firstIdentity), true)],
    ['ID-008', () => assert.equal(resolver.equalInstitutionCanonicalIdentity(firstIdentity, { ...firstIdentity, recordRevision: 2 }), false)],
    ['ID-009', () => assert.equal(resolver.compareInstitutionCanonicalIdentity(firstIdentity, secondIdentity) < 0, true)],
    ['ID-010', () => assert.equal(resolver.compareInstitutionCanonicalIdentity({ ...firstIdentity, recordRevision: 2 }, firstIdentity) > 0, true)],
    ['ID-011', () => assert.equal(resolver.institutionCanonicalKey(firstIdentity), firstKey)],
    ['ROUTE-001', () => assert.deepEqual(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'direct' }), { ok: true, value: { identity: firstIdentity, source: 'direct', sourceContextRef: null } })],
    ['ROUTE-002', () => assert.equal(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'recommendation', sourceContextRef: 'ctx-1' }).ok, true)],
    ['ROUTE-003', () => assert.equal(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'direct_list' }).value.source, 'direct')],
    ['ROUTE-004', () => assert.equal(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'direct_link' }).value.source, 'direct')],
    ['ROUTE-005', () => assert.equal(route.parseInstitutionDetailRoute({ institutionId: encodeURIComponent(first.institutionId), recordRevision: encodeURIComponent('1'), source: 'direct' }).ok, true)],
    ['ROUTE-006', () => expectFailure(route.parseInstitutionDetailRoute({ recordRevision: '1', source: 'direct' }), 'ROUTE_IDENTITY_MISSING')],
    ['ROUTE-007', () => expectFailure(route.parseInstitutionDetailRoute({ id: first.institutionId, recordRevision: '1', source: 'direct' }), 'ROUTE_IDENTITY_MISSING')],
    ['ROUTE-008', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: 'Bad ID', recordRevision: '1', source: 'direct' }), 'ROUTE_INSTITUTION_ID_INVALID')],
    ['ROUTE-009', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '0', source: 'direct' }), 'ROUTE_RECORD_REVISION_INVALID')],
    ['ROUTE-010', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1.0', source: 'direct' }), 'ROUTE_RECORD_REVISION_INVALID')],
    ['ROUTE-011', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'other' }), 'ROUTE_SOURCE_INVALID')],
    ['ROUTE-012', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'recommendation' }), 'ROUTE_CONTEXT_REF_INVALID')],
    ['ROUTE-013', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'direct', sourceContextRef: 'ctx-1' }), 'ROUTE_CONTEXT_REF_INVALID')],
    ['ROUTE-014', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: '%E0%A4%A', recordRevision: '1', source: 'direct' }), 'ROUTE_INSTITUTION_ID_INVALID')],
    ['ROUTE-015', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: [first.institutionId], recordRevision: '1', source: 'direct' }), 'ROUTE_INSTITUTION_ID_INVALID')],
    ['ROUTE-016', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: ['1'], source: 'direct' }), 'ROUTE_RECORD_REVISION_INVALID')],
    ['ROUTE-017', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'recommendation', sourceContextRef: '%E0%A4%A' }), 'ROUTE_CONTEXT_REF_INVALID')],
    ['ROUTE-018', () => assert.equal(route.serializeInstitutionDetailRoute(firstIdentity, 'recommendation', 'ctx-1').includes('institutionId='), true)],
    ['ROUTE-019', () => assert.equal(route.serializeInstitutionDetailRoute(firstIdentity, 'recommendation', 'ctx-1').includes('sourceContextRef=ctx-1'), true)],
    ['ROUTE-020', () => assert.equal(route.serializeInstitutionDetailRoute(firstIdentity, 'direct_link').includes('recordRevision=1'), true)],
  ]
  for (const [id, callback] of identityCases) await runCase(id, 'identity-route', callback)

  // Current resolver: exact identity only; all catalog validation errors are
  // observable and no current resolver reaches the historical provider.
  const currentResolver = resolver.createInstitutionCurrentCatalogResolver(makeCurrentService())
  const currentCases = [
    ['CURRENT-001', async () => { const result = await currentResolver.loadCurrentCatalog(); assert.equal(result.ok, true); assert.equal(result.value.records.length, 8) }],
    ['CURRENT-002', async () => { const result = await currentResolver.resolveExactCurrentRevision(firstIdentity); assert.equal(result.ok, true); assert.equal(equalIdentity(result.value.record, firstIdentity), true) }],
    ['CURRENT-003', async () => expectFailure(await currentResolver.resolveExactCurrentRevision({ ...firstIdentity, recordRevision: 2 }), 'INSTITUTION_REVISION_NOT_FOUND')],
    ['CURRENT-004', async () => expectFailure(await currentResolver.resolveExactCurrentRevision({ institutionId: 'institution-v11-missing', recordRevision: 1 }), 'INSTITUTION_NOT_FOUND')],
    ['CURRENT-005', async () => expectFailure(await currentResolver.resolveExactCurrentRevision({ institutionId: 'bad id', recordRevision: 1 }), 'IDENTITY_INVALID')],
    ['CURRENT-006', async () => { const result = await resolver.resolveExactCurrentInstitutionRecord(makeCurrentCatalogPayload().records, firstIdentity); assert.equal(result.ok, true) }],
    ['CURRENT-007', async () => { const result = await resolver.resolveExactCurrentInstitutionRecord(makeCurrentCatalogPayload().records, { ...firstIdentity, recordRevision: 3 }); expectFailure(result, 'INSTITUTION_REVISION_NOT_FOUND') }],
    ['CURRENT-008', async () => { const duplicate = [cloneInstitutionListDetailRecord(first), cloneInstitutionListDetailRecord(first)]; const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService(duplicate)).loadCurrentCatalog(); expectFailure(result, 'DUPLICATE_CURRENT_INSTITUTION_ID') }],
    ['CURRENT-009', async () => { const invalid = cloneInstitutionListDetailRecord(first); invalid.recordStatus = 'not-a-status'; const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService([invalid])).loadCurrentCatalog(); expectFailure(result, 'INVALID_INSTITUTION_RECORD') }],
    ['CURRENT-010', async () => { const service = { loadCatalog: async () => ({ ok: true, value: { datasetVersion: '', datasetMode: 'MOCK_DEVELOPMENT_ONLY', records: [] } }) }; const result = await resolver.createInstitutionCurrentCatalogResolver(service).loadCurrentCatalog(); expectFailure(result, 'INVALID_CATALOG_ENVELOPE') }],
    ['CURRENT-011', async () => { const service = { loadCatalog: async () => ({ ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }) }; const result = await resolver.createInstitutionCurrentCatalogResolver(service).loadCurrentCatalog(); expectFailure(result, 'PROVIDER_LOAD_FAILED') }],
    ['CURRENT-012', async () => { const result = await resolver.createInstitutionCurrentCatalogResolver(makeThrowingCurrentService()).loadCurrentCatalog(); expectFailure(result, 'PROVIDER_LOAD_FAILED') }],
    ['CURRENT-013', async () => { const records = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS); const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService(records)).loadCurrentCatalog(); assert.equal(result.ok, true); result.value.records[0].identity.name.value = 'mutated'; const again = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService(records)).loadCurrentCatalog(); assert.notEqual(again.value.records[0].identity.name.value, 'mutated') }],
    ['CURRENT-014', async () => { const reversed = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS).reverse(); const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService(reversed)).resolveExactCurrentRevision(firstIdentity); assert.equal(result.ok, true); assert.equal(result.value.record.institutionId, first.institutionId) }],
  ]
  for (const [id, callback] of currentCases) await runCase(id, 'current-resolver', callback)

  const versionBoundaryCases = [
    ['VERSION-BOUNDARY-001', async () => { const v1 = institutionFixtures[0].record; const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService([v1])).loadCurrentCatalog(); expectFailure(result, 'INVALID_INSTITUTION_RECORD') }],
    ['VERSION-BOUNDARY-002', async () => { const future = cloneInstitutionListDetailRecord(first); future.contractVersion = 'institution-contract-v9'; const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService([future])).loadCurrentCatalog(); expectFailure(result, 'INVALID_INSTITUTION_RECORD') }],
    ['VERSION-BOUNDARY-003', async () => { const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService([first])).loadCurrentCatalog(); assert.equal(result.ok, true); assert.equal(result.value.records[0].contractVersion, 'institution-contract-v1.1') }],
  ]
  for (const [id, callback] of versionBoundaryCases) await runCase(id, 'version-boundary', callback)

  // Historical resolver is a separate injected boundary.  The production
  // default remains unavailable and never reuses the current eight records.
  const historicalRecord = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORD
  const historicalIdentity = identityOf(historicalRecord)
  const historyCases = [
    ['HISTORY-001', async () => expectFailure(await resolver.notConfiguredHistoricalRevisionResolver.resolveExactRevision(historicalIdentity), 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED')],
    ['HISTORY-002', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); assert.equal(result.ok, true); assert.equal(result.value.recordRevision, 2) }],
    ['HISTORY-003', async () => expectFailure(await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), { institutionId: 'bad id', recordRevision: 2 }), 'IDENTITY_INVALID')],
    ['HISTORY-004', async () => expectFailure(await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), { institutionId: historicalRecord.institutionId, recordRevision: 3 }), 'INSTITUTION_REVISION_NOT_FOUND')],
    ['HISTORY-005', async () => expectFailure(await resolver.resolveExactHistoricalInstitutionRecord(makeThrowingHistoricalResolver(), historicalIdentity), 'HISTORICAL_REVISION_PROVIDER_FAILED')],
    ['HISTORY-006', async () => { const invalid = cloneInstitutionListDetailRecord(historicalRecord); invalid.recordStatus = 'bad'; const result = await resolver.resolveExactHistoricalInstitutionRecord({ resolveExactRevision: async () => ({ ok: true, value: invalid }) }, historicalIdentity); expectFailure(result, 'INVALID_HISTORICAL_INSTITUTION_RECORD') }],
    ['HISTORY-007', async () => { const other = cloneInstitutionListDetailRecord(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[1]); other.recordRevision = 2; other.evidence = other.evidence.map((entry) => ({ ...entry, recordRevision: 2 })); const result = await resolver.resolveExactHistoricalInstitutionRecord({ resolveExactRevision: async () => ({ ok: true, value: other }) }, historicalIdentity); expectFailure(result, 'EXACT_IDENTITY_MISMATCH') }],
    ['HISTORY-008', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); result.value.identity.name.value = 'changed'; const again = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); assert.notEqual(again.value.identity.name.value, 'changed') }],
    ['HISTORY-009', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); assert.equal(result.value.recordStatus, 'archived'); assert.equal(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.some((record) => equalIdentity(record, historicalIdentity)), false) }],
    ['HISTORY-010', async () => { let called = 0; const result = await resolver.resolveExactHistoricalInstitutionRecord({ resolveExactRevision: async () => { called += 1; return { ok: true, value: historicalRecord } } }, { institutionId: 'bad id', recordRevision: 2 }); expectFailure(result, 'IDENTITY_INVALID'); assert.equal(called, 0) }],
    ['HISTORY-011', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); assert.equal(result.value.recordRevision > 0, true) }],
    ['HISTORY-012', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), historicalIdentity); assert.equal(result.value.recordProvenance, 'MOCK_DEVELOPMENT_ONLY'); assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.dataLabel, 'NOT_REAL_INSTITUTION_DATA') }],
  ]
  for (const [id, callback] of historyCases) await runCase(id, 'historical-resolver', callback)

  // The registry stores a frozen, narrow context only.  It has no persistence
  // and accepts an injectable token/clock so expiry and collision are testable.
  const baseContext = makeContextInput()
  const registryCases = [
    ['REGISTRY-001', () => { const reg = makeRegistry(context, 'ctx-001'); const result = reg.register(baseContext); assert.equal(result.ok, true); assert.equal(result.value, 'ctx-001') }],
    ['REGISTRY-002', () => { const reg = makeRegistry(context, 'ctx-002'); const token = reg.register(baseContext).value; const result = reg.resolve(token); assert.equal(result.ok, true); assert.equal(result.value.kind, 'institution_navigation_source_context_v1') }],
    ['REGISTRY-003', () => { const reg = makeRegistry(context, 'ctx-003'); const input = makeContextInput(); const token = reg.register(input).value; input.datasetVersion = 'mutated'; input.manifest[0].identity.institutionId = 'mutated'; const result = reg.resolve(token); assert.equal(result.value.datasetVersion, INSTITUTION_LIST_DETAIL_DATASET_VERSION); assert.equal(result.value.manifest[0].identity.institutionId, first.institutionId) }],
    ['REGISTRY-004', () => { const reg = makeRegistry(context, 'ctx-004'); const result = reg.register(baseContext); const resolved = reg.resolve(result.value); assert.throws(() => { resolved.value.manifest[0].identity.institutionId = 'mutated' }); assert.equal(reg.resolve(result.value).value.manifest[0].identity.institutionId, first.institutionId) }],
    ['REGISTRY-005', () => { const reg = makeRegistry(context, 'ctx-005'); const token = reg.register(baseContext).value; assert.equal(reg.clear(token), true); expectFailure(reg.resolve(token), 'SOURCE_CONTEXT_NOT_FOUND') }],
    ['REGISTRY-006', () => { const reg = makeRegistry(context, 'ctx-006'); reg.register(baseContext); reg.clearAll(); expectFailure(reg.resolve('ctx-006'), 'SOURCE_CONTEXT_NOT_FOUND') }],
    ['REGISTRY-007', () => { const reg = makeRegistry(context, 'ctx-007'); expectFailure(reg.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 0, tier: 'EXACT' }, { record: first, group: 'cards', order: 1, tier: 'SOFT_NEAR' }])), 'SOURCE_CONTEXT_CANDIDATE_DUPLICATE') }],
    ['REGISTRY-008', () => { const input = makeContextInput(); input.manifest.push({ ...input.manifest[0], identity: { ...input.manifest[0].identity } }); const reg = makeRegistry(context, 'ctx-008'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_MANIFEST_MISMATCH') }],
    ['REGISTRY-009', () => { const outside = cloneInstitutionListDetailRecord(first); outside.recordRevision = 2; const input = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: outside, group: 'cards', order: 0, tier: 'EXACT' }]); const reg = makeRegistry(context, 'ctx-009'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_IDENTITY_MISMATCH') }],
    ['REGISTRY-010', () => { const input = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 2, tier: 'EXACT' }]); const reg = makeRegistry(context, 'ctx-010'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_CANDIDATE_INVALID') }],
    ['REGISTRY-011', () => { const input = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 0, tier: 'EXACT' }, { record: second, group: 'nearMatches', order: 0, tier: 'SOFT_NEAR' }]); const reg = makeRegistry(context, 'ctx-011'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_CANDIDATE_INVALID') }],
    ['REGISTRY-012', () => { const input = makeContextInput(); input.recommendationRulesetVersion = 'wrong'; const reg = makeRegistry(context, 'ctx-012'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_INVALID') }],
    ['REGISTRY-013', () => { const input = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 0, tier: 'CONDITIONAL' }]); const reg = makeRegistry(context, 'ctx-013'); expectFailure(reg.register(input), 'SOURCE_CONTEXT_CANDIDATE_INVALID') }],
    ['REGISTRY-014', () => { const reg = makeRegistry(context, ''); expectFailure(reg.register(baseContext), 'SOURCE_CONTEXT_REF_INVALID') }],
    ['REGISTRY-015', () => { const reg = makeRegistry(context, 'ctx-015'); assert.equal(reg.register(baseContext).ok, true); expectFailure(reg.register(baseContext), 'SOURCE_CONTEXT_TOKEN_COLLISION') }],
    ['REGISTRY-016', () => { const reg = context.createInstitutionSourceContextRegistry({ tokenFactory: () => { throw new Error('no token') } }); expectFailure(reg.register(baseContext), 'SOURCE_CONTEXT_TOKEN_FACTORY_FAILED') }],
    ['REGISTRY-017', () => { const reg = makeRegistry(context, 'ctx-017'); expectFailure(reg.resolve('bad ref'), 'SOURCE_CONTEXT_REF_INVALID') }],
    ['REGISTRY-018', () => { const reg = makeRegistry(context, 'ctx-018'); const result = reg.register(baseContext); assert.equal(context.assertInstitutionSourceContextIdentity(result.value && reg.resolve(result.value).value, firstIdentity).ok, true) }],
    ['REGISTRY-019', () => { const reg = makeRegistry(context, 'ctx-019'); const result = reg.register(baseContext); assert.equal(context.assertInstitutionSourceContextIdentity(reg.resolve(result.value).value, { institutionId: second.institutionId, recordRevision: 1 }).ok, false) }],
    ['REGISTRY-020', () => { let now = 100; const reg = context.createInstitutionSourceContextRegistry({ tokenFactory: () => 'ctx-020', clock: () => now, ttlMs: 10 }); const token = reg.register(baseContext).value; now = 110; expectFailure(reg.resolve(token), 'SOURCE_CONTEXT_EXPIRED') }],
  ]
  for (const [id, callback] of registryCases) await runCase(id, 'source-context-registry', callback)

  // Context-loss tests prove that an opaque recommendation reference is not a
  // fallback hint: no current catalog or profile reconstruction may occur.
  const contextLossCases = [
    ['CONTEXT-LOSS-001', async () => { let calls = 0; const services = createServices({ resolver, context, application }, { currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-002', async () => { let calls = 0; const services = createServices({ resolver, context, application }, { currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: 'missing-context', evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-003', async () => { let calls = 0; const registry = makeRegistry(context, 'ctx-loss-003'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry, currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: '2026-09-01T10:00:00.000Z' }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-004', async () => { let calls = 0; const registry = makeRegistry(context, 'ctx-loss-004'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry, currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.detail.build({ identity: secondIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-005', async () => { let calls = 0; const registry = makeRegistry(context, 'ctx-loss-005'); const input = makeContextInput(); input.manifest[0].recordStatus = 'suspended'; const token = registry.register(input).value; const services = createServices({ resolver, context, application }, { registry, currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 1) }],
    ['CONTEXT-LOSS-006', async () => { let calls = 0; const registry = makeRegistry(context, 'ctx-loss-006'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry, currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.list.build({ evaluationAsOf: '2026-09-01T10:00:00.000Z', sourceContextRef: token }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-007', async () => { let calls = 0; const services = createServices({ resolver, context, application }, { currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: 'unknown-context' }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(calls, 0) }],
    ['CONTEXT-LOSS-008', async () => { let calls = 0; const registry = makeRegistry(context, 'ctx-loss-008'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry, currentService: { loadCatalog: async () => { calls += 1; return { ok: true, value: makeCurrentCatalogPayload() } } } }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); assert.equal(result.ok, true); assert.equal(calls, 1) }],
    ['CONTEXT-LOSS-009', async () => { const registry = makeRegistry(context, 'ctx-loss-009'); const token = registry.register(baseContext).value; registry.clear(token); const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['CONTEXT-LOSS-010', async () => { const registry = makeRegistry(context, 'ctx-loss-010'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['CONTEXT-LOSS-011', async () => { const registry = makeRegistry(context, 'ctx-loss-011'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.recommendationContext !== null, true) }],
    ['CONTEXT-LOSS-012', async () => { const registry = makeRegistry(context, 'ctx-loss-012'); const token = registry.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); assert.equal(result.ok, true); assert.equal(result.value.source, 'recommendation') }],
  ]
  for (const [id, callback] of contextLossCases) await runCase(id, 'context-loss', callback)

  const directServices = createServices({ resolver, context, application })
  const metadataEntries = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.map((record, index) => ({
    identity: identityOf(record),
    displayOrder: INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.length - index - 1,
  }))
  const recommendationRegistry = makeRegistry(context, 'ctx-list-rec')
  const recommendationToken = recommendationRegistry.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [
    { record: second, group: 'cards', order: 0, tier: 'EXACT' },
  ])).value
  const listCases = [
    ['LIST-001', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.source, 'direct') }],
    ['LIST-002', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: null }); assert.equal(result.ok, true); assert.equal(result.value.sourceContextRef, null) }],
    ['LIST-003', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.displayInstitutions.length, 8) }],
    ['LIST-004', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.deepEqual(snapshotIdentities(result.value.displayInstitutions), snapshotIdentities(result.value.displayInstitutions).slice().sort()) }],
    ['LIST-005', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(JSON.stringify(result.value.displayInstitutions).includes('displayOrder'), false) }],
    ['LIST-006', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.dataDisclosure.kind, 'MOCK_DEVELOPMENT_ONLY'); assert.ok(result.value.dataDisclosure.text.includes('功能测试示例')) }],
    ['LIST-007', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.displayInstitutions.every((item) => item.vr.state === 'unknown' && item.vr.canNavigate === false), true) }],
    ['LIST-008', async () => { const result = await directServices.list.build({ evaluationAsOf: 'not-a-time' }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['LIST-009', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: metadataEntries } }); assert.equal(result.ok, true); assert.equal(result.value.ordering.kind, 'CURATED_DISPLAY_ORDER_V1'); assert.equal(result.value.displayInstitutions[0].institutionId, INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[7].institutionId) }],
    ['LIST-010', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: metadataEntries.slice(1) } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['LIST-011', async () => { const duplicateOrders = metadataEntries.map((entry) => ({ ...entry })); duplicateOrders[1].displayOrder = duplicateOrders[0].displayOrder; const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: duplicateOrders } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['LIST-012', async () => { const unknown = metadataEntries.map((entry) => ({ ...entry })); unknown[0].identity = { institutionId: 'institution-unknown', recordRevision: 1 }; const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: unknown } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['LIST-013', async () => { const empty = createServices({ resolver, context, application }, { currentRecords: [] }); const result = await empty.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.displayInstitutions.length, 0) }],
    ['LIST-014', async () => { const broken = createServices({ resolver, context, application }, { currentService: makeThrowingCurrentService() }); const result = await broken.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_CATALOG_ERROR') }],
    ['LIST-015', async () => { const services = createServices({ resolver, context, application }, { registry: recommendationRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: recommendationToken }); assert.equal(result.ok, true); assert.equal(result.value.source, 'recommendation') }],
    ['LIST-016', async () => { const services = createServices({ resolver, context, application }, { registry: recommendationRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: recommendationToken }); assert.equal(result.value.recommendedCandidates.length, 1); assert.equal(result.value.recommendedCandidates[0].institutionId, second.institutionId) }],
    ['LIST-017', async () => { const services = createServices({ resolver, context, application }, { registry: recommendationRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: recommendationToken }); assert.equal(result.value.otherCurrentPartners.length, 7) }],
    ['LIST-018', async () => { const services = createServices({ resolver, context, application }, { registry: recommendationRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: recommendationToken }); assert.equal(new Set(snapshotIdentities(result.value.displayInstitutions)).size, result.value.displayInstitutions.length) }],
    ['LIST-019', async () => { const registry = makeRegistry(context, 'ctx-list-mode'); const input = makeContextInput(); input.datasetMode = 'PRODUCTION'; input.manifest = input.manifest.map((entry) => ({ ...entry, recordProvenance: 'PRODUCTION_CANDIDATE' })); const token = registry.register(input).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['LIST-020', async () => { const services = createServices({ resolver, context, application }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: 'missing-list-context' }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['LIST-021', async () => { const historyContext = makeRegistry(context, 'ctx-list-history'); const historyInput = makeContextInput([historicalRecord], [{ record: historicalRecord, group: 'cards', order: 0, tier: 'EXACT' }]); const token = historyContext.register(historyInput).value; const services = createServices({ resolver, context, application }, { registry: historyContext }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['LIST-022', async () => { const registry = makeRegistry(context, 'ctx-list-multi'); const token = registry.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 0, tier: 'EXACT' }, { record: second, group: 'cards', order: 1, tier: 'SOFT_NEAR' }])).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); assert.equal(result.ok, true); assert.equal(result.value.recommendedCandidates.length, 2) }],
    ['LIST-023', async () => { const registry = makeRegistry(context, 'ctx-list-order'); const token = registry.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: second, group: 'cards', order: 1, tier: 'SOFT_NEAR' }, { record: first, group: 'cards', order: 0, tier: 'EXACT' }])).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); assert.deepEqual(snapshotIdentities(result.value.recommendedCandidates), [`${first.institutionId}#1`, `${second.institutionId}#1`]) }],
    ['LIST-024', async () => { const registry = makeRegistry(context, 'ctx-list-placement'); const token = registry.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'conditionalCandidates', order: 0, tier: 'CONDITIONAL' }])).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: token }); assert.equal(result.value.recommendedCandidates[0].recommendationPlacement.tier, 'CONDITIONAL') }],
    ['LIST-025', async () => { const source = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS); const services = createServices({ resolver, context, application }, { currentRecords: source }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.recommendedCandidates.length, 0); assert.equal(result.value.otherCurrentPartners.length, 8) }],
    ['LIST-026', async () => { const malformed = metadataEntries.map((entry) => ({ ...entry })); malformed[0] = null; const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: malformed } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR'); assert.equal(result.error.causeCode, 'INVALID_LIST_ORDER_METADATA') }],
  ]
  for (const [id, callback] of listCases) await runCase(id, 'list-application', callback)

  const detailRegistry = makeRegistry(context, 'ctx-detail-rec')
  const detailToken = detailRegistry.register(makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [
    { record: first, group: 'cards', order: 0, tier: 'EXACT', reasons: [{ code: 'CARE_COMPATIBILITY', reference: 'TEST' }], differences: [] },
  ])).value
  const historyRegistry = makeRegistry(context, 'ctx-detail-history')
  const historyToken = historyRegistry.register(makeContextInput([historicalRecord], [
    { record: historicalRecord, group: 'cards', order: 0, tier: 'EXACT' },
  ])).value
  const detailCases = [
    ['DETAIL-001', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'DIRECT_CURRENT') }],
    ['DETAIL-002', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.deepEqual(result.value.identity, firstIdentity) }],
    ['DETAIL-003', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.recommendationContext, null) }],
    ['DETAIL-004', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.actions.canContactConsultant, false); assert.equal(result.value.actions.canCreateAppointment, false) }],
    ['DETAIL-005', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.sections.basic.name.value !== null, true); assert.equal(result.value.sections.careProcess.state, 'not_applicable_for_schema') }],
    ['DETAIL-006', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.dataDisclosure.kind, 'MOCK_DEVELOPMENT_ONLY') }],
    ['DETAIL-007', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.sections.media.vr.state, 'unknown'); assert.equal(result.value.actions.canOpenVr, false) }],
    ['DETAIL-008', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: 'not-a-time' }); expectFailure(result, 'INSTITUTION_DETAIL_PROJECTION_ERROR') }],
    ['DETAIL-009', async () => { const result = await directServices.detail.build({ identity: { institutionId: 'bad id', recordRevision: 1 }, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_ROUTE_ERROR') }],
    ['DETAIL-010', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-011', async () => { const result = await directServices.detail.build({ identity: { institutionId: 'institution-v11-missing', recordRevision: 1 }, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_NOT_FOUND') }],
    ['DETAIL-012', async () => { const result = await directServices.detail.build({ identity: { institutionId: first.institutionId, recordRevision: 2 }, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_REVISION_NOT_FOUND') }],
    ['DETAIL-013', async () => { const broken = createServices({ resolver, context, application }, { currentService: makeThrowingCurrentService() }); const result = await broken.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_CATALOG_ERROR') }],
    ['DETAIL-014', async () => { const suspended = cloneInstitutionListDetailRecord(first); suspended.recordStatus = 'suspended'; const services = createServices({ resolver, context, application }, { currentRecords: [suspended] }); const result = await services.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_RECORD_NOT_DISPLAYABLE') }],
    ['DETAIL-015', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'RECOMMENDATION_PINNED') }],
    ['DETAIL-016', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.recommendationContext.tier, 'EXACT'); assert.equal(result.value.recommendationContext.reasons[0].code, 'CARE_COMPATIBILITY') }],
    ['DETAIL-017', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.evaluationAsOf, INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF) }],
    ['DETAIL-018', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-019', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: 'missing-detail-context', evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-020', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: secondIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-021', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: '2026-09-01T10:00:00.000Z' }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-022', async () => { const services = createServices({ resolver, context, application }, { registry: detailRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: detailToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.actions.canCreateAppointment, false) }],
    ['DETAIL-023', async () => { const services = createServices({ resolver, context, application }, { registry: historyRegistry, historicalResolver: makeHistoricalResolver() }); const result = await services.detail.build({ identity: historicalIdentity, source: 'recommendation', sourceContextRef: historyToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'HISTORICAL_READ_ONLY') }],
    ['DETAIL-024', async () => { const services = createServices({ resolver, context, application }, { registry: historyRegistry, historicalResolver: makeHistoricalResolver() }); const result = await services.detail.build({ identity: historicalIdentity, source: 'recommendation', sourceContextRef: historyToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.revisionContext.state, 'historical_inactive'); assert.equal(result.value.revisionContext.currentIdentity.recordRevision, 1) }],
    ['DETAIL-025', async () => { const services = createServices({ resolver, context, application }, { registry: historyRegistry, historicalResolver: makeHistoricalResolver() }); const result = await services.detail.build({ identity: historicalIdentity, source: 'recommendation', sourceContextRef: historyToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.actions.canViewCurrentRevision, true); assert.equal(result.value.actions.canOpenVr, false) }],
    ['DETAIL-026', async () => { const services = createServices({ resolver, context, application }); const result = await services.detail.buildCurrentRevision({ originalIdentity: historicalIdentity, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'CURRENT_INSTITUTION_CONTEXT') }],
    ['DETAIL-027', async () => { const services = createServices({ resolver, context, application }); const result = await services.detail.buildCurrentRevision({ originalIdentity: historicalIdentity, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.identity.recordRevision, 1); assert.equal(result.value.recommendationContext, null) }],
    ['DETAIL-028', async () => { const services = createServices({ resolver, context, application }); const result = await services.detail.buildCurrentRevision({ originalIdentity: historicalIdentity, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.actions.canViewCurrentRevision, false); assert.equal(result.value.source, 'direct') }],
    ['DETAIL-029', async () => { const services = createServices({ resolver, context, application }); const result = await services.detail.buildCurrentRevision({ originalIdentity: { institutionId: 'institution-v11-missing', recordRevision: 2 }, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_NOT_FOUND') }],
    ['DETAIL-030', async () => { const registry = makeRegistry(context, 'ctx-detail-status'); const input = makeContextInput(); input.manifest[0].recordStatus = 'suspended'; const token = registry.register(input).value; const services = createServices({ resolver, context, application }, { registry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['DETAIL-031', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); const keys = Object.keys(result.value.sections); assert.ok(keys.includes('rooms')); assert.ok(keys.includes('qualifications')); assert.ok(keys.includes('consultantVisit')) }],
    ['DETAIL-032', async () => { const result = await directServices.detail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.recordProvenance, 'MOCK_DEVELOPMENT_ONLY'); assert.equal(result.value.recordStatus, 'published') }],
    ['DETAIL-033', async () => { const publishedHistory = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS[0]; const currentSuspended = cloneInstitutionListDetailRecord(first); currentSuspended.recordStatus = 'suspended'; const registry = makeRegistry(context, 'ctx-detail-current-suspended'); const token = registry.register(makeContextInput([publishedHistory], [{ record: publishedHistory, group: 'cards', order: 0, tier: 'EXACT' }])).value; const services = createServices({ resolver, context, application }, { currentRecords: [currentSuspended], registry, historicalResolver: makeHistoricalResolver(publishedHistory) }); const result = await services.detail.build({ identity: identityOf(publishedHistory), source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.revisionContext.currentIdentity, null); assert.equal(result.value.actions.canViewCurrentRevision, false) }],
  ]
  for (const [id, callback] of detailCases) await runCase(id, 'detail-application', callback)

  // A recommendation pinned to an older dataset must never be satisfied by a
  // same-identity record from the current dataset.  A history provider is the
  // only legal source when dataset versions differ.
  const versionMismatchRegistry = makeRegistry(context, 'ctx-version-mismatch')
  const versionMismatchInput = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [
    { record: first, group: 'cards', order: 0, tier: 'EXACT' },
  ])
  versionMismatchInput.datasetVersion = 'institution-catalog-v1.1-past-test'
  const versionMismatchToken = versionMismatchRegistry.register(versionMismatchInput).value
  const versionHistoryRegistry = makeRegistry(context, 'ctx-version-history')
  const versionHistoryInput = makeContextInput([historicalRecord], [
    { record: historicalRecord, group: 'cards', order: 0, tier: 'EXACT' },
  ])
  versionHistoryInput.datasetVersion = 'institution-catalog-v1.1-past-test'
  const versionHistoryToken = versionHistoryRegistry.register(versionHistoryInput).value
  const modeMismatchRegistry = makeRegistry(context, 'ctx-mode-mismatch')
  const modeMismatchInput = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [
    { record: first, group: 'cards', order: 0, tier: 'EXACT' },
  ])
  modeMismatchInput.datasetMode = 'PRODUCTION'
  modeMismatchInput.manifest = modeMismatchInput.manifest.map((entry) => ({ ...entry, recordProvenance: 'PRODUCTION_CANDIDATE' }))
  const modeMismatchToken = modeMismatchRegistry.register(modeMismatchInput).value
  const versionRoutingCases = [
    ['VERSION-001', async () => { const services = createServices({ resolver, context, application }, { registry: versionMismatchRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: versionMismatchToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_REVISION_NOT_FOUND'); assert.equal(result.error.causeCode, 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED') }],
    ['VERSION-002', async () => { const services = createServices({ resolver, context, application }, { registry: versionMismatchRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: versionMismatchToken }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(result.error.causeCode, 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED') }],
    ['VERSION-003', async () => { const services = createServices({ resolver, context, application }, { registry: versionHistoryRegistry, historicalResolver: makeHistoricalResolver() }); const result = await services.detail.build({ identity: historicalIdentity, source: 'recommendation', sourceContextRef: versionHistoryToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'HISTORICAL_READ_ONLY') }],
    ['VERSION-004', async () => { const services = createServices({ resolver, context, application }, { registry: versionHistoryRegistry, historicalResolver: makeHistoricalResolver() }); const result = await services.detail.build({ identity: historicalIdentity, source: 'recommendation', sourceContextRef: versionHistoryToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.value.identity.recordRevision, historicalRecord.recordRevision); assert.equal(result.value.recommendationContext.tier, 'EXACT') }],
    ['VERSION-005', async () => { const services = createServices({ resolver, context, application }, { registry: modeMismatchRegistry }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: modeMismatchToken, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(result.error.causeCode, 'SOURCE_CONTEXT_DATASET_MODE_MISMATCH') }],
    ['VERSION-006', async () => { const services = createServices({ resolver, context, application }, { registry: modeMismatchRegistry }); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: modeMismatchToken }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR'); assert.equal(result.error.causeCode, 'SOURCE_CONTEXT_DATASET_MODE_MISMATCH') }],
  ]
  for (const [id, callback] of versionRoutingCases) await runCase(id, 'dataset-version-routing', callback)

  // Promise rejections from a provider/resolver are normalized at the
  // application boundary instead of surfacing as an unhandled rejection or a
  // silent no-op.
  const throwingCurrentResolver = {
    loadCurrentCatalog: async () => { throw new Error('synthetic current catalog rejection') },
    resolveExactCurrentRevision: async () => { throw new Error('synthetic current revision rejection') },
  }
  const throwingApplicationDeps = {
    currentCatalogResolver: throwingCurrentResolver,
    historicalRevisionResolver: resolver.createNotConfiguredHistoricalRevisionResolver(),
    sourceContextRegistry: context.createInstitutionSourceContextRegistry({ tokenFactory: () => 'ctx-throwing-provider' }),
  }
  const throwingList = application.createInstitutionListApplicationServiceV12(throwingApplicationDeps)
  const throwingDetail = application.createInstitutionDetailApplicationServiceV12(throwingApplicationDeps)
  const providerThrowCases = [
    ['PROVIDER-THROW-001', async () => { const result = await throwingList.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_CATALOG_ERROR'); assert.equal(result.error.causeCode, 'PROVIDER_LOAD_FAILED') }],
    ['PROVIDER-THROW-002', async () => { const result = await throwingDetail.build({ identity: firstIdentity, source: 'direct', sourceContextRef: null, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_CATALOG_ERROR'); assert.equal(result.error.causeCode, 'PROVIDER_LOAD_FAILED') }],
    ['PROVIDER-THROW-003', async () => { const result = await throwingDetail.buildCurrentRevision({ originalIdentity: firstIdentity, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_CATALOG_ERROR'); assert.equal(result.error.causeCode, 'PROVIDER_LOAD_FAILED') }],
  ]
  for (const [id, callback] of providerThrowCases) await runCase(id, 'provider-error-normalization', callback)

  // Historical matrix: only a published pinned revision can participate in
  // List; suspended/archived revisions remain Detail-only and read-only.
  const historicalPublished = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS[0]
  const historicalSuspended = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS[1]
  const historicalArchived = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS[2]
  const historyMatrixServices = (record, token) => {
    const registry = makeRegistry(context, token)
    const sourceInput = makeContextInput([record], [{ record, group: 'cards', order: 0, tier: 'EXACT' }])
    const sourceRef = registry.register(sourceInput).value
    const services = createServices({ resolver, context, application }, {
      registry,
      historicalResolver: makeHistoricalResolver(record),
    })
    return { services, sourceRef }
  }
  const historyMatrixResolver = {
    resolveExactRevision: async (identity) => {
      const institutionRecords = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS.filter(
        (record) => record.institutionId === identity.institutionId,
      )
      if (institutionRecords.length === 0) {
        return { ok: false, error: { code: 'INSTITUTION_NOT_FOUND' } }
      }
      const matches = INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS.filter((record) => equalIdentity(identity, identityOf(record)))
      return matches.length === 1
        ? { ok: true, value: cloneInstitutionListDetailRecord(matches[0]) }
        : { ok: false, error: { code: 'INSTITUTION_REVISION_NOT_FOUND' } }
    },
  }
  const historyMatrixCases = [
    ['HISTORY-MATRIX-001', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(historicalPublished), identityOf(historicalPublished)); assert.equal(result.ok, true); assert.equal(result.value.recordStatus, 'published') }],
    ['HISTORY-MATRIX-002', async () => { const { services, sourceRef } = historyMatrixServices(historicalPublished, 'ctx-history-published-detail'); const result = await services.detail.build({ identity: identityOf(historicalPublished), source: 'recommendation', sourceContextRef: sourceRef, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'RECOMMENDATION_PINNED') }],
    ['HISTORY-MATRIX-003', async () => {
      const { services, sourceRef } = historyMatrixServices(
        historicalPublished,
        'ctx-history-published-list',
      )
      const result = await services.list.build({
        evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
        sourceContextRef: sourceRef,
      })
      assert.equal(result.ok, true)
      assert.equal(result.value.recommendedCandidates[0].recordRevision, historicalPublished.recordRevision)
      const currentRevision = result.value.otherCurrentPartners.find((item) =>
        item.institutionId === historicalPublished.institutionId)
      assert.notEqual(currentRevision, undefined)
      assert.notEqual(currentRevision.recordRevision, historicalPublished.recordRevision)
      assert.equal(
        result.value.displayInstitutions.filter((item) =>
          item.institutionId === historicalPublished.institutionId).length,
        2,
      )
    }],
    ['HISTORY-MATRIX-004', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(historicalSuspended), identityOf(historicalSuspended)); assert.equal(result.ok, true); assert.equal(result.value.recordStatus, 'suspended') }],
    ['HISTORY-MATRIX-005', async () => { const { services, sourceRef } = historyMatrixServices(historicalSuspended, 'ctx-history-suspended-detail'); const result = await services.detail.build({ identity: identityOf(historicalSuspended), source: 'recommendation', sourceContextRef: sourceRef, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'HISTORICAL_READ_ONLY'); assert.equal(result.value.actions.canCreateAppointment, false) }],
    ['HISTORY-MATRIX-006', async () => { const { services, sourceRef } = historyMatrixServices(historicalSuspended, 'ctx-history-suspended-list'); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: sourceRef }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['HISTORY-MATRIX-007', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(historicalArchived), identityOf(historicalArchived)); assert.equal(result.ok, true); assert.equal(result.value.recordStatus, 'archived') }],
    ['HISTORY-MATRIX-008', async () => { const { services, sourceRef } = historyMatrixServices(historicalArchived, 'ctx-history-archived-detail'); const result = await services.detail.build({ identity: identityOf(historicalArchived), source: 'recommendation', sourceContextRef: sourceRef, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); assert.equal(result.ok, true); assert.equal(result.value.contextKind, 'HISTORICAL_READ_ONLY'); assert.equal(result.value.actions.canOpenVr, false) }],
    ['HISTORY-MATRIX-009', async () => { const { services, sourceRef } = historyMatrixServices(historicalArchived, 'ctx-history-archived-list'); const result = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, sourceContextRef: sourceRef }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['HISTORY-MATRIX-010', async () => { const missingRevision = { ...identityOf(historicalPublished), recordRevision: 99 }; const result = await resolver.resolveExactHistoricalInstitutionRecord(historyMatrixResolver, missingRevision); expectFailure(result, 'INSTITUTION_REVISION_NOT_FOUND') }],
    ['HISTORY-MATRIX-011', async () => { const missingInstitution = { institutionId: 'institution-v11-missing', recordRevision: 2 }; const result = await resolver.resolveExactHistoricalInstitutionRecord(historyMatrixResolver, missingInstitution); expectFailure(result, 'INSTITUTION_NOT_FOUND') }],
    ['HISTORY-MATRIX-012', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(historyMatrixResolver, identityOf(historicalPublished)); assert.equal(result.ok, true); assert.equal(result.value.recordRevision, 2) }],
    ['HISTORY-MATRIX-013', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(historyMatrixResolver, identityOf(historicalSuspended)); assert.equal(result.ok, true); assert.equal(result.value.recordRevision, 3) }],
    ['HISTORY-MATRIX-014', async () => { const result = await resolver.resolveExactHistoricalInstitutionRecord(historyMatrixResolver, { institutionId: historicalPublished.institutionId, recordRevision: 5 }); expectFailure(result, 'INSTITUTION_REVISION_NOT_FOUND') }],
  ]
  for (const [id, callback] of historyMatrixCases) await runCase(id, 'historical-matrix', callback)

  const drift = application.detectInstitutionRevisionDrift
  const driftCases = [
    ['DRIFT-001', () => assert.equal(drift(firstIdentity, firstIdentity), 'no_drift')],
    ['DRIFT-002', () => assert.equal(drift(firstIdentity, { ...firstIdentity, recordRevision: 2 }), 'different_current_revision_available')],
    ['DRIFT-003', () => assert.equal(drift(firstIdentity, null), 'current_revision_unknown')],
    ['DRIFT-004', () => assert.equal(drift({ institutionId: 'bad id', recordRevision: 1 }, firstIdentity), 'current_revision_unknown')],
    ['DRIFT-005', () => assert.equal(drift(firstIdentity, { institutionId: 'bad id', recordRevision: 1 }), 'current_revision_unknown')],
    ['DRIFT-006', () => assert.equal(drift(firstIdentity, secondIdentity), 'current_revision_unknown')],
    ['DRIFT-007', () => assert.equal(drift({ ...firstIdentity, recordRevision: 1 }, { ...firstIdentity, recordRevision: 3 }), 'different_current_revision_available')],
    ['DRIFT-008', () => assert.equal(drift({ ...firstIdentity }, { ...firstIdentity }), 'no_drift')],
    ['DRIFT-009', () => assert.equal(drift(firstIdentity, { institutionId: first.institutionId, recordRevision: 99 }), 'different_current_revision_available')],
    ['DRIFT-010', () => assert.equal(drift({ institutionId: second.institutionId, recordRevision: 1 }, firstIdentity), 'current_revision_unknown')],
    ['DRIFT-011', () => assert.equal(drift(firstIdentity, { institutionId: first.institutionId, recordRevision: 2 }), 'different_current_revision_available')],
    ['DRIFT-012', () => assert.equal(drift(firstIdentity, null), 'current_revision_unknown')],
  ]
  for (const [id, callback] of driftCases) await runCase(id, 'revision-drift', callback)

  const permutationCases = []
  const baseOrder = snapshotIdentities(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.map(identityOf))
  for (let index = 0; index < 12; index += 1) {
    permutationCases.push([`PERM-${String(index + 1).padStart(3, '0')}`, async () => {
      const records = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS)
      if (index % 2 === 0) records.reverse()
      else records.push(...records.splice(0, (index * 3) % records.length))
      const ordered = application.orderCurrentInstitutionRecordsForList(records)
      assert.equal(ordered.ok, true)
      assert.deepEqual(snapshotIdentities(ordered.value.records), baseOrder)
      const services = createServices({ resolver, context, application }, { currentRecords: records })
      const list = await services.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF })
      assert.equal(list.ok, true)
      assert.deepEqual(snapshotIdentities(list.value.displayInstitutions), baseOrder)
    }])
  }
  const curatedPermutationCases = [
    ['PERM-CURATED-001', async () => { const records = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS).reverse(); const result = application.orderCurrentInstitutionRecordsForList(records, { entries: metadataEntries }); assert.equal(result.ok, true); assert.equal(result.value.kind, 'CURATED_DISPLAY_ORDER_V1') }],
    ['PERM-CURATED-002', async () => { const records = cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS).slice(2).concat(cloneInstitutionListDetailRecords(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS).slice(0, 2)); const result = application.orderCurrentInstitutionRecordsForList(records, { entries: metadataEntries }); assert.equal(result.ok, true); assert.equal(result.value.records[0].institutionId, INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[7].institutionId) }],
  ]
  for (const [id, callback] of permutationCases.concat(curatedPermutationCases)) await runCase(id, 'permutation', callback)

  const isolationFiles = [
    'institution-detail-route.ts',
    'institution-display-projection-v11.ts',
    'institution-list-detail-application.ts',
    'institution-presentation.ts',
    'institution-recommendation-source.ts',
    'institution-record-resolver.ts',
    'institution-source-context.ts',
  ].map((name) => path.join(servicesRoot, name))
  const isolationCases = [
    ['ISOLATION-001', () => assert.equal(Array.from(loadedSourcePaths).some((filePath) => normalizePath(filePath).includes(`${path.sep}domain${path.sep}recommendation${path.sep}`)), false)],
    ['ISOLATION-002', () => assert.equal(Array.from(loadedSourceTexts.values()).some((source) => /evaluateRecommendation|deriveRecommendation|rankCandidates/.test(source)), false)],
    ['ISOLATION-003', () => assert.equal(Array.from(loadedSourceTexts.values()).some((source) => /from\s+['"][^'"]*(assessment-draft|elder-profile|profile)/.test(source)), false)],
    ['ISOLATION-004', () => assert.equal(isolationFiles.some((filePath) => /evaluate-recommendation|domain[\\/]recommendation/.test(readFileSync(filePath, 'utf8'))), false)],
    // The registry's optional TTL has an injectable wall-clock default.  The
    // deterministic application path itself must rely on explicit inputs.
    ['ISOLATION-005', () => assert.equal(isolationFiles.filter((filePath) => !filePath.endsWith('institution-source-context.ts')).some((filePath) => /Date\.now\(\)|new\s+Date\s*\(/.test(readFileSync(filePath, 'utf8'))), false)],
    ['ISOLATION-006', () => assert.equal(isolationFiles.some((filePath) => /wx\.|localStorage|sessionStorage|setStorage|removeStorage|getStorage/.test(readFileSync(filePath, 'utf8'))), false)],
    ['ISOLATION-007', () => { const appSource = isolationFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n'); assert.equal(/scripts[\\/]fixtures|institution-list-detail-fixtures/.test(appSource), false) }],
    ['ISOLATION-008', () => { const appSource = isolationFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n'); assert.equal(/class\s+[A-Za-z_$][\w$]*\s*\{[^}]*\w+\s*=/.test(appSource), false); assert.equal(appSource.includes('structuredClone'), false) }],
    ['ISOLATION-009', () => { const result = displayProjection.projectInstitutionDisplaySnapshotV11Pure(first, INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF); assert.equal(result.institutionId, first.institutionId); assert.equal(result.recordRevision, first.recordRevision) }],
    ['ISOLATION-010', () => { const snapshot = awaitableRecommendationLikeSnapshot(first); const projected = recommendationSource.projectInstitutionNavigationSourceContextV2(snapshot); assert.equal(projected.ok, true); assert.equal(projected.value.candidates.length, 1) }],
    ['ISOLATION-011', () => { const result = presentation.projectInstitutionListDisplayItemV12(first, INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF); assert.equal(result.recommendationPlacement, null); assert.equal(result.vr.canNavigate, false) }],
    ['ISOLATION-012', () => { const snapshot = awaitableRecommendationLikeSnapshot(first); snapshot.preview.semantics.exactMatch = false; delete snapshot.preview.semantics.noExactMatch; const projected = recommendationSource.projectInstitutionNavigationSourceContextV2(snapshot); expectFailure(projected, 'RECOMMENDATION_SOURCE_CONTEXT_MISMATCH') }],
    ['ISOLATION-013', () => { const snapshot = awaitableRecommendationLikeSnapshot(first); snapshot.preview.semantics.exactMatch = false; snapshot.preview.semantics.noExactMatch = { nearMatches: 'not-an-array' }; const projected = recommendationSource.projectInstitutionNavigationSourceContextV2(snapshot); expectFailure(projected, 'RECOMMENDATION_SOURCE_CONTEXT_MISMATCH') }],
    ['ISOLATION-014', () => { const snapshot = awaitableRecommendationLikeSnapshot(first); snapshot.preview.semantics.exactMatch = true; snapshot.preview.semantics.noExactMatch = { nearMatches: [] }; const projected = recommendationSource.projectInstitutionNavigationSourceContextV2(snapshot); expectFailure(projected, 'RECOMMENDATION_SOURCE_CONTEXT_MISMATCH') }],
  ]
  for (const [id, callback] of isolationCases) await runCase(id, 'recommendation-isolation', callback)

  // Named attack cases keep the fail-closed boundary visible in CI output;
  // each one targets an input shape that previously risked silent fallback.
  const fakeVrRecord = cloneInstitutionListDetailRecord(first)
  const fakeVrField = (value) => ({
    availability: 'provided',
    value,
    asOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
    verification: { status: 'verified', evidenceIds: [] },
  })
  const fakeCoverMediaId = fakeVrRecord.media.length > 0 ? fakeVrRecord.media[0].mediaId : 'media-fake-cover'
  fakeVrRecord.vr = {
    status: 'available',
    url: fakeVrField('https://synthetic.example/vr'),
    coverMediaId: fakeVrField(fakeCoverMediaId),
    scenes: [{
      sceneId: 'scene-fake-lobby',
      sceneCode: 'lobby',
      name: fakeVrField('Synthetic Lobby'),
      url: fakeVrField('https://synthetic.example/vr/lobby'),
      coverMediaId: fakeVrField(fakeCoverMediaId),
    }],
    verification: { status: 'verified', evidenceIds: [] },
  }
  const unknownSchemaRecord = cloneInstitutionListDetailRecord(first)
  unknownSchemaRecord.unexpectedFutureField = 'must-not-be-accepted'
  const attackCases = [
    ['ATTACK-001', () => expectFailure(route.parseInstitutionDetailRoute({ id: first.institutionId, recordRevision: '1', source: 'direct' }), 'ROUTE_IDENTITY_MISSING')],
    ['ATTACK-002', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: [first.institutionId], recordRevision: '1', source: 'direct' }), 'ROUTE_INSTITUTION_ID_INVALID')],
    ['ATTACK-003', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: '%E0%A4%A', recordRevision: '1', source: 'direct' }), 'ROUTE_INSTITUTION_ID_INVALID')],
    ['ATTACK-004', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'recommendation' }), 'ROUTE_CONTEXT_REF_INVALID')],
    ['ATTACK-005', () => expectFailure(route.parseInstitutionDetailRoute({ institutionId: first.institutionId, recordRevision: '1', source: 'direct', sourceContextRef: 'ctx' }), 'ROUTE_CONTEXT_REF_INVALID')],
    ['ATTACK-006', async () => expectFailure(await currentResolver.resolveExactCurrentRevision({ ...firstIdentity, recordRevision: 2 }), 'INSTITUTION_REVISION_NOT_FOUND')],
    ['ATTACK-007', async () => { const services = createServices({ resolver, context, application }); const result = await services.detail.build({ identity: firstIdentity, source: 'recommendation', sourceContextRef: 'lost', evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['ATTACK-008', async () => { const reg = makeRegistry(context, 'attack-008'); const token = reg.register(baseContext).value; const services = createServices({ resolver, context, application }, { registry: reg }); const result = await services.detail.build({ identity: secondIdentity, source: 'recommendation', sourceContextRef: token, evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF }); expectFailure(result, 'INSTITUTION_SOURCE_CONTEXT_ERROR') }],
    ['ATTACK-009', () => { const input = makeContextInput(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS, [{ record: first, group: 'cards', order: 0, tier: 'EXACT' }, { record: first, group: 'cards', order: 1, tier: 'SOFT_NEAR' }]); expectFailure(makeRegistry(context, 'attack-009').register(input), 'SOURCE_CONTEXT_CANDIDATE_DUPLICATE') }],
    ['ATTACK-010', () => { const input = makeContextInput(); input.manifest.push({ ...input.manifest[0], identity: { ...input.manifest[0].identity } }); expectFailure(makeRegistry(context, 'attack-010').register(input), 'SOURCE_CONTEXT_MANIFEST_MISMATCH') }],
    ['ATTACK-011', async () => expectFailure(await resolver.notConfiguredHistoricalRevisionResolver.resolveExactRevision(historicalIdentity), 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED')],
    ['ATTACK-012', async () => expectFailure(await resolver.resolveExactHistoricalInstitutionRecord(makeHistoricalResolver(), { institutionId: 'bad id', recordRevision: 2 }), 'IDENTITY_INVALID')],
    ['ATTACK-013', async () => { const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: metadataEntries.slice(1) } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['ATTACK-014', async () => { const duplicateOrders = metadataEntries.map((entry) => ({ ...entry })); duplicateOrders[1].displayOrder = duplicateOrders[0].displayOrder; const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: duplicateOrders } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['ATTACK-015', async () => { const unknown = metadataEntries.map((entry) => ({ ...entry })); unknown[0].identity = { institutionId: 'institution-unknown', recordRevision: 1 }; const result = await directServices.list.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF, presentationMetadata: { entries: unknown } }); expectFailure(result, 'INSTITUTION_LIST_PROJECTION_ERROR') }],
    ['ATTACK-016', () => { assert.equal(fakeVrRecord.vr.status, 'available'); assert.equal(fakeVrRecord.vr.url.value.startsWith('https://'), true); assert.equal(fakeVrRecord.vr.scenes.length > 0, true); const listItem = presentation.projectInstitutionListDisplayItemV12(fakeVrRecord, INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF); assert.equal(listItem.vr.state, 'unknown'); assert.equal(listItem.vr.canNavigate, false) }],
    ['ATTACK-017', async () => { const result = await resolver.createInstitutionCurrentCatalogResolver(makeCurrentService([unknownSchemaRecord])).loadCurrentCatalog(); expectFailure(result, 'INVALID_INSTITUTION_RECORD') }],
  ]
  for (const [id, callback] of attackCases) await runCase(id, 'attack-cases', callback)

  const minimums = {
    'identity-route': 15,
    'current-resolver': 10,
    'historical-resolver': 10,
    'source-context-registry': 15,
    'context-loss': 10,
    'list-application': 20,
    'detail-application': 25,
    'revision-drift': 10,
    permutation: 10,
    'recommendation-isolation': 8,
    'version-boundary': 3,
  }
  Object.entries(minimums).forEach(([category, minimum]) => {
    assert.ok((categoryCounts.get(category) || 0) >= minimum, `${category} cases below required minimum`)
  })
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure))
    throw new Error(`${failures.length} Institution List/Detail runtime case(s) failed`)
  }
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserInfo.source}: ${parserInfo.parserPath})`)
  console.log(`FIXTURE_POLICY: ${INSTITUTION_LIST_DETAIL_FIXTURE_POLICY}`)
  console.log(`DATA_PROVENANCE: ${INSTITUTION_LIST_DETAIL_DATA_PROVENANCE}`)
  console.log(`DATA_LABEL: ${INSTITUTION_LIST_DETAIL_DATA_LABEL}`)
  console.log(`SYNTHETIC_VERIFICATION: ${INSTITUTION_LIST_DETAIL_SYNTHETIC_VERIFICATION}`)
  console.log(`CURRENT_RECORDS: ${INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.length}`)
  console.log(`HISTORICAL_FIXTURES: ${INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS.length} (${INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS.map((record) => `${record.institutionId}#${record.recordRevision}:${record.recordStatus}`).join(', ')})`)
  console.log(`LOADED_NEW_TS_MODULES: ${loadedSourcePaths.size}`)
  console.log(`TOTAL_CASES: ${cases.length}/${cases.length} PASS`)
  Object.entries(minimums).forEach(([category, minimum]) => console.log(`${category.toUpperCase().replaceAll('-', '_')}: ${categoryCounts.get(category)}/${minimum}+ PASS`))
  console.log('CURRENT_HISTORY_SEPARATION: PASS')
  console.log('INSTITUTION_LIST_DETAIL_RUNTIME = PASS')
}

const awaitableRecommendationLikeSnapshot = (record) => ({
  kind: 'recommendation_result_application_snapshot_v2',
  preview: {
    semantics: {
      versions: {
        recommendationContractVersion: 'recommendation-contract-v2',
        recommendationRulesetVersion: 'recommendation-ruleset-v2',
        policyVersion: 'conservative-exact-with-conditional-v1',
        institutionContractVersion: 'institution-contract-v1.1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
      },
      datasetVersion: INSTITUTION_LIST_DETAIL_DATASET_VERSION,
      datasetMode: 'MOCK_DEVELOPMENT_ONLY',
      evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
      exactMatch: true,
      poolManifest: {
        datasetVersion: INSTITUTION_LIST_DETAIL_DATASET_VERSION,
        datasetMode: 'MOCK_DEVELOPMENT_ONLY',
        evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
        institutionContractVersion: 'institution-contract-v1.1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
        entries: [{ institutionId: record.institutionId, recordRevision: record.recordRevision, recordProvenance: record.recordProvenance, recordStatus: record.recordStatus, disposition: 'included' }],
      },
      cards: [{ institutionId: record.institutionId, recordRevision: record.recordRevision, matchTier: 'EXACT', reasons: [{ reasonCode: 'CARE_COMPATIBILITY', reasonType: 'TEST' }], differences: [] }],
      conditionalCandidates: [],
    },
  },
  sourceContext: {
    datasetVersion: INSTITUTION_LIST_DETAIL_DATASET_VERSION,
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
    institutionContractVersion: 'institution-contract-v1.1',
    institutionCapabilityContractVersion: 'institution-capability-contract-v1',
  },
})

main().catch((error) => {
  console.error('INSTITUTION_LIST_DETAIL_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
