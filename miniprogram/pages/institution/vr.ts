import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: 'VR 看院',
  routeLabel: '机构 · VR 看院',
  description: 'VR 是机构详情中的重要内容模块；只有接入真实平台地址后才能开放查看。',
  nextUrl: '/pages/consultant/index',
  nextLabel: '咨询养老顾问',
  nextIsTab: true,
})
