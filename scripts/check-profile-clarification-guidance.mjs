import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeProfileV2UiDraft } from './fixtures/profile-v2-ui-fixtures.mjs'
import { makeCompletedAssessmentV2 } from './fixtures/elder-profile-v2-fixtures.mjs'

// Synthetic inputs only; never load a user's draft or log answers/profile snapshots.
const { ts } = loadWechatTypeScript()
let definition, pages = [], failNavigation = true
const navigations = []
const navigate = options => { navigations.push(options); if (failNavigation) options.fail?.(); else options.success?.(); options.complete?.() }
const rt = createWechatTsRuntime(ts, { Page(value) { definition = value }, Component() {}, getCurrentPages: () => pages, wx: {
  getStorageSync() {}, getSystemInfoSync: () => ({ safeArea: { top: 20 }, platform: 'android' }),
  navigateTo: navigate, redirectTo: navigate, reLaunch: navigate, navigateBack: navigate,
} })
const load = file => rt.load('miniprogram/' + file + '.ts')
const derive = load('domain/elder-profile/v2/derive-elder-profile-preview-v2').deriveElderProfilePreviewV2
const makeVm = load('pages/assessment/profile-v2-view-model').createProfilePageViewModelV2
const deriveFormal = load('domain/elder-profile/v2/index').deriveElderProfileV2
const { evaluateFormalRecommendationV2, evaluateRecommendationPreviewV2 } = load('domain/recommendation/v2/index')
const clone = value => JSON.parse(JSON.stringify(value))
const direct = ['round_the_clock_care', 'one_to_one_caregiver']
const inspect = overrides => {
  const draft = makeProfileV2UiDraft({ 'cognitive.specialCareNeeds': direct, ...overrides })
  const result = derive(draft); assert.equal(result.ok, true)
  const before = JSON.stringify(result.preview)
  const formal = deriveFormal(makeCompletedAssessmentV2(draft.answers))
  assert.equal(formal.ok, true)
  const { kind: _previewKind, source: _source, profileContractVersion, derivationRulesetVersion, ...previewFacts } = result.preview
  const { kind: _formalKind, identity: _identity, ...formalFacts } = formal.profile
  assert.equal(JSON.stringify(previewFacts), JSON.stringify(formalFacts), 'Formal and Preview keep exactly the same frozen semantics')
  const input = { contractVersion: 'recommendation-contract-v2', rulesetVersion: 'recommendation-ruleset-v2',
    policyVersion: 'conservative-exact-with-conditional-v1', institutions: [], datasetVersion: 'synthetic-recorded-care',
    datasetMode: 'MOCK_DEVELOPMENT_ONLY', evaluationAsOf: '2026-10-28T00:00:00.000Z' }
  const recommendationBefore = evaluateRecommendationPreviewV2({ ...input, profile: result.preview })
  const formalRecommendation = evaluateFormalRecommendationV2({ ...input, profile: formal.profile })
  assert.equal(recommendationBefore.ok, true)
  assert.equal(formalRecommendation.ok, true)
  assert.deepEqual(clone(recommendationBefore.value.semantics), clone(formalRecommendation.value.semantics), 'recommendation and readiness stay identical across Formal/Preview')
  const vm = makeVm(result.preview)
  assert.equal(JSON.stringify(result.preview), before, 'presentation cannot change frozen clarification/readiness facts')
  assert.equal(vm.actions.canOpenRecommendation, true, 'complete answers remain a valid Profile')
  assert.deepEqual(evaluateRecommendationPreviewV2({ ...input, profile: result.preview }), recommendationBefore, 'display cannot unlock or change recommendation')
  assert.deepEqual(derive(draft), result, 'submitting the same answers creates no new errors or clarifications')
  return { draft, preview: result.preview, vm, recommendation: recommendationBefore.value.semantics }
}
const clean = inspect({})
assert.equal(clean.vm.clarifications.length, 0, '24-hour + one-to-one alone must never be treated as incomplete')
assert.equal(clean.vm.specialCareTags.filter(tag => tag.tone === 'brand').length, 2)
assert.equal(inspect({ 'preference.region': undefined }).vm.preferenceRows.find(row => row.label === '区域偏好').value, '未填写区域偏好')
assert.equal(clean.vm.preferenceRows.find(row => row.label === '区域偏好').value, '不限区域', 'explicit no-preference remains distinct from an unanswered optional field')

const cases = [
  ['night_care', '夜间重点照护', { 'cognitive.symptoms': ['sleep_wake_disorder'] }, 'cognitive'],
  ['dementia_unit', '认知症专区', { 'cognitive.symptoms': ['gets_lost'] }, 'cognitive'],
  ['rehabilitation_training', '康复训练', { 'health.rehabilitationNeed': 'possible' }, 'health'],
  ['tube_feeding', '鼻饲护理', { 'adl.eating': 'special_feeding' }, 'adl'],
  ['catheter_care', '导尿护理', { 'adl.toileting': 'catheter_or_stoma' }, 'adl'],
  ['pressure_injury_care', '压疮护理', { 'health.recentEvents': ['pressure_injury'] }, 'health'],
  ['incontinence_care', '失禁护理', { 'adl.toileting': 'frequent_incontinence' }, 'adl'],
]
for (const [capability, label, overrides, sourceSection] of cases) {
  const { preview, vm } = inspect(overrides)
  const field = 'specialCare.requiredCareCapabilities.' + capability
  const index = preview.clarifications.findIndex(item => item.reasonCode === 'risk_signal_needs_confirmation' && item.affectedDerivedFields.includes(field))
  assert.ok(index >= 0, capability)
  const row = vm.clarifications[index]
  assert.ok(row.text.includes(label), 'reminder must name the actual unresolved capability')
  assert.equal(row.editSection, 'cognitive')
  assert.equal(row.errorKey, 'edit-cognitive', 'failure feedback must match the Page action')
  assert.ok(row.editLabel.includes(label))
  assert.equal(row.relatedEdits.length, 0, 'recorded risks must not ask to resubmit the original clue')
  assert.ok(row.priorityLabel.startsWith('已记录'))
  const confirmed = inspect({ ...overrides, 'cognitive.specialCareNeeds': [...direct, capability] })
  assert.equal(confirmed.preview.specialCare.derivedFacts.requiredCareCapabilities.find(item => item.capability === capability).status, 'required')
  assert.equal(confirmed.preview.clarifications.some(item => item.reasonCode === 'risk_signal_needs_confirmation' && item.affectedDerivedFields.includes(field)), false, 'explicit requirement replaces only its own unresolved clue')
  if (capability === 'tube_feeding' || capability === 'catheter_care') {
    assert.ok(confirmed.preview.clarifications.some(item => item.reasonCode === 'non_ordinal_adl_answer'), 'medical care-mode clarification must not be erased by direct selection')
  }
  console.log(`PASS synthetic ${capability}: specific guidance, source edit path, direct selection and safety preservation`)
}
const conflict = inspect({ 'health.rehabilitationNeed': 'none', 'cognitive.specialCareNeeds': [...direct, 'rehabilitation_training'] })
const conflictIndex = conflict.preview.clarifications.findIndex(item => item.reasonCode === 'cross_answer_conflict' && item.affectedDerivedFields.includes('health.rehabilitationNeed'))
assert.ok(conflict.vm.clarifications[conflictIndex].text.includes('康复需求'))
assert.ok(!conflict.vm.clarifications[conflictIndex].text.includes('认知问卷'))
assert.ok(conflict.vm.clarifications[conflictIndex].relatedEdits.some(item => item.section === 'cognitive'))
assert.equal(conflict.vm.clarifications[conflictIndex].guidanceKind, 'conflict')
assert.ok(conflict.vm.clarifications[conflictIndex].priorityLabel.includes('冲突'))
assert.ok(inspect({ 'cognitive.specialCareNeeds': ['unknown'] }).vm.clarifications.length > 0)
assert.equal(inspect({ 'cognitive.specialCareNeeds': ['none'] }).vm.clarifications.length, 0)
const multiple = inspect({ 'health.rehabilitationNeed': 'possible', 'health.recentEvents': ['pressure_injury'], 'cognitive.symptoms': ['sleep_wake_disorder'] })
assert.equal(new Set(multiple.vm.clarifications.map(item => item.text)).size, multiple.vm.clarifications.length, 'different requirements cannot collapse to identical generic rows')

for (const answer of ['normal', 'occasional_difficulty', 'significant_difficulty', 'unknown']) {
  const { preview, vm, recommendation } = inspect({ 'health.swallowingAbility': answer, 'health.rehabilitationNeed': 'possible' })
  const nutrition = vm.nutritionRows.find(row => row.label === '吞咽情况')
  const index = preview.clarifications.findIndex(item => item.affectedDerivedFields.includes('nutrition.swallowingConcern'))
  const rehab = vm.clarifications.find(item => item.text.includes('专门康复训练'))
  assert.ok(rehab.text.includes('已选择可能需要康复'))
  assert.ok(rehab.followUpNote.includes('尚不清楚可保持原回答'))
  assert.equal(rehab.editSection, 'cognitive')
  assert.equal(preview.specialCare.derivedFacts.requiredCareCapabilities.find(item => item.capability === 'rehabilitation_training').status, 'needs_confirmation')
  // Preserve the current runtime's known swallowing/OTHER-capability readiness
  // behavior; this UI repair must not silently change that frozen boundary.
  assert.equal(recommendation.elderReadiness, 'ready')
  assert.equal(recommendation.cards.length, 0)
  assert.equal(recommendation.conditionalCandidates.length, 0)
  if (answer === 'normal') { assert.equal(index, -1); assert.equal(nutrition.value, '吞咽情况正常') }
  else {
    const reminder = vm.clarifications[index]
    assert.equal(reminder.guidanceKind, answer === 'unknown' ? 'answer_needed' : 'recorded_risk')
    assert.ok(nutrition.value.includes(answer === 'unknown' ? '不确定' : answer === 'occasional_difficulty' ? '偶尔吞咽不顺或容易呛咳' : '明显吞咽困难'))
    if (answer !== 'unknown') {
      assert.ok(reminder.text.includes('进食照护安排与机构接收能力'))
      assert.ok(reminder.followUpNote.includes('无需重复作答'))
      assert.equal(preview.clarifications[index].priority, 'required_before_hard_filter')
    }
  }
  console.log(`PASS swallowing ${answer}: recorded answer vs unknown, rehabilitation distinction, Formal/Preview and recommendation parity`)
}
for (const answer of ['occasional_difficulty', 'significant_difficulty', 'unknown']) {
  const { recommendation } = inspect({ 'health.swallowingAbility': answer })
  assert.equal(recommendation.elderReadiness, 'ready', 'existing swallowing readiness behavior stays unchanged')
}
const blocked = inspect({ 'adl.eating': 'unknown', 'health.swallowingAbility': 'occasional_difficulty', 'health.rehabilitationNeed': 'possible' })
assert.equal(blocked.recommendation.elderReadiness, 'blocked_by_required_clarification')
assert.equal(blocked.recommendation.cards.length, 0)
assert.equal(blocked.recommendation.conditionalCandidates.length, 0)

// Real Profile Page action and failure feedback, with an isolated synthetic getter.
let current = inspect({ 'health.rehabilitationNeed': 'possible' })
load('store/assessment-draft').assessmentDraftStore.getDraft = () => current.draft
load('pages/assessment/profile')
const page = { ...definition, route: 'pages/assessment/profile', data: JSON.parse(JSON.stringify(definition.data)), setData(patch, callback) { Object.assign(this.data, patch); callback?.() } }
pages = [page]; page.onLoad?.({}); page.onShow()
assert.equal(page.data.pageState, 'ready')
const reminder = page.data.viewModel.clarifications.find(item => item.text.includes('康复训练'))
page.onEdit({ currentTarget: { dataset: { section: reminder.editSection } } })
assert.equal(page.data.actionErrorKey, reminder.errorKey)
assert.ok(page.data.actionErrorMessage)
page.onEdit({ currentTarget: { dataset: { section: 'health' } } })
assert.equal(page.data.actionErrorKey, 'edit-health', 'section-level original edit remains available')
failNavigation = false
page.onEdit({ currentTarget: { dataset: { section: reminder.editSection } } })
assert.equal(navigations.length, 3, 'failed edits must be retryable')
current = inspect({ 'health.rehabilitationNeed': 'possible', 'cognitive.specialCareNeeds': [...direct, 'rehabilitation_training'] })
page.onShow()
assert.equal(page.data.viewModel.clarifications.length, 0, 'returning after a real answer change refreshes the Profile')
page.onShow()
assert.equal(page.data.viewModel.clarifications.length, 0, 'returning again with the same answers creates no false errors')
current = inspect({ 'health.swallowingAbility': 'unknown' })
page.onShow()
assert.ok(page.data.viewModel.clarifications.some(item => item.guidanceKind === 'answer_needed'))
current = inspect({ 'health.swallowingAbility': 'normal' })
page.onShow()
assert.equal(page.data.viewModel.clarifications.length, 0, 'editing unknown to a known answer refreshes without stale prompts')
current = { draft: makeProfileV2UiDraft({ 'health.swallowingAbility': undefined }) }
page.onShow()
assert.equal(page.data.pageState, 'incomplete', 'unanswered required input stays distinct from a completed risk answer')
const markup = fs.readFileSync('miniprogram/pages/assessment/profile.wxml', 'utf8')
assert.ok(markup.includes('本次问卷已填写完成'))
assert.ok(markup.includes('已记录的照护情况与后续提醒'))
assert.ok(markup.includes('item.followUpNote'))
assert.ok(markup.includes('不能生成已确认安全适合的推荐'))
assert.ok(markup.includes('relatedEdit.errorKey'))
assert.ok(!markup.includes('开发 Mock 机构目录'))
const demoMarkup = fs.readFileSync('modes/demo/overrides/pages/assessment/profile.wxml', 'utf8')
for (const template of [markup, demoMarkup]) {
  assert.ok(template.includes('已记录的照护情况与后续提醒'))
  assert.ok(template.includes('item.followUpNote'))
  assert.ok(template.includes('已报告的风险无需重复作答'))
  assert.ok(template.includes('不能生成已确认安全适合的推荐'))
  assert.ok(!template.includes('仍需核对的照护事项'))
}
assert.ok(demoMarkup.includes('虚构机构资料'), 'Demo must keep its fictional-data boundary')
console.log('PASS Profile logic review: complete vs unresolved, rehabilitation conflict, distinct reminders, visible edit failure/retry and refresh')
