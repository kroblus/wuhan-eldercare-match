import type {
  AppointmentIdempotencyComparisonV1,
  AppointmentIdempotencyInputV1,
  AppointmentIdempotencyRecordV1,
} from '../../types/appointment-institution-visit-v1'
import { validateAppointmentSubmissionV1 } from './validate-appointment-institution-visit'

type CanonicalSubmission = Omit<AppointmentIdempotencyInputV1, 'submission'> & {
  submission: Record<string, unknown>
}

const canonicalSubmission = (input: AppointmentIdempotencyInputV1): CanonicalSubmission => {
  const submission = input.submission
  const normalized: Record<string, unknown> = {
    contractVersion: submission.contractVersion,
    kind: submission.kind,
    idempotencyKey: submission.idempotencyKey,
    institutionId: submission.institutionId,
    institutionRecordRevision: submission.institutionRecordRevision,
    elderId: submission.elderId,
    visitDate: submission.visitDate,
    visitTimePreference: submission.visitTimePreference,
    participantCount: submission.participantCount,
    contactName: submission.contactName,
    phone: submission.phone,
    phonePurpose: submission.phonePurpose,
    phoneAuthorization: submission.phoneAuthorization,
  }
  if (submission.pickupRequested !== undefined) normalized.pickupRequested = submission.pickupRequested
  if (submission.notes !== undefined) normalized.notes = submission.notes
  return { ownerUserId: input.ownerUserId.trim(), idempotencyKey: submission.idempotencyKey, submission: normalized }
}

const canonicalJson = (input: AppointmentIdempotencyInputV1): string => JSON.stringify(canonicalSubmission(input))

export const validateAppointmentIdempotencyInputV1 = (value: unknown): value is AppointmentIdempotencyInputV1 => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).sort().join('|') !== 'idempotencyKey|ownerUserId|submission') return false
  if (typeof candidate.ownerUserId !== 'string' || candidate.ownerUserId.trim().length === 0) return false
  const submissionResult = validateAppointmentSubmissionV1(candidate.submission)
  return submissionResult.ok && candidate.idempotencyKey === submissionResult.value.idempotencyKey
}

export const classifyAppointmentIdempotencyV1 = (
  input: AppointmentIdempotencyInputV1,
  prior: AppointmentIdempotencyRecordV1 | null,
): AppointmentIdempotencyComparisonV1 => {
  if (!prior) return 'new_attempt'
  if (prior.ownerUserId !== input.ownerUserId || prior.idempotencyKey !== input.idempotencyKey) return 'new_attempt'
  if (canonicalJson(input) === canonicalJson(prior)) return 'replay'
  return 'conflict'
}

export const areAppointmentIdempotencyInputsEquivalentV1 = (
  left: AppointmentIdempotencyInputV1,
  right: AppointmentIdempotencyInputV1,
): boolean => canonicalJson(left) === canonicalJson(right)
