import { profileHeadline } from '../../runtime/institution-display'
import { modeText } from '../../runtime/presentation-copy'
import { buildProfileApplicationSnapshot } from '../../services/profile-application-v2'
import type { AssessmentStepId } from '../../types/assessment'
import {
  beginAssessmentPageAction,
  endAssessmentPageAction,
  getAssessmentStepFromRoute,
  isAssessmentPageActionActive,
  navigateProfileToAssessmentStep,
  navigateProfileToIntro,
  onHideAssessmentPhasePage,
  onUnloadAssessmentPhasePage,
  resetAssessmentPageNavigation,
} from '../../utils/assessment-phase-navigation'
import { createProfilePageViewModel } from './profile-view-model'
import { createProfilePageViewModelV2 } from './profile-v2-view-model'
import type { ProfileEditSection, ProfilePageViewModel } from './profile-view-model'
import type { ProfilePageViewModelV2 } from './profile-v2-view-model'
import { readBrowseFontStyle } from '../../utils/browse-font'

type ProfilePageState = 'loading' | 'ready' | 'incomplete' | 'error'

interface ProfilePageData {
  hierarchyFontStyle: string
  backEnabled: boolean
  isRootProfile: boolean
  pageState: ProfilePageState
  viewModel: ProfilePageViewModel | ProfilePageViewModelV2 | null
  stateTitle: string
  stateMessage: string
  recoveryRoute: string
  recoveryLabel: string
  actionErrorKey: string
  actionErrorMessage: string
}

interface NavigationLifecycleCallbacks {
  success: () => void
  fail: () => void
  complete: () => void
}

type GuardedNavigationInvoker = (callbacks: NavigationLifecycleCallbacks) => unknown

const EDIT_ROUTES: Record<ProfileEditSection, string> = {
  basic: '/pages/assessment/basic',
  health: '/pages/assessment/health',
  adl: '/pages/assessment/adl',
  cognitive: '/pages/assessment/cognitive',
  preference: '/pages/assessment/preference',
  budget: '/pages/assessment/budget',
}

const STEP_LABELS: Record<AssessmentStepId, string> = {
  basic: '老人基本情况',
  health: '健康情况',
  adl: '日常生活能力',
  cognitive: '认知与特殊护理',
  preference: '养老需求与偏好',
  budget: '预算与入住计划',
}

const MAX_PROFILE_NAVIGATION_STACK_SIZE = 10

const isProfileEditSection = (value: unknown): value is ProfileEditSection =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EDIT_ROUTES, value)

const runGuardedNavigation = (
  instance: object,
  action: string,
  invoke: GuardedNavigationInvoker,
  onFailure: () => void,
): boolean => {
  if (!beginAssessmentPageAction(instance, action)) return false

  let succeeded = false
  let failureNotified = false
  const notifyFailure = () => {
    if (failureNotified || !isAssessmentPageActionActive(instance, action)) return
    failureNotified = true
    endAssessmentPageAction(instance, action)
    onFailure()
  }

  try {
    invoke({
      success: () => {
        succeeded = true
      },
      fail: notifyFailure,
      complete: () => {
        if (!succeeded) {
          notifyFailure()
        }
      },
    })
  } catch {
    notifyFailure()
    return false
  }
  return true
}

const questionRoute = (questionId: string): { route: string, label: string } => {
  const step = questionId.split('.')[0] as AssessmentStepId
  if (!Object.prototype.hasOwnProperty.call(EDIT_ROUTES, step)) {
    return { route: '/pages/assessment/intro', label: '评估说明' }
  }
  return {
    route: EDIT_ROUTES[step],
    label: STEP_LABELS[step],
  }
}

Page({
  data: {
    hierarchyFontStyle: '',
    backEnabled: true,
    isRootProfile: false,
    pageState: 'loading',
    viewModel: null,
    stateTitle: '正在生成需求画像',
    stateMessage: '正在根据本次评估整理需要确认的信息。',
    recoveryRoute: '/pages/assessment/intro',
    recoveryLabel: '返回评估说明',
    actionErrorKey: '',
    actionErrorMessage: '',
  } as ProfilePageData,

  onShow() {
    this.setData({ hierarchyFontStyle: readBrowseFontStyle() })
    resetAssessmentPageNavigation(this)
    let isRootProfile = false
    try {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      isRootProfile = pages.length === 1
        && current === this
        && current.route === 'pages/assessment/profile'
    } catch (_error) {
      isRootProfile = false
    }
    this.setData({ isRootProfile })
    this.refreshProfile()
  },

  onHide() {
    onHideAssessmentPhasePage(this)
  },

  onUnload() {
    onUnloadAssessmentPhasePage(this)
  },

  refreshProfile() {
    this.setData({
      pageState: 'loading',
      viewModel: null,
      stateTitle: '正在生成需求画像',
      stateMessage: '正在根据本次评估整理需要确认的信息。',
      actionErrorKey: '',
      actionErrorMessage: '',
    })

    try {
      const result = buildProfileApplicationSnapshot()
      if (result.ok) {
        const viewModel = result.version === 2
          ? createProfilePageViewModelV2(result.value.preview)
          : createProfilePageViewModel(result.value.preview)
        if (result.version === 2) viewModel.headline = profileHeadline(viewModel.headline)
        this.setData({
          pageState: 'ready',
          viewModel,
          stateTitle: '',
          stateMessage: '',
          recoveryRoute: '/pages/assessment/intro',
          recoveryLabel: '返回评估说明',
        })
        return
      }

      if (result.error.causeCode === 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE') {
        const firstQuestionId = result.error.questionIds && result.error.questionIds[0]
        const hasAnswers = result.hasAnswers
        const recovery = firstQuestionId && hasAnswers
          ? questionRoute(firstQuestionId)
          : { route: '/pages/assessment/intro', label: '评估说明' }
        this.setData({
          pageState: 'incomplete',
          viewModel: null,
          stateTitle: '评估还未完成',
          stateMessage: modeText(`请先补充${recovery.label}中的必填信息，完成后再确认老人需求画像。`),
          recoveryRoute: recovery.route,
          recoveryLabel: hasAnswers ? `返回${recovery.label}继续填写` : '返回评估说明',
        })
        return
      }

      const unsupported = result.error.causeCode === 'UNSUPPORTED_ASSESSMENT_SCHEMA'
      this.setData({
        pageState: 'error',
        viewModel: null,
        stateTitle: unsupported ? '当前评估版本暂不支持' : '评估信息暂时无法读取',
        stateMessage: unsupported
          ? '请返回评估说明，按当前版本重新检查或开始评估。'
          : '当前本机草稿结构不完整，请返回评估说明后重试。',
        recoveryRoute: '/pages/assessment/intro',
        recoveryLabel: '返回评估说明',
      })
    } catch {
      this.setData({
        pageState: 'error',
        viewModel: null,
        stateTitle: '需求画像暂时无法生成',
        stateMessage: '请返回评估说明检查当前评估，稍后再试。',
        recoveryRoute: '/pages/assessment/intro',
        recoveryLabel: '返回评估说明',
      })
    }
  },

  clearActionError() {
    if (this.data.actionErrorMessage) {
      this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    }
  },

  showNavigationFailure(actionKey: string, message: string) {
    this.setData({ actionErrorKey: actionKey, actionErrorMessage: message })
  },

  navigateToExistingOrRedirect(
    targetStep: AssessmentStepId,
    action: string,
    actionErrorKey: string,
    focusSpecialCare = false,
  ) {
    this.clearActionError()
    const onFailure = () => {
      this.showNavigationFailure(actionErrorKey, '暂时无法返回修改，请稍后重试。')
    }
    navigateProfileToAssessmentStep(this, targetStep, 'profile-edit', action, onFailure, focusSpecialCare)
  },

  onEdit(event: WechatMiniprogram.BaseEvent) {
    const section = event.currentTarget.dataset.section
    if (!isProfileEditSection(section)) {
      return
    }
    this.navigateToExistingOrRedirect(
      section,
      `profile.edit.${section}`,
      `edit-${section}`,
      section === 'cognitive' && event.currentTarget.dataset.focusSpecialCare === true,
    )
  },

  onRecover() {
    const step = getAssessmentStepFromRoute(this.data.recoveryRoute)
    this.clearActionError()
    const onFailure = () => {
      this.showNavigationFailure('recovery', '暂时无法返回补充评估，请稍后重试。')
    }
    if (step) {
      navigateProfileToAssessmentStep(this, step, 'profile-recovery', 'profile.recover', onFailure)
    } else {
      navigateProfileToIntro(this, 'profile.recover', onFailure)
    }
  },

  onOpenRecommendation() {
    this.clearActionError()
    let pages: WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>[] | null = null
    try {
      pages = getCurrentPages()
    } catch (_error) {
      pages = null
    }
    const current = pages && pages.length > 0 ? pages[pages.length - 1] : null
    if (!pages || !current || current !== this || current.route !== 'pages/assessment/profile') {
      this.showNavigationFailure('recommendation', '当前页面状态已变化，请返回后再查看机构推荐。')
      return
    }
    if (pages.length >= MAX_PROFILE_NAVIGATION_STACK_SIZE) {
      this.showNavigationFailure('recommendation', '页面层级已满，请先返回首页后再查看机构推荐。')
      return
    }
    runGuardedNavigation(this, 'profile.openRecommendation', (callbacks) => wx.navigateTo({
      url: '/pages/recommendation/result',
      success: callbacks.success,
      fail: callbacks.fail,
      complete: callbacks.complete,
    }), () => {
      this.showNavigationFailure('recommendation', '暂时无法打开机构推荐，请稍后重试。')
    })
  },

  onBackNavigationFailure() {
    this.showNavigationFailure('back', '暂时无法返回，请稍后重试。')
  },

  onHome() {
    this.clearActionError()
    runGuardedNavigation(this, 'profile.home', (callbacks) => wx.switchTab({
      url: '/pages/home/index',
      success: callbacks.success,
      fail: callbacks.fail,
      complete: callbacks.complete,
    }), () => {
      this.showNavigationFailure('home', '暂时无法返回首页，请稍后重试。')
    })
  },
})
