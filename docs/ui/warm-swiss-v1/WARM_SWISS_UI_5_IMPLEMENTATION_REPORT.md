# WARM_SWISS_UI_5 — Visit Evaluation Visual Refactor

Document role: `AUDIT_ONLY`

Date: `2026-10-08` (Asia/Shanghai)

This report records one implementation and its evidence. It is not a current architecture source, a new Contract, or a new visual baseline.

## Result and Git baseline

`STATUS = PASS_WITH_RISKS`. The existing evaluation form now uses Warm Swiss V1.2 presentation. Production E2E and manual Android gates remain unverified. No UI-6 work was started.

- Start and end HEAD: `bd2ad50500c5c5dc18f4fe0d759e4affc451a848`, `docs(ui): record Warm Swiss UI-4 audits`.
- Previous implementation checkpoint: `7cf26cd8a85c59b3559ee0ad89edcc4ab78696fe`.
- Initial staged diff: empty. No staging, commit, push, reset, restore, checkout, clean, or stash occurred.
- The six pre-existing `.codex` modifications and historical `output/**` files were preserved.
- Evidence is confined to `output/warm-swiss-ui5/`; no UI-4 evidence was overwritten.
- Main session performed all analysis, implementation, and verification. No subagent was started.

## Source and frozen boundaries

Visual master: [Warm Swiss Final UI Baseline V1.2](WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf), CURRENT, PDF pages 27–29, 23A/23B/23C. The three pages were rendered and visually inspected. The frozen PDF was not modified.

Product scope was checked against the current V1.2 page-level PRD, pages 37–39. Relevant semantic sources are:

- `VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md`: required overall/consideration, optional dimension/fee/care/tag/comment inputs, stable codes, immutable submission, private user observations.
- `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md`: trusted principal, owner-scoped read, exact route visit identity and server completed status.
- `VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md`: page-local and TEST_ONLY boundaries; subsequent production Contracts decide the formerly open write semantics.
- `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md`: completion authority belongs to Backend/Operations. Evaluation consumes status; it does not change it.
- WeChat Interaction Contract V2 and Runtime Compatibility Policy for action channels, validation display, fixed navigation clearance and evidence levels.

No `CONTRACT_INDEX.md`, archive product source, entire service-loop reread, or replacement Contract was needed. No dedicated current VisitEvaluation Page/Application handoff file was found among the VisitEvaluation document filenames; the frozen Contracts and directly implemented Application/providers supplied that boundary.

## Capability audit before implementation

The actual active route in `miniprogram/app.json` is `pages/visit/evaluation`. The audit covered `evaluation.*`, `evaluation-view-model.ts`, `visit-evaluation-application.ts`, production context/submit providers, write mapping, idempotency helper and completed appointment navigation.

| # | Capability | Before change | Finding |
|---|---|---|---|
| 1 | visitId reception/validation | IMPLEMENTED | Only visitId is consumed; blank, overlong or control-character identifiers fail closed. |
| 2 | completed Gate | IMPLEMENTED | Exact completed context is required; server status is authoritative. |
| 3 | owner/principal | IMPLEMENTED | C5 session and owner-scoped Backend context; route fields do not select an owner. |
| 4 | page loading | IMPLEMENTED | Context loading, guarded retry, request sequence guard. |
| 5 | editable state | IMPLEMENTED | Only editing/submit_failed permit draft handlers. |
| 6 | overall rating | IMPLEMENTED | Required integer 1–5, one selected value. |
| 7 | consideration | IMPLEMENTED | Required willing/compare/not_considering single choice. |
| 8 | dimension ratings | IMPLEMENTED | 21 optional stable IDs across five groups; no inferred score. |
| 9 | care-management observations | IMPLEMENTED | yes/no/unconfirmed; six handover topics with unconfirmed XOR. |
| 10 | fee transparency | IMPLEMENTED | Optional clear/unclear plus seven independent topics with three answer codes. |
| 11 | liked tags | IMPLEMENTED | Ten stable codes; independent max three. |
| 12 | concern tags | IMPLEMENTED | Same ten codes; independent max three; cross-group reuse allowed. |
| 13 | supplementary comment | IMPLEMENTED | Optional, max 200 characters; visible count. |
| 14 | field validation | IMPLEMENTED | Local validator, write mapping and server field-error handling. No first-error scroll existed. |
| 15 | edit preservation | PARTIAL | Page-local draft, submission failure and auth recheck retain input. No persistent draft or process-restart/re-entry recovery. |
| 16 | submitting | IMPLEMENTED | Page lock plus Application production single-flight. |
| 17 | submitted | IMPLEMENTED | Formal success result; production receipt uses server identity/time. |
| 18 | submit failure | IMPLEMENTED | Draft remains intact; truthful failure feedback. |
| 19 | retry | IMPLEMENTED | Guarded retry; production content/key reuse is unchanged. |
| 20 | return navigation | IMPLEMENTED | Existing navigation-bar returns to actual parent; no new fallback/route. |
| 21 | prohibit edits after submit | IMPLEMENTED | Handlers reject changes after submitted; buttons disabled. |
| 22 | TEST_ONLY isolation | IMPLEMENTED | Explicit test dependency injection; no production fixture import/fallback. |

The formal production context and submit implementations already exist. Their current live availability was not established: the real My Appointments load returned `load_error`, so there was no accessible real completed Visit/owner context on which to perform a safe submission. This does not establish that no real records exist. No synthetic Visit was created, no status was changed, and no production evaluation was submitted.

## Existing structure and implementation

The baseline is one long form, with no Step State, no three-step navigation and no step-specific validation. That structure is preserved. Three numbered chapters and a static contents guide implement 23A–23C without a false completion/progress indicator, new route or state machine.

| Part | Presentation |
|---|---|
| 23A / 01 总体体验 | Overall five rectangular options, explicit selected check mark, score legend, required labels, lightweight Radio rows for consideration. |
| 23B / 02 现场观察 | All 21 dimension fields, stacked label/five-option rows, grouped headings and fine rules; care observations before fees; six handover choices; seven fee topics and aggregate clarity. |
| 23C / 03 最后确认 | Independent tag counters, wrapping choices with check/plus markers, optional textarea/count, direct draft confirmation rows, one fixed submit Footer. |

Warm white, dark headings, gray helper text, terracotta actions, existing 40rpx page margins, small radii and fine dividers use existing `@ws-*` tokens. There are no token or shared component changes, new UI library, gradients, shadows or large colored cards. Native `view` sections replace the old section-card presentation locally. Existing NavigationBar and PrimaryButton Warm Swiss opt-ins are reused.

The only TS addition is presentation error positioning: after the existing invalid result, `wx.nextTick` measures the error target, viewport and navigation component's internal header, then scrolls the title below that fixed header. Local and returned server validation retain their rules and inline messages. Missing geometry/API leaves the inline error available. The initial host-level navigation query returned null in Simulator; scoped component measurement fixed that issue and was reverified.

The confirmation rows read the draft and existing option labels directly. They do not compute an average, weighted score, suitability conclusion or observation-completion claim. No `适合入住` outcome is created. Successful submission shows an explicit result and read-only confirmation instead of the editable form. Production receipt fields retain their original data source and display condition.

## Fields, action channels and state preservation

- Stable IDs and all option lists, draft shape, requiredness and validation helpers are unchanged.
- Each view control retains its original handler and dataset. Selected-state accessibility text and check marks supplement color.
- Liked and concern tags keep independent limits. A rejected fourth selection retains the prior three and shows the existing group-specific error.
- Care observation `no` and `unconfirmed` remain distinct. Neither becomes InstitutionCareProcess, InstitutionVerification or a capability fact.
- Fee answers remain clear/unclear and explained/not_explained/unconfirmed observations; no amount, quote, price commitment or price score is invented.
- Supplement remains optional and limited to 200; native maxlength and existing truncation/validation are unchanged. `adjust-position` and `cursor-spacing` are presentation hints, not keyboard proof.
- There is one rendered Footer. TEST_ONLY and production buttons remain mutually exclusive and each uses only `bind:action="onSubmit"`, with no native tap submission channel.
- loading_context, not_completed, denied, auth_required, load_error, unavailable, already_submitted, submission_conflict, editing, submitting, submit_failed and submitted keep separate displays and transitions.
- Submission locks, Application command/result, authorization, storage, idempotency and production providers are unchanged. Failed submissions retain every draft value. No new persistent Draft mechanism was added.
- Returning to an existing parent does not validate or submit. Leaving the page keeps the original lifetime behavior; cross-entry recovery is not newly claimed.

## Data ownership

`VisitEvaluation = USER_REPORTED_DATA`; care observations are `USER_REPORTED_VISIT_OBSERVATION`.

No Institution facts/revisions, verification, public content, CareProcess, Recommendation V2 score/tier/rank or Visit status are written by this change. `PUBLIC_INSTITUTION_RATING = DISABLED_V1_2` remains in force. No public rating, average, comment count, ranking or review community was added.

## Files changed and scope proof

Requested source changes:

1. `miniprogram/pages/visit/evaluation.wxml`
2. `miniprogram/pages/visit/evaluation.less`
3. `miniprogram/pages/visit/evaluation.ts` — presentation error scroll only
4. This AUDIT_ONLY report

Untracked evidence/helpers are under `output/warm-swiss-ui5/`. `evaluation.json`, ViewModel, Application, providers, backend, domain, routes, shared components, tokens and Appointment pages were not changed.

`verify-scope-and-presentation-TEST_ONLY.mjs` compares original Page methods from HEAD with the implementation after excluding the added visual reveal calls: business handlers are unchanged. SHA256 checks pass for 456 protected files, including pre-existing `.codex` files, all previous output evidence, UI-4 sources, shared components, tokens and evaluation dependencies. Initial staged diff remains empty.

## Tests actually run

Commands come from package.json when registered. Evaluation and appointment-list checks are existing scripts without package.json aliases, so they were invoked directly. All executed runtime checks use isolated fixtures; none writes real Backend data.

| Check | Result | Evidence |
|---|---|---|
| `node scripts/check-visit-evaluation-runtime.mjs` | PASS, 42 cases | `evaluation-tests.log`; Page, validation, context, submission/result, failure recovery, owner/status gate, fixture isolation. |
| `node scripts/check-appointment-list-runtime.mjs` | PASS, 15 cases | `appointment-list-tests.log`; completed action, encoded visit-bound route, guard and owner-read behavior. |
| `npm run check:appointment-institution-visit-c2-runtime` | PASS, 19 fixtures / 98 assertions | `visit-authority-tests.log`; transition/completed rules and no cross-domain writes. |
| `npm run check:appointment-institution-visit-c2-compat` | PASS, 7 targets / 17 emitted modules / 0 errors | `visit-compat-tests.log`. |
| `npm run check:wechat-ts-targeted-compat` | PASS, 0 diagnostic errors | `ts-compat-tests.log`; WeChat TypeScript 4.1.2 and official local typings. |
| `npm run check:wechat-js-compat` | PASS, 160 actual DevTools generated modules | `js-compat-tests.log`; no unsupported class fields. |
| `node output/warm-swiss-ui5/verify-scope-and-presentation-TEST_ONLY.mjs` | PASS | `scope-and-presentation-TEST_ONLY.json`; first-error clearance, intent positioning, geometry fallback, invalid-input retention, unchanged handlers, protected hashes. |
| JSON parse checks | PASS, 39 files | `json-check.json`; package, project, tsconfig and Mini Program JSON. |
| `npm run check:doc-governance` | PASS | `doc-governance-tests.log`; 94 registry entries / 76 active Markdown files. |
| `git diff --check` | PASS | No whitespace errors in this implementation; final full diff check also run. |
| DevTools `compile_wxml` | PASS | Actual evaluation template compilation, codeLength 32400. |
| Standalone `compile_wxss` | NOT_AVAILABLE | Source is Less; no `evaluation.wxss` exists on disk. No WXSS file was added. DevTools Less compilation/rendering is evidenced by actual Simulator captures. |

Additional Backend JUnit reruns were NOT_RUN: the default Java is 17, whereas server/pom.xml requires Java 21; inspected installed JDK locations did not supply a 21 toolchain. No new JDK, Backend setup, MySQL integration, migration or real database test was introduced for this visual task. Frontend/context/mapping/authority tests above do not substitute for Backend unit/database or production E2E evidence.

## DevTools and screenshots

DevTools was logged in and the skill/tool versions matched. Simulator refreshed the modified source and actually loaded the evaluation page. Main viewport: `390 × 844` logical px; original PNG screenshots: `512 × 1103` px.

All evidence is in `output/warm-swiss-ui5/`: 26 real Simulator PNG captures and three PDF baseline renders. Baseline page renders are named `baseline-27/28/29.png`; they are PDF references, not Simulator captures. `evaluation-unavailable-before.png` is pre-change Simulator evidence, and `evaluation-unavailable.png` is the genuine default page after migration (missing visitId; fail closed).

| Evidence group | Actual Simulator files | Provenance |
|---|---|---|
| 23A | `evaluation-overall-top-TEST_ONLY.png`, `evaluation-overall-rating-TEST_ONLY.png`, `evaluation-overall-intent-TEST_ONLY.png` | Existing isolated context provider + actual controls |
| 23B | `evaluation-observation-top-TEST_ONLY.png`, `evaluation-observation-middle-TEST_ONLY.png`, `evaluation-care-process-TEST_ONLY.png`, `evaluation-fees-TEST_ONLY.png` | Existing fixture / actual control actions |
| 23C | `evaluation-tags-TEST_ONLY.png`, `evaluation-tags-limit-TEST_ONLY.png`, `evaluation-notes-TEST_ONLY.png`, `evaluation-confirmation-TEST_ONLY.png`, `evaluation-bottom-TEST_ONLY.png` | Actual tag/input actions; 200-character input and draft-derived summary |
| Submit/validation | `evaluation-validation-TEST_ONLY.png`, `evaluation-submitting-TEST_ONLY.png`, `evaluation-submit-failed-TEST_ONLY.png`, `evaluation-submitted-TEST_ONLY.png` | Existing test provider outcomes through the real Application/Page handlers |
| Context Gates | `evaluation-loading-TEST_ONLY.png`, `evaluation-not_completed-TEST_ONLY.png`, `evaluation-denied-TEST_ONLY.png`, `evaluation-load_error-TEST_ONLY.png`, `evaluation-unavailable-TEST_ONLY.png` | Isolated dependency outcomes through the existing context handler |
| Additional state presentation | `evaluation-auth_required-RENDER_ONLY-TEST_ONLY.png`, `evaluation-already_submitted-RENDER_ONLY-TEST_ONLY.png`, `evaluation-submission_conflict-RENDER_ONLY-TEST_ONLY.png` | Page-data render fixtures only; transition semantics are covered by runtime tests, not these images |

The existing fixture factories under `scripts/fixtures/` were reused. The test application was injected only into the live test page instance, using the official compiled Application module and explicit test-only dependency ports. Deferred release wrapped the existing synthetic submit provider to inspect submitting/double-tap/failure/retry; no production provider was installed in that fixture. Gate-only result stubs have no network or persistence. Render-only state screenshots are explicitly labeled. Fixtures were unloaded through navigation after capture; the final live page returned to the genuine unavailable state.

Simulator interactions confirmed:

- Overall 1–5 and all three consideration options: one selected value.
- Every one of the 21 dimension IDs: in-range selection and correct draft value.
- All three care observation answers; handover unconfirmed replaces specifics, and selecting a specific removes unconfirmed.
- Aggregate fee clarity and all seven independent topics.
- Each tag group rejects its fourth choice and retains the earlier three; both groups may reuse a code.
- Textarea input over the limit is clamped to 200, counter 200/remaining 0.
- Invalid submit invokes no test provider and reveals the first required error below the measured 91px header.
- Two submit button actions while pending: one provider invocation, exact draft preservation.
- Failure: exact draft preservation; retry success: second total invocation; subsequent submit/edit attempts do not change the draft or invoke the provider.
- Submitted form has zero rating/tag/textarea elements; it displays a clear TEST_ONLY result and read-only confirmation.
- TEST_ONLY completed My Appointments action carries only `visitId=visit-test-completed`; other four statuses have no evaluation action. Back returns to the existing My Appointments parent. Appointment source/status authority is unchanged.
- At 390px width, 168 controls have minimum width about 63.60px and height 45px; zero control horizontal overflow. At page bottom the last confirmation content ends above the fixed Footer.

Detailed captured action results are in `devtools-interactions-TEST_ONLY.json`; evidence inventory is in `evidence-manifest.json`. No full health answers, profiles, live session evidence, credentials or real evaluation comments were captured.

Known tool limitations: tapping the PrimaryButton host did not trigger the native button; subsequent checks target its actual `button`. Coordinate tapping returned `appservice App.CDPEnable unimplemented`, so no physical-touch proof is claimed. One cleanup navigation timed out during rapid page transitions; a later page-stack check and sequential navigation confirmed fixture pages had unloaded. Filtered evaluation/SyntaxError/ReferenceError/TypeError console checks returned no matching entries, which is not a claim that the complete console is empty.

## Contract-safe visual deviations and remaining risks

1. `CONTRACT_SAFE_VISUAL_DEVIATION`: three visual pages become chapters of the existing long form. No previous/next step controls, step number, fake progress or new route is introduced.
2. Dimension rows stack label above five options. This increases page length compared with the dense PDF matrix while preserving readable text and touch area; no question, value or score is hidden.
3. Fees preserve clear/unclear and three per-topic codes including unconfirmed. The visual master's simplified yes/no presentation does not replace the frozen schema, and clarity does not become a 1–5 fee score.
4. Header uses confirmed context/status messages. Production context does not expose an institution display name or visit date; visual example names/dates were not invented.
5. Confirmation is a direct read-only draft display. No overall algorithm or “现场观察已完成” claim is introduced. Submitted editing controls are hidden while original state and data remain unchanged.
6. Persistent Draft/re-entry recovery was not present and remains absent. Users retain data within the current page and on failure/auth recheck, not across page destruction or process restart.
7. Main Simulator viewport passed. An additional narrow Simulator viewport was NOT_RUN because the exposed tool surface provides no actual viewport-resize action. Media styles reduce spacing below 360px; that code is not narrow-device runtime evidence.
8. Production E2E is NOT_VERIFIED: actual owner appointment read returned load_error; no genuine completed Visit context or safe real submit was exercised. TEST_ONLY success cannot satisfy production readiness.
9. Backend JUnit/database rerun was NOT_RUN due the Java 21 prerequisite above. No backend source changed.
10. Android 17, physical touch and soft keyboard remain PENDING. Textarea internal scrolling/auto-height during real typing, keyboard overlap, chip/rating physical taps, long-page scrolling, safe area, Footer and real submit need device evidence. Simulator input/textarea hints do not close that gate.

## Completion values

Every PASS below describes source/isolation/runtime or Simulator evidence within this task. It is not production or manual device proof.

```text
STATUS = PASS_WITH_RISKS
PHASE = WARM_SWISS_UI_5
MAIN_SESSION_ONLY = TRUE
CAPABILITY_AUDIT = COMPLETE
VISIT_EVALUATION_VISUAL = PASS
VISIT_EVALUATION_CAPABILITY = PARTIAL
VISUAL_MASTER = WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf / CURRENT / pages 27–29
THREE_PART_VISUAL = PASS
EXISTING_FORM_STRUCTURE = PRESERVED
VISIT_ID_GATE = PASS
COMPLETED_VISIT_GATE = PASS
OWNER_ISOLATION = PASS
OVERALL_RATING = PASS
CONSIDERATION_INTENT = PASS
DIMENSION_RATING = PASS
CARE_PROCESS_OBSERVATION = PASS
FEE_TRANSPARENCY = PASS
SATISFACTION_TAG_MAX_3 = PASS
CONCERN_TAG_MAX_3 = PASS
NOTE_MAX_200 = PASS
VALIDATION = PASS
SUBMISSION_STATE_MACHINE = PASS
SUBMIT_FAILURE_INPUT_PRESERVATION = PASS
NO_DOUBLE_SUBMISSION = PASS
USER_REPORTED_DATA_BOUNDARY = PASS
NO_INSTITUTION_FACT_CONTAMINATION = TRUE
NO_RECOMMENDATION_RERANK = TRUE
PUBLIC_RATING_DISABLED = TRUE
PRODUCTION_E2E = NOT_VERIFIED
TEST_ONLY_PROVENANCE = PASS
TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = NONE
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
NAVIGATION_TESTS = PASS / isolated runtime + TEST_ONLY Simulator
RUNTIME_TESTS = PASS / executed checks above; Backend JUnit NOT_RUN
DEVTOOLS = PASS / actual compilation, selector interactions and screenshots
VISUAL_EVIDENCE = output/warm-swiss-ui5/
ANDROID_17_MANUAL_GATE = PENDING
PHYSICAL_TOUCH_GATE = PENDING
SOFT_KEYBOARD_GATE = PENDING
FILES_CHANGED = evaluation.wxml; evaluation.less; evaluation.ts; this AUDIT_ONLY report
AFFECTED_OTHER_PAGES = NONE / My Appointments completed entry regression only
PRE_EXISTING_CHANGES_PRESERVED = TRUE
VISUAL_DEVIATIONS = documented above / Contract-safe
RISKS = production E2E; Backend Java21 rerun; narrow Simulator; manual Android/touch/keyboard
DOC_IMPACT = AUDIT_ONLY
READY_FOR_UI_5_CHECKPOINT = TRUE / reviewable work only; no Git submission performed
READY_FOR_WARM_SWISS_UI_6 = FALSE / awaits Owner and independent review
```

This phase stops here. No Mine, Elder, Assessment History, Appointment implementation, Frozen Contract, UI-6, automatic commit or push is included.
