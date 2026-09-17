# Phase V1.2-C2 Implementation Handoff — Appointment & InstitutionVisit Domain/Application Foundation

状态：`FROZEN_PHASE_V1_2_C2_DEFINITION`

冻结日期：`2026-09-17`

```text
POST_C1_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C2
NEXT_PHASE_NAME = Appointment & InstitutionVisit Domain/Application Foundation
NEXT_PHASE_TYPE = DOMAIN_APPLICATION_FOUNDATION_IMPLEMENTATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
C2_PHASE_DEFINITION = PASS
C2_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C2 = NOT_STARTED
PRE_C2_DEFINITION_HEAD = 1c034bdddee947513ac69031552fba38ad710b50
PHASE_V1_2_C1 = PASS
C1_CONTRACT = FROZEN
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_TO_START_NEXT_PHASE = TRUE
READY_TO_START_V1_2_C2 = TRUE
```

本文冻结 C1 之后唯一获准立即实施的最小 Foundation slice。C2 只把 Frozen Appointment / InstitutionVisit Contract
落成确定性、可测试的 Domain/Application runtime boundary；不实现真实登录、Backend、API、DB、持久化、Page、手机号
授权、运营状态写入或 VisitEvaluation。

## 1. Successor Decision

### 1.1 Candidate review

| Candidate | Decision | Current fact and dependency |
|---|---|---|
| Appointment / InstitutionVisit Domain + Application Foundation | `READY` | C1 已冻结对象、identity、submission、result、lifecycle、idempotency、permission 与 privacy，可在无真实 Backend 时通过纯函数、ports 和 test-only doubles 独立验收 |
| Authenticated identity / auth implementation | `REQUIRES_PREREQUISITE` | C1 只冻结 trusted principal 语义；仓库尚无正式 auth/session provider。C2 只定义消费边界，不实现登录或身份协议 |
| Backend persistence / API foundation | `REQUIRES_PREREQUISITE` | `server/` 仍为占位，需先有稳定 Domain/Application command、result 与 ports；C2 不冻结 endpoint、DTO、DB 或 transaction technology |
| Appointment Page integration | `REQUIRES_PREREQUISITE` | 当前 create/success 页面为 honest scaffold；需等待 C2、auth handoff、purpose-bound phone flow 与真实 submit adapter |
| “我的预约” read path | `DEFERRED` | 属于后续用户历史能力，且依赖 authenticated owner read、真实 persisted Visit 与 Backend permission filter |
| Visit operational status foundation | `REQUIRES_PREREQUISITE` | C2 实现纯状态模型与 transition legality；真实状态 mutation/audit/source 必须等待 Backend/Operations |
| VisitEvaluation | `DEFERRED` | 必须等待真实 server-generated `visitId` 与 authoritative `completed` |

### 1.2 Dependency order

```text
C1 Frozen Appointment & InstitutionVisit Contract
  -> C2 Domain/Application Foundation
  -> authenticated identity adapter + Backend persistence/API foundation
  -> Appointment submit Page integration + purpose-bound phone authorization
  -> authenticated owner read / “我的预约” integration
  -> Backend/Operations lifecycle mutation
  -> VisitEvaluation Contract/Foundation/UI
```

### 1.3 Why C2 is the immediate successor

C2 是当前唯一同时满足以下条件的最小切片：

- 直接消费 C1 Frozen Contract，不新增产品语义；
- 不依赖真实 login、User.phone provider、Backend、DB 或运营人员；
- 不创建假 `visitId`、假 server record、假提交成功或假状态；
- 为 future Backend、auth adapter、Page、owner read 与 VisitEvaluation 提供同一稳定代码边界；
- 可通过 deterministic targeted runtime、compatibility 与 isolation evidence 独立验收。

不存在新的 Owner Decision。真实 auth protocol、API/DB 技术与运营系统选择属于后续 implementation decision，不改变 C1
业务结果，因此不阻塞 C2。

## 2. Authority and Source Order

C2 implementation 依次遵守：

1. Current V1.2 Product Source；
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`；
3. applicable Institution、Consultant、AI、Recommendation Frozen isolation boundary；
4. `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
5. 本 C2 implementation handoff；
6. current scaffold/code 仅作为现状证据，不得覆盖上述来源。

`miniprogram/types/domain.ts` 的 legacy `Appointment` interface 不是 C2 Source of Truth。它包含 `draft/submitted/confirmed/unknown`
等非 C1 lifecycle 状态；C2 不得把它重新包装成 authoritative `InstitutionVisitV1`。

若实现无法同时满足 C1 Contract 与本 handoff，必须停止并报告 `CONTRACT_GAP`；不得修改 Frozen Contract 或 Product Source
来迁就代码。

## 3. Goal

C2 的唯一目标是建立稳定、versioned、provider-neutral 的 Appointment / InstitutionVisit Foundation，使后续能力可以共享：

- `AppointmentLocalDraftV1`、`AppointmentSubmissionV1`、submission receipt/result；
- `InstitutionVisitV1` 与 exact five-state lifecycle；
- pure exact-shape validation、normalization、transition legality 与 idempotency comparison；
- explicit authenticated-principal、submission、owner-read port roles；
- public-safe Application result/snapshot 与 raw provider/auth/persistence firewall；
- fail-closed auth、contact、Institution revision、Elder authorization 与 provider failure mapping；
- deterministic test-only fixtures and targeted runtime evidence。

C2 不声称已有真实预约能力。没有真实 adapter 时，production wiring 必须保持 unavailable/auth-required 等合法非成功边界，
不得产生 accepted receipt 或 persisted Visit。

## 4. Preconditions

C2 implementation 开始前必须保持：

- `PHASE_V1_2_C1 = PASS`；
- `C1_CONTRACT = FROZEN`；
- C1 Owner Decision、identity、phone、submission truth、five-state lifecycle 与 idempotency 语义 unchanged；
- current `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md` 有效；
- 无需等待真实 auth、Backend、API、DB、phone provider、Page 或 Operations system；
- 所有非 C2 working-tree change 保持隔离。

## 5. In Scope

未来 C2 implementation 只允许覆盖：

1. C1-backed versioned runtime types for local draft、submission command、receipt/result、Visit aggregate、status and public snapshot；
2. exact-shape validators and non-semantic normalization；
3. local-draft provenance、field allowlist 与 retain/clear outcome primitives，但不实现 storage；
4. formal submission required-field validation；
5. authenticated-principal input boundary and auth-required fail-closed result；
6. exact `institutionId + institutionRecordRevision`、authorized `elderId` 与 optional authoritative `consultantId` boundaries；
7. purpose-bound contact name/phone validation boundary without phone-as-identity；
8. canonical business payload projection and idempotency-key validation/comparison；
9. exact five-state lifecycle representation and pure legal-transition evaluator；
10. stable public-safe submission result/receipt and owner-visible Visit snapshot projection；
11. protocol-neutral injected port roles for authenticated principal、submit/persistence candidate and owner read/list；
12. untrusted port outcome validation and raw auth/provider/DB error firewall；
13. safe unavailable、auth-required、contact-required、validation、conflict and technical failure mapping；
14. deterministic TEST_ONLY synthetic fixtures and import/isolation checks；
15. targeted TypeScript/generated-JS compatibility and risk-based QA。

Port/interface names and internal file count may follow repository conventions. Their semantic roles are frozen; REST path、HTTP verb、wire DTO、
DB schema、auth token and deployment topology are not。

## 6. Out of Scope

C2 does not implement：

- `wx.login`、session、account registration、auth provider or identity persistence；
- `getPhoneNumber`、phone consent UI/provider or real User.phone；
- `server/**` application、REST/RPC endpoint、DB、ORM、migration、transaction or production persistence；
- real submission、real `visitId`、real owner history or any operational status write；
- Appointment create/success/index Page、ViewModel、WXML、Less、navigation or interaction；
- local storage adapter such as `wx.setStorage`；
- “我的预约” UI/read integration；
- Consultant/Operations status mutation、cancellation workflow or audit console；
- VisitEvaluation Contract/Foundation/Page；
- legacy Appointment migration or repository-wide refactor；
- production Institution/Elder/User/Consultant/phone/Visit data；
- Recommendation、Institution、ElderProfile、Consultant or AI semantic change；
- any Frozen Contract or Product Source change。

If implementation requires these capabilities, report `C2_SCOPE_EXPANSION_DETECTED` and stop rather than silently broadening C2。

## 7. Object and Identity Boundary

The Foundation must preserve exactly three roles：

```text
AppointmentLocalDraftV1
AppointmentSubmissionV1 command + receipt/result
InstitutionVisitV1 authoritative aggregate representation
```

Required separations：

- `localDraftId != idempotencyKey != visitId != userId`；
- User.phone is contact data, never identity or ownership proof；
- Institution name/list index is not canonical identity；
- Page state and submission receipt are not Visit status evidence；
- no second persisted Appointment aggregate or lifecycle；
- no client-generated/reserved/inferred `visitId`。

C2 types represent `InstitutionVisitV1` but cannot instantiate production truth. Only a future Backend adapter may return a candidate persisted Visit,
which Application must validate before public projection。

## 8. Domain Ownership

Pure Domain Foundation owns：

- exact object/status/result shape legality；
- required semantic-field validation；
- canonical payload projection for comparison；
- idempotency replay/conflict classification from explicit inputs；
- lifecycle transition legality and terminal-state rules；
- identity non-substitution rules；
- pure public projection primitives。

Domain must not depend on Page、Store、Service、Mock、network、storage、`wx.*`、clock、random、Backend SDK or environment state。
It does not authorize principal、resolve Elder/Institution/Consultant、persist records or mutate status。

## 9. Application and Port Ownership

### 9.1 Application

Application Foundation owns：

- orchestration of already-explicit draft/submission input；
- invoking injected authenticated-principal and Visit ports；
- retaining draft semantics on every non-accepted outcome；
- validating every untrusted port outcome before projection；
- stable auth/contact/validation/idempotency/service/technical result mapping；
- outputting only public-safe Application result/snapshot。

Application must not invent authenticated identity、Elder authorization、Institution eligibility、consultant assignment、`visitId` or status。

### 9.2 Authenticated-principal boundary

C2 may define a protocol-neutral port/result proving only whether a trusted authenticated principal is available to the current operation。

- principal identity comes from the injected trusted boundary, never command body、route、phone or draft；
- missing/unavailable/failed auth maps to stable non-success and zero persistence candidate；
- C2 does not define WeChat login、token、session、account linking or auth API；
- test principal is TEST_ONLY and cannot enter production wiring。

### 9.3 Submission/persistence boundary

C2 may define a neutral submission port whose accepted candidate is still untrusted until Application validation。It must not contain transport、DB
or provider details。Only a valid accepted candidate may carry server-generated `visitId` and authoritative initial `requested` status。

No production adapter is required or authorized in C2。Provider absence/failure must fail closed; it must never become fake accepted success。

### 9.4 Owner read/list boundary

C2 may define only the stable authenticated-owner port/result and public-safe Visit snapshot needed by future consumers。It does not implement
the “我的预约” query, API, Page or stored records。A phone、route ID、local draft ID or knowledge of `visitId` never proves read authorization。

### 9.5 Page boundary

Future Page/ViewModel may consume only C2 public-safe Application results。It will own presentation、form interaction、auth/phone action and local
storage interaction, but must not reimplement validation、identity、idempotency、status inference or persistence truth。C2 changes no Page。

### 9.6 Backend/Operations boundary

Future Backend owns authenticated authorization、atomic persistence、visitId、idempotency enforcement、owner read filtering、private contact
protection and lifecycle truth。Authorized Consultant/Operations owns real status commands。C2 only supplies stable Domain/Application semantics;
it does not freeze the Backend technology or implement operations。

## 10. Local Draft and Formal Submission

Local draft Foundation must：

- preserve explicit `LOCAL_DRAFT_ONLY` provenance；
- carry no `visitId` or operational status；
- remain outside owner history；
- never project submitted/requested/contacting/scheduled/completed/cancelled；
- preserve user input on auth/contact/validation/network/service failure unless user explicitly clears it；
- never auto-submit after auth success or reload。

Formal submission validation must require all C1 fields and must fail closed on missing auth、authorized Elder、eligible exact Institution revision、
contactName、purpose-bound phone、intent field or idempotency key。Failure creates no accepted receipt and Application result must retain draft semantics。

## 11. Submission Truth and Lifecycle

```text
LOCAL_DRAFT != SUBMITTED_REQUEST
SUBMITTED_REQUEST != CONFIRMED_VISIT
REQUESTED != CONTACTING
REQUESTED != SCHEDULED
SCHEDULED != COMPLETED
```

Only a validated accepted persistence candidate may project an accepted receipt with the same server-generated `visitId` and initial `requested`。
All non-success variants carry no new Visit identity and no success wording。

The Domain status set is exactly：

```text
requested
contacting
scheduled
completed
cancelled
```

C2 implements the C1 transition matrix as a pure evaluator。It does not execute a transition or infer truth from clock、Page、route、user statement
or fixture。`completed` and `cancelled` remain terminal in V1。

## 12. Idempotency Boundary

C2 must deterministically validate/classify explicit inputs using：

```text
trusted authenticated owner identity
+ opaque idempotencyKey
+ canonical normalized business payload
```

- same owner/key/payload accepted replay maps to the same candidate receipt/visit identity；
- same owner/key with changed material payload is conflict；
- different key remains a distinct attempt；C2 invents no cross-key semantic dedupe；
- key generation、TTL、storage、index and transaction enforcement are future adapter/Backend responsibilities；
- canonical comparison must not leak phone/name/payload fingerprint into public result、logs or fixture output。

## 13. Privacy and Cross-Domain Isolation

- contactName/User.phone are private, purpose-bound Appointment/Consultant contact data only；
- public result/snapshot must not expose raw phone、private note、auth token、DB locator、stack or provider metadata；
- Institution official phone and Consultant phone are never User.phone fallback；
- Institution record is read by exact immutable revision identity and never mutated/upgraded；
- authorized Elder is referenced, not created or rewritten；
- Consultant assignment/contact logic is not copied；
- Recommendation recompute/rerank/write/matching role remains zero/none；
- AI creates or mutates no Appointment/Visit；
- VisitEvaluation remains locked without real `visitId + authoritative completed`；
- fixture/synthetic result never becomes production truth。

## 14. Mock and Production Isolation

Allowed evidence may use deterministic synthetic cases only with explicit `TEST_ONLY_SYNTHETIC` provenance。Fixtures may cover valid/invalid drafts、
submissions、auth results、port candidates、replay/conflict、all statuses/transitions and failures。

Fixtures and doubles must not：

- enter the `miniprogram/**` production dependency graph；
- contain real phone、identity or Institution/Visit facts；
- generate a production `visitId` or owner history；
- unlock VisitEvaluation；
- be presented as a production auth/Backend/persistence adapter。

Production adapter count may remain zero in C2。That is correct Foundation behavior, not a reason to wire synthetic success。

## 15. Mandatory C2 Implementation Gates

All gates below are mandatory for future implementation；this definition task does not execute them。

### GATE 1 — CONTRACT_CONFORMANCE

C1 Contract and all existing Frozen semantics remain unchanged；no new object、status、permission、phone purpose or side effect。

### GATE 2 — OBJECT_IDENTITY_MODEL

Three object roles and all non-substitution rules have versioned exact-shape representation；legacy Appointment is not authoritative。

### GATE 3 — LOCAL_DRAFT_BOUNDARY

Anonymous/authenticated local draft validation、provenance、retention and no-server-truth behavior are deterministic；storage is not implemented。

### GATE 4 — SUBMISSION_VALIDATION

All formal required fields and canonical identities are validated fail-closed；invalid/missing input cannot reach accepted path。

### GATE 5 — AUTH_IDENTITY_PERMISSION_BOUNDARY

Trusted-principal input is injected and never derived from phone/route/draft；missing/failed auth creates zero Visit and maps stable non-success。

### GATE 6 — SUBMISSION_TRUTH_PUBLIC_RESULT

Accepted/requested remains distinct from confirmed/scheduled/completed；only validated accepted candidate carries `visitId`；public result leaks no raw error。

### GATE 7 — VISIT_LIFECYCLE_RULES

Exact five states、C1 transition matrix、terminal states and no Page/time inference have deterministic coverage。

### GATE 8 — IDEMPOTENCY

Canonical payload、same-key replay、changed-payload conflict、uncertain retry and PII-safe comparison behavior match C1。

### GATE 9 — CANONICAL_REFERENCE_ISOLATION

Exact Institution revision、authorized Elder、optional authoritative Consultant and server-only visit identity boundaries are enforced without mutation/fallback。

### GATE 10 — PHONE_PRIVACY

Contact name/phone requiredness、purpose limitation、non-identity、no fallback and public/log/fixture redaction all PASS。

### GATE 11 — PORT_AND_RAW_FIREWALL

Auth/submit/owner-read ports are protocol-neutral；raw auth/provider/DB/internal fields cannot enter public result；malformed candidate fails closed。

### GATE 12 — OWNER_READ_STATUS_PROJECTION

Public-safe Visit snapshot preserves authoritative status and exact identity while excluding private/internal data；no real read path or status mutation is claimed。

### GATE 13 — CROSS_DOMAIN_ISOLATION

Recommendation、Institution、ElderProfile、Consultant、AI and VisitEvaluation writes/semantic changes remain zero；real evaluation unlock remains impossible。

### GATE 14 — MOCK_PRODUCTION_ISOLATION

Production fixture import count、real adapter count、real Visit creation and fake success count are zero；all synthetic cases retain test provenance。

### GATE 15 — DETERMINISM_RUNTIME

Targeted fixtures cover all objects、required-field failures、result variants、five statuses/transitions、idempotency、ports/raw firewall、privacy and negative isolation；
same explicit input produces deep-equal output。

### GATE 16 — WECHAT_COMPATIBILITY

Because Foundation is expected under `miniprogram/**`, targeted TypeScript compile and generated-JS compatibility are mandatory；no Node-only API、unsupported
runtime syntax、network/auth SDK or Page interaction is introduced。

### GATE 17 — TARGETED_QA

Independent diff-driven QA checks C1 conformance、fail-closed negatives、anti-green fixtures、privacy、raw firewall、legacy-type avoidance、scope expansion and
actual changed dependencies。No full repository QA by default。

## 16. Evidence Strategy

Future C2 completion evidence must report separately：

```text
TARGETED_DOMAIN_APPLICATION_RUNTIME = MANDATORY
TARGETED_WECHAT_TYPESCRIPT_COMPATIBILITY = MANDATORY
TARGETED_GENERATED_JS_COMPATIBILITY = MANDATORY
TARGETED_QA = MANDATORY
FRESH_DEVTOOLS = NOT_MANDATORY
ANDROID_REAL_DEVICE = NOT_MANDATORY
FULL_REPOSITORY_TESTS = NOT_REQUIRED
```

C2 has no Page、ViewModel、WXML、Less、navigation、`wx.*` user action or user-visible behavior。If implementation touches those, the DevTools/Android exemption
is invalid and implementation must stop with `C2_SCOPE_EXPANSION_DETECTED` rather than silently adding UI Gates。

## 17. PASS / PASS_WITH_RISKS / BLOCKED

### 17.1 PASS

Only when all 17 mandatory Gates pass may future implementation report：

```text
PHASE_V1_2_C2 = PASS
C2_IMPLEMENTATION = COMPLETE
MANDATORY_GATES = 17/17 PASS
BLOCKERS = 0
READY_FOR_C2_SUCCESSOR = TRUE
```

Missing real auth、Backend、API、DB、phone provider、Page、owner history、Operations console or VisitEvaluation is not a C2 blocker because each is out of scope。

### 17.2 PASS_WITH_RISKS

May be used only when all mandatory Gates pass and a real, non-blocking Foundation maintenance/integration risk remains。It must not hide a failed runtime、
compatibility、privacy、isolation or QA Gate。

### 17.3 BLOCKED

C2 must be blocked if：

- implementation requires changing C1 or another Frozen Contract；
- accepted success/Visit identity cannot be prevented without a real Backend；
- phone/route/draft is used as account identity；
- legacy Appointment lifecycle becomes authoritative；
- malformed port output or raw error leaks into public result；
- fake/synthetic auth、Visit、status or history enters production graph；
- Recommendation/Institution/ElderProfile/Consultant/AI/Evaluation isolation is broken；
- any mandatory runtime/compatibility/QA Gate fails；
- real auth/Backend/UI/status mutation is required to finish the claimed scope。

Report `BLOCKER / ROOT_CAUSE / AFFECTED_SCOPE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`。

## 18. Deferred Capabilities

The following remain explicitly deferred after C2 definition：

- WeChat/login/account/auth implementation；
- purpose-bound phone authorization provider/UI；
- self-owned Backend Visit service、API、DB、persistence and transaction enforcement；
- production Institution/Elder/Consultant resolution adapters；
- Appointment create/success Page integration；
- authenticated “我的预约” read integration；
- Consultant/Operations lifecycle mutation；
- VisitEvaluation Contract/Foundation/UI。

C2 PASS authorizes successor discovery only。It does not preselect whether auth/Backend or another prerequisite is the next phase。

## 19. Definition Result

```text
POST_C1_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C2
NEXT_PHASE_NAME = Appointment & InstitutionVisit Domain/Application Foundation
NEXT_PHASE_TYPE = DOMAIN_APPLICATION_FOUNDATION_IMPLEMENTATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN

C2_PHASE_DEFINITION = PASS
C2_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C2 = NOT_STARTED

READY_TO_START_NEXT_PHASE = TRUE
READY_TO_START_V1_2_C2 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C1 = PASS / UNCHANGED
C1_CONTRACT = FROZEN / UNCHANGED

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 20. Change Policy

- This handoff freezes only C2 implementation scope、ownership、Gates and completion rules；
- it creates no new business Contract and changes no C1 semantic；
- additive internal organization is allowed only when public/application semantics remain unchanged；
- auth protocol、wire API、DB schema、phone provider、Page behavior and Operations workflow require their own authorized successor；
- implementation convenience may not broaden C2 or convert a port/test double into production truth。
