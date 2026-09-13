import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import type { InstitutionRecordV12 } from '../../../types/institution-v1-2'
import type { InstitutionRecordV121 } from '../../../types/institution-v1-2-1'
import { isPlainRecord } from '../primitives'
import { validateInstitutionRecordV11 } from '../v1-1/validate-institution-v1-1'
import { validateInstitutionRecordV12 } from '../v1-2/validate-institution-v1-2'
import type { InstitutionV12ValidationOptions } from '../v1-2/validate-institution-v1-2'
import { validateInstitutionRecordV121 } from './validate-institution-v1-2-1'
import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'

export type InstitutionVersionDispatchResult =
  | { ok: true; contractVersion: 'institution-contract-v1.1'; value: InstitutionRecordV11 }
  | { ok: true; contractVersion: 'institution-contract-v1.2'; value: InstitutionRecordV12 }
  | { ok: true; contractVersion: 'institution-contract-v1.2.1'; value: InstitutionRecordV121 }
  | {
      ok: false
      code: 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION' | 'INVALID_INSTITUTION_RECORD'
      contractVersion: string | null
    }

export type InstitutionVersionDispatchOptions = InstitutionV121ValidationOptions
  & InstitutionV12ValidationOptions

export const validateInstitutionRecordByVersion = (
  input: unknown,
  options: InstitutionVersionDispatchOptions = {},
): InstitutionVersionDispatchResult => {
  if (!isPlainRecord(input) || typeof input.contractVersion !== 'string') {
    return {
      ok: false,
      code: 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION',
      contractVersion: null,
    }
  }
  if (input.contractVersion === 'institution-contract-v1.1') {
    const result = validateInstitutionRecordV11(input)
    return result.ok
      ? { ok: true, contractVersion: input.contractVersion, value: result.value }
      : { ok: false, code: 'INVALID_INSTITUTION_RECORD', contractVersion: input.contractVersion }
  }
  if (input.contractVersion === 'institution-contract-v1.2') {
    const result = validateInstitutionRecordV12(input, options)
    return result.ok
      ? { ok: true, contractVersion: input.contractVersion, value: result.value }
      : { ok: false, code: 'INVALID_INSTITUTION_RECORD', contractVersion: input.contractVersion }
  }
  if (input.contractVersion === 'institution-contract-v1.2.1') {
    const result = validateInstitutionRecordV121(input, options)
    return result.ok
      ? { ok: true, contractVersion: input.contractVersion, value: result.value }
      : { ok: false, code: 'INVALID_INSTITUTION_RECORD', contractVersion: input.contractVersion }
  }
  return {
    ok: false,
    code: 'UNSUPPORTED_INSTITUTION_CONTRACT_VERSION',
    contractVersion: input.contractVersion,
  }
}
