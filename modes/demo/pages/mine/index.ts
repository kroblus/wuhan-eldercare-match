import { readDemo } from '../../demo/session'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
Page({
  data: { fontStyle: '', elders: 0, assessments: 0, appointments: 0, error: '' },
  onShow() { resetNavigationGuard(this); const s = readDemo(); this.setData({ fontStyle: readBrowseFontStyle(), elders: s.elders.length, assessments: s.assessments.length, appointments: s.flows.length }) },
  open(url: string) { navigateToWithGuard(this, 'mine.demo.record', url, undefined, () => this.setData({ error: '暂时无法打开记录，请重试。' })) },
  navigateNext() { this.open('/pages/elder/index') },
  openAssessmentHistory() { this.open('/pages/assessment/history') },
  openAppointments() { this.open('/pages/appointment/index') },
  settings() { this.open('/pages/showcase/index') },
})
