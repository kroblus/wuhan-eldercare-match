/** Pure display facts shared by directory and detail projections. */
import { isValidIsoTimestamp } from './primitives'
import { isVerificationCurrentAt } from './verification'
import type { InstitutionField, ReferenceMonthlyPrice } from '../../types/institution'
import type { InstitutionRecordV11 } from '../../types/institution-v1-1'
import type {
  InstitutionEffectiveVerification, InstitutionPresentationFact,
  InstitutionReferenceMonthlyPriceDisplay,
} from '../../types/institution-list-detail'

export const verificationState = (
  verification: InstitutionField<unknown>['verification'],
  evaluationAsOf: string,
): InstitutionEffectiveVerification => {
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

export const projectInstitutionField = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): InstitutionPresentationFact<T> => ({
  availability: field.availability,
  value: field.availability === 'provided' ? field.value : null,
  effectiveVerification: verificationState(field.verification, evaluationAsOf),
})

export const projectReferencePrice = (
  field: InstitutionField<ReferenceMonthlyPrice>,
  evaluationAsOf: string,
): InstitutionPresentationFact<InstitutionReferenceMonthlyPriceDisplay> => {
  const fact = projectInstitutionField(field, evaluationAsOf)
  if (fact.value === null) {
    return {
      availability: fact.availability,
      value: null,
      effectiveVerification: fact.effectiveVerification,
    }
  }
  const range = fact.value.range
  return {
    availability: fact.availability,
    effectiveVerification: fact.effectiveVerification,
    value: range.kind === 'bounded'
      ? {
        kind: 'bounded',
        minAmountMinor: range.min.amountMinor,
        maxAmountMinor: range.max.amountMinor,
        currency: 'CNY',
        period: 'month',
        basis: 'reference_total',
      }
      : {
        kind: 'starting_at',
        minAmountMinor: range.min.amountMinor,
        maxAmountMinor: null,
        currency: 'CNY',
        period: 'month',
        basis: 'reference_total',
      },
  }
}

export const projectInstitutionPrice = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): Readonly<Record<string, InstitutionPresentationFact<unknown> | readonly unknown[]>> => ({
  referenceMonthlyPrice: projectReferencePrice(record.price.referenceMonthlyPrice, evaluationAsOf),
  recurringComponents: record.price.recurringComponents.map((component) => ({
    component: component.component,
    referenceAmount: projectInstitutionField(component.referenceAmount, evaluationAsOf),
  })),
  deposit: projectInstitutionField(record.price.deposit, evaluationAsOf),
  oneTimeFees: record.price.oneTimeFees.map((fee) => ({
    feeId: fee.feeId,
    label: fee.label,
    referenceAmount: projectInstitutionField(fee.referenceAmount, evaluationAsOf),
  })),
  adjustmentFactors: projectInstitutionField(record.price.adjustmentFactors, evaluationAsOf),
  priceNote: projectInstitutionField(record.price.priceNote, evaluationAsOf),
})
