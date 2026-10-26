import { readDemo } from './session'
import { createRecommendationResultViewModelV2 } from '../pages/recommendation/result-v2-view-model'
import { APPOINTMENT_LIST_FILTERS } from '../pages/appointment/list-view-model'
import { navigateToWithGuard, resetNavigationGuard } from '../utils/navigation-guard'
import directory from './directory.json'
import { basicRecordRows, savedProfileRows, assessmentSummary } from './record-presentation'
import { formatChinaDateTime } from '../utils/display-date'
import { readBrowseFontStyle } from '../utils/browse-font'
import { storyDisplayName } from './story-name'
import { appointmentTimePresentation } from './appointment-time'

const labels: Record<string, string> = { requested: '待确认', contacting: '待确认', scheduled: '已确认', completed: '已完成', cancelled: '已取消' }
export function registerDemoRecords(kind: 'elders' | 'elder' | 'history' | 'appointments'): void {
  const routes = new WeakMap<object, Record<string, string>>()
  Page({
    data: { title: kind === 'history' ? '我的评估' : kind === 'appointments' ? '我的预约' : kind === 'elder' ? '老人档案详情' : '老人档案',
      viewKind: kind, fontStyle: '', basicRows: [] as Array<{ label: string; value: string }>, selectedName: '',
      recommendationGroups: [] as any[],
      rows: [] as any[], profileRows: [] as any[], recommendation: null as any, snapshotTime: '',
      ready: false, selected: false, filters: kind === 'appointments' ? APPOINTMENT_LIST_FILTERS : [], filter: 'all', error: '' },
    onLoad(query: Record<string, string>) { routes.set(this, query || {}) },
    onUnload() { routes.delete(this) },
    onShow() { resetNavigationGuard(this); this.setData({ fontStyle: readBrowseFontStyle() }); this.refresh() },
    refresh() {
      const state = readDemo()
      const route = routes.get(this) || {}
      let rows: any[] = [], profileRows: any[] = [], recommendation: any = null, snapshotTime = '', basicRows: any[] = []
      const selected = kind === 'history' ? state.assessments.find(a => a.assessmentId === route.assessmentId)
        : kind === 'elder' ? state.assessments.filter(a => a.elderId === route.elderId).sort((a, b) => b.assessmentSnapshot.completedAt.localeCompare(a.assessmentSnapshot.completedAt))[0] : undefined
      if (kind === 'elders') rows = state.elders.map(e => {
        const record = state.assessments.filter(a => a.elderId === e.elderId).sort((a, b) => b.assessmentSnapshot.completedAt.localeCompare(a.assessmentSnapshot.completedAt))[0]
        return { id: e.elderId, title: e.name.replace(/^演示老人[·・]/, ''), subtitle: record ? basicRecordRows(record).map(r => r.value).join(' · ') : '基本情况待补充',
          summary: record ? assessmentSummary(record) : '尚无已完成的评估', timeLabel: '最近评估',
          time: record ? formatChinaDateTime(record.assessmentSnapshot.completedAt) : '暂无记录', action: '查看档案',
          url: '/pages/elder/detail?elderId=' + encodeURIComponent(e.elderId) }
      })
      if (kind === 'elder' || kind === 'history') {
        rows = state.assessments.filter(a => !route.elderId || a.elderId === route.elderId)
          .sort((a, b) => b.assessmentSnapshot.completedAt.localeCompare(a.assessmentSnapshot.completedAt))
          .map(a => ({ id: a.assessmentId, title: state.elders.find(e => e.elderId === a.elderId)!.name.replace(/^演示老人[·・]/, ''),
            subtitle: '已完成评估', timeLabel: '完成时间', time: formatChinaDateTime(a.assessmentSnapshot.completedAt),
            summary: assessmentSummary(a), action: '查看评估结果',
            url: '/pages/assessment/history?assessmentId=' + encodeURIComponent(a.assessmentId) }))
        if (selected) {
          basicRows = basicRecordRows(selected)
          profileRows = savedProfileRows(selected)
          recommendation = createRecommendationResultViewModelV2(selected.recommendationSnapshot)
          snapshotTime = formatChinaDateTime(selected.assessmentSnapshot.completedAt)
        }
      }
      if (kind === 'appointments') rows = state.flows.filter(f => this.data.filter === 'all'
        || (this.data.filter === 'awaiting' ? ['requested', 'contacting'].includes(f.appointmentStatus)
          : this.data.filter === 'confirmed' ? f.appointmentStatus === 'scheduled' : f.appointmentStatus === this.data.filter))
        .map(f => ({ id: f.appointmentId, title: storyDisplayName(f.institutionId, (directory.find(r => r.institutionId === f.institutionId) || { displayName: '机构资料不可用' }).displayName), subtitle: labels[f.appointmentStatus],
          ...appointmentTimePresentation(f.appointmentStatus), summary: f.appointmentStatus === 'completed' ? '本次看院已完成，可记录或查看现场感受。' : f.appointmentStatus === 'cancelled' ? '预约已取消。' : '安排以确认结果为准。',
          status: f.appointmentStatus, action: f.appointmentStatus === 'completed' ? f.evaluation ? '查看看院评价' : '填写看院评价' : '',
          url: f.appointmentStatus === 'completed' ? '/pages/visit/evaluation?visitId=' + encodeURIComponent(f.visitId) : '',
          detailUrl: '/pages/institution/detail?institutionId=' + encodeURIComponent(f.institutionId) + '&recordRevision=' + f.recordRevision }))
      this.setData({ ready: state.ready, rows, basicRows, profileRows, recommendation, snapshotTime, selected: !!selected,
        recommendationGroups: recommendation ? [{ title: '推荐候选', cards: recommendation.cards }, { title: '需要进一步确认', cards: recommendation.conditionalCards }].map(group => ({ ...group,
          cards: group.cards.map((card: { name: string }) => ({ ...card, name: card.name.replace(/^演示名称[：:]\s*/, '').replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, '') })) })) : [],
        title: kind === 'history' && selected ? '历史评估结果' : this.data.title,
        selectedName: selected ? (state.elders.find(e => e.elderId === selected.elderId) || { name: '老人姓名未填写' }).name.replace(/^演示老人[·・]/, '') : '',
        error: (route.elderId || route.assessmentId) && !selected ? '这条演示记录不存在或已重置。' : '' })
    },
    filterRecords(event: WechatMiniprogram.BaseEvent) {
      const filter = event.currentTarget.dataset.filter
      if (!APPOINTMENT_LIST_FILTERS.some(f => f.key === filter)) return
      this.setData({ filter }); this.refresh()
    },
    openRecord(event: WechatMiniprogram.BaseEvent) {
      const { id, detail } = event.currentTarget.dataset
      const row = this.data.rows.find(r => r.id === id)
      const url = row && (detail ? row.detailUrl : row.url)
      if (url) navigateToWithGuard(this, 'demo.records', url, undefined, () => this.setData({ error: '打开失败，请重试。' }))
    },
  })
}
