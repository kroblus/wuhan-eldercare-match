import type { VisitEvaluationWriteContentV1 } from './visit-evaluation-write-content'

const SUBMISSION_CONTRACT_VERSION = 'visit-evaluation-production-write-contract-v1'
const SUBMISSION_REQUEST_KIND = 'visit_evaluation_submission_request_v1'
const SUBMISSION_RESULT_KIND = 'visit_evaluation_submission_result_v1'
const REQUEST_TIMEOUT_MS = 15000

export interface VisitEvaluationSubmissionReceiptV1 {
  evaluationId: string
  visitId: string
  state: 'submitted'
  submittedAt: string
}

export interface VisitEvaluationSubmissionFieldErrorV1 {
  field: string
  code: string
}

export type ProductionVisitEvaluationSubmitResultV1 =
  | { kind: 'submitted'; receipt: VisitEvaluationSubmissionReceiptV1; replayed: boolean }
  | { kind: 'validation_failed'; fieldErrors: VisitEvaluationSubmissionFieldErrorV1[] }
  | { kind: 'already_submitted' }
  | { kind: 'idempotency_conflict' }
  | { kind: 'auth_required' }
  | { kind: 'not_found' }
  | { kind: 'not_completed' }
  | { kind: 'service_unavailable' }
  | { kind: 'technical_failure' }

export interface VisitEvaluationSubmissionRequestV1 {
  visitId: string
  idempotencyKey: string
  content: VisitEvaluationWriteContentV1
}

export interface VisitEvaluationAuthenticatedSubmitAccessV1 {
  submit(request: VisitEvaluationSubmissionRequestV1): Promise<{
    statusCode: number
    data: unknown
  } | null>
  clearSession(): void
}

export interface ProductionVisitEvaluationSubmitProviderV1 {
  submit(request: VisitEvaluationSubmissionRequestV1): Promise<ProductionVisitEvaluationSubmitResultV1>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isSafeText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string'
  && value.trim().length > 0
  && value.length <= maxLength
  && !/[\u0000-\u001f\u007f]/.test(value)

const AUTH_RESOLUTIONS = ['authenticated', 'missing', 'expired', 'invalid', 'unavailable', 'technical_failure']
const OUTCOMES = ['accepted', 'replayed', 'rejected', 'conflict', 'unavailable', 'technical_failure']

const readFieldErrors = (value: unknown): VisitEvaluationSubmissionFieldErrorV1[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const errors: VisitEvaluationSubmissionFieldErrorV1[] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['field', 'code'])
      || !isSafeText(candidate.field, 120) || !isSafeText(candidate.code, 80)) return null
    errors.push({ field: candidate.field, code: candidate.code })
  }
  return errors
}

const readReceipt = (value: unknown, expectedVisitId: string): VisitEvaluationSubmissionReceiptV1 | null => {
  if (!isRecord(value) || !hasExactKeys(value, ['evaluationId', 'visitId', 'state', 'submittedAt'])
    || !isSafeText(value.evaluationId, 200)
    || value.visitId !== expectedVisitId
    || value.state !== 'submitted'
    || !isSafeText(value.submittedAt, 80)
    || !Number.isFinite(Date.parse(value.submittedAt))) return null
  return {
    evaluationId: value.evaluationId,
    visitId: value.visitId as string,
    state: 'submitted',
    submittedAt: value.submittedAt,
  }
}

/** Strictly projects the frozen Backend envelope into safe application outcomes. */
export const readVisitEvaluationSubmissionResultV1 = (
  value: unknown,
  expectedVisitId: string,
): ProductionVisitEvaluationSubmitResultV1 => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'authResolution', 'outcome', 'code', 'receipt', 'fieldErrors',
  ]) || value.contractVersion !== SUBMISSION_CONTRACT_VERSION
    || value.kind !== SUBMISSION_RESULT_KIND
    || typeof value.authResolution !== 'string' || !AUTH_RESOLUTIONS.includes(value.authResolution)
    || typeof value.outcome !== 'string' || !OUTCOMES.includes(value.outcome)
    || !isSafeText(value.code, 100)) return { kind: 'technical_failure' }

  if (value.outcome === 'accepted' || value.outcome === 'replayed') {
    const receipt = readReceipt(value.receipt, expectedVisitId)
    const expectedCode = value.outcome === 'accepted' ? 'ACCEPTED' : 'REPLAYED'
    if (value.authResolution !== 'authenticated' || value.code !== expectedCode
      || !receipt || value.fieldErrors !== null) return { kind: 'technical_failure' }
    return { kind: 'submitted', receipt, replayed: value.outcome === 'replayed' }
  }

  if (value.receipt !== null) return { kind: 'technical_failure' }
  if (value.code === 'VALIDATION_FAILED' && value.outcome === 'rejected') {
    if (value.authResolution !== 'authenticated') return { kind: 'technical_failure' }
    const fieldErrors = readFieldErrors(value.fieldErrors)
    return fieldErrors ? { kind: 'validation_failed', fieldErrors } : { kind: 'technical_failure' }
  }
  if (value.fieldErrors !== null) return { kind: 'technical_failure' }

  if (value.code === 'AUTH_REQUIRED' && value.outcome === 'rejected'
    && ['missing', 'expired', 'invalid'].includes(value.authResolution)) return { kind: 'auth_required' }
  if (value.authResolution === 'authenticated') {
    if (value.code === 'NOT_FOUND' && value.outcome === 'rejected') return { kind: 'not_found' }
    if (value.code === 'NOT_COMPLETED' && value.outcome === 'rejected') return { kind: 'not_completed' }
    if (value.code === 'ALREADY_SUBMITTED' && value.outcome === 'rejected') return { kind: 'already_submitted' }
    if (value.code === 'IDEMPOTENCY_CONFLICT' && value.outcome === 'conflict') return { kind: 'idempotency_conflict' }
  }
  if (value.code === 'SERVICE_UNAVAILABLE' && value.outcome === 'unavailable'
    && ['authenticated', 'unavailable'].includes(value.authResolution)) return { kind: 'service_unavailable' }
  if (value.code === 'TECHNICAL_FAILURE' && value.outcome === 'technical_failure'
    && ['authenticated', 'technical_failure'].includes(value.authResolution)) return { kind: 'technical_failure' }
  return { kind: 'technical_failure' }
}

export const createProductionVisitEvaluationSubmitProviderV1 = (
  access: VisitEvaluationAuthenticatedSubmitAccessV1,
): ProductionVisitEvaluationSubmitProviderV1 => ({
  async submit(request): Promise<ProductionVisitEvaluationSubmitResultV1> {
    if (!request || !isSafeText(request.visitId, 200)
      || !isSafeText(request.idempotencyKey, 128)
      || request.idempotencyKey.length < 8
      || /\s/.test(request.idempotencyKey)) return { kind: 'technical_failure' }

    let response: { statusCode: number; data: unknown } | null
    try {
      response = await access.submit(request)
    } catch (_error) {
      return { kind: 'technical_failure' }
    }
    if (!response) return { kind: 'auth_required' }
    if (response.statusCode !== 200) return { kind: 'technical_failure' }

    const result = readVisitEvaluationSubmissionResultV1(response.data, request.visitId)
    if (result.kind === 'auth_required') access.clearSession()
    return result
  },
})

export const createVisitEvaluationSubmissionBodyV1 = (
  request: VisitEvaluationSubmissionRequestV1,
): Record<string, unknown> => ({
  ...request.content,
  contractVersion: SUBMISSION_CONTRACT_VERSION,
  kind: SUBMISSION_REQUEST_KIND,
  idempotencyKey: request.idempotencyKey,
})

export const VISIT_EVALUATION_SUBMISSION_ENDPOINT_V1 = '/api/v1/visits'
export const VISIT_EVALUATION_SUBMISSION_TIMEOUT_MS_V1 = REQUEST_TIMEOUT_MS
