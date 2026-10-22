import { createCompletedAssessmentUserLoopV1 } from '../../services/completed-assessment-user-loop'
import type { HistoryDraftPort, HistorySaveConfirmation } from '../../services/completed-assessment-user-loop'
import { navigateToWithGuard } from '../../utils/navigation-guard'
import { historicalRecommendationViewV1 } from '../../domain/assessment-history/recommendation-view'

declare function require(path: string): { assessmentDraftStore: HistoryDraftPort }
interface Page { setData(patch: Record<string, unknown>): void }
interface Context {
  active: boolean
  approved: boolean
  generation: number
  scroll: number
  listScroll: number
  detailId: string
  busy: boolean
  detailPending: boolean
  recommendationPending: boolean
  recoveryPending: boolean
  confirmationPending: boolean
  saveConfirmation?: HistorySaveConfirmation
  savePreparing: boolean
  client: ReturnType<typeof createCompletedAssessmentUserLoopV1>
}
const contexts = new WeakMap<object, Context>()
export const historyLoopData = {
  userLoopEnabled: false, loopSavePending: false, loopSaveMessage: '', loopConflict: false,
  loopSavePreparing: false, loopSaveConfirmVisible: false, loopSaveConfirmMessage: '',
  loopRecoveryPending: false, loopRecoveredId: '',
  loopNewSessionConfirm: false, loopDraftState: '',
  loopDetailVisible: false, loopDetailPending: false, loopDetailMessage: '', loopDetailTime: '',
  loopProfileAvailable: false, loopProfileRows: [] as Array<{ label: string; value: string }>,
  loopDetailVersion: '', loopReassessmentPending: false,
  loopRecommendationVisible: false, loopRecommendationPending: false, loopRecommendationState: '',
  loopRecommendationMessage: '', loopRecommendationTitle: '', loopRecommendationVersion: '',
  loopRecommendationCards: [] as Array<{ key: string; order: string; name: string; region: string; version: string; reasons: string[]; differences: string[] }>,
  loopRecommendationGaps: [] as string[],
}
export const activateHistoryUserLoop = (page: Page): void => {
  let context = contexts.get(page)
  if (!context) {
    context = { active: true, approved: false, generation: 0, scroll: 0, listScroll: 0, detailId: '', busy: false, detailPending: false, recommendationPending: false, recoveryPending: false, confirmationPending: false, savePreparing: false,
      // Dynamic import is not executed in ordinary History reads, only after an approved explicit action.
      client: createCompletedAssessmentUserLoopV1(() => require('../../store/assessment-draft').assessmentDraftStore) }
    contexts.set(page, context)
  }
  context.active = true
  context.approved = false
  context.confirmationPending = false
  context.saveConfirmation = undefined
  context.client.cancelSaveConfirmation()
  context.detailId = ''
  context.detailPending = false
  context.recommendationPending = false
  context.generation += 1
  page.setData({ ...historyLoopData, loopSavePending: context.client.isSaving(), loopSaveMessage: context.client.feedback() })
}
export const hideHistoryUserLoop = (page: Page, detached = false): void => {
  const context = contexts.get(page)
  if (context) { context.active = false; context.confirmationPending = false; context.saveConfirmation = undefined; context.client.cancelSaveConfirmation(); context.generation += 1 }
  if (detached) contexts.delete(page)
}
export const refreshHistoryUserLoop = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if (!c || !c.active) return
  const generation = c.generation
  const approved = await c.client.capability()
  if (!c.active || c.generation !== generation) return
  c.approved = approved
  page.setData({ userLoopEnabled: approved, loopSavePending: c.client.isSaving(), loopSaveMessage: c.client.feedback() })
  if (approved) await reconcileHistorySave(page)
}
export const reconcileHistorySave = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if ((!c || !c.active) || !c.approved || c.client.isSaving() || c.recoveryPending) return
  c.recoveryPending = true
  const generation = c.generation
  page.setData({ loopRecoveryPending: true, loopRecoveredId: '' })
  const result = await c.client.recoverPending()
  c.recoveryPending = false
  // Release the visual pending flag even when navigation invalidates the result payload.
  if (c.active && contexts.get(page) === c) page.setData({ loopRecoveryPending: false })
  if (!c.active || c.generation !== generation) return
  page.setData({ loopRecoveryPending: false, ...(result ? { loopSaveMessage: result.message,
    loopRecoveredId: result.state === 'SUCCESS' ? result.item.id : '' } : {}) })
}
export const viewRecoveredHistorySave = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if ((!c || !c.active) || !c.approved) return
  const generation = c.generation
  const result = await c.client.recoverPending()
  if (!c.active || c.generation !== generation || contexts.get(page) !== c) return
  if (result && result.state === 'SUCCESS') await selectHistoryResult(page, result.item.id)
  else if (result) page.setData({ loopSaveMessage: result.message, loopRecoveredId: '' })
}
export const requestHistorySaveConfirmation = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if (!c || !c.active || !c.approved || c.client.isSaving() || c.recoveryPending || c.busy || c.savePreparing || c.saveConfirmation) return
  const generation = c.generation
  c.savePreparing = true
  c.confirmationPending = false
  page.setData({ loopNewSessionConfirm: false, loopSavePreparing: true })
  const result = await c.client.requestSaveConfirmation()
  c.savePreparing = false
  if (c.active && contexts.get(page) === c) page.setData({ loopSavePreparing: false })
  if (!c.active || c.generation !== generation || contexts.get(page) !== c) return
  page.setData({ loopSavePreparing: false })
  if (result.state === 'CONFIRM') {
    c.saveConfirmation = result.confirmation
    page.setData({ loopSaveConfirmVisible: true, loopSaveConfirmMessage: result.confirmation.message })
  } else page.setData({ loopSaveMessage: result.message })
}
export const cancelHistorySaveConfirmation = (page: Page): void => {
  const c = contexts.get(page)
  if (!c || !c.active || c.client.isSaving()) return
  c.saveConfirmation = undefined; c.client.cancelSaveConfirmation()
  page.setData({ loopSaveConfirmVisible: false, loopSaveConfirmMessage: '', loopSaveMessage: '已取消保存，未创建保存意图或提交问卷；草稿保持不变。' })
}
export const saveHistoryCurrentAssessment = async (page: Page, refresh: () => void): Promise<void> => {
  const c = contexts.get(page)
  if (!c || !c.active || !c.approved || !c.saveConfirmation || c.client.isSaving() || c.recoveryPending || c.busy) return
  const confirmation = c.saveConfirmation, generation = c.generation
  c.saveConfirmation = undefined
  page.setData({ loopSaveConfirmVisible: false, loopSaveConfirmMessage: '' })
  page.setData({ loopSavePending: true, loopSaveMessage: '正在保存，收到服务器回执前尚未确认成功。' })
  const result = await c.client.saveCurrent(confirmation)
  if (c.active && contexts.get(page) === c) page.setData({ loopSavePending: false })
  if (!c.active || c.generation !== generation || contexts.get(page) !== c) return
  page.setData({ loopSavePending: false, loopSaveMessage: result.message })
  if (result.state === 'SUCCESS') refresh()
}
export const selectHistoryResult = async (page: Page, id: unknown): Promise<boolean> => {
  const c = contexts.get(page)
  if (!c || !c.active || !c.approved || typeof id !== 'string') return false
  c.saveConfirmation = undefined; c.client.cancelSaveConfirmation()
  if (!c.detailId) c.listScroll = c.scroll
  c.detailId = id
  c.detailPending = true
  c.recommendationPending = false
  const generation = ++c.generation
  page.setData({ loopSaveConfirmVisible: false, loopDetailVisible: true, loopDetailPending: true, loopDetailMessage: '', loopProfileAvailable: false,
    loopProfileRows: [], loopDetailTime: '', loopDetailVersion: '', loopRecommendationVisible: false, loopRecommendationPending: false })
  wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  const result = await c.client.readDetail(id)
  if (!c.active || c.generation !== generation) return true
  c.detailPending = false
  if (result.state === 'ERROR') page.setData({ loopDetailPending: false, loopDetailMessage: result.message })
  else page.setData({ loopDetailPending: false, loopDetailTime: result.item.completedAt,
    loopDetailVersion: `Assessment Schema ${result.item.schemaVersion}`,
    loopProfileAvailable: result.profile !== null, loopProfileRows: result.profile ? result.profile.rows : [],
    loopDetailMessage: result.profile ? '以下内容来自当次保存的不可变画像展示快照。' : '这条旧记录未保存画像展示快照，历史画像暂不可用；原记录保持不变。' })
  return true
}
export const retryHistoryResult = (page: Page): void => {
  const c = contexts.get(page)
  if (c && c.detailId && c.active) void selectHistoryResult(page, c.detailId)
}
export const returnHistoryList = (page: Page): void => {
  const c = contexts.get(page)
  if (!c) return
  c.generation += 1
  c.detailId = ''
  c.detailPending = false
  c.recommendationPending = false
  page.setData({ loopDetailVisible: false, loopDetailPending: false, loopRecommendationVisible: false, loopRecommendationPending: false })
  wx.pageScrollTo({ scrollTop: c.listScroll, duration: 0 })
}
export const readHistoryRecommendation = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if ((!c || !c.active) || !c.approved || !c.detailId || c.detailPending || c.recommendationPending) return
  c.recommendationPending = true
  const generation = ++c.generation
  page.setData({ loopRecommendationVisible: true, loopRecommendationPending: true, loopRecommendationState: 'LOADING',
    loopRecommendationMessage: '正在读取当次历史推荐快照…', loopRecommendationCards: [], loopRecommendationGaps: [],
    loopRecommendationTitle: '', loopRecommendationVersion: '' })
  const result = await c.client.readRecommendation(c.detailId)
  if (!c.active || c.generation !== generation) return
  c.recommendationPending = false
  if (result.state !== 'READY') page.setData({ loopRecommendationPending: false, loopRecommendationState: result.state, loopRecommendationMessage: result.message })
  else {
    const view = historicalRecommendationViewV1(result.display)
    page.setData({ loopRecommendationPending: false, loopRecommendationState: 'READY', loopRecommendationTitle: view.title,
      loopRecommendationMessage: view.note, loopRecommendationVersion: view.version, loopRecommendationCards: view.cards, loopRecommendationGaps: view.gaps })
  }
}
export const returnHistoryProfile = (page: Page): void => {
  const c = contexts.get(page)
  if ((!c || !c.active)) return
  c.generation += 1
  c.recommendationPending = false
  page.setData({ loopRecommendationVisible: false, loopRecommendationPending: false })
}
export const recordHistoryScroll = (page: Page, scrollTop: number): void => {
  const c = contexts.get(page)
  if (c && Number.isFinite(scrollTop)) c.scroll = scrollTop
}
export const beginHistoryReassessment = async (page: Page): Promise<boolean> => {
  const c = contexts.get(page)
  if (!c || !c.active || !c.approved) return false
  if (c.busy || c.savePreparing || c.saveConfirmation || c.client.isSaving() || c.recoveryPending) return true
  c.busy = true
  const generation = c.generation
  page.setData({ loopReassessmentPending: true })
  const result = await c.client.reassessment()
  c.busy = false
  if (c.active && contexts.get(page) === c) page.setData({ loopReassessmentPending: false })
  if (!c.active || c.generation !== generation) return true
  page.setData({ loopReassessmentPending: false, loopConflict: result.state === 'CONFLICT', actionMessage: result.message })
  c.confirmationPending = result.state === 'CONFIRM_REQUIRED'
  page.setData({ loopNewSessionConfirm: c.confirmationPending })
  if (result.state === 'EMPTY_CONTEXT') navigateToWithGuard(page, 'history.safeReassessment', '/pages/assessment/intro', undefined,
    () => page.setData({ actionMessage: '暂时无法打开评估说明，当前空草稿保持不变。' }))
  return true
}
export const confirmHistoryNewSession = async (page: Page): Promise<void> => {
  const c = contexts.get(page)
  if ((!c || !c.active) || !c.approved || !c.confirmationPending || c.busy || c.client.isSaving() || c.recoveryPending) return
  c.confirmationPending = false
  c.busy = true
  const generation = c.generation
  page.setData({ loopNewSessionConfirm: false, loopReassessmentPending: true })
  const result = await c.client.confirmNewSession()
  c.busy = false
  if (!c.active || c.generation !== generation) return
  page.setData({ loopReassessmentPending: false, loopConflict: result.state === 'CONFLICT', actionMessage: result.message })
  if (result.state === 'EMPTY_CONTEXT') navigateToWithGuard(page, 'history.confirmedNewSession', '/pages/assessment/intro', undefined,
    () => page.setData({ actionMessage: '新空白会话已保留，暂时无法打开评估说明。' }))
}
export const cancelHistoryNewSession = (page: Page): void => {
  const c = contexts.get(page)
  if (c && c.active && !c.busy) { c.confirmationPending = false; page.setData({ loopNewSessionConfirm: false, actionMessage: '已取消新评估，当前草稿和历史保持不变。' }) }
}
export const preserveHistoryDraft = (page: Page, continueDraft: boolean): void => {
  const c = contexts.get(page)
  if ((!c || !c.active) || !c.approved) return
  page.setData({ loopConflict: false, actionMessage: '已保留当前草稿，没有创建或删除任何评估。' })
  if (continueDraft) navigateToWithGuard(page, 'history.continueDraft', '/pages/assessment/intro', undefined,
    () => page.setData({ actionMessage: '暂时无法打开评估说明，草稿仍保留。' }))
}
