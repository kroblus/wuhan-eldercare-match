import type { InstitutionCanonicalIdentity } from './institution-list-detail'

export type AppointmentCreateFieldV1 =
  | 'institution'
  | 'visitDate'
  | 'visitTimePreference'
  | 'participantCount'
  | 'contactName'
  | 'phone'
  | 'notes'

export interface AppointmentCreateFormV1 {
  visitDate: string
  visitTimePreference: string
  participantCount: string
  contactName: string
  phone: string
  notes: string
}

export interface AppointmentCreateInstitutionV1 {
  identity: InstitutionCanonicalIdentity
  displayName: string
}

export type AppointmentCreateFormErrorsV1 = Partial<Record<AppointmentCreateFieldV1, string>>

export interface AppointmentCreateSubmittedSummaryV1 {
  institutionId: string
  institutionRecordRevision: string
  institutionName: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
}

export interface AppointmentCreateReceiptV1 {
  contractVersion: 'appointment-institution-visit-contract-v1'
  kind: 'appointment_submission_receipt_v1'
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  status: 'requested'
  acceptedAt: string
  publicMessage: '预约申请已提交'
}

export interface AppointmentCreateSuccessHandoffV1 {
  receipt: AppointmentCreateReceiptV1
  summary: AppointmentCreateSubmittedSummaryV1
}

export type AppointmentCreateErrorCodeV1 =
  | 'AUTH_REQUIRED'
  | 'CONTACT_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'REFERENCE_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'TECHNICAL_FAILURE'

export type AppointmentCreateSubmissionResultV1 =
  | { kind: 'accepted'; receipt: AppointmentCreateReceiptV1; replayed: boolean }
  | { kind: 'rejected'; code: AppointmentCreateErrorCodeV1 }
  | { kind: 'outcome_unknown' }
  | { kind: 'attempt_unresolved' }
