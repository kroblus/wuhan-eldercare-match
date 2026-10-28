import { p1Institution } from '../../../content/p1-public-institution'
import { p1Client, p1Pending, newP1RequestId, P1_VERSION, validateP1Input, p1BeijingTime } from '../../../services/p1-service-client'
import type { P1Input, P1Item, P1Config } from '../../../services/p1-service-client'
import { readBrowseFontStyle } from '../../../utils/browse-font'
import { institutionPublicationClient } from '../../../services/institution-publications'
import type { InstitutionPublicProfile, InstitutionPublishedProfile } from '../../../types/institution-publication'

const relationshipValues: P1Input['relationship'][] = ['SELF', 'FAMILY', 'OTHER']
const scenarioValues: P1Input['serviceScenario'][] = ['UNDECIDED', 'LONG_TERM', 'SHORT_STAY', 'POST_OPERATION']
const statusLabels = { PENDING_CONTACT: '待联系', FOLLOWING_UP: '联系跟进中', PENDING_ARRANGEMENT: '待安排', CONFIRMED: '已有确认带看', VISITED: '已记录到访', NO_SHOW: '已记录未到访', CLOSED: '已结束联系', CANCELLED: '已取消' }
const visitLabels = { DRAFT: '待双方确认', CONFIRMED: '已确认', CANCELLED: '这场已取消', ARRIVED: '已到访', NO_SHOW: '未到访' }
const lifetimes = new WeakMap<object, number>()
const active = (page: object, generation: number) => lifetimes.get(page) === generation
const publicPriceSummary = (profile: InstitutionPublicProfile | null): string => {
  if (!profile || !profile.prices.length) return ''
  const totals = profile.prices.map(row => row.total)
  const low = Math.min(...totals), high = Math.max(...totals)
  return (low === high ? String(low) : `${low}—${high}`) + ' 元/月（参考总月费）'
}
const displayItems = (items: P1Item[]) => items.map(item => ({ ...item,
  statusLabel: statusLabels[item.status], kindLabel: item.kind === 'VISIT_INTENT' ? '带看意向' : '普通咨询',
  createdLabel: p1BeijingTime(item.createdAt), updatedLabel: p1BeijingTime(item.updatedAt),
  visits: (item.visits || []).map(visit => ({ ...visit, statusLabel: visitLabels[visit.status], startLabel: p1BeijingTime(visit.start), endLabel: p1BeijingTime(visit.end), actualLabel: p1BeijingTime(visit.actualAt) })),
}))

Page({
  data: {
    browseFontStyle: '', institution: p1Institution as InstitutionPublicProfile | null, config: null as P1Config | null,
    publicProfiles: [] as InstitutionPublishedProfile[], publicNames: [] as string[], publicIndex: 0,
    publicLoading: false, publicError: '', publicOnline: false, publicSynthetic: false, publicRevision: 0,
    publicPriceSummary: publicPriceSummary(p1Institution),
    loading: false, busy: false, error: '', feedback: '', configError: '',
    kindIndex: 0, institutionIndex: 0, relationshipIndex: 1, scenarioIndex: 0,
    kinds: ['普通咨询', '带看意向'], institutions: ['请平台顾问协助推荐'], institutionIds: [null] as (string | null)[],
    relationships: ['本人', '家属', '其他合法受托人'], scenarios: ['尚未确定', '长期养老', '短期托养', '术后阶段'],
    contactName: '', contactPhone: '', preferredWindow: '', partySize: '1', assistanceNote: '', consent: false,
    items: [] as ReturnType<typeof displayItems>, listLoaded: false, listError: '',
    pending: false, calling: false,
  },
  onLoad() {
    lifetimes.set(this, 1)
    const pending = p1Pending.input
    this.setData({ pending: !!pending })
    if (pending) this.setData({ contactName: pending.contactName, contactPhone: pending.contactPhone,
      kindIndex: pending.kind === 'VISIT_INTENT' ? 1 : 0,
      relationshipIndex: relationshipValues.indexOf(pending.relationship), scenarioIndex: scenarioValues.indexOf(pending.serviceScenario),
      preferredWindow: pending.preferredWindow || '', partySize: String(pending.partySize), assistanceNote: pending.assistanceNote || '', consent: pending.consentAccepted,
    })
    this.loadConfig()
    this.loadPublicInstitutions()
  },
  onShow() { this.setData({ browseFontStyle: readBrowseFontStyle() }) },
  onUnload() { lifetimes.set(this, (lifetimes.get(this) || 0) + 1) },
  async loadConfig() {
    if (this.data.loading || this.data.busy) return
    const generation = lifetimes.get(this) || 0
    this.setData({ loading: true, configError: '', config: null })
    try {
      const config = await p1Client.loadConfig()
      if (active(this, generation)) {
        const choices = config ? config.institutions : []
        const institutionIds: (string | null)[] = [null, ...choices.map(entry => entry.institutionId)]
        const institutions = ['请平台顾问协助推荐', ...choices.map(entry => entry.institutionName)]
        const selectedId = p1Pending.input ? p1Pending.input.institutionId : this.data.institutionIds[this.data.institutionIndex]
        let index = institutionIds.indexOf(selectedId || null)
        if (p1Pending.input && selectedId && index < 0) {
          institutionIds.push(selectedId); institutions.push('原申请机构（保留原申请重试）'); index = institutionIds.length - 1
        }
        this.setData({ config, institutionIds, institutions, institutionIndex: index < 0 ? 0 : index })
      }
    } catch (_) {
      if (active(this, generation)) this.setData({ configError: '暂时无法获取服务状态，请重试。资料仍可浏览。' })
    } finally { if (active(this, generation)) this.setData({ loading: false }) }
  },
  async loadPublicInstitutions() {
    if (this.data.publicLoading) return
    const generation = lifetimes.get(this) || 0
    const selectedId = this.data.institution && this.data.institution.id
    this.setData({ publicLoading: true, publicError: '', publicSynthetic: false, institution: null, publicProfiles: [], publicNames: [], publicRevision: 0, publicPriceSummary: '' })
    try {
      const published = await institutionPublicationClient.load()
      if (!active(this, generation)) return
      if (!published) {
        this.setData({ institution: p1Institution, publicOnline: false, publicSynthetic: false, publicIndex: 0, publicPriceSummary: publicPriceSummary(p1Institution) })
        return
      }
      const profiles = published.publicProfiles
      const match = profiles.findIndex(entry => entry.institutionId === selectedId)
      const index = match < 0 ? 0 : match
      this.setData({ publicOnline: true, publicSynthetic: published.dataEnvironment === 'SYNTHETIC_TEST_ONLY',
        publicProfiles: profiles, publicNames: profiles.map(entry => entry.profile.name), publicIndex: index,
        institution: profiles.length ? profiles[index].profile : null, publicRevision: profiles.length ? profiles[index].recordRevision : 0,
        publicPriceSummary: publicPriceSummary(profiles.length ? profiles[index].profile : null),
      })
    } catch (_) {
      if (active(this, generation)) this.setData({ publicError: '未能取得已发布机构资料，请重试。当前不展示旧版本替代资料。', publicOnline: true })
    } finally { if (active(this, generation)) this.setData({ publicLoading: false }) }
  },
  choosePublicInstitution(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value)
    if (this.data.publicLoading || !Number.isInteger(index) || index < 0 || index >= this.data.publicProfiles.length) return
    const selected = this.data.publicProfiles[index]
    this.setData({ publicIndex: index, institution: selected.profile, publicRevision: selected.recordRevision, publicPriceSummary: publicPriceSummary(selected.profile) })
  },
  editText(event: WechatMiniprogram.Input) {
    if (this.data.busy || this.data.pending) return
    const field = event.currentTarget.dataset.field
    if (!['contactName', 'contactPhone', 'preferredWindow', 'partySize', 'assistanceNote'].includes(field)) return
    this.setData({ [field]: event.detail.value, error: '', feedback: '' })
  },
  choose(event: WechatMiniprogram.PickerChange) {
    if (this.data.busy || this.data.pending) return
    const field = event.currentTarget.dataset.field
    const ranges: Record<string, number> = { kindIndex: 2, institutionIndex: this.data.institutionIds.length, relationshipIndex: 3, scenarioIndex: 4 }
    const value = Number(event.detail.value)
    if (ranges[field] && Number.isInteger(value) && value >= 0 && value < ranges[field]) this.setData({ [field]: value })
  },
  consentChanged(event: WechatMiniprogram.CheckboxGroupChange) {
    if (!this.data.busy && !this.data.pending) this.setData({ consent: event.detail.value.includes('accepted') })
  },
  async submit() {
    if (this.data.busy || this.data.loading || !this.data.config || !this.data.config.enabled || !this.data.config.notice) return
    const generation = lifetimes.get(this) || 0
    const input: P1Input = p1Pending.input || {
      requestId: newP1RequestId(), inputVersion: P1_VERSION,
      kind: this.data.kindIndex === 1 ? 'VISIT_INTENT' : 'CONSULTATION',
      institutionId: this.data.institutionIds[this.data.institutionIndex] || null,
      contactName: this.data.contactName.trim(), contactPhone: this.data.contactPhone.trim(),
      relationship: relationshipValues[this.data.relationshipIndex], serviceScenario: scenarioValues[this.data.scenarioIndex],
      preferredWindow: this.data.preferredWindow.trim() || null, partySize: Number(this.data.partySize),
      assistanceNote: this.data.assistanceNote.trim() || null,
      consentVersion: this.data.config.notice.version, consentAccepted: this.data.consent,
    }
    const invalid = validateP1Input(input)
    if (invalid) { this.setData({ error: invalid }); return }
    p1Pending.input = input
    this.setData({ busy: true, pending: true, error: '', feedback: '' })
    try {
      const item = await p1Client.submit(input)
      p1Pending.input = null
      if (active(this, generation)) this.setData({ pending: false, consent: false,
        contactName: '', contactPhone: '', assistanceNote: '', preferredWindow: '',
        items: displayItems([item, ...this.data.items.filter(v => v.id !== item.id)]),
        feedback: item.kind === 'VISIT_INTENT' ? '带看申请已提交，待顾问联系后确认安排；当前没有确认时段。' : '咨询申请已提交，等待平台顾问联系。',
      })
    } catch (failure) {
      const rejected = failure instanceof Error && ['HTTP_400', 'HTTP_413'].includes(failure.message)
      if (rejected) p1Pending.input = null
      if (active(this, generation)) this.setData({ pending: !!p1Pending.input, error: rejected
        ? '服务未接受这份申请，请核对输入并重新获取服务告知后提交。'
        : '尚未确认提交结果。已保留本次申请，可查询本人进度，或使用原申请重试；请勿另建重复申请。' })
    } finally { if (active(this, generation)) this.setData({ busy: false }) }
  },
  async loadMine() {
    if (this.data.busy || this.data.loading || !this.data.config) return
    const generation = lifetimes.get(this) || 0
    this.setData({ busy: true, listError: '' })
    try {
      const items = await p1Client.list()
      const recovered = p1Pending.input && items.some(item => item.id === p1Pending.input!.requestId)
      if (recovered) p1Pending.input = null
      if (active(this, generation)) this.setData({ items: displayItems(items), listLoaded: true,
        pending: !!p1Pending.input, ...(recovered ? { error: '', feedback: '已找回本次申请，请查看下方实际状态。', contactName: '', contactPhone: '', assistanceNote: '', preferredWindow: '', consent: false } : {}),
      })
    } catch (_) {
      if (active(this, generation)) this.setData({ listError: '未能读取本人申请，请重试。此状态不表示没有申请。', listLoaded: false, items: [] })
    } finally { if (active(this, generation)) this.setData({ busy: false }) }
  },
  async cancelRequest(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id
    if (this.data.busy || !this.data.items.some(item => item.id === id && item.canCancel)) return
    const generation = lifetimes.get(this) || 0
    this.setData({ busy: true, listError: '' })
    try {
      const result = await p1Client.cancel(id)
      if (active(this, generation)) this.setData({ items: displayItems(this.data.items.map(v => v.id === id ? result : v)) })
    } catch (_) {
      if (active(this, generation)) this.setData({ listError: '尚未确认取消结果，请刷新本人进度后重试。' })
    } finally { if (active(this, generation)) this.setData({ busy: false }) }
  },
  callPlatform() {
    const config = this.data.config
    if (this.data.calling || !config || config.datasetMode !== 'PRODUCTION' || !config.platformContact.phone) return
    const generation = lifetimes.get(this) || 0
    this.setData({ calling: true, error: '' })
    const fail = () => { if (active(this, generation)) this.setData({ error: '未能拨打平台电话，请稍后重试。' }) }
    const complete = () => { if (active(this, generation)) this.setData({ calling: false }) }
    try { wx.makePhoneCall({ phoneNumber: config.platformContact.phone, fail, complete }) }
    catch (_) { fail(); complete() }
  },
})
