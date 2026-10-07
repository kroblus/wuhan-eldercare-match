# WARM_SWISS_UI_3A Implementation Report

Document role = AUDIT_ONLY
DOC_IMPACT = AUDIT_ONLY
Date = 2026-10-07 (Asia/Shanghai)
PHASE = WARM_SWISS_UI_3A
STATUS = PASS_WITH_RISKS
MAIN_SESSION_ONLY = TRUE

## Baseline and scope

- Actual branch / HEAD: master / 7ec60fac45ec4ccb2ef7651aab730e5700a03ebf.
- Visual Source of Truth: README CURRENT V1.2; WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf. Read Design System, Masters, Navigation, Data Reality, Institution/VR audit; inspected rendered pages 20/21/22.
- Semantic Source of Truth: current Product V1.2 and frozen INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md (fact axes, list ordering, identity and VR gates).
- Interaction / compatibility: WECHAT_INTERACTION_CONTRACT_V2.md and existing Repo Skills; existing runtime/toolchain preserved.
- Active routes confirmed in app.json: pages/institution/index, pages/institution/detail, pages/institution/vr.
- Only the two authorized page templates/styles were edited. Institution Detail was read and regressed, not edited. No Agent configuration, Contract, Provider, ViewModel, TS, Catalog, backend or other page changes.
- Six pre-existing .codex modifications and historical output directories preserved. No stage, commit, push, reset, restore, checkout, clean or stash performed.
- UI-0 through UI-2.2 not reopened. UI-3B not started.

## Capability audit before implementation

Legend: IMPLEMENTED = existing functioning runtime; PARTIAL = data/representation exists with a limited gate; SCAFFOLD = route shell without the full domain capability; NOT_AVAILABLE = no such current capability. The visual baseline does not create runtime functionality.

### Institution Directory

| Capability | Audit | Evidence / boundary |
| --- | --- | --- |
| Catalog load | IMPLEMENTED | buildInstitutionListPageSnapshot → validated V1.2.1 catalog composition |
| Count | PARTIAL | No separate production total; items.length is the current display snapshot count. UI says “共 8 条” within explicit Mock disclosure, not eight real Wuhan partners |
| Name | IMPLEMENTED | Display-safe name plus its independent verification status |
| Region | IMPLEMENTED | Display-safe region; current examples explicitly contain Mock |
| Institution type | IMPLEMENTED | Existing VM type labels and fact status |
| Reference fees | IMPLEMENTED | Existing bounded / starting-at / unknown price projection; values unchanged |
| Verified tags | PARTIAL | Existing verifiedDisplayTags/VM tags path retained; live development catalog has no populated tags |
| VR status | IMPLEMENTED | Existing available/unavailable/unknown labels; current eight items all unknown |
| Sorting | IMPLEMENTED | Application ordering unchanged; page renders original items, no new sort controls/algorithm |
| Detail navigation | IMPLEMENTED | One onCardTap binding and canonical navigationIntent serializer |
| Loading | IMPLEMENTED | Same pageState and neutral loading copy |
| Empty | IMPLEMENTED | Same VM empty copy and existing Back action |
| Error | IMPLEMENTED | catalog_error / projection_error / source_context_error preserved |
| Retry | IMPLEMENTED | Same canRetry gate and onRetry; in-flight protection unchanged |
| Data provenance | IMPLEMENTED | MOCK_DEVELOPMENT_ONLY snapshot disclosure remains prominent |
| Region/type filters and interactive sort | NOT_AVAILABLE | No fake controls, district options or Assessment state reuse added |
| Image load error fallback | PARTIAL | Existing no-image placeholder retained; no live image URLs exist to verify network-failure rendering |

Direct dependencies read: index.ts/WXML/Less/JSON, list-view-model.ts, institution-list-detail-page.ts, canonical detail route and navigation guard; catalog provider inspected only to confirm development origin. No broad domain rewrite.

### VR

| Capability | Audit | Evidence / boundary |
| --- | --- | --- |
| Viewer | SCAFFOLD | vr.ts uses registerRoutePage; no renderer |
| Viewer technology | NOT_AVAILABLE | No canvas, web-view, panorama engine or playback lifecycle |
| VR URL source | NOT_AVAILABLE | Scaffold loads no institution or URL |
| Institution VR projection | PARTIAL | List/Detail consume gated VR display state; no VR-page application resolver |
| Multiple scenes | NOT_AVAILABLE | No scene data |
| Space switching | NOT_AVAILABLE | No real room controls |
| Panorama state | NOT_AVAILABLE | No panorama/session state |
| Loading/error | NOT_AVAILABLE | Scaffold has a static empty presentation, not a VR load state machine |
| Unknown/unavailable/expired | PARTIAL | List/Detail truth gate distinguishes availability; VR shell does not resolve per-institution state or expiry |
| Preview image fallback | NOT_AVAILABLE | No imagery injected |
| Route shell | SCAFFOLD | Active /pages/institution/vr; static “暂无真实 VR 内容” |
| Entry/exit | PARTIAL | Diagnostic DevTools route load; generic existing navigation-bar back. Detail VR gate stays closed |
| Return Detail/context | PARTIAL | Stack return keeps the existing parent Detail identity; VR does not parse or bind institution query/context |
| Consultant/appointment CTA | PARTIAL | Existing generic Consultant Tab action retained; no VR Appointment action |

VR_CAPABILITY = SCAFFOLD
VR_VISUAL = PASS
VISUAL_SCAFFOLD_POLISH = COMPLETE
FULL_VR_VIEWER = NOT_AVAILABLE

## Changes and visual implementation

### Directory / MASTER-D

- Warm white surface, dark typography, existing 40rpx Warm Swiss page margin, thin rules and small radii.
- Snapshot title and introduction retained. Current displayed record count derived only from already-projected items.
- Development provenance remains above the records; no “武汉精选真实机构” marketing claim.
- Replaced the full-width cover/card structure with numbered rows: existing image or neutral fallback on the left, institution facts on the right.
- Region, type, name and fee verification states remain textual; current verified facts also use the existing success color. Expired and pending status are not promoted to verified.
- Fees explicitly labeled “参考月费”; bounded, starting-at and missing values unchanged.
- Existing group heading, placement label, tags and VR label retained. Display numbering is only positional presentation, not ranking.
- One row-level detail handler. The visible detail link has no second binding.
- Loading/empty/error use left-aligned page-local presentation with existing text/state/actions. Final error/empty buttons use full-width Warm Swiss styling.

### VR / MASTER-E

- Reused Warm Swiss navigation and PrimaryButton opt-in, color/spacing/numbered section primitives.
- 01 current content: honest no-resource state; 02 VR information; 03 existing Consultant action.
- Development Scaffold provenance remains explicit.
- No institution name displayed because the current scaffold does not legally resolve institution context.
- No fake Viewer, imagery, 360 controls, scene switching, preview URL or Appointment CTA.
- Existing TS description, generic Consultant Tab action and Back behavior unchanged.
- Auxiliary explanation says actual environment/services still need confirmation; no guarantee or real-time claim.

TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = NONE
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
AFFECTED_OTHER_PAGES = NONE (Detail regression only)

## Identity, revision and navigation

INSTITUTION_IDENTITY_CHECK = PASS
RECORD_REVISION_PRESERVED = TRUE

- Direct List element-event navigation: institution-a-mock#2 → Detail query institutionId=institution-a-mock, recordRevision=2, source=direct_list. Existing parser maps direct-list source according to its established route semantics.
- Returning to List and invoking onCardTap twice synchronously produced one new Detail page; settled stack contains only List + one Detail. Runtime tests separately cover failure release and onShow reset.
- Existing Recommendation-context tests pass sourceContextRef propagation for frozen candidates and direct/null context for other partners. No personal profile snapshot was read in DevTools.
- Detail remains ready; officialContact.state=unknown, hasPhones=false, media.vrState=unknown, canOpenVr=false. Calling the existing VR action reports “当前没有可用的 VR 看院资料。” and creates no VR navigation.
- Detail Appointment method enters /pages/appointment/create with institution-a-mock and revision 2; no appointment submitted or phone authorized. Detail Consultant method enters the existing Consultant Tab.
- Diagnostic automation pushed VR with the same ID/revision/source to test its route shell, then automation navigateBack returned to the original Detail page with identical query. This is API/stack evidence, NOT a production Detail→VR entry or per-institution VR resolution.
- VR navigateNext method returns to /pages/consultant/index. Scaffold probe verifies one generic action path per invocation.
- Formal List→Detail→VR business chain remains gated. No gate bypass added to app code.

## Tests

All logs are in ../../../output/warm-swiss-ui3a/ (relative to this report's directory).

| Check | Result |
| --- | --- |
| npm run check:institution-v1-2-1-catalog-integration | PASS, 199 cases |
| npm run check:institution-list-page-runtime | PASS, 22/22 |
| npm run check:institution-detail-page-runtime | PASS, 32/32 |
| npm run check:institution-detail-v1-2-1-ui-runtime | PASS, 39/39 |
| npm run check:institution-detail-v1-2-1-interactions | PASS, 16/16 |
| npm run check:institution-list-detail-runtime | PASS, 231/231 |
| npm run check:institution-list-detail-interactions | PASS, 17/17 |
| npm run check:institution-navigation-a0-4-interactions | PASS, 25/25 |
| npm run check:warm-swiss-ui0-runtime | PASS, existing Consultant guard/action checks |
| npm run check:wechat-ts-targeted-compat | PASS, 0 TS diagnostics; 164 emitted modules in memory |
| npm run check:wechat-js-compat | PASS, 159 fresh DevTools cache JS modules; no unsupported class fields |
| node output/warm-swiss-ui3a/vr-scaffold-probe.mjs | PASS, existing Scaffold/empty/Consultant semantics; no fake Viewer |
| DevTools compile_wxml index / vr | PASS after fixing initial list expression syntax |
| JSON parsing of app / index / vr registration | PASS |
| git diff --check | PASS |
| Documentation governance | PASS |

No recommendation engine change or consumer change; no additional recommendation engine suite was needed. Existing navigation/integration checks cover the preserved recommendation source-context boundary. No permanent mirrored implementation test added; the small VR probe is evidence-only under output.

## DevTools evidence and limitations

DEVTOOLS = PASS_WITH_LIMITATIONS
INSTITUTION_LIST = PASS
INSTITUTION_DETAIL_REGRESSION = PASS

Actual WeChat DevTools Simulator: devtools / iPhone 12/13 (Pro), logical 390×844, SDK 2.32.3. Original PNG captures returned 512×1103. No ADB or physical Android evidence was collected.

| Screenshot | State / provenance |
| --- | --- |
| institution-list-top.png | Real current development-catalog ready state; explicit disclosure and count |
| institution-list-middle.png | B/C rows, unknown fee remains “暂未提供” |
| institution-list-bottom.png | G/H rows; last CTA and safe bottom spacing visible |
| institution-list-empty.png | Render-only empty fixture; initial button styling |
| institution-list-empty-final.png | Final empty styling; full-width Back; use this for final visual review |
| institution-list-error.png | Real invalid sourceContextRef error; initial button styling |
| institution-list-error-final.png | Final error styling; real context error and Retry |
| vr-top.png | Actual static VR Scaffold, no Viewer |
| vr-current-state.png | Actual no-resource section |
| vr-bottom.png | Last service CTA and safe-area visible |
| vr-unavailable.png | Current static no-resource presentation, not a new domain “unavailable” enum |
| institution-detail-regression-top.png | Existing approved Detail; identity/fee/verification/official phone/VR gate/CTAs |

The empty fixture copies approved empty copy and provenance from the current VM, empties item arrays and sets only page presentation state. It is not a Provider fixture, production directory change or proof the live catalog is empty. It is saved as list-empty-render-fixture.json and discarded by fresh navigation.

Errors were safely triggered through a non-existent opaque ref, not by altering Provider or production data. Retry was exercised as an element event; the invalid reference continues to fail closed.

Evidence artifacts also include:
- list-ready-data.json; test-results.json and per-check logs.
- list-detail-stack.json; list-rapid-event.json; list-rapid-stack-settled.json.
- detail-official-contact.json; detail-media-gate.json; detail-vr-gate-action.json.
- detail-appointment-stack.json; detail-consultant-current.json.
- vr-diagnostic-stack-complete.json; vr-back-api-stack.json; vr-consultant-current.json.
- list-error-retry-event.json; list-error-retry-state.json; final-console-error-grep.json.
- vr-scaffold-probe.mjs and log.

Physical coordinate tap attempt failed with 'appservice App.CDPEnable unimplemented'. Element event/API/method tests are NOT physical touch verification. Direct component lookup for navigation-bar was unavailable through the evaluation interface; VR return evidence is explicitly API navigateBack, not a tested physical header tap. Initial page readiness races (“page destroyed” / no current page) and CLI quoting failures were resolved for the successful final route/state captures; raw diagnostic failures remain in output and are not cited as passes. Final error grep matched repeated [warn] entries from the unchanged question-section component: its String error property received null. The captured matches contain no Institution/VR runtime exception; this is not a full console audit or physical device pass. The unrelated component warning is reported without expanding UI-3A scope.

## Visual comparison and Contract-safe deviations

Compared against the V1.2 pages 20 (List), 21 (approved Detail reference), 22 (VR):
- Shared page margin, warm background, dark title, accent CTA, thin dividers, small radii and numbered hierarchy match the existing Warm Swiss system.
- List rows are taller than the synthetic PDF due to preserved fact-by-fact verification text and Mock provenance. Real available type text wraps; no truncation or hidden institution record. Extremely long production names and actual remote media failures are not live-tested; word breaking/min-width rules are retained.
- No PDF images/prices/institution names imported.
- No filters/search/sort affordances because current runtime has none.
- Count is current display snapshot records, not a claim about real partnership totals.
- VR has no resolved institution hero, real scenes, Viewer, return-to-detail CTA or Appointment CTA because these are absent from its legal scaffold.
- Header Back keeps existing stack/root behavior. Standalone root VR has no configured fallback; no context-free Detail route is invented.
- VR no-resource state is the allowed stage completion, not full VR capability.

CONTRACT_SAFE_VISUAL_DEVIATION = TRUE (runtime-truth-based changes above)
VISUAL_DEVIATIONS = See this section; no semantic drift

## Data reality check

DATA_REALITY_CHECK = PASS

NO_FAKE_INSTITUTION = TRUE
NO_FAKE_PRICE = TRUE
NO_FAKE_BED_CAPACITY = TRUE
NO_FAKE_VR = TRUE
NO_FAKE_VERIFICATION = TRUE
NO_FAKE_PHONE = TRUE
MOCK_PROVENANCE_PRESERVED = TRUE
INSTITUTION_IDENTITY_PRESERVED = TRUE
RECORD_REVISION_PRESERVED = TRUE

Existing synthetic catalog facts remain explicitly development data; their existing fact-level verified statuses are not presented as verification of real Wuhan institutions. No Catalog/Provider/domain/contact data was changed.

## Risks and closeout

ANDROID_17_MANUAL_GATE = PENDING
PRE_EXISTING_CHANGES_PRESERVED = TRUE
READY_FOR_WARM_SWISS_UI_3B = TRUE (visual scope completed; only readiness statement, no UI-3B implementation)

Remaining limitations:
1. VR Viewer/exact institution context is still Scaffold; future implementation needs its own authorized application work.
2. Physical tap and Android 17 validation remain pending. Final cross-page device closeout should verify Back, quick taps, long text, scroll/safe-area, and CTA reachability.
3. Standalone root VR Back lacks an existing configured fallback. Preserved rather than changing navigation policy during visual work.
4. Live image-network failure and very long production names cannot be proven against the current no-image development catalog.
5. Generic VR Scaffold Consultant navigation retains its pre-existing behavior; it does not acquire institution assignment or a new page-level navigation guard.
6. Session console contains question-section String/null warnings in an unchanged component; no fix attempted in this visual scope.

FILES_CHANGED:
- miniprogram/pages/institution/index.wxml
- miniprogram/pages/institution/index.less
- miniprogram/pages/institution/vr.wxml
- miniprogram/pages/institution/vr.less
- docs/ui/warm-swiss-v1/WARM_SWISS_UI_3A_IMPLEMENTATION_REPORT.md (new AUDIT_ONLY report)
- output/warm-swiss-ui3a/ (new local evidence only)

NAVIGATION_TESTS = PASS (runtime + event/API evidence; physical limitation disclosed)
RUNTIME_TESTS = PASS
VISUAL_EVIDENCE = ACTUAL_DEVTOOLS_SIMULATOR
DOC_IMPACT = AUDIT_ONLY

Stopped at UI-3A. No stage / commit / push.
