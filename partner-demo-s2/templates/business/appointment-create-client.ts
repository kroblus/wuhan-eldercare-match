import { normalizeAppointmentPhoneV1 } from '../domain/appointment-institution-visit/phone-format'
import type {
  AppointmentCreateErrorCodeV1,
  AppointmentCreateFormErrorsV1,
  AppointmentCreateFormV1,
  AppointmentCreateInstitutionV1,
  AppointmentCreateReceiptV1,
  AppointmentCreateSubmissionResultV1,
  AppointmentCreateSuccessHandoffV1,
  AppointmentCreateSubmittedSummaryV1,
} from '../types/appointment-create-v1'
import type { DemoBusinessSessionV1 } from './business-session'
import {
  consumeDemoAppointmentSuccessHandoff,
  consumeDemoInstitutionDisplaySnapshot,
  createDemoAppointment,
  createDemoAppointmentIntent,
  createDemoAppointmentSuccessHandoff,
  discardDemoAppointmentSuccessHandoff,
  discardDemoInstitutionDisplaySnapshot,
  recordDemoInstitutionDisplaySnapshot,
  PARTNER_DEMO_BUSINESS_PROVENANCE,
} from './business-session'

export type AppointmentElderPrepareResultV1 =
  | { kind: 'ready'; elderId: string }
  | { kind: 'auth_required' }
  | { kind: 'unavailable' }

export interface AppointmentCreateClientV1 {
  resolveOrEstablishElderAfterIntent(): Promise<AppointmentElderPrepareResultV1>
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

export interface DemoAppointmentCreateClientOptionsV1 {
  session?: DemoBusinessSessionV1
}

const DEMO_ELDER_ID = 'synthetic-demo-elder'
const APPOINTMENT_CONTRACT_VERSION = 'appointment-institution-visit-contract-v1'
const RECEIPT_KIND = 'appointment_submission_receipt_v1'
const APPOINTMENT_SUBMISSION_PUBLIC_MESSAGE = '预约申请已提交'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isSafeText = (value: unknown, maxLength: number): value is string => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= maxLength
  && !/[\u0000-\u001f\u007f]/.test(value)

const isValidCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-').map((part) => Number(part))
  const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isUtcInstant = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const [year, month, day] = match[1].split('-').map((part) => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === match[1]
    && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59
}

const readAppointmentReceipt = (
  value: unknown,
  expected: { institutionId: string; institutionRecordRevision: string },
): AppointmentCreateReceiptV1 | null => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'visitId', 'institutionId', 'institutionRecordRevision',
    'status', 'acceptedAt', 'publicMessage',
  ]) || value.contractVersion !== APPOINTMENT_CONTRACT_VERSION
    || value.kind !== RECEIPT_KIND
    || !isSafeText(value.visitId, 200)
    || value.institutionId !== expected.institutionId
    || value.institutionRecordRevision !== expected.institutionRecordRevision
    || value.status !== 'requested'
    || value.publicMessage !== APPOINTMENT_SUBMISSION_PUBLIC_MESSAGE
    || !isUtcInstant(value.acceptedAt)) return null
  return {
    contractVersion: APPOINTMENT_CONTRACT_VERSION,
    kind: RECEIPT_KIND,
    visitId: value.visitId,
    institutionId: expected.institutionId,
    institutionRecordRevision: expected.institutionRecordRevision,
    status: 'requested',
    acceptedAt: value.acceptedAt,
    publicMessage: APPOINTMENT_SUBMISSION_PUBLIC_MESSAGE,
  }
}

export const validateAppointmentCreateFormV1 = (
  form: AppointmentCreateFormV1,
  institution: AppointmentCreateInstitutionV1 | null,
): AppointmentFormValidationV1 => {
  const errors: AppointmentCreateFormErrorsV1 = {}
  if (!isRecord(form)) return { valid: false, errors: { visitDate: '请选择有效的预约日期。' } }
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
  if (contactName.length < 1 || contactName.length > 200) errors.contactName = '请填写联系人姓名，最多 200 个字符。'
  const phone = normalizeAppointmentPhoneV1(form.phone)
  if (phone === null) errors.phone = '请输入正确的中国大陆11位手机号。'
  const rawNotes = typeof form.notes === 'string' ? form.notes.trim() : ''
  if (rawNotes.length > 2000) errors.notes = '备注最多 2000 个字符。'

  if (Object.keys(errors).length > 0 || phone === null) return { valid: false, errors }
  const normalized: NonNullable<AppointmentFormValidationV1['normalized']> = {
    visitDate,
    visitTimePreference,
    participantCount,
    contactName,
    phone,
  }
  if (rawNotes.length > 0) normalized.notes = rawNotes
  return { valid: true, errors, normalized }
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
  const receipt = readAppointmentReceipt(value.receipt, {
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

const hashIntent = (value: readonly unknown[]): string => {
  const text = JSON.stringify(value)
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0
  return `demo-fp-${(`00000000${hash.toString(16)}`).slice(-8)}`
}

export const createDemoAppointmentCreateClientV1 = (
  options: DemoAppointmentCreateClientOptionsV1 = {},
): AppointmentCreateClientV1 => {
  const session = options.session
  const intentId = session ? session.createAppointmentIntent() : createDemoAppointmentIntent()
  let prepared = false

  const makeAppointment = (
    input: Parameters<AppointmentCreateClientV1['submit']>[0],
    normalized: NonNullable<AppointmentFormValidationV1['normalized']>,
    fingerprint: string,
  ) => {
    const institutionRecordRevision = String(input.institution.identity.recordRevision)
    const result = session
      ? session.createAppointment({
        intentId,
        fingerprint,
        institutionId: input.institution.identity.institutionId,
        institutionRecordRevision,
        institutionName: input.institution.displayName,
        visitDate: normalized.visitDate,
        visitTimePreference: normalized.visitTimePreference,
        participantCount: normalized.participantCount,
      })
      : createDemoAppointment({
        intentId,
        fingerprint,
        institutionId: input.institution.identity.institutionId,
        institutionRecordRevision,
        institutionName: input.institution.displayName,
        visitDate: normalized.visitDate,
        visitTimePreference: normalized.visitTimePreference,
        participantCount: normalized.participantCount,
      })
    return result
  }

  return {
    async resolveOrEstablishElderAfterIntent(): Promise<AppointmentElderPrepareResultV1> {
      prepared = true
      return { kind: 'ready', elderId: DEMO_ELDER_ID }
    },

    async submit(input): Promise<AppointmentCreateSubmissionResultV1> {
      if (!input || !prepared || input.elderId !== DEMO_ELDER_ID) {
        return { kind: 'rejected', code: 'REFERENCE_UNAVAILABLE' }
      }
      const validation = validateAppointmentCreateFormV1(input.form, input.institution)
      if (!validation.valid || !validation.normalized) return { kind: 'rejected', code: 'VALIDATION_FAILED' }
      const normalized = validation.normalized
      const fingerprint = hashIntent([
        input.institution.identity.institutionId,
        input.institution.identity.recordRevision,
        normalized.visitDate,
        normalized.visitTimePreference,
        normalized.participantCount,
        normalized.contactName,
        normalized.phone,
        normalized.notes || '',
      ])
      const result = makeAppointment(input, normalized, fingerprint)
      if (result.kind === 'rejected') {
        const code: AppointmentCreateErrorCodeV1 = result.code
        return { kind: 'rejected', code }
      }
      const visit = result.visit
      const receipt: AppointmentCreateReceiptV1 = {
        contractVersion: APPOINTMENT_CONTRACT_VERSION,
        kind: RECEIPT_KIND,
        visitId: visit.visitId,
        institutionId: visit.institutionId,
        institutionRecordRevision: visit.institutionRecordRevision,
        status: 'requested',
        acceptedAt: visit.acceptedAt,
        publicMessage: APPOINTMENT_SUBMISSION_PUBLIC_MESSAGE,
      }
      return { kind: 'accepted', receipt, replayed: result.replayed }
    },
  }
}

/** Compatibility factory name for generated imports; its implementation is local DEMO_ONLY. */
export const createProductionAppointmentCreateClientV1 = (): AppointmentCreateClientV1 =>
  createDemoAppointmentCreateClientV1()

export const createAppointmentSuccessHandoffV1 = (
  receipt: AppointmentCreateReceiptV1,
  summary: AppointmentCreateSubmittedSummaryV1,
): AppointmentCreatePrivateSuccessHandoffV1 => {
  const result = createDemoAppointmentSuccessHandoff(receipt, summary)
  return { id: result.id, handoff: result.handoff }
}

export const consumeAppointmentSuccessHandoffV1 = (id: unknown): AppointmentCreateSuccessHandoffV1 | null =>
  consumeDemoAppointmentSuccessHandoff(id)

export const discardAppointmentSuccessHandoffV1 = (id: string): void => discardDemoAppointmentSuccessHandoff(id)

export const recordAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
  displayName: string,
): void => recordDemoInstitutionDisplaySnapshot(institutionId, revision, displayName)

export const consumeAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
): string | null => consumeDemoInstitutionDisplaySnapshot(institutionId, revision)

export const discardAppointmentInstitutionDisplaySnapshotV1 = (
  institutionId: string,
  revision: number,
): void => discardDemoInstitutionDisplaySnapshot(institutionId, revision)

export const DEMO_APPOINTMENT_PROVENANCE_V1 = PARTNER_DEMO_BUSINESS_PROVENANCE

