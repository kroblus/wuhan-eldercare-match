import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '老人档案详情',
  routeLabel: '我的 · 档案详情',
  description: '详情会把原始答案转换成可读摘要，并保留最近评估时间和历史 Assessment。',
  nextUrl: '/pages/assessment/history',
  nextLabel: '查看我的评估骨架',
  statusMessage: '重新评估必须创建新的 Assessment，不覆盖旧结果；当前不展示虚拟老人信息。',
})
