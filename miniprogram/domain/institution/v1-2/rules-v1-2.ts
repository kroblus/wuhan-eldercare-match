import type {
  CareRecordCompletenessCode,
  CareRecordFrequencyCode,
  CareRecordTraceabilityCode,
  CareProcessPresenceCode,
  HandoverContentCode,
} from '../../../types/institution-v1-2'

export const INSTITUTION_CONTRACT_VERSION_V12 = 'institution-contract-v1.2' as const
export const INSTITUTION_CARE_PROCESS_SCHEMA_VERSION_V1 = 'institution-care-process-v1' as const

export const CARE_PROCESS_PRESENCE_CODES: readonly CareProcessPresenceCode[] = [
  'present',
  'absent',
]

export const CARE_RECORD_COMPLETENESS_CODES: readonly CareRecordCompletenessCode[] = [
  'complete',
  'partial',
]

export const CARE_RECORD_FREQUENCY_CODES: readonly CareRecordFrequencyCode[] = [
  'per_shift',
  'daily',
  'event_based',
  'other',
]

export const CARE_RECORD_TRACEABILITY_CODES: readonly CareRecordTraceabilityCode[] = [
  'traceable',
  'not_traceable',
]

export const HANDOVER_CONTENT_CODES: readonly HandoverContentCode[] = [
  'vital_signs',
  'abnormal_events',
  'interventions_recorded',
  'follow_up',
  'family_communication',
  'medical_transfer',
]

export const CARE_PROCESS_FIELD_PATHS: readonly string[] = [
  'careProcess.careRecord.presence',
  'careProcess.careRecord.completeness',
  'careProcess.careRecord.completenessCriteriaRef',
  'careProcess.careRecord.frequency',
  'careProcess.careRecord.otherFrequencyNote',
  'careProcess.careRecord.traceability',
  'careProcess.shiftHandover24h.presence',
  'careProcess.shiftHandover24h.processNote',
  'careProcess.shiftHandover24h.contents.vital_signs',
  'careProcess.shiftHandover24h.contents.abnormal_events',
  'careProcess.shiftHandover24h.contents.interventions_recorded',
  'careProcess.shiftHandover24h.contents.follow_up',
  'careProcess.shiftHandover24h.contents.family_communication',
  'careProcess.shiftHandover24h.contents.medical_transfer',
]

export const isCareProcessFieldPath = (fieldPath: string): boolean =>
  CARE_PROCESS_FIELD_PATHS.indexOf(fieldPath) >= 0

export const isCareProcessEvidencePath = (fieldPath: string): boolean =>
  fieldPath.indexOf('careProcess.') === 0

export type FrequencyCanonicalizationErrorCode =
  | 'INVALID_CARE_RECORD_FREQUENCY'

export type FrequencyCanonicalizationResult =
  | { ok: true; value: readonly CareRecordFrequencyCode[] }
  | { ok: false; code: FrequencyCanonicalizationErrorCode }

/** Pure ingestion helper. Exact record validation still rejects dirty input. */
export const canonicalizeCareRecordFrequencyCodes = (
  input: readonly unknown[],
): FrequencyCanonicalizationResult => {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, code: 'INVALID_CARE_RECORD_FREQUENCY' }
  }
  const selected: CareRecordFrequencyCode[] = []
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index]
    if (typeof value !== 'string'
      || CARE_RECORD_FREQUENCY_CODES.indexOf(value as CareRecordFrequencyCode) < 0) {
      return { ok: false, code: 'INVALID_CARE_RECORD_FREQUENCY' }
    }
    const code = value as CareRecordFrequencyCode
    if (selected.indexOf(code) < 0) {
      selected.push(code)
    }
  }
  return {
    ok: true,
    value: CARE_RECORD_FREQUENCY_CODES.filter((code) => selected.indexOf(code) >= 0),
  }
}

export const isCanonicalCareRecordFrequencyCodes = (input: unknown): boolean => {
  if (!Array.isArray(input) || input.length === 0) {
    return false
  }
  const canonical = canonicalizeCareRecordFrequencyCodes(input)
  if (!canonical.ok || canonical.value.length !== input.length) {
    return false
  }
  return canonical.value.every((code, index) => code === input[index])
}
