import { institutionDetailApplicationV12 } from '../../services/institution-list-detail-page'
import { directoryPhone, directorySnapshotMatches } from './directory-presentation'
import type { InstitutionListItemViewModel } from './list-view-model'

// One pending native action per page, including across cards and hide/show.
const states = new WeakMap<object, { epoch: number; active: boolean; pending: { native: boolean } | null }>()
const stateFor = (page: object) => {
  let state = states.get(page)
  if (!state) { state = { epoch: 0, active: true, pending: null }; states.set(page, state) }
  return state
}
export const invalidateDirectoryCall = (page: object, active?: boolean) => {
  const state = stateFor(page)
  state.epoch += 1
  if (state.pending && !state.pending.native) state.pending = null
  if (active !== undefined) state.active = active
}

export const callDirectoryPhone = async (page: object, key: string,
  readItems: () => readonly InstitutionListItemViewModel[], feedback: (message: string) => void): Promise<void> => {
  const state = stateFor(page)
  const item = readItems().find(row => row.key === key)
  if (!state.active || state.pending || !item || !item.card.compact
    || item.navigationIntent.source !== 'direct_list' || item.navigationIntent.sourceContextRef) return
  if (item.card.isDemo) { feedback('TEST ONLY：模拟拨号，不会拨打真实电话。'); return }
  if (!item.card.phoneKey) return
  const token = { native: false }
  state.pending = token
  const epoch = state.epoch
  const current = () => state.active && state.epoch === epoch && readItems().some(row => row === item)
  let finished = false, succeeded = false
  const release = () => { if (state.pending === token) state.pending = null }
  const fail = () => {
    release()
    if (!finished && current()) feedback('拨号未完成或已取消，请重试。')
    finished = true
  }
  try {
    feedback('')
    const evaluationAsOf = new Date().toISOString()
    const result = await institutionDetailApplicationV12.build({
      identity: { institutionId: item.institutionId, recordRevision: item.recordRevision },
      source: 'direct', sourceContextRef: null, evaluationAsOf,
    })
    if (!current()) return
    const phone = result.ok && directorySnapshotMatches(result.value, item, evaluationAsOf)
      ? directoryPhone(result.value) : undefined
    if (!phone || phone.key !== item.card.phoneKey || !phone.callAction.available) {
      feedback('当前官方电话不可拨，请查看详情核实。'); return
    }
    token.native = true
    wx.makePhoneCall({ phoneNumber: phone.callAction.dialValue,
      success: () => { succeeded = true }, fail,
      complete: () => { if (!succeeded) fail(); finished = true; release() } })
  } catch (_error) { fail() }
  finally { if (!token.native) release() }
}
