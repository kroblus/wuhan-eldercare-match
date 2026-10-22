import type { AppointmentValidationIssueV1, InstitutionVisitStatusV1 } from '../../types/appointment-institution-visit-v1'

export type AppointmentLifecycleSourceV1 = 'create' | InstitutionVisitStatusV1

export interface AppointmentLifecycleEvaluationV1 {
  ok: true
  kind: 'allowed' | 'noop'
  from: AppointmentLifecycleSourceV1
  to: InstitutionVisitStatusV1
}

export interface AppointmentLifecycleFailureV1 {
  ok: false
  issues: readonly AppointmentValidationIssueV1[]
}

const allowedTransitions: Record<AppointmentLifecycleSourceV1, readonly InstitutionVisitStatusV1[]> = {
  create: ['requested'],
  requested: ['contacting', 'scheduled', 'cancelled'],
  contacting: ['scheduled', 'cancelled'],
  scheduled: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const isInstitutionVisitStatusV1 = (value: unknown): value is InstitutionVisitStatusV1 =>
  value === 'requested' || value === 'contacting' || value === 'scheduled' || value === 'completed' || value === 'cancelled'

export const canTransitionInstitutionVisitV1 = (
  from: AppointmentLifecycleSourceV1,
  to: InstitutionVisitStatusV1,
): boolean => {
  if ((from !== 'create' && !isInstitutionVisitStatusV1(from)) || !isInstitutionVisitStatusV1(to)) return false
  return Object.prototype.hasOwnProperty.call(allowedTransitions, from)
    && allowedTransitions[from].indexOf(to) >= 0
}

export const evaluateInstitutionVisitTransitionV1 = (
  from: AppointmentLifecycleSourceV1,
  to: InstitutionVisitStatusV1,
): AppointmentLifecycleEvaluationV1 | AppointmentLifecycleFailureV1 => {
  if ((from !== 'create' && !isInstitutionVisitStatusV1(from)) || !isInstitutionVisitStatusV1(to)) {
    return { ok: false, issues: [{ code: 'INVALID_STATUS', path: 'status' }] }
  }
  if (from !== 'create' && from === to) return { ok: true, kind: 'noop', from, to }
  if (!canTransitionInstitutionVisitV1(from, to)) {
    return { ok: false, issues: [{ code: 'INVALID_STATUS', path: 'transition' }] }
  }
  return { ok: true, kind: 'allowed', from, to }
}

export const isTerminalInstitutionVisitStatusV1 = (status: InstitutionVisitStatusV1): boolean =>
  status === 'completed' || status === 'cancelled'
