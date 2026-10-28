import type { InitialReferenceDisplayCardV1, ReferenceCompositionV1 } from '../../types/initial-reference-v1'
import type { InstitutionDisplayFactV11 } from '../../types/recommendation-result-v2'
import { clarificationText } from '../assessment/profile-v2-view-model'
import { createRecommendationResultViewModelV2 } from './result-v2-view-model'
import type { RecommendationResultPageViewModelV2 } from './result-v2-view-model'
import { isRecommendationDifferenceVisibleV2, recommendationDifferenceLabelV2 } from './recommendation-display-semantics'

export interface ReferenceCardViewModel {
  institutionId: string
  recordRevision: number
  name: string
  region: string
  price: string
  reasons: string[]
  institutionWarnings: string[]
  riskFacts: string[]
  clarifications: string[]
  differences: string[]
  detailLabel: string
}

export interface InitialReferenceResultViewModel extends Omit<RecommendationResultPageViewModelV2, 'state'> {
  state: 'initial_reference_only' | 'no_personalized_candidate'
  referenceCards: ReferenceCardViewModel[]
  legacyMessage: string
  exclusionMessage: string
}

const CARE_LABELS: Record<string, string> = {
  independent: '生活可自理', light_care: '轻度照护', semi_disabled: '半失能照护',
  disabled: '失能照护', severely_disabled: '重度照护',
}
const MOBILITY_LABELS: Record<string, string> = {
  independent: '可独立行动', walking_aid: '需助行支持', wheelchair: '使用轮椅', bedbound: '卧床照护',
}
const CAPABILITY_LABELS: Record<string, string> = {
  round_the_clock_care: '全天照护', one_to_one_caregiver: '一对一照护', night_care: '夜间照护',
  dementia_unit: '认知症专区', rehabilitation_training: '康复训练', tube_feeding: '管饲护理',
  catheter_care: '导管护理', pressure_injury_care: '压疮护理', incontinence_care: '失禁照护',
}
const FIELD_LABELS: Record<string, string> = {
  'adl.careLevel': '自理与照护等级', 'mobility.level': '行动支持',
  'cognition.cognitiveConcern': '认知情况', 'cognition.reportedDiagnosis': '已报告的认知诊断',
  'cognition.wanderingRisk': '走失风险支持', 'cognition.behavioralRisk': '情绪与行为支持',
  'cognition.sleepCycleIssue': '作息与夜间支持', 'health.rehabilitationNeed': '康复需求',
}
const ADL_LABELS: Record<string, string> = {
  feeding_minor: '进食需少量协助', feeding_dependence: '进食依赖协助', special_feeding_review: '特殊进食方式需核实',
  walking_aid: '使用助行工具', wheelchair: '使用轮椅', bedridden: '卧床照护',
  toileting_minor: '如厕需少量协助', incontinence: '失禁照护', toileting_full_assistance: '如厕需全程协助',
  catheter_or_stoma_review: '导管或造口照护需核实', bathing_partial: '洗澡需部分协助', bathing_full_assistance: '洗澡需全程协助',
  dressing_partial: '穿衣需部分协助', dressing_full_assistance: '穿衣需全程协助',
  transfer_minor: '床椅转移需少量协助', transfer_support: '床椅转移需支持', fully_dependent_transfer: '床椅转移完全依赖协助',
  stairs_assistance: '上下楼需协助', stairs_unable: '无法上下楼', no_stairs_context: '尚无楼梯活动观察',
}
const BASIS_LABELS: Record<string, string> = {
  AREA: '区域：已核验区划符合所选区域偏好。',
  BUDGET: '预算：已核验的参考月费区间与您的预算重叠，不是最终报价。',
}
const STATUS_LABELS: Record<string, string> = {
  unknown: '资料未知', unverified: '资料未核实', expired: '核验资料已过期', unavailable: '资料暂不可用',
}
const categoryLabel: Record<string, string> = { AREA: '区域', BUDGET: '参考月费', BASIC_SERVICE: '房型或餐次' }
const fieldLabel = (field: string): string => FIELD_LABELS[field]
  || CAPABILITY_LABELS[field.replace('specialCare.requiredCareCapabilities.', '')]
  || '相关照护条件'

const identityText = (fact: InstitutionDisplayFactV11<string>, mock: boolean, fallback: string): string => {
  if (fact.availability !== 'provided') return fallback
  if (fact.effectiveVerification === 'current_verified') return fact.value
  return mock ? `演示资料：${fact.value}` : fallback
}

const mapCard = (card: InitialReferenceDisplayCardV1, composition: ReferenceCompositionV1): ReferenceCardViewModel => {
  const mock = composition.datasetMode === 'MOCK_DEVELOPMENT_ONLY' && card.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
  const reasons: string[] = []
  // Only map the successful evidence already selected by C1-A. No eligibility or ordering here.
  card.referenceReasons.forEach(reason => {
    if (reason.category !== 'BASIC_SERVICE') reasons.push(BASIS_LABELS[reason.category])
    else reason.matchedFieldPaths.forEach(field => reasons.push(field === 'meal.mealSchedule'
      ? '普通安排：已核验餐次符合所选偏好。' : '普通安排：已核验房型符合所选偏好。'))
  })
  const fact = card.institutionFacts.price.referenceMonthlyPrice
  const price = fact.effectiveValue
  let priceText = '参考费用资料待核实'
  if (price !== null) {
    const min = `¥${price.range.min.amountMinor / 100}`
    priceText = price.range.kind === 'bounded' ? `${min}–¥${price.range.max.amountMinor / 100} / 月` : `${min} 起 / 月`
  }
  const warnings = card.institutionCapabilityUnknowns.map(item => `${fieldLabel(item.sourceDerivedField)}：护理能力未知或未核实，需向机构确认。`)
  const candidate = composition.legacyV2.preview.semantics.candidateEvaluations.find(item =>
    item.institutionId === card.institutionId && item.recordRevision === card.recordRevision)
  if (candidate) candidate.constraintResults.forEach(item => {
    if (item.outcome === 'conditional') warnings.push(`${fieldLabel(item.sourceDerivedField)}：需由机构进一步评估。`)
  })
  ;(['easyChewSupport', 'modifiedFoodSupport'] as const).forEach(field => {
    const food = card.institutionFacts.meal[field]
    const label = field === 'easyChewSupport' ? '易咀嚼饮食' : '特殊处理饮食'
    if (food.effectiveValue === 'requires_inquiry') warnings.push(`${label}：需向机构询问，尚不能确认支持。`)
    else if (food.effectiveStatus !== 'current_verified') warnings.push(`${label}：${STATUS_LABELS[food.effectiveStatus]}，不能视为已支持。`)
    else if (food.effectiveValue === 'unavailable') warnings.push(`${label}：当前核验资料显示暂不提供，请结合具体需要核实。`)
  })
  warnings.push('床位、护理能力与接收条件均须向机构核实；本卡不确认可入住。')
  const risk = card.elderRiskFacts
  const riskFacts: string[] = []
  riskFacts.push(risk.adl.careLevel.status === 'known'
    ? `本次照护画像：${CARE_LABELS[risk.adl.careLevel.value]}，具体照护需机构评估。` : '自理与照护等级尚待确认。')
  riskFacts.push(risk.mobility.level.status === 'known'
    ? `本次行动情况：${MOBILITY_LABELS[risk.mobility.level.value]}。` : '行动与转移支持情况尚待确认。')
  risk.adl.careModes.forEach(mode => riskFacts.push(`日常照护：${ADL_LABELS[mode.code] || '相关照护方式需确认'}${mode.status === 'needs_confirmation' ? '（待确认）' : ''}。`))
  const swallowing = risk.nutrition.swallowingConcern
  if (swallowing.status !== 'known') riskFacts.push(swallowing.status === 'unknown'
    ? '吞咽情况未知，须进一步确认；不能据此推断鼻饲需求。'
    : '已报告吞咽不顺，风险及具体照护方式需进一步确认；不能据此推断鼻饲需求。')
  const texture = risk.nutrition.foodTextureSupport
  if (texture.status !== 'known') riskFacts.push('咀嚼与饮食形态尚待确认。')
  else if (texture.value !== 'standard') riskFacts.push(texture.value === 'easy_chew' ? '已报告易咀嚼饮食需求。' : '已报告特殊处理饮食需求。')
  ;(['cognitiveConcern', 'reportedDiagnosis', 'wanderingRisk', 'behavioralRisk', 'sleepCycleIssue'] as const).forEach(field => {
    const value = risk.cognition[field]
    if (value.status === 'known' && (value.value === 'present' || value.value === 'reported')) {
      riskFacts.push(`${FIELD_LABELS[`cognition.${field}`]}：本次回答已报告，须向机构说明并核实照护安排。`)
    }
  })
  if (risk.health.rehabilitationNeed.status === 'known' && risk.health.rehabilitationNeed.value !== 'not_required') riskFacts.push('已报告康复相关需求，具体安排须进一步确认。')
  risk.specialCare.requiredCareCapabilities.forEach(item => {
    if (item.status === 'required') riskFacts.push(`已报告${CAPABILITY_LABELS[item.capability]}需求，须核实具体支持。`)
  })
  const differences = card.ordinaryDataGaps.filter(item => item.status !== 'NOT_APPLICABLE').map(item =>
    `${categoryLabel[item.category]}：${item.status === 'NOT_MATCHED' ? '与所选偏好存在差异' : '暂无足够的核验资料'}。`)
  if (candidate) candidate.differences.forEach(item => {
    const ordinary = ['budget', 'region', 'institution_type', 'priority', 'room_type', 'meal_schedule'].indexOf(item.differenceType) >= 0
    if (ordinary && isRecommendationDifferenceVisibleV2(item.differenceCode)
      && (item.differenceCategory === 'SOFT_DIFFERENCE' || item.differenceCategory === 'UNVERIFIED_DATA_GAP')) {
      // Preserve each old ordinary difference, including a meal gap when room fit
      // already makes BASIC_SERVICE matched. Never derive new fit from raw facts.
      differences.push(`${item.differenceCategory === 'UNVERIFIED_DATA_GAP' ? '普通偏好资料待核验' : '普通偏好差异'}：${recommendationDifferenceLabelV2(item.differenceCode)}`)
    }
  })
  return {
    institutionId: card.institutionId, recordRevision: card.recordRevision,
    name: identityText(card.institutionDisplay.identity.name, mock, '机构名称待核实'),
    region: identityText(card.institutionDisplay.identity.regionDisplayName, mock, '区域资料待核实'),
    price: priceText, reasons, institutionWarnings: warnings, riskFacts,
    clarifications: card.elderClarifications.map(clarificationText), differences,
    detailLabel: '查看机构公开详情',
  }
}

export const createInitialReferenceResultViewModel = (
  composition: ReferenceCompositionV1,
): RecommendationResultPageViewModelV2 | InitialReferenceResultViewModel => {
  const legacy = createRecommendationResultViewModelV2(composition.legacyV2)
  if (composition.state === 'LEGACY_V2_DISPLAY') return legacy
  const hasReference = composition.state === 'INITIAL_REFERENCE_ONLY'
  return {
    ...legacy,
    state: hasReference ? 'initial_reference_only' : 'no_personalized_candidate',
    headline: hasReference ? '暂无可核实匹配，先了解初步参考' : '暂无足够可信的个性化参考依据',
    summary: hasReference ? '暂无可核实匹配；下列仅为初步参考，护理与接收条件需向机构核实。'
      : '当前资料还不足以形成个性化参考。可以浏览公开机构目录，再逐项核实照护、收费与接收条件。',
    cards: [], conditionalCards: [], focusTags: [],
    referenceCards: composition.displayedReferenceCards.map(card => mapCard(card, composition)),
    legacyMessage: composition.legacyV2.preview.semantics.elderReadiness !== 'ready'
      ? '部分照护事项仍需确认，原有照护条件阻断仍保留。初步参考不代表护理匹配成功。'
      : '当前尚无可以核实匹配的候选。初步参考只说明普通偏好依据，不确认护理能力。',
    exclusionMessage: composition.referenceEvaluations.some(item => item.exclusionCodes.length > 0)
      ? '与已知必要条件存在当前明确冲突的机构，未列入初步参考。' : '',
  }
}
