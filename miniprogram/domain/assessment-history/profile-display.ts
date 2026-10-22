import { deriveElderProfileV2 } from '../elder-profile/v2/derive-elder-profile-v2'
import type { DerivedFact } from '../../types/elder-profile'

// Evaluated once by the server at save. No Draft, wx, Catalog or Recommendation imports.
const text = (fact: DerivedFact<string>, labels: Record<string, string>): string => {
  if (fact.status === 'unknown') return '暂不确定'
  const value = 'value' in fact ? fact.value : undefined
  const label = value && labels[value] ? labels[value] : '暂不确定'
  return fact.status === 'needs_confirmation' ? `${label} · 待确认` : label
}
export const deriveHistoricalProfileDisplayV1 = (snapshot: unknown) => {
  const result = deriveElderProfileV2(snapshot)
  if (!result.ok) return { ok: false as const }
  const p = result.profile
  return { ok: true as const, display: {
    kind: 'historical_profile_display_v1', snapshotVersion: 1,
    assessmentId: p.identity.assessmentId, assessmentCompletedAt: p.identity.assessmentCompletedAt,
    assessmentSchemaVersion: 2, profileContractVersion: p.identity.profileContractVersion,
    derivationRulesetVersion: p.identity.derivationRulesetVersion,
    rows: [
      { label: '照护需求', value: text(p.adl.derivedFacts.careLevel, { independent: '自理', light_care: '轻度照护', semi_disabled: '半失能', disabled: '失能', severely_disabled: '重度失能' }) },
      { label: '行动能力', value: text(p.mobility.derivedFacts.level, { independent: '可独立行走', walking_aid: '需要拐杖或助行器', wheelchair: '轮椅辅助', bedbound: '基本无法下床' }) },
      { label: '康复需求', value: text(p.health.derivedFacts.rehabilitationNeed, { required: '有明确康复需求', possible: '可能需要康复支持', not_required: '未提出康复需求' }) },
      { label: '食物质地支持', value: text(p.nutrition.derivedFacts.foodTextureSupport, { standard: '普通食物', easy_chew: '易咀嚼食物', modified_food: '调整食物质地' }) },
      { label: '吞咽关注', value: text(p.nutrition.derivedFacts.swallowingConcern, { normal: '未报告吞咽困难', occasional_difficulty: '偶有吞咽困难', significant_difficulty: '明显吞咽困难' }) },
      { label: '认知关注', value: text(p.cognition.derivedFacts.cognitiveConcern, { present: '有用户报告的认知相关情况', absent: '用户报告无相关情况', not_reported: '未报告相关情况' }) },
    ],
  } }
}
