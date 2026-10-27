import { resolveStory, queryFromUrl, isStoryCurrent, StoryContext } from '../../demo/story'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
import { readBrowseFontStyle } from '../../utils/browse-font'
Component({
  properties: { contextUrl: { type: String, value: '', observer() { this.loadContext() } } },
  data: { story: null as StoryContext | null, error: '', fontStyle: '' },
  lifetimes: { attached() { this.loadContext() } },
  pageLifetimes: { show() { resetNavigationGuard(this); this.setData({ fontStyle: readBrowseFontStyle() }); this.loadContext() } },
  methods: {
    async loadContext() {
      const url = this.data.contextUrl
      const story = await resolveStory(queryFromUrl(url)).catch(() => null)
      if (url === this.data.contextUrl) this.setData({ story: story && story.mediaAvailable ? story : null, fontStyle: readBrowseFontStyle() })
    },
    open(event: WechatMiniprogram.BaseEvent) {
      const story = this.data.story, action = event.currentTarget.dataset.action
      if (!story || !isStoryCurrent(story) || !['map', 'vr'].includes(action)) { this.setData({ error: '演示资料已变化，请返回首页重新进入。' }); return }
      this.setData({ error: '' })
      navigateToWithGuard(this, 'story.' + action, action === 'map' ? story.mapUrl : story.vrUrl, undefined, () => this.setData({ error: '暂时无法打开，请重试。' }))
    },
  },
})
