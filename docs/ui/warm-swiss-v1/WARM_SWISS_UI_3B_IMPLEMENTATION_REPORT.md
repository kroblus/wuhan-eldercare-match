# WARM_SWISS_UI_3B Implementation Report

Document role = AUDIT_ONLY
DOC_KIND = AUDIT
NORMATIVE = FALSE
DOC_IMPACT = AUDIT_ONLY
Date = 2026-10-07 (Asia/Shanghai)
PHASE = WARM_SWISS_UI_3B
STATUS = PASS_WITH_RISKS
MAIN_SESSION_ONLY = TRUE

## Scope and baseline

- Branch / HEAD: master / 7ec60fac45ec4ccb2ef7651aab730e5700a03ebf. No stage, commit or push.
- UI-3A is approved and was not reopened. Its four page files and report, six pre-existing .codex files, and app.json were hash-checked unchanged (12/12).
- Visual Source of Truth: docs/ui/warm-swiss-v1/README.md, CURRENT V1.2, and WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf. Used the Master mapping, relevant Navigation/Data Reality/Consultant contact guidance and Consultant/Assistant audit pages; inspected rendered PDF pages 22/23. UI-3A report was a scope reference only.
- CONSULTANT_MASTER = MASTER-F / Service & Conversion.
- ASSISTANT_MASTER = MASTER-F / Service & Conversion.
- Semantic sources: frozen GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md, CONSULTANT_PERMISSION_CONTRACT_V1.md and AI_CONSULTATION_CONTRACT_V1.md under docs/architecture. Existing Interaction V2 and C6 authorization behavior remain authoritative.
- Implementation and validation were performed by the main session. No subagent, Agent Engineering change or UI-4 work.

## Capability audit before implementation

IMPLEMENTED means an existing functioning route, projection or handler. PARTIAL means a functioning path whose current data/integration is limited. SCAFFOLD means the full product capability is absent. NOT_AVAILABLE means no current field or integration. A supported state or test fixture does not prove production data readiness.

### Consultant

| Item | Capability | Current evidence / boundary |
| --- | --- | --- |
| Route / Tab | IMPLEMENTED | app.json registers /pages/consultant/index as the Consultant Tab; no duplicate route |
| Profile data source | IMPLEMENTED | buildGlobalConsultantPageApplicationV1 consumes the public-safe global application result |
| Actual public profile | SCAFFOLD | productionSafeMissingProvider: PRODUCTION provenance, sourceState missing, loadConsultantProfile returns null |
| Name | NOT_AVAILABLE | displayName is empty; showIdentity false |
| Avatar | NOT_AVAILABLE | Active projection has no avatar; no image added |
| Job / role | PARTIAL | VM has generic roleLabel 养老顾问; no real identity shown in current missing state |
| Service description | IMPLEMENTED | Existing generic description and five service items preserved; not claims about a named person |
| Contact projection | PARTIAL | Frozen phone/QR projections and visibility gates exist, but current contact section is hidden |
| Phone number | NOT_AVAILABLE | phone.status missing; displayValue and dialValue empty |
| WeChat account | NOT_AVAILABLE | No textual WeChat ID field in active projection |
| Enterprise WeChat QR | NOT_AVAILABLE | publicImageUrl empty; showQrImage false; no placeholder QR |
| Online state | NOT_AVAILABLE | No online status field or invented availability |
| Consultant assignment | NOT_AVAILABLE | Global service does not assign an institution or institution consultant |
| Consulting entry | PARTIAL | Existing guarded phone/QR paths depend on a configured profile; current page exposes honest reload and lawful institution selection |
| Reload | IMPLEMENTED | onRetry reloads the existing application; actual DevTools result remains missing |
| Appointment assistance | PARTIAL | onAppointmentTap opens the institution list to select a specific institution; does not create an appointment |
| Telephone action | PARTIAL | Existing actionAvailable + dialValue gate and guard retained; tested with offline mocks, not a live call |
| Login dependency for browsing | NOT_AVAILABLE | Public browsing remains anonymous |
| Phone authorization | IMPLEMENTED | Existing C6 native getPhoneNumber purpose-only verification retained; explicit user action only, no contact/appointment submission or reusable proof storage |
| Loading | IMPLEMENTED | Existing transient loading branch; visual check uses clearly marked TEST_ONLY page-data fixture |
| Empty / config pending | IMPLEMENTED | Actual production-safe missing state; main DevTools evidence |
| Error | IMPLEMENTED | Existing failure/null-projection branch; visual check uses clearly marked TEST_ONLY fixture |
| Retry | IMPLEMENTED | Existing failure/missing action; fixture retry restored actual missing state |
| Ready | PARTIAL | VM supports configured availability states; no real ready profile and no fabricated ready screenshot |

Data source: miniprogram/services/consultant-global-page.ts composes createGlobalConsultantApplicationServiceV1 with productionSafeMissingProvider. resolvePublicMedia returns unavailable. Institution official phone, user phone and global Consultant contact are not interchangeable. No Provider, contact projection or authentication policy was changed.

CONSULTANT_VISUAL = PASS
CONSULTANT_CAPABILITY = SCAFFOLD
CONSULTANT_PROFILE_CAPABILITY = SCAFFOLD
CONSULTANT_DATA_REALITY = PASS
REAL_CONSULTANT_PROFILE = NOT_AVAILABLE

### Assistant route and capability

ASSISTANT_ROUTE = ACTIVE
Actual route = /pages/service/ai-chat/index (non-Tab)
Actual caller = Home.openAIConsultation

| Item | Capability | Current evidence / boundary |
| --- | --- | --- |
| Active page and Home entry | IMPLEMENTED | Registered app.json page and guarded Home navigation |
| Messages | IMPLEMENTED | Empty on entry; current session messages are produced by real input/send and approved FAQ lookup |
| Approved FAQ | IMPLEMENTED | 11 owner-approved production entries, deterministic exact question/alias lookup; not a test-only mock |
| Free-form online AI | NOT_AVAILABLE | No model/backend request in the active page application |
| Input / send | IMPLEMENTED | Existing textarea, onInput/onSend/submitInput and sendInFlight guard |
| Backend endpoint | NOT_AVAILABLE | Local approved FAQ application only |
| Production mock conversation | NOT_AVAILABLE | No static history inserted; test-only composition remains outside the production graph |
| Initial / empty | IMPLEMENTED | idle, messages empty, no fake greeting/history |
| Sending / loading | IMPLEMENTED | Actual rapid-send probe observed sending; one user message before completion |
| Ready answer | IMPLEMENTED | Actual approved question produced answer_ready with 产品说明 source label |
| Error | IMPLEMENTED | Existing recoverSendFailure path verified in runtime tests; screenshot is explicitly TEST_ONLY |
| Retry | IMPLEMENTED | Actual unmatched question reached knowledge_unavailable; retry stayed unavailable without an invented answer |
| Conversation context | PARTIAL | Local ephemeral messages only; no personal/domain context entry |
| Assessment read | NOT_AVAILABLE | No raw answers or Draft read added |
| ElderProfile read | NOT_AVAILABLE | No personal Profile projection integration in this page |
| Recommendation read | NOT_AVAILABLE | General approved FAQ explains concepts only; no personal result snapshot integration |
| Institution Detail action | NOT_AVAILABLE | No such current action; no new route created |
| Manual Consultant entry | IMPLEMENTED | Existing generic openHumanHandoff switches to Consultant Tab; sending gate and navigation guard retained |
| Login requirement | NOT_AVAILABLE | Entry and FAQ interaction have no login requirement |
| History persistence | NOT_AVAILABLE | New page instance returned to idle with messages empty |

ASSISTANT_VISUAL = PASS
ASSISTANT_CAPABILITY = SCAFFOLD (task definition: FAQ-only, not a full online conversational service)
ASSISTANT_RECOMMENDATION_BOUNDARY = PASS

The explicit B7 safety table is finite and exact, not a general intent classifier. “我该吃什么药？” produced need_human and the existing safe refusal. Alternative wording and unapproved real-time questions stayed knowledge_unavailable without a fabricated reply. No safety classifier was expanded. The generic Consultant entry is preserved independently of result-specific canOpenHumanHandoff; it does not promise an assigned or contacted consultant.

## Presentation changes

Only these four implementation files changed:

1. miniprogram/pages/consultant/index.wxml
2. miniprogram/pages/consultant/index.less
3. miniprogram/pages/service/ai-chat/index.wxml
4. miniprogram/pages/service/ai-chat/index.less

- Reused existing Warm Swiss tokens, NavigationBar and PrimaryButton variants. Warm white surface, dark hierarchy, terracotta section numbering/primary CTA, 40rpx page margin, thin rules, small radii and quieter secondary actions.
- Consultant: current profile state, existing service descriptions, existing contact authorization and institution-selection action arranged into four readable sections. Missing is neutral; failure uses the existing error color. Legal identity, phone and QR branches remain field-gated. No avatar was added.
- Assistant: capability status, ruled quick questions, real current-session messages and sources, then manual Consultant entry. User messages use a restrained warm surface; assistant replies remain readable plain text. need_human is normal service guidance, not a red failure panel.
- Existing static notice incorrectly said no approved FAQ was connected despite the active B7 production manifest. Changed only WXML notice to accurately distinguish approved FAQs, unmatched questions and absent online model.
- Moved existing input/send/retry presentation into a page-local fixed composer with safe-area padding and 520rpx scroll reserve. Textarea remains auto-height, maxlength 500, with 200rpx maximum visible height. Send area is 280rpx so the existing loading indicator and label fit on one line. Long input and bottom manual CTA were inspected.
- All original input, send, retry, quick-question, phone, authorization, selection and handoff handlers remain. PrimaryButton actions use one bind:action channel; no duplicate page bindtap was added.

TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = NONE
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
AFFECTED_OTHER_PAGES = NONE (shared code/routes unchanged; existing navigation entries regressed)

No TS, JSON, ViewModel, Provider, Store, Domain, Backend, Institution Catalog, Assessment, ElderProfile or Recommendation code was edited. This report and output/warm-swiss-ui3b evidence are the additional artifacts.

## Data reality

| Check | Result |
| --- | --- |
| NO_FAKE_CONSULTANT | TRUE |
| NO_FAKE_CONSULTANT_PHOTO | TRUE |
| NO_FAKE_PHONE | TRUE |
| NO_FAKE_WECHAT | TRUE |
| NO_FAKE_ONLINE_STATUS | TRUE |
| NO_FAKE_CHAT_HISTORY | TRUE |
| NO_FAKE_AI_RECOMMENDATION | TRUE |
| NO_FAKE_APPOINTMENT | TRUE |
| MOCK_PROVENANCE_PRESERVED | TRUE |

DATA_REALITY_CHECK = PASS. No institution official contact was copied to the global Consultant. No phone call, live authorization or contact submission was executed. Screenshots of conversational content reflect deliberate non-personal test inputs through the real local handler; they are session validation, not historical user consultations. Render-only states are visibly TEST_ONLY and were never written to a production Provider. No sensitive Assessment/Profile data or secrets were collected.

## Tests

Existing package.json scripts were inspected before invocation. All listed checks passed; logs are under output/warm-swiss-ui3b.

| Existing command | Result / coverage |
| --- | --- |
| npm run check:consultant-b3-runtime | PASS; VM states, phone gate/guard, reload, institution-selection navigation, global context isolation |
| node scripts/check-c6-phone-authorization.mjs | PASS; existing native binding/purpose text and offline authorization verification checks, TypeScript 4.1.2 |
| npm run check:ai-b5-runtime | PASS; 24 test fixtures / 96 assertions; fail-closed safety, zero cross-domain writes |
| npm run check:ai-b6-runtime | PASS; 12 test fixtures / 84 assertions; seven states, empty input, rapid send/retry, handoff, Home entry |
| npm run check:ai-b7-runtime | PASS; 16 test fixtures / 139 assertions; 11 approved production FAQs, provenance, safety precedence, no live provider/secret or domain writes |
| npm run check:warm-swiss-ui0-runtime | PASS; existing Consultant CTA gates, one action channel, navigation guard/failure/lifecycle |
| npm run check:institution-navigation-a0-4-interactions | PASS; 25/25 cases, canonical routes, context/guard boundaries and root Back behavior |
| DevTools compile_wxml, both actual page paths | PASS; final Consultant/Assistant compile outputs saved |
| JSON parse | PASS; app.json and both page component registrations |
| git diff --check | PASS |
| npm run check:doc-governance | PASS; completed after adding this AUDIT_ONLY report |
| Protected-file SHA-256 comparison | PASS; 12/12 unchanged |

No runtime source changed, so separate targeted TS/generated-JS compatibility suites were not expanded for this presentation-only stage. Existing runtime/C6 tests compiled their relevant code. Phone call counts in test logs are offline mock calls, not real outbound calls.

## DevTools and navigation evidence

Both actual routes were opened in the logged-in WeChat DevTools Simulator. CLI event/API and page-stack evidence is distinct from physical touch and Android evidence.

| Flow | Actual result | Evidence in output/warm-swiss-ui3b |
| --- | --- | --- |
| Home → Consultant | PASS; existing Home action called twice, Consultant single-root Tab | home-consultant-rapid-action.json, home-consultant-stack.json |
| Home → Assistant | PASS; Home + Assistant stack | home-assistant-action.json, home-assistant-stack.json |
| VR → Consultant | PASS; unchanged navigateNext reaches Consultant single-root Tab | vr-consultant-action.json, vr-consultant-stack.json |
| Assistant → Consultant | PASS; existing generic action switches Tab and removes Assistant stack | assistant-consultant-action.json, assistant-consultant-stack.json |
| Consultant → institution selection | PASS; same-tick double action yields one institution page | consultant-selection-rapid-action.json, consultant-selection-stack.json |
| Institution list → Consultant | PASS; API navigateBack returns to Consultant root | consultant-return-stack.json |
| Assistant → Home Back | PASS at API stack level | assistant-back-home-stack.json |
| Consultant Tab / native bar | PASS at API/render level; selected Consultant Tab visible at top and bottom | consultant-top.png, consultant-tab-bottom.png |
| Assistant rapid send | PASS; sending with one user message, then exactly one user + one approved answer | assistant-rapid-send.json, assistant-rapid-send-result.json |
| Quick question / empty validation | PASS via selector event + actual handler | assistant-quick-action.json, assistant-empty-validation-result.json |
| Fresh Assistant session | PASS; idle, messages empty, render fixture removed | assistant-restored-initial.json |

The VR scaffold's existing navigateNext directly uses switchTab and has no page-level NavigationGuard. It was not rewritten in UI-3B; one action path was verified, not a new rapid-tap guarantee. Consultant remains a Tab with backEnabled false; its root does not require ordinary navigateBack. Assistant entry from Home has the existing back affordance and API return succeeds. Direct standalone Assistant root fallback is not implemented by the existing NavigationBar and was not added.

Physical coordinate tap was attempted in this stage and failed with appservice App.CDPEnable unimplemented (physical-tab-tap.log). Selector-event and callMethod/API checks are not physical click PASS. The console query retained pre-existing question-section error-property String/null warnings; that unchanged component is outside this task. No new Consultant/Assistant runtime exception was observed, but the retained console is not a claim that all logs are clean.

NAVIGATION_TESTS = PASS (runtime + event/API scope; physical gate pending)
RUNTIME_TESTS = PASS
DEVTOOLS = PASS_WITH_RISKS

## Visual evidence

All PNGs below are actual 512 × 1103 DevTools Simulator captures under output/warm-swiss-ui3b; no design mockups were substituted. Required Assistant captures were refreshed after the page-local send-width correction.

| File | Provenance / inspected content |
| --- | --- |
| consultant-top.png | Actual missing public profile; title, neutral status, native Tab |
| consultant-config-pending.png | Actual 顾问资料待配置; primary reality evidence |
| consultant-current-state.png | Actual service/current-state layout |
| consultant-bottom.png | Actual existing consent and institution-selection sections |
| consultant-tab-bottom.png | Actual bottom with selected native Consultant Tab visible |
| consultant-loading-TEST_ONLY.png | Explicit render-only loading fixture; no fake identity/contact |
| consultant-error-TEST_ONLY.png | Explicit render-only failure/null projection; restored through retry |
| assistant-top.png | Actual fresh idle page; empty history, FAQ/model capability notice |
| assistant-current-state.png | Actual answer_ready following approved FAQ input |
| assistant-conversation.png | Real handler-generated FAQ reply and 产品说明 source label |
| assistant-input.png | Deliberately entered long non-sensitive input, never submitted; bounded composer and reachable manual CTA |
| assistant-bottom.png | Actual unmatched-question state; fixed input/send/retry and reachable manual CTA |
| assistant-need-human.png | Actual exact B7 medical-boundary safe refusal; send disabled, manual Consultant CTA retained |
| assistant-sending-TEST_ONLY.png | Explicit render-only transient layout; final width keeps loading/text on one line |
| assistant-error-TEST_ONLY.png | Explicit render-only failure/retry layout; supporting capture before final send-width increase |
| assistant-validation.png | Actual empty-input error; supporting capture before final send-width increase |

The report's capability conclusions use actual sources/handlers/runtime tests, not render-only screenshots. No ready Consultant fixture, invented contact image or online model answer was used. Simulator ended on actual missing Consultant state; Assistant fixtures were discarded by reopening the page.

VISUAL_EVIDENCE = PASS

## Contract-safe visual deviations and remaining gates

CONTRACT_SAFE_VISUAL_DEVIATION:

1. Consultant stays a truthful configuration-pending service surface without profile/photo/phone/QR/online-state decoration. Real contacts cannot be inferred from the visual reference.
2. Assistant displays approved FAQs and real ephemeral local interactions; no online model, fabricated opening conversation, personal recommendation context or institution ranking was added.
3. Existing C6 purpose-only authorization remains visible with its exact limitations. It does not become contact submission or automatic appointment creation.
4. Existing ViewModel state/provenance wording is preserved, including the initial/unmatched honest-unavailability labels, even though the page-local notice now correctly acknowledges approved FAQs.

ANDROID_17_MANUAL_GATE = PENDING. There is no new Android 17 device evidence, ADB proof, native authorization test or real telephone test. Do not reuse earlier phase/device PASS. The fixed composer still needs real-device keyboard, safe-area and long-input scrolling validation; Simulator proves layout without a physical soft keyboard. Physical Tab/header/button touches remain pending due the tool limitation.

RISKS = absent real Consultant profile; FAQ-only assistant; finite exact safety phrases; real-device keyboard/physical touch/native authorization pending; existing unrelated console warning and direct-root Assistant fallback limitation. These are recorded limitations, not newly added product behavior.

PRE_EXISTING_CHANGES_PRESERVED = TRUE (protected-hash-verification.json; historical output preserved)
READY_FOR_WARM_SWISS_UI_4 = TRUE (UI-3B implementation/evidence complete; this is sequencing readiness, not Android final acceptance)

Stop at UI-3B. No appointment flow, Mine, Evaluation, Profile, history or UI-4 implementation was started. No Git stage, commit or push.
