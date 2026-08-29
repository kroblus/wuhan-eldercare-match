import type { AssessmentStepId } from '../types/assessment'

/** 六步评估页面的返回兜底路径；仅用于根栈时恢复可理解的上一步。 */
const ASSESSMENT_BACK_ROUTES: Record<AssessmentStepId, string> = {
  basic: '/pages/assessment/intro',
  health: '/pages/assessment/basic',
  adl: '/pages/assessment/health',
  cognitive: '/pages/assessment/adl',
  preference: '/pages/assessment/cognitive',
  budget: '/pages/assessment/preference',
}

export interface AssessmentBackNavigationApi {
  getCurrentPages: () => unknown[]
  navigateBack: (options: WechatMiniprogram.NavigateBackOption) => unknown
  redirectTo: (options: WechatMiniprogram.RedirectToOption) => unknown
}

const defaultNavigationApi: AssessmentBackNavigationApi = {
  getCurrentPages: () => getCurrentPages(),
  navigateBack: (options) => wx.navigateBack(options),
  redirectTo: (options) => wx.redirectTo(options),
}

/**
 * 从评估步骤返回：已有来源页时保留微信返回栈，直达根页时跳到明确的上一步。
 * 该 helper 不校验答案、不清理草稿，页面返回后由 onShow 负责恢复显示态。
 */
export const navigateBackFromAssessment = (
  step: AssessmentStepId,
  api: AssessmentBackNavigationApi = defaultNavigationApi,
): 'navigateBack' | 'redirectTo' => {
  const pages = api.getCurrentPages()
  if (pages.length > 1) {
    api.navigateBack({ delta: 1 })
    return 'navigateBack'
  }

  api.redirectTo({ url: ASSESSMENT_BACK_ROUTES[step] })
  return 'redirectTo'
}
