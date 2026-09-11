import {
  buildInstitutionListPageSnapshot,
} from '../../services/institution-list-detail-page'
import {
  createInstitutionListErrorViewModel,
  createInstitutionListLoadingViewModel,
  createInstitutionListPageViewModel,
} from './list-view-model'
import type { InstitutionListPageViewModelV12 } from './list-view-model'
import {
  getNavigationGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'

type ListPageState = InstitutionListPageViewModelV12['pageState']

interface InstitutionListPageData {
  pageState: ListPageState
  viewModel: InstitutionListPageViewModelV12 | null
  sourceContextRef: string | null
  actionErrorKey: string
  actionErrorMessage: string
}

const listGenerations = new WeakMap<object, number>()
const listLoadsInFlight = new WeakSet<object>()
const blockedCardActions = new WeakSet<object>()

const nextGeneration = (instance: object): number => {
  const generation = (listGenerations.get(instance) || 0) + 1
  listGenerations.set(instance, generation)
  return generation
}

const isCurrentGeneration = (instance: object, generation: number): boolean =>
  listGenerations.get(instance) === generation

const pageStateForError = (code: string): Exclude<ListPageState, 'loading' | 'ready' | 'empty'> => {
  if (code === 'INSTITUTION_SOURCE_CONTEXT_ERROR') return 'source_context_error'
  if (code === 'INSTITUTION_LIST_PROJECTION_ERROR') return 'projection_error'
  return 'catalog_error'
}

const runBack = (
  instance: object,
  onFailure: () => void,
): boolean => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire('institution.list.back')) return false
  const pages = getCurrentPages()
  let succeeded = false
  let reported = false
  const fail = () => {
    guard.release('institution.list.back')
    if (!reported) {
      reported = true
      onFailure()
    }
  }
  try {
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    } else {
      wx.redirectTo({
        url: '/pages/home/index',
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    }
  } catch (_error) {
    fail()
    return false
  }
  return true
}

Page({
  data: {
    pageState: 'loading',
    viewModel: null,
    sourceContextRef: null,
    actionErrorKey: '',
    actionErrorMessage: '',
  } as InstitutionListPageData,

  onLoad(query: Record<string, string | undefined>) {
    const sourceContextRef = query && query.sourceContextRef ? query.sourceContextRef : null
    this.setData({ sourceContextRef })
    this.loadList(sourceContextRef)
  },

  onShow() {
    resetNavigationGuard(this)
  },

  loadList(sourceContextRef: string | null) {
    if (listLoadsInFlight.has(this)) return
    listLoadsInFlight.add(this)
    blockedCardActions.delete(this)
    const generation = nextGeneration(this)
    const loading = createInstitutionListLoadingViewModel()
    this.setData({
      pageState: loading.pageState,
      viewModel: null,
      actionErrorKey: '',
      actionErrorMessage: '',
    })
    buildInstitutionListPageSnapshot(sourceContextRef).then((result) => {
      listLoadsInFlight.delete(this)
      if (!isCurrentGeneration(this, generation)) return
      if (result.ok) {
        const viewModel = createInstitutionListPageViewModel(result.value)
        this.setData({
          pageState: viewModel.pageState,
          viewModel,
          actionErrorKey: '',
          actionErrorMessage: '',
        })
        return
      }
      const pageState = pageStateForError(result.error.code)
      const viewModel = createInstitutionListErrorViewModel(pageState)
      this.setData({
        pageState,
        viewModel,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    }).catch(() => {
      listLoadsInFlight.delete(this)
      if (!isCurrentGeneration(this, generation)) return
      const viewModel = createInstitutionListErrorViewModel('catalog_error')
      this.setData({
        pageState: 'catalog_error',
        viewModel,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    })
  },

  onRetry() {
    if (this.data.pageState === 'loading') return
    this.loadList(this.data.sourceContextRef)
  },

  onCardTap(event: WechatMiniprogram.BaseEvent) {
    const itemKey = event.currentTarget.dataset.itemKey as string
    if (!itemKey || this.data.pageState !== 'ready') return
    if (blockedCardActions.has(this)) return
    blockedCardActions.add(this)
    // The canonical intent is already built in the ViewModel.  The A0-3 gate
    // remains blocked, so this action has one visible result and zero routing.
    this.setData(
      {
        actionErrorKey: itemKey,
        actionErrorMessage: '机构详情入口正在开发验证中，当前不会打开详情页面。',
      },
      () => { blockedCardActions.delete(this) },
    )
  },

  onBackToHome() {
    runBack(this, () => {
      this.setData({
        actionErrorKey: 'back',
        actionErrorMessage: '暂时无法返回，请稍后重试。',
      })
    })
  },

  onNavigationFailure() {
    this.setData({
      actionErrorKey: 'back',
      actionErrorMessage: '暂时无法返回，请稍后重试。',
    })
  },
})
