import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { makeProfileV2UiDraft } from './fixtures/profile-v2-ui-fixtures.mjs'

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
const direct = ['round_the_clock_care', 'one_to_one_caregiver']
const inspect = overrides => {
  const draft = makeProfileV2UiDraft({ 'cognitive.specialCareNeeds': direct, ...overrides })
  const result = derive(draft); assert.equal(result.ok, true)
  const before = JSON.stringify(result.preview)
  const vm = makeVm(result.preview)
  assert.equal(JSON.stringify(result.preview), before, 'presentation cannot change frozen clarification/readiness facts')
  assert.equal(vm.actions.canOpenRecommendation, true, 'complete answers remain a valid Profile')
  return { draft, preview: result.preview, vm }
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
  if (sourceSection !== 'cognitive') assert.ok(row.relatedEdits.some(item => item.section === sourceSection), 'original clue must have a valid edit path')
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
assert.ok(inspect({ 'cognitive.specialCareNeeds': ['unknown'] }).vm.clarifications.length > 0)
assert.equal(inspect({ 'cognitive.specialCareNeeds': ['none'] }).vm.clarifications.length, 0)
const multiple = inspect({ 'health.rehabilitationNeed': 'possible', 'health.recentEvents': ['pressure_injury'], 'cognitive.symptoms': ['sleep_wake_disorder'] })
assert.equal(new Set(multiple.vm.clarifications.map(item => item.text)).size, multiple.vm.clarifications.length, 'different requirements cannot collapse to identical generic rows')

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
assert.equal(page.data.actionErrorKey, reminder.relatedEdits.find(item => item.section === 'health').errorKey)
failNavigation = false
page.onEdit({ currentTarget: { dataset: { section: reminder.editSection } } })
assert.equal(navigations.length, 3, 'failed edits must be retryable')
current = inspect({ 'health.rehabilitationNeed': 'possible', 'cognitive.specialCareNeeds': [...direct, 'rehabilitation_training'] })
page.onShow()
assert.equal(page.data.viewModel.clarifications.length, 0, 'returning after a real answer change refreshes the Profile')
const markup = fs.readFileSync('miniprogram/pages/assessment/profile.wxml', 'utf8')
assert.ok(markup.includes('本次问卷已填写完成'))
assert.ok(markup.includes('relatedEdit.errorKey'))
assert.ok(!markup.includes('开发 Mock 机构目录'))
console.log('PASS Profile logic review: complete vs unresolved, rehabilitation conflict, distinct reminders, visible edit failure/retry and refresh')
