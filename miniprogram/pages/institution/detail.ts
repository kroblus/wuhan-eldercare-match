import {
  buildInstitutionCurrentRevisionSnapshot,
  buildInstitutionDetailPageSnapshot,
} from '../../services/institution-list-detail-page'
import {
  parseInstitutionDetailRouteQuery,
} from '../../services/institution-detail-route'
import type { InstitutionDetailRoute } from '../../services/institution-detail-route'
import {
  createInstitutionDetailErrorViewModel,
  createInstitutionDetailPageViewModel,
} from './detail-view-model'
import type {
  InstitutionDetailErrorViewModelV12,
  InstitutionDetailPageViewModelV12,
} from './detail-view-model'
import {
  getNavigationGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'

type DetailPageState = 'loading' | InstitutionDetailErrorViewModelV12['pageState'] | 'ready'

interface InstitutionDetailPageData {
  pageState: DetailPageState
  viewModel: InstitutionDetailPageViewModelV12 | null
  errorViewModel: InstitutionDetailErrorViewModelV12 | null
  actionErrorKey: string
  actionErrorMessage: string
  isSwitchingRevision: boolean
}

const routeByPage = new WeakMap<object, InstitutionDetailRoute>()
const detailGenerations = new WeakMap<object, number>()

const nextGeneration = (instance: object): number => {
  const generation = (detailGenerations.get(instance) || 0) + 1
  detailGenerations.set(instance, generation)
  return generation
}

const isCurrentGeneration = (instance: object, generation: number): boolean =>
  detailGenerations.get(instance) === generation

const detailStateForError = (code: string): InstitutionDetailErrorViewModelV12['pageState'] => {
  if (code === 'INSTITUTION_ROUTE_ERROR') return 'route_error'
  if (code === 'INSTITUTION_NOT_FOUND') return 'not_found'
  if (code === 'INSTITUTION_REVISION_NOT_FOUND') return 'revision_not_found'
  if (code === 'INSTITUTION_SOURCE_CONTEXT_ERROR') return 'source_context_error'
  if (code === 'INSTITUTION_DETAIL_PROJECTION_ERROR'
    || code === 'INSTITUTION_RECORD_NOT_DISPLAYABLE') return 'projection_error'
  return 'catalog_error'
}

const runBack = (
  instance: object,
  onFailure: () => void,
): boolean => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire('institution.detail.back')) return false
  const pages = getCurrentPages()
  let succeeded = false
  let reported = false
  const fail = () => {
    guard.release('institution.detail.back')
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
        url: '/pages/institution/index',
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
    errorViewModel: null,
    actionErrorKey: '',
    actionErrorMessage: '',
    isSwitchingRevision: false,
  } as InstitutionDetailPageData,

  onLoad(query: Record<string, string | undefined>) {
    const parsed = parseInstitutionDetailRouteQuery(query)
    if (!parsed.ok) {
      this.setData({
        pageState: 'route_error',
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel('route_error'),
        actionErrorKey: '',
        actionErrorMessage: '',
      })
      return
    }
    routeByPage.set(this, parsed.value)
    this.buildRoute(parsed.value)
  },

  onShow() {
    // Detail has a single build entry in onLoad.  Showing the page again only
    // resets navigation protection; it does not rebuild the same snapshot.
    resetNavigationGuard(this)
  },

  buildRoute(route: InstitutionDetailRoute) {
    const generation = nextGeneration(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      errorViewModel: null,
      actionErrorKey: '',
      actionErrorMessage: '',
      isSwitchingRevision: false,
    })
    buildInstitutionDetailPageSnapshot(route).then((result) => {
      if (!isCurrentGeneration(this, generation)) return
      if (result.ok) {
        const viewModel = createInstitutionDetailPageViewModel(result.value)
        this.setData({
          pageState: 'ready',
          viewModel,
          errorViewModel: null,
          actionErrorKey: '',
          actionErrorMessage: '',
          isSwitchingRevision: false,
        })
        return
      }
      const pageState = detailStateForError(result.error.code)
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        actionErrorKey: '',
        actionErrorMessage: '',
        isSwitchingRevision: false,
      })
    }).catch(() => {
      if (!isCurrentGeneration(this, generation)) return
      const pageState = 'catalog_error' as const
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        actionErrorKey: '',
        actionErrorMessage: '',
        isSwitchingRevision: false,
      })
    })
  },

  onRetry() {
    if (this.data.pageState === 'loading' || this.data.isSwitchingRevision) return
    const route = routeByPage.get(this)
    if (route === undefined) return
    this.buildRoute(route)
  },

  onViewCurrentRevision() {
    if (this.data.pageState !== 'ready'
      || this.data.viewModel === null
      || !this.data.viewModel.canViewCurrentRevision
      || this.data.isSwitchingRevision) return
    const route = routeByPage.get(this)
    if (route === undefined) return
    const guard = getNavigationGuard(this)
    if (!guard.acquire('institution.detail.currentRevision')) return
    const generation = nextGeneration(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      errorViewModel: null,
      isSwitchingRevision: true,
      actionErrorKey: '',
      actionErrorMessage: '',
    })
    buildInstitutionCurrentRevisionSnapshot(route.identity).then((result) => {
      guard.release('institution.detail.currentRevision')
      if (!isCurrentGeneration(this, generation)) return
      if (result.ok) {
        const viewModel = createInstitutionDetailPageViewModel(result.value)
        const currentRoute: InstitutionDetailRoute = {
          identity: result.value.identity,
          source: 'direct',
          sourceContextRef: null,
        }
        routeByPage.set(this, currentRoute)
        this.setData({
          pageState: 'ready',
          viewModel,
          errorViewModel: null,
          isSwitchingRevision: false,
          actionErrorKey: '',
          actionErrorMessage: '',
        })
        return
      }
      const pageState = detailStateForError(result.error.code)
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        isSwitchingRevision: false,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    }).catch(() => {
      guard.release('institution.detail.currentRevision')
      if (!isCurrentGeneration(this, generation)) return
      const pageState = 'catalog_error' as const
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        isSwitchingRevision: false,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    })
  },

  onVrTap() {
    if (this.data.pageState !== 'ready' || this.data.viewModel === null) return
    this.setData({
      actionErrorKey: 'vr',
      actionErrorMessage: this.data.viewModel.media.vrState === 'available'
        ? 'VR看院入口正在开发验证中，当前不会打开。'
        : '当前没有可用的 VR 看院资料。',
    })
  },

  onBackToList() {
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
