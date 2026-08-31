# Recommendation Contract V1

状态：FROZEN_PHASE_4B_2

产品审批：CONSERVATIVE_EXACT_WITH_CONDITIONAL

版本：recommendation-contract-v1

规范性入口为本文 §19 与 `RECOMMENDATION_RULE_CONTRACT.md`；§1–18 原文保留为 Phase 4B-1 历史提案，不是最终 V1 规则。其中旧 A/B、readiness、tier、权重候选和待审批表述均不再生效。阶段审批与 quota/resume 历史保留在 `RECOMMENDATION_RULE_PROPOSAL.md` §0。matching_engine 与 backend_domain 已只读 PASS，允许在本冻结契约下实现纯域；freeze 不代替后续 runtime/compatibility/QA，也不授权 UI、Backend、持久化或真实机构数据。

## 1. Source of truth and scope

本提案建立在以下已冻结输入之上：

- AGENTS.md；
- ASSESSMENT_CONTRACT.md（assessment-schema-v1）；
- ELDER_PROFILE_CONTRACT.md（elder-profile-contract-v1）；
- ADL_RULE_CONTRACT.md（adl-ruleset-v1）；
- ANONYMOUS_PROFILE_PREVIEW_CONTRACT.md；
- INSTITUTION_CONTRACT.md（institution-contract-v1）；
- INSTITUTION_CAPABILITY_CONTRACT.md（institution-capability-contract-v1）；
- PROFILE_UI_CONTRACT.md；
- MOCK_DATA_POLICY.md、DOMAIN_CONTRACT.md；
- 两份正式产品 PRD，尤其页面 09–13、推荐结果/机构详情、真实性和解释性要求。

Recommendation 只能消费已经派生的 ElderProfile 语义或合法的 ElderProfilePreview 语义，以及机构记录经过字段级核验投影后的 effective facts。它不得再次读取 27 个 Assessment answers、Draft Store、页面 label、Mock display string、服务文本或未核验 raw capability。

## 2. Non-goals and product boundary

本阶段不授权：

- 任何推荐、过滤、排序或分数运行时代码；
- 把 LLM、随机数、网络状态或当前时间用于推荐决策；
- 创建 Recommendation、RecommendationReason、RecommendationPreview 的生产实现；
- Recommendation 页面、机构列表/详情 UI 或 VR 业务；
- API、数据库、登录、手机号、预约落库；
- 真实武汉机构记录或生产 verified dataset。

所有文中的类型、JSON 和示例均为提案说明；没有任何代码契约在本阶段自动生效。

## 3. Domain pipeline

未来唯一允许的语义管线是：

~~~text
ElderProfile semantics / ElderProfilePreview semantics
        +
validated Institution record
        -> effective matching-critical facts
        -> requirement and capability evaluation
        -> care/safety tier
        -> preference and financial fit
        -> explainable ordering within a tier
        -> Recommendation / RecommendationPreview result
~~~

机构 raw capability 必须先经过：

~~~text
validateInstitutionRecord(record)
  -> field-level verification projection(evaluationAsOf)
  -> effective capability status
~~~

resolveEffectiveCapability 的输入必须来自同一份已验证记录、同一 recordRevision 和其可解析 evidence；只看到一个 supported marker 不足以生成理由或 eligibility。evaluationAsOf 必须是调用方显式传入的合法时间；projection 不读取 Date.now()。

未来 Matching 仅可读取 Institution Contract §14/Capability Contract §9 冻结的 22 个 InstitutionMatchingCriticalFieldPath：区域、verified supportedTypes、五档接收、轮椅/卧床/转移、认知接收/走失支持、九项 special care 和参考月费。primaryType、availability、rooms、media、VR、qualification、医疗描述、康复设施、人员和服务文本不在该集合内。

## 4. Recommendation input contract

### 4.1 Formal input

所有评估必须共享一个显式、可回放的 context；外层 input 的 evaluationAsOf 必须与 institutionDataset.evaluationAsOf 相同：

~~~ts
type RecommendationPolicy = 'conservative' | 'balanced'

type RecommendationProfileInputContext =
  | {
      kind: 'formal_profile'
      source: ElderProfile['identity']
      adlRulesetVersion: 'adl-ruleset-v1'
    }
  | {
      kind: 'preview_profile'
      source: ElderProfilePreview['source']
      profileContractVersion: 'elder-profile-contract-v1'
      derivationRulesetVersion: 'elder-profile-ruleset-v1'
      adlRulesetVersion: 'adl-ruleset-v1'
    }

type RecommendationPoolManifestEntry = {
  institutionId: string
  recordRevision: number
} & (
  | { disposition: 'included'; exclusionReasonCode?: never }
  | {
      disposition: 'excluded'
      exclusionReasonCode: 'RECORD_NOT_PUBLISHED' | 'MOCK_DATA_NOT_PRODUCTION' | 'INVALID_RECORD'
    }
)

interface RecommendationPoolManifest {
  datasetVersion: string
  entries: readonly RecommendationPoolManifestEntry[]
}

interface RecommendationElderSemanticSnapshot {
  adl: ElderProfile['adl']['derivedFacts']
  mobility: ElderProfile['mobility']['derivedFacts']
  health: ElderProfile['health']['derivedFacts']
  cognition: ElderProfile['cognition']['derivedFacts']
  specialCare: ElderProfile['specialCare']['derivedFacts']
  preference: ElderProfile['preference']['rawFacts']
  financial: ElderProfile['financial']['rawFacts']
  intent: ElderProfile['intent']['rawFacts']
  evidence: readonly DerivationEvidence[]
  clarifications: readonly ProfileClarification[]
}

interface RecommendationEvaluationContext {
  evaluationAsOf: string
  selectedPolicy: RecommendationPolicy
  rulesetVersion: 'recommendation-ruleset-v1-proposal'
  profileInputContext: RecommendationProfileInputContext
  institutionDatasetVersion: string
  poolManifest: RecommendationPoolManifest
  elderSemanticSnapshot: RecommendationElderSemanticSnapshot
  institutionContractVersion: 'institution-contract-v1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}
~~~

`RecommendationElderSemanticSnapshot` 是本次 §5.1 消费字段的不可变副本：仅 derivedFacts、preference/financial/intent rawFacts，以及引用到的 evidence/clarifications；不包括姓名、其他 basic rawFacts 或全量 27 个答案。它是内部审计快照，不是新的可公开调用 bare-payload 输入。正式保存时必须保留该快照或等价不可变版本；Preview 中仅限内存。evidenceId 必须能在该快照中解析，不能仅保留身份和版本字符串。

快照必须逐字段等于对应 envelope 的消费字段投影；evidence/clarifications 只保留这些字段依赖的原条目，不能重推、伪造或漏掉 blocking 项。profileInputContext 的 source/版本和 snapshot 必须来自同一输入；formal 的 identity、preview 的 source/localDraftId 必须精确相等。禁止 Profile A + snapshot B，或复制旧 snapshot 后只换版本/身份。由 adapter 生成并 deterministic 校验此不变量，不能接受调用方任意拼装的 snapshot。

formal_profile 必须同时携带真实 assessmentId/elderId；preview_profile 只能携带真实 localDraftId 来源。`profileInputContext` 绑定这次不可变的 ElderProfile/ElderProfilePreview semantic snapshot，不是一个可被 latest profile 替换的缓存键。版本和身份归属分别由 Assessment/Profile 或 Preview contract 负责，推荐 shared core 不拥有历史 identity。未来正式持久化外壳可以另行记录服务器 recommendationId/createdAt，但这些字段不进入 shared core，也不进入 RecommendationPreview。

正式推荐必须从真实历史身份开始：

~~~ts
interface FormalRecommendationInput {
  kind: 'formal_recommendation_input'
  elderProfile: ElderProfile
  institutionDataset: ValidatedInstitutionDataset
  evaluationContext: RecommendationEvaluationContext
}
~~~

elderProfile.identity.assessmentId 与 elderProfile.identity.elderId 必须是真实服务器身份；未来正式 Recommendation.assessmentId 必须复制并绑定这个真实 assessmentId。同一 Assessment 的 recommendation 不能在结果中改写成另一个身份。

未来服务端必须验证 user → Elder → Assessment 归属和 completed 状态，不能信任客户端填入的身份。正式 context 的 source 完整复制已验证 identity（包括 assessmentCompletedAt）；匿名 context 只能是 preview_profile。输入和输出的 context、source、policy、datasetVersion、poolManifest 必须一致，禁止混装两种身份。

### 4.2 Anonymous preview input

匿名推荐只能在项目负责人批准 Preview 边界后使用独立 envelope：

~~~ts
interface AnonymousRecommendationPreviewInput {
  kind: 'anonymous_recommendation_preview_input'
  elderProfilePreview: ElderProfilePreview
  institutionDataset: ValidatedInstitutionDataset
  evaluationContext: RecommendationEvaluationContext
}
~~~

它只使用当前内存中的 ElderProfilePreview 和 effective institution facts。Preview 输入及结果不得拥有或伪造：

~~~text
recommendationId
assessmentId
elderId
generatedAt
~~~

不得以 localDraftId 填入任何正式 ID，也不得把 Draft 包装成 CompletedAssessment。Preview 不持久化、不进入历史列表、不新增 Preview Store；其下一次使用必须从当前 Draft 重新派生。

### 4.3 Institution dataset input

~~~ts
interface ValidatedInstitutionDataset {
  datasetKind: 'validated_institution_dataset'
  datasetVersion: string
  evaluationAsOf: string
  records: readonly ValidatedInstitutionRecord[]
  poolManifest: RecommendationPoolManifest
}
~~~

dataset 资格和 per-elder eligibility 是两个层次：

1. dataset 入口必须同时满足 recordStatus = published 且 recordProvenance = PRODUCTION_CANDIDATE；draft、suspended、archived 或 MOCK_DEVELOPMENT_ONLY 均不得进入默认生产 dataset；
2. 每家机构仍须逐个检查 region、capability、type 和 price 的字段级 effective status，不能因为进入 dataset 就假定对每个老人 eligible。

shared semantic core 接收的不是可随意读取的 raw InstitutionRecord，而是 adapter 产出的 EffectiveInstitutionFacts；raw record 只在 adapter 内用于证明 recordRevision、fieldPath、valueSnapshot 和 projection reason 的一致性。

这里 ValidatedInstitutionRecord 表示现有 validator 成功后的原记录，不是新领域对象或可绕过校验的标记。EffectiveInstitutionFacts 是 22 个白名单字段的 projection 结果加 §8 引用；core 不接收白名单外字段。manifest 必须枚举本次完整候选池的 institutionId/recordRevision、准入或排除原因，并绑定各 revision 不可变字段/evidence 快照；仅有 opaque datasetVersion 不足以重放。重复 institutionId、混合 revision、context/dataset 的 evaluationAsOf 不一致或不存在的 evidence 引用属于 invalid_input，先拒绝，不输出 NO_EXACT_MATCH。

`institutionDataset.evaluationAsOf` 必须与 `evaluationContext.evaluationAsOf` 字符串完全相同；若不相同，input 无效，不能用任一时间覆盖另一时间。

规范性不变量：context.institutionDatasetVersion、context.poolManifest.datasetVersion、dataset.datasetVersion 必须相等；context.poolManifest 与 dataset.poolManifest 完全相同；manifest 的 included 项与 dataset.records 的 institutionId+recordRevision 一一对应，excluded 项不得出现于 records。不能合法解析 institutionId/revision 的损坏输入必须拒绝，不为其生成 manifest 身份。exclusionReasonCode 是稳定 code，不能用自由文案参与计算。

当前没有真实 verified institution dataset。任何 synthetic fixture 只能标识 MOCK_DEVELOPMENT_ONLY、TEST_SYNTHETIC_VERIFIED、NOT_REAL_INSTITUTION_DATA，不得据此声称某家武汉机构最适合任何老人。

其中只有 MOCK_DEVELOPMENT_ONLY 是现有 recordProvenance code；另两者是测试说明标签，不得写入冻结字段或伪装为生产准入。未来 synthetic 测试可在隔离测试入口提供有效投影，但不能由此绕过默认生产 dataset gate。

## 5. Elder semantic consumption boundary

### 5.1 Allowed profile facts

Matching 只读取 ElderProfile/ElderProfilePreview 的公开语义：

- adl.derivedFacts.careLevel、adl.derivedFacts.careModes、mobility.derivedFacts.level；
- health.derivedFacts.rehabilitationNeed；
- cognition.derivedFacts；
- specialCare.derivedFacts.requiredCareCapabilities；
- preference.rawFacts（机构类型、最多 3 个 priority、可选 region snapshot）；
- financial.rawFacts（月预算、一次性费用容忍度）；
- intent.rawFacts（入住时间、顾问意向）；
- 已有 evidence 和 clarifications，仅作来源和 readiness 检查。

不得从 preference/financial 缺少 derived evidence ID 这一事实推断其“不可靠”。它们是已冻结的 profile raw facts；理由引用必须使用 raw fact snapshot reference，而不是伪造 ev:financial.* 或 ev:preference.*。也不得绕过 Profile 去读取 Store 或原始 27 个 answer。

### 5.2 Elder evidence references

提议使用两个明确通道：

~~~ts
type ProfileRawFactEvidenceRef =
  | {
      kind: 'profile_raw_fact'
      profilePath: 'preference.rawFacts.preferredInstitutionType'
      sourceQuestionId: 'preference.careType'
      valueSnapshot: AssessmentAnswerValueMap['preference.careType']
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'preference.rawFacts.priorities'
      sourceQuestionId: 'preference.priorities'
      valueSnapshot: AssessmentAnswerValueMap['preference.priorities']
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'preference.rawFacts.regionPreference'
      sourceQuestionId: 'preference.region'
      presence: 'provided' | 'absent'
      valueSnapshot: AssessmentAnswerValueMap['preference.region'] | null
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'financial.rawFacts.monthlyBudget'
      sourceQuestionId: 'budget.monthlyRange'
      valueSnapshot: AssessmentAnswerValueMap['budget.monthlyRange']
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'financial.rawFacts.depositTolerance'
      sourceQuestionId: 'budget.upfrontCostAcceptance'
      valueSnapshot: AssessmentAnswerValueMap['budget.upfrontCostAcceptance']
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'intent.rawFacts.moveInTiming'
      sourceQuestionId: 'budget.moveInTiming'
      valueSnapshot: AssessmentAnswerValueMap['budget.moveInTiming']
    }
  | {
      kind: 'profile_raw_fact'
      profilePath: 'intent.rawFacts.consultantIntent'
      sourceQuestionId: 'budget.consultantSupport'
      valueSnapshot: AssessmentAnswerValueMap['budget.consultantSupport']
    }

type ElderEvidenceRef =
  | {
      kind: 'derived_evidence'
      derivedField: ElderProfileDerivedField
      evidenceId: DerivationEvidenceId
    }
  | ProfileRawFactEvidenceRef
~~~

valueSnapshot 必须是当前 Profile 中的结构化值副本；profilePath 与 sourceQuestionId 必须相互对应。这里的七个 raw fact union 与现有 assessment.ts 的答案类型一一对应，不允许以 unknown、自由文本或“ev:preference.*”占位。

region 的 presence=absent 时 valueSnapshot 必须为 null；provided 时必须是现有 region answer。该 null 只记录可选字段缺失，不是新增 Assessment option；不能混为 no_preference。

### 5.3 Input readiness and clarifications

Profile clarification 的 priority 是业务前置条件，不是可忽略的 UI 提示：

- required_before_classification：不能宣称 care-level classification 已确定；
- required_before_hard_filter：不能把受影响 requirement/capability 当作已澄清，也不能让该条件下的机构成为 eligible 或 exact；
- recommended/informational：不阻止已确定的其他事实，但必须保留可解释提示。

提案输出应同时有全局 readiness 和每个 requirement 的结果：

~~~ts
type RecommendationInputReadiness =
  | 'ready_for_exact_evaluation'
  | 'ready_for_conditional_evaluation'
  | 'blocked_by_required_clarification'
  | 'invalid_input'

interface RequirementReadiness {
  sourceDerivedField: ElderProfileDerivedField
  status: 'resolved' | 'unresolved' | 'not_applicable'
  blockingPriority?: ClarificationPriority
  clarificationIds: readonly string[]
}
~~~

一个未澄清的事实可以保留其他已知 hard conflict 的审计结果，但不得被当作 eligible/exact。例如，老人有已确认的鼻饲 required，同时另一个 care clue 未澄清；required 与机构 unsupported 仍记录 conflict，而全局结果仍不能称 exact，直到所有 required_before_hard_filter 影响的事实处理完毕。

not_reported 不是 not_required：它不形成正向 requirement，也不提供“老人不需要”的证据。对一个未声明的 capability，evaluation 可返回 not_applicable（requirementStatus = not_reported），但结果不得写成“已确认无需求”。

## 6. Requirement status semantics

ElderProfile CareCapabilityRequirementStatus 的消费边界：

| Elder status | 语义 | 可生成的 requirement | exact/eligibility 边界 |
|---|---|---|---|
| required | 用户明确提出对应 special-care；或被已批准的明确规则提升 | hard requirement candidate | 只有对应 effective capability supported 才能 satisfied；requires_assessment/unknown 不得 exact/eligible；unsupported 是硬冲突 |
| not_required | 用户明确选择 none 且没有跨题 clue | 没有该项 requirement | not_applicable，不能倒推其他能力；不因机构 status 加分 |
| not_reported | 用户没有声明该项，不能等同无需求 | 没有已声明 requirement | 不作为正向或负向事实；不得渲染为“不需要” |
| unknown | 用户明确选择 unknown | 未解析 requirement | unverified；受影响的 exact/eligible 被阻断 |
| needs_confirmation | ADL/健康等 clue 尚未澄清 | potential requirement，outcome=unverified | 不得 exact/eligible；可按 Policy A/B 决定是否展示 unverified candidate |

required 的来源必须可以追溯到 Profile 的明确 stable code 和 existing derived evidence。症状、年龄、careLevel、机构类型或 UI 文案不能单独制造 required。

## 7. Hard constraint result

提议的 per-constraint 结构：

~~~ts
type HardConstraintOutcome =
  | 'satisfied'
  | 'conditional'
  | 'unverified'
  | 'conflict'
  | 'not_applicable'

interface HardConstraintResult {
  constraintCode: string
  sourceDerivedField: ElderProfileDerivedField
  elderRequirementStatus: CareCapabilityRequirementStatus | 'known_care_level' | 'known_mobility'
  institutionId: string
  recordRevision: number
  institutionFieldPath: InstitutionMatchingCriticalFieldPath | null
  institutionEffectiveStatus: InstitutionEffectiveCapabilityStatus | 'not_evaluated'
  outcome: HardConstraintOutcome
  blocksExact: boolean
  blocksEligibility: boolean
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
  clarificationIds: readonly string[]
}
~~~

结果不是 boolean：

- satisfied：老人侧已明确、机构侧 current verified effective supported；
- conditional：老人 requirement 已明确，但机构有效状态为 requires_assessment；老人自身需求未解析时只能 unverified，不能混用；
- unverified：机构 effective unknown，或老人 requirement/分类被 unknown/needs_confirmation 阻断；
- conflict：老人侧为明确 required，机构侧 current verified effective unsupported；
- not_applicable：老人明确 not_required，或没有该映射适用性，但不把 not_reported 改写为 not_required。

明确的 unsupported 与资料缺失 unknown 必须永远是不同 outcome；requires_assessment 也不能改写成 supported。

## 8. Institution evidence reference

~~~ts
interface InstitutionEffectiveEvidenceRef {
  institutionId: string
  recordRevision: number
  fieldPath: InstitutionMatchingCriticalFieldPath
  rawSnapshot: InstitutionEvidenceValueSnapshot | null
  effectiveSnapshot: InstitutionEvidenceValueSnapshot | null
  projectionReason:
    | 'raw_value_currently_verified'
    | 'raw_value_unknown'
    | 'raw_value_unverified'
    | 'raw_value_expired'
    | 'raw_value_past_valid_until'
    | 'verification_in_future'
    | 'raw_field_unavailable'
  evidenceIds: readonly string[]
  verificationStatus: 'verified' | 'expired' | 'unverified'
  verifiedAt?: string
  validUntil?: string
  evaluationAsOf: string
}
~~~

capability 的 snapshot 使用 stable_code；普通字段使用与该 fieldPath 对应的现有 typed snapshot。缺失值为 null，不伪造 evidence；unknown/unavailable/unverified 字段可有空 evidenceIds，此时 recordRevision+fieldPath+字段原快照证明“资料缺失”，不能生成 supported 理由。有效确定值必须有可解析且匹配的 verified evidence。validUntil == evaluationAsOf 沿用现有 projection 的有效语义，未来 verifiedAt 不得提前生效。完整 raw 字段 verification 元数据保留在 manifest 对应快照，不能从 effective unknown 反写 raw evidence。

未来 adapter 必须 deterministic 验证 path → snapshot 映射：identity.regionCode=stable_code；typeProfile.supportedTypes=stable_code_list；19 个 capability path=四态 stable_code；price.referenceMonthlyPrice=reference_monthly_price。rawSnapshot 必须与记录一致，effectiveSnapshot 必须与现有 projection 一致；capability 的 effective status 就是其 effectiveSnapshot.value，非 capability 未知值使用 null。projectionReason、verification、evidenceIds 和 evaluationAsOf 必须相容，否则 invalid_input。这些验证属于后续实现要求，不是声称本轮已有 validator。

未来 adapter 必须从同一份 validated record 和 projection 结果构建 rawSnapshot、effectiveSnapshot、projectionReason 与 evaluationAsOf，不能仅放一个 verified=true 标记。raw supported/unverified 只能投影为 effective unknown，不能渲染为支持。Effective determinate status 的 reason 必须引用当前有效 verified evidence；effective unknown 可引用能证明 unknown 的同一 revision evidence，具体展示模板另行批准。没有对应 Institution target 的 HardConstraintResult 必须将 institutionFieldPath 设为 null、institutionEffectiveStatus 设为 not_evaluated，不得制造路径。

裸 evidenceId 只在所属同一个 Profile/input context 内有效。正式 Recommendation 的理由引用必须绑定 assessmentId、Profile contract/ruleset versions 和输入 snapshot；Preview 的理由只绑定当前 localDraftId 来源、semantic snapshot 和 institution recordRevision，不把 localDraftId 当内容 revision，也不能依赖 Preview cache。

institutionId + recordRevision + fieldPath + rawSnapshot/effectiveSnapshot + evidenceIds 是机构侧解释当时事实的最小定位。机构 revision 改变时必须形成新的 Recommendation 结果或新的 Preview 计算，不得把新记录套在旧理由上。当前 Institution Contract 未定义 evidenceRevision，本提案不发明该字段。

## 9. Recommendation result envelope

~~~ts
type RecommendationMatchTier =
  | 'exact'
  | 'near'
  | 'conditional'
  | 'unverified'
  | 'ineligible'

type RecommendationEligibility =
  | 'eligible'
  | 'conditional'
  | 'unverified'
  | 'ineligible'

interface RecommendationItem {
  institutionId: string
  recordRevision: number
  eligibility: RecommendationEligibility
  matchTier: RecommendationMatchTier
  constraintResults: readonly HardConstraintResult[]
  factors: readonly NamedFactorResult[]
  reasons: readonly RecommendationReason[]
  differences: readonly RecommendationDifference[]
}

interface Recommendation {
  kind: 'recommendation'
  assessmentId: string
  evaluationContext: RecommendationEvaluationContext
  selectedPolicy: RecommendationPolicy
  poolManifest: RecommendationPoolManifest
  readiness: RecommendationInputReadiness
  requirementReadiness: readonly RequirementReadiness[]
  items: readonly RecommendationItem[]
  exactMatch: boolean
  noExactMatch?: NoExactMatch
  candidateEvaluations: readonly RecommendationItem[]
}
~~~

正式对象未来才可拥有 assessmentId；其 evaluationAsOf 是显式评估输入的快照时间，不是隐式当前时间。字段名、稳定 codes 和最终版本号仍需项目负责人批准。

匿名对象单独使用：

~~~ts
interface RecommendationPreview {
  kind: 'recommendation_preview'
  source: ElderProfilePreview['source']
  evaluationContext: RecommendationEvaluationContext
  selectedPolicy: RecommendationPolicy
  poolManifest: RecommendationPoolManifest
  readiness: RecommendationInputReadiness
  requirementReadiness: readonly RequirementReadiness[]
  items: readonly RecommendationItem[]
  exactMatch: boolean
  noExactMatch?: NoExactMatch
  candidateEvaluations: readonly RecommendationItem[]
}
~~~

RecommendationPreview 不得出现 recommendationId、assessmentId、elderId、generatedAt 或持久化标识；但可以携带真实 localDraftId 来源和显式 evaluationAsOf，用于绑定当前 in-memory evaluation context。正式 Recommendation 与 Preview 必须共享同一个 semantic core，差异只在 identity adapter 和输出持久化边界。`evaluationContext` 中的 profile/version snapshot、selectedPolicy、pool manifest 与 institution revision 共同保证两侧 evidence 可回放。

candidateEvaluations 为内部完整评估审计，不是推荐卡片；items 为按 policy 选择的展示候选，永远不包含 ineligible。exactMatch 取决于全池是否存在 exact，不取决于截断后的数量；false 时必须有 noExactMatch，true 时不得附 NO_EXACT_MATCH。结果先按 exact、soft near、conditional、unverified 分组，再在每组内部比较批准因子；Policy A 隐藏后两组，Policy B 才可显示且不能混标为 near/eligible。无可评估机构时保留稳定空池原因，不生成虚假候选。

invalid_input 使用拒绝结果而不是生成上述 Recommendation/Preview。其余 readiness 如存在 blocking clarification，仍允许记录已知冲突，但不能成为 eligible/exact；B 最多显示明确未核验候选。readiness 的 conditional evaluation 泛指可以作不确定性评估，不改变单项 conditional/unverified 的区分。

NamedFactorResult 提案仅记录 factorCode、结构化 fit/status、两侧 evidence refs；不含本轮未批准的权重或百分比。完整名称和适用域见规则提案 §10.3。scope=context 的来源身份、items 的 recordRevision 和 NoExactMatch 中逐机构约束不可脱离所属 evaluationContext 独立传用。

~~~ts
type NamedFactorResult = {
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
} & (
  | { factorCode: 'care_compatibility_tier'; status: RecommendationEligibility }
  | {
      factorCode: 'budget_fit'
      status: 'within_budget' | 'partially_overlapping' | 'above_budget' | 'below_declared_range' | 'unknown'
    }
  | { factorCode: 'region_fit'; status: 'same' | 'different' | 'unknown' | 'not_applicable' }
  | { factorCode: 'institution_type_fit'; status: 'match' | 'mismatch' | 'unknown' | 'not_applicable' }
  | {
      factorCode: 'rehabilitation_fit'
      status: InstitutionEffectiveCapabilityStatus | 'not_applicable'
    }
  | {
      factorCode: 'priority_fit'
      priorityCode: AssessmentAnswerValueMap['preference.priorities'][number]
      status: 'match' | 'mismatch' | 'unknown' | 'not_scorable' | 'not_applicable'
    }
)
~~~

上述 code/status 组合属于文档提案，不输出 score；care tier 只分组，不可加权抵消。priority_fit 每个已选 priority 一项，是否可评分及证据限制按规则 §9；不可评分项的机构 refs 可为空，只生成资料限制说明，不生成 positive reason。

## 10. Exact, conditional, near and ineligible

推荐必须先决定 care/safety eligibility，再处理偏好和财务 fit：

| 结果 | 必要条件 | 可否被 soft factor 提升 |
|---|---|---|
| exact / eligible | 所有适用 hard requirements 为 satisfied；无受影响 required_before_classification 或 required_before_hard_filter clarification；预算 fit 为 within_budget；指定 region 为 same；已知 careType 的 supportedTypes 命中；neutral/display-only priority 不阻断 | 不需要提升；availability 和 advisory 不参与 |
| near / eligible | 所有适用 hard requirements 仍为 satisfied，且无 blocking clarification；只存在获准的预算、区域或类型差异，或预算/机构资料的非护理 warning | 只能在全部 hard requirement satisfied 时出现 |
| conditional / conditional | 至少一个明确 required 对应 requires_assessment；它不能变 exact 或 eligible | 不能由偏好分数提升 |
| unverified / unverified | 适用护理 capability effective unknown，或老人护理 requirement/分类 unknown、needs_confirmation；它不能变 exact 或 eligible | 不能由偏好分数提升 |
| ineligible / ineligible | 至少一个明确 required 对应 verified effective unsupported | 绝不能由价格、区域、环境、类型或 priority 覆盖 |

当前 exact predicate 的明确边界：

- 用户 monthlyBudget=unknown 或机构 effective price=unknown/unavailable：fit=unknown，exact=false；若护理全部满足且无 blocking clarification，仍是 near/eligible，附财务资料不足 warning，绝不能当作 within_budget；
- 机构 price.range.kind=starting_at 即使 min 落入用户上限，也因上限未知而 fit=partially_overlapping，exact=false；
- cny_15000_plus 只有 lowerBound=15000、upperBound=null；没有用户明确上限，因此 fit=unknown（BUDGET_CEILING_UNSPECIFIED），不能断言任意更高报价 within；
- 机构 bounded range 完全低于用户 lowerBound：fit=below_declared_range，exact=false；starting_at min 低于 lowerBound 但上限未知只能 partially_overlapping，不能误判 below；
- region absent 或 no_preference：fit=not_applicable，不阻断 exact；指定 region 且机构 same 才是 exact_region_fit，different/unknown 分别使 exact=false；
- 用户 careType=unknown：type fit=not_applicable，不 penalty；用户已选 type 但 institution supportedTypes effective unknown：type fit=unknown，exact=false；primaryType 不参与；
- priority 不参与 exact predicate，只作同层排序/说明：DISPLAY_EXPLAINABLE/NOT_YET_SCORABLE 为 neutral；structured priority 若未知或不命中也必须 warning，不能宣称“全部关注项满足”；
- upfront deposit/oneTimeFees、availability 和其它 advisory facts 永远不改变 exact predicate。

Layer A 的 unverified 仅指护理适配无法确认。单独的价格、指定区域或机构类型未知不改变 care eligibility；护理已全部满足时均保留 eligible，以 fit unknown + near 表达，不能降成护理 unverified。聚合顺序与规则 §10.1 一致：conflict → ineligible，否则护理 unverified/阻塞澄清 → unverified，否则 requires_assessment → conditional，最后才 eligible。

这里“有 difference”与“满足 exact predicate”是两个层次：差异必须继续保留在结果中，不能因为 UI 只显示友好文案就消除；只有上述明确条件决定 exact。若项目负责人改变预算/区域/类型是否参与 exact，必须升级本提案版本，不能在实现时临时解释。

## 11. Explainability contract

所有用户可见的推荐理由必须由 stable reason code 和两侧 evidence render；自由文本只能是未来 UI 模板输出，不是事实源。

~~~ts
type RecommendationReasonType =
  | 'care_capability'
  | 'medical_rehabilitation'
  | 'budget'
  | 'region'
  | 'institution_type'
  | 'priority'
  | 'data_quality'

interface RecommendationReason {
  reasonCode: string
  reasonType: RecommendationReasonType
  polarity: 'supported' | 'conditional' | 'unverified' | 'difference' | 'conflict'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
}
~~~

规则：

1. supported 理由必须有 Elder 侧实际 requirement/fact 和 Institution 侧 current verified effective fact；
2. conditional/unverified 理由必须明确指出需确认或资料不足，不得写成支持；
3. conflict 理由必须引用 verified unsupported 证据；
4. 每条 institution ref 的 institutionId/recordRevision 与所属 item 一致；不新增 sourceRevision 或 evidenceRevision；
5. 没有 Profile derived evidence 的 preference/financial 事实使用 raw fact ref，不编造 evidence ID；
6. availability、primaryType、房间、VR、图片和 free text 不能成为 care reason 或 score；
7. medicalSupport、rehabilitationSupport.features、upfront fees 只能进入明确标注的 advisory explanation，不能扩充 22 白名单或偷偷参与 ranking。

建议 reason code 由下列 stable families 起步（仍为 proposal）：

~~~text
CARE_LEVEL_SUPPORTED
MOBILITY_SUPPORTED
TRANSFER_SUPPORTED
COGNITIVE_ACCEPTANCE_SUPPORTED
WANDERING_SUPPORT_SUPPORTED
SPECIAL_CARE_SUPPORTED
REHABILITATION_SUPPORTED
REQUIREMENT_REQUIRES_ASSESSMENT
REQUIREMENT_UNVERIFIED
REQUIREMENT_UNSUPPORTED
BUDGET_WITHIN_RANGE
BUDGET_PARTIAL_OVERLAP
BUDGET_ABOVE_RANGE
BUDGET_BELOW_DECLARED_RANGE
BUDGET_CEILING_UNSPECIFIED
BUDGET_UNKNOWN
REGION_MATCH
REGION_DIFFERENT
REGION_UNKNOWN
TYPE_MATCH
TYPE_DIFFERENT
TYPE_UNKNOWN
PRIORITY_STRUCTURED_MATCH
PRIORITY_DISPLAY_ONLY
DATA_NOT_VERIFIED
~~~

Reason code 只能在对应结构化证据存在时生成；不要将这些 code 变成当前实现。

## 12. Difference and warning contract

Matching-critical reasons/differences 与白名单外 advisory 必须是两个 evidence 通道：

~~~ts
type InstitutionAdvisoryEvidenceRef = {
  institutionId: string
  recordRevision: number
  evaluationAsOf: string
  evidenceIds: readonly string[]
} & (
  | { fieldPath: 'price.deposit'; snapshot: InstitutionRecord['price']['deposit'] }
  | {
      fieldPath: 'price.oneTimeFees'
      scope: 'list_presence'
      snapshot: InstitutionRecord['price']['oneTimeFees']
      evidenceIds: readonly []
    }
  | {
      fieldPath: 'price.oneTimeFees'
      scope: 'fee_amount'
      feeId: string
      snapshot: InstitutionRecord['price']['oneTimeFees'][number]['referenceAmount']
    }
  | { fieldPath: 'operations.bedAvailability'; snapshot: InstitutionRecord['operations']['bedAvailability'] }
)
~~~

`InstitutionEffectiveEvidenceRef` 只允许 22 个 matching-critical path；`InstitutionAdvisoryEvidenceRef` 只能用于 advisory，不得放入 HardConstraint、care compatibility、ranking factor 或 matching RecommendationReason。两类 snapshot 都必须来自同一 validated record/revision；不能仅复制一个 status marker。

此处仅建模本轮必要的 upfront cost 与 availability 提示。oneTimeFees 按真实 feeId 定位每项 referenceAmount 和 verification，列表本身不能伪造整体 verified 标记；空列表/空 evidence 只支持“资料不足”。§15 其他展示资料未来需要独立字段级 locator 才能做结构化 advisory，本轮不扩建其类型。advisory 在 core 结果之后独立附加，不进入 semantic ranking。内部 SourceReference/SourceNote 不出现在公共 UI 模型。

scope=list_presence 只说明项目列表有无，不能声称费用已核验/费用为零。scope=fee_amount 时 feeId 必须在同一 recordRevision 的 oneTimeFees 中唯一命中，snapshot 必须等于该项 referenceAmount；evidenceIds 必须来自该 leaf 的 verification 并解析到同一 fee 的 fieldPath。其他 fee 的证据不可互换，unknown 金额不得补造证据。

下面两个对象属于不同通道：RecommendationDifference 是 semantic core 的结构化差异；RecommendationAdvisoryAttachment 是 core 返回后独立附加的呈现资料，不是 RecommendationItem.differences 的成员，也不是 Recommendation/RecommendationPreview envelope 的字段。投影不明/缺失的费用不能渲染为 verified 或 accepted。相同 core 输入必须产生相同核心结果；availability 变化允许 attachment 不同，但不能使核心结果或排序变化。

~~~ts
interface RecommendationDifference {
  differenceCode: string
  differenceType:
    | 'hard_conflict'
    | 'requires_assessment'
    | 'unknown_capability'
    | 'budget'
    | 'region'
    | 'institution_type'
    | 'priority'
    | 'data_quality'
  severity: 'blocking' | 'important' | 'advisory'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  institutionEvidenceRefs: readonly InstitutionEffectiveEvidenceRef[]
}
~~~

独立的 post-core attachment 提案：

~~~ts
interface RecommendationAdvisoryAttachment {
  institutionId: string
  recordRevision: number
  advisoryCode: 'UPFRONT_COST_NEEDS_INQUIRY' | 'AVAILABILITY_DISPLAY_ONLY'
  severity: 'advisory'
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  advisoryEvidenceRefs: readonly InstitutionAdvisoryEvidenceRef[]
}
~~~

attachment 只能附到同一 evaluationContext 所属 institutionId/recordRevision，不含匹配 critical ref、不影响 hard constraint、factor、reason 或 exact。upfront 可引用 financial.depositTolerance；availability 只引用机构侧、不伪造 Elder evidence。匿名 attachment 同样仅内存；正式未来若需历史展示，可在独立持久化外壳中显式保存带时间/revision的附件快照，不能用最新动态数据冒充历史资料，本轮不实现任何保存。

Difference 是核心结果的一等结构，不是任意自由文本：

- required + effective unsupported：hard_conflict/blocking，不能进入 nearMatches；
- required + requires_assessment：requires_assessment/important，不能称 supported；
- required + effective unknown：unknown_capability/important，不能称 unsupported；
- starting-at 月费超过用户上限或跨越预算：budget，明确为参考起步价/部分重叠，不承诺总价；
- deposit/oneTimeFees unknown：只在独立 UPFRONT_COST_NEEDS_INQUIRY attachment 中提示；不能从空列表、unknown 或 tolerance 推导“已接受”，不生成核心 Difference；
- region different：region/advisory，V1 默认不做 hard exclusion；
- type mismatch：institution_type/advisory，不能改写 care compatibility；
- 机构 availability unavailable：只在独立 AVAILABILITY_DISPLAY_ONLY attachment 中提示，不生成核心 Difference。

所有匹配 difference 的两侧来源都必须可追溯；如果没有可核验机构证据，只能引用缺失字段快照说明资料未核验，不能猜测差异。attachment 与核心 difference 的 equality/展示/保存边界不得混用。

## 13. NO_EXACT_MATCH

~~~ts
interface NoExactMatch {
  code: 'NO_EXACT_MATCH'
  reasonCode:
    | 'NO_VERIFIED_INSTITUTION_POOL'
    | 'ALL_CANDIDATES_HAVE_HARD_CONFLICT'
    | 'REQUIRED_CAPABILITY_UNRESOLVED'
    | 'ONLY_SOFT_NEAR_MATCHES'
    | 'NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES'
  unmetHardRequirements: readonly HardConstraintResult[]
  unverifiedRequirements: readonly HardConstraintResult[]
  nearMatches: readonly RecommendationItem[]
  differences: readonly RecommendationDifference[]
}
~~~

要求：

1. NO_EXACT_MATCH 不是简单 items=[]；它必须给出原因、未满足 hard requirements、未核验 requirements 和 near matches；
2. nearMatches 最多 3 家，少于 3 家就少返回，不能凑数；
3. verified unsupported 的 hard requirement 不能隐藏、不能被高 preference score 抵消、不能包装成 near exact；
4. near match 只能放宽已批准的 budget、region、institution type preference；是否允许 unresolved capability 由产品决策决定，Policy A 禁止、Policy B 仅按 conditional/unverified 原态展示；
5. 护理安全 hard constraint 不因没有 exact match 而自动放宽；
6. 空的真实机构池使用 NO_VERIFIED_INSTITUTION_POOL 等稳定原因，不得声称“武汉没有机构”；
7. no-exact 结果仍须保留每家 near candidate 的明确差异和 warning。

unmetHardRequirements 收集 conflict；unverifiedRequirements 收集 conditional 与 unverified，保留各自 outcome、不混成一个状态。稳定 reason 优先级：无准入记录 → NO_VERIFIED_INSTITUTION_POOL；全体 ineligible → ALL_CANDIDATES_HAVE_HARD_CONFLICT；存在 eligible soft near → ONLY_SOFT_NEAR_MATCHES；否则仍有未解析护理 → REQUIRED_CAPABILITY_UNRESOLVED；其他已知偏好未满足 → NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES。所有逐机构约束携带自身 institutionId/recordRevision，未显示候选也保留审计证据。A/B 的 exact predicate 相同，因此同输入 NO_EXACT_MATCH 是否发生相同，只是替代候选数量/分组不同。

## 14. Determinism and revision provenance

相同的：

~~~text
Elder semantic input
Institution dataset records and revisions
effective projection evaluationAsOf
recommendation ruleset version
selected policy
~~~

必须产生相同的 semantic result、tier、reason codes、difference codes 和排序。禁止依赖：

- Date.now()、隐式当前时间；
- Math.random()、UUID；
- LLM 或网络变化；
- availability 动态字段；
- 对象遍历顺序未定义的副作用。

当机构字段或 evidence 更新时，结果必须绑定：

~~~text
institutionId
recordRevision
fieldPath / rawSnapshot / effectiveSnapshot / evidenceIds
datasetVersion
rulesetVersion
evaluationAsOf
~~~

历史正式 Recommendation 只能解释当时的 revision；Preview 不持久化，也不产生历史 result identity。future pool manifest 应记录参与及排除的机构 revision/排除原因，或保留足以重放当时 pool 的最小 snapshot；不能以 latest 数据替换旧 revision。

同 tier、同 named factor 结果的最终 tie-break 使用稳定 ASCII institutionId 升序；它只保证 deterministic，不代表机构质量或营销排序。不得使用 availability、名称 label 或随机数决胜。

## 15. Availability and non-whitelist advisory channel

InstitutionAvailabilityStatus 仍是 DISPLAY_ONLY_DYNAMIC。它可在结果中作为“当前床位需咨询”等显示 warning，但不得：

- 进入 hard filter；
- 进入 compatibility 或 score；
- 改变 care tier；
- 让 unavailable 的护理能力变成 unsupported。

下列 22 白名单外字段可在未来以隔离的 advisory 通道解释，但本提案不将它们加入 Matching input：

~~~text
medicalSupport.*
rehabilitationSupport.features.*
services[]
rooms[]
media[] / vr
qualifications[]
operations.*
price.deposit / price.oneTimeFees / price.adjustmentFactors
~~~

advisory 通道只消费 validated record 的真实结构化字段和 evidence，不能自由文本评分，不能改变 exact/near/conditional/ineligible predicate。当前 price.oneTimeFees = [] 只表示没有提供项目列表，不表示费用为 0 或“无其他费用”；deposit 或任一 fee unknown 时仍是 unknown。Assessment 的 depends_on_amount/avoid_high_one_time_fee 没有数值阈值，不能编造“高额”门槛或从月预算推导。

## 16. Product decisions required

以下内容必须由项目负责人拍板，不把实现细节转嫁给负责人：

1. required + requires_assessment：是否只返回 conditional，还是允许在 nearMatches 展示；
2. required + unknown：保持 unverified，是隐藏还是允许显式未核验候选；
3. careLevel 五档是否允许 monotonic inheritance。V1 建议不允许，严格读取对应档独立核验值；
4. 康复 role：known required 是否映射 hard candidate；possible 建议仅 ranking/说明，不自动 hard；explicit rehabilitation_training=required 仍为 hard。任何选择不得消除冻结 Profile 的 blocking clarification；
5. region 是否可成为 hard constraint。V1 建议不是 hard exclusion，仅 fit/difference；
6. budget 是否可成为 hard constraint。V1 建议是 fit，不覆盖 care hard constraint；
7. 是否展示匹配百分比。建议不展示伪精确 87%/93%，使用结构化理由和 tier；
8. near match 是否允许 unresolved capability，以及默认 A/B 策略。建议 V1 先选 A；B 仅按 conditional/unverified 原态分组展示，不升级护理安全结论；
9. 是否批准 RecommendationPreview。未批准前不得从匿名 Profile UI 进入真实推荐。

## 17. Frozen-contract protection and acceptance boundary

本提案不得改写已冻结的 Assessment、ElderProfile、ADL、Preview、Institution 或 Profile UI 业务语义。特别是：

- 不新增 Assessment question/code；
- 不把 special_feeding 变成 tube_feeding，不把 catheter_or_stoma 变成 catheter_care；
- 不把 diagnosed_dementia 变成系统诊断或自动要求 dementia_unit；
- 不把 not_reported 变成 not_required；
- 不把 Institution primaryType 或 UI label 当 capability；
- 不在 Profile/Page/Store 中写入推荐结论。

进入后续实现阶段前，matching_engine、backend_domain、wechat_frontend 和 qa_reviewer 必须分别在自身职责内审查本提案；实现阶段仍需另行冻结 Recommendation Contract，并通过 deterministic、evidence、NO_EXACT_MATCH 和安全边界 Gate。

## 18. Status

~~~text
RECOMMENDATION_CONTRACT = PROPOSED_PHASE_4B_1
FINAL_DECISION = PROJECT_OWNER_DECISION_REQUIRED
RECOMMENDATION_ENGINE = 0
HARD_FILTER_RUNTIME = 0
SCORING_RUNTIME = 0
RANKING_RUNTIME = 0
INSTITUTION_UI = 0
BACKEND = 0
REAL_VERIFIED_INSTITUTION_DATA = 0
~~~

## 19. Phase 4B-2 normative contract — FROZEN_PHASE_4B_2

本节是 RESUME 后通过审查的规范性契约。§1–18 保留原提案，不删除审批历史；其中 A/B、旧 readiness/tier、未冻结排序和未来时态不作为最终实现规则。本节明确引用的既有 evidence/snapshot 结构继续适用；有差异时以本节及正式 Rule Contract 为准。

### 19.1 Source and adapter ownership

正式入口接受完整 `ElderProfile` envelope；匿名入口接受完整 `ElderProfilePreview` envelope。拒绝 bare semantic payload、错配 kind/source/identity、未知 schema/ruleset version 和损坏的证据引用。Adapter 从单一输入内部创建 profile context、消费快照和机构投影；调用方不能另传 context、manifest 或预计算 effective fact 来覆盖验证结果。

两种入口共享一个内部 semantic core。Core 只拥有 requirement extraction、care evaluation、soft fit、tier、ranking、reasons、differences 和 NO_EXACT_MATCH；不拥有正式/匿名 identity，也不接收机构白名单外运营字段。正式/匿名输出只有外层来源不同，不复制规则。

Formal evaluator 是可信调用方内的纯语义函数，不是客户端身份授权入口或 RPC。其生产调用前置条件是未来服务端/可信 loader 已完成 user → Elder → Assessment 的归属、completed 状态和 profile 同源校验；不能以客户端提交的 elderId/assessmentId、kind 或一个 `ownershipVerified=true` 标记证明该前置条件。本阶段不实现该 loader、授权或接口，也不从任何 Page 调用 Formal evaluator。合成 formal fixture 只测试适配等价性，不声称服务器身份已核验。

`ANONYMOUS_PROFILE_PREVIEW_CONTRACT.md` §15 的 RECOMMENDATION_CONSUMPTION=NOT_YET_AUTHORIZED 是 Phase 3A-3 的阶段范围记录。本轮项目负责人明确批准的 Phase 4B-2 仅新增本文 Preview Adapter 的领域消费授权，覆盖该历史阶段的未授权状态；不改变 Preview 的 source identity、ephemeral、derivation 或 Assessment 冻结语义，不授权 UI 接入/持久化。原冻结文档保留历史文本，不改写其业务约束。

来源、时点和版本必须显式、确定：

- `evaluationAsOf` 必填并使用现有显式 ISO timestamp validator；不读取当前时间。
- `datasetVersion` 是非空调用方版本标签，不作为全池 manifest 的替代。
- `rulesetVersion = recommendation-ruleset-v1`、`policyVersion = conservative-exact-with-conditional-v1`；不支持的版本拒绝，不自动降级。
- 正式输出 context 复制原始 `ElderProfile.identity`。不生成 Recommendation ID、Assessment ID、Elder ID、CompletedAssessment 或 generatedAt；结构校验不冒充未来服务端归属/完成状态授权。
- Preview context 仅复制合法 `source` 与原有 Profile/ADL 版本。Preview 仅内存，无持久化，无伪造正式身份。

### 19.2 Minimal elder snapshot and validation

消费字段沿用 §4/§5 的 RecommendationElderSemanticSnapshot：adl/mobility/health/cognition/specialCare derived facts、preference/financial/intent raw facts、原始 evidence/clarifications。排除 basic、姓名、完整 Assessment answers 和 userFacingSummary。

Adapter 验证派生字段的合法 status/code、九项特殊护理完整性、care mode 唯一性、evidence ID/derivedField/outcome 对应及 clarification 引用；不从 27 答案再次 derive，也不把 candidateValue 当确定 value。公开 Profile envelope 必须来自冻结 deriver；本层验证语义结构/引用一致性，不宣称对客户端自填身份建立服务器真实性证明。

`preference.priorities` 是唯一在本层进行集合规范化的用户偏好数组。合法集合才允许 canonicalize；重复 priority、非法 code、空集合或超过三项必须先返回 invalid_input，不得通过去重修复非法 Profile。合法集合在新输出快照及 raw-fact ref 中按 stable priority code 的 ASCII/code-unit 顺序排序；不修改输入 Profile/Draft，不把点击顺序当优先级。快照同源规则对该数组采用集合相等，其他字段仍保留原始事实。借此同一 priority set 的不同输入顺序可得到完全相同输出；不创建伪造的 derived evidence ID。

### 19.3 Institution pool and provenance

Adapter 首先逐条调用现有 `validateInstitutionRecord`，之后只使用现有 effective projection 和冻结的 22 matching-critical paths。任一损坏记录、重复 institutionId、非法时点或版本拒绝整次输入，返回稳定错误 code，不伪装 NO_EXACT_MATCH，也不为损坏身份补造 manifest entry。

全池 manifest 由 Adapter 构造并按 institutionId ASCII 字符序排列，包含每条有效输入记录的 institutionId、recordRevision、recordProvenance、recordStatus、准入/排除原因以及当次 22 字段 raw/effective 快照和所用 evidence metadata。included 项禁止 exclusionReasonCode；excluded 项必须有稳定原因。included 项与 candidateEvaluations 一一对应；excluded 不运行护理推荐。

默认生产准入仅允许 `published + PRODUCTION_CANDIDATE`。合成测试必须走显式 `MOCK_DEVELOPMENT_ONLY` dataset mode，仅接受相同 provenance 的 synthetic 记录并让输出携带该标签；此模式不是生产 fallback。不得把 TEST_SYNTHETIC_VERIFIED 写入冻结 recordProvenance，也不得在 fixture 中移除 Mock 标签来伪装生产记录。

所有机构引用继续使用 §8 的 institutionId + recordRevision + 22-whitelist fieldPath + rawSnapshot/effectiveSnapshot + evaluationAsOf + verification metadata + evidenceIds。raw unverified unsupported 只能得到 effective unknown，不得形成 conflict。只保留证据的结构化审计元数据，不把 sourceReference/sourceNote 带入推荐公开结果。缺失信息使用 null/真实空 evidence，不能补造证据。

Manifest 保留的是本次 matching 投影，不含 availability 或一次性费用。相同 matching revision 下仅修改运营状态不得改变 core equality；若机构修订号本身变化，provenance 必然变化，但仅运营变化仍不能改变 care tier 或排序。旧推荐解释不重新读取 latest 机构资料。

生产机构池必须由未来可信完整 dataset provider 提供；纯 evaluator 只能证明 manifest 与**本次提供的完整输入数组**一一对应，不能知道调用方是否隐瞒外部记录，也不能由一个 opaque datasetVersion 证明全市场/全部合作机构完整性。本阶段没有该 provider、生产数据或 completeness 认证标记；不能对外声称“已经搜索所有武汉机构”。

冻结的 machine schema（文档类型；生产声明在 freeze 后创建）：

```ts
interface RecommendationVersions {
  recommendationContractVersion: 'recommendation-contract-v1'
  recommendationRulesetVersion: 'recommendation-ruleset-v1'
  policyVersion: 'conservative-exact-with-conditional-v1'
  elderProfileContractVersion: 'elder-profile-contract-v1'
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v1'
  adlRulesetVersion: 'adl-ruleset-v1'
  institutionContractVersion: 'institution-contract-v1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

type RecommendationDatasetMode = 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'

type RecommendationInstitutionEvidenceSnapshot = Pick<InstitutionEvidence,
  'evidenceId' | 'institutionId' | 'recordRevision' | 'fieldPath' |
  'valueSnapshot' | 'sourceType' | 'observedAt' | 'verificationStatus' |
  'verifiedAt' | 'validUntil'>

type RecommendationPoolManifestEntry = {
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecord['recordProvenance']
  recordStatus: InstitutionRecord['recordStatus']
  matchingFields: readonly InstitutionEffectiveEvidenceRef[]
  evidence: readonly RecommendationInstitutionEvidenceSnapshot[]
} & (
  | { disposition: 'included'; exclusionReasonCode?: never }
  | { disposition: 'excluded'; exclusionReasonCode:
      'RECORD_NOT_PUBLISHED' | 'MOCK_DATA_NOT_PRODUCTION' | 'NON_MOCK_DATA_IN_SYNTHETIC_MODE' }
)

interface RecommendationPoolManifest {
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  institutionContractVersion: 'institution-contract-v1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
  entries: readonly RecommendationPoolManifestEntry[]
}
```

`matchingFields` 必须按既有白名单顺序恰好包含 22 项，类型/快照规则沿用 §8（新增规则不变）：capability 用 stable_code，region 用 stable_code，supportedTypes 用 stable_code_list，price 用 reference_monthly_price。每项都有 raw/effective snapshot、projectionReason、evaluationAsOf、verificationStatus/时间和 evidenceIds。evidence 仅收集这 22 项引用的同 revision 原证据元数据，去重后按 evidenceId ASCII 排序；不混入运营、媒体证据或内部来源说明。

所有 ref 的 institutionId/recordRevision 必须等于所属 entry，所有 effective ref/manifest 的 evaluationAsOf 必须与本次 semantic result 的显式字符串完全相等。优先按 recordStatus 排除，其次按 datasetMode/provenance 排除。included 无排除码，excluded 有排除码；所有 entry 与输入记录无重复地一一对应。versions 放入 semantic result 的 `versions`，不混淆八个版本；值必须与源 Profile、Institution 和当前 ruleset 一致。

### 19.4 Operational advisory isolation

沿用 §12 的独立 `RecommendationAdvisoryAttachment`，不放进 semantic envelope、item differences、ranking 或 core equality。只处理 availability 和 upfront cost；不扩大白名单。

Attachment 从同一 validated record/明确 evaluationAsOf 创建 typed snapshot。oneTimeFees 的 list_presence 不能证明金额为零；fee_amount 按 feeId 唯一定位原列表项，evidence fieldPath 必须对应原列表 index 的 referenceAmount。未知/未核验金额不转成已接受；depositTolerance 无金额阈值，不虚构“高额”标准。没有适用 Elder 事实的 availability 提示只引用机构侧，不伪造 Elder evidence。

### 19.5 Ranking, readiness and exactness

最终机器规则唯一来源为 `RECOMMENDATION_RULE_CONTRACT.md` §2–9；不是旧 §6/§9/§10 的 A/B 定义。matching_engine 的 tuple 精度及落文一致性审查均 PASS：

```text
tier → PriorityFitVector → budget → type → region → rehabilitation → institutionId ASCII
PriorityFitVector = (matchedCount↓, partialCount↓, knownMismatchCount↑, unknownCount↑)
```

Budget ordinal：within_budget > partially_overlapping > below_declared_range > above_budget > unknown；Type：match > unknown > mismatch；Region：same > unknown > different；Rehab：supported > requires_assessment > unknown > unsupported。只比较命名类别/计数，不求总分。neutral slot 不比较，必须有 rankParticipation 记录。

price/close_to_family/rehabilitation_capability 已消费 budget/region/rehab 字段时，相应 baseline rank slot neutral，但原 fit、reason、exactness 检查不删除。dementia priority 只消费未被明确 hard 使用的 acceptance/unit 子项；type supportedTypes 是另一事实，不因同名概念去重。不可评分 priority 中性，不从文本/图片生成值。

老人 unknown/needs_confirmation 使用独立 blocked_by_required_clarification。阻断时只保留已知硬结果审计：明确 conflict 的 tier=INELIGIBLE，其余 tier=null；无推荐卡，不把老人未知叫机构 UNVERIFIED。唯一健康侧 rehab known required/possible 的 scoped soft 例外按规则 §3，旧 Profile status/clarification 不改写。

ready 后才按 conflict、institution unknown、conditional 的顺序决定前三种非安全满足情况；hard 全部 satisfied 才判 Exact/SoftNear。Exact 要求 budget within、指定 region same、指定 type match、适用 health rehab soft 为 supported；其中 unknown/差异导致 SoftNear。priority-only mismatch/unknown/NOT_YET_SCORABLE 不单独改变 Exact，不能将 Exact 渲染为所有关注项均满足。

卡片上限 MAX_3，选最高可展示层，不补低层数量。Conditional 使用独立列表；Unverified/Ineligible 永不入默认推荐卡。

### 19.6 V1 machine envelope

以下为实现命名和归属；`miniprogram/types/recommendation.ts` 将在冻结后对应定义，不能提前编码反补业务规则：

- `RecommendationEvaluationInput`：profile（完整正式或 Preview envelope）、institutions（完整池）、datasetVersion、datasetMode（PRODUCTION 或显式 MOCK_DEVELOPMENT_ONLY）、evaluationAsOf、rulesetVersion、policyVersion。无独立可篡改 context/manifest/effective facts 输入。
- `evaluateRecommendationPreview(input)` 与 `evaluateFormalRecommendation(input)`：检查对应 envelope kind 后，调用同一投影/semantic core；返回 `{ ok: true, value }` 或 `{ ok: false, error: { code, paths } }`。正式路径不从 Preview 或 Draft 造身份。
- `RecommendationPreview`：kind=recommendation_preview、source=原 Preview source、原 Profile/ADL 版本与 `semantics`。不含正式 identity 字段。
- `FormalRecommendation`：kind=recommendation、identity=原 ElderProfile.identity 与 `semantics`。它是正式语义适配结果，不是已保存数据库记录。
- `RecommendationSemanticResult`：`versions: RecommendationVersions`、policy、显式 evaluationAsOf、datasetVersion/mode、最小 elderSnapshot、poolManifest、elderReadiness、requirementReadiness、elderClarifications、items、conditionalCandidates、candidateEvaluations、exactMatch，以及 exactMatch=false 时的 noExactMatch。
- `RequirementReadiness`：稳定 code、sourceDerivedField、disposition（unresolved / soft_fit_data_gap / informational）、blocksEligibility、原始 clarificationIds 与 Elder evidence refs；全局 elderReadiness 由是否存在 blocksEligibility=true 决定。原 Profile clarifications 独立完整保留。新的消费关系可用 Recommendation code 解释，但不能伪造原 Profile clarification ID。
- `RecommendationItem`：institutionId、recordRevision、matchTier、constraintResults、softFit、rankTuple/rankParticipation、reasons、differences。readiness 阻断的内部审计项允许 matchTier/rankTuple=null，不能作为卡片。
- `NoExactMatch`：稳定 code/reasonCode、逐机构 conflict/conditional/unverified 摘要与单列老人澄清；不通过自由文本判定，不要求 UI 再推理。
- `HardConstraintEvaluation` 只将明确 required 或 not_required/not_reported 消费成矩阵行；老人 unresolved 另列 readiness，不伪造已确定的 hard 条件。其引用沿用 §5/§8 的真实 derived/raw evidence 与机构有效投影。
- `buildRecommendationAdvisories` 只产生独立 attachment，不修改或混入上述 semantic result。

Schema/version/timestamp、Profile 结构/引用、机构校验、重复机构身份等输入错误必须使用稳定 error code，分别报告路径；不是 NO_EXACT_MATCH，不能自行补值。内部 core 不暴露允许绕过 adapter 的公开 bare-payload 入口。

### 19.7 Freeze gate and review evidence

2026-08-31，恢复后的 matching_engine 最终只读落文确认 PASS；backend_domain 对四项 identity/provenance gap closure 最终只读 PASS。两者均在生产代码创建前完成。主 SOL 据此冻结本文 recommendation-contract-v1 / FROZEN_PHASE_4B_2 及 Rule Contract recommendation-ruleset-v1 / FROZEN_V1。

正式 freeze 不等于已完成 runtime/QA；后者必须另有实际证据。本轮不自动 commit。

### 19.8 Implementation evidence — Phase 4B-2

2026-08-31 的实现及测试 checkpoint 记录在 `RECOMMENDATION_RULE_PROPOSAL.md` §0.4；该节是执行证据，不变更本合同业务语义。源码位于 `miniprogram/domain/recommendation/` 与 `miniprogram/types/recommendation.ts`；正式 Gate 为 `npm run check:recommendation-runtime`。Formal 和 Preview 通过同一个验证/投影/semantic core 执行，不复制规则、不保存结果。调用方后续对原 Profile/机构深层值的修改不得改变已返回的快照；runtime 对该不变量进行实际原地修改验证。

固定预期清单不由当前 fixture 列表动态推导。40 个历史 A/B 场景均断言最终 V1；既有不完整 A/B 政策只保留历史，不运行第二套引擎。最新独立 QA 结论必须与自动 Gate 分开记录，不把契约预审 PASS 或主 SOL 自测替代最终 QA。

最终集成记录：Recommendation runtime 117 个固定 case × 6 个顶层断言 PASS；TypeScript 5.9.3 application 与实际微信 TS 4.1.2 targeted（8 个 Recommendation 文件、总 24 roots / 25 emitted JS）PASS。独立 qa_reviewer 最终只读复验 PASS；首轮两项 blocker、修复及其证据见 Proposal §0.4。当前无新域 Page 接入，Android=N/A；旧 50-module DevTools cache 仅用于既有页面 JS regression。没有 stage 或 commit，不自动进入 Recommendation Result UI。
