export type InstitutionRawRecord = Record<string, unknown>

export const isPlainRecord = (value: unknown): value is InstitutionRawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
    && Math.abs(value) <= 9007199254740991

export const isPositiveInteger = (value: unknown): value is number =>
  isFiniteInteger(value) && value > 0

export const isNonNegativeInteger = (value: unknown): value is number =>
  isFiniteInteger(value) && value >= 0

export const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.indexOf(value as T) >= 0

export const hasUniqueStrings = (values: readonly string[]): boolean => {
  const seen: string[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (seen.indexOf(values[index]) >= 0) {
      return false
    }
    seen.push(values[index])
  }
  return true
}

export const hasExactKeys = (value: InstitutionRawRecord, expectedKeys: readonly string[]): boolean => {
  const actualKeys = Object.keys(value).sort()
  const frozenKeys = expectedKeys.slice().sort()
  if (actualKeys.length !== frozenKeys.length) {
    return false
  }
  for (let index = 0; index < frozenKeys.length; index += 1) {
    if (actualKeys[index] !== frozenKeys[index]) {
      return false
    }
  }
  return true
}

const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const isLeapYear = (year: number): boolean =>
  year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31
}

const isValidCalendarDate = (year: number, month: number, day: number): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)

export const isValidIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    return false
  }
  return isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

export const isValidIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_TIMESTAMP_PATTERN.exec(value)
  if (!match) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return false
  }
  if (match[8] !== 'Z') {
    const offsetHour = Number(match[10])
    const offsetMinute = Number(match[11])
    if (offsetHour > 23 || offsetMinute > 59) {
      return false
    }
  }
  return Number.isFinite(Date.parse(value))
}

export const compareIsoTimestamps = (left: string, right: string): number => {
  const leftEpoch = Date.parse(left)
  const rightEpoch = Date.parse(right)
  if (leftEpoch < rightEpoch) {
    return -1
  }
  if (leftEpoch > rightEpoch) {
    return 1
  }
  return 0
}

export const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') { return false }
  // DNS/IPv4-style authority; no credentials, whitespace, or backslash tricks.
  // Syntax only: this does not claim network reachability or real media evidence.
  const match = /^https:\/\/([a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*)(?::(\d{1,5}))?(?:[/?#][^\s\\]*)?$/i.exec(value)
  return match !== null && (match[2] === undefined || (Number(match[2]) > 0 && Number(match[2]) <= 65535))
}

export const isStableIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{2,63}$/.test(value)

export const isStableRegionCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(value)
