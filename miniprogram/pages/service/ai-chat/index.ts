import { readBrowseFontStyle } from '../../../utils/browse-font'
import { createAIConsultationPageApplicationV1 } from '../../../services/ai-consultation-page'
import { getNavigationGuard, resetNavigationGuard } from '../../../utils/navigation-guard'
import type { AIConsultationPublicApplicationResultV1 } from '../../../types/ai-consultation-v1'
import {
  createAIChatPageViewModelV1,
} from './index-view-model'
import type { AIChatPageViewModelV1 } from './index-view-model'

const CONSULTANT_TAB_URL = '/pages/consultant/index'
const application = createAIConsultationPageApplicationV1()
const sendInFlight = new WeakSet<object>()

interface AIChatPageData {
  fontStyle: string
  result: AIConsultationPublicApplicationResultV1 | null
  viewModel: AIChatPageViewModelV1 | null
  inputValue: string
  inputError: string
  actionError: string
  isSending: boolean
  lastSubmittedInput: string
  quickQuestions: readonly string[]
}

const applyResult = (
  instance: { setData: (data: Partial<AIChatPageData>, callback?: () => void) => void },
  result: AIConsultationPublicApplicationResultV1,
  isSending = false,
): void => {
  const viewModel = createAIChatPageViewModelV1(result)
  instance.setData({
    result,
    viewModel,
    isSending,
    inputError: '',
  }, () => {
    if (isSending || !viewModel.messages.length) return
    const latest = viewModel.messages[viewModel.messages.length - 1]
    try {
      const pages = getCurrentPages()
      if (!pages.length || pages[pages.length - 1] !== instance) return
      const target = latest.role === 'assistant'
        && (viewModel.state === 'answer_ready' || viewModel.state === 'need_human')
        ? { selector: '#' + latest.messageId } : { scrollTop: 0 }
      wx.pageScrollTo({ ...target, duration: 200, fail: () => { /* Manual scrolling remains available. */ } })
    } catch (_error) { /* Keep the answer readable when automatic scrolling is unavailable. */ }
  })
}

Component({
  data: {
    fontStyle: '',
    result: null,
    viewModel: null,
    inputValue: '',
    inputError: '',
    actionError: '',
    isSending: false,
    lastSubmittedInput: '',
    quickQuestions: ['怎样开始养老需求评估？', '推荐结果应该怎么看？', '看院前需要准备什么？'],
  } as AIChatPageData,

  lifetimes: {
    attached() {
      this.setData({ fontStyle: readBrowseFontStyle() })
      applyResult(this, application.createInitialResult())
    },
  },

  pageLifetimes: {
    show() {
      const fontStyle = readBrowseFontStyle()
      if (this.data.fontStyle !== fontStyle) this.setData({ fontStyle })
      resetNavigationGuard(this)
    },
  },

  methods: {
    onInput(event: WechatMiniprogram.TextareaInput): void {
      this.setData({ inputValue: event.detail.value, inputError: '' })
    },

    onQuickQuestion(event: WechatMiniprogram.BaseEvent): void {
      if (sendInFlight.has(this)) return
      const question = String(event.currentTarget.dataset.question || '').trim()
      if (!question) return
      this.setData({ inputValue: question, inputError: '' })
    },

    submitInput(input: string): void {
      if (sendInFlight.has(this)) return
      const value = input.trim()
      if (!value) {
        this.setData({ inputError: '请先输入想了解的问题。' })
        return
      }
      if (!this.data.result || !this.data.viewModel || !this.data.viewModel.canSend) return
      sendInFlight.add(this)
      this.setData({
        inputValue: value,
        inputError: '',
        actionError: '',
        isSending: true,
        lastSubmittedInput: value,
      })
      const current = this.data.result
      try {
        const sending = application.beginSend(current, value)
        applyResult(this, sending, true)
        application.completeSend(sending).then((result) => {
          if (!sendInFlight.has(this)) return
          applyResult(this, result)
        }).catch(() => {
          if (!sendInFlight.has(this)) return
          applyResult(this, application.recoverSendFailure(sending))
          this.setData({ actionError: '咨询服务暂时不可用，请稍后重试。' })
        }).then(() => {
          sendInFlight.delete(this)
          this.setData({ isSending: false })
        })
      } catch (_error) {
        applyResult(this, application.recoverSendFailure(current))
        this.setData({ actionError: '咨询服务暂时不可用，请稍后重试。' })
        sendInFlight.delete(this)
        this.setData({ isSending: false })
      }
    },

    onSend(): void {
      this.submitInput(this.data.inputValue)
    },

    onRetry(): void {
      if (!this.data.viewModel || !this.data.viewModel.canRetry) return
      this.submitInput(this.data.lastSubmittedInput)
    },

    openHumanHandoff(): void {
      if (sendInFlight.has(this)) return
      const guard = getNavigationGuard(this)
      const action = 'aiConsultation.openConsultant'
      if (!guard.acquire(action)) return
      let succeeded = false
      let reported = false
      const fail = () => {
        guard.release(action)
        if (reported) return
        reported = true
        this.setData({ actionError: '暂时无法打开养老顾问，请稍后重试。' })
      }
      this.setData({ actionError: '' })
      try {
        wx.switchTab({
          url: CONSULTANT_TAB_URL,
          success: () => { succeeded = true },
          fail,
          complete: () => { if (!succeeded) fail() },
        })
      } catch (_error) {
        fail()
      }
    },
  },
})
