/** TEST_ONLY recovery metadata. Never store answers, payload hashes, results or credentials. */
export interface HistoryRecoveryRecord {
  version: 1; origin: string; scopeId: string; intentId: string; createdAt: string
  draftContext: string; state: 'pending' | 'confirmed'
}
export interface HistoryRecoveryStorage { read(key: string): unknown; write(key: string, value: unknown): void }
export const HISTORY_RECOVERY_STORAGE_KEY = '__test_only_history_save_recovery_v1'
export const defaultHistoryRecoveryStorage = (): HistoryRecoveryStorage => ({
  read: key => wx.getStorageSync(key), write: (key, value) => wx.setStorageSync(key, value),
})
export const recoveryUuid = (v: unknown): v is string => typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)
export const readHistoryRecovery = (storage: HistoryRecoveryStorage): HistoryRecoveryRecord | null => {
  const v = storage.read(HISTORY_RECOVERY_STORAGE_KEY)
  if (v === '' || v === null || v === undefined) return null
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('Recovery metadata unavailable')
  const r = v as Record<string, unknown>
  if (Object.keys(r).sort().join('|') !== ['version', 'origin', 'scopeId', 'intentId', 'createdAt', 'draftContext', 'state'].sort().join('|')
    || r.version !== 1 || typeof r.origin !== 'string' || r.origin.length > 300 || !recoveryUuid(r.scopeId) || !recoveryUuid(r.intentId)
    || typeof r.createdAt !== 'string' || r.createdAt.length > 40 || !Number.isFinite(Date.parse(r.createdAt))
    || typeof r.draftContext !== 'string' || !r.draftContext || r.draftContext.length > 100 || !['pending', 'confirmed'].includes(String(r.state)))
    throw new Error('Recovery metadata unavailable')
  return { ...r } as unknown as HistoryRecoveryRecord
}
export const persistHistoryRecovery = (storage: HistoryRecoveryStorage, record: HistoryRecoveryRecord): void => {
  storage.write(HISTORY_RECOVERY_STORAGE_KEY, { ...record })
  const saved = readHistoryRecovery(storage)
  if (JSON.stringify(saved) !== JSON.stringify(record)) throw new Error('Recovery metadata read-back failed')
}
