// Development-only destinations. Never fall back into a business page.
export const showcaseRoot = 'pages/showcase/index'
const destinations = [showcaseRoot, 'pages/showcase/vr-real', 'pages/showcase/map-real']
const locks = new WeakSet<object>()
export function unlock(page: object): void { locks.delete(page) }
export function openShowcase(page: object, destination: string, fail: () => void): void {
  if (destinations.indexOf(destination) < 0 || locks.has(page)) return
  locks.add(page)
  try {
    wx.navigateTo({ url: '/' + destination, fail: () => { unlock(page); fail() } })
  } catch (_) { unlock(page); fail() }
}
export function backToShowcase(page: object, fail: () => void): void {
  if (locks.has(page)) return
  locks.add(page)
  const pages = getCurrentPages()
  const previous = pages[pages.length - 2]
  const failure = () => { unlock(page); fail() }
  try {
    if (previous && previous.route === showcaseRoot) wx.navigateBack({ delta: 1, fail: failure })
    else wx.redirectTo({ url: '/' + showcaseRoot, fail: failure })
  } catch (_) { failure() }
}
