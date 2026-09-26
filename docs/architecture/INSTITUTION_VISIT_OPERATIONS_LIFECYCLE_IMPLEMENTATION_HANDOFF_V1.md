# InstitutionVisit Operations Lifecycle Backend Implementation Handoff V1

Status: FROZEN_PHASE_BOUNDARY / PREREQUISITE_REQUIRED

Handoff ID: handoff.institution_visit_operations_lifecycle.v1

Baseline HEAD: 21bd62cdcbc356bfcdf346beaa75dc8e3c6aa3f3

**HANDOFF_SCOPE = BACKEND_API_AUTH_PERSISTENCE**
**HANDOFF_BOUNDARY = PHASE_BOUNDARY_ONLY**
**OPERATIONS_PRINCIPAL_FOUNDATION = MISSING**
**IMPLEMENTATION_READY = FALSE**
**IMPLEMENTATION_EVIDENCE = NONE**
**EXPECTED_NEW_FLYWAY = YES**
**PHASE_ID = UNASSIGNED**

This Handoff records a conditional implementation boundary for the frozen InstitutionVisit Operations Lifecycle Contract V1. It does not assign a V1.2 phase number, approve an Operations identity provider, or change any frozen product semantics. Lifecycle implementation remains blocked until the Operations Principal and explicit Visit authorization foundation below has a real trusted source.

## 1. Source authority

Implementation must follow these active frozen sources:

1. **INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md** owns V1 Operations mutation authority, per-Visit scope, operational facts, completion evidence, audit, privacy, and fail-closed behavior.
2. **APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md (C1)** remains the only source for the five Visit statuses, status meanings, transition matrix, initial requested state, and terminal-state behavior.
3. **AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md (C3)** owns ordinary authenticated-user identity and initial Visit creation.
4. **APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md**, **AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md**, and **VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md** remain read-only or downstream Evaluation boundaries.
5. The current C5 implementation remains an ordinary user-session boundary. It does not grant Operations authority.

If implementation would change Operations-only authority, explicit Visit scope, the factual basis for a status, C1 transition truth, or cross-domain isolation, stop and request a versioned Contract decision. Do not edit any Frozen Contract in place.

## 2. Repository foundation at the baseline

| Area | Current evidence | Handoff consequence |
|---|---|---|
| Visit persistence | **server/src/main/resources/db/migration/V1__create_visit_submission_tables.sql** creates **institution_visit_v1**; **V3__allow_c1_visit_statuses_for_owner_read.sql** already permits all five C1 status values. | Reuse the persisted Visit identity and status. No new status value or V1–V5 rewrite is needed. |
| Ordinary-user identity | **server/src/main/java/com/wuhan/eldercare/visit/domain/TrustedPrincipal.java** contains only **userId**. **C5AuthEvidenceResolver.java** resolves an active C5 self-owned user session to that type. | Do not reuse C5 identity as an Operations role or elevate a user session. |
| Operations trust and Visit scope | No staff/Operations principal resolver, role proof, or explicit per-Visit grant source exists under **server/src/main** or **server/src/test**. | Production lifecycle writes cannot be enabled until a real trusted identity and scope source is supplied. |
| Owner read | **JdbcAppointmentOwnerReadRepository** filters by **user_id**; **AppointmentOwnerReadController** exposes the existing GET collection. | Keep it read-only and unchanged. |
| Evaluation | Evaluation context and write repositories read the persisted Visit status and require authoritative **completed** for new eligibility. | Keep the direction as completed Visit → Evaluation. Evaluation never writes Visit status. |
| Lifecycle evaluator | **miniprogram/domain/appointment-institution-visit/lifecycle.ts** defines **evaluateInstitutionVisitTransitionV1** and **canTransitionInstitutionVisitV1**. The Java Backend has no corresponding transition evaluator; its status allowlists only validate status membership. | The implementation must establish one C1 rule authority and demonstrate server parity/reuse. Do not invent or drift into a second transition matrix. |
| Audit and operational facts | V1–V5 contain no lifecycle event/audit table or Operations-specific fact timestamps. V5 **operator_reference** is Institution-publish provenance and does not authenticate an actor or authorize a Visit. | Add durable lifecycle audit support. Never treat a supplied operator string or V5 publication provenance as identity or scope. |

C1 §10.2 remains the sole transition matrix, including its same-status no-op allowance. This Handoff does not reproduce or extend that matrix.

## 3. Required prerequisite: Operations Principal and Authorization Foundation

Before any production lifecycle mutation code can be considered implementation-ready, the foundation must satisfy all of the following:

1. A trusted server-side boundary resolves a provider-neutral, stable internal Operations actor reference from real authentication evidence. Client fields, route data, visitId possession, C5 user session, User.phone, and TEST_ONLY fixtures cannot establish this principal.
2. The server proves the platform Operations mutation class for the current request. Consultant assignment, Consultant identity, Institution association, and ordinary account authentication do not grant this role.
3. A trusted server-side authorization source proves explicit authorization for the requested persisted visitId on every mutation attempt. Role membership alone is insufficient. Unknown and out-of-scope Visits have the same public hidden/not-found behavior.
4. Scope resolution has testable revocation and unavailable/ambiguous fail-closed behavior; any expiring grant must also fail closed after expiry. The grant source may be an already-authorized external service or an additive server-owned store; no such service or store is present at this baseline.
5. The actor reference used in audit is the same verified internal identity produced by the trust boundary. Raw credentials, session evidence, provider payloads, and caller-supplied operator references are never stored as the actor identity.
6. The production profile has no TEST_ONLY principal, default Operations account, hard-coded staff credential, permissive fallback, or bypass path. Required secrets remain server-side and absent from source control and logs.

No specific staff login product, identity vendor, token format, role library, or grant-table shape is selected here. A foundation that cannot meet these criteria leaves lifecycle production mutation disabled and unavailable.

## 4. Bounded Backend implementation slice after the prerequisite

Ownership is **server/**. The slice may add a trusted Operations principal/scope adapter, one versioned Operations-only status-mutation API/result boundary, an Application service, a C1-compatible server transition evaluator or adapter, JDBC persistence, and the migrations required for scope/audit truth.

For each command, the implementation must:

1. Resolve the trusted Operations principal, then prove explicit scope for the target persisted visitId. Do both for every request and retry.
2. Resolve the existing Visit and current status from Backend persistence. Never accept client owner, Institution binding, current status, actor, role, scope, or authoritative timestamps.
3. Apply C1 transition legality against the current persisted status. Handle same-status commands according to C1 without recording a duplicate transition event.
4. Require the positive operational fact for the target status: actual follow-up underway for contacting; an actually confirmed visit plan for scheduled; an authoritative cancellation outcome for cancelled; and an authorized Operations attestation that the in-person visit occurred for completed.
5. Keep fact time distinct from server acceptance time. Preserve only time precision truthfully known. Never infer a fact time from visitDate, elapsed time, request time, or client clock.
6. Commit status and its audit event atomically against the current state. A stale or concurrent command must return a conflict/rejection and cannot overwrite or skip a transition.
7. Return a stable versioned, privacy-safe result using the existing Backend result conventions. Do not expose raw evidence, scope details, private Visit fields, credentials, provider exceptions, or existence/status details for hidden Visits.

The frozen Contract leaves route, verb, DTO field names, provider, storage format, and lock/version technique open. Select those as implementation details without widening this slice or changing frozen business meaning. The API must be separately Operations-authorized; it must not add a mutation to owner-read or Evaluation routes.

### 4.1 C1 evaluator authority

The current TypeScript C1 evaluator is present, but the Java service has no reusable evaluator. The implementation must record which server-side reuse or adapter strategy is selected and prove that it accepts/rejects the same C1 matrix and same-status no-op behavior. If a Java evaluator is added, C1 remains its sole normative source and targeted parity evidence is mandatory. No HTTP controller, repository, or result DTO may own another copy of the transition matrix.

### 4.2 Persistence and migration

**EXPECTED_NEW_FLYWAY = YES.** Add a forward-only Flyway migration after V5 for lifecycle audit/event persistence. A dedicated actor-scope table is conditional on choosing a server-owned grant source; if an already-authorized external source is used, its resolver must still prove target Visit scope on every command.

The persistence must retain enough minimal data to audit target Visit, authoritative from/to status, verified actor reference, supporting fact/provenance, fact time when truthfully known, server acceptance time, and command outcome. A committed transition event must be append-only and committed atomically with the Visit status change. Rejected, stale, and repeated no-op command outcomes must remain distinguishable from committed transitions under the selected audit representation.

V3 already widens the status check to exactly the five C1 statuses. Do not rewrite V1–V5, rebuild historical Institution revisions, change old Visit ownership, or fabricate audit facts for statuses already present before this mutation implementation. New records must be additive and compatible with existing owner-read and Evaluation queries. No status change is backfilled from date passage or user feedback.

If optional scheduled/completed fact timestamps are materialized separately from the event record, write them only from corresponding verified facts; a missing or imprecise fact time remains unknown rather than being manufactured.

### 4.3 API and downstream compatibility

The existing **GET /api/v1/visits** remains the authenticated owner's read-only collection. Its result envelope and field meanings do not change. A later owner read naturally observes the latest authoritative status.

Evaluation context and write remain consumers of the persisted status and continue to require exactly completed. No Evaluation schema or result change is needed solely to write a Visit status. A new Operations endpoint/result must have its own versioned contract shape and cannot reuse C5 ordinary-user authorization.

The Mini Program already recognizes all five C1 statuses in its owner-read and Evaluation context models. This Backend-only slice adds no Operations UI or new client write authority. Recommendation, ElderProfile, Assessment, Institution verified facts, Institution revision history, public content, and VisitEvaluation content are unaffected; no matching interface or ranking input changes are authorized.

### 4.4 Retry and idempotency safety

A lost response or repeated Operations command must not create a second status transition or duplicate committed audit event. The implementation needs a durable logical operation identity or an equivalent durable way to recognize the accepted command and return a stable outcome on retry. A different command must not silently reuse an accepted operation identity to change the Visit or its audit history. The key format, generation, storage, and HTTP transport remain implementation details; Visit creation idempotency is not copied mechanically. C1 same-status no-op remains distinct from replay of an already accepted mutation.

## 5. Out of scope

- Assigning a V1.2-C7 or other phase number.
- Choosing an unapproved authentication vendor, staff-login UX, or external scope provider.
- Mini Program Operations UI, owner cancellation mutation, Consultant status writes, moderation, CRM/calendar integration, or notifications.
- Editing C1, C3, C5, owner-read, or Evaluation Frozen Contracts.
- Changing Recommendation semantics, Assessment/Profile history, Institution facts/revisions, public content, or Evaluation ownership.
- Backfilling unverifiable lifecycle history or treating current V3 status support as evidence that mutation already exists.
- Production enablement before the prerequisite is satisfied.

## 6. Mandatory implementation gates G01–G20

Gate status vocabulary in this Handoff is about definition readiness only: READY means the acceptance requirement is sufficiently defined for a later implementation; it is not runtime PASS. BLOCKED_BY_PREREQUISITE means the gate depends on the missing Operations Principal and Authorization Foundation. No implementation evidence exists at this baseline.

| Gate | Acceptance requirement | Handoff status |
|---|---|---|
| G01 SOURCE_CONTRACT_INHERITANCE | Follow the frozen Operations Lifecycle Contract, C1 transition authority, C3/C5 ordinary-user boundaries, owner-read, and Evaluation boundaries. | READY |
| G02 OPERATIONS_PRINCIPAL_FOUNDATION | Supply a real trusted Operations actor and role proof, without C5, Consultant, phone, client claims, or TEST_ONLY identity. | BLOCKED_BY_PREREQUISITE |
| G03 OPERATIONS_AUTHENTICATION | Resolve and verify the Operations principal for every command; carry its stable internal actor reference to audit. | BLOCKED_BY_PREREQUISITE |
| G04 OBJECT_LEVEL_AUTHORIZATION | Prove an explicit, current Visit grant on every command; hide unknown and out-of-scope Visits equivalently. | BLOCKED_BY_PREREQUISITE |
| G05 AUTHORITATIVE_VISIT_LOAD | Load the target and current status from persisted Visit by server visitId; ignore client owner/current-status assertions. | READY |
| G06 C1_TRANSITION_EVALUATOR_REUSE | Establish one C1 rule authority with server reuse/adapter parity, including same-status no-op; no second matrix in API or persistence. | READY |
| G07 EVIDENCE_VALIDATION | Require positive operational facts for contacting, scheduled, and cancelled; reject missing or unverifiable facts. | READY |
| G08 COMPLETED_POSITIVE_EVIDENCE | Require an auditable authorized Operations attestation that the in-person visit actually occurred; never infer completion from dates or Evaluation. | READY |
| G09 OPERATIONAL_TIMESTAMP_AUTHORITY | Keep verified fact time separate from server acceptance time; do not fabricate scheduledAt/completedAt or use client time as authority. | READY |
| G10 ATOMIC_TRANSACTION | Validate current state and commit status plus required audit atomically; rollback must leave neither a partial transition nor a partial committed event. | READY |
| G11 STALE_CONCURRENT_PROTECTION | Reject stale and concurrent mutation conflicts deterministically; no last-write-wins, skipped transition, or silent overwrite. | READY |
| G12 AUDIT_PERSISTENCE | Persist minimal append-only committed transition provenance and verified actor; distinguish rejection, conflict, and no-op outcomes. | READY |
| G13 RETRY_IDEMPOTENCY_SAFETY | A repeated logical command cannot duplicate a transition or audit event; a lost response has a stable retry outcome, with durable operation identity or equivalent evidence. | READY |
| G14 PUBLIC_SAFE_RESULT_FAILURE | Distinguish accepted, auth failure, hidden object, illegal transition, insufficient evidence, stale conflict, and technical failure without leaking private or provider data. | READY |
| G15 OWNER_READ_REGRESSION | Preserve GET owner-read as read-only and owner-scoped; verify it observes an accepted authoritative status. | READY |
| G16 EVALUATION_REGRESSION | Evaluation context/write remain downstream of authoritative completed; no Evaluation action mutates Visit status. | READY |
| G17 TEST_ONLY_SECRET_ISOLATION | Missing real authority/evidence fails closed; synthetic principal/evidence and raw credentials remain outside production and logs. | READY |
| G18 MYSQL_PERSISTENCE_EVIDENCE | On disposable MySQL 8-compatible engine, prove forward Flyway, audit correctness, rollback, accepted/illegal/completed cases, and stale/concurrent behavior. | READY |
| G19 TARGETED_BACKEND_QA | Cover auth/scope negatives, C1 edges, evidence validation, resource hiding, owner-read/Evaluation regressions, and data minimization. | READY |
| G20 DOCUMENTATION_SOURCE_IDENTITY_CLOSEOUT | Reconcile the implementation against frozen sources and phase identity, confirm independent QA, and report evidence without claiming unrun production gates. | READY |

Implementation closure requires implementation evidence and PASS for all 20 gates. Handoff READY statuses do not count as implementation evidence or permit a production write path.

## 7. Conditional readiness result

| Item | Current value |
|---|---|
| Operations principal foundation | MISSING |
| G01 | READY |
| G02–G04 | BLOCKED_BY_PREREQUISITE |
| G05–G20 | READY |
| Implementation evidence | NONE |
| Implementation ready | FALSE |
| Production mutation enabled | FALSE |
| Next phase ID | UNASSIGNED |
| Next action | Establish and review the Operations Principal and explicit Visit scope foundation |

After a real foundation is available and accepted, re-evaluate G02–G04 against that source, then begin only the bounded Backend/API/persistence slice in Section 4. This Handoff creates no production behavior and does not freeze any API path or provider choice.
