import type {
  AIConsultationSafetyPolicyInputV1,
  AIHandoffReasonV1,
  AIHandoffV1,
  AISafetyEvaluationV1,
} from '../../types/ai-consultation-v1'

const PUBLIC_EXPLANATIONS: Record<AIHandoffReasonV1, string> = {
  user_requested_human: '可以转到养老顾问服务，由人工继续协助。',
  allowed_knowledge_insufficient: '当前允许使用的资料不足，建议由养老顾问继续协助。',
  institution_confirmation_required: '这项信息需要由相关机构或养老顾问进一步确认。',
  realtime_business_fact_required: '实时床位、价格等信息需要由养老顾问协助确认。',
  contract_payment_or_complaint: '合同、付款或投诉事项需要由人工渠道处理。',
  appointment_or_complex_care: '预约带看或复杂照护事项需要由养老顾问继续协助。',
  medical_professional_required: '该问题需要合格医疗专业人员判断，养老顾问和 AI 都不能替代医疗诊断。',
  consultant_guidance_suggested: '如需进一步了解，可以联系养老顾问。',
}
const createHandoff = (reason: AIHandoffReasonV1): AIHandoffV1 => {
  const handoff: AIHandoffV1 = {
    level: 'required',
    reason,
    publicExplanation: PUBLIC_EXPLANATIONS[reason],
  }
  if (reason !== 'medical_professional_required') handoff.destination = 'global_consultant_service'
  return handoff
}

export const evaluateAISafetyDispositionV1 = (
  input: AIConsultationSafetyPolicyInputV1,
): AISafetyEvaluationV1 => {
  if (input.requestCategory === 'medical_professional_judgment') {
    return {
      kind: 'safe_refusal',
      state: 'need_human',
      handoff: createHandoff('medical_professional_required'),
    }
  }
  if (input.userRequestedHuman) {
    return { kind: 'human_handoff', state: 'need_human', handoff: createHandoff('user_requested_human') }
  }
  if (input.requestCategory === 'institution_confirmation') {
    return { kind: 'human_handoff', state: 'need_human', handoff: createHandoff('institution_confirmation_required') }
  }
  if (input.requestCategory === 'realtime_business_fact') {
    return { kind: 'human_handoff', state: 'need_human', handoff: createHandoff('realtime_business_fact_required') }
  }
  if (input.requestCategory === 'contract_payment_or_complaint') {
    return { kind: 'human_handoff', state: 'need_human', handoff: createHandoff('contract_payment_or_complaint') }
  }
  if (input.requestCategory === 'appointment_or_complex_care') {
    return { kind: 'human_handoff', state: 'need_human', handoff: createHandoff('appointment_or_complex_care') }
  }
  if (input.requestCategory === 'prohibited_nonmedical') {
    return { kind: 'safe_refusal', state: 'answer_ready', handoff: null }
  }
  if (!input.hasSufficientAllowedKnowledge) {
    if (input.consecutiveAllowedKnowledgeInsufficiencyCount >= 2) {
      return {
        kind: 'human_handoff',
        state: 'need_human',
        handoff: createHandoff('allowed_knowledge_insufficient'),
      }
    }
    return { kind: 'knowledge_unavailable', state: 'knowledge_unavailable' }
  }
  return { kind: 'answer', state: 'answer_ready' }
}
