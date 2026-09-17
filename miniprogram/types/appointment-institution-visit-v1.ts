export const APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1 = 'appointment-institution-visit-contract-v1' as const
export const APPOINTMENT_LOCAL_DRAFT_KIND_V1 = 'appointment_local_draft_v1' as const
export const APPOINTMENT_SUBMISSION_KIND_V1 = 'appointment_submission_v1' as const
export const INSTITUTION_VISIT_KIND_V1 = 'institution_visit_v1' as const
export const INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1 = 'institution_visit_public_snapshot_v1' as const

export type AppointmentInstitutionVisitContractVersionV1 =
  typeof APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1

export type InstitutionVisitStatusV1 =
  | 'requested'
  | 'contacting'
  | 'scheduled'
  | 'completed'
  | 'cancelled'

export type AppointmentPhonePurposeV1 = 'appointment_or_consultant_contact'
export type AppointmentPhoneAuthorizationV1 = 'explicit'

export interface AppointmentLocalDraftV1 {
  contractVersion: AppointmentInstitutionVisitContractVersionV1
  kind: typeof APPOINTMENT_LOCAL_DRAFT_KIND_V1
  provenance: 'LOCAL_DRAFT_ONLY'
  localDraftId: string
  institutionId: string
  institutionRecordRevision: string
  elderId: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  contactName?: string
  phone?: string
  notes?: string
}

export interface AppointmentSubmissionV1 {
  contractVersion: AppointmentInstitutionVisitContractVersionV1
  kind: typeof APPOINTMENT_SUBMISSION_KIND_V1
  idempotencyKey: string
  institutionId: string
  institutionRecordRevision: string
  elderId: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  contactName: string
  phone: string
  phonePurpose: AppointmentPhonePurposeV1
  phoneAuthorization: AppointmentPhoneAuthorizationV1
  notes?: string
}

export interface InstitutionVisitV1 {
  contractVersion: AppointmentInstitutionVisitContractVersionV1
  kind: typeof INSTITUTION_VISIT_KIND_V1
  visitId: string
  userId: string
  elderId: string
  institutionId: string
  institutionRecordRevision: string
  consultantId?: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  contactName: string
  phone: string
  phonePurpose: AppointmentPhonePurposeV1
  status: InstitutionVisitStatusV1
  acceptedAt: string
  scheduledAt?: string
  completedAt?: string
  cancelledAt?: string
  notes?: string
}

export interface InstitutionVisitPublicSnapshotV1 {
  contractVersion: AppointmentInstitutionVisitContractVersionV1
  kind: typeof INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1
  visitId: string
  elderId: string
  institutionId: string
  institutionRecordRevision: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  status: InstitutionVisitStatusV1
  acceptedAt: string
}

export interface AppointmentSubmissionReceiptV1 {
  contractVersion: AppointmentInstitutionVisitContractVersionV1
  kind: 'appointment_submission_receipt_v1'
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  status: 'requested'
  acceptedAt: string
  publicMessage: '预约申请已提交'
}

export interface AppointmentSubmissionAcceptedV1 {
  receipt: AppointmentSubmissionReceiptV1
  visit: InstitutionVisitPublicSnapshotV1
}

export type AppointmentApplicationErrorCodeV1 =
  | 'AUTH_REQUIRED'
  | 'CONTACT_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'REFERENCE_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'TECHNICAL_FAILURE'

export interface AppointmentApplicationErrorV1 {
  code: AppointmentApplicationErrorCodeV1
  publicMessage: string
  retryable: boolean
  draftAction: 'RETAIN_LOCAL_DRAFT'
}

export type AppointmentApplicationResultV1 =
  | { ok: true; value: AppointmentSubmissionAcceptedV1 }
  | { ok: false; error: AppointmentApplicationErrorV1 }

export type AppointmentValidationIssueCodeV1 =
  | 'INVALID_SHAPE'
  | 'INVALID_CONTRACT_VERSION'
  | 'INVALID_KIND'
  | 'INVALID_PROVENANCE'
  | 'INVALID_IDENTITY'
  | 'INVALID_FIELD'
  | 'MISSING_REQUIRED_FIELD'
  | 'FORBIDDEN_FIELD'
  | 'INVALID_PHONE_PURPOSE'
  | 'INVALID_PHONE_AUTHORIZATION'
  | 'INVALID_STATUS'
  | 'INVALID_SERVER_TIMESTAMP'

export interface AppointmentValidationIssueV1 {
  code: AppointmentValidationIssueCodeV1
  path: string
}

export type AppointmentValidationResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly AppointmentValidationIssueV1[] }

export interface AuthenticatedPrincipalV1 {
  userId: string
}

export type AuthenticatedPrincipalPortResultV1 =
  | { ok: true; principal: AuthenticatedPrincipalV1 }
  | { ok: false; failure: 'missing' | 'unavailable' | 'failed' }

export interface AuthenticatedPrincipalPortV1 {
  getPrincipal(): AuthenticatedPrincipalPortResultV1
}

export interface AppointmentSubmissionPortInputV1 {
  principal: AuthenticatedPrincipalV1
  submission: AppointmentSubmissionV1
}

export type AppointmentSubmissionPortFailureV1 =
  | 'reference_unavailable'
  | 'idempotency_conflict'
  | 'unavailable'
  | 'technical'

export type AppointmentSubmissionPortResultV1 =
  | { ok: true; candidate: unknown }
  | { ok: false; failure: AppointmentSubmissionPortFailureV1 }

export interface AppointmentSubmissionPortV1 {
  submit(input: AppointmentSubmissionPortInputV1): AppointmentSubmissionPortResultV1
}

export interface AppointmentOwnerReadPortV1 {
  listOwnedVisits(principal: AuthenticatedPrincipalV1): unknown
}

export type AppointmentOwnerReadPortResultV1 =
  | { ok: true; visits: readonly InstitutionVisitPublicSnapshotV1[] }
  | { ok: false; failure: 'unauthorized' | 'unavailable' | 'technical' }

export interface AppointmentAcceptedPersistenceCandidateV1 {
  kind: 'accepted_persistence_candidate_v1'
  visit: unknown
}

export type AppointmentIdempotencyComparisonV1 = 'new_attempt' | 'replay' | 'conflict'

export interface AppointmentIdempotencyInputV1 {
  ownerUserId: string
  idempotencyKey: string
  submission: AppointmentSubmissionV1
}

export interface AppointmentIdempotencyRecordV1 extends AppointmentIdempotencyInputV1 {
  acceptedVisitId: string
}
