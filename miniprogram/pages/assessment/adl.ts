import { registerRoutePage } from '../../utils/route-scaffold'

registerRoutePage({
  title: '日常生活能力',
  routeLabel: '评估 · 第 3 步 / 共 6 步',
  description: '通过进食、行动、如厕和转移等生活场景了解照护强度。',
  nextUrl: '/pages/assessment/cognitive',
  nextLabel: '下一步骨架',
  statusMessage: '后续将使用易懂的生活场景提问，内部 ADL 分类不会直接展示给用户。',
})
