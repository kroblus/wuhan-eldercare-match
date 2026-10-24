import assert from 'node:assert/strict'

// Explicit build-time seams: production source and its verification rules are untouched.
export function composeDemoStory(source) {
  const edit = (file, before, after) => {
    const text = source.get(file).toString().replace(/\r\n/g, '\n')
    assert.ok(text.includes(before), 'Demo story composition anchor missing: ' + file + ' / ' + before.slice(0, 45))
    source.set(file, Buffer.from(text.replace(before, after)))
  }
  const prepend = (file, text) => source.set(file, Buffer.from(text + source.get(file)))
  const resultView = 'pages/recommendation/result-v2-view-model.ts'
  prepend(resultView, "import { storyDisplayName } from '../../demo/story-name'\n")
  edit(resultView, "name: name === null ? demoName === null ? '机构名称待核验' : `演示名称：${demoName}` : name,", "name: storyDisplayName(candidate.institutionId, name === null ? demoName === null ? '机构名称待核验' : demoName : name),")
  const resultMarkup = source.get('pages/recommendation/result.wxml').toString().replaceAll('<text class="institution-name">{{item.name}}</text>', '<text wx:if="{{item.institutionId === \'demo-inst-chunhe-home\'}}" class="fact-label">本次讲解机构</text><text class="institution-name">{{item.name}}</text>')
  source.set('pages/recommendation/result.wxml', Buffer.from(resultMarkup))
  const compactDisclosure = source.get('pages/recommendation/result.wxml').toString().replace(/<view wx:if="\{\{isDemoBuild \|\| \(viewModel && viewModel.hasMockDisclosure\)\}\}" class="mock-disclosure">[\s\S]*?<\/view>/, '<view class="mock-disclosure"><text class="mock-disclosure__title">演示数据 · 虚构机构</text></view>')
  source.set('pages/recommendation/result.wxml', Buffer.from(compactDisclosure))
  const listView = 'pages/institution/list-view-model.ts'
  prepend(listView, "import { storyDisplayName } from '../../demo/story-name'\n")
  edit(listView, "name: name.value || '机构名称待提供',", "name: storyDisplayName(item.institutionId, name.value || '机构名称待提供'),")
  edit(listView, "? name.value.replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, '') || '机构名称待确认'", "? storyDisplayName(item.institutionId, name.value) || '机构名称待确认'")
  for (const route of ['mine/index', 'consultant/index', 'consultant/consultation', 'appointment/create', 'showcase/index', 'showcase/map-real', 'showcase/vr-real']) {
    const file = 'pages/' + route + '.json', config = JSON.parse(source.get(file))
    config.usingComponents = { 'navigation-bar': '/components/navigation-bar/navigation-bar', ...(route === 'showcase/index' ? { 'demo-tools': '/components/demo-tools/demo-tools' } : {}) }
    source.set(file, Buffer.from(JSON.stringify(config)))
  }
  source.set('app.ts', Buffer.from(`import { installDemoGuards } from './demo/guard'
installDemoGuards(__APPID__)
import { loadDemo } from './demo/session'
App({globalData:{runMode:'DEMO'},onLaunch(){loadDemo().catch(()=>{})}})
`))
  const detail = 'pages/institution/detail.ts'
  prepend(detail, "import { storyDestination, storyDisplayName } from '../../demo/story'\n")
  edit(detail, '  fontStyle: string', '  storyDetailUrl: string\n  isStoryInstitution: boolean\n  fontStyle: string')
  edit(detail, "    fontStyle: '',", "    storyDetailUrl: '', isStoryInstitution: false,\n    fontStyle: '',")
  edit(detail, '    routeByPage.set(this, parsed.value)', `    this.setData({storyDetailUrl: storyDestination(parsed.value, '/pages/institution/detail'), isStoryInstitution: parsed.value.identity.institutionId === 'demo-inst-chunhe-home' && parsed.value.identity.recordRevision === 1})
    routeByPage.set(this, parsed.value)`)
  edit(detail, 'reading: createDetailReading(viewModel),', 'reading: { ...createDetailReading(viewModel), title: storyDisplayName(route.identity.institutionId, viewModel.title) },')
  edit(detail, "'/pages/consultant/consultation', undefined,", "storyDestination(routeByPage.get(this), '/pages/consultant/consultation'), undefined,")
  edit(detail, 'const url = `/pages/appointment/create?institutionId=${encodeURIComponent(identity.institutionId)}&recordRevision=${String(identity.recordRevision)}`', "const url = storyDestination(route, '/pages/appointment/create')")
  const config = JSON.parse(source.get('pages/institution/detail.json'))
  config.usingComponents['demo-story-preview'] = '/components/demo-story-preview/demo-story-preview'
  source.set('pages/institution/detail.json', Buffer.from(JSON.stringify(config)))
  const markup = 'pages/institution/detail.wxml'
  edit(markup, '<view class="detail-contact-card">', '<demo-story-preview id="story-preview" context-url="{{storyDetailUrl}}"></demo-story-preview>\n      <view class="detail-contact-card">')
  edit(markup, '<text class="detail-subheading">机构位置</text>', '<block wx:if="{{!isStoryInstitution}}"><text class="detail-subheading">机构位置</text>')
  edit(markup, '<text class="detail-subheading detail-contact-title">机构官方电话</text>', '</block><text class="detail-subheading detail-contact-title">机构官方电话</text>')
  edit(markup, 'text="咨询顾问"', 'text="咨询养老顾问"')
  edit(markup, '演示资料，非真实机构信息。', '演示数据 · 虚构机构')
  // Retain the native map and WebGL engines, their lifecycle and recovery logic.
  for (const kind of ['map', 'vr']) {
    const file = 'pages/showcase/' + kind + '-real.ts'
    prepend(file, "import { resolveStory, backFromStory, StoryContext } from '../../demo/story'\nimport { readBrowseFontStyle } from '../../utils/browse-font'\n")
    edit(file, 'import { backToShowcase, unlock }', 'import { unlock }')
    edit(file, 'data: { allowed: false,', "data: { story: null as StoryContext | null, fontStyle: '', allowed: false,")
    edit(file, 'onLoad() {', 'onLoad(query: Record<string,string | undefined> = {}) {')
    edit(file, 'allowed: isDevelopmentBuild()', 'allowed: isDevelopmentBuild() && !query.institutionId, fontStyle: readBrowseFontStyle()')
    if (kind === 'map') {
      edit(file, 'read: 0 }) },', `read: 0 })
      if (query.institutionId) resolveStory(query).then(story => { if (!runtimes.has(this)) return; this.setData({story, allowed: !!story && story.mediaAvailable, error: story && story.mediaAvailable ? '' : '机构演示链接不可用，请返回详情。'}); if (story && story.mediaAvailable) this.retryMap() })
    },`)
      edit(file, "backToShowcase(this, () => this.setData({ error: '返回功能演示失败，请重试' }))", "backFromStory(this, this.data.story, () => this.setData({error:'暂时无法返回，请重试。'}))")
    } else {
      edit(file, 'sampleActive: false })\n  },', `sampleActive: !!query.institutionId })
    if (query.institutionId) resolveStory(query).then(story => {const r=runtimes.get(this); if(!r)return; this.setData({story, allowed: !!story && story.mediaAvailable, error: story && story.mediaAvailable ? '' : '机构演示链接不可用，请返回详情。'}); if(story && story.mediaAvailable && r.ready)this.mountCanvas()})
  },`)
      edit(file, '演示资料，仅用于体验拖动与缩放，不关联机构身份。', '演示空间，非该机构实景。可拖动与缩放，不代表机构环境已核验。')
      edit(file, "backToShowcase(this, () => this.setData({ error: '返回功能演示失败，请重试' }))", "backFromStory(this, this.data.story, () => this.setData({error:'暂时无法返回，请重试。'}))")
    }
  }
}
