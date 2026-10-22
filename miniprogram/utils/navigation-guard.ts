/**
 * 页面实例级导航保护。
 *
 * 这是事件根因修复后的第二层保险：同一 action 在一次页面生命周期内只允许
 * 发起一次 navigateTo。导航失败或同步抛错会释放锁；成功后由来源页 onShow
 * 重置，从而保证用户返回后可以再次导航。
 */

export class NavigationGuard {
  private readonly lockedActions: Set<string>

  constructor() {
    this.lockedActions = new Set<string>()
  }

  acquire(action: string): boolean {
    if (this.lockedActions.has(action)) {
      return false
    }
    this.lockedActions.add(action)
    return true
  }

  release(action: string): void {
    this.lockedActions.delete(action)
  }

  reset(): void {
    this.lockedActions.clear()
  }

  isLocked(action: string): boolean {
    return this.lockedActions.has(action)
  }
}

const instanceGuards = new WeakMap<object, NavigationGuard>()

export const getNavigationGuard = (instance: object): NavigationGuard => {
  const existingGuard = instanceGuards.get(instance)
  if (existingGuard) {
    return existingGuard
  }

  const guard = new NavigationGuard()
  instanceGuards.set(instance, guard)
  return guard
}

export const resetNavigationGuard = (instance: object): void => {
  getNavigationGuard(instance).reset()
}

export type NavigateToInvoker = (options: WechatMiniprogram.NavigateToOption) => unknown
export type NavigationFailureHandler = () => void

const defaultNavigateTo: NavigateToInvoker = (options) => wx.navigateTo(options)

export const navigateToWithGuard = (
  instance: object,
  action: string,
  url: string,
  navigateTo: NavigateToInvoker = defaultNavigateTo,
  onFailure?: NavigationFailureHandler,
): boolean => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire(action)) {
    return false
  }

  let navigationSucceeded = false
  let failureNotified = false
  const handleFailure = () => {
    guard.release(action)
    if (!failureNotified) {
      failureNotified = true
      if (onFailure) {
        onFailure()
      }
    }
  }
  try {
    navigateTo({
      url,
      success: () => {
        navigationSucceeded = true
      },
      fail: () => {
        handleFailure()
      },
      complete: () => {
        if (!navigationSucceeded) {
          handleFailure()
        }
      },
    })
  } catch {
    handleFailure()
    return false
  }

  return true
}

export type ExistingRouteFallback = 'navigateTo' | 'redirectTo'
export type ExistingRouteNavigationResult = 'navigateBack' | ExistingRouteFallback | null

interface ExistingRouteStackPage {
  route?: unknown
}

interface ExistingRouteNavigationOptions {
  url?: string
  delta?: number
  success?: () => void
  fail?: () => void
  complete?: () => void
}

const normalizeRoute = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const withoutQuery = value.split(/[?#]/, 1)[0]
  return withoutQuery.replace(/^\/+/, '').replace(/\/+$/, '')
}

const findExistingRouteAncestorIndex = (url: string, pages: ExistingRouteStackPage[]): number => {
  const targetRoute = normalizeRoute(url)
  for (let index = pages.length - 2; index >= 0; index -= 1) {
    if (normalizeRoute(pages[index] && pages[index].route) === targetRoute) return index
  }
  return -1
}

export const hasExistingRouteAncestor = (url: string): boolean => {
  try {
    const pages = getCurrentPages() as ExistingRouteStackPage[]
    return findExistingRouteAncestorIndex(url, pages) >= 0
  } catch (_error) {
    return false
  }
}

/**
 * Return to an existing non-Tab route when it is already in the page stack.
 * Otherwise use the caller's explicit fallback. This is intentionally local
 * stack navigation, not a global route policy.
 */
export const navigateToExistingRouteWithGuard = (
  instance: object,
  action: string,
  url: string,
  fallback: ExistingRouteFallback,
  onFailure?: NavigationFailureHandler,
): ExistingRouteNavigationResult => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire(action)) return null

  let pages: ExistingRouteStackPage[] = []
  try {
    pages = getCurrentPages() as ExistingRouteStackPage[]
  } catch (_error) {
    pages = []
  }

  const targetIndex = findExistingRouteAncestorIndex(url, pages)

  const useBack = targetIndex >= 0 && pages.length - 1 - targetIndex > 0
  const navigationResult: ExistingRouteNavigationResult = useBack ? 'navigateBack' : fallback
  const options: ExistingRouteNavigationOptions = useBack
    ? { delta: pages.length - 1 - targetIndex }
    : { url: url.charAt(0) === '/' ? url : `/${url}` }

  let navigationSucceeded = false
  let failureNotified = false
  const handleFailure = () => {
    guard.release(action)
    if (failureNotified) return
    failureNotified = true
    if (onFailure) onFailure()
  }

  options.success = () => {
    navigationSucceeded = true
  }
  options.fail = handleFailure
  options.complete = () => {
    if (!navigationSucceeded) handleFailure()
  }

  try {
    if (useBack) {
      wx.navigateBack(options as WechatMiniprogram.NavigateBackOption)
    } else if (fallback === 'redirectTo') {
      wx.redirectTo(options as WechatMiniprogram.RedirectToOption)
    } else {
      wx.navigateTo(options as WechatMiniprogram.NavigateToOption)
    }
  } catch (_error) {
    handleFailure()
    return null
  }

  return navigationResult
}
