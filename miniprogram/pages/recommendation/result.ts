import {
  buildRecommendationResultApplicationSnapshot,
} from '../../services/recommendation-result-application'
import type {
  RecommendationPreviewApplicationError,
} from '../../types/recommendation-preview'
import {
  getNavigationGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'
import {
  createRecommendationResultViewModel,
} from './result-view-model'
import {
  createRecommendationResultViewModelV2,
} from './result-v2-view-model'
import type {
  RecommendationResultPageState,
  RecommendationResultViewModel,
} from './result-view-model'
import type { RecommendationResultPageViewModelV2 } from './result-v2-view-model'

type RecommendationResultPageLifecycleState =
  | 'loading'
  | RecommendationResultPageState
  | RecommendationResultPageViewModelV2['state']
  | 'assessment_error'
  | 'catalog_error'
  | 'recommendation_error'

interface RecommendationResultPageData {
  pageTitle: string
  eyebrow: string
  description: string
  backEnabled: boolean
  pageState: RecommendationResultPageLifecycleState
  viewModel: RecommendationResultViewModel | RecommendationResultPageViewModelV2 | null
  stateTitle: string
  stateMessage: string
  actionErrorKey: string
  actionErrorMessage: string
}

interface NavigationCallbacks {
  success: () => void
  fail: () => void
  complete: () => void
}

type NavigationInvoker = (callbacks: NavigationCallbacks) => unknown

const refreshGenerations = new WeakMap<object, number>()

const nextRefreshGeneration = (instance: object): number => {
  const next = (refreshGenerations.get(instance) || 0) + 1
  refreshGenerations.set(instance, next)
  return next
}

const isCurrentRefresh = (instance: object, generation: number): boolean =>
  refreshGenerations.get(instance) === generation

const runGuardedNavigation = (
  instance: object,
  action: string,
  invoke: NavigationInvoker,
  onFailure: () => void,
): boolean => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire(action)) {
    return false
  }
  let succeeded = false
  let failureReported = false
  const reportFailure = () => {
    guard.release(action)
    if (!failureReported) {
      failureReported = true
      onFailure()
    }
  }
  try {
    invoke({
      success: () => {
        succeeded = true
      },
      fail: reportFailure,
      complete: () => {
        if (!succeeded) {
          reportFailure()
        }
      },
    })
  } catch (_error) {
    reportFailure()
    return false
  }
  return true
}

const errorPresentation = (
  error: RecommendationPreviewApplicationError | { code: string, causeCode?: string },
): { pageState: 'assessment_error' | 'catalog_error' | 'recommendation_error', title: string, message: string } => {
  if (error.code === 'ASSESSMENT_PREVIEW_ERROR' || error.code === 'ASSESSMENT_PROFILE_V2_ERROR') {
    return {
      pageState: 'assessment_error',
      title: '评估信息还未准备好',
      message: '请返回评估页面补充必填信息，完成后再生成推荐。',
    }
  }
  if (error.code === 'NO_INSTITUTIONS_AVAILABLE') {
    return {
      pageState: 'catalog_error',
      title: '当前没有可用的机构资料',
      message: '暂时没有足够资料形成安全推荐，请稍后重试或咨询顾问。',
    }
  }
  if (error.code === 'INVALID_INSTITUTION_RECORD'
    || error.code === 'INSTITUTION_CATALOG_ERROR'
    || error.code === 'INSTITUTION_CATALOG_V11_ERROR') {
    return {
      pageState: 'catalog_error',
      title: '机构资料暂时不可用',
      message: '当前开发目录正在核验，请稍后重试；页面不会展示未经核验的机构卡片。',
    }
  }
  return {
    pageState: 'recommendation_error',
    title: '推荐暂时无法生成',
    message: '当前评估结果需要稍后重试。你可以调整需求，或先咨询养老顾问。',
  }
}

const currentRoute = (route: string): string => route.charAt(0) === '/' ? route.slice(1) : route

Page({
  data: {
    pageTitle: '评估结果与机构推荐',
    eyebrow: '评估 · 推荐预览',
    description: '先看清老人需要什么，再了解哪些候选机构值得进一步确认。',
    backEnabled: true,
    pageState: 'loading',
    viewModel: null,
    stateTitle: '正在整理推荐预览',
    stateMessage: '正在根据本次评估和开发目录中的结构化资料生成结果。',
    actionErrorKey: '',
    actionErrorMessage: '',
  } as RecommendationResultPageData,

  onShow() {
    resetNavigationGuard(this)
    this.refreshRecommendation()
  },

  refreshRecommendation() {
    const generation = nextRefreshGeneration(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      stateTitle: '正在整理推荐预览',
      stateMessage: '正在根据本次评估和开发目录中的结构化资料生成结果。',
      actionErrorKey: '',
      actionErrorMessage: '',
    })

    const evaluationAsOf = new Date().toISOString()
    buildRecommendationResultApplicationSnapshot({ evaluationAsOf }).then((result) => {
      if (!isCurrentRefresh(this, generation)) {
        return
      }
      if (!result.ok) {
        const presentation = errorPresentation(result.error)
        this.setData({
          pageState: presentation.pageState,
          viewModel: null,
          stateTitle: presentation.title,
          stateMessage: presentation.message,
        })
        return
      }
      const viewModel = result.version === 2
        ? createRecommendationResultViewModelV2(result.value)
        : createRecommendationResultViewModel(result.value)
      this.setData({
        pageState: viewModel.state,
        viewModel,
        stateTitle: '',
        stateMessage: '',
      })
    }).catch(() => {
      if (!isCurrentRefresh(this, generation)) {
        return
      }
      this.setData({
        pageState: 'recommendation_error',
        viewModel: null,
        stateTitle: '推荐暂时无法生成',
        stateMessage: '当前评估结果需要稍后重试。你可以调整需求，或先咨询养老顾问。',
      })
    })
  },

  onRetry() {
    if (this.data.pageState === 'loading') {
      return
    }
    this.refreshRecommendation()
  },

  navigateToProfile() {
    const pages = getCurrentPages()
    let profileIndex = -1
    for (let index = pages.length - 2; index >= 0; index -= 1) {
      if (pages[index].route === currentRoute('/pages/assessment/profile')) {
        profileIndex = index
        break
      }
    }
    const onFailure = () => {
      this.setData({
        actionErrorKey: 'adjust',
        actionErrorMessage: '暂时无法返回画像，请稍后重试。',
      })
    }
    if (profileIndex >= 0) {
      const delta = pages.length - 1 - profileIndex
      runGuardedNavigation(this, 'recommendation.adjustNeeds', (callbacks) => wx.navigateBack({
        delta,
        success: callbacks.success,
        fail: callbacks.fail,
        complete: callbacks.complete,
      }), onFailure)
      return
    }
    runGuardedNavigation(this, 'recommendation.adjustNeeds', (callbacks) => wx.redirectTo({
      url: '/pages/assessment/profile',
      success: callbacks.success,
      fail: callbacks.fail,
      complete: callbacks.complete,
    }), onFailure)
  },

  onAdjustNeeds() {
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    this.navigateToProfile()
  },

  onConsultant() {
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    runGuardedNavigation(this, 'recommendation.consultant', (callbacks) => wx.switchTab({
      url: '/pages/consultant/index',
      success: callbacks.success,
      fail: callbacks.fail,
      complete: callbacks.complete,
    }), () => {
      this.setData({
        actionErrorKey: 'consultant',
        actionErrorMessage: '暂时无法打开养老顾问，请稍后重试。',
      })
    })
  },

  onBackNavigationFailure() {
    this.setData({
      actionErrorKey: 'back',
      actionErrorMessage: '暂时无法返回，请稍后重试。',
    })
  },
})
