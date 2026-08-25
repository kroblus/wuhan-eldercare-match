import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '老人需求画像',
  routeLabel: '评估 · 信息确认',
  description: '让家属先确认系统是否理解准确，再进入机构推荐。',
  nextUrl: '/pages/recommendation/result',
  nextLabel: '生成推荐骨架',
  statusMessage: '后续会把原始答案转换成人话总结，不直接暴露内部 ADL 评分。',
})
