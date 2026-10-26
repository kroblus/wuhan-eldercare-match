# Contract Index — Fallback Router

**Use this file only when the task crosses domains, version ownership is unclear, or the correct Source of Truth is not obvious.** If the task already names a domain/version, read that Contract directly.

This file routes; it does not define business semantics.

| Task | Primary source | Add only if needed |
|---|---|---|
| Current product scope | `docs/product/README.md` + current V1.2 product PDF | relevant architecture Contract |
| Assessment V2 schema/validation | `ASSESSMENT_CONTRACT_V2.md` | migration Contract; interaction Contract |
| Assessment actions/navigation | `WECHAT_INTERACTION_CONTRACT_V2.md` | Assessment V2; WeChat Skills |
| B01-D Scope A navigation / current acceptance and closeout | `WECHAT_INTERACTION_CONTRACT_V2.md` + `WECHAT_INTERACTION_B01_PHASE_BOUNDARY_D_SUCCESSOR_V1.md` | [dated Scope A routing below](#b01-scope-a-current-routing-2026-10-13); affected source and relevant evidence only |
| Profile UI V2 application / edit and recovery navigation | `PROFILE_UI_V2_INTEGRATION_CONTRACT.md` | for B01-D Scope A navigation: `PROFILE_UI_V2_B01_PHASE_BOUNDARY_D_INTEGRATION_CONTRACT_V1.md` + relevant B01 routing below |
| ElderProfile V2 | `ELDER_PROFILE_CONTRACT_V2.md` | Assessment V2; Preview V2 |
| Recommendation V2 | `RECOMMENDATION_CONTRACT_V2.md` + `RECOMMENDATION_RULE_CONTRACT_V2.md` | ElderProfile/Institution only when dependency changes |
| Institution current schema/contact/address/Geo/public content | `INSTITUTION_CONTRACT_V1_2_1.md` | V1.2/V1.1 only for explicit compatibility/projection paths |
| Institution list/detail UI/application | relevant List/Detail integration Contract + V1.2.1 | current PRD page; frontend structure; WeChat Skills |
| Consultant / public contact / assignment / permission / privacy | `CONSULTANT_PERMISSION_CONTRACT_V1.md` | Institution V1.2.1 or Recommendation V2 only for an affected isolation boundary |
| Global Consultant selection / contextless public application snapshot | `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md` | `CONSULTANT_PERMISSION_CONTRACT_V1.md`; B2 handoff/runtime only for implementation conformance |
| AI consultation / knowledge allowlist / safety / human handoff / application boundary | `AI_CONSULTATION_CONTRACT_V1.md` | current Product Source AI pages; relevant Profile/Recommendation/Institution/Consultant Contract only for an affected read/isolation boundary |
| Appointment submission / InstitutionVisit identity, lifecycle, permission, phone, persistence boundary | `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` | current Product Source Appointment/Visit pages; Institution/Consultant Contract only for canonical identity/contact isolation |
| Authenticated ElderRecord identity / sole responsible C5 user / Appointment Elder reference and new-Institution eligibility | `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1.md` | C1 Appointment reference; C5 principal; Assessment/ElderProfile identity separation; Institution current revision Contract |
| Authenticated ElderRecord production foundation implementation scope and gates | `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_IMPLEMENTATION_HANDOFF_V1.md` | Frozen Elder identity/binding Contract; C5 and Appointment reference boundaries |
| C3 canonical Elder/Institution reference and transactional submission integration implementation scope and gates | `C3_CANONICAL_REFERENCE_ELDER_BINDING_TRANSACTIONAL_INTEGRATION_IMPLEMENTATION_HANDOFF_V1.md` | C1/C3/C5/C6 Frozen boundaries; Elder identity/binding Contract and Handoff; Institution appointment eligibility |
| Appointment Create / C3 client integration implementation scope and gates | `APPOINTMENT_CREATE_C3_CLIENT_INTEGRATION_IMPLEMENTATION_HANDOFF_V1.md` | Frozen C1/C3/C5/C6 and Elder boundaries; current Product Source Appointment flow; WeChat interaction Contract |
| InstitutionVisit production lifecycle mutation authority / Visit scope / operational evidence and audit | `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md` | C1 lifecycle/status rules; C3/C5 principal boundary; Consultant permission/assignment; current Product Source Appointment/Visit/Evaluation pages |
| Authenticated Visit submission / auth evidence / atomic create-or-replay / durable idempotency boundary | `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` | `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`; C2 Application ports; Current Product Source login/phone/Appointment pages |
| Authenticated “我的预约” collection owner-read / minimal Visit list / historical Institution display | `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md` | C1 owner/status/history; C3/C5 session; authenticated Evaluation context for final eligibility |
| My Appointments “联系顾问”卡片动作 / platform global Consultant authority / V1 status visibility | `MY_APPOINTMENTS_CONTACT_CONSULTANT_ACTION_CONTRACT_V1.md` | Global Consultant public snapshot; Consultant permission; owner-read Visit status; WeChat interaction Contract |
| VisitEvaluation non-sensitive UI / local draft / TEST_ONLY application states | `VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md` | Current Product Source VisitEvaluation pages; `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` §15 for real creation prerequisites |
| Authenticated single-Visit owner-read / production Evaluation context | `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md` | C1 §7/§10/§15, C3 §4.3 and C5 session boundary only as needed |
| VisitEvaluation production write / authorization / cardinality / idempotency | `VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md` | Current Product Source Evaluation questions; C1 §15, non-sensitive UI and authenticated context Contracts |
| Post-A1 V1.2-B1 phase status and handoff | `V1_2_B1_PHASE_HANDOFF.md` | `CONSULTANT_PERMISSION_CONTRACT_V1.md` |
| V1.2-B2.1 phase status and implementation handoff | `V1_2_B2_1_IMPLEMENTATION_HANDOFF.md` | `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`; `V1_2_B2_IMPLEMENTATION_HANDOFF.md` |
| V1.2-B3 Consultant UI phase status and implementation handoff | `V1_2_B3_IMPLEMENTATION_HANDOFF.md` | `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`; `WECHAT_INTERACTION_CONTRACT_V2.md`; current Product Source Consultant page |
| V1.2-B4 AI Contract Freeze phase definition and handoff | `V1_2_B4_PHASE_HANDOFF.md` | `AI_CONSULTATION_CONTRACT_V1.md`; current Product Source AI pages |
| V1.2-B5 AI Domain/Application Foundation phase definition and implementation handoff | `V1_2_B5_IMPLEMENTATION_HANDOFF.md` | `AI_CONSULTATION_CONTRACT_V1.md`; `FRONTEND_STRUCTURE.md`; `MOCK_DATA_POLICY.md` |
| Generated JavaScript / class compatibility | `WECHAT_RUNTIME_COMPATIBILITY_POLICY.md` | interaction Contract only when Action/navigation behavior is affected |
| Mock/synthetic data | `MOCK_DATA_POLICY.md` | affected Institution/Recommendation Contract |
| Frontend structure/ownership | `FRONTEND_STRUCTURE.md` | affected business Contract |
| Documentation lifecycle/governance | `README.md` + `DOC_REGISTRY.json` | archived evidence only when explicitly needed |
| Test command | `package.json` + affected Contract gate | relevant Skill |

## Interaction version routing

`WECHAT_INTERACTION_CONTRACT.md` is SUPERSEDED historical V1; its original text remains immutable under Interaction V2 §12.5. For current general interaction tasks, follow [Interaction V2](WECHAT_INTERACTION_CONTRACT_V2.md). Old architecture documents' V1 citations do not restore V1 as current authority. Explicit historical V1 review may still read [the original V1](WECHAT_INTERACTION_CONTRACT.md).

B01-D Scope A is a signed local phase under the current V2 framework; consult its explicit scoped coverage when relevant, retaining unchanged V2 rules. Profile UI V2 local constraints also require the applicable Profile integration Contract. These are version/scope branches, not parallel general interaction specifications.

## B01 Scope A current routing (2026-10-13)

Use this branch only for six physical Assessment steps and actual-parent Back, Budget completion to a Profile root, Profile UI V2 six edits/recovery, or Scope A acceptance/closeout. This dated index points to sources; it defines no new state specification or business semantics.

- General Frozen constraints: [Interaction V2](WECHAT_INTERACTION_CONTRACT_V2.md).
- Signed B01 local boundary and signing-time governance: [B01 Interaction Phase Boundary D](WECHAT_INTERACTION_B01_PHASE_BOUNDARY_D_SUCCESSOR_V1.md).
- Profile application constraints and signed local coverage: [Profile UI V2 integration](PROFILE_UI_V2_INTEGRATION_CONTRACT.md); [Profile B01 integration](PROFILE_UI_V2_B01_PHASE_BOUNDARY_D_INTEGRATION_CONTRACT_V1.md).
- Current implementation structure, checked against affected source: [CURRENT ROUTES](ROUTES.md); [CURRENT FRONTEND_STRUCTURE](FRONTEND_STRUCTURE.md).
- Dated Scope A completion/acceptance/closeout evidence (AUDIT, not Frozen): [FINAL_CLOSEOUT, 2026-10-13](../../output/b01-phase-boundary-d-scope-a-implementation-v1/FINAL_CLOSEOUT.md).

As recorded by that closeout: `B01_SCOPE_A_IMPLEMENTATION=COMPLETE`, `B01_ANDROID_OWNER_ACCEPTANCE=OWNER_REPORTED_PASS`, `B01_FINAL_GOVERNANCE_REVIEW=PASS_WITH_RISKS`, `B01_SCOPE_A_FINAL_CLOSEOUT=CLOSED_WITH_RISKS`. `FAST_NATIVE_TRANSITION_JANK=OPEN` and `ANDROID_FRAME_EVIDENCE=PENDING` remain risks.

Separate scope/governance/release facts remain: `B01_SCOPE_B=DEFERRED_NOT_VERIFIED`, `GLOBAL_NAVIGATION_PASS=FALSE`, `SUCCESSOR_ACTIVATED=FALSE`, `PRODUCTION_RELEASE_READY=FALSE`. Scope A closure does not prove Scope B, activate a successor or approve production release.

Signed documents and Registry retain their original `NOT_STARTED`, `APPROVED_PENDING_IMPLEMENTATION` and `runtime_activation=false` signing-time/governance fields. Current source implementation, later closeout and successor activation are distinct; do not overwrite or infer one from another. FINAL_CLOSEOUT remains dated audit evidence, not CURRENT architecture truth or a Frozen Contract. Ordinary non-B01 tasks do not load this branch or all B01 historical reports; expand only the needed evidence.

Defaults:
- Proposal / Audit / Migration / archived impact analysis / old Bootstrap docs are historical, not active truth.
- Redirect stubs preserve old paths only; they are never normative sources.
- Ordinary Consultant implementation does not load `V1_2_B1_PHASE_HANDOFF.md`; add it only for B1 phase status, A1-5 → B1 transition, or successor-boundary history.
- Do not recursively load every document referenced by a Contract; expand only when the current change depends on that semantic.
- If two active Contracts truly conflict, report exact locations; do not guess by filename/date.
