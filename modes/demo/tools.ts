import directory from '../../demo/directory.json'
import { loadDemo, readDemo, resetDemo, simulateAppointment, simulateVisit, simulateEvaluation } from '../../demo/session'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

Component({
  properties: {
    compactHome: { type: Boolean, value: false },
    serviceOnly: { type: Boolean, value: false },
    institutionId: { type: String, value: '', observer(value: string) {
      const index = directory.findIndex(row => row.institutionId === value)
      if (index >= 0) { this.setData({ selectedIndex: index }); this.refresh() }
    } },
  },
  data: { confirming: false, ready: false, loading: false, epoch: 0, status: '', error: '', selectedIndex: 0, selectedName: '', names: directory.map(r => r.displayName), serviceState: '', ratingIndex: 3, ratings: ['1 分','2 分','3 分','4 分','5 分'] },
  lifetimes: { attached() { this.refresh() } },
  pageLifetimes: { show() { resetNavigationGuard(this); this.refresh() } },
  methods: {
    refresh() {
      const state = readDemo(), selected = directory[this.data.selectedIndex]
      const flow = state.flows.find(f => f.institutionId === selected.institutionId)
      this.setData({ ready: state.ready, epoch: state.epoch, selectedName: selected.displayName,
        status: state.ready ? '已加载 12 家虚构机构和评估样例；可修改评估后重新匹配。' : '尚未加载演示资料。',
        serviceState: flow ? flow.state : '' })
    },
    async load() {
      if (this.data.loading || this.data.confirming) return
      this.setData({ loading: true, error: '' })
      try { await loadDemo(); this.refresh(); this.triggerEvent('changed', {}, { bubbles: false, composed: false }) }
      catch (_) { this.refresh(); this.setData({ error: '演示资料加载失败，请重试。' }) }
      finally { this.setData({ loading: false }) }
    },
    reset() {
      if (this.data.loading || this.data.confirming) return
      const expectedEpoch = readDemo().epoch
      this.setData({ confirming: true, error: '' })
      const fail = () => this.setData({ confirming: false, error: '暂时无法确认重置，请重试。' })
      try {
        wx.showModal({ title: '重置演示记录', content: '重置后将清除本次演示记录，是否继续？', confirmText: '重置', cancelText: '取消',
          success: result => {
            if (!result.confirm) return
            if (readDemo().epoch !== expectedEpoch) { this.setData({ error: '演示记录已更新，请重新确认。' }); return }
            resetDemo(); this.refresh(); this.triggerEvent('changed', {}, { bubbles: false, composed: false })
          }, fail, complete: () => this.setData({ confirming: false }) })
      } catch (_error) { fail() }
    },
    open(event: WechatMiniprogram.BaseEvent) {
      if (!this.data.ready || this.data.loading) return
      const target = event.currentTarget.dataset.target
      const routes: { [key: string]: string } = { institutions: '/pages/institution/index', profile: '/pages/assessment/profile', recommendation: '/pages/recommendation/result', vr: '/pages/showcase/vr-real', map: '/pages/showcase/map-real' }
      const url = routes[target]
      if (url) navigateToWithGuard(this, 'demo.open', url, undefined, () => this.setData({ error: '打开失败，请重试。' }))
    },
    selectInstitution(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value)
      if (!Number.isInteger(index) || !directory[index]) return
      this.setData({ selectedIndex: index, error: '' }); this.refresh()
    },
    selectRating(event: WechatMiniprogram.PickerChange) { this.setData({ ratingIndex: Number(event.detail.value) }) },
    simulate(event: WechatMiniprogram.BaseEvent) {
      if (!this.data.ready || this.data.loading) return
      const id = directory[this.data.selectedIndex].institutionId
      try {
        const action = event.currentTarget.dataset.action
        if (action === 'appointment') simulateAppointment(id, this.data.epoch)
        else if (action === 'visit') simulateVisit(id, this.data.epoch)
        else if (action === 'evaluation') simulateEvaluation(id, this.data.epoch, this.data.ratingIndex + 1)
        this.setData({ error: '' }); this.refresh()
      } catch (_) { this.setData({ error: '当前演示状态已变化，请重新加载资料后重试。' }) }
    },
  },
})
