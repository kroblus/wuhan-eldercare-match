export const AI_B6_FIXTURE_POLICY = 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_AI_DATA'

const base = {
  kind: 'ai_consultation_public_application_snapshot_v1',
  contractVersion: 'ai-consultation-contract-v1',
  conversationRef: { kind: 'local_session', localSessionId: 'b6-fixture-session' },
  conversationCreatedAt: '2026-09-16T00:00:00.000Z',
}

const user = {
  messageId: 'b6-user',
  role: 'user',
  kind: 'user_input',
  content: '这是测试问题，仅用于 B6 自动化验证。',
  sourceRefs: [],
  createdAt: '2026-09-16T00:00:01.000Z',
}

const answer = {
  messageId: 'b6-answer',
  role: 'assistant',
  kind: 'answer',
  content: '这是测试回答，不代表生产在线 AI。',
  sourceRefs: [{ category: 'product_faq', publicLabel: '测试产品说明', publicVersion: 'b6-fixture' }],
  createdAt: '2026-09-16T00:00:02.000Z',
}

const handoff = {
  messageId: 'b6-handoff',
  role: 'assistant',
  kind: 'human_handoff',
  content: '这个问题需要养老顾问进一步协助。',
  sourceRefs: [],
  handoff: {
    level: 'required',
    reason: 'user_requested_human',
    publicExplanation: '你可以联系平台养老顾问继续了解。',
    destination: 'global_consultant_service',
  },
  createdAt: '2026-09-16T00:00:02.000Z',
}

const failure = {
  messageId: 'b6-failure',
  role: 'assistant',
  kind: 'technical_failure',
  content: '测试失败状态，请稍后重试。',
  sourceRefs: [],
  createdAt: '2026-09-16T00:00:02.000Z',
}

const snapshot = (state, messages, responseProvenance = 'unavailable') => ({
  ok: true,
  value: {
    ...base,
    state,
    messages,
    responseProvenance,
    actions: {
      canSend: state !== 'sending' && state !== 'need_human',
      canRetry: state === 'knowledge_unavailable' || state === 'network_error' || state === 'service_error',
      canOpenHumanHandoff: messages.some((message) => message.handoff && message.handoff.destination === 'global_consultant_service'),
    },
  },
})

export const AI_B6_PUBLIC_STATE_FIXTURES = [
  ['idle', snapshot('idle', [])],
  ['sending', snapshot('sending', [user])],
  ['answer_ready', snapshot('answer_ready', [user, answer], 'approved_faq')],
  ['need_human', snapshot('need_human', [user, handoff])],
  ['knowledge_unavailable', snapshot('knowledge_unavailable', [user])],
  ['network_error', snapshot('network_error', [user, failure])],
  ['service_error', snapshot('service_error', [user, failure])],
]

export const AI_B6_SAFE_REFUSAL_FIXTURE = {
  ok: true,
  value: {
    ...base,
    state: 'need_human',
    messages: [user, {
      messageId: 'b6-medical-refusal',
      role: 'assistant',
      kind: 'safe_refusal',
      content: '养老咨询助手不能提供医疗诊断、治疗或用药建议，请咨询合格的医疗专业人员。',
      sourceRefs: [],
      handoff: {
        level: 'required',
        reason: 'medical_professional_required',
        publicExplanation: '这个问题需要合格的医疗专业人员判断。',
      },
      createdAt: '2026-09-16T00:00:02.000Z',
    }],
    responseProvenance: 'unavailable',
    actions: { canSend: false, canRetry: false, canOpenHumanHandoff: false },
  },
}

export const AI_B6_FIXTURE_MANIFEST = [
  'B6-CONTROL',
  'B6-SEVEN-STATE-MAPPING',
  'B6-APPLICATION-UNAVAILABLE',
  'B6-EMPTY-INPUT',
  'B6-SEND-RAPID-TAP-RECOVERY',
  'B6-SEND-FAILURE-RETRY-RECOVERY',
  'B6-SEND-SYNC-THROW-RETRY-RECOVERY',
  'B6-RETRY-RECOVERY',
  'B6-HUMAN-HANDOFF-SWITCH-TAB',
  'B6-HOME-ENTRY',
  'B6-SAFE-REFUSAL',
  'B6-PRIVACY-AND-ISOLATION',
]
