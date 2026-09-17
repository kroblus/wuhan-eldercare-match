import {
  projectAppointmentSubmissionAcceptedV1,
  validateAppointmentSubmissionV1,
  validateAuthenticatedPrincipalPortResultV1,
  validateAcceptedPersistenceCandidateV1,
} from '../domain/appointment-institution-visit'
import type {
  AppointmentApplicationErrorCodeV1,
  AppointmentApplicationResultV1,
  AppointmentSubmissionPortV1,
  AuthenticatedPrincipalPortV1,
  AppointmentSubmissionV1,
} from '../types/appointment-institution-visit-v1'

const PUBLIC_MESSAGES: Record<AppointmentApplicationErrorCodeV1, string> = {
  AUTH_REQUIRED: '请先完成登录或身份确认后再提交预约申请。',
  CONTACT_REQUIRED: '请提供预约联系人姓名和用于联系的手机号。',
  VALIDATION_FAILED: '预约信息不完整或无效，请检查后重试。',
  REFERENCE_UNAVAILABLE: '当前机构或老人信息暂不可用于预约，请稍后重试。',
  IDEMPOTENCY_CONFLICT: '本次预约提交信息已发生变化，请重新发起提交。',
  SERVICE_UNAVAILABLE: '预约服务暂不可用，已保留当前填写内容。',
  TECHNICAL_FAILURE: '预约申请暂未提交成功，已保留当前填写内容。',
}

export interface AppointmentApplicationRequestV1 {
  submission: unknown
}

export interface AppointmentVisitApplicationDependenciesV1 {
  authenticatedPrincipalPort?: AuthenticatedPrincipalPortV1
  submissionPort?: AppointmentSubmissionPortV1
}

export interface AppointmentVisitApplicationServiceV1 {
  submit(input: unknown): AppointmentApplicationResultV1
}

const failure = (
  code: AppointmentApplicationErrorCodeV1,
  retryable: boolean,
): AppointmentApplicationResultV1 => ({
  ok: false,
  error: {
    code,
    publicMessage: PUBLIC_MESSAGES[code],
    retryable,
    draftAction: 'RETAIN_LOCAL_DRAFT',
  },
})

const isRequest = (value: unknown): value is AppointmentApplicationRequestV1 => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return Object.keys(candidate).sort().join('|') === 'submission' && Object.prototype.hasOwnProperty.call(candidate, 'submission')
}

const hasContactIssue = (issues: readonly { path: string }[]): boolean => issues.some((item) =>
  item.path === 'contactName' || item.path === 'phone' || item.path === 'phonePurpose' || item.path === 'phoneAuthorization')

const isMissingContactInput = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return !Object.prototype.hasOwnProperty.call(candidate, 'contactName')
    || !Object.prototype.hasOwnProperty.call(candidate, 'phone')
    || !Object.prototype.hasOwnProperty.call(candidate, 'phonePurpose')
    || !Object.prototype.hasOwnProperty.call(candidate, 'phoneAuthorization')
}

const isAcceptedPortResult = (value: unknown): value is { ok: true; candidate: unknown } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return Object.keys(candidate).sort().join('|') === 'candidate|ok' && candidate.ok === true
}

const isFailurePortResult = (value: unknown): value is { ok: false; failure: string } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return Object.keys(candidate).sort().join('|') === 'failure|ok'
    && candidate.ok === false
    && (candidate.failure === 'reference_unavailable'
      || candidate.failure === 'idempotency_conflict'
      || candidate.failure === 'unavailable'
      || candidate.failure === 'technical')
}

const submissionMatchesVisit = (submission: AppointmentSubmissionV1, visit: {
  institutionId: string
  institutionRecordRevision: string
  elderId: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  contactName: string
  phone: string
  phonePurpose: string
  notes?: string
}): boolean => submission.institutionId === visit.institutionId
  && submission.institutionRecordRevision === visit.institutionRecordRevision
  && submission.elderId === visit.elderId
  && submission.visitDate === visit.visitDate
  && submission.visitTimePreference === visit.visitTimePreference
  && submission.participantCount === visit.participantCount
  && submission.pickupRequested === visit.pickupRequested
  && submission.contactName === visit.contactName
  && submission.phone === visit.phone
  && submission.phonePurpose === visit.phonePurpose
  && submission.notes === visit.notes

const resolveSubmission = (
  dependencies: AppointmentVisitApplicationDependenciesV1,
  submission: AppointmentSubmissionV1,
): AppointmentApplicationResultV1 => {
  if (!dependencies.authenticatedPrincipalPort || typeof dependencies.authenticatedPrincipalPort.getPrincipal !== 'function') {
    return failure('AUTH_REQUIRED', true)
  }
  let authResult: unknown
  try {
    authResult = dependencies.authenticatedPrincipalPort.getPrincipal()
  } catch (_error) {
    return failure('SERVICE_UNAVAILABLE', true)
  }
  const authResultValidation = validateAuthenticatedPrincipalPortResultV1(authResult)
  if (!authResultValidation.ok) return failure('SERVICE_UNAVAILABLE', true)
  if (!authResultValidation.value.ok) {
    return authResultValidation.value.failure === 'missing'
      ? failure('AUTH_REQUIRED', true)
      : failure('SERVICE_UNAVAILABLE', true)
  }
  const principal = authResultValidation.value.principal
  if (!dependencies.submissionPort || typeof dependencies.submissionPort.submit !== 'function') {
    return failure('SERVICE_UNAVAILABLE', true)
  }
  let portResult: unknown
  try {
    portResult = dependencies.submissionPort.submit({ principal, submission })
  } catch (_error) {
    return failure('TECHNICAL_FAILURE', true)
  }
  if (isFailurePortResult(portResult)) {
    if (portResult.failure === 'reference_unavailable') return failure('REFERENCE_UNAVAILABLE', true)
    if (portResult.failure === 'idempotency_conflict') return failure('IDEMPOTENCY_CONFLICT', false)
    if (portResult.failure === 'unavailable') return failure('SERVICE_UNAVAILABLE', true)
    return failure('TECHNICAL_FAILURE', true)
  }
  if (!isAcceptedPortResult(portResult)) return failure('TECHNICAL_FAILURE', true)
  const candidateResult = validateAcceptedPersistenceCandidateV1(portResult.candidate)
  if (!candidateResult.ok) return failure('TECHNICAL_FAILURE', true)
  const visit = candidateResult.value.visit
  if (visit.userId !== principal.userId || !submissionMatchesVisit(submission, visit)) {
    return failure('TECHNICAL_FAILURE', true)
  }
  return { ok: true, value: projectAppointmentSubmissionAcceptedV1(visit) }
}

export const createAppointmentVisitApplicationServiceV1 = (
  dependencies: AppointmentVisitApplicationDependenciesV1 = {},
): AppointmentVisitApplicationServiceV1 => ({
  submit(input: unknown): AppointmentApplicationResultV1 {
    if (!isRequest(input)) return failure('VALIDATION_FAILED', false)
    if (isMissingContactInput(input.submission)) return failure('CONTACT_REQUIRED', false)
    const submissionResult = validateAppointmentSubmissionV1(input.submission)
    if (!submissionResult.ok) return failure(hasContactIssue(submissionResult.issues) ? 'CONTACT_REQUIRED' : 'VALIDATION_FAILED', false)
    return resolveSubmission(dependencies, submissionResult.value)
  },
})
