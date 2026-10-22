# Phase V1.2-C5 Implementation Handoff — WeChat Authenticated Principal Integration

状态：`FROZEN_PHASE_V1_2_C5_DEFINITION`

冻结日期：`2026-09-18`

```text
POST_C4_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C5
NEXT_PHASE_NAME = WeChat Authenticated Principal Integration
NEXT_PHASE_TYPE = AUTH_SESSION_INTEGRATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C5 = NOT_STARTED
READY_TO_START_V1_2_C5 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C4 = PASS / UNCHANGED
C4_IMPLEMENTATION = COMPLETE / UNCHANGED
C3_CONTRACT = FROZEN / UNCHANGED
```

本文冻结 C4 之后唯一获准立即实施的最小 production-integration slice。C5 只把真实微信认证证据解析为 Backend-owned、
稳定且 opaque 的 authenticated principal，并将自有 session 接入 C4 `AuthEvidenceResolver`。C5 不获取 User.phone、不授权
Elder/Institution reference、不创建 Visit，也不接 Appointment Page。

## 1. Successor Decision

### 1.1 Candidate review

| Candidate | Decision | Current fact and dependency |
|---|---|---|
| C4 Backend submission / MySQL foundation | `ALREADY_SATISFIED` | API/Application、atomic persistence、durable idempotency 与 server identity/time authority 已完成 |
| real WeChat auth/session provider | `READY` | C3 已冻结 provider-neutral evidence 与 trusted principal semantics；微信 provider、encoding、TTL/rotation 是受约束的 Backend implementation choice |
| trusted principal production adapter | `READY` | C4 `AuthEvidenceResolver` 已存在且默认 fail closed；C5 可实现唯一 production adapter |
| purpose-bound phone authorization/provider | `REQUIRES_PREREQUISITE` | 必须建立在 trusted principal 之上；phone 仍只属于 Appointment/Consultant contact purpose |
| canonical Institution reference adapter | `REQUIRES_PREREQUISITE` | 需要 Backend-readable authoritative Institution revision source；不得信任客户端 catalog |
| canonical Elder reference/ownership adapter | `REQUIRES_PREREQUISITE` | 需要 authenticated owner 与持久化 Elder ownership source；本地 Profile 不是 server authority |
| Backend Appointment transport/API foundation | `ALREADY_SATISFIED` | C4 已有 versioned submission controller；production success 仍被缺失 phone/reference adapters 正确阻断 |
| Mini Program authenticated submission transport | `REQUIRES_PREREQUISITE` | 依赖 C5 session、phone evidence 与 canonical reference adapters |
| Appointment Page formal submit | `DEFERRED` | 不能在 auth/phone/reference/transport 未闭合时制造 success |
| success/result presentation | `DEFERRED` | 只能消费 committed accepted/replayed receipt |
| authenticated owner-read / 我的预约 | `DEFERRED` | 需要独立 permission-filtered read boundary，不并入首次 auth slice |

### 1.2 Dependency order

```text
C3 Frozen trust Contract + C4 Backend foundation
  ↓
C5 WeChat authenticated principal integration           ← immediate successor
  ↓
purpose-bound phone evidence integration
+ canonical Elder ownership / Institution revision adapters
  ↓
Mini Program authenticated submission transport
  ↓
Appointment Page formal submit + accepted-result presentation
  ↓
authenticated owner-read / 我的预约
  ↓
Operations lifecycle mutation
  ↓
VisitEvaluation
```

### 1.3 Why C5 is immediate

C4 已经证明 persistence truth，但生产配置因无 trusted principal adapter 而 fail closed。所有正式 Appointment write、Elder ownership、
idempotency owner scope 与未来 owner-read 都首先依赖 authenticated principal。Phone 不能替代 identity；Page 也不能自行生成 identity。
因此先建立单一、可验收的 auth/principal slice，既直接消费 C4，又不把 phone、reference、Page 和 owner-read 绑成一个大阶段。

C3 已明确：provider、evidence encoding、transport placement、TTL 与 rotation 是 implementation choices。C5 不新增 account role、
phone identity、Visit state 或 Product behavior；provider raw subject 与 session protocol remain private Backend details。

## 2. Source of Truth

C5 implementation must follow, in order：

1. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`；
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`；
3. `V1_2_C4_IMPLEMENTATION_HANDOFF.md` 与已完成 C4 implementation；
4. C2 Application types/ports；
5. Current Product Source；
6. CURRENT security、mock、frontend and backend ownership policies；
7. this C5 handoff for phase scope and implementation Gates。

本文不是新的业务 Contract。若实现需要改变 C3 的 identity role、resolution taxonomy、privacy 或 phone-not-identity 语义，必须停止并报告
`NEW_CONTRACT_REQUIRED`。

## 3. Goal

C5 shall establish this production trust chain：

```text
untrusted, short-lived WeChat login evidence
  ↓ Backend-only provider exchange and validation
verified provider subject in the configured Mini Program namespace
  ↓ durable one-to-one internal identity mapping
server-generated opaque stable userId
  ↓ self-owned session issuance / validation
opaque session evidence
  ↓ C4 AuthEvidenceResolver
authenticated TrustedPrincipal(userId)
```

Every missing、expired、invalid、revoked、unavailable or technical path fails closed and creates no Visit.

## 4. In Scope

C5 may implement only：

1. versioned Backend auth request/result types compatible with C3 resolution semantics；
2. Backend-owned WeChat login provider client port and production adapter；
3. provider response validation and configured Mini Program namespace binding；
4. server-generated opaque stable `userId`；
5. durable provider-subject → internal-user identity mapping；
6. self-owned opaque session issuance、hashed persistence、expiry、revocation and validation；
7. production `AuthEvidenceResolver` adapter backed by the self-owned session store；
8. stable `authenticated / missing / expired / invalid / unavailable / technical_failure` mapping；
9. versioned Backend auth endpoint required to obtain self-owned session evidence；
10. provider raw-error、subject、session-key and internal locator privacy firewall；
11. server-only Secret/config loading and fail-closed startup/runtime behavior；
12. real MySQL migration/repository needed for identity/session truth；
13. concurrency-safe same-provider-subject mapping to one opaque userId；
14. TEST_ONLY provider adapters/fixtures and targeted Backend tests；
15. narrowly authorized provider integration evidence when credentials/environment are supplied outside Git。

Implementation may choose private token encoding and storage mechanics, but no raw provider session key、provider subject or phone may become the public
`userId` or cross the Application/Page boundary.

## 5. Out of Scope

C5 must not implement：

- purpose-bound User.phone acquisition、`getPhoneNumber` client interaction or phone verifier adapter；
- canonical Elder ownership or Institution revision production adapters；
- Appointment submit transport from Mini Program、form、local draft、success Page or owner-read；
- real InstitutionVisit creation as a C5 success criterion；
- Consultant/Operations lifecycle mutation or VisitEvaluation；
- cross-App/cross-provider account merge、Union identity product behavior or phone-based account linking；
- profile editing、account recovery UI、logout UI or “我的” Page integration；
- Recommendation、Institution、ElderProfile、Consultant or AI semantic changes；
- client-held AppSecret、provider Secret or raw session key；
- test/mock identity accepted by production profile。

## 6. Ownership and Trust Boundaries

### 6.1 C3/C4 ownership

- C3 owns trusted principal semantics、resolution taxonomy、raw firewall and phone-not-identity；
- C4 owns Visit submission orchestration、persistence、idempotency and server Visit authority；
- C5 owns only real auth provider exchange、internal identity mapping and self-owned session truth；
- C5 must implement C4 `AuthEvidenceResolver` without changing its public semantic outcomes。

### 6.2 Auth evidence boundary

- client-supplied login code/session evidence is untrusted until Backend verification；
- existence、shape、route origin or local storage never proves authentication；
- provider exchange happens only on self-owned Backend；
- provider subject/session key is internal provider data, not Application identity；
- only a valid self-owned unexpired, non-revoked session resolves `authenticated`；
- no client-supplied `userId` is accepted or echoed as authority。

### 6.3 Identity mapping

- `userId` is server-generated、opaque and stable within the configured product identity namespace；
- provider namespace + verified provider subject maps durably to exactly one internal userId；
- concurrent first login for the same verified subject converges to one userId；
- C5 does not merge identities across apps/providers and does not infer identity from phone；
- raw provider identifiers are never returned to Mini Program Page/Application output。

### 6.4 Session ownership

- Backend owns session issuance、validation、expiry and revocation truth；
- session evidence is opaque to the Mini Program and cannot encode a client-authoritative userId；
- only a one-way representation of active session evidence may be persisted where feasible；
- expired/revoked/unknown/malformed evidence returns a stable non-authenticated outcome；
- auth provider outage cannot turn stale or malformed evidence into authenticated truth。

## 7. Phone and Canonical Reference Boundaries

- C5 reads、requests、stores and infers no User.phone；
- phone remains purpose-bound contact data and is never an identity、session or account-recovery key；
- C5 does not implement `PurposeBoundContactVerifier` production success；
- C5 does not authorize `elderId` or `institutionId + institutionRecordRevision`；
- current Mini Program local profile/catalog/mock data cannot become Backend authority；
- a C5-authenticated principal alone is insufficient to create an InstitutionVisit。

## 8. Backend Transport and Mini Program Ownership

- C5 may add only the versioned Backend auth endpoint needed for server-side provider exchange and self-owned session issuance；
- C4 Appointment submission endpoint remains unchanged and continues to require all C3 gates；
- Mini Program `wx.login` orchestration、auth state store and Appointment transport adapter are deferred；
- Page never receives provider raw response、provider subject、raw session key or internal account locator；
- successful auth does not submit a draft、obtain phone evidence or create a Visit；
- future client integration must perform an explicit Appointment submit action after all required gates are satisfied。

## 9. Secret and Configuration Boundary

- provider AppSecret/credential exists only in Backend secret management/runtime environment；
- no real Secret enters Git、example config、test fixture、logs or Mini Program bundle；
- AppID/provider namespace may be configuration but never substitutes for verified provider response；
- missing or contradictory production config fails closed；
- no TEST_ONLY provider or principal is automatically registered in production profile；
- provider-specific raw error is mapped to stable unavailable/technical semantics without leakage。

## 10. Persistence and Privacy

- identity/session migrations are additive and must not rewrite C4 Visit truth；
- identity mapping has a database-enforced unique provider namespace + subject boundary；
- userId and session identifiers are server authority；
- session expiry/revocation and mapping writes are transactionally consistent；
- raw login code and raw provider session key are never stored as business records；
- generic logs、public errors、analytics and test snapshots exclude raw provider data、session evidence and Secrets；
- C5 stores no phone、Appointment draft、health/Profile or Institution private evidence。

## 11. Mock / Fixture Isolation

- deterministic provider/session adapters and identities are `TEST_ONLY`；
- production dependency graph/profile contains zero synthetic principal、provider or session fallback；
- integration fixtures use explicit synthetic provenance or an expressly authorized external development environment；
- successful test auth is not evidence that Appointment submission, phone or canonical references are production-ready；
- production without valid provider configuration remains non-authenticated/fail closed。

## 12. Mandatory C5 Implementation Gates

All 15 gates are mandatory：

### GATE 1 — C3_C4_CONFORMANCE

C3 identity/resolution/privacy semantics and C4 Visit behavior remain unchanged；no new Page-facing auth/Visit state is created.

### GATE 2 — PROVIDER_EXCHANGE_BOUNDARY

Only Backend performs the real provider exchange；untrusted login evidence and malformed/provider-failed responses fail closed.

### GATE 3 — OPAQUE_PRINCIPAL_MAPPING

Verified provider namespace + subject maps to one server-generated opaque userId；phone/client userId/provider subject never becomes principal.

### GATE 4 — DURABLE_IDENTITY_PERSISTENCE

Real MySQL migration/repository proves stable mapping、unique constraints、transaction rollback and no duplicate user under retry/concurrency.

### GATE 5 — SELF_OWNED_SESSION

Backend issues and validates opaque self-owned sessions with expiry/revocation；raw provider session material is not exposed or persisted as public evidence.

### GATE 6 — AUTH_RESOLUTION_TAXONOMY

authenticated/missing/expired/invalid/unavailable/technical failure are deterministic and match C3 exactly.

### GATE 7 — C4_AUTH_RESOLVER_INTEGRATION

Production `AuthEvidenceResolver` consumes only verified self-owned session truth；all non-authenticated paths reach zero Visit persistence.

### GATE 8 — SECRET_CONFIGURATION_ISOLATION

Provider Secret is Backend-only、absent from Git/bundle/log/test data；missing configuration fails closed.

### GATE 9 — RAW_ERROR_PRIVACY_FIREWALL

Raw provider response、subject、session key、login code、stack/network details and internal locators never enter stable public results or generic logs.

### GATE 10 — PHONE_NOT_IDENTITY

C5 phone reads/writes and phone-based identity/account/session paths are zero；phone verifier remains unavailable/deferred.

### GATE 11 — REFERENCE_VISIT_ISOLATION

C5 performs no Elder/Institution authorization success, Appointment submit, Visit creation/status mutation or owner-read.

### GATE 12 — CONCURRENT_LOGIN_SAFETY

Concurrent/retried login for the same verified provider subject converges to one stable userId without partial identity/session rows.

### GATE 13 — MOCK_PRODUCTION_ISOLATION

Production test-provider、synthetic principal/session and fixture imports/registrations are zero.

### GATE 14 — TARGETED_BACKEND_EVIDENCE

Build、unit、contract、migration、real MySQL transaction/concurrency and authorized provider-adapter evidence cover positive and fail-closed paths.

### GATE 15 — TARGETED_QA

Independent diff-driven QA reviews trust、identity mapping、session security、Secret/privacy、negative paths、mock isolation and scope.

## 13. Evidence Strategy

```text
BACKEND_BUILD = MANDATORY
TARGETED_UNIT_CONTRACT_TESTS = MANDATORY
MYSQL_MIGRATION_INTEGRATION = MANDATORY
CONCURRENT_IDENTITY_MAPPING = MANDATORY
SESSION_EXPIRY_REVOCATION_TESTS = MANDATORY
STATIC_SECRET_MOCK_PROFILE_CHECK = MANDATORY
AUTHORIZED_PROVIDER_ADAPTER_EVIDENCE = MANDATORY_FOR_FULL_PASS
INDEPENDENT_TARGETED_QA = MANDATORY

MINIPROGRAM_RUNTIME_TESTS = NOT_REQUIRED
WECHAT_DEVTOOLS = NOT_REQUIRED
ANDROID_REAL_DEVICE = NOT_REQUIRED
FULL_REPOSITORY_TESTS = NOT_REQUIRED
```

Provider evidence must use an expressly authorized development environment/credential outside Git. If such external evidence is unavailable, code may be
complete but C5 cannot claim full PASS. C5 must not add Mini Program UI merely to manufacture provider evidence.

## 14. PASS / PASS_WITH_RISKS / BLOCKED

### 14.1 PASS

Only when all 15 Gates pass may implementation report：

```text
PHASE_V1_2_C5 = PASS
C5_IMPLEMENTATION = COMPLETE
MANDATORY_GATES = 15/15 PASS
BLOCKERS = 0
READY_FOR_C5_SUCCESSOR = TRUE
```

Phone、reference、Mini Program transport and Page remain valid deferred dependencies and are not C5 blockers when their production paths still fail closed.

### 14.2 PASS_WITH_RISKS

Allowed only when implementation、database、security、mock-isolation and QA Gates pass but authorized external provider evidence is pending：

```text
PHASE_V1_2_C5 = PASS_WITH_RISKS
C5_IMPLEMENTATION = COMPLETE_PENDING_EXTERNAL_PROVIDER_EVIDENCE
READY_FOR_C5_SUCCESSOR = FALSE
```

It may not hide fake principal acceptance、missing persistence/concurrency evidence、Secret leakage or production test adapters.

### 14.3 BLOCKED

C5 is `BLOCKED` if：

- trusted principal depends on client-supplied userId、phone、route or local draft；
- provider verification occurs in Mini Program or requires a client-held Secret；
- raw provider subject/session key becomes public userId or session evidence；
- session validation does not fail closed for expired/revoked/invalid evidence；
- concurrent provider mapping can create multiple internal users；
- production profile registers test provider/principal/session fallback；
- auth success creates/submits a Visit or bypasses phone/reference gates；
- C3/C4 must be changed；
- any mandatory build/database/provider/privacy/QA Gate fails。

Report `BLOCKER / ROOT_CAUSE / AFFECTED_SCOPE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`.

## 15. Deferred Capabilities

After C5, still deferred：

- purpose-bound User.phone acquisition and production verifier；
- canonical Elder ownership and Institution revision adapters；
- Mini Program auth/session and Appointment submission transport；
- Appointment form/local draft/submit/success UI；
- authenticated owner-read / 我的预约；
- Operations lifecycle mutation；
- VisitEvaluation。

Their order requires Post-C5 successor discovery; C5 does not pre-authorize Page or combine these capabilities.

## 16. Definition Result

```text
PRE_SUCCESSOR_HEAD = d8fd2825b271d90124dfc8b2857d3157453879e8
POST_C4_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C5
NEXT_PHASE_NAME = WeChat Authenticated Principal Integration
NEXT_PHASE_TYPE = AUTH_SESSION_INTEGRATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C5 = NOT_STARTED

READY_TO_START_NEXT_PHASE = TRUE
READY_TO_START_V1_2_C5 = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0

PHASE_V1_2_C4 = PASS / UNCHANGED
C4_IMPLEMENTATION = COMPLETE / UNCHANGED
C3_CONTRACT = FROZEN / UNCHANGED

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
EXISTING_FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0
```

## 17. Change Policy

- this handoff freezes only C5 scope、ownership、Gates and completion rules；
- implementation-local provider protocol、evidence encoding、token format and TTL may not weaken C3 semantics；
- new account role、cross-provider identity merge、phone identity or Page behavior requires a successor/Contract decision；
- Frozen C3/C1、C4 persistence truth and Product Source remain unchanged。

## 18. Implementation Evidence — Pending Authorized Provider Gate

This section records the C5 implementation result. Section 16 is the frozen definition snapshot, not the current phase marker.

```text
PHASE_V1_2_C5 = PASS_WITH_RISKS
C5_IMPLEMENTATION = COMPLETE_PENDING_EXTERNAL_PROVIDER_EVIDENCE
MANDATORY_GATES = 14/15 PASS
REAL_PROVIDER_EVIDENCE = MISSING
READY_FOR_C5_SUCCESSOR = FALSE
```

The Backend-only implementation includes WeChat code exchange, durable opaque identity mapping, atomic identity/session issuance, self-owned session expiry/revocation, and the C4 `AuthEvidenceResolver` adapter. Java 21 Backend tests passed (40 tests, 0 failures/errors), including C4 regression. A disposable real MySQL 8 instance passed 6 C5 integration cases: both migrations, repeated identity stability, transaction rollback on session collision, eight concurrent first logins to one identity, and session resolution/revocation. The production dependency graph contains no TEST_ONLY provider or principal fallback. No Mini Program, phone, reference, Appointment Page, or Visit behavior was added.

No authorized WeChat AppID/AppSecret and one-time login evidence were supplied for this run. TEST_ONLY provider behavior does not satisfy Gate 14's external provider requirement. Full `PASS` and successor readiness require an authorized provider exchange and resulting self-owned session resolution against the same implementation source. DevTools and Android remain not required for this Backend-only phase.

## 19. Runtime Configuration Wiring Reconciliation — Provider Gate Still Pending

The configuration repair is based on implementation source `efa4593bd9739dd0fec3e1130a8905abf6ed339d`. `application.yml` already maps the documented external `C5_WECHAT_APP_ID`, `C5_WECHAT_APP_SECRET`, and `C5_AUTH_HASH_SECRET` variables into `c5.auth.*`. The Java configuration now gives those external variables explicit precedence when Spring relaxed environment binding also exposes the older `C5_AUTH_APP_ID`, `C5_AUTH_APP_SECRET`, or `C5_AUTH_IDENTITY_HASH_SECRET` names. The older names remain a fallback when the documented variables are absent. This is one provider/hasher configuration path, not separate credentials for each alias.

`PersistenceConfiguration` already passes `C4_MYSQL_URL`, `C4_MYSQL_USERNAME`, and `C4_MYSQL_PASSWORD` into the production Hikari `DataSource`; no password wiring change was needed. Targeted configuration and C4/C5 boundary tests use synthetic values and do not connect to an Owner database. This reconciliation does not supply real WeChat provider evidence or change the phase result:

```text
PHASE_V1_2_C5 = PASS_WITH_RISKS
C5_IMPLEMENTATION = COMPLETE_PENDING_EXTERNAL_PROVIDER_EVIDENCE
MANDATORY_GATES = 14/15 PASS
REAL_PROVIDER_EVIDENCE = MISSING
READY_FOR_C5_SUCCESSOR = FALSE
```

## 20. Real WeChat Provider Runtime Gate — Closeout

This section is the current C5 status. Sections 16, 18, and 19 record earlier definition, implementation, and configuration snapshots. The validated implementation source is `66b22eba6c7eba07518073a888e37693aa51a9e2`; the closeout changes documentation only.

The Owner started the Backend from that source with Java 21 and Maven `spring-boot:run` in the default profile. The startup record shows a live MySQL connection, Flyway validation and application of migrations V1 and V2, and Tomcat on port 8080. The C4 and C5 JDBC repositories and C5 auth service are required by the successful production context startup. Configuration conditions and the authenticated runtime responses establish selection of the production `WeChatHttpAuthProvider`; no TEST_ONLY provider was used.

Two separate fresh `wx.login` codes from the authorized Mini Program each produced the C5 `AUTHENTICATED` result with self-owned session evidence and expiry present. A read-only, bounded MySQL aggregate for those two calls returned two persisted session rows, one distinct internal principal, and one mapped principal; the Owner confirmed no other authentication occurred in the window. The first issued session reached the C4 authenticated path and returned `CONTACT_REQUIRED` because no phone evidence was supplied; no Visit was created. A tampered session returned `AUTH_REQUIRED`. Reusing the second one-time code returned `INVALID / AUTH_EVIDENCE_INVALID` without session evidence. Existing targeted tests cover expiry, revocation, concurrency, and fail-closed configuration semantics; those cases were not rerun against the Owner runtime for this Gate.

Only public-safe result fields and presence booleans were retained from the DevTools calls. Provider identity is hashed before persistence, session evidence is stored only as a digest, and provider errors are mapped to stable public results. Targeted source and default-profile logging review found no application-controlled path that logs the AppSecret, provider response, raw identity, login code, or session evidence. External process, APM, and operating-system log sinks were outside this Gate's inspection boundary. Independent targeted QA reconciled source identity and evidence with no implementation defect found.

```text
C5_VALIDATED_IMPLEMENTATION_SOURCE = 66b22eba6c7eba07518073a888e37693aa51a9e2
MYSQL_RUNTIME = PASS
FLYWAY = PASS
PRODUCTION_WECHAT_PROVIDER_SELECTED = PASS
REAL_PROVIDER_EVIDENCE = PASS
REAL_CODE_EXCHANGE = PASS
DURABLE_PRINCIPAL_EVIDENCE = PASS
SELF_OWNED_SESSION_EVIDENCE = PASS
C4_RESOLVER_EVIDENCE = PASS
SECRET_FIREWALL = PASS
MANDATORY_GATES = 15/15 PASS
PHASE_V1_2_C5 = PASS
C5_IMPLEMENTATION = COMPLETE
BLOCKERS = 0
READY_FOR_C5_SUCCESSOR = TRUE
```
