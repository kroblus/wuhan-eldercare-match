import type {
  CareProcessPresenceCode,
  CareRecordCompletenessCode,
  CareRecordFrequencyCode,
  CareRecordTraceabilityCode,
  HandoverContentCode,
} from '../../types/institution-v1-2'
import type {
  InstitutionCapabilityDisplayItem,
  InstitutionDetailApplicationSnapshotV12,
  InstitutionDetailMediaDisplay,
  InstitutionDetailPageStateV12,
  InstitutionDetailRoomDisplay,
  InstitutionDetailFutureSectionsV121,
  InstitutionEffectiveVerification,
  InstitutionMapApplicationStatusV121,
  InstitutionOfficialPhoneApplicationSnapshotV121,
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

export interface InstitutionDetailIntroductionViewModel {
  text: string
  sourceLabel: string
  updatedDateLabel: string
}

export type InstitutionDetailAddressState =
  | 'ready'
  | 'address_unknown'
  | 'address_unavailable'
  | 'address_unverified'
  | 'address_expired'

export type InstitutionDetailLocationState = InstitutionDetailAddressState | 'map_unavailable' | 'map_ready'

export type InstitutionDetailMapActionViewModel =
  | {
      available: true
      label: string
      latitude: number
      longitude: number
      name: string
      address: string
      scale: 16
    }
  | {
      available: false
      label: string
      disabledReason: string
    }

export interface InstitutionDetailLocationViewModel {
  state: InstitutionDetailLocationState
  addressState: InstitutionDetailAddressState
  address: string
  addressStatus: string
  addressStatusTone: InstitutionDetailFactRowViewModel['statusTone']
  mapState: 'map_unavailable' | 'map_ready'
  mapStatus: string
  mapStatusTone: InstitutionDetailFactRowViewModel['statusTone']
  mapAction: InstitutionDetailMapActionViewModel
}

export type InstitutionDetailOfficialPhoneState = 'verified' | 'pending' | 'expired' | 'unknown' | 'unavailable'

export type InstitutionDetailPhoneActionViewModel =
  | { available: true; label: string; dialValue: string }
  | { available: false; label: string }

export interface InstitutionDetailOfficialPhoneViewModel {
  key: string
  purposeLabel: string
  displayValue: string
  state: InstitutionDetailOfficialPhoneState
  statusLabel: string
  statusTone: InstitutionDetailFactRowViewModel['statusTone']
  verifiedDateLabel: string
  callAction: InstitutionDetailPhoneActionViewModel
}

export interface InstitutionDetailOfficialContactViewModel {
  state: 'ready' | 'unknown' | 'unavailable'
  statusLabel: string
  statusTone: InstitutionDetailFactRowViewModel['statusTone']
  hasPhones: boolean
  phones: readonly InstitutionDetailOfficialPhoneViewModel[]
}

export interface InstitutionDetailCareProcessViewModel {
  statusLabel: string
  statusTone: InstitutionDetailFactRowViewModel['statusTone']
  hasFacts: boolean
  pendingLabel: string
  emptyMessage: string
  careRecordRows: readonly InstitutionDetailFactRowViewModel[]
  handoverPresence: InstitutionDetailFactRowViewModel | null
  handoverContentRows: readonly InstitutionDetailFactRowViewModel[]
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
  introduction: InstitutionDetailIntroductionViewModel | null
  location: InstitutionDetailLocationViewModel
  officialContact: InstitutionDetailOfficialContactViewModel
  careProcess: InstitutionDetailCareProcessViewModel | null
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

const OFFICIAL_PHONE_PURPOSE_LABELS: Record<string, string> = {
  main: '机构主电话',
  admission_consultation: '入住咨询',
  service: '服务电话',
  other: '其它',
}

const CARE_FREQUENCY_LABELS: Record<CareRecordFrequencyCode, string> = {
  per_shift: '每班次',
  daily: '每日',
  event_based: '按事件',
  other: '其他频率',
}

const HANDOVER_CONTENT_LABELS: Record<HandoverContentCode, string> = {
  vital_signs: '生命体征',
  abnormal_events: '异常情况',
  interventions_recorded: '处理措施记录',
  follow_up: '后续跟进',
  family_communication: '家属沟通',
  medical_transfer: '转医信息',
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

const emptyFutureSections = (): InstitutionDetailFutureSectionsV121 => ({
  publicIntroduction: {
    status: 'unavailable',
    contentRevision: null,
    text: null,
    sourceType: null,
    updatedAt: null,
  },
  officialContact: {
    status: 'unavailable',
    directory: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
    phones: [],
  },
  officialAddress: {
    status: 'unavailable',
    formattedAddress: null,
    effectiveVerification: 'unverified',
  },
  mapLocation: {
    status: 'unavailable',
    institutionName: '',
    formattedAddress: null,
    latitude: null,
    longitude: null,
    coordinateSystem: null,
    addressVerification: null,
    geoVerification: null,
    mapActionAvailable: false,
  },
  careProcess: {
    status: 'unavailable',
    careRecord: {
      presence: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      completeness: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      frequency: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      traceability: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
    },
    shiftHandover24h: {
      presence: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      contents: {
        vital_signs: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        abnormal_events: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        interventions_recorded: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        follow_up: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        family_communication: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        medical_transfer: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      },
    },
  },
})

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

const dateOnlyLabel = (value: string | null): string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `核验日期：${value}` : ''

const publicSourceLabel = (sourceType: string | null): string =>
  sourceType === 'institution_supplied' ? '机构提供' : sourceType === 'platform_edited' ? '平台整理' : ''

const introductionViewModel = (
  introduction: InstitutionDetailFutureSectionsV121['publicIntroduction'],
): InstitutionDetailIntroductionViewModel | null => {
  if (introduction.status !== 'ready'
    || typeof introduction.text !== 'string'
    || introduction.text.trim().length === 0) return null
  return {
    text: introduction.text,
    sourceLabel: publicSourceLabel(introduction.sourceType),
    updatedDateLabel: dateOnlyLabel(introduction.updatedAt),
  }
}

const addressStateFor = (
  address: InstitutionDetailFutureSectionsV121['officialAddress'],
): InstitutionDetailAddressState => {
  if (address.status === 'unknown') return 'address_unknown'
  if (address.status === 'unavailable') return 'address_unavailable'
  if (address.effectiveVerification === 'expired') return 'address_expired'
  if (address.effectiveVerification === 'unverified') return 'address_unverified'
  return 'ready'
}

const addressStatusCopy = (state: InstitutionDetailAddressState): string => {
  if (state === 'address_unknown') return '机构地址待确认'
  if (state === 'address_unavailable') return '当前暂无可提供的机构地址'
  if (state === 'address_unverified') return '地址资料待核验'
  if (state === 'address_expired') return '地址资料已过核验期'
  return '地址已核验'
}

const mapStatusCopy = (status: InstitutionMapApplicationStatusV121): string => {
  if (status === 'available') return '可查看地图'
  if (status === 'address_unknown') return '机构地址待确认'
  if (status === 'address_unavailable') return '当前暂无可提供的机构地址'
  if (status === 'address_unverified') return '地址资料待核验'
  if (status === 'address_expired') return '地址资料已过核验期'
  if (status === 'geo_unknown') return '地图位置待确认'
  if (status === 'geo_unavailable') return '当前暂无可提供的地图位置'
  if (status === 'geo_unverified') return '地图位置待核验'
  if (status === 'geo_expired') return '地图位置资料已过核验期'
  return '地图暂不可用'
}

const mapStatusTone = (
  status: InstitutionMapApplicationStatusV121,
): InstitutionDetailFactRowViewModel['statusTone'] => {
  if (status === 'available') return 'positive'
  if (status === 'address_unavailable' || status === 'geo_unavailable'
    || status === 'address_expired' || status === 'geo_expired' || status === 'unavailable') return 'warning'
  return 'muted'
}

const locationViewModel = (
  future: InstitutionDetailFutureSectionsV121,
): InstitutionDetailLocationViewModel => {
  const addressState = addressStateFor(future.officialAddress)
  const addressStatus = addressStatusCopy(addressState)
  const address = future.officialAddress.formattedAddress || addressStatus
  const addressStatusTone = addressState === 'address_unavailable' || addressState === 'address_expired'
    ? 'warning'
    : addressState === 'ready' ? 'positive' : 'muted'
  const mapReady = future.mapLocation.mapActionAvailable
  const mapStatus = mapStatusCopy(future.mapLocation.status)
  const mapAction: InstitutionDetailMapActionViewModel = mapReady
    ? {
        available: true,
        label: '查看地图',
        latitude: future.mapLocation.latitude as number,
        longitude: future.mapLocation.longitude as number,
        name: future.mapLocation.institutionName,
        address: future.mapLocation.formattedAddress as string,
        scale: 16,
      }
    : {
        available: false,
        label: '查看地图',
        disabledReason: mapStatus,
      }
  return {
    state: mapReady
      ? 'map_ready'
      : addressState === 'ready' && future.mapLocation.status !== 'available'
        ? 'map_unavailable'
        : addressState,
    addressState,
    address,
    addressStatus,
    addressStatusTone,
    mapState: mapReady ? 'map_ready' : 'map_unavailable',
    mapStatus,
    mapStatusTone: mapStatusTone(future.mapLocation.status),
    mapAction,
  }
}

const officialPhoneState = (
  phone: InstitutionOfficialPhoneApplicationSnapshotV121,
): InstitutionDetailOfficialPhoneState => {
  if (phone.status === 'current_verified') return 'verified'
  if (phone.status === 'unverified_with_source') return 'pending'
  if (phone.status === 'expired') return 'expired'
  return 'unknown'
}

const officialPhoneStatusLabel = (state: InstitutionDetailOfficialPhoneState): string => {
  if (state === 'verified') return '已核验'
  if (state === 'pending') return '待核验'
  if (state === 'expired') return '电话资料已过核验期'
  if (state === 'unavailable') return '当前暂无可提供的官方联系电话'
  return '官方联系电话待确认'
}

const officialPhoneStatusTone = (
  state: InstitutionDetailOfficialPhoneState,
): InstitutionDetailFactRowViewModel['statusTone'] =>
  state === 'verified' ? 'positive' : state === 'expired' || state === 'unavailable' ? 'warning' : 'muted'

const officialPhoneViewModel = (
  phone: InstitutionOfficialPhoneApplicationSnapshotV121,
): InstitutionDetailOfficialPhoneViewModel => {
  const state = officialPhoneState(phone)
  const callAvailable = phone.callActionAvailable
  const displayValue = state === 'verified' || state === 'pending'
    ? phone.displayValue || '官方联系电话待确认' : ''
  return {
    key: phone.officialPhoneKey,
    purposeLabel: OFFICIAL_PHONE_PURPOSE_LABELS[phone.purpose] || '其它',
    displayValue,
    state,
    statusLabel: officialPhoneStatusLabel(state),
    statusTone: officialPhoneStatusTone(state),
    verifiedDateLabel: dateOnlyLabel(phone.verifiedDate),
    callAction: callAvailable
      ? { available: true, label: '拨打机构电话', dialValue: phone.dialValue as string }
      : { available: false, label: state === 'expired' ? '电话资料已过核验期' : '暂不可拨打' },
  }
}

const officialContactViewModel = (
  contact: InstitutionDetailFutureSectionsV121['officialContact'],
): InstitutionDetailOfficialContactViewModel => {
  const phones = contact.phones.map(officialPhoneViewModel)
  const state: InstitutionDetailOfficialContactViewModel['state'] = contact.status === 'unknown'
    ? 'unknown' : contact.status === 'unavailable' ? 'unavailable' : 'ready'
  const statusLabel = state === 'unknown'
    ? '官方联系电话待确认'
    : state === 'unavailable'
      ? '当前暂无可提供的官方联系电话'
      : phones.length > 0 ? '机构官方联系方式' : '官方联系电话待确认'
  return {
    state,
    statusLabel,
    statusTone: state === 'unavailable' ? 'warning' : state === 'unknown' ? 'muted' : 'neutral',
    hasPhones: phones.length > 0,
    phones,
  }
}

const carePresenceValue = (
  value: unknown,
  effectiveVerification: InstitutionEffectiveVerification,
): string => {
  if (value === 'present') {
    return effectiveVerification === 'unverified' ? '机构资料称存在' : '有'
  }
  if (value === 'absent') {
    return effectiveVerification === 'unverified' ? '机构资料称暂无' : '已确认暂无'
  }
  return ''
}

const careCompletenessValue = (value: unknown): string =>
  value === 'complete' ? '完整' : value === 'partial' ? '部分完整' : ''

const careFrequencyValue = (value: unknown): string => {
  if (!Array.isArray(value)) return ''
  return value.map((item) => CARE_FREQUENCY_LABELS[item as CareRecordFrequencyCode] || '')
    .filter((item) => item.length > 0)
    .join('、')
}

const careTraceabilityValue = (value: unknown): string =>
  value === 'traceable' ? '可追溯' : value === 'not_traceable' ? '暂不可追溯' : ''

const careFactRow = (
  key: string,
  label: string,
  fact: {
    availability: InstitutionPresentationAvailability
    value: CareProcessPresenceCode | CareRecordCompletenessCode | CareRecordTraceabilityCode
      | readonly CareRecordFrequencyCode[] | null
    effectiveVerification: InstitutionEffectiveVerification
  },
  formatter: (value: unknown, effectiveVerification: InstitutionEffectiveVerification) => string,
): InstitutionDetailFactRowViewModel | null => {
  if (fact.availability !== 'provided'
    || fact.value === null
    || formatter(fact.value, fact.effectiveVerification).length === 0) return null
  const row = factRow(key, label, fact)
  const formatted = formatter(fact.value, fact.effectiveVerification)
  return {
    ...row,
    value: fact.effectiveVerification === 'expired' ? `此前资料：${formatted}` : formatted,
  }
}

const HANDOVER_CONTENT_KEYS: readonly HandoverContentCode[] = [
  'vital_signs',
  'abnormal_events',
  'interventions_recorded',
  'follow_up',
  'family_communication',
  'medical_transfer',
]

const careProcessViewModel = (
  careProcess: InstitutionDetailFutureSectionsV121['careProcess'],
): InstitutionDetailCareProcessViewModel => {
  const careRecordRows = [
    careFactRow('careProcess.careRecord.presence', '护理记录', careProcess.careRecord.presence, carePresenceValue),
    careFactRow('careProcess.careRecord.completeness', '护理记录完整性', careProcess.careRecord.completeness, careCompletenessValue),
    careFactRow('careProcess.careRecord.frequency', '记录频率', careProcess.careRecord.frequency, careFrequencyValue),
    careFactRow('careProcess.careRecord.traceability', '可追溯性', careProcess.careRecord.traceability, careTraceabilityValue),
  ].filter((row): row is InstitutionDetailFactRowViewModel => row !== null)
  const handoverPresence = careFactRow(
    'careProcess.shiftHandover24h.presence',
    '24小时交接',
    careProcess.shiftHandover24h.presence,
    carePresenceValue,
  )
  const handoverContentRows = HANDOVER_CONTENT_KEYS.map((key) => careFactRow(
    `careProcess.shiftHandover24h.contents.${key}`,
    HANDOVER_CONTENT_LABELS[key],
    careProcess.shiftHandover24h.contents[key],
    carePresenceValue,
  )).filter((row): row is InstitutionDetailFactRowViewModel => row !== null)
  const allFacts = [
    careProcess.careRecord.presence,
    careProcess.careRecord.completeness,
    careProcess.careRecord.frequency,
    careProcess.careRecord.traceability,
    careProcess.shiftHandover24h.presence,
    ...HANDOVER_CONTENT_KEYS.map((key) => careProcess.shiftHandover24h.contents[key]),
  ]
  const hasFacts = careRecordRows.length > 0 || handoverPresence !== null || handoverContentRows.length > 0
  const hasPending = allFacts.some((fact) => fact.availability !== 'provided' || fact.value === null)
  const statusLabel = !hasFacts
    ? careProcess.status === 'unavailable' ? '当前暂无可提供的护理管理与交接资料' : '相关资料待确认'
    : hasPending ? '部分资料已提供，部分资料待确认' : '资料已提供'
  return {
    statusLabel,
    statusTone: !hasFacts
      ? careProcess.status === 'unavailable' ? 'warning' : 'muted'
      : hasPending ? 'neutral' : 'positive',
    hasFacts,
    pendingLabel: hasFacts && hasPending ? '部分字段资料待确认' : '',
    emptyMessage: careProcess.status === 'unavailable'
      ? '当前暂无可提供的护理管理与交接资料' : '相关资料待确认',
    careRecordRows,
    handoverPresence,
    handoverContentRows,
  }
}

const careProcessForSnapshot = (
  snapshot: InstitutionDetailApplicationSnapshotV12,
  future: InstitutionDetailFutureSectionsV121,
): InstitutionDetailCareProcessViewModel | null => {
  const sectionState = snapshot.sections.careProcess.state
  if (sectionState !== 'not_applicable_for_schema'
    && sectionState !== 'not_in_source_contract') {
    return careProcessViewModel(future.careProcess)
  }
  if (snapshot.contextKind === 'DIRECT_CURRENT'
    || snapshot.contextKind === 'CURRENT_INSTITUTION_CONTEXT') return null

  const message = '该版本机构资料尚未包含护理管理信息'
  return {
    statusLabel: message,
    statusTone: 'muted',
    hasFacts: false,
    pendingLabel: '',
    emptyMessage: message,
    careRecordRows: [],
    handoverPresence: null,
    handoverContentRows: [],
  }
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
  const future = snapshot.sections.futureV121 || emptyFutureSections()
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
    introduction: introductionViewModel(future.publicIntroduction),
    location: locationViewModel(future),
    officialContact: officialContactViewModel(future.officialContact),
    careProcess: careProcessForSnapshot(snapshot, future),
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
