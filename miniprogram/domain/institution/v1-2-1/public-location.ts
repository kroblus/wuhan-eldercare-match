import type {
  InstitutionAddressV1,
  InstitutionGeoLocationV1,
} from '../../../types/institution-v1-2-1'
import { hasExactKeys, isPlainRecord } from '../primitives'
import { isCanonicalTrimmedText } from '../v1-2/runtime-primitives'
import { MAP_READY_COORDINATE_SYSTEM } from './rules-v1-2-1'

export interface AdministrativeDivisionResolver {
  isValidHierarchy(address: InstitutionAddressV1): boolean
}

export type AddressCanonicalizationResult =
  | { ok: true; value: InstitutionAddressV1 }
  | { ok: false; code: 'INVALID_STRUCTURED_ADDRESS' }

const POSTAL_CODE_PATTERN = /^[A-Za-z0-9-]{1,16}$/

const normalizeText = (value: unknown): string | null =>
  typeof value === 'string' ? value.normalize('NFC').trim() : null

const normalizeArea = (value: unknown): { code: string; displayName: string } | null => {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['code', 'displayName'])) return null
  const code = normalizeText(value.code)
  const displayName = normalizeText(value.displayName)
  if (!code || !displayName
    || !isCanonicalTrimmedText(code, 1, 64, false)
    || !isCanonicalTrimmedText(displayName, 1, 40, false)) {
    return null
  }
  return { code, displayName }
}

export const canonicalizeInstitutionAddress = (input: unknown): AddressCanonicalizationResult => {
  if (!isPlainRecord(input) || !hasExactKeys(input, [
    'countryCode', 'province', 'city', 'district', 'addressLine', 'postalCode',
  ])) {
    return { ok: false, code: 'INVALID_STRUCTURED_ADDRESS' }
  }
  const province = normalizeArea(input.province)
  const city = normalizeArea(input.city)
  const district = normalizeArea(input.district)
  const addressLine = normalizeText(input.addressLine)
  const postalCode = input.postalCode === null ? null : normalizeText(input.postalCode)
  const formattedAddress = province && city && district && addressLine
    ? `${province.displayName}${city.displayName}${district.displayName}${addressLine}`
    : null
  if (normalizeText(input.countryCode) !== 'CN'
    || !province || !city || !district || !addressLine
    || !isCanonicalTrimmedText(addressLine, 1, 200, false)
    || district.displayName === '暂无'
    || addressLine === '暂无'
    || formattedAddress === null
    || Array.from(formattedAddress).length > 300
    || (postalCode !== null && !POSTAL_CODE_PATTERN.test(postalCode))) {
    return { ok: false, code: 'INVALID_STRUCTURED_ADDRESS' }
  }
  return {
    ok: true,
    value: {
      countryCode: 'CN',
      province,
      city,
      district,
      addressLine,
      postalCode,
    },
  }
}

export const isCanonicalInstitutionAddress = (value: unknown): value is InstitutionAddressV1 => {
  const canonical = canonicalizeInstitutionAddress(value)
  if (!canonical.ok || !isPlainRecord(value)) return false
  const input = value as unknown as InstitutionAddressV1
  return input.countryCode === canonical.value.countryCode
    && input.province.code === canonical.value.province.code
    && input.province.displayName === canonical.value.province.displayName
    && input.city.code === canonical.value.city.code
    && input.city.displayName === canonical.value.city.displayName
    && input.district.code === canonical.value.district.code
    && input.district.displayName === canonical.value.district.displayName
    && input.addressLine === canonical.value.addressLine
    && input.postalCode === canonical.value.postalCode
}

export type FormattedAddressResult =
  | { ok: true; value: string }
  | { ok: false; code: 'INVALID_STRUCTURED_ADDRESS' }

export const formatInstitutionAddress = (address: InstitutionAddressV1): FormattedAddressResult => {
  if (!isCanonicalInstitutionAddress(address)) {
    return { ok: false, code: 'INVALID_STRUCTURED_ADDRESS' }
  }
  const value = `${address.province.displayName}${address.city.displayName}${address.district.displayName}${address.addressLine}`
  return Array.from(value).length <= 300
    ? { ok: true, value }
    : { ok: false, code: 'INVALID_STRUCTURED_ADDRESS' }
}

export const isValidInstitutionGeoLocation = (value: unknown): value is InstitutionGeoLocationV1 => {
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['latitude', 'longitude', 'coordinateSystem'])
    || typeof value.latitude !== 'number'
    || typeof value.longitude !== 'number'
    || !Number.isFinite(value.latitude)
    || !Number.isFinite(value.longitude)
    || value.latitude < -90 || value.latitude > 90
    || value.longitude < -180 || value.longitude > 180
    || (value.latitude === 0 && value.longitude === 0)
    || value.coordinateSystem !== MAP_READY_COORDINATE_SYSTEM) {
    return false
  }
  return true
}
