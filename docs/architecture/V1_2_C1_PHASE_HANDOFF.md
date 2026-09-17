# Phase V1.2-C1 Handoff — Appointment & InstitutionVisit Contract Freeze

状态：`FROZEN_PHASE_V1_2_C1_DEFINITION / PHASE_V1_2_C1_PASS`

冻结日期：`2026-09-17`

```text
POST_B7_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C1
NEXT_PHASE_NAME = Appointment & InstitutionVisit Contract Freeze
NEXT_PHASE_TYPE = CONTRACT_FREEZE
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C1 = PASS
C1_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS
PRE_C1_DEFINITION_HEAD = 6913cf3b1c9c2105ffa03cb52250c7fbcc4d0d89
PHASE_V1_2_B7 = PASS
B7_IMPLEMENTATION = COMPLETE
AI_CONSULTATION_CONTRACT = FROZEN
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C1_SUCCESSOR = TRUE
```

本 handoff 冻结 B7 之后唯一获准立即开展的 successor。C1 只负责把 Current Product Source 已明确的
Appointment / InstitutionVisit 语义、权限和数据真相边界收敛为新的 versioned Frozen Contract；不授权
production runtime、Page、Backend、数据库、真实提交或 VisitEvaluation 实现。

## 1. Successor Decision

### 1.1 Remaining V1.2 P0

- V1.2-A Institution CareProcess：已完成；
- V1.2-B Consultant、Enterprise WeChat、AI Foundation/UI 与 approved FAQ limited mode：已完成；
- V1.2-C Appointment / InstitutionVisit / VisitEvaluation 服务闭环：未完成；
- 当前 Appointment 三个页面只是 honest scaffold；`/pages/visit/evaluation` 尚无 route 或 implementation；
- `server/**` 只有未来 Backend 边界说明，没有正式工程、API、auth、persistence 或 operational state source。

### 1.2 Candidate review

| Candidate | Decision | Reason |
|---|---|---|
| Self-owned AI Backend Gateway Foundation | `DEFERRED / REQUIRES_NEW_CONTRACT` | B4 只冻结 provider/Secret ownership，未冻结 endpoint、DTO、auth、retention、deployment 或 operational protocol；B7 approved FAQ 已提供合法有限能力 |
| Real AI provider / Secret integration | `DEFERRED` | 硬依赖 self-owned Backend gateway 与受控 Secret/network/safety enforcement；客户端直连仍被禁止 |
| Appointment + InstitutionVisit production implementation | `REQUIRES_NEW_CONTRACT` | identity、submission、auth、phone、idempotency、persistence 和状态 authority 尚未冻结，当前 scaffold 不得升级成伪提交 |
| Appointment & InstitutionVisit Contract Freeze | `READY` | 属于剩余 V1.2 P0，Product Source 已给出核心对象、状态、权限与事实归属，且这是合法实现前最小前置阶段 |
| VisitEvaluation implementation | `DEFERRED / REQUIRES_INSTITUTION_VISIT` | 必须绑定真实 `visitId` 且 authoritative Visit status 为 `completed`；不得由 Page 或时间推断 |
| Other V1.2 P0 | `ALREADY_SATISFIED` | Recommendation 主链、CareProcess、Consultant 与 AI P0 已完成；P1/P2 不提前进入 |

### 1.3 Dependency order

```text
V1.2-C1 Appointment & InstitutionVisit Contract Freeze
  -> future Appointment / InstitutionVisit Domain + Application + Backend Foundation
  -> future formal submission / operational Visit truth
  -> future VisitEvaluation Contract / Foundation / UI

separate deferred track:
self-owned AI Backend Gateway Contract/Foundation
  -> real provider + Secret integration
```

C1 优先是因为它直接推进当前唯一未完成的 P0 服务闭环，并在任何真实手机号采集、登录、持久化或运营状态写入前先
关闭必要 Contract 缺口。真实 AI provider 不是 B7 limited mode 正确性的前置条件，也不应抢占 V1.2-C 的 immediate
successor。

## 2. Authority and Source Order

C1 Contract Freeze 依次遵守：

1. `docs/product/README.md` 路由的两份 Current V1.2 Product Source PDF；
2. 已冻结 Institution / List-Detail Contract 中 canonical `(institutionId, recordRevision)` 边界；
3. 已冻结 Consultant / Permission Contract 中 platform consultant 与 Institution official contact 隔离；
4. 已冻结 AI Consultation Contract 中 Appointment / Visit / Evaluation zero-write 边界；
5. CURRENT `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
6. `server/README.md` 所记录的当前 repo/backend 缺口，仅作为现状证据，不作为业务 Contract；
7. 本 handoff 对 C1 phase scope、ownership、mandatory Gates 与 completion criteria 的冻结。

C1 不修改上述 Frozen Contract 或 Product Source。发现真实冲突时必须停止冻结新 Contract 并报告最小
`CONTRACT_CONFLICT`，不得为适配 scaffold 或旧通用 TypeScript type 改写正式语义。

## 3. Phase Goal

C1 必须创建并冻结一个 versioned Appointment / InstitutionVisit Contract，使后续 implementation 不再自行猜测：

- Appointment intent/request 与 InstitutionVisit 的对象、identity 和 ownership；
- “预约申请已提交”与“机构/顾问已确认”的严格差异；
- `requested / contacting / scheduled / completed / cancelled` 的状态语义和 mutation authority；
- canonical Institution revision、Elder/User/Consultant identity 如何绑定；
- anonymous intent、authenticated persistence 与历史查看的合法边界；
- User.phone 的 purpose-bound 获取、使用和禁止传播边界；
- Backend、Application、Page、Consultant/Operations 对提交、状态和公开结果的 ownership；
- idempotency、retry、duplicate submission 与 public-safe failure 的 Contract 边界；
- VisitEvaluation 何时才可成为合法 successor；
- Recommendation、Institution verified fact、AI、Consultant 与 Mock isolation。

目标 Contract 的语义角色为 `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1`。具体文件名服从当前 Documentation
Governance；本 handoff 不预先实现其 types、runtime 或 API。

## 4. Preconditions

```text
PHASE_V1_2_B7 = PASS
B7_IMPLEMENTATION = COMPLETE
CURRENT_PRODUCT_SOURCE_VERSION = V1.2
V1_2_C = InstitutionVisit + VisitEvaluation
APPOINTMENT_PAGES = HONEST_SCAFFOLD_ONLY
VISIT_EVALUATION_ROUTE = ABSENT
FORMAL_BACKEND = ABSENT
APPOINTMENT_VISIT_FROZEN_CONTRACT = ABSENT
```

旧 `miniprogram/types/domain.ts` 中的通用 `Appointment` interface 和现有 route scaffold 仅是当前代码事实，不是 C1
Source of Truth，不得反向冻结 `submitted/confirmed/completed` 等旧 shape。

## 5. C1 In Scope

### 5.1 Object and identity model

C1 必须冻结：

- Appointment intent/request 与 InstitutionVisit 是否为不同对象及其稳定 versioned identity；
- canonical `institutionId + institutionRecordRevision` 的强制绑定；
- current revision eligibility 与 historical/suspended/archived revision 禁止创建边界；
- `elderId`、`userId`、`consultantId` 的可选性、归属与何时必须存在；
- `visitId` 的生成 authority，以及 VisitEvaluation 未来必须绑定真实 `visitId`；
- public/application result 与 raw Backend/operations record 的隔离。

### 5.2 Submission and lifecycle semantics

C1 必须保持并精确定义：

```text
SUBMITTED_REQUEST != CONFIRMED_VISIT
REQUESTED != SCHEDULED
SCHEDULED != COMPLETED
```

Product Source 的 Visit lifecycle 只允许：

- `requested`；
- `contacting`；
- `scheduled`；
- `completed`；
- `cancelled`。

Contract 必须冻结合法 transition、mutation authority、terminal/non-terminal behavior、unknown/unavailable/failure
边界，以及 Page 不得根据时间、日期或本地 navigation 推断状态。

### 5.3 Appointment input and truthful result

C1 仅按 Product Source 冻结候选输入语义：

- Institution；
- Elder；
- visit date / time；
- participant count；
- pickup only when truthfully supported；
- contact name；
- purpose-bound phone；
- notes。

Contract 必须定义 validation、optional/required、display-safe projection 与 failure 边界。成功结果只能表达
“预约申请已提交”或 Contract 中等价的 request acceptance，不得冒充机构确认、顾问已联系、实际排期或 completed Visit。

### 5.4 Identity, auth and anonymous boundary

Product Source 允许先表达预约/带看意向，同时规定正式持久化历史可要求登录。C1 必须由正式 owner decision 唯一冻结：

- anonymous intent 是否可提交到何种边界；
- 哪一步开始要求 authenticated identity；
- formal persisted record、history ownership 与 access control；
- anonymous/local state 不得冒充 server-persisted Appointment/Visit truth；
- 登录失败、identity unavailable 与 user cancellation 的 public-safe result。

这是 C1 必须关闭的 Contract decision，不授权 Page、Backend implementer 或 scaffold 自行选择。

### 5.5 User.phone and privacy

C1 必须冻结：

- 只有用户明确预约或明确要求顾问联系时才可获取/提交 User.phone；
- purpose、user action、consent/authorization 与最小数据传递边界；
- 未授权、取消、不可用和失败时不得伪造号码或从其他对象 fallback；
- User.phone 不得来自 Consultant phone 或 Institution official phone；
- route/query/log/analytics/fixture 不得携带真实 User.phone；
- retention、masking、access 与 deletion 的 ownership 原则，不在 C1 冻结具体 DB/加密实现。

### 5.6 Backend, persistence and API ownership

C1 必须冻结稳定 Domain/Application 语义和 future port/protocol boundary，但不实现：

- REST/RPC endpoint；
- Backend DTO；
- DB schema、ORM 或 migration；
- auth/session provider；
- queue、CRM、operations console 或 deployment。

Backend/Operations 未来拥有 persisted Appointment/Visit truth、status mutation、idempotency enforcement 与 authorized
access。Application 拥有 stable request/result、validation、privacy minimization 与 public-safe projection。Page 只收集 Contract
允许的输入、呈现 Application result 和触发 action，不生成业务状态。

### 5.7 Consultant and contact boundary

- Consultant assignment/profile 继续由既有 Consultant Service Contract 所有；
- Appointment/Visit Contract 可以引用合法 resolved `consultantId` 或 public handoff destination，但不得复制 assignment resolver；
- platform Consultant phone 永远不冒充 Institution official phone；
- Appointment submission 不自动声明 Consultant 已联系、已确认或已接单；
- C1 不修改 B1–B3 Consultant Frozen semantics。

### 5.8 VisitEvaluation successor boundary

C1 只冻结 VisitEvaluation 的必要前置条件，不实现完整评价 Contract：

- 必须绑定真实 `visitId`；
- authoritative Visit status 必须为 `completed`；
- Page 不按时间或用户自行声明推断 completed；
- Evaluation 继续属于 `USER_REPORTED_DATA`；
- Evaluation 不修改 Institution verified facts/revision，不进入 Recommendation V2；
- Evaluation fields、submission states、persistence、UI 与 verification-lead workflow 留给后续独立 Contract/successor。

### 5.9 Mock and fixture boundary

C1 必须规定未来 synthetic Appointment/Visit fixture 的明确 TEST_ONLY provenance。Mock 不得：

- 冒充真实用户、手机号、Appointment、Visit 或运营状态；
- 进入 production dependency graph；
- 伪造 `scheduled/completed` 以解锁 production VisitEvaluation；
- 写回 Institution、Recommendation、Consultant 或 AI truth。

## 6. C1 Out of Scope

- production TypeScript/Java/runtime types、validator、service、provider 或 fixture；
- Appointment Page、form、WXML、Less、navigation 或 User.phone 微信授权实现；
- `/pages/appointment/success`、`/pages/appointment/index` production integration；
- `/pages/visit/evaluation` route、Page、ViewModel 或 form；
- Backend project、controller、API、DB、migration、auth、persistence、idempotency implementation 或 CRM；
- real User/Elder/Institution/Consultant/phone/Appointment/Visit/Evaluation data；
- VisitEvaluation 完整 Contract/Foundation/UI；
- self-owned AI Backend gateway、real provider、Secret 或 AI context integration；
- Recommendation V2、Institution verified semantics、ElderProfile、Consultant、AI Contract 或 Product Source 修改；
- DevTools、Android 或 user-visible interaction validation。

若 C1 Contract Freeze 必须写 production/runtime/test code 才能完成，必须报告 `SCOPE_MISMATCH` 并停止。

## 7. Layer and Domain Ownership

| Layer / owner | C1 freezes | C1 does not authorize |
|---|---|---|
| Appointment / Visit Domain | identity、object relationship、states、transition legality、truth ownership | runtime implementation、DB、API |
| Application | stable command/request/result、validation、minimization、public-safe projection、port boundary | direct persistence、raw Backend schema exposure |
| Backend / Operations | persisted truth、identity/auth enforcement、status mutation、idempotency、authorized reads/writes | implementation in C1 |
| Consultant Service | existing assignment/profile/contact truth | Appointment state ownership or Institution official contact fallback |
| WeChat Page | future input/display/action consumer | state inference、persistence truth、raw record access |
| VisitEvaluation | future completed-Visit consumer | implementation or premature submission |
| Recommendation / Institution | read-only canonical reference where authorized | Visit/Evaluation write-back or ranking impact |
| Mock / fixture | future deterministic TEST_ONLY evidence | production truth |

## 8. Frozen Isolation Requirements

### 8.1 Recommendation isolation

```text
APPOINTMENT_RECOMMENDATION_MATCHING_ROLE = NONE
INSTITUTION_VISIT_RECOMMENDATION_MATCHING_ROLE = NONE
VISIT_EVALUATION_RECOMMENDATION_MATCHING_ROLE = NONE
RECOMMENDATION_WRITE = FORBIDDEN
RECOMMENDATION_RERANK = FORBIDDEN
```

Appointment/Visit status、Evaluation、contact intent 和 Consultant interaction 均不得改变 Safety、Eligibility、Exactness、
PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` 或 recommendation ordering。

### 8.2 Institution isolation

- Appointment/Visit 绑定某个 canonical Institution revision，但不修改该 revision；
- user intent、visit status 与 VisitEvaluation observation 都不是 Institution verified fact；
- unknown/unverified/expired Institution data 不得因预约或带看被补造为 verified；
- historical/suspended/archived revision 的创建禁令继续服从现有 Institution Contract。

### 8.3 AI isolation

- AI/FAQ 只可解释 approved process information；
- AI 不创建、确认、修改或取消 Appointment/Visit；
- AI 不推断 status，不提交 VisitEvaluation，不读取 User.phone；
- C1 不改变 B4–B7 AI Contract/Foundation/UI/FAQ semantics。

## 9. Mandatory C1 Contract Gates

### GATE 1 — PHASE_TRANSITION

- B7 保持 `PASS / COMPLETE`；
- C1 是 authoritative current phase；
- C1 不进入 production implementation。

### GATE 2 — OWNER_DECISION_CAPTURE

- exact anonymous-intent / authenticated-persistence boundary 已由 owner 明确批准；
- Product Source 未唯一决定的 identity/auth/submission 行为不得由 Contract author 猜测；
- 所有 blocking decisions 以最小、可审计方式记录。

### GATE 3 — OBJECT_AND_IDENTITY_MODEL

- Appointment intent/request、InstitutionVisit 与 future VisitEvaluation 的关系清晰；
- `institutionId + institutionRecordRevision`、`visitId`、User/Elder/Consultant identity 归属明确；
- old scaffold/type 不覆盖 versioned Contract。

### GATE 4 — SUBMISSION_TRUTH

- `SUBMITTED != CONFIRMED` 明确；
- request acceptance、operational confirmation、schedule 与 completion 不互相冒充；
- success/failure/public-safe result 稳定。

### GATE 5 — VISIT_LIFECYCLE

- 仅正式五状态及合法 transition 被定义；
- Backend/authorized Operations 是 operational state truth owner；
- Page/time inference = forbidden。

### GATE 6 — IDENTITY_AUTH_PERMISSION

- anonymous、authenticated、operations 的合法动作矩阵明确；
- formal persistence/history/access ownership 清晰；
- 未授权状态 fail closed。

### GATE 7 — PHONE_PRIVACY

- User.phone 只用于明确预约/联系目的；
- Consultant/Institution phone 与 User.phone 隔离；
- context、route、log、Mock 与 public result 不泄露 private phone。

### GATE 8 — BACKEND_PERSISTENCE_OWNERSHIP

- Domain/Application/Backend/Page ownership 清晰；
- idempotency、duplicate submission、retry 与 persistence truth 边界明确；
- C1 不冻结 provider-specific endpoint、DTO、DB 或 auth implementation。

### GATE 9 — CONSULTANT_CONTACT_ISOLATION

- Consultant assignment/contact 继续复用既有 Contract；
- Appointment/Visit 不复制 resolver；
- platform Consultant contact 不成为 Institution official contact。

### GATE 10 — VISIT_EVALUATION_PREREQUISITE

- real `visitId + completed` 是 future Evaluation 的硬前置；
- `USER_REPORTED_DATA`、no Institution write、no Recommendation role 保持冻结；
- C1 不提前实现完整 Evaluation Contract。

### GATE 11 — CROSS_DOMAIN_ISOLATION

- Recommendation、Institution、ElderProfile、Consultant、AI 的 write/matching/ownership 边界明确；
- Appointment/Visit 不产生 verified Institution fact 或 Recommendation signal。

### GATE 12 — MOCK_PROVENANCE

- future fixture 仅 TEST_ONLY；
- fake phone/identity/status/Visit/Evaluation 不进入 production truth；
- no synthetic completed Visit unlocks production evaluation。

### GATE 13 — DOWNSTREAM_IMPLEMENTATION_BOUNDARY

- future Domain/Application/Backend foundation 的 scope、ownership、mandatory automated Gates 与 completion dependency 可从 Contract 唯一推出；
- UI、Backend、VisitEvaluation successor 未被 C1 偷跑。

### GATE 14 — CROSS_DOCUMENT_QA

- 与 Current Product Source、Institution/Consultant/AI Frozen boundaries、Frontend/Mock policies 一致；
- 独立 diff-driven QA 无 blocking finding；
- 新 Contract 按 governance 注册，普通 phase handoff 不误注册为业务 Contract。

### GATE 15 — PRODUCTION_ISOLATION

```text
PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
MOCK_DATA_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 10. Evidence Strategy

C1 是 Contract Freeze。mandatory evidence 仅包括：

- document governance；
- owner decision capture；
- Product Source consistency；
- object/state/identity/permission boundary review；
- cross-document isolation review；
- independent diff-driven Contract QA。

```text
RUNTIME_TESTS = NOT_REQUIRED
DEVTOOLS = NOT_REQUIRED
ANDROID = NOT_REQUIRED
FULL_REPOSITORY_TESTS = NOT_REQUIRED
```

未来 Foundation/Backend/UI phase 必须按实际 changed layer 重新定义 runtime、API、compatibility、DevTools 与 real-device
evidence；C1 文档 evidence 不得冒充实现 evidence。

## 11. PASS / BLOCKED Conditions

### PASS

只有以下全部成立才允许：

```text
PHASE_V1_2_C1 = PASS
APPOINTMENT_INSTITUTION_VISIT_CONTRACT = FROZEN
BLOCKERS = 0
READY_FOR_C1_SUCCESSOR = TRUE
```

- 15 项 mandatory Contract Gates 全部 PASS；
- owner decisions、identity、state、permission、phone、Backend/persistence ownership 均明确；
- future implementation 不需要 Page/Backend 自行发明业务规则；
- B1–B7、Recommendation、Institution 与 AI Frozen semantics 保持不变；
- production/runtime/test code change = 0。

### BLOCKED

以下任一情况必须 `PHASE_V1_2_C1 = BLOCKED`：

- anonymous intent 与 authenticated persistence 无法唯一冻结；
- User.phone 获取目的、authority 或 ownership 需要未决产品选择；
- Appointment request 与 InstitutionVisit identity/state 无法一致定义；
- `SUBMITTED != CONFIRMED` 或 Visit status authority 存在冲突；
- future Evaluation 无法在不伪造 completed Visit 的情况下定义前置边界；
- 必须修改现有 Frozen Contract 或 Product Source 才能成立；
- 新 Contract 会改变 Recommendation 或 Institution verified semantics。

阻塞时只报告最小：

```text
OWNER_DECISION_REQUIRED
CONTRACT_CONFLICT
AFFECTED_SCOPE
MINIMAL_RESOLUTION
```

不得通过模糊 wording、scaffold 行为或 implementation convenience 掩盖。

## 12. Successor Boundary

C1 PASS 后才评估最小的 Appointment / InstitutionVisit Domain、Application 与 Backend Foundation；不得在本 handoff 中为其
命名、编号或实现。VisitEvaluation 继续等待真实 InstitutionVisit foundation 与 authoritative `completed` truth。

Self-owned AI Backend gateway 与 real provider/Secret integration 保持独立 deferred candidate，不属于 C1，也不因 C1 获得
实现授权。

## 13. Change Policy

- 本 handoff 是 phase boundary，不是 Appointment/Visit 业务 Contract；
- C1 必须新建 versioned Contract，不得把新语义塞入现有 Institution、Consultant、AI 或 Recommendation Contract；
- phase execution 不得修改 Product Source 以适配实现；
- frozen C1 Contract 的后续语义变化必须走 version bump/successor，不得静默修改；
- 本 handoff 的 future/owner-decision wording 不构成未经批准的产品行为。

## 14. Definition Result

```text
POST_B7_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C1
NEXT_PHASE_NAME = Appointment & InstitutionVisit Contract Freeze
NEXT_PHASE_TYPE = CONTRACT_FREEZE
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C1 = NOT_STARTED
READY_TO_START_NEXT_PHASE = TRUE
PRODUCT_DECISIONS = CLOSED_FOR_SUCCESSOR_SELECTION
BLOCKERS = 0

PHASE_V1_2_B7 = PASS / UNCHANGED
B7_IMPLEMENTATION = COMPLETE / UNCHANGED
AI_CONSULTATION_CONTRACT = FROZEN / UNCHANGED

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 15. Final Contract Freeze Result — 2026-09-17

本节记录 C1 Contract Freeze 的当前最终生命周期结果。第 14 节的 `PHASE_V1_2_C1 = NOT_STARTED` 仅为 successor
definition 当时的历史快照，不是当前 phase marker。本结果不授权任何 runtime、UI、Backend、DB、API、auth 或
VisitEvaluation implementation。

项目负责人在 C1 执行期间正式关闭了唯一 remaining decision：formal server submission 必须同时具备合法
`contactName` 与 purpose-bound User.phone；缺失或拒绝任一项时不得创建 server record，必须保留 local draft。

```text
PHASE_V1_2_C1 = PASS
C1_CONTRACT = FROZEN
CONTRACT_ID = appointment-institution-visit-contract-v1
MANDATORY_GATES = 15/15 PASS

OWNER_DECISION = CLOSED
CONTACT_NAME_REQUIRED = TRUE
PURPOSE_BOUND_PHONE_REQUIRED = TRUE
ANONYMOUS_FORM_ENTRY = ALLOWED
ANONYMOUS_LOCAL_DRAFT = ALLOWED
SERVER_PERSISTENCE_REQUIRES_AUTH = TRUE
USER_PHONE_IS_ACCOUNT_IDENTITY = FALSE

IDENTITY_BOUNDARY = FROZEN
ANONYMOUS_DRAFT_BOUNDARY = FROZEN
AUTHENTICATED_PERSISTENCE_BOUNDARY = FROZEN
PHONE_PRIVACY_BOUNDARY = FROZEN
SUBMISSION_TRUTH = SUBMITTED_NOT_CONFIRMED
VISIT_LIFECYCLE = FROZEN
STATUS_AUTHORITY = BACKEND_OPERATIONS
IDEMPOTENCY_BOUNDARY = FROZEN
VISIT_EVALUATION_PREREQUISITE = REAL_VISIT_ID + COMPLETED

PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C1_SUCCESSOR = TRUE

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
MOCK_DATA_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```
