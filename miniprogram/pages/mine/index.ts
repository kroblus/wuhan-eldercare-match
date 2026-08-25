import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '我的',
  routeLabel: '我的 · 匿名浏览',
  description: '暂不登录也可以浏览首页、机构、图片、VR 和填写评估。',
  nextUrl: '/pages/elder/index',
  nextLabel: '查看老人档案骨架',
  statusMessage: '登录、手机号授权和历史保存只在对应场景按需触发，不在进入小程序时强制要求。',
  backEnabled: false,
})
