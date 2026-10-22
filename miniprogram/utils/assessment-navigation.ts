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
  showFailure?: () => void
}

interface AssessmentStackPage {
  route?: unknown
}

const ROUTE_BACK_LABELS: Record<string, string> = {
  'pages/home/index': '首页',
  'pages/assessment/intro': '评估说明',
  'pages/assessment/basic': '老人基本情况',
  'pages/assessment/health': '健康情况',
  'pages/assessment/adl': '生活自理情况',
  'pages/assessment/cognitive': '认知情况',
  'pages/assessment/preference': '入住偏好',
  'pages/assessment/budget': '预算安排',
  'pages/assessment/profile': '老人画像',
  'pages/assessment/history': '我的评估',
  'pages/mine/index': '我的',
}

const defaultNavigationApi: AssessmentBackNavigationApi = {
  getCurrentPages: () => getCurrentPages(),
  navigateBack: (options) => wx.navigateBack(options),
  redirectTo: (options) => wx.redirectTo(options),
  showFailure: () => wx.showToast({ title: '暂时无法返回，请重试。', icon: 'none' }),
}

const normalizeRoute = (route: unknown): string => {
  if (typeof route !== 'string') return ''
  return route.split(/[?#]/, 1)[0].replace(/^\/+/, '').replace(/\/+$/, '')
}

/** The visible back label follows the page the user will actually return to. */
export const getAssessmentBackText = (
  step: AssessmentStepId,
  api: Pick<AssessmentBackNavigationApi, 'getCurrentPages'> = defaultNavigationApi,
): string => {
  let pages: AssessmentStackPage[] = []
  try {
    pages = api.getCurrentPages() as AssessmentStackPage[]
  } catch (_error) {
    pages = []
  }

  const parent = pages.length > 1 ? pages[pages.length - 2] : null
  const parentRoute = normalizeRoute(parent && parent.route)
  const parentLabel = ROUTE_BACK_LABELS[parentRoute]
  if (parentLabel) return `返回${parentLabel}`
  if (parentRoute) return '返回上一页'

  const fallbackRoute = normalizeRoute(ASSESSMENT_BACK_ROUTES[step])
  return `返回${ROUTE_BACK_LABELS[fallbackRoute] || '上一页'}`
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
  let navigationSucceeded = false
  let failureNotified = false
  const handleFailure = () => {
    if (failureNotified) return
    failureNotified = true
    if (api.showFailure) api.showFailure()
  }

  try {
    if (pages.length > 1) {
      api.navigateBack({
        delta: 1,
        success: () => { navigationSucceeded = true },
        fail: handleFailure,
        complete: () => { if (!navigationSucceeded) handleFailure() },
      })
      return 'navigateBack'
    }

    api.redirectTo({
      url: ASSESSMENT_BACK_ROUTES[step],
      success: () => { navigationSucceeded = true },
      fail: handleFailure,
      complete: () => { if (!navigationSucceeded) handleFailure() },
    })
    return 'redirectTo'
  } catch (_error) {
    handleFailure()
    return pages.length > 1 ? 'navigateBack' : 'redirectTo'
  }
}
