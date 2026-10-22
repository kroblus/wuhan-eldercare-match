# AI Consultation Safety & Application Contract V1

状态：`FROZEN_PHASE_V1_2_B4`

Contract 版本：`ai-consultation-contract-v1`

Product 版本：`V1.2`

冻结日期：`2026-09-16`

```text
PHASE_V1_2_B4 = PASS
AI_CONSULTATION_CONTRACT = FROZEN_PHASE_V1_2_B4
AI_CONSULTATION_CONTRACT_VERSION = ai-consultation-contract-v1
AI_RECOMMENDATION_ROLE = EXPLANATION_ONLY
AI_INSTITUTION_FACT_WRITE = FORBIDDEN
AI_ELDER_PROFILE_WRITE = FORBIDDEN
AI_VISIT_APPOINTMENT_WRITE = FORBIDDEN
REAL_AI_PROVIDER_CALL_OWNER = SELF_OWNED_BACKEND
CLIENT_MODEL_SECRET_OWNERSHIP = NONE
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_IMPLEMENTATION_AUTHORIZED = FALSE
PRODUCTION_CODE_CHANGE = 0
```

本文冻结 V1.2 养老咨询助手的会话/消息、知识来源、安全回答、拒答与转人工、隐私、Backend/Secret、
public-safe Application result 和跨领域隔离语义。未来 AI Domain/Application Foundation、Backend gateway、
approved FAQ adapter 与 `/pages/service/ai-chat` 必须服从本文。

本文不实现 AI 页面、runtime、Backend、provider、RAG、Prompt、持久化或真实模型调用，也不选择模型厂商、
endpoint、数据库、加密算法或 retention TTL。

## 1. Normative Language and Authority

本文使用：

- **MUST / 必须**：实现不得偏离；
- **MUST NOT / 禁止**：任何层均不得提供该行为；
- **MAY / 可以**：允许但不强制，不得被实现升级为永久 mandatory policy。

直接 Source of Truth 顺序为：

1. `docs/product/README.md` 路由的当前两份 V1.2 Product PDF；
2. frozen `V1_2_B4_PHASE_HANDOFF.md`；
3. frozen ElderProfile V2、Recommendation V2、Institution V1.2.1 与 Consultant/Permission 语义；
4. CURRENT `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
5. 本 Contract 对 AI Consultation 新增的稳定语义。

本文不得覆盖上游对象的 identity、derivation、ranking、verification 或 public projection。若未来 Product Source
实质改变 allowed knowledge、safety、permission、handoff 或 isolation，应先做 Change Impact Analysis，并通过新
Contract revision 或 successor phase 变更；不得由 Prompt、Page、Backend adapter 或 provider 配置静默改变。

## 2. Frozen Scope

### 2.1 In scope

- versioned `AIConversation`、`AIMessage` 与 public-safe Application result；
- `idle / sending / answer_ready / need_human / knowledge_unavailable / network_error / service_error`；
- knowledge/context allowlist 与 `sourceRefs`；
- allowed answer、safe refusal 与 human handoff；
- anonymous access、context minimization、permission 与 privacy；
- Application、Page、self-owned Backend gateway、provider 与 knowledge adapter ownership；
- FAQ/Mock/synthetic/live-provider provenance；
- Recommendation、Institution、ElderProfile、Appointment/Visit/Evaluation 隔离；
- 后续实现可依赖的最小稳定输入、输出与 acceptance boundary。

### 2.2 Out of scope

- `/pages/service/ai-chat`、WXML、Less、ViewModel、路由、聊天或微信交互；
- runtime types、validator、safety evaluator、provider、fixture 或 test script；
- 真实模型调用、模型选择、Prompt engineering、RAG、embedding、vector database 或 streaming；
- REST/GraphQL endpoint、Backend DTO、DB schema、ORM、migration、queue、rate limit 或 observability；
- conversation persistence、跨设备历史、登录/auth、User.phone、retention TTL 或具体加密/删除实现；
- AI 诊断、治疗、用药、报价、床位保证、自动排名、自动预约或投诉/合同裁决；
- Appointment、InstitutionVisit、VisitEvaluation、CRM 或 V1.2-C implementation；
- 修改 Assessment、ElderProfile、Recommendation、Institution、Consultant 或 Current Product Source。

## 3. Frozen Product and Architecture Decisions

| ID | Frozen decision |
|---|---|
| B4-D1 | AI Consultation 只解释 allowlist 内既有、合法的 display/application-safe 信息，不创造新的 verified fact |
| B4-D2 | `AIConversation` / `AIMessage` 属于 AI Service；conversation identity 不等于 authenticated user identity，也不自动代表持久化记录 |
| B4-D3 | `PROVIDER_RAW_RESULT != AI_APPLICATION_RESULT`；moderation details、Prompt、provider tool/error 不是 Application/Page Contract |
| B4-D4 | public result 只使用冻结状态；`unknown / knowledge_unavailable / network_error / service_error` 不得互相压平或改写为业务事实 |
| B4-D5 | 模型训练知识/general knowledge 不能绕过 explicit knowledge allowlist；养老基础概念必须来自 approved product/static knowledge |
| B4-D6 | 医疗结论、实时机构承诺、合同/付款/投诉、自动预约与 Recommendation 重排不属于可回答范围 |
| B4-D7 | human handoff 是安全引导，不代表顾问已回复、已联系、已确认预约，也不授权读取 User.phone |
| B4-D8 | 真实在线 AI 调用只能走 `Mini Program -> self-owned Backend -> AI provider`；Secret/provider credential 只归 Backend |
| B4-D9 | approved FAQ limited mode 可作为诚实的生产能力；development Mock 与 test-only synthetic result 永远不能冒充该能力或在线 AI |
| B4-D10 | AI 对 Recommendation 的角色为 `EXPLANATION_ONLY`；对 Institution/ElderProfile/Visit/Appointment 的 mutation role 均为 `NONE` |

## 4. Ownership and Stable Data Flow

```text
Frozen read-only public/display snapshots + approved static knowledge
  -> AI Application context allowlist and minimization
  -> AI consultation port
  -> approved FAQ adapter OR self-owned Backend gateway -> AI provider
  -> Backend/Application safety projection
  -> AIConsultationApplicationResultV1
  -> future Page / ViewModel
  -> optional safe human handoff to an existing destination
```

- source Domain 继续拥有 Profile、Recommendation、Institution 和 Consultant public snapshot；AI 只有只读解释权；
- AI Service 拥有 conversation/message identity、message kind、state、`sourceRefs` 与 `handoffReason`；
- Application 拥有 allowlist enforcement、context minimization、stable failure mapping 与 public-safe result；
- self-owned Backend 拥有 provider credential、network call、provider raw schema、server-side safety enforcement 与输出过滤；
- Page/ViewModel 只做 presentation、send/retry/handoff action，不读取 raw source 或 provider response；
- provider 无权直接写任何项目 Domain object，普通用户输入也不会自动成为 verified fact；
- Operations MAY 管理 approved FAQ/knowledge publication，但不能通过运营内容扩大本 Contract 的 allowlist。

## 5. AIConversation V1

### 5.1 Identity

V1 conversation 必须使用以下两类 identity role 之一：

- `conversationId`：AI Service/Backend 为当前服务会话分配的稳定 identity；
- `localSessionId`：匿名或仅本地会话的稳定 identity，作用域仅限当前合法 session。

至少存在一个 identity。二者不得被解释为 `userId`、手机号、登录状态、Appointment 或持久化许可。若后续需要把
local session 与 authenticated/persistent conversation 关联，必须由 successor permission/persistence Contract 定义；
V1 不允许隐式合并、静默上传或跨账号复用。

### 5.2 Service model

下列 shape 冻结字段职责；具体 TypeScript module/path 由后续 implementation phase 决定：

```ts
type AIConversationRefV1 =
  | { kind: 'service_conversation'; conversationId: string }
  | { kind: 'local_session'; localSessionId: string }

interface AIConversationV1 {
  contractVersion: 'ai-consultation-contract-v1'
  ref: AIConversationRefV1
  createdAt: string
  state: AIConsultationStateV1
  messages: readonly AIMessageV1[]
}
```

- `AIConversationV1` 是 AI Service 的稳定对象，不是 Page 直接消费的 object；Page 只能消费 §7 的 public-safe projection；
- `createdAt` 是会话时间信息，不是 consent、verification 或业务状态；
- `messages` 的顺序由 AI Service/Application 保持，Page 不重排、不改写；
- anonymous conversation MAY 只存在内存/本地 session，本文不授权持久化；
- raw provider transcript、system Prompt、moderation trace、token usage 与 internal audit 不属于 public model。

## 6. AIMessage V1

```ts
type AIMessageRoleV1 = 'user' | 'assistant'

type AIMessageKindV1 =
  | 'user_input'
  | 'answer'
  | 'safe_refusal'
  | 'human_handoff'
  | 'technical_failure'

interface AIMessageV1 {
  contractVersion: 'ai-consultation-contract-v1'
  messageId: string
  role: AIMessageRoleV1
  kind: AIMessageKindV1
  content: string
  sourceRefs: readonly AISourceRefV1[]
  handoff?: AIHandoffV1
  createdAt: string
}
```

稳定约束：

- `messageId` 只要求在所属 conversation 内稳定，不证明 Backend persistence；
- `user_input` 只能由 `role = user` 使用；其 `sourceRefs` 必须为空且没有 `handoff`；
- `answer / safe_refusal / human_handoff / technical_failure` 只能由 `role = assistant` 使用；
- `answer` 的事实性解释必须能由 allowlist source 支持；无合法依据时不得生成填补事实的 answer；
- `technical_failure` 只包含 public-safe retry/failure copy，不暴露 raw provider/network/moderation details；
- system/developer Prompt、provider tool message、internal chain-of-thought 或审核 trace 不是 `AIMessageV1`，禁止投影给客户端。

`AIMessageV1.kind` 同时承担稳定 response disposition：`answer` 对应 `allowed_answer`，`safe_refusal` 对应
`safe_refusal`，`human_handoff` 对应 `human_handoff`，`technical_failure` 对应 `technical_failure`。Page 不得解析
`content` 来猜 disposition。

## 7. Application Result and State Model

```ts
type AIConsultationStateV1 =
  | 'idle'
  | 'sending'
  | 'answer_ready'
  | 'need_human'
  | 'knowledge_unavailable'
  | 'network_error'
  | 'service_error'

interface AIMessagePublicProjectionV1 {
  messageId: string
  role: AIMessageRoleV1
  kind: AIMessageKindV1
  content: string
  sourceRefs: readonly AISourceRefV1[]
  handoff?: AIHandoffV1
  createdAt: string
}

interface AIConsultationPublicApplicationSnapshotV1 {
  kind: 'ai_consultation_public_application_snapshot_v1'
  contractVersion: 'ai-consultation-contract-v1'
  conversationRef: AIConversationRefV1
  conversationCreatedAt: string
  state: AIConsultationStateV1
  messages: readonly AIMessagePublicProjectionV1[]
  responseProvenance: 'approved_faq' | 'live_backend' | 'unavailable'
  actions: {
    canSend: boolean
    canRetry: boolean
    canOpenHumanHandoff: boolean
  }
}

type AIConsultationPublicApplicationResultV1 =
  | { ok: true; value: AIConsultationPublicApplicationSnapshotV1 }
  | {
      ok: false
      error: {
        code: 'NETWORK_ERROR' | 'SERVICE_ERROR'
        publicMessage: string
        retryable: boolean
        snapshot: AIConsultationPublicApplicationSnapshotV1
      }
    }
```

`AIConsultationPublicApplicationResultV1` 必须只返回上述 public-safe snapshot 或上述稳定 Application error；
`knowledge_unavailable` 是安全的业务能力结果，不伪装成 network/service exception。Page 不得直接消费
`AIConversationV1`、`AIMessageV1`、provider raw schema 或 Backend error。
Application projection 必须过滤每条 message 和 sourceRef。状态语义冻结为：

| State | Meaning | Must not mean |
|---|---|---|
| `idle` | 无 request in flight，可等待输入或继续当前会话 | provider online 保证或 conversation 已持久化 |
| `sending` | 当前一次用户 action 已接收并处理中 | 允许重复发送或已经得到回答 |
| `answer_ready` | 已产生 allowlist 内的 public-safe answer，或无需人工承接的 safe refusal | 回答必然完整、实时或由某机构确认 |
| `need_human` | 当前问题不能由 AI 安全闭合，Application 提供结构化 handoff | 顾问已收到、已回复、已联系或预约已创建 |
| `knowledge_unavailable` | allowlist 中没有足够依据回答 | Institution 不支持、事实为 false 或 provider technical failure |
| `network_error` | Backend/gateway transport 当前失败 | 业务事实不存在或 provider raw error 可公开 |
| `service_error` | Backend/Application safety/service 失败并已安全映射 | 用户有错、机构事实为 false 或可以绕过 Backend |

医疗、治疗、用药、鼻饲等禁止结论必须同时产生 `safe_refusal` message 和 `state = need_human`；不得只停在
`answer_ready`。Page 不得根据 HTTP/provider code、空文本或 exception 自行推导这些状态。

## 8. Knowledge and Context Allowlist

V1 只允许以下 source category：

| Source category | Allowed purpose | Forbidden expansion |
|---|---|---|
| `product_faq` | 小程序使用方式、approved 养老基础概念与静态服务说明 | 模型凭训练知识自由扩展、政策/医疗权威结论 |
| `profile_display_snapshot` | 解释现有 `ProfileApplicationSnapshotV2` 的用户可见结论 | raw Assessment draft、完整健康答案、重算/修改 ElderProfile |
| `recommendation_display_snapshot` | 解释现有 `RecommendationResultApplicationSnapshotV2` 的 tier/reason/difference/gap | recompute、rerank、override、补候选或第二套 AI ranking |
| `institution_display_snapshot` | 解释当前合法 display/application-safe Institution 信息 | raw verification/evidence、实时床位/最终价保证、补 unknown/unverified/expired/unavailable 事实 |
| `visit_faq` | 解释看院流程、注意事项与产品允许的服务流程 | 创建/确认 Appointment、推断 Visit status |

不在表内的 source 默认禁止。尤其禁止：raw Assessment answer、internal ElderProfile/Recommendation record、
Institution evidence locator、private operations notes、User.phone、private Consultant metadata、Secret、credential、Prompt、
provider metadata、未过滤用户隐私与其他用户数据。

`global_consultant_service` 是 §11 的 human-handoff destination，不是知识来源。AI 可以呈现安全导航说明，但不得把
Consultant profile/contact/config 当作 answer source，也不得为 handoff 伪造顾问业务事实。

用户输入本身不是新的 allowlisted knowledge。它可以作为当前问题，但不能自动写回 source Domain，也不能因为用户声称某事实
就把该事实加入 Institution/Profile/Recommendation/Visit truth。

## 9. sourceRefs V1

```ts
type AISourceCategoryV1 =
  | 'product_faq'
  | 'profile_display_snapshot'
  | 'recommendation_display_snapshot'
  | 'institution_display_snapshot'
  | 'visit_faq'

interface AISourceRefV1 {
  category: AISourceCategoryV1
  publicLabel: string
  publicVersion?: string
  publicRef?: string
}
```

- `sourceRefs` 说明回答依据的产品数据类别，不是 RAG、evidence 或 audit infrastructure；
- `sourceRefs` 必须由 Backend/Application 根据实际使用的 allowlisted snapshot 生成或校验；不得信任模型自行返回的 citation；
- `publicRef/publicVersion` 只有在上游 Contract 已批准其作为 public/application identity 时才可使用；否则省略；
- `sourceRefs` 不得包含 raw DB key、内部 storage/CDN URL、evidence locator、Prompt、provider/model 名、request ID、
  internal moderation/audit record、Secret 或 private metadata；
- 多 source answer 必须只列实际使用的允许来源；拒答/technical failure 不得伪造 citation；
- synthetic/test sourceRef 必须保持显式 test provenance，禁止进入 production result。

## 10. Safety Response Boundary

### 10.1 Answer allowed

只有满足以下全部条件才可返回 `answer`：

1. 用户问题属于 §8 allowlist；
2. 结论能被当前合法 source 支持；
3. 文案不包含医学、实时运营或确定性承诺；
4. 不重算、不重排、不写回任何上游 Domain；
5. `sourceRefs` 与实际依据一致。

AI 可以解释“当前资料显示什么、Recommendation 已经给出的理由是什么、有哪些需要进一步确认”，不能把解释升级为新的
诊断、推荐、机构承诺或实时事实。

### 10.2 Safe refusal

以下请求必须产生 `safe_refusal`；其中医疗/治疗/用药/鼻饲等请求还必须进入 `need_human` 并提供安全的人工/专业服务说明：

- 医疗诊断、疾病结论、治疗方案、用药建议/调整、鼻饲或其他需医疗专业判断的结论；
- 保证某机构“一定适合 / 最好 / 一定有床”；
- 要求 AI 重算、重排或生成第二套 Recommendation；
- 要求基于缺失、unknown、unverified、expired 或 unavailable 数据补事实；
- 要求绕过 privacy、permission、Backend/Secret 或 verified-data boundary。

医疗拒答必须明确 AI 与养老顾问都不能替代合格医疗专业判断；不得把 Consultant handoff 描述成医疗诊断渠道。
医疗类别的稳定组合为 `message.kind = safe_refusal`、`state = need_human`、
`handoff.reason = medical_professional_required`。

### 10.3 Need human

以下情况必须进入 `need_human`：

- 用户主动要求人工；
- 连续两次在 allowlist 内仍资料不足；
- 需要机构确认的实时床位、实时最终价格、复杂护理或服务事实；
- 合同、付款、投诉；
- 预约带看或需要 operational follow-up；
- 其他 Product Source 明确要求人工处理的场景。

实时/合同/投诉/预约类问题可以给出范围说明，但不得以 AI answer 结束成确定性业务结论。

## 11. Human Handoff V1

```ts
type AIHandoffLevelV1 = 'required' | 'suggested'

type AIHandoffReasonV1 =
  | 'user_requested_human'
  | 'allowed_knowledge_insufficient'
  | 'institution_confirmation_required'
  | 'realtime_business_fact_required'
  | 'contract_payment_or_complaint'
  | 'appointment_or_complex_care'
  | 'medical_professional_required'
  | 'consultant_guidance_suggested'

interface AIHandoffV1 {
  level: AIHandoffLevelV1
  reason: AIHandoffReasonV1
  publicExplanation: string
  destination?: 'global_consultant_service'
}
```

- `required` 表示 AI 不得继续给出被禁止的结论；`suggested` 只用于合法回答后建议进一步咨询，不得替代 required；
- `destination = global_consultant_service` 只引用已冻结的公开 Consultant 入口，不读取 raw Consultant/config/assignment；
- 当前该 destination 对应 B3 已通过的 `/pages/consultant/index`；未来 UI 只做合法 Tab 导航，不携带 raw context 或 contact query；
- `medical_professional_required` 不得把养老顾问包装成医疗人员；若没有合法医疗入口，省略 destination 并给出安全说明；
- handoff 不创建 contact request、Appointment、Visit、账号、User.phone consent 或持久化记录；
- 不得显示“顾问已收到 / 已联系 / 已确认”等未发生事实，也不得伪造顾问回复。

## 12. Permission and Privacy

### 12.1 Anonymous access

- anonymous visitor 可以打开 AI assistant、阅读 approved FAQ 并在合法能力可用时进行基础咨询；
- 打开 AI、发送基础问题或进入 human-handoff 页面不得强制登录或请求 User.phone；
- anonymous/local session identity 不得用于反推手机号、账号或 Elder identity；
- 保存历史、跨设备同步、正式业务联系等持久化能力须由后续 Contract 另行授权。

### 12.2 Context minimization

- 只传递回答当前问题必需的 display/application-safe fields；
- 默认不传完整健康问卷、raw Assessment draft、完整 Profile/Recommendation/Institution record；
- 不传 User.phone、private notes、internal evidence、Consultant private metadata、Secret/credential；
- user input、context、answer 与 error 不得无目的写入 analytics/log；具体 retention/audit/deletion 由后续 Backend/Privacy Contract 冻结；
- 拒绝、technical failure 或 human handoff 不产生读取更多个人数据的权限。

当个人 display snapshot 需要 authenticated/authorized ownership 时，Backend/Application 必须验证当前授权并裁剪上下文；
不得信任客户端仅提交的 `elderId`、`assessmentId` 或其他 identity locator。匿名场景只可使用当前合法 local/application
context，不得读取其他用户 snapshot。

AI 基础咨询不自动创建账号、contact request、Appointment、Visit 或其他用户业务记录。

## 13. Backend, Provider and Secret Boundary

真实在线链路唯一合法方向为：

```text
Mini Program
  -> stable AI Application request
  -> self-owned Backend gateway
  -> provider/model
  -> Backend safety filtering and public projection
  -> stable AI Application result
  -> Page/ViewModel
```

- Backend 负责 API Key/AppSecret/provider credential、provider auth、network call、server-side allowlist/safety enforcement 与 raw output filtering；
- Application 负责最小 context、stable request/result、public state、sourceRefs 与 handoff mapping；
- Page 不直接调用需 Secret 的 provider，不接触 provider SDK/raw schema，不自行补 safety rule；
- provider-specific model name、error code、tool schema、token usage 与 moderation metadata 不得成为 Page Contract；
- Secret 不得进入 Mini Program bundle、route/query、Mock、fixture、console、error、screenshot、文档示例或 Git；
- 本 Contract 不冻结 vendor、endpoint、transport、DTO、database 或 deployment platform。

## 14. Recommendation, Institution, Profile and Visit Isolation

### 14.1 Recommendation V2

```text
AI_RECOMMENDATION_READ = DISPLAY_SNAPSHOT_ONLY
AI_RECOMMENDATION_ROLE = EXPLANATION_ONLY
AI_RECOMMENDATION_WRITE = FORBIDDEN
AI_RECOMMENDATION_RERANK = FORBIDDEN
AI_RECOMMENDATION_OVERRIDE = FORBIDDEN
AI_RECOMMENDATION_MATCHING_ROLE = NONE
```

AIConversation、AIMessage、question、answer、handoff、usage 或 feedback 均不得进入 Safety、Eligibility、Exactness、Tier、
PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH`、candidate/card ordering 或 reason/difference 生成。

### 14.2 Institution

- 只读当前合法 Institution display/application-safe snapshot；
- 不读取或修改 raw verified facts、Verification/Evidence、record revision 或 internal notes；
- unknown/unverified/expired/unavailable 不得互相压平或改写为 available/false/“机构不支持”，历史价格不得描述为实时最终价；
- AI answer、用户说法或 conversation 不能成为 Institution fact；用户反馈也不得绕过 VerificationLead/人工核验流程。

### 14.3 Assessment and ElderProfile

- 只解释已有 display-safe Profile snapshot；
- 不创建第二份 Profile，不重新评分/派生，不生成医疗诊断；
- 不修改 Assessment draft/ElderProfile，也不把对话内容自动写回。

### 14.4 Appointment, Visit and Evaluation

- 只解释 approved Visit FAQ/流程；
- 不创建、确认或修改 Appointment/InstitutionVisit；
- 不推断 `requested/contacting/scheduled/completed/cancelled`；
- 不创建/提交 VisitEvaluation，不修改评价或生成 Recommendation/Institution weight。

## 15. Mock, FAQ and Production Provenance

必须区分以下 provenance role：

| Role | Production use | Required truth |
|---|---|---|
| approved Product FAQ | allowed in explicit limited mode | 受版本管理、只回答 allowlist；不得冒充实时模型/机构查询 |
| live Backend/provider | allowed after successor implementation gates pass | 经 self-owned Backend 与 safety projection；不向 Page 暴露 raw provider |
| development Mock provider | forbidden as production truth | 明确 `MOCK_DEVELOPMENT_ONLY`，不得静默 fallback |
| test-only synthetic conversation/source | forbidden in production graph | 仅 deterministic test/fixture；sourceRefs 保持 synthetic provenance |

- Backend/provider 未接入时，production MAY 诚实提供 `approved_faq` limited mode 或 `unavailable`；
- production 不得静默 fallback 到 development Mock/test fixture；
- Mock answer 不得冒充真实在线 AI，synthetic citation 不得冒充真实 source；
- FAQ 不得声称实时床位、最终价格、合同状态、预约成功或机构已确认；
- production App import test-only fixture = forbidden。

## 16. Downstream Implementation Boundary

未来最小 AI Foundation/implementation successor 应只冻结并实现本 Contract 所需的能力，不得在代码中重做产品决策。其
mandatory automated acceptance 至少包括：

1. Contract-backed conversation/message/source/handoff/runtime types；
2. state validation 与 provider-raw-to-Application-result 隔离；
3. explicit knowledge/context allowlist 与 minimization；
4. deterministic allowed-answer / safe-refusal / need-human classification；
5. sourceRefs 与 handoffReason public-safe projection；
6. read-only consultation port、approved FAQ adapter 和/或 Backend gateway abstraction；
7. client Secret/provider direct-call structural Gate，以及 bundle/log/error 的 targeted secret leakage scan；
8. Recommendation/Institution/Profile/Visit zero-write and zero-rerank isolation tests；
9. Mock/FAQ/live provenance 与 production graph isolation；
10. changed-file TypeScript/WeChat compatibility（若代码进入 Mini Program runtime）；
11. targeted risk-based QA。

该 successor 不因本 Contract 自动包含 UI、真实 Backend、provider、persistence 或 login。若 phase 只实现 pure Domain/Application
Foundation，Fresh DevTools/Android 默认不 mandatory；若包含 Page/navigation/user interaction，必须由该 phase 重新冻结相应
DevTools/real-device Gates。

## 17. B4 Contract Freeze Gate Closure

| Mandatory Gate | Frozen evidence | Result |
|---|---|---|
| Phase transition | `V1_2_B4_PHASE_HANDOFF.md` + B3 PASS baseline | `PASS` |
| Object/state model | §§5–7 | `PASS` |
| Knowledge allowlist | §§8–9 | `PASS` |
| Safety response boundary | §10 | `PASS` |
| Human handoff | §11 | `PASS` |
| Privacy/permission | §12 | `PASS` |
| Backend/Secret boundary | §13 | `PASS` |
| Recommendation isolation | §14.1 | `PASS` |
| Institution/ElderProfile isolation | §§14.2–14.3 | `PASS` |
| Visit/Appointment isolation | §14.4 | `PASS` |
| Mock provenance | §15 | `PASS` |
| Downstream implementation boundary | §16 | `PASS` |
| Cross-document QA and production isolation | targeted Product/Contract review + independent diff-driven QA | `PASS` |

```text
PHASE_V1_2_B4 = PASS
AI_CONSULTATION_CONTRACT = FROZEN
BLOCKERS = 0
READY_FOR_B4_SUCCESSOR = TRUE
```

## 18. Change Policy

- 后续实现不得通过 Prompt、FAQ 内容、provider adapter、Page 或 Backend configuration 改变本文的 allowlist、safety、privacy、
  handoff、Secret ownership 或 isolation；
- 增加新的知识类别、AI 自动 ranking/action、persistent identity、public conversation history 或更多个人数据读取，必须做
  Change Impact Analysis，并发布兼容 successor 或新 Contract version；
- provider/vendor、endpoint、transport、DB、TTL 与具体 Prompt 可以由后续 implementation Contract 决定，但不得改变本文语义；
- 本 Contract 不授权 production implementation，也不预先命名/编号下一 Phase。
