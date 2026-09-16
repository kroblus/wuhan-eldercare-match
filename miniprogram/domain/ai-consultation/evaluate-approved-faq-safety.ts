import type {
  AIConsultationRequestCategoryV1,
  AIConsultationSafetyPolicyInputV1,
} from '../../types/ai-consultation-v1'
import { normalizeApprovedFaqQueryV1 } from './validate-approved-faq'

type AIApprovedFaqPreflightCategoryV1 = AIConsultationRequestCategoryV1 | 'user_requested_human'

export type AIApprovedFaqSafetyPreflightV1 =
  | { kind: 'safe_to_lookup'; policy: AIConsultationSafetyPolicyInputV1 }
  | { kind: 'blocked'; policy: AIConsultationSafetyPolicyInputV1 }

const EXPLICIT_CATEGORY_PHRASES: readonly [AIApprovedFaqPreflightCategoryV1, readonly string[]][] = [
  ['medical_professional_judgment', ['我该吃什么药', '请帮我诊断', '怎么治疗这个病', '要不要调整用药']],
  ['user_requested_human', ['我要人工', '请联系顾问', '我想找人工']],
  ['institution_confirmation', ['这家机构一定适合吗', '机构能不能保证适合']],
  ['realtime_business_fact', ['实时床位还有吗', '现在有床位吗', '最终价格是多少']],
  ['contract_payment_or_complaint', ['我要投诉', '合同怎么处理', '付款发生争议']],
  ['appointment_or_complex_care', ['我要预约带看', '请确认预约成功', '复杂照护怎么办']],
  ['prohibited_nonmedical', ['哪个机构一定最好', '请重新帮我排名']],
]

const categoryFor = (input: string): AIApprovedFaqPreflightCategoryV1 | null => {
  const normalized = normalizeApprovedFaqQueryV1(input)
  for (const [category, phrases] of EXPLICIT_CATEGORY_PHRASES) {
    if (phrases.some((phrase) => normalizeApprovedFaqQueryV1(phrase) === normalized)) return category
  }
  return null
}

/**
 * B7 deliberately uses only a small, explicit safety table.  It is not an
 * intent classifier: anything outside the table remains subject to exact FAQ
 * lookup and fails closed when no approved entry matches.
 */
export const evaluateApprovedFaqSafetyPreflightV1 = (
  input: string,
): AIApprovedFaqSafetyPreflightV1 => {
  const category = categoryFor(input)
  if (!category) {
    return {
      kind: 'safe_to_lookup',
      policy: {
        requestCategory: 'allowlisted_explanation',
        userRequestedHuman: false,
        consecutiveAllowedKnowledgeInsufficiencyCount: 0,
        hasSufficientAllowedKnowledge: false,
      },
    }
  }
  return {
    kind: 'blocked',
    policy: {
      requestCategory: category === 'user_requested_human' ? 'allowlisted_explanation' : category,
      userRequestedHuman: category === 'user_requested_human',
      consecutiveAllowedKnowledgeInsufficiencyCount: 0,
      hasSufficientAllowedKnowledge: false,
    },
  }
}
