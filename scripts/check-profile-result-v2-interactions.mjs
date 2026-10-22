import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')

const profileSource = read('miniprogram/pages/assessment/profile.ts')
const profileWxml = read('miniprogram/pages/assessment/profile.wxml')
const resultSource = read('miniprogram/pages/recommendation/result.ts')
const resultWxml = read('miniprogram/pages/recommendation/result.wxml')
const primaryButton = read('miniprogram/components/primary-button/primary-button.ts')
const navigationGuard = read('miniprogram/utils/navigation-guard.ts')
const profileApplication = read('miniprogram/services/profile-application-v2.ts')
const resultApplication = read('miniprogram/services/recommendation-result-application.ts')
const resultViewModel = read('miniprogram/pages/recommendation/result-v2-view-model.ts')

const checks = [
  ['INTERACTION-V2-001', 'shared button exposes one non-bubbling action channel', () => {
    assert.match(primaryButton, /triggerEvent\(['"]action['"]/)
    assert.match(primaryButton, /bubbles:\s*false/)
    assert.match(primaryButton, /composed:\s*false/)
    assert.doesNotMatch(primaryButton, /triggerEvent\(\s*['"]tap['"]\s*\)/)
  }],
  ['INTERACTION-V2-002', 'Profile and Result page actions use explicit bindings', () => {
    assert.match(profileWxml, /bind:action="onOpenRecommendation"/)
    assert.match(resultWxml, /bind:action="onAdjustNeeds"/)
    assert.match(resultWxml, /bind:action="onRetry"/)
    assert.doesNotMatch(profileWxml, /\sbindtap=/)
    assert.equal((resultWxml.match(/bindtap="onRecommendationCardTap"/g) || []).length, 2)
    assert.doesNotMatch(resultWxml, /<primary-button[^>]*bindtap=/)
  }],
  ['INTERACTION-V2-003', 'Back remains available while page data is loading', () => {
    assert.match(profileSource, /resetAssessmentPageNavigation\(this\)/)
    assert.match(resultSource, /resetNavigationGuard\(this\)/)
    assert.match(profileWxml, /back="\{\{backEnabled\}\}"/)
    assert.match(resultWxml, /back="\{\{backEnabled\}\}"/)
  }],
  ['INTERACTION-V2-004', 'refresh clears stale ViewModel before V2 derivation', () => {
    assert.match(profileSource, /viewModel:\s*null/)
    assert.match(resultSource, /viewModel:\s*null/)
    assert.match(profileSource, /refreshProfile\(\)/)
    assert.match(resultSource, /refreshRecommendation\(\)/)
  }],
  ['INTERACTION-V2-005', 'navigation uses one guarded action and visible failure feedback', () => {
    assert.match(profileSource, /runGuardedNavigation\(this, 'profile\.openRecommendation'/)
    assert.match(resultSource, /runGuardedNavigation\(this, 'recommendation\.adjustNeeds'/)
    assert.match(resultSource, /actionErrorMessage/)
    assert.match(navigationGuard, /acquire\(/)
  }],
  ['INTERACTION-V2-006', 'V2 application boundaries remain local and anonymous', () => {
    assert.doesNotMatch(profileApplication, /wx\.request|wx\.login|getPhoneNumber/)
    assert.doesNotMatch(resultApplication, /wx\.request|wx\.login|getPhoneNumber/)
    assert.doesNotMatch(profileApplication, /setStorageSync|removeStorageSync/)
    assert.doesNotMatch(resultApplication, /setStorageSync|removeStorageSync/)
  }],
  ['INTERACTION-V2-007', 'Result keeps downstream identity gates and no fake score', () => {
    assert.match(resultWxml, /item\.detailLabel/)
    assert.match(resultWxml, /bindtap="onRecommendationCardTap"/)
    assert.match(resultSource, /registerInstitutionRecommendationSourceContextV2/)
    assert.match(resultSource, /serializeInstitutionDetailRoute/)
    assert.match(resultSource, /onRecommendationListTap/)
    assert.match(resultSource, /recommendation\.result\.openInstitution/)
    assert.match(resultViewModel, /查看机构详情/)
    assert.match(resultViewModel, /浏览已收录的养老机构/)
    assert.match(resultWxml, /bindtap="onBrowseDirectory"/)
    assert.doesNotMatch(resultWxml, /匹配度|百分比|概率|评分/)
    assert.doesNotMatch(resultViewModel, /InstitutionRecordV11/)
  }],
  ['INTERACTION-V2-008', 'Result readiness blocked remains an honest no-safe state', () => {
    assert.match(resultWxml, /ELDER_READINESS_BLOCKED/)
    assert.match(resultViewModel, /ELDER_READINESS_BLOCKED/)
    assert.match(resultViewModel, /no_safe_recommendation/)
    assert.doesNotMatch(resultViewModel, /semantics\.cards\.(?:filter|sort)\(/)
    assert.doesNotMatch(resultViewModel, /semantics\.conditionalCandidates\.(?:filter|sort)\(/)
    assert.doesNotMatch(resultViewModel, /nearMatches\.(?:filter|sort)\(/)
  }],
  ['INTERACTION-V2-009', 'Profile and Result avoid generated identity and network side effects', () => {
    assert.doesNotMatch(profileSource, /assessmentId|elderId|completedAt|previewId/)
    assert.doesNotMatch(resultSource, /assessmentId|elderId|recommendationId|completedAt/)
    assert.doesNotMatch(profileSource, /wx\.request|wx\.login|getPhoneNumber/)
    assert.doesNotMatch(resultSource, /wx\.request|wx\.login|getPhoneNumber/)
  }],
  ['INTERACTION-V2-010', 'new V2 TypeScript follows real-device class-field rule', () => {
    const sources = [
      read('miniprogram/types/profile-application-v2.ts'),
      read('miniprogram/services/profile-application-v2.ts'),
      read('miniprogram/pages/assessment/profile-v2-view-model.ts'),
      read('miniprogram/types/recommendation-result-v2.ts'),
      read('miniprogram/services/recommendation-result-application.ts'),
      read('miniprogram/pages/recommendation/result-v2-view-model.ts'),
    ]
    sources.forEach((source) => assert.doesNotMatch(source, /class\s+[A-Za-z_$][\w$]*\s*\{[^}]*\b[A-Za-z_$][\w$]*\s*=/s))
    assert.match(resultSource, /new Date\(\)\.toISOString\(\)/)
  }],
]

const executed = []
const failures = []
checks.forEach(([id, description, check]) => {
  try {
    check()
    executed.push(id)
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
})

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure))
  console.error('PROFILE_RESULT_V2_INTERACTION_RUNTIME = FAIL')
  process.exitCode = 1
} else {
  console.log(`PROFILE_RESULT_V2_INTERACTION_CASES: ${executed.length}/${checks.length} PASS`)
  console.log('PROFILE_RESULT_V2_INTERACTION_RUNTIME = PASS')
}
