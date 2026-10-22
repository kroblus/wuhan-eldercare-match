import { navigateToWithGuard, resetNavigationGuard } from './navigation-guard'

export interface RouteScaffoldConfig {
  title: string
  routeLabel: string
  description: string
  nextUrl?: string
  nextLabel?: string
  nextIsTab?: boolean
  backEnabled?: boolean
  statusMessage?: string
}

export interface RouteScaffoldData {
  pageTitle: string
  routeLabel: string
  description: string
  nextUrl: string
  nextLabel: string
  nextIsTab: boolean
  showNext: boolean
  backEnabled: boolean
  statusMessage: string
}

export const createRouteScaffoldData = (config: RouteScaffoldConfig): RouteScaffoldData => {
  const nextUrl = config.nextUrl || ''

  return {
    pageTitle: config.title,
    routeLabel: config.routeLabel,
    description: config.description,
    nextUrl,
    nextLabel: config.nextLabel || '继续查看骨架',
    nextIsTab: config.nextIsTab === true,
    showNext: nextUrl.length > 0,
    backEnabled: config.backEnabled !== false,
    statusMessage: config.statusMessage || '本页已建立路由与页面壳层，业务字段将在后续契约冻结后实现。',
  }
}

export const registerRoutePage = (config: RouteScaffoldConfig): void => {
  Component({
    data: createRouteScaffoldData(config),
    pageLifetimes: {
      show() {
        resetNavigationGuard(this)
      },
    },
    methods: {
      navigateNext() {
        const { nextUrl, nextIsTab } = this.data as RouteScaffoldData
        if (nextUrl) {
          if (nextIsTab) {
            wx.switchTab({ url: nextUrl })
          } else {
            navigateToWithGuard(this, 'route-scaffold.next', nextUrl, undefined, () => {
              wx.showToast({ title: '暂时无法打开此页面，请稍后重试。', icon: 'none' })
            })
          }
        }
      },
    },
  })
}
