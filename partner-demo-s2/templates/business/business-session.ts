import type {
  AppointmentCreateReceiptV1,
  AppointmentCreateSuccessHandoffV1,
  AppointmentCreateSubmittedSummaryV1,
} from '../types/appointment-create-v1'
import type { AppointmentOwnerReadVisitStatusV1, AppointmentOwnerReadVisitV1 } from '../types/appointment-owner-read-v1'

export const PARTNER_DEMO_BUSINESS_PROVENANCE = 'DEMO_ONLY' as const
export const PARTNER_DEMO_EVALUATION_PROVENANCE = 'TEST_ONLY' as const
export const PARTNER_DEMO_OWNER_ID = 'synthetic-demo-owner'

export type DemoVisitStatusV1 = AppointmentOwnerReadVisitStatusV1

export interface DemoAppointmentInputV1 {
  intentId: string
  fingerprint: string
  institutionId: string
  institutionRecordRevision: string
  institutionName: string
  visitDate: string
  visitTimePreference: string
  participantCount: number
  pickupRequested?: boolean
}

export interface DemoVisitRecordV1 extends AppointmentOwnerReadVisitV1 {
  provenance: typeof PARTNER_DEMO_BUSINESS_PROVENANCE
  institutionId: string
  institutionRecordRevision: string
  acceptedAt: string
}

export type DemoAppointmentCreateResultV1 =
  | { kind: 'accepted'; visit: DemoVisitRecordV1; replayed: boolean }
  | { kind: 'rejected'; code: 'IDEMPOTENCY_CONFLICT' | 'REFERENCE_UNAVAILABLE' }

export type DemoVisitStatusAdvanceResultV1 =
  | { kind: 'advanced'; visit: DemoVisitRecordV1 }
  | { kind: 'already_completed'; visit: DemoVisitRecordV1 }
  | { kind: 'cancelled'; visit: DemoVisitRecordV1 }
  | { kind: 'not_found' }

export interface DemoEvaluationContextV1 {
  provenance: 'TEST_ONLY'
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  ownerUserId: typeof PARTNER_DEMO_OWNER_ID
  visitStatus: 'completed'
}

export interface DemoEvaluationSubmissionV1 {
  provenance: 'TEST_ONLY'
  context: DemoEvaluationContextV1
  draft: unknown
}

export interface DemoBusinessSessionV1 {
  createAppointment(input: DemoAppointmentInputV1): DemoAppointmentCreateResultV1
  listVisits(): readonly DemoVisitRecordV1[]
  readVisit(visitId: string): DemoVisitRecordV1 | null
  advanceVisitStatus(visitId: string): DemoVisitStatusAdvanceResultV1
  loadEvaluationContext(visitId: string): DemoEvaluationContextV1 | null
  submitEvaluation(input: DemoEvaluationSubmissionV1): { outcome: 'submitted' | 'already_submitted' | 'provider_failed'; provenance: 'TEST_ONLY' }
  createAppointmentIntent(): string
  createSuccessHandoff(receipt: AppointmentCreateReceiptV1, summary: AppointmentCreateSubmittedSummaryV1): { id: string; handoff: AppointmentCreateSuccessHandoffV1 }
  consumeSuccessHandoff(id: unknown): AppointmentCreateSuccessHandoffV1 | null
  discardSuccessHandoff(id: string): void
  recordInstitutionDisplaySnapshot(institutionId: string, revision: number, displayName: string): void
  consumeInstitutionDisplaySnapshot(institutionId: string, revision: number): string | null
  discardInstitutionDisplaySnapshot(institutionId: string, revision: number): void
  reset(): void
}

const STATUSES: readonly DemoVisitStatusV1[] = ['requested', 'contacting', 'scheduled', 'completed', 'cancelled']
const NEXT_STATUS: Partial<Record<DemoVisitStatusV1, DemoVisitStatusV1>> = {
  requested: 'contacting',
  contacting: 'scheduled',
  scheduled: 'completed',
}

const isSafeIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= 200
  && !/[\u0000-\u001f\u007f]/.test(value)

const isSyntheticInstitution = (input: DemoAppointmentInputV1): boolean =>
  /^s2a-synth-(alpha|beta|gamma)$/.test(input.institutionId)
  && /^[1-9]\d*$/.test(input.institutionRecordRevision)
  && Number.isSafeInteger(Number(input.institutionRecordRevision))
  && input.institutionName.includes('虚构示例机构')
  && input.institutionName.includes('TEST ONLY')

const asIsoTime = (now: () => string): string => {
  const value = now()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '2026-09-13T08:00:00.000Z'
  return date.toISOString()
}

const intentFingerprintKey = (intentId: string): string => intentId
const institutionSnapshotKey = (institutionId: string, revision: number): string => `${institutionId}\u0000${revision}`
const leftPad = (value: string, width: number): string => (`0000000000${value}`).slice(-width)

export const createDemoBusinessSession = (
  options: { now?: () => string } = {},
): DemoBusinessSessionV1 => {
  const now = options.now || (() => new Date().toISOString())
  let visitSequence = 0
  let intentSequence = 0
  let handoffSequence = 0
  let sessionEpoch = 0
  const visits = new Map<string, DemoVisitRecordV1>()
  const intents = new Map<string, { fingerprint: string; visitId: string }>()
  const evaluations = new Map<string, string>()
  const handoffs = new Map<string, AppointmentCreateSuccessHandoffV1>()
  const institutionSnapshots = new Map<string, string>()

  const cloneVisit = (visit: DemoVisitRecordV1): DemoVisitRecordV1 => ({
    ...visit,
    institutionDisplay: { ...visit.institutionDisplay },
  })

  return {
    createAppointment(input): DemoAppointmentCreateResultV1 {
      if (!input || !isSafeIdentifier(input.intentId) || !isSafeIdentifier(input.fingerprint)
        || input.intentId.indexOf(`demo-intent-${sessionEpoch.toString(36)}-`) !== 0
        || !isSyntheticInstitution(input)
        || !/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)
        || !isSafeIdentifier(input.visitTimePreference)
        || !Number.isInteger(input.participantCount) || input.participantCount < 1 || input.participantCount > 1000
        || (input.pickupRequested !== undefined && typeof input.pickupRequested !== 'boolean')) {
        return { kind: 'rejected', code: 'REFERENCE_UNAVAILABLE' }
      }
      const prior = intents.get(intentFingerprintKey(input.intentId))
      if (prior) {
        if (prior.fingerprint !== input.fingerprint) return { kind: 'rejected', code: 'IDEMPOTENCY_CONFLICT' }
        const replay = visits.get(prior.visitId)
        return replay ? { kind: 'accepted', visit: cloneVisit(replay), replayed: true }
          : { kind: 'rejected', code: 'REFERENCE_UNAVAILABLE' }
      }

      visitSequence += 1
      const visitId = `demo-visit-${sessionEpoch.toString(36)}-${leftPad(visitSequence.toString(36), 4)}`
      const visit: DemoVisitRecordV1 = {
        provenance: PARTNER_DEMO_BUSINESS_PROVENANCE,
        visitId,
        institutionId: input.institutionId,
        institutionRecordRevision: input.institutionRecordRevision,
        visitStatus: 'requested',
        visitDate: input.visitDate,
        visitTimePreference: input.visitTimePreference,
        participantCount: input.participantCount,
        ...(input.pickupRequested === undefined ? {} : { pickupRequested: input.pickupRequested }),
        institutionDisplay: { availability: 'ready', name: input.institutionName },
        acceptedAt: asIsoTime(now),
      }
      visits.set(visitId, visit)
      intents.set(intentFingerprintKey(input.intentId), { fingerprint: input.fingerprint, visitId })
      return { kind: 'accepted', visit: cloneVisit(visit), replayed: false }
    },

    listVisits(): readonly DemoVisitRecordV1[] {
      return [...visits.values()].map(cloneVisit)
    },

    readVisit(visitId: string): DemoVisitRecordV1 | null {
      const visit = visits.get(visitId)
      return visit ? cloneVisit(visit) : null
    },

    advanceVisitStatus(visitId: string): DemoVisitStatusAdvanceResultV1 {
      const visit = visits.get(visitId)
      if (!visit) return { kind: 'not_found' }
      if (visit.visitStatus === 'cancelled') return { kind: 'cancelled', visit: cloneVisit(visit) }
      if (visit.visitStatus === 'completed') return { kind: 'already_completed', visit: cloneVisit(visit) }
      const next = NEXT_STATUS[visit.visitStatus]
      if (!next || STATUSES.indexOf(next) < 0) return { kind: 'already_completed', visit: cloneVisit(visit) }
      visit.visitStatus = next
      return { kind: 'advanced', visit: cloneVisit(visit) }
    },

    loadEvaluationContext(visitId: string): DemoEvaluationContextV1 | null {
      const visit = visits.get(visitId)
      if (!visit || visit.visitStatus !== 'completed') return null
      return {
        provenance: PARTNER_DEMO_EVALUATION_PROVENANCE,
        visitId: visit.visitId,
        institutionId: visit.institutionId,
        institutionRecordRevision: visit.institutionRecordRevision,
        ownerUserId: PARTNER_DEMO_OWNER_ID,
        visitStatus: 'completed',
      }
    },

    submitEvaluation(input): { outcome: 'submitted' | 'already_submitted' | 'provider_failed'; provenance: 'TEST_ONLY' } {
      if (!input || input.provenance !== PARTNER_DEMO_EVALUATION_PROVENANCE
        || !input.context || input.context.provenance !== PARTNER_DEMO_EVALUATION_PROVENANCE
        || input.context.ownerUserId !== PARTNER_DEMO_OWNER_ID
        || input.context.visitStatus !== 'completed') {
        return { outcome: 'provider_failed', provenance: PARTNER_DEMO_EVALUATION_PROVENANCE }
      }
      const visit = visits.get(input.context.visitId)
      if (!visit || visit.visitStatus !== 'completed'
        || visit.institutionId !== input.context.institutionId
        || visit.institutionRecordRevision !== input.context.institutionRecordRevision) {
        return { outcome: 'provider_failed', provenance: PARTNER_DEMO_EVALUATION_PROVENANCE }
      }
      const fingerprint = stableEvaluationFingerprint(input.draft)
      if (!fingerprint) return { outcome: 'provider_failed', provenance: PARTNER_DEMO_EVALUATION_PROVENANCE }
      const priorFingerprint = evaluations.get(visit.visitId)
      if (priorFingerprint) {
        return {
          outcome: priorFingerprint === fingerprint ? 'submitted' : 'already_submitted',
          provenance: PARTNER_DEMO_EVALUATION_PROVENANCE,
        }
      }
      evaluations.set(visit.visitId, fingerprint)
      return { outcome: 'submitted', provenance: PARTNER_DEMO_EVALUATION_PROVENANCE }
    },

    createAppointmentIntent(): string {
      intentSequence += 1
      return `demo-intent-${sessionEpoch.toString(36)}-${intentSequence.toString(36)}`
    },

    createSuccessHandoff(receipt, summary): { id: string; handoff: AppointmentCreateSuccessHandoffV1 } {
      handoffSequence += 1
      const id = `demo-appointment-result-${sessionEpoch.toString(36)}-${handoffSequence.toString(36)}`
      const handoff = {
        receipt: { ...receipt },
        summary: { ...summary },
      }
      handoffs.set(id, handoff)
      return { id, handoff: { receipt: { ...handoff.receipt }, summary: { ...handoff.summary } } }
    },

    consumeSuccessHandoff(id): AppointmentCreateSuccessHandoffV1 | null {
      if (!isSafeIdentifier(id)) return null
      const handoff = handoffs.get(id)
      if (!handoff) return null
      handoffs.delete(id)
      return { receipt: { ...handoff.receipt }, summary: { ...handoff.summary } }
    },

    discardSuccessHandoff(id): void {
      handoffs.delete(id)
    },

    recordInstitutionDisplaySnapshot(institutionId, revision, displayName): void {
      if (!isSyntheticInstitution({
        institutionId,
        institutionRecordRevision: String(revision),
        institutionName: displayName,
        intentId: 'snapshot',
        fingerprint: 'snapshot',
        visitDate: '2026-09-13',
        visitTimePreference: 'snapshot',
        participantCount: 1,
      }) || !Number.isSafeInteger(revision) || revision <= 0) return
      institutionSnapshots.set(institutionSnapshotKey(institutionId, revision), displayName)
    },

    consumeInstitutionDisplaySnapshot(institutionId, revision): string | null {
      const key = institutionSnapshotKey(institutionId, revision)
      const value = institutionSnapshots.get(key)
      if (value) institutionSnapshots.delete(key)
      return value || null
    },

    discardInstitutionDisplaySnapshot(institutionId, revision): void {
      institutionSnapshots.delete(institutionSnapshotKey(institutionId, revision))
    },

    reset(): void {
      visits.clear()
      intents.clear()
      evaluations.clear()
      handoffs.clear()
      institutionSnapshots.clear()
      visitSequence = 0
      intentSequence = 0
      handoffSequence = 0
      sessionEpoch += 1
    },
  }
}

const stableEvaluationFingerprint = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const sorted = (item: unknown, parentKey = ''): unknown => {
    if (Array.isArray(item)) {
      const values = item.map((child) => sorted(child))
      return parentKey === 'likedTags' || parentKey === 'concernTags' || parentKey === 'handoverTopics'
        ? values.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
        : values
    }
    if (typeof item !== 'object' || item === null) return item
    const record = item as Record<string, unknown>
    const output: Record<string, unknown> = {}
    Object.keys(record).sort().forEach((key) => { output[key] = sorted(record[key], key) })
    return output
  }
  let canonical: string
  try {
    canonical = JSON.stringify(sorted(value))
  } catch (_error) {
    return null
  }
  let hash = 5381
  for (let index = 0; index < canonical.length; index += 1) hash = ((hash * 33) ^ canonical.charCodeAt(index)) >>> 0
  return `test-only-${leftPad(hash.toString(16), 8)}`
}

const defaultBusinessSession = createDemoBusinessSession()

export const createDemoAppointmentIntent = (): string => defaultBusinessSession.createAppointmentIntent()
export const createDemoAppointment = (input: DemoAppointmentInputV1): DemoAppointmentCreateResultV1 =>
  defaultBusinessSession.createAppointment(input)
export const listDemoVisits = (): readonly DemoVisitRecordV1[] => defaultBusinessSession.listVisits()
export const readDemoVisit = (visitId: string): DemoVisitRecordV1 | null => defaultBusinessSession.readVisit(visitId)
export const advanceDemoVisitStatus = (visitId: string): DemoVisitStatusAdvanceResultV1 =>
  defaultBusinessSession.advanceVisitStatus(visitId)
export const loadDemoEvaluationContext = (visitId: string): DemoEvaluationContextV1 | null =>
  defaultBusinessSession.loadEvaluationContext(visitId)
export const submitDemoEvaluation = (input: DemoEvaluationSubmissionV1) => defaultBusinessSession.submitEvaluation(input)
export const createDemoAppointmentSuccessHandoff = (
  receipt: AppointmentCreateReceiptV1,
  summary: AppointmentCreateSubmittedSummaryV1,
) => defaultBusinessSession.createSuccessHandoff(receipt, summary)
export const consumeDemoAppointmentSuccessHandoff = (id: unknown) => defaultBusinessSession.consumeSuccessHandoff(id)
export const discardDemoAppointmentSuccessHandoff = (id: string) => defaultBusinessSession.discardSuccessHandoff(id)
export const recordDemoInstitutionDisplaySnapshot = (institutionId: string, revision: number, displayName: string): void =>
  defaultBusinessSession.recordInstitutionDisplaySnapshot(institutionId, revision, displayName)
export const consumeDemoInstitutionDisplaySnapshot = (institutionId: string, revision: number): string | null =>
  defaultBusinessSession.consumeInstitutionDisplaySnapshot(institutionId, revision)
export const discardDemoInstitutionDisplaySnapshot = (institutionId: string, revision: number): void =>
  defaultBusinessSession.discardInstitutionDisplaySnapshot(institutionId, revision)
export const resetDemoBusinessSession = (): void => defaultBusinessSession.reset()

