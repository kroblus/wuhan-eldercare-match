# Authenticated Visit Submission & Persistence Contract V1

状态：`FROZEN`

Contract ID：`authenticated-visit-submission-persistence-contract-v1`

冻结日期：`2026-09-17`

适用阶段：`V1.2-C3`

```text
PHASE_V1_2_C3 = PASS
C3_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C3_SUCCESSOR = TRUE
```

本文冻结正式 Appointment submit 从客户端 Application 边界进入自有 Backend，并在可信身份、purpose-bound contact evidence、
canonical references、durable idempotency 和 atomic persistence 全部成立后创建或重放唯一 authoritative `InstitutionVisitV1`
的 versioned 协议语义。

本文不实现 auth/session、User.phone provider、Backend、API、DB、repository、Page 或真实 Visit。任何后续实现不得用 provider、
框架或 UI 便利反向修改本文及 C1/C2 Frozen semantics。

## 1. Authority and Source Order

本 Contract 依次遵守：

1. `docs/product/README.md` 路由的两份 Current V1.2 Product Source PDF；
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`；
3. `V1_2_C2_IMPLEMENTATION_HANDOFF.md` 与已验证 C2 types/Domain/Application ports；
4. `V1_2_C3_PHASE_HANDOFF.md` 的 scope、ownership、15 Gates 与 completion criteria；
5. CURRENT `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
6. 本文新增的 authenticated submission / persistence boundary。

`server/README.md`、Appointment scaffolds、test fixtures 和未来 provider documentation 只可证明 implementation state，不能覆盖本 Contract。

## 2. Normative Scope

### 2.1 In scope

- trusted authenticated principal resolution boundary；
- auth/session evidence ownership and fail-closed states；
- anonymous local draft → explicit authenticated formal submission handoff；
- purpose-bound contactName/User.phone authorization evidence；
- C2 Application command ↔ Backend submission/result boundary；
- exact canonical reference authorization；
- atomic create-or-replay transaction；
- durable idempotency scope and duplicate/retry semantics；
- committed Backend-only initial `requested`、`visitId` and `acceptedAt` truth；
- accepted/replayed/rejected/conflict/unavailable/technical result taxonomy；
- privacy、raw error firewall、audit/redaction ownership；
- mock/test and Page truth isolation；
- downstream implementation ownership and Gates。

### 2.2 Out of scope

- concrete WeChat login/session/account-linking implementation；
- token、cookie、header、credential、endpoint or transport format；
- real phone acquisition/authorization provider；
- Backend project、Controller、API implementation、DB schema、ORM、migration or deployment；
- production repository or in-memory substitute；
- Appointment create/success/index Page、local storage or navigation；
- authenticated owner-read implementation；
- Consultant/Operations lifecycle mutation implementation；
- VisitEvaluation；
- Recommendation、Institution、ElderProfile、Consultant、AI or Product Source changes。

## 3. Frozen Invariants

```text
ANONYMOUS_LOCAL_DRAFT = ALLOWED
ANONYMOUS_SERVER_VISIT_CREATION = FORBIDDEN
FORMAL_SERVER_PERSISTENCE_REQUIRES_TRUSTED_PRINCIPAL = TRUE

USER_PHONE_IS_ACCOUNT_IDENTITY = FALSE
PHONE_PURPOSE = APPOINTMENT_OR_CONSULTANT_CONTACT_ONLY

ACCEPTED_RECEIPT_REQUIRES_COMMITTED_CREATE_OR_REPLAY = TRUE
VISIT_ID_AUTHORITY = SERVER_ONLY
ACCEPTED_AT_AUTHORITY = SERVER_ONLY
INITIAL_VISIT_STATUS = requested

SUBMITTED != CONFIRMED
REQUESTED != SCHEDULED
PAGE_STATUS_INFERENCE = FORBIDDEN
```

No missing、expired、invalid、unavailable or malformed identity/contact/reference/persistence condition may be converted into accepted success.

## 4. Trust Roles and Semantic Objects

### 4.1 Untrusted client input

The following remain untrusted until verified by the owning Backend boundary：

- route/query/page state；
- `AppointmentLocalDraftV1`；
- `AppointmentSubmissionV1` submitted by a client；
- any client-supplied user/account identifier；
- auth/session evidence candidate；
- phone authorization evidence candidate；
- Institution/Elder/Consultant identifiers；
- idempotency key and claimed retry state。

Client input MUST NOT contain or reserve `visitId`、Visit status、`acceptedAt` or operational timestamps.

### 4.2 Auth evidence candidate

An auth evidence candidate is an opaque, provider-neutral proof presented for Backend validation. It is not the trusted principal itself and MUST NOT：

- expose its raw value to Page/Application public result；
- be logged、persisted as Appointment business data or included in analytics；
- be derived from phone、route、draft or idempotency key；
- be treated as valid merely because it exists client-side。

Provider、encoding、transport placement、TTL and rotation are implementation choices. They may not weaken server validation or privacy.

### 4.3 Trusted authenticated principal

Only the authorized Backend/auth boundary may resolve a trusted principal. Its minimum semantic identity is an opaque stable `userId` used for：

- Visit ownership attribution；
- Elder ownership/authorization checks；
- idempotency scope；
- future owner-read authorization；
- future VisitEvaluation relation authorization。

The Backend-facing resolution outcome is one of：

```text
authenticated
missing
expired
invalid
unavailable
technical_failure
```

Only `authenticated` carries a trusted principal. Every other outcome creates zero Visit and projects a stable non-success Application result.
No provider raw reason、token content or internal account locator may cross the raw firewall.

### 4.4 Purpose-bound contact evidence

Formal submission requires valid `contactName` and purpose-bound User.phone plus explicit authorization evidence. The evidence role proves only that the
contact value may be used for `appointment_or_consultant_contact`; it proves no account identity or ownership.

The verification outcome is one of：

```text
authorized
missing
declined
expired
invalid
unavailable
technical_failure
```

Only `authorized` may yield a validated private contact value for Backend persistence. Other outcomes create zero Visit, return no accepted receipt and
preserve local draft semantics. Exact provider、consent screen、proof encoding and transport are not frozen by this Contract.

Institution official phone and Consultant phone are never fallback User.phone.

## 5. Anonymous Draft to Authenticated Submission

The legal handoff is：

```text
anonymous/local AppointmentLocalDraftV1
  ↓ explicit user submit action
auth required when trusted principal is absent
  ↓ successful Backend validation of auth evidence
same preserved draft + explicit continuing/new submit confirmation
  ↓ contact and command validation
formal authenticated submission attempt
```

- auth success alone MUST NOT submit a draft；
- cancelled/failed/expired/unavailable auth preserves draft and creates zero server truth；
- localDraftId never becomes server identity or idempotency key；
- Page may display an auth/contact requirement but cannot claim persistence or status；
- raw contact data must not be placed in route/query during handoff。

## 6. Application ↔ Backend Boundary

### 6.1 Versioned command role

The Backend submission command is a versioned transport projection of a validated C2 `AppointmentSubmissionV1` plus opaque evidence candidates.
It MUST preserve C2 business fields and MUST NOT accept these as client authority：

- `userId` or owner identity；
- `visitId`；
- Consultant assignment truth；
- Visit status；
- `acceptedAt`、`scheduledAt`、`completedAt` or `cancelledAt`；
- replay/commit success claims。

Application owns client-side shape validation and minimization. Backend MUST independently validate authorization、references、contact evidence and
idempotency before persistence. Passing Application validation alone never means accepted persistence.

### 6.2 Backend semantic result taxonomy

The Backend boundary returns exactly one semantic outcome：

| Outcome | Meaning | May carry authoritative receipt/Visit candidate |
|---|---|---|
| `accepted` | one new Visit was atomically committed | yes |
| `replayed` | an earlier committed identical logical submission was authoritatively replayed | yes, same identity/receipt |
| `rejected` | auth/contact/validation/reference authorization failed before commit | no |
| `conflict` | same trusted owner/key was reused with materially different canonical payload | no |
| `unavailable` | required owned service/provider is unavailable and commit is not proven | no |
| `technical_failure` | internal failure with no proven commit/result | no |

`rejected` reason maps only to the existing stable C2 public taxonomy：

```text
AUTH_REQUIRED
CONTACT_REQUIRED
VALIDATION_FAILED
REFERENCE_UNAVAILABLE
```

`conflict` maps to `IDEMPOTENCY_CONFLICT`; `unavailable` maps to `SERVICE_UNAVAILABLE`; unclassified internal failure maps to
`TECHNICAL_FAILURE`. No new Page-facing business status is created.

### 6.3 Accepted persistence candidate

Only `accepted` or `replayed` may carry an untrusted-to-Application persisted candidate. Application MUST still validate it through the C2 firewall.
The candidate must contain one exact `InstitutionVisitV1` with：

- trusted owner `userId` matching the authenticated principal；
- exact submitted Elder and Institution revision references；
- matching canonical visit intent and purpose-bound contact values；
- server-generated `visitId`；
- `status = requested`；
- server-generated `acceptedAt`；
- no transport、DB、auth/provider or stack metadata。

Malformed or mismatched candidates fail closed as stable technical failure and cannot reach Page.

## 7. Canonical Reference Authorization

Before commit, Backend MUST authoritatively verify：

1. trusted principal owns or is allowed to use the submitted persisted `elderId`；
2. exact `institutionId + institutionRecordRevision` resolves and is eligible for Appointment submission；
3. optional Consultant binding, if later performed by an authorized service, follows Consultant Contract and is never accepted from client authority。

Failure or uncertainty creates no Visit. Validation reads do not mutate Institution、ElderProfile、Recommendation or Consultant truth.

## 8. Atomic Create-or-Replay

One authoritative transaction boundary MUST cover：

```text
trusted principal authorization
+ elder ownership/authorization
+ exact institution revision eligibility
+ purpose-bound contact evidence validation
+ durable idempotency lookup and comparison
+ create one InstitutionVisit(status=requested) OR replay the committed one
+ persist authoritative visitId and acceptedAt
+ make the accepted/replay result durable
```

The transaction MUST satisfy：

- no accepted result before commit；
- no partial Visit or second truth object；
- no new `visitId` on replay；
- same logical committed submission has exactly one authoritative Visit；
- failure before commit returns no accepted receipt；
- an uncertain transport outcome is not evidence of either success or failure and is resolved by retrying the same idempotency scope。

Transaction framework、isolation primitive、table/index names and ORM are not frozen, but implementations must prove equivalent atomicity.

## 9. Durable Idempotency

### 9.1 Scope

The durable key is semantically scoped by：

```text
trusted authenticated userId
+ opaque idempotencyKey
+ canonical normalized C2 submission payload
```

Phone、contactName、Elder/Institution data and user identity must not be encoded into the key. The Backend may store a protected comparison representation,
but Page/logs/errors must never expose raw private canonical payload or fingerprint.

### 9.2 Outcomes

- no committed record for owner/key → eligible new attempt；
- committed same owner/key/canonical payload → `replayed` with the original `visitId` and semantically identical receipt；
- same owner/key with materially different payload → `conflict`, zero new Visit；
- different key → distinct attempt; no cross-key semantic deduplication is invented；
- pre-commit failure must not create a durable accepted record；
- uncertain outcome retries the original key until authoritative result is known。

Key generation、TTL and physical storage may vary, but expiration policy must not permit duplicate committed Visits for an unresolved retry.

## 10. Server Truth and Receipt Semantics

### 10.1 Server-only authority

Only committed Backend persistence owns：

- `visitId`；
- `acceptedAt`；
- initial `requested` status；
- accepted/replayed receipt truth。

Client clock、Page state、route、local draft、user statement、test fixture and network callback timing own none of these.

### 10.2 Accepted and replayed receipt

Both accepted and replayed results project the C2 `AppointmentSubmissionReceiptV1` semantics：

```text
status = requested
publicMessage = 预约申请已提交
```

They MUST preserve `SUBMITTED != CONFIRMED`. The receipt cannot say or imply Institution confirmation、scheduled Visit、completed Visit or consultant contact.
Replay must return the same authoritative `visitId` and accepted truth, not a new success event.

### 10.3 Non-success

Rejected、conflict、unavailable and technical failure carry no new `visitId`、server timestamp、Visit snapshot or success wording. Local draft retention remains
the client-safe action. Page must not route to a success state unless Application has validated an accepted/replayed committed candidate.

## 11. Retry and Duplicate Requests

- UI tap guard prevents local concurrent actions but is not the idempotency authority；
- repeated physical/client requests may occur and Backend must enforce durable idempotency；
- timeout、disconnect or unknown client outcome must retry the same idempotency key；
- client must not generate a new key merely to escape an unknown outcome；
- Backend retry of internal work must not create a second Visit；
- conflict is terminal for that owner/key/payload mismatch and must not be silently treated as replay；
- transport-level duplicate delivery may not alter accepted/replayed business truth。

## 12. Privacy, Raw Error Firewall and Secrets

### 12.1 Private data

The following are private/internal and must not appear in public receipt、public Page/ViewModel output、route、query、analytics、generic logs or test snapshots：

- raw User.phone and contactName；
- raw auth/session evidence；
- raw phone authorization/provider evidence；
- internal user/account/provider locator；
- canonical private payload or fingerprint；
- DB row/key/transaction/constraint details；
- stack trace、internal exception、network/provider metadata；
- Secret、AppSecret、API key or credential。

### 12.2 Ownership

- Backend owns protected persistence and authorized access to private contact data；
- auth/phone providers own their raw evidence according to their future adapter Contract；
- Application receives only stable semantic outcomes；
- Page receives only C2 public-safe result/snapshot；
- logging、audit and support tooling must use redacted stable correlation, never raw private values。

Physical retention/deletion periods require future implementation policy, but must remain purpose-limited and must not convert phone into identity.

After an explicit Appointment/contact action, Page may hold purpose-bound contactName/User.phone only inside the C1-authorized local-draft/form interaction
boundary. Those values must not be exposed as public result/state、route/query data、logs、analytics、generic errors or test snapshots, and must be retained
or cleared only according to the local-draft semantics and the user's explicit action.

## 13. Page and Consumer Boundary

Page/ViewModel may：

- retain/edit local draft；
- trigger explicit auth、phone authorization and submit actions through approved Application services；
- display stable validation/auth/contact/service errors；
- display accepted receipt only after C2 Application validation。

Page/ViewModel MUST NOT：

- self-declare user identity or auth success；
- treat phone as identity；
- construct `visitId` or server timestamp；
- claim requested/confirmed/scheduled/completed from tap、route、clock or local storage；
- turn network success into business success without committed Backend result；
- infer replay/conflict or bypass idempotency；
- read raw provider/Backend error。

Appointment Page、success Page and owner history implementation remain out of C3.

## 14. Mock and Test Isolation

Allowed deterministic Contract examples/test doubles MUST carry explicit `TEST_ONLY` provenance. They may exercise auth/contact/reference/idempotency/result cases,
but MUST NOT：

- enter production dependency graph；
- use real phone、identity、Institution or Visit data；
- register as production auth、phone、Backend or repository capability；
- generate production-looking accepted truth or owner history；
- manufacture `completed` to unlock VisitEvaluation；
- silently replace missing production adapters。

With no real adapters, production behavior remains `AUTH_REQUIRED` or `SERVICE_UNAVAILABLE`, never synthetic accepted success.

## 15. Deferred Capability and Cross-Domain Isolation

- owner-read/“我的预约” requires a later authenticated read Contract/implementation；
- lifecycle mutation requires a later authorized Operations command/audit boundary；
- VisitEvaluation remains locked without real `visitId + authoritative completed`；
- Recommendation recompute/rerank/write/matching remains zero/none；
- Institution facts/revision、ElderProfile、Consultant assignment/contact and AI truth remain read-only or untouched according to their own Contracts；
- C3 creates no login UX、account merge、notification、CRM or public evaluation behavior。

## 16. Layer Ownership

| Layer | Owns | Must not own |
|---|---|---|
| C2 Domain | command/object validation、lifecycle and idempotency comparison semantics | provider、network、DB、auth truth |
| Application | command minimization、stable port invocation、candidate validation、public result projection | account truth、commit truth、visitId/status invention |
| Auth boundary | auth evidence validation and trusted principal resolution | phone-as-identity、Appointment persistence |
| Phone boundary | purpose-bound authorization evidence and validated private contact | account identity、Visit status |
| Backend Visit service | authorization、canonical references、atomic persistence、durable idempotency、visitId/acceptedAt/requested truth | Page state、Recommendation/Institution writes |
| Page/ViewModel | input/action/display/local-draft interaction | auth/persistence/status truth |
| Operations successor | authorized post-request lifecycle commands and audit | account ownership、Page inference |

## 17. Mandatory C3 Contract Gate Evidence

| Gate | Result | Frozen evidence |
|---|---|---|
| 1 PHASE_AND_SOURCE_CONFORMANCE | PASS | C1/C2 remain PASS and unchanged; Product Source and Owner Decisions preserved; production/runtime/test changes are zero |
| 2 TRUSTED_PRINCIPAL_IDENTITY | PASS | Backend-only trusted principal resolution; phone/route/draft/command identity substitution forbidden |
| 3 AUTH_SESSION_OWNERSHIP | PASS | provider-neutral evidence candidate, trusted resolution outcomes and fail-closed anonymous/auth handoff frozen |
| 4 PURPOSE_BOUND_CONTACT_EVIDENCE | PASS | required contact, explicit authorization, purpose limitation, no fallback and privacy frozen |
| 5 SUBMISSION_WIRE_BOUNDARY | PASS | versioned C2 command/result mapping and client-forbidden authority fields frozen without transport choice |
| 6 CANONICAL_REFERENCE_AUTHORIZATION | PASS | Elder owner/authorization and exact Institution revision resolution fail closed without cross-domain write |
| 7 ATOMIC_PERSISTENCE | PASS | one create-or-replay transaction, commit truth and failure-before-commit semantics frozen |
| 8 SERVER_VISIT_ID_AND_TIMESTAMP_AUTHORITY | PASS | only committed Backend persistence owns visitId、acceptedAt and initial requested |
| 9 DURABLE_IDEMPOTENCY | PASS | trusted owner/key/canonical payload scope、replay、conflict and uncertain retry frozen |
| 10 RESULT_AND_RAW_ERROR_FIREWALL | PASS | accepted/replayed/rejected/conflict/unavailable/technical outcomes mapped to C2 public-safe taxonomy |
| 11 PRIVACY_AUDIT_RETENTION_OWNERSHIP | PASS | private contact/evidence/Secret exclusion、redaction and protected ownership frozen |
| 12 NO_FAKE_PERSISTENCE_AND_MOCK_ISOLATION | PASS | no real adapter and no synthetic production success; TEST_ONLY boundary explicit |
| 13 DEFERRED_CAPABILITY_ISOLATION | PASS | Page、owner-read、Operations mutation and VisitEvaluation remain deferred |
| 14 CROSS_DOMAIN_ISOLATION | PASS | Recommendation、Institution、ElderProfile、Consultant and AI semantic/write changes remain zero |
| 15 DOWNSTREAM_BOUNDARY_AND_QA | PASS | implementation ownership/evidence boundary frozen; targeted document governance and independent QA required |

## 18. Downstream Implementation Boundary

C3 PASS authorizes only successor discovery. A future implementation phase must select the smallest lawful slice and freeze layer-specific Gates. Likely
implementation work may include trusted auth/session adapter、purpose-bound phone adapter or self-owned Backend persistence foundation, but C3 does not
preselect their ordering beyond these dependencies：

```text
trusted principal and purpose-bound contact evidence
  before
committed Visit persistence
  before
Page accepted-success integration / owner-read / Operations mutation
```

Backend implementation evidence must include transaction/idempotency concurrency、authorization、migration、private-data and raw-firewall tests. UI evidence
cannot substitute for Backend persistence proof. Page/DevTools/Android Gates apply only when a later phase changes user-visible runtime.

## 19. Completion Result

```text
PHASE_V1_2_C3 = PASS
C3_CONTRACT = FROZEN
AUTHENTICATED_VISIT_PERSISTENCE_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS

TRUSTED_PRINCIPAL_BOUNDARY = PASS
AUTH_SESSION_OWNERSHIP = FROZEN
PHONE_EVIDENCE_BOUNDARY = FROZEN
APPLICATION_BACKEND_BOUNDARY = FROZEN
ATOMIC_CREATE_OR_REPLAY = FROZEN
DURABLE_IDEMPOTENCY = FROZEN
VISIT_ID_AUTHORITY = SERVER_ONLY
TIMESTAMP_AUTHORITY = SERVER_ONLY
SUBMITTED_NOT_CONFIRMED = PRESERVED
RAW_ERROR_FIREWALL = PASS
MOCK_ISOLATION = PASS

PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
C1_CONTRACT_CHANGE = 0
C2_SEMANTIC_CHANGE = 0
PRODUCT_SOURCE_SEMANTIC_CHANGE = 0

RUNTIME_TESTS = NOT_REQUIRED / NOT_RUN
DEVTOOLS = NOT_REQUIRED / NOT_RUN
ANDROID = NOT_REQUIRED / NOT_RUN
FULL_REPOSITORY_TESTS = NOT_RUN

PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C3_SUCCESSOR = TRUE
```

## 20. Change Policy

- This Contract is immutable within V1 once frozen；
- provider、session、wire、DB、phone or Page implementation may not silently redefine it；
- new identity role、phone purpose、persistence object、result state or lifecycle behavior requires explicit successor/version review；
- implementation-specific security details may remain private, but their behavior must satisfy this public architecture boundary；
- C3 changes no existing Frozen Contract or Product Source。
