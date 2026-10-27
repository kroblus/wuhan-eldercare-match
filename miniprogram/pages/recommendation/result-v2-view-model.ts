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
  primaryReasons: ResultReasonViewModelV2[]
  additionalReasons: ResultReasonViewModelV2[]
  matchLabel: string
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
  NO_VERIFIED_INSTITUTION_POOL: '现有机构护理服务资料还不足以确认哪些机构适合当前需求。',
  ALL_CANDIDATES_HAVE_HARD_CONFLICT: '当前机构池与已报告的关键护理需求存在较大差异。',
  REQUIRED_CAPABILITY_UNRESOLVED: '关键护理条件缺少足够核验资料，目前还不能确认机构是否适合。',
  ONLY_SOFT_NEAR_MATCHES: '暂时没有完全符合全部偏好条件的机构。',
  ONLY_CONDITIONAL_CANDIDATES: '当前候选机构都需要先完成进一步评估。',
  NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES: '暂时没有完全符合全部偏好条件的机构。',
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
  // An unverified synthetic label may identify a disclosed demo case. It is
  // never a verified institutional fact and never feeds matching or ranking.
  const syntheticIdentity = snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY'
    && display.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
  const demoName = syntheticIdentity && display.identity.name.availability === 'provided'
    && display.identity.name.effectiveVerification === 'unverified' ? display.identity.name.value : null
  const demoRegion = syntheticIdentity && display.identity.regionDisplayName.availability === 'provided'
    && display.identity.regionDisplayName.effectiveVerification === 'unverified' ? display.identity.regionDisplayName.value : null
  const cover = display.media.cover
  const advisories: string[] = []
  const reasons = mapReasons(candidate.reasons)
  if (operationalKeys.has(institutionKey(candidate.institutionId, candidate.recordRevision))) {
    advisories.push('床位可用性需向机构确认；该提示不改变匹配结论。')
  }
  return {
    institutionId: candidate.institutionId,
    recordRevision: candidate.recordRevision,
    name: name === null ? demoName === null ? '机构名称待核验' : `演示名称：${demoName}` : name,
    region: region === null ? demoRegion === null ? '区域信息待核验' : `演示区域：${demoRegion}` : region,
    type: formatType(display),
    price: formatPrice(display),
    coverUrl: cover.url || '',
    hasCover: cover.state === 'current_verified' && cover.url !== null,
    tags: formatTags(display),
    reasons,
    primaryReasons: reasons.slice(0, 3),
    additionalReasons: reasons.slice(3),
    matchLabel: isConditional ? '需要进一步评估' : candidate.matchTier === 'EXACT' ? '主要护理条件可确认' : '相近候选 · 部分偏好待确认',
    differences: mapDifferences(candidate.differences),
    compactFacts: buildCompactFacts(candidate, display),
    advisories,
    vrLabel: display.media.vr.state === 'current_verified_available' ? 'VR 看院已准备' : '',
    detailLabel: '查看机构详情',
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
  '是否接收符合老人当前照护情况的住户，所需护理能力如何确认。',
  '当前收费、包含项目和另行收费项目分别是什么。',
  '近期是否有可入住床位，是否需要等候。',
  '入住条件、所需材料，以及是否支持参观、如何安排。',
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
  let summary = '照护需求已整理，以下依据本次画像与机构资料说明判断结果。'
  if (state.state === 'ready_exact') {
    headline = '关键护理需求已找到可确认匹配的候选机构'
    summary = '这些机构在当前资料和评估时间点下，满足主要护理条件；入住前仍建议实地确认。'
  } else if (state.state === 'ready_soft_near') {
    headline = '有相近候选，部分偏好仍需确认'
    summary = '以下机构已经满足当前关键护理需求，但部分偏好尚未完全符合或确认，请逐项查看差异。'
  } else if (state.state === 'ready_conditional') {
    headline = '需要进一步评估的机构'
    summary = '这些机构尚不能直接视为满足全部护理需求，需要机构进一步确认。'
  } else if (state.emptyReason === 'ELDER_READINESS_BLOCKED') {
    headline = '部分照护事项仍需确认'
    summary = '问卷已填写完成，但部分照护事项仍需核实，确认后才能继续判断机构是否适合。当前未生成机构推荐卡片。'
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
      ? '以下机构、价格与护理能力均为虚构演示资料，不代表真实养老机构信息。' : null,
    hasMockDisclosure: snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY',
    datasetLabel: snapshot.sourceContext.datasetMode === 'MOCK_DEVELOPMENT_ONLY' ? '虚构机构演示目录' : '公开机构资料',
    emptyReason: state.emptyReason,
    noSafeMessage: state.emptyReason === 'ELDER_READINESS_BLOCKED'
      ? '请返回画像查看具体待确认事项；若回答不准确再修改，重复提交相同答案不会改变这些条件。' : state.state === 'no_safe_recommendation'
        ? '未确认不代表机构不提供相关服务。可以先浏览已收录机构，查看公开资料，再向机构核实；普通目录不是推荐名单。' : '',
    actions: {
      canRetry: false,
      canAdjustNeeds: true,
      canContactConsultant: true,
      detailLabel: '查看机构详情',
      listLabel: '浏览已收录的养老机构',
    },
  }
}

export type { RecommendationReasonCodeV2, RecommendationDifferenceCodeV2 }
