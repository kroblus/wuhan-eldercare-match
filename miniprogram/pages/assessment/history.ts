import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '我的评估',
  routeLabel: '我的 · 历史评估',
  description: '历史记录将按老人和 Assessment 绑定，重新评估不会覆盖旧结果。',
  nextUrl: '/pages/recommendation/result',
  nextLabel: '查看结果骨架',
})
