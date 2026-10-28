/** Shared pure address, map and official-phone display models. */
import type {
  InstitutionDetailFutureSectionsV121, InstitutionMapApplicationStatusV121,
  InstitutionOfficialPhoneApplicationSnapshotV121,
} from '../../types/institution-list-detail'

export type InstitutionContactLocationTone = 'positive' | 'neutral' | 'warning' | 'muted'

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
  addressStatusTone: InstitutionContactLocationTone
  mapState: 'map_unavailable' | 'map_ready'
  mapStatus: string
  mapStatusTone: InstitutionContactLocationTone
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
  statusTone: InstitutionContactLocationTone
  verifiedDateLabel: string
  callAction: InstitutionDetailPhoneActionViewModel
}

export interface InstitutionDetailOfficialContactViewModel {
  state: 'ready' | 'unknown' | 'unavailable'
  statusLabel: string
  statusTone: InstitutionContactLocationTone
  hasPhones: boolean
  phones: readonly InstitutionDetailOfficialPhoneViewModel[]
}

const OFFICIAL_PHONE_PURPOSE_LABELS: Record<string, string> = {
  main: '机构主电话',
  admission_consultation: '入住咨询',
  service: '服务电话',
  other: '其它',
}

export const dateOnlyLabel = (value: string | null): string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `核验日期：${value}` : ''

export type InstitutionAddressViewModel = Pick<InstitutionDetailLocationViewModel,
  'addressState' | 'address' | 'addressStatus' | 'addressStatusTone'>

export const addressViewModel = (
  officialAddress: InstitutionDetailFutureSectionsV121['officialAddress'],
): InstitutionAddressViewModel => {
  const addressState = addressStateFor(officialAddress)
  const addressStatus = addressStatusCopy(addressState)
  const address = officialAddress.formattedAddress || addressStatus
  const addressStatusTone = addressState === 'address_unavailable' || addressState === 'address_expired'
    ? 'warning'
    : addressState === 'ready' ? 'positive' : 'muted'
  return { addressState, address, addressStatus, addressStatusTone }
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
): InstitutionContactLocationTone => {
  if (status === 'available') return 'positive'
  if (status === 'address_unavailable' || status === 'geo_unavailable'
    || status === 'address_expired' || status === 'geo_expired' || status === 'unavailable') return 'warning'
  return 'muted'
}

export const locationViewModel = (
  future: Pick<InstitutionDetailFutureSectionsV121, 'officialAddress' | 'mapLocation'>,
): InstitutionDetailLocationViewModel => {
  const { addressState, address, addressStatus, addressStatusTone } = addressViewModel(future.officialAddress)
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
): InstitutionContactLocationTone =>
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

export const officialContactViewModel = (
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
