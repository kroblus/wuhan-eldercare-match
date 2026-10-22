import type {
  AppointmentSubmissionAcceptedV1,
  InstitutionVisitPublicSnapshotV1,
  InstitutionVisitV1,
} from '../../types/appointment-institution-visit-v1'
import {
  APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
  INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1,
} from '../../types/appointment-institution-visit-v1'

export const projectInstitutionVisitPublicSnapshotV1 = (
  visit: InstitutionVisitV1,
): InstitutionVisitPublicSnapshotV1 => {
  const snapshot: InstitutionVisitPublicSnapshotV1 = {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: INSTITUTION_VISIT_PUBLIC_SNAPSHOT_KIND_V1,
    visitId: visit.visitId,
    elderId: visit.elderId,
    institutionId: visit.institutionId,
    institutionRecordRevision: visit.institutionRecordRevision,
    visitDate: visit.visitDate,
    visitTimePreference: visit.visitTimePreference,
    participantCount: visit.participantCount,
    status: visit.status,
    acceptedAt: visit.acceptedAt,
  }
  if (visit.pickupRequested !== undefined) snapshot.pickupRequested = visit.pickupRequested
  return snapshot
}

export const projectAppointmentSubmissionAcceptedV1 = (
  visit: InstitutionVisitV1,
): AppointmentSubmissionAcceptedV1 => ({
  receipt: {
    contractVersion: APPOINTMENT_INSTITUTION_VISIT_CONTRACT_VERSION_V1,
    kind: 'appointment_submission_receipt_v1',
    visitId: visit.visitId,
    institutionId: visit.institutionId,
    institutionRecordRevision: visit.institutionRecordRevision,
    status: 'requested',
    acceptedAt: visit.acceptedAt,
    publicMessage: '预约申请已提交',
  },
  visit: projectInstitutionVisitPublicSnapshotV1(visit),
})
