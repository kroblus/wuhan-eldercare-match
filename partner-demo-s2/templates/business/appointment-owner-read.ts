import type { AppointmentOwnerReadVisitV1 } from '../types/appointment-owner-read-v1'
import type { DemoBusinessSessionV1 } from './business-session'
import { listDemoVisits, PARTNER_DEMO_BUSINESS_PROVENANCE } from './business-session'

export type AppointmentOwnerReadProviderResultV1 =
  | { kind: 'ready'; visits: readonly AppointmentOwnerReadVisitV1[]; provenance: 'DEMO_ONLY' }
  | { kind: 'auth_required' | 'unavailable' | 'technical_failure'; provenance: 'DEMO_ONLY' }

export interface AppointmentOwnerReadProviderV1 {
  readonly provenance: 'DEMO_ONLY'
  loadOwnedVisits(): Promise<AppointmentOwnerReadProviderResultV1>
}

export interface DemoAppointmentOwnerReadOptionsV1 {
  session?: DemoBusinessSessionV1
}

export const createDemoAppointmentOwnerReadProviderV1 = (
  options: DemoAppointmentOwnerReadOptionsV1 = {},
): AppointmentOwnerReadProviderV1 => ({
  provenance: PARTNER_DEMO_BUSINESS_PROVENANCE,
  async loadOwnedVisits(): Promise<AppointmentOwnerReadProviderResultV1> {
    const visits = options.session ? options.session.listVisits() : listDemoVisits()
    return {
      kind: 'ready',
      provenance: PARTNER_DEMO_BUSINESS_PROVENANCE,
      visits,
    }
  },
})

/** Compatibility factory name for generated imports; this is an in-memory demo provider. */
export const createProductionAppointmentOwnerReadProviderV1 = (
): AppointmentOwnerReadProviderV1 => createDemoAppointmentOwnerReadProviderV1()

export const DEMO_APPOINTMENT_OWNER_READ_PROVENANCE_V1 = PARTNER_DEMO_BUSINESS_PROVENANCE
