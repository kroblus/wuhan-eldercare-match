import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '合作机构列表',
  routeLabel: '机构 · 武汉合作机构',
  description: '这里只展示平台已核验的精选机构池；真实资料接入前不展示虚构价格、能力或床位信息。',
  nextUrl: '/pages/institution/detail',
  nextLabel: '查看机构详情骨架',
})
