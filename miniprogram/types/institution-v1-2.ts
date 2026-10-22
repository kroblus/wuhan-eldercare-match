/**
 * FROZEN_PHASE_V1_2_A1
 *
 * Institution V1.2 is the compatibility predecessor for V1.2.1. It adds
 * CareProcess facts without changing any frozen V1.1 or Capability semantic.
 */
import type {
  InstitutionEvidence,
  InstitutionField,
} from './institution'
import type { InstitutionRecordV11 } from './institution-v1-1'

export type InstitutionContractVersionV12 = 'institution-contract-v1.2'
export type InstitutionCareProcessSchemaVersionV1 = 'institution-care-process-v1'

export type CareProcessPresenceCode = 'present' | 'absent'
export type CareRecordCompletenessCode = 'complete' | 'partial'
export type CareRecordFrequencyCode =
  | 'per_shift'
  | 'daily'
  | 'event_based'
  | 'other'
export type CareRecordFrequencyCodeSet = readonly CareRecordFrequencyCode[]
export type CareRecordTraceabilityCode = 'traceable' | 'not_traceable'

export type HandoverContentCode =
  | 'vital_signs'
  | 'abnormal_events'
  | 'interventions_recorded'
  | 'follow_up'
  | 'family_communication'
  | 'medical_transfer'

export type HandoverContentFacts = {
  readonly [K in HandoverContentCode]: InstitutionField<CareProcessPresenceCode>
}

export interface InstitutionCareRecordV1 {
  presence: InstitutionField<CareProcessPresenceCode>
  completeness: InstitutionField<CareRecordCompletenessCode>
  completenessCriteriaRef: InstitutionField<string>
  frequency: InstitutionField<CareRecordFrequencyCodeSet>
  otherFrequencyNote: InstitutionField<string>
  traceability: InstitutionField<CareRecordTraceabilityCode>
}

export interface InstitutionShiftHandover24hV1 {
  presence: InstitutionField<CareProcessPresenceCode>
  processNote: InstitutionField<string>
  contents: HandoverContentFacts
}

export interface InstitutionCareProcessV1 {
  schemaVersion: InstitutionCareProcessSchemaVersionV1
  careRecord: InstitutionCareRecordV1
  shiftHandover24h: InstitutionShiftHandover24hV1
}

/** V1.2 reuses the existing evidence vocabulary without widening it. */
export type InstitutionEvidenceV12 = InstitutionEvidence

export interface InstitutionRecordV12 extends Omit<
  InstitutionRecordV11,
  'contractVersion' | 'evidence'
> {
  contractVersion: InstitutionContractVersionV12
  careProcess: InstitutionCareProcessV1
  evidence: readonly InstitutionEvidenceV12[]
}
