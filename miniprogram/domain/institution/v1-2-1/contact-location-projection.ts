/** Pure official-contact and public-location projections. Map readiness keeps its complete validation gate. */
import { deriveInstitutionMapReadiness } from './map-readiness'
import { deriveOfficialPhonePublicSnapshot } from './official-phone'
import { projectInstitutionField } from '../presentation-facts'
import type { InstitutionV121ValidationOptions } from './validate-institution-v1-2-1'
import type { InstitutionOfficialPhoneV1, InstitutionRecordV121 } from '../../../types/institution-v1-2-1'
import type {
  InstitutionMapApplicationSnapshotV121,
  InstitutionOfficialAddressApplicationSnapshotV121,
  InstitutionOfficialContactApplicationSnapshotV121,
  InstitutionOfficialPhoneApplicationSnapshotV121,
} from '../../../types/institution-list-detail'

export const projectOfficialPhone = (
  record: InstitutionRecordV121,
  phone: InstitutionOfficialPhoneV1,
  evaluationAsOf: string,
): InstitutionOfficialPhoneApplicationSnapshotV121 => {
  const snapshot = deriveOfficialPhonePublicSnapshot(record, phone, evaluationAsOf)
  return {
    officialPhoneKey: snapshot.officialPhoneKey,
    purpose: snapshot.purpose,
    displayValue: snapshot.displayValue,
    dialValue: snapshot.dialValue,
    extension: snapshot.extension,
    status: snapshot.status,
    verifiedDate: snapshot.verifiedDate,
    callActionAvailable: snapshot.callActionAvailable,
  }
}

export const projectOfficialContact = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
): InstitutionOfficialContactApplicationSnapshotV121 => {
  const directory = projectInstitutionField(
    record.officialContact.phoneDirectoryPresence,
    evaluationAsOf,
  )
  const phones = directory.value === 'present'
    ? record.officialContact.officialPhones.map((phone) =>
      projectOfficialPhone(record, phone, evaluationAsOf))
    : []
  const status = directory.availability === 'provided'
    ? directory.value === 'present' ? 'provided' : 'unavailable'
    : directory.availability
  return {
    status,
    directory,
    phones,
  }
}

export const projectOfficialAddress = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
  formattedAddress: string | null,
): InstitutionOfficialAddressApplicationSnapshotV121 => {
  const address = projectInstitutionField(record.publicLocation.address, evaluationAsOf)
  return {
    status: address.availability,
    formattedAddress: address.value === null ? null : formattedAddress,
    effectiveVerification: address.effectiveVerification,
  }
}

export const unavailableMap = (): InstitutionMapApplicationSnapshotV121 => ({
  status: 'unavailable',
  institutionName: '',
  formattedAddress: null,
  latitude: null,
  longitude: null,
  coordinateSystem: null,
  addressVerification: null,
  geoVerification: null,
  mapActionAvailable: false,
})

export const projectMap = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
  options: InstitutionV121ValidationOptions = {},
): InstitutionMapApplicationSnapshotV121 => {
  const result = deriveInstitutionMapReadiness(record, evaluationAsOf, options)
  if (!result.ok) return unavailableMap()
  return {
    status: result.value.status,
    institutionName: result.value.institutionName,
    formattedAddress: result.value.formattedAddress,
    latitude: result.value.latitude,
    longitude: result.value.longitude,
    coordinateSystem: result.value.coordinateSystem,
    addressVerification: result.value.addressVerification,
    geoVerification: result.value.geoVerification,
    mapActionAvailable: result.value.mapActionAvailable,
  }
}
