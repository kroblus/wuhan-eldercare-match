import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '老人基本情况',
  routeLabel: '评估 · 第 1 步 / 共 6 步',
  description: '建立老人基础档案，后续评估和历史记录会围绕这份档案关联。',
  nextUrl: '/pages/assessment/health',
  nextLabel: '下一步骨架',
})
