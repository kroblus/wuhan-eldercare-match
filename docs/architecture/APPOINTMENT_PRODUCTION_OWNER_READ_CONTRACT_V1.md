# Appointment Production Owner-Read Contract V1

Status: `FROZEN`

Frozen: `2026-09-25`

Contract ID: `appointment-production-owner-read-contract-v1`

Owner decision: freeze only the authenticated collection read for the current user's retained InstitutionVisits and the minimum Appointment list projection. This Contract authorizes a later implementation; it does not implement a repository, API, historical Institution resolver, Mini Program provider, lifecycle command, or deployment.

## 1. Authority and scope

- `docs/product/README.md` routes to the current V1.2 Product Source for “我的预约”, its five tabs, and the completed Visit evaluation entry.
- `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` (C1) owns Visit identity, the five domain statuses, Backend/Operations status authority, owner/history permission, and Visit-to-Institution revision binding.
- `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` (C3) owns the authenticated principal and formal Visit persistence; its deferred collection owner-read boundary is supplied here.
- `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md` owns the single-Visit owner check and final Evaluation context eligibility. This Contract neither widens nor replaces that authority.
- `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` owns exact Institution identity/revision resolution and forbids substituting the current/latest revision for a historical one.

The only collection in scope is the requesting authenticated user's InstitutionVisits that the system still retains. This Contract does not define retention duration, archive/deletion operations, Visit creation, operational status mutation, Evaluation read/write, Institution detail, public appointments, or Consultant/Operations collection access.

## 2. Authentication and collection ownership

The existing C5 session, passed only through `X-Auth-Evidence`, is resolved by the existing `AuthEvidenceResolver`. Only an `authenticated` resolution supplies the trusted opaque `userId`. The Backend must constrain the collection read by that `userId` before projection; it must not read all Visits and leave ownership filtering to the client.

The client supplies no `userId`, `ownerId`, openId, phone, institution identity, status, completion flag, or other ownership authority. Neither a route/query value nor knowledge of a `visitId` proves ownership. No session, an expired/invalid session, or an unavailable authentication boundary yields no Visit data. User.phone is neither required nor an account/owner key.

If a future single-Visit owner-read operation is added, an unknown Visit and another owner's Visit must retain the same hidden `not_found` semantics already frozen for the Evaluation context. This collection operation accepts no arbitrary owner parameter and naturally returns only owned records.

## 3. Collection scope and status authority

Every retained, owned Visit with one of C1's five server-authoritative statuses belongs to the collection:

```text
requested | contacting | scheduled | completed | cancelled
```

`completed` and `cancelled` remain visible as history while retained. This does not create an indefinite retention promise. Unknown/corrupt persisted statuses fail closed; they are not mapped to a new UI or domain status, and an incomplete collection must not be presented as a complete ready result.

The Backend returns the actual persisted `InstitutionVisit.status`. The Page cannot infer or mutate it from `visitDate`, elapsed time, client statements, or local navigation. No `pending`, `confirmed`, `finished`, `expired`, `overdue`, or `auto_completed` domain state is introduced.

The existing Appointment ViewModel groups statuses only for presentation:

| Visit domain status | “我的预约” tab |
|---|---|
| `requested`, `contacting` | 待确认 |
| `scheduled` | 已确认 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

“全部” includes all five. These Chinese labels and grouping are not stored as a second domain status. V1 server read returns the owner collection without a `status`/`tab` filter; the Mini Program applies the grouping locally.

## 4. Versioned read operation and result

The V1 collection operation is:

```text
GET /api/v1/visits
X-Auth-Evidence: <existing C5 session evidence>
```

There is no request body, owner query, status query, or page/cursor parameter in V1. The route follows the existing `/api/v1/visits/{visitId}/evaluation-context` family. Existing Backend convention uses a stable JSON application result, with HTTP 200 for application/auth outcomes; transport failure remains possible and is never a successful empty list. No second global error envelope is created.

The logical public result has exactly these top-level fields:

```text
contractVersion = appointment-production-owner-read-contract-v1
kind = appointment_owner_read_result_v1
authResolution = authenticated | missing | expired | invalid | unavailable | technical_failure
availability = ready | unavailable | technical_failure | null
items = AppointmentListItemV1[] | null
```

- When `authResolution` is not `authenticated`, `availability` and `items` are null. `missing`, `expired`, and `invalid` mean `AUTH_REQUIRED` for the Page; auth `unavailable`/`technical_failure` remain service failures, not an empty list or a phone prompt.
- When authenticated and `availability=ready`, `items` is an array of all retained owned Visits, including `[]` for a legitimate owner with no Visit. An empty owner collection is `READY_EMPTY`, never `NOT_FOUND` or an error.
- When authenticated and `availability=unavailable` or `technical_failure`, `items` is null. Repository/service failure, unsafe incomplete projection, or an invalid persisted status must not be turned into `[]`. Raw errors and other-owner existence never enter the result.

## 5. Minimum list item and data minimization

Each `AppointmentListItemV1` has only:

```text
visitId
institutionId
institutionRecordRevision
visitStatus
visitDate
visitTimePreference
participantCount
pickupRequested?        // optional, only when the Visit recorded it
institutionDisplay = { availability: ready, name: <public-safe historical name> }
                   | { availability: unavailable, name: null }
```

`institutionId + institutionRecordRevision` preserves the exact historical Visit binding and permits safe display resolution; neither field grants client authority to change the Visit or to select a newer revision. `pickupRequested` is optional; absence must not be turned into an assertion that pickup exists or is supported. The Institution name is the only additional display field in V1.

The response excludes `userId`/ownerId, `elderId`, ElderProfile, Assessment/raw health data, contact name or phone, User.phone, Consultant phone/private data, private notes, identity documents, Institution raw verification evidence, Recommendation internals, C5 session evidence, credentials, and unrelated Visit/Evaluation data. Do not expose an entire existing public Visit or Institution snapshot merely because its type already exists. No real personal data is needed to implement or test this Contract.

## 6. Visit time and historical Institution display

`visitDate` and `visitTimePreference` are the user's submitted desired date and time preference. They are not `scheduledAt`, `completedAt`, or an Operations-confirmed appointment time. The list must not relabel the preference as a confirmed time. This Contract creates no operational timestamp field and does not infer `completed` from a date.

An Institution name may be shown only if a public-safe record is resolved for the Visit's exact `institutionId + institutionRecordRevision`. The historical resolver may use any safe implementation, but it must verify exact identity. A failed historical lookup must never fall back to the latest/current revision or fabricate a name.

If exact historical display is absent or cannot safely be projected for an item, keep the owned Visit in the successful collection and set that item's `institutionDisplay` to `unavailable`; the Page may show an honest placeholder such as its current “机构资料暂不可用”. A single item's display unavailability is distinct from collection read failure. A systemic repository/service failure or failure that prevents safe collection projection returns `availability=unavailable` or `technical_failure`, not an empty list. No Institution verified fact or Visit revision is changed by this read.

## 7. Evaluation entry and submitted state

For a trusted list item with `visitStatus=completed`, the Page may show “填写看院评价” as a **presentation entry hint**. It may pass only `visitId` to the existing Evaluation route. The single-Visit `evaluation-context` operation remains the final owner/status eligibility authority when entering editing, and the Evaluation POST remains the final write authority. A prior list response cannot override either check.

V1 collection items do not include `evaluationSubmitted`, `evaluationId`, or Evaluation status, and no Evaluation read query is required. The current Product Source does not require an “已评价” list state. If a completed Visit has already been evaluated, the existing immutable, one-per-Visit write boundary still prevents a second Evaluation. A future “已评价/查看评价” experience requires a separate successor; this Contract adds no edit or detail capability.

## 8. Ordering, pagination, and Page states

```text
BUSINESS_ORDERING = NOT_DEFINED
PAGINATION_CONTRACT = NOT_REQUIRED_FOR_OWNER_READ_V1
SERVER_STATUS_FILTER = NOT_REQUIRED_FOR_OWNER_READ_V1
```

V1 returns the retained owner collection. A deterministic technical ordering may be chosen by the implementation for stability, but it is not a business priority or frozen newest/upcoming/status order; clients must not infer one. V1 adds no `page`, `size`, `cursor`, or `totalPages`. Later scale needs may receive a compatible versioned extension, not a silent change to this result.

The existing Page states are sufficient: loading; ready with items; ready with `[]` (empty); and load error/unavailable. The implementation should reuse its filters, completed CTA, and navigation guard. It must not show editing or a successful owner list before authenticated `ready` data arrives.

## 9. Production and TEST_ONLY boundary

Production owner-read must use the real Backend authenticated collection result. TEST_ONLY synthetic Visit fixtures remain in the test/development dependency graph. Missing Backend, auth failure, provider failure, invalid response, or transport error may not fall back to synthetic Visits or a fabricated empty collection. No phone authorization, real openId fixture, real Elder/health/contact data, or company subject material is required.

```text
REAL_PHONE_REQUIRED = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
COMPANY_SUBJECT_MATERIAL = NOT_USED
```

## 10. Implementation and evidence boundary

The next implementation may add the owner-filtered repository query, application service, controller/result DTO, exact historical public-name resolution or explicit per-item unavailability, and Mini Program production provider. It must reuse C5 resolution and the existing Appointment presentation; it must not add a second auth model, status machine, Evaluation eligibility authority, phone requirement, Institution fact write, or Recommendation input.

Targeted evidence must cover all five statuses; completed/cancelled history; legitimate `[]`; missing/expired/invalid session; only-owned collection; no client owner authority; exact revision name and no latest fallback; per-item historical display unavailable without deleting the Visit; whole-service failure distinct from empty; minimal response; local filtering; completed CTA followed by final Evaluation context check; and production/TEST_ONLY isolation.

Passing this Contract freeze does not mean production owner-read is implemented, Visit lifecycle mutation exists, real-device E2E passed, C6 G13 passed, or trial/release Backend is ready.
