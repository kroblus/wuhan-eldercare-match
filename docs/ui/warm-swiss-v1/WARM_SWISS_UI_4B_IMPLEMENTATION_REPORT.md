# WARM_SWISS_UI_4B Implementation Report

Document role: `AUDIT_ONLY`
Date: 2026-10-07 (Asia/Shanghai)
Phase: `WARM_SWISS_UI_4B`
Status: `PASS_WITH_RISKS`
Implementation ownership: `MAIN_SESSION_ONLY`; no subagents used.

## Baseline and authority

- HEAD: `786eea3f42922069cdce9cf557066b481e146edc`; UI-3 implementation checkpoint: `7c24424875c8b9ad9d7a2c6ea1f524753320d95e`.
- UI-4A is approved and frozen. Its three uncommitted Create files and implementation report remain byte-for-byte unchanged.
- Visual source: this directory's `README.md` and `WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf`. Page 10 assigns Success to **MASTER-C / Explanation–Decision** and My Appointments to **MASTER-D / Directory–Records**. Enlarged references are PDF pages 24 and 26. Page references in this report use the actual PDF physical page numbers.
- Product source: `docs/product/README.md`, current V1.2 page-level PRD, Success/My Appointments page requirements.
- Semantic sources: frozen Appointment/InstitutionVisit V1; Appointment Production Owner Read V1; InstitutionVisit Operations Lifecycle V1; My Appointments Contact Consultant Action V1; Authenticated Visit Evaluation Context V1. Existing receipt integration and WeChat interaction/runtime rules retain authority over visual samples.
- Initial working tree included six modified `.codex` files, UI-4A changes, and `output/**`. A baseline manifest captured 1,064 existing files. Final SHA-256 verification confirms all 1,060 files outside the four permitted visual files are unchanged. This includes pre-existing output evidence and configuration.
- No stage, commit, push, reset, restore, checkout, clean or stash performed. No production Visit creation, cancellation, evaluation write or real phone authorization performed.

## Success capability matrix

Audit performed before implementation; statuses separate code capability from live external availability.

| # | Capability | Status | Existing implementation / boundary |
| --- | --- | --- | --- |
| 1 | Route | IMPLEMENTED | Registered `/pages/appointment/success` |
| 2 | handoffId input | IMPLEMENTED | Exactly one string query key; extra fields fail closed |
| 3 | Receipt source | PARTIAL | Accepted C3 receipt via existing private in-memory handoff; no live accepted receipt exercised under phone Gate |
| 4 | Receipt lifecycle | IMPLEMENTED | Consume/delete once; ready page keeps only its public snapshot |
| 5 | Institution identity | IMPLEMENTED | Receipt/summary exact institutionId + institutionRecordRevision pair |
| 6 | Institution name | IMPLEMENTED | Validated summary display value, not query text or latest catalog lookup |
| 7 | Date | IMPLEMENTED | Validated summary visitDate; unchanged intention field |
| 8 | Time | IMPLEMENTED | Validated free-text visitTimePreference; unchanged |
| 9 | Party size | IMPLEMENTED | Validated participantCount; unchanged |
| 10 | Visit status | IMPLEMENTED | Receipt validator accepts requested + accurate publicMessage only; no current lifecycle lookup here |
| 11 | Consultant action | IMPLEMENTED | Guarded switchTab to global `/pages/consultant/index` |
| 12 | My Appointments action | IMPLEMENTED | Guarded navigateTo `/pages/appointment/index`; owner-read still required there |
| 13 | Home action | IMPLEMENTED | Guarded switchTab `/pages/home/index` |
| 14 | Loading | NOT_AVAILABLE | Synchronous handoff; no loading state or fabricated skeleton |
| 15 | Ready | PARTIAL | Safe code path and isolated VM verified; DevTools ready rendering is TEST_ONLY |
| 16 | Unavailable | IMPLEMENTED | No valid handoff produces result-unavailable view |
| 17 | Invalid handoff | IMPLEMENTED | Missing, malformed, identity mismatch and injected query rejected |
| 18 | Expired handoff | NOT_AVAILABLE | No time-based TTL/expired enum; lost, discarded or consumed memory is unavailable |
| 19 | Refresh/reload | IMPLEMENTED | New page cannot consume a receipt again; process memory loss unavailable; onShow keeps current validated page snapshot |
| 20 | Duplicate navigation | IMPLEMENTED | Existing per-action NavigationGuard and failure release |
| 21 | Personal exposure | IMPLEMENTED | Public receipt/summary only; no contact phone/name, Elder/Profile, session or native code |
| 22 | Direct root | IMPLEMENTED | Existing navbar fallback redirects to My Appointments; DevTools root Back verified |

## My Appointments capability matrix

| # | Capability | Status | Existing implementation / boundary |
| --- | --- | --- | --- |
| 1 | Owner read | PARTIAL | Formal authenticated provider exists; current DevTools read returns load_error |
| 2 | Data source | IMPLEMENTED | Production GET `/api/v1/visits`; no development catalog or fixture fallback |
| 3 | Identity requirement | IMPLEMENTED | C5 session evidence; principal constrained by Backend; phone is not identity |
| 4 | Loading | IMPLEMENTED | Existing single-flight loadState, no synthetic records |
| 5 | Ready | PARTIAL | Existing provider/VM/page path tested offline; no live owned list obtained |
| 6 | Empty | IMPLEMENTED | Ready with empty visits; isolated visual verification only |
| 7 | Error | IMPLEMENTED | Public-safe mapped error; actual DevTools evidence |
| 8 | Retry | IMPLEMENTED | Same provider with in-flight lock; actual retry remains safe load_error |
| 9 | Pagination | NOT_AVAILABLE | No cursor/page contract, no new controls |
| 10 | Ordering | IMPLEMENTED | Preserve returned projection order; business sorting NOT_DEFINED |
| 11 | Status filtering | IMPLEMENTED | Existing five filters and frozen ViewModel mapping |
| 12 | Institution display | IMPLEMENTED | Backend historical exact-pair display projection; unavailable name keeps record |
| 13 | Date/time | IMPLEMENTED | Existing projection values unchanged; no date inference |
| 14 | Status display | IMPLEMENTED | Existing five persisted status labels |
| 15 | Consultant action | IMPLEMENTED | VM gate; global Consultant Tab without record context |
| 16 | Institution Detail action | NOT_AVAILABLE | No existing CTA/route; no name-based or latest-revision navigation introduced |
| 17 | Cancel action | NOT_AVAILABLE | No client cancellation capability or mutation added |
| 18 | Evaluation action | IMPLEMENTED | Completed hint only; target requires authoritative per-Visit owner/completion context |
| 19 | Current Visit revision/version | NOT_AVAILABLE | No public Visit version UI; historical Institution pair validated in read boundary then minimized from Page data |
| 20 | Stale/concurrent state | PARTIAL | Existing snapshot remains onShow; next evaluation-context read revalidates owner/status; no auto refresh/status upgrade |

My Appointments root navbar has no existing fallback. That behavior remains unchanged. Parent-stack Back remains available; this visual task does not invent a root route.

## Receipt and owner-read boundaries

Success continues to use `handoffId → consume once → validate receipt/summary → public snapshot`. It never reads institution name, date, status or count from query facts. The exact Institution identity/revision and public submission receipt remain unchanged. URL status injection, receipt replay, discarded handoff, mismatched identity/revision, scheduled receipt and confirmation copy all fail closed in the isolated runtime verification. A fresh runtime without the handoff cannot reconstruct the result.

The result heading uses the validated `预约申请已提交` public message. Its waiting explanation explicitly requires further Consultant/Institution confirmation. Summary dates/times/counts remain user intentions; acceptedAt is the existing server acceptance field, retained without inventing timezone formatting or confirmed scheduling. No green confirmation check, assigned consultant, confirmation number, available bed or final price added.

My Appointments preserves the formal authenticated owner provider and Backend owner constraint. Client requests do not choose an owner, derive one from phone/Elder, or replace failures with an empty or synthetic history. `load_error` remains distinguishable from `ready_empty`. Returned order remains unchanged. The historical Institution revision cannot silently switch to latest; this task adds no Institution navigation because its capability is absent.

## Status mapping, authority and actions

`STATUS_SOURCE = AUTHORITATIVE`; `STATUS_AUTHORITY = BACKEND_OPERATIONS`; `CLIENT_STATUS_INFERENCE = FALSE`.

| Domain status | Exact existing display | Existing filter | Contact Consultant | Evaluation hint |
| --- | --- | --- | --- | --- |
| requested | 待确认 · 已提交 | 待确认 / awaiting | Yes | No |
| contacting | 待确认 · 顾问联系中 | 待确认 / awaiting | Yes | No |
| scheduled | 已确认 | 已确认 / confirmed | Yes | No |
| completed | 已完成 | 已完成 / completed | Yes | Yes, context recheck required |
| cancelled | 已取消 | 已取消 / cancelled | No | No |

All includes every returned record in provider order. Filtered row numbers are presentation positions, not priority or Visit identity. Old fixture dates remain requested/contacting/scheduled when their persisted status says so.

- Success actions remain ready-only. Contact/Home use switchTab; My Appointments uses navigateTo. Invalid results expose only the existing navbar return/fallback entry. Guards, duplicate suppression and safe failures are unchanged.
- List Consultant CTA is shown only by the existing VM boolean. It opens the global Consultant Tab, passes no Visit/Institution/Elder/user context, performs no phone call and does not move status to contacting.
- Completed Evaluation CTA carries the original visitId, rechecks the currently visible VM gate, and enters `/pages/visit/evaluation?visitId=...`. The target reads authenticated per-Visit evaluation context and allows editing only for the owned completed Visit. Unknown/foreign/non-completed/rejected context cannot become an editable evaluation.
- DevTools navigation with the existing completed TEST_ONLY fixture reached the original Evaluation route and then `load_error`; no fake eligible context was injected and no evaluation was submitted. This proves route/gate preservation, not live eligible completion.
- Institution Detail and cancellation capabilities are absent; no corresponding buttons or fake success states added.

## Visual implementation

Four page-local WXML/Less files changed. No TS, ViewModel, application service, provider, domain, token or shared component changed.

- Success / MASTER-C: warm-white surface, dark heading and body, a restrained terracotta status rule, numbered summary/next-step sections, thin fact dividers, a clear Consultant primary action and quiet existing secondary actions. Actions remain in normal document flow with bottom spacing.
- My Appointments / MASTER-D: lightweight horizontal text filters with terracotta active underline; numbered records with thin rules; institution/status hierarchy; compact date/time/count facts; existing gated CTAs. No shadow-card stack, image dependency, colorful tag wall or fixed footer.
- Status remains explicit text. Scheduled uses the existing success token; requested/contacting remain neutral, completed uses accent, cancelled stays muted. Colors do not infer or mutate state.
- Existing NavigationBar/PrimaryButton Warm Swiss variants reused. Loading/empty/error styling is page-local; shared StatePanel remains unchanged. Error retry remains a real existing action.
- Long institution names and long time preferences wrap. Both completed CTAs fit/wrap within the record. Normal-flow content has no fixed footer overlap. Current 390px simulator viewport bounding rectangles: 39 list rectangles and 11 Success rectangles, zero outside viewport. This supports current DevTools geometry only; it does not certify all physical devices or glyph metrics.

## Validation

| Check | Result | Coverage / evidence limits |
| --- | --- | --- |
| `npm run check:appointment-create-runtime` | PASS | Formal isolated Create transport, idempotency, safe handoff, Success actions/deduplication, identity/summary, Detail entry and Back |
| `node scripts/check-appointment-list-runtime.mjs` | PASS | 15 existing cases: provider/owner boundaries, errors/empty/retry, order, mapping/filter, no date inference, completed entry |
| `npm run check:appointment-contact-consultant-runtime` | PASS | 8 existing cases: status gates, switchTab, dedupe/retry, completed Evaluation preservation; final WXML rerun |
| `node scripts/check-visit-evaluation-runtime.mjs` | PASS | 42 existing isolated cases, including per-Visit owner/completed context, denied/unknown/malformed rejection |
| `npm run check:appointment-institution-visit-c2-runtime` | PASS | 19 fixtures / 98 assertions; lifecycle legality and persisted status boundaries |
| `npm run check:institution-navigation-a0-4-interactions` | PASS | 25 cases; canonical navigation/context/Back, no public identity bypass |
| `npm run check:consultant-b3-runtime` | PASS | Existing Consultant state, global-context and Appointment navigation regressions; simulated phone API only |
| `node output/warm-swiss-ui4b/prepare-render-fixtures-TEST_ONLY.mjs` | PASS | Isolated receipt identity/lifetime/replay checks; existing list fixtures mapped by current VM; no real app store/provider injection |
| `node output/warm-swiss-ui4b/verify-scope-and-bindings.mjs` | PASS | 1,060 preserved file hashes; CTA gates/event/identity/navigation attributes unchanged; app/page JSON parse; diff check; zero staged files |
| WeChat targeted TS / emitted JS checks | NOT_TRIGGERED_BY_UI4B | No runtime TS/JS source changes in this phase; existing UI-4A files preserved |
| DevTools refresh + actual pages | PASS_WITH_EXTERNAL_LIMITS | Both pages opened; no cached SyntaxError/ReferenceError/TypeError/WXML/WXSS hits in final filtered console |
| `npm run check:doc-governance` | PASS | Final audit document check |

The initial contact-action static assertion required wx:if to be the first PrimaryButton attribute. Attribute ordering was restored and the existing test passed; tests were not weakened or modified.

## DevTools and evidence provenance

Screenshots are raw 512×1103 simulator PNGs under `output/warm-swiss-ui4b/`. The simulator reports a 390px CSS viewport. Native physical coordinate touch was not established; selector-triggered events and method calls are automation evidence only.

| Evidence | Source and observed result |
| --- | --- |
| `appointment-success-unavailable.png` | Actual invalid/extra-query root entry, unavailable; existing navbar root return reached My Appointments |
| `appointments-error.png` | Actual production provider returned public-safe load_error; actual retry same result |
| `appointment-success-ready-TEST_ONLY.png` | Isolated VM validated public receipt, render-only setData; top/result/waiting hierarchy |
| `appointment-success-summary-TEST_ONLY.png` | Same isolated summary/identity/date/time/count/acceptedAt; no production receipt |
| `appointment-success-bottom-TEST_ONLY.png` | Same render-only snapshot; three existing actions and bottom space |
| `appointment-success-long-text-TEST_ONLY.png` | Public render-only long name/time; no app handoff-store insertion |
| `appointments-top-TEST_ONLY.png`, `appointments-list-TEST_ONLY.png`, `appointments-bottom-TEST_ONLY.png` | Existing five-status test fixtures through existing VM, public render-only Page data |
| `appointments-filter-requested-TEST_ONLY.png` | Both requested/contacting; exact waiting labels; no Evaluation despite 2020 dates |
| `appointments-filter-scheduled-TEST_ONLY.png` | Scheduled only, Contact CTA only |
| `appointments-filter-completed-TEST_ONLY.png` | Completed only, unavailable historical institution label, Contact + Evaluation |
| `appointments-filter-cancelled-TEST_ONLY.png` | Cancelled only; zero contact/evaluation buttons |
| `appointments-empty-TEST_ONLY.png`, `appointments-loading-TEST_ONLY.png` | Render-only existing empty/loading states; no records or fake CTA |
| `appointments-long-text-TEST_ONLY.png` | Public render-only stress values; wrapping and status/action separation |
| `ui4a-create-regression-MOCK.png` | Actual existing Detail → Create development route, explicit Mock institution, ready, exact ID/revision retained |
| `visual-master-page-10.png`, `visual-master-page-24.png`, `visual-master-page-26.png` | Frozen PDF reference renders, not app runtime |

No live accepted receipt, live owned ready/empty history, true cancellation or eligible completed evaluation was obtained. Success ready navigation was exercised using render-only TEST_ONLY data: Consultant/My Appointments/Home reached their exact canonical destinations. List Contact reached the global Consultant Tab without query context. At completion those render-only pages were removed and My Appointments was reopened through its real provider, returning load_error. No fixture was added to production code, app handoff memory, provider, auth session or database.

## Contract-safe deviations and risks

1. The reference's confirmed-looking success copy is subordinate to requested receipt semantics. Implementation consistently says application submitted and awaiting confirmation.
2. No TTL-specific expired state, loading Success state, pagination, Institution Detail CTA, cancellation control, assigned consultant or Visit version is invented for visual completeness.
3. Unavailable Success retains the existing navbar legal fallback; a new unavailable CTA would require changing ready-only actions. My Appointments root Back has no existing fallback and is preserved.
4. Owner-read live availability remains PARTIAL. Current DevTools public error does not identify the underlying auth/server/network cause; raw identity, session and backend payloads were not exposed or recorded.
5. Android 17 and physical touch remain PENDING. UI-4B has no input/keyboard surface; UI-4A soft keyboard PENDING is inherited. Current simulator wrapping/geometry is not physical-device certification.
6. UI-4A's development-only read diagnostic is a pre-existing non-blocking product closeout risk. It was neither modified nor activated.

```text
PHONE_COMPONENT_ACCOUNT_ELIGIBILITY = FAIL_EXTERNAL
REAL_PHONE_CAPABILITY = EXTERNAL_BLOCKED
REAL_PHONE_TEST = SKIPPED_BY_AUTHORITATIVE_EXTERNAL_GATE
DO_NOT_REPEAT_REAL_PHONE_AUTH = TRUE
ANDROID_17_MANUAL_GATE = PENDING
PHYSICAL_TOUCH_GATE = PENDING
SOFT_KEYBOARD_GATE = PENDING
DEVELOPER_DIAGNOSTIC_SURFACE = PRE_EXISTING_NON_BLOCKING_RISK
```

## Changed files and closeout

- `miniprogram/pages/appointment/success.wxml`
- `miniprogram/pages/appointment/success.less`
- `miniprogram/pages/appointment/index.wxml`
- `miniprogram/pages/appointment/index.less`
- This new `WARM_SWISS_UI_4B_IMPLEMENTATION_REPORT.md`
- New UI-4B evidence, isolated fixture preparation and scope verification only under `output/warm-swiss-ui4b/`.

`TOKENS_CHANGED = NONE`; `SHARED_COMPONENTS_CHANGED = NONE`; `BUSINESS_BEHAVIOR_CHANGED = FALSE`; `CONTRACT_CHANGES = NONE`; `AFFECTED_OTHER_PAGES = NONE`.

`SUCCESS_HANDOFF_GATE = PASS`; `SUBMITTED_NOT_CONFIRMED = PASS`; `OWNER_READ = PARTIAL` (live), `OWNER_READ_ISOLATION = PASS` (preserved boundary/tests); `APPOINTMENT_FILTER = IMPLEMENTED`; `CANCEL_CAPABILITY = NOT_AVAILABLE`; `EVALUATION_GATE = PASS`; `INSTITUTION_IDENTITY = PASS`; `RECORD_REVISION = PASS`; `CONSULTANT_NAVIGATION = PASS`.

`DATA_REALITY_CHECK = PASS`; `NO_FAKE_VISIT = TRUE`; `NO_FAKE_STATUS = TRUE`; `NO_CLIENT_STATUS_INFERENCE = TRUE`; `NO_FAKE_CONFIRMATION = TRUE`; `NO_FAKE_INSTITUTION = TRUE`; `NO_FAKE_CONSULTANT = TRUE`; `NO_FAKE_CANCELLATION = TRUE`; `NO_FAKE_EVALUATION_GATE = TRUE`.

`UI4A_UNCHANGED = TRUE`; `PRE_EXISTING_CHANGES_PRESERVED = TRUE`; `DOC_IMPACT = AUDIT_ONLY`; `READY_FOR_WARM_SWISS_UI_5 = TRUE` for visual development sequencing only. This does not close external phone, real owner-read availability or manual device Gates. UI-5 was not started.
