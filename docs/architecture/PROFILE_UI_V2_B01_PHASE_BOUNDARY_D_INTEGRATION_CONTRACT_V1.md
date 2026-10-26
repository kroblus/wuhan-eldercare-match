# Profile UI V2 — B01 Phase Boundary D Integration Contract V1

```ini
DOC_STATUS = FROZEN
DOC_KIND = CONTRACT
CONTRACT_ID = contract.profile_ui.v2_integration.b01_phase_boundary_d.v1
CONTRACT_VERSION = profile-ui-v2-application-integration-b01-phase-boundary-d-v1
SIGNING_DATE = 2026-10-12
SIGNING_TIMEZONE = Asia/Shanghai
SUCCESSOR_TEXT_APPROVAL = APPROVED
STATUS = APPROVED_PENDING_IMPLEMENTATION
SIGNED_SCOPE = A
EXCLUDED_SCOPE = B
IMPLEMENTATION_AUTHORIZATION_THIS_ROUND = NONE
B01_IMPLEMENTATION = NOT_STARTED
RUNTIME_ACTIVATION = FALSE
RUNTIME_ACCEPTANCE = NOT_VERIFIED
ANDROID_OWNER_ACCEPTANCE = NOT_VERIFIED_FOR_B01_D
GLOBAL_NAVIGATION_PASS = NOT_DECLARED
PRODUCTION_RELEASE_READY = FALSE
```

## 签署范围、覆盖优先级与实施边界

Owner 于 2026-10-12（Asia/Shanghai）在本会话直接批准 R01–R04 修订后的两份 successor 文本，并授权本次正式 ID/版本核对与登记。完整签署依据、草案哈希和版本绑定见[签署记录](../../output/b01-phase-boundary-d-owner-signoff-v1/OWNER_SIGNOFF.md)。

- **SIGNED_SCOPE = A**：六物理评估页面、Budget 合法完成后单次阶段重置、Profile 根/非根出口及六组编辑/恢复、继续填写、深来源重新进入 Assessment 的实际容量保护与 Intro 一次性目标意图协议。
- **EXCLUDED_SCOPE = B**：不重新进入 Assessment 的独立深层 Profile/Result/Institution/Appointment 业务链；并排除 D01/D02、History/D12、领域 Schema、S2B、生产发布。B 的容量不足只能保留合法上下文及可见失败/现有合法恢复，不授权猜测性 reset 或 context/handoff 迁移；不得将 B 标为 PASS。B 延期不阻止 A 后续单独获授权实施。
- 本文是**已批准、冻结的未来实施规范**，不是已部署行为或 runtime 验收记录。只有下一轮明确源码实施授权及相应验证/激活治理完成后，才能声明实现符合本 successor；本轮没有这类授权，不提前配置 runtime dispatch、发布新路由或更新 CURRENT 运行时事实。
- 本文与配套 successor 共同组成 Scope A 的局部覆盖：明确改变的导航条款以本签署文本为未来实施依据，未改变的规则仍按原 Frozen。旧文件和旧登记保留，既不全量 SUPERSEDED，也不把两份全量交互规范当并行权威。旧文件中“当前唯一”及旧人工 PASS 只能依其原版本/测试源解释，不能否定本次已批准的局部后继，也不能转为新实现 PASS。
- 下面保留已签署草案的结构化差异字段（包括 `EXISTING_RULE`、`PROPOSED_SUCCESSOR_TEXT`）及“拟议/草案/若获批”等起草时表达，以便逐条追溯。Scope A 中后继条款现在已获文本批准；这些历史表达不表示再次等待同一文本批准，不授权当前源码执行。B 类建议、可选文案与实施参数仍按原范围保持未决/建议性质。
- 32 题、26 必填、稳定 ID、Draft Schema/currentStep、首缺组恢复及完整 Draft Continue-to-Basic、Profile 版本派生与 Recommendation 领域语义均不变；不新增敏感答案传递或全局状态框架。B-1G 原型仍为 REJECTED。

## 源版本与局部覆盖表

前驱：`contract.profile_ui.v2_integration` / `profile-ui-v2-application-integration-v1`，原文 [Profile V2 Integration](PROFILE_UI_V2_INTEGRATION_CONTRACT.md)。配套签署：[Interaction B01-D V1](WECHAT_INTERACTION_B01_PHASE_BOUNDARY_D_SUCCESSOR_V1.md)。legacy [Profile UI V1](PROFILE_UI_CONTRACT.md) 的 `contract.profile_ui.v1` 保留原文；本版不替换领域 Profile V2 或 application dispatch 版本。

| 原合同条款 | Scope A 后继条款 | 最小覆盖关系 |
|---|---|---|
| Profile V2 §§6–8、§10 决策 1/4 | P01/P03 | 四状态、原 route、最新 Draft 原子刷新与领域派生不变；根/父实例明确区分，四状态有可达 Home，根 header fallback 从 Budget 改 Home switchTab |
| Profile V2 §7、legacy Profile V1 §8 对应导航行 | P02 | 合法且容量安全的题组祖先按原 delta 返回；无合法祖先且安全时 redirect 编辑改为 navigateTo(target)，保留真实 Profile 父页；容量不足执行已签署 I03/R02/R03 协议 |
| Profile V2 §§3、6–8、§10 决策 4 | P03 + Interaction I02 | 完成后新 Profile 从最新合法 Draft 走原 versioned 派生；不迁移旧 Preview/Recommendation；显式 Result CTA 及原 Recommendation 领域路径保持，不重复堆积 Profile/Result |
| Profile V2 §§6–7、§11、legacy Profile V1 §8 反馈/出口行 | P04/P01 + Interaction I04 | 返回/保存/失败提示必须真实；根系统 Back 不承诺回 Budget/Home；可选措辞/位置不是新增冻结视觉要求，不强制第七修改入口 |
| 原版本不变量、其他条款及旧阶段标记 | 本文范围与明确不变节 | 不撤销原 application/domain/version/History 边界；旧阶段状态只属旧文证据，不能当 B01-D runtime 验收或本版已实施 |

## P01 — Profile root, four states, and Home/Edit/Result actions

### Structured difference

```text
SOURCE_CONTRACT:
  docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md
SOURCE_SECTION:
  §§6, 7, 8, 10 (decision 1: Profile route; decision 4: Preview refresh), 11
EXISTING_RULE:
  Keep loading/ready/incomplete/error. Every onShow rereads the current Draft and atomically replaces the in-memory snapshot; no stale ViewModel or Preview cache. Back uses the real page stack when present and currently falls back to Budget at root. Ready permits the six edits and Result CTA; incomplete/error use recovery actions.
APPROVED_NEW_PRODUCT_BEHAVIOR:
  After successful Budget completion, Profile is the actual root. Root Profile offers Home and Edit; root Android system Back may leave the mini program. This is an approved D goal, not evidence of Android verification.
PROPOSED_SUCCESSOR_TEXT:
  Preserve the existing Profile route and four states. In every state expose a usable Home action that switches to the registered Home tab and preserves Draft without validation or clearing. In ready, expose the existing six Edit actions and Result CTA; in incomplete/error retain the existing recovery behavior and do not present stale/partial Profile data. Profile back is parent-first: when a real parent exists, return to that instance; only when the page is truly root use Home as the header fallback. The root header fallback must be configured as a tab fallback (`fallbackUrl=/pages/home/index`, `fallbackIsTab=true`) and call `switchTab`. At the D-created root, Android system Back follows WeChat root-page behavior and may leave the mini program; do not promise that it returns to Budget or Home, and do not intercept it to synthesize a business route. The in-page Home action and Android system Back are distinct actions.
UNCHANGED_INVARIANTS:
  Keep `/pages/assessment/profile` and existing schema/version dispatch; keep four states; no login, Draft clear, Preview persistence, partial Profile, formal identity, or Profile-side Recommendation inference. At most one navigation API per action. A real parent takes precedence over root fallback.
BREAKING_NAVIGATION_SEMANTICS:
  Successful Budget `reLaunch` closes the Assessment/Intro/Home ancestors and creates a true Profile root. The root header fallback changes from the existing Budget fallback to Home; Android system Back is not equivalent to that fallback. Parent-stack Profile instances must still return to their actual parent.
REQUIRED_TESTS:
  Exercise all four Profile states both with a parent and at root; prove Home is reachable in each, root fallback uses switchTab with the tab flag, and parent back pops the actual parent. Verify ready-only Edit/Result actions and incomplete/error recovery. Node tests may cover API selection and state preservation, but only an Owner Android test can verify root system-Back behavior; report that separately from DevTools and automation.
```

### State/action interpretation for review

| Profile state | Home | Edit | Result | Recovery |
|---|---|---|---|---|
| `loading` | Available; does not wait for Preview or validate | Not exposed until ready | Not exposed until ready | Back remains usable |
| `ready` | Available | Six existing section IDs and targets | Existing Result V2 entry | Not applicable |
| `incomplete` | Available | Existing recovery semantics; no stale ready actions | Unavailable | First missing step, or Intro when no answers, subject to the capacity rules proposed in P02 |
| `error` | Available | No partial Profile edit actions | Unavailable | Existing Intro recovery; preserve Draft |

The table preserves the accepted four-state and root/parent rules. A root Profile must have a clearly identified, reachable “返回首页” action using the lawful Tab API; an adequate existing header/action can satisfy this without a duplicate Home button. Additional wording and visual placement remain suggestions. Existing six section edits satisfy the Edit affordance; this revision does not require a seventh duplicate Edit entry.

## P02 — Six-group Edit, ordinary resume, root and deep branches

### Structured difference

```text
SOURCE_CONTRACT:
  docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md; docs/architecture/PROFILE_UI_CONTRACT.md (legacy Phase 3B interaction baseline)
SOURCE_SECTION:
  V2 §§6, 7, 8, 11; legacy §8; stack-design draft §§3, 4, 5, 9
EXISTING_RULE:
  Profile Edit reuses a matching Assessment ancestor with navigateBack(delta); if no matching ancestor exists, it uses redirectTo(target). Intro/Assessment resume keeps its current root and parent branches. Six groups remain basic, health, adl, cognitive, preference, budget. Back does not validate or clear Draft.
APPROVED_NEW_PRODUCT_BEHAVIOR:
  The user may edit from the root Profile. A path that cannot fit the remaining page-stack capacity must offer a confirmed local reset; cancel preserves the page and legal Draft.
PROPOSED_SUCCESSOR_TEXT:
  Keep all six group IDs, route targets, step order, per-step validation, and Draft semantics. First search for a legal matching group ancestor. If one exists and the remaining path fits, return to it once with navigateBack(delta), preserving the source stack; a route-name match alone is insufficient if the resulting peak exceeds the platform page limit. If no legal ancestor exists and capacity is safe, the proposed normative branch uses one navigateTo(target) from Profile so Profile remains the actual first parent; it is not an unresolved choice between push and redirect. Continue through the remaining groups and Budget using the existing validations. The first edited group’s system Back therefore returns to the real Profile; later Back follows pages actually visited, not an unvisited earlier group. Only after Budget group validation, full Assessment completion validation, and successful local persistence may Budget make one reLaunch to Profile. On return, Profile refreshes from the latest Draft and repeated edits must pop/reuse ancestors or complete the phase reset rather than accumulating duplicate Profile/step pages.

  For capacity calculation, use the actual stack and API: with legal ancestor depth `a` and target group `k`, `a + 6 - k <= 10`; with no ancestor and current Profile depth `p`, the proposed push requires `p + 1 + 6 - k <= 10`. Recompute at each entry/forward boundary. If unsafe, keep the page and Draft on cancel. On confirmation, perform one local reset to the real Intro page; show Intro normally and require a second explicit user action before entering a target step. Do not automatically push a page from Intro on load or chain multiple navigation APIs. Preserve the ordinary root-Intro redirect and its existing Android/system-back limitation unless a separately approved successor changes that branch.

  The existing six Edit actions provide the modification affordance; no seventh duplicate whole-assessment Edit action is required. In incomplete/error use the existing recovery action, not a fabricated ready Edit flow. Existing full-Draft Continue-to-Basic and first-missing-group convenience recovery stay unchanged. Modification is not Restart and never clears or recreates answers.

  The covered capacity-reset branch obeys Interaction I03 R02/R03: confirmation opens only Intro; intent contains only one of basic/health/adl/cognitive/preference/budget and a necessary Assessment/Profile source type, never answers or business context. Intro reads/validates it for its current instance and displays the lawful target. A second explicit action revalidates the target under existing Draft recovery/capacity rules before one navigation; no onLoad push or silent target substitution. The request occupies the intent while pending, success consumes/clears it without replay on return, and failure visibly releases the request for an explicit retry only if the Intro/target/context remain valid. Cancel, exit or invalidation prevents further navigation or late restoration; no Draft/currentStep/schema change. A valid reset naturally closes the old source and transfers ownership to the new Intro; this is not permission for automatic step navigation. Intent parameter naming/local representation may be settled in implementation, but the lifecycle rules are defined here and in I03.
UNCHANGED_INVARIANTS:
  Do not change Assessment questions, answer codes, conditions, schema, Draft store, validation, persistence, or completion semantics. Back never triggers Next validation and does not clear Draft. No hidden sequential page pushes, fake ancestors, health answers in query parameters, automatic resume writes, or global navigation framework. Stage reset is not Restart and does not clear a legal Draft.
BREAKING_NAVIGATION_SEMANTICS:
  The current no-ancestor Profile `redirectTo(step)` proposal would change to a safe `navigateTo(step)` so a real Profile parent survives. A successful Budget transition changes from `navigateTo(Profile)` to `reLaunch(Profile)`, closing all old pages. Capacity confirmation may discard the surrounding Home/Intro/older browsing page stack while preserving Draft. Ordinary resume/system Back can still reach only actual ancestors; it cannot return to a skipped step.
REQUIRED_TESTS:
  Retain accepted Budget/derivation tests. Cover six safe no-ancestor edits using navigateTo with a real Profile parent, legal-ancestor delta/capacity, repeat editing without duplicates, Home reachability without requiring duplicate controls, and unchanged full-Draft/first-missing recovery. Test intent whitelist/source validation, Intro-only reset, explicit second action, occupied request, success consumption/no replay, visible failure and valid explicit retry, cancellation/exit/invalidation/no late restoration. Test I03 R03 late/repeated confirmations after source/target/navigation-context changes, cancellation zero navigation and at most one lawful API without Draft clear. Distinguish covered phase entry from deferred independent business entry; Android remains separate manual evidence.
```

### Branch status; do not collapse these into one promise

| Entry branch | Existing behavior / expected actual Back target | Successor status |
|---|---|---|
| Ordinary Home start | Home → Intro → Basic → remaining groups. Standard system Back pops visited parents. | Preserve; after successful Budget save, D reLaunches Profile root. |
| Home resume to first missing group | Current parent stack is Home → Intro → selected group; Back returns to Intro, not to a skipped group. | Preserve the existing rule; full-Draft Continue still Basic. Do not label skipped steps as system-Back targets. |
| Ordinary independent root Intro | Existing redirect/root fallback behavior remains; system Back may have no Assessment parent while the page button follows its own fallback. | Preserve the known platform/entry divergence; do not claim gesture parity. |
| Profile with a safe existing group ancestor | Reuse a legal ancestor via navigateBack(delta), if capacity calculation passes. | Proposed explicit legal-ancestor and peak check. |
| Profile without a group ancestor, safe capacity | Current V2 rule redirects; the revised proposed rule uses navigateTo(target), preserving a true Profile parent. | This branch is signed in scope A; APPROVED_PENDING_IMPLEMENTATION / RUNTIME_NOT_ACTIVE. |
| Deep/unsafe Assessment entry | Current implementation lacks the D capacity reset. | Covered phase scope: valid confirmation → Intro only → second explicit operation, with defined R02/R03 lifecycle and unchanged recovery. Parameter naming is implementation work. |

The formulas are design inputs, not a claim that every live path was runtime-tested. The nominal Mini Program stack ceiling used by this analysis is 10, based on the project typings and Interaction V2 §22 evidence; it is not a new product constant or a guarantee of device success. Implementation must use the actual supported platform capacity and actual stack at each action boundary, and retain visible navigation-failure recovery. This draft does not change `currentStep` into a resume target: Assessment V2 §9.1 retains its progress-metadata meaning. The first-missing route is the current Intro helper behavior proposed for explicit interaction mapping here, not a new Draft field or silent data-contract rewrite.

### P02 unresolved business-chain entry: `TBD-BIZ-ENTRY`

```text
SOURCE_CONTRACT:
  docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md; output/b01-phase-boundary-stack-design-v1/B01-PHASE-BOUNDARY-STACK-DESIGN.md (DESIGN_ONLY)
SOURCE_SECTION:
  V2 §§6, 7, 11; stack-design §§5, 6, 9
EXISTING_RULE:
  Profile/Result/Institution source context and appointment handoff follow their existing route/state contracts. Profile and Result do not own institution revision or appointment submission state.
APPROVED_NEW_PRODUCT_BEHAVIOR:
  Capacity shortage requires an explicit confirmation before local reset; cancellation preserves the current page and legal Draft.
PROPOSED_SUCCESSOR_TEXT:
  R01 separates covered scope A (Assessment/Profile phase entry, six-group edit/recovery and completion, including deep sources that actually re-enter Assessment) from deferred scope B (independent deep Profile/Result/Institution/Appointment continuation without Assessment re-entry). B does not authorize speculative reLaunch, context migration or loss of lawful institutionId/revision/sourceContext/handoff. When B lacks capacity, retain the current page and lawful context, show visible failure/capacity feedback and existing lawful return/recovery options; do not perform a known-unsafe push, unauthorized reset, invented recovery protocol or multiple-API fallback. Confirmation alone cannot authorize an undefined reset recipe. Recommend scoped, staged approval of A; B is a separate decision and may need its own successor. B does not block signed A scope and separately authorized A implementation, but B remains uncovered/NOT_VERIFIED and cannot be labeled PASS or globally solved. This revision itself grants no activation or implementation.
UNCHANGED_INVARIANTS:
  Preserve institutionId/recordRevision and sourceContext semantics, appointment request/accepted receipt semantics, and existing navigation for business routes. Do not submit a real appointment or evaluation as part of design validation. No false guarantee that D constrains all later business-chain depth.
BREAKING_NAVIGATION_SEMANTICS:
  B reset/migration is not authorized by this successor. Preserve its lawful identity, context and receipt semantics; visible capacity failure is not permission to discard the business stack. Any later destructive reset/continuation change requires a separate decision.
REQUIRED_TESTS:
  Distinguish deep Profile edit entering Assessment (A) from independent business continuation (B). For B shortage prove retained institutionId/revision/sourceContext/handoff, no unauthorized reset/migration/multi-API or known-unsafe continuation, and visible feedback/available lawful recovery. Do not mark B as PASS. Test a later B reset recipe only after its separate approval; A can be accepted independently within its signed scope.
```

The reason is concrete: the design’s ordinary Profile-root chain is not a bound on an independently entered business chain. For example, Profile depth 5 plus the ordinary directory tail is 11 pages (`p + 6`); a direct no-List consultation expansion from Profile depth 1 can already reach depth 10. No reset behavior for these cases is asserted by this Profile draft.

## P03 — Latest Draft snapshot and Recommendation handoff

### Structured difference

```text
SOURCE_CONTRACT:
  docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md
SOURCE_SECTION:
  §§3, 6, 7, 8, 10 (decisions 1 and 4), 11; stack-design §§3, 4, 6, 9
EXISTING_RULE:
  The V2 application entry reads one current legal V2 Draft, calls the existing V2 Preview adapter, returns a versioned snapshot, does not write storage, and does not create a Preview store. Every Profile onShow refreshes and atomically replaces its in-memory snapshot. Profile Result CTA opens the existing Result route; Result adjustment returns to a real Profile ancestor when available, otherwise uses the existing Profile fallback.
APPROVED_NEW_PRODUCT_BEHAVIOR:
  A successful Budget save reLaunches a new Profile root; the old Profile/Result and their in-memory previews do not cross the phase reset.
PROPOSED_SUCCESSOR_TEXT:
  After `reLaunch(Profile)`, the new Profile instance must call the current version-dispatched Profile application path against the latest legal Draft and construct its normal versioned application snapshot. Do not pass the old Profile Preview, Recommendation result, or stale readiness through route parameters or memory copied across the reset. `onShow` remains the refresh boundary and replaces the prior in-memory snapshot atomically; loading/incomplete/error never displays stale ready data or a partial Profile. The Result action remains one `navigateTo` to the existing Result route. When opened, Result follows the existing Recommendation application/algorithm and readiness semantics from the current Draft; Profile must not preview, cache, rank, filter, or write back Recommendation output. Returning from Result must reuse/pop the existing Profile where a legal parent exists. After another successful Budget completion, the user may reopen Result from the new Profile, which recomputes through the existing Recommendation path.
UNCHANGED_INVARIANTS:
  Preserve `/pages/assessment/profile`, V1 historical versus live V2 dispatch, `buildProfileApplicationSnapshotV2()` semantics, `deriveElderProfilePreviewV2()` as the only V2 preview derivation, Recommendation V2 safety/eligibility/exactness/priority/rank and blocked behavior, and no Preview persistence. No new ElderProfile identity, Assessment schema, Profile Store, Recommendation cache, or Recommendation-to-Institution shortcut.
BREAKING_NAVIGATION_SEMANTICS:
  reLaunch intentionally discards old in-memory Profile/Result snapshots and clears their ancestors. Result is not auto-opened by the transition; it remains an explicit Profile action. Business-chain sourceContext handling after a deep reset remains `TBD-BIZ-ENTRY` above.
REQUIRED_TESTS:
  Use distinct Draft revisions/values to prove the post-reLaunch Profile reflects the latest successful Draft, not a prior snapshot. Verify no Profile/Preview/Recommendation state is persisted or forwarded, each onShow atomically refreshes, incomplete/error contain no stale ready data, and Result is a single navigateTo that invokes the unchanged Recommendation path. Test Result→same Profile parent, edit→Budget success→new root Profile→explicit Result, without duplicate Profile/Result pages. Recommendation contract/domain tests remain separate from navigation tests.
```

## P04 — Required behavior and optional family-facing copy

### Structured difference

```text
SOURCE_CONTRACT:
  docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md; docs/architecture/PROFILE_UI_CONTRACT.md (legacy)
SOURCE_SECTION:
  V2 §§6, 7, 10 (decisions 1 and 4), 11; legacy §§6, 8; stack-design §§3–5, 9
EXISTING_RULE:
  State recovery and navigation failure require visible, truthful feedback. Existing Profile back says the prior page is used; the root fallback target is currently Budget. Edit labels correspond to the six real Assessment groups. Legacy §8 describes the Phase 3B interaction baseline, not a new D approval.
APPROVED_NEW_PRODUCT_BEHAVIOR:
  Budget completion starts a new Profile root; the root offers Home and Edit, and users are told system Back may leave the mini program. Unsafe stack entry requires an explain/confirm decision; cancel preserves page and legal Draft.
PROPOSED_SUCCESSOR_TEXT:
  **Normative behavior:** At a true Profile root, label the header fallback/action as Home and implement it as one Home `switchTab`. At a Profile with a parent, communicate/perform return to the actual parent. State that Android system Back at a root may leave the mini program and is not the in-page Home action. Explain before any unsafe-capacity reset that confirmation will leave the current browsing/Assessment page stack while retaining the legal Draft; cancel remains on the same page with no navigation or Draft mutation. Only describe an Assessment as saved after the local persistence result succeeds. Use separate messages for save failure, capacity confirmation, navigation failure, and root behavior; no copy may claim universal Android gesture parity.

  **Optional family-facing copy for Owner review only:** Budget completion: “本次评估已保存。您可以在需求画像中修改，也可以返回首页。” System Back helper: “您已完成评估。使用系统返回可能离开小程序；返回首页请点‘返回首页’。” Capacity prompt: “继续评估需要离开当前浏览路径；已成功保存的草稿会保留。是否返回评估说明后继续？” These are suggestions, not frozen strings. The Intro must still require a second deliberate action if that branch is approved. Suggested action labels are “返回首页”, “修改评估”, and “查看推荐”; “继续查看推荐” is an optional wording only when it accurately describes an available action, not a promise to restore an old Result instance.
UNCHANGED_INVARIANTS:
  Truthful save state; no full Draft/Profile/health answers in logs or copy; no implication of formal identity, recommendation readiness, or successful persistence before the corresponding result. Existing accessibility and component event contracts remain owned by the related interaction successor.
BREAKING_NAVIGATION_SEMANTICS:
  Existing “return to previous assessment step” language is no longer accurate at a post-Budget Profile root. Root Home copy must not imply system Back equals Home; deep-entry labels must not promise a skipped-step parent.
REQUIRED_TESTS:
  Review all four states and root/parent branches against rendered action labels; verify copy matches the API and success/failure result. Test capacity cancel and confirmation copy against actual API count and Draft preservation. Owner Android acceptance must separately confirm the root gesture wording is accurate on the target device; no Node test can prove it.
```

## Explicitly unchanged or outside this successor

- This Profile integration draft is paired with, and cannot replace, the Assessment Interaction successor needed for Budget completion/reLaunch and capacity-entry semantics.
- The source V2 Profile document retains its original frozen phase declarations, including `PROFILE_V2_APPLICATION_CONTRACT = FROZEN_PHASE_V1_1_F1` and `PROFILE_V2_UI_IMPLEMENTATION = NOT_STARTED`. These are historical declarations in that frozen document, not a determination that today's Profile runtime is unimplemented. This signed successor preserves those declarations; its independent formal ID identifies approved text, not an activated runtime version.
- The legacy Phase 3B Profile contract remains a historical source. This signed successor does not edit or revoke it; the scoped coverage table above identifies the navigation rows superseded for future scope A implementation.
- History remains unimplemented as previously scoped. No new History capability, route, data access, or persistence behavior is proposed.
- Do not claim all routes, Android gestures, or later Institution/Appointment chains are covered by the Assessment-root arithmetic.

## 后续授权与证据边界

两篇文本的 Scope A 已由本轮 Owner 签署关闭，不再把正式 ID/版本或 R01–R04 文本批准列为待办。参数命名、局部意图持有/清理、有效来源绑定、对应 UI/可选措辞和实施 Gate 安排，留给单独授权的实施设计；不得改变已签署行为或引入新全局状态框架。

本轮仅冻结文本及必要治理登记：没有 Assessment/Draft/Recommendation、app.json、S2B、Backend 或发布能力改动，也不激活 runtime。后续实施须按 Interaction V2 §11/§24/§25 与本版矩阵完成适用测试和独立 QA，分别记录自动化、DevTools、Android Owner 真机证据。静态栈 8/7/6/10 推导不是 runtime PASS，更不是全局业务深链安全证明。

`STATUS = APPROVED_PENDING_IMPLEMENTATION`；`B01_IMPLEMENTATION = NOT_STARTED`；`RUNTIME_ACTIVATION = FALSE`；`PRODUCTION_RELEASE_READY = FALSE`。
