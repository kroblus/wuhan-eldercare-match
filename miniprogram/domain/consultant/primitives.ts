export type ConsultantRawRecordV1 = Record<string, unknown>

export {
  hasExactKeys,
  isNonEmptyString,
  isOneOf,
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  isValidIsoTimestamp,
  isHttpsUrl,
} from '../institution/primitives'

export const isValidPhoneValue = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }
  if (!/^\+?[0-9][0-9 ()-]{5,31}$/.test(value)) {
    return false
  }
  const digits = value.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 20
}

export const toDialValue = (value: string): string => {
  const prefix = value.trim().startsWith('+') ? '+' : ''
  return `${prefix}${value.replace(/\D/g, '')}`
}
