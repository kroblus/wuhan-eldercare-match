import { createRouteScaffoldData } from '../../utils/route-scaffold'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
import { createHistoryViewModel, historyActionMessage } from './history-view-model'
import { createCompletedAssessmentHistoryClientV1 } from '../../services/completed-assessment-history'
import type { CompletedAssessmentHistoryClientV1 } from '../../services/completed-assessment-history'
import type { CompletedAssessmentHistoryMetadataV1 } from '../../types/completed-assessment-history'
import { activateHistoryUserLoop, beginHistoryReassessment, hideHistoryUserLoop, historyLoopData,
  preserveHistoryDraft, recordHistoryScroll, refreshHistoryUserLoop, retryHistoryResult, returnHistoryList,
  saveHistoryCurrentAssessment, requestHistorySaveConfirmation, cancelHistorySaveConfirmation, selectHistoryResult, readHistoryRecommendation, returnHistoryProfile, reconcileHistorySave, viewRecoveredHistorySave, confirmHistoryNewSession, cancelHistoryNewSession } from './history-user-loop'

interface HistoryPage { setData(patch: Record<string, unknown>): void }
interface ReadState {
  active: boolean
  pending: boolean
  generation: number
  cursor: string | null
  records: CompletedAssessmentHistoryMetadataV1[]
  client: CompletedAssessmentHistoryClientV1
}
const reads = new WeakMap<object, ReadState>()
const invalidate = (page: HistoryPage): void => {
  const state = reads.get(page)
  if (state) { state.active = false; state.generation += 1; state.pending = false }
}
const readHistory = async (page: HistoryPage, append: boolean): Promise<void> => {
  const state = reads.get(page)
  if (!state || !state.active || state.pending || (append && !state.cursor)) return
  state.pending = true
  const generation = ++state.generation
  page.setData({ historyLoading: true })
  const result = await state.client.readPage(append ? state.cursor || undefined : undefined)
  if (!state.active || state.generation !== generation) return
  state.pending = false
  if (result.state === 'READY') {
    const records = append ? [...state.records, ...result.records] : result.records
    if (new Set(records.map(record => record.id)).size !== records.length) {
      page.setData({ ...createHistoryViewModel({ state: 'ERROR' }), historyLoading: false, hasMore: false })
      return
    }
    state.records = records
    state.cursor = result.nextCursor
    page.setData({ ...createHistoryViewModel({ state: 'READY', records }), historyLoading: false, hasMore: result.nextCursor !== null })
  } else {
    state.cursor = null
    state.records = []
    page.setData({ ...createHistoryViewModel(result), historyLoading: false, hasMore: false })
  }
}

const routeData = createRouteScaffoldData({
  title: '我的评估',
  routeLabel: '我的 · 历史评估',
  description: '历史记录将按老人和 Assessment 绑定，重新评估不会覆盖旧结果。',
  nextUrl: '/pages/recommendation/result',
  nextLabel: '查看结果骨架',
})

Component({
  data: { ...routeData, ...createHistoryViewModel(), historyLoading: false, hasMore: false, ...historyLoopData },
  lifetimes: { detached() { invalidate(this); hideHistoryUserLoop(this, true) } },
  pageLifetimes: {
    show() {
      resetNavigationGuard(this)
      invalidate(this)
      activateHistoryUserLoop(this)
      this.setData({ ...createHistoryViewModel(), historyLoading: false, hasMore: false })
      reads.set(this, { active: true, pending: false, generation: 0, cursor: null, records: [], client: createCompletedAssessmentHistoryClientV1() })
      void readHistory(this, false)
      void refreshHistoryUserLoop(this)
    },
    hide() { invalidate(this); hideHistoryUserLoop(this) },
  },
  methods: {
    loadMoreHistory() { void readHistory(this, true) },
    async viewHistoryResult(event?: { currentTarget?: { dataset?: { recordId?: unknown } } }) {
      const currentTarget = event === undefined || event === null ? undefined : event.currentTarget
      const dataset = currentTarget === undefined || currentTarget === null ? undefined : currentTarget.dataset
      const id = dataset === undefined || dataset === null ? undefined : dataset.recordId
      const state = reads.get(this)
      const records = (state === undefined || state === null ? undefined : state.records) || []
      if (records.some(record => record.id === id) && await selectHistoryResult(this, id)) return
      this.setData({ actionMessage: historyActionMessage('VIEW_RESULT') })
    },
    async newAssessment() {
      if (!await beginHistoryReassessment(this)) this.setData({ actionMessage: historyActionMessage('NEW_ASSESSMENT') })
    },
    saveCurrentAssessment() { void requestHistorySaveConfirmation(this) },
    confirmSaveAssessment() { void saveHistoryCurrentAssessment(this, () => { void readHistory(this, false) }) },
    cancelSaveAssessment() { cancelHistorySaveConfirmation(this) },
    confirmNewAssessmentSession() { void confirmHistoryNewSession(this) },
    cancelNewAssessmentSession() { cancelHistoryNewSession(this) },
    reconcilePendingSave() { void reconcileHistorySave(this) },
    viewRecoveredSave() { void viewRecoveredHistorySave(this) },
    retryHistoricalResult() { retryHistoryResult(this) },
    returnToHistoryList() { returnHistoryList(this) },
    viewHistoricalRecommendation() { void readHistoryRecommendation(this) },
    retryHistoricalRecommendation() { void readHistoryRecommendation(this) },
    returnToHistoricalProfile() { returnHistoryProfile(this) },
    keepCurrentDraft() { preserveHistoryDraft(this, false) },
    continueCurrentDraft() { preserveHistoryDraft(this, true) },
    onPageScroll(event: { scrollTop: number }) { recordHistoryScroll(this, event.scrollTop) },
    navigateNext() {
      navigateToWithGuard(this, 'history.currentRecommendation', this.data.nextUrl, undefined, () => {
        this.setData({ actionMessage: '暂时无法打开当前推荐页面，请稍后重试。' })
      })
    },
  },
})
