import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '机构详情',
  routeLabel: '机构 · 详情骨架',
  description: '机构详情会串联真实信息、匹配理由、VR、图片、顾问和预约入口。',
  nextUrl: '/pages/institution/vr',
  nextLabel: '进入 VR 看院骨架',
  statusMessage: '详情页只展示真实机构字段；缺失内容明确标记为暂无数据或需咨询。',
})
