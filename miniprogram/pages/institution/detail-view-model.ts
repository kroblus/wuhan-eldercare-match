import { modeText } from '../../runtime/presentation-copy'
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
  availability?: InstitutionPresentationAvailability
  effectiveVerification?: InstitutionEffectiveVerification
}

export interface InstitutionDetailOverviewSection {
  key: string
  number: string
  title: string
  summary: string
  highlights: readonly string[]
  notice: string
  rows: readonly InstitutionDetailFactRowViewModel[]
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
  overview: {
    regionAndType: readonly InstitutionDetailFactRowViewModel[]
    monthlyPrice: InstitutionDetailFactRowViewModel | null
    careSummary: string
    careAlert: string
    careNotices: readonly string[]
    sections: readonly InstitutionDetailOverviewSection[]
  }
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
  requires_assessment: '需评估后确认',
  included: '已包含',
  additional_fee: '另行收费',
  care_level: '照护等级',
  room_type: '房型',
  special_care: '特殊护理',
  nutritionist: '营养师',
  social_worker: '社工',
  rehabilitation_room: '康复室',
  postoperative_rehabilitation: '术后康复',
  limb_function_training: '肢体功能训练',
  cognitive_training: '认知训练',
  eldercare_caregiver_certificate: '养老护理员证书',
  nursing_assistant_certificate: '护理辅助人员证书',
  other_documented_certificate: '其他有记录的证书',
  resident_call_to_nurse_arrival: '老人呼叫至护士到达',
  resident_call_to_caregiver_arrival: '老人呼叫至护理员到达',
  emergency_call_to_staff_arrival: '紧急呼叫至人员到达',
  other_documented_scenario: '其他有记录的场景',
  documented_target: '记录的目标值',
  documented_median: '记录的中位数',
  documented_maximum: '记录的最大值',
  other_documented_statistic: '其他有记录的统计值',
  weekly: '每周',
  on_demand: '按需',
  straight_line: '直线距离',
  road: '道路距离',
  co_located: '同址',
  walking: '步行',
  driving: '驾车',
  public_transit: '公共交通',
  less_than_one_year: '不足 1 年',
  one_to_three_years: '1–3 年',
  three_to_five_years: '3–5 年',
  five_years_or_more: '5 年及以上',
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
  training: '培训资料',
  trainingTopics: '培训内容',
  trainingNote: '培训说明',
  rehabilitationTherapist: '康复师',
  features: '设施项目',
  bloodPressureMonitoring: '血压监测',
  rehabilitationRoom: '康复室',
  emergencySupport: '应急支持',
  equipment: '设备',
  featureCode: '服务项目',
  serviceCode: '服务项目',
  priceTreatment: '收费方式',
  certification: '资质',
  trainingDescription: '培训说明',
  vehicleAccess: '车辆通行',
  metro: '地铁',
  busStops: '公交站点',
  relationships: '医疗合作关系',
  hospitals: '周边医院',
  nearestStationName: '最近地铁站点',
  routeNote: '交通路线说明',
  publicActivityZone: '公共活动区域',
  activeAgingZone: '活力养老区域',
  careZone: '照护区域',
  dementiaZone: '认知照护区域',
  privateBathroom: '独立卫生间',
  airConditioner: '空调',
  wardrobe: '衣柜',
  television: '电视',
  callSystem: '呼叫系统',
  balcony: '阳台',
  accessibility: '无障碍设施',
  electricCurtain: '电动窗帘',
  refrigerator: '冰箱',
  bedsideTableOrFoldBoard: '床头桌或折叠板',
  wheelchairOrAssistiveEquipment: '轮椅或辅助设备',
  smartSpeakerOrRadio: '智能音箱或收音机',
  magnifier: '放大镜',
  calligraphyOrPersonalItems: '书画或个人物品',
  scheduleNote: '活动安排说明',
  bloodPressure: '血压监测',
  bloodOxygen: '血氧监测',
  bloodGlucose: '血糖监测',
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

const labelFor = (key: string): string => FIELD_LABELS[key] || CODE_LABELS[key] || '资料项目'

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
  if (state === 'pending') return '机构提供，平台待核验'
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
    availability: fact.availability,
    effectiveVerification: fact.effectiveVerification,
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
      const fieldLabel = labels[key] || labelFor(key)
      const parentKey = prefix.split('.').filter((part) => !/^\d+$/.test(part)).pop() || ''
      const needsContext = ['availability', 'frequency', 'serviceNote', 'distanceMeters', 'responseTimeMinutes', 'scenario', 'statistic', 'measurementNote'].includes(key)
      const parentLabel = labelFor(parentKey)
      rows.push(factRow(rowKey, needsContext && parentLabel !== '资料项目'
        ? `${parentLabel} · ${fieldLabel}` : fieldLabel, value))
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
  canOpenVr: canOpenVr && media.vr.state === 'available' && media.vr.canNavigate && media.vr.sceneCount > 0,
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
      factRow(`${room.roomId}.name`, '房型名称', room.name),
      factRow(`${room.roomId}.roomType`, '房型类别', room.roomType),
      factRow(`${room.roomId}.area`, '面积', room.areaSquareMeters),
      factRow(`${room.roomId}.bedType`, '床型', room.bedType),
      factRow(`${room.roomId}.referencePrice`, '参考费用', room.referencePrice as FactLike),
      ...rowsFromValue(room.features, `${room.roomId}.features`),
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

// Presentation only: retain every projected field and its independent status.
const describeFacts = (
  rows: readonly InstitutionDetailFactRowViewModel[], subject: string, unknownCopy: string,
): string => {
  if (!rows.length) return `${subject}暂无可展示资料`
  if (rows.every((row) => row.availability === 'unknown' && row.effectiveVerification !== 'expired')) return unknownCopy
  const notes: string[] = []
  if (rows.some((row) => row.availability === 'unknown')) notes.push('尚无明确资料的项目')
  if (rows.some((row) => row.availability === 'unavailable')) notes.push('资料当前不可取得或不适用的项目')
  if (rows.some((row) => row.availability === 'provided' && row.effectiveVerification === 'unverified')) notes.push('待核验项目')
  if (rows.some((row) => row.effectiveVerification === 'expired')) notes.push('核验已过期的项目')
  return notes.length ? `${subject}中有${notes.join('、')}` : `${subject}已有资料，核验状态见明细`
}

const sectionOverview = (
  key: string, number: string, title: string,
  rows: readonly InstitutionDetailFactRowViewModel[],
): InstitutionDetailOverviewSection => {
  const highlights = rows.filter((row) => row.availability === 'provided'
    && row.effectiveVerification === 'current_verified').slice(0, 2)
    .map((row) => `${row.label}：${row.value}（${row.statusSummary}）`)
  return {
    key, number, title, rows, highlights, notice: '', summary: '',
  }
}

const overviewFor = (
  view: Omit<InstitutionDetailPageViewModelV12, 'overview'>,
  snapshot: InstitutionDetailApplicationSnapshotV12,
  future: InstitutionDetailFutureSectionsV121,
): InstitutionDetailPageViewModelV12['overview'] => {
  const capabilityRows = view.capabilityGroups.reduce<InstitutionDetailFactRowViewModel[]>((rows, group) => {
    group.items.forEach((item) => rows.push({
      key: item.key, label: `${group.title} · ${item.label}`, value: item.status,
      status: item.status, verificationLabel: item.verification,
      statusSummary: item.verification, statusTone: item.tone,
    }))
    return rows
  }, [])
  const acceptance = view.capabilityGroups[0].items
  const currentAccepted = acceptance.filter((item) => item.status === '可提供' && item.verification === '已核验')
  const careSummary = currentAccepted.length
    ? `已核验接收：${currentAccepted.map((item) => item.label).join('、')}`
    : '照护接收情况待逐项确认，请咨询老人所需的具体照护。'
  const careNotices = view.capabilityGroups.map((group) => {
    const unresolved = group.items.filter((item) => item.status !== '可提供' || item.verification !== '已核验')
    if (!unresolved.length) return ''
    const statuses = Array.from(new Set(unresolved.map((item) => `${item.status} · ${item.verification}`)))
    return `${group.title}：${unresolved.map((item) => item.label).join('、')}（${statuses.join('；')}）。请逐项确认。`
  }).filter((text) => text.length > 0)
  const careRows: InstitutionDetailFactRowViewModel[] = []
  if (view.careProcess && snapshot.sections.careProcess.state === 'available_for_schema') {
    const add = (key: string, label: string, fact: Parameters<typeof careFactRow>[2], formatter: Parameters<typeof careFactRow>[3]) => {
      careRows.push(careFactRow(key, label, fact, formatter) || factRow(key, label, fact))
    }
    add('careProcess.careRecord.presence', '护理记录', future.careProcess.careRecord.presence, carePresenceValue)
    add('careProcess.careRecord.completeness', '护理记录完整性', future.careProcess.careRecord.completeness, careCompletenessValue)
    add('careProcess.careRecord.frequency', '记录频率', future.careProcess.careRecord.frequency, careFrequencyValue)
    add('careProcess.careRecord.traceability', '可追溯性', future.careProcess.careRecord.traceability, careTraceabilityValue)
    add('careProcess.shiftHandover24h.presence', '24小时交接', future.careProcess.shiftHandover24h.presence, carePresenceValue)
    HANDOVER_CONTENT_KEYS.forEach((key) => add(`careProcess.shiftHandover24h.contents.${key}`,
      `交接内容 · ${HANDOVER_CONTENT_LABELS[key]}`, future.careProcess.shiftHandover24h.contents[key], carePresenceValue))
  }
  const medicalPending = view.medicalRows.filter((row) => row.availability !== 'provided' || row.effectiveVerification !== 'current_verified')
  const medicalRisk = view.medicalRows.filter((row) => row.availability === 'provided'
    && /^(未提供|暂不可用|当前不可用|否|需进一步确认|需评估后确认)$/.test(row.value))
  medicalRisk.forEach((row) => careNotices.push(`${row.label}：${row.value}（${row.statusSummary}）。请确认对入住的影响。`))
  const careAlert = careNotices.length
    ? '照护接收或护理支持有待确认项目，请先核实老人需要的服务。'
    : medicalPending.length ? '医疗、康复及健康监测资料待确认，请先核实老人需要的服务。' : ''
  const lifeRows = [...view.mealRows, ...view.activityRows]
  const life = sectionOverview('life', '03', '房间与日常生活', [...lifeRows, ...view.rooms.reduce<InstitutionDetailFactRowViewModel[]>((rows, room) => [...rows, ...room.rows], [])])
  const monthlyPrice = view.priceRows.find((row) => row.key === 'price.referenceMonthlyPrice' || row.key === 'price.monthlyRange') || null
  const feeDetails = view.priceRows.filter((row) => row !== monthlyPrice)
  const monthlyCopy = monthlyPrice
    ? `参考月费：${monthlyPrice.availability !== 'provided' ? monthlyPrice.statusSummary
      : `${monthlyPrice.value}${monthlyPrice.statusSummary === '已核验' ? '' : `（${monthlyPrice.statusSummary}）`}`}`
    : '参考月费待确认'
  const teamRows = [...view.staffingRows, ...careRows]
  const contactCopy = view.officialContact.hasPhones
    ? `官方电话：${Array.from(new Set(view.officialContact.phones.map((phone) => phone.statusLabel))).join('、')}`
    : view.officialContact.statusLabel
  const care = sectionOverview('care', '01', '护理与照护能力', [...capabilityRows, ...view.medicalRows])
  const fees = sectionOverview('fees', '02', '费用与入住', view.priceRows)
  const team = sectionOverview('team', '04', '护理团队与管理', teamRows)
  const info = sectionOverview('info', '05', '机构资料与位置', [...view.basicRows, ...view.qualificationRows, ...view.transportRows, ...view.hospitalRows])
  return {
    regionAndType: view.basicRows.filter((row) => row.key === 'basic.region' || row.key === 'basic.institutionType'),
    monthlyPrice,
    careSummary, careAlert, careNotices,
    sections: [
      { ...care, summary: `${careNotices.length ? '照护支持有待确认项目' : '照护支持已有资料'}；${describeFacts(view.medicalRows, '医疗与康复', '医疗、康复及健康监测资料尚待补充')}。` },
      { ...fees, highlights: [], summary: `${monthlyCopy}。${describeFacts(feeDetails, '收费明细', '其他收费内容待确认，请询问实际费用和包含项目')}。` },
      { ...life, rows: lifeRows, summary: `${describeFacts(life.rows, '居住与日常生活资料', view.rooms.length ? '房型、设施、膳食及活动安排仍需确认' : '房型尚待补充，膳食安排和活动空间也需确认')}。` },
      { ...team, summary: `${describeFacts(teamRows, '人员及护理管理资料', view.careProcess ? '人员配置、资质与护理记录等资料待补充' : '人员配置及资质资料待补充')}${view.careProcess ? '' : '；该版本未包含护理管理与交接资料'}。` },
      { ...info, highlights: view.location.addressState === 'ready' ? [`机构地址：${view.location.address}`] : [],
        summary: `${view.location.addressStatus}；${contactCopy}；${describeFacts(view.qualificationRows, '资质资料', '资质资料尚待补充')}。` },
    ],
  }
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
  const view: Omit<InstitutionDetailPageViewModelV12, 'overview'> = {
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
  return { ...view, overview: overviewFor(view, snapshot, future) }
}

const detailErrorCopy = (
  pageState: Exclude<InstitutionDetailPageStateV12, 'loading' | 'ready'>,
): { title: string; message: string; canRetry: boolean } => {
  if (pageState === 'route_error') return { title: '机构链接无效', message: modeText('当前链接缺少合法的机构版本信息，请从合作机构列表重新进入。'), canRetry: false }
  if (pageState === 'not_found') return { title: '暂时找不到该机构资料', message: modeText('当前资料已无法读取，请返回合作机构列表重新浏览。'), canRetry: true }
  if (pageState === 'revision_not_found') return { title: '当前无法找到该版本的机构资料', message: '为了避免展示错误版本，页面没有自动切换到其他资料。', canRetry: true }
  if (pageState === 'source_context_error') return { title: '原推荐上下文已失效', message: '暂时无法展示当时的推荐说明，请返回推荐结果后重试。', canRetry: true }
  if (pageState === 'projection_error') return { title: '机构资料暂时无法展示', message: '当前资料未能通过展示校验，请稍后重试。', canRetry: true }
  return { title: '机构资料暂时不可用', message: modeText('当前合作机构资料未能读取，请稍后重试。'), canRetry: true }
}

export const createInstitutionDetailErrorViewModel = (
  pageState: Exclude<InstitutionDetailPageStateV12, 'loading' | 'ready'>,
): InstitutionDetailErrorViewModelV12 => ({ pageState, ...detailErrorCopy(pageState) })
