import { validateAppointmentSubmissionV1 } from '../domain/appointment-institution-visit/validate-appointment-institution-visit'
import type {
  AppointmentCreateErrorCodeV1,
  AppointmentCreateReceiptV1,
  AppointmentCreateSubmissionResultV1,
} from '../types/appointment-create-v1'
import type { AppointmentSubmissionV1 } from '../types/appointment-institution-visit-v1'

const APPOINTMENT_CONTRACT_VERSION = 'appointment-institution-visit-contract-v1'
const RECEIPT_KIND = 'appointment_submission_receipt_v1'

export interface AppointmentApplicationRequestV1 {
  submission: unknown
  response: unknown
}

export interface AppointmentVisitApplicationServiceV1 {
  submit(input: unknown): AppointmentCreateSubmissionResultV1
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isOpaqueId = (value: unknown): value is string => isNonBlank(value)
  && value.length <= 200
  && !/[\u0000-\u001f\u007f]/.test(value)

const isUtcInstant = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const [year, month, day] = match[1].split('-').map((part) => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === match[1]
    && Number(match[2]) <= 23
    && Number(match[3]) <= 59
    && Number(match[4]) <= 59
}

export const readAppointmentReceiptV1 = (
  value: unknown,
  expected: { institutionId: string; institutionRecordRevision: string },
): AppointmentCreateReceiptV1 | null => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'visitId', 'institutionId', 'institutionRecordRevision',
    'status', 'acceptedAt', 'publicMessage',
  ]) || value.contractVersion !== APPOINTMENT_CONTRACT_VERSION
    || value.kind !== RECEIPT_KIND
    || !isOpaqueId(value.visitId)
    || value.institutionId !== expected.institutionId
    || value.institutionRecordRevision !== expected.institutionRecordRevision
    || value.status !== 'requested'
    || value.publicMessage !== '预约申请已提交'
    || !isUtcInstant(value.acceptedAt)) return null
  return {
    contractVersion: APPOINTMENT_CONTRACT_VERSION,
    kind: RECEIPT_KIND,
    visitId: value.visitId,
    institutionId: expected.institutionId,
    institutionRecordRevision: expected.institutionRecordRevision,
    status: 'requested',
    acceptedAt: value.acceptedAt,
    publicMessage: '预约申请已提交',
  }
}

export const readAppointmentC3PublicResultV1 = (
  value: unknown,
  expected: { institutionId: string; institutionRecordRevision: string },
): AppointmentCreateSubmissionResultV1 => {
  if (!isRecord(value) || !hasExactKeys(value, ['outcome', 'code', 'receipt'])
    || typeof value.outcome !== 'string' || typeof value.code !== 'string') return { kind: 'outcome_unknown' }
  if (value.outcome === 'accepted' || value.outcome === 'replayed') {
    const expectedCode = value.outcome === 'accepted' ? 'ACCEPTED' : 'REPLAYED'
    const receipt = readAppointmentReceiptV1(value.receipt, expected)
    if (value.code !== expectedCode || !receipt) return { kind: 'outcome_unknown' }
    return { kind: 'accepted', receipt, replayed: value.outcome === 'replayed' }
  }
  if (value.receipt !== null) return { kind: 'outcome_unknown' }
  if (value.outcome === 'rejected') {
    const codes: readonly string[] = [
      'AUTH_REQUIRED', 'CONTACT_REQUIRED', 'VALIDATION_FAILED', 'REFERENCE_UNAVAILABLE',
    ]
    if (codes.indexOf(value.code) >= 0) {
      return { kind: 'rejected', code: value.code as AppointmentCreateErrorCodeV1 }
    }
  }
  if (value.outcome === 'conflict' && value.code === 'IDEMPOTENCY_CONFLICT') {
    return { kind: 'rejected', code: 'IDEMPOTENCY_CONFLICT' }
  }
  if (value.outcome === 'unavailable' && value.code === 'SERVICE_UNAVAILABLE') {
    return { kind: 'rejected', code: 'SERVICE_UNAVAILABLE' }
  }
  if (value.outcome === 'technical_failure' && value.code === 'TECHNICAL_FAILURE') {
    return { kind: 'outcome_unknown' }
  }
  return { kind: 'outcome_unknown' }
}

const isRequest = (value: unknown): value is AppointmentApplicationRequestV1 => {
  if (!isRecord(value) || !hasExactKeys(value, ['submission', 'response'])) return false
  return Object.prototype.hasOwnProperty.call(value, 'submission')
    && Object.prototype.hasOwnProperty.call(value, 'response')
}

const invalidInput = (): AppointmentCreateSubmissionResultV1 => ({
  kind: 'rejected',
  code: 'VALIDATION_FAILED',
})

export const createAppointmentVisitApplicationServiceV1 = (): AppointmentVisitApplicationServiceV1 => ({
  submit(input: unknown): AppointmentCreateSubmissionResultV1 {
    if (!isRequest(input)) return invalidInput()
    const submissionValidation = validateAppointmentSubmissionV1(input.submission)
    if (!submissionValidation.ok) return invalidInput()
    const submission: AppointmentSubmissionV1 = submissionValidation.value
    const revision = submission.institutionRecordRevision
    if (!/^[1-9]\d*$/.test(revision) || !Number.isSafeInteger(Number(revision))) return invalidInput()
    return readAppointmentC3PublicResultV1(input.response, {
      institutionId: submission.institutionId,
      institutionRecordRevision: revision,
    })
  },
})
