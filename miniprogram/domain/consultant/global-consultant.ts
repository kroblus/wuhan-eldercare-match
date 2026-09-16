import type {
  GlobalConsultantSelectionConfigurationV1,
  GlobalConsultantSelectionStatusV1,
  ConsultantValidationIssueV1,
  ConsultantValidationResultV1,
} from '../../types/consultant-v1'
import { GLOBAL_CONSULTANT_SELECTION_ROLE_V1 } from '../../types/consultant-v1'
import {
  hasExactKeys,
  isOneOf,
  isPlainRecord,
  isStableIdentifier,
  isValidIsoTimestamp,
} from './primitives'

export const GLOBAL_CONSULTANT_SNAPSHOT_KIND_V1 = 'global_consultant_public_application_snapshot_v1' as const
export const GLOBAL_CONSULTANT_SELECTION_SOURCE_V1 = 'platform_configuration' as const

const ok = <T>(value: T): ConsultantValidationResultV1<T> => ({ ok: true, value })
const fail = <T>(issues: readonly ConsultantValidationIssueV1[]): ConsultantValidationResultV1<T> => ({ ok: false, issues })
const issue = (path: string): ConsultantValidationIssueV1 => ({
  code: 'INVALID_GLOBAL_CONFIGURATION',
  path,
})

/**
 * Validate the platform-level selection trust boundary. A missing provider
 * value is the only implicit normalization allowed: it means an empty global
 * slot, never an Institution assignment/default lookup.
 */
export const validateGlobalConsultantSelectionConfigurationV1 = (
  input: unknown,
): ConsultantValidationResultV1<GlobalConsultantSelectionConfigurationV1> => {
  if (input === null || input === undefined) {
    return ok({
      role: GLOBAL_CONSULTANT_SELECTION_ROLE_V1,
      sourceState: 'missing',
    })
  }
  if (!isPlainRecord(input)
    || !hasExactKeys(input, ['role', 'sourceState'])
    && !hasExactKeys(input, ['role', 'sourceState', 'consultantId'])) {
    return fail([issue('$')])
  }
  if (input.role !== GLOBAL_CONSULTANT_SELECTION_ROLE_V1
    || !isOneOf(input.sourceState, ['configured', 'missing', 'unavailable', 'unknown'] as const)) {
    return fail([issue('$')])
  }
  if (input.sourceState === 'configured') {
    return hasExactKeys(input, ['role', 'sourceState', 'consultantId'])
      && isStableIdentifier(input.consultantId)
      ? ok({
        role: GLOBAL_CONSULTANT_SELECTION_ROLE_V1,
        sourceState: 'configured',
        consultantId: input.consultantId,
      })
      : fail([issue('consultantId')])
  }
  return hasExactKeys(input, ['role', 'sourceState'])
    ? ok({
      role: GLOBAL_CONSULTANT_SELECTION_ROLE_V1,
      sourceState: input.sourceState,
    })
    : fail([issue('$')])
}

export interface GlobalConsultantSelectionResolutionV1 {
  status: GlobalConsultantSelectionStatusV1
  consultantId: string | null
}

/**
 * Resolve exactly one explicit platform slot. This function intentionally
 * has no Institution input and no default fallback branch.
 */
export const resolveGlobalConsultantSelectionV1 = (
  configuration: GlobalConsultantSelectionConfigurationV1,
): GlobalConsultantSelectionResolutionV1 => configuration.sourceState === 'configured'
  ? { status: 'configured', consultantId: configuration.consultantId }
  : { status: configuration.sourceState, consultantId: null }

export const validateGlobalConsultantApplicationInputV1 = (
  input: unknown,
): ConsultantValidationResultV1<{ snapshotAsOf: string }> => {
  if (!isPlainRecord(input) || !hasExactKeys(input, ['snapshotAsOf']) || !isValidIsoTimestamp(input.snapshotAsOf)) {
    return {
      ok: false,
      issues: [{ code: 'INVALID_GLOBAL_REQUEST', path: '$' }],
    }
  }
  return ok({ snapshotAsOf: input.snapshotAsOf })
}
