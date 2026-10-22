// Isolated runtime tests; these do not provide DevTools or real-service evidence.
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { ts } = loadWechatTypeScript()
let detail
let component
const navigation = []
const scrolls = []
const pages = []
const runtime = createWechatTsRuntime(ts, {
  Page(config) { detail = config },
  Component(config) { component = config },
  getCurrentPages() { return pages },
  wx: {
    navigateTo(options) { navigation.push(options) },
    pageScrollTo(options) { scrolls.push(options) },
  },
})
runtime.load(path.join(root, 'miniprogram/pages/institution/detail.ts'))
const makeDetail = () => {
  const instance = {
    data: { pageState: 'ready', viewModel: {}, isSwitchingRevision: false },
    setData(patch) { Object.assign(this.data, patch) },
  }
  detail.onShow.call(instance)
  return instance
}
const instance = makeDetail()
pages.push(instance)
detail.onAIChatTap.call(instance)
detail.onAIChatTap.call(instance)
assert.equal(navigation.length, 1, 'rapid FAQ taps must navigate once')
assert.equal(navigation[0].url, '/pages/service/ai-chat/index', 'no personal context in FAQ URL')
navigation[0].fail({ errMsg: 'isolated failure' })
assert.equal(instance.data.actionErrorKey, 'faq')
assert.match(instance.data.actionErrorMessage, /重试/)
detail.onAIChatTap.call(instance)
assert.equal(navigation.length, 2, 'failed navigation must allow retry')
const blocked = makeDetail()
blocked.data.isSwitchingRevision = true
detail.onAIChatTap.call(blocked)
assert.equal(navigation.length, 2, 'revision switch must block new navigation')
console.log('FAQ_NAVIGATION_DEDUP_FAILURE_RETRY_CONTEXT = PASS')

runtime.load(path.join(root, 'miniprogram/pages/service/ai-chat/index.ts'))
const chat = {
  ...component.methods,
  data: JSON.parse(JSON.stringify(component.data)),
  setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback() },
}
component.lifetimes.attached.call(chat)
pages.push(chat)
chat.onInput({ detail: { value: '怎样开始养老需求评估？' } })
chat.onSend()
chat.onSend()
for (let index = 0; index < 20; index++) await Promise.resolve()
assert.equal(chat.data.viewModel.state, 'answer_ready')
assert.equal(chat.data.viewModel.messages.length, 2, 'rapid send must not append twice')
assert.equal(scrolls.at(-1).selector, '#' + chat.data.viewModel.messages.at(-1).messageId)
assert.match(chat.data.viewModel.provenanceLabel, /FAQ.*未接入在线模型/)
chat.onInput({ detail: { value: '请解释月球基地的养老安排' } })
chat.onSend()
for (let index = 0; index < 20; index++) await Promise.resolve()
assert.equal(chat.data.viewModel.state, 'knowledge_unavailable')
assert.equal(scrolls.at(-1).scrollTop, 0, 'unavailable feedback must return to visible status')
assert.match(chat.data.viewModel.stateTitle, /资料不足/)
console.log('FAQ_REPLY_AND_UNAVAILABLE_VISIBILITY = PASS')

const appModule = runtime.load(path.join(root, 'miniprogram/services/ai-consultation-page.ts'))
const originalFactory = appModule.createAIConsultationPageApplicationV1
let resolveReply
appModule.createAIConsultationPageApplicationV1 = () => {
  const app = originalFactory()
  const complete = app.completeSend
  return { ...app, completeSend(sending) { return new Promise(resolve => { resolveReply = () => complete(sending).then(resolve) }) } }
}
// A fresh runtime is needed because Component's application is module-scoped.
let delayedComponent
const delayedRuntime = createWechatTsRuntime(ts, {
  Component(config) { delayedComponent = config },
  getCurrentPages() { return pages },
  wx: { pageScrollTo(options) { scrolls.push(options) } },
})
const delayedService = delayedRuntime.load(path.join(root, 'miniprogram/services/ai-consultation-page.ts'))
delayedService.createAIConsultationPageApplicationV1 = appModule.createAIConsultationPageApplicationV1
delayedRuntime.load(path.join(root, 'miniprogram/pages/service/ai-chat/index.ts'))
const delayedPage = {
  ...delayedComponent.methods,
  data: JSON.parse(JSON.stringify(delayedComponent.data)),
  setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback() },
}
pages.push(delayedPage)
delayedComponent.lifetimes.attached.call(delayedPage)
delayedPage.onInput({ detail: { value: '月球基地养老' } })
delayedPage.onSend()
pages.pop()
const before = scrolls.length
resolveReply()
for (let index = 0; index < 20; index++) await Promise.resolve()
assert.equal(delayedPage.data.viewModel.state, 'knowledge_unavailable')
assert.equal(scrolls.length, before, 'late response must not scroll a different page')
console.log('FAQ_LATE_RESPONSE_CANNOT_SCROLL_OTHER_PAGE = PASS')
console.log('SHOWCASE_SERVICE_LOOP_RUNTIME = PASS (isolated Node VM, not DevTools)')
