import type {
  ConsultantProfileV1,
  ConsultantPublicPhoneProjectionV1,
  ConsultantPublicWechatQrProjectionV1,
  ConsultantPublicMediaResolutionV1,
  ConsultantServiceStatusV1,
} from '../../types/consultant-v1'
import { toDialValue } from './primitives'

export const CONSULTANT_PHONE_LABEL_V1 = '养老顾问电话' as const
export const CONSULTANT_QR_LABEL_V1 = '企业微信养老顾问' as const

const unavailablePhone = (
  status: 'unavailable' | 'unknown' | 'missing',
): ConsultantPublicPhoneProjectionV1 => ({
  status,
  label: CONSULTANT_PHONE_LABEL_V1,
  actionAvailable: false,
})

const unavailableQr = (
  status: 'unavailable' | 'inactive' | 'expired' | 'unknown' | 'missing',
): ConsultantPublicWechatQrProjectionV1 => ({
  status,
  label: CONSULTANT_QR_LABEL_V1,
  actionAvailable: false,
})

export const projectConsultantPhoneV1 = (
  profile: ConsultantProfileV1,
): ConsultantPublicPhoneProjectionV1 => {
  if (profile.serviceStatus !== 'active') {
    return unavailablePhone(profile.serviceStatus === 'unknown' ? 'unknown' : 'unavailable')
  }
  const phone = profile.platformPhone
  if (phone.sourceState === 'unavailable') {
    return unavailablePhone('unavailable')
  }
  if (phone.sourceState === 'unknown') {
    return unavailablePhone('unknown')
  }
  if (phone.reviewStatus === 'approved') {
    return {
      status: 'available',
      label: CONSULTANT_PHONE_LABEL_V1,
      displayValue: phone.value,
      dialValue: toDialValue(phone.value),
      actionAvailable: true,
    }
  }
  return unavailablePhone(phone.reviewStatus === 'unknown' ? 'unknown' : 'unavailable')
}

export const projectConsultantQrV1 = (
  profile: ConsultantProfileV1,
  mediaResolution: ConsultantPublicMediaResolutionV1 | null,
): ConsultantPublicWechatQrProjectionV1 => {
  if (profile.serviceStatus !== 'active') {
    return unavailableQr(profile.serviceStatus === 'unknown' ? 'unknown' : 'inactive')
  }
  const qr = profile.enterpriseWechatQr
  if (qr.sourceState === 'unavailable') {
    return unavailableQr('unavailable')
  }
  if (qr.sourceState === 'unknown') {
    return unavailableQr('unknown')
  }
  if (qr.reviewStatus === 'unknown' || qr.lifecycleStatus === 'unknown') {
    return unavailableQr('unknown')
  }
  if (qr.reviewStatus !== 'approved' || qr.lifecycleStatus !== 'active') {
    if (qr.lifecycleStatus === 'expired') {
      return unavailableQr('expired')
    }
    if (qr.lifecycleStatus === 'inactive') {
      return unavailableQr('inactive')
    }
    return unavailableQr('unavailable')
  }
  if (mediaResolution === null) {
    return unavailableQr('unavailable')
  }
  if (mediaResolution.status === 'available') {
    return {
      status: 'available',
      label: CONSULTANT_QR_LABEL_V1,
      publicImageUrl: mediaResolution.publicImageUrl,
      actionAvailable: true,
    }
  }
  return unavailableQr(mediaResolution.status)
}

/**
 * Shared public allowlist for both Institution-bound and platform-global
 * Consultant application snapshots. Context selection is deliberately kept
 * outside this helper.
 */
export const projectConsultantPublicProfileV1 = (
  profile: ConsultantProfileV1,
  mediaResolution: ConsultantPublicMediaResolutionV1 | null,
): import('../../types/consultant-v1').ConsultantPublicProfileV1 => ({
  consultantId: profile.consultantId,
  displayName: profile.displayName,
  serviceStatus: profile.serviceStatus,
  serviceAreaDisplayName: profile.serviceArea.displayName,
  phone: projectConsultantPhoneV1(profile),
  enterpriseWechatQr: projectConsultantQrV1(profile, mediaResolution),
})

export const deriveConsultantResolutionStatusV1 = (
  phone: ConsultantPublicPhoneProjectionV1,
  qr: ConsultantPublicWechatQrProjectionV1,
): 'available' | 'unavailable' | 'expired' | 'unknown' | 'missing' => {
  if (phone.status === 'available' || qr.status === 'available') {
    return 'available'
  }
  if (phone.status === 'unknown' || qr.status === 'unknown') {
    return 'unknown'
  }
  if (qr.status === 'expired' && (phone.status === 'unavailable' || phone.status === 'missing')) {
    return 'expired'
  }
  if (phone.status === 'missing' && qr.status === 'missing') {
    return 'missing'
  }
  return 'unavailable'
}

export const isActiveConsultantProfileV1 = (
  profile: ConsultantProfileV1,
): boolean => profile.serviceStatus === 'active'

export const serviceStatusToNonAvailablePhoneStatusV1 = (
  status: ConsultantServiceStatusV1,
): 'unavailable' | 'unknown' => status === 'unknown' ? 'unknown' : 'unavailable'
