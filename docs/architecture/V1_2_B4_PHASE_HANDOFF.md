# Phase V1.2-B4 Handoff — AI Consultation Safety & Application Contract Freeze

状态：`FROZEN_PHASE_V1_2_B4_DEFINITION`

冻结日期：`2026-09-16`

```text
NEXT_PHASE_ID = V1.2-B4
NEXT_PHASE_NAME = AI Consultation Safety & Application Contract Freeze
B4_PHASE_KIND = CONTRACT_FREEZE
B4_PHASE_DEFINITION = PASS
B4_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B4 = NOT_STARTED
AI_CONSULTATION_CONTRACT = NOT_FROZEN
PRE_B4_DEFINITION_HEAD = 990c2b40183ec8b963610a02d6ad2a70dfcac574
PHASE_V1_2_B3 = PASS
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_CODE_CHANGE_BY_DEFINITION_TASK = 0
RUNTIME_CODE_CHANGE_BY_DEFINITION_TASK = 0
TEST_CODE_CHANGE_BY_DEFINITION_TASK = 0
READY_TO_START_V1_2_B4 = TRUE
```

本文冻结 B3 之后的下一正式阶段边界、文档交付物与 mandatory Gates。它不是 AI 业务 Contract 本身，也不授权任何
production、runtime、Backend、模型或 UI 实现。只有未来 B4 按本文完成并通过全部 Contract Freeze Gates 后，才允许把新的
versioned AI Consultation Contract 标记为 frozen。

## 1. Authority and Successor Decision

本阶段的 Source of Truth 顺序为：

1. `docs/product/README.md` 与当前两份 V1.2 Product PDF；
2. 已冻结的 ElderProfile V2、Recommendation V2、Institution V1.2.1 与 Consultant/Permission 语义；
3. `FRONTEND_STRUCTURE.md`、`MOCK_DATA_POLICY.md` 与 `WECHAT_INTERACTION_CONTRACT.md`；
4. 当前 repo 的真实实现与 B3 Final PASS evidence。

Current Product Source 明确把 V1.2 划分为：

- V1.2-A：InstitutionCareProcess；
- V1.2-B：AI Consultation + Consultant / Enterprise WeChat；
- V1.2-C：InstitutionVisit + VisitEvaluation。

B1–B3 已完成 V1.2-B 的 Consultant/Enterprise WeChat Contract、Foundation 与独立 UI，但 `/pages/service/ai-chat`
尚不存在，repo 也没有 AI types、Domain、Application、provider 或 Backend。AI Consultation 因此是 V1.2-B 中唯一仍未建立
authoritative Contract 的 P0 能力。

Appointment/InstitutionVisit 属于 V1.2-C，正式提交依赖 identity、purpose-bound User.phone、Backend ownership、persistence
与运营状态事实；VisitEvaluation 又依赖真实 `completed` InstitutionVisit。它们不能绕过这些依赖成为 B3 后的直接 UI 实现，
也不得与 AI 合并成一个“大 B4”。

因此 authoritative successor 是：

```text
V1.2-B3 Consultant UI Integration = PASS
  -> V1.2-B4 AI Consultation Safety & Application Contract Freeze
  -> future separately defined AI Foundation / Backend / UI implementation phase
  -> only after V1.2-B closure may V1.2-C successor discovery begin
```

## 2. Phase Goal

B4 的唯一目标是创建并冻结一个 versioned AI Consultation Contract，使未来 AI Domain/Application、Backend gateway、FAQ or
knowledge adapter、`/pages/service/ai-chat` 与 Consultant human handoff 共享同一安全语义。

该 Contract 必须让未来实现无需猜测：

- `AIConversation` / `AIMessage` 的稳定职责、identity 与 ownership；
- AI 可以读取哪些 public/display-safe inputs；
- 哪些问题可以回答、必须转人工或必须拒绝；
- `sourceRefs` 与 `handoffReason` 的公开安全边界；
- anonymous、authenticated user、operations 的权限与数据最小化；
- Application、Page、Backend gateway 与模型 provider 的 ownership；
- AI 对 ElderProfile、Recommendation、Institution、VisitEvaluation 的 read/write isolation；
- FAQ/Mock 与真实在线模型能力如何区分；
- future implementation 的稳定状态与 failure boundary。

B4 是 docs-only Contract Freeze，不实现 AI 功能。

## 3. Preconditions

B4 开始前必须保持：

- `PHASE_V1_2_A1_5 = PASS`；
- `PHASE_V1_2_B1 = PASS`，Consultant/Permission Contract frozen；
- `PHASE_V1_2_B2 = PASS`，Institution-bound Consultant Foundation complete；
- `PHASE_V1_2_B2_1 = PASS`，Global Consultant Snapshot Foundation complete；
- `PHASE_V1_2_B3 = PASS`，Consultant Page 与 human-handoff destination available；
- Recommendation V2 与 Institution frozen semantics unchanged；
- production/runtime working tree 不因 B4 文档任务发生修改。

## 4. B4 In Scope

未来 B4 Contract Freeze 必须覆盖：

1. versioned `AIConversation` / `AIMessage` identity、role、content、creation time、source reference 与 handoff reason；
2. `idle`、`sending`、`answer_ready`、`need_human`、`knowledge_unavailable`、`network_error`、`service_error`
   的互不压平语义；
3. Product FAQ、养老基础概念、Profile display snapshot、Recommendation display snapshot、verified Institution display
   snapshot、Visit FAQ 的只读 allowlist；
4. raw Assessment answers、internal verification/evidence locator、private operations notes、Secret 与未过滤个人数据的禁止读取边界；
5. 医疗诊断、治疗、用药、鼻饲判断、实时床位/最终价格、合同、付款、投诉、复杂特殊护理确认与预约确认的转人工/拒绝边界；
6. “一定适合 / 最好 / 一定有床”等保证性表达和缺失事实补全的禁止边界；
7. 用户主动要求人工、连续两次资料不足、需要机构确认时的 Consultant handoff；
8. anonymous access、最小上下文、个人画像解释与登录/持久化之间的权限边界；
9. 小程序、Application service、自有 Backend gateway、AI provider 与 knowledge source 的 ownership；
10. API Key、AppSecret、provider credential 仅归 Backend，禁止进入小程序或仓库；
11. FAQ/local adapter、test fixture 与真实在线 AI result 的 provenance 隔离；
12. Recommendation、Institution、Assessment/ElderProfile 与 VisitEvaluation 的 hard write isolation；
13. 后续 AI Foundation、Backend 与 UI 实现可以依赖的稳定 public/application result。

## 5. B4 Out of Scope

B4 不包含：

- `/pages/service/ai-chat`、WXML、Less、ViewModel、聊天交互或路由实现；
- AI runtime types、validator、evaluator、service、provider 或 test fixture；
- 真实模型调用、模型选择、prompt engineering、RAG、embedding、vector database 或 streaming；
- Backend project、REST endpoint、DTO、database、ORM、migration、queue、rate limit 或 observability 实现；
- API Key、AppSecret、真实 provider credential 或生产 knowledge data；
- conversation persistence、登录技术、retention TTL、删除 job 或具体加密算法；
- AI 自动推荐、重排、评分、诊断、报价、床位保证、合同/投诉处理或自动预约；
- Appointment、InstitutionVisit、VisitEvaluation、CRM 或 V1.2-C implementation；
- 修改 ElderProfile、Recommendation、Institution、Consultant 或 Product Source；
- production fake AI answer、fake source reference 或把 Mock 冒充模型结果。

基础设施、协议或保留期限若未被 Product Source 决定，应保留为后续 implementation decision，不得在 B4 中擅自冻结。

## 6. Ownership and Layer Boundary

B4 Contract 必须冻结以下 ownership：

```text
Frozen read-only source snapshots
  -> AI Application context allowlist / minimization
  -> AI consultation port
  -> future Backend gateway or explicitly marked FAQ adapter
  -> public-safe AI Application result
  -> future Page / ViewModel
  -> human handoff to Consultant Tab when required
```

- source Domain 继续拥有 Profile、Recommendation、Institution display snapshot；AI 只有只读解释权；
- AI Service 拥有 conversation/message、answer state、sourceRefs 与 handoffReason 语义；
- Application 层拥有 context minimization、stable result、error mapping 与 human-handoff eligibility；
- future Page/ViewModel 只消费 public-safe Application result，不直接读取 raw profile、recommendation、institution 或 provider response；
- self-owned Backend gateway 承担 Secret、provider authentication、server-side safety enforcement 与外部模型调用；
- Consultant Service 只作为已冻结的人工承接目标，不向 AI 提供 Recommendation matching role；
- ordinary user、Page 与模型 provider 均无权写回 source facts。

B4 不冻结具体 endpoint、transport、vendor 或 database schema。

## 7. Knowledge and Data Truth Boundary

Contract 必须为每类允许知识定义 source role 和 public/display-safe projection，不复制上游 Domain 算法：

- Product FAQ / application usage；
- 养老基础术语；
- `ProfileApplicationSnapshotV2` 的既有展示结论；
- `RecommendationResultApplicationSnapshotV2` 的 tier/reason/difference/gap 等已生成展示语义；
- 当前合法的 Institution display/application snapshot；
- Visit FAQ / 看院流程与注意事项。

必须明确：

- 默认不把完整健康问卷或完整 ElderProfile raw record 发送给模型；
- institution-level 结论只能来自当前允许展示的数据，缺资料时必须说明需要确认；
- `sourceRefs` 只能表达允许公开/解释的 source identity，不泄露内部 evidence locator、credential 或 private metadata；
- AI answer 不是 Institution verified fact、Recommendation result、medical judgment 或 operational Visit truth；
- `knowledge_unavailable` 不得压平成机构“不支持”或事实为 false。

## 8. Safety and Human Handoff

B4 Contract 必须冻结至少三类 outcome：

1. **Answer allowed**：在 allowlist 与现有 source evidence 内进行有限解释；
2. **Need human**：用户要求人工、连续两次资料不足、需要机构确认、实时/合同/投诉/预约/复杂护理问题；
3. **Refuse safely**：医疗诊断、治疗、用药或其他禁止由 AI 给出结论的请求。

Contract 必须定义 public-safe handoff reason，而不是暴露 prompt、provider error 或内部 moderation details。人工入口复用已通过 B3 的
Consultant Tab；AI 不得自行选择 Institution consultant、修改 Consultant assignment 或获取 User.phone。

## 9. Permission and Privacy

- anonymous visitor 可以打开 AI assistant 并使用不需要个人持久化的合法能力；
- 打开 AI、阅读 FAQ 或查看公开回答不得强制登录或请求 User.phone；
- 解释个人画像只能读取当前合法、最小化的 local/authorized display snapshot；
- 是否持久化 conversation、跨设备历史或账户绑定属于后续明确授权能力，不是 B4 默认事实；
- 不记录完整健康答案、Secret、provider credential、private notes 或未过滤 raw source；
- persistent history、retention、deletion、audit 与 consent implementation 必须在未来 Backend/permission phase 明确，B4 只冻结原则；
- AI 不得写入 Assessment、ElderProfile、Recommendation、Institution 或 VisitEvaluation。

## 10. Isolation Invariants

### 10.1 Recommendation V2

```text
AI_RECOMMENDATION_READ = DISPLAY_SNAPSHOT_ONLY
AI_RECOMMENDATION_WRITE = FORBIDDEN
AI_RECOMMENDATION_RERANK = FORBIDDEN
AI_RECOMMENDATION_OVERRIDE = FORBIDDEN
AI_RECOMMENDATION_MATCHING_ROLE = NONE
```

AIConversation、AIMessage、question、answer、handoff state 或 usage telemetry 均不得进入 Safety、Eligibility、Exactness、
PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` 或 card ordering。

### 10.2 Institution and Visit

- AI 只可读取合法 Institution display data，不读取/修改 raw verified facts；
- AI 不得补造价格、床位、电话、地址、护理能力或 Verification/Evidence；
- AI answer 不创建新的 Institution revision；
- AI 不创建 Appointment/InstitutionVisit，不推断 visit status；
- AI 不代替用户提交 VisitEvaluation，不产生公开评分或 Recommendation weight。

## 11. Mock, FAQ and Provider Boundary

- test-only AI fixtures 只能验证 Contract states、answer/handoff mapping 与 isolation；
- production App 不得 import test fixture；
- FAQ/local adapter 必须明确标识其能力来源，不冒充在线模型、实时机构查询或 Backend success；
- synthetic answer/sourceRefs 不得在 production 截图、DevTools 或真机中冒充真实 AI/Institution facts；
- Backend 未上线不是接入前端 API Key 或伪造在线结果的理由；
- future production provider failure 必须映射为 frozen public-safe state，不得由 Page 自行解释 raw error。

## 12. B4 Mandatory Gates

### GATE 1 — PHASE TRANSITION

- B3 Final PASS 与 V1.2-B remaining P0 已被正式记录；
- B4 ID、name、type、goal、scope、out-of-scope 与 completion criteria 明确；
- 不把 V1.2-C Appointment/Visit/Evaluation 混入 B4。

### GATE 2 — CONTRACT IDENTITY AND OBJECT MODEL

- versioned AI Consultation Contract 建立；
- `AIConversation`、`AIMessage`、sourceRefs、handoffReason 的职责、public/internal boundary 与 mutation authority 明确；
- conversation identity 不强制等同于 authenticated user 或 persistent record。

### GATE 3 — STATE MODEL

- `idle/sending/answer_ready/need_human/knowledge_unavailable/network_error/service_error` 具有确定且不互相压平的语义；
- Contract 定义哪些是 conversation/message state、哪些是 Application/runtime failure；
- Page 不需要解释 provider raw status。

### GATE 4 — KNOWLEDGE AND CONTEXT ALLOWLIST

- Product FAQ、Profile、Recommendation、Institution display snapshot 与 Visit FAQ 的允许读取边界明确；
- raw health answers、private metadata、internal evidence locator 与 Secret 明确禁止；
- sourceRefs 不泄露内部数据。

### GATE 5 — SAFETY AND HUMAN HANDOFF

- allowed answer、need_human、safe refusal 的边界完整；
- medical、realtime、contract/payment/complaint、appointment/complex-care 场景不会得到伪结论；
- Consultant handoff 与 B1/B2.1/B3 边界一致。

### GATE 6 — PERMISSION AND PRIVACY

- anonymous access、minimal context、personal snapshot、login/persistence 与 User.phone 边界明确；
- 打开 AI 不要求 login/User.phone；
- 未冻结具体 TTL/crypto/infrastructure。

### GATE 7 — BACKEND AND SECRET BOUNDARY

- 真实在线链路仅允许 `Mini Program -> self-owned Backend -> AI provider`；
- frontend/repo 不得包含 model API Key/AppSecret/provider credential；
- Contract 不预占 endpoint、vendor、DB 或 transport protocol。

### GATE 8 — RECOMMENDATION ISOLATION

- read 仅限既有 display snapshot；
- write/rerank/override/matching role 全部为 none/forbidden；
- 不复制或重新实现 Recommendation V2 算法。

### GATE 9 — INSTITUTION / VISIT ISOLATION

- AI 不写 Institution facts/revision/verification；
- AI 不创建或推断 Appointment/Visit；
- AI 不提交 VisitEvaluation 或产生 rating weight。

### GATE 10 — MOCK / FAQ ISOLATION

- FAQ/local adapter、development Mock、test fixture、Backend/model provider 的 provenance 可区分；
- production graph 无 test-only fixture；
- 无 fake online answer、fake source or fake Institution fact。

### GATE 11 — DOWNSTREAM APPLICATION BOUNDARY

- future Domain/Application Foundation 可以依据 Contract 定义 types、validation、context minimization、port 与 public result；
- future Page/ViewModel 只消费 public-safe result；
- Contract 不把 UI、Backend 或 provider implementation 提前塞入 B4。

### GATE 12 — CROSS-DOCUMENT CONSISTENCY

- 与 Current Product Source、Profile/Recommendation/Institution/Consultant frozen boundaries、Frontend Structure 与 Mock Policy 一致；
- 发现真实冲突时报告，不修改更高优先级 Source 来迁就 AI Contract。

### GATE 13 — CONTRACT QA AND PRODUCTION ISOLATION

- final Contract diff 进行 independent、read-only、risk-based QA；
- review safety gaps、scope expansion、privacy leakage、hidden rerank/write path 与 fake provider semantics；
- `PRODUCTION_CODE_CHANGE = 0`、`RUNTIME_CODE_CHANGE = 0`、`TEST_CODE_CHANGE = 0`。

## 13. Evidence and Gate Applicability

B4 是 Contract Freeze，因此仅要求：

- targeted Product Source review；
- contract completeness and contradiction review；
- privacy/safety/backend boundary review；
- Recommendation/Institution isolation review；
- document governance validation；
- `git diff --check`；
- independent Contract QA。

```text
RUNTIME_TESTS = NOT_MANDATORY
FRESH_DEVTOOLS_GATE = NOT_MANDATORY
ANDROID_REAL_DEVICE_GATE = NOT_MANDATORY
```

如果 B4 意外修改 production/runtime/test code，应停止按纯 Contract Freeze 验收并报告 scope mismatch。

## 14. Completion and Verdict Rules

只有 Gate 1–13 全部 PASS，且没有 contract-critical unresolved product decision，未来 B4 才允许输出：

```text
PHASE_V1_2_B4 = PASS
AI_CONSULTATION_CONTRACT = FROZEN
BLOCKERS = 0
READY_FOR_B4_IMPLEMENTATION_SUCCESSOR = TRUE
```

`PASS_WITH_RISKS` 只允许用于 Contract 已足以作为实现 Source of Truth，但仍有不阻止 contract freeze 的后续依赖，例如：

- Backend project/provider 尚未实现；
- 模型/vendor 尚未选择；
- production knowledge source 尚未接入；
- persistent conversation/history 尚未实现。

这些 out-of-scope 依赖本身不构成 B4 blocker。

以下必须 `BLOCKED`：allowed knowledge 无法确定、medical/realtime safety 仍有矛盾、sourceRefs/privacy 会泄露 raw data、human
handoff 无法定义、真实在线 AI 必须暴露 frontend Secret、Recommendation/Institution isolation 无法保持，或必须修改 Current
Product Source / existing Frozen Contract 才能成立。

## 15. Successor Boundary and Change Policy

- B4 PASS 后才评估 AI Domain/Application Foundation、Backend gateway 或 UI integration 的最小 successor；
- 本文不提前为 B4 successor 命名或编号，也不实现 `/pages/service/ai-chat`；
- Appointment/InstitutionVisit/VisitEvaluation 保持 V1.2-C 候选，不进入 B4；
- B4 Contract 一旦 frozen，后续实现不得通过代码改变 allowed knowledge、safety、privacy、handoff 或 isolation；
- 重大语义变化必须发布新的 Contract revision 或 successor phase，不得静默修改实现。
