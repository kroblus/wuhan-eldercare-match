import type { InstitutionField } from '../../../types/institution'
import type {
  InstitutionAddressV1,
  InstitutionGeoLocationV1,
  InstitutionRecordV121,
} from '../../../types/institution-v1-2-1'
import { isVerificationCurrentAt } from '../verification'
import { compareIsoTimestamps, isValidIsoTimestamp } from '../primitives'
import { formatInstitutionAddress } from './public-location'
import { validateInstitutionRecordV121 } from './validate-institution-v1-2-1'
import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'

export type InstitutionMapDisplayStatusV1 =
  | 'available'
  | 'address_unknown'
  | 'address_unavailable'
  | 'address_unverified'
  | 'address_expired'
  | 'geo_unknown'
  | 'geo_unavailable'
  | 'geo_unverified'
  | 'geo_expired'

export type InstitutionEffectiveVerificationV121 =
  | 'current_verified'
  | 'unverified'
  | 'expired'

export interface InstitutionMapDisplaySnapshotV1 {
  status: InstitutionMapDisplayStatusV1
  institutionName: string
  formattedAddress: string | null
  latitude: number | null
  longitude: number | null
  coordinateSystem: 'gcj02' | null
  addressVerification: InstitutionEffectiveVerificationV121 | null
  geoVerification: InstitutionEffectiveVerificationV121 | null
  mapActionAvailable: boolean
}

export type InstitutionMapReadinessResult =
  | { ok: true; value: InstitutionMapDisplaySnapshotV1 }
  | {
      ok: false
      code: 'INVALID_INSTITUTION_V121_RECORD' | 'INVALID_EVALUATION_AS_OF' | 'MAP_ACTION_UNAVAILABLE'
    }

const effectiveVerification = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): InstitutionEffectiveVerificationV121 => {
  if (isVerificationCurrentAt(field.verification, evaluationAsOf)) {
    return 'current_verified'
  }
  const verification = field.verification
  if (verification.status === 'expired'
    || (verification.status === 'verified'
      && verification.validUntil !== undefined
      && compareIsoTimestamps(verification.validUntil, evaluationAsOf) < 0)) {
    return 'expired'
  }
  return 'unverified'
}

const unavailableStatus = <T>(
  prefix: 'address' | 'geo',
  field: InstitutionField<T>,
  evaluationAsOf: string,
): InstitutionMapDisplayStatusV1 | null => {
  if (field.availability === 'unknown') {
    return prefix === 'address' ? 'address_unknown' : 'geo_unknown'
  }
  if (field.availability === 'unavailable') {
    return prefix === 'address' ? 'address_unavailable' : 'geo_unavailable'
  }
  const verification = effectiveVerification(field, evaluationAsOf)
  if (verification === 'expired') {
    return prefix === 'address' ? 'address_expired' : 'geo_expired'
  }
  if (verification !== 'current_verified') {
    return prefix === 'address' ? 'address_unverified' : 'geo_unverified'
  }
  return null
}

export const deriveInstitutionMapReadiness = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
  options: InstitutionV121ValidationOptions = {},
): InstitutionMapReadinessResult => {
  if (!isValidIsoTimestamp(evaluationAsOf)) {
    return { ok: false, code: 'INVALID_EVALUATION_AS_OF' }
  }
  if (!validateInstitutionRecordV121(record, options).ok) {
    return { ok: false, code: 'INVALID_INSTITUTION_V121_RECORD' }
  }
  if (record.recordStatus !== 'published') {
    return { ok: false, code: 'MAP_ACTION_UNAVAILABLE' }
  }
  const addressField = record.publicLocation.address
  const geoField = record.publicLocation.geo
  const addressStatus = unavailableStatus('address', addressField, evaluationAsOf)
  const formatted = addressField.availability === 'provided'
    ? formatInstitutionAddress(addressField.value as InstitutionAddressV1)
    : null
  const formattedAddress = formatted && formatted.ok ? formatted.value : null
  const institutionName = record.identity.name.availability === 'provided'
    ? record.identity.name.value : ''
  if (addressStatus) {
    return {
      ok: true,
      value: {
        status: addressStatus,
        institutionName,
        formattedAddress,
        latitude: null,
        longitude: null,
        coordinateSystem: null,
        addressVerification: addressField.availability === 'provided'
          ? effectiveVerification(addressField, evaluationAsOf) : null,
        geoVerification: geoField.availability === 'provided'
          ? effectiveVerification(geoField, evaluationAsOf) : null,
        mapActionAvailable: false,
      },
    }
  }
  const geoStatus = unavailableStatus('geo', geoField, evaluationAsOf)
  if (geoStatus) {
    return {
      ok: true,
      value: {
        status: geoStatus,
        institutionName,
        formattedAddress,
        latitude: null,
        longitude: null,
        coordinateSystem: null,
        addressVerification: effectiveVerification(addressField, evaluationAsOf),
        geoVerification: geoField.availability === 'provided'
          ? effectiveVerification(geoField, evaluationAsOf) : null,
        mapActionAvailable: false,
      },
    }
  }
  const geo = geoField.value as InstitutionGeoLocationV1
  return {
    ok: true,
    value: {
      status: 'available',
      institutionName,
      formattedAddress,
      latitude: geo.latitude,
      longitude: geo.longitude,
      coordinateSystem: geo.coordinateSystem,
      addressVerification: effectiveVerification(addressField, evaluationAsOf),
      geoVerification: effectiveVerification(geoField, evaluationAsOf),
      mapActionAvailable: true,
    },
  }
}
