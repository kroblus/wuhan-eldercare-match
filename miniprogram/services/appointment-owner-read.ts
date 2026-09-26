import {
  createC5AuthenticatedBackendSessionClientV1,
  createDefaultWeChatC5BackendTransportV1,
} from './c5-authenticated-backend-session'
import type { WeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import {
  APPOINTMENT_OWNER_READ_CONTRACT_VERSION_V1,
  APPOINTMENT_OWNER_READ_RESULT_KIND_V1,
} from '../types/appointment-owner-read-v1'
import type { AppointmentOwnerReadVisitV1 } from '../types/appointment-owner-read-v1'

const VISITS_ENDPOINT = '/api/v1/visits'
const REQUEST_TIMEOUT_MS = 15000
const AUTH_RESOLUTIONS = ['authenticated', 'missing', 'expired', 'invalid', 'unavailable', 'technical_failure']
const VISIT_STATUSES = ['requested', 'contacting', 'scheduled', 'completed', 'cancelled']

export type AppointmentOwnerReadProviderResultV1 =
  | { kind: 'ready'; visits: readonly AppointmentOwnerReadVisitV1[] }
  | { kind: 'auth_required' }
  | { kind: 'unavailable' }
  | { kind: 'technical_failure' }

export interface AppointmentOwnerReadProviderV1 {
  loadOwnedVisits(): Promise<AppointmentOwnerReadProviderResultV1>
}

export interface AppointmentOwnerReadTransportV1 extends WeChatC5BackendTransportV1 {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isSafeText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string'
  && value.trim().length > 0
  && value.length <= maxLength
  && !/[\u0000-\u001f\u007f]/.test(value)

const parseVisit = (value: unknown): AppointmentOwnerReadVisitV1 | null => {
  if (!isRecord(value)) return null
  const expectedKeys = [
    'visitId', 'institutionId', 'institutionRecordRevision', 'visitStatus', 'visitDate',
    'visitTimePreference', 'participantCount', 'institutionDisplay',
  ]
  if (Object.prototype.hasOwnProperty.call(value, 'pickupRequested')) expectedKeys.push('pickupRequested')
  if (!hasExactKeys(value, expectedKeys)
    || !isSafeText(value.visitId, 200)
    || !isSafeText(value.institutionId, 200)
    || !isSafeText(value.institutionRecordRevision, 200)
    || typeof value.visitStatus !== 'string'
    || !VISIT_STATUSES.includes(value.visitStatus)
    || !isSafeText(value.visitDate, 32)
    || !isSafeText(value.visitTimePreference, 128)
    || typeof value.participantCount !== 'number'
    || !Number.isInteger(value.participantCount)
    || value.participantCount < 1
    || (Object.prototype.hasOwnProperty.call(value, 'pickupRequested')
      && typeof value.pickupRequested !== 'boolean')) return null

  if (!isRecord(value.institutionDisplay)
    || !hasExactKeys(value.institutionDisplay, ['availability', 'name'])) return null
  let institutionDisplay: AppointmentOwnerReadVisitV1['institutionDisplay']
  if (value.institutionDisplay.availability === 'ready'
    && isSafeText(value.institutionDisplay.name, 200)) {
    institutionDisplay = { availability: 'ready', name: value.institutionDisplay.name }
  } else if (value.institutionDisplay.availability === 'unavailable'
    && value.institutionDisplay.name === null) {
    institutionDisplay = { availability: 'unavailable', name: null }
  } else {
    return null
  }

  return {
    visitId: value.visitId,
    visitStatus: value.visitStatus as AppointmentOwnerReadVisitV1['visitStatus'],
    visitDate: value.visitDate,
    visitTimePreference: value.visitTimePreference,
    participantCount: value.participantCount,
    ...(typeof value.pickupRequested === 'boolean' ? { pickupRequested: value.pickupRequested } : {}),
    institutionDisplay,
  }
}

/** Fail-closed adapter for the committed Backend owner-read result envelope. */
export const readAppointmentOwnerReadResultV1 = (
  value: unknown,
): AppointmentOwnerReadProviderResultV1 => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'authResolution', 'availability', 'items',
  ]) || value.contractVersion !== APPOINTMENT_OWNER_READ_CONTRACT_VERSION_V1
    || value.kind !== APPOINTMENT_OWNER_READ_RESULT_KIND_V1
    || typeof value.authResolution !== 'string'
    || !AUTH_RESOLUTIONS.includes(value.authResolution)) return { kind: 'technical_failure' }

  if (value.authResolution !== 'authenticated') {
    if (value.availability !== null || value.items !== null) return { kind: 'technical_failure' }
    if (['missing', 'expired', 'invalid'].includes(value.authResolution)) return { kind: 'auth_required' }
    return value.authResolution === 'unavailable' ? { kind: 'unavailable' } : { kind: 'technical_failure' }
  }

  if (value.availability === 'unavailable' && value.items === null) return { kind: 'unavailable' }
  if (value.availability === 'technical_failure' && value.items === null) return { kind: 'technical_failure' }
  if (value.availability !== 'ready' || !Array.isArray(value.items)) return { kind: 'technical_failure' }

  const visits: AppointmentOwnerReadVisitV1[] = []
  for (const item of value.items) {
    const visit = parseVisit(item)
    if (!visit) return { kind: 'technical_failure' }
    visits.push(visit)
  }
  return { kind: 'ready', visits }
}

const loadOwnedVisits = async (
  transport: AppointmentOwnerReadTransportV1,
  sessionClient: ReturnType<typeof createC5AuthenticatedBackendSessionClientV1>,
): Promise<AppointmentOwnerReadProviderResultV1> => {
  const origin = sessionClient.resolveBackendOrigin()
  if (origin.length === 0) return { kind: 'unavailable' }

  const sessionResult = await sessionClient.acquireSession(origin)
  if (sessionResult.kind === 'unavailable') return { kind: 'unavailable' }
  if (sessionResult.kind !== 'authenticated') return { kind: 'technical_failure' }

  let response: { statusCode: number; data: unknown }
  try {
    response = await transport.request({
      url: `${origin}${VISITS_ENDPOINT}`,
      method: 'GET',
      timeout: REQUEST_TIMEOUT_MS,
      header: {
        Accept: 'application/json',
        'X-Auth-Evidence': sessionResult.session.evidence,
      },
    })
  } catch (_error) {
    return { kind: 'technical_failure' }
  }
  if (response.statusCode !== 200) return { kind: 'technical_failure' }

  if (isRecord(response.data)
    && ['missing', 'expired', 'invalid'].includes(String(response.data.authResolution))) {
    sessionClient.clearSession()
  }
  return readAppointmentOwnerReadResultV1(response.data)
}

export const createProductionAppointmentOwnerReadProviderV1 = (
  transport: AppointmentOwnerReadTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): AppointmentOwnerReadProviderV1 => {
  const sessionClient = createC5AuthenticatedBackendSessionClientV1(transport)
  let inFlight: Promise<AppointmentOwnerReadProviderResultV1> | null = null

  return {
    loadOwnedVisits(): Promise<AppointmentOwnerReadProviderResultV1> {
      if (inFlight) return inFlight
      const currentRequest = loadOwnedVisits(transport, sessionClient)
      inFlight = currentRequest.then((result) => {
        inFlight = null
        return result
      }, () => {
        inFlight = null
        return { kind: 'technical_failure' }
      })
      return inFlight
    },
  }
}
