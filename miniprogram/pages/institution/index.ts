import { filterInstitutionDirectory } from '../../services/institution-directory-search'
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
import { serializeInstitutionDetailRoute } from '../../services/institution-detail-route'
import { directoryNatureOptions, directoryDistrictOptions } from '../../runtime/directory-metadata'
import type { InstitutionListItemViewModel } from './list-view-model'

type ListPageState = InstitutionListPageViewModelV12['pageState']

interface InstitutionListPageData {
  pageState: ListPageState
  viewModel: InstitutionListPageViewModelV12 | null
  sourceContextRef: string | null
  actionErrorKey: string
  actionErrorMessage: string
  keyword: string
  visibleItems: readonly InstitutionListItemViewModel[]
  natureOptions: typeof directoryNatureOptions
  districtOptions: typeof directoryDistrictOptions
  natureIndex: number
  districtIndex: number
  hasMetadataFilters: boolean
}

const listGenerations = new WeakMap<object, number>()
const listLoadsInFlight = new WeakSet<object>()

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
      wx.switchTab({
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
    keyword: '',
    visibleItems: [],
    natureOptions: directoryNatureOptions,
    districtOptions: directoryDistrictOptions,
    natureIndex: 0,
    districtIndex: 0,
    hasMetadataFilters: false,
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
        this.filterDirectory()
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

  filterDirectory() {
    this.setData({ hasMetadataFilters: true,
      visibleItems: filterInstitutionDirectory(this.data.viewModel ? this.data.viewModel.items : [], this.data.keyword, this.data.natureIndex, this.data.districtIndex) })
  },
  onSearchInput(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value }); this.filterDirectory()
  },
  onNatureChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value)
    if (!Number.isInteger(index) || !directoryNatureOptions[index]) return
    this.setData({ natureIndex: index }); this.filterDirectory()
  },
  onDistrictChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value)
    if (!Number.isInteger(index) || !directoryDistrictOptions[index]) return
    this.setData({ districtIndex: index }); this.filterDirectory()
  },
  clearSearch() {
    this.setData({ keyword: '', natureIndex: 0, districtIndex: 0 }); this.filterDirectory()
  },

  onRetry() {
    if (this.data.pageState === 'loading') return
    this.loadList(this.data.sourceContextRef)
  },

  onCardTap(event: WechatMiniprogram.BaseEvent) {
    const itemKey = event.currentTarget.dataset.itemKey as string
    if (!itemKey || this.data.pageState !== 'ready') return
    const viewModel = this.data.viewModel
    const item = viewModel === null
      ? undefined
      : viewModel.items.find((candidate) => candidate.key === itemKey)
    if (item === undefined) return
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    const guard = getNavigationGuard(this)
    if (!guard.acquire('institution.list.openDetail')) return
    const intent = item.navigationIntent
    const url = serializeInstitutionDetailRoute(
      {
        institutionId: intent.institutionId,
        recordRevision: intent.recordRevision,
      },
      intent.source,
      intent.sourceContextRef,
    )
    if (url === null) {
      guard.release('institution.list.openDetail')
      this.setData({ actionErrorKey: itemKey, actionErrorMessage: '机构资料链接暂时无法生成，请稍后重试。' })
      return
    }
    let succeeded = false
    let reported = false
    const fail = () => {
      guard.release('institution.list.openDetail')
      if (reported) return
      reported = true
      this.setData({ actionErrorKey: itemKey, actionErrorMessage: '暂时无法打开机构详情，请稍后重试。' })
    }
    try {
      wx.navigateTo({
        url,
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    } catch (_error) {
      fail()
    }
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
