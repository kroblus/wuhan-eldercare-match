/**
 * Phase V1.2-A0-3 Institution List page runtime gate.
 *
 * The cases below exercise the page-facing ViewModel against A0-2 snapshots
 * built from test-only records.  They deliberately do not import the app's
 * mock provider and do not mount wx; the static assertions cover the Page /
 * WXML boundary while the ViewModel cases cover the display contract.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  INSTITUTION_LIST_DETAIL_CURRENT_RECORDS,
  INSTITUTION_LIST_DETAIL_DATASET_VERSION,
  INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
  INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST,
  makeCurrentCatalogPayload,
} from './fixtures/institution-list-detail-fixtures.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const pageRoot = path.join(appRoot, 'pages', 'institution')

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
    for (const profile of readdirSync(profileRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(packageRoot)) continue
      for (const runtime of readdirSync(packageRoot, { withFileTypes: true })) {
        const file = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(file)) {
          const ts = require(file)
          if (ts.version === '4.1.2') candidates.push({ file, mtime: statSync(file).mtimeMs })
        }
      }
    }
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  assert.ok(candidates.length > 0, 'WeChat TypeScript 4.1.2 parser is required')
  return { ts: require(candidates[0].file), file: candidates[0].file }
}

const createRuntime = (typescript) => {
  const cache = new Map()
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} } })
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
    const errors = (output.diagnostics || []).filter((item) => item.category === typescript.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire, module, module.exports,
    )
    return module.exports
  }
  return { load }
}

const createListSnapshot = async (runtime, records = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS) => {
  const resolver = runtime.load(path.join(appRoot, 'services', 'institution-record-resolver.ts'))
  const context = runtime.load(path.join(appRoot, 'services', 'institution-source-context.ts'))
  const application = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-application.ts'))
  const currentResolver = resolver.createInstitutionCurrentCatalogResolver({
    loadCatalog: async () => ({ ok: true, value: makeCurrentCatalogPayload(records) }),
  })
  const registry = context.createInstitutionSourceContextRegistry({ tokenFactory: () => 'list-ui-test-context' })
  const service = application.createInstitutionListApplicationServiceV12({
    currentCatalogResolver: currentResolver,
    historicalRevisionResolver: resolver.createNotConfiguredHistoricalRevisionResolver(),
    sourceContextRegistry: registry,
  })
  const result = await service.build({ evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF })
  assert.equal(result.ok, true)
  return result.value
}

const snapshotItems = (snapshot) => [
  ...(snapshot.recommendedCandidates || []),
  ...(snapshot.otherCurrentPartners || snapshot.displayInstitutions || []),
]

const replaceFirstSnapshotItem = (snapshot, transform) => {
  const recommended = (snapshot.recommendedCandidates || []).slice()
  const other = (snapshot.otherCurrentPartners || snapshot.displayInstitutions || []).slice()
  if (recommended.length > 0) recommended[0] = transform(recommended[0], 0)
  else if (other.length > 0) other[0] = transform(other[0], 0)
  return { ...snapshot, recommendedCandidates: recommended, otherCurrentPartners: other }
}

const failures = []
const executed = []
const run = async (id, description, callback) => {
  assert.match(id, /^LIST-UI-\d{3}$/)
  assert.ok(!executed.includes(id), `duplicate case ${id}`)
  try {
    await callback()
    executed.push(id)
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createRuntime(ts)
  const vmModule = runtime.load(path.join(pageRoot, 'list-view-model.ts'))
  const livePageApplication = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-page.ts'))
  const pageSource = readFileSync(path.join(pageRoot, 'index.ts'), 'utf8')
  const wxml = readFileSync(path.join(pageRoot, 'index.wxml'), 'utf8')
  const json = JSON.parse(readFileSync(path.join(pageRoot, 'index.json'), 'utf8'))
  const snapshot = await createListSnapshot(runtime)
  const view = vmModule.createInstitutionListPageViewModel(snapshot)

  await run('LIST-UI-001', 'loading state is explicit', () => {
    assert.equal(vmModule.createInstitutionListLoadingViewModel().pageState, 'loading')
  })
  await run('LIST-UI-002', 'ready state comes from the application snapshot', () => {
    assert.equal(view.pageState, 'ready')
    assert.equal(view.items.length, 8)
  })
  await run('LIST-UI-003', 'empty copy is the approved product copy', () => {
    const empty = vmModule.createInstitutionListPageViewModel({
      ...snapshot,
      recommendedCandidates: [],
      otherCurrentPartners: [],
      displayInstitutions: [],
    })
    assert.equal(empty.pageState, 'empty')
    assert.equal(empty.emptyTitle, '当前暂无可展示的合作机构资料')
  })
  await run('LIST-UI-004', 'catalog error exposes retry', () => {
    const error = vmModule.createInstitutionListErrorViewModel('catalog_error')
    assert.equal(error.pageState, 'catalog_error')
    assert.equal(error.canRetry, true)
  })
  await run('LIST-UI-005', 'source-context error is distinct', () => {
    const error = vmModule.createInstitutionListErrorViewModel('source_context_error')
    assert.equal(error.pageState, 'source_context_error')
    assert.match(error.errorTitle, /推荐上下文/)
  })
  await run('LIST-UI-006', 'projection error is distinct', () => {
    const error = vmModule.createInstitutionListErrorViewModel('projection_error')
    assert.equal(error.pageState, 'projection_error')
    assert.equal(error.canRetry, true)
  })
  await run('LIST-UI-007', 'the complete eight-record order is preserved', () => {
    assert.equal(view.items.map((item) => item.institutionId).join('|'), snapshotItems(snapshot).map((item) => item.institutionId).join('|'))
  })
  await run('LIST-UI-008', 'canonical item keys contain both identity parts', () => {
    assert.ok(view.items.every((item) => item.key === `${item.institutionId}#${item.recordRevision}`))
  })
  await run('LIST-UI-009', 'future intent uses canonical identity and direct_list source', () => {
    assert.ok(view.items.every((item) => item.navigationIntent.institutionId === item.institutionId
      && item.navigationIntent.recordRevision === item.recordRevision
      && item.navigationIntent.source === 'direct_list'))
  })
  await run('LIST-UI-010', 'development disclosure is snapshot-provided', () => {
    assert.equal(snapshot.dataDisclosure.kind, 'MOCK_DEVELOPMENT_ONLY')
    assert.equal(view.hasDisclosure, true)
    assert.match(view.disclosure, /开发|Mock|示例/)
  })
  await run('LIST-UI-011', 'cards do not expose public rating, count, match, or bed facts', () => {
    assert.equal(view.items.some((item) => Object.keys(item).some((key) => /rating|review|match|percent|bedCount|beds/i.test(key))), false)
  })
  await run('LIST-UI-012', 'bounded prices retain both bounds', () => {
    const card = view.items.find((item) => item.price.includes('–'))
    assert.ok(card, 'a bounded price fixture is required')
    assert.match(card.price, /^¥\d+–¥\d+ \/ 月$/)
  })
  await run('LIST-UI-013', 'starting prices do not invent an upper bound', () => {
    const changed = vmModule.createInstitutionListPageViewModel(replaceFirstSnapshotItem(snapshot, (item) => ({
      ...item,
      referenceMonthlyPrice: {
        availability: 'provided',
        effectiveVerification: 'current_verified',
        value: {
          kind: 'starting_at',
          minAmountMinor: 450000,
          maxAmountMinor: null,
          currency: 'CNY',
          period: 'month',
          basis: 'reference_total',
        },
      },
    })))
    const card = changed.items.find((item) => item.price.includes(' 起 / 月'))
    assert.ok(card, 'a starting-at price projection is required')
    assert.equal(card.price.includes('–'), false)
  })
  await run('LIST-UI-014', 'unknown prices do not become zero', () => {
    const changed = vmModule.createInstitutionListPageViewModel(replaceFirstSnapshotItem(snapshot, (item) => ({
      ...item,
      referenceMonthlyPrice: { availability: 'unknown', value: null, effectiveVerification: 'unverified' },
    })))
    assert.equal(changed.items[0].price, '暂未提供')
    assert.equal(changed.items[0].price.includes('¥0'), false)
  })
  await run('LIST-UI-015', 'unverified and expired status remain visible', () => {
    const source = snapshotItems(snapshot)
    assert.ok(source.length >= 2)
    const recommended = (snapshot.recommendedCandidates || []).slice()
    const other = (snapshot.otherCurrentPartners || snapshot.displayInstitutions || []).slice()
    const mutate = (item, index) => ({
      ...item,
      name: { ...item.name, effectiveVerification: index === 0 ? 'unverified' : 'expired' },
    })
    if (recommended.length >= 2) {
      recommended[0] = mutate(recommended[0], 0)
      recommended[1] = mutate(recommended[1], 1)
    } else {
      other[0] = mutate(other[0], 0)
      other[1] = mutate(other[1], 1)
    }
    const changed = vmModule.createInstitutionListPageViewModel({ ...snapshot, recommendedCandidates: recommended, otherCurrentPartners: other })
    assert.equal(changed.items[0].nameStatus, '资料待核验')
    assert.equal(changed.items[1].nameStatus, '核验已过期')
  })
  await run('LIST-UI-016', 'VR unknown remains unknown and non-navigable data', () => {
    assert.ok(view.items.every((item) => item.vrState === 'unknown'))
    assert.ok(view.items.every((item) => item.vrLabel.includes('待确认')))
  })
  await run('LIST-UI-017', 'VR unavailable and available labels are projected without inventing URLs', () => {
    const all = snapshotItems(snapshot)
    assert.ok(all.length >= 3)
    const recommended = (snapshot.recommendedCandidates || []).slice()
    const other = (snapshot.otherCurrentPartners || snapshot.displayInstitutions || []).slice()
    const target = recommended.length >= 3 ? recommended : other
    for (let index = 0; index < 3; index += 1) {
      target[index] = {
        ...target[index],
        vr: { state: index === 0 ? 'unavailable' : 'available', canNavigate: false, sceneCount: index === 0 ? 0 : 1 },
      }
    }
    const changed = vmModule.createInstitutionListPageViewModel({ ...snapshot, recommendedCandidates: recommended, otherCurrentPartners: other })
    assert.equal(changed.items[0].vrLabel, 'VR资料暂不可用')
    assert.equal(changed.items[1].vrLabel, 'VR看院资料已核验')
    assert.equal(changed.items[1].vrState, 'available')
  })
  await run('LIST-UI-018', 'verified display tags are read-only projection fields', () => {
    assert.ok(view.items.every((item) => item.tags.every((tag) => tag.tone === 'neutral')))
    assert.equal(view.items[0].tags.map((tag) => tag.text).join('|'), snapshotItems(snapshot)[0].verifiedDisplayTags.map((tag) => tag.code || tag.fieldPath).join('|'))
  })
  await run('LIST-UI-019', 'page and WXML retain a single blocked card action', () => {
    assert.match(pageSource, /onCardTap/)
    assert.match(pageSource, /不会打开详情页面/)
    assert.match(wxml, /bindtap="onCardTap"/)
    assert.equal((pageSource.match(/navigateTo|redirectTo|switchTab|reLaunch/g) || []).length, 1)
  })
  await run('LIST-UI-020', 'legacy id/name/array fallback and direct fixture imports are absent', () => {
    assert.equal(/\?id=|data-id=|item\.id|legacy|fixtures\/institution/i.test(pageSource), false)
    assert.equal(/\?id=|data-id=|item\.id|legacy|fixtures\/institution/i.test(wxml), false)
    assert.equal(json.usingComponents['page-container'], '/components/page-container/page-container')
    assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.fixturePolicy, 'TEST_FIXTURE_ONLY')
  })
  await run('LIST-UI-021', 'live page application resolves the canonical development catalog', async () => {
    const live = await livePageApplication.buildInstitutionListPageSnapshot(null)
    assert.equal(live.ok, true)
    assert.equal(live.value.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
    assert.equal(live.value.displayInstitutions.length, 8)
  })

  assert.deepEqual(executed, Array.from({ length: 21 }, (_, index) => `LIST-UI-${String(index + 1).padStart(3, '0')}`))
  if (failures.length > 0) throw new Error(`${failures.length} list UI case(s) failed\n${failures.join('\n')}`)
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`LIST_UI_CASES: ${executed.length}/21 PASS`)
  console.log(`LIST_UI_FIXTURE_RECORDS: ${INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.length}`)
  console.log(`LIST_UI_DATASET_VERSION: ${INSTITUTION_LIST_DETAIL_DATASET_VERSION}`)
  console.log('LIST_UI_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('INSTITUTION_LIST_PAGE_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
