import { loadDemo, readDemo } from './session'
import { resolveStory, storyNeeds, StoryContext } from './story'
import { readBrowseFontStyle } from '../utils/browse-font'
import { navigateToWithGuard, resetNavigationGuard } from '../utils/navigation-guard'
const routes = new WeakMap<object, Record<string, string>>()
// Local replies can be below the fold. Reveal their existing section after render;
// do not mistake a successful setData for visible feedback from a physical tap.
const revealFeedback = (page: WechatMiniprogram.Page.TrivialInstance, selector: string): void => {
  if (typeof wx.nextTick !== 'function' || typeof wx.createSelectorQuery !== 'function') return
  wx.nextTick(() => {
    if (getCurrentPages().slice(-1)[0] !== page) return
    wx.createSelectorQuery().select(selector).boundingClientRect().selectViewport().scrollOffset().exec(results => {
      const target = results[0] as { top: number } | null, viewport = results[1] as { scrollTop: number } | null
      const navigation = page.selectComponent('#consultant-navigation')
      if (!target || !viewport || !navigation) return
      wx.createSelectorQuery().in(navigation).select('.weui-navigation-bar__inner').boundingClientRect().exec(rectangles => {
        const header = rectangles[0] as { height: number } | null
        if (!header || getCurrentPages().slice(-1)[0] !== page) return
        wx.pageScrollTo({ scrollTop: Math.max(0, target.top + viewport.scrollTop - header.height - 16), duration: 200,
          fail: () => { /* The local reply remains readable with normal page scrolling. */ } })
      })
    })
  })
}
const questions = [
  { key: 'care', title: '怎样确认照护是否合适？', reply: '演示回复：先整理老人行动、饮食与日常协助需求，再逐项向机构了解接收条件、人员安排和交接方式。当前摘要不是医疗判断。' },
  { key: 'fees', title: '费用和床位能马上确定吗？', reply: '演示回复：不能。本演示不提供实时床位或具体报价，需要进一步人工确认房型、照护等级、费用包含项和押金。' },
  { key: 'medical', title: '医疗及康复能力怎样核实？', reply: '演示回复：请进一步人工确认具体服务、合法资质、适用条件和紧急处置安排。不能从演示介绍推断机构具备某项医疗能力。' },
]
export function registerDemoConsultant(backEnabled: boolean): void {
  Page({
    data: { backEnabled, fontStyle: '', loading: true, consultantId: 'demo-consultant-xiaoan-v1', name: '演示顾问·小安',
      role: '养老顾问（演示）', region: '武汉', status: '演示可体验', needs: null as ReturnType<typeof storyNeeds>,
      story: null as StoryContext | null, questions, reply: '', contacting: false, error: '' },
    onLoad(query: Record<string, string>) { routes.set(this, query || {}) },
    onUnload() { routes.delete(this) },
    async onShow() {
      resetNavigationGuard(this)
      this.setData({ fontStyle: readBrowseFontStyle(), loading: true, error: '' })
      try {
        await loadDemo()
        const query = routes.get(this) || {}, story = query.institutionId ? await resolveStory(query) : null
        if (!routes.has(this)) return
        this.setData({ loading: false, story, needs: storyNeeds(), error: query.institutionId && !story ? '关联机构资料已变化，请返回机构详情重新进入。' : '' })
      } catch (_) { this.setData({ loading: false, error: '演示资料暂未就绪，请返回首页重试。' }) }
    },
    contact() {
      this.setData({ contacting: true, reply: '模拟咨询已开始。先了解老人需求，再比较机构并安排看院。请选择下面的问题继续体验；不会联系真人或发送消息。' })
      revealFeedback(this, '#consultant-faq')
    },
    ask(event: WechatMiniprogram.BaseEvent) {
      const question = questions.find(q => q.key === event.currentTarget.dataset.key)
      if (question) { this.setData({ reply: question.reply }); revealFeedback(this, '.story-reply') }
    },
    book() {
      const story = this.data.story
      if (!story || story.epoch !== readDemo().epoch || !readDemo().ready) { this.setData({ error: '请先从机构详情选择咨询机构。' }); return }
      navigateToWithGuard(this, 'consultant.demo.book', story.appointmentUrl, undefined, () => this.setData({ error: '暂时无法打开看院安排，请重试。' }))
    },
    browse() { navigateToWithGuard(this, 'consultant.demo.browse', '/pages/recommendation/result', undefined, () => this.setData({ error: '暂时无法打开机构比较，请重试。' })) },
  })
}
