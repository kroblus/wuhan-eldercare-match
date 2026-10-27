import { familyReading, reviewedOn } from '../../content/family-reading'
import { getNavigationGuard, navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

export const registerReadingPage = (topic: keyof typeof familyReading): void => {
  const article = familyReading[topic]
  Page({
    data: { article, topic, reviewedOn, copyMessage: '', copyPending: false, navigationError: '',
      sections: article.sections.map((section, index) => ({ ...section, number: '0' + (index + 1),
        heading: topic === 'admission' && index === 3 ? '与机构确认参观' : section.title.split(' / ')[1] || section.title })),
      related: (['policy', 'education', 'admission'] as const).filter(key => key !== topic).map(key => ({ topic: key, title: familyReading[key].title })),
      primarySource: article.sources[0],
      expired: topic === 'policy' && Date.now() > Date.parse('2026-12-31T23:59:59+08:00') },
    onShow() { resetNavigationGuard(this) },
    onCopySource(event: WechatMiniprogram.BaseEvent) {
      if (this.data.copyPending) return
      const source = article.sources.find(row => row.id === event.currentTarget.dataset.sourceId)
      if (!source) return
      this.setData({ copyMessage: '', copyPending: true })
      const fail = () => this.setData({ copyPending: false, copyMessage: '暂时无法复制，可长按来源网址复制后在浏览器查看。' })
      try {
        wx.setClipboardData({ data: source.url, success: () => this.setData({ copyMessage: '已复制官方来源网址，可在浏览器核对原文。' }), fail,
          complete: () => this.setData({ copyPending: false }) })
      } catch (_error) { fail() }
    },
    onNavigationFailure() { this.setData({ navigationError: '暂时无法返回，请重试。' }) },
    openRelated(event: WechatMiniprogram.BaseEvent) {
      const key = event.currentTarget.dataset.topic
      if (['policy', 'education', 'admission'].indexOf(key) < 0 || key === topic) return
      this.setData({ navigationError: '' })
      navigateToWithGuard(this, 'reading.related', '/pages/service/' + key + '/index', undefined, () => {
        this.setData({ navigationError: '暂时无法打开相关内容，请重试。' })
      })
    },
    goHome() {
      const guard = getNavigationGuard(this), action = 'reading.home'
      if (!guard.acquire(action)) return
      this.setData({ navigationError: '' })
      let succeeded = false
      const fail = () => { guard.release(action); this.onNavigationFailure() }
      try { wx.switchTab({ url: '/pages/home/index', success: () => { succeeded = true }, fail, complete: () => { if (!succeeded) fail() } }) }
      catch (_error) { fail() }
    },
  })
}
