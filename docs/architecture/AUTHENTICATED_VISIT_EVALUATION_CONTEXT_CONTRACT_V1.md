# Authenticated VisitEvaluation Context Contract V1 — Read-Only Successor

Status: `FROZEN`

Frozen: `2026-09-24`

Owner decision: authorize the smallest production owner-read and evaluation-context successor, plus a Flyway V3 constraint migration that permits exactly the five C1 Visit statuses. This Contract does not authorize lifecycle mutation or VisitEvaluation production writes.

## 1. Authority and scope

- `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` owns Visit identity, trusted ownership, the five authoritative status values, and §15 Evaluation prerequisites.
- `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` owns the trusted opaque principal and requires a later authenticated owner-read boundary; this Contract supplies only that read boundary for a single Visit's Evaluation context.
- `VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md` owns the form, local draft and TEST_ONLY submit states. This Contract permits production context loading and local editing only. No production Evaluation submit, persistence, uniqueness, idempotency or edit-after-submit semantics are defined.
- The C5 self-owned session and existing `AuthEvidenceResolver` remain the only production authentication authority. User.phone is contact evidence, never an owner key.

## 2. Request and authorization

`GET /api/v1/visits/{visitId}/evaluation-context` accepts only the path `visitId` and the existing `X-Auth-Evidence` header carrying C5 session evidence. There is no request body, client status, `userId`, phone, institution identity or completion flag. Route/query data never establishes eligibility.

The Backend resolves the session through the existing `AuthEvidenceResolver`. Only an `authenticated` resolution yields its trusted opaque `userId`. The repository must read by both `visitId` and this trusted `userId`; unknown and other-owner Visit IDs have the same public `not_found` result and no context. No phone matching, development user identity or TEST_ONLY fallback is allowed. A missing, expired, invalid or unavailable session cannot yield Visit data.

The persisted server-side `InstitutionVisit.status` is the sole status authority. `eligible` requires an owned Visit with status exactly `completed`; `requested`, `contacting`, `scheduled` and `cancelled` yield `not_completed`. Date passage, a route parameter or page state cannot imply completion. This read does not create or change a Visit.

## 3. Versioned public result

The existing Backend convention is a stable JSON result with HTTP 200 for application/auth outcomes. Transport failures can still occur and the client must treat them as load errors. The result has exactly these top-level fields:

```text
contractVersion = authenticated-visit-evaluation-context-contract-v1
kind = authenticated_visit_evaluation_context_result_v1
authResolution = authenticated | missing | expired | invalid | unavailable | technical_failure
availability = eligible | not_completed | not_found | unavailable | technical_failure | null
context = { visitId, institutionId, institutionRecordRevision, visitStatus } | null
```

`authResolution` uses the existing `AuthEvidenceResolver` taxonomy. If it is not `authenticated`, `availability` and `context` are null. For `authenticated`, `availability` is non-null. `context` is non-null only for an owned Visit with `availability=eligible` or `not_completed`; otherwise it is null. `visitStatus` is one of C1's five values. An unexpected/corrupt persisted status fails closed as `technical_failure`, without a context. Repository/database unavailability maps to `unavailable`; other technical errors map to `technical_failure`. Neither raw exception nor resource-existence detail enters the result.

The context contains no owner/user ID, Elder ID, phone, contact name, notes, health answers, internal operations data, session evidence, or Institution verified facts. No display name or snapshot is invented because the current persisted Visit does not contain one and the page does not require one.

## 4. Frontend and data boundary

The production evaluation page starts in context loading. Only an exact valid `authenticated + eligible` response for its requested `visitId`, with `visitStatus=completed`, may enter local `editing`. `not_completed` shows a non-editable eligibility message; `not_found` and auth failures reveal no other-owner details. Service/transport failure offers a guarded retry. No response, invalid schema, or missing provider may fall back to a TEST_ONLY fixture.

The page may obtain a fresh C5 session through the existing WeChat login exchange and forward its opaque evidence only in the request header. It must not put session evidence in route parameters, page state, storage or logs. Production evaluation submission stays disabled and cannot claim persistence; TEST_ONLY submit remains restricted to its existing test/development graph.

No VisitEvaluation write, Institution fact/revision write, public rating, Recommendation input, phone authorization, Appointment list owner-read or Operations status command is in scope.

## 5. Persistence compatibility

Flyway V1's `chk_institution_visit_status_requested` admits only initial `requested` records. A V3 migration may replace it with a constraint admitting exactly `requested`, `contacting`, `scheduled`, `completed`, `cancelled`, as already frozen by C1. It does not update any row or add a status mutation API. Invalid out-of-band statuses must fail migration instead of being silently rewritten. Migration checks use a disposable database; no clean/repair or destructive operation on Owner data is authorized.

## 6. Verification boundary

Targeted evidence must cover owned completed and each other C1 status; unknown and foreign-owned IDs with identical hidden response; missing/expired/invalid session; database unavailable/failure; no client status authority; minimal JSON projection; frontend loading, eligible, denied, unavailable and retry; production fixture isolation; and V3 schema behavior in a safe disposable database where available.

Passing this read successor does not mean production Evaluation persistence, Appointment list owner-read, real-user Evaluation write E2E, C6 G13 or production publication passed.
