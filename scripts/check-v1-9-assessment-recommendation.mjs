import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeResultV2UiDraft, makeResultV2CatalogFixture, RESULT_V2_EVALUATION_AS_OF } from './fixtures/recommendation-result-v2-ui-fixtures.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0)) }
const { ts } = loadWechatTypeScript()
function harness(base, mode = 'source') {
  let definition, pages = [], failNavigation = false
  const storage = new Map(), navigations = [], effects = []
  const navigate = options => {
    navigations.push(options)
    if (failNavigation) options.fail?.(); else options.success?.()
    options.complete?.()
  }
  const api = { cloud: {}, nextTick: fn => fn(), getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 20, safeArea: { top: 20, bottom: 780 } }), getAccountInfoSync: () => ({ miniProgram: { appId: 'wx69f6bd834cebca33', envVersion: 'develop' } }),
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, clone(value)), removeStorageSync: key => storage.delete(key),
    navigateTo: navigate, redirectTo: navigate, switchTab: navigate, navigateBack: navigate, reLaunch: navigate,
  }
  for (const name of ['request','login','authorize','makePhoneCall','openLocation','uploadFile']) api[name] = () => { effects.push(name); throw Error('Unexpected real API') }
  const runtime = createWechatTsRuntime(ts, { wx: api, Page(value) { definition = value }, Component() {}, App() {}, getCurrentPages: () => pages, setTimeout, clearTimeout })
  const load = file => runtime.load(path.join(base, file + (mode === 'source' ? '.ts' : '.js')))
  const mount = route => {
    load(route)
    const page = { ...definition, route, data: clone(definition.data), setData(patch, callback) { Object.assign(this.data, patch); callback?.() } }
    pages = [page]
    return page
  }
  if (mode === 'demo') { load('app'); load('demo/session').loadDemo() }
  return { load, mount, effects, navigations, setPages: value => { pages = value }, fail: value => { failNavigation = value } }
}

const rt = harness('miniprogram')
const serviceModule = rt.load('services/recommendation-preview-v2')
const catalogModule = rt.load('services/institution-catalog-v1-1')
const canonical = (await catalogModule.institutionCatalogServiceV11.loadCatalog()).value
const makeVm = rt.load('pages/recommendation/result-v2-view-model').createRecommendationResultViewModelV2
const build = (draft = makeResultV2UiDraft(), variant = 'exact', catalog = null) => serviceModule.createRecommendationPreviewServiceV2({
  draftSource: { getDraft: () => clone(draft) },
  institutionCatalog: catalogModule.createInstitutionCatalogServiceV11({ loadCatalog: async () => clone(catalog || makeResultV2CatalogFixture(canonical, variant)) }),
}).buildResultSnapshot(RESULT_V2_EVALUATION_AS_OF)

for (const [name, draft, variant, expected] of [
  ['exact', makeResultV2UiDraft(), 'exact', 'ready_exact'],
  ['near', makeResultV2UiDraft({ 'preference.roomType': 'single' }), 'exact', 'ready_soft_near'],
  ['conditional', makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }), 'conditional', 'ready_conditional'],
  ['readiness', makeResultV2UiDraft({ 'health.chewingAbility': 'unknown' }), 'exact', 'no_safe_recommendation'],
  ['hard-conflict', makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }), 'hard-conflict', 'no_safe_recommendation'],
]) {
  const result = await build(draft, variant)
  assert.equal(result.ok, true, name)
  const vm = makeVm(result.value), semantics = result.value.preview.semantics
  assert.equal(vm.state, expected, name)
  assert.ok(vm.cards.length <= 3)
  assert.equal(vm.cards.length, semantics.cards.length || (semantics.noExactMatch?.nearMatches.length || 0))
  for (const card of [...vm.cards, ...vm.conditionalCards]) {
    assert.ok(semantics.candidateEvaluations.some(candidate => candidate.institutionId === card.institutionId && candidate.recordRevision === card.recordRevision))
    assert.deepEqual(clone([...card.primaryReasons, ...card.additionalReasons]), clone(card.reasons))
    assert.ok(card.primaryReasons.length <= 3)
    assert.ok(card.differences.length >= 0)
    assert.doesNotMatch(JSON.stringify(card), /匹配百分比|综合推荐分数/)
  }
  if (name === 'readiness') assert.equal(vm.emptyReason, 'ELDER_READINESS_BLOCKED')
  if (name === 'conditional') {
    assert.equal(vm.cards.length, 0)
    assert.ok(vm.conditionalCards.length > 0)
    assert.ok(vm.summary.includes('尚不能直接视为满足全部护理需求'))
  }
  assert.deepEqual(clone(result), clone(await build(draft, variant)), 'fixed-time determinism')
  const reversed = makeResultV2CatalogFixture(canonical, variant)
  reversed.records.reverse()
  const reordered = await build(draft, variant, reversed)
  assert.equal(reordered.ok, true)
  assert.deepEqual(clone(reordered.value.preview.semantics.cards), clone(semantics.cards), 'input order cannot change ranked cards')
  console.log(`PASS synthetic ${name}: ${vm.state}; cards=${vm.cards.length}, conditional=${vm.conditionalCards.length}`)
}
for (const records of [[], [{}]]) {
  const failed = await build(makeResultV2UiDraft(), 'exact', { ...canonical, records })
  assert.equal(failed.ok, false)
  assert.equal(failed.error.code, 'INSTITUTION_CATALOG_V11_ERROR')
}

const labelSnapshot = clone((await build()).value)
for (const display of labelSnapshot.institutionDisplays) {
  display.identity.name.effectiveVerification = 'unverified'
  display.identity.regionDisplayName.effectiveVerification = 'unverified'
}
assert.ok(makeVm(labelSnapshot).cards.every(card => card.name.startsWith('演示名称：')))
labelSnapshot.sourceContext.datasetMode = 'PRODUCTION'
assert.ok(makeVm(labelSnapshot).cards.every(card => card.name === '机构名称待核验'), 'demo labels cannot become production facts')
labelSnapshot.sourceContext.datasetMode = 'MOCK_DEVELOPMENT_ONLY'
for (const display of labelSnapshot.institutionDisplays) display.identity.name.effectiveVerification = 'expired'
assert.ok(makeVm(labelSnapshot).cards.every(card => card.name === '机构名称待核验'), 'expired labels stay hidden')

// The source-only CI branch uses synthetic records. Actual production wiring is
// asserted below against the complete build, never emulated as a CI build.
const emptyResult = await build(makeResultV2UiDraft({ 'adl.mobility': 'wheelchair' }), 'hard-conflict')
assert.equal(emptyResult.ok, true)

// Actual Page methods: safe directory fallback has no recommendation context, even on errors.
const page = rt.mount('pages/recommendation/result')
page.data.pageState = 'no_safe_recommendation'
page.data.viewModel = makeVm(emptyResult.value)
page.onBrowseDirectory(); page.onBrowseDirectory()
assert.equal(rt.navigations.length, 1)
assert.equal(rt.navigations[0].url, '/pages/institution/index')
const guard = rt.load('utils/navigation-guard')
guard.resetNavigationGuard(page)
rt.fail(true); page.onBrowseDirectory()
assert.equal(page.data.actionErrorKey, 'directory')
rt.fail(false); page.onBrowseDirectory()
assert.equal(rt.navigations.length, 3)
assert.ok(rt.navigations.every(item => item.url === '/pages/institution/index'))
guard.resetNavigationGuard(page)
page.data.pageState = 'catalog_error'; page.onBrowseDirectory()
assert.equal(rt.navigations.length, 4)
assert.equal(rt.effects.length, 0)

// Unload must invalidate in-flight promises before they can restore a stale result.
const application = rt.load('services/recommendation-result-application')
const originalBuild = application.buildRecommendationResultApplicationSnapshot
let complete
application.buildRecommendationResultApplicationSnapshot = () => new Promise(resolve => { complete = resolve })
page.onShow(); assert.equal(page.data.viewModel, null); page.onUnload()
complete({ ok: true, version: 2, value: emptyResult.value }); await flush()
assert.equal(page.data.viewModel, null)
application.buildRecommendationResultApplicationSnapshot = originalBuild

const markup = fs.readFileSync('miniprogram/pages/recommendation/result.wxml', 'utf8')
assert.match(markup, /公开资料目录，并非根据当前照护需求确认适合的推荐名单/)
assert.match(markup, /wx:for="\{\{item.differences\}\}"/)
assert.match(markup, /bindtap="onBrowseDirectory"/)
assert.doesNotMatch(fs.readFileSync('miniprogram/presentation/recommendation/result-v2-view-model.ts', 'utf8'), /合作机构|开发目录中的结构化资料/)
console.log('PASS source UI: contextless directory, retry, duplicate navigation guard, unload race, complete difference rendering')

if (!process.argv.includes('--source-only')) for (const mode of ['production', 'demo']) {
  const app = harness(`dist/${mode}/miniprogram`, mode)
  const store = app.load('store/assessment-draft').assessmentDraftStore
  const input = makeResultV2UiDraft()
  for (const [id, value] of Object.entries(input.answers)) store.setAnswer(id, value)
  for (const step of ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']) {
    const current = app.mount(`pages/assessment/${step}`)
    current.onLoad?.({}); current.onShow?.()
    const before = app.navigations.length
    current.onNext(); current.onNext(); await flush()
    assert.equal(app.navigations.length, before + 1, `${mode}/${step}: valid Next exactly once; ${current.data.formError || ''}`)
    current.onUnload?.()
  }
  const profile = app.mount('pages/assessment/profile')
  profile.onLoad?.({}); profile.onShow()
  assert.equal(profile.data.pageState, 'ready')
  const before = app.navigations.length
  profile.onOpenRecommendation(); profile.onOpenRecommendation()
  assert.equal(app.navigations.length, before + 1)
  assert.equal(app.navigations[before].url, '/pages/recommendation/result')
  const resultPage = app.mount('pages/recommendation/result')
  resultPage.onShow(); await flush()
  assert.ok(resultPage.data.viewModel)
  if (mode === 'production') {
    assert.equal(resultPage.data.pageState, 'no_safe_recommendation')
    assert.equal(resultPage.data.isDemoBuild, false)
  } else assert.equal(resultPage.data.isDemoBuild, true)
  const previousSnapshot = app.load('services/recommendation-result-application')
  const built = await previousSnapshot.buildRecommendationResultApplicationSnapshot({ evaluationAsOf: '2026-10-23T00:00:00.000Z' })
  assert.equal(built.ok, true)
  assert.equal(built.value.preview.semantics.poolManifest.entries.length, mode === 'production' ? 11 : 12)
  if (mode === 'production') {
    const semantics = built.value.preview.semantics
    assert.ok(semantics.candidateEvaluations.every(candidate => candidate.matchTier === 'UNVERIFIED'))
    assert.equal(semantics.cards.length + semantics.conditionalCandidates.length, 0)
    assert.equal(resultPage.data.viewModel.datasetLabel, '公开机构资料')
    assert.ok(resultPage.data.viewModel.summary.includes('资料'))
    console.log(`PASS production pool=11: ${semantics.noExactMatch.reasonCode}; all UNVERIFIED, no recommendation cards`)
  }
  const candidate = [...resultPage.data.viewModel.cards, ...resultPage.data.viewModel.conditionalCards][0]
  if (mode === 'demo') {
    assert.ok(candidate, 'actual 12-institution demo must exercise candidate detail navigation')
    assert.ok(candidate.name.startsWith('演示名称：'), 'unverified synthetic identity must be labeled, not promoted')
  }
  console.log(`PASS ${mode} actual result: ${resultPage.data.pageState}; cards=${resultPage.data.viewModel.cards.length}, conditional=${resultPage.data.viewModel.conditionalCards.length}`)
  if (candidate) {
    const event = { currentTarget: { dataset: { institutionId: candidate.institutionId, recordRevision: candidate.recordRevision } } }
    const beforeNavigation = app.navigations.length
    resultPage.onCandidateExplanationToggle(event)
    assert.equal(resultPage.data.expandedCards[candidate.institutionId + '#' + candidate.recordRevision], true)
    resultPage.onCandidateExplanationToggle(event)
    assert.equal(resultPage.data.expandedCards[candidate.institutionId + '#' + candidate.recordRevision], false)
    assert.equal(app.navigations.length, beforeNavigation, 'expanding explanations cannot navigate')
    resultPage.onRecommendationCardTap(event); resultPage.onRecommendationCardTap(event)
    assert.equal(app.navigations.length, beforeNavigation + 1)
    const route = app.navigations.at(-1).url
    const query = Object.fromEntries(new URL('https://local' + route).searchParams)
    assert.ok(query.sourceContextRef)
    assert.equal(query.institutionId, candidate.institutionId)
    const detail = app.mount('pages/institution/detail'); detail.onLoad(query); await flush()
    assert.equal(detail.data.pageState, 'ready')
    assert.ok(detail.data.viewModel.recommendation)
    resultPage.onShow(); await flush()
    const stale = app.mount('pages/institution/detail'); stale.onLoad(query); await flush()
    assert.notEqual(stale.data.pageState, 'ready', 'refresh expires old recommendation context')
  }
  resultPage.onShow(); await flush(); resultPage.onBrowseDirectory()
  assert.equal(app.navigations.at(-1).url, '/pages/institution/index')
  const list = await app.load('services/institution-list-detail-page').buildInstitutionListPageSnapshot(null)
  assert.equal(list.ok, true)
  assert.equal(list.value.displayInstitutions.length, mode === 'production' ? 11 : 12)
  const identity = built.value.preview.semantics.poolManifest.entries[0]
  const ordinary = app.mount('pages/institution/detail')
  ordinary.onLoad({ institutionId: identity.institutionId, recordRevision: String(identity.recordRevision), source: 'direct_link' }); await flush()
  assert.equal(ordinary.data.pageState, 'ready')
  assert.equal(ordinary.data.viewModel.recommendation, null, 'ordinary detail cannot inherit another elder explanation')
  store.setAnswer('health.chewingAbility', 'unknown')
  resultPage.onShow(); await flush()
  assert.equal(resultPage.data.viewModel.emptyReason, 'ELDER_READINESS_BLOCKED')
  assert.equal(resultPage.data.viewModel.cards.length + resultPage.data.viewModel.conditionalCards.length, 0)
  store.setAnswer('health.chewingAbility', 'normal')
  resultPage.onShow(); await flush()
  assert.notEqual(resultPage.data.viewModel.emptyReason, 'ELDER_READINESS_BLOCKED')
  assert.equal(app.effects.length, 0)
  console.log(`PASS ${mode}: six steps -> profile -> result; pool/context, ordinary details, edits refresh and no real APIs`)
}
