import { parseInstitutionDetailRouteQuery } from '../../services/institution-detail-route'
import type { InstitutionDetailRoute } from '../../services/institution-detail-route'
import { resolveInstitutionVrResource } from '../../services/institution-vr-resource'

const routes = new WeakMap<object, InstitutionDetailRoute>()
const generations = new WeakMap<object, number>()
Page({
  data: { url: '', loading: true, message: '', name: '' },
  onLoad(query: Record<string, string | undefined>) {
    const parsed = parseInstitutionDetailRouteQuery(query || {})
    if (!parsed.ok) {
      this.setData({ loading: false, message: '机构链接无效，请返回机构详情重新进入。' })
      return
    }
    routes.set(this, parsed.value)
    this.loadResource()
  },
  onUnload() { generations.delete(this); routes.delete(this) },
  loadResource() {
    const route = routes.get(this)
    if (!route) return
    const generation = (generations.get(this) || 0) + 1
    generations.set(this, generation)
    this.setData({ loading: true, url: '', message: '' })
    resolveInstitutionVrResource(route).then(resource => {
      if (generations.get(this) !== generation) return
      this.setData(resource
        ? { loading: false, url: resource.url, name: resource.name, message: '' }
        : { loading: false, url: '', message: '当前没有可用的已核验全景资料，请返回机构详情。' })
    }).catch(() => {
      if (generations.get(this) === generation) this.setData({ loading: false, url: '', message: '全景资料读取失败，请重试或返回。' })
    })
  },
  onWebError() {
    this.setData({ url: '', loading: false, message: '全景页面未能打开，请重试或返回。' })
  },
})
