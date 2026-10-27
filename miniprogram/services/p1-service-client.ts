import { EXPECTED_RECOMMENDATION_DATASET_MODE } from '../runtime/recommendation-mode'
import { createC5AuthenticatedBackendSessionClientV1, createDefaultWeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import type { WeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'

export const P1_VERSION = 'p1-service-request-v1'
export interface P1Input {
  requestId: string; inputVersion: string; kind: 'CONSULTATION' | 'VISIT_INTENT'
  institutionId: string | null; contactName: string; contactPhone: string
  relationship: 'SELF' | 'FAMILY' | 'OTHER'
  serviceScenario: 'LONG_TERM' | 'SHORT_STAY' | 'POST_OPERATION' | 'UNDECIDED'
  preferredWindow: string | null; partySize: number; assistanceNote: string | null
  consentVersion: string; consentAccepted: boolean
}
export interface P1Item extends Omit<P1Input, 'requestId' | 'inputVersion' | 'consentAccepted'> {
  id: string; institutionName: string | null
  status: 'PENDING_CONTACT' | 'FOLLOWING_UP' | 'PENDING_ARRANGEMENT' | 'CONFIRMED' | 'VISITED' | 'NO_SHOW' | 'CLOSED' | 'CANCELLED'
  createdAt: string; updatedAt: string; datasetMode: 'PRODUCTION' | 'SYNTHETIC_TEST_ONLY'
  source: string; assignedTo: string | null; scheduledStart: string | null; scheduledEnd: string | null
  canCancel: boolean; visits: P1Visit[]
}
export interface P1Visit {
  id: string; status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'ARRIVED' | 'NO_SHOW'
  institutionId: string; institutionName: string; start: string | null; end: string | null
  meetingNote: string | null; actualAt: string | null
}
export interface P1Config {
  enabled: boolean; datasetMode: 'PRODUCTION' | 'SYNTHETIC_TEST_ONLY'
  platformContact: { label: string; phone: string | null }
  notice: { version: string; text: string } | null
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const nullableText = (v: unknown): boolean => v === null || typeof v === 'string'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Unknown network data is validated here, before it reaches any page or click handler.
export function readP1Item(v: unknown, mode: string): P1Item {
  if (!record(v) || typeof v.id !== 'string' || !uuid.test(v.id) || v.datasetMode !== mode
    || !['CONSULTATION', 'VISIT_INTENT'].includes(String(v.kind))
    || !['PENDING_CONTACT', 'FOLLOWING_UP', 'PENDING_ARRANGEMENT', 'CONFIRMED', 'VISITED', 'NO_SHOW', 'CLOSED', 'CANCELLED'].includes(String(v.status))
    || (v.institutionId !== null && v.institutionId !== 'ningyue-yiyang-center')
    || !nullableText(v.institutionName) || !nullableText(v.preferredWindow) || !nullableText(v.assistanceNote)
    || !nullableText(v.assignedTo) || !nullableText(v.scheduledStart) || !nullableText(v.scheduledEnd)
    || typeof v.contactName !== 'string' || typeof v.contactPhone !== 'string'
    || typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt))
    || typeof v.updatedAt !== 'string' || !Number.isFinite(Date.parse(v.updatedAt))
    || !['SELF', 'FAMILY', 'OTHER'].includes(String(v.relationship))
    || !['LONG_TERM', 'SHORT_STAY', 'POST_OPERATION', 'UNDECIDED'].includes(String(v.serviceScenario))
    || !Number.isInteger(v.partySize) || Number(v.partySize) < 1 || Number(v.partySize) > 10
    || typeof v.consentVersion !== 'string' || v.source !== (mode === 'SYNTHETIC_TEST_ONLY' ? 'SYNTHETIC_TEST_ONLY' : 'MINIPROGRAM')) throw new Error('INVALID_RESPONSE')
  // V1 pending responses remain compatible; newer progress fields are validated as one boundary.
  if (v.visits !== undefined && (!Array.isArray(v.visits) || !v.visits.every(entry => {
    if (!record(entry) || typeof entry.id !== 'string' || !uuid.test(entry.id)
      || !['DRAFT', 'CONFIRMED', 'CANCELLED', 'ARRIVED', 'NO_SHOW'].includes(String(entry.status))
      || typeof entry.institutionName !== 'string'
      || !(entry.institutionId === 'ningyue-yiyang-center' || mode === 'SYNTHETIC_TEST_ONLY' && entry.institutionId === 'synthetic-reception-b')
      || !nullableText(entry.meetingNote) || !nullableText(entry.actualAt)) return false
    const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
    return (entry.status === 'DRAFT' ? entry.start === null && entry.end === null && entry.meetingNote === null
      : validDate(entry.start) && validDate(entry.end) && Date.parse(String(entry.start)) < Date.parse(String(entry.end)))
      && (entry.actualAt === null || validDate(entry.actualAt))
  }))) throw new Error('INVALID_RESPONSE')
  if (v.canCancel !== undefined && typeof v.canCancel !== 'boolean') throw new Error('INVALID_RESPONSE')
  const visits = (v.visits || []) as P1Visit[]
  if (['CONFIRMED', 'VISITED', 'NO_SHOW'].includes(String(v.status)) && !visits.length) throw new Error('INVALID_RESPONSE')
  return { ...v, visits, canCancel: v.canCancel === undefined ? v.status !== 'CANCELLED' && !visits.some(visit => visit.status === 'ARRIVED') : v.canCancel } as unknown as P1Item
}

// Fixed UTC+08 display only. UTC storage values are never rewritten by the view.
export function p1BeijingTime(value: string | null): string {
  if (!value) return '待确认'
  const time = new Date(Date.parse(value) + 8 * 3600000)
  if (!Number.isFinite(time.getTime())) return '时间暂不可用'
  const pad = (n: number) => n < 10 ? `0${n}` : String(n)
  return `${time.getUTCFullYear()}-${pad(time.getUTCMonth() + 1)}-${pad(time.getUTCDate())} ${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())}（北京时间）`
}

export const validateP1Input = (v: P1Input): string => {
  if (!v.contactName.trim() || v.contactName.trim().length > 40) return '请填写联系人称呼（不超过 40 字）'
  if (!/^1[3-9]\d{9}$/.test(v.contactPhone)) return '请填写有效的中国大陆手机号码'
  if (!Number.isInteger(v.partySize) || v.partySize < 1 || v.partySize > 10) return '参加人数请填写 1—10 人'
  if ((v.preferredWindow || '').length > 120 || (v.assistanceNote || '').length > 200) return '意向时间或协助说明过长'
  if (!v.consentAccepted || !v.consentVersion) return '请阅读并主动同意本次服务告知'
  return ''
}
export const newP1RequestId = (): string => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.floor(Math.random() * 16)
  return (c === 'x' ? r : (r & 3) | 8).toString(16)
})

export function createP1Client(transport: WeChatC5BackendTransportV1, expectedMode: string) {
  const sessions = createC5AuthenticatedBackendSessionClientV1(transport)
  let config: P1Config | null = null
  let configuredOrigin = ''
  const request = async (path: string, method: 'GET' | 'POST', body?: P1Input): Promise<Record<string, unknown>> => {
    if (expectedMode !== 'PRODUCTION' || !configuredOrigin || !config) throw new Error('UNAVAILABLE')
    if (sessions.resolveBackendOrigin() !== configuredOrigin) { config = null; sessions.clearSession(); throw new Error('UNAVAILABLE') }
    const auth = await sessions.acquireSession(configuredOrigin)
    if (auth.kind !== 'authenticated') throw new Error('AUTH_UNAVAILABLE')
    const response = await transport.request({ url: `${configuredOrigin}/api/v1/p1-service${path}`, method, timeout: 15000,
      header: { 'Content-Type': 'application/json', 'X-Auth-Evidence': auth.session.evidence },
      ...(body ? { data: { ...body } } : {}),
    })
    if (response.statusCode === 401) sessions.clearSession()
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP_${response.statusCode}`)
    if (!record(response.data) || response.data.contractVersion !== P1_VERSION) throw new Error('INVALID_RESPONSE')
    return response.data
  }
  return {
    async loadConfig(): Promise<P1Config | null> {
      config = null
      configuredOrigin = ''
      if (expectedMode !== 'PRODUCTION') return null // Demo never opens the real request channel.
      const origin = sessions.resolveBackendOrigin()
      if (!origin) return null
      const response = await transport.request({ url: `${origin}/api/v1/p1-service/config`, method: 'GET', timeout: 15000, header: { Accept: 'application/json' } })
      const v = response.data
      if (response.statusCode !== 200 || !record(v) || v.contractVersion !== P1_VERSION || typeof v.enabled !== 'boolean'
        || (v.datasetMode !== 'PRODUCTION' && !(v.datasetMode === 'SYNTHETIC_TEST_ONLY' && transport.environment() === 'develop'))
        || !record(v.platformContact) || typeof v.platformContact.label !== 'string'
        || !(v.platformContact.phone === null || (typeof v.platformContact.phone === 'string' && /^1[3-9]\d{9}$/.test(v.platformContact.phone)))
        || !(v.notice === null || (record(v.notice) && typeof v.notice.version === 'string' && typeof v.notice.text === 'string' && !!v.notice.version && !!v.notice.text))) throw new Error('INVALID_CONFIG')
      config = { enabled: v.enabled, datasetMode: v.datasetMode, platformContact: v.platformContact as P1Config['platformContact'], notice: v.notice as P1Config['notice'] }
      configuredOrigin = origin
      return config
    },
    async submit(input: P1Input): Promise<P1Item> {
      if (!config || !config.enabled || !config.notice || input.consentVersion !== config.notice.version) throw new Error('UNAVAILABLE')
      const error = validateP1Input(input)
      if (error) throw new Error(error)
      const response = await request('/requests', 'POST', input)
      const item = readP1Item(response.item, config.datasetMode)
      if (item.id !== input.requestId) throw new Error('INVALID_RESPONSE')
      return item
    },
    async list(): Promise<P1Item[]> {
      const response = await request('/requests', 'GET')
      if (!Array.isArray(response.items)) throw new Error('INVALID_RESPONSE')
      return response.items.map(v => readP1Item(v, config!.datasetMode))
    },
    async cancel(id: string): Promise<P1Item> {
      if (!uuid.test(id)) throw new Error('INVALID_ID')
      const response = await request(`/requests/${id}/cancel`, 'POST')
      const item = readP1Item(response.item, config!.datasetMode)
      if (item.id !== id || item.status !== 'CANCELLED') throw new Error('INVALID_RESPONSE')
      return item
    },
  }
}
export const p1Client = createP1Client(createDefaultWeChatC5BackendTransportV1(), EXPECTED_RECOMMENDATION_DATASET_MODE)
// Keep an uncertain submission in memory only; retry exactly this payload and ID, including after navigation.
export const p1Pending: { input: P1Input | null } = { input: null }
