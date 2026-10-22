import {
  compareIsoTimestamps,
  hasExactKeys,
  hasUniqueStrings,
  isNonEmptyString,
  isOneOf,
  isPlainRecord,
  isValidIsoTimestamp,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'

const AVAILABILITY_CODES = ['provided', 'unknown', 'unavailable'] as const
const VERIFICATION_CODES = ['unverified', 'verified', 'expired'] as const

export interface InstitutionSuccessorFieldBinding {
  fieldPath: string
  rawValue: unknown
  snapshotType: string
  verification: InstitutionRawRecord
}

export type SuccessorIssue = (code: string, path: string) => void
export type SuccessorValueValidator = (value: unknown) => boolean

const hasAllowedFieldKeys = (value: InstitutionRawRecord): boolean =>
  hasExactKeys(value, ['availability', 'value', 'verification'])
  || hasExactKeys(value, ['availability', 'value', 'verification', 'asOf'])

const hasAllowedVerificationKeys = (value: InstitutionRawRecord): boolean => {
  if (value.status === 'unverified') {
    return hasExactKeys(value, ['status', 'evidenceIds'])
  }
  if (value.status === 'verified') {
    return hasExactKeys(value, ['status', 'evidenceIds', 'verifiedAt'])
      || hasExactKeys(value, ['status', 'evidenceIds', 'verifiedAt', 'validUntil'])
  }
  return hasExactKeys(value, ['status', 'evidenceIds', 'verifiedAt', 'validUntil'])
}

export const validateSuccessorVerification = (
  value: unknown,
  path: string,
  issue: SuccessorIssue,
): value is InstitutionRawRecord => {
  if (!isPlainRecord(value)
    || !isOneOf(value.status, VERIFICATION_CODES)
    || !Array.isArray(value.evidenceIds)
    || !value.evidenceIds.every((item) => isNonEmptyString(item))
    || !hasUniqueStrings(value.evidenceIds as string[])
    || !hasAllowedVerificationKeys(value)) {
    issue('INVALID_FIELD_VERIFICATION', path)
    return false
  }
  if (value.status === 'unverified') {
    return true
  }
  if (value.evidenceIds.length === 0 || !isValidIsoTimestamp(value.verifiedAt)) {
    issue('INVALID_FIELD_VERIFICATION', path)
    return false
  }
  if (value.validUntil !== undefined
    && (!isValidIsoTimestamp(value.validUntil)
      || compareIsoTimestamps(String(value.verifiedAt), String(value.validUntil)) > 0)) {
    issue('INVALID_FIELD_VERIFICATION', path)
    return false
  }
  if (value.status === 'expired' && !isValidIsoTimestamp(value.validUntil)) {
    issue('INVALID_FIELD_VERIFICATION', path)
    return false
  }
  return true
}

export const validateSuccessorField = (
  value: unknown,
  path: string,
  valueValidator: SuccessorValueValidator,
  snapshotType: string,
  errorCode: string,
  issue: SuccessorIssue,
  bindings: InstitutionSuccessorFieldBinding[],
  requireProvided = false,
): InstitutionRawRecord | null => {
  if (!isPlainRecord(value)
    || !hasAllowedFieldKeys(value)
    || !isOneOf(value.availability, AVAILABILITY_CODES)) {
    issue(errorCode, path)
    return null
  }
  if (value.asOf !== undefined && !isValidIsoTimestamp(value.asOf)) {
    issue(errorCode, `${path}.asOf`)
  }
  const verificationValid = validateSuccessorVerification(
    value.verification,
    `${path}.verification`,
    issue,
  )
  const verification = isPlainRecord(value.verification) ? value.verification : null
  if (value.availability === 'provided') {
    if (!valueValidator(value.value)) {
      issue(errorCode, `${path}.value`)
    }
  } else if (value.value !== null) {
    issue(errorCode, `${path}.value`)
  }
  if (requireProvided && value.availability !== 'provided') {
    issue(errorCode, path)
  }
  if (verificationValid && verification) {
    const evidenceIds = verification.evidenceIds as readonly string[]
    if (value.availability === 'unknown'
      && (verification.status !== 'unverified' || evidenceIds.length !== 0)) {
      issue(errorCode, `${path}.verification`)
    }
    const evidenceRequired = verification.status === 'verified'
      || verification.status === 'expired'
    if (evidenceRequired && evidenceIds.length === 0) {
      issue(errorCode, `${path}.verification.evidenceIds`)
    }
    if (evidenceIds.length > 0) {
      bindings.push({
        fieldPath: path,
        rawValue: value.availability === 'provided' ? value.value : value.availability,
        snapshotType: value.availability === 'provided' ? snapshotType : 'stable_code',
        verification,
      })
    }
  }
  return value
}

export const isUnknownOnlyField = (value: unknown): boolean =>
  isPlainRecord(value)
  && value.availability === 'unknown'
  && value.value === null
  && isPlainRecord(value.verification)
  && value.verification.status === 'unverified'
  && Array.isArray(value.verification.evidenceIds)
  && value.verification.evidenceIds.length === 0

export const isProvidedPresentField = (value: unknown): boolean =>
  isPlainRecord(value)
  && value.availability === 'provided'
  && value.value === 'present'

export const isCanonicalTrimmedText = (
  value: unknown,
  minimumCodePoints = 1,
  maximumCodePoints = 2000,
  allowLineBreaks = true,
): value is string => {
  if (typeof value !== 'string'
    || value !== value.trim()
    || value !== value.normalize('NFC')) {
    return false
  }
  const length = Array.from(value).length
  if (length < minimumCodePoints || length > maximumCodePoints || value.indexOf('\u0000') >= 0) {
    return false
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 && !(allowLineBreaks && code === 10)) {
      return false
    }
    if (code === 127) {
      return false
    }
  }
  return true
}
