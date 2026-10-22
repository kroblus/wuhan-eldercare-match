import type {
  AppointmentAcceptedPersistenceCandidateV1,
  AppointmentLocalDraftV1,
  AppointmentOwnerReadPortResultV1,
  AppointmentSubmissionV1,
  AppointmentValidationIssueV1,
  AppointmentValidationResultV1,
  AuthenticatedPrincipalV1,
  AuthenticatedPrincipalPortResultV1,
  InstitutionVisitPublicSnapshotV1,
  InstitutionVisitV1,
} from '../../types/appointment-institution-visit-v1'
import {
  APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
  APPOINTMENT_LOCAL_DRAFT_KIND_V1,
  APPOINTMENT_SUBMISSION_KIND_V1,
  INSTITUTION_VISIT_KIND_V1,
  INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1,
} from '../../types/appointment-institution-visit-v1'
import { normalizeAppointmentPhoneV1 } from './phone-format'

const STATUS_VALUES = ['requested', 'contacting', 'scheduled', 'completed', 'cancelled'] as const
const PHONE_PURPOSE = 'appointment_or_consultant_contact' as const
const PHONE_AUTHORIZATION = 'explicit' as const

type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: RecordValue, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = new Set<string>([...required, ...optional])
  const keys = Object.keys(value)
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key))
}

const issue = (code: AppointmentValidationIssueV1['code'], path: string): AppointmentValidationIssueV1 => ({ code, path })

const invalid = <T>(issues: AppointmentValidationIssueV1[]): AppointmentValidationResultV1<T> => ({ ok: false, issues })

const readString = (value: unknown, path: string, min: number, max: number, issues: AppointmentValidationIssueV1[]): string | null => {
  if (typeof value !== 'string') {
    issues.push(issue('INVALID_FIELD', path))
    return null
  }
  const normalized = value.trim()
  if (normalized.length < min || normalized.length > max) {
    issues.push(issue('INVALID_FIELD', path))
    return null
  }
  return normalized
}

const readOpaqueId = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | null => {
  const id = readString(value, path, 1, 200, issues)
  if (id !== null && /[\u0000-\u001f\u007f]/.test(id)) issues.push(issue('INVALID_IDENTITY', path))
  return id
}

const readTimestamp = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | null => {
  const timestamp = readString(value, path, 1, 80, issues)
  if (timestamp !== null && Number.isNaN(Date.parse(timestamp))) issues.push(issue('INVALID_SERVER_TIMESTAMP', path))
  return timestamp
}

const readDate = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | null => {
  const date = readString(value, path, 1, 32, issues)
  if (date !== null) {
    const parts = date.split('-').map((part) => Number(part))
    const parsed = new Date(Date.UTC(parts[0], (parts[1] || 0) - 1, parts[2] || 0))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || parts.length !== 3
      || Number.isNaN(parsed.getTime())
      || parsed.toISOString().slice(0, 10) !== date) issues.push(issue('INVALID_FIELD', path))
  }
  return date
}

const readPositiveInteger = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 1000) {
    issues.push(issue('INVALID_FIELD', path))
    return null
  }
  return value
}

const readOptionalBoolean = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): boolean | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    issues.push(issue('INVALID_FIELD', path))
    return undefined
  }
  return value
}

const readPhone = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | null => {
  const phone = readString(value, path, 6, 32, issues)
  if (phone === null) return null
  if (!/^[0-9+()\-\s]+$/.test(phone) || phone.replace(/\D/g, '').length < 6 || phone.replace(/\D/g, '').length > 20) {
    issues.push(issue('INVALID_FIELD', path))
    return null
  }
  return phone
}

// New manual drafts/commands follow the approved policy. Historical persisted
// Visit reads retain their existing transport grammar; no records are migrated.
const readManualPhone = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | null => {
  const phone = normalizeAppointmentPhoneV1(value)
  if (phone === null) issues.push(issue('INVALID_FIELD', path))
  return phone
}

const readOptionalNotes = (value: unknown, path: string, issues: AppointmentValidationIssueV1[]): string | undefined => {
  if (value === undefined) return undefined
  return readString(value, path, 1, 2000, issues) || undefined
}

const validateVersion = (value: RecordValue, issues: AppointmentValidationIssueV1[]): void => {
  if (value.contractVersion !== APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1) {
    issues.push(issue('INVALID_CONTRACT_VERSION', 'contractVersion'))
  }
}

const validateDateAndIntent = (value: RecordValue, issues: AppointmentValidationIssueV1[]) => {
  const visitDate = readDate(value.visitDate, 'visitDate', issues)
  const visitTimePreference = readString(value.visitTimePreference, 'visitTimePreference', 1, 80, issues)
  const participantCount = readPositiveInteger(value.participantCount, 'participantCount', issues)
  const pickupRequested = readOptionalBoolean(value.pickupRequested, 'pickupRequested', issues)
  return { visitDate, visitTimePreference, participantCount, pickupRequested }
}

export const validateAppointmentLocalDraftV1 = (value: unknown): AppointmentValidationResultV1<AppointmentLocalDraftV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  const issues: AppointmentValidationIssueV1[] = []
  if (!hasExactKeys(value, [
    'contractVersion', 'kind', 'provenance', 'localDraftId', 'institutionId', 'institutionRecordRevision', 'elderId',
    'visitDate', 'visitTimePreference', 'participantCount',
  ], ['pickupRequested', 'contactName', 'phone', 'notes'])) return invalid([issue('INVALID_SHAPE', '')])
  validateVersion(value, issues)
  if (value.kind !== APPOINTMENT_LOCAL_DRAFT_KIND_V1) issues.push(issue('INVALID_KIND', 'kind'))
  if (value.provenance !== 'LOCAL_DRAFT_ONLY') issues.push(issue('INVALID_PROVENANCE', 'provenance'))
  const localDraftId = readOpaqueId(value.localDraftId, 'localDraftId', issues)
  const institutionId = readOpaqueId(value.institutionId, 'institutionId', issues)
  const institutionRecordRevision = readOpaqueId(value.institutionRecordRevision, 'institutionRecordRevision', issues)
  const elderId = readOpaqueId(value.elderId, 'elderId', issues)
  const intent = validateDateAndIntent(value, issues)
  const contactName = value.contactName === undefined ? undefined : readString(value.contactName, 'contactName', 1, 200, issues) || undefined
  const phone = value.phone === undefined ? undefined : readManualPhone(value.phone, 'phone', issues) || undefined
  const notes = readOptionalNotes(value.notes, 'notes', issues)
  if (issues.length > 0 || !localDraftId || !institutionId || !institutionRecordRevision || !elderId
    || !intent.visitDate || !intent.visitTimePreference || !intent.participantCount) return invalid(issues)
  const result: AppointmentLocalDraftV1 = {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: APPOINTMENT_LOCAL_DRAFT_KIND_V1,
    provenance: 'LOCAL_DRAFT_ONLY',
    localDraftId,
    institutionId,
    institutionRecordRevision,
    elderId,
    visitDate: intent.visitDate,
    visitTimePreference: intent.visitTimePreference,
    participantCount: intent.participantCount,
  }
  if (intent.pickupRequested !== undefined) result.pickupRequested = intent.pickupRequested
  if (contactName !== undefined) result.contactName = contactName
  if (phone !== undefined) result.phone = phone
  if (notes !== undefined) result.notes = notes
  return { ok: true, value: result }
}

export const validateAppointmentSubmissionV1 = (value: unknown): AppointmentValidationResultV1<AppointmentSubmissionV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  const issues: AppointmentValidationIssueV1[] = []
  if (!hasExactKeys(value, [
    'contractVersion', 'kind', 'idempotencyKey', 'institutionId', 'institutionRecordRevision', 'elderId',
    'visitDate', 'visitTimePreference', 'participantCount', 'contactName', 'phone', 'phonePurpose', 'phoneAuthorization',
  ], ['pickupRequested', 'notes'])) return invalid([issue('INVALID_SHAPE', '')])
  validateVersion(value, issues)
  if (value.kind !== APPOINTMENT_SUBMISSION_KIND_V1) issues.push(issue('INVALID_KIND', 'kind'))
  const idempotencyKey = readString(value.idempotencyKey, 'idempotencyKey', 8, 128, issues)
  if (idempotencyKey !== null && (/\s/.test(idempotencyKey) || /^\d+$/.test(idempotencyKey) || /[@()+]/.test(idempotencyKey))) {
    issues.push(issue('INVALID_FIELD', 'idempotencyKey'))
  }
  const institutionId = readOpaqueId(value.institutionId, 'institutionId', issues)
  const institutionRecordRevision = readOpaqueId(value.institutionRecordRevision, 'institutionRecordRevision', issues)
  const elderId = readOpaqueId(value.elderId, 'elderId', issues)
  const intent = validateDateAndIntent(value, issues)
  const contactName = readString(value.contactName, 'contactName', 1, 200, issues)
  const phone = readManualPhone(value.phone, 'phone', issues)
  if (value.phonePurpose !== PHONE_PURPOSE) issues.push(issue('INVALID_PHONE_PURPOSE', 'phonePurpose'))
  if (value.phoneAuthorization !== PHONE_AUTHORIZATION) issues.push(issue('INVALID_PHONE_AUTHORIZATION', 'phoneAuthorization'))
  const notes = readOptionalNotes(value.notes, 'notes', issues)
  if (issues.length > 0 || !idempotencyKey || !institutionId || !institutionRecordRevision || !elderId
    || !intent.visitDate || !intent.visitTimePreference || !intent.participantCount || !contactName || !phone) return invalid(issues)
  const result: AppointmentSubmissionV1 = {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: APPOINTMENT_SUBMISSION_KIND_V1,
    idempotencyKey,
    institutionId,
    institutionRecordRevision,
    elderId,
    visitDate: intent.visitDate,
    visitTimePreference: intent.visitTimePreference,
    participantCount: intent.participantCount,
    contactName,
    phone,
    phonePurpose: PHONE_PURPOSE,
    phoneAuthorization: PHONE_AUTHORIZATION,
  }
  if (intent.pickupRequested !== undefined) result.pickupRequested = intent.pickupRequested
  if (notes !== undefined) result.notes = notes
  return { ok: true, value: result }
}

export const validateAuthenticatedPrincipalV1 = (value: unknown): AppointmentValidationResultV1<AuthenticatedPrincipalV1> => {
  if (!isRecord(value) || !hasExactKeys(value, ['userId'])) return invalid([issue('INVALID_SHAPE', '')])
  const issues: AppointmentValidationIssueV1[] = []
  const userId = readOpaqueId(value.userId, 'userId', issues)
  if (issues.length > 0 || !userId) return invalid(issues)
  return { ok: true, value: { userId } }
}

export const validateAuthenticatedPrincipalPortResultV1 = (
  value: unknown,
): AppointmentValidationResultV1<AuthenticatedPrincipalPortResultV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  if (value.ok === false) {
    if (!hasExactKeys(value, ['ok', 'failure'])
      || (value.failure !== 'missing' && value.failure !== 'unavailable' && value.failure !== 'failed')) {
      return invalid([issue('INVALID_SHAPE', '')])
    }
    return { ok: true, value: { ok: false, failure: value.failure } }
  }
  if (value.ok !== true || !hasExactKeys(value, ['ok', 'principal'])) {
    return invalid([issue('INVALID_SHAPE', '')])
  }
  const principal = validateAuthenticatedPrincipalV1(value.principal)
  if (!principal.ok) return principal
  return { ok: true, value: { ok: true, principal: principal.value } }
}

export const validateInstitutionVisitV1 = (value: unknown): AppointmentValidationResultV1<InstitutionVisitV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  const issues: AppointmentValidationIssueV1[] = []
  if (!hasExactKeys(value, [
    'contractVersion', 'kind', 'visitId', 'userId', 'elderId', 'institutionId', 'institutionRecordRevision',
    'visitDate', 'visitTimePreference', 'participantCount', 'contactName', 'phone', 'phonePurpose', 'status', 'acceptedAt',
  ], ['consultantId', 'pickupRequested', 'scheduledAt', 'completedAt', 'cancelledAt', 'notes'])) return invalid([issue('INVALID_SHAPE', '')])
  validateVersion(value, issues)
  if (value.kind !== INSTITUTION_VISIT_KIND_V1) issues.push(issue('INVALID_KIND', 'kind'))
  const visitId = readOpaqueId(value.visitId, 'visitId', issues)
  const userId = readOpaqueId(value.userId, 'userId', issues)
  const elderId = readOpaqueId(value.elderId, 'elderId', issues)
  const institutionId = readOpaqueId(value.institutionId, 'institutionId', issues)
  const institutionRecordRevision = readOpaqueId(value.institutionRecordRevision, 'institutionRecordRevision', issues)
  const intent = validateDateAndIntent(value, issues)
  const contactName = readString(value.contactName, 'contactName', 1, 200, issues)
  const phone = readPhone(value.phone, 'phone', issues)
  if (value.phonePurpose !== PHONE_PURPOSE) issues.push(issue('INVALID_PHONE_PURPOSE', 'phonePurpose'))
  if (typeof value.status !== 'string' || !STATUS_VALUES.includes(value.status as typeof STATUS_VALUES[number])) issues.push(issue('INVALID_STATUS', 'status'))
  const acceptedAt = readTimestamp(value.acceptedAt, 'acceptedAt', issues)
  const consultantId = value.consultantId === undefined ? undefined : readOpaqueId(value.consultantId, 'consultantId', issues) || undefined
  const scheduledAt = value.scheduledAt === undefined ? undefined : readTimestamp(value.scheduledAt, 'scheduledAt', issues) || undefined
  const completedAt = value.completedAt === undefined ? undefined : readTimestamp(value.completedAt, 'completedAt', issues) || undefined
  const cancelledAt = value.cancelledAt === undefined ? undefined : readTimestamp(value.cancelledAt, 'cancelledAt', issues) || undefined
  const notes = readOptionalNotes(value.notes, 'notes', issues)
  if ((value.status === 'requested' || value.status === 'contacting')
    && (scheduledAt !== undefined || completedAt !== undefined || cancelledAt !== undefined)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'statusTimestamps'))
  }
  if (value.status === 'scheduled'
    && (scheduledAt === undefined || completedAt !== undefined || cancelledAt !== undefined)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'statusTimestamps'))
  }
  if (value.status === 'completed'
    && (scheduledAt === undefined || completedAt === undefined || cancelledAt !== undefined)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'statusTimestamps'))
  }
  if (value.status === 'cancelled' && (cancelledAt === undefined || completedAt !== undefined)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'statusTimestamps'))
  }
  if (acceptedAt !== null && scheduledAt !== undefined && Date.parse(scheduledAt) < Date.parse(acceptedAt)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'scheduledAt'))
  }
  if (acceptedAt !== null && completedAt !== undefined && Date.parse(completedAt) < Date.parse(acceptedAt)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'completedAt'))
  }
  if (acceptedAt !== null && cancelledAt !== undefined && Date.parse(cancelledAt) < Date.parse(acceptedAt)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'cancelledAt'))
  }
  if (scheduledAt !== undefined && completedAt !== undefined && Date.parse(completedAt) < Date.parse(scheduledAt)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'completedAt'))
  }
  if (scheduledAt !== undefined && cancelledAt !== undefined && Date.parse(cancelledAt) < Date.parse(scheduledAt)) {
    issues.push(issue('INVALID_SERVER_TIMESTAMP', 'cancelledAt'))
  }
  if (issues.length > 0 || !visitId || !userId || !elderId || !institutionId || !institutionRecordRevision
    || !intent.visitDate || !intent.visitTimePreference || !intent.participantCount || !contactName || !phone || !acceptedAt
    || typeof value.status !== 'string' || !STATUS_VALUES.includes(value.status as typeof STATUS_VALUES[number])) return invalid(issues)
  const result: InstitutionVisitV1 = {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: INSTITUTION_VISIT_KIND_V1,
    visitId,
    userId,
    elderId,
    institutionId,
    institutionRecordRevision,
    visitDate: intent.visitDate,
    visitTimePreference: intent.visitTimePreference,
    participantCount: intent.participantCount,
    contactName,
    phone,
    phonePurpose: PHONE_PURPOSE,
    status: value.status as InstitutionVisitV1['status'],
    acceptedAt,
  }
  if (consultantId !== undefined) result.consultantId = consultantId
  if (intent.pickupRequested !== undefined) result.pickupRequested = intent.pickupRequested
  if (scheduledAt !== undefined) result.scheduledAt = scheduledAt
  if (completedAt !== undefined) result.completedAt = completedAt
  if (cancelledAt !== undefined) result.cancelledAt = cancelledAt
  if (notes !== undefined) result.notes = notes
  return { ok: true, value: result }
}

export const validateInstitutionVisitPublicSnapshotV1 = (value: unknown): AppointmentValidationResultV1<InstitutionVisitPublicSnapshotV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  const issues: AppointmentValidationIssueV1[] = []
  if (!hasExactKeys(value, [
    'contractVersion', 'kind', 'visitId', 'elderId', 'institutionId', 'institutionRecordRevision',
    'visitDate', 'visitTimePreference', 'participantCount', 'status', 'acceptedAt',
  ], ['pickupRequested'])) return invalid([issue('INVALID_SHAPE', '')])
  validateVersion(value, issues)
  if (value.kind !== INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1) issues.push(issue('INVALID_KIND', 'kind'))
  const visitId = readOpaqueId(value.visitId, 'visitId', issues)
  const elderId = readOpaqueId(value.elderId, 'elderId', issues)
  const institutionId = readOpaqueId(value.institutionId, 'institutionId', issues)
  const institutionRecordRevision = readOpaqueId(value.institutionRecordRevision, 'institutionRecordRevision', issues)
  const intent = validateDateAndIntent(value, issues)
  if (typeof value.status !== 'string' || !STATUS_VALUES.includes(value.status as typeof STATUS_VALUES[number])) issues.push(issue('INVALID_STATUS', 'status'))
  const acceptedAt = readTimestamp(value.acceptedAt, 'acceptedAt', issues)
  if (issues.length > 0 || !visitId || !elderId || !institutionId || !institutionRecordRevision || !intent.visitDate
    || !intent.visitTimePreference || !intent.participantCount || !acceptedAt || typeof value.status !== 'string'
    || !STATUS_VALUES.includes(value.status as typeof STATUS_VALUES[number])) return invalid(issues)
  const result: InstitutionVisitPublicSnapshotV1 = {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1,
    visitId,
    elderId,
    institutionId,
    institutionRecordRevision,
    visitDate: intent.visitDate,
    visitTimePreference: intent.visitTimePreference,
    participantCount: intent.participantCount,
    status: value.status as InstitutionVisitPublicSnapshotV1['status'],
    acceptedAt,
  }
  if (intent.pickupRequested !== undefined) result.pickupRequested = intent.pickupRequested
  return { ok: true, value: result }
}

export const validateAcceptedPersistenceCandidateV1 = (
  value: unknown,
): AppointmentValidationResultV1<AppointmentAcceptedPersistenceCandidateV1 & { visit: InstitutionVisitV1 }> => {
  if (!isRecord(value) || !hasExactKeys(value, ['kind', 'visit'])) return invalid([issue('INVALID_SHAPE', '')])
  if (value.kind !== 'accepted_persistence_candidate_v1') return invalid([issue('INVALID_KIND', 'kind')])
  const visitResult = validateInstitutionVisitV1(value.visit)
  if (!visitResult.ok) return { ok: false, issues: visitResult.issues }
  if (visitResult.value.status !== 'requested') return invalid([issue('INVALID_STATUS', 'visit.status')])
  return { ok: true, value: { kind: 'accepted_persistence_candidate_v1', visit: visitResult.value } }
}

export const validateAppointmentOwnerReadPortResultV1 = (
  value: unknown,
): AppointmentValidationResultV1<AppointmentOwnerReadPortResultV1> => {
  if (!isRecord(value)) return invalid([issue('INVALID_SHAPE', '')])
  if (value.ok === false) {
    if (!hasExactKeys(value, ['ok', 'failure'])
      || (value.failure !== 'unauthorized' && value.failure !== 'unavailable' && value.failure !== 'technical')) {
      return invalid([issue('INVALID_SHAPE', '')])
    }
    return { ok: true, value: { ok: false, failure: value.failure } }
  }
  if (!hasExactKeys(value, ['ok', 'visits']) || value.ok !== true || !Array.isArray(value.visits)) {
    return invalid([issue('INVALID_SHAPE', '')])
  }
  const visits = value.visits.map((item) => validateInstitutionVisitPublicSnapshotV1(item))
  const invalidVisit = visits.find((item) => !item.ok)
  if (invalidVisit && !invalidVisit.ok) return { ok: false, issues: invalidVisit.issues }
  return { ok: true, value: { ok: true, visits: visits.map((item) => item.ok ? item.value : undefined).filter((item): item is InstitutionVisitPublicSnapshotV1 => item !== undefined) } }
}
