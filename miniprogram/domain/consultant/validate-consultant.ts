import {
  CONSULTANT_CONTRACT_VERSION_V1,
} from '../../types/consultant-v1'
import type {
  ConsultantAssignmentInspectionV1,
  ConsultantCanonicalInstitutionContextV1,
  ConsultantDefaultConfigurationV1,
  ConsultantProfileV1,
  ConsultantPublicMediaResolutionV1,
  ConsultantValidationIssueV1,
  ConsultantValidationResultV1,
  InstitutionConsultantAssignmentV1,
} from '../../types/consultant-v1'
import {
  hasExactKeys,
  isHttpsUrl,
  isNonEmptyString,
  isOneOf,
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  isValidIsoTimestamp,
  isValidPhoneValue,
} from './primitives'

const ok = <T>(value: T): ConsultantValidationResultV1<T> => ({ ok: true, value })
const fail = <T>(issues: readonly ConsultantValidationIssueV1[]): ConsultantValidationResultV1<T> => ({ ok: false, issues })

const issue = (code: ConsultantValidationIssueV1['code'], path: string): ConsultantValidationIssueV1 => ({ code, path })

const validatePhoneConfig = (
  value: unknown,
): ConsultantValidationIssueV1[] => {
  if (!isPlainRecord(value) || typeof value.sourceState !== 'string') {
    return [issue('INVALID_VALUE', 'platformPhone')]
  }
  if (value.sourceState === 'unavailable' || value.sourceState === 'unknown') {
    return hasExactKeys(value, ['sourceState']) ? [] : [issue('INVALID_VALUE', 'platformPhone')]
  }
  if (value.sourceState !== 'configured'
    || !hasExactKeys(value, ['sourceState', 'value', 'reviewStatus'])
    || !isValidPhoneValue(value.value)
    || !isOneOf(value.reviewStatus, ['approved', 'pending_review', 'rejected', 'unknown'] as const)) {
    return [issue('INVALID_VALUE', 'platformPhone')]
  }
  return []
}

const validateQrConfig = (
  value: unknown,
): ConsultantValidationIssueV1[] => {
  if (!isPlainRecord(value) || typeof value.sourceState !== 'string') {
    return [issue('INVALID_VALUE', 'enterpriseWechatQr')]
  }
  if (value.sourceState === 'unavailable' || value.sourceState === 'unknown') {
    return hasExactKeys(value, ['sourceState']) ? [] : [issue('INVALID_VALUE', 'enterpriseWechatQr')]
  }
  if (value.sourceState !== 'configured'
    || !hasExactKeys(value, ['sourceState', 'wechatQrMediaId', 'reviewStatus', 'lifecycleStatus'])
    || !isStableIdentifier(value.wechatQrMediaId)
    || !isOneOf(value.reviewStatus, ['approved', 'pending_review', 'rejected', 'unknown'] as const)
    || !isOneOf(value.lifecycleStatus, ['active', 'inactive', 'expired', 'unknown'] as const)) {
    return [issue('INVALID_VALUE', 'enterpriseWechatQr')]
  }
  return []
}

export const validateConsultantProfileV1 = (
  input: unknown,
): ConsultantValidationResultV1<ConsultantProfileV1> => {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, [
      'contractVersion',
      'consultantId',
      'displayName',
      'serviceStatus',
      'serviceArea',
      'platformPhone',
      'enterpriseWechatQr',
    ])) {
    return fail([issue('INVALID_CONSULTANT_PROFILE', '$')])
  }
  const issues: ConsultantValidationIssueV1[] = []
  if (input.contractVersion !== CONSULTANT_CONTRACT_VERSION_V1) {
    issues.push(issue('INVALID_CONSULTANT_PROFILE', 'contractVersion'))
  }
  if (!isStableIdentifier(input.consultantId)) {
    issues.push(issue('INVALID_CONSULTANT_PROFILE', 'consultantId'))
  }
  if (!isNonEmptyString(input.displayName)) {
    issues.push(issue('INVALID_CONSULTANT_PROFILE', 'displayName'))
  }
  if (!isOneOf(input.serviceStatus, ['active', 'inactive', 'unknown'] as const)) {
    issues.push(issue('INVALID_CONSULTANT_PROFILE', 'serviceStatus'))
  }
  if (!isPlainRecord(input.serviceArea)
    || !hasExactKeys(input.serviceArea, ['displayName'])
    || !isNonEmptyString(input.serviceArea.displayName)) {
    issues.push(issue('INVALID_CONSULTANT_PROFILE', 'serviceArea'))
  }
  validatePhoneConfig(input.platformPhone).forEach((item) => issues.push(item))
  validateQrConfig(input.enterpriseWechatQr).forEach((item) => issues.push(item))
  return issues.length > 0
    ? fail(issues)
    : ok(input as unknown as ConsultantProfileV1)
}

export const validateInstitutionConsultantAssignmentV1 = (
  input: unknown,
): ConsultantValidationResultV1<InstitutionConsultantAssignmentV1> => {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, ['assignmentId', 'institutionId', 'consultantId', 'status'])
    || !isStableIdentifier(input.assignmentId)
    || !isStableIdentifier(input.institutionId)
    || !isStableIdentifier(input.consultantId)
    || !isOneOf(input.status, ['active', 'inactive'] as const)) {
    return fail([issue('INVALID_ASSIGNMENT', '$')])
  }
  return ok(input as unknown as InstitutionConsultantAssignmentV1)
}

export const validateCanonicalInstitutionContextV1 = (
  input: unknown,
): ConsultantValidationResultV1<ConsultantCanonicalInstitutionContextV1> => {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, ['institutionId', 'recordRevision'])
    || !isStableIdentifier(input.institutionId)
    || !isPositiveInteger(input.recordRevision)) {
    return fail([issue('INVALID_INSTITUTION_CONTEXT', '$')])
  }
  return ok(input as unknown as ConsultantCanonicalInstitutionContextV1)
}

export const validateSnapshotAsOfV1 = (
  input: unknown,
): ConsultantValidationResultV1<string> => isValidIsoTimestamp(input)
  ? ok(input)
  : fail([issue('INVALID_SNAPSHOT_AS_OF', '$')])

export const validateDataProvenanceV1 = (
  input: unknown,
): ConsultantValidationResultV1<'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'> => isOneOf(
  input,
  ['PRODUCTION', 'MOCK_DEVELOPMENT_ONLY'] as const,
)
  ? ok(input)
  : fail([issue('INVALID_PROVENANCE', '$')])

export const validateDefaultConsultantConfigurationV1 = (
  input: unknown,
): ConsultantValidationResultV1<ConsultantDefaultConfigurationV1> => {
  if (input === null || input === undefined) {
    return ok({ enabled: false })
  }
  if (!isPlainRecord(input) || typeof input.enabled !== 'boolean') {
    return fail([issue('INVALID_DEFAULT_CONFIGURATION', '$')])
  }
  if (input.enabled === false) {
    return hasExactKeys(input, ['enabled'])
      ? ok({ enabled: false })
      : fail([issue('INVALID_DEFAULT_CONFIGURATION', '$')])
  }
  return hasExactKeys(input, ['enabled', 'consultantId']) && isStableIdentifier(input.consultantId)
    ? ok({ enabled: true, consultantId: input.consultantId })
    : fail([issue('INVALID_DEFAULT_CONFIGURATION', '$')])
}

export const validatePublicMediaResolutionV1 = (
  input: unknown,
): ConsultantValidationResultV1<ConsultantPublicMediaResolutionV1> => {
  if (!isPlainRecord(input) || typeof input.status !== 'string') {
    return fail([issue('INVALID_MEDIA_RESOLUTION', '$')])
  }
  if (input.status === 'available') {
    return hasExactKeys(input, ['status', 'publicImageUrl']) && isHttpsUrl(input.publicImageUrl)
      ? ok(input as unknown as ConsultantPublicMediaResolutionV1)
      : fail([issue('INVALID_MEDIA_RESOLUTION', '$')])
  }
  if (!isOneOf(input.status, ['unavailable', 'inactive', 'expired', 'unknown', 'missing'] as const)
    || !hasExactKeys(input, ['status'])) {
    return fail([issue('INVALID_MEDIA_RESOLUTION', '$')])
  }
  return ok(input as unknown as ConsultantPublicMediaResolutionV1)
}

export const inspectAssignmentLookupV1 = (
  input: unknown,
): ConsultantValidationResultV1<ConsultantAssignmentInspectionV1> => {
  let assignments: readonly unknown[]
  if (Array.isArray(input)) {
    assignments = input
  } else if (input === null || input === undefined) {
    return ok({ status: 'missing', assignment: null })
  } else if (isPlainRecord(input)
    && hasExactKeys(input, ['status'])
    && input.status === 'missing') {
    return ok({ status: 'missing', assignment: null })
  } else if (isPlainRecord(input)
    && hasExactKeys(input, ['status'])
    && input.status === 'unknown') {
    return ok({ status: 'unknown', assignment: null })
  } else if (isPlainRecord(input)
    && input.status === 'available'
    && Array.isArray(input.assignments)
    && hasExactKeys(input, ['status', 'assignments'])) {
    assignments = input.assignments
  } else if (isPlainRecord(input)
    && hasExactKeys(input, ['status'])
    && input.status === 'ambiguous') {
    return ok({ status: 'ambiguous', assignment: null })
  } else {
    return fail([issue('INVALID_ASSIGNMENT', '$')])
  }
  if (assignments.length === 0) {
    return ok({ status: 'missing', assignment: null })
  }
  const validated: InstitutionConsultantAssignmentV1[] = []
  for (let index = 0; index < assignments.length; index += 1) {
    const result = validateInstitutionConsultantAssignmentV1(assignments[index])
    if (!result.ok) {
      return fail(result.issues.map((item) => ({ ...item, path: `assignments.${index}.${item.path}` })))
    }
    validated.push(result.value)
  }
  if (validated.length !== 1) {
    return ok({ status: 'ambiguous', assignment: null })
  }
  return validated[0].status === 'active'
    ? ok({ status: 'active', assignment: validated[0] })
    : ok({ status: 'inactive', assignment: validated[0] })
}
