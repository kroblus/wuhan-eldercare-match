import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV12 } from '../../../types/institution-v1-2'
import { validateInstitutionRecordV11 } from '../v1-1/validate-institution-v1-1'
import {
  hasExactKeys,
  isPlainRecord,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'
import { validateInstitutionCareProcessV1 } from './care-process'
import type { CareProcessValidationOptions } from './care-process'
import { validateSuccessorEvidenceClosure } from './evidence-closure'
import { buildInstitutionRecordV11Explicit } from './projection-common'
import {
  INSTITUTION_CONTRACT_VERSION_V12,
  isCareProcessEvidencePath,
} from './rules-v1-2'
import type { InstitutionSuccessorFieldBinding } from './runtime-primitives'

export type InstitutionV12ValidationErrorCode =
  | 'INVALID_V12_RECORD_SHAPE'
  | 'INVALID_CONTRACT_VERSION'
  | 'INVALID_CARE_PROCESS_SHAPE'
  | 'INVALID_CARE_PROCESS_FACT'
  | 'INVALID_CARE_PROCESS_RELATION'
  | 'INVALID_CARE_RECORD_FREQUENCY'
  | 'INVALID_CARE_RECORD_COMPLETENESS_CRITERIA'
  | 'CARE_RECORD_COMPLETENESS_CRITERIA_RESOLVER_NOT_CONFIGURED'
  | 'INVALID_CARE_PROCESS_EVIDENCE'
  | 'INVALID_FIELD_VERIFICATION'
  | 'DUPLICATE_ID'
  | 'BROKEN_REFERENCE'
  | string

export interface InstitutionV12ValidationIssue {
  code: InstitutionV12ValidationErrorCode
  path: string
}

export type InstitutionV12ValidationResult =
  | { ok: true; value: InstitutionRecordV12 }
  | { ok: false; issues: readonly InstitutionV12ValidationIssue[] }

export interface InstitutionV12ValidationOptions extends CareProcessValidationOptions {}

export const INSTITUTION_V12_TOP_LEVEL_KEYS: readonly string[] = [
  'contractVersion',
  'capabilityContractVersion',
  'institutionId',
  'recordRevision',
  'recordProvenance',
  'recordStatus',
  'identity',
  'typeProfile',
  'capabilities',
  'services',
  'medicalSupport',
  'rehabilitationSupport',
  'staffing',
  'healthMonitoring',
  'price',
  'operations',
  'rooms',
  'meal',
  'activity',
  'transportation',
  'majorHospitalAccess',
  'media',
  'vr',
  'qualifications',
  'evidence',
  'careProcess',
]

const projectUncheckedToV11 = (input: InstitutionRawRecord) => {
  const record = input as unknown as InstitutionRecordV12
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.filter((item) => !(
      isPlainRecord(item)
      && typeof item.fieldPath === 'string'
      && isCareProcessEvidencePath(item.fieldPath)
    )) as InstitutionEvidence[]
    : []
  return buildInstitutionRecordV11Explicit(record, evidence)
}

export const validateInstitutionRecordV12 = (
  input: unknown,
  options: InstitutionV12ValidationOptions = {},
): InstitutionV12ValidationResult => {
  const issues: InstitutionV12ValidationIssue[] = []
  const issue = (code: string, path: string): void => {
    issues.push({ code, path })
  }
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [{ code: 'INVALID_V12_RECORD_SHAPE', path: '$' }] }
  }
  if (!hasExactKeys(input, INSTITUTION_V12_TOP_LEVEL_KEYS)) {
    issue('INVALID_V12_RECORD_SHAPE', '$')
  }
  if (input.contractVersion !== INSTITUTION_CONTRACT_VERSION_V12) {
    issue('INVALID_CONTRACT_VERSION', 'contractVersion')
  } else {
    try {
      const v11Validation = validateInstitutionRecordV11(projectUncheckedToV11(input))
      if (!v11Validation.ok) {
        v11Validation.issues.forEach((item) => issue(item.code, item.path))
      }
    } catch (_error) {
      issue('INVALID_V12_RECORD_SHAPE', '$')
    }
  }

  const bindings: InstitutionSuccessorFieldBinding[] = []
  validateInstitutionCareProcessV1(input.careProcess, options, issue, bindings)
  validateSuccessorEvidenceClosure(
    input,
    bindings,
    isCareProcessEvidencePath,
    'INVALID_CARE_PROCESS_EVIDENCE',
    issue,
  )

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as InstitutionRecordV12 }
}
