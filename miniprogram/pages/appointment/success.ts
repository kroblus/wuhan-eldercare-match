import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '预约申请结果',
  routeLabel: '预约 · 结果骨架',
  description: '只有真实提交结果返回后才能进入此页；提交申请不等于顾问已经确认接待。',
  nextUrl: '/pages/appointment/index',
  nextLabel: '查看我的预约骨架',
  statusMessage: '状态必须展示为后端或顾问运营侧的业务事实，不由前端自行推断。',
})
