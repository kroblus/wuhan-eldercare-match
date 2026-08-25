import { createRouteScaffoldData } from '../../utils/route-scaffold'

const APPOINTMENT_URL = '/pages/appointment/create'

Component({
  data: {
    ...createRouteScaffoldData({
      title: '养老顾问',
      routeLabel: '顾问 · 武汉服务',
      description: '在画像、推荐、VR 和预约等关键节点，用户都可以找到顾问协助。',
      nextUrl: APPOINTMENT_URL,
      nextLabel: '查看预约看院骨架',
      statusMessage: '顾问姓名、头像、擅长方向和联系方式必须来自真实运营数据。',
      backEnabled: false,
    }),
    navigationError: false,
    navigationErrorMessage: '',
  },
  methods: {
    navigateToAppointment() {
      this.setData({
        navigationError: false,
        navigationErrorMessage: '',
      })
      wx.navigateTo({
        url: APPOINTMENT_URL,
        fail: (error) => {
          this.setData({
            navigationError: true,
            navigationErrorMessage: error.errMsg || '暂时无法打开预约页面，请稍后重试。',
          })
        },
      })
    },
    retryNavigate() {
      this.navigateToAppointment()
    },
  },
})
