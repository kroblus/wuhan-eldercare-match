import { validHistoricalRecommendationV1, historicalRecommendationViewV1 } from '../domain/assessment-history/recommendation-view'
import type { HistoricalRecommendationDisplayV1 } from '../domain/assessment-history/recommendation-view'
import type { HistoricalProfileDisplayV1 } from '../types/completed-assessment-history'

/** Memory-only TEST_ONLY projection; provisional identity/time are not completion metadata. */
export interface TrustedAssessmentPreviewV1 {
  contractVersion: 'completed-assessment-history-api-v1'
  kind: 'trusted_recommendation_preview_v1'
  previewId: string
  displayBinding: string
  sessionId: string
  scopeId: string
  environment: string
  createdAt: string
  expiresAt: string
  state: 'READY'
  profileDisplay: HistoricalProfileDisplayV1
  recommendationDisplay: HistoricalRecommendationDisplayV1
}
export type TrustedPreviewProjectionV1 = Pick<TrustedAssessmentPreviewV1, 'createdAt' | 'expiresAt' | 'profileDisplay' | 'recommendationDisplay'>
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]): boolean => Object.keys(v).sort().join('|') === keys.sort().join('|')
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const labels = ['照护需求', '行动能力', '康复需求', '食物质地支持', '吞咽关注', '认知关注']
export const validTrustedAssessmentPreviewV1 = (v: unknown): v is TrustedAssessmentPreviewV1 => {
  if (!object(v) || !exact(v, ['contractVersion','kind','previewId','displayBinding','sessionId','scopeId','environment','createdAt','expiresAt','state','profileDisplay','recommendationDisplay'])
    || v.contractVersion !== 'completed-assessment-history-api-v1' || v.kind !== 'trusted_recommendation_preview_v1'
    || !uuid(v.previewId) || !uuid(v.sessionId) || !uuid(v.scopeId) || typeof v.displayBinding !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(v.displayBinding) || typeof v.environment !== 'string' || !/^TEST_ONLY_[A-Za-z0-9_-]{1,72}$/.test(v.environment) || v.state !== 'READY'
    || typeof v.createdAt !== 'string' || typeof v.expiresAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt))
    || !Number.isFinite(Date.parse(v.expiresAt)) || Date.parse(v.expiresAt) <= Date.parse(v.createdAt)) return false
  const p = v.profileDisplay
  return object(p) && exact(p,['kind','snapshotVersion','assessmentId','assessmentCompletedAt','assessmentSchemaVersion','profileContractVersion','derivationRulesetVersion','rows'])
    && p.kind === 'historical_profile_display_v1' && p.snapshotVersion === 1 && p.assessmentId === v.previewId
    && p.assessmentCompletedAt === v.createdAt && p.assessmentSchemaVersion === 2
    && p.profileContractVersion === 'elder-profile-contract-v2' && p.derivationRulesetVersion === 'elder-profile-ruleset-v2'
    && Array.isArray(p.rows) && p.rows.length === 6 && p.rows.every((row,index) => object(row) && exact(row,['label','value'])
      && row.label === labels[index] && typeof row.value === 'string' && row.value.length > 0 && row.value.length <= 80)
    && validHistoricalRecommendationV1(v.recommendationDisplay, { id: v.previewId, completedAt: v.createdAt })
}
export const trustedPreviewProjectionV1 = (v: TrustedAssessmentPreviewV1): TrustedPreviewProjectionV1 => JSON.parse(JSON.stringify({
  createdAt: v.createdAt, expiresAt: v.expiresAt, profileDisplay: v.profileDisplay, recommendationDisplay: v.recommendationDisplay,
}))
/** Uses only the pinned display, never Draft, current Catalog or Recommendation engine. */
export const trustedPreviewViewV1 = (p: TrustedPreviewProjectionV1) => {
  const r = p.recommendationDisplay, view = historicalRecommendationViewV1(r)
  return { profileRows: p.profileDisplay.rows, recommendation: { ...view,
    title: view.title.replace(/当次/g,'本次').replace('保存当时','本次'),
    note: view.note.replace(/当时/g,'本次').replace(/当次/g,'本次').replace('已保存结果','服务器核验结果'),
  }, nearMatches: historicalRecommendationViewV1({...r,cards:r.nearMatches,conditionalCandidates:[]}).cards,
  advisories:r.advisories.map(row => row.code), noExactReason:r.noExactMatch ? r.noExactMatch.reasonCode : '',
  source: `${r.source.reference} · ${r.source.datasetVersion} · 合成测试资料`, catalogDigest:r.source.digest,
  versions:Object.keys(r.versions).map(key => `${key}: ${r.versions[key as keyof typeof r.versions]}`),
  state: r.state, createdAt: p.createdAt, expiresAt: p.expiresAt }
}
