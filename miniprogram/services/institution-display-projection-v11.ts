/**
 * Pure V1.1 display projection boundary for the List/Detail application
 * layer.  Keeping this helper in its own module prevents List/Detail imports
 * from traversing the Recommendation evaluator, draft store, or profile
 * derivation graph.
 */

import { isValidIsoTimestamp } from '../domain/institution/primitives'
import { isVerificationCurrentAt } from '../domain/institution/verification'
import type {
  InstitutionField,
  InstitutionTypeCode,
  ReferenceMonthlyPrice,
} from '../types/institution'
import type { InstitutionRecordV11 } from '../types/institution-v1-1'
import type {
  EffectiveVerificationStateV11,
  InstitutionDisplayFactV11,
  InstitutionDisplaySnapshotV11,
  InstitutionMealDisplayFactsV11,
  InstitutionRoomDisplayFactV11,
  ReferenceMonthlyPriceDisplayValueV11,
} from '../types/recommendation-result-v2'

const verificationState = (
  verification: InstitutionField<unknown>['verification'],
  evaluationAsOf: string,
): EffectiveVerificationStateV11 => {
  if (verification.status === 'expired') return 'expired'
  if (verification.status === 'verified'
    && verification.validUntil !== undefined
    && isValidIsoTimestamp(evaluationAsOf)
    && isValidIsoTimestamp(verification.validUntil)
    && Date.parse(verification.validUntil) < Date.parse(evaluationAsOf)) {
    return 'expired'
  }
  return verification.status === 'verified' && isVerificationCurrentAt(verification, evaluationAsOf)
    ? 'current_verified'
    : 'unverified'
}

const displayFact = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): InstitutionDisplayFactV11<T> => {
  const effectiveVerification = verificationState(field.verification, evaluationAsOf)
  if (field.availability === 'provided') {
    return {
      availability: 'provided',
      value: field.value,
      effectiveVerification,
    }
  }
  return {
    availability: field.availability === 'unavailable' ? 'unavailable' : 'unknown',
    value: null,
    effectiveVerification,
  }
}

const unknownFact = <T>(): InstitutionDisplayFactV11<T> => ({
  availability: 'unknown',
  value: null,
  effectiveVerification: 'unverified',
})

const referenceMonthlyPrice = (
  field: InstitutionField<ReferenceMonthlyPrice>,
  evaluationAsOf: string,
): InstitutionDisplayFactV11<ReferenceMonthlyPriceDisplayValueV11> => {
  const fact = displayFact(field, evaluationAsOf)
  if (fact.availability !== 'provided') return fact
  const range = fact.value.range
  if (range.kind === 'bounded') {
    return {
      availability: 'provided',
      effectiveVerification: fact.effectiveVerification,
      value: {
        kind: 'bounded',
        minAmountMinor: range.min.amountMinor,
        maxAmountMinor: range.max.amountMinor,
        currency: 'CNY',
        period: 'month',
        basis: 'reference_total',
      },
    }
  }
  return {
    availability: 'provided',
    effectiveVerification: fact.effectiveVerification,
    value: {
      kind: 'starting_at',
      minAmountMinor: range.min.amountMinor,
      currency: 'CNY',
      period: 'month',
      basis: 'reference_total',
    },
  }
}

const projectCover = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionDisplaySnapshotV11['media']['cover'] => {
  const mediaId = displayFact(record.identity.coverMediaId, evaluationAsOf)
  if (mediaId.availability !== 'provided'
    || mediaId.effectiveVerification !== 'current_verified'
    || mediaId.value.trim().length === 0) {
    return { state: 'placeholder', mediaId: null, url: null }
  }
  const media = record.media.find((entry) => entry.mediaId === mediaId.value && entry.role === 'cover')
  if (media === undefined) return { state: 'placeholder', mediaId: null, url: null }
  const url = displayFact(media.url, evaluationAsOf)
  if (url.availability !== 'provided'
    || url.effectiveVerification !== 'current_verified'
    || url.value.trim().length === 0) {
    return { state: 'placeholder', mediaId: null, url: null }
  }
  return { state: 'current_verified', mediaId: mediaId.value, url: url.value }
}

const projectVr = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionDisplaySnapshotV11['media']['vr'] => {
  if (record.vr.status === 'unavailable') {
    return isVerificationCurrentAt(record.vr.verification, evaluationAsOf)
      ? { state: 'unavailable' }
      : { state: 'unknown' }
  }
  if (record.vr.status !== 'available'
    || !isVerificationCurrentAt(record.vr.verification, evaluationAsOf)) {
    return { state: 'unknown' }
  }
  const url = displayFact(record.vr.url, evaluationAsOf)
  const cover = displayFact(record.vr.coverMediaId, evaluationAsOf)
  const hasScene = record.vr.scenes.some((scene) => {
    const sceneUrl = displayFact(scene.url, evaluationAsOf)
    return sceneUrl.availability === 'provided'
      && sceneUrl.effectiveVerification === 'current_verified'
      && sceneUrl.value.trim().length > 0
  })
  if (url.availability !== 'provided'
    || url.effectiveVerification !== 'current_verified'
    || url.value.trim().length === 0
    || cover.availability !== 'provided'
    || cover.effectiveVerification !== 'current_verified'
    || cover.value.trim().length === 0
    || !hasScene) {
    return { state: 'unknown' }
  }
  return { state: 'current_verified_available' }
}

const projectRoomFacts = (
  rooms: readonly InstitutionRecordV11['rooms'][number][],
  evaluationAsOf: string,
): readonly InstitutionRoomDisplayFactV11[] => rooms.map((room) => ({
  roomId: room.roomId,
  roomType: displayFact(room.roomType, evaluationAsOf),
}))

const projectMealFacts = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionMealDisplayFactsV11 => ({
  mealSchedule: displayFact(record.meal.mealSchedule, evaluationAsOf),
  easyChewSupport: displayFact(record.meal.easyChewSupport, evaluationAsOf),
  modifiedFoodSupport: displayFact(record.meal.modifiedFoodSupport, evaluationAsOf),
})

/**
 * The same V1.1 display shape consumed by Recommendation Result V2, without
 * importing the Recommendation application service itself.
 */
export const projectInstitutionDisplaySnapshotV11Pure = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionDisplaySnapshotV11 => {
  const primaryType = record.typeProfile.primaryType === undefined
    ? unknownFact<InstitutionTypeCode>()
    : displayFact(record.typeProfile.primaryType, evaluationAsOf)
  return {
    kind: 'institution_display_snapshot_v1_1',
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    recordProvenance: record.recordProvenance,
    recordStatus: record.recordStatus,
    identity: {
      name: displayFact(record.identity.name, evaluationAsOf),
      regionDisplayName: displayFact(record.identity.regionDisplayName, evaluationAsOf),
    },
    type: {
      primaryType,
      supportedTypes: displayFact(record.typeProfile.supportedTypes, evaluationAsOf),
    },
    price: {
      referenceMonthlyPrice: referenceMonthlyPrice(record.price.referenceMonthlyPrice, evaluationAsOf),
    },
    media: {
      cover: projectCover(record, evaluationAsOf),
      vr: projectVr(record, evaluationAsOf),
    },
    roomFacts: projectRoomFacts(record.rooms, evaluationAsOf),
    mealFacts: projectMealFacts(record, evaluationAsOf),
  }
}
