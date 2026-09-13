import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import type { InstitutionRecordV12 } from '../../../types/institution-v1-2'
import { validateInstitutionRecordV11 } from '../v1-1/validate-institution-v1-1'
import { buildInstitutionRecordV11Explicit } from './projection-common'
import { isCareProcessEvidencePath } from './rules-v1-2'
import { validateInstitutionRecordV12 } from './validate-institution-v1-2'
import type { InstitutionV12ValidationOptions } from './validate-institution-v1-2'

export type V12ToV11ProjectionResult =
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; code: 'V12_TO_V11_PROJECTION_FAILED' }

export const projectInstitutionRecordV12ToV11 = (
  record: InstitutionRecordV12,
  options: InstitutionV12ValidationOptions = {},
): V12ToV11ProjectionResult => {
  const inputValidation = validateInstitutionRecordV12(record, options)
  if (!inputValidation.ok) {
    return { ok: false, code: 'V12_TO_V11_PROJECTION_FAILED' }
  }
  const evidence = record.evidence.filter((item) =>
    !isCareProcessEvidencePath(item.fieldPath)) as readonly InstitutionEvidence[]
  const output = buildInstitutionRecordV11Explicit(record, evidence)
  const outputValidation = validateInstitutionRecordV11(output)
  return outputValidation.ok
    ? { ok: true, value: output }
    : { ok: false, code: 'V12_TO_V11_PROJECTION_FAILED' }
}
