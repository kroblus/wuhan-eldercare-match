# VisitEvaluation Non-Sensitive UI Contract V1 — V1.2 Successor Slice

Status: `FROZEN_NON_SENSITIVE_UI_SLICE`

Frozen: `2026-09-24`

Owner decision: the V1.2 VisitEvaluation UI/draft and TEST_ONLY interaction slice may proceed before production Visit owner-read and evaluation persistence. This is the future versioned UI successor required by C1 §15; it does not amend C1 or C3.

## 1. Authority and scope

- Current V1.2 Product Source (routed by `docs/product/README.md`) owns the listed evaluation questions and ranges.
- `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` §15 still owns every **real** VisitEvaluation creation prerequisite: authenticated authorized user, real server-generated `visitId`, exact Institution identity bound to that Visit, and authoritative `completed` status. Page state, route data and fixtures never satisfy it.
- `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` §15 keeps production evaluation locked while those prerequisites and an authorized evaluation write boundary are absent.
- This successor freezes only page-local form presentation, draft bounds, TEST_ONLY context/submit behavior, and production fail-closed behavior. It defines no production wire schema, stable result code, Evaluation identity policy, owner-read adapter, or Backend persistence.

## 2. Page and identity boundary

- Route: `/pages/visit/evaluation`, receiving only `visitId`. No phone, contact information, full ElderProfile, health answers, session evidence, or provider credentials may enter route parameters.
- An authorized production evaluation context must eventually resolve `visitId` to its Visit, exact `institutionId` and `institutionRecordRevision`, trusted owner, and authoritative completed status before production editing/submission is enabled. This slice does **not** implement that resolver.
- TEST_ONLY fixtures may supply synthetic context and identity for deterministic page verification. They are never production Visit or completion truth and must not enter the production dependency graph.
- With no authorized production context/provider, the production page shows an honest unavailable state. It must not silently select a fixture or claim a submission succeeded.

## 3. Non-sensitive form presentation and local bounds

The form presents the current Product Source's user-observation fields. All unanswered controls may remain empty in this slice; this does not decide future submission requiredness or partial-evaluation policy.

| Group | Page-local inputs |
|---|---|
| Overall | Overall impression 1–5; future consideration: willing to consider, continue comparing, or not considering |
| Environment and living | Hygiene, room comfort, age-friendly facilities, common space, living atmosphere; each selected rating 1–5 |
| Care experience | Service attitude, professional impression, communication with the elder, on-site care order; each selected rating 1–5 |
| Medical and safety | Medical support, emergency explanation, rehabilitation facilities, safety management; each selected rating 1–5 |
| Dining | Dining-room environment, meal impression, dietary-arrangement explanation, perceived fit for the elder's dietary needs; each selected rating 1–5 |
| Activities and life | Activity space, activity variety, living atmosphere, common-area use; each selected rating 1–5 |
| Fee transparency | Whether the fee explanation was clear; display the Product Source's fee topics (bed, meals, care, management, special care, deposit, other one-time fees) without inventing a score or price fact |
| Care-management observation | Whether the visitor learned about complete care records and 24-hour handover: yes/no/unconfirmed; handover topics: vital signs, exceptions, handling method, follow-up, family communication, unconfirmed |
| Tags | Liked tags and concern tags, each independently limited to three selections, drawn from care, medical, room, environment, dining, activities, transport, price, staff attitude, other |
| Supplement | Optional user comment, at most 200 characters |

The UI blocks a fourth tag within its own group and explains the limit without deleting earlier selections. A comment over 200 characters cannot enter the draft; the count remains visible. A selected rating outside 1–5 is invalid. The page does not infer any unanswered field to be required. Fee-answer encoding, topic-level responses, and handover-option exclusivity are **not** frozen as domain/wire semantics here.

## 4. Page-local application state

- `editing`: local draft may change after a TEST_ONLY context is supplied. No production write occurs.
- `submitting`: one in-flight TEST_ONLY action; rapid or repeated taps cannot create another invocation. Draft remains intact.
- `submitted`: explicit TEST_ONLY success feedback, never a claim of production persistence, Institution confirmation, or public rating.
- `submit_failed`: explicit failure feedback; every draft input remains intact and a single guarded retry may re-enter `submitting`. No automatic return/navigation.
- A separate context-loading/unavailable display may precede `editing`; it is not a Visit business state.
- Test providers and fixtures live under tests/dev tooling only. Production cannot import or fall back to them.

## 5. Data ownership and isolation

- VisitEvaluation is `USER_REPORTED_DATA`; care-management answers are `USER_REPORTED_VISIT_OBSERVATION`. A visitor's “not learned about” answer is not an Institution capability or verified fact.
- This slice writes no Institution fact/revision, InstitutionCareProcess, InstitutionVerification, Recommendation V2 input/score/rank, public average rating, comment count, or review community data.
- It creates no Visit, does not implement real evaluation persistence, owner-read, lifecycle mutation, phone authorization, or public publishing.

## 6. Verification and completion boundary

Targeted evidence covers field presence, local 1–5 bounds, each max-three tag group, 200-character limit, observation mapping, context-to-route binding, `editing → submitting → submitted / submit_failed → retry`, draft retention, duplicate-action guard, production-unavailable state, fixture isolation, WeChat runtime compatibility, and no cross-domain writes.

Passing this UI slice means only the non-sensitive form/application interaction is implemented. It does not mean a real completed Visit has been resolved, a real Evaluation has been persisted, C6 G13 passed, or real-user end-to-end evaluation is available.

## 7. Open product and production decisions

The following are deliberately **not** frozen by this slice: field requiredness and whether partial evaluations may submit; canonical persisted field keys/value schema (especially fee-detail responses); whether handover “unconfirmed” is exclusive; whether tags may appear in both groups; one-Evaluation-per-Visit uniqueness and duplicate-submit/idempotency behavior; edit/resubmit after success; authorized owner-read/completed-context provider; and production write/result semantics. A later versioned Contract and implementation gate must decide these before production submission is enabled.
