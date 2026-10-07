# WARM_SWISS_UI_4B_1 Implementation Report

Document role: `AUDIT_ONLY`
Date: 2026-10-07 (Asia/Shanghai)
Phase: `WARM_SWISS_UI_4B_1`
Status: `PASS`
Ownership: `MAIN_SESSION_ONLY`; no subagents used.

## Scope and baseline

This phase closes only the time-preference visual fixture wording and raw receipt timestamp display. UI-4A and the other accepted UI-4B surfaces remain frozen. HEAD remains `786eea3f42922069cdce9cf557066b481e146edc`. The six pre-existing `.codex` changes, UI-4A/UI-4B changes and all prior output remain intact. No stage/commit/push or destructive Git operation performed.

A pre-change SHA-256 manifest captured 1,092 existing files. Final verification confirms all 1,090 files outside Success TS/WXML are byte-for-byte unchanged. This includes My Appointments TS/ViewModel/WXML/Less, all shared code, previous reports and all 20 original UI-4B PNGs.

## Issue 1: time preference source and formal policy

`TIME_PREFERENCE_ISSUE_SOURCE = OTHER` — a TEST_ONLY fixture contains English **user-preference free text**, not an internal enum or a bypass of production projection.

The complete source chain is:

`scripts/fixtures/appointment-list-test-fixtures.mjs` (`visitTimePreference: 'morning'`) → UI-4B isolated preparation script → actual `createAppointmentListViewModel` → `item.visitTimePreference` WXML binding → old TEST_ONLY screenshot.

The former fixture already passes through the formal ViewModel. It does not bypass display mapping. The formal ViewModel correctly preserves the supplied preference text. No production enum-to-label mapping exists to repair.

Evidence read in the minimum affected scope:

- `APPOINTMENT_CREATE_C3_CLIENT_INTEGRATION_IMPLEMENTATION_HANDOFF_V1.md`, field table: required nonblank user preference, at most 80 characters; explicitly no undefined time-slot enum.
- `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md`: date/time preference is submitted desired intent, not Operations-confirmed scheduling time.
- Appointment/InstitutionVisit and owner-read types declare `visitTimePreference: string`. Validators accept text rather than morning/afternoon/evening/anytime/custom/unknown enums. Domain projection and owner-read preserve the supplied string.
- Current Create runtime fixtures already use `上午` and `下午` as free text. There is no formal finite enum set or Chinese enum mapping.

The new isolated visual fixture deliberately supplies `上午` **before** calling the same production ViewModel. It preserves institution labels and TEST_ONLY markings, 2020 dates, participant count, all five statuses, filters, order and CTA booleans. Neither the shared source fixture nor production mapping was changed.

`TIME_PREFERENCE_MAPPING = EXISTING_FREE_TEXT_PASS_THROUGH`; `UNKNOWN_TIME_PREFERENCE_FALLBACK = NOT_APPLICABLE_NO_ENUM`.

Known-looking English words and future strings are not interpreted as internal codes: valid user free text is preserved, not guessed or replaced with “待确认”. Invalid owner-read fields continue to fail the existing provider validation and produce its public-safe unavailable/error behavior. This does not claim support for a future enum contract. Introducing such a contract/mapping would be separate work.

Runtime checks exercise `上午`, `下午`, `晚上`, `10:00—11:00`, `morning`, `afternoon`, `evening`, `anytime`, `custom`, `unknown`, and `future_code` as text and confirm exact preservation without input mutation. The new screenshot input is explicitly `上午`; `morning` does not appear there. No internal preference enum exists in the current implementation.

## Issue 2: receipt timestamp display

`TIMESTAMP_ISSUE_SOURCE = PRODUCTION_VIEWMODEL_LEAK` — Success previously bound `handoff.receipt.acceptedAt` directly in its template, so any valid production or isolated receipt displayed raw ISO. This is a presentation leak, not a handoff/provenance failure.

Changes:

1. Success imports the existing `miniprogram/utils/util.ts` `formatTime` helper.
2. After the unchanged receipt/summary validation, Page data derives `acceptedAtDisplay = formatTime(new Date(handoff.receipt.acceptedAt))`.
3. The existing timestamp fact binds that separate display field. It keeps its position, styling and label.
4. Initial/unavailable data clears the display value, preventing a previous ready value from lingering after invalid input.

The raw receipt, acceptedAt string, application result, stored timestamp, one-time handoff, identity/revision, submitted-intent summary and requested public message remain untouched. No WXML arithmetic, fixed-hour offset, Z replacement, ISO substring formatting, new Date.now fact or Backend change introduced.

`TIMESTAMP_FORMATTER = EXISTING_UTIL_FORMAT_TIME_WITH_STANDARD_DATE`.

`TIMESTAMP_DISPLAY_TIMEZONE_POLICY = DEVICE_LOCAL_TIME_EXISTING_FORMATTER`.

The existing helper uses standard local Date getters and formats `YYYY/MM/DD HH:mm:ss`. The repo search found no Appointment-specific Asia/Shanghai formatter or explicit fixed-timezone display policy. This phase reuses the existing helper's local behavior and does not introduce a second timezone strategy. On the current host/simulator, offset is -480 minutes and the sample `2026-09-27T08:00:00.000Z` displays `2026/09/27 16:00:00`. Other device timezones display that same instant in their local time.

Local-zone tests cover Shanghai, UTC and New York, including crossing the calendar day. The existing receipt validator still requires a valid UTC Z instant. A Date-format-capable `+08:00` string is tested at helper level but remains rejected by the receipt gate; no validator was relaxed.

The label `服务端接收时间` remains unchanged. The inspected integration specification permits acceptedAt without prescribing a replacement user-facing label. “提交时间” may be considered in a separate copy decision; this phase does not rename acceptance as a client submission timestamp.

## Tests

| Check | Result | Coverage |
| --- | --- | --- |
| `node output/warm-swiss-ui4b1/check-display-and-prepare-TEST_ONLY.mjs` | PASS | Actual Success onLoad and existing formatter; three local timezones, midnight rollover, helper offset equivalence, receipt offset rejection, immutable receipt/source data, replay/invalid query, clearing stale display; free-text policy and unchanged list fields/gates |
| `npm run check:appointment-create-runtime` | PASS | Existing formal isolated Create/receipt/handoff/identity/navigation/deduplication boundaries and submitted-not-confirmed message |
| `node scripts/check-appointment-list-runtime.mjs` | PASS | 15 existing owner-read, ready/empty/error/retry, status/filter/order and completed-entry cases |
| `npm run check:appointment-contact-consultant-runtime` | PASS | 8 existing status/Contact/Evaluation/deduplication cases |
| `npm run check:wechat-ts-targeted-compat` | PASS | Official TypeScript 4.1.2, 162 target roots, zero diagnostics/class initializers/external runtime imports |
| Fresh DevTools refresh + `npm run check:wechat-js-compat` | PASS | 159 generated modules, no unsupported class-field syntax |
| `node output/warm-swiss-ui4b1/verify-preservation.mjs` | PASS | 1,090 protected hashes, TS presentation-only additions, WXML exactly one value binding, JSON parse, diff check, zero staged files |
| `npm run check:doc-governance` | PASS | Final audit documentation verification |

An initial timezone probe tried an offset receipt and correctly hit the existing UTC-only gate. The probe was corrected to distinguish formatter behavior from receipt acceptance. Production validation was unchanged. No existing tests were weakened or edited.

## DevTools and new visual evidence

Only the two requested ready states were re-rendered; old evidence was not regenerated or overwritten.

| New file under `output/warm-swiss-ui4b1/` | Provenance / observed result |
| --- | --- |
| `appointment-success-summary-after.png` | TEST_ONLY public snapshot generated by actual Success onLoad in isolated VM; summary date/time/count unchanged, timestamp `2026/09/27 16:00:00`, no raw ISO in displayed fact |
| `appointments-list-after.png` | TEST_ONLY localized free-text input through actual list ViewModel; five original records, time preference `上午`, same status/filter/CTA presentation |

TEST_ONLY institution markings remain visible. Public render-only setData was used solely for screenshots. No fixture was inserted into the production provider, real app handoff store, auth session or database. Current simulator local offset (-480 minutes) and sample local hour (16) match the isolated formatted snapshot. Success value rectangles fit inside the 390px viewport; all 15 list fact rectangles also fit. Timestamp is one line and does not crowd its label. No layout adjustment or long-text screenshot was required because Less and My Appointments layouts did not change.

After capture, render-only pages were removed and My Appointments was reopened through its actual provider. It still returned `load_error`; `OWNER_READ = PARTIAL`, production ready/empty history remains unverified. Final filtered console contained no SyntaxError/ReferenceError/TypeError/WXML/WXSS matches. These are DevTools/isolated-runtime results, not physical touch or Android evidence.

## Unchanged boundaries, files and closeout

Production changes only:

- `miniprogram/pages/appointment/success.ts`: separate formatted timestamp Page field.
- `miniprogram/pages/appointment/success.wxml`: one timestamp value binding.

New files only: this audit report and `output/warm-swiss-ui4b1/**` (baseline/preservation evidence, isolated probe, public render data and two screenshots).

`DOMAIN_ENUM_CHANGED = FALSE`; `BACKEND_TIMESTAMP_CHANGED = FALSE`; `OWNER_READ_CHANGED = FALSE`; `STATUS_MAPPING_CHANGED = FALSE`; `EVALUATION_GATE_CHANGED = FALSE`; `BUSINESS_BEHAVIOR_CHANGED = FALSE`; `CONTRACT_CHANGES = NONE`.

All Appointment statuses remain Backend/Operations facts. Date, receipt display, Consultant viewing and local timezone do not infer completed/contacting/scheduled. Evaluation remains completed-only with the original authenticated context gate. Cancellation capability, owner-read isolation and Success navigation/handoff remain unchanged. UI-4A, phone provider, auth, server, domains, shared tokens/components and Agent configuration were not changed.

```text
TIME_PREFERENCE_DISPLAY = PASS
TIME_PREFERENCE_INTERNAL_ENUM_VISIBLE = FALSE
RAW_ISO_TIMESTAMP_VISIBLE = FALSE
TIMESTAMP_DISPLAY = PASS
SUBMITTED_NOT_CONFIRMED = PASS
TEST_ONLY_PROVENANCE = PASS
UI4A_UNCHANGED = TRUE
UI4B_OTHER_SURFACES_UNCHANGED = TRUE
PRE_EXISTING_CHANGES_PRESERVED = TRUE
OWNER_READ = PARTIAL
PHONE_COMPONENT_ACCOUNT_ELIGIBILITY = FAIL_EXTERNAL
REAL_PHONE_CAPABILITY = EXTERNAL_BLOCKED
REAL_PHONE_TEST = SKIPPED_BY_AUTHORITATIVE_EXTERNAL_GATE
DO_NOT_REPEAT_REAL_PHONE_AUTH = TRUE
ANDROID_17_MANUAL_GATE = PENDING
PHYSICAL_TOUCH_GATE = PENDING
SOFT_KEYBOARD_GATE = PENDING
DOC_IMPACT = AUDIT_ONLY
WARM_SWISS_UI_4B_1 = PASS
WARM_SWISS_UI_4B = APPROVED
READY_FOR_UI_4_CHECKPOINT = TRUE
```

Approval/checkpoint readiness here closes the two scoped display issues under the Owner's stated acceptance rule. It does not close the inherited real owner-read, phone or manual-device Gates. Checkpoint staging/commit/push was not performed. Work stops at UI-4B.1.
