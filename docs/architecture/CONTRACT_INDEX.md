# Contract Index — Fallback Router

**Use this file only when the task crosses domains, version ownership is unclear, or the correct Source of Truth is not obvious.** If the task already names a domain/version, read that Contract directly.

This file routes; it does not define business semantics.

| Task | Primary source | Add only if needed |
|---|---|---|
| Current product scope | `docs/product/README.md` + current V1.2 product PDF | relevant architecture Contract |
| Assessment V2 schema/validation | `ASSESSMENT_CONTRACT_V2.md` | migration Contract; interaction Contract |
| Assessment actions/navigation | `WECHAT_INTERACTION_CONTRACT.md` | Assessment V2; WeChat Skills |
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
| InstitutionVisit production lifecycle mutation authority / Visit scope / operational evidence and audit | `INSTITUTION_VISIT_OPERATIONS_LIFECYCLE_CONTRACT_V1.md` | C1 lifecycle/status rules; C3/C5 principal boundary; Consultant permission/assignment; current Product Source Appointment/Visit/Evaluation pages |
| Authenticated Visit submission / auth evidence / atomic create-or-replay / durable idempotency boundary | `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` | `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`; C2 Application ports; Current Product Source login/phone/Appointment pages |
| Authenticated “我的预约” collection owner-read / minimal Visit list / historical Institution display | `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md` | C1 owner/status/history; C3/C5 session; authenticated Evaluation context for final eligibility |
| VisitEvaluation non-sensitive UI / local draft / TEST_ONLY application states | `VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md` | Current Product Source VisitEvaluation pages; `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` §15 for real creation prerequisites |
| Authenticated single-Visit owner-read / production Evaluation context | `AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md` | C1 §7/§10/§15, C3 §4.3 and C5 session boundary only as needed |
| VisitEvaluation production write / authorization / cardinality / idempotency | `VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md` | Current Product Source Evaluation questions; C1 §15, non-sensitive UI and authenticated context Contracts |
| Post-A1 V1.2-B1 phase status and handoff | `V1_2_B1_PHASE_HANDOFF.md` | `CONSULTANT_PERMISSION_CONTRACT_V1.md` |
| V1.2-B2.1 phase status and implementation handoff | `V1_2_B2_1_IMPLEMENTATION_HANDOFF.md` | `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`; `V1_2_B2_IMPLEMENTATION_HANDOFF.md` |
| V1.2-B3 Consultant UI phase status and implementation handoff | `V1_2_B3_IMPLEMENTATION_HANDOFF.md` | `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`; `WECHAT_INTERACTION_CONTRACT.md`; current Product Source Consultant page |
| V1.2-B4 AI Contract Freeze phase definition and handoff | `V1_2_B4_PHASE_HANDOFF.md` | `AI_CONSULTATION_CONTRACT_V1.md`; current Product Source AI pages |
| V1.2-B5 AI Domain/Application Foundation phase definition and implementation handoff | `V1_2_B5_IMPLEMENTATION_HANDOFF.md` | `AI_CONSULTATION_CONTRACT_V1.md`; `FRONTEND_STRUCTURE.md`; `MOCK_DATA_POLICY.md` |
| Generated JavaScript / class compatibility | `WECHAT_RUNTIME_COMPATIBILITY_POLICY.md` | interaction Contract only when Action/navigation behavior is affected |
| Mock/synthetic data | `MOCK_DATA_POLICY.md` | affected Institution/Recommendation Contract |
| Frontend structure/ownership | `FRONTEND_STRUCTURE.md` | affected business Contract |
| Documentation lifecycle/governance | `README.md` + `DOC_REGISTRY.json` | archived evidence only when explicitly needed |
| Test command | `package.json` + affected Contract gate | relevant Skill |

Defaults:
- Proposal / Audit / Migration / archived impact analysis / old Bootstrap docs are historical, not active truth.
- Redirect stubs preserve old paths only; they are never normative sources.
- Ordinary Consultant implementation does not load `V1_2_B1_PHASE_HANDOFF.md`; add it only for B1 phase status, A1-5 → B1 transition, or successor-boundary history.
- Do not recursively load every document referenced by a Contract; expand only when the current change depends on that semantic.
- If two active Contracts truly conflict, report exact locations; do not guess by filename/date.
