import { createRouteScaffoldData } from '../../utils/route-scaffold'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
import type { RouteScaffoldData } from '../../utils/route-scaffold'

const APPOINTMENT_LIST_URL = '/pages/appointment/index'
const APPOINTMENT_NAVIGATION_ACTION = 'mine.openAppointments'
const HISTORY_LIST_URL = '/pages/assessment/history'
const HISTORY_NAVIGATION_ACTION = 'mine.openAssessmentHistory'

interface MinePageData extends RouteScaffoldData {
  appointmentNavigationErrorMessage: string
  historyNavigationErrorMessage: string
}

const routeData = createRouteScaffoldData({
  title: '我的',
  routeLabel: '我的 · 匿名浏览',
  description: '暂不登录也可以浏览首页、机构、图片、VR 和填写评估。',
  nextUrl: '/pages/elder/index',
  nextLabel: '查看老人档案骨架',
  statusMessage: '登录、手机号授权和历史保存只在对应场景按需触发，不在进入小程序时强制要求。',
  backEnabled: false,
})

Component({
  data: {
    ...routeData,
    appointmentNavigationErrorMessage: '',
    historyNavigationErrorMessage: '',
  } as MinePageData,

  pageLifetimes: {
    show() {
      resetNavigationGuard(this)
    },
  },

  methods: {
    navigateNext() {
      const { nextUrl, nextIsTab } = this.data as MinePageData
      if (!nextUrl) return
      if (nextIsTab) {
        wx.switchTab({ url: nextUrl })
        return
      }
      navigateToWithGuard(this, 'mine.navigateNext', nextUrl, undefined, () => {
        wx.showToast({ title: '暂时无法打开老人档案，请稍后重试。', icon: 'none' })
      })
    },

    openAssessmentHistory() {
      this.setData({ historyNavigationErrorMessage: '' })
      navigateToWithGuard(
        this,
        HISTORY_NAVIGATION_ACTION,
        HISTORY_LIST_URL,
        undefined,
        () => {
          this.setData({
            historyNavigationErrorMessage: '暂时无法打开我的评估，请稍后重试。',
          })
        },
      )
    },

    openAppointments() {
      this.setData({ appointmentNavigationErrorMessage: '' })
      navigateToWithGuard(
        this,
        APPOINTMENT_NAVIGATION_ACTION,
        APPOINTMENT_LIST_URL,
        undefined,
        () => {
          this.setData({
            appointmentNavigationErrorMessage: '暂时无法打开我的预约，请稍后重试。',
          })
        },
      )
    },
  },
})
