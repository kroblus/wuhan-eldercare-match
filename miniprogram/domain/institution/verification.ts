import type {
  InstitutionCapabilityStatus,
  InstitutionEffectiveCapabilityStatus,
  InstitutionField,
  InstitutionFieldVerification,
} from '../../types/institution'
import { compareIsoTimestamps, hasUniqueStrings, isNonEmptyString, isValidIsoTimestamp } from './primitives'

export type EffectiveInstitutionField<T> =
  | { availability: 'provided'; value: T }
  | { availability: 'unknown'; value: null }

/**
 * Deterministic verification gate. `evaluationAsOf` is mandatory so this pure
 * helper never reads the device clock.
 * The enclosing record must first pass validateInstitutionRecord so referenced
 * evidence is bound to this field/value/revision; this helper does not fetch it.
 */
export const isVerificationCurrentAt = (
  verification: InstitutionFieldVerification,
  evaluationAsOf: string,
): boolean => {
  if (!isValidIsoTimestamp(evaluationAsOf) || verification.status !== 'verified') {
    return false
  }
  if (!Array.isArray(verification.evidenceIds) || verification.evidenceIds.length === 0
    || !verification.evidenceIds.every(isNonEmptyString) || !hasUniqueStrings(verification.evidenceIds)) {
    return false
  }
  if (!isValidIsoTimestamp(verification.verifiedAt)
    || compareIsoTimestamps(verification.verifiedAt, evaluationAsOf) > 0) {
    return false
  }
  if (verification.validUntil !== undefined) {
    if (!isValidIsoTimestamp(verification.validUntil)
      || compareIsoTimestamps(verification.validUntil, evaluationAsOf) < 0) {
      return false
    }
  }
  return true
}

export const resolveEffectiveCapability = (
  capabilityValue: InstitutionCapabilityStatus,
  verification: InstitutionFieldVerification,
  evaluationAsOf: string,
): InstitutionEffectiveCapabilityStatus => {
  if (capabilityValue !== 'supported' && capabilityValue !== 'requires_assessment'
    && capabilityValue !== 'unsupported') {
    return 'unknown'
  }
  return isVerificationCurrentAt(verification, evaluationAsOf)
    ? capabilityValue
    : 'unknown'
}

/** Used by region, supportedTypes and reference price before future matching. */
export const resolveEffectiveInstitutionField = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): EffectiveInstitutionField<T> => {
  if (field.availability !== 'provided'
    || !isVerificationCurrentAt(field.verification, evaluationAsOf)) {
    return { availability: 'unknown', value: null }
  }
  return { availability: 'provided', value: field.value }
}
