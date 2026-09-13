import type { InstitutionEvidence } from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import type { InstitutionRecordV121 } from '../../../types/institution-v1-2-1'
import { validateInstitutionRecordV11 } from '../v1-1/validate-institution-v1-1'
import { buildInstitutionRecordV11Explicit } from '../v1-2/projection-common'
import { isAnyPostV11EvidencePath } from './rules-v1-2-1'
import { validateInstitutionRecordV121 } from './validate-institution-v1-2-1'
import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'

export type V121ToV11ProjectionResult =
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; code: 'V121_TO_V11_PROJECTION_ERROR' }

/** Canonical Recommendation path: direct V1.2.1 to explicit V1.1 allowlist. */
export const projectInstitutionRecordV121ToV11 = (
  record: InstitutionRecordV121,
  options: InstitutionV121ValidationOptions = {},
): V121ToV11ProjectionResult => {
  if (!validateInstitutionRecordV121(record, options).ok) {
    return { ok: false, code: 'V121_TO_V11_PROJECTION_ERROR' }
  }
  const evidence = record.evidence.filter((item) =>
    !isAnyPostV11EvidencePath(item.fieldPath)) as readonly InstitutionEvidence[]
  const output = buildInstitutionRecordV11Explicit(record, evidence)
  return validateInstitutionRecordV11(output).ok
    ? { ok: true, value: output }
    : { ok: false, code: 'V121_TO_V11_PROJECTION_ERROR' }
}
