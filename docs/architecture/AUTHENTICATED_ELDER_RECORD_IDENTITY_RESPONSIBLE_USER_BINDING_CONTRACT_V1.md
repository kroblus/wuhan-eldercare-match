# Authenticated Elder Record Identity and Responsible User Binding Contract V1

状态：`FROZEN`

Contract ID：`authenticated-elder-record-identity-responsible-user-binding-contract-v1`

版本：`V1`

适用范围：`V1.2 Appointment prerequisite — authenticated ElderRecord identity and responsible-user binding`

```text
ELDER_ACCOUNT_MODEL_V1 = ONE_RESPONSIBLE_C5_USER_TO_ONE_ELDER_RECORD
FAMILY_ACCOUNT_MODEL_V1 = NONE
MULTI_ELDER_MANAGEMENT_V1 = NOT_SUPPORTED
CROSS_ACCOUNT_ELDER_SHARING_V1 = NOT_SUPPORTED
APPOINTMENT_ELDER_SELECTION_V1 = IMPLICIT_SINGLE_BOUND_RECORD
SUPERSEDES = NONE
OWNER_DECISIONS = CLOSED
```

本文冻结 V1 中 `ElderRecord` 的稳定身份、唯一 C5 负责用户绑定及其在正式 Appointment 中的引用 authority。它补齐 Appointment 所需的身份与授权边界，不实现 API、存储或页面。

## 1. Authority, Source Reconciliation and Related Contracts

本 Contract 继承以下冻结语义，不复制或改写它们：

1. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`（C3）定义正式 Visit 提交的 trusted authenticated principal、opaque `userId`、Elder reference authorization 与失败关闭边界。
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`（C1）定义 Appointment / Visit、其 `elderId` reference、精确 Institution revision 与 Visit 生命周期。本文只冻结 C1 在 V1 当前支持的 Elder ownership 子集。
3. `ASSESSMENT_CONTRACT_V2.md` 定义 Assessment draft、完成态及历史版本语义。
4. `ELDER_PROFILE_CONTRACT_V2.md` 定义 `CompletedAssessmentV2 -> ElderProfileV2` 派生语义。
5. `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` 定义 Institution exact revision 与历史显示边界。
6. `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md` 定义已创建 Visit 的 owner collection read；owner-read 不创建或重绑 ElderRecord。
7. `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md` 与 `VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md` 定义评价资格与提交边界。
8. `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md` 与 Operations principal/Visit grant 语义只授予其定义的 Visit lifecycle authority。
9. Current Product Source 由 `docs/product/README.md` 指向的 V1.2 页面级 PRD 与 MVP 页面方案构成。

### 1.1 Explicit V1 scope decision

V1.2 页面级 PRD 第 41 页写有“支持一个家庭管理多个老人”。Owner 已明确决定当前 V1 不实现此能力：一个 authenticated C5 负责用户最多绑定一个 ElderRecord，且 ElderRecord 只有一个负责 C5 用户。本文如实记录这是对该 PRD 较宽表述的**明确 Owner 范围收窄**；不声称 PDF 本身已经定义一对一，也不修改 Product PDF。本文采纳后，当前 V1 实现必须遵守本 Contract；未来若要支持多位 Elder、家庭账户或其他关系，必须经过独立 successor 决策与 Contract。

C1/C3 中通用的 “owns or is authorized to use” 不会在 V1 被实现成跨账号共享。V1 唯一受支持的关系是当前 C5 authenticated user 对其唯一绑定 ElderRecord 的 responsible ownership。

### 1.2 Institution appointment eligibility Owner decision

C1 要求所引用的精确 Institution revision 对新 Appointment `appointment-eligible`；Institution List/Detail Contract 规定历史 `suspended` / `archived` revision 不可创建预约，并明确自身不预判当前 revision 的实际 appointment eligibility。Owner 已为本 Contract 明确决定 V1 的新预约必要条件：

```text
exact requested Institution revision is the current revision
AND recordStatus = published
AND explicit Operations authorization for appointment eligibility exists
```

三项均必须由 Backend 在正式创建 Appointment 时基于可信 server-side Institution / Operations 事实确认。`published` 或可在前台展示本身**不足以**授权预约。授权缺失、未知、无法解析或无法核实时必须失败关闭，不得把历史 revision 自动替换为最新 revision。本文冻结这个业务条件，不指定授权的存储、字段、provider、具体操作角色或授予/撤销机制，也不把它解释成床位、价格、护理能力或其他 Institution verified fact。

## 2. Normative Scope

### 2.1 In scope

- V1 stable `ElderRecord` identity and its responsible-user binding；
- one-to-zero-or-one user binding cardinality and one-responsible-user record cardinality；
- C5 identity authority and private read/write boundary；
- separation among Assessment draft/identity, ElderRecord and ElderProfile；
- server-side Elder reference resolution for Appointment；
- V1 exclusion of multiple records, cross-account use, delegation and transfer；
- stability of Elder references already persisted on Visit；
- distinct rules for historical Institution display and new Appointment eligibility；
- isolation from phone identity, Operations ownership, VisitEvaluation, Institution verified facts and Recommendation。

### 2.2 Out of scope

This Contract does not define an ElderRecord table or fields beyond the stable identity/binding semantics, Assessment persistence schema, API/DTO/path, ID generation algorithm, login/session protocol, authorization library, Institution eligibility storage/provider, database constraint/locking, page copy, family/shared-access model, record retention, public Elder identity, or implementation phase/Handoff. These are either implementation details within the frozen semantics or future successor scope.

## 3. Stable ElderRecord Identity

`ElderRecord` is the persistent service-subject identity for one Elder under the V1 responsible-user model. It is distinct from the Assessment answers and from any derived profile.

Every persisted ElderRecord MUST have a stable, opaque `elderId` that is authoritative at the Backend boundary. It MUST NOT be chosen by the client or derived from a person’s name, phone number, raw OpenID, local draft ID, `assessmentId`, `ElderProfile` hash/ID, or Recommendation session.

Once established, `elderId` remains stable across reassessment, ElderProfile refresh/derivation, Recommendation refresh, Institution revision changes, Visit lifecycle changes and VisitEvaluation. These downstream events MUST NOT create a replacement identity or rewrite a persisted Visit’s Elder reference.

The identity/binding layer is minimum necessary. It is not an Elder questionnaire or a copy of Assessment, ElderProfile, health, contact or identity-document data. `elderId` is internal and is not a public person identifier.

## 4. Responsible C5 User and Cardinality

`Responsible User` is the single C5 user principal authenticated by the existing trusted Backend/session boundary and bound to an ElderRecord as the user responsible for the Elder-related service flow. This principal is the user of the mini program, not the Elder.

The trusted C5 resolver’s stable opaque `userId` is the sole binding authority:

```text
one authenticated C5 userId -> zero or one currently usable bound ElderRecord
one ElderRecord -> exactly one responsible authenticated C5 userId
```

Zero is valid before a record is established. Once bound, an ordinary V1 flow MUST NOT create a second record for that user, transfer the binding, or make another user an owner. A concurrent or repeated creation attempt MUST preserve the same zero-or-one outcome; it cannot yield multiple usable `elderId` values. Any request to create a second usable record MUST fail closed as unsupported under V1. The specific API error code is implementation detail.

“Active/currently usable binding” describes which single record the trusted Backend resolves for the authenticated user. It does not introduce a second Elder domain status machine. The V1 user flow cannot inactivate or replace an existing record in order to mint another Elder identity. Administrative retention, account closure, deletion or recovery mechanics are not defined here; they cannot silently grant ordinary users a replacement path.

## 5. Explicitly Unsupported V1 Account Models

V1 has no family or household account entity, family owner/admin, member list, invitation, shared Elder, delegated user, caregiver group, or multi-Elder selector. Those terms do not describe hidden objects or extension points in this Contract; they are `V1_OUT_OF_SCOPE_FUTURE_CAPABILITY`.

V1 does not support:

- one C5 user selecting or managing two or more ElderRecords；
- one ElderRecord having two or more C5 users；
- another authenticated user reading, updating, selecting, booking for, or submitting an Evaluation for someone else’s ElderRecord；
- invitation, delegation, sharing, cross-account authorization, transfer or reassignment；
- ordinary user hard-delete, replace, or switch-to-another-Elder behavior。

Future multi-Elder, family/shared access, delegation, transfer, replacement or deletion capability requires a new Owner decision and successor Contract. No implementation may add these capabilities as “future-proofing” under V1.

## 6. C5 Identity and Access Boundary

The current C5 authenticated session resolves the responsible user. Only the trusted Backend/auth boundary may turn a valid session into its `userId`. Missing, expired, invalid, unavailable or technically failed authentication provides no ElderRecord access and no production binding.

The following are not Elder ownership or identity authority:

- `User.phone`, any contact phone, phone authorization or `getPhoneNumber`；
- raw `openid`, `wx.login` code or client-held session evidence；
- client-supplied `userId`, owner ID or `responsibleUserId`；
- an Assessment draft, local profile, display name or client state；
- Consultant or Operations principal/Visit authorization。

Only the currently bound responsible C5 user may read private ElderRecord and permitted private profile context. That user may initiate only the Elder data flows already allowed by the applicable Assessment and ElderProfile Contracts. This Contract grants no broader field-editing or history-rewrite capability. Another C5 user receives no private Elder data or use authority.

Backend services may resolve the bound ElderRecord for a lawful operation defined by its owning Contract. Such service access does not create another user owner, sharing grant or end-user write permission. An Operations principal may perform only its contracted Visit lifecycle actions; that authority does not grant ElderRecord ownership or general ElderProfile access.

## 7. Assessment and ElderProfile Relationship

An `AssessmentDraftV2.localDraftId` identifies a local editing draft only. It is never `elderId`, an ownership proof, or a persisted production Elder identity. A draft may exist before a persistent ElderRecord is bound.

Formal Assessment/Profile data can be associated with a production Elder identity only after the Backend resolves the current C5 Responsible User and establishes or resolves that user’s sole ElderRecord binding. Assessment answers, `assessmentId`, completion, or valid Profile derivation do not independently prove that the user owns an ElderRecord.

`ElderProfile` remains the versioned derived business profile under `ELDER_PROFILE_CONTRACT_V2.md`. It is not the stable ElderRecord and cannot supply or replace `elderId`. The completed Assessment/profile result references the stable `elderId` under the owning Assessment/Profile semantics. Reassessment for the same Elder creates/retains the Assessment history required by the Assessment Contract and continues using the same ElderRecord; it MUST NOT mint a new Elder identity. Existing historical Assessment/Profile version rules remain unchanged.

This Contract does not define how Assessment answers are transported during a future first-time bind, where a binding API lives, or how persisted Assessment identity is generated. Those choices must implement the above identity order and must not promote `localDraftId` or a derived Profile key into `elderId`.

## 8. Appointment Elder Reference Authority

V1 Appointment has one implicit Elder target: the ElderRecord bound to the currently authenticated Responsible User. Product UI text that says “select an Elder” means resolve/use that sole bound record; it is not a multi-record chooser.

For every formal Appointment create, the Backend MUST:

1. authenticate the current C5 principal and obtain trusted `userId`；
2. resolve the sole ElderRecord bound to that `userId`；
3. use its server-authoritative `elderId` as the Visit reference；
4. authorize the same exact Institution revision under §9 and satisfy all remaining C1/C3 preconditions；
5. persist no Visit if identity, binding or any other required precondition is absent or uncertain。

Client `elderId` is not authority. If a wire request includes one for compatibility with C1’s reference-shaped command, Backend MUST compare it with the sole server-resolved `elderId`; mismatch is rejected. A matching value remains a reference assertion, not the proof of ownership. The Backend may instead resolve the reference without accepting one from the client. Exact DTO shape is left to implementation.

An authenticated user without a bound ElderRecord cannot formally create an Appointment until a legitimate server-side creation/binding flow establishes that record. The local draft may remain available according to the owning UI/Appointment Contract; it cannot produce a persisted Visit or synthetic success.

The broader C1 phrase “owns or is authorized” remains valid at the generic Visit contract boundary. The V1 supported subset in this Contract is solely “current authenticated user is the responsible owner”; no additional authorization class is implemented under V1.

## 9. Institution Reference for New Appointments

Historical Institution display and new Appointment eligibility are separate:

```text
existing Visit read -> exact historical institutionId + institutionRecordRevision
new Appointment -> currently current, published, explicitly Operations-authorized eligible revision
```

The new Appointment reference MUST identify the exact `institutionId + institutionRecordRevision` that is current at the server’s eligibility check. For that exact revision, Backend must verify both `recordStatus = published` and positive explicit Operations authorization for appointment eligibility. These are necessary conditions and an eligibility fact, not a claim that capacity, price, clinical quality, or any other Institution fact is available or verified.

An old revision may remain resolvable for its existing historical Visit and may be displayed under the owner-read Contract. That historical displayability does not authorize a new Appointment. Historical, suspended, archived, draft, non-current, unpublished, or otherwise unresolvable revisions are not valid new Appointment references. A request pinned to an old revision MUST NOT be silently upgraded to latest/current; the client must use an explicit current-revision selection under the owning Institution presentation flow.

The explicit appointment-eligibility Operations authorization MUST be a positive, server-verifiable fact for the exact current published revision. Missing, unknown, unavailable, ambiguous, or unverifiable authorization fails closed and creates no Visit. `published`, public visibility, `PRODUCTION_CANDIDATE`, a recommendation/list appearance, or historical display alone cannot substitute for that authorization. This Contract does not define its grant source, storage, schema, actor role mechanics, API, or revocation process.

The Institution revision bound to a Visit remains the exact revision accepted at creation. Later publication or revision changes do not rewrite the existing Visit’s historical Institution reference.

## 10. Historical Visit Reference Stability

Every persisted `InstitutionVisit.elderId` remains the identity reference accepted for that Visit. It MUST NOT change because the same responsible user reassesses the Elder, a Profile is rederived, Recommendation is refreshed, Visit status changes, an evaluation is submitted, or the Institution’s current revision changes.

Owner collection reads retain C1/Appointment owner-read behavior and the exact historical references. Operations lifecycle reads/writes remain scoped to Visit and do not change Elder ownership. No current profile or Institution record may be used to rewrite an existing Visit’s `elderId` or `institutionRecordRevision`.

## 11. Evaluation, Operations, Institution and Recommendation Isolation

`VisitEvaluation` remains `USER_REPORTED_DATA`. Evaluation requires the existing real owner Visit and authoritative `completed` state. Evaluation creation or content MUST NOT create, bind, transfer, replace or change an ElderRecord, responsible user, or Visit `elderId`.

Operations principal and Visit grant authorize only the specific Visit lifecycle operation in the Operations Contract. They do not authorize the operator to become the Responsible User or to read/update arbitrary private ElderRecord/Profile data.

Elder identity and binding are not Institution verified facts or evidence. Appointment and ElderRecord flows MUST NOT write Institution verified data, `InstitutionCareProcess`, verification evidence, or revisions. A user observation or Evaluation cannot be promoted into Elder ownership or Institution truth by this Contract.

This Contract does not alter Recommendation V2 Safety, Eligibility, Exactness, `PriorityFitVector`, Rank Tuple, or `NO_EXACT_MATCH`. Establishing or resolving `elderId` alone does not trigger a Recommendation recomputation. Any recomputation remains governed by the current Assessment/Recommendation Contracts.

## 12. Phone, Privacy and Test Isolation

```text
REAL_PHONE_REQUIRED_FOR_SELECTED_PHASE = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
COMPANY_SUBJECT_MATERIAL = NOT_USED
```

Phone is not an identity, binding, ownership, deduplication, transfer or access key. This Contract does not authorize phone acquisition, matching, account linking, or storage in ElderRecord. Any future phone use remains limited to its independently authorized C1/C3 purpose.

Identity boundaries should expose only the internal identifiers and minimum data needed by their authorized consumer. Public responses must not reveal unnecessary `elderId`, `userId`, private profile, health, Assessment, contact, session or authorization material. No real Elder or health data is needed to define or test this Contract.

TEST_ONLY identities, Assessment fixtures, mock catalogs and synthetic Elder records remain confined to the test/development dependency graph. They are not production ElderRecord authority, C5 proof, Institution eligibility, or Appointment success. A production identity/reference failure must fail closed, never use a fixture fallback.

## 13. Stable Failure Semantics

This Contract freezes rejection conditions, not HTTP or application error code spelling. Existing result/error architecture MUST be reused. A future implementation MUST fail closed when:

- C5 authentication is missing, invalid, expired or unavailable；
- no sole bound ElderRecord can be resolved；
- the user already has a bound record and requests another under V1；
- a requested Elder is not the authenticated user’s sole bound record；
- a client Elder identifier disagrees with the server-resolved binding；
- a second account attempts to access or use the record；
- an Institution revision is not the exact current published revision with explicit appointment-eligibility Operations authorization；
- any required binding or authoritative reference cannot be safely resolved。

Failure creates no Visit and does not mutate ElderRecord, ElderProfile, Assessment history, Institution, or Recommendation. The API must not leak private Elder existence or ownership to another account.

## 14. Implementation Boundary

Future implementation may choose API shape, persistence model, identifier generator, transaction/constraint strategy, request serialization and integration ports, provided it satisfies this Contract plus C1/C3 and the owning Assessment/Profile/Institution/Operations Contracts. It must preserve the one-to-zero-or-one and exactly-one binding invariants under retries/concurrency and keep the server as the identity/reference authority.

This Contract does not freeze a backend table, column, migration version, endpoint, ORM, locking method, provider, UI page or operations grant store. A later implementation Handoff must define its own files, API compatibility, migration/read impact, tests and production/test boundaries without re-opening the settled V1 account model.

## 15. Contract Conformance Gates

| Gate | V1 semantic requirement |
|---|---|
| G01 Product decision fidelity | Preserve the explicit Owner scope narrowing from PRD page 41; do not claim the unchanged PDF already specified 1:1. |
| G02 Stable Elder identity | `elderId` is opaque, stable and server-authoritative. |
| G03 Responsible-user binding | The authenticated C5 user is the sole responsible user. |
| G04 Cardinality per user | One C5 user resolves to zero or one currently usable ElderRecord; V1 user flow cannot replace a record to mint another. |
| G05 Cardinality per record | Each ElderRecord has exactly one responsible C5 user. |
| G06 Family account exclusion | No family/household account or member model exists in V1. |
| G07 Cross-account exclusion | No sharing or use by another C5 account. |
| G08 Transfer/delegation exclusion | No transfer, invitation, delegation, replacement or switch flow. |
| G09 Assessment separation | Local draft/assessment identity never becomes `elderId` or ownership proof. |
| G10 Profile separation | ElderProfile is derived data, not the stable identity. |
| G11 Appointment authority | Backend resolves the sole binding from the C5 principal for each formal create. |
| G12 Client-ID distrust | Client `elderId` cannot establish or change authority and must match if present. |
| G13 C5 inheritance | Existing C5 trusted identity boundary is reused without auth redesign. |
| G14 Historical Visit stability | Existing Visit Elder reference remains stable through downstream changes. |
| G15 New Institution eligibility | Exact current + published revision also requires explicit appointment-eligibility Operations authorization; unknown fails closed. |
| G16 Historical Institution isolation | Historical exact revision remains for existing Visit; it cannot authorize new Appointment and cannot fall back to latest. |
| G17 Phone isolation | Phone is not Elder identity, owner key or authorization; selected phase needs no real phone. |
| G18 Operations isolation | Visit lifecycle authority grants no Elder ownership or general Elder data rights. |
| G19 Evaluation isolation | Evaluation neither creates nor changes Elder identity/binding. |
| G20 Recommendation/Institution isolation | No Recommendation mutation/recompute and no Institution verified-fact write. |
| G21 Data minimization | Identity binding stores/exposes no unnecessary private/health data. |
| G22 Test/production isolation | TEST_ONLY data and principals cannot authorize production records or submissions. |
| G23 Governance | Versioned Contract registration, routing validation and independent Contract review are required for repository freeze closeout. |

## 16. Owner Decision and Source-Change Record

```text
ELDER_ACCOUNT_MODEL_V1 = ONE_RESPONSIBLE_C5_USER_TO_ONE_ELDER_RECORD
FAMILY_ACCOUNT_MODEL_V1 = NONE
MULTI_ELDER_MANAGEMENT_V1 = NOT_SUPPORTED
CROSS_ACCOUNT_ELDER_SHARING_V1 = NOT_SUPPORTED
APPOINTMENT_ELDER_SELECTION_V1 = IMPLICIT_SINGLE_BOUND_RECORD
NEW_APPOINTMENT_INSTITUTION_ELIGIBILITY_V1 = CURRENT_AND_PUBLISHED_AND_EXPLICIT_OPERATIONS_AUTHORIZED
```

These are explicit Owner decisions for the V1 supported scope. The one-user/one-Elder decision narrows the broader V1.2 PRD sentence identified in §1.1. The Institution eligibility decision fills the C1/C3 `appointment-eligible` predicate without copying Institution verification rules or selecting its technical grant source. Neither decision modifies an existing Frozen Contract or Product PDF.

Any future change to these choices requires an explicit successor decision/Contract before implementation.
