import { parseInstitutionDetailRouteQuery } from '../../services/institution-detail-route'
import type { InstitutionDetailRoute } from '../../services/institution-detail-route'
import { resolveInstitutionVrResource } from '../../services/institution-vr-resource'
import { buildInstitutionDetailPageSnapshot } from '../../services/institution-list-detail-page'
import { readBrowseFontStyle } from '../../utils/browse-font'

const routes = new WeakMap<object, InstitutionDetailRoute>()
const generations = new WeakMap<object, number>()
Page({
  data: { fontStyle: '', url: '', loading: true, message: '', name: '', institutionId: '', recordRevision: 0, disclosure: '' },
  onShow() { this.setData({ fontStyle: readBrowseFontStyle() }) },
  onLoad(query: Record<string, string | undefined>) {
    const parsed = parseInstitutionDetailRouteQuery(query || {})
    if (!parsed.ok) {
      this.setData({ loading: false, message: '机构链接无效，请返回机构详情重新进入。' })
      return
    }
    routes.set(this, parsed.value)
    this.setData({ institutionId: parsed.value.identity.institutionId, recordRevision: parsed.value.identity.recordRevision })
    this.loadResource()
  },
  onUnload() { generations.delete(this); routes.delete(this) },
  loadResource() {
    const route = routes.get(this)
    if (!route) return
    const generation = (generations.get(this) || 0) + 1
    generations.set(this, generation)
    this.setData({ loading: true, url: '', message: '' })
    Promise.all([resolveInstitutionVrResource(route), buildInstitutionDetailPageSnapshot(route)]).then(([resource, detail]) => {
      if (generations.get(this) !== generation) return
      if (!detail.ok) { this.setData({ loading: false, message: '无法确认该机构及资料版本，请返回详情重新进入。' }); return }
      this.setData({ name: (detail.value.sections.basic.name.value || '机构名称待确认').replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, ''),
        disclosure: detail.value.datasetMode === 'MOCK_DEVELOPMENT_ONLY' ? 'TEST ONLY · 当前机构未关联全景。演示全景素材不代表该机构真实场景。' : '全景资源按当前机构与资料版本读取。' })
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
