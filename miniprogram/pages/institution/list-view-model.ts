import type {
  InstitutionListApplicationSnapshotV12,
  InstitutionListDisplayItemV12,
  InstitutionListPageStateV12,
  InstitutionPresentationAvailability,
  InstitutionEffectiveVerification,
  InstitutionRouteSource,
} from '../../types/institution-list-detail'
import type { InstitutionTypeCode } from '../../types/institution'
import { readDirectoryMetadata } from '../../runtime/directory-metadata'
import { readInstitutionDirectoryInfo } from '../../runtime/institution-source-notes'

export interface InstitutionListNavigationIntentViewModel {
  institutionId: string
  recordRevision: number
  source: Extract<InstitutionRouteSource, 'direct_list' | 'recommendation'>
  sourceContextRef: string | null
}

export type InstitutionListDisplayGroupViewModel =
  | 'cards'
  | 'nearMatches'
  | 'conditionalCandidates'
  | 'other'

export interface InstitutionListItemViewModel {
  key: string
  institutionId: string
  recordRevision: number
  name: string
  nameStatus: string
  region: string
  regionStatus: string
  type: string
  typeStatus: string
  price: string
  priceStatus: string
  coverUrl: string
  hasCover: boolean
  tags: readonly { text: string; tone: 'neutral' | 'development' }[]
  vrLabel: string
  vrState: 'available' | 'unavailable' | 'unknown'
  recommendationGroup: InstitutionListDisplayGroupViewModel
  groupLabel: string
  showGroupHeading: boolean
  placementLabel: string
  navigationIntent: InstitutionListNavigationIntentViewModel
  card: {
    compact?: boolean
    phoneKey?: string
    title: string; region: string; price: string; feature: string; isDemo: boolean
    nature: string; address: string; addressStatus: string; phone: string
    notes: readonly string[]; factTags: readonly string[]
  }
}

export interface InstitutionListPageViewModelV12 {
  pageState: InstitutionListPageStateV12
  title: string
  description: string
  disclosure: string
  hasDisclosure: boolean
  items: readonly InstitutionListItemViewModel[]
  recommendedItems: readonly InstitutionListItemViewModel[]
  otherItems: readonly InstitutionListItemViewModel[]
  emptyTitle: string
  emptyMessage: string
  errorTitle: string
  errorMessage: string
  canRetry: boolean
  actionErrorMessage: string
}

const TYPE_LABELS: Record<InstitutionTypeCode, string> = {
  active_aging: '活力养老',
  medical_nursing_integrated: '医养结合',
  disability_care: '失能照护',
  dementia_care: '认知照护',
  rehabilitation_care: '康复照护',
}

const availabilityText = (availability: InstitutionPresentationAvailability): string => {
  if (availability === 'unknown') return '暂未提供'
  if (availability === 'unavailable') return '当前不可用'
  return ''
}

const verificationText = (verification: InstitutionEffectiveVerification): string => {
  if (verification === 'expired') return '核验已过期'
  if (verification === 'unverified') return '资料待核验'
  return '已核验'
}

const factStatus = (
  availability: InstitutionPresentationAvailability,
  verification: InstitutionEffectiveVerification,
): string => {
  const unavailable = availabilityText(availability)
  const verificationLabel = verificationText(verification)
  return unavailable.length > 0 ? `${unavailable} · ${verificationLabel}` : verificationLabel
}

const valueOrStatus = <T>(
  fact: { availability: InstitutionPresentationAvailability; value: T | null; effectiveVerification: InstitutionEffectiveVerification },
  format: (value: T) => string,
): { value: string; status: string } => {
  const value = fact.availability === 'provided' && fact.value !== null ? format(fact.value) : ''
  return {
    value: value.length > 0 ? value : availabilityText(fact.availability),
    status: factStatus(fact.availability, fact.effectiveVerification),
  }
}

const formatPrice = (fact: InstitutionListDisplayItemV12['referenceMonthlyPrice']): { value: string; status: string } =>
  valueOrStatus(fact, (price) => {
    const yuan = (amountMinor: number): string => amountMinor > 0 ? `¥${Math.round(amountMinor / 100)}` : ''
    const min = yuan(price.minAmountMinor)
    if (price.kind === 'starting_at') return min.length > 0 ? `${min} 起 / 月` : ''
    const max = price.maxAmountMinor === null ? '' : yuan(price.maxAmountMinor)
    return min.length > 0 && max.length > 0 ? `${min}–${max} / 月` : ''
  })

const formatTypes = (types: readonly InstitutionTypeCode[]): string => {
  const labels: string[] = []
  types.forEach((type) => {
    const label = TYPE_LABELS[type]
    if (label !== undefined && labels.indexOf(label) < 0) labels.push(label)
  })
  return labels.join('、')
}

const formatTags = (
  item: InstitutionListDisplayItemV12,
): readonly { text: string; tone: 'neutral' | 'development' }[] => item.verifiedDisplayTags.map((tag) => ({
  // The tag code is already produced by the frozen display projection.  The
  // UI maps only display-safe field labels; it does not infer new facts.
  text: tag.code || tag.fieldPath,
  tone: 'neutral',
}))

const formatItem = (
  item: InstitutionListDisplayItemV12,
  source: Extract<InstitutionRouteSource, 'direct_list' | 'recommendation'>,
  sourceContextRef: string | null,
  directoryMetadata: readonly { institutionId: string; recordRevision?: number; natureLabel?: string }[],
): InstitutionListItemViewModel => {
  const name = valueOrStatus(item.name, (value) => value)
  const region = valueOrStatus(item.region, (value) => value.displayName)
  const type = valueOrStatus(item.institutionType, formatTypes)
  const price = formatPrice(item.referenceMonthlyPrice)
  const metadata = directoryMetadata.find(row => row.institutionId === item.institutionId && (row.recordRevision === undefined || row.recordRevision === item.recordRevision))
  const vrLabel = item.vr.state === 'available'
    ? 'VR看院资料已核验'
    : item.vr.state === 'unavailable'
      ? 'VR资料暂不可用'
      : 'VR资料待确认'
  const recommendationGroup: InstitutionListDisplayGroupViewModel =
    item.recommendationPlacement === null ? 'other' : item.recommendationPlacement.group
  const placementLabel = recommendationGroup === 'other'
    ? '其他合作机构'
    : recommendationGroup === 'cards'
      ? '推荐候选'
      : recommendationGroup === 'nearMatches'
        ? '相近候选'
        : '条件候选'
  return {
    key: `${item.institutionId}#${item.recordRevision}`,
    institutionId: item.institutionId,
    recordRevision: item.recordRevision,
    name: name.value || '机构名称待提供',
    nameStatus: name.status,
    region: region.value || '区域信息待提供',
    regionStatus: region.status,
    type: type.value || '机构类型待提供',
    typeStatus: type.status,
    price: price.value || '参考费用暂未提供',
    priceStatus: price.status,
    coverUrl: item.cover.url || '',
    hasCover: item.cover.state === 'current_verified' && item.cover.url !== null,
    tags: formatTags(item),
    vrLabel,
    vrState: item.vr.state,
    recommendationGroup,
    groupLabel: placementLabel,
    showGroupHeading: false,
    placementLabel,
    navigationIntent: {
      institutionId: item.institutionId,
      recordRevision: item.recordRevision,
      source,
      sourceContextRef,
    },
    card: {
      nature: metadata && metadata.natureLabel ? metadata.natureLabel : '性质待确认',
      address: '地址资料请查看详情', addressStatus: '', phone: '公开电话状态请查看详情',
      notes: readInstitutionDirectoryInfo(item.institutionId, item.recordRevision).notes,
      // Ordinary directory decoration may allocate evidence-gated nature to one chip.
      // Other sources keep basic facts; no service/type-derived T2/T3 chips.
      factTags: [],
      title: item.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
        ? name.value.replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, '') || '机构名称待确认' : name.value || '机构名称待确认',
      region: item.region.availability === 'provided' && item.region.effectiveVerification === 'current_verified' ? region.value : '区域待确认',
      price: item.referenceMonthlyPrice.availability === 'provided' && item.referenceMonthlyPrice.effectiveVerification === 'current_verified' ? '参考月费 ' + price.value : '费用待咨询',
      feature: metadata && metadata.natureLabel ? metadata.natureLabel : item.institutionType.availability === 'provided' && item.institutionType.effectiveVerification === 'current_verified' ? type.value : '',
      isDemo: item.recordProvenance === 'MOCK_DEVELOPMENT_ONLY',
    },
  }
}

const withGroupHeadings = (
  items: readonly InstitutionListItemViewModel[],
): InstitutionListItemViewModel[] => {
  const seenGroups = new Set<InstitutionListDisplayGroupViewModel>()
  return items.map((item) => {
    const showGroupHeading = !seenGroups.has(item.recommendationGroup)
    seenGroups.add(item.recommendationGroup)
    return { ...item, showGroupHeading }
  })
}

const errorCopy = (
  pageState: InstitutionListPageStateV12,
): { title: string; message: string } => {
  if (pageState === 'source_context_error') {
    return {
      title: '原推荐上下文已失效',
      message: '暂时无法按照原来的推荐资料展示机构，请返回推荐结果后重试。',
    }
  }
  if (pageState === 'projection_error') {
    return {
      title: '机构资料暂时无法展示',
      message: '当前资料未能通过展示校验，请稍后重试。',
    }
  }
  return {
    title: '机构资料暂时不可用',
    message: '当前合作机构资料未能读取，请稍后重试。',
  }
}

export const createInstitutionListPageViewModel = (
  snapshot: InstitutionListApplicationSnapshotV12,
): InstitutionListPageViewModelV12 => {
  const candidateSource: Extract<InstitutionRouteSource, 'direct_list' | 'recommendation'> =
    snapshot.source === 'recommendation' ? 'recommendation' : 'direct_list'
  const candidateSourceContextRef = candidateSource === 'recommendation' ? snapshot.sourceContextRef : null
  const directoryMetadata = readDirectoryMetadata()
  const mappedRecommendedItems = snapshot.recommendedCandidates.map((item) =>
    formatItem(item, candidateSource, candidateSourceContextRef, directoryMetadata))
  const mappedOtherItems = snapshot.otherCurrentPartners.map((item) =>
    formatItem(item, 'direct_list', null, directoryMetadata))
  const items = withGroupHeadings(mappedRecommendedItems.concat(mappedOtherItems))
  const recommendedItems = items.slice(0, mappedRecommendedItems.length)
  const otherItems = items.slice(mappedRecommendedItems.length)
  return {
    pageState: items.length > 0 ? 'ready' : 'empty',
    title: snapshot.source === 'recommendation' ? '推荐机构资料' : '合作机构列表',
    description: snapshot.source === 'recommendation'
      ? '以下资料来自本次推荐的同一机构版本；请结合实际沟通进一步确认。'
      : '这里展示平台当前可读取的合作机构资料，先了解基本情况，再决定下一步。',
    disclosure: snapshot.dataDisclosure.text || '',
    hasDisclosure: snapshot.dataDisclosure.text !== null,
    items,
    recommendedItems,
    otherItems,
    emptyTitle: '当前暂无可展示的合作机构资料',
    emptyMessage: '资料补充后，这里会展示机构的基础信息、参考费用与可核验服务。',
    errorTitle: '',
    errorMessage: '',
    canRetry: false,
    actionErrorMessage: '',
  }
}

export const createInstitutionListErrorViewModel = (
  pageState: Exclude<InstitutionListPageStateV12, 'loading' | 'ready' | 'empty'>,
): InstitutionListPageViewModelV12 => {
  const copy = errorCopy(pageState)
  return {
    pageState,
    title: '合作机构列表',
    description: '这里展示平台当前可读取的合作机构资料。',
    disclosure: '',
    hasDisclosure: false,
    items: [],
    recommendedItems: [],
    otherItems: [],
    emptyTitle: '',
    emptyMessage: '',
    errorTitle: copy.title,
    errorMessage: copy.message,
    canRetry: true,
    actionErrorMessage: '',
  }
}

export const createInstitutionListLoadingViewModel = (): InstitutionListPageViewModelV12 => ({
  pageState: 'loading',
  title: '合作机构列表',
  description: '正在读取当前合作机构资料。',
  disclosure: '',
  hasDisclosure: false,
  items: [],
  recommendedItems: [],
  otherItems: [],
  emptyTitle: '',
  emptyMessage: '',
  errorTitle: '',
  errorMessage: '',
  canRetry: false,
  actionErrorMessage: '',
})
