import type {
  InstitutionCareProcessV1,
} from '../../../types/institution-v1-2'
import {
  hasExactKeys,
  isNonEmptyString,
  isOneOf,
  isPlainRecord,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'
import {
  isProvidedPresentField,
  isUnknownOnlyField,
  validateSuccessorField,
} from './runtime-primitives'
import type {
  InstitutionSuccessorFieldBinding,
  SuccessorIssue,
} from './runtime-primitives'
import {
  CARE_PROCESS_PRESENCE_CODES,
  CARE_RECORD_COMPLETENESS_CODES,
  CARE_RECORD_TRACEABILITY_CODES,
  HANDOVER_CONTENT_CODES,
  INSTITUTION_CARE_PROCESS_SCHEMA_VERSION_V1,
  isCanonicalCareRecordFrequencyCodes,
} from './rules-v1-2'

export interface CareRecordCompletenessCriteriaResolver {
  isApprovedCriteriaRef(criteriaRef: string): boolean
}

export interface CareProcessValidationOptions {
  completenessCriteriaResolver?: CareRecordCompletenessCriteriaResolver
}

const isNonEmptyTrimmedText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value

const validateUnknownDependents = (
  values: readonly { path: string; value: unknown }[],
  issue: SuccessorIssue,
): void => {
  values.forEach((dependent) => {
    if (!isUnknownOnlyField(dependent.value)) {
      issue('INVALID_CARE_PROCESS_RELATION', dependent.path)
    }
  })
}

const validateCareRecord = (
  value: unknown,
  options: CareProcessValidationOptions,
  issue: SuccessorIssue,
  bindings: InstitutionSuccessorFieldBinding[],
): void => {
  const path = 'careProcess.careRecord'
  if (!isPlainRecord(value) || !hasExactKeys(value, [
    'presence',
    'completeness',
    'completenessCriteriaRef',
    'frequency',
    'otherFrequencyNote',
    'traceability',
  ])) {
    issue('INVALID_CARE_PROCESS_SHAPE', path)
    return
  }
  validateSuccessorField(value.presence, `${path}.presence`, (item) =>
    isOneOf(item, CARE_PROCESS_PRESENCE_CODES), 'stable_code',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)
  validateSuccessorField(value.completeness, `${path}.completeness`, (item) =>
    isOneOf(item, CARE_RECORD_COMPLETENESS_CODES), 'stable_code',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)
  validateSuccessorField(value.completenessCriteriaRef, `${path}.completenessCriteriaRef`, (item) =>
    isNonEmptyString(item), 'text',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)
  validateSuccessorField(value.frequency, `${path}.frequency`, isCanonicalCareRecordFrequencyCodes,
    'stable_code_list', 'INVALID_CARE_RECORD_FREQUENCY', issue, bindings)
  validateSuccessorField(value.otherFrequencyNote, `${path}.otherFrequencyNote`, (item) =>
    isNonEmptyTrimmedText(item), 'text',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)
  validateSuccessorField(value.traceability, `${path}.traceability`, (item) =>
    isOneOf(item, CARE_RECORD_TRACEABILITY_CODES), 'stable_code',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)

  const dependents = [
    { path: `${path}.completeness`, value: value.completeness },
    { path: `${path}.completenessCriteriaRef`, value: value.completenessCriteriaRef },
    { path: `${path}.frequency`, value: value.frequency },
    { path: `${path}.otherFrequencyNote`, value: value.otherFrequencyNote },
    { path: `${path}.traceability`, value: value.traceability },
  ]
  if (!isProvidedPresentField(value.presence)) {
    validateUnknownDependents(dependents, issue)
    return
  }

  const completeness = value.completeness
  const criteria = value.completenessCriteriaRef
  if (isPlainRecord(completeness) && completeness.availability === 'provided') {
    if (!isPlainRecord(criteria)
      || criteria.availability !== 'provided'
      || typeof criteria.value !== 'string') {
      issue('INVALID_CARE_RECORD_COMPLETENESS_CRITERIA', `${path}.completenessCriteriaRef`)
    } else if (!options.completenessCriteriaResolver) {
      issue('CARE_RECORD_COMPLETENESS_CRITERIA_RESOLVER_NOT_CONFIGURED', `${path}.completenessCriteriaRef`)
    } else {
      try {
        if (!options.completenessCriteriaResolver.isApprovedCriteriaRef(criteria.value)) {
          issue('INVALID_CARE_RECORD_COMPLETENESS_CRITERIA', `${path}.completenessCriteriaRef`)
        }
      } catch (_error) {
        issue('INVALID_CARE_RECORD_COMPLETENESS_CRITERIA', `${path}.completenessCriteriaRef`)
      }
    }
  } else if (!isUnknownOnlyField(criteria)) {
    issue('INVALID_CARE_RECORD_COMPLETENESS_CRITERIA', `${path}.completenessCriteriaRef`)
  }

  const frequency = value.frequency
  const note = value.otherFrequencyNote
  const includesOther = isPlainRecord(frequency)
    && frequency.availability === 'provided'
    && Array.isArray(frequency.value)
    && frequency.value.indexOf('other') >= 0
  if (includesOther) {
    if (!isPlainRecord(note) || note.availability !== 'provided') {
      issue('INVALID_CARE_RECORD_FREQUENCY', `${path}.otherFrequencyNote`)
    }
  } else if (!isUnknownOnlyField(note)) {
    issue('INVALID_CARE_RECORD_FREQUENCY', `${path}.otherFrequencyNote`)
  }
}

const validateShiftHandover = (
  value: unknown,
  issue: SuccessorIssue,
  bindings: InstitutionSuccessorFieldBinding[],
): void => {
  const path = 'careProcess.shiftHandover24h'
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['presence', 'processNote', 'contents'])) {
    issue('INVALID_CARE_PROCESS_SHAPE', path)
    return
  }
  validateSuccessorField(value.presence, `${path}.presence`, (item) =>
    isOneOf(item, CARE_PROCESS_PRESENCE_CODES), 'stable_code',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)
  validateSuccessorField(value.processNote, `${path}.processNote`, (item) =>
    isNonEmptyString(item), 'text',
  'INVALID_CARE_PROCESS_FACT', issue, bindings)

  if (!isPlainRecord(value.contents)
    || !hasExactKeys(value.contents, HANDOVER_CONTENT_CODES)) {
    issue('INVALID_CARE_PROCESS_SHAPE', `${path}.contents`)
    return
  }
  const contents = value.contents as InstitutionRawRecord
  HANDOVER_CONTENT_CODES.forEach((code) => {
    validateSuccessorField(contents[code], `${path}.contents.${code}`, (item) =>
      isOneOf(item, CARE_PROCESS_PRESENCE_CODES), 'stable_code',
    'INVALID_CARE_PROCESS_FACT', issue, bindings)
  })
  if (!isProvidedPresentField(value.presence)) {
    validateUnknownDependents([
      { path: `${path}.processNote`, value: value.processNote },
      ...HANDOVER_CONTENT_CODES.map((code) => ({
        path: `${path}.contents.${code}`,
        value: contents[code],
      })),
    ], issue)
  }
}

export const validateInstitutionCareProcessV1 = (
  value: unknown,
  options: CareProcessValidationOptions,
  issue: SuccessorIssue,
  bindings: InstitutionSuccessorFieldBinding[],
): value is InstitutionCareProcessV1 => {
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['schemaVersion', 'careRecord', 'shiftHandover24h'])) {
    issue('INVALID_CARE_PROCESS_SHAPE', 'careProcess')
    return false
  }
  if (value.schemaVersion !== INSTITUTION_CARE_PROCESS_SCHEMA_VERSION_V1) {
    issue('INVALID_CARE_PROCESS_SHAPE', 'careProcess.schemaVersion')
  }
  validateCareRecord(value.careRecord, options, issue, bindings)
  validateShiftHandover(value.shiftHandover24h, issue, bindings)
  return true
}
