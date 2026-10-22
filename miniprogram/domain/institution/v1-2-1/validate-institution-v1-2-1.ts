import type { InstitutionEvidence } from '../../../types/institution'
import type {
  InstitutionOfficialPhoneV1,
  InstitutionRecordV121,
} from '../../../types/institution-v1-2-1'
import {
  hasExactKeys,
  isOneOf,
  isPlainRecord,
  isStableIdentifier,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'
import { validateSuccessorEvidenceClosure } from '../v1-2/evidence-closure'
import type {
  InstitutionSuccessorFieldBinding,
} from '../v1-2/runtime-primitives'
import { validateSuccessorField } from '../v1-2/runtime-primitives'
import { validateInstitutionRecordV12 } from '../v1-2/validate-institution-v1-2'
import type { InstitutionV12ValidationOptions } from '../v1-2/validate-institution-v1-2'
import {
  canonicalizeOfficialPhones,
  isCanonicalOfficialPhoneOrder,
  isCanonicalOfficialPhoneValue,
} from './official-phone'
import {
  isCanonicalInstitutionAddress,
  isValidInstitutionGeoLocation,
} from './public-location'
import type { AdministrativeDivisionResolver } from './public-location'
import { buildInstitutionRecordV12Explicit } from './projection-common'
import {
  INSTITUTION_CONTRACT_VERSION_V121,
  INSTITUTION_OFFICIAL_CONTACT_SCHEMA_VERSION_V1,
  INSTITUTION_PUBLIC_LOCATION_SCHEMA_VERSION_V1,
  OFFICIAL_PHONE_DIRECTORY_PRESENCE_CODES,
  isV121ExtensionEvidencePath,
  officialPhoneFieldPath,
} from './rules-v1-2-1'

export type InstitutionV121ValidationErrorCode =
  | 'INVALID_INSTITUTION_V121_RECORD'
  | 'INVALID_CONTRACT_VERSION'
  | 'INVALID_OFFICIAL_CONTACT'
  | 'INVALID_OFFICIAL_PHONE'
  | 'INVALID_OFFICIAL_PHONE_ORDER'
  | 'INVALID_STRUCTURED_ADDRESS'
  | 'ADMINISTRATIVE_DIVISION_RESOLVER_NOT_CONFIGURED'
  | 'INVALID_ADMINISTRATIVE_DIVISION_HIERARCHY'
  | 'INVALID_GEO_LOCATION'
  | 'UNSUPPORTED_COORDINATE_SYSTEM'
  | 'V121_EVIDENCE_CLOSURE_ERROR'
  | 'INVALID_FIELD_VERIFICATION'
  | 'DUPLICATE_ID'
  | 'BROKEN_REFERENCE'
  | string

export interface InstitutionV121ValidationIssue {
  code: InstitutionV121ValidationErrorCode
  path: string
}

export type InstitutionV121ValidationResult =
  | { ok: true; value: InstitutionRecordV121 }
  | { ok: false; issues: readonly InstitutionV121ValidationIssue[] }

export interface InstitutionV121ValidationOptions extends InstitutionV12ValidationOptions {
  administrativeDivisionResolver?: AdministrativeDivisionResolver
}

export const INSTITUTION_V121_TOP_LEVEL_KEYS: readonly string[] = [
  'contractVersion',
  'capabilityContractVersion',
  'institutionId',
  'recordRevision',
  'recordProvenance',
  'recordStatus',
  'identity',
  'typeProfile',
  'capabilities',
  'services',
  'medicalSupport',
  'rehabilitationSupport',
  'staffing',
  'healthMonitoring',
  'price',
  'operations',
  'rooms',
  'meal',
  'activity',
  'transportation',
  'majorHospitalAccess',
  'media',
  'vr',
  'qualifications',
  'evidence',
  'careProcess',
  'officialContact',
  'publicLocation',
]

const projectUncheckedToV12 = (input: InstitutionRawRecord) => {
  const record = input as unknown as InstitutionRecordV121
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.filter((item) => !(
      isPlainRecord(item)
      && typeof item.fieldPath === 'string'
      && isV121ExtensionEvidencePath(item.fieldPath)
    )) as InstitutionEvidence[]
    : []
  return buildInstitutionRecordV12Explicit(record, evidence)
}

const validateOfficialContact = (
  value: unknown,
  issue: (code: string, path: string) => void,
  bindings: InstitutionSuccessorFieldBinding[],
): void => {
  const path = 'officialContact'
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['schemaVersion', 'phoneDirectoryPresence', 'officialPhones'])) {
    issue('INVALID_OFFICIAL_CONTACT', path)
    return
  }
  if (value.schemaVersion !== INSTITUTION_OFFICIAL_CONTACT_SCHEMA_VERSION_V1) {
    issue('INVALID_OFFICIAL_CONTACT', `${path}.schemaVersion`)
  }
  const directory = validateSuccessorField(
    value.phoneDirectoryPresence,
    `${path}.phoneDirectoryPresence`,
    (item) => isOneOf(item, OFFICIAL_PHONE_DIRECTORY_PRESENCE_CODES),
    'stable_code',
    'INVALID_OFFICIAL_CONTACT',
    issue,
    bindings,
  )
  if (!Array.isArray(value.officialPhones)) {
    issue('INVALID_OFFICIAL_CONTACT', `${path}.officialPhones`)
    return
  }
  const keys: string[] = []
  const phones: InstitutionOfficialPhoneV1[] = []
  value.officialPhones.forEach((item, index) => {
    const itemPath = `${path}.officialPhones.${index}`
    if (!isPlainRecord(item)
      || !hasExactKeys(item, ['officialPhoneKey', 'phone'])
      || !isStableIdentifier(item.officialPhoneKey)) {
      issue('INVALID_OFFICIAL_PHONE', itemPath)
      return
    }
    if (keys.indexOf(item.officialPhoneKey) >= 0) {
      issue('INVALID_OFFICIAL_PHONE', `${itemPath}.officialPhoneKey`)
    }
    keys.push(item.officialPhoneKey)
    validateSuccessorField(
      item.phone,
      officialPhoneFieldPath(item.officialPhoneKey),
      isCanonicalOfficialPhoneValue,
      'official_phone',
      'INVALID_OFFICIAL_PHONE',
      issue,
      bindings,
      true,
    )
    phones.push(item as unknown as InstitutionOfficialPhoneV1)
  })
  const canonical = canonicalizeOfficialPhones(phones)
  if (!canonical.ok) {
    issue('INVALID_OFFICIAL_PHONE', `${path}.officialPhones`)
  } else if (!isCanonicalOfficialPhoneOrder(phones)) {
    issue('INVALID_OFFICIAL_PHONE_ORDER', `${path}.officialPhones`)
  }
  const directoryPresent = directory !== null
    && directory.availability === 'provided'
    && directory.value === 'present'
  if ((directoryPresent && phones.length === 0)
    || (!directoryPresent && phones.length > 0)) {
    issue('INVALID_OFFICIAL_CONTACT', `${path}.officialPhones`)
  }
}

const validatePublicLocation = (
  value: unknown,
  options: InstitutionV121ValidationOptions,
  issue: (code: string, path: string) => void,
  bindings: InstitutionSuccessorFieldBinding[],
): void => {
  const path = 'publicLocation'
  if (!isPlainRecord(value) || !hasExactKeys(value, ['schemaVersion', 'address', 'geo'])) {
    issue('INVALID_STRUCTURED_ADDRESS', path)
    return
  }
  if (value.schemaVersion !== INSTITUTION_PUBLIC_LOCATION_SCHEMA_VERSION_V1) {
    issue('INVALID_STRUCTURED_ADDRESS', `${path}.schemaVersion`)
  }
  const address = validateSuccessorField(
    value.address,
    `${path}.address`,
    isCanonicalInstitutionAddress,
    'structured_address',
    'INVALID_STRUCTURED_ADDRESS',
    issue,
    bindings,
  )
  if (address && address.availability === 'provided') {
    if (!options.administrativeDivisionResolver) {
      issue('ADMINISTRATIVE_DIVISION_RESOLVER_NOT_CONFIGURED', `${path}.address`)
    } else if (isCanonicalInstitutionAddress(address.value)) {
      try {
        if (!options.administrativeDivisionResolver.isValidHierarchy(address.value)) {
          issue('INVALID_ADMINISTRATIVE_DIVISION_HIERARCHY', `${path}.address`)
        }
      } catch (_error) {
        issue('INVALID_ADMINISTRATIVE_DIVISION_HIERARCHY', `${path}.address`)
      }
    }
  }
  const geo = validateSuccessorField(
    value.geo,
    `${path}.geo`,
    isValidInstitutionGeoLocation,
    'geo_location',
    'INVALID_GEO_LOCATION',
    issue,
    bindings,
  )
  if (geo && geo.availability === 'provided'
    && isPlainRecord(geo.value)
    && geo.value.coordinateSystem !== 'gcj02') {
    issue('UNSUPPORTED_COORDINATE_SYSTEM', `${path}.geo.value.coordinateSystem`)
  }
}

export const validateInstitutionRecordV121 = (
  input: unknown,
  options: InstitutionV121ValidationOptions = {},
): InstitutionV121ValidationResult => {
  const issues: InstitutionV121ValidationIssue[] = []
  const issue = (code: string, path: string): void => {
    issues.push({ code, path })
  }
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [{ code: 'INVALID_INSTITUTION_V121_RECORD', path: '$' }] }
  }
  if (!hasExactKeys(input, INSTITUTION_V121_TOP_LEVEL_KEYS)) {
    issue('INVALID_INSTITUTION_V121_RECORD', '$')
  }
  if (input.contractVersion !== INSTITUTION_CONTRACT_VERSION_V121) {
    issue('INVALID_CONTRACT_VERSION', 'contractVersion')
  } else {
    try {
      const predecessorValidation = validateInstitutionRecordV12(projectUncheckedToV12(input), options)
      if (!predecessorValidation.ok) {
        predecessorValidation.issues.forEach((item) => issue(item.code, item.path))
      }
    } catch (_error) {
      issue('INVALID_INSTITUTION_V121_RECORD', '$')
    }
  }
  const bindings: InstitutionSuccessorFieldBinding[] = []
  validateOfficialContact(input.officialContact, issue, bindings)
  validatePublicLocation(input.publicLocation, options, issue, bindings)
  validateSuccessorEvidenceClosure(
    input,
    bindings,
    isV121ExtensionEvidencePath,
    'V121_EVIDENCE_CLOSURE_ERROR',
    issue,
  )
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as InstitutionRecordV121 }
}
