import type {
  InstitutionField,
  InstitutionRecord,
  InstitutionTypeCode,
} from '../../types/institution'
import type {
  RecommendationAdvisoryAttachment,
  RecommendationDifference,
  RecommendationItem,
  RecommendationReason,
} from '../../types/recommendation'
import type {
  RecommendationResultApplicationSnapshot,
} from '../../types/recommendation-preview'

export type RecommendationResultPageState =
  | 'ready_exact'
  | 'ready_soft_near'
  | 'ready_conditional'
  | 'no_safe_recommendation'

export type ResultTagTone = 'brand' | 'neutral' | 'warning' | 'development'

export interface ResultTagViewModel {
  text: string
  tone: ResultTagTone
}

export interface ResultReasonViewModel {
  key: string
  text: string
  tone: 'positive' | 'neutral' | 'warning'
}

export interface ResultDifferenceViewModel {
  key: string
  text: string
  tone: 'neutral' | 'warning' | 'muted'
}

export interface RecommendationInstitutionCardViewModel {
  institutionId: string
  recordRevision: number
  name: string
  region: string
  type: string
  price: string
  coverUrl: string
  hasCover: boolean
  tags: ResultTagViewModel[]
  reasons: ResultReasonViewModel[]
  differences: ResultDifferenceViewModel[]
  advisories: string[]
  vrLabel: string
  detailLabel: string
  isConditional: boolean
}

export interface RecommendationResultViewModel {
  state: RecommendationResultPageState
  headline: string
  summary: string
  focusTags: ResultTagViewModel[]
  cards: RecommendationInstitutionCardViewModel[]
  conditionalCards: RecommendationInstitutionCardViewModel[]
  visitAdvice: string[]
  hasMockDisclosure: boolean
  datasetLabel: string
  noSafeMessage: string
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
  TYPE_DIFFERENT: '机构类型偏好存在差异',
  TYPE_UNKNOWN: '机构类型资料待确认',
  PRIORITY_STRUCTURED_MATCH: '关注重点有结构化支持',
  PRIORITY_NOT_MET: '部分关注重点存在差异',
  PRIORITY_UNVERIFIED: '关注重点资料待核验',
  PRIORITY_NOT_SCORABLE: '部分关注重点暂无法判断',
  DATA_NOT_VERIFIED: '部分机构资料待核验',
}

const DIFFERENCE_LABELS: Record<RecommendationDifference['differenceCode'], string> = {
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
  PRIORITY_NOT_SCORABLE: '一项用户关注内容暂无法结构化判断',
  REHABILITATION_SOFT_DATA_GAP: '康复服务相关资料仍需确认',
}

const NO_EXACT_LABELS: Record<string, string> = {
  NO_VERIFIED_INSTITUTION_POOL: '当前没有可确认的机构资料可供安全推荐。',
  ALL_CANDIDATES_HAVE_HARD_CONFLICT: '当前机构池与已报告的关键护理需求存在较大差异。',
  REQUIRED_CAPABILITY_UNRESOLVED: '有关键护理需求仍需要进一步确认。',
  ONLY_SOFT_NEAR_MATCHES: '暂时没有完全符合全部偏好条件的已收录机构。',
  ONLY_CONDITIONAL_CANDIDATES: '当前候选机构都需要先完成进一步评估。',
  NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES: '暂时没有完全符合全部偏好条件的已收录机构。',
}

const NO_SAFE_DEFAULT = '当前已收录机构中，暂时没有能够安全确认满足全部关键护理需求的机构。'

const uniqueStrings = (values: readonly string[]): string[] => {
  const result: string[] = []
  values.forEach((value) => {
    if (value && result.indexOf(value) < 0) {
      result.push(value)
    }
  })
  return result
}

const fieldValue = <T>(field: InstitutionField<T>): T | null =>
  field.availability === 'provided' ? field.value : null

const verifiedFieldValue = <T>(field: InstitutionField<T>, evaluationAsOf: string): T | null => {
  if (field.availability !== 'provided' || field.verification.status !== 'verified') {
    return null
  }
  if (field.verification.validUntil !== undefined) {
    const validUntil = Date.parse(field.verification.validUntil)
    const asOf = Date.parse(evaluationAsOf)
    if (Number.isFinite(validUntil) && Number.isFinite(asOf)) {
      if (validUntil < asOf) return null
    } else if (field.verification.validUntil < evaluationAsOf) {
      return null
    }
  }
  return field.value
}

const optionalFieldValue = <T>(field: InstitutionField<T> | undefined): T | null =>
  field === undefined ? null : fieldValue(field)

const typeLabel = (code: string): string => TYPE_LABELS[code as InstitutionTypeCode] || ''

const fieldText = (field: InstitutionField<string>, fallback: string): string => {
  const value = fieldValue(field)
  return value === null || value.trim().length === 0 ? fallback : value
}

const formatMoney = (amountMinor: number): string => {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return ''
  }
  const yuan = Math.round(amountMinor / 100)
  if (yuan <= 0) {
    return ''
  }
  return `¥${yuan}`
}

const formatPrice = (record: InstitutionRecord, evaluationAsOf: string): string => {
  const reference = verifiedFieldValue(record.price.referenceMonthlyPrice, evaluationAsOf)
  if (reference === null) {
    return '参考费用暂未提供'
  }
  const range = reference.range
  if (range.kind === 'bounded') {
    const min = formatMoney(range.min.amountMinor)
    const max = formatMoney(range.max.amountMinor)
    return min && max ? `${min}–${max} / 月` : '参考费用暂未提供'
  }
  const min = formatMoney(range.min.amountMinor)
  return min ? `${min} 起 / 月` : '参考费用暂未提供'
}

const formatType = (record: InstitutionRecord): string => {
  const primary = optionalFieldValue(record.typeProfile.primaryType)
  if (primary !== null) {
    return TYPE_LABELS[primary] || '机构类型待提供'
  }
  const supported = fieldValue(record.typeProfile.supportedTypes)
  if (supported !== null && supported.length > 0) {
    const labels = uniqueStrings(supported.map((code) => typeLabel(code)))
    if (labels.length > 0) {
      return labels.join('、')
    }
  }
  return '机构类型待提供'
}

const findCoverUrl = (record: InstitutionRecord, evaluationAsOf: string): string => {
  const mediaId = verifiedFieldValue(record.identity.coverMediaId, evaluationAsOf)
  if (mediaId === null) {
    return ''
  }
  for (let index = 0; index < record.media.length; index += 1) {
    const media = record.media[index]
    if (media.mediaId === mediaId && media.role === 'cover') {
      const url = verifiedFieldValue(media.url, evaluationAsOf)
      if (url !== null && url.trim().length > 0) {
        return url
      }
    }
  }
  return ''
}

const structuredInstitutionTags = (record: InstitutionRecord): ResultTagViewModel[] => {
  const primary = optionalFieldValue(record.typeProfile.primaryType)
  const supported = fieldValue(record.typeProfile.supportedTypes)
  const codes: string[] = []
  if (primary !== null) {
    codes.push(primary)
  }
  if (supported !== null) {
    supported.forEach((code) => codes.push(code))
  }
  return uniqueStrings(codes.map(typeLabel))
    .slice(0, 3)
    .map((text) => ({ text, tone: 'neutral' as const }))
}

const evidenceDetailLabel = (reason: RecommendationReason): string => {
  for (let index = 0; index < reason.institutionEvidenceRefs.length; index += 1) {
    const path = reason.institutionEvidenceRefs[index].fieldPath
    const specialMatch = path.match(/^capabilities\.specialCare\.([^\.]+)$/)
    if (specialMatch !== null) {
      return SPECIAL_CARE_LABELS[specialMatch[1]] || '特殊护理'
    }
    if (path.indexOf('careLevelAcceptance') >= 0) return '照护等级'
    if (path.indexOf('mobilitySupport') >= 0) return '行动支持'
    if (path.indexOf('cognitiveSupport') >= 0) return '认知照护'
    if (path === 'price.referenceMonthlyPrice') return '参考费用'
    if (path === 'identity.regionCode') return '区域'
    if (path === 'typeProfile.supportedTypes') return '机构类型'
    if (path.indexOf('rehabilitation') >= 0) return '康复支持'
  }
  return ''
}

const reasonText = (reason: RecommendationReason): { text: string, tone: ResultReasonViewModel['tone'] } => {
  const detail = evidenceDetailLabel(reason)
  let base = REASON_LABELS[reason.reasonCode] || '当前结果包含一项结构化匹配信息'
  if (reason.reasonCode === 'SPECIAL_CARE_SUPPORTED' && detail) {
    base = `${detail}能力可匹配`
  }
  if (reason.polarity === 'supported') {
    return { text: base, tone: 'positive' }
  }
  if (reason.polarity === 'conditional') {
    return { text: `需进一步确认：${base}`, tone: 'warning' }
  }
  if (reason.polarity === 'unverified') {
    return { text: `资料待核验：${base}`, tone: 'warning' }
  }
  return { text: `当前存在差异：${base}`, tone: reason.polarity === 'conflict' ? 'warning' : 'neutral' }
}

const differenceText = (
  difference: RecommendationDifference,
): { text: string, tone: ResultDifferenceViewModel['tone'] } => {
  const label = DIFFERENCE_LABELS[difference.differenceCode]
  if (difference.differenceCategory === 'SOFT_DIFFERENCE') {
    return { text: `偏好差异：${label}`, tone: 'neutral' }
  }
  if (difference.differenceCategory === 'CONDITIONAL_REQUIREMENT') {
    return { text: label, tone: 'warning' }
  }
  if (difference.differenceCategory === 'UNVERIFIED_DATA_GAP') {
    return { text: `资料待核验：${label}`, tone: 'muted' }
  }
  return { text: label, tone: 'warning' }
}

const availabilityAdvisoryText = (advisory: RecommendationAdvisoryAttachment): string => {
  for (let index = 0; index < advisory.advisoryEvidenceRefs.length; index += 1) {
    const evidence = advisory.advisoryEvidenceRefs[index]
    if (evidence.fieldPath !== 'operations.bedAvailability') {
      continue
    }
    if (evidence.snapshot.status === 'available') {
      return '当前床位信息：显示有床位，入住前请再次咨询'
    }
    if (evidence.snapshot.status === 'limited') {
      return '当前床位信息：余量有限，入住前请咨询'
    }
    if (evidence.snapshot.status === 'unavailable') {
      return '当前床位信息：显示暂无床位；该动态信息不改变匹配结论'
    }
    return '当前床位：需咨询'
  }
  return '当前床位：需咨询'
}

const advisoryTexts = (
  snapshot: RecommendationResultApplicationSnapshot,
  record: InstitutionRecord,
): string[] => snapshot.advisories
  .filter((advisory: RecommendationAdvisoryAttachment) => advisory.institutionId === record.institutionId
    && advisory.recordRevision === record.recordRevision)
  .map((advisory: RecommendationAdvisoryAttachment) => advisory.advisoryCode === 'AVAILABILITY_DISPLAY_ONLY'
    ? availabilityAdvisoryText(advisory)
    : '押金或一次性费用需向机构咨询')
  .filter((text: string, index: number, values: string[]) => values.indexOf(text) === index)

const vrLabel = (record: InstitutionRecord, evaluationAsOf: string): string => {
  if (record.vr.status !== 'available') {
    return ''
  }
  const url = verifiedFieldValue(record.vr.url, evaluationAsOf)
  if (url !== null && url.trim().length > 0 && record.vr.scenes.length > 0) {
    return 'VR 看院已准备'
  }
  return ''
}

const findRecord = (
  records: readonly InstitutionRecord[],
  item: RecommendationItem,
): InstitutionRecord | null => {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.institutionId === item.institutionId && record.recordRevision === item.recordRevision) {
      return record
    }
  }
  return null
}

const cardFromItem = (
  snapshot: RecommendationResultApplicationSnapshot,
  item: RecommendationItem,
  isConditional: boolean,
): RecommendationInstitutionCardViewModel | null => {
  const record = findRecord(snapshot.institutionRecords, item)
  if (record === null) {
    throw new Error('RECOMMENDATION_RESULT_INSTITUTION_SOURCE_MISSING')
  }
  if (!isConditional && item.matchTier !== 'EXACT' && item.matchTier !== 'SOFT_NEAR') {
    return null
  }
  if (isConditional && item.matchTier !== 'CONDITIONAL') {
    return null
  }
  const coverUrl = findCoverUrl(record, snapshot.evaluationAsOf)
  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    name: fieldText(record.identity.name, '机构名称待提供'),
    region: fieldText(record.identity.regionDisplayName, '区域信息待提供'),
    type: formatType(record),
    price: formatPrice(record, snapshot.evaluationAsOf),
    coverUrl,
    hasCover: coverUrl.length > 0,
    tags: structuredInstitutionTags(record),
    reasons: item.reasons.map((reason: RecommendationReason, index: number) => ({
      ...reasonText(reason),
      key: `${reason.reasonCode}-${index}`,
    })),
    differences: item.differences.map((difference: RecommendationDifference, index: number) => ({
      ...differenceText(difference),
      key: `${difference.differenceCode}-${index}`,
    })),
    advisories: advisoryTexts(snapshot, record),
    vrLabel: vrLabel(record, snapshot.evaluationAsOf),
    detailLabel: '机构详情接入中',
    isConditional,
  }
}

const knownValue = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  return record.status === 'known' ? record.value : undefined
}

const buildFocusTags = (
  semantics: RecommendationResultApplicationSnapshot['preview']['semantics'],
): ResultTagViewModel[] => {
  const tags: ResultTagViewModel[] = []
  const careLevel = knownValue(semantics.elderSnapshot.adl.careLevel)
  if (typeof careLevel === 'string' && CARE_LEVEL_LABELS[careLevel]) {
    tags.push({ text: CARE_LEVEL_LABELS[careLevel], tone: 'brand' })
  }
  const mobility = knownValue(semantics.elderSnapshot.mobility.level)
  if (typeof mobility === 'string' && MOBILITY_LABELS[mobility]) {
    tags.push({ text: MOBILITY_LABELS[mobility], tone: 'brand' })
  }
  const rehabilitation = knownValue(semantics.elderSnapshot.health.rehabilitationNeed)
  if (rehabilitation === 'required') {
    tags.push({ text: '康复需求明确', tone: 'brand' })
  } else if (rehabilitation === 'possible') {
    tags.push({ text: '可能需要康复', tone: 'neutral' })
  }
  const wandering = knownValue(semantics.elderSnapshot.cognition.wanderingRisk)
  if (wandering === 'present') {
    tags.push({ text: '走失风险需关注', tone: 'warning' })
  }
  const capabilities = semantics.elderSnapshot.specialCare.requiredCareCapabilities
  capabilities.forEach((requirement: typeof capabilities[number]) => {
    if (requirement.status === 'required' && SPECIAL_CARE_LABELS[requirement.capability]) {
      tags.push({ text: SPECIAL_CARE_LABELS[requirement.capability], tone: 'warning' })
    }
  })
  if (semantics.elderReadiness !== 'ready') {
    tags.push({ text: '部分需求待确认', tone: 'warning' })
  }
  return tags.slice(0, 3)
}

const selectCards = (
  snapshot: RecommendationResultApplicationSnapshot,
): {
  cards: RecommendationInstitutionCardViewModel[]
  conditionalCards: RecommendationInstitutionCardViewModel[]
} => {
  const semantics = snapshot.preview.semantics
  const sourceItems: readonly RecommendationItem[] = semantics.items.length > 0
    ? semantics.items
    : semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches
  const cards: RecommendationInstitutionCardViewModel[] = []
  sourceItems.forEach((item: RecommendationItem) => {
    const card = cardFromItem(snapshot, item, false)
    if (card !== null) cards.push(card)
  })
  const conditionalCards: RecommendationInstitutionCardViewModel[] = []
  semantics.conditionalCandidates.forEach((item: RecommendationItem) => {
    const card = cardFromItem(snapshot, item, true)
    if (card !== null) conditionalCards.push(card)
  })
  return { cards, conditionalCards }
}

const deriveState = (
  semantics: RecommendationResultApplicationSnapshot['preview']['semantics'],
  cards: readonly RecommendationInstitutionCardViewModel[],
  conditionalCards: readonly RecommendationInstitutionCardViewModel[],
): RecommendationResultPageState => {
  if (cards.length > 0) {
    return semantics.exactMatch ? 'ready_exact' : 'ready_soft_near'
  }
  if (conditionalCards.length > 0) {
    return 'ready_conditional'
  }
  return 'no_safe_recommendation'
}

export const createRecommendationResultViewModel = (
  snapshot: RecommendationResultApplicationSnapshot,
): RecommendationResultViewModel => {
  const selected = selectCards(snapshot)
  const semantics = snapshot.preview.semantics
  const state = deriveState(semantics, selected.cards, selected.conditionalCards)
  let headline = '先看清老人需要什么'
  let summary = '以下内容依据本次评估、需求画像与机构资料整理。'
  if (state === 'ready_exact') {
    headline = '关键护理需求已找到可确认匹配的候选机构'
    summary = '这些机构在当前资料和评估时间点下，满足主要护理条件；入住前仍建议实地确认。'
  } else if (state === 'ready_soft_near') {
    headline = '暂时没有完全符合全部偏好条件的已收录机构'
    summary = '以下机构已经满足当前关键护理需求，但在预算、区域或机构类型等偏好上存在差异。'
  } else if (state === 'ready_conditional') {
    headline = '需要机构进一步评估的候选'
    summary = '这些候选不能直接视为已匹配，需要由机构进一步确认护理条件。'
  } else if (semantics.noExactMatch !== undefined) {
    headline = '当前还没有可直接确认的安全推荐'
    summary = NO_EXACT_LABELS[semantics.noExactMatch.reasonCode]
      || NO_SAFE_DEFAULT
  }
  const visitAdvice = [
    '建议实地确认护理员配置与日常照护安排。',
    '建议确认夜间巡查和应急响应方式。',
    '建议确认康复服务是否另行收费。',
    '建议确认无障碍环境和医疗急救支持。',
  ]
  return {
    state,
    headline,
    summary,
    focusTags: buildFocusTags(semantics),
    cards: selected.cards,
    conditionalCards: selected.conditionalCards,
    visitAdvice,
    hasMockDisclosure: snapshot.datasetMode === 'MOCK_DEVELOPMENT_ONLY',
    datasetLabel: snapshot.datasetMode === 'MOCK_DEVELOPMENT_ONLY' ? '开发 Mock 数据' : '已收录机构资料',
    noSafeMessage: state === 'no_safe_recommendation'
      ? '可以调整需求后重新生成，或咨询养老顾问确认下一步。'
      : '',
  }
}
