# Phase V1.2-C3 Handoff — Authenticated Visit Submission & Persistence Boundary Contract Freeze

状态：`FROZEN_PHASE_V1_2_C3_DEFINITION`

冻结日期：`2026-09-17`

```text
POST_C2_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C3
NEXT_PHASE_NAME = Authenticated Visit Submission & Persistence Boundary Contract Freeze
NEXT_PHASE_TYPE = CONTRACT_FREEZE
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C3 = NOT_STARTED
READY_TO_START_V1_2_C3 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C1 = PASS / UNCHANGED
C1_CONTRACT = FROZEN / UNCHANGED
PHASE_V1_2_C2 = PASS / UNCHANGED
C2_IMPLEMENTATION = COMPLETE / UNCHANGED
```

本文冻结 C2 之后唯一获准立即开展的最小阶段。C3 只创建 versioned authenticated submission / persistence
boundary Contract；不实现登录、手机号授权、Backend、API、数据库、Page、真实 Visit、owner read 或运营状态变更。

## 1. Successor Decision

### 1.1 Candidate review

| Candidate | Decision | Current fact and dependency |
|---|---|---|
| C2 Appointment / InstitutionVisit Domain/Application Foundation | `ALREADY_SATISFIED` | versioned objects、validation、lifecycle、idempotency、public result and protocol-neutral ports 已完成并通过 17/17 Gates |
| Trusted authenticated identity adapter | `REQUIRES_NEW_CONTRACT` | C2 只有 trusted-principal port；真实 adapter 仍缺 session evidence、Backend validation、freshness and failure boundary |
| Auth/session foundation | `REQUIRES_NEW_CONTRACT` | C1 只冻结 persistence requires auth and phone is not identity；未冻结 login/session/account provider protocol |
| Backend persistence/API foundation | `REQUIRES_PREREQUISITE` | `server/` 仍为 placeholder；必须先冻结 identity proof、wire command/result、transaction and migration boundary |
| Atomic InstitutionVisit creation + authoritative visitId | `REQUIRES_PREREQUISITE` | 依赖 trusted principal、canonical reference authorization、idempotency storage and atomic persistence |
| Purpose-bound User.phone acquisition | `REQUIRES_NEW_CONTRACT` | purpose and non-identity 已冻结；authorization evidence、provider handoff and server validation 尚未冻结 |
| Appointment Page integration | `DEFERRED` | create/success remain honest scaffolds；formal flow requires auth、phone evidence and real accepted persistence receipt |
| Authenticated owner-read / 我的预约 | `DEFERRED` | requires persisted Visit、trusted owner identity and permission-filtered query；不属于首个 write slice |
| Backend/Operations lifecycle mutation | `DEFERRED` | requires persisted Visit、authorized actor command、audit and authoritative status mutation boundary |
| VisitEvaluation | `DEFERRED` | requires real server-generated `visitId + authoritative completed` |

### 1.2 Dependency order

```text
C1 Frozen Contract
  ↓
C2 Domain/Application Foundation                       COMPLETE
  ↓
C3 authenticated submission / persistence Contract    ← immediate successor
  ↓
trusted auth/session + purpose-bound phone adapters
  ↓
Backend atomic requested-Visit persistence/API
  ↓
Appointment Page submission integration
  ↓
authenticated owner-read / 我的预约
  ↓
authorized Operations lifecycle mutation
  ↓
VisitEvaluation successor
```

### 1.3 Why C3 is immediate

C2 has completed every provider-neutral runtime rule that can be implemented without external truth. The next unresolved boundary is not another
Page mapping or another pure Domain layer: it is the trust boundary connecting a real authenticated principal and purpose-bound contact evidence to
an atomic Backend persistence receipt. Implementing any adapter before this boundary is frozen would require inventing identity、session、wire、transaction
or phone-provider semantics. C3 closes only that architecture gap and enables a later implementation phase without claiming real persistence.

No new product choice is required to authorize this Contract Freeze. Provider、framework、token format、database product and endpoint syntax remain
technical choices to be bounded by C3, not product behavior to be guessed by Page or runtime code.

## 2. Source of Truth

C3 must follow, in order：

1. `docs/product/README.md` and its two Current V1.2 Product Source PDFs；
2. `docs/architecture/APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`；
3. `docs/architecture/V1_2_C2_IMPLEMENTATION_HANDOFF.md` and validated C2 public ports/results；
4. CURRENT `FRONTEND_STRUCTURE.md` and `MOCK_DATA_POLICY.md`；
5. `server/README.md` as current implementation-state evidence only；
6. this phase handoff for C3 scope and completion gates。

C3 must not modify C1、C2、Product Source or any unrelated Frozen Contract to fit a preferred provider or framework.

## 3. Goal

C3 shall create and freeze one versioned Contract for the smallest real submission trust boundary：

```text
explicit Appointment submit intent
  + trusted authenticated principal evidence
  + purpose-bound contact authorization evidence
  + validated C2 AppointmentSubmissionV1
  ↓
self-owned Backend authorization and atomic persistence boundary
  ↓
authoritative InstitutionVisitV1(status=requested)
  + server-generated visitId
  + stable accepted/replay/non-success result
```

The Contract must be provider-neutral and implementation-ready. It must not itself create accounts、sessions、phone data、Visit records or API endpoints.

## 4. In Scope

C3 Contract Freeze must define：

1. trusted authenticated principal evidence and Backend-owned `userId` attribution；
2. anonymous local draft → explicit authenticated submission handoff；
3. auth/session ownership, validation, expiry/unavailable and fail-closed semantics without treating phone as identity；
4. purpose-bound contactName/User.phone acquisition authorization evidence and minimization；
5. versioned mapping between C2 `AppointmentSubmissionV1` / Application results and a Backend submission boundary；
6. exact Institution revision and Elder ownership/authorization resolution roles；
7. atomic create-or-replay transaction boundary for one authoritative `InstitutionVisitV1(status=requested)`；
8. server-only `visitId` and server timestamp authority；
9. persisted idempotency scope、replay、conflict and uncertain retry semantics；
10. stable public/client-safe accepted and non-success results plus raw error firewall；
11. persistence ownership、migration/version dispatch and rollback invariants without choosing physical schema；
12. private contact protection、logging/audit redaction and retention ownership；
13. mock/test-double provenance and production isolation；
14. downstream adapter ownership and implementation Gates。

## 5. Frozen Ownership Boundaries

### 5.1 Identity and auth

- Backend/auth service owns validation of authentication evidence and issuance/resolution of the trusted principal used for persistence；
- Mini Program input、route、draft、phone、idempotency key and client-supplied `userId` can never prove identity；
- login success alone does not submit a draft；the user must retain an explicit submit intent；
- C3 must not permanently bind the product to one identity vendor, token syntax or SDK；
- unavailable、expired、invalid or malformed auth evidence creates no Visit and returns a stable non-success result。

### 5.2 Application / Backend

- Application validates and minimizes the C2 command, invokes injected adapters and consumes only the stable Backend result；
- Backend owns authorization、canonical reference resolution、atomic transaction、idempotency enforcement、`visitId`、server timestamps and persisted truth；
- raw auth、transport、DB、provider and stack details never become C2/public/Page results；
- an accepted result exists only after committed create or authoritative idempotent replay。

### 5.3 Persistence and transaction

The future Contract must require one atomic boundary covering at minimum：

```text
trusted principal authorization
+ elder ownership/authorization
+ exact institution revision eligibility
+ purpose-bound contact evidence validation
+ idempotency lookup / conflict decision
+ create-or-replay one InstitutionVisit(status=requested)
+ durable visitId and acceptedAt
```

Failure before commit returns no accepted receipt and no new Visit identity. Transaction technology、table names、ORM and physical index remain future
implementation choices, but cannot weaken atomicity or replay semantics.

### 5.4 Phone

- contactName and User.phone remain required only for explicit Appointment/Consultant contact；
- User.phone remains private contact data, not identity、credential、ownership proof or idempotency scope；
- Consultant phone and Institution official phone are never fallback User.phone；
- phone authorization evidence must be verifiable and purpose-bound before persistence；
- raw phone must not enter route/query、logs、analytics、error payload、mock snapshot or public receipt。

### 5.5 Idempotency

- Backend owns durable idempotency enforcement scoped by trusted user + opaque key + canonical C2 payload；
- same committed input replays the same `visitId` and receipt；changed material payload under the same scope fails closed；
- uncertain network outcome retries the same key；client does not blind-submit a new key；
- idempotency records cannot replace authorization or expose private canonical payload/fingerprint。

### 5.6 Page and deferred consumers

Page remains a future consumer of C2 public-safe results. C3 changes no Page. Owner-read、Operations mutation and VisitEvaluation remain separate downstream
slices and cannot be smuggled into the first authenticated submit/persistence Contract.

## 6. Out of Scope

C3 must not implement or freeze as a concrete runtime choice：

- `wx.login`、session/account provider、token SDK or account-linking implementation；
- User.phone acquisition UI/provider implementation；
- Backend project、Controller、endpoint、HTTP/RPC transport、DB、ORM、migration or deployment；
- real user、phone、Institution、Elder、Appointment or Visit data；
- production auth、submission、persistence or owner-read adapters；
- Appointment create/success/index Page、ViewModel、WXML、Less or local storage；
- Operations console、status command implementation or notifications；
- VisitEvaluation Contract/runtime/UI；
- Recommendation、Institution、ElderProfile、Consultant、AI or Product Source changes。

## 7. Mock and Production Isolation

- Contract examples must use explicit non-production provenance and contain no real phone、identity or Institution/Visit facts；
- test auth/session、phone evidence、repository and Visit results must never be registered as production capability；
- absent real adapters must remain auth-required/service-unavailable, not synthetic accepted success；
- no example may generate a production-looking `visitId` or `completed` state that unlocks VisitEvaluation。

## 8. Mandatory C3 Contract Gates

All 15 gates are mandatory for C3 Contract Freeze：

### GATE 1 — PHASE_AND_SOURCE_CONFORMANCE

C1/C2 remain PASS and unchanged；Current Product Source and C1 owner decisions are preserved；C3 contains no runtime implementation.

### GATE 2 — TRUSTED_PRINCIPAL_IDENTITY

Backend-owned principal attribution is explicit；phone、route、draft、command `userId` or idempotency key cannot become identity.

### GATE 3 — AUTH_SESSION_OWNERSHIP

Client/Backend/auth ownership、validation、expiry/unavailable/failure and anonymous-to-auth handoff are defined without freezing a vendor.

### GATE 4 — PURPOSE_BOUND_CONTACT_EVIDENCE

Contact name/phone requiredness、authorization evidence、purpose、minimization、redaction and no-fallback rules conform to C1.

### GATE 5 — SUBMISSION_WIRE_BOUNDARY

C2 command/result mapping、version dispatch、raw firewall and public-safe failure taxonomy are explicit without inventing a second business model.

### GATE 6 — CANONICAL_REFERENCE_AUTHORIZATION

Exact Institution revision and Elder owner/authorization resolution roles fail closed and create no cross-domain mutation.

### GATE 7 — ATOMIC_PERSISTENCE

Create-or-replay transaction scope、commit truth and failure-before-commit behavior are explicit and protocol neutral.

### GATE 8 — SERVER_VISIT_ID_AND_TIMESTAMP_AUTHORITY

Only committed Backend persistence owns `visitId`、`acceptedAt` and initial `requested`; no client reservation or fake receipt is possible.

### GATE 9 — DURABLE_IDEMPOTENCY

Trusted-owner scope、canonical payload、same-key replay、conflict、uncertain retry and privacy are fully defined.

### GATE 10 — RESULT_AND_RAW_ERROR_FIREWALL

Accepted/replay/non-success outputs are stable and public safe；raw auth、phone provider、transport、DB and stack details cannot cross Application.

### GATE 11 — PRIVACY_AUDIT_RETENTION_OWNERSHIP

Private contact storage、access、logging/audit redaction、retention/deletion ownership and Secret exclusion are bounded without exposing implementation secrets.

### GATE 12 — NO_FAKE_PERSISTENCE_AND_MOCK_ISOLATION

Missing adapters remain unavailable；test doubles/examples cannot produce production truth、history or Evaluation eligibility.

### GATE 13 — DEFERRED_CAPABILITY_ISOLATION

Owner-read、Operations lifecycle mutation、Appointment Page and VisitEvaluation remain explicitly deferred and cannot expand C3.

### GATE 14 — CROSS_DOMAIN_ISOLATION

Recommendation、Institution verified facts/revision、ElderProfile、Consultant and AI semantics/writes remain unchanged.

### GATE 15 — DOWNSTREAM_BOUNDARY_AND_QA

The Contract defines the smallest lawful implementation successor、mandatory implementation evidence and independent diff-driven QA；document governance passes.

## 9. Evidence Strategy

C3 is a Contract Freeze phase：

```text
DOCUMENT_VALIDATION = MANDATORY
PRODUCT_SOURCE_CONSISTENCY = MANDATORY
C1_C2_CONFORMANCE = MANDATORY
IDENTITY_AUTH_PRIVACY_REVIEW = MANDATORY
PERSISTENCE_TRANSACTION_REVIEW = MANDATORY
INDEPENDENT_CONTRACT_QA = MANDATORY

RUNTIME_TESTS = NOT_REQUIRED / NOT_RUN
DEVTOOLS = NOT_REQUIRED / NOT_RUN
ANDROID = NOT_REQUIRED / NOT_RUN
FULL_REPOSITORY_TESTS = NOT_RUN
```

Future implementation Gates are to be frozen by the C3 Contract itself and must match the actual successor layer. Backend implementation evidence must not
be replaced by Mini Program simulator evidence, and a future Page phase must not use mocks as real persistence evidence.

## 10. PASS / PASS_WITH_RISKS / BLOCKED

### 10.1 PASS

Only when all 15 Contract Gates pass may C3 report：

```text
PHASE_V1_2_C3 = PASS
AUTHENTICATED_VISIT_PERSISTENCE_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C3_SUCCESSOR = TRUE
```

### 10.2 PASS_WITH_RISKS

May be used only when Contract semantics and all mandatory Gates pass, while a non-blocking implementation dependency remains. Missing Backend、DB、auth
provider、phone provider or Page is expected and is not itself a Contract Freeze blocker.

### 10.3 BLOCKED

C3 must stop and report the smallest `OWNER_DECISION_REQUIRED` or `CONTRACT_GAP` if：

- principal/account identity cannot be defined without treating phone as identity；
- anonymous server persistence or login-triggered auto-submit would be required；
- purpose-bound phone evidence cannot be separated from account identity；
- accepted success cannot be tied to atomic committed persistence；
- `visitId` or status must be client-generated/inferred；
- idempotency replay cannot preserve the same authoritative Visit；
- owner-read/Operations/Evaluation scope must be mixed into the first submit Contract；
- C1/C2 or another Frozen Contract would need semantic modification；
- any mandatory Contract Gate or independent QA fails。

## 11. Deferred Capabilities

After C3 definition, the following remain deferred until the C3 Contract is actually frozen and a successor explicitly authorizes them：

- trusted auth/session adapter implementation；
- purpose-bound phone provider implementation；
- Backend/API/DB/persistence implementation；
- real InstitutionVisit creation；
- Appointment Page integration；
- authenticated owner-read / 我的预约；
- Operations lifecycle mutation；
- VisitEvaluation。

## 12. Definition Result

```text
POST_C2_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C3
NEXT_PHASE_NAME = Authenticated Visit Submission & Persistence Boundary Contract Freeze
NEXT_PHASE_TYPE = CONTRACT_FREEZE
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C3 = NOT_STARTED

READY_TO_START_NEXT_PHASE = TRUE
READY_TO_START_V1_2_C3 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C2 = PASS / UNCHANGED
C2_IMPLEMENTATION = COMPLETE / UNCHANGED
PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 13. Change Policy

- This handoff freezes only C3 Contract scope、ownership、Gates and completion conditions；
- C3 must create a new versioned Contract rather than modifying C1；
- implementation choices remain replaceable unless the Contract requires an invariant；
- any future runtime、Backend or Page work requires a separately authorized successor after C3 PASS。
