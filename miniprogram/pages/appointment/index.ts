import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '我的预约',
  routeLabel: '我的 · 看院预约',
  description: '预约列表只展示后端或顾问运营侧返回的真实状态，不由前端自行推断。',
  nextUrl: '/pages/institution/index',
  nextLabel: '看看合作机构骨架',
})
