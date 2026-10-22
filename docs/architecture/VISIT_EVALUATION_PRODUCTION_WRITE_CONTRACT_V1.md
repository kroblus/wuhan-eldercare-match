# VisitEvaluation Production Write Contract V1

Status: `FROZEN`

Frozen: `2026-09-24`

Owner decision: freeze the production submission, authorization, cardinality, validation, idempotency, immutability, and data-ownership semantics for one VisitEvaluation per completed Visit. This Contract authorizes a later implementation task; it does not itself authorize code, schema migration, deployment, or production write evidence.

## 1. Authority and relationship

- `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` owns Visit identity, owner attribution, the five authoritative Visit statuses, and the prerequisite that a real Evaluation may only follow an authenticated owner's real Visit with server-authoritative `completed` status.
- `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` owns C5 trusted principal resolution, opaque stable `userId`, auth result semantics, and the existing accepted/replayed/rejected/conflict/unavailable/technical-failure pattern. This Contract reuses that boundary for Evaluation writes.
- `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md` owns the read-only owner/context endpoint and its hidden-resource policy. This Contract adds only the production write semantics; read behavior is unchanged.
- `VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md` owns the current form presentation and local draft interaction. This Contract freezes production validation and wire/persistence meaning where that UI successor explicitly left it open. Later UI implementation must send the stable values defined here.
- The current V1.2 Product Source, identified by `docs/product/README.md`, owns the evaluation questions, fee topics, tags, and product limits. This Contract does not amend that source or the older Frozen Contracts.

Scope is one authenticated user's private submission for one owned, completed Visit. It includes no Evaluation read/list API, edit, withdrawal, moderation, public rating, or promotion to Institution facts.

## 2. Authorization and creation eligibility

A new Evaluation may be created only when all conditions hold:

1. The request has a valid current session resolved by the existing C5 `AuthEvidenceResolver`.
2. The trusted opaque `userId` comes only from that authenticated resolution.
3. The server resolves `visitId` and confirms the persisted Visit owner equals that `userId`.
4. The server-side Visit status is exactly `completed` at the creation consistency boundary.
5. No Evaluation has already been committed for that Visit.

An unknown Visit and a Visit owned by another user have the same public `NOT_FOUND` result. They reveal neither Visit existence, status, nor Evaluation existence. Authentication and owner checks precede any result that could reveal a Visit or existing submission.

The persisted server Visit is the sole status authority. Client `status`, `completed`, route data, local ViewModel state, date passage, user statement, and page navigation cannot establish eligibility. A new Evaluation against any other C1 status (`requested`, `contacting`, `scheduled`, or `cancelled`) is rejected as `NOT_COMPLETED`.

User.phone is not required, read, matched, used as an owner key, stored in the Evaluation, or used as Evaluation identity. No `getPhoneNumber` capability is required.

## 3. Cardinality and immutable submission

V1 freezes:

```text
ONE_COMPLETED_VISIT -> AT_MOST_ONE_COMMITTED_VISIT_EVALUATION
```

V1 has no deletion, withdrawal, replacement, or inactive-record workflow. Therefore at most one committed Evaluation record exists for a Visit for its lifetime under this Contract. A successful submission is immutable to ordinary users: no edit, overwrite, upsert, or second submission can replace it. Any correction/revision or administrative withdrawal requires a separately versioned successor.

Different Visits may have different Evaluations by the same trusted user. This Contract does not create a public review thread or support multiple submissions for one Visit.

## 4. Request and trusted authority

The production operation is:

```text
POST /api/v1/visits/{visitId}/evaluation
X-Auth-Evidence: <existing C5 session evidence>
Content-Type: application/json
```

The path `visitId` is the only Visit identity supplied by the client. The request body has this versioned envelope and evaluation content:

```json
{
  "contractVersion": "visit-evaluation-production-write-contract-v1",
  "kind": "visit_evaluation_submission_request_v1",
  "idempotencyKey": "<opaque request identity>",
  "overallRating": 1,
  "consideration": "willing",
  "ratings": {
    "hygiene": 5
  },
  "feeExplanationClear": "clear",
  "feeTopicExplanations": {
    "bed_fee": "explained"
  },
  "careProcessObservations": {
    "careRecordLearned": "yes",
    "handoverLearned": "unconfirmed",
    "handoverTopics": ["unconfirmed"]
  },
  "likedTags": ["care"],
  "concernTags": ["care"],
  "comment": "Optional user-reported comment"
}
```

The example is illustrative; only `contractVersion`, `kind`, `idempotencyKey`, `overallRating`, and `consideration` are required. Unanswered optional values are omitted. No client field can establish authority for `userId`, `ownerId`, `evaluationId`, `institutionId`, `institutionRecordRevision`, Visit status/completion, server timestamp, auth result, or persistence state. Those values are resolved or generated by the Backend.

The raw C5 evidence is accepted only at the existing auth boundary. It is not Evaluation data and never appears in a result, log, route, analytics, or stored Evaluation row.

## 5. Frozen field semantics

### 5.1 Required fields

- `overallRating`: required integer from 1 through 5.
- `consideration`: required stable code. Reuse the current V1.2 codes exactly: `willing`, `compare`, or `not_considering`. Chinese display labels are not domain identity.

Missing required values or any other code fails validation. An Evaluation cannot consist only of optional observations or a comment.

### 5.2 Optional dimension ratings

`ratings` is optional and may contain any subset of the current V1.2 keys:

```text
hygiene
room_comfort
age_friendly_facilities
common_space
living_atmosphere
service_attitude
professional_impression
communication_with_elder
on_site_care_order
medical_support
emergency_explanation
rehabilitation_facilities
safety_management
dining_room_environment
meal_impression
dietary_arrangement_explanation
dietary_needs_fit
activity_space
activity_variety
daily_life_atmosphere
common_area_use
```

Each included value must be an integer from 1 through 5. Omitted keys remain unanswered; they are never converted to zero, a negative rating, or an inferred score. Unknown keys and invalid values fail validation. Partial dimension submission is allowed. No average, total, weighted score, or Institution score is derived.

### 5.3 Fee transparency

The aggregate `feeExplanationClear` field is optional and retains its current stable values `clear` or `unclear`.

In addition, the Product Source's seven fee topics are optional, independent user observations under `feeTopicExplanations`. The keys and stable answer codes are:

| Key | Product topic | Allowed value |
|---|---|---|
| `bed_fee` | Bed fee | `explained`, `not_explained`, `unconfirmed` |
| `meal_fee` | Meal fee | `explained`, `not_explained`, `unconfirmed` |
| `care_fee` | Care fee | `explained`, `not_explained`, `unconfirmed` |
| `management_fee` | Management fee | `explained`, `not_explained`, `unconfirmed` |
| `special_care_fee` | Special-care fee | `explained`, `not_explained`, `unconfirmed` |
| `deposit` | Deposit | `explained`, `not_explained`, `unconfirmed` |
| `other_one_time_fee` | Other one-time fees | `explained`, `not_explained`, `unconfirmed` |

Each topic may be omitted when unanswered. The aggregate clarity answer and topic answers are separate observations; the aggregate is not a substitute for any topic answer, and the Backend does not infer one from the other. No amount, quote, price fact, or fee score is created. The form may be expanded in the later persistence implementation to collect these per-topic answers.

### 5.4 Care-process observations

`careProcessObservations` is optional. Its optional fields are:

- `careRecordLearned`: `yes`, `no`, or `unconfirmed`.
- `handoverLearned`: `yes`, `no`, or `unconfirmed`.
- `handoverTopics`: a set containing zero or more of `vital_signs`, `abnormal_events`, `handling_method`, `follow_up`, `family_communication`, or `unconfirmed`.

`no` means the user reports that this visit led them to understand the answer as no; `unconfirmed` means the user did not confirm the information. These are distinct values and must remain distinct.

`unconfirmed` in `handoverTopics` is mutually exclusive with all five specific topics. The only valid non-empty forms containing that code are `["unconfirmed"]` or a set of specific topic codes without `unconfirmed`. Unknown codes and duplicates fail validation. This V1 evaluation question set does not include `medical_transfer`; that Institution detail field is not added to VisitEvaluation by inference.

These fields are `USER_REPORTED_VISIT_OBSERVATION` only. No value is evidence that an Institution process exists or does not exist.

### 5.5 Tags

`likedTags` and `concernTags` are independently optional sets. Each group allows at most three unique codes from:

```text
care, medical, room, environment, dining, activities, transport, price,
staff_attitude, other
```

Duplicates within one group, unknown codes, or more than three entries in either group fail validation. The same code may appear once in each group; for example, `care` may be both liked and a concern. The groups have independent counts and meanings.

### 5.6 Comment

`comment` is optional and may contain at most 200 product characters. An omitted or empty comment is unanswered. The Backend enforces the product limit; this Contract does not prescribe a Unicode storage/counting algorithm beyond that product-level limit. The comment is user-reported content and must not be written to generic logs or error responses.

## 6. Logical idempotency and duplicate outcomes

Every logical submission has a non-empty opaque `idempotencyKey`. The client creates it once for a new submit intent and reuses the same key for every retry of that intent, including after timeout, disconnect, or an unknown client outcome. A retry must not generate a new key merely because the first response was not received. The key is not derived from phone, identity, Visit content, or credentials.

The semantic idempotency scope is:

```text
trusted userId + visitId + idempotencyKey
```

The Backend compares the validated, normalized Evaluation content for an existing key. The envelope and key are excluded from content comparison. Object property order has no semantic effect; `likedTags`, `concernTags`, and `handoverTopics` are set-valued and their order has no semantic effect. Omitted unanswered optional values, empty optional arrays, and an empty comment normalize to the same unanswered content. Any optional rating/enum value that is present must be valid. Comment text otherwise compares exactly; the Backend does not trim or rewrite user text for comparison.

Outcomes are deterministic:

1. No Evaluation exists and the request commits: `accepted` with one new Evaluation receipt.
2. An Evaluation exists for the Visit and the request repeats its original idempotency key with identical normalized content: `replayed` with the same receipt (`evaluationId`, `visitId`, `submittedAt`). It creates no write and no second success event.
3. An Evaluation exists and the same idempotency key is reused with different content: `conflict` / `IDEMPOTENCY_CONFLICT`. It does not alter the first Evaluation.
4. An Evaluation exists and a different key expresses a new submit intent: `rejected` / `ALREADY_SUBMITTED`. The existing Evaluation is not returned and is not changed.

For a first attempt with no Evaluation, an owned Visit must currently be `completed`. Exact replay is resolution of a previously committed request, not a new creation, and returns the original receipt after current session and owner checks. A different new intent remains `ALREADY_SUBMITTED` even if the Visit status later changes. Neither case exposes Evaluation content.

The idempotency decision must survive an uncertain response for as long as needed to prevent a duplicate accepted record. Key storage, hashing/protection, and retention mechanism are implementation choices, but an expiration policy may not turn a committed same-intent retry into a second Evaluation.

## 7. Concurrent submissions and consistency boundary

When concurrent requests target the same Visit:

- exactly one new Evaluation at most may commit;
- identical owner/Visit/key/content requests resolve as one `accepted` result and subsequent `replayed` result(s);
- a different key resolves as `ALREADY_SUBMITTED` after the winner commits;
- a reused key with different content resolves as `IDEMPOTENCY_CONFLICT`;
- no request may overwrite the winner or commit a partial duplicate.

The authorization, owner lookup, current completed-status check, idempotency decision, one-per-Visit cardinality enforcement, Evaluation creation, and durable success result must behave within a consistency boundary that prevents time-of-check/time-of-use and concurrent duplicate races. SQL locks, transaction isolation, ORM, table names, and whether idempotency data is stored with the Evaluation or separately remain implementation choices. A durable uniqueness/atomicity guarantee is mandatory.

## 8. Evaluation identity, revision binding, and timestamp

The Backend creates a stable opaque `evaluationId` according to the existing server identity policy. The persisted record is bound to:

- `evaluationId`;
- `visitId`;
- authenticated trusted `userId`;
- `institutionId` and `institutionRecordRevision` read from that Visit's authoritative server-side record;
- required and submitted optional Evaluation fields;
- a trusted server-side submission timestamp.

The client cannot supply or override these identity, ownership, revision, status, or timestamp values. The institution revision is the exact revision already bound to the Visit at visit time; a later Institution revision cannot rewrite the Evaluation binding. The stable response field is `submittedAt`, generated from Backend/server time and identical on replay. Client time is never authoritative.

## 9. Versioned result and error semantics

The result follows the current Backend C3/C5 versioned JSON Application-result convention and the Visit Evaluation Context Contract: a well-formed request reaching the Application boundary returns HTTP 200 with a stable semantic result. Transport/parser failures may remain HTTP/network errors; they do not authorize a new key. The client retains its draft and retries the same key when commit outcome is unknown.

Every Application result has exactly these top-level fields:

```text
contractVersion = visit-evaluation-production-write-contract-v1
kind = visit_evaluation_submission_result_v1
authResolution = authenticated | missing | expired | invalid | unavailable | technical_failure
outcome = accepted | replayed | rejected | conflict | unavailable | technical_failure
code = stable non-blank public code
receipt = { evaluationId, visitId, state, submittedAt } | null
fieldErrors = array of { field, code } | null
```

`receipt.state` is always `submitted`. A receipt is present only for `accepted` and `replayed`; both contain the same authoritative values for one logical submission. Other outcomes carry no evaluation identity, timestamp, Evaluation content, Visit snapshot, owner data, or success wording. `fieldErrors` is a non-empty array only for `VALIDATION_FAILED` and null for every other result; entries identify stable field paths and machine codes without echoing input values. Every result has a non-blank `code`, following the existing C3 result convention.

| Semantic result | Stable `code` | Meaning |
|---|---|---|
| `accepted` | `ACCEPTED` | A new Evaluation was atomically committed. |
| `replayed` | `REPLAYED` | Same owner/Visit/key/content; return the original minimal receipt. |
| `rejected` | `AUTH_REQUIRED` | Session resolution is `missing`, `expired`, or `invalid`; no Visit data is returned. |
| `rejected` | `NOT_FOUND` | Visit is unknown or not owned by the authenticated user; both are indistinguishable. |
| `rejected` | `NOT_COMPLETED` | Owned Visit exists, but a new Evaluation cannot be created because authoritative status is not `completed`. |
| `rejected` | `VALIDATION_FAILED` | Required/value/unknown-key/tag-limit/duplicate/observation/comment validation failed; safe `fieldErrors` may identify fields. |
| `rejected` | `ALREADY_SUBMITTED` | A different new intent targets a Visit with an Evaluation already committed. No existing receipt is disclosed. |
| `conflict` | `IDEMPOTENCY_CONFLICT` | The same owner/Visit/key was reused with different normalized content. |
| `unavailable` | `SERVICE_UNAVAILABLE` | Required owned auth, Visit, or persistence service is unavailable and commit is not established. |
| `technical_failure` | `TECHNICAL_FAILURE` | Unclassified internal failure or an outcome that cannot be safely projected. |

`authResolution` reuses the C5 `AuthEvidenceResolver` values exactly. `missing`, `expired`, and `invalid` map to `rejected/AUTH_REQUIRED`; an unavailable resolver maps to `unavailable/SERVICE_UNAVAILABLE`; resolver technical failure maps to `technical_failure/TECHNICAL_FAILURE`. Only `authenticated` carries a trusted principal. No raw token/provider reason, database error, SQL constraint, exception, stack trace, or resource-existence detail may enter the result.

Validation codes are stable and safe to expose; at minimum implementations distinguish invalid rating, invalid consideration, unknown field/value, invalid or repeated tag, tag limit exceeded, invalid observation/topic, `unconfirmed` handover exclusivity violation, and comment over-limit. User-facing Chinese copy remains a Page concern.

## 10. Persistence implementation Gates

A conforming persistence implementation must provide durable record semantics for:

- server-generated stable `evaluationId`;
- `visitId`, trusted `userId`, `institutionId`, and `institutionRecordRevision`;
- required `overallRating` and `consideration`;
- optional dimension ratings, fee transparency and seven fee-topic answers, care observations/topics, tag groups, and comment;
- server-generated authoritative `submittedAt`;
- one committed Evaluation per Visit;
- enough protected idempotency identity/content-comparison data to distinguish exact replay from changed-payload conflict and a new already-submitted intent.

The schema may use normalized columns, JSON, related tables, or another existing persistence representation if it preserves all Contract semantics, constraints, privacy boundaries, and deterministic replay. A database uniqueness constraint is preferred where supported; if another design is used, equivalent durable enforcement must be demonstrated under concurrent requests. The Contract does not prescribe SQL DDL, key hashing, locking, isolation level, JSON encoding, or ORM.

Migration must be additive/versioned, preserve existing Visit/C5 identity/session history, and must not introduce or update Institution facts, Recommendation data, Evaluation public projections, or historical Visits. No Evaluation table or migration is created by this Contract.

## 11. Data ownership, privacy, and forbidden writes

```text
VisitEvaluation = USER_REPORTED_DATA
careProcessObservations = USER_REPORTED_VISIT_OBSERVATION
```

An Evaluation is a private user/operations service record under V1.2. It is not a verified claim about an Institution. A future VerificationLead may use user feedback as a review clue only through the separately authorized human review and new Institution verification/revision path; this Contract defines no automatic promotion.

The Evaluation write must never create, update, score, or otherwise contaminate:

- `Institution`, `InstitutionCapability`, `InstitutionCareProcess`, `InstitutionVerification`, or Institution evidence/revision;
- `ElderProfile`, Assessment, or health answers;
- Recommendation V2 safety, eligibility, exactness, reason, gap, priority-fit vector, rank, `NO_EXACT_MATCH`, or any input/score;
- `ratingScore`, `averageRating`, `popularityScore`, `reviewWeight`, `careProcessScore`, or recommendation boost.

```text
PUBLIC_INSTITUTION_RATING = DISABLED_V1_2
```

No public Evaluation list, public comment community, average rating, or public count is produced. Response projection is limited to the minimal receipt. Raw comment, session evidence, phone, credential, provider data, health/Profile data, SQL/constraint details, and internal exceptions must not be logged or placed in generic errors. The Evaluation record has no phone, provider token, contact phone, ElderProfile, Assessment, or raw auth evidence field.

## 12. Client application behavior

The production client remains compatible with `editing → submitting → submitted | submit_failed`:

- A valid `accepted` or exact `replayed` result moves to `submitted`.
- `VALIDATION_FAILED` returns/remains in editable state with safe field errors; all draft input is retained.
- A recoverable transport/service/technical failure retains every draft value and the same `idempotencyKey` for retry until a definitive result is received.
- `ALREADY_SUBMITTED` is terminal for another write intent for that Visit. The client must not silently issue a new key or display a second Evaluation as submitted.
- `NOT_FOUND`, auth failure, and `NOT_COMPLETED` never unlock a write or reveal another user's data.
- A tap guard may prevent local duplicate actions but does not replace Backend idempotency/cardinality enforcement.

The client does not claim persistence from HTTP 200 alone; only a validated `accepted`/`replayed` result with the exact contract envelope and minimal receipt establishes `submitted`.

## 13. Non-goals and completion evidence for implementation

This Contract does not authorize Evaluation read/list, editing after submit, deletion, appeal, Operations moderation, admin correction, Appointment list owner-read, Visit status mutation, a production publication flow, or a public rating feature. It does not reopen C6/G13 and has no dependency on phone authorization.

The later implementation Gate must prove, at minimum: authenticated trusted owner binding; hidden unknown/foreign Visit behavior; server-authoritative completed eligibility; required/optional/value validation; seven fee topic mappings and aggregate separation; `unconfirmed` mutual exclusion; independent tag limits and cross-group reuse; exact replay vs changed-key/payload outcomes; concurrent cardinality; immutability; server identity/revision/timestamp authority; minimal result and secret/privacy firewall; no Institution/Recommendation writes; migration compatibility; and production/test-provider separation. Runtime evidence must not be presented as real-user or production-database evidence unless those environments were actually used and authorized.

## 14. Frozen V1 decisions

```text
AUTHORIZATION = EXISTING_C5_SESSION + TRUSTED_OWNER + SERVER_COMPLETED
PHONE_REQUIRED = FALSE
CARDINALITY = ONE_COMMITTED_EVALUATION_PER_VISIT
REQUIRED = overallRating, consideration
PARTIAL_DIMENSION_RATINGS = ALLOWED
IDEMPOTENT_REPLAY = SAME_OWNER_VISIT_KEY_AND_NORMALIZED_CONTENT
SAME_KEY_CHANGED_CONTENT = IDEMPOTENCY_CONFLICT
NEW_KEY_AFTER_SUCCESS = ALREADY_SUBMITTED
CONCURRENT_DUPLICATE = AT_MOST_ONE_COMMIT
POST_SUBMIT_EDIT = FORBIDDEN_V1
UNKNOWN_HANDOVER = MUTUALLY_EXCLUSIVE
TAG_CROSS_GROUP_DUPLICATE = ALLOWED
INSTITUTION_REVISION = TRUSTED_VISIT_BOUND_REVISION
INSTITUTION_OR_RECOMMENDATION_WRITE = FORBIDDEN
PUBLIC_INSTITUTION_RATING = DISABLED_V1_2
```

No product/open decision blocks a conforming V1 persistence implementation. Physical schema and transaction mechanisms remain implementation choices constrained by the semantic Gates above.
