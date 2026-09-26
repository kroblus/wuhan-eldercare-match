export const APPOINTMENT_OWNER_READ_CONTRACT_VERSION_V1 =
  'appointment-production-owner-read-contract-v1' as const
export const APPOINTMENT_OWNER_READ_RESULT_KIND_V1 = 'appointment_owner_read_result_v1' as const

export type AppointmentOwnerReadVisitStatusV1 =
  | 'requested'
  | 'contacting'
  | 'scheduled'
  | 'completed'
  | 'cancelled'

export interface AppointmentOwnerReadVisitV1 {
  visitId: string
  visitStatus: AppointmentOwnerReadVisitStatusV1
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
  institutionDisplay: {
    availability: 'ready' | 'unavailable'
    name: string | null
  }
}
