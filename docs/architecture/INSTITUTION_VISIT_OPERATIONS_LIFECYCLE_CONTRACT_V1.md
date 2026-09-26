# InstitutionVisit Operations Lifecycle Mutation Authority & Completion Evidence Contract V1

Status: `FROZEN`

Contract ID: `institution-visit-operations-lifecycle-contract-v1`

Version: `V1`

Frozen: `2026-09-26`

Supersedes: `NONE`

Inherits C1 lifecycle semantics: `YES`

This Contract freezes the production authority, object authorization, evidence, and audit boundary for post-submission `InstitutionVisit` status mutations. It does not implement a mutation API, persistence schema, or operations interface.

## 1. Source authority and relationship

- `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` (C1) remains the sole authority for Visit identity and ownership, the five status values, their meanings, the legal transition matrix, and Evaluation eligibility.
- This Contract defines who may issue a production lifecycle mutation, which Visit they may mutate, the positive operational facts required by that mutation, and the minimum provenance/audit boundary.
- `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` (C3) remains the authority for the ordinary authenticated user principal, initial Visit creation, create idempotency, and server ownership of `visitId` and `acceptedAt`.
- `CONSULTANT_PERMISSION_CONTRACT_V1.md` remains the authority for Consultant identity and Institution-to-Consultant assignment. An Institution assignment does not grant Visit lifecycle write access under this Contract.
- `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md` remains a read-only consumer boundary. Evaluation context/write Contracts remain downstream consumers of authoritative `completed` status.
- Current V1.2 Product Source is routed by `docs/product/README.md` to `武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf` and `武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`. Relevant pages establish the Operations/Consultant service context (page-level PRD p5, p30), requested Appointment fields and submission truth (p34-35), Visit statuses (p36), Evaluation purpose/data ownership (p37-39), and the MVP Appointment/Visit/Evaluation flow (MVP plan p18-24).

If this Contract and C1 appear to overlap, C1 owns the lifecycle semantics and this Contract owns only the production mutation authority and evidence boundary. No C1 status or transition rule is duplicated here.

## 2. Frozen Owner decisions

The following decisions were supplied for this Contract Freeze and are normative:

1. V1 production lifecycle mutation authority is limited to authorized **platform Operations** principals. Consultants, including an assigned Consultant, cannot mutate Visit status in V1.
2. Every Operations actor must have explicit authorization for the target Visit. A platform Operations role by itself grants no global Visit access.
3. A transition to `completed` requires an authorized Operations actor to make an auditable factual attestation that the actual in-person visit occurred. A status-button action or target status alone is not evidence.

## 3. Operations principal and trust boundary

An Operations mutation principal is a Backend-verified platform Operations identity authorized to perform the requested Visit operation. The principal and its authority must be resolved by a trusted server-side boundary; request fields cannot establish either.

The following are not Operations identity or mutation authority:

- a C5 ordinary authenticated user principal or session;
- Visit ownership, Elder ownership, or knowledge of a `visitId`;
- `User.phone`, Consultant phone, or Institution official contact;
- a Mini Program owner/client identity, route value, local state, or request claim;
- a `TEST_ONLY` principal or fixture.

The Operations principal is provider-neutral. Token format, authentication provider, session protocol, RBAC library, and staff login UX are implementation details.

## 4. Object-level authorization

Before each mutation, the Backend must prove that the resolved Operations principal has explicit authorization for the target server Visit. The authorization check applies to every command, including retries and requests from the same actor.

Authorization is not established by:

- Operations role membership alone;
- `visitId` knowledge or possession;
- the Visit's Institution, its current or historical revision, or the requester's ownership;
- Institution-to-Consultant assignment, default Consultant resolution, or a Consultant's public availability;
- client-supplied `userId`, `ownerId`, `consultantId`, Institution identity, status, or scope claim.

The grant source and its technical representation are implementation details. Its semantic result must be an explicit authorized Visit scope resolved from trusted server-side data. An unresolved, expired, ambiguous, or unavailable scope fails closed.

## 5. Mutation target and authoritative current state

The target is the Backend-persisted `visitId` created under C1/C3. A command may express a target transition intent, but only the Backend may resolve the current Visit, its authoritative current status, its bound Institution identity, and the Operations principal/scope.

The Backend must not trust a client claim of current status or accept client identity, ownership, Institution binding, or operational timestamp fields as authority. An unknown or out-of-scope Visit must not be changed.

## 6. Lifecycle rule ownership

For each authorized command, the Backend reads the currently persisted Visit status and applies C1's frozen transition rules. C1 remains the only transition-matrix source; an API, UI, repository, or new Contract-local matrix must not create a second rule set.

An illegal transition, direct jump, backward transition, reopening, or correction is rejected. The Backend must not synthesize an intermediate transition to make a requested target reachable. A repeated write of the already-current status follows C1's allowance: it may be handled as an idempotent no-op, in which case it creates no new lifecycle transition event. If the implementation does not use that no-op behavior, it must not record a second lifecycle transition. Any command outcome audit remains distinct from a transition event.

## 7. Operational facts for contacting, scheduled, and cancelled

These clauses preserve C1 meanings without adding a call-log, CRM, or required cancellation-reason product feature:

- `contacting` may be recorded only when actual Consultant/Operations follow-up communication is underway as an operational fact. Assignment, planned outreach, submission, or a contact button alone is insufficient. The authorized Operations actor records the fact; no call-log or message-receipt provider is required.
- `scheduled` may be recorded only when an operational visit plan is actually confirmed. A submitted Appointment, requested `visitDate`/`visitTimePreference`, or a planned-but-unconfirmed time is not confirmation. The authorized Operations actor records the confirmed-plan fact. No unapproved confirmation source or external calendar/CRM is required.
- `cancelled` may be recorded only when the authorized Operations actor confirms and records an authoritative cancellation outcome that ends the Visit process. An owner cancellation request may initiate that process but does not itself change the status. This Contract does not invent a particular cancellation source or require a cancellation reason.

For each of these statuses, the Operations actor's command is a record of the stated operational fact, not a substitute for that fact. Missing or contradictory facts fail closed.

## 8. Completion evidence

`completed` is permitted only from the C1-legal predecessor status and only when the authorized Operations actor records a positive, auditable attestation that the actual in-person Institution visit occurred.

The evidence must preserve, semantically and provider-neutrally:

- the stable server `visitId` being attested;
- an explicit factual assertion that the actual in-person visit occurred;
- the trusted Operations principal who asserted it;
- the occurrence/fact time at the precision the authorized actor can truthfully establish;
- the server-recorded time for accepting the attestation;
- provenance sufficient to audit the attestation, including the authorized actor and Visit identity.

The evidence is separate from the transition intent and target status. A bare click, status enum, success response, empty reason, or generic “mark complete” action without the factual attestation and provenance is `EVIDENCE_INSUFFICIENT` and must not mutate the Visit.

The explicit Operations attestation is the required positive evidence; a bare status command is not. No particular external artifact, screenshot, CRM, calendar, ticket system, vendor, or second-person review is required. A stable reference may be retained when an authorized operational source provides one, but a new external evidence system is not a prerequisite. Evidence must remain minimal and must not copy User.phone, full health answers, Assessment, ElderProfile, Recommendation internals, or unrelated private notes.

The following never establish completion:

- elapsed time, an expired `visitDate`, or a scheduled plan/time;
- `scheduledAt`, Appointment submission, or an accepted/replayed receipt;
- a user's assertion, Mini Program/page/local state, route value, or owner-read display;
- VisitEvaluation creation, submission, score, observation, or feedback;
- Institution verified facts, a new Institution revision, or a Recommendation result;
- synthetic data, test fixtures, `TEST_ONLY` principal/Visit/evidence, or fallback behavior.

If the Backend cannot establish the required authority, explicit Visit scope, legal C1 transition, or positive factual evidence, it rejects the mutation and preserves the current status.

## 9. Operational timestamps

Backend time and the authoritative operational fact own lifecycle timestamps.

- `scheduledAt`, if represented, may be written only when an actual confirmed plan exists. It must correspond to the confirmed scheduling fact; it must not be copied from the initial submission time, requested `visitDate`/`visitTimePreference`, or client clock.
- `completedAt`, if represented, may be written only from the attested actual occurrence/fact time. It must not be inferred from elapsed time, `visitDate`, `scheduledAt`, Evaluation, request receipt time, or client clock. If a precise occurrence timestamp is not truthfully known, do not manufacture one; preserve the attested fact-time precision separately according to the implementation's compatible representation.
- The server-recorded time for accepting a mutation is distinct from the time the visit was scheduled or occurred. It is assigned by the Backend and cannot be supplied by the client.
- No lifecycle timestamp is required merely because a field exists in an implementation. Missing or unavailable values retain their defined optional/unknown semantics and are not fabricated.

The physical columns, timezone encoding, precision, and persistence representation are implementation details.

## 10. Audit and provenance

Every successful status transition must leave an auditable Backend-owned fact sufficient to answer:

- which stable `visitId` was targeted;
- which authoritative status it had and which status it became;
- which verified Operations principal acted;
- which evidence/provenance or cancellation outcome supported the transition;
- when the Backend accepted it;
- whether the mutation succeeded.

The audit record must distinguish a committed transition from a rejected, stale, or repeated no-op command. It must use stable internal identity and minimize sensitive data; it must not expose raw auth/session evidence, User.phone, contact fields, full health/Profile data, secrets, or raw provider errors. Audit storage, retention period, and physical event format remain implementation details.

This Contract does not require a new durable operation ID or reuse of C3's Visit-creation `idempotencyKey`. C1's same-status no-op semantics apply; if a later implementation needs stronger retry correlation, it may add a provider-neutral implementation mechanism without changing lifecycle truth.

## 11. Atomicity and concurrency

A mutation must be checked and committed against the authoritative current persisted status as one logical atomic operation. Concurrent commands may not produce last-write-wins history or skip a C1 transition.

A command whose current-state precondition became stale, or whose requested transition is no longer legal, is deterministically rejected as a conflict/illegal transition under the existing application result architecture. The Backend does not retry by traversing another transition. Row locks, optimistic versions, transaction strategy, and ORM behavior are implementation details.

## 12. Failure, privacy, and result semantics

All failures are fail closed:

- missing/invalid Operations authentication or a principal without the Operations mutation class → existing authentication/unauthorized outcome;
- unknown Visit and a Visit outside the actor's explicit scope → the same privacy-preserving hidden/not-found outcome, with no existence or status disclosure;
- missing/expired/unresolved Visit scope → reject without mutation;
- illegal C1 transition → stable illegal-transition/rejected outcome;
- missing or insufficient operational fact/evidence → stable evidence-insufficient/rejected outcome;
- stale concurrent state → stable conflict outcome;
- repository/provider/system failure → unavailable or technical-failure outcome, never a successful empty/no-op mutation.

Public result names and HTTP mapping follow existing result architecture. Raw exception, authorization internals, evidence content, private Visit fields, and object-existence detail do not enter public results. The Backend may retain a minimum internal audit record for a rejection under its security policy; this Contract does not define a separate enterprise audit platform.

## 13. Owner-read isolation

`GET /api/v1/visits` remains the authenticated owner's read-only collection. This Contract adds no owner mutation route or capability. An owner may submit a cancellation request through a separately authorized flow, but cannot set Visit status or claim that the request has been accepted as `cancelled`.

## 14. VisitEvaluation isolation

The direction remains `authoritative completed Visit → Evaluation eligibility`. Evaluation read/create/write, user observation, score, or submission cannot create, confirm, or repair a Visit status. VisitEvaluation remains `USER_REPORTED_DATA`, not Operations truth or Institution evidence.

## 15. Recommendation and Institution isolation

An Operations lifecycle mutation:

- does not change or rerank Recommendation V2 or write ElderProfile;
- does not modify Institution verified facts, verification evidence, public content, or `recordRevision`;
- does not automatically create an Institution revision;
- does not promote VisitEvaluation or user-reported feedback into Institution evidence.

Any future verification lead continues through the separately authorized human verification and revision workflow.

## 16. Production and test isolation

Production mutation requires a real authorized Operations principal, explicit Visit scope, a real persisted Visit, a legal C1 transition, and the required operational fact/evidence. `TEST_ONLY` principals, Visits, evidence, fixtures, and fallback paths may be used only in their isolated test/development graph.

If production authority, scope, evidence, or Backend persistence is unavailable, the result is rejected/unavailable. No synthetic production truth is permitted.

## 17. Phone and C6 isolation

```text
REAL_PHONE_REQUIRED = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
```

Operations identity and lifecycle authority do not depend on `User.phone`, `getPhoneNumber`, C6 G13, or C5 ordinary-user session evidence. Phone remains purpose-bound contact data under C1/C3 and is never an Operations identity or scope grant.

## 18. Stable Application boundary and implementation details

A later Application/Backend implementation can depend on this semantic sequence:

```text
resolve trusted Operations principal
  -> resolve explicit scope for server visitId
  -> load current persisted Visit/current C1 status
  -> validate transition using C1
  -> validate positive operational fact/evidence for target status
  -> atomically commit status + truthful timestamps + audit/provenance
  -> return a stable result without private or existence leakage
```

This Contract does not freeze an API path/verb/DTO, token or provider, authorization library, grant storage, table/schema, migration, ORM, locking/version technique, evidence vendor/storage format, admin UI, staff login UI, retention TTL, notifications, CRM, calendar, or external service integration. These details may not weaken the authority, scope, fact, audit, isolation, or fail-closed semantics above.

## 19. Mandatory Contract Gates

| Gate | Result | Frozen evidence |
|---|---|---|
| G01 Contract identity/versioning | PASS | New V1 Contract ID and path; it does not supersede C1/C3. |
| G02 C1 lifecycle inheritance | PASS | C1 remains sole owner of the five statuses, meanings, transition matrix, and Evaluation prerequisite. |
| G03 Operations principal authority | PASS | Owner decision limits V1 mutation to trusted platform Operations; Consultants and ordinary C5 users cannot mutate. |
| G04 Object-level authorization | PASS | Each actor requires explicit target Visit scope; Institution/Consultant assignment and ID knowledge do not grant access. |
| G05 Authoritative Visit identity | PASS | Backend resolves the persisted stable `visitId`; client identity and current status are not authority. |
| G06 Legal transition enforcement | PASS | Backend applies C1 to current persisted status; illegal/direct/stale transitions fail closed. |
| G07 contacting/scheduled authority | PASS | Operations records actual follow-up underway or a confirmed plan; submission and requested time remain non-authoritative. |
| G08 Completion evidence | PASS | Owner decision requires an auditable Operations attestation of actual visit occurrence, separately from the command. |
| G09 Operational timestamp authority | PASS | Only truthful Backend-authoritative operation/fact times may be recorded; no preference/client-time inference. |
| G10 Audit/provenance | PASS | Target, from/to, authorized actor, fact/provenance, server acceptance time, and outcome are auditable. |
| G11 Atomicity/concurrency | PASS | Current-state validation and transition commit are atomic in semantics; stale requests conflict. |
| G12 Failure/privacy semantics | PASS | Fail-closed outcomes and hidden not-found behavior prevent Visit enumeration. |
| G13 Owner-read isolation | PASS | Owner collection remains read-only; cancellation request does not directly mutate status. |
| G14 Evaluation isolation | PASS | Completed Visit unlocks Evaluation; Evaluation never writes Visit status. |
| G15 Recommendation/Institution isolation | PASS | Visit operations do not write Recommendation, ElderProfile, or Institution verified facts/revisions. |
| G16 Production/test isolation | PASS | TEST_ONLY identity/Visit/evidence and synthetic fallback cannot enter production. |
| G17 Phone/C6 isolation | PASS | Phone is not operations identity; REAL_PHONE remains deferred and G13 is not reopened. |
| G18 Downstream implementation boundary | PASS | Provider/API/schema/UI/locking details remain open; semantic Application sequence is sufficient for a later handoff. |

## 20. Freeze result and change policy

```text
INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT = FROZEN
PRODUCT_DECISIONS = CLOSED
SOURCE_CONFLICT = NONE
IMPLEMENTATION_READY = NO
IMPLEMENTATION_HANDOFF_READY = YES
PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
SCHEMA_CHANGE = 0
```

This Contract freezes semantics only. It does not select a new V1.2 phase ID or authorize production implementation. A later phase-definition/implementation handoff must use this Contract with C1/C3 and define its implementation slice and mandatory evidence gates.

Any future change to mutation authority, Visit scope, completion proof, transition truth, or cross-domain isolation requires an explicit versioned successor or approved additive Contract; do not modify this Frozen Contract or C1 in place.
