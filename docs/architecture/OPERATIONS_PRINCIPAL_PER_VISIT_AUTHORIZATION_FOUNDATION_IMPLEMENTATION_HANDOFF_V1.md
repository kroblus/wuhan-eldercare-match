# Operations Principal & Per-Visit Authorization Foundation Implementation Handoff V1

Status: `FROZEN_PHASE_BOUNDARY / IMPLEMENTATION_READY`

Handoff ID: `handoff.operations_principal_per_visit_authorization_foundation.v1`

Baseline HEAD: `6f4d7e4e860561cd1077dc429aaf22f0b102571e`

```text
HANDOFF_SCOPE = BACKEND_AUTH_PERSISTENCE
HANDOFF_BOUNDARY = FOUNDATION_ONLY
OPERATIONS_PRINCIPAL_AUTHORIZATION_FOUNDATION = FROZEN_FOR_IMPLEMENTATION
IMPLEMENTATION_READY = TRUE
IMPLEMENTATION_EVIDENCE = NONE
EXPECTED_NEW_FLYWAY = YES
LIFECYCLE_MUTATION_IMPLEMENTATION_READY = FALSE
PHASE_ID = UNASSIGNED
PHASE_NAME = Operations Principal & Per-Visit Authorization Foundation
PHASE_TYPE = BACKEND_AUTHORIZATION_FOUNDATION
PRODUCT_DECISIONS = CLOSED
NEW_CONTRACT_REQUIRED = NO
```

This Handoff freezes the smallest independently implementable Backend foundation needed before Visit lifecycle mutation: resolve a trusted platform Operations principal, then resolve that principal's explicit authorization for one server-persisted Visit. It does not implement either capability or enable lifecycle writes.

## 1. Source authority and relationship

The implementation follows these sources, in order:

1. `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md` freezes the platform Operations authority class, explicit per-Visit scope, and fail-closed behavior.
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` (C1) remains the authority for Visit identity and lifecycle semantics.
3. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` (C3) and the current C5 implementation define ordinary end-user identity/session semantics only.
4. `CONSULTANT_PERMISSION_CONTRACT_V1.md` defines Consultant identity and assignment; neither is Operations authentication or Visit authorization.
5. `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_IMPLEMENTATION_HANDOFF_V1.md` is the downstream lifecycle mutation boundary. Its G02–G04 remain blocked until this Foundation is implemented and closed.
6. Current V1.2 Product Source is routed by `docs/product/README.md`. The page-level PRD identifies platform Consultants and Operations/data-verification staff (p. 5), describes Consultant service activity (p. 30), and defines submitted Appointment and Visit status semantics (pp. 34–36). It does not define a credential protocol or a Visit-grant provisioning process; the Owner decision in §2 supplies the latter for this implementation boundary.

This Handoff does not amend or supersede any Frozen Contract. If implementation would widen the Operations class, weaken explicit Visit scope, or change another frozen semantic, stop and request a versioned Contract decision.

## 2. Owner-supplied provisioning decision

For this V1 implementation boundary, the Owner decided:

- A Visit grant exists only when its `(operationsPrincipalId, visitId)` pair is included in an Owner-approved grant list.
- A controlled Backend/deployment process creates and revokes those grants from the approved list.
- The same approved list is the allowlist for principal enrollment: only `operationsPrincipalId` values present in an approved pair may be provisioned. The controlled process may bind or revoke verified credential evidence only for those listed IDs, after establishing that the evidence belongs to a real platform Operations actor.
- An Operations principal cannot create, revoke, or expand its own grants, and cannot provision grants for another principal.
- Enrollment never creates a wildcard or additional Visit grant; each active scope must correspond to an explicitly approved pair.

This decision closes the grant-issuer authority gap without adding a product role, grant-management UI, or generic RBAC system. The approved list and its provisioning input are trusted operational inputs; their concrete encoding and delivery remain implementation details. They must not place credentials or real personal data in Git or the Mini Program.

## 3. Existing Backend capability at the baseline

| Area | Current evidence | Handoff consequence |
|---|---|---|
| End-user principal | `TrustedPrincipal.java` contains only `userId`; `C5AuthEvidenceResolver.java` resolves active C5 user sessions through `AuthIdentitySessionRepository`. | C5 remains an ordinary user boundary. Do not add an Operations flag to `userId` or reinterpret C5 evidence. |
| Operations authentication | No Operations principal type, resolver, credential binding, or production Operations provider exists under `server/src/main`. | Add a separate Backend trust boundary that maps verified Operations evidence to a stable opaque Operations principal. |
| Visit authorization | No explicit principal-to-Visit grant store or resolver exists under `server/src/main`; V1–V5 contain no such grant persistence. | Add explicit per-Visit authorization backed by the approved Owner grant list and durable server-side state. |
| `operator_reference` | V5 uses this as Institution publication provenance. It is not an authenticated principal or Visit grant. | Do not reuse it as Operations identity or authorization. |
| Visit data | Existing Visit persistence owns stable `visitId` and status. | The grant target is the persisted server `visitId`; no new Visit identity is created. |

The C5 result taxonomy, server-side evidence validation, opaque identity, clocks, and dependency boundaries may inform implementation structure. C5 identity and evidence do not confer Operations authority.

## 4. Operations principal boundary

### 4.1 Trusted identity

The Foundation must resolve trusted server-side Operations authentication evidence to a stable, opaque `operationsPrincipalId` in a distinct identity namespace. The principal must represent the frozen platform Operations class. A request field such as `operatorId`, `operationsPrincipalId`, `operatorRole`, or `userId` is never proof of identity or role.

Only Owner-approved, explicitly provisioned, usable Operations principals may resolve successfully. A principal ID is eligible for enrollment only if it appears in an approved principal-to-Visit pair. The controlled Backend/deployment process must bind verified evidence to that listed ID after establishing that the evidence belongs to a real platform Operations actor; it cannot enroll unlisted IDs or accept self-registration. Each accepted evidence item must map to the principal whose actor reference is used by downstream audit. A credential shared across unrelated actors, or evidence that cannot identify one stable principal, is insufficient for mutation authority.

### 4.2 Provider-neutral authentication

The Backend must own verification of the Operations evidence. The Foundation may use a suitable Backend-controlled production credential/provider mechanism, provided it:

- binds verified evidence to one provisioned stable principal;
- supports invalidation/revocation and fails closed when the principal is revoked, disabled, unknown, or the provider is unavailable;
- does not rely on C5 ordinary-user authentication, `User.phone`, Consultant identity, client claims, or `TEST_ONLY` identities;
- keeps raw credentials and provider payloads out of the Mini Program, public results, audit records, ordinary logs, and source control.

Credential format, transport, provider, framework, hashing or verifier storage, rotation procedure, and endpoint shape remain implementation details. A missing or invalid production credential must produce an authentication failure or unavailable result, never a synthetic principal.

### 4.3 Principal lifecycle

Principal identity is stable for the period in which it is provisioned. The durable server-side state must distinguish usable from revoked/disabled and unknown. Revocation must prevent subsequent authorization resolutions; any cache or replication mechanism must not continue granting authority after the authoritative revocation takes effect. No staff name, phone, portrait, department, or title is required for the mutation boundary.

## 5. Per-Visit authorization boundary

### 5.1 Grant semantics

Authorization is the explicit, current relation:

```text
trusted operationsPrincipalId
  + server-persisted visitId
  + active Owner-approved grant
  -> AUTHORIZED
```

There are no wildcard, role-wide, Institution-wide, or inferred grants in V1. Knowing `visitId`, belonging to platform Operations, owning the Visit, or being assigned as its Consultant does not itself authorize a mutation. The grant is checked for every downstream lifecycle command.

The grant source of truth is durable Backend-controlled state populated only from the Owner-approved grant list through the controlled Backend/deployment provisioning process in §2. The approved input must identify the exact principal and Visit pair. The provisioning path must reject malformed, unknown-principal, or unknown-Visit entries and must not convert absent input into broad access.

### 5.2 Creation, revocation, and provenance

The provisioning process creates or revokes grants; application Operations principals cannot self-provision or alter grants. The persisted record must preserve enough minimum provenance to establish that the exact pair came from an Owner-approved provisioning input and when the Backend accepted creation or revocation. It must not retain raw credentials. Revocation must remain effective across process restart; physical event/table representation is an implementation choice.

Existing Visits receive no automatic or backfilled grants. A missing grant means denied until an explicit approved provisioning action creates one. A revoked grant cannot be revived by a lifecycle request; a future grant requires a new approved provisioning action.

### 5.3 Resolver outcomes and privacy

The application boundary must distinguish, using current Backend result conventions:

- verified usable principal;
- missing, invalid, unknown, disabled, or revoked principal;
- `AUTHORIZED` for an active exact principal-to-Visit grant;
- `DENIED/HIDDEN` for no active grant or an unknown/out-of-scope Visit;
- provider/repository `UNAVAILABLE` or `TECHNICAL_FAILURE`.

For an ordinary caller, a Visit outside the principal's scope and a nonexistent Visit must have the same hidden/not-found behavior. Do not disclose Visit existence, owner, status, grant details, credential state, or internal provider errors. Technical unavailability must not become authorization success.

The resolver consumes a trusted principal and server-resolved Visit identity. It must not read Consultant assignment or accept caller-supplied user, owner, Consultant, Institution, status, or scope claims as authority.

## 6. Persistence and migration boundary

**EXPECTED_NEW_FLYWAY = YES.** V1–V5 contain no durable Operations principal/grant capability. Add forward-only persistence after the current V5 chain for the minimum state needed to resolve provisioned principals, their usable/revoked state, exact principal-to-Visit grants, and provisioning/revocation provenance. Verify the active migration chain before selecting the next version; do not rewrite V1–V5.

The schema must support:

- stable opaque Operations principal identity distinct from `userId`;
- credential verifier/reference or provider binding without storing raw credentials;
- explicit `(operationsPrincipalId, visitId)` grant state and revocation;
- Owner-approved provisioning provenance and Backend-recorded timestamps;
- deterministic resolution after restart and fail-closed handling of missing/ambiguous state.

No historical operator, credential, or Visit grant may be fabricated. Physical table/column names, indexes, hashing algorithm, and migration version are implementation details.

## 7. Application and lifecycle consumer boundary

Expose two independently testable Backend application ports (or project-equivalent names):

1. Operations evidence → trusted Operations principal resolution.
2. Trusted Operations principal + server `visitId` → `AUTHORIZED`, `DENIED/HIDDEN`, or unavailable/technical result.

The future lifecycle mutation service may consume only the verified principal and authorization result. It may not parse raw credentials, trust client principal fields, infer access from role alone, or derive Operations authorization from Consultant assignment. It remains responsible for separately applying the Lifecycle Contract and C1 rules after this Foundation closes.

This Handoff does not add a lifecycle endpoint, mutate Visit status, validate completion evidence, write lifecycle timestamps/audit, or change owner-read, Evaluation, Institution, Recommendation, or Appointment APIs.

## 8. Security, privacy, and isolation

- C5 `TrustedPrincipal(userId)` remains end-user identity. No `C5 userId + special flag` elevation is allowed.
- Consultant identity, assignment, default Consultant resolution, and Consultant permissions never create an Operations principal or Visit grant.
- `User.phone`, `getPhoneNumber`, C6 G13, real WeChat end-user login, and real personal data are not required.
- Raw Operations credentials, C5 evidence, provider payloads, secrets, and internal grant details never enter public results, ordinary logs, or audit content.
- Production dependencies contain no `TEST_ONLY` principal, credential, Visit grant, resolver, or synthetic fallback. Missing production configuration, principal, or grant fails closed.
- No generic IAM/RBAC, organization hierarchy, admin dashboard, Consultant management, staff Mini Program mode, or grant-management UI is part of this Foundation.

```text
REAL_PHONE_REQUIRED = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
COMPANY_SUBJECT_MATERIAL = NOT_USED
```

## 9. Targeted implementation evidence

The Foundation implementation must provide targeted evidence, without claiming real-account or deployment E2E:

- valid synthetic Operations evidence resolves to its stable provisioned principal;
- missing, invalid, unknown, disabled, or revoked evidence fails closed;
- one Owner-approved exact grant resolves `AUTHORIZED`;
- absent/revoked grant fails closed; an Operations principal cannot create or alter its grant;
- unknown Visit and out-of-scope Visit share hidden semantics;
- C5 ordinary user, Consultant identity, assignment, and client-supplied principal/scope claims cannot resolve or grant Operations authority;
- production credential/grant missing and provider/store unavailable do not fall back to `TEST_ONLY` or success;
- raw credentials and provider errors are absent from result, audit, and application logs;
- if durable persistence is added, disposable MySQL verifies forward migration, create/revoke persistence across restart, and correct principal/grant resolution.

Use only synthetic principals, credentials, and Visit IDs. No production credentials or real Visit data are part of this phase.

## 10. Mandatory Foundation Gates G01–G21

Gate status describes requirement readiness only. `READY` means a later implementation has an actionable acceptance requirement; it is not runtime PASS or evidence that the capability exists.

| Gate | Acceptance requirement | Handoff status |
|---|---|---|
| G01 SOURCE_FROZEN_CONFORMANCE | Preserve the Operations Lifecycle Contract, C1, C3/C5, Consultant, owner-read, and privacy boundaries. | READY |
| G02 STABLE_OPERATIONS_PRINCIPAL_IDENTITY | Resolve a stable opaque principal in an Operations-specific namespace; no client-selected identity. | READY |
| G03 PRODUCTION_AUTHENTICATION_BOUNDARY | Verify production Operations evidence in the Backend and bind it to one provisioned principal; mechanism remains implementation detail. | READY |
| G04 PRINCIPAL_INVALIDATION_FAIL_CLOSED | Unknown, disabled, revoked, or unavailable principal state never authenticates; revocation applies to subsequent resolutions. | READY |
| G05 SECRET_CREDENTIAL_ISOLATION | Keep raw credentials server-side and out of Git, Mini Program, results, audit, and ordinary logs. | READY |
| G06 EXPLICIT_PER_VISIT_GRANT | Require an active exact principal-to-persisted-visit grant on every lifecycle authorization. | READY |
| G07 AUTHORIZATION_SOURCE_AND_RESOLVER | Resolve grant truth from durable Backend-controlled state; no role-wide, Consultant, owner, or client-claim inference. | READY |
| G08 GRANT_PROVISIONING_AUTHORITY | Use Owner-approved principal/Visit grants created and revoked only through the controlled Backend/deployment process; principals cannot self-grant. | READY |
| G09 ANTI_ENUMERATION | Map nonexistent and unauthorized Visits to the same public hidden result; keep provider/store failure distinct and fail closed. | READY |
| G10 DURABLE_PERSISTENCE | Add forward-only migration for durable principal/grant state and revocation where required; preserve semantics after restart. | READY |
| G11 PROVISIONING_PROVENANCE_AND_SERVER_TIME | Preserve minimal approved-input provenance and Backend-recorded creation/revocation time without secrets or fabricated history. | READY |
| G12 APPLICATION_RESULT_FIREWALL | Return only stable auth/authorization outcomes; suppress credentials, internal grant data, and raw provider errors. | READY |
| G13 LIFECYCLE_CONSUMER_BOUNDARY | Future mutation service consumes trusted principal and per-Visit authorization result; this Foundation adds no status mutation. | READY |
| G14 C5_END_USER_ISOLATION | C5 user identity/session cannot be elevated to Operations authority. | READY |
| G15 CONSULTANT_ASSIGNMENT_ISOLATION | Consultant identity/assignment does not grant Operations authority or Visit scope. | READY |
| G16 PHONE_C6_ISOLATION | No phone identity or C6 G13 dependency. | READY |
| G17 TEST_ONLY_PRODUCTION_ISOLATION | Synthetic principal/credentials/grants remain test-only; production missing-input paths fail closed. | READY |
| G18 TARGETED_AUTHORIZATION_TESTS | Test valid/invalid/revoked principals, exact/absent grants, self-grant rejection, anti-enumeration, and authority isolation. | READY |
| G19 DISPOSABLE_MYSQL_EVIDENCE | If persistent state is added, prove migration and principal/grant create/revoke/restart behavior on disposable MySQL. | READY |
| G20 SECURITY_AND_INDEPENDENT_QA | Complete targeted secret/privacy review and independent diff-driven QA. | READY |
| G21 DOCUMENTATION_AND_SOURCE_IDENTITY_CLOSEOUT | Verify source identity, migration version, Gate evidence, and lifecycle handoff dependency before closeout. | READY |

All 21 statuses are implementation acceptance criteria, not test results. Foundation closure requires actual implementation and evidence for applicable gates. Until then, no production Operations principal or grant is assumed to exist.

## 11. Phase and closeout boundary

```text
OPERATIONS_PRINCIPAL_AUTHORIZATION_FOUNDATION_HANDOFF = FROZEN
PRODUCT_DECISIONS = CLOSED
NEW_CONTRACT_REQUIRED = NO
IMPLEMENTATION_READY = TRUE
IMPLEMENTATION_EVIDENCE = NONE
LIFECYCLE_MUTATION_IMPLEMENTATION_READY = FALSE
READY_FOR_NEXT_TASK = TRUE
PHASE_ID = UNASSIGNED
```

Do not assign `V1.2-C7` or another phase number without an explicit governance route. The next implementation is limited to this Backend authentication and per-Visit authorization Foundation. After it independently closes, re-evaluate G02–G04 in `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_IMPLEMENTATION_HANDOFF_V1.md`; this Handoff does not authorize starting that lifecycle mutation slice in parallel.

## 12. Non-goals

- Visit lifecycle mutation, transition evaluation, completion evidence, transition timestamps, or lifecycle audit;
- status mutation API/controller/service/repository;
- owner-read or Evaluation changes;
- Institution or Recommendation changes;
- generic IAM/RBAC, organization hierarchy, Operations console, staff login UI, or grant-management UI;
- Consultant assignment changes or Consultant mutation authority;
- phone/G13, real-user data, real-account E2E, cross-device, trial/release, or deployment readiness.
