import type { InstitutionTypeCode } from '../../types/institution'
import type {
  InstitutionDisplayFactV11,
  InstitutionDisplaySnapshotV11,
  RecommendationResultApplicationSnapshotV2,
} from '../../types/recommendation-result-v2'
import type {
  RecommendationCandidateEvaluationV2,
  RecommendationDifferenceCodeV2,
  RecommendationDifferenceV2,
  RecommendationReasonCodeV2,
  RecommendationReasonV2,
  RecommendationSemanticResultV2,
} from '../../types/recommendation-v2'
import {
  isRecommendationDifferenceVisibleV2,
  isRecommendationReasonVisibleV2,
  recommendationDifferenceLabelV2,
  recommendationReasonLabelV2,
} from './recommendation-display-semantics'

export type RecommendationResultPageStateV2 =
  | 'loading'
  | 'ready_exact'
  | 'ready_soft_near'
  | 'ready_conditional'
  | 'no_safe_recommendation'
  | 'assessment_error'
  | 'catalog_error'
  | 'recommendation_error'

export type ResultTagToneV2 = 'brand' | 'neutral' | 'warning' | 'development'

export interface ResultTagViewModelV2 {
  text: string
  tone: ResultTagToneV2
}

export interface ResultReasonViewModelV2 {
  key: string
  text: string
  tone: 'positive' | 'neutral' | 'warning'
}

export interface ResultDifferenceViewModelV2 {
  key: string
  text: string
  tone: 'neutral' | 'warning' | 'muted'
}

export interface ResultCompactFactViewModelV2 {
  key: string
  text: string
  tone: 'positive' | 'neutral' | 'warning' | 'muted'
}

export interface RecommendationInstitutionCardViewModelV2 {
  institutionId: string
  recordRevision: number
  name: string
  region: string
  type: string
  price: string
  coverUrl: string
  hasCover: boolean
  tags: ResultTagViewModelV2[]
  reasons: ResultReasonViewModelV2[]
  differences: ResultDifferenceViewModelV2[]
  compactFacts: ResultCompactFactViewModelV2[]
  advisories: string[]
  vrLabel: string
  detailLabel: string
  isConditional: boolean
}

export interface RecommendationResultPageViewModelV2 {
  state: RecommendationResultPageStateV2
  headline: string
  summary: string
  focusTags: ResultTagViewModelV2[]
  cards: RecommendationInstitutionCardViewModelV2[]
  conditionalCards: RecommendationInstitutionCardViewModelV2[]
  resultAdvisories: string[]
  visitAdvice: string[]
  mockDisclosure: string | null
  hasMockDisclosure: boolean
  datasetLabel: string
  emptyReason: 'ELDER_READINESS_BLOCKED' | 'NO_SAFE_RECOMMENDATION' | null
  noSafeMessage: string
  actions: {
    canRetry: boolean
    canAdjustNeeds: boolean
    canContactConsultant: boolean
    detailLabel: string
    listLabel: string
  }
}

const TYPE_LABELS: Record<InstitutionTypeCode, string> = {
  active_aging: '活力型养老',
  medical_nursing_integrated: '医养结合',
  disability_care: '失能照护',
  dementia_care: '认知症照护',
  rehabilitation_care: '康复照护',
}

const CARE_LEVEL_LABELS: Record<string, string> = {
  independent: '生活可自理',
  light_care: '需要轻度照护',
  semi_disabled: '需要半失能照护',
  disabled: '需要失能照护',
  severely_disabled: '需要重度照护',
}

const MOBILITY_LABELS: Record<string, string> = {
  independent: '可独立行动',
  walking_aid: '行动需要辅助',
  wheelchair: '需要轮椅支持',
  bedbound: '长期卧床照护',
}

const SPECIAL_CARE_LABELS: Record<string, string> = {
  round_the_clock_care: '24 小时照护',
  one_to_one_caregiver: '一对一照护',
  night_care: '夜间重点照护',
  dementia_unit: '认知症专区',
  rehabilitation_training: '康复训练',
  tube_feeding: '鼻饲护理',
  catheter_care: '导尿护理',
  pressure_injury_care: '压疮护理',
  incontinence_care: '失禁护理',
}

const PRIORITY_LABELS: Record<string, string> = {
  care_capability: '照护能力',
  caregiver_quality: '护理人员质量',
  medical_conditions: '医疗条件',
  rehabilitation_capability: '康复能力',
  food_quality: '餐饮质量',
  living_environment: '居住环境',
  room_facilities: '房间设施',
  activity_space: '活动空间',
  transportation: '交通方便',
  near_major_hospital: '距离大型医院近',
  price: '价格',
  region: '区域',
}

const NO_EXACT_LABELS: Record<string, string> = {
  NO_VERIFIED_INSTITUTION_POOL: '当前没有可确认的机构资料可供安全推荐。',
  ALL_CANDIDATES_HAVE_HARD_CONFLICT: '当前机构池与已报告的关键护理需求存在较大差异。',
  REQUIRED_CAPABILITY_UNRESOLVED: '有关键护理需求仍需要进一步确认。',
  ONLY_SOFT_NEAR_MATCHES: '暂时没有完全符合全部偏好条件的合作机构。',
  ONLY_CONDITIONAL_CANDIDATES: '当前候选机构都需要先完成进一步评估。',
  NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES: '暂时没有完全符合全部偏好条件的合作机构。',
}

const isProvided = <T>(fact: InstitutionDisplayFactV11<T>): fact is Extract<InstitutionDisplayFactV11<T>, { availability: 'provided' }> =>
  fact.availability === 'provided'

const uniqueStrings = (values: readonly string[]): string[] => values.filter(
  (value, index) => value.length > 0 && values.indexOf(value) === index,
)

const institutionKey = (institutionId: string, recordRevision: number): string =>
  `${institutionId}#${recordRevision}`

const displayFor = (
  snapshot: RecommendationResultApplicationSnapshotV2,
  candidate: RecommendationCandidateEvaluationV2,
): InstitutionDisplaySnapshotV11 => {
  const display = snapshot.institutionDisplays.find((entry) =>
    entry.institutionId === candidate.institutionId && entry.recordRevision === candidate.recordRevision)
  if (display === undefined) {
    throw new Error('RESULT_SOURCE_ASSOCIATION_ERROR')
  }
  return display
}

const displayText = <T>(fact: InstitutionDisplayFactV11<T>): T | null =>
  isProvided(fact) && fact.effectiveVerification === 'current_verified' ? fact.value : null

const formatMoney = (amountMinor: number): string => {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return ''
  const yuan = Math.round(amountMinor / 100)
  return yuan > 0 ? `¥${yuan}` : ''
}

const formatPrice = (display: InstitutionDisplaySnapshotV11): string => {
  const fact = display.price.referenceMonthlyPrice
  const value = displayText(fact)
  if (value === null) return '参考费用暂未提供'
  if (value.kind === 'bounded') {
    const min = formatMoney(value.minAmountMinor)
    const max = formatMoney(value.maxAmountMinor)
    return min && max ? `${min}–${max} / 月` : '参考费用暂未提供'
  }
  const min = formatMoney(value.minAmountMinor)
  return min ? `${min} 起 / 月` : '参考费用暂未提供'
}

const formatType = (display: InstitutionDisplaySnapshotV11): string => {
  const primary = displayText(display.type.primaryType)
  if (primary !== null) return TYPE_LABELS[primary] || '机构类型待提供'
  const supported = displayText(display.type.supportedTypes)
  if (supported !== null && supported.length > 0) {
    const labels = uniqueStrings(supported.map((code) => TYPE_LABELS[code] || ''))
    if (labels.length > 0) return labels.join('、')
  }
  return '机构类型待提供'
}

const formatTags = (display: InstitutionDisplaySnapshotV11): ResultTagViewModelV2[] => {
  const codes: InstitutionTypeCode[] = []
  const primary = displayText(display.type.primaryType)
  if (primary !== null) codes.push(primary)
  const supported = displayText(display.type.supportedTypes)
  if (supported !== null) supported.forEach((code) => codes.push(code))
  return uniqueStrings(codes.map((code) => TYPE_LABELS[code] || ''))
    .slice(0, 3)
    .map((text) => ({ text, tone: 'neutral' as const }))
}

const reasonText = (reason: RecommendationReasonV2): { text: string, tone: ResultReasonViewModelV2['tone'] } | null => {
  if (!isRecommendationReasonVisibleV2(reason.reasonCode)) return null
  const base = recommendationReasonLabelV2(reason.reasonCode)
  if (reason.polarity === 'supported') return { text: base, tone: 'positive' }
  if (reason.polarity === 'conditional') return { text: `需进一步确认：${base}`, tone: 'warning' }
  if (reason.polarity === 'unverified') return { text: `资料待核验：${base}`, tone: 'warning' }
  return { text: `当前存在差异：${base}`, tone: reason.polarity === 'conflict' ? 'warning' : 'neutral' }
}

const differenceText = (difference: RecommendationDifferenceV2): { text: string, tone: ResultDifferenceViewModelV2['tone'] } | null => {
  if (!isRecommendationDifferenceVisibleV2(difference.differenceCode)) return null
  const label = recommendationDifferenceLabelV2(difference.differenceCode)
  if (difference.differenceCategory === 'SOFT_DIFFERENCE') return { text: `偏好差异：${label}`, tone: 'neutral' }
  if (difference.differenceCategory === 'CONDITIONAL_REQUIREMENT') return { text: label, tone: 'warning' }
  if (difference.differenceCategory === 'UNVERIFIED_DATA_GAP') return { text: `资料待核验：${label}`, tone: 'muted' }
  return { text: label, tone: 'warning' }
}

const mapReasons = (reasons: readonly RecommendationReasonV2[]): ResultReasonViewModelV2[] => {
  const values: ResultReasonViewModelV2[] = []
  reasons.forEach((reason, index) => {
    const mapped = reasonText(reason)
    if (mapped !== null) values.push({ ...mapped, key: `${reason.reasonCode}-${index}` })
  })
  return values
}

const mapDifferences = (differences: readonly RecommendationDifferenceV2[]): ResultDifferenceViewModelV2[] => {
  const values: ResultDifferenceViewModelV2[] = []
  differences.forEach((difference, index) => {
    const mapped = differenceText(difference)
    if (mapped !== null) values.push({ ...mapped, key: `${difference.differenceCode}-${index}` })
  })
  return values
}

const compactFact = (
  key: string,
  text: string,
  tone: ResultCompactFactViewModelV2['tone'],
): ResultCompactFactViewModelV2 => ({ key, text, tone })

const buildCompactFacts = (
  candidate: RecommendationCandidateEvaluationV2,
  display: InstitutionDisplaySnapshotV11,
): ResultCompactFactViewModelV2[] => {
  const facts: ResultCompactFactViewModelV2[] = []
  if (candidate.roomFit.fit === 'match') {
    facts.push(compactFact('room', '符合所选房型偏好', 'positive'))
  } else if (candidate.roomFit.fit === 'unknown') {
    facts.push(compactFact('room', '当前核验资料不足，需要进一步确认', 'warning'))
  } else if (candidate.roomFit.fit === 'mismatch') {
    throw new Error('INACTIVE_ROOM_MISMATCH_RUNTIME')
  }

  if (candidate.mealScheduleFit.fit === 'match') {
    facts.push(compactFact('meal', '餐次安排与所选偏好一致', 'positive'))
  } else if (candidate.mealScheduleFit.fit === 'mismatch') {
    facts.push(compactFact('meal', '该项安排与您的偏好存在差异', 'neutral'))
  } else if (candidate.mealScheduleFit.sourceState === 'data_unavailable') {
    facts.push(compactFact('meal', '当前资料显示该项服务暂不可用', 'warning'))
  } else if (candidate.mealScheduleFit.fit === 'unknown') {
    facts.push(compactFact('meal', '当前核验资料不足，需进一步确认', 'warning'))
  }

  if (candidate.nutrition.status === 'supported') {
    facts.push(compactFact('nutrition', candidate.nutrition.texture === 'easy_chew'
      ? '易咀嚼饮食支持已核验' : '特殊处理饮食支持已核验', 'positive'))
  } else if (candidate.nutrition.status === 'unavailable') {
    facts.push(compactFact('nutrition', '当前资料显示该项服务暂不可用', 'warning'))
  } else if (candidate.nutrition.status === 'requires_inquiry') {
    facts.push(compactFact('nutrition', '该项服务需要进一步向机构确认', 'warning'))
  } else if (candidate.nutrition.status === 'unknown') {
    facts.push(compactFact('nutrition', '当前核验资料不足，需进一步确认', 'warning'))
  }

  candidate.activityFit.displayFacts.forEach((fact) => {
    const source = fact.institutionEvidenceRef.effectiveSnapshot
    if (source !== null && source.valueType === 'stable_code' && source.value === 'present') {
      facts.push(compactFact(fact.fieldPath, fact.fieldPath === 'activity.indoorSpace'
        ? '室内活动空间：已提供' : '室外活动空间：已提供', 'neutral'))
    }
  })

  if (display.media.vr.state === 'unknown') {
    facts.push(compactFact('vr', 'VR 信息暂未提供', 'muted'))
  }
  return facts
}

const cardFromCandidate = (
  snapshot: RecommendationResultApplicationSnapshotV2,
  candidate: RecommendationCandidateEvaluationV2,
  isConditional: boolean,
  operationalKeys: ReadonlySet<string>,
): RecommendationInstitutionCardViewModelV2 => {
  const display = displayFor(snapshot, candidate)
  const name = displayText(display.identity.name)
  const region = displayText(display.identity.regionDisplayName)
  const cover = display.media.cover
  const advisories: string[] = []
  if (operationalKeys.has(institutionKey(candidate.institutionId, candidate.recordRevision))) {
    advisories.push('床位可用性需向机构确认；该提示不改变匹配结论。')
  }
  return {
    institutionId: candidate.institutionId,
    recordRevision: candidate.recordRevision,
    name: name === null ? '机构名称待核验' : name,
    region: region === null ? '区域信息待核验' : region,
    type: formatType(display),
    price: formatPrice(display),
    coverUrl: cover.url || '',
    hasCover: cover.state === 'current_verified' && cover.url !== null,
    tags: formatTags(display),
    reasons: mapReasons(candidate.reasons),
    differences: mapDifferences(candidate.differences),
    compactFacts: buildCompactFacts(candidate, display),
    advisories,
    vrLabel: display.media.vr.state === 'current_verified_available' ? 'VR 看院已准备' : '',
    detailLabel: '机构详情接入中',
    isConditional,
  }
}

const knownValue = <T>(fact: { status: string, value?: T }): T | undefined =>
  fact.status === 'known' ? fact.value : undefined

const buildFocusTags = (semantics: RecommendationSemanticResultV2): ResultTagViewModelV2[] => {
  const tags: ResultTagViewModelV2[] = []
  const careLevel = knownValue(semantics.elderSnapshot.adl.careLevel)
  if (typeof careLevel === 'string' && CARE_LEVEL_LABELS[careLevel]) tags.push({ text: CARE_LEVEL_LABELS[careLevel], tone: 'brand' })
  const mobility = knownValue(semantics.elderSnapshot.mobility.level)
  if (typeof mobility === 'string' && MOBILITY_LABELS[mobility]) tags.push({ text: MOBILITY_LABELS[mobility], tone: 'brand' })
  const priorities = semantics.elderSnapshot.preference.priorities
  priorities.slice(0, 3).forEach((priority) => {
    if (PRIORITY_LABELS[priority]) tags.push({ text: `您关注：${PRIORITY_LABELS[priority]}`, tone: 'neutral' })
  })
  const capabilities = semantics.elderSnapshot.specialCare.requiredCareCapabilities
  capabilities.forEach((requirement) => {
    if (requirement.status === 'required' && SPECIAL_CARE_LABELS[requirement.capability]) {
      tags.push({ text: SPECIAL_CARE_LABELS[requirement.capability], tone: 'warning' })
    }
  })
  if (semantics.elderReadiness !== 'ready') tags.push({ text: '部分需求待确认', tone: 'warning' })
  return tags.slice(0, 3)
}

const deriveCards = (
  snapshot: RecommendationResultApplicationSnapshotV2,
  operationalKeys: ReadonlySet<string>,
): { cards: RecommendationInstitutionCardViewModelV2[], conditionalCards: RecommendationInstitutionCardViewModelV2[] } => {
  const semantics = snapshot.preview.semantics
  // A blocked elder readiness result may still contain evaluator diagnostics or
  // candidate evaluations, but it must never expose those as recommendation
  // cards before the required clarification is resolved.
  if (semantics.elderReadiness !== 'ready') {
    return { cards: [], conditionalCards: [] }
  }
  const cardsSource = semantics.cards.length > 0
    ? semantics.cards
    : semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches
  const cards = cardsSource.map((candidate) => cardFromCandidate(snapshot, candidate, false, operationalKeys))
  const conditionalCards = semantics.conditionalCandidates.map((candidate) =>
    cardFromCandidate(snapshot, candidate, true, operationalKeys))
  return { cards, conditionalCards }
}

const stateFor = (
  semantics: RecommendationSemanticResultV2,
  cards: readonly RecommendationInstitutionCardViewModelV2[],
  conditionalCards: readonly RecommendationInstitutionCardViewModelV2[],
): { state: RecommendationResultPageStateV2, emptyReason: RecommendationResultPageViewModelV2['emptyReason'] } => {
  if (semantics.elderReadiness !== 'ready') {
    return { state: 'no_safe_recommendation', emptyReason: 'ELDER_READINESS_BLOCKED' }
  }
  if (cards.length > 0) return { state: semantics.exactMatch ? 'ready_exact' : 'ready_soft_near', emptyReason: null }
  if (conditionalCards.length > 0) return { state: 'ready_conditional', emptyReason: null }
  return { state: 'no_safe_recommendation', emptyReason: 'NO_SAFE_RECOMMENDATION' }
}

const visitAdvice = [
  '建议实地确认护理员配置与日常照护安排。',
  '建议确认夜间巡查和应急响应方式。',
  '建议确认康复服务是否另行收费。',
  '建议确认无障碍环境和医疗急救支持。',
]

export const createRecommendationResultViewModelV2 = (
  snapshot: RecommendationResultApplicationSnapshotV2,
): RecommendationResultPageViewModelV2 => {
  const semantics = snapshot.preview.semantics
  const operationalKeys = new Set(snapshot.operationalDisplayAdvisories.map((item) =>
    institutionKey(item.institutionId, item.recordRevision)))
  const selected = deriveCards(snapshot, operationalKeys)
  const state = stateFor(semantics, selected.cards, selected.conditionalCards)
  let headline = '先看清老人需要什么'
  let summary = '以下内容依据本次评估与开发目录中的结构化资料整理。'
  if (state.state === 'ready_exact') {
    headline = '关键护理需求已找到可确认匹配的候选机构'
    summary = '这些机构在当前资料和评估时间点下，满足主要护理条件；入住前仍建议实地确认。'
  } else if (state.state === 'ready_soft_near') {
    headline = '暂时没有完全符合全部偏好条件的合作机构'
    summary = '以下机构已经满足当前关键护理需求，但仍存在偏好差异，或部分生活适配资料需要进一步确认。'
  } else if (state.state === 'ready_conditional') {
    headline = '需要机构进一步评估的候选'
    summary = '这些候选不能直接视为已匹配，需要由机构进一步确认护理条件。'
  } else if (state.emptyReason === 'ELDER_READINESS_BLOCKED') {
    headline = '还需要补充或确认老人信息'
    summary = '需要先补充/确认老人相关信息；完成确认后系统才能继续评估机构，当前未生成机构推荐卡片。'
  } else if (semantics.noExactMatch !== undefined) {
    headline = '当前还没有可直接确认的安全推荐'
    summary = NO_EXACT_LABELS[semantics.noExactMatch.reasonCode]
      || '当前没有能够安全确认满足全部关键护理需求的机构。'
  }
  const resultAdvisories: string[] = []
  semantics.advisories.forEach((advisory) => {
    if (advisory.code === 'HIGH_CARE_LOW_BUDGET') {
      resultAdvisories.push('实际费用可能受护理等级、特殊护理和房型影响，建议预留一定预算空间。')
    }
  })
  return {
    state: state.state,
    headline,
    summary,
    focusTags: buildFocusTags(semantics),
    cards: selected.cards,
    conditionalCards: selected.conditionalCards,
    resultAdvisories,
    visitAdvice,
    mockDisclosure: snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY'
      ? '以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。' : null,
    hasMockDisclosure: snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY',
    datasetLabel: snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY' ? '开发 Mock 数据' : '合作机构资料',
    emptyReason: state.emptyReason,
    noSafeMessage: state.emptyReason === 'ELDER_READINESS_BLOCKED'
      ? '请返回画像补充或确认信息。' : state.state === 'no_safe_recommendation'
        ? '可以调整需求后重新生成，或咨询养老顾问确认下一步。' : '',
    actions: {
      canRetry: false,
      canAdjustNeeds: true,
      canContactConsultant: true,
      detailLabel: '机构详情接入中',
      listLabel: '合作机构列表接入中',
    },
  }
}

export type { RecommendationReasonCodeV2, RecommendationDifferenceCodeV2 }
