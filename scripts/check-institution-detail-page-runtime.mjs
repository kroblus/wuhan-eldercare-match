/**
 * Phase V1.2-A0-3 Institution Detail page runtime gate.
 *
 * Test-only cases use the A0-2 application boundary and synthetic records.
 * The page source is audited separately so a passing ViewModel cannot hide a
 * legacy route, raw-record import, or a future business section leaking into
 * the live page.
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
  makeHistoricalFixture,
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

const buildApplication = async (runtime, records = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS) => {
  const resolver = runtime.load(path.join(appRoot, 'services', 'institution-record-resolver.ts'))
  const context = runtime.load(path.join(appRoot, 'services', 'institution-source-context.ts'))
  const application = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-application.ts'))
  const currentResolver = resolver.createInstitutionCurrentCatalogResolver({
    loadCatalog: async () => ({ ok: true, value: makeCurrentCatalogPayload(records) }),
  })
  const registry = context.createInstitutionSourceContextRegistry({ tokenFactory: () => 'detail-ui-test-context' })
  const service = application.createInstitutionDetailApplicationServiceV12({
    currentCatalogResolver: currentResolver,
    historicalRevisionResolver: resolver.createNotConfiguredHistoricalRevisionResolver(),
    sourceContextRegistry: registry,
  })
  const first = records[0]
  const route = {
    identity: { institutionId: first.institutionId, recordRevision: first.recordRevision },
    source: 'direct',
    sourceContextRef: null,
  }
  const result = await service.build({
    ...route,
    evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
  })
  assert.equal(result.ok, true)
  return { result: result.value, service, registry, resolver, context, application, route }
}

const failures = []
const executed = []
const run = async (id, description, callback) => {
  assert.match(id, /^DETAIL-UI-\d{3}$/)
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

const rowsText = (view) => JSON.stringify([
  view.basicRows, view.staffingRows, view.medicalRows, view.mealRows,
  view.activityRows, view.transportRows, view.hospitalRows, view.priceRows,
  view.qualificationRows,
])

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createRuntime(ts)
  const routeModule = runtime.load(path.join(appRoot, 'services', 'institution-detail-route.ts'))
  const vmModule = runtime.load(path.join(pageRoot, 'detail-view-model.ts'))
  const recommendationDisplay = runtime.load(path.join(appRoot, 'pages', 'recommendation', 'recommendation-display-semantics.ts'))
  const livePageApplication = runtime.load(path.join(appRoot, 'services', 'institution-list-detail-page.ts'))
  const { result: direct, service, registry } = await buildApplication(runtime)
  const view = vmModule.createInstitutionDetailPageViewModel(direct)
  const pageSource = readFileSync(path.join(pageRoot, 'detail.ts'), 'utf8')
  const wxml = readFileSync(path.join(pageRoot, 'detail.wxml'), 'utf8')
  const less = readFileSync(path.join(pageRoot, 'detail.less'), 'utf8')
  const json = JSON.parse(readFileSync(path.join(pageRoot, 'detail.json'), 'utf8'))
  const first = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0]
  const identity = { institutionId: first.institutionId, recordRevision: first.recordRevision }

  await run('DETAIL-UI-001', 'canonical route parses institutionId and revision', () => {
    const parsed = routeModule.parseInstitutionDetailRouteQuery({
      institutionId: identity.institutionId,
      recordRevision: String(identity.recordRevision),
      source: 'direct_link',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.identity.institutionId, identity.institutionId)
    assert.equal(parsed.value.identity.recordRevision, identity.recordRevision)
  })
  await run('DETAIL-UI-002', 'missing identity becomes route error', () => {
    const parsed = routeModule.parseInstitutionDetailRouteQuery({ source: 'direct' })
    assert.equal(parsed.ok, false)
    assert.equal(parsed.error.code, 'ROUTE_IDENTITY_MISSING')
    assert.equal(vmModule.createInstitutionDetailErrorViewModel('route_error').pageState, 'route_error')
  })
  await run('DETAIL-UI-003', 'legacy id-only route is rejected', () => {
    const parsed = routeModule.parseInstitutionDetailRouteQuery({ id: identity.institutionId, source: 'direct' })
    assert.equal(parsed.ok, false)
    assert.equal(parsed.error.code, 'ROUTE_IDENTITY_MISSING')
  })
  await run('DETAIL-UI-004', 'direct route does not require recommendation context', () => {
    const parsed = routeModule.parseInstitutionDetailRouteQuery({
      institutionId: identity.institutionId,
      recordRevision: String(identity.recordRevision),
      source: 'direct',
    })
    assert.equal(parsed.ok, true)
    assert.equal(direct.source, 'direct')
    assert.equal(direct.recommendationContext, null)
  })
  await run('DETAIL-UI-005', 'direct application snapshot is ready', () => {
    assert.equal(direct.contextKind, 'DIRECT_CURRENT')
    assert.equal(view.pageState, 'ready')
    assert.equal(view.title, String(direct.sections.basic.name.value))
  })
  await run('DETAIL-UI-006', 'basic identity rows use display projection', () => {
    assert.equal(view.basicRows.map((row) => row.label).join('|'), '机构名称|所在区域|地址|机构类型')
    assert.equal(view.basicRows.some((row) => row.key.includes('institutionId')), false)
  })
  await run('DETAIL-UI-007', 'all legal V1.1 section arrays are represented', () => {
    assert.ok(view.basicRows.length > 0)
    assert.ok(Array.isArray(view.capabilityGroups))
    assert.ok(Array.isArray(view.staffingRows))
    assert.ok(Array.isArray(view.medicalRows))
    assert.ok(Array.isArray(view.rooms))
    assert.ok(Array.isArray(view.mealRows))
    assert.ok(Array.isArray(view.activityRows))
    assert.ok(Array.isArray(view.transportRows))
    assert.ok(Array.isArray(view.hospitalRows))
    assert.ok(Array.isArray(view.priceRows))
    assert.ok(Array.isArray(view.qualificationRows))
  })
  await run('DETAIL-UI-008', 'development disclosure remains visible', () => {
    assert.equal(direct.dataDisclosure.kind, 'MOCK_DEVELOPMENT_ONLY')
    assert.equal(view.hasDisclosure, true)
    assert.match(view.disclosure, /开发|Mock|示例/)
  })
  await run('DETAIL-UI-009', 'historical snapshots are labelled read-only', () => {
    const historical = clone(direct)
    historical.contextKind = 'HISTORICAL_READ_ONLY'
    historical.recordStatus = 'archived'
    historical.revisionContext = {
      kind: 'PINNED_RECOMMENDATION_REVISION',
      state: 'historical_inactive',
      originalIdentity: { ...identity, recordRevision: 2 },
      currentIdentity: identity,
    }
    historical.sections.media.vr.state = 'available'
    historical.sections.media.vr.canNavigate = true
    historical.actions.canOpenVr = true
    const historicalView = vmModule.createInstitutionDetailPageViewModel(historical)
    assert.equal(historicalView.contextLabel, '历史机构资料')
    assert.equal(historicalView.historyLabel, '只读资料')
    assert.match(historicalView.description, /仅供查看/)
    assert.equal(historicalView.media.canOpenVr, false)
  })
  await run('DETAIL-UI-010', 'historical records expose no appointment or edit action', () => {
    const historical = clone(direct)
    historical.contextKind = 'HISTORICAL_READ_ONLY'
    historical.actions.canCreateAppointment = false
    historical.actions.canContactConsultant = false
    const serialized = JSON.stringify(historical.actions)
    assert.equal(serialized.includes('canCreateAppointment'), true)
    assert.equal(historical.actions.canCreateAppointment, false)
    assert.equal(historical.actions.canContactConsultant, false)
  })
  await run('DETAIL-UI-011', 'revision drift is disclosed with current switch affordance', () => {
    const drift = clone(direct)
    drift.contextKind = 'RECOMMENDATION_PINNED'
    drift.revisionContext.state = 'different_current_revision_available'
    drift.revisionContext.currentIdentity = { ...identity, recordRevision: 2 }
    drift.actions.canViewCurrentRevision = true
    const driftView = vmModule.createInstitutionDetailPageViewModel(drift)
    assert.equal(driftView.canViewCurrentRevision, true)
    assert.match(driftView.revisionNotice, /更新/)
    assert.match(driftView.currentRevisionLabel, /当前/)
  })
  await run('DETAIL-UI-012', 'current-revision view clears pinned recommendation semantics', async () => {
    const switched = await service.buildCurrentRevision({
      originalIdentity: identity,
      evaluationAsOf: INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF,
    })
    assert.equal(switched.ok, true)
    assert.equal(switched.value.contextKind, 'CURRENT_INSTITUTION_CONTEXT')
    assert.equal(switched.value.recommendationContext, null)
    assert.equal(vmModule.createInstitutionDetailPageViewModel(switched.value).recommendation, null)
  })
  await run('DETAIL-UI-013', 'pinned recommendation shows only snapshot reason codes', () => {
    const pinned = clone(direct)
    pinned.contextKind = 'RECOMMENDATION_PINNED'
    pinned.source = 'recommendation'
    pinned.recommendationContext = {
      // A displayed card can still be SOFT_NEAR.  Tier wording must use the
      // frozen tier, not infer it from the placement group.
      group: 'cards', order: 0, tier: 'SOFT_NEAR',
      reasons: [
        { code: 'MEAL_SCHEDULE_MATCH', reference: 'meal_schedule' },
        { code: 'PRIORITY_NOT_SCORABLE', reference: 'priority' },
      ],
      differences: [
        { code: 'MODIFIED_FOOD_SUPPORT_UNKNOWN', reference: 'nutrition' },
        { code: 'PRIORITY_NOT_SCORABLE', reference: 'priority' },
      ],
    }
    const pinnedView = vmModule.createInstitutionDetailPageViewModel(pinned)
    assert.equal(
      pinnedView.recommendation.tierLabel,
      recommendationDisplay.recommendationTierLabelV2('SOFT_NEAR'),
    )
    assert.equal(pinnedView.recommendation.reasons.length, 1)
    assert.equal(pinnedView.recommendation.differences.length, 1)
    assert.equal(
      pinnedView.recommendation.reasons[0].value,
      recommendationDisplay.recommendationReasonLabelV2('MEAL_SCHEDULE_MATCH'),
    )
    assert.equal(
      pinnedView.recommendation.differences[0].value,
      recommendationDisplay.recommendationDifferenceLabelV2('MODIFIED_FOOD_SUPPORT_UNKNOWN'),
    )
    assert.equal(pinnedView.recommendation.reasons[0].status, '来自本次推荐上下文')
    assert.equal(pinnedView.recommendation.reasons[0].statusTone, 'neutral')
  })
  await run('DETAIL-UI-014', 'direct detail hides recommendation section', () => {
    assert.equal(view.recommendation, null)
    assert.equal(direct.recommendationContext, null)
  })
  await run('DETAIL-UI-015', 'source-context error has retryable, visible copy', () => {
    const error = vmModule.createInstitutionDetailErrorViewModel('source_context_error')
    assert.equal(error.pageState, 'source_context_error')
    assert.equal(error.canRetry, true)
    assert.match(error.message, /推荐(上下文|说明)/)
  })
  await run('DETAIL-UI-016', 'route error has no unsafe retry fallback', () => {
    const error = vmModule.createInstitutionDetailErrorViewModel('route_error')
    assert.equal(error.canRetry, false)
    assert.match(error.message, /合法的机构版本/)
  })
  await run('DETAIL-UI-017', 'revision-not-found remains distinct', () => {
    const error = vmModule.createInstitutionDetailErrorViewModel('revision_not_found')
    assert.equal(error.pageState, 'revision_not_found')
    assert.match(error.title, /版本/)
    assert.equal(error.canRetry, true)
  })
  await run('DETAIL-UI-018', 'verification axes show unknown/unverified separately', () => {
    const unknown = clone(direct)
    unknown.sections.basic.address.effectiveVerification = 'unverified'
    unknown.sections.basic.address.availability = 'unknown'
    const unknownView = vmModule.createInstitutionDetailPageViewModel(unknown)
    const row = unknownView.basicRows.find((item) => item.label === '地址')
    assert.equal(row.value, '暂不明确')
    assert.equal(row.status, '暂不明确')
    const unverified = clone(direct)
    unverified.sections.basic.name.effectiveVerification = 'unverified'
    const unverifiedView = vmModule.createInstitutionDetailPageViewModel(unverified)
    assert.equal(unverifiedView.basicRows[0].status, '资料待核验')
  })
  await run('DETAIL-UI-019', 'expired verification remains a warning', () => {
    const expired = clone(direct)
    expired.sections.basic.name.effectiveVerification = 'expired'
    const expiredView = vmModule.createInstitutionDetailPageViewModel(expired)
    assert.equal(expiredView.basicRows[0].status, '核验已过期')
    assert.equal(expiredView.basicRows[0].statusTone, 'warning')
  })
  await run('DETAIL-UI-020', 'capability status and verification are separate fields', () => {
    const items = view.capabilityGroups.flatMap((group) => group.items)
    assert.ok(items.length > 0)
    assert.ok(items.every((item) => typeof item.status === 'string' && typeof item.verification === 'string'))
    const statuses = new Set(items.map((item) => item.status))
    assert.ok([...statuses].every((item) => ['可提供', '需进一步确认', '当前不可用', '暂不明确'].includes(item)))
  })
  await run('DETAIL-UI-021', 'bounded price keeps both bounds', () => {
    const row = view.priceRows.find((item) => item.value.includes('–'))
    assert.ok(row, 'bounded price row is required')
    assert.match(row.value, /^¥\d+–¥\d+ \/ 月$/)
  })
  await run('DETAIL-UI-022', 'starting price does not invent an upper bound', () => {
    const changed = clone(direct)
    const price = changed.sections.price.referenceMonthlyPrice
    price.value = {
      kind: 'starting_at', minAmountMinor: 450000, maxAmountMinor: null,
      currency: 'CNY', period: 'month', basis: 'reference_total',
    }
    const changedView = vmModule.createInstitutionDetailPageViewModel(changed)
    assert.ok(changedView.priceRows.some((row) => row.value.includes(' 起 / 月')))
    assert.equal(changedView.priceRows.some((row) => row.value.includes('¥0')), false)
  })
  await run('DETAIL-UI-023', 'unknown price is not zero or a promise', () => {
    const changed = clone(direct)
    changed.sections.price.referenceMonthlyPrice = {
      availability: 'unknown', value: null, effectiveVerification: 'unverified',
    }
    const changedView = vmModule.createInstitutionDetailPageViewModel(changed)
    const serialized = JSON.stringify(changedView.priceRows)
    assert.equal(serialized.includes('¥0'), false)
    assert.equal(serialized.includes('最终'), false)
  })
  await run('DETAIL-UI-024', 'empty rooms are non-negative and explicit', () => {
    const changed = clone(direct)
    changed.sections.rooms = []
    const changedView = vmModule.createInstitutionDetailPageViewModel(changed)
    assert.deepEqual(changedView.rooms, [])
    assert.equal(JSON.stringify(changedView).includes('无床位'), false)
  })
  await run('DETAIL-UI-025', 'modified food remains a meal fact, never tube feeding', () => {
    const changed = clone(direct)
    changed.sections.meals.modifiedFoodSupport = {
      availability: 'provided', effectiveVerification: 'current_verified', value: 'modified_food',
    }
    const changedView = vmModule.createInstitutionDetailPageViewModel(changed)
    const mealText = JSON.stringify(changedView.mealRows)
    assert.equal(mealText.includes('鼻饲'), false)
    assert.equal(mealText.includes('特殊处理饮食支持'), true)
  })
  await run('DETAIL-UI-026', 'VR unknown is display-only and non-navigable', () => {
    assert.equal(view.media.vrState, 'unknown')
    assert.match(view.media.vrLabel, /待确认/)
    assert.equal(direct.sections.media.vr.canNavigate, false)
  })
  await run('DETAIL-UI-027', 'current V1.1 CareProcess stays hidden while Consultant stays hidden from body', () => {
    assert.equal(view.media.vrState, 'unknown')
    assert.equal(rowsText(view).includes('功能开发中'), false)
    assert.equal(direct.sections.careProcess.state, 'not_applicable_for_schema')
    assert.equal(view.careProcess, null)
    assert.equal(wxml.includes('护理管理与交接'), true)
    assert.match(wxml, /section\.key === 'team'/)
    assert.match(wxml, /expandedSections\[section\.key\]/)
    assert.equal(wxml.includes('consultantVisit'), false)
  })
  await run('DETAIL-UI-028', 'public rating is not rendered', () => {
    assert.equal(/rating|评分|评价数|星级/i.test(JSON.stringify(view)), false)
    assert.equal(/rating|评分|评价数|星级/i.test(wxml), false)
  })
  await run('DETAIL-UI-029', 'page uses canonical route/application and no legacy fallback', () => {
    assert.match(pageSource, /parseInstitutionDetailRouteQuery/)
    assert.match(pageSource, /buildInstitutionDetailPageSnapshot/)
    assert.equal(/\?id=|query\.id|name lookup|latest|fallback|institutionService|institutionCatalog/i.test(pageSource), false)
    assert.equal(/institutionFixtures|fixtures\/institution|rawInstitutionRecord|InstitutionRecordV11/i.test(pageSource), false)
  })
  await run('DETAIL-UI-030', 'page lifecycle has one initial build and declared blocked interactions', () => {
    assert.match(pageSource, /onLoad\s*\(/)
    assert.equal((pageSource.match(/buildInstitutionDetailPageSnapshot\s*\(/g) || []).length, 1)
    const onShowBody = pageSource.match(/onShow\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\},/)?.[1] || ''
    assert.equal(onShowBody.includes('buildInstitutionDetailPageSnapshot'), false)
    assert.match(wxml, /重新加载|返回上一页/)
    assert.match(wxml, /VR/)
    assert.equal(less.length > 0, true)
    assert.equal(json.usingComponents['page-container'], '/components/page-container/page-container')
    assert.equal(INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST.fixturePolicy, 'TEST_FIXTURE_ONLY')
    assert.equal(Object.keys(view).some((key) => /evaluator|raw|mock|latest/i.test(key)), false)
  })
  await run('DETAIL-UI-031', 'appointment CTA component is registered on the detail page', () => {
    assert.match(wxml, /<primary-button\b(?=[^>]*\btext="预约看院 →")(?=[^>]*\bbind:action="onAppointmentTap")[^>]*>/)
    assert.equal(json.usingComponents['primary-button'], '/components/primary-button/primary-button')
  })
  await run('DETAIL-UI-032', 'live page application exact-resolves a canonical development record', async () => {
    const liveList = await livePageApplication.buildInstitutionListPageSnapshot(null)
    assert.equal(liveList.ok, true)
    const liveItem = liveList.value.displayInstitutions[0]
    const liveDetail = await livePageApplication.buildInstitutionDetailPageSnapshot({
      identity: {
        institutionId: liveItem.institutionId,
        recordRevision: liveItem.recordRevision,
      },
      source: 'direct',
      sourceContextRef: null,
    })
    assert.equal(liveDetail.ok, true)
    assert.equal(liveDetail.value.identity.institutionId, liveItem.institutionId)
    assert.equal(liveDetail.value.identity.recordRevision, liveItem.recordRevision)
  })

  assert.deepEqual(executed, Array.from({ length: 32 }, (_, index) => `DETAIL-UI-${String(index + 1).padStart(3, '0')}`))
  if (failures.length > 0) throw new Error(`${failures.length} detail UI case(s) failed\n${failures.join('\n')}`)
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`DETAIL_UI_CASES: ${executed.length}/32 PASS`)
  console.log(`DETAIL_UI_DATASET_VERSION: ${INSTITUTION_LIST_DETAIL_DATASET_VERSION}`)
  console.log('DETAIL_UI_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('INSTITUTION_DETAIL_PAGE_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
