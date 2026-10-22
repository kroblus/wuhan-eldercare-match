import {
  createC5AuthenticatedJsonHeadersV1,
  createC5AuthenticatedBackendSessionClientV1,
  createDefaultWeChatC5BackendTransportV1,
} from './c5-authenticated-backend-session'
import type {
  C5AuthenticatedBackendSessionV1,
  WeChatC5BackendTransportV1,
} from './c5-authenticated-backend-session'
import {
  createAppointmentVisitApplicationServiceV1,
  readAppointmentReceiptV1,
} from './appointment-institution-visit-application'
import { validateAppointmentSubmissionV1 } from '../domain/appointment-institution-visit/validate-appointment-institution-visit'
import { normalizeAppointmentPhoneV1 } from '../domain/appointment-institution-visit/phone-format'
import type {
  AppointmentCreateFormErrorsV1,
  AppointmentCreateFormV1,
  AppointmentCreateInstitutionV1,
  AppointmentCreateReceiptV1,
  AppointmentCreateSubmissionResultV1,
  AppointmentCreateSuccessHandoffV1,
  AppointmentCreateSubmittedSummaryV1,
} from '../types/appointment-create-v1'
import type { AppointmentSubmissionV1 } from '../types/appointment-institution-visit-v1'

const ELDER_ENDPOINT = '/api/v1/elder-record'
const SUBMISSION_ENDPOINT = '/api/v1/appointment-submissions'
const REQUEST_TIMEOUT_MS = 15000
const APPOINTMENT_CONTRACT_VERSION = 'appointment-institution-visit-contract-v1'
const APPOINTMENT_SUBMISSION_KIND = 'appointment_submission_v1'
const ELDER_CONTRACT_VERSION = 'elder-record-identity-api-v1'
const ELDER_RESOLUTION_KIND = 'elder_record_resolution_result_v1'
const ELDER_ESTABLISHMENT_KIND = 'elder_record_establishment_result_v1'
const PHONE_PURPOSE = 'appointment_or_consultant_contact'

export interface AppointmentCreateTransportV1 extends WeChatC5BackendTransportV1 {}

export type AppointmentElderPrepareResultV1 =
  | { kind: 'ready'; elderId: string }
  | { kind: 'auth_required' }
  | { kind: 'unavailable' }

export interface AppointmentCreateClientV1 {
  /** Call only after the user submits a locally valid Appointment form. */
  resolveOrEstablishElderAfterIntent(): Promise<AppointmentElderPrepareResultV1>
  /** The phone code is accepted only for this call and is never retained. */
  submit(input: {
    institution: AppointmentCreateInstitutionV1
    elderId: string
    form: AppointmentCreateFormV1
    phoneCode: string
  }): Promise<AppointmentCreateSubmissionResultV1>
}

export interface AppointmentFormValidationV1 {
  valid: boolean
  errors: AppointmentCreateFormErrorsV1
  normalized?: {
    visitDate: string
    visitTimePreference: string
    participantCount: number
    contactName: string
    phone: string
    notes?: string
  }
}

export interface AppointmentCreatePrivateSuccessHandoffV1 {
  id: string
  handoff: AppointmentCreateSuccessHandoffV1
}

interface CanonicalSubmissionFields {
  institutionId: string
  institutionRecordRevision: string
  elderId: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  contactName: string
  phone: string
  phonePurpose: typeof PHONE_PURPOSE
  phoneAuthorization: 'explicit'
  notes?: string
}

interface PendingAttempt {
  key: string
  fingerprint: string
  submission: AppointmentSubmissionV1
  state: 'unknown' | 'settled'
}

let attemptSequence = 0
let handoffSequence = 0
const successHandoffs = new Map<string, AppointmentCreateSuccessHandoffV1>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isSafeText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string'
    && value.trim().length > 0
    && value.length <= maxLength
    && !/[\u0000-\u001f\u007f]/.test(value)

const isValidCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-').map((part) => Number(part))
  const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const validateAppointmentCreateFormV1 = (
  form: AppointmentCreateFormV1,
  institution: AppointmentCreateInstitutionV1 | null,
): AppointmentFormValidationV1 => {
  const errors: AppointmentCreateFormErrorsV1 = {}
  if (!institution
    || !isSafeText(institution.identity.institutionId, 200)
    || !Number.isSafeInteger(institution.identity.recordRevision)
    || institution.identity.recordRevision <= 0
    || !isSafeText(institution.displayName, 200)) {
    errors.institution = '机构资料暂不可用，请返回合作机构列表重新打开详情。'
  }

  const visitDate = typeof form.visitDate === 'string' ? form.visitDate.trim() : ''
  if (!isValidCalendarDate(visitDate)) errors.visitDate = '请选择有效的预约日期。'

  const visitTimePreference = typeof form.visitTimePreference === 'string' ? form.visitTimePreference.trim() : ''
  if (visitTimePreference.length < 1 || visitTimePreference.length > 80) {
    errors.visitTimePreference = '请填写时间偏好，最多 80 个字符。'
  }

  const countText = typeof form.participantCount === 'string' ? form.participantCount.trim() : ''
  const participantCount = /^[0-9]+$/.test(countText) ? Number(countText) : 0
  if (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 1000) {
    errors.participantCount = '请输入 1 至 1000 的整数。'
  }

  const contactName = typeof form.contactName === 'string' ? form.contactName.trim() : ''
  if (contactName.length < 1 || contactName.length > 200) {
    errors.contactName = '请填写联系人姓名，最多 200 个字符。'
  }

  const phone = normalizeAppointmentPhoneV1(form.phone)
  if (phone === null) errors.phone = '请输入正确的中国大陆11位手机号。'

  const rawNotes = typeof form.notes === 'string' ? form.notes.trim() : ''
  if (rawNotes.length > 2000) errors.notes = '备注最多 2000 个字符。'

  if (Object.keys(errors).length > 0 || phone === null) return { valid: false, errors }
  const normalized: AppointmentFormValidationV1['normalized'] = {
    visitDate,
    visitTimePreference,
    participantCount,
    contactName,
    phone,
  }
  if (rawNotes.length > 0) normalized.notes = rawNotes
  return { valid: true, errors, normalized }
}

const nextAttemptKey = (): string => {
  attemptSequence += 1
  return `appt-${Date.now().toString(36)}-${attemptSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const nextHandoffId = (): string => {
  handoffSequence += 1
  return `appointment-result-${Date.now().toString(36)}-${handoffSequence.toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

const readElderAuth = (value: unknown): {
  authResolution: string
  data: Record<string, unknown>
} | null => {
  if (!isRecord(value)) return null
  return { authResolution: typeof value.authResolution === 'string' ? value.authResolution : '', data: value }
}

const isOpaqueId = (value: unknown): value is string => isSafeText(value, 200)

const readElderResolution = (value: unknown):
  | { kind: 'bound'; elderId: string }
  | { kind: 'not_found' }
  | { kind: 'auth_required' }
  | { kind: 'unavailable' } => {
  const envelope = readElderAuth(value)
  if (!envelope || !hasExactKeys(envelope.data, [
    'contractVersion', 'kind', 'authResolution', 'availability', 'elderId',
  ]) || envelope.data.contractVersion !== ELDER_CONTRACT_VERSION
    || envelope.data.kind !== ELDER_RESOLUTION_KIND) return { kind: 'unavailable' }
  if (envelope.authResolution !== 'authenticated') {
    if (envelope.data.availability !== null || envelope.data.elderId !== null) return { kind: 'unavailable' }
    if (envelope.authResolution === 'missing' || envelope.authResolution === 'expired'
      || envelope.authResolution === 'invalid') return { kind: 'auth_required' }
    return { kind: 'unavailable' }
  }
  if (envelope.data.availability === 'bound' && isOpaqueId(envelope.data.elderId)) {
    return { kind: 'bound', elderId: envelope.data.elderId }
  }
  if (envelope.data.availability === 'not_found' && envelope.data.elderId === null) return { kind: 'not_found' }
  return { kind: 'unavailable' }
}

const readElderEstablishment = (value: unknown):
  | { kind: 'bound'; elderId: string }
  | { kind: 'auth_required' }
  | { kind: 'unavailable' } => {
  const envelope = readElderAuth(value)
  if (!envelope || !hasExactKeys(envelope.data, [
    'contractVersion', 'kind', 'authResolution', 'establishment', 'elderId',
  ]) || envelope.data.contractVersion !== ELDER_CONTRACT_VERSION
    || envelope.data.kind !== ELDER_ESTABLISHMENT_KIND) return { kind: 'unavailable' }
  if (envelope.authResolution !== 'authenticated') {
    if (envelope.data.establishment !== null || envelope.data.elderId !== null) return { kind: 'unavailable' }
    if (envelope.authResolution === 'missing' || envelope.authResolution === 'expired'
      || envelope.authResolution === 'invalid') return { kind: 'auth_required' }
    return { kind: 'unavailable' }
  }
  if ((envelope.data.establishment === 'created' || envelope.data.establishment === 'already_bound')
    && isOpaqueId(envelope.data.elderId)) return { kind: 'bound', elderId: envelope.data.elderId }
  return { kind: 'unavailable' }
}

export const validateAppointmentCreateSuccessHandoffV1 = (
  value: unknown,
): AppointmentCreateSuccessHandoffV1 | null => {
  if (!isRecord(value) || !hasExactKeys(value, ['receipt', 'summary'])
    || !isRecord(value.summary) || !hasExactKeys(value.summary, [
      'institutionId', 'institutionRecordRevision', 'institutionName',
      'visitDate', 'visitTimePreference', 'participantCount',
    ])) return null
  const summary = value.summary
  if (!isSafeText(summary.institutionId, 200)
    || typeof summary.institutionRecordRevision !== 'string'
    || !/^[1-9]\d*$/.test(summary.institutionRecordRevision)
    || !Number.isSafeInteger(Number(summary.institutionRecordRevision))
    || !isSafeText(summary.institutionName, 200)
    || typeof summary.visitDate !== 'string' || !isValidCalendarDate(summary.visitDate)
    || !isSafeText(summary.visitTimePreference, 80)
    || typeof summary.participantCount !== 'number'
    || !Number.isInteger(summary.participantCount)
    || summary.participantCount < 1 || summary.participantCount > 1000) return null
  const receipt = readAppointmentReceiptV1(value.receipt, {
    institutionId: summary.institutionId,
    institutionRecordRevision: summary.institutionRecordRevision,
  })
  if (!receipt) return null
  return {
    receipt,
    summary: {
      institutionId: summary.institutionId,
      institutionRecordRevision: summary.institutionRecordRevision,
      institutionName: summary.institutionName,
      visitDate: summary.visitDate,
      visitTimePreference: summary.visitTimePreference,
      participantCount: summary.participantCount,
    },
  }
}

const getUsableSession = async (
  sessionClient: ReturnType<typeof createC5AuthenticatedBackendSessionClientV1>,
): Promise<{ kind: 'ready'; session: C5AuthenticatedBackendSessionV1 } | { kind: 'auth_required' } | { kind: 'unavailable' }> => {
  const origin = sessionClient.resolveBackendOrigin()
  if (origin.length === 0) return { kind: 'unavailable' }
  const active = sessionClient.activeSession()
  if (active && active.origin === origin && active.expiresAt > Date.now()) {
    return { kind: 'ready', session: active }
  }
  if (active) sessionClient.clearSession()
  const acquired = await sessionClient.acquireSession(origin)
  if (acquired.kind === 'authenticated') return { kind: 'ready', session: acquired.session }
  if (acquired.kind === 'unavailable') return { kind: 'unavailable' }
  return { kind: 'auth_required' }
}

const semanticFields = (
  institution: AppointmentCreateInstitutionV1,
  elderId: string,
  form: AppointmentCreateFormV1,
): CanonicalSubmissionFields | null => {
  const validated = validateAppointmentCreateFormV1(form, institution)
  if (!validated.valid || !validated.normalized || !isOpaqueId(elderId)) return null
  const fields: CanonicalSubmissionFields = {
    institutionId: institution.identity.institutionId,
    institutionRecordRevision: String(institution.identity.recordRevision),
    elderId,
    visitDate: validated.normalized.visitDate,
    visitTimePreference: validated.normalized.visitTimePreference,
    participantCount: validated.normalized.participantCount,
    contactName: validated.normalized.contactName,
    phone: validated.normalized.phone,
    phonePurpose: PHONE_PURPOSE,
    phoneAuthorization: 'explicit',
  }
  if (validated.normalized.notes !== undefined) fields.notes = validated.normalized.notes
  return fields
}

const fingerprint = (fields: CanonicalSubmissionFields): string => JSON.stringify(fields)

const buildSubmission = (key: string, fields: CanonicalSubmissionFields): AppointmentSubmissionV1 => {
  const submission: AppointmentSubmissionV1 = {
    contractVersion: APPOINTMENT_CONTRACT_VERSION,
    kind: APPOINTMENT_SUBMISSION_KIND,
    idempotencyKey: key,
    ...fields,
  }
  return submission
}

export const createProductionAppointmentCreateClientV1 = (
  transport: AppointmentCreateTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): AppointmentCreateClientV1 => {
  const sessionClient = createC5AuthenticatedBackendSessionClientV1(transport)
  const application = createAppointmentVisitApplicationServiceV1()
  let pendingAttempt: PendingAttempt | null = null

  return {
    async resolveOrEstablishElderAfterIntent(): Promise<AppointmentElderPrepareResultV1> {
      const sessionResult = await getUsableSession(sessionClient)
      if (sessionResult.kind !== 'ready') return sessionResult
      let response: { statusCode: number; data: unknown }
      try {
        response = await transport.request({
          url: `${sessionResult.session.origin}${ELDER_ENDPOINT}`,
          method: 'GET',
          timeout: REQUEST_TIMEOUT_MS,
          header: createC5AuthenticatedJsonHeadersV1(sessionResult.session),
        })
      } catch (_error) {
        return { kind: 'unavailable' }
      }
      if (response.statusCode !== 200) return { kind: 'unavailable' }
      const resolved = readElderResolution(response.data)
      if (resolved.kind === 'bound') return { kind: 'ready', elderId: resolved.elderId }
      if (resolved.kind === 'auth_required') {
        sessionClient.clearSession()
        return { kind: 'auth_required' }
      }
      if (resolved.kind !== 'not_found') return { kind: 'unavailable' }

      // This POST is reachable only from the page's validated explicit Appointment action.
      let establishmentResponse: { statusCode: number; data: unknown }
      try {
        establishmentResponse = await transport.request({
          url: `${sessionResult.session.origin}${ELDER_ENDPOINT}`,
          method: 'POST',
          timeout: REQUEST_TIMEOUT_MS,
          header: createC5AuthenticatedJsonHeadersV1(sessionResult.session),
        })
      } catch (_error) {
        return { kind: 'unavailable' }
      }
      if (establishmentResponse.statusCode !== 200) return { kind: 'unavailable' }
      const established = readElderEstablishment(establishmentResponse.data)
      if (established.kind === 'bound') return { kind: 'ready', elderId: established.elderId }
      if (established.kind === 'auth_required') {
        sessionClient.clearSession()
        return { kind: 'auth_required' }
      }
      return { kind: 'unavailable' }
    },

    async submit(input): Promise<AppointmentCreateSubmissionResultV1> {
      if (!input || typeof input.phoneCode !== 'string' || input.phoneCode.trim().length === 0) {
        return { kind: 'rejected', code: 'CONTACT_REQUIRED' }
      }
      const fields = semanticFields(input.institution, input.elderId, input.form)
      if (!fields) return { kind: 'rejected', code: 'VALIDATION_FAILED' }
      const semanticFingerprint = fingerprint(fields)
      if (pendingAttempt && pendingAttempt.state === 'unknown'
        && pendingAttempt.fingerprint !== semanticFingerprint) return { kind: 'attempt_unresolved' }

      if (!pendingAttempt || pendingAttempt.fingerprint !== semanticFingerprint) {
        const key = nextAttemptKey()
        pendingAttempt = {
          key,
          fingerprint: semanticFingerprint,
          submission: buildSubmission(key, fields),
          state: 'settled',
        }
      }

      const submissionResult = validateAppointmentSubmissionV1(pendingAttempt.submission)
      if (!submissionResult.ok) return { kind: 'rejected', code: 'VALIDATION_FAILED' }
      const sessionResult = await getUsableSession(sessionClient)
      if (sessionResult.kind === 'auth_required') return { kind: 'rejected', code: 'AUTH_REQUIRED' }
      if (sessionResult.kind !== 'ready') return { kind: 'rejected', code: 'SERVICE_UNAVAILABLE' }

      pendingAttempt.state = 'unknown'
      let response: { statusCode: number; data: unknown }
      try {
        response = await transport.request({
          url: `${sessionResult.session.origin}${SUBMISSION_ENDPOINT}`,
          method: 'POST',
          timeout: REQUEST_TIMEOUT_MS,
          header: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Evidence': sessionResult.session.evidence,
            'X-Phone-Auth-Evidence': input.phoneCode,
          },
          data: submissionResult.value as unknown as Record<string, unknown>,
        })
      } catch (_error) {
        return { kind: 'outcome_unknown' }
      }
      if (response.statusCode !== 200) return { kind: 'outcome_unknown' }

      const applicationResult = application.submit({
        submission: submissionResult.value,
        response: response.data,
      })
      if (applicationResult.kind === 'accepted') {
        pendingAttempt = null
        return applicationResult
      }
      if (applicationResult.kind === 'outcome_unknown') return applicationResult
      if (applicationResult.kind === 'attempt_unresolved') return applicationResult
      pendingAttempt.state = 'settled'
      if (applicationResult.code === 'AUTH_REQUIRED') sessionClient.clearSession()
      return applicationResult
    },
  }
}

export const createAppointmentSuccessHandoffV1 = (
  receipt: AppointmentCreateReceiptV1,
  summary: AppointmentCreateSubmittedSummaryV1,
): AppointmentCreatePrivateSuccessHandoffV1 => {
  const id = nextHandoffId()
  successHandoffs.set(id, { receipt, summary })
  return { id, handoff: { receipt, summary } }
}

export const consumeAppointmentSuccessHandoffV1 = (id: unknown): AppointmentCreateSuccessHandoffV1 | null => {
  if (!isSafeText(id, 128)) return null
  const handoff = successHandoffs.get(id)
  if (!handoff) return null
  successHandoffs.delete(id)
  return validateAppointmentCreateSuccessHandoffV1(handoff)
}

export const discardAppointmentSuccessHandoffV1 = (id: string): void => {
  successHandoffs.delete(id)
}

const institutionDisplaySnapshots = new Map<string, string>()

const identityKey = (institutionId: string, revision: number): string => `${institutionId}\u0000${revision}`

export const recordAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
  displayName: string,
): void => {
  if (!isSafeText(institutionId, 200) || !Number.isSafeInteger(revision) || revision <= 0
    || !isSafeText(displayName, 200)) return
  institutionDisplaySnapshots.set(identityKey(institutionId, revision), displayName)
}

export const consumeAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
): string | null => {
  const key = identityKey(institutionId, revision)
  const displayName = institutionDisplaySnapshots.get(key)
  if (!displayName) return null
  institutionDisplaySnapshots.delete(key)
  return displayName
}

export const discardAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
): void => {
  institutionDisplaySnapshots.delete(identityKey(institutionId, revision))
}
