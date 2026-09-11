import type {
  InstitutionCapabilityDisplayItem,
  InstitutionDetailApplicationSnapshotV12,
  InstitutionDetailMediaDisplay,
  InstitutionDetailPageStateV12,
  InstitutionDetailRoomDisplay,
  InstitutionEffectiveVerification,
  InstitutionPresentationAvailability,
} from '../../types/institution-list-detail'
import type { InstitutionEffectiveCapabilityStatus } from '../../types/institution'
import {
  isRecommendationDifferenceVisibleV2,
  isRecommendationReasonVisibleV2,
  recommendationDifferenceLabelV2,
  recommendationReasonLabelV2,
  recommendationTierLabelV2,
} from '../recommendation/recommendation-display-semantics'

export interface InstitutionDetailFactRowViewModel {
  key: string
  label: string
  value: string
  status: string
  verificationLabel: string
  statusSummary: string
  statusTone: 'positive' | 'neutral' | 'warning' | 'muted'
}

export interface InstitutionDetailCapabilityViewModel {
  key: string
  label: string
  status: string
  verification: string
  tone: 'positive' | 'neutral' | 'warning' | 'muted'
}

export interface InstitutionDetailRoomViewModel {
  key: string
  name: string
  type: string
  rows: readonly InstitutionDetailFactRowViewModel[]
  hasMedia: boolean
}

export interface InstitutionDetailMediaViewModel {
  hasCover: boolean
  coverUrl: string
  gallery: readonly { key: string; url: string; caption: string; status: string }[]
  vrLabel: string
  vrState: 'available' | 'unavailable' | 'unknown'
  canOpenVr: boolean
}

export interface InstitutionDetailRecommendationViewModel {
  tierLabel: string
  reasons: readonly InstitutionDetailFactRowViewModel[]
  differences: readonly InstitutionDetailFactRowViewModel[]
}

export interface InstitutionDetailPageViewModelV12 {
  pageState: 'ready'
  title: string
  description: string
  disclosure: string
  hasDisclosure: boolean
  contextLabel: string
  historyLabel: string
  revisionNotice: string
  canViewCurrentRevision: boolean
  currentRevisionLabel: string
  recommendation: InstitutionDetailRecommendationViewModel | null
  basicRows: readonly InstitutionDetailFactRowViewModel[]
  media: InstitutionDetailMediaViewModel
  capabilityGroups: readonly {
    key: string
    title: string
    items: readonly InstitutionDetailCapabilityViewModel[]
  }[]
  staffingRows: readonly InstitutionDetailFactRowViewModel[]
  medicalRows: readonly InstitutionDetailFactRowViewModel[]
  rooms: readonly InstitutionDetailRoomViewModel[]
  mealRows: readonly InstitutionDetailFactRowViewModel[]
  activityRows: readonly InstitutionDetailFactRowViewModel[]
  transportRows: readonly InstitutionDetailFactRowViewModel[]
  hospitalRows: readonly InstitutionDetailFactRowViewModel[]
  priceRows: readonly InstitutionDetailFactRowViewModel[]
  qualificationRows: readonly InstitutionDetailFactRowViewModel[]
}

export interface InstitutionDetailErrorViewModelV12 {
  pageState: Exclude<InstitutionDetailPageStateV12, 'loading' | 'ready'>
  title: string
  message: string
  canRetry: boolean
}

type FactLike = {
  availability: InstitutionPresentationAvailability
  value: unknown
  effectiveVerification: InstitutionEffectiveVerification
}

const CODE_LABELS: Record<string, string> = {
  active_aging: '活力养老',
  medical_nursing_integrated: '医养结合',
  disability_care: '失能照护',
  dementia_care: '认知照护',
  rehabilitation_care: '康复照护',
  independent: '自理照护',
  light_care: '轻度照护',
  semi_disabled: '半失能照护',
  disabled: '失能照护',
  severely_disabled: '重度失能照护',
  wheelchair_support: '轮椅支持',
  bedbound_support: '长期卧床支持',
  transfer_support: '床椅转移支持',
  dementia_acceptance: '认知症接收',
  wandering_risk_support: '走失风险支持',
  round_the_clock_care: '24小时照护',
  one_to_one_caregiver: '一对一护工',
  night_care: '夜间重点照护',
  dementia_unit: '认知症专区',
  rehabilitation_training: '康复训练',
  tube_feeding: '鼻饲护理',
  catheter_care: '导尿护理',
  pressure_injury_care: '压疮护理',
  incontinence_care: '失禁护理',
  available: '可提供',
  unavailable: '暂不可用',
  requires_inquiry: '需进一步确认',
  unknown: '暂不明确',
  three_meals: '一日三餐',
  three_meals_one_snack: '一日三餐一加餐',
  three_meals_two_snacks: '一日三餐两加餐',
  other: '其他安排',
  yes: '有',
  no: '无',
  present: '已提供',
  absent: '未提供',
  current_verified: '已核验',
  unverified: '资料待核验',
  expired: '核验已过期',
  dance: '舞蹈',
  calligraphy: '书法',
  arts_crafts: '手工艺',
  chess_cards: '棋牌',
  general_activity: '日常活动',
  music: '音乐',
  fitness: '健身',
  doctor: '医生',
  nurse: '护士',
  caregiver: '护理员',
  rehabilitation_therapist: '康复师',
  single: '单人间',
  double: '双人间',
  multi_bed: '多人间',
  suite: '套间',
  standard_bed: '普通床',
  nursing_bed: '护理床',
  medical_bed: '医疗床',
  modified_food: '特殊处理饮食',
  community_health_center: '社区卫生服务中心',
  owned_hospital: '自有医院',
  partner_hospital: '合作医院',
  bed_fee: '床位费',
  care_fee: '护理费',
  meal_fee: '餐费',
  management_fee: '管理费',
  special_care_fee: '特殊护理费',
  other_fee: '其他费用',
}

const FIELD_LABELS: Record<string, string> = {
  name: '机构名称',
  region: '所在区域',
  address: '地址',
  institutionType: '机构类型',
  counts: '人员配置',
  caregiverResidentRatio: '护理员与老人比例',
  caregiverCertification: '护理员资质',
  certifiedCaregiverCount: '持证护理员人数',
  observedCaregiverCount: '统计护理员人数',
  certifiedRatioBasisPoints: '持证比例',
  certificateTypes: '证书类型',
  rawStatement: '资质说明',
  caregiverExperienceDistribution: '护理员经验分布',
  caregiverExperienceStatement: '护理员经验说明',
  nurseResponseTime: '护士响应时间',
  caregiverResponseTime: '护理员响应时间',
  dutyStaffing24h: '24小时值守',
  responseTimeMinutes: '响应时间',
  medicalSupport: '医疗支持',
  doctorRounds: '医生巡诊',
  nurseStaff: '护士配置',
  nurseStation: '护士站',
  partnerHospitals: '合作医院',
  clinic: '医务室',
  medicalDuty24h: '24小时医疗值守',
  medicalDuty24hNote: '医疗值守说明',
  emergencyTransferSupport: '紧急转诊支持',
  rehabilitationSupport: '康复支持',
  healthMonitoring: '健康监测',
  indoorSpace: '室内活动空间',
  outdoorSpace: '室外活动空间',
  offerings: '活动项目',
  zones: '活动区域',
  transportation: '交通',
  majorHospitalAccess: '周边医院',
  referenceMonthlyPrice: '参考月费用',
  recurringComponents: '月度费用构成',
  deposit: '押金',
  oneTimeFees: '一次性费用',
  adjustmentFactors: '费用调整因素',
  referenceAmount: '参考费用',
  priceNote: '费用说明',
  certificateName: '证书名称',
  validity: '有效期',
  validFrom: '生效日期',
  validUntil: '失效日期',
  mealSchedule: '餐次安排',
  easyChewSupport: '易咀嚼饮食支持',
  modifiedFoodSupport: '特殊处理饮食支持',
  mealFee: '餐费',
  specialDietExtraFee: '特殊饮食费用',
  serviceNote: '服务说明',
  relationshipType: '关系类型',
  organizationName: '医院名称',
  relationshipNote: '关系说明',
  availability: '可用状态',
  frequency: '频率',
  scenario: '响应场景',
  statistic: '统计口径',
  measurementNote: '测量说明',
  staffedRoles: '值守岗位',
  coverageNote: '覆盖说明',
  distanceMeters: '距离',
  distanceMethod: '距离方式',
  distanceSource: '距离来源',
  travelTimeMinutes: '预计时间',
  travelMode: '出行方式',
  stopName: '站点名称',
  routeSummary: '路线说明',
  accessNote: '通行说明',
  hospitalName: '医院名称',
  hospitalCategory: '医院类别',
  caregiverCount: '护理员人数',
  residentCount: '老人数量',
  role: '岗位',
  count: '人数',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFact = (value: unknown): value is FactLike => isRecord(value)
  && (value.availability === 'provided' || value.availability === 'unknown' || value.availability === 'unavailable')
  && (value.effectiveVerification === 'current_verified'
    || value.effectiveVerification === 'unverified'
    || value.effectiveVerification === 'expired')
  && Object.prototype.hasOwnProperty.call(value, 'value')

const labelFor = (key: string): string => FIELD_LABELS[key] || CODE_LABELS[key] || key

const verificationLabel = (verification: InstitutionEffectiveVerification): string =>
  verification === 'current_verified' ? '已核验'
    : verification === 'expired' ? '核验已过期' : '资料待核验'

const statusToneFor = (
  availability: InstitutionPresentationAvailability,
  verification: InstitutionEffectiveVerification,
): InstitutionDetailFactRowViewModel['statusTone'] => {
  if (availability === 'unavailable' || verification === 'expired') return 'warning'
  if (availability === 'unknown' || verification === 'unverified') return 'muted'
  return 'positive'
}

const formatMoney = (amountMinor: unknown): string => {
  if (typeof amountMinor !== 'number' || !Number.isFinite(amountMinor) || amountMinor <= 0) return ''
  return `¥${Math.round(amountMinor / 100)}`
}

const formatValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return CODE_LABELS[value] || value
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('fee')) return formatMoney(value)
    if (key.toLowerCase().includes('basispoints')) return `${Math.round(value) / 100}%`
    if (key.toLowerCase().includes('distance')) return `${value} 米`
    if (key.toLowerCase().includes('minutes')) return `${value} 分钟`
    return String(value)
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) {
    const values = value.map((item) => formatValue(key, item)).filter((item) => item.length > 0)
    return values.join('、')
  }
  if (isRecord(value)) {
    if (typeof value.displayName === 'string' && value.displayName.length > 0) return value.displayName
    if (typeof value.amountMinor === 'number') return formatMoney(value.amountMinor)
    if (typeof value.role === 'string' && typeof value.count === 'number') {
      return `${CODE_LABELS[value.role] || value.role}：${value.count} 人`
    }
    if (typeof value.caregiverCount === 'number' && typeof value.residentCount === 'number') {
      return `${value.caregiverCount}:${value.residentCount}`
    }
    if (value.kind === 'bounded' && isRecord(value.min) && isRecord(value.max)) {
      const min = formatMoney(value.min.amountMinor)
      const max = formatMoney(value.max.amountMinor)
      return min && max ? `${min}–${max} / 月` : ''
    }
    if (value.kind === 'starting_at' && isRecord(value.min)) {
      const min = formatMoney(value.min.amountMinor)
      return min ? `${min} 起 / 月` : ''
    }
    if (typeof value.min === 'number' && typeof value.max === 'number') return `${value.min}–${value.max}`
    if (typeof value.minAmountMinor === 'number') {
      const min = formatMoney(value.minAmountMinor)
      const max = typeof value.maxAmountMinor === 'number' ? formatMoney(value.maxAmountMinor) : ''
      return min && max ? `${min}–${max} / 月` : min ? `${min} 起 / 月` : ''
    }
    const values = Object.keys(value).map((childKey) => {
      const childValue = formatValue(childKey, value[childKey])
      return childValue.length > 0 ? `${labelFor(childKey)}：${childValue}` : ''
    }).filter((item) => item.length > 0)
    return values.length > 0 ? values.join('；') : '资料已提供'
  }
  return String(value)
}

const factRow = (
  key: string,
  label: string,
  fact: FactLike,
): InstitutionDetailFactRowViewModel => {
  const provided = fact.availability === 'provided' && fact.value !== null
  const value = provided ? formatValue(key, fact.value) : ''
  const availabilityLabel = fact.availability === 'unknown'
    ? '暂不明确'
    : fact.availability === 'unavailable' ? '当前不可用' : '资料已提供'
  const verification = verificationLabel(fact.effectiveVerification)
  const status = provided
    ? verification
    : availabilityLabel
  return {
    key,
    label,
    value: value || availabilityLabel,
    status,
    verificationLabel: verification,
    statusSummary: provided ? verification : `${availabilityLabel} · ${verification}`,
    statusTone: statusToneFor(fact.availability, fact.effectiveVerification),
  }
}

const valueRow = (
  key: string,
  label: string,
  value: unknown,
): InstitutionDetailFactRowViewModel => ({
  key,
  label,
  value: formatValue(key, value) || '资料已提供',
  status: '已提供',
  verificationLabel: '',
  statusSummary: '已提供',
  statusTone: 'neutral',
})

const rowsFromValue = (
  source: unknown,
  prefix: string,
  labels: Record<string, string> = FIELD_LABELS,
): InstitutionDetailFactRowViewModel[] => {
  if (!isRecord(source)) return []
  const rows: InstitutionDetailFactRowViewModel[] = []
  Object.keys(source).forEach((key) => {
    const value = source[key]
    const rowKey = `${prefix}.${key}`
    if (isFact(value)) {
      rows.push(factRow(rowKey, labels[key] || labelFor(key), value))
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isRecord(item)) {
          const referenceAmount = item.referenceAmount
          const itemLabel = typeof item.label === 'string' && item.label.length > 0
            ? item.label
            : typeof item.component === 'string'
              ? CODE_LABELS[item.component] || '费用项目'
              : ''
          if (itemLabel.length > 0 && isFact(referenceAmount)) {
            rows.push(factRow(`${rowKey}.${index}.referenceAmount`, itemLabel, referenceAmount))
            return
          }
          rows.push(...rowsFromValue(item, `${rowKey}.${index}`, labels))
        } else if (item !== null && item !== undefined) {
          rows.push(valueRow(`${rowKey}.${index}`, labels[key] || labelFor(key), item))
        }
      })
      return
    }
    if (isRecord(value)) rows.push(...rowsFromValue(value, rowKey, labels))
  })
  return rows
}

const basicRows = (snapshot: InstitutionDetailApplicationSnapshotV12): InstitutionDetailFactRowViewModel[] => [
  factRow('basic.name', '机构名称', snapshot.sections.basic.name),
  factRow('basic.region', '所在区域', snapshot.sections.basic.region),
  factRow('basic.address', '地址', snapshot.sections.basic.address),
  factRow('basic.institutionType', '机构类型', snapshot.sections.basic.institutionType),
]

const capabilityLabel = (code: string): string => CODE_LABELS[code] || code

const capabilityGroup = (
  key: string,
  title: string,
  items: readonly InstitutionCapabilityDisplayItem[],
): { key: string; title: string; items: readonly InstitutionDetailCapabilityViewModel[] } => ({
  key,
  title,
  items: items.map((item) => ({
    key: `${key}.${item.code}`,
    label: capabilityLabel(item.code),
    status: capabilityStatusLabel(item.status),
    verification: verificationLabel(item.effectiveVerification),
    tone: capabilityTone(item.status, item.effectiveVerification),
  })),
})

const capabilityStatusLabel = (status: InstitutionEffectiveCapabilityStatus): string => {
  if (status === 'supported') return '可提供'
  if (status === 'requires_assessment') return '需进一步确认'
  if (status === 'unsupported') return '当前不可用'
  return '暂不明确'
}

const capabilityTone = (
  status: InstitutionEffectiveCapabilityStatus,
  verification: InstitutionEffectiveVerification,
): InstitutionDetailCapabilityViewModel['tone'] => {
  if (status === 'supported' && verification === 'current_verified') return 'positive'
  if (status === 'unsupported' || verification === 'expired') return 'warning'
  if (status === 'unknown' || verification === 'unverified') return 'muted'
  return 'neutral'
}

const recommendationRows = (
  refs: readonly { code: string; reference?: string }[],
  prefix: string,
  isDifference: boolean,
): InstitutionDetailFactRowViewModel[] => refs.filter((ref) => isDifference
  ? isRecommendationDifferenceVisibleV2(ref.code)
  : isRecommendationReasonVisibleV2(ref.code)).map((ref, index) => ({
  key: `${prefix}-${ref.code}-${index}`,
  label: isDifference ? '主要差异' : '推荐理由',
  value: isDifference ? recommendationDifferenceLabelV2(ref.code) : recommendationReasonLabelV2(ref.code),
  status: '来自本次推荐上下文',
  verificationLabel: '',
  statusSummary: '来自本次推荐上下文',
  // The frozen Detail source projection intentionally omits Result polarity
  // and difference category. Keep the display conservative instead of
  // reconstructing those semantics from a code.
  statusTone: 'neutral',
}))

const mediaViewModel = (
  media: InstitutionDetailMediaDisplay,
  canOpenVr: boolean,
): InstitutionDetailMediaViewModel => ({
  hasCover: media.cover.state === 'current_verified' && media.cover.url !== null,
  coverUrl: media.cover.url || '',
  gallery: media.gallery.map((item) => ({
    key: item.mediaId,
    url: item.displayUrl || '',
    caption: item.caption || (item.availability === 'unknown' ? '图片资料待确认' : '图片资料暂不可用'),
    status: item.availability === 'provided'
      ? verificationLabel(item.effectiveVerification)
      : `${item.availability === 'unknown' ? '暂不明确' : '当前不可用'} · ${verificationLabel(item.effectiveVerification)}`,
  })),
  vrLabel: media.vr.state === 'available'
    ? 'VR看院资料已核验'
    : media.vr.state === 'unavailable' ? 'VR资料暂不可用' : 'VR资料待确认',
  vrState: media.vr.state,
  canOpenVr,
})

const roomViewModel = (room: InstitutionDetailRoomDisplay): InstitutionDetailRoomViewModel => {
  const name = room.name.availability === 'provided' && room.name.value !== null
    ? String(room.name.value) : '房型名称待提供'
  const type = room.roomType.availability === 'provided' && room.roomType.value !== null
    ? labelFor(String(room.roomType.value)) : '房型资料待确认'
  return {
    key: room.roomId,
    name,
    type,
    rows: [
      factRow(`${room.roomId}.area`, '面积', room.areaSquareMeters),
      factRow(`${room.roomId}.bedType`, '床型', room.bedType),
      factRow(`${room.roomId}.referencePrice`, '参考费用', room.referencePrice as FactLike),
    ],
    hasMedia: room.mediaIds.length > 0,
  }
}

const historyCopy = (snapshot: InstitutionDetailApplicationSnapshotV12): { label: string; notice: string } => {
  if (snapshot.contextKind === 'HISTORICAL_READ_ONLY') {
    return { label: '历史机构资料', notice: snapshot.revisionContext.state === 'different_current_revision_available' ? '机构资料已有更新' : '' }
  }
  if (snapshot.revisionContext.state === 'different_current_revision_available') {
    return { label: '推荐时的机构资料', notice: '机构资料已有更新' }
  }
  return { label: snapshot.contextKind === 'RECOMMENDATION_PINNED' ? '推荐机构资料' : '当前机构资料', notice: '' }
}

export const createInstitutionDetailPageViewModel = (
  snapshot: InstitutionDetailApplicationSnapshotV12,
): InstitutionDetailPageViewModelV12 => {
  const history = historyCopy(snapshot)
  const recommendation = snapshot.recommendationContext === null ? null : {
    tierLabel: recommendationTierLabelV2(snapshot.recommendationContext.tier),
    reasons: recommendationRows(snapshot.recommendationContext.reasons, 'reason', false),
    differences: recommendationRows(snapshot.recommendationContext.differences, 'difference', true),
  }
  return {
    pageState: 'ready',
    title: snapshot.sections.basic.name.value || '机构详情',
    description: snapshot.contextKind === 'HISTORICAL_READ_ONLY'
      ? '以下内容固定对应当时的机构资料，仅供查看。'
      : '以下内容来自同一机构版本的结构化资料；缺失信息会明确标注。',
    disclosure: snapshot.dataDisclosure.text || '',
    hasDisclosure: snapshot.dataDisclosure.text !== null,
    contextLabel: history.label,
    historyLabel: snapshot.contextKind === 'HISTORICAL_READ_ONLY' ? '只读资料' : '',
    revisionNotice: history.notice,
    canViewCurrentRevision: snapshot.actions.canViewCurrentRevision,
    currentRevisionLabel: '查看当前机构资料',
    recommendation,
    basicRows: basicRows(snapshot),
    media: mediaViewModel(
      snapshot.sections.media,
      snapshot.contextKind !== 'HISTORICAL_READ_ONLY' && snapshot.actions.canOpenVr,
    ),
    capabilityGroups: [
      capabilityGroup('careLevelAcceptance', '照护等级接收', snapshot.sections.careCapability.careLevelAcceptance),
      capabilityGroup('mobilitySupport', '行动与转移支持', snapshot.sections.careCapability.mobilitySupport),
      capabilityGroup('cognitiveSupport', '认知支持', snapshot.sections.careCapability.cognitiveSupport),
      capabilityGroup('specialCare', '特殊护理', snapshot.sections.careCapability.specialCare),
    ],
    staffingRows: rowsFromValue(snapshot.sections.staffing, 'staffing'),
    medicalRows: rowsFromValue(snapshot.sections.medicalRehabilitationMonitoring, 'medical'),
    rooms: snapshot.sections.rooms.map(roomViewModel),
    mealRows: rowsFromValue(snapshot.sections.meals, 'meals'),
    activityRows: rowsFromValue(snapshot.sections.activity, 'activity'),
    transportRows: rowsFromValue(snapshot.sections.transportHospital.transportation, 'transport'),
    hospitalRows: rowsFromValue({ hospitals: snapshot.sections.transportHospital.majorHospitalAccess }, 'hospital'),
    priceRows: rowsFromValue(snapshot.sections.price, 'price'),
    qualificationRows: rowsFromValue({ qualifications: snapshot.sections.qualifications }, 'qualification'),
  }
}

const detailErrorCopy = (
  pageState: Exclude<InstitutionDetailPageStateV12, 'loading' | 'ready'>,
): { title: string; message: string; canRetry: boolean } => {
  if (pageState === 'route_error') return { title: '机构链接无效', message: '当前链接缺少合法的机构版本信息，请从合作机构列表重新进入。', canRetry: false }
  if (pageState === 'not_found') return { title: '暂时找不到该机构资料', message: '当前资料已无法读取，请返回合作机构列表重新浏览。', canRetry: true }
  if (pageState === 'revision_not_found') return { title: '当前无法找到该版本的机构资料', message: '为了避免展示错误版本，页面没有自动切换到其他资料。', canRetry: true }
  if (pageState === 'source_context_error') return { title: '原推荐上下文已失效', message: '暂时无法展示当时的推荐说明，请返回推荐结果后重试。', canRetry: true }
  if (pageState === 'projection_error') return { title: '机构资料暂时无法展示', message: '当前资料未能通过展示校验，请稍后重试。', canRetry: true }
  return { title: '机构资料暂时不可用', message: '当前合作机构资料未能读取，请稍后重试。', canRetry: true }
}

export const createInstitutionDetailErrorViewModel = (
  pageState: Exclude<InstitutionDetailPageStateV12, 'loading' | 'ready'>,
): InstitutionDetailErrorViewModelV12 => ({ pageState, ...detailErrorCopy(pageState) })
