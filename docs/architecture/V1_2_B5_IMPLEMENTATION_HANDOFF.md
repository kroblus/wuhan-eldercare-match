# Phase V1.2-B5 Implementation Handoff — AI Domain & Application Foundation

状态：`FROZEN_PHASE_V1_2_B5_DEFINITION`

冻结日期：`2026-09-16`

```text
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-B5
NEXT_PHASE_NAME = AI Domain & Application Foundation
NEXT_PHASE_TYPE = DOMAIN_APPLICATION_FOUNDATION_IMPLEMENTATION
B5_PHASE_DEFINITION = PASS
B5_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B5 = NOT_STARTED
PRE_B5_DEFINITION_HEAD = 2dfbe683ee1c68c5297c62fa2e918e1f25c0d5ae
PHASE_V1_2_B4 = PASS
AI_CONSULTATION_CONTRACT = FROZEN
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_CODE_CHANGE_BY_DEFINITION_TASK = 0
RUNTIME_CODE_CHANGE_BY_DEFINITION_TASK = 0
TEST_CODE_CHANGE_BY_DEFINITION_TASK = 0
MOCK_DATA_CHANGE_BY_DEFINITION_TASK = 0
READY_TO_START_V1_2_B5 = TRUE
```

本文冻结 B4 之后的最小 implementation successor。它授权未来 B5 将
`AI_CONSULTATION_CONTRACT_V1.md` 落成确定性、可测试的 Domain/Application Foundation，但不授权 AI Page、真实
Backend、模型 provider、production knowledge、持久化或用户可见 interaction。

## 1. Phase Transition and Authority

正式阶段链路为：

```text
V1.2-B4 AI Consultation Safety & Application Contract Freeze
  -> PASS / AI_CONSULTATION_CONTRACT_V1 = FROZEN
  -> V1.2-B5 AI Domain & Application Foundation
  -> future B5 implementation + mandatory automated Gates
  -> only after implementation evidence: PHASE_V1_2_B5 = PASS
```

当前仓库不存在已批准的其他 B5 或相冲突 successor ID。项目负责人已批准 Post-B4 successor definition，并允许在当前
governance 下使用 `V1.2-B5`。本 handoff 只冻结工程切片、ownership、mandatory Gates 与 completion boundary，不新增或
重写 B4 业务语义。

Source of Truth 顺序：

```text
AI_CONSULTATION_CONTRACT_V1.md
  -> V1_2_B4_PHASE_HANDOFF.md for phase history
  -> FRONTEND_STRUCTURE.md / MOCK_DATA_POLICY.md
  -> this B5 implementation boundary
  -> future implementation details and test-only fixtures
```

实现若与 B4 Contract 冲突，必须停止并报告 `CONTRACT_GAP`；不得修改 B4 Contract、Product Source 或其他 Frozen Contract
来适配代码。

## 2. Goal

B5 的唯一目标是把 B4 Frozen Contract 变成稳定的 runtime boundary，使 future Backend gateway、approved knowledge
adapter 与 AI Page 可以依赖同一组：

- versioned `AIConversationV1` / `AIMessageV1` / state / source / handoff types；
- pure validation、normalization 与 deterministic safety disposition；
- knowledge/context allowlist 与 minimization；
- provider-raw firewall；
- public-safe `AIConsultationPublicApplicationResultV1`；
- vendor/transport-neutral read-only provider port；
- deterministic test-only evidence。

B5 不接入真实模型，也不声称能够用客户端纯函数可靠理解任意自由文本。Foundation 只对显式、受信任的 policy input、
approved FAQ identity、allowlisted context 和 adapter outcome 执行 B4 已冻结的确定性规则。

## 3. Preconditions

B5 开始前必须保持：

- `PHASE_V1_2_A1_5 / B1 / B2 / B2_1 / B3 / B4 = PASS`；
- `AI_CONSULTATION_CONTRACT_V1 = FROZEN`；
- B4 object/state/allowlist/safety/handoff/privacy/Secret/isolation 语义不变；
- 当前 `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md` 有效；
- production/runtime working tree 的任何非 B5 修改必须保持隔离；
- 无需等待真实 Backend、provider、API Key、production FAQ、AI Page、登录或 persistence。

这些外部能力缺失不构成纯 Foundation blocker；B5 以 ports、fail-closed state 和 test-only fixtures 完成。

## 4. In Scope

未来 B5 implementation 只允许覆盖：

1. B4-backed、versioned AI conversation/message/state/source/handoff/Application result types；
2. raw/internal input 到 validated Contract representation 的纯 validator；
3. 不改变语义的最小 normalization；
4. knowledge/source category allowlist evaluator，未知 category 默认拒绝进入 answer path；
5. context minimization projector，只接收已授权的 display/application-safe inputs；
6. deterministic safety disposition evaluator：`answer / safe_refusal / human_handoff`；
7. B4 state 与 disposition 的合法组合、stable `handoffReason` 和 destination projection；
8. `sourceRefs` validation、rebinding 与 public-safe projection；
9. provider-independent internal result validation 与 provider-raw firewall；
10. public-safe `AIConsultationPublicApplicationResultV1` builder；
11. read-only consultation/knowledge/provider port interface；
12. stable invalid-input/provider/application failure mapping；
13. test-only injected provider/FAQ doubles 与 deterministic fixtures；
14. targeted runtime、privacy/isolation、import-graph 与 compatibility Gates；
15. 实现所必需的最小 CURRENT architecture reference update。

B5 可以定义 Foundation 内部的 versioned validation/failure code 和 port request/result，但这些 code 只服务当前 runtime，
不能成为未批准的 Backend wire protocol、provider schema 或新的 Product state。

## 5. Out of Scope

B5 不实现：

- `/pages/service/ai-chat`、Page、ViewModel、WXML、Less、route 或微信用户 interaction；
- 真实 AI provider、provider SDK、模型选择、Prompt engineering、streaming 或 tool calling；
- `wx.request`/HTTP/RPC 真实模型调用、self-owned Backend gateway 或 `server/**`；
- API Key、AppSecret、provider credential、生产配置或 Secret 管理；
- production Product FAQ/knowledge content、RAG、embedding、vector database 或 search infrastructure；
- DB、ORM、conversation persistence、history sync、login/auth、retention/audit/delete implementation；
- User.phone、contact request、Appointment、InstitutionVisit、VisitEvaluation 或 CRM；
- raw Assessment/ElderProfile/Institution/Recommendation record ingestion；
- Recommendation recompute/rerank/write、Institution/ElderProfile mutation 或 Visit truth mutation；
- B4 Contract、Product Source 或任何既有 Frozen Contract semantic change。

若 implementation 需要上述能力，必须报告 `B5_SCOPE_EXPANSION_DETECTED`，不得在同一 phase 静默扩张。

## 6. Layer and Ownership Boundary

稳定调用方向：

```text
B4-backed versioned types
  -> pure validators / allowlist / safety disposition / public projectors
  -> Application context minimization and orchestration
  -> read-only consultation/provider port
  -> injected test double in B5 OR future self-owned Backend adapter
  -> internal untrusted candidate outcome validation
  -> AIConsultationPublicApplicationResultV1
  -> future Page/ViewModel (not B5)
```

### 6.1 Domain ownership

AI Domain Foundation 负责：

- conversation/message/ref/state/source/handoff exact-shape validation；
- stable state/disposition combination rules；
- knowledge category allowlist；
- deterministic policy matrix；
- sourceRef/handoff public projection primitives；
- pure failure classification。

Domain 不依赖 Page、Component、Store、Service、Mock、network、storage、`wx.*`、clock 或 random state；不得读取 raw
provider response 或上游 Domain record。

### 6.2 Application ownership

AI Application Foundation 负责：

- 接收当前调用已授权、已投影的 display/application-safe context；
- context field minimization 与 ownership boundary；
- 调用 read-only port；
- 把内部 candidate outcome 当作 untrusted input 再验证；
- 生成/校验实际使用 source 的 `sourceRefs`；
- stable state/error/handoff mapping；
- 只输出 `AIConsultationPublicApplicationResultV1`。

Application 不执行登录、授权获取、持久化、网络 transport、provider selection 或 Page 文案判断。

### 6.3 Provider-port ownership

B5 只定义 transport/vendor-neutral interface：

- input 是 stable Application request 与已经最小化的 context；
- output 是 provider-independent、仍需 Application validation 的 internal candidate result；
- port 是 read-only，不允许 mutation callback、Domain write 或业务 side effect；
- port 不包含 URL、HTTP header、SDK、vendor model、Secret、DB、auth token 或 provider raw schema；
- test double 可以注入 deterministic candidate result，但必须保持 test-only provenance。

自由文本的 production classification、模型调用、provider raw response parsing 与 server-side safety 属于 future self-owned
Backend adapter；B5 不以本地关键词或 Prompt 伪装 production NLU。

### 6.4 Frontend ownership

B5 不修改 Page。future Page/ViewModel 只能消费 public-safe Application result，并负责 presentation、send/retry/handoff
interaction；不得重做 allowlist、safety、source eligibility、provider error 或 Recommendation/Institution 规则。

### 6.5 Backend ownership

future `backend_domain` 独占：provider credential、Secret、network call、provider raw schema、server-side safety、source ownership
authorization、可选 persistence、rate limit、audit/retention 与 output filtering。B5 不预先冻结其 endpoint、DTO、vendor、DB 或
deployment platform。

### 6.6 Mock ownership

- `scripts/fixtures/**`：test-only deterministic cases；
- injected test provider/FAQ double：仅测试 port/orchestration；
- `miniprogram/mock/**`：只有未来独立授权的 development Mock 才允许使用；B5 默认不创建；
- approved Product FAQ 是 future production knowledge，不是 test double，也不由 B5 填写内容。

## 7. Expected Repository Placement

实现应遵守当前结构：

- `miniprogram/types/ai-consultation*.ts`：B4-backed runtime/public types；
- `miniprogram/domain/ai-consultation/**`：pure validators、allowlist、policy、source/handoff projection；
- `miniprogram/services/ai-consultation*.ts`：ports、context minimization、orchestration、public result；
- `scripts/fixtures/**`：`TEST_ONLY_SYNTHETIC` cases；
- `scripts/check-*.mjs`：B5 targeted runtime/isolation/compatibility Gate。

具体文件数和内部名称可按实现最小化；上述是 ownership boundary，不要求机械创建空目录或无用模块。

## 8. Runtime and Validation Boundary

### 8.1 Contract-backed objects

B5 必须直接实现 B4 versioned object职责，不创建近似的第二套 shape：

- `AIConversationRefV1` 必须是 service conversation 或 local session 的互斥 identity；
- identity 是 opaque stable value，不等于 user/account/phone/persistence consent；
- `AIMessageV1.role/kind/sourceRefs/handoff` 组合必须合法；
- user input 无 sourceRefs/handoff；assistant output 不得使用 user-only kind；
- provider/system/tool/moderation/internal trace 不成为 public message；
- seven-state model 与 Application failure 保持分离。

Invalid input 不得被修补成成功 snapshot。Normalization 只能做不改变事实的结构处理，不得生成 identity、source、answer、
handoff、phone、Institution fact 或 Recommendation 结论。

### 8.2 Determinism

pure evaluator 对相同显式 input 必须产生 deep-equal output，不读取 `Date.now()`、random、storage、environment 或 network。
需要时间/identity 的 validator 只接受显式输入；测试固定这些值。

## 9. Knowledge and Context Boundary

允许的 source category 只能是 B4 的五类：

```text
product_faq
profile_display_snapshot
recommendation_display_snapshot
institution_display_snapshot
visit_faq
```

- 未知、空白、重复冲突或未获批准 category 默认不能进入 answer path；
- `global_consultant_service` 只是 handoff destination，不是 knowledge source；
- Application 不接收 raw Assessment draft、完整健康答案、完整 Profile/Recommendation/Institution record；
- 不接收 internal evidence locator、private notes、User.phone、Secret、Prompt 或 provider metadata；
- authenticated/authorized personal context 由 future Backend/Application owner 验证，B5 不信任客户端只提交的 `elderId`、
  `assessmentId` 或 locator；
- anonymous/local context 只能使用当前调用合法拥有的 display-safe projection；不得跨用户复用。

Context projector 应以 explicit field allowlist 输出最小 internal request。仅做 `as` cast、object spread 或删除少数字段，不能
证明 minimization；tests 必须断言 forbidden keys 不存在。

## 10. Safety Disposition Boundary

B5 的 deterministic policy evaluator 接收显式、已验证的 policy input，不负责 production free-text understanding。它至少表达：

- request category / safety flags；
- allowlisted source availability；
- user requested human；
- consecutive allowed-knowledge insufficiency count；
- Institution confirmation / realtime / contract-payment-complaint / appointment-complex-care requirement。

输出必须是 B4 的稳定 disposition/state/handoff 组合：

| Contract case | Required result |
|---|---|
| allowlisted source 足够且无禁止边界 | `answer` + `answer_ready` |
| safe refusal、无需人工承接 | `safe_refusal` + `answer_ready` |
| medical/treatment/medication/nasogastric | `safe_refusal` + `need_human` + `medical_professional_required` |
| user requested human | `human_handoff` + `need_human` + `user_requested_human` |
| 连续两次 allowlisted knowledge 不足 | `human_handoff` + `need_human` + `allowed_knowledge_insufficient` |
| realtime/institution confirmation | `human_handoff` + `need_human` + 对应 stable reason |
| 单次合法资料不足 | `knowledge_unavailable`，不得变成 Institution false/unavailable |
| transport failure | `network_error` public failure |
| Application/service failure | `service_error` public failure |

Provider 或 test double 提供的 disposition 不是信任根；Application 必须重新验证 Contract combination。不得只靠 Prompt 文案要求
provider “自觉”遵守安全边界。

## 11. Handoff and sourceRefs

### 11.1 Handoff

- `handoffReason` 只能使用 B4 stable code；
- `global_consultant_service` 是唯一现有 in-app Consultant destination，对应 `/pages/consultant/index`；
- medical handoff 不得把养老顾问描述成医疗人员；无合法医疗 destination 时只输出安全说明；
- handoff 不创建 contact request、Appointment、Visit、login、User.phone consent 或 persistence；
- 不输出“顾问已收到/已联系/已确认”等未发生事实。

### 11.2 sourceRefs

- sourceRef category 必须来自 §9；
- sourceRefs 由 Application 根据当前实际使用、已经 allowlist 的 context 生成或校验，不信任 provider citation；
- publicRef/version 只有上游 Contract 已批准为 public/application identity 时才可保留；
- raw DB id、internal URL、evidence locator、Prompt、provider/model/request id、moderation/audit、Secret/private metadata 禁止；
- refusal/technical failure 不伪造 citation；synthetic sourceRefs 不进入 production result。

## 12. Provider Raw and Public Result Isolation

```text
PROVIDER_RAW_RESULT != INTERNAL_CANDIDATE_RESULT
INTERNAL_CANDIDATE_RESULT != AI_APPLICATION_RESULT
```

B5 不处理真实 provider schema，但必须建立可验证 firewall：

- port 的 candidate result 必须经过 exact-shape validation；
- unknown/additional/internal fields 不得穿透 public projection；
- raw answer、Prompt、tool call、retrieval document、moderation、stack、transport error、token/provider metadata 禁止公开；
- sourceRefs 和 handoff 由 Application 按 allowlisted context 重新校验；
- invalid candidate result 映射 stable service/application failure，不能伪装 `answer_ready`；
- Page-facing output 唯一为 `AIConsultationPublicApplicationResultV1`。

## 13. Recommendation, Institution, Profile and Visit Isolation

```text
AI_RECOMMENDATION_ROLE = EXPLANATION_ONLY
AI_RECOMMENDATION_WRITE = FORBIDDEN
AI_RECOMMENDATION_RERANK = FORBIDDEN
AI_RECOMMENDATION_MATCHING_ROLE = NONE
```

B5 types/evaluator/port/fixture/result：

- 不导入或调用 Recommendation evaluator/ranking；
- 不改变 Safety、Eligibility、Exactness、Tier、PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` 或 card ordering；
- 不写 Assessment/ElderProfile，不生成第二份 Profile 或医疗诊断；
- 不写 Institution fact/Verification/Evidence/revision，不把 unknown/unverified/expired/unavailable 补成事实；
- 不创建/修改 Appointment/InstitutionVisit/VisitEvaluation，不推断 Visit status；
- 用户输入、answer、handoff 或 usage telemetry 不成为上述 Domain 的 input。

Isolation evidence 默认使用 structural import assertions、pure fixture tests 与 output shape checks。只有 B5 实际改动共享依赖时才扩大
对应回归；不得默认重跑整个 Recommendation/Institution 测试矩阵。

## 14. Mock and Fixture Boundary

B5 fixtures 必须：

- 使用 `TEST_ONLY_SYNTHETIC` 或当前测试体系的等价显式 provenance；
- 覆盖 valid/invalid object、全部 state、五类 source、unknown source、safety matrix、handoff、sourceRef stripping、provider failure；
- 不含真实个人健康数据、User.phone、Secret、真实未授权 Institution/Consultant facts；
- 不冒充 approved FAQ、online AI、realtime Institution query 或 Backend success；
- 不被 `miniprogram/**` production graph import。

Development Mock 与 test fixture 不得互相冒充。B5 不要求创建用户可见 Mock，也不得为了 future UI 演示把 synthetic answer 接入
production App。

## 15. Mandatory B5 Implementation Gates

以下 Gates 在未来 B5 implementation 中全部 mandatory；本 definition task 不执行它们。

### GATE 1 — CONTRACT_CONFORMANCE

- implementation 与 `AI_CONSULTATION_CONTRACT_V1.md` 完全一致；
- B4 Contract/Product Source/其他 Frozen semantic diff 为 0；
- no new knowledge、state、disposition、permission、side effect 或 provider behavior。

### GATE 2 — OBJECT_STATE_MODEL

- `AIConversationV1`、`AIMessageV1`、refs、seven states、message kinds、handoff 与 public result 有稳定 versioned representation；
- exact-shape/role-kind/state combination validation 完成；
- service/local identity 与 account/persistence 明确隔离。

### GATE 3 — KNOWLEDGE_ALLOWLIST

- 只接受 B4 五类 source；未知/未批准 category 默认拒绝进入 answer path；
- Consultant destination 不变成 knowledge；
- allowlist cases 与 deny-by-default 有 deterministic fixtures。

### GATE 4 — SAFETY_DISPOSITION

- `answer / safe_refusal / human_handoff` 是 deterministic Application result；
- medical 等 case 固定为 safe refusal + need human；
- 单次资料不足、连续两次资料不足、network/service failure 不压平；
- provider/test double outcome 必须经过 Application validation，不能只依赖 Prompt。

### GATE 5 — HANDOFF

- stable `handoffReason`、required/suggested 与 destination mapping 正确；
- 不创建 Appointment/contact request，不请求 User.phone，不承诺顾问已收到；
- medical handoff 不把 Consultant 冒充医疗专业人员。

### GATE 6 — SOURCE_REFS

- 只允许 public-safe category/label/version/ref；
- Application 从实际 allowlisted context 生成或校验；
- raw DB id、internal locator/URL、provider/model/request metadata、Prompt/Secret 不泄漏；
- fake/synthetic citation 不进入 production result。

### GATE 7 — CONTEXT_MINIMIZATION

- 只接收/投影回答当前 request 所需的 display/application-safe fields；
- raw Assessment、完整健康答案、private notes、internal evidence、User.phone、Secret 均不存在；
- unauthorized locator 不被信任；forbidden-key assertions PASS。

### GATE 8 — PROVIDER_RAW_ISOLATION

- internal candidate result 与 public Application result 类型/validation 明确分层；
- unknown/raw provider fields、Prompt、tool/moderation/error/stack 不可穿透；
- invalid candidate result fail closed，不能生成 available answer。

### GATE 9 — RECOMMENDATION_ISOLATION

- explanation only；Recommendation evaluator/ranker calls = 0；
- recompute/rerank/write/override/matching role = 0/NONE；
- B5 output 不进入 Recommendation input 或排序。

### GATE 10 — INSTITUTION_PROFILE_ISOLATION

- Institution/ElderProfile 只读 display/application-safe context；
- fact/revision/Profile/Assessment mutation = 0；
- unknown/unverified/expired/unavailable 不被 AI 改写。

### GATE 11 — VISIT_APPOINTMENT_ISOLATION

- Appointment/InstitutionVisit/VisitEvaluation create/update calls = 0；
- 不推断 Visit status，不生成预约确认或评价 truth。

### GATE 12 — MOCK_PROVENANCE

- production graph import test fixture = 0；
- injected doubles 保持 test-only provenance；
- approved FAQ、future live Backend、development Mock、test fixture 不混同。

### GATE 13 — DETERMINISM_RUNTIME

- pure Domain/Application evaluator 对相同显式 input deep-equal；
- fixture manifest 固定 case ID，检查缺失、重复和意外 skip；
- targeted runtime 覆盖 object/state、allowlist、safety、handoff、sourceRefs、minimization、raw firewall 与 isolation；
- 不运行无关全仓 runtime matrix。

### GATE 14 — WECHAT_COMPATIBILITY

- 若 B5 production Foundation 位于或进入 `miniprogram/**` runtime dependency graph，targeted TypeScript 与 generated-JS
  compatibility mandatory；
- 不引入当前 toolchain 不支持的 syntax、Node-only API、DOM/browser assumption 或 provider SDK；
- compatibility evidence 只覆盖 B5 changed modules 与真实依赖，不等于 DevTools UI Gate。

### GATE 15 — TARGETED_QA

- independent QA 只审最终 B5 diff、B4 conformance、anti-green fixtures、provider/raw firewall、privacy/Secret、isolation 与 scope；
- shared dependency 若未修改，不扩大到完整 Recommendation/Institution/Page 审查；
- production/UI/Backend scope expansion、mandatory Gate failure 或 fixture contamination 均为 blocker。

## 16. Evidence Policy

未来 B5 completion evidence 必须分开报告：

```text
RUNTIME_TESTS = MANDATORY_TARGETED_DOMAIN_APPLICATION
TARGETED_COMPATIBILITY = MANDATORY_IF_MINIPROGRAM_RUNTIME_DEPENDENCY
TARGETED_QA = MANDATORY
FRESH_DEVTOOLS_GATE = NOT_MANDATORY
ANDROID_REAL_DEVICE_GATE = NOT_MANDATORY
```

理由：B5 不包含 Page、ViewModel、navigation、WXML、Less、`wx.*` user action 或其他用户可见行为。Targeted TypeScript/
generated-JS compatibility 是自动化 runtime compatibility evidence，不是 Fresh DevTools 或真机 evidence。

如果 implementation 触及用户可见层，DevTools/Android 豁免失效；必须先报告 scope expansion 并重新冻结 phase/Gates，不能在 B5
中静默追加 UI。

## 17. Completion and Verdict Rules

### 17.1 Future implementation PASS

只有未来 implementation 同时满足以下条件，才能宣布：

```text
PHASE_V1_2_B5 = PASS
B5_IMPLEMENTATION = COMPLETE
BLOCKERS = 0
READY_FOR_B5_SUCCESSOR = TRUE
```

条件：

1. §15 全部 mandatory Gates PASS；
2. B4 Contract 与所有既有 Frozen semantics unchanged；
3. provider/Backend/UI/persistence/Secret 未越界实现；
4. public-safe Application result 是 future UI 唯一 AI consumer boundary；
5. production graph 无 test fixture、Mock answer 或 provider SDK；
6. independent targeted QA PASS；
7. Git change set 可追溯且无无关修改。

Backend/provider、production FAQ/knowledge、persistence 与 UI 尚不存在本身不构成 B5 风险或 blocker，因为它们明确 out of scope。

`PASS_WITH_RISKS` 只有在全部 mandatory Gates PASS 且存在真实、非阻塞、会影响 Foundation 维护/集成的风险时使用；不得用于掩盖
runtime/compatibility/QA failure、Contract mismatch、Secret/provider 直连、raw leakage 或 fixture contamination。

### 17.2 BLOCKED

以下必须 `PHASE_V1_2_B5 = BLOCKED`：

- 无法在不修改 B4 Contract 的情况下实现核心 object/state/safety/result；
- arbitrary free-text safety 被错误声称为客户端 pure evaluator 已可靠完成；
- provider raw/Secret/internal source 泄漏到 public result；
- Recommendation/Institution/Profile/Visit isolation 被破坏；
- production graph import test fixture；
- mandatory runtime/compatibility/QA Gate FAIL；
- 必须实现 UI、真实 Backend/provider、persistence 或 auth 才能完成 Foundation。

报告必须包含 `BLOCKER / ROOT_CAUSE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`。

### 17.3 Current definition task result

本 definition task 成功只允许：

```text
B5_PHASE_DEFINITION = PASS
B5_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B5 = NOT_STARTED
READY_TO_START_V1_2_B5 = TRUE
```

## 18. Non-blocking Implementation Dependencies

- self-owned Backend project/gateway；
- provider/vendor、model 与 Secret management；
- production Product FAQ/knowledge source 与 governance；
- conversation persistence、identity、retention/audit/deletion；
- `/pages/service/ai-chat` 与微信 interaction；
- production authorization for personal display snapshot context。

B5 必须通过 ports、explicit safe states、field allowlists 与 test-only fixtures 独立完成，不得因上述依赖未就绪而伪造 production
answer、provider success、citation 或 personal context。

## 19. Successor Boundary

B5 implementation PASS 后，才适合评估最小 Backend gateway、approved FAQ/knowledge adapter 或 AI UI integration successor。
该 successor 必须另行确定依赖顺序、真实 data/provider readiness 与相应 Gate；本文不命名、编号、批准或实现它。

## 20. Change Policy

- 本 handoff 冻结 B5 implementation slice 和 mandatory Gates，不创建新的 AI business semantics；
- allowlist、safety、handoff、privacy、Secret ownership、Recommendation/Institution/Profile/Visit isolation 变化必须先发布 B4
  Contract successor/version bump；
- additive internal organization MAY 最小调整，但不得改变 public version/state/result、port ownership 或 out-of-scope；
- Backend wire protocol、vendor、endpoint、DB、Prompt、production FAQ content 或 Page behavior 不得在 B5 中提前冻结；
- scope expansion 需要新的 phase approval，不得由实现自行决定。

## 21. Definition Review Record

```text
BACKEND_DOMAIN_BOUNDARY_REVIEW = PASS
QA_REVIEW = PASS
PRODUCT_DECISION_BLOCKER = NONE
ARCHITECTURE_GAP_BLOCKER = NONE
```

backend/domain 专项审查确认：B4 Contract 足以无歧义定义纯 Foundation；provider port 可保持 vendor/transport-neutral，真实 Backend、
Secret、provider、persistence 与 UI 均可延后且不阻止 B5。
