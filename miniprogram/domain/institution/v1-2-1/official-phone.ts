import type { InstitutionFieldVerification } from '../../../types/institution'
import type {
  InstitutionOfficialPhoneV1,
  InstitutionOfficialPhoneValueV1,
  InstitutionRecordV121,
} from '../../../types/institution-v1-2-1'
import { isVerificationCurrentAt } from '../verification'
import {
  compareIsoTimestamps,
  hasExactKeys,
  isPlainRecord,
  isStableIdentifier,
  isValidIsoTimestamp,
} from '../primitives'
import { isCanonicalTrimmedText } from '../v1-2/runtime-primitives'
import { OFFICIAL_PHONE_PURPOSE_CODES, officialPhoneFieldPath } from './rules-v1-2-1'

const MOBILE_PATTERN = /^1[3-9][0-9]{9}$/
const LANDLINE_AREA_PATTERN = /^0[0-9]{2,3}$/
const LANDLINE_SUBSCRIBER_PATTERN = /^[0-9]{7,8}$/
const EXTENSION_PATTERN = /^[0-9]{1,6}$/
const ALLOWED_INGESTION_SEPARATORS = /[\s()\-]/g

export type OfficialPhoneCanonicalizationResult =
  | { ok: true; value: InstitutionOfficialPhoneValueV1 }
  | { ok: false; code: 'INVALID_OFFICIAL_PHONE' }

export type OfficialPhoneListCanonicalizationResult =
  | { ok: true; value: readonly InstitutionOfficialPhoneV1[] }
  | { ok: false; code: 'INVALID_OFFICIAL_PHONE' | 'DUPLICATE_OFFICIAL_PHONE' }

const asciiCompare = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const normalizePhoneDigits = (value: unknown): string | null => {
  if (typeof value !== 'string' || /[a-zA-Z:/?#&=%]/.test(value)) {
    return null
  }
  return value.trim().replace(ALLOWED_INGESTION_SEPARATORS, '')
}

export const canonicalizeOfficialPhoneValue = (
  input: unknown,
): OfficialPhoneCanonicalizationResult => {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, ['purpose', 'otherPurposeNote', 'number'])
    || typeof input.purpose !== 'string'
    || OFFICIAL_PHONE_PURPOSE_CODES.indexOf(input.purpose as InstitutionOfficialPhoneValueV1['purpose']) < 0
    || !isPlainRecord(input.number)) {
    return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
  }
  const purpose = input.purpose as InstitutionOfficialPhoneValueV1['purpose']
  let note: string | null = null
  if (purpose === 'other') {
    if (typeof input.otherPurposeNote !== 'string') {
      return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
    }
    note = input.otherPurposeNote.normalize('NFC').trim()
    if (!isCanonicalTrimmedText(note, 1, 80, false) || /[\r\n]/.test(note)) {
      return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
    }
  } else if (input.otherPurposeNote !== null) {
    return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
  }

  if (input.number.kind === 'mainland_mobile'
    && hasExactKeys(input.number, ['kind', 'countryCallingCode', 'nationalNumber', 'extension'])) {
    const nationalNumber = normalizePhoneDigits(input.number.nationalNumber)
    if (String(input.number.countryCallingCode).trim() !== '+86'
      || !nationalNumber
      || !MOBILE_PATTERN.test(nationalNumber)
      || input.number.extension !== null) {
      return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
    }
    return {
      ok: true,
      value: {
        purpose,
        otherPurposeNote: note,
        number: {
          kind: 'mainland_mobile',
          countryCallingCode: '+86',
          nationalNumber,
          extension: null,
        },
      },
    }
  }
  if (input.number.kind === 'mainland_landline'
    && hasExactKeys(input.number, [
      'kind', 'countryCallingCode', 'areaCode', 'subscriberNumber', 'extension',
    ])) {
    const areaCode = normalizePhoneDigits(input.number.areaCode)
    const subscriberNumber = normalizePhoneDigits(input.number.subscriberNumber)
    const extension = input.number.extension === null
      ? null : normalizePhoneDigits(input.number.extension)
    if (String(input.number.countryCallingCode).trim() !== '+86'
      || !areaCode || !LANDLINE_AREA_PATTERN.test(areaCode)
      || !subscriberNumber || !LANDLINE_SUBSCRIBER_PATTERN.test(subscriberNumber)
      || (extension !== null && !EXTENSION_PATTERN.test(extension))) {
      return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
    }
    return {
      ok: true,
      value: {
        purpose,
        otherPurposeNote: note,
        number: {
          kind: 'mainland_landline',
          countryCallingCode: '+86',
          areaCode,
          subscriberNumber,
          extension,
        },
      },
    }
  }
  return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
}

export const officialPhoneBaseDigits = (value: InstitutionOfficialPhoneValueV1): string =>
  value.number.kind === 'mainland_mobile'
    ? value.number.nationalNumber
    : `${value.number.areaCode}${value.number.subscriberNumber}`

export const officialPhoneDialValue = officialPhoneBaseDigits

export const officialPhoneDisplayValue = (value: InstitutionOfficialPhoneValueV1): string => {
  if (value.number.kind === 'mainland_mobile') {
    return `+86 ${value.number.nationalNumber}`
  }
  const base = `+86 ${value.number.areaCode}-${value.number.subscriberNumber}`
  return value.number.extension === null ? base : `${base} 转 ${value.number.extension}`
}

export const officialPhoneValueKey = (value: InstitutionOfficialPhoneValueV1): string => {
  const extension = value.number.extension === null ? '' : value.number.extension
  return `${value.number.kind}|${officialPhoneBaseDigits(value)}|${extension}`
}

const equalOfficialPhoneValue = (
  left: InstitutionOfficialPhoneValueV1,
  right: InstitutionOfficialPhoneValueV1,
): boolean => {
  if (left.purpose !== right.purpose
    || left.otherPurposeNote !== right.otherPurposeNote
    || left.number.kind !== right.number.kind
    || left.number.countryCallingCode !== right.number.countryCallingCode) {
    return false
  }
  if (left.number.kind === 'mainland_mobile' && right.number.kind === 'mainland_mobile') {
    return left.number.nationalNumber === right.number.nationalNumber
      && left.number.extension === right.number.extension
  }
  if (left.number.kind === 'mainland_landline' && right.number.kind === 'mainland_landline') {
    return left.number.areaCode === right.number.areaCode
      && left.number.subscriberNumber === right.number.subscriberNumber
      && left.number.extension === right.number.extension
  }
  return false
}

export const compareOfficialPhones = (
  left: InstitutionOfficialPhoneV1,
  right: InstitutionOfficialPhoneV1,
): number => {
  const leftValue = left.phone.value as InstitutionOfficialPhoneValueV1
  const rightValue = right.phone.value as InstitutionOfficialPhoneValueV1
  const purposeOrder = OFFICIAL_PHONE_PURPOSE_CODES.indexOf(leftValue.purpose)
    - OFFICIAL_PHONE_PURPOSE_CODES.indexOf(rightValue.purpose)
  if (purposeOrder !== 0) return purposeOrder
  const valueOrder = asciiCompare(officialPhoneValueKey(leftValue), officialPhoneValueKey(rightValue))
  return valueOrder !== 0
    ? valueOrder
    : asciiCompare(left.officialPhoneKey, right.officialPhoneKey)
}

export const canonicalizeOfficialPhones = (
  input: readonly InstitutionOfficialPhoneV1[],
): OfficialPhoneListCanonicalizationResult => {
  if (!Array.isArray(input)) {
    return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
  }
  const result: InstitutionOfficialPhoneV1[] = []
  const keys: string[] = []
  const values: string[] = []
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index]
    if (!isPlainRecord(item)
      || !hasExactKeys(item, ['officialPhoneKey', 'phone'])
      || !isStableIdentifier(item.officialPhoneKey)
      || !isPlainRecord(item.phone)
      || item.phone.availability !== 'provided') {
      return { ok: false, code: 'INVALID_OFFICIAL_PHONE' }
    }
    const typedItem = item as unknown as InstitutionOfficialPhoneV1
    const canonical = canonicalizeOfficialPhoneValue(item.phone.value)
    if (!canonical.ok) return canonical
    const valueKey = officialPhoneValueKey(canonical.value)
    if (keys.indexOf(item.officialPhoneKey) >= 0 || values.indexOf(valueKey) >= 0) {
      return { ok: false, code: 'DUPLICATE_OFFICIAL_PHONE' }
    }
    keys.push(item.officialPhoneKey)
    values.push(valueKey)
    result.push({
      officialPhoneKey: item.officialPhoneKey,
      phone: {
        availability: 'provided',
        value: canonical.value,
        ...(typedItem.phone.asOf === undefined ? {} : { asOf: typedItem.phone.asOf }),
        verification: typedItem.phone.verification as InstitutionFieldVerification,
      },
    })
  }
  return { ok: true, value: result.slice().sort(compareOfficialPhones) }
}

export const isCanonicalOfficialPhoneValue = (value: unknown): value is InstitutionOfficialPhoneValueV1 => {
  const canonical = canonicalizeOfficialPhoneValue(value)
  if (!canonical.ok || !isPlainRecord(value)) return false
  return equalOfficialPhoneValue(canonical.value, value as unknown as InstitutionOfficialPhoneValueV1)
}

export const isCanonicalOfficialPhoneOrder = (phones: readonly InstitutionOfficialPhoneV1[]): boolean => {
  const canonical = canonicalizeOfficialPhones(phones)
  if (!canonical.ok || canonical.value.length !== phones.length) return false
  return canonical.value.every((item, index) => item === phones[index]
    || (item.officialPhoneKey === phones[index].officialPhoneKey
      && equalOfficialPhoneValue(
        item.phone.value as InstitutionOfficialPhoneValueV1,
        phones[index].phone.value as InstitutionOfficialPhoneValueV1,
      )))
}

export type InstitutionPhonePublicStatus =
  | 'current_verified'
  | 'unverified_with_source'
  | 'unverified_without_source'
  | 'expired'

export interface InstitutionOfficialPhonePublicSnapshot {
  officialPhoneKey: string
  purpose: InstitutionOfficialPhoneValueV1['purpose']
  displayValue: string | null
  dialValue: string | null
  extension: string | null
  status: InstitutionPhonePublicStatus
  verifiedDate: string | null
  callActionAvailable: boolean
}

const hasAllowedSourceClosure = (
  record: InstitutionRecordV121,
  phone: InstitutionOfficialPhoneV1,
): boolean => {
  const ids = phone.phone.verification.evidenceIds
  if (ids.length === 0) return false
  const expectedPath = officialPhoneFieldPath(phone.officialPhoneKey)
  return ids.every((id) => record.evidence.some((evidence) =>
    evidence.evidenceId === id
    && evidence.fieldPath === expectedPath
    && evidence.verificationStatus === 'unverified'))
}

export const deriveOfficialPhonePublicSnapshot = (
  record: InstitutionRecordV121,
  phone: InstitutionOfficialPhoneV1,
  evaluationAsOf: string,
): InstitutionOfficialPhonePublicSnapshot => {
  const value = phone.phone.value as InstitutionOfficialPhoneValueV1
  const verification = phone.phone.verification
  const verifiedAt = verification.status === 'unverified' ? null : verification.verifiedAt
  const directoryCurrent = isVerificationCurrentAt(
    record.officialContact.phoneDirectoryPresence.verification,
    evaluationAsOf,
  )
  const phoneCurrent = isVerificationCurrentAt(verification, evaluationAsOf)
  if (directoryCurrent && phoneCurrent) {
    return {
      officialPhoneKey: phone.officialPhoneKey,
      purpose: value.purpose,
      displayValue: officialPhoneDisplayValue(value),
      dialValue: officialPhoneDialValue(value),
      extension: value.number.extension,
      status: 'current_verified',
      verifiedDate: verifiedAt === null ? null : verifiedAt.slice(0, 10),
      callActionAvailable: record.recordStatus === 'published',
    }
  }
  const expired = verification.status === 'expired'
    || (verification.status === 'verified'
      && typeof verification.validUntil === 'string'
      && isValidIsoTimestamp(evaluationAsOf)
      && compareIsoTimestamps(verification.validUntil, evaluationAsOf) < 0)
  if (expired) {
    return {
      officialPhoneKey: phone.officialPhoneKey,
      purpose: value.purpose,
      displayValue: null,
      dialValue: null,
      extension: null,
      status: 'expired',
      verifiedDate: verifiedAt === null ? null : verifiedAt.slice(0, 10),
      callActionAvailable: false,
    }
  }
  const allowed = verification.status === 'unverified' && hasAllowedSourceClosure(record, phone)
  return {
    officialPhoneKey: phone.officialPhoneKey,
    purpose: value.purpose,
    displayValue: allowed ? officialPhoneDisplayValue(value) : null,
    dialValue: null,
    extension: allowed ? value.number.extension : null,
    status: allowed ? 'unverified_with_source' : 'unverified_without_source',
    verifiedDate: null,
    callActionAvailable: false,
  }
}
