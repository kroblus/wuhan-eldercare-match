import { resolveShowcaseContext, backFromShowcase } from '../../runtime/showcase-context'
import type { ShowcaseContext } from '../../types/showcase-context'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { unlock } from './navigation'
import { isDevelopmentBuild } from './development'
// Broad Wuhan city viewport only. This is not an institution or a POI coordinate.
export const cityView = { latitude: 30.59, longitude: 114.30, scale: 11 }
interface MapRuntime { active: boolean; generation: number; timer: ReturnType<typeof setTimeout> | null; read: number }
const runtimes = new WeakMap<object, MapRuntime>()
Page({
  data: { story: null as ShowcaseContext | null, fontStyle: '', allowed: false, latitude: cityView.latitude, longitude: cityView.longitude, scale: cityView.scale,
    center: '武汉城区初始视野', mapVisible: false, mapId: 'city-0', loading: true, updated: false, error: '' },
  onLoad(query: Record<string, string | undefined> = {}) { this.setData({ allowed: isDevelopmentBuild() && !query.institutionId, fontStyle: readBrowseFontStyle() }); runtimes.set(this, { active: false, generation: 0, timer: null, read: 0 })
    if (query.institutionId) resolveShowcaseContext(query).then(story => {
      if (!runtimes.has(this)) return
      this.setData({ story, allowed: !!story && story.mediaAvailable, error: story && story.mediaAvailable ? '' : '机构演示链接不可用，请返回详情。' })
      if (story && story.mediaAvailable) this.retryMap()
    })
  },
  onShow() { unlock(this); const runtime = runtimes.get(this)!; runtime.active = true; this.retryMap() },
  onHide() { this.stopMap() },
  onUnload() { this.stopMap(); runtimes.delete(this) },
  stopMap() {
    const runtime = runtimes.get(this)
    if (!runtime) return
    runtime.active = false; runtime.generation++; runtime.read++
    if (runtime.timer !== null) clearTimeout(runtime.timer)
    runtime.timer = null
    this.setData({ mapVisible: false })
  },
  retryMap() {
    const runtime = runtimes.get(this)!
    if (!this.data.allowed || !runtime.active) return
    const generation = ++runtime.generation
    if (runtime.timer !== null) clearTimeout(runtime.timer)
    this.setData({ mapVisible: false, loading: true, updated: false, error: '' }, () => {
      if (!runtime.active || runtime.generation !== generation) return
      this.setData({ mapVisible: true, mapId: 'city-' + generation, ...cityView, center: '武汉城区初始视野' })
      runtime.timer = setTimeout(() => {
        if (runtime.active && runtime.generation === generation && !this.data.updated) this.setData({ loading: false, error: '尚未收到原生地图更新；请检查网络或微信地图能力后重试。' })
      }, 12000)
    })
  },
  mapUpdated(event: { target: { id: string } }) {
    const runtime = runtimes.get(this)!
    if (!runtime.active || event.target.id !== this.data.mapId) return
    if (runtime.timer !== null) clearTimeout(runtime.timer)
    runtime.timer = null
    // An updated event is not proof that all remote tiles loaded successfully.
    this.setData({ loading: false, updated: true, error: '' })
    this.readCenter()
  },
  regionChanged(event: { target: { id: string }; type: string; detail?: { type?: string } }) {
    if (event.target.id !== this.data.mapId) return
    if (event.type === 'end' || (event.detail && event.detail.type === 'end')) this.readCenter()
  },
  readCenter() {
    const runtime = runtimes.get(this)!
    if (!runtime.active || !this.data.mapVisible) return
    const generation = runtime.generation, read = ++runtime.read
    try {
      wx.createMapContext(this.data.mapId, this).getCenterLocation({
        success: center => {
          if (!runtime.active || runtime.generation !== generation || runtime.read !== read) return
          if (Number.isFinite(center.latitude) && Number.isFinite(center.longitude)) this.setData({ center: center.latitude.toFixed(5) + ', ' + center.longitude.toFixed(5) + ' · GCJ-02' })
        }, fail: () => {
          if (runtime.active && runtime.generation === generation && runtime.read === read) this.setData({ center: '无法读取中心点，请拖动后重试' })
        },
      })
    } catch (_) { this.setData({ center: '当前环境无法读取地图中心点' }) }
  },
  resetMap() { this.retryMap() },
  reportBlank() { this.setData({ error: '若底图空白或加载失败，请检查网络、开发者权限及地图能力，再点击重试。原生 updated 事件不能代替底图目视验收。' }) },
  back() { backFromShowcase(this, this.data.story, () => this.setData({ error: '暂时无法返回，请重试。' })) },
})
