import { recoveryUuid } from './history-save-recovery'
import type { HistoryRecoveryStorage } from './history-save-recovery'

export const HISTORY_SESSION_STORAGE_KEY = '__test_only_history_session_v1'
export interface HistorySessionBinding {
  version: 1; origin: string; scopeId: string; sessionId: string; draftContext: string
  state: 'active' | 'switch_requested' | 'switch_prepared'; nextSessionId?: string; nextDraftContext?: string
}
export const readHistorySession = (storage: HistoryRecoveryStorage): HistorySessionBinding | null => {
  const raw = storage.read(HISTORY_SESSION_STORAGE_KEY)
  if (raw === '' || raw === null || raw === undefined) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Session metadata unavailable')
  const r = raw as Record<string, unknown>, switching = r.state !== 'active', prepared = r.state === 'switch_prepared'
  const keys = ['version','origin','scopeId','sessionId','draftContext','state', ...(switching ? ['nextDraftContext'] : []), ...(prepared ? ['nextSessionId'] : [])]
  if (Object.keys(r).sort().join('|') !== keys.sort().join('|') || r.version !== 1 || typeof r.origin !== 'string' || r.origin.length > 300
    || !recoveryUuid(r.scopeId) || !recoveryUuid(r.sessionId) || typeof r.draftContext !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(r.draftContext)
    || !['active','switch_requested','switch_prepared'].includes(String(r.state)) || (prepared && (!recoveryUuid(r.nextSessionId) || r.nextSessionId === r.sessionId))
    || (switching && (typeof r.nextDraftContext !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(r.nextDraftContext) || r.nextDraftContext === r.draftContext)))
    throw new Error('Session metadata unavailable')
  return { ...r } as unknown as HistorySessionBinding
}
export const persistHistorySession = (storage: HistoryRecoveryStorage, value: HistorySessionBinding): void => {
  storage.write(HISTORY_SESSION_STORAGE_KEY, { ...value })
  const read = readHistorySession(storage)
  if (!read || Object.keys(value).some(key => read[key as keyof HistorySessionBinding] !== value[key as keyof HistorySessionBinding])) throw new Error('Session metadata read-back failed')
}
