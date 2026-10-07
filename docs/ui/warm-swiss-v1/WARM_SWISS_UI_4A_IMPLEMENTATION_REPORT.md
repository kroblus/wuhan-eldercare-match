# WARM_SWISS_UI_4A Implementation Report

Document role: `AUDIT_ONLY`
Date: 2026-10-07 (Asia/Shanghai)
Phase: `WARM_SWISS_UI_4A`
Status: `PASS_WITH_RISKS`
Implementation ownership: `MAIN_SESSION_ONLY`; no subagents used.

## Baseline and authority

- HEAD: `786eea3f42922069cdce9cf557066b481e146edc` (UI-3 audits).
- UI-3 implementation checkpoint: `7c24424875c8b9ad9d7a2c6ea1f524753320d95e`.
- Visual source: `README.md` in this directory, current frozen V1.2 PDF. PDF page 10 assigns Appointment Create to **MASTER-F / Service–Conversion**. Page 23 contains its enlarged visual reference; pages 5 and 8 define master/component and appointment boundaries.
- Product source: `docs/product/README.md`, current V1.2 page-level PRD page 34.
- Semantic source: frozen Appointment/InstitutionVisit V1, authenticated submission/persistence V1, Appointment Create client integration handoff V1, C6 purpose-bound phone handoff, current WeChat interaction V2 and runtime compatibility policy.
- The integration handoff's historical scaffold description is superseded by actual implemented code for capability auditing. Its frozen field/identity/submission boundaries remain applicable.
- `PROJECT_CURRENT_STATUS.md` was not found in the repository, including an ignored-file search. No replacement current-state document was invented. The task's explicit Owner-provided platform Gate is the authority for this phase's real-phone prohibition; the older C6 handoff does not reopen it.
- Initial working tree: six pre-existing `.codex` modifications and untracked `output/`. All preserved. No stage, commit, push, reset, restore, checkout, clean or stash performed.

## Current capability matrix (audited before implementation)

Statuses describe code and actual current runtime separately where needed; they do not certify production provider availability.

| # | Capability | Status | Evidence / boundary |
| --- | --- | --- | --- |
| 1 | Route | IMPLEMENTED | Registered `/pages/appointment/create`; canonical route parser |
| 2 | Institution context | IMPLEMENTED | Detail handoff or exact-version display snapshot, not a name-derived ID |
| 3 | Institution revision | IMPLEMENTED | Positive canonical integer; unchanged source revision; submission uses decimal string |
| 4 | Elder selection | PARTIAL | Implicit sole current-user backend binding; no selector, public name or multi-Elder capability |
| 5 | Date | IMPLEMENTED | Native date picker, real calendar `YYYY-MM-DD`, required |
| 6 | Time | IMPLEMENTED | Required free-text preference, trim and 80-character bound |
| 7 | Party size | IMPLEMENTED | Required integer 1–1000 |
| 8 | Transport request | NOT_AVAILABLE | No verifiable support projection; no control or payload added |
| 9 | Contact name | IMPLEMENTED | Required private form value, trim and 1–200 characters |
| 10 | Phone state | PARTIAL | Manual number and prepare/submitting/missing-result states; no independently authorized-phone projection |
| 11 | Phone authorization control | EXTERNAL_BLOCKED | Existing native getPhoneNumber binding implemented; current account capability ineligible |
| 12 | Notes | IMPLEMENTED | Optional, trim and 1–2000 characters; no health/Profile prefill |
| 13 | Validation | IMPLEMENTED | Client/domain validation, inline errors and existing first-error order |
| 14 | Submission | PARTIAL | Formal authenticated C3 HTTP transport exists; live provider path externally blocked, not exercised |
| 15 | Auth/session requirement | IMPLEMENTED | Private C5 session evidence only after valid explicit intent |
| 16 | Canonical Institution reference | IMPLEMENTED | Exact pair; authoritative backend eligibility/revision gate, no latest fallback |
| 17 | Canonical Elder reference | IMPLEMENTED | Resolve/establish current-user sole binding after intent; backend re-resolves; no local generated ID |
| 18 | Loading | IMPLEMENTED | Institution loading state; no automatic auth or Elder creation |
| 19 | Ready | IMPLEMENTED | Real existing Detail entry reaches ready; current institution is explicitly Mock |
| 20 | Validation error | IMPLEMENTED | Local invalid submit returns errors without request/navigation |
| 21 | Phone blocked/missing | PARTIAL | Missing/denied/no-code fail closed; no display-safe account-eligibility projection exists |
| 22 | Submission pending | IMPLEMENTED | phoneRunning, phoneSubmitting and formLocked; offline runtime regression |
| 23 | Submission failure | IMPLEMENTED | Public-safe local mappings; draft preserved, no success fallback |
| 24 | Duplicate submit guard | IMPLEMENTED | Prepare/phone in-flight guards, private idempotent attempt and NavigationGuard |
| 25 | Success navigation | IMPLEMENTED | Accepted safe receipt only; one guarded redirect; offline regression |
| 26 | Handoff/receipt identity | IMPLEMENTED | One-time handoff ID and receipt/summary validation; invalid URL unavailable |

`APPOINTMENT_CREATE_CAPABILITY = PARTIAL` and `SUBMISSION_CAPABILITY = PARTIAL` reflect external live-phone limitations, not scaffold code.

## Identity and source isolation

Institution Detail's existing Appointment handler transfers only `institutionId + recordRevision`. Its name is passed through an exact-pair in-memory display snapshot, not URL text. Create also validates optional route `source/sourceContextRef`; missing source defaults to direct, as the existing parser defines. Recommendation context is not Appointment write authority. No route serializer, identity reference adapter, catalog or source-context behavior changed.

DevTools observed the actual existing List → Detail → Create path: Detail used `institution-a-mock`, revision `2`, `source=direct_list`; Create carried the same pair without source/context fields. Display remained `示例机构 A（Mock）`. This proves development entry-context preservation, not a production Institution reference or appointment eligibility.

Elder V1 is implicitly the current C5 user's sole binding. No public Elder display name exists here. UI now describes that binding neutrally before preparation and uses the existing `prepared` boolean for the prepared label. No Elder ID/name is synthesized from Assessment, Draft or Profile. Live resolve/establish was not invoked in DevTools. Existing offline tests cover canonical resolution/establishment, auth failure, unavailable binding and backend assertion semantics. The existing develop-only read diagnostic remains available and was not triggered.

## Form and interaction semantics

| Field | Frozen meaning retained |
| --- | --- |
| Institution | Required canonical ID/revision, name is display only |
| Elder | Required authoritative reference at submission; implicit sole account binding |
| Date | Required real calendar date; user intention, not confirmed availability |
| Time | Required free text, ≤80 characters; no operating hours/time-slot enum invented |
| Count | Required integer 1–1000; unchanged number input and maxlength |
| Contact | Required trim 1–200 characters; private local form value |
| Phone | Required manual contact value with existing 6–32 character / 6–20 digit validator, plus fresh native purpose-bound evidence |
| Notes | Optional ≤2000 characters, sensitive-content warning preserved |
| Transport | Hidden and omitted because support is not established |

Action matrix retained:

| Action / state | Clickability and effects |
| --- | --- |
| Initial or incomplete form / Submit | Clickable; local validation first; inline errors and first-error scroll; zero auth/Elder/phone/C3/navigation on invalid |
| Edit field | Existing input/change handler; clears that field's error and prepared state; retains other values |
| Valid explicit Submit | Existing prepare guard; private C5 and sole Elder resolution/necessary establishment, once |
| Native authorization after preparation | Existing single bindgetphonenumber; fresh code dispatched once to C3, never through Consultant phone verification |
| Preparing/submitting | Existing loading/disabled/formLocked guards; no parallel submit channel |
| Denied, missing code or rejection | Existing public-safe failure, draft preservation and no Visit/success inference |
| Unknown result | Same canonical body/key retry; fresh native code required; form remains locked |
| Accepted/replayed receipt | One safe handoff and guarded success navigation; no invented visitId |
| Back | Existing parent/root fallback; no validation, auth or submission |

Binding/attribute comparison with HEAD confirms all `bind/catch` channels and all required, disabled, loading, native open-type, mode, type, maxlength and auto-height constraints unchanged. The only TS change is measured fixed-header height and its page data. Removing those presentation additions yields the exact baseline TS source. No tests were weakened or modified.

## Phone capability and external Gate

```text
PHONE_COMPONENT_ACCOUNT_ELIGIBILITY = FAIL_EXTERNAL
PHONE_CODE_MISSING_ROOT_CAUSE_CLASS = ACCOUNT_CAPABILITY_INELIGIBLE
REAL_PHONE_CAPABILITY = EXTERNAL_BLOCKED
REAL_PHONE_PROVIDER_EVIDENCE = MISSING
G13 = MISSING / PENDING_EXTERNAL_BLOCKED
REAL_PHONE_TEST = SKIPPED_BY_AUTHORITATIVE_EXTERNAL_GATE
DO_NOT_REPEAT_REAL_PHONE_AUTH = TRUE
PHONE_IS_NOT_IDENTITY = PASS
PURPOSE_BOUND_PHONE = PASS
```

The page currently has no account-eligibility Application result to display. This phase therefore does not invent a runtime blocked flag or expose AppID/G13/C6 internals. Current missing/awaiting authorization copy and existing public-safe failure path were restyled. The manual contact input remains because the frozen integration requires equality between it and provider phone evidence; it does not replace native authorization.

There is no independent `authorized` phone display state or masked provider-phone projection. No authorized-phone screenshot was fabricated. Existing TEST_ONLY VM/offline tests exercise prepared, denied, no-code, submitting, accepted, rejected and retry branches. Synthetic callback fixtures stayed inside those offline tests. No getPhoneNumber/native authorization tap, live provider request, real call, C6 reopen, provider/account/SDK/privacy workaround or synthetic production authorization occurred.

## Submission and Success boundary

The existing production client retains C5 opaque evidence headers, fresh phone code header, explicit frozen purpose, private contact fields, canonical Institution pair and Elder assertion. Codes/session material are not exposed through the public page outcome or success summary. Private idempotent attempts preserve same-body/same-key retries and reject unresolved/conflicting bodies. No backend, C5/C6 service, provider, domain or DTO was changed.

Success implementation and styling are byte-for-byte unchanged. Offline Appointment runtime proves accepted receipt navigation, strict public message `预约申请已提交`, no contact/phone/Elder ID in success summary, invalid receipt/handoff fail closed and action guards. Actual DevTools direct opening of Success without handoff returned `pageState=unavailable` and displayed the existing unavailable result. No live appointment was submitted. Success's Bootstrap visual remains a UI-4B observation, not a UI-4A change.

## Presentation changes

- MASTER-F four-section composition: 01 本次看院 (Institution and lawful implicit Elder description), 02 看院时间, 03 参与人数, 04 联系信息 (contact, phone purpose/status and notes).
- Existing Warm Swiss tokens: warm white surface, dark typography, terracotta section numbers/CTA, 40rpx alignment, ruled section boundaries, small-radius controls, no decorative card shadows.
- Existing NavigationBar, PrimaryButton and QuestionSection opt-in Warm Swiss variants; no shared source edits or second design system.
- Primary CTA `提交预约`; native continuation remains explicit `授权手机号并提交预约`; processing copy remains application submission, never appointment confirmation.
- Sticky CTA with safe-area padding and content reserve. Purpose/status, inline errors, notes and submission-not-confirmation copy remain scrollable content.
- Measured header height in page-local TS, following the existing Assessment pattern. Original error targets and first-error ordering stay intact; padded anchor boxes keep field/error visible below the fixed header.
- Input focus border uses the existing accent; actual physical keyboard/focus behavior awaits manual device evidence.

## Tests

| Check | Final result / scope |
| --- | --- |
| npm run check:appointment-create-runtime | PASS; TEST_ONLY transport, form validation, prepare/phone duplicate guards, failures/unknown retry, canonical entry, Back and receipt/handoff |
| npm run check:appointment-institution-visit-c2-runtime | PASS; 19 TEST_ONLY fixtures, 98 assertions; fail closed and zero fabricated success/write fallbacks |
| npm run check:appointment-institution-visit-c2-compat | PASS; official WeChat TS 4.1.2, 0 diagnostics/class fields |
| node scripts/check-c6-phone-authorization.mjs | PASS; native purpose binding and offline authorization; no real provider exchange |
| npm run check:institution-navigation-a0-4-interactions | PASS; 25/25 navigation cases |
| npm run check:institution-detail-v1-2-1-interactions | PASS; 16/16 offline interaction cases, no actual call/map request |
| npm run check:consultant-b3-runtime | PASS; offline Consultant phone/guard/appointment-entry isolation |
| npm run check:wechat-ts-targeted-compat | PASS; official TS 4.1.2, 162 roots including Appointment, 0 errors/class fields |
| npm run check:wechat-js-compat | PASS; 159 fresh DevTools-generated modules, no unsupported class fields |
| JSON parse | PASS; app/create/success JSON |
| npm run check:doc-governance | PASS; 94 registry entries, 76 active Markdown files |
| git diff --check | PASS; only normal LF/CRLF advisory messages |
| Tracked-file hash comparison | PASS; only create.wxml/create.less/create.ts changed; all other tracked files including original .codex changes match initial bytes |
| Binding/constraint and TS comparison | PASS; events/form/auth attributes unchanged; business TS equals HEAD after removing header presentation additions |
| Index inspection | Empty; no files staged |

The first runtime rerun after adding header measurement exposed the older VM harness's absent getSystemInfoSync API. The visual measurement now checks API presence and retains a default in that harness; tests then passed. No fixture assertion or test was changed. Tests printing phone/API call counts use VM mocks; these are not real outbound calls.

## DevTools and visual evidence

Actual DevTools compiled the final changed source. Simulator observations include List selector-event → exact Detail → existing Appointment method → ready Create; no hardcoded Create query. Empty Submit via the existing component action produced date first-error; fixing date/time/count/contact moved the only remaining error to phone with `prepared=false`. Input handlers clear field errors. Long test inputs left phone empty, keeping every submit pre-validation only. Success without handoff failed closed. Fresh page re-entry discarded test form values and restored the original Mock display.

Coordinate tap returned `appservice App.CDPEnable unimplemented`; selector events and page methods provided runtime evidence. Do not label these as physical touches. An occasional page transition wait queried before the new page settled; subsequent current-page and selector reads verified the correct route. A scrollWidth diagnostic returned `Cannot read properties of undefined (reading '$$')`; it is tool evidence unavailable, not a measured horizontal-overflow PASS. Shell width measured 350px; screenshots show no horizontal overflow or field/footer collision.

A narrow final console query for SyntaxError/ReferenceError/TypeError/WXML/WXSS returned no matching lines. This does not claim the entire console is empty.

Evidence root: `output/warm-swiss-ui4a/`. Native simulator PNG captures are 512×1103. All visual evidence below was inspected.

| File | Evidence |
| --- | --- |
| appointment-create-top.png | Actual current Mock context, title, identity reminder and fixed CTA |
| appointment-create-institution.png | Actual Institution and implicit Elder description, existing develop diagnostic |
| appointment-create-time.png | Actual date/time input, count and section hierarchy |
| appointment-create-contact.png | Actual empty contact form, phone purpose/status, notes |
| appointment-create-bottom.png | Notes, application-not-confirmation disclaimer, safe-area reserve and CTA |
| appointment-validation.png | Actual empty-form inline errors, first date error below fixed header |
| appointment-phone-missing-TEST_ONLY.png | Partially corrected local TEST_ONLY form, missing phone; no prepare/authorization |
| appointment-long-contact-TEST_ONLY.png | Deliberate non-personal long contact input remains inside its native single-line control |
| appointment-long-notes-TEST_ONLY.png | Deliberate non-personal long notes wrap and scroll |
| appointment-long-notes-bottom-TEST_ONLY.png | Long notes end and disclaimer can reach the visible area above CTA |
| appointment-long-institution-TEST_ONLY.png | Render-only long Mock display text; exact existing identity retained, no action while patched, immediately restored |
| appointment-success-unavailable-regression.png | Unchanged Success without lawful handoff |
| scope-check.json / baseline-hashes.json | Scope, binding and preservation evidence |
| visual-appointment-master.png / visual-page-8.png / visual-page-10.png / prd-page-34.png | Read-only baseline/source renderings |

`appointment-phone-blocked.png` is not applicable: current runtime has no display-safe account-blocked projection. `appointment-phone-authorized-TEST_ONLY.png` is not generated: there is no separate authorized state or existing isolated simulator rendering fixture. Its absence is not real-phone PASS. Loading/failure/accepted authorization states are covered by existing pure runtime tests and retained bindings, not fabricated production screenshots.

Long Elder name is NOT_AVAILABLE because the lawful reference exposes no name. Long Institution text is explicitly a TEST_ONLY render stress case, not real catalog data or evidence of a different Institution. No patched display/test input entered backend or storage.

## Data reality and phase protection

```text
NO_FAKE_INSTITUTION = TRUE
NO_FAKE_ELDER = TRUE
NO_FAKE_PHONE = TRUE
NO_FAKE_AUTH_SUCCESS = TRUE
NO_FAKE_VISIT_ID = TRUE
NO_FAKE_APPOINTMENT_SUCCESS = TRUE
NO_FAKE_TRANSPORT_SUPPORT = TRUE
NO_FAKE_CONSULTANT_ASSIGNMENT = TRUE
MOCK_PROVENANCE_PRESERVED = TRUE
TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = NONE
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
AFFECTED_OTHER_PAGES = NONE
PRE_EXISTING_CHANGES_PRESERVED = TRUE
```

The data-reality assertions concern product facts, identities and production writes. Explicitly marked TEST_ONLY render text and the repository's existing Mock fixture remain synthetic development evidence. No secret, real phone/contact evidence, provider payload/code/cloudID/session token or sensitive Profile was recorded.

## Files changed

1. `miniprogram/pages/appointment/create.wxml`
2. `miniprogram/pages/appointment/create.less`
3. `miniprogram/pages/appointment/create.ts` (header measurement only)
4. `docs/ui/warm-swiss-v1/WARM_SWISS_UI_4A_IMPLEMENTATION_REPORT.md` (this AUDIT_ONLY report)
5. New phase evidence under `output/warm-swiss-ui4a/`.

Server/domain/providers/catalog/Consultant source, My Appointments, Success implementation, Evaluation, tokens/shared components, agent config and all previously frozen UI pages were untouched. Baseline hash check covers all tracked files, not only a selected UI-3 subset. Existing output directories were preserved.

## Remaining gates and risks

```text
ANDROID_17_MANUAL_GATE = PENDING
PHYSICAL_TOUCH_GATE = PENDING
SOFT_KEYBOARD_GATE = PENDING
REAL_PHONE_TEST = SKIPPED_BY_AUTHORITATIVE_EXTERNAL_GATE
DOC_IMPACT = AUDIT_ONLY
READY_FOR_WARM_SWISS_UI_4B = TRUE
```

- Platform phone capability remains externally blocked; real provider evidence and G13 remain missing. Only a future platform eligibility confirmation plus separate Owner authorization can reopen one real test.
- No live valid preparation/submission, production canonical-reference round trip, real Elder creation or real Visit receipt was exercised. Formal transport/identity/result preservation is supported by source and offline tests, not live E2E.
- Android 17 keyboard, focused long input, safe-area, Back/button touch and scroll interaction require physical manual validation. Simulator cannot replace this Gate.
- Native prepared phone-button/loading/failure visual branches were not forced in the production simulator; their binding/styling and behavior are covered statically/offline.
- PROJECT_CURRENT_STATUS.md is absent; no current-state router was edited or recreated.
- Success/My Appointments visual work remains UI-4B; no work on that phase started. UI-4B readiness means create visual and preserved success/submission boundaries, not phone capability PASS.

## Final phase markers

```text
STATUS = PASS_WITH_RISKS
PHASE = WARM_SWISS_UI_4A
MAIN_SESSION_ONLY = TRUE
CAPABILITY_AUDIT = COMPLETE
APPOINTMENT_CREATE_VISUAL = PASS
APPOINTMENT_CREATE_CAPABILITY = PARTIAL
APPOINTMENT_CREATE_MASTER = MASTER-F / Service–Conversion
INSTITUTION_IDENTITY = PASS
ELDER_IDENTITY = PASS
FORM_SEMANTICS = PASS
VALIDATION = PASS
SUBMISSION_CAPABILITY = PARTIAL
SUBMISSION_SEMANTICS = PASS
SUCCESS_BOUNDARY_REGRESSION = PASS
PHONE_AUTH_VISUAL = PASS
PHONE_IS_NOT_IDENTITY = PASS
PURPOSE_BOUND_PHONE = PASS
READY_FOR_WARM_SWISS_UI_4B = TRUE
```

Phase stopped after implementation, scoped verification, simulator evidence and this report. No Git delivery or UI-4B implementation performed.
