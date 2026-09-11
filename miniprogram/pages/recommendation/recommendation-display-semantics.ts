/**
 * Shared, display-only Recommendation V2 wording.
 *
 * Result and Institution Detail consume the same stable code labels so the
 * two surfaces cannot drift. This module does not evaluate, rank or infer a
 * Recommendation and deliberately contains no Assessment/Institution facts.
 */

const REASON_LABELS: Record<string, string> = {
  CARE_LEVEL_SUPPORTED: '照护等级与当前需求相符',
  MOBILITY_SUPPORTED: '行动照护能力可匹配',
  TRANSFER_SUPPORTED: '床椅转移支持可匹配',
  COGNITIVE_ACCEPTANCE_SUPPORTED: '认知照护接收情况可匹配',
  WANDERING_SUPPORT_SUPPORTED: '走失风险支持情况可匹配',
  SPECIAL_CARE_SUPPORTED: '特殊护理能力可匹配',
  REHABILITATION_SUPPORTED: '康复支持情况可匹配',
  REQUIREMENT_REQUIRES_ASSESSMENT: '部分护理需求需要机构评估',
  REQUIREMENT_UNVERIFIED: '相关护理资料仍待核验',
  REQUIREMENT_UNSUPPORTED: '部分需求与当前资料存在差异',
  BUDGET_WITHIN_RANGE: '参考费用在预算范围内',
  BUDGET_PARTIAL_OVERLAP: '参考费用与预算部分重叠',
  BUDGET_ABOVE_RANGE: '参考费用高于当前预算区间',
  BUDGET_BELOW_DECLARED_RANGE: '参考费用低于当前预算区间',
  BUDGET_CEILING_UNSPECIFIED: '预算上限尚未明确',
  BUDGET_UNKNOWN: '预算资料暂不明确',
  REGION_MATCH: '区域偏好相符',
  REGION_DIFFERENT: '区域偏好存在差异',
  REGION_UNKNOWN: '区域资料待确认',
  TYPE_MATCH: '机构类型偏好相符',
  TYPE_DIFFERENT: '机构类型存在差异',
  TYPE_UNKNOWN: '机构类型资料待确认',
  PRIORITY_STRUCTURED_MATCH: '关注重点有结构化支持',
  PRIORITY_NOT_MET: '部分关注重点存在差异',
  PRIORITY_UNVERIFIED: '关注重点资料待核验',
  DATA_NOT_VERIFIED: '部分资料仍待核验',
  ROOM_TYPE_MATCH: '符合所选房型偏好',
  MEAL_SCHEDULE_MATCH: '餐次安排与所选偏好一致',
  EASY_CHEW_SUPPORT: '易咀嚼饮食支持已核验',
  MODIFIED_FOOD_SUPPORT: '特殊处理饮食支持已核验',
}

const DIFFERENCE_LABELS: Record<string, string> = {
  HARD_CAPABILITY_UNSUPPORTED: '关键护理能力当前不支持',
  CAPABILITY_REQUIRES_ASSESSMENT: '相关护理能力需要机构进一步评估',
  CAPABILITY_NOT_VERIFIED: '相关护理能力资料尚未完成核验',
  ELDER_REQUIREMENT_NEEDS_CONFIRMATION: '老人当前护理需求仍需补充确认',
  BUDGET_PARTIAL_OVERLAP: '参考费用与当前预算范围部分重叠',
  BUDGET_ABOVE_RANGE: '参考费用高于当前预算范围',
  BUDGET_BELOW_DECLARED_RANGE: '参考费用低于当前预算范围',
  BUDGET_UNKNOWN: '参考费用或预算信息暂不明确',
  PRICE_UPPER_BOUND_UNKNOWN: '参考费用上限尚未提供',
  REGION_DIFFERENT: '所在区域与当前偏好不同',
  REGION_UNKNOWN: '区域信息暂未提供',
  TYPE_DIFFERENT: '机构类型与当前偏好不同',
  TYPE_UNKNOWN: '机构类型信息暂未提供',
  PRIORITY_NOT_MET: '一项用户关注内容当前未满足',
  PRIORITY_UNVERIFIED: '一项用户关注内容资料待核验',
  REHABILITATION_SOFT_DATA_GAP: '康复服务相关资料仍需确认',
  ROOM_TYPE_MISMATCH: '房型偏好存在差异',
  ROOM_TYPE_UNKNOWN: '房型资料不足，需要进一步确认',
  MEAL_SCHEDULE_MISMATCH: '该项安排与您的偏好存在差异',
  MEAL_SCHEDULE_DATA_UNAVAILABLE: '当前资料显示该项服务暂不可用',
  MEAL_SCHEDULE_UNKNOWN: '当前核验资料不足，需进一步确认',
  EASY_CHEW_SUPPORT_UNAVAILABLE: '当前资料显示该项服务暂不可用',
  EASY_CHEW_SUPPORT_REQUIRES_INQUIRY: '该项服务需要进一步向机构确认',
  EASY_CHEW_SUPPORT_UNKNOWN: '当前核验资料不足，需进一步确认',
  MODIFIED_FOOD_SUPPORT_UNAVAILABLE: '当前资料显示该项服务暂不可用',
  MODIFIED_FOOD_SUPPORT_REQUIRES_INQUIRY: '该项服务需要进一步向机构确认',
  MODIFIED_FOOD_SUPPORT_UNKNOWN: '当前核验资料不足，需进一步确认',
}

const TIER_LABELS: Record<'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL', string> = {
  EXACT: '完全匹配候选',
  SOFT_NEAR: '相近候选',
  CONDITIONAL: '条件候选',
}

export const recommendationReasonLabelV2 = (code: string): string =>
  REASON_LABELS[code] || '当前结果包含一项结构化匹配信息'

export const recommendationDifferenceLabelV2 = (code: string): string =>
  DIFFERENCE_LABELS[code] || '当前存在一项需要进一步确认的差异'

export const recommendationTierLabelV2 = (
  tier: 'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL',
): string => TIER_LABELS[tier]

export const isRecommendationReasonVisibleV2 = (code: string): boolean =>
  code !== 'PRIORITY_NOT_SCORABLE'

export const isRecommendationDifferenceVisibleV2 = (code: string): boolean =>
  code !== 'PRIORITY_NOT_SCORABLE'
