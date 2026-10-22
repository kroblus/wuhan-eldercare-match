import { openShowcase, unlock } from './navigation'
import { isDevelopmentBuild } from './development'
Page({
  data: { error: '', allowed: false },
  onLoad() { this.setData({ allowed: isDevelopmentBuild() }) },
  onShow() { unlock(this) },
  openVr() { if (this.data.allowed) openShowcase(this, 'pages/showcase/vr-real', () => this.setData({ error: '打开失败，请重试' })) },
  openMap() { if (this.data.allowed) openShowcase(this, 'pages/showcase/map-real', () => this.setData({ error: '打开失败，请重试' })) },
})
