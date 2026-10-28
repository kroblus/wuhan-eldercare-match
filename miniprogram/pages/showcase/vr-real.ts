import { resolveShowcaseContext, backFromShowcase, panoramaNotice } from '../../runtime/showcase-context'
import type { ShowcaseContext } from '../../types/showcase-context'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { unlock } from './navigation'
import { isDevelopmentBuild } from './development'
import { inspectPanoramaJpeg } from './panorama-input'
import { panoramaSample } from '../../runtime/panorama-sample'
import { CanvasNode, SphereRenderer, TouchPoint, View, clamp, createSphereRenderer, initialView, moveView } from './sphere-renderer'
interface Runtime {
  active: boolean; ready: boolean; dead: boolean; generation: number; picking: boolean
  renderer: SphereRenderer | null; points: TouchPoint[]; view: View; calibration: boolean; pendingFile: string | null; sampleActive: boolean
}
const runtimes = new WeakMap<object, Runtime>()
type TouchEvent = { touches: Array<{ x?: number; y?: number; clientX?: number; clientY?: number }> }
function points(event: TouchEvent): TouchPoint[] {
  return event.touches.slice(0, 2).map(touch => ({ x: touch.x === undefined ? touch.clientX || 0 : touch.x, y: touch.y === undefined ? touch.clientY || 0 : touch.y }))
}
function release(runtime: Runtime): void {
  if (runtime.renderer) runtime.renderer.dispose()
  runtime.renderer = null; runtime.points = []
}
Page({
  data: { story: null as ShowcaseContext | null, fontStyle: '', allowed: false, canvasVisible: true, loading: false, rendered: false, choosing: false, notice: '等待 Owner 提供已脱敏、获授权的完整球形全景 JPEG。', source: '尚未加载照片', yaw: 0, pitch: 0, fov: 75, error: '' },
  onLoad(query: Record<string, string | undefined> = {}) {
    this.setData({ allowed: isDevelopmentBuild() && !query.institutionId, fontStyle: readBrowseFontStyle(), hasSample: !!panoramaSample })
    runtimes.set(this, { active: true, ready: false, dead: false, generation: 0, picking: false, renderer: null, points: [], view: initialView(), calibration: false, pendingFile: null, sampleActive: !!query.institutionId })
    if (query.institutionId) resolveShowcaseContext(query).then(story => {
      const runtime = runtimes.get(this)
      if (!runtime) return
      this.setData({ story, allowed: !!story && story.mediaAvailable, error: story && story.mediaAvailable ? '' : '机构演示链接不可用，请返回详情。' })
      if (story && story.mediaAvailable && runtime.ready) this.mountCanvas()
    })
  },
  onReady() { const runtime = runtimes.get(this)!; runtime.ready = true; this.mountCanvas() },
  onShow() {
    unlock(this)
    const runtime = runtimes.get(this)
    if (!runtime) return
    runtime.active = true
    if (runtime.ready) this.mountCanvas()
  },
  onHide() {
    const runtime = runtimes.get(this)!
    runtime.active = false; runtime.generation++; release(runtime)
    this.setData({ canvasVisible: false, rendered: false, loading: false, choosing: runtime.picking,
      source: runtime.calibration ? '几何校准纹理 · 非照片 / 非机构实景' : '尚未加载照片' })
  },
  onUnload() {
    const runtime = runtimes.get(this)!
    runtime.dead = true; runtime.active = false; runtime.generation++; runtime.pendingFile = null; release(runtime)
    runtimes.delete(this)
  },
  onResize() {
    const runtime = runtimes.get(this)!
    runtime.generation++; release(runtime)
    this.setData({ canvasVisible: false, rendered: false, source: '视口已变化，请重新选择照片或校准纹理' }, () => this.mountCanvas())
  },
  mountCanvas() {
    const runtime = runtimes.get(this)
    if (!this.data.allowed || !runtime || !runtime.active || runtime.dead || runtime.renderer) return
    const generation = ++runtime.generation
    this.setData({ canvasVisible: true }, () => wx.nextTick(() => {
      if (!runtime.active || runtime.dead || runtime.generation !== generation) return
      wx.createSelectorQuery().in(this).select('#panorama').fields({ node: true, size: true }).exec(result => {
        if (!runtime.active || runtime.dead || runtime.generation !== generation) return
        try {
          const target = result[0]
          if (!target || !target.node) throw new Error('CANVAS_MISSING')
          runtime.renderer = createSphereRenderer(target.node as CanvasNode, target.width, target.height, wx.getSystemInfoSync().pixelRatio, () => {
            if (!runtime.active || runtime.dead) return
            release(runtime)
            this.setData({ rendered: false, loading: false, error: 'WebGL 已中断或设备不支持，请重试；未使用平面图片替代。' })
          })
          if (runtime.calibration) this.useCalibration()
          if (runtime.sampleActive) this.useSample()
          else if (runtime.pendingFile) { const file = runtime.pendingFile; runtime.pendingFile = null; this.readLocalPhoto(file) }
        } catch (_) { this.setData({ loading: false, choosing: false, error: '无法初始化 WebGL，请使用支持 Canvas WebGL 的微信版本和设备后重试。' }) }
      })
    }))
  },
  retryCanvas() {
    const runtime = runtimes.get(this)!
    runtime.generation++; release(runtime)
    this.setData({ canvasVisible: false, rendered: false, error: '' }, () => this.mountCanvas())
  },
  useCalibration() {
    const runtime = runtimes.get(this)!
    if (!runtime.active || !runtime.renderer || this.data.choosing) return
    try {
      runtime.renderer.loadCalibration(); runtime.calibration = true; runtime.sampleActive = false; runtime.view = initialView()
      this.setData({ rendered: true, loading: false, source: '几何校准纹理 · 非照片 / 非家庭或机构实景', notice: '这是程序生成的经纬网格，只验证球面纹理与手势。真实家庭照片尚未验收。', error: '' })
      this.updateView()
    } catch (_) { release(runtime); this.setData({ rendered: false, loading: false, error: '纹理初始化失败，请重试 WebGL' }) }
  },
  useSample() {
    const runtime = runtimes.get(this)
    if (!panoramaSample || !runtime || !runtime.active || !runtime.renderer || this.data.choosing) return
    runtime.sampleActive = true
    runtime.calibration = false
    const generation = ++runtime.generation
    this.setData({ loading: true, rendered: false, error: '', source: '正在加载合成演示全景' })
    runtime.renderer.loadBundledSample(error => {
      if (!runtime.active || runtime.dead || runtime.generation !== generation) return
      this.setData({ loading: false, rendered: !error, source: 'AI 合成演示全景 · 非真实地点或机构实景',
        notice: panoramaNotice, error: error ? '合成全景加载失败，请重试。' : '' })
      if (!error) { runtime.view = initialView(); this.updateView() }
    })
  },
  chooseLocalPhoto() {
    const runtime = runtimes.get(this)!
    if (!runtime.active || !runtime.renderer || runtime.picking || this.data.loading || this.data.choosing) return
    this.setData({ choosing: true, error: '' })
    try {
      wx.showModal({ title: '仅加载授权演示副本', content: '请确认：你有权使用此照片；它是完整 360°×180° 等距柱状投影，已人工检查人物、门牌、证件、私人照片和文件，并清除了敏感信息与元数据。2:1 比例本身不能证明投影。此页只临时读取，不上传、不保存、不关联机构。', confirmText: '已检查', cancelText: '取消',
        success: result => {
          if (!runtime.active || runtime.dead) return
          if (!result.confirm) { this.setData({ choosing: false }); return }
          runtime.picking = true
          try {
            wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album'],
              success: response => {
                if (runtime.dead) return
                const file = response.tempFilePaths[0]
                if (!file) { runtime.picking = false; this.setData({ choosing: false, error: '未取得本地演示副本，请重试' }); return }
                if (!runtime.active || !runtime.renderer) { runtime.pendingFile = file; return }
                runtime.picking = false; this.readLocalPhoto(file)
              },
              fail: () => { if (!runtime.dead) { runtime.picking = false; this.setData({ choosing: false, error: '未选择照片或相册不可用；可重试或使用校准纹理' }) } },
            })
          } catch (_) { runtime.picking = false; this.setData({ choosing: false, error: '当前微信不支持本地相册选择' }) }
        },
        fail: () => { if (!runtime.dead) this.setData({ choosing: false, error: '无法打开确认，请重试' }) },
      })
    } catch (_) { this.setData({ choosing: false, error: '无法打开确认，请重试' }) }
  },
  readLocalPhoto(file: string) {
    const runtime = runtimes.get(this)!
    runtime.picking = false
    if (!runtime.active || !runtime.renderer) return
    runtime.calibration = false
    runtime.sampleActive = false
    const generation = ++runtime.generation
    this.setData({ choosing: false, rendered: false, loading: true, source: '正在检查本地 JPEG', error: '' })
    const current = () => !runtime.dead && runtime.active && runtime.generation === generation
    const failed = (message: string) => { if (current()) this.setData({ loading: false, rendered: false, source: '照片未通过加载', error: message }) }
    try {
      wx.getFileSystemManager().readFile({ filePath: file,
        success: response => {
          if (!current()) return
          try {
            if (typeof response.data === 'string') throw new Error('无法读取本地照片')
            const dimensions = inspectPanoramaJpeg(response.data)
            runtime.renderer!.loadLocal(file, dimensions.width, dimensions.height, error => {
              if (!current()) return
              if (error) { failed('纹理加载失败、文件尺寸超出设备能力或本地格式不兼容；请重试'); return }
              runtime.view = initialView()
              this.setData({ loading: false, rendered: true, source: 'Owner 确认的本地演示副本 · ' + dimensions.width + '×' + dimensions.height,
                notice: '完整球形投影由素材提供者确认；元数据与尺寸已检查。仅演示技术，不属于任何养老机构。', error: '' })
              this.updateView()
            })
          } catch (error) { failed(error instanceof Error ? error.message : '照片检查失败') }
        }, fail: () => failed('无法读取本地照片，请重新选择脱敏副本'),
      })
    } catch (_) { failed('当前设备不能读取本地副本') }
  },
  updateView() {
    const runtime = runtimes.get(this)!
    if (!runtime.active || !runtime.renderer || !this.data.rendered) return
    runtime.renderer.requestDraw(runtime.view)
    this.setData({ yaw: Math.round(runtime.view.yaw), pitch: Math.round(runtime.view.pitch), fov: Math.round(runtime.view.fov) })
  },
  touchStart(event: TouchEvent) { const runtime = runtimes.get(this)!; runtime.points = points(event) },
  touchMove(event: TouchEvent) {
    const runtime = runtimes.get(this)!, next = points(event)
    if (this.data.rendered) { runtime.view = moveView(runtime.view, runtime.points, next); this.updateView() }
    runtime.points = next
  },
  touchEnd(event: TouchEvent) { const runtime = runtimes.get(this)!; runtime.points = points(event) },
  zoomIn() { const runtime = runtimes.get(this)!; runtime.view.fov = clamp(runtime.view.fov - 10, 35, 100); this.updateView() },
  zoomOut() { const runtime = runtimes.get(this)!; runtime.view.fov = clamp(runtime.view.fov + 10, 35, 100); this.updateView() },
  resetView() { runtimes.get(this)!.view = initialView(); this.updateView() },
  back() { backFromShowcase(this, this.data.story, () => this.setData({ error: '暂时无法返回，请重试。' })) },
})
