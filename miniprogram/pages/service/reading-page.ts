import { familyReading, reviewedOn } from '../../content/family-reading'
import { getNavigationGuard, resetNavigationGuard } from '../../utils/navigation-guard'

export const registerReadingPage = (topic: keyof typeof familyReading): void => {
  const article = familyReading[topic]
  Page({
    data: { article, reviewedOn, copyMessage: '', copyPending: false, navigationError: '',
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
