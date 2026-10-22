import type {
  ConsultantPublicPhoneProjectionV1,
  ConsultantPublicWechatQrProjectionV1,
  GlobalConsultantPublicApplicationResultV1,
  GlobalConsultantResolutionStatusV1,
} from '../../types/consultant-v1'

export type ConsultantPageStateV1 =
  | 'loading'
  | 'available'
  | 'phone_only'
  | 'qr_only'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'
  | 'failure'

export interface ConsultantPagePhoneViewModelV1 {
  status: ConsultantPublicPhoneProjectionV1['status']
  label: ConsultantPublicPhoneProjectionV1['label']
  displayValue: string
  actionAvailable: boolean
  dialValue: string
  statusText: string
}

export interface ConsultantPageQrViewModelV1 {
  status: ConsultantPublicWechatQrProjectionV1['status']
  label: ConsultantPublicWechatQrProjectionV1['label']
  publicImageUrl: string
  showImage: boolean
  allowLongPress: boolean
  statusText: string
}

export interface ConsultantPageViewModelV1 {
  pageState: Exclude<ConsultantPageStateV1, 'loading'>
  roleLabel: string
  displayName: string
  serviceArea: string
  serviceDescription: string
  stateTitle: string
  stateMessage: string
  showIdentity: boolean
  showContactSection: boolean
  showReloadAction: boolean
  phone: ConsultantPagePhoneViewModelV1
  qr: ConsultantPageQrViewModelV1
  showPhoneAction: boolean
  showQrImage: boolean
}

const unavailablePhone = (
  projection: ConsultantPublicPhoneProjectionV1,
): ConsultantPagePhoneViewModelV1 => ({
  status: projection.status,
  label: projection.label,
  displayValue: '',
  actionAvailable: false,
  dialValue: '',
  statusText: phoneStatusText(projection.status),
})

const unavailableQr = (
  projection: ConsultantPublicWechatQrProjectionV1,
): ConsultantPageQrViewModelV1 => ({
  status: projection.status,
  label: projection.label,
  publicImageUrl: '',
  showImage: false,
  allowLongPress: false,
  statusText: qrStatusText(projection.status),
})

const projectPhone = (
  projection: ConsultantPublicPhoneProjectionV1,
): ConsultantPagePhoneViewModelV1 => {
  if (projection.status !== 'available') {
    return unavailablePhone(projection)
  }
  return {
    status: projection.status,
    label: projection.label,
    displayValue: projection.displayValue,
    actionAvailable: projection.actionAvailable,
    dialValue: projection.dialValue,
    statusText: '可拨打平台养老顾问电话',
  }
}

const projectQr = (
  projection: ConsultantPublicWechatQrProjectionV1,
): ConsultantPageQrViewModelV1 => {
  if (projection.status !== 'available') {
    return unavailableQr(projection)
  }
  return {
    status: projection.status,
    label: projection.label,
    publicImageUrl: projection.publicImageUrl,
    showImage: projection.actionAvailable,
    allowLongPress: projection.actionAvailable,
    statusText: '可长按识别真实企业微信二维码',
  }
}

const phoneStatusText = (
  status: ConsultantPublicPhoneProjectionV1['status'],
): string => {
  if (status === 'unknown') return '平台顾问电话暂时无法确认。'
  if (status === 'missing') return '平台顾问电话暂未配置。'
  if (status === 'unavailable') return '当前没有可公开的顾问电话。'
  return '平台顾问电话已准备好。'
}

const qrStatusText = (
  status: ConsultantPublicWechatQrProjectionV1['status'],
): string => {
  if (status === 'expired') return '企业微信二维码已过期，暂不展示。'
  if (status === 'inactive') return '企业微信二维码当前不可用。'
  if (status === 'unknown') return '企业微信二维码状态暂时无法确认。'
  if (status === 'missing') return '企业微信二维码暂未配置。'
  return '当前没有可公开的企业微信二维码。'
}

const pageStateFor = (
  resolutionStatus: GlobalConsultantResolutionStatusV1,
  phone: ConsultantPublicPhoneProjectionV1,
  qr: ConsultantPublicWechatQrProjectionV1,
): Exclude<ConsultantPageStateV1, 'loading'> => {
  if (phone.status === 'available' && qr.status === 'available') return 'available'
  if (phone.status === 'available') return 'phone_only'
  if (qr.status === 'available') return 'qr_only'
  return resolutionStatus
}

const stateCopy = (
  state: ConsultantPageStateV1,
): { title: string, message: string } => {
  if (state === 'available') {
    return {
      title: '平台养老顾问已准备好',
      message: '你可以先咨询顾问，进一步了解老人画像、机构差异和看院安排。',
    }
  }
  if (state === 'phone_only') {
    return {
      title: '可先电话咨询养老顾问',
      message: '企业微信二维码暂不可用，电话渠道仍保持独立展示。',
    }
  }
  if (state === 'qr_only') {
    return {
      title: '可通过企业微信联系养老顾问',
      message: '当前没有可公开的顾问电话，二维码渠道仍保持独立展示。',
    }
  }
  if (state === 'inactive') {
    return { title: '顾问服务暂不可用', message: '当前顾问服务处于暂停状态，请稍后再试。' }
  }
  if (state === 'expired') {
    return { title: '顾问公开联系方式待更新', message: '现有联系方式已失效，页面不会展示过期二维码或其他未经确认的号码。' }
  }
  if (state === 'unknown') {
    return { title: '顾问资料待确认', message: '当前无法确认公开联系方式，页面不会猜测或补充其他机构号码。' }
  }
  if (state === 'missing') {
    return { title: '顾问资料待配置', message: '当前还没有可公开的顾问资料，请稍后再试。' }
  }
  if (state === 'failure') {
    return { title: '顾问资料暂时不可用', message: '当前无法安全读取顾问公开资料，请稍后重试。' }
  }
  return { title: '当前没有可公开的联系方式', message: '页面不会展示未经确认的顾问电话或二维码。' }
}

const emptyPhone = (): ConsultantPagePhoneViewModelV1 => ({
  status: 'missing',
  label: '养老顾问电话',
  displayValue: '',
  actionAvailable: false,
  dialValue: '',
  statusText: '平台顾问电话暂未配置。',
})

const emptyQr = (): ConsultantPageQrViewModelV1 => ({
  status: 'missing',
  label: '企业微信养老顾问',
  publicImageUrl: '',
  showImage: false,
  allowLongPress: false,
  statusText: '企业微信二维码暂未配置。',
})

const baseViewModel = (
  pageState: Exclude<ConsultantPageStateV1, 'loading'>,
  stateTitle: string,
  stateMessage: string,
): ConsultantPageViewModelV1 => ({
  pageState,
  roleLabel: '养老顾问',
  displayName: '',
  serviceArea: '',
  serviceDescription: '顾问可以协助解读老人画像、说明推荐与机构差异、确认最新信息，并协助预约带看和后续沟通。',
  stateTitle,
  stateMessage,
  showIdentity: false,
  showContactSection: false,
  showReloadAction: pageState === 'failure'
    || pageState === 'unavailable'
    || pageState === 'unknown'
    || pageState === 'missing',
  phone: emptyPhone(),
  qr: emptyQr(),
  showPhoneAction: false,
  showQrImage: false,
})

export const createConsultantPageViewModelV1 = (
  result: GlobalConsultantPublicApplicationResultV1,
): ConsultantPageViewModelV1 => {
  if (!result.ok) {
    const copy = stateCopy('failure')
    return baseViewModel('failure', copy.title, copy.message)
  }

  const snapshot = result.value
  const consultant = snapshot.consultant
  if (consultant === null) {
    const copy = stateCopy(snapshot.resolutionStatus)
    return baseViewModel(snapshot.resolutionStatus, copy.title, copy.message)
  }

  const phone = projectPhone(consultant.phone)
  const qr = projectQr(consultant.enterpriseWechatQr)
  const pageState = pageStateFor(snapshot.resolutionStatus, consultant.phone, consultant.enterpriseWechatQr)
  const copy = stateCopy(pageState)
  return {
    pageState,
    roleLabel: '养老顾问',
    displayName: consultant.displayName,
    serviceArea: consultant.serviceAreaDisplayName,
    serviceDescription: '顾问可以协助解读老人画像、说明推荐与机构差异、确认最新信息，并协助预约带看和后续沟通。',
    stateTitle: copy.title,
    stateMessage: copy.message,
    showIdentity: true,
    showContactSection: true,
    showReloadAction: false,
    phone,
    qr,
    showPhoneAction: phone.actionAvailable,
    showQrImage: qr.showImage,
  }
}
