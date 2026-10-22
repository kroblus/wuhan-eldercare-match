# Appointment & InstitutionVisit Contract V1

状态：`FROZEN`

Contract ID：`appointment-institution-visit-contract-v1`

冻结日期：`2026-09-17`

适用阶段：`V1.2-C1`

```text
PHASE_V1_2_C1 = PASS
C1_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS
OWNER_DECISION = CLOSED
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C1_SUCCESSOR = TRUE
```

本文冻结 V1.2 Appointment submission 与 `InstitutionVisit` 的唯一正式 Domain/Application 语义。后续
TypeScript/Java runtime、Page、Backend、API、数据库、认证、持久化、运营工具和 VisitEvaluation successor 必须服从
本文；不得让当前 scaffold、旧通用 `Appointment` type 或实现便利反向修改本 Contract。

## 1. Authority and Source Order

本 Contract 依次遵守：

1. 项目负责人于 `2026-09-17` 明确批准的 anonymous/auth/contact Owner Decision；
2. `docs/product/README.md` 路由的两份 Current V1.2 Product Source PDF；
3. `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` 的 canonical Institution identity 与 revision boundary；
4. `CONSULTANT_PERMISSION_CONTRACT_V1.md` 的 Consultant assignment/contact 与 User.phone boundary；
5. `AI_CONSULTATION_CONTRACT_V1.md` 的 Appointment/Visit/Evaluation zero-write boundary；
6. CURRENT `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
7. `V1_2_C1_PHASE_HANDOFF.md` 的 phase scope、ownership、15 Gates 与 completion criteria；
8. 本 Contract 对 Appointment submission / InstitutionVisit 新增的 versioned frozen semantics。

`server/README.md`、现有 Appointment scaffold 与旧 `miniprogram/types/domain.ts` 只证明当前实现状态，不是业务
Source of Truth。若本文与更高优先级 Frozen Contract 发生真实冲突，必须停止实现并报告最小冲突，不得修改旧 Contract
或 Product Source 来适配本文。

## 2. Normative Language and Scope

- **MUST / 必须**：所有后续实现均需满足；
- **MUST NOT / 禁止**：任何层均不得提供；
- **MAY / 可以**：允许但不强制，不能被 implementation 偷换成新的产品承诺。

### 2.1 In scope

- anonymous Appointment form entry 与 client-local draft；
- authenticated formal submission 与 server persistence gate；
- `AppointmentSubmissionV1` command/receipt boundary；
- 唯一 authoritative `InstitutionVisitV1` aggregate；
- canonical identity、ownership、permission/read boundary；
- formal submission required fields；
- purpose-bound contact name/User.phone；
- `SUBMITTED != CONFIRMED`；
- five-state Visit lifecycle 与 Backend/Operations authority；
- idempotency、duplicate submit、retry/replay/conflict semantics；
- public/client-safe Application result 与 failure boundary；
- future VisitEvaluation prerequisite；
- Recommendation、Institution、Consultant、AI 与 Mock isolation。

### 2.2 Out of scope

- Mini Program runtime、Page/ViewModel、WXML、Less 或 navigation implementation；
- Backend project、Controller、REST/RPC endpoint、DTO、DB schema、ORM、migration 或 deployment；
- auth/session/login/User.phone API 的具体实现；
- encryption algorithm、credential、retention TTL、physical audit table 或 deletion job；
- real User/Elder/Institution/Consultant/phone/Appointment/Visit data；
- CRM、operations console、notification、calendar 或 transport provider；
- VisitEvaluation fields、submission runtime、Page、persistence 或 verification-lead workflow；
- Recommendation、Institution、ElderProfile、Consultant、AI 或 Product Source 修改。

## 3. Frozen Owner Decisions

以下决策已关闭，不得由后续 Page、Application、Backend 或 provider 重新解释：

```text
ANONYMOUS_FORM_ENTRY = ALLOWED
ANONYMOUS_LOCAL_DRAFT = ALLOWED
SERVER_PERSISTENCE_REQUIRES_AUTH = TRUE

CONTACT_NAME_FOR_FORMAL_SUBMISSION = REQUIRED
PURPOSE_BOUND_USER_PHONE_FOR_FORMAL_SUBMISSION = REQUIRED

MISSING_OR_DECLINED_CONTACT_NAME = NO_SERVER_RECORD_CREATED
MISSING_OR_DECLINED_CONTACT_PHONE = NO_SERVER_RECORD_CREATED
LOCAL_DRAFT_ON_INCOMPLETE_CONTACT = PRESERVED

USER_PHONE_IS_ACCOUNT_IDENTITY = FALSE
PHONE_USE_PURPOSE = APPOINTMENT_OR_CONSULTANT_CONTACT_ONLY

AUTHENTICATED_IDENTITY_OWNS =
  SERVER_RECORD_ATTRIBUTION
  IDEMPOTENT_SUBMISSION_SCOPE
  MY_APPOINTMENTS_ACCESS
  VISIT_LIFECYCLE_ACCESS
  FUTURE_VISIT_EVALUATION_VISIT_ID_RELATION
```

登录成功本身不得自动提交草稿。服务端 persistence 必须仍然属于用户明确发起的 Appointment submit action；auth 只关闭
identity gate，不替代 contact consent、field validation 或 submit intent。

## 4. Canonical Object Model

### 4.1 Exactly three legal roles

V1 只冻结以下三个不同角色：

1. `AppointmentLocalDraftV1`：client-local、未提交、非 authoritative；
2. `AppointmentSubmissionV1`：Application command 与 acceptance/failure receipt；不是 persisted Domain aggregate；
3. `InstitutionVisitV1`：唯一 server-persisted Appointment/Visit operational aggregate。

本文不创建独立 persisted `AppointmentRequest`、`AppointmentRecord` 或第二套 appointment lifecycle。Current Product Source
将 `InstitutionVisit` 列为 V1.2-C 核心数据对象；Appointment 页面描述的是提交 action 和 receipt。后续如确需独立 request
aggregate，必须走新的 Contract/version，不得在 Backend schema 中静默添加第二个 truth owner。

### 4.2 No identity substitution

- `localDraftId` 不是 `visitId`；
- `idempotencyKey` 不是 `visitId`、`userId` 或 account identity；
- User.phone 不是 `userId`、login credential 或 ownership proof；
- Institution name 不是 canonical Institution identity；
- Consultant phone/Institution official phone 不是 User.phone；
- submission receipt 不是第二个 persisted Appointment object；
- UI state、route presence、date/time passage 或 user statement 不是 Visit status evidence。

## 5. AppointmentLocalDraftV1

### 5.1 Nature and allowed behavior

Anonymous and authenticated users MAY：

- enter the Appointment form；
- fill fields permitted by this Contract；
- save and restore a temporary client-local draft；
- edit or delete that local draft。

The draft MUST：

- carry explicit `LOCAL_DRAFT_ONLY` provenance；
- remain outside server persistence and “我的预约” history；
- create no `visitId`、server record、operational status or success receipt；
- never display itself as `submitted`、`requested`、`contacting`、`scheduled`、`completed` or `cancelled`；
- never be used to unlock VisitEvaluation；
- retain user-entered data after auth cancellation/failure、contact validation failure、network failure or service failure unless
  the user explicitly clears it；
- not auto-submit merely because login succeeds or the Page reloads。

### 5.2 Draft identity and privacy

`localDraftId` is a client-local opaque identifier only. It MUST NOT be sent or accepted as a server business identity.

Local draft storage MAY contain purpose-bound contact name and phone only after an explicit Appointment/contact action. Future
implementation MUST minimize local fields and MUST NOT put raw contact data into route/query、logs、analytics、crash metadata、
Mock or test snapshots. Physical storage、expiry and encryption are implementation decisions, but may not weaken these invariants.

### 5.3 Authentication handoff

When an anonymous user requests formal submission：

1. Application MUST preserve the local draft；
2. Application MUST require authenticated identity before any server write；
3. cancelled/failed/unavailable auth MUST return a client-safe non-success result；
4. zero partial Appointment/Visit record may be created；
5. after auth, persistence may continue only as the same explicit submit intent or a new explicit confirmation；login alone never submits。

## 6. AppointmentSubmissionV1

### 6.1 Command, not aggregate

`AppointmentSubmissionV1` is a versioned Application command envelope. It expresses an authenticated user's explicit request to
create one server-persisted `InstitutionVisitV1`. It is not a second Domain aggregate and owns no lifecycle.

The command MUST semantically contain：

- Contract/version identity；
- opaque `idempotencyKey` generated for one logical submit action；
- exact `institutionId + institutionRecordRevision`；
- authenticated-owned or authorized, server-resolvable `elderId`；
- requested visit date and time preference；
- participant count；
- pickup request only when truthful support is established；
- required `contactName`；
- required purpose-bound User.phone；
- explicit phone purpose/authorization evidence for Appointment or Consultant contact；
- optional user notes；
- no client-supplied `userId`、`visitId`、`consultantId`、Visit status or operational timestamps。

Field transport encoding, phone provider token, API DTO and DB columns are out of scope. Any future adapter MUST preserve these
semantics exactly and fail closed on missing/invalid required data.

### 6.2 Formal submission preconditions

Server persistence is allowed only if all are true：

```text
authenticated principal is valid
AND authenticated user owns/is authorized for elderId
AND exact Institution revision is resolvable and appointment-eligible
AND all Contract-required visit intent fields are valid
AND contactName is valid and non-empty
AND purpose-bound User.phone is valid and explicitly authorized
AND idempotencyKey is valid
AND Backend can atomically create or replay the authoritative Visit
```

Missing、invalid、declined or unavailable contact name/phone MUST：

- create no server record；
- create no `visitId`；
- return no fake success；
- retain the local draft；
- never fall back to Consultant phone or Institution official phone。

The same no-write rule applies to auth failure、unauthorized elder、ineligible Institution revision、invalid submission or a failure
before atomic persistence succeeds.

### 6.3 Required and conditional semantic fields

| Semantic field | Formal submission | Rule |
|---|---|---|
| Institution identity | required | exact `institutionId + institutionRecordRevision` |
| Elder identity | required | authorized persisted `elderId`; local/raw profile is not enough |
| Visit date | required | explicit user intent; no Page-generated operational fact |
| Visit time preference | required | preference only, not confirmed schedule |
| Participant count | required | positive user-provided count |
| Pickup | conditional | only when the capability is truthfully supported; absence does not imply support |
| Contact name | required | purpose-bound private contact data |
| User.phone | required | purpose-bound private contact data, never account identity |
| Notes | optional | user-provided private note; never Institution fact |
| Consultant identity | client forbidden | resolved/set by authorized service/operations only |
| Visit status/timestamps | client forbidden | Backend/Operations truth only |

## 7. Canonical Identity and Ownership

### 7.1 Authenticated user

- `userId` MUST come from a trusted authenticated principal, never command body, phone, route or local draft；
- the authenticated user owns the created Visit record and its “我的预约” access scope；
- other ordinary users MUST be denied；
- account/identity matching by phone is forbidden。

### 7.2 Elder

- persisted submission requires a stable `elderId` resolvable by the Backend；
- Backend MUST verify the authenticated user may act for that Elder；
- anonymous/local Assessment, raw profile or display name MUST NOT be promoted into a persisted `elderId`；
- if no authorized persisted Elder reference exists, formal submission fails closed and the local draft remains；
- C1 does not define Elder creation/migration implementation。

### 7.3 Institution revision

The Visit MUST bind the exact canonical pair captured at submission：

```text
institutionId
institutionRecordRevision
```

- institution name、list index or latest-record lookup is forbidden；
- the record MUST NOT auto-upgrade to a newer revision on save/read；
- historical、suspended or archived revisions remain forbidden for Appointment creation；
- invalid/ineligible/unresolvable revision creates no Visit；
- Visit binding never modifies Institution facts、verification、evidence or revision。

### 7.4 Consultant

- `consultantId` is optional at initial `requested` creation unless an authorized Consultant resolution already exists；
- Page/client MUST NOT select, invent or trust a route-provided consultantId；
- assignment/profile/contact remain owned by Consultant Service；
- authorized Backend/Operations may bind a resolved consultant according to that Contract；
- no Appointment/Visit logic may copy the assignment resolver or use Institution official phone as fallback。

### 7.5 Visit

- `visitId` is an opaque stable identity generated only by the Backend/Visit service after atomic accepted persistence；
- client/local draft cannot generate, reserve or infer it；
- exactly one authoritative `InstitutionVisitV1` is created per accepted logical idempotent submission；
- the same accepted idempotent retry MUST return the same `visitId`。

## 8. Submission Receipt and Truth

### 8.1 Accepted result

Only after authenticated validation and atomic persistence succeeds may Application return an accepted receipt with：

- `visitId`；
- exact Institution identity；
- initial authoritative status `requested`；
- server acceptance time；
- client-safe wording equivalent to “预约申请已提交”。

The receipt is a projection/result, not an independently persisted Appointment Domain object.

### 8.2 Frozen distinctions

```text
SUBMITTED_REQUEST != CONFIRMED_VISIT
REQUESTED != CONTACTING
REQUESTED != SCHEDULED
SCHEDULED != COMPLETED
LOCAL_DRAFT != SUBMITTED_REQUEST
```

- accepted/submitted means the Backend persisted the Visit in `requested`；
- it does not mean a Consultant has contacted the user；
- it does not mean a plan is confirmed；
- it does not mean the Institution accepted or guaranteed capacity；
- it does not mean the visit occurred；
- `confirmed` is not a V1 lifecycle code; confirmed-plan presentation maps only from authoritative `scheduled`。

### 8.3 Stable Application result boundary

Future Application implementation MUST expose a versioned client-safe union equivalent to：

- accepted/requested；
- auth required；
- contact required/declined；
- validation failed；
- Institution/Elder unavailable or unauthorized；
- idempotency conflict；
- service unavailable；
- technical failure。

Only accepted/requested carries a `visitId`. All non-success results create no new Visit and MUST NOT display submission success.
Provider/DB/auth raw errors, stack traces and internal identifiers MUST NOT become Page contract.

## 9. InstitutionVisitV1 Aggregate

The persisted aggregate MUST semantically retain：

- contract/object version；
- server-generated `visitId`；
- authenticated owner `userId`；
- authorized `elderId`；
- exact `institutionId + institutionRecordRevision`；
- optional authoritative `consultantId`；
- requested visit intent needed for service fulfillment；
- private purpose-bound contact name and User.phone；
- current `InstitutionVisitStatusV1`；
- only truthful operational timestamps；
- private user note when supplied；
- provenance/audit required by Backend policy without exposing it publicly。

This aggregate is the only V1 operational Appointment/Visit truth. It MUST NOT contain raw Assessment、full ElderProfile、
Recommendation internals、Institution evidence locator、Consultant private profile、Secret or provider credential.

## 10. Visit Lifecycle

### 10.1 Frozen status codes

```text
requested  = persisted intent; waiting for authorized follow-up
contacting = authorized Consultant/Operations is communicating
scheduled  = operational visit plan is confirmed
completed  = authorized source confirms the visit occurred
cancelled  = visit process ended by an authorized cancellation outcome
```

No `draft`、`submitted`、`confirmed`、`unknown` or UI loading/error code may enter the Domain status enum. Draft/submission/Application
failures remain separate concerns.

### 10.2 Legal transition matrix

| From | Legal next states | Notes |
|---|---|---|
| create | `requested` | only initial persisted state |
| `requested` | `contacting`, `scheduled`, `cancelled` | scheduled may be reached when a real plan is already confirmed |
| `contacting` | `scheduled`, `cancelled` | communication alone is not scheduling |
| `scheduled` | `completed`, `cancelled` | completed requires real operational evidence |
| `completed` | none | terminal in V1 |
| `cancelled` | none | terminal in V1 |

- backward transition is forbidden；
- direct `requested/contacting -> completed` is forbidden；
- repeated write of the same status MAY be treated as an idempotent no-op, not a new event；
- reopening, rescheduling after cancellation, correction or status-history revision requires a future Contract/version；
- failure to determine status does not create an `unknown` Domain status; Application returns unavailable/failure without inventing truth。

### 10.3 Status authority

```text
STATUS_AUTHORITY = BACKEND_OPERATIONS
PAGE_STATUS_INFERENCE = FORBIDDEN
TIME_BASED_COMPLETION_INFERENCE = FORBIDDEN
USER_SELF_ASSERTED_COMPLETION = NOT_AUTHORITATIVE
```

Only Backend plus role-authorized Consultant/Operations actions may persist status changes. A user MAY request cancellation, but the
request does not itself mutate the Domain status; only the authoritative result can become `cancelled`.

## 11. Idempotency and Duplicate Submission

### 11.1 Scope

Idempotency is scoped by：

```text
authenticated userId
+ opaque idempotencyKey
+ canonical normalized submission payload
```

The `idempotencyKey` MUST：

- be stable for one logical submit action and all its retries；
- contain no phone、name、userId、Elder/Institution fact or other PII；
- not be a `visitId` or ownership proof；
- be replaced only for a deliberate new submission action after the prior outcome is known or abandoned。

### 11.2 Replay and conflict

- same authenticated user + same key + same canonical payload after a successful commit MUST replay the original accepted receipt and
  same `visitId`；
- it MUST NOT create a second Visit；
- same authenticated user + same key + materially different payload MUST fail closed as idempotency-key reuse conflict；
- different key is a distinct submission attempt; V1 does not invent cross-key semantic deduplication；
- a failure before atomic commit MUST NOT return accepted success；
- an uncertain transport result MUST be resolved through the same idempotency key, not by issuing a new blind submit。

Canonical comparison includes all business-relevant submission fields. Implementation MUST protect private values and MUST NOT expose
payload fingerprints, raw contact data or comparison details to Page/logs. Key format、TTL、table/index and transaction technology remain
Backend implementation choices, but may not weaken these semantics.

## 12. Permission and Read Boundary

| Actor | Draft | Submit | Read Visit/history | Mutate lifecycle | Read private contact |
|---|---|---|---|---|---|
| Anonymous visitor | local only | auth required; no server write | forbidden | forbidden | local user-entered field only |
| Authenticated owner | local + owned flow | allowed when all Contract gates pass | own records only | may request actions; cannot directly set status | own submitted contact through authorized flow only |
| Other ordinary user | own local draft only | own authenticated flow only | forbidden for others | forbidden | forbidden |
| Assigned/authorized Consultant | n/a | may assist only under future authorized actor rules | minimum assigned business scope | role-authorized command only | minimum necessary scope |
| Operations | n/a | may assist/enter only with actor attribution | authorized operational scope | authorized source of truth | minimum audited scope |
| Public/AI/Recommendation | none | forbidden | public process explanation only | forbidden | forbidden |

“我的预约” and any persisted history MUST query by authenticated ownership/authorization. A phone match, local ID, route parameter or
knowledge of a `visitId` is never sufficient authorization.

## 13. Contact Name, User.phone and Privacy

### 13.1 Required formal contact

```text
CONTACT_NAME_REQUIRED = TRUE
PURPOSE_BOUND_PHONE_REQUIRED = TRUE
USER_PHONE_IS_ACCOUNT_IDENTITY = FALSE
```

Both contact name and purpose-bound User.phone are required for formal server persistence. Missing、empty、invalid、declined、cancelled or
unavailable contact acquisition means：

- no server record；
- no `visitId`；
- no accepted receipt；
- local draft preserved；
- client-safe explanation/retry path only。

### 13.2 Purpose and separation

User.phone may be used only to fulfil the explicit Appointment or Consultant-contact purpose approved by the user. It MUST NOT：

- identify or authenticate an account；
- be copied from Consultant public phone or Institution official phone；
- fall back to either of those numbers；
- be used for Recommendation, Institution matching, AI context or marketing expansion；
- appear in route/query、public snapshot、logs、analytics、fixtures、error messages or source refs；
- be disclosed to unrelated Institutions, users or providers。

### 13.3 Backend privacy ownership

Backend owns future secure storage、access control、masking、audit、retention and deletion implementation. C1 does not choose cryptography
or TTL, but any implementation MUST preserve data minimization and purpose limitation. Page receives only the minimum client-safe result
needed for the active owner flow.

## 14. Consultant Boundary

- Consultant Service remains the sole owner of profile、assignment、service/contact state and default semantics；
- Appointment/Visit may consume an authorized resolved consultant reference but must not run or copy the resolver；
- `consultantId` and contact channels are never accepted from untrusted Page payload as authoritative；
- submission does not claim that a Consultant has contacted, accepted or confirmed the request；
- platform Consultant contact and Institution official contact remain different identities and must not fall back to one another；
- Consultant assistance does not transfer Visit ownership away from the authenticated user；
- future Operations/Consultant data entry must retain actor attribution and cannot impersonate the user。

## 15. VisitEvaluation Prerequisite

Future VisitEvaluation creation requires all of：

```text
authenticated authorized user
+ real server-generated visitId
+ exact Institution identity bound to that Visit
+ authoritative InstitutionVisit.status = completed
```

Local draft、submission receipt without a persisted Visit、scheduled date passage、user statement、Page state、Mock data or AI answer can
never satisfy this prerequisite.

VisitEvaluation remains：

- `USER_REPORTED_DATA`；
- private user/operations service record in V1.2；
- no direct Institution fact/revision write；
- no Recommendation input、weight、rank or rating；
- no public Institution rating/community。

C1 freezes only this prerequisite. Evaluation fields、submission states、Foundation、UI、Backend and optional VerificationLead workflow
require a future versioned Contract/successor.

## 16. Cross-Domain Isolation

### 16.1 Recommendation

```text
APPOINTMENT_RECOMMENDATION_MATCHING_ROLE = NONE
INSTITUTION_VISIT_RECOMMENDATION_MATCHING_ROLE = NONE
VISIT_EVALUATION_RECOMMENDATION_MATCHING_ROLE = NONE
RECOMMENDATION_WRITE = FORBIDDEN
RECOMMENDATION_RERANK = FORBIDDEN
RECOMMENDATION_OVERRIDE = FORBIDDEN
```

Visit intent/status/contact data cannot change Safety、Eligibility、Exactness、PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` or ordering.

### 16.2 Institution

- Visit references an exact Institution revision but never modifies it；
- submission/contact/status are service-operation facts, not Institution verified facts；
- Visit/Evaluation cannot convert unknown/unverified/expired facts into verified facts；
- future user feedback may only become a verification lead through a separately frozen manual verification path。

### 16.3 ElderProfile and Assessment

- submission may reference authorized `elderId` but cannot read/write raw Assessment or full ElderProfile；
- Visit data cannot update assessment answers, profile scores or Recommendation input；
- health/special-care information not explicitly required by this Contract must not enter Appointment payload。

### 16.4 AI

- AI/approved FAQ may explain process information only；
- AI cannot submit, confirm, schedule, complete or cancel a Visit；
- AI cannot read User.phone or private Visit record；
- AI cannot unlock VisitEvaluation or claim an Appointment succeeded。

## 17. Mock and Fixture Isolation

Future deterministic fixture MAY cover draft、submission、idempotency、status and permission cases only with explicit TEST_ONLY provenance.

Fixture/mock MUST NOT：

- enter production dependency graph；
- contain real User.phone or private contact data；
- create production `visitId` or Appointment truth；
- masquerade as Backend/Operations state；
- use fake `completed` status to unlock production VisitEvaluation；
- mutate Institution、Recommendation、Consultant、ElderProfile or AI truth。

Production with no Backend/provider MUST remain honestly unavailable; it may not silently use a test repository or in-memory fake submit.

## 18. Layer Ownership and Future Ports

| Layer | Owns | Must not own |
|---|---|---|
| Domain | versioned identity、Visit states、transition legality、submission truth、idempotency semantics | UI、network、DB、auth provider |
| Application | draft-to-command validation、auth/contact gates、stable result、privacy minimization、read-only/write-command ports | raw provider schema、status invention、direct DB |
| Backend/Visit Service | authenticated ownership、atomic persistence、visitId、idempotency enforcement、status truth、authorized reads | Page semantics、Recommendation/Institution writes |
| Consultant/Operations | authorized follow-up/status commands within role | account ownership、silent user impersonation |
| Page/ViewModel | input mapping、local draft action、display/action state、user-visible errors | business identity、persistence truth、status inference |
| VisitEvaluation successor | completed Visit consumer | premature implementation in C1 |

Future ports may express authenticated submit、owner read/list、authorized operational transition and cancellation request. C1 does not freeze
REST paths、HTTP verbs、DTO names、DB schema、framework or deployment topology.

## 19. Mandatory Gate Evidence

| Gate | Result | Frozen evidence |
|---|---|---|
| 1 PHASE_TRANSITION | PASS | B7 remains PASS; C1 only creates Contract/governance docs |
| 2 OWNER_DECISION_CAPTURE | PASS | anonymous draft/auth persistence/contact requiredness/phone identity decisions recorded in Section 3 |
| 3 OBJECT_AND_IDENTITY_MODEL | PASS | local draft, submission command/receipt and single persisted InstitutionVisit separated |
| 4 SUBMISSION_TRUTH | PASS | accepted/requested is not confirmed/scheduled/completed; no fake success |
| 5 VISIT_LIFECYCLE | PASS | exact five states, transition matrix, terminal states and authority frozen |
| 6 IDENTITY_AUTH_PERMISSION | PASS | server persistence requires auth; owner/read/role matrix frozen |
| 7 PHONE_PRIVACY | PASS | contactName/phone required, purpose-bound, non-identity, no fallback/leakage |
| 8 BACKEND_PERSISTENCE_OWNERSHIP | PASS | Backend owns atomic truth/idempotency/status; protocol implementation deferred |
| 9 CONSULTANT_CONTACT_ISOLATION | PASS | existing resolver/contact identity reused, never copied/fallback |
| 10 VISIT_EVALUATION_PREREQUISITE | PASS | real `visitId + completed` and authenticated authorization required |
| 11 CROSS_DOMAIN_ISOLATION | PASS | Recommendation/Institution/ElderProfile/AI writes and matching remain forbidden |
| 12 MOCK_PROVENANCE | PASS | TEST_ONLY, zero production truth/import, no fake completed unlock |
| 13 DOWNSTREAM_IMPLEMENTATION_BOUNDARY | PASS | Domain/Application/Backend/Page ownership and future ports are explicit |
| 14 CROSS_DOCUMENT_QA | PASS | Product Source and applicable Frozen boundaries reviewed; independent final QA required before commit |
| 15 PRODUCTION_ISOLATION | PASS | production/runtime/test/mock changes = 0 |

## 20. C1 Completion and Successor Boundary

```text
PHASE_V1_2_C1 = PASS
C1_CONTRACT = FROZEN
MANDATORY_GATES = 15/15 PASS

OWNER_DECISION = CLOSED
CONTACT_NAME_REQUIRED = TRUE
PURPOSE_BOUND_PHONE_REQUIRED = TRUE
ANONYMOUS_FORM_ENTRY = ALLOWED
ANONYMOUS_LOCAL_DRAFT = ALLOWED
SERVER_PERSISTENCE_REQUIRES_AUTH = TRUE
USER_PHONE_IS_ACCOUNT_IDENTITY = FALSE

SUBMITTED_NOT_CONFIRMED = PASS
VISIT_LIFECYCLE = FROZEN
STATUS_AUTHORITY = BACKEND_OPERATIONS
IDENTITY_MODEL = FROZEN
IDEMPOTENCY_BOUNDARY = FROZEN
VISIT_EVALUATION_PREREQUISITE = REAL_VISIT_ID + COMPLETED

PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_FOR_C1_SUCCESSOR = TRUE
```

C1 PASS only authorizes Post-C1 successor discovery. It does not authorize runtime、Backend、auth、DB、API、Appointment UI or
VisitEvaluation implementation. The next phase must define the smallest Foundation slice and its layer-specific runtime/API/evidence Gates.

## 21. Change Policy

- This Contract is immutable within V1 once frozen；
- field/identity/status/permission/phone/idempotency changes require a versioned successor；
- Backend schema or Page implementation may not silently redefine Domain semantics；
- no existing Frozen Contract or Product Source was changed by C1；
- unresolved future implementation choices must remain within this Contract's boundaries, not become new product behavior。
