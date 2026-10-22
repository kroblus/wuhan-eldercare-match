import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV12 } from '../../../types/institution-v1-2'
import type { InstitutionRecordV121 } from '../../../types/institution-v1-2-1'
import { validateInstitutionRecordV12 } from '../v1-2/validate-institution-v1-2'
import { buildInstitutionRecordV12Explicit } from './projection-common'
import { isV121ExtensionEvidencePath } from './rules-v1-2-1'
import { validateInstitutionRecordV121 } from './validate-institution-v1-2-1'
import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'

export type V121ToV12ProjectionResult =
  | { ok: true; value: InstitutionRecordV12 }
  | { ok: false; code: 'V121_TO_V12_PROJECTION_ERROR' }

export const projectInstitutionRecordV121ToV12 = (
  record: InstitutionRecordV121,
  options: InstitutionV121ValidationOptions = {},
): V121ToV12ProjectionResult => {
  if (!validateInstitutionRecordV121(record, options).ok) {
    return { ok: false, code: 'V121_TO_V12_PROJECTION_ERROR' }
  }
  const evidence = record.evidence.filter((item) =>
    !isV121ExtensionEvidencePath(item.fieldPath)) as readonly InstitutionEvidence[]
  const output = buildInstitutionRecordV12Explicit(record, evidence)
  return validateInstitutionRecordV12(output, options).ok
    ? { ok: true, value: output }
    : { ok: false, code: 'V121_TO_V12_PROJECTION_ERROR' }
}
