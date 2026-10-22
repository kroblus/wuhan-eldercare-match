import type {
  AIConsultationPublicApplicationResultV1,
  AIConsultationPublicApplicationSnapshotV1,
  AIMessagePublicProjectionV1,
} from '../../../types/ai-consultation-v1'

export type AIChatPageStateV1 = AIConsultationPublicApplicationSnapshotV1['state']

export interface AIChatMessageViewModelV1 {
  messageId: string
  role: 'user' | 'assistant'
  roleLabel: string
  kind: AIMessagePublicProjectionV1['kind']
  content: string
  sourceLabels: readonly string[]
  handoffExplanation: string
  isUser: boolean
}

export interface AIChatPageViewModelV1 {
  state: AIChatPageStateV1
  stateTitle: string
  stateMessage: string
  provenanceLabel: string
  messages: readonly AIChatMessageViewModelV1[]
  canSend: boolean
  canRetry: boolean
  canOpenHumanHandoff: boolean
  hasMessages: boolean
  showUnavailableNotice: boolean
  showRetry: boolean
  showHumanHandoff: boolean
  inputPlaceholder: string
  errorMessage: string
}

const sourceLabels: Record<string, string> = {
  product_faq: '产品说明',
  profile_display_snapshot: '老人画像摘要',
  recommendation_display_snapshot: '推荐结果摘要',
  institution_display_snapshot: '机构公开资料',
  visit_faq: '看院流程说明',
}

const copyForState = (
  state: AIChatPageStateV1,
): { title: string, message: string } => {
  if (state === 'sending') return { title: '正在整理你的问题', message: '请稍候，页面不会重复发送同一条问题。' }
  if (state === 'answer_ready') return { title: '已整理公开资料', message: '以下内容仅用于解释已有资料，不代表实时承诺。' }
  if (state === 'need_human') return { title: '建议联系养老顾问', message: '这个问题需要人工或专业人员进一步确认。' }
  if (state === 'network_error') return { title: '网络暂时不可用', message: '请检查网络后重试，页面不会展示内部错误信息。' }
  if (state === 'service_error') return { title: '咨询服务暂时不可用', message: '请稍后重试，或直接联系养老顾问。' }
  if (state === 'knowledge_unavailable') return { title: '当前资料不足以回答这个问题', message: '没有找到适用的已批准资料，不会推测答案；可换个问题或联系养老顾问。' }
  return { title: '养老咨询助手', message: '可以先输入关于小程序使用、养老基础概念或已有资料的问题。' }
}

const projectMessage = (message: AIMessagePublicProjectionV1): AIChatMessageViewModelV1 => ({
  messageId: message.messageId,
  role: message.role,
  roleLabel: message.role === 'user' ? '你' : '养老咨询助手',
  kind: message.kind,
  content: message.content,
  sourceLabels: message.sourceRefs.map((source) => sourceLabels[source.category] || '已批准公开资料'),
  handoffExplanation: message.handoff ? message.handoff.publicExplanation : '',
  isUser: message.role === 'user',
})

export const createAIChatPageViewModelV1 = (
  result: AIConsultationPublicApplicationResultV1,
): AIChatPageViewModelV1 => {
  const snapshot = result.ok ? result.value : result.error.snapshot
  const copy = copyForState(snapshot.state)
  const errorMessage = result.ok ? '' : result.error.publicMessage
  return {
    state: snapshot.state,
    stateTitle: copy.title,
    stateMessage: copy.message,
    provenanceLabel: snapshot.responseProvenance === 'unavailable'
      ? '本次暂无可用回答；不会以未获批准的资料补全。'
      : snapshot.responseProvenance === 'approved_faq'
        ? '已批准 FAQ · 常见问题检索，未接入在线模型。'
        : '内容来自受控在线咨询服务。',
    messages: snapshot.messages.map(projectMessage),
    canSend: snapshot.actions.canSend,
    canRetry: snapshot.actions.canRetry,
    canOpenHumanHandoff: snapshot.actions.canOpenHumanHandoff,
    hasMessages: snapshot.messages.length > 0,
    showUnavailableNotice: snapshot.responseProvenance === 'unavailable',
    showRetry: snapshot.actions.canRetry,
    showHumanHandoff: snapshot.actions.canOpenHumanHandoff,
    inputPlaceholder: '例如：怎样开始养老需求评估？',
    errorMessage,
  }
}
