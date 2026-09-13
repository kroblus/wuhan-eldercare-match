/**
 * Application-safe projections for Institution V1.2.1 Detail.
 *
 * This module is deliberately not a Page/ViewModel and never exposes the raw
 * V1.2.1 record, evidence, source locator, or evidenceIds. It converts one
 * already validated exact record plus one evaluation timestamp into the
 * future-safe sections reserved by A1-4. The current A0 WXML does not render
 * these sections yet.
 */

import {
  deriveInstitutionMapReadiness,
} from '../domain/institution/v1-2-1/map-readiness'
import { deriveOfficialPhonePublicSnapshot } from '../domain/institution/v1-2-1/official-phone'
import { isValidIsoTimestamp } from '../domain/institution/primitives'
import type { InstitutionField } from '../types/institution'
import type {
  CareProcessPresenceCode,
  HandoverContentCode,
} from '../types/institution-v1-2'
import type {
  InstitutionOfficialPhoneV1,
  InstitutionPublicContentV1,
  InstitutionRecordV121,
} from '../types/institution-v1-2-1'
import type {
  InstitutionCareProcessApplicationSnapshotV121,
  InstitutionDetailFutureSectionsV121,
  InstitutionMapApplicationSnapshotV121,
  InstitutionOfficialAddressApplicationSnapshotV121,
  InstitutionOfficialContactApplicationSnapshotV121,
  InstitutionOfficialPhoneApplicationSnapshotV121,
  InstitutionPublicIntroductionApplicationSnapshotV121,
  InstitutionPresentationFact,
} from '../types/institution-list-detail'
import { projectInstitutionField } from './institution-presentation'

export type InstitutionPublicContentApplicationInputV121 =
  | { status: 'ready'; value: InstitutionPublicContentV1 }
  | { status: 'hidden_no_pin' | 'hidden_no_current_head' | 'hidden_not_found' | 'unavailable'; value: null }

const emptyPublicIntroduction = (
  status: InstitutionPublicIntroductionApplicationSnapshotV121['status'],
): InstitutionPublicIntroductionApplicationSnapshotV121 => ({
  status,
  contentRevision: null,
  text: null,
  sourceType: null,
  updatedAt: null,
})

export const projectInstitutionPublicIntroductionV121 = (
  input: InstitutionPublicContentApplicationInputV121,
  institutionId: string,
): InstitutionPublicIntroductionApplicationSnapshotV121 => {
  if (input.status !== 'ready') return emptyPublicIntroduction(input.status)
  const content = input.value
  if (content.institutionId !== institutionId
    || content.publicationStatus !== 'published'
    || content.introduction.availability !== 'provided') {
    return emptyPublicIntroduction('hidden_not_found')
  }
  return {
    status: 'ready',
    contentRevision: content.contentRevision,
    text: content.introduction.text,
    sourceType: content.introduction.sourceType,
    updatedAt: content.updatedAt,
  }
}

const projectOfficialPhone = (
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

const projectOfficialContact = (
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

const projectOfficialAddress = (
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

const unavailableMap = (): InstitutionMapApplicationSnapshotV121 => ({
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

const projectMap = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
): InstitutionMapApplicationSnapshotV121 => {
  const result = deriveInstitutionMapReadiness(record, evaluationAsOf)
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

const projectCarePresence = (
  field: InstitutionField<CareProcessPresenceCode>,
  evaluationAsOf: string,
): InstitutionPresentationFact<CareProcessPresenceCode> =>
  projectInstitutionField(field, evaluationAsOf)

const projectCareProcess = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
): InstitutionCareProcessApplicationSnapshotV121 => {
  const careRecord = record.careProcess.careRecord
  const handover = record.careProcess.shiftHandover24h
  const presence = projectCarePresence(careRecord.presence, evaluationAsOf)
  // Build a mutable local object and return it as the frozen contract shape;
  // mapped contract properties are readonly, so assigning through that type
  // would incorrectly reject this one-time projection.
  const contents: Record<HandoverContentCode, InstitutionPresentationFact<CareProcessPresenceCode>> = {
    vital_signs: projectCarePresence(handover.contents.vital_signs, evaluationAsOf),
    abnormal_events: projectCarePresence(handover.contents.abnormal_events, evaluationAsOf),
    interventions_recorded: projectCarePresence(handover.contents.interventions_recorded, evaluationAsOf),
    follow_up: projectCarePresence(handover.contents.follow_up, evaluationAsOf),
    family_communication: projectCarePresence(handover.contents.family_communication, evaluationAsOf),
    medical_transfer: projectCarePresence(handover.contents.medical_transfer, evaluationAsOf),
  }
  return {
    status: presence.availability,
    careRecord: {
      presence,
      completeness: projectInstitutionField(careRecord.completeness, evaluationAsOf),
      frequency: projectInstitutionField(careRecord.frequency, evaluationAsOf),
      traceability: projectInstitutionField(careRecord.traceability, evaluationAsOf),
    },
    shiftHandover24h: {
      presence: projectCarePresence(handover.presence, evaluationAsOf),
      contents,
    },
  }
}

/**
 * Build all V1.2.1 future-safe Detail sections from one exact record. The
 * function is intentionally deterministic and does not read the catalog or
 * the clock.
 */
export const projectInstitutionFutureSectionsV121 = (
  record: InstitutionRecordV121,
  evaluationAsOf: string,
  publicContent: InstitutionPublicContentApplicationInputV121 = {
    status: 'hidden_no_current_head',
    value: null,
  },
): InstitutionDetailFutureSectionsV121 => {
  if (!isValidIsoTimestamp(evaluationAsOf)) {
    throw new Error('INVALID_EVALUATION_AS_OF')
  }
  const map = projectMap(record, evaluationAsOf)
  return {
    publicIntroduction: projectInstitutionPublicIntroductionV121(
      publicContent,
      record.institutionId,
    ),
    officialContact: projectOfficialContact(record, evaluationAsOf),
    officialAddress: projectOfficialAddress(record, evaluationAsOf, map.formattedAddress),
    mapLocation: map,
    careProcess: projectCareProcess(record, evaluationAsOf),
  }
}

/** A safe, non-V1.2.1 fallback used only by frozen V1.1 test/service inputs. */
export const createUnavailableFutureSectionsV121 = (): InstitutionDetailFutureSectionsV121 => ({
  publicIntroduction: emptyPublicIntroduction('unavailable'),
  officialContact: {
    status: 'unavailable',
    directory: {
      availability: 'unavailable',
      value: null,
      effectiveVerification: 'unverified',
    },
    phones: [],
  },
  officialAddress: {
    status: 'unavailable',
    formattedAddress: null,
    effectiveVerification: 'unverified',
  },
  mapLocation: unavailableMap(),
  careProcess: {
    status: 'unavailable',
    careRecord: {
      presence: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      completeness: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      frequency: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      traceability: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
    },
    shiftHandover24h: {
      presence: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      contents: {
        vital_signs: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        abnormal_events: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        interventions_recorded: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        follow_up: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        family_communication: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
        medical_transfer: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' },
      },
    },
  },
})
