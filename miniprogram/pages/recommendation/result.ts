import {
  buildRecommendationResultApplicationSnapshot,
} from '../../services/recommendation-result-application'
import { readBrowseFontStyle } from '../../utils/browse-font'
import type {
  RecommendationPreviewApplicationError,
} from '../../types/recommendation-preview'
import type { RecommendationResultApplicationSnapshotV2 } from '../../types/recommendation-result-v2'
import {
  institutionSourceContextRegistry,
  registerInstitutionRecommendationSourceContextV2 as registerInstitutionRecommendationSourceContextV2FromPage,
} from '../../services/institution-list-detail-page'
import {
  registerInstitutionRecommendationSourceContextV2 as registerInstitutionRecommendationSourceContextV2FromSource,
} from '../../services/institution-recommendation-source'
import {
  serializeInstitutionDetailRoute,
} from '../../services/institution-detail-route'
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
import { emptyRecommendationSaveView, recommendationResultSaveController } from '../../services/recommendation-result-save'
import { isDevelopmentBuild } from '../showcase/development'

type RecommendationResultPageLifecycleState =
  | 'loading'
  | RecommendationResultPageState
  | RecommendationResultPageViewModelV2['state']
  | 'assessment_error'
  | 'catalog_error'
  | 'recommendation_error'

interface RecommendationResultPageData {
  hierarchyFontStyle: string
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
  expandedCards: Record<string, boolean>
  isDemoBuild: boolean
  resultSaveVisible: boolean
  resultSavePending: boolean
  resultSaveDialog: boolean
  resultSaveConfirmDisabled: boolean
  resultSaveMessage: string
  resultSaveCanReconcile: boolean
  resultSaveAdmissionReady: boolean
  resultSaveTrustedView: ReturnType<typeof emptyRecommendationSaveView>['resultSaveTrustedView']
}

interface NavigationCallbacks {
  success: () => void
  fail: () => void
  complete: () => void
}

type NavigationInvoker = (callbacks: NavigationCallbacks) => unknown

const refreshGenerations = new WeakMap<object, number>()
const resultSnapshots = new WeakMap<object, RecommendationResultApplicationSnapshotV2>()
const resultSourceContextRefs = new WeakMap<object, Set<string>>()

/**
 * The page-facing composition owns the live provider wiring. The source-level
 * fallback exists only for the isolated interaction harness, whose module
 * override intentionally supplies a registry-only page composition stub.
 */
const registerInstitutionRecommendationSourceContextV2 = (
  snapshot: RecommendationResultApplicationSnapshotV2,
) => typeof registerInstitutionRecommendationSourceContextV2FromPage === 'function'
  ? registerInstitutionRecommendationSourceContextV2FromPage(snapshot)
  : registerInstitutionRecommendationSourceContextV2FromSource(
    snapshot,
    institutionSourceContextRegistry,
  )

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
  if (error.code === 'NO_INSTITUTIONS_AVAILABLE' || error.causeCode === 'NO_INSTITUTIONS_AVAILABLE') {
    return {
      pageState: 'catalog_error',
      title: '当前没有可用的机构资料',
      message: '机构目录暂时为空，当前无法判断。你可以重试；这不代表所有机构都不适合。',
    }
  }
  if (error.code === 'INVALID_INSTITUTION_RECORD'
    || error.code === 'INSTITUTION_CATALOG_ERROR'
    || error.code === 'INSTITUTION_CATALOG_V11_ERROR') {
    return {
      pageState: 'catalog_error',
      title: '机构资料暂时不可用',
      message: '机构资料暂时未能加载或通过检查，请重试；这不是对机构是否适合的判断。',
    }
  }
  return {
    pageState: 'recommendation_error',
    title: '推荐暂时无法生成',
    message: '请重试，或返回画像确认需求。也可以先浏览公开机构资料。',
  }
}

const currentRoute = (route: string): string => route.charAt(0) === '/' ? route.slice(1) : route

const hasRecommendationIdentity = (
  snapshot: RecommendationResultApplicationSnapshotV2,
  institutionId: string,
  recordRevision: number,
): boolean => {
  const semantics = snapshot.preview.semantics
  const candidates = semantics.cards.concat(
    semantics.conditionalCandidates,
    semantics.noExactMatch === undefined ? [] : semantics.noExactMatch.nearMatches,
  )
  return candidates.some((candidate) => candidate.institutionId === institutionId
    && candidate.recordRevision === recordRevision)
}

const clearResultSourceContexts = (instance: object): void => {
  const refs = resultSourceContextRefs.get(instance)
  if (refs === undefined) return
  refs.forEach((ref) => institutionSourceContextRegistry.clear(ref))
  refs.clear()
  resultSourceContextRefs.delete(instance)
}

const rememberResultSourceContext = (instance: object, ref: string): void => {
  const existing = resultSourceContextRefs.get(instance)
  if (existing !== undefined) {
    existing.add(ref)
    return
  }
  resultSourceContextRefs.set(instance, new Set([ref]))
}

const forgetResultSourceContext = (instance: object, ref: string): void => {
  const refs = resultSourceContextRefs.get(instance)
  if (refs === undefined) return
  refs.delete(ref)
  if (refs.size === 0) resultSourceContextRefs.delete(instance)
}

Page({
  data: {
    hierarchyFontStyle: '',
    pageTitle: '评估结果与机构推荐',
    eyebrow: '评估 · 推荐预览',
    description: '先看清老人需要什么，再了解哪些候选机构值得进一步确认。',
    backEnabled: true,
    pageState: 'loading',
    viewModel: null,
    stateTitle: '正在整理推荐预览',
    stateMessage: '正在根据本次需求画像和机构资料核对照护条件。',
    actionErrorKey: '',
    actionErrorMessage: '',
    expandedCards: {},
    isDemoBuild: isDevelopmentBuild(),
    ...emptyRecommendationSaveView(),
  } as RecommendationResultPageData,

  onShow() {
    this.setData({ hierarchyFontStyle: readBrowseFontStyle() })
    resetNavigationGuard(this)
    this.refreshRecommendation()
  },

  onUnload() {
    nextRefreshGeneration(this)
    resultSnapshots.delete(this)
    recommendationResultSaveController(this).close()
    clearResultSourceContexts(this)
  },

  onHide() { nextRefreshGeneration(this); recommendationResultSaveController(this).close() },

  refreshRecommendation() {
    recommendationResultSaveController(this).close()
    clearResultSourceContexts(this)
    const generation = nextRefreshGeneration(this)
    resultSnapshots.delete(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      stateTitle: '正在整理推荐预览',
      stateMessage: '正在根据本次需求画像和机构资料核对照护条件。',
      actionErrorKey: '',
      actionErrorMessage: '',
      expandedCards: {},
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
      if (result.version === 2) {
        resultSnapshots.set(this, result.value)
      }
      this.setData({
        pageState: viewModel.state,
        viewModel,
        stateTitle: '',
        stateMessage: '',
      })
      void recommendationResultSaveController(this).activate(result.version === 2 ? result.value : undefined)
    }).catch(() => {
      if (!isCurrentRefresh(this, generation)) {
        return
      }
      this.setData({
        pageState: 'recommendation_error',
        viewModel: null,
        stateTitle: '推荐暂时无法生成',
        stateMessage: '请重试，或返回画像确认需求。也可以先浏览公开机构资料。',
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
    recommendationResultSaveController(this).close()
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    this.navigateToProfile()
  },

  onConsultant() {
    recommendationResultSaveController(this).close()
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

  onSaveAssessment() { void recommendationResultSaveController(this).begin() },
  onVerifyAssessmentSave() { void recommendationResultSaveController(this).verify() },
  onObtainTrustedAssessmentPreview() { void recommendationResultSaveController(this).obtainPreview() },
  onCancelAssessmentSave() { recommendationResultSaveController(this).cancel() },
  onConfirmAssessmentSave() { void recommendationResultSaveController(this).confirm() },
  onReconcileAssessmentSave() { void recommendationResultSaveController(this).reconcile() },
  async onAssessmentHistory() {
    if (!await recommendationResultSaveController(this).canOpenHistory()) return
    runGuardedNavigation(this, 'recommendation.assessmentHistory', callbacks => wx.navigateTo({
      url: '/pages/assessment/history', ...callbacks,
    }), () => this.setData({ actionErrorKey: 'history-save', actionErrorMessage: '暂时无法打开我的评估，请重试。' }))
  },

  onRecommendationCardTap(event: WechatMiniprogram.BaseEvent) {
    const institutionId = event.currentTarget.dataset.institutionId as string
    const recordRevision = Number(event.currentTarget.dataset.recordRevision)
    const snapshot = resultSnapshots.get(this)
    if (snapshot === undefined) {
      this.setData({
        actionErrorKey: 'recommendation-detail',
        actionErrorMessage: '当前推荐资料已失效，请重新生成后再查看详情。',
      })
      return
    }
    if (this.data.pageState !== 'ready_exact'
      && this.data.pageState !== 'ready_soft_near'
      && this.data.pageState !== 'ready_conditional') return
    if (!institutionId
      || !Number.isSafeInteger(recordRevision)
      || recordRevision <= 0
      || !hasRecommendationIdentity(snapshot, institutionId, recordRevision)) {
      this.setData({
        actionErrorKey: 'recommendation-detail',
        actionErrorMessage: '当前推荐资料已失效，请重新生成推荐后再查看详情。',
      })
      return
    }

    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    const guard = getNavigationGuard(this)
    if (!guard.acquire('recommendation.result.openInstitution')) return
    const registered = registerInstitutionRecommendationSourceContextV2(
      snapshot,
    )
    if (!registered.ok) {
      guard.release('recommendation.result.openInstitution')
      this.setData({
        actionErrorKey: 'recommendation-detail',
        actionErrorMessage: '当前推荐资料暂时无法打开，请重新生成推荐后重试。',
      })
      return
    }
    const sourceContextRef = registered.value.sourceContextRef
    rememberResultSourceContext(this, sourceContextRef)
    const url = serializeInstitutionDetailRoute(
      { institutionId, recordRevision },
      'recommendation',
      sourceContextRef,
    )
    if (url === null) {
      institutionSourceContextRegistry.clear(sourceContextRef)
      forgetResultSourceContext(this, sourceContextRef)
      guard.release('recommendation.result.openInstitution')
      this.setData({
        actionErrorKey: 'recommendation-detail',
        actionErrorMessage: '当前推荐详情链接暂时无法生成，请稍后重试。',
      })
      return
    }

    let succeeded = false
    let cleaned = false
    const fail = () => {
      if (cleaned) return
      cleaned = true
      institutionSourceContextRegistry.clear(sourceContextRef)
      forgetResultSourceContext(this, sourceContextRef)
      guard.release('recommendation.result.openInstitution')
      this.setData({
        actionErrorKey: 'recommendation-detail',
        actionErrorMessage: '暂时无法打开机构详情，请稍后重试。',
      })
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

  onBrowseDirectory() {
    // Ordinary browsing is independent of recommendation membership and carries
    // neither assessment data nor a recommendation source-context reference.
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    runGuardedNavigation(this, 'recommendation.result.openInstitution', callbacks => wx.navigateTo({
      url: '/pages/institution/index',
      ...callbacks,
    }), () => this.setData({ actionErrorKey: 'directory', actionErrorMessage: '暂时无法打开机构目录，请重试。' }))
  },

  onCandidateExplanationToggle(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.institutionId as string
    const revision = Number(event.currentTarget.dataset.recordRevision)
    const snapshot = resultSnapshots.get(this)
    if (!snapshot || !hasRecommendationIdentity(snapshot, id, revision)) return
    const key = `${id}#${revision}`
    this.setData({ expandedCards: { ...this.data.expandedCards, [key]: !this.data.expandedCards[key] } })
  },

  onRecommendationListTap() {
    const snapshot = resultSnapshots.get(this)
    if (snapshot === undefined) {
      this.setData({
        actionErrorKey: 'recommendation-list',
        actionErrorMessage: '本次候选列表已失效，请重新生成推荐，或浏览普通机构目录。',
      })
      return
    }
    if (this.data.pageState === 'loading'
      || this.data.pageState === 'assessment_error'
      || this.data.pageState === 'catalog_error'
      || this.data.pageState === 'no_safe_recommendation'
      || this.data.pageState === 'recommendation_error') {
      this.setData({
        actionErrorKey: 'recommendation-list',
        actionErrorMessage: '当前推荐资料已失效，请重新生成推荐后再查看机构列表。',
      })
      return
    }
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    const guard = getNavigationGuard(this)
    if (!guard.acquire('recommendation.result.openInstitution')) return
    const registered = registerInstitutionRecommendationSourceContextV2(
      snapshot,
    )
    if (!registered.ok) {
      guard.release('recommendation.result.openInstitution')
      this.setData({
        actionErrorKey: 'recommendation-list',
        actionErrorMessage: '当前推荐资料暂时无法打开机构列表，请重新生成推荐后重试。',
      })
      return
    }
    const sourceContextRef = registered.value.sourceContextRef
    rememberResultSourceContext(this, sourceContextRef)
    const url = `/pages/institution/index?sourceContextRef=${encodeURIComponent(sourceContextRef)}`
    let succeeded = false
    let cleaned = false
    const fail = () => {
      if (cleaned) return
      cleaned = true
      institutionSourceContextRegistry.clear(sourceContextRef)
      forgetResultSourceContext(this, sourceContextRef)
      guard.release('recommendation.result.openInstitution')
      this.setData({
        actionErrorKey: 'recommendation-list',
        actionErrorMessage: '暂时无法打开机构列表，请稍后重试。',
      })
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

  onBackNavigationFailure() {
    this.setData({
      actionErrorKey: 'back',
      actionErrorMessage: '暂时无法返回，请稍后重试。',
    })
  },
})
