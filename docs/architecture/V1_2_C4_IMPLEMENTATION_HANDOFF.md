# Phase V1.2-C4 Implementation Handoff — Authenticated Visit Submission Backend Foundation

状态：`FROZEN_PHASE_V1_2_C4_DEFINITION`

冻结日期：`2026-09-17`

```text
POST_C3_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C4
NEXT_PHASE_NAME = Authenticated Visit Submission Backend Foundation
NEXT_PHASE_TYPE = BACKEND_FOUNDATION_IMPLEMENTATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C4 = NOT_STARTED
READY_TO_START_V1_2_C4 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C3 = PASS / UNCHANGED
C3_CONTRACT = FROZEN / UNCHANGED
```

本文冻结 C3 之后唯一获准立即实施的最小 Backend slice。C4 建立 self-owned Backend submission foundation、真实 MySQL
repository/transaction、durable idempotency 与 server identity/time authority；auth、phone and canonical-reference dependencies remain injected
fail-closed ports until later real adapters are authorized. C4 does not implement Mini Program Page or claim production Appointment availability.

## 1. Successor Decision

### 1.1 Candidate review

| Candidate | Decision | Current fact and dependency |
|---|---|---|
| C2 client Domain/Application Foundation | `ALREADY_SATISFIED` | versioned objects、validation、public result and protocol-neutral ports 已完成 |
| C3 authenticated submission/persistence Contract | `ALREADY_SATISFIED` | trust、result、atomicity、idempotency and server authority 已 Frozen |
| Trusted auth/session adapter foundation | `READY` | C4 may implement Backend-owned port/orchestration and fail-closed resolution；concrete provider wiring remains deferred |
| Authenticated principal resolution | `READY` | C3 fixes evidence → trusted opaque userId boundary；test-only evidence can verify orchestration without becoming production identity |
| Concrete auth/session provider | `REQUIRES_PREREQUISITE` | requires authorized provider、Secret/config and deployment；C4 must not invent or silently register one |
| Purpose-bound phone evidence verifier foundation | `READY` | C4 may implement verifier port、purpose enforcement and stable result mapping |
| Concrete phone provider/authorization integration | `REQUIRES_PREREQUISITE` | requires provider/Secret/client authorization flow；raw evidence cannot be mocked in production |
| Backend submission API/Application foundation | `READY` | directly consumes C3 semantic command/result and owns raw firewall |
| Production MySQL repository foundation | `READY` | server is currently placeholder；C4 may bootstrap the planned Java/Spring/MySQL baseline and real transaction repository |
| Atomic create-or-replay persistence | `READY` | C3 completely freezes commit/replay/conflict semantics；requires real DB integration evidence |
| Durable idempotency store | `READY` | must be implemented in the same transaction-capable persistence slice；no Redis required in V1 |
| Server visitId/acceptedAt generation | `READY` | only repository transaction may generate/persist them；client values remain forbidden |
| Appointment Page integration | `DEFERRED` | requires production auth/phone/reference adapters and a stable Backend endpoint；C4 changes no Page |
| Authenticated owner-read / 我的预约 | `DEFERRED` | requires real persisted Visit and a separately authorized permission-filtered read slice |
| Operations lifecycle mutation | `DEFERRED` | requires role commands、audit and post-request state authority beyond initial requested |
| VisitEvaluation | `DEFERRED` | requires real `visitId + authoritative completed` |

### 1.2 Dependency order

```text
C3 Frozen Contract
  ↓
C4 Backend submission + MySQL persistence foundation       ← immediate successor
  ↓
real auth/session + phone evidence + reference adapters
  ↓
Mini Program Application transport adapter
  ↓
Appointment Page/local draft/submit/success integration
  ↓
authenticated owner-read / 我的预约
  ↓
Operations lifecycle mutation
  ↓
VisitEvaluation
```

### 1.3 Why C4 is immediate

C3 closes the semantic contract needed by a Backend implementation. A Page cannot legally submit or display success before committed persistence. A concrete
auth or phone provider cannot be selected from Product Source and provides no Visit value without a Backend consumer. A DB-only phase would lack the C3
Application/auth/contact firewall. C4 therefore implements the smallest coherent Backend foundation that can prove real transaction/idempotency behavior
while keeping every absent external provider fail closed.

The current repository assigns `server/**` to `backend_domain` and records a planned baseline of Spring Boot 3.x、Java 21 and MySQL 8.x, with no Redis by
default for V1. C4 may bootstrap that baseline. Exact patch versions、build tool、package names and deployment topology are implementation-local choices and
must not alter C3 semantics.

## 2. Source of Truth

C4 implementation must follow, in order：

1. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`；
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`；
3. C2 types/Domain/Application and `V1_2_C2_IMPLEMENTATION_HANDOFF.md`；
4. `V1_2_C3_PHASE_HANDOFF.md`；
5. Current Product Source；
6. CURRENT repository ownership、mock and security policies；
7. this C4 handoff for implementation scope and Gates。

`server/README.md` provides the repository's planned technical baseline, not alternative business semantics. C4 must not modify Frozen Contracts to fit
framework conventions.

## 3. Goal

C4 shall provide a real, testable Backend foundation for：

```text
untrusted versioned submission request
  ↓
auth evidence resolver port
+ purpose-bound contact evidence verifier port
+ Elder owner / exact Institution revision authorization ports
  ↓
Backend Application orchestration and raw firewall
  ↓
one real MySQL transaction:
  durable idempotency lookup
  + create-or-replay InstitutionVisit(status=requested)
  + server visitId / acceptedAt
  ↓
stable C3/C2 semantic result
```

In production configuration with any required real adapter absent, the only legal behavior is stable auth-required/unavailable/non-success. Test-only adapters
may exercise accepted/replayed paths against a real integration database but cannot be registered in production.

## 4. In Scope

C4 implementation may include only：

1. minimal self-owned `server/**` project bootstrap using the recorded Java 21 / Spring Boot 3.x / MySQL 8.x baseline；
2. server-side versioned authenticated Visit submission request/result representations matching C3；
3. strict untrusted request validation and client-forbidden authority fields；
4. trusted-principal resolver port and stable resolution outcome mapping；
5. purpose-bound contact evidence verifier port and stable outcome mapping；
6. Elder ownership/authorization and exact Institution revision eligibility ports；
7. Backend Application orchestration and raw provider/error firewall；
8. production MySQL schema/migration for authoritative initial Visit and durable idempotency records；
9. repository implementation with one atomic create-or-replay boundary；
10. same owner/key/payload replay and same owner/key/changed-payload conflict；
11. concurrent duplicate protection at database/transaction level；
12. server-only `visitId` and `acceptedAt` generation；
13. initial `status=requested` persistence only；
14. accepted/replayed/rejected/conflict/unavailable/technical semantic result mapping；
15. private contact storage protection、redacted logging and Secret/config isolation；
16. deterministic test-only adapters/fixtures and targeted Backend unit/integration/contract tests；
17. migration/schema validation and failure/recovery evidence。

## 5. Out of Scope

C4 must not implement：

- concrete WeChat login、session/account provider or client auth flow；
- production auth token issuance/refresh/account linking；
- concrete User.phone provider or Mini Program phone authorization UI；
- real Institution/Elder/Consultant production data adapters unless a later phase explicitly authorizes them；
- Mini Program transport adapter、Appointment create/success/index Page、ViewModel、WXML、Less or local draft storage；
- authenticated owner-read / 我的预约；
- Consultant/Operations `contacting/scheduled/completed/cancelled` mutation；
- notifications、calendar、CRM or Operations console；
- VisitEvaluation；
- Recommendation、Institution、ElderProfile、Consultant or AI writes/semantic changes；
- Redis、message queue、RAG or unrelated Backend infrastructure；
- production in-memory repository or test principal/contact evidence fallback。

## 6. Ownership and Dependency Boundaries

### 6.1 C3 and C2 ownership

- C3 owns trust、wire/result、transaction、idempotency、server authority and privacy semantics；
- C2 owns client-facing objects、validation、public result projection and protocol-neutral client ports；
- C4 implements the Backend side without modifying either semantic source；
- language-specific server DTO/entity types are adapters, not new business contracts。

### 6.2 Auth-principal boundary

- production request handling must call an injected Backend auth resolver；
- only an `authenticated` resolution carries trusted `userId`；
- missing/expired/invalid/unavailable/technical evidence creates zero Visit；
- client `userId`、phone、route、draft and idempotency key are never accepted as principal；
- C4 may implement the interface/orchestration and TEST_ONLY resolver only；no synthetic production principal registration。

### 6.3 Phone evidence boundary

- production request handling must call an injected purpose-bound contact verifier；
- only `authorized` yields validated private contact for persistence；
- missing/declined/expired/invalid/unavailable/technical creates zero Visit；
- phone remains contact data only and is excluded from identity、ownership and idempotency key；
- C4 may implement the interface/orchestration and TEST_ONLY verifier only；no fake production phone provider。

### 6.4 Canonical references

- Elder ownership/authorization and exact Institution revision eligibility are Backend-owned injected dependencies；
- unknown、unauthorized、expired/ineligible or unavailable reference fails closed before transaction commit；
- no test reference adapter enters production；
- C4 reads no Institution official phone and copies no Consultant resolver。

### 6.5 Backend/Application boundary

- transport adapters accept an untrusted versioned command and emit only stable C3 outcomes；
- Backend Application validates/minimizes, invokes dependencies and coordinates the transaction boundary；
- raw auth/phone/reference/DB/stack errors never cross the stable result mapper；
- transport success is not business success；only committed accepted/replayed carries a candidate receipt。

## 7. Persistence and Transaction Boundary

### 7.1 Real repository requirement

C4 must implement a real MySQL-backed repository/migration. In-memory/map/file repositories are allowed only under `TEST_ONLY` where useful and cannot be
production beans/configuration/fallback. A claimed C4 PASS requires database integration evidence, not repository mocks alone.

### 7.2 Atomic operation

One transaction must bind：

```text
trusted principal
+ verified purpose-bound contact
+ authorized Elder and exact Institution revision
+ durable idempotency lookup/comparison
+ create or replay one InstitutionVisit(status=requested)
+ persist server visitId and acceptedAt
+ persist/recover the authoritative receipt relation
```

Commit failure returns no accepted/replayed result. A rollback leaves no partial Visit or accepted idempotency record. The Application may not publish a
candidate before the transaction returns committed/replayed truth.

### 7.3 Durable idempotency ownership

- repository/transaction owns durable owner + key + canonical payload comparison；
- same committed input replays the same visitId and semantically identical receipt；
- changed material payload under the same owner/key returns conflict and creates zero Visit；
- distinct key remains a distinct attempt；no cross-key dedupe is invented；
- concurrent same-key requests must converge to one Visit；
- uncertain client outcome is resolved by same-key retry；
- raw payload/fingerprint never enters public response or generic logs。

### 7.4 Server identity and time

- only Backend persistence generates `visitId` and `acceptedAt`；
- test determinism may inject a server ID/time source under TEST_ONLY or test configuration；
- production ID/time source cannot be client-controlled；
- accepted and replayed preserve the same authoritative identity/time；
- initial status is exactly `requested`；C4 writes no later lifecycle state。

## 8. Result and Privacy Boundary

### 8.1 Stable results

C4 must map all outcomes to C3 semantics：

```text
accepted
replayed
rejected
conflict
unavailable
technical_failure
```

Only accepted/replayed after committed truth may carry an InstitutionVisit candidate. C2 Application remains responsible for final public projection.

### 8.2 Raw firewall

No stable response/log/test snapshot may leak auth/session evidence、phone evidence、raw private contact、internal user locator、DB keys/SQL/constraint names、
canonical payload/fingerprint、stack trace、provider metadata or Secrets. Internal diagnostics must be redacted and access-controlled.

### 8.3 Secrets and configuration

- Secrets belong only to server-side runtime configuration/secret management；
- no real credential enters Git、example config、test fixture or Mini Program bundle；
- placeholder configuration must be unmistakably non-secret；
- missing provider configuration fails closed and cannot enable a test adapter in production profile。

## 9. Mock / Fixture / Profile Isolation

- deterministic adapters and fixtures are `TEST_ONLY`；
- production dependency graph/profile contains zero test auth、phone、reference or repository adapters；
- test accepted/replayed data uses explicit synthetic provenance and a disposable integration database；
- no synthetic `completed` unlocks VisitEvaluation；
- no development profile may silently become production capability；
- production with missing dependencies remains unavailable and creates zero Visit。

## 10. Mandatory C4 Implementation Gates

All 17 gates are mandatory：

### GATE 1 — C3_CONFORMANCE

C1/C2/C3 and Product Source remain unchanged；server implementation creates no new identity、phone purpose、result or lifecycle semantics.

### GATE 2 — SERVER_BOOTSTRAP_AND_VERSIONING

The minimal server project builds reproducibly on the repository baseline；versioned request/result dispatch is explicit；no unrelated service is introduced.

### GATE 3 — SUBMISSION_COMMAND_RESULT_MAPPING

Untrusted command validation、client-forbidden fields and accepted/replayed/rejected/conflict/unavailable/technical mappings match C3 exactly.

### GATE 4 — TRUSTED_PRINCIPAL_RESOLUTION

Only injected Backend resolution yields trusted userId；all missing/expired/invalid/unavailable/malformed cases fail closed with zero persistence.

### GATE 5 — PURPOSE_BOUND_CONTACT_VERIFICATION

Only authorized Appointment/Consultant contact evidence yields private contact；phone-as-identity/fallback and missing provider success are impossible.

### GATE 6 — CANONICAL_REFERENCE_AUTHORIZATION

Elder ownership and exact Institution revision eligibility are verified before commit；unknown/unauthorized/unavailable cases create zero Visit.

### GATE 7 — MYSQL_SCHEMA_AND_MIGRATION

Versioned migration/schema supports one authoritative Visit and durable idempotency without a second Appointment aggregate；clean migration and schema checks pass.

### GATE 8 — ATOMIC_CREATE_OR_REPLAY

Real database transaction proves commit/rollback truth；accepted/replayed exists only after commit and no partial Visit/receipt survives failure.

### GATE 9 — DURABLE_IDEMPOTENCY

Same owner/key/payload replays the same Visit；same owner/key/changed payload conflicts；different key remains distinct；private comparison data is protected.

### GATE 10 — CONCURRENT_DUPLICATE_SAFETY

Concurrent same-key submissions against the integration database converge to exactly one authoritative Visit and one accepted identity.

### GATE 11 — SERVER_VISIT_ID_TIMESTAMP_AUTHORITY

visitId、acceptedAt and initial requested are generated/persisted only by server transaction；client control and pre-commit projection are rejected.

### GATE 12 — RESULT_RAW_ERROR_PRIVATE_DATA_FIREWALL

Stable response/log evidence contains no raw provider/DB/stack/Secret/private contact/internal locator or payload fingerprint.

### GATE 13 — SECRET_CONFIGURATION_ISOLATION

Production profile has no test adapter or checked-in Secret；missing configuration fails closed；example values are placeholders only.

### GATE 14 — NO_FAKE_PRODUCTION_PERSISTENCE

Production in-memory/mock repository and synthetic principal/contact/reference fallback counts are zero；accepted integration cases use disposable test infrastructure only.

### GATE 15 — CROSS_DOMAIN_AND_DEFERRED_ISOLATION

Mini Program Page、owner-read、Operations mutation、Evaluation and Recommendation/Institution/ElderProfile/Consultant/AI writes/changes remain zero.

### GATE 16 — TARGETED_BACKEND_EVIDENCE

Backend unit、contract、migration and real database integration tests cover positive and fail-closed paths, rollback、replay、conflict and concurrency.

### GATE 17 — TARGETED_QA

Independent diff-driven QA reviews Contract conformance、transaction/idempotency race safety、negative paths、privacy、profile/mock isolation、scope and actual dependencies.

## 11. Required Evidence Strategy

Future C4 implementation must report separately：

```text
BACKEND_BUILD = MANDATORY
TARGETED_UNIT_TESTS = MANDATORY
TARGETED_APPLICATION_CONTRACT_TESTS = MANDATORY
MYSQL_MIGRATION_VALIDATION = MANDATORY
MYSQL_TRANSACTION_INTEGRATION = MANDATORY
CONCURRENT_IDEMPOTENCY_TEST = MANDATORY
STATIC_SECRET_FIXTURE_PROFILE_CHECK = MANDATORY
INDEPENDENT_TARGETED_QA = MANDATORY

MINIPROGRAM_RUNTIME_TESTS = NOT_REQUIRED
WECHAT_DEVTOOLS = NOT_REQUIRED
ANDROID_REAL_DEVICE = NOT_REQUIRED
FULL_REPOSITORY_TESTS = NOT_REQUIRED
```

If C4 unexpectedly changes `miniprogram/**` or user-visible interaction, the exemption is invalid and implementation must stop with
`C4_SCOPE_EXPANSION_DETECTED` rather than silently adding frontend work.

## 12. PASS / PASS_WITH_RISKS / BLOCKED

### 12.1 PASS

Only when all 17 Gates pass may implementation report：

```text
PHASE_V1_2_C4 = PASS
C4_IMPLEMENTATION = COMPLETE
MANDATORY_GATES = 17/17 PASS
BLOCKERS = 0
READY_FOR_C4_SUCCESSOR = TRUE
```

Concrete production auth/phone/reference providers and Page remain valid deferred dependencies. Their absence is not a C4 blocker only if production wiring
fails closed and every accepted/replayed integration case is explicitly test-only against real disposable database infrastructure.

### 12.2 PASS_WITH_RISKS

Allowed only when all mandatory Gates pass and a non-blocking environment/deployment dependency remains. It may not hide missing real database transaction、
concurrency、migration、privacy、mock isolation or QA evidence.

### 12.3 BLOCKED

C4 must be `BLOCKED` if：

- a trusted principal or authorized contact cannot be distinguished from client claims；
- phone becomes identity、ownership or idempotency scope；
- accepted/replayed can occur before committed persistence；
- only an in-memory/mock production repository is available；
- database transaction cannot guarantee one Visit under concurrent duplicate requests；
- visitId/acceptedAt/status can be client-generated or projected before commit；
- raw error/private data/Secret crosses the firewall；
- test adapters enter production profile/graph；
- Page、owner-read、Operations or Evaluation work is required to claim completion；
- C1/C2/C3 must be changed；
- any mandatory build/test/integration/QA Gate fails。

Report `BLOCKER / ROOT_CAUSE / AFFECTED_SCOPE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`.

## 13. Deferred Capabilities

After C4, still deferred：

- real auth/session provider wiring；
- real purpose-bound phone provider/client authorization；
- production Institution/Elder/Consultant adapters and data；
- Mini Program transport integration and Appointment Page；
- authenticated owner-read / 我的预约；
- Operations lifecycle mutation；
- VisitEvaluation。

These require separate successor discovery; C4 must not preselect their order beyond C3 dependencies.

## 14. Definition Result

```text
POST_C3_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C4
NEXT_PHASE_NAME = Authenticated Visit Submission Backend Foundation
NEXT_PHASE_TYPE = BACKEND_FOUNDATION_IMPLEMENTATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C4 = NOT_STARTED

READY_TO_START_NEXT_PHASE = TRUE
READY_TO_START_V1_2_C4 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C3 = PASS / UNCHANGED
C3_CONTRACT = FROZEN / UNCHANGED

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 15. Change Policy

- This handoff freezes only C4 implementation scope、ownership、Gates and completion rules；
- it authorizes a minimal Backend foundation, not production launch or Page integration；
- implementation-local build/framework choices may not weaken C3；
- any change to identity、phone purpose、result taxonomy、Visit lifecycle or persistence truth requires Contract successor review。
