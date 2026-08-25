import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '评估结果与机构推荐',
  routeLabel: '推荐 · 结果骨架',
  description: '先解释老人当前更需要什么，再展示基于真实机构数据的推荐理由。',
  nextUrl: '/pages/institution/detail',
  nextLabel: '查看机构详情骨架',
  statusMessage: '推荐结果必须绑定 assessmentId，并以真实护理能力、预算和区域数据生成。',
})
