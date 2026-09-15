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
