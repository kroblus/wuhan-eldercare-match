# Phase V1.2-B6 Implementation Handoff — AI Consultation UI Integration

状态：`FROZEN_PHASE_V1_2_B6_DEFINITION`

冻结日期：`2026-09-16`

```text
POST_B5_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-B6
NEXT_PHASE_NAME = AI Consultation UI Integration
NEXT_PHASE_TYPE = MINIPROGRAM_UI_INTEGRATION
B6_PHASE_DEFINITION = PASS
B6_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B6 = NOT_STARTED
PRE_B6_DEFINITION_HEAD = ea508052aaa08f7947659c8c5ca3d5a97b95aee8
PHASE_V1_2_B5 = PASS
B5_IMPLEMENTATION = COMPLETE
AI_CONSULTATION_CONTRACT = FROZEN
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_TO_START_V1_2_B6 = TRUE
```

本文冻结 B5 之后唯一获准立即实施的 successor。它授权建立 `/pages/service/ai-chat`、页面级 ViewModel、诚实的
approved-FAQ/unavailable capability wiring、用户交互和到养老顾问 Tab 的安全转人工导航；不授权真实 Backend、模型 provider、
Secret、production FAQ 内容、持久化或 Recommendation/Institution/Profile/Visit 写入。

## 1. Authority and Source Order

本阶段依次遵守：

1. 当前 V1.2 Product Source 中“养老咨询助手”页面、权限、安全技术边界与页面跳转要求；
2. `AI_CONSULTATION_CONTRACT_V1.md`；
3. `V1_2_B5_IMPLEMENTATION_HANDOFF.md` 与已完成 B5 runtime；
4. `FRONTEND_STRUCTURE.md`、`MOCK_DATA_POLICY.md`、`WECHAT_INTERACTION_CONTRACT.md`；
5. 本 handoff 的 UI implementation boundary。

本 handoff 不新增 knowledge category、AI state、safety disposition、handoff reason、权限、Recommendation 角色或 provider
能力。若实现需要改变 B4 Frozen Contract 或 B5 public result，必须停止并报告 `CONTRACT_GAP`，不得由 Page/ViewModel 自行补规则。

## 2. Successor Decision

### 2.1 Candidate review

#### AI UI Integration — immediate successor

- Current Product Source 将 `/pages/service/ai-chat` 定义为 V1.2-B P0 页面，并明确 Backend 未上线时可以先做 AI UI 与 FAQ/Mock
  adapter；其中 B4/B5 Frozen provenance 进一步约束 production 只能使用 approved FAQ 或 unavailable，development Mock/test
  fixture 不得进入 production/application graph；
- 当前 `miniprogram/app.json` 未注册该 route，`miniprogram/pages/service/ai-chat/**` 不存在；
- B5 已提供 Page 唯一允许消费的 `AIConsultationPublicApplicationResultV1`、七态、`sourceRefs`、handoff 与 action flags；
- 页面可以在没有 live Backend 时，以 approved FAQ（若后续有正式内容）或 production unavailable 合法存在；B6 Page/Application
  graph 不接 development Mock，test fixture 只能用于自动验证；
- 因此 UI 不存在 blocking Contract gap，可以形成最小用户可见交付。

#### Self-owned Backend Gateway Foundation — valid later successor

- live provider、Secret、network、provider raw schema 与 server-side safety 必须归 self-owned Backend；
- 当前 `server/**` 只有边界 README，没有正式 Backend 工程；
- B4/B5 未冻结 endpoint、transport、DTO、auth、rate limit、retention 或 deployment；Backend 开工前必须另行冻结最小 API/
  implementation boundary；
- Backend gateway 不阻止 B6，但 live provider integration 必须等待它。

#### Production Knowledge / Provider — not one immediate phase

- approved FAQ content/adapter 可以不依赖 live Backend，但需要独立的 product approval、version 和 provenance；
- real provider configuration 与 Secret management 必须依赖 self-owned Backend gateway；
- 两者依赖不同，不得被合并成一个模糊的 immediate phase，也不得塞入 B6。

### 2.2 Dependency order

```text
V1.2-B5 AI Domain & Application Foundation
  -> V1.2-B6 AI Consultation UI Integration
       -> honest unavailable is always legal

approved FAQ governance + adapter (optional parallel capability)
  -> B6 Application facade
       -> approved_faq limited mode

V1.2-B5 AI Domain & Application Foundation
  -> future self-owned Backend gateway boundary/foundation
       -> real provider configuration + Secret management + online model integration
```

Backend 与 UI 没有彼此完成后的硬串行依赖；`self-owned Backend gateway -> real provider` 是硬依赖。选择 B6 是因为它是当前最小、
合法且最接近 V1.2-B 用户可用闭环的交付，不代表 Backend 优先级被取消。

## 3. Goal

B6 的唯一目标是把 B5 public-safe Application boundary 接入一个匿名可打开、状态诚实、可转人工的微信小程序页面：

```text
approved capability or honest unavailable application wiring
  -> B5 AIConsultationPublicApplicationResultV1
  -> B6 Page ViewModel
  -> /pages/service/ai-chat
  -> send / retry / global consultant handoff interaction
```

Page/ViewModel 不解释 provider raw、knowledge allowlist、safety policy、source eligibility、Recommendation、Institution 或
ElderProfile 语义。

## 4. Preconditions

- `PHASE_V1_2_B4 = PASS`；
- `AI_CONSULTATION_CONTRACT = FROZEN`；
- `PHASE_V1_2_B5 = PASS`；
- `B5_IMPLEMENTATION = COMPLETE`；
- `AIConsultationPublicApplicationResultV1` 与相关 validation/projection runtime 已存在；
- `/pages/consultant/index` 已存在且是 Tab 页面；
- Product Source 已允许 Backend 未上线时先交付诚实 limited/unavailable UI。

不需要等待 self-owned Backend、provider vendor、Secret、production FAQ、RAG、persistence、login 或 User.phone。

## 5. In Scope

1. 在 `miniprogram/app.json` 注册 `/pages/service/ai-chat`；
2. 新建该页面的 Page、ViewModel、WXML、Less 与必要页面配置；
3. 建立页面唯一的数据入口：Page-facing AI Application facade/service；
4. 该 facade 只返回经过 B5 validation/projection 的 `AIConsultationPublicApplicationResultV1`；
5. 在 Application 层建立 capability-absent adapter：它不是 `AIConsultationProviderPortV1`，不得伪造 `approved_faq` 或
   `live_backend`；它只使用 B5 version/type/constants 构造既有 `knowledge_unavailable` public result，设置
   `responseProvenance = unavailable`，并在返回 Page 前通过 `validateAIApplicationResultV1`；
6. approved FAQ adapter 若未来已独立批准，则通过真实 `AIConsultationProviderPortV1` 注入 B5 service；无 adapter 时不得调用
   `createAIConsultationApplicationServiceV1` 并塞入 fake port；
7. 建立 local-session 页面生命周期、输入、send、retry 与 message display mapping；
8. 映射 B5 的七个 public-safe state，不重新推导 Domain state；
9. 展示 public-safe message、sourceRefs label、response provenance 与 handoff explanation；
10. 提供 Product Source 的常用问题入口，但回答能力必须服从实际 capability/provenance；
11. TEST_ONLY fixture 覆盖 answer/refusal/handoff/error 状态，但不进入 B6 Application 或 production dependency graph；
12. 固定“联系养老顾问”与结构化 handoff action，使用 `wx.switchTab({ url: '/pages/consultant/index' })`；
13. 首页新增最小 AI 助手入口，使 P0 页面可被用户正常打开；
14. targeted page/runtime/interaction/compatibility、Fresh DevTools 与 Android 17 人工真机证据。

若后续已有正式批准且版本化的 Product FAQ adapter，可通过稳定 Application port 接入；B6 不授权自行撰写或批准 production FAQ。

## 6. Out of Scope

- self-owned Backend gateway、`server/**` production implementation；
- REST/RPC endpoint、Backend DTO、auth、rate limit、logging、retention、DB 或 conversation persistence；
- real provider、provider SDK、模型选择、Secret、API Key、AppSecret、Prompt、streaming、tool calling；
- production FAQ 内容创作、审批、发布或运营后台；
- RAG、embedding、vector DB、search infrastructure；
- Recommendation Result / Profile / Institution Detail 到 AI 的 context-aware 新入口；
- route/query 传递 raw Profile、Recommendation、Institution 或 assessment 数据；
- 登录、User.phone、联系人收集、预约、Visit、VisitEvaluation；
- Recommendation V2、Institution verified fact、ElderProfile 或 Consultant Contract 修改；
- B4/B5 Frozen semantics 修改。

Recommendation/Profile/Institution 的 context-aware AI integration 需另行冻结安全 context transport，不得在 B6 Page 中临时拼接。

## 7. Ownership

### 7.1 Frontend Page / ViewModel

负责：

- 输入值、显示映射、section visibility、scroll/presentation；
- send/retry/handoff 的页面 action 与 loading/disabled/guard；
- public-safe messages、sourceRefs label、provenance 和 error copy 的展示；
- 微信导航调用与用户可见失败反馈。

不得负责：

- arbitrary free-text safety classification、allowlist、context minimization 或 sourceRef 生成；
- provider selection/raw parsing、Backend error interpretation；
- Recommendation/Institution/Profile 解释规则；
- public snapshot、answer、refusal 或 handoff object 的自行构造。

### 7.2 Application

负责：

- 建立 local-session request identity 与稳定 Page-facing facade；
- 调用 B5 service/validator/projection；
- 注入实际获准 capability；
- capability 缺失时返回现有 public-safe unavailable/error result；
- 不让 Page 看到 raw conversation、provider candidate、internal validation issue 或 source Domain record。

“没有 Backend/FAQ”不得伪装成 `approved_faq` 或 `live_backend`。不得为了复用 port 给不存在的 provider 伪造 provenance。

### 7.3 Backend

Backend 继续独占 provider credential、Secret、network、provider raw schema、server-side safety/filtering 与授权。B6 不创建任何
Backend wire protocol，也不将 B5 TypeScript interface 宣布为未来 HTTP DTO。

### 7.4 Mock / fixture / FAQ

- `scripts/fixtures/**`：TEST_ONLY 自动化证据；production import 必须为 0；
- development Mock：不进入 B6 Page/Application graph；若未来另行授权开发预览，必须走与 production 完全隔离的 dev-only bootstrap，
  不得借用 `approved_faq` / `live_backend` provenance；
- approved FAQ：production knowledge，必须有正式版本/provenance；不存在时保持 unavailable；
- live Backend：B6 不实现，也不得用 Mock 冒充。

## 8. Public UI State Boundary

ViewModel 只能映射 B5 public result：

| State | UI responsibility | Forbidden inference |
| --- | --- | --- |
| `idle` | 输入与常用问题入口可见 | online provider 已连接 |
| `sending` | 单次 action loading，阻止重复 send | provider 一定会成功 |
| `answer_ready` | 展示 public message/sourceRefs/provenance | answer 是实时机构承诺 |
| `need_human` | 展示安全说明与顾问入口 | 顾问已收到或已回复 |
| `knowledge_unavailable` | 诚实说明资料不足，可按 actions retry | Institution 不支持 |
| `network_error` | 可见网络错误和合法 retry | 公开 provider raw error |
| `service_error` | 可见服务错误和合法 retry | 用户输入或机构事实错误 |

不同 state 不得为减少 UI 分支而压平事实。Page 服从 `actions.canSend / canRetry / canOpenHumanHandoff`，不得重新发明 eligibility。

## 9. Capability and Provenance

B6 production 允许：

1. `approved_faq`：仅当独立批准、版本化 adapter/content 已存在；
2. `unavailable`：当前没有 approved production capability 时的默认诚实结果。

B6 production 不允许：

- development Mock 或 test fixture；
- 页面硬编码“AI 回答”；
- synthetic sourceRef/citation；
- 静默从 Backend failure fallback 到 Mock；
- 把 unavailable 页面描述成在线 AI 已可用。

自动化可使用 TEST_ONLY fixture 覆盖全部正向状态；Fresh DevTools 与 Android production evidence 必须针对真实 production capability，
不得为了正向截图注入 synthetic answer。

## 10. Interaction Matrix Boundary

未来实现编码前必须按 `WECHAT_INTERACTION_CONTRACT.md` 建立页面 Interaction Matrix，并至少冻结以下 action：

| Action | Initial eligibility | Effect | Failure/retry |
| --- | --- | --- | --- |
| send | non-empty trimmed input + `canSend` + no send in flight | one Page handler, at most one Application request | visible failure; release guard; retry allowed when result allows |
| quick question | item enabled + no send in flight | fill/submit one approved question through same send chain | no second event channel |
| retry | `canRetry` + no request in flight | one retry using Application-owned request boundary | failure visible; guard released |
| human handoff | fixed CTA or `canOpenHumanHandoff` | one `wx.switchTab` to Consultant | fail visible; guard released; later retry allowed |

共同要求：

- `1 physical tap -> 1 component event -> 1 page handler -> at most 1 business action/navigation`；
- empty/whitespace input 不发起 Application request，并给出可见 validation；
- rapid tap 不产生重复 message、request 或 navigation；
- success/fail/throw 后均不遗留永久 guard；
- 页面重新 show 后 action 可再次执行；
- Consultant 是 Tab，必须 `wx.switchTab({ url: '/pages/consultant/index' })`，禁止 `wx.navigateTo`；
- navigation failure 必须有用户可感知反馈。

## 11. Permission, Privacy and Isolation

- anonymous visitor 可以打开页面并使用实际可用的基础能力；
- 打开页面、发送基础问题或转到顾问页不强制登录、不请求 User.phone；
- Page/query/storage/log 不携带 raw assessment、private health answer、Secret、provider raw、internal evidence 或 private metadata；
- B6 不写 Assessment、ElderProfile、Recommendation、Institution、Appointment、Visit 或 VisitEvaluation；
- `AI_RECOMMENDATION_ROLE = EXPLANATION_ONLY`，recompute/rerank/write/matching 均为 0；
- human handoff 不创建 Appointment，不声明顾问已联系，不读取 Consultant raw/config/contact；只导航到现有 global Consultant page。

## 12. Mandatory Implementation Gates

### GATE 1 — CONTRACT_AND_B5_CONFORMANCE

- Page 只消费 B5 public-safe Application result；
- B4/B5 state、knowledge、safety、handoff、privacy 和 isolation 零漂移。

### GATE 2 — ROUTE_AND_ENTRY

- `/pages/service/ai-chat` route/page/config 完整；
- 首页最小 AI 入口合法、single-action、失败可见；
- Back/page-stack 行为符合非 Tab 页面语义。

### GATE 3 — PAGE_APPLICATION_BOUNDARY

- raw conversation/provider/config/source Domain/fixture imports 为 0；
- ViewModel deterministic，只映射 public result；
- arbitrary user text 不由 Page 分类成 safety policy。

### GATE 4 — PUBLIC_STATE_MAPPING

- 七态与 answer/refusal/handoff/technical-failure message 均有确定性覆盖；
- actions、sourceRefs、provenance 与 error mapping 正确；
- unknown/unavailable/failure 不被压成虚假业务事实。

### GATE 5 — CAPABILITY_PROVENANCE

- approved FAQ、test fixture、live Backend、unavailable 明确隔离；
- 当前无 approved production capability 时 production 显示诚实 unavailable；
- capability-absent adapter 输出必须通过 B5 public-result validator，且 fake provider/port 调用为 0；
- B6 Page/Application graph 中 development Mock import/wiring 为 0；
- fake online AI、fake sourceRef 和静默 Mock fallback 为 0。

### GATE 6 — SEND_RETRY_INTERACTION

- empty、valid、sending、rapid tap、failure、guard release、retry success 均有 runtime evidence；
- 每次物理 action 最多一次 Application request；
- Page 不绕过 Application safety/result boundary。

### GATE 7 — HUMAN_HANDOFF_NAVIGATION

- fixed CTA 与 structured handoff 均只进入 global Consultant Tab；
- `wx.switchTab`、single navigation、rapid tap guard、failure feedback、release/retry 全部 PASS；
- `wx.navigateTo` Consultant 调用为 0。

### GATE 8 — ANONYMOUS_PRIVACY

- anonymous open/send/handoff 不强制登录、不请求 User.phone；
- raw private context、Secret、provider/internal metadata 暴露为 0。

### GATE 9 — BACKEND_SECRET_ISOLATION

- provider SDK、`wx.request`/direct model endpoint、API Key/AppSecret/token 为 0；
- B5 port 未被误写成 Backend wire protocol；
- production no-capability 不伪装 Backend success。

### GATE 10 — MOCK_FIXTURE_ISOLATION

- production graph 对 `scripts/fixtures/**` import = 0；
- B6 production/application graph 对 development Mock import/wiring = 0；
- automated positive states 不被冒充为 production evidence。

### GATE 11 — CROSS_DOMAIN_ISOLATION

- Recommendation recompute/rerank/write = 0；
- Institution/ElderProfile/Assessment/Visit/Appointment writes = 0；
- context-aware Recommendation/Profile/Institution entry integration 未越界加入。

### GATE 12 — WECHAT_COMPATIBILITY

- targeted TypeScript、JSON、generated-JS 与 interaction runtime PASS；
- 新 `wx.*` 参数、success/fail/complete 和页面栈语义符合当前 typings/Contract；
- Node-only API、unsupported emitted class field 或额外 runtime polyfill assumption 为 0。

### GATE 13 — FRESH_DEVTOOLS

`FRESH_DEVTOOLS_GATE = MANDATORY`。必须针对最终 B6 source 验证：

- page 编译、加载、输入、滚动、send/retry、七态映射；
- production 当前真实 capability（预期为 unavailable，除非届时有 approved FAQ）诚实展示；
- Home entry、Consultant `switchTab`、Back/page stack；
- console 无相关 runtime exception。

Test-only positive answers 不得被接入 production DevTools build 充当真实 evidence。

### GATE 14 — ANDROID_17_MANUAL_REAL_DEVICE

`ANDROID_REAL_DEVICE_GATE = MANDATORY`，证据类型必须是 `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`，不得用自动化或 DevTools
替代。至少验证匿名打开、布局/滚动/输入、production actual state、send/retry、rapid tap、Home entry、Consultant handoff、Back stack
和无 Android 特有 crash/重复 action。

若 approved FAQ/live Backend 尚不可达，正向 answer case 记录 `NOT_REACHABLE`，由 automated TEST_ONLY evidence 覆盖；不得写成
production real-device PASS，也不得注入 fake production data。

### GATE 15 — TARGETED_QA

final diff 做独立、Contract-driven QA，重点检查 public boundary、state/provenance honesty、duplicate action、switchTab、privacy/Secret、
fixture contamination、scope expansion 与 DevTools/manual evidence classification。无需重审完整 Recommendation/Institution/Assessment。

## 13. Evidence Policy

必须分开报告：

```text
AUTOMATED_EVIDENCE
FRESH_DEVTOOLS_EVIDENCE
MANUAL_ANDROID_REAL_DEVICE_VERIFICATION
```

- automated fixture 可以证明 answer/refusal/handoff/error UI mapping；
- DevTools 证明当前 build 的微信编译与 simulator runtime，不替代 Android；
- Android 只证明 production 当前真实可达状态；
- Backend/provider/approved FAQ 未实现不能被旧证据或 Mock 宣布为 PASS。

## 14. Completion and Verdict

### 14.1 PASS

只有 15 项 Gate 全部满足，才允许：

```text
PHASE_V1_2_B6 = PASS
B6_IMPLEMENTATION = COMPLETE
BLOCKERS = 0
READY_FOR_B6_SUCCESSOR = TRUE
```

Backend、real provider、Secret 和 production FAQ 尚未实现不自动阻止 B6；前提是 production unavailable 诚实、public boundary 完整、
Mock/fixture 无污染。

### 14.2 PASS_WITH_RISKS

若 automated、compatibility、Fresh DevTools、QA 均 PASS，但 mandatory Android 17 人工证据尚未完成：

```text
PHASE_V1_2_B6 = PASS_WITH_RISKS
B6_IMPLEMENTATION = COMPLETE_PENDING_MANUAL_GATE
ANDROID_B6 = PENDING_OWNER_MANUAL_REAL_DEVICE_VERIFICATION
READY_FOR_B6_SUCCESSOR = FALSE
```

### 14.3 BLOCKED

以下不得用 `PASS_WITH_RISKS` 掩盖：

- Page/ViewModel 构造或解释 raw AI business semantics；
- arbitrary free text safety 被放进 Page；
- development Mock/test fixture 冒充 production；
- fake online/FAQ provenance、synthetic sourceRef 或 Secret/provider direct call；
- duplicate request/navigation、interaction failure 无反馈或 guard 不释放；
- Consultant 使用 `wx.navigateTo`；
- permission/privacy 或 Recommendation/Institution/Profile/Visit isolation 破坏；
- mandatory runtime/compatibility/DevTools FAIL 或 Android 实测 FAIL；
- 必须修改 Frozen Contract 才能完成。

报告 `BLOCKER / ROOT_CAUSE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`。

## 15. Definition Task Result

本任务只允许输出：

```text
POST_B5_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-B6
NEXT_PHASE_NAME = AI Consultation UI Integration
NEXT_PHASE_TYPE = MINIPROGRAM_UI_INTEGRATION
B6_PHASE_DEFINITION = PASS
B6_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B6 = NOT_STARTED
READY_TO_START_V1_2_B6 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
```

## 16. Successor Boundary

B6 PASS 后才能重新评估 self-owned Backend gateway、approved production knowledge adapter、real provider integration，或仍未完成的
V1.2-C 服务闭环。本文不命名、编号、批准或实现这些 successor。

## 17. Change Policy

- Page/ViewModel/layout/copy 的 additive refinement MAY 在 B6 scope 内完成，但不得改变 B4/B5 stable semantics；
- knowledge category、state、safety、handoff、privacy、Recommendation role 或更多个人数据读取变化需要 Contract successor；
- Backend endpoint/DTO/auth/retention/provider/vendor/Secret/production FAQ governance 必须由后继阶段冻结；
- context-aware Recommendation/Profile/Institution entry 需要独立安全 transport/integration boundary；
- B6 scope expansion 不得由 implementation 自行决定。
