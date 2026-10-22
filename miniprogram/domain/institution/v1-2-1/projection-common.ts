import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV12 } from '../../../types/institution-v1-2'

type V12CompatibleRecord = Omit<InstitutionRecordV12, 'contractVersion' | 'evidence'>

/** Explicit V1.2 allowlist. V1.2.1 fields can never cross this boundary. */
export const buildInstitutionRecordV12Explicit = (
  record: V12CompatibleRecord,
  evidence: readonly InstitutionEvidence[],
): InstitutionRecordV12 => ({
  contractVersion: 'institution-contract-v1.2',
  capabilityContractVersion: record.capabilityContractVersion,
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  recordProvenance: record.recordProvenance,
  recordStatus: record.recordStatus,
  identity: record.identity,
  typeProfile: record.typeProfile,
  capabilities: record.capabilities,
  services: record.services,
  medicalSupport: record.medicalSupport,
  rehabilitationSupport: record.rehabilitationSupport,
  staffing: record.staffing,
  healthMonitoring: record.healthMonitoring,
  price: record.price,
  operations: record.operations,
  rooms: record.rooms,
  meal: record.meal,
  activity: record.activity,
  transportation: record.transportation,
  majorHospitalAccess: record.majorHospitalAccess,
  media: record.media,
  vr: record.vr,
  qualifications: record.qualifications,
  evidence,
  careProcess: record.careProcess,
})
