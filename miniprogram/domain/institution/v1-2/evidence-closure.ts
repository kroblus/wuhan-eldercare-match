import { INSTITUTION_EVIDENCE_SOURCE_TYPES } from '../rules'
import {
  hasExactKeys,
  isNonEmptyString,
  isOneOf,
  isPlainRecord,
  isStableIdentifier,
  isValidIsoTimestamp,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'
import type {
  InstitutionSuccessorFieldBinding,
  SuccessorIssue,
} from './runtime-primitives'

const equalValue = (left: unknown, right: unknown, depth = 0): boolean => {
  if (left === right) {
    return true
  }
  if (depth > 16) {
    return false
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((item, index) => equalValue(item, right[index], depth + 1))
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return false
  }
  const keys = Object.keys(left)
  return hasExactKeys(right, keys)
    && keys.every((key) => equalValue(left[key], right[key], depth + 1))
}

const hasEvidenceKeys = (evidence: InstitutionRawRecord): boolean => {
  const required = [
    'evidenceId',
    'institutionId',
    'recordRevision',
    'fieldPath',
    'valueSnapshot',
    'sourceType',
    'verificationStatus',
  ]
  const optional: string[] = []
  if (evidence.observedAt !== undefined) optional.push('observedAt')
  if (evidence.sourceReference !== undefined) optional.push('sourceReference')
  if (evidence.sourceNote !== undefined) optional.push('sourceNote')
  if (evidence.verifiedAt !== undefined) optional.push('verifiedAt')
  if (evidence.validUntil !== undefined) optional.push('validUntil')
  return hasExactKeys(evidence, required.concat(optional))
}

const validateEvidenceShape = (
  evidence: InstitutionRawRecord,
  path: string,
  issue: SuccessorIssue,
  errorCode: string,
): boolean => {
  let valid = true
  if (!hasEvidenceKeys(evidence)
    || !isStableIdentifier(evidence.evidenceId)
    || !isStableIdentifier(evidence.institutionId)
    || typeof evidence.recordRevision !== 'number'
    || !Number.isSafeInteger(evidence.recordRevision)
    || evidence.recordRevision <= 0
    || !isNonEmptyString(evidence.fieldPath)
    || !isPlainRecord(evidence.valueSnapshot)
    || !hasExactKeys(evidence.valueSnapshot, ['valueType', 'value'])
    || !isOneOf(evidence.sourceType, INSTITUTION_EVIDENCE_SOURCE_TYPES)
    || (evidence.observedAt !== undefined && !isValidIsoTimestamp(evidence.observedAt))) {
    issue(errorCode, path)
    return false
  }
  if (!isNonEmptyString(evidence.sourceReference)
    && !isNonEmptyString(evidence.sourceNote)) {
    issue(errorCode, path)
    valid = false
  }
  if (evidence.verificationStatus === 'unverified') {
    if (evidence.verifiedAt !== undefined || evidence.validUntil !== undefined) {
      issue(errorCode, path)
      valid = false
    }
  } else if (evidence.verificationStatus === 'verified') {
    if (!isValidIsoTimestamp(evidence.verifiedAt)
      || (evidence.validUntil !== undefined && !isValidIsoTimestamp(evidence.validUntil))) {
      issue(errorCode, path)
      valid = false
    }
  } else if (evidence.verificationStatus === 'expired') {
    if (!isValidIsoTimestamp(evidence.verifiedAt)
      || !isValidIsoTimestamp(evidence.validUntil)) {
      issue(errorCode, path)
      valid = false
    }
  } else {
    issue(errorCode, path)
    valid = false
  }
  return valid
}

export const validateSuccessorEvidenceClosure = (
  input: InstitutionRawRecord,
  bindings: readonly InstitutionSuccessorFieldBinding[],
  isSuccessorPath: (fieldPath: string) => boolean,
  errorCode: string,
  issue: SuccessorIssue,
): void => {
  if (!Array.isArray(input.evidence)) {
    issue(errorCode, 'evidence')
    return
  }
  const evidenceItems = input.evidence
  const allIds: string[] = []
  evidenceItems.forEach((item, index) => {
    if (!isPlainRecord(item) || !isStableIdentifier(item.evidenceId)) {
      issue(errorCode, `evidence.${index}`)
      return
    }
    if (allIds.indexOf(item.evidenceId) >= 0) {
      issue('DUPLICATE_ID', `evidence.${index}.evidenceId`)
      return
    }
    allIds.push(item.evidenceId)
    if (typeof item.fieldPath === 'string' && isSuccessorPath(item.fieldPath)) {
      validateEvidenceShape(item, `evidence.${index}`, issue, errorCode)
    }
  })

  const referencedIds: string[] = []
  bindings.forEach((binding) => {
    const evidenceIds = binding.verification.evidenceIds
    if (!Array.isArray(evidenceIds)) {
      issue(errorCode, `${binding.fieldPath}.verification.evidenceIds`)
      return
    }
    evidenceIds.forEach((evidenceId) => {
      if (referencedIds.indexOf(String(evidenceId)) < 0) {
        referencedIds.push(String(evidenceId))
      }
      const evidence = evidenceItems.find((item) =>
        isPlainRecord(item) && item.evidenceId === evidenceId)
      if (!isPlainRecord(evidence)) {
        issue('BROKEN_REFERENCE', `${binding.fieldPath}.verification.evidenceIds`)
        return
      }
      const verification = binding.verification
      const snapshot = evidence.valueSnapshot
      if (evidence.institutionId !== input.institutionId
        || evidence.recordRevision !== input.recordRevision
        || evidence.fieldPath !== binding.fieldPath
        || evidence.verificationStatus !== verification.status
        || evidence.verifiedAt !== verification.verifiedAt
        || evidence.validUntil !== verification.validUntil
        || !isPlainRecord(snapshot)
        || snapshot.valueType !== binding.snapshotType
        || !equalValue(snapshot.value, binding.rawValue)) {
        issue(errorCode, binding.fieldPath)
      }
    })
  })

  evidenceItems.forEach((item, index) => {
    if (isPlainRecord(item)
      && typeof item.fieldPath === 'string'
      && isSuccessorPath(item.fieldPath)
      && referencedIds.indexOf(String(item.evidenceId)) < 0) {
      issue('BROKEN_REFERENCE', `evidence.${index}`)
    }
  })
}
