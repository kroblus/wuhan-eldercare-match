import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'

type V11CompatibleRecord = Omit<InstitutionRecordV11, 'contractVersion' | 'evidence'>

/**
 * The single explicit V1.1 root allowlist used by successor projectors.
 * It deliberately does not inspect successor fields.
 */
export const buildInstitutionRecordV11Explicit = (
  record: V11CompatibleRecord,
  evidence: readonly InstitutionEvidence[],
): InstitutionRecordV11 => ({
  contractVersion: 'institution-contract-v1.1',
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
})
