import { readDemo, simulateAppointment } from '../../demo/session'
import { resolveStory, StoryContext } from '../../demo/story'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
Page({
  data: { fontStyle: '', story: null as StoryContext | null, state: '', visitId: '', epoch: -1, saved: false, evaluated: false, error: '' },
  async onLoad(query: Record<string,string>) {
    const story = await resolveStory(query).catch(() => null)
    this.setData({ story, epoch: readDemo().epoch, error: story ? '' : '无法确认该机构，请返回详情重新进入。' }); this.refresh()
  },
  onShow() { resetNavigationGuard(this); this.setData({ fontStyle: readBrowseFontStyle() }); this.refresh() },
  refresh() { const s = readDemo(), flow = s.ready && this.data.story && this.data.story.epoch === s.epoch && s.flows.find(f => f.institutionId === this.data.story!.institutionId && f.recordRevision === this.data.story!.recordRevision); this.setData({ state: flow ? flow.appointmentStatus : '', visitId: flow ? flow.visitId : '', evaluated: !!flow && !!flow.evaluation }) },
  confirm() {
    const story = this.data.story, s = readDemo()
    if (!story || !s.ready || story.epoch !== s.epoch) { this.setData({ error: '演示会话已变化，请返回机构详情。' }); return }
    try { simulateAppointment(story.institutionId, story.epoch); this.setData({ saved: true }); this.refresh() }
    catch (_) { this.setData({ error: '演示安排暂未保存，请返回重试。' }) }
  },
  records() { navigateToWithGuard(this, 'demo.book.records', '/pages/appointment/index', undefined, () => this.setData({ error: '暂时无法打开预约记录。' })) },
  evaluate() {
    this.refresh()
    if (this.data.state !== 'completed' || !this.data.visitId) return
    navigateToWithGuard(this, 'demo.book.evaluate', '/pages/visit/evaluation?visitId=' + encodeURIComponent(this.data.visitId), undefined, () => this.setData({ error: '暂时无法打开评价。' }))
  },
})
