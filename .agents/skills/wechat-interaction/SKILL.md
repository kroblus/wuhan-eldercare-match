---
name: wechat-interaction
description: Use for Mini Program actions, validation, navigation, disabled/loading behavior, or Assessment interaction changes.
---

# WeChat interaction

For ordinary current interaction tasks, read `docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md` first.

Add only the branch relevant to the task:

- B01-D Scope A (six physical Assessment steps and actual-parent Back, Budget completion to a Profile root, edit/recovery navigation, or current acceptance/closeout): read `docs/architecture/WECHAT_INTERACTION_B01_PHASE_BOUNDARY_D_SUCCESSOR_V1.md` for the signed local boundary and `output/b01-phase-boundary-d-scope-a-implementation-v1/FINAL_CLOSEOUT.md` for the latest dated closeout. Current implementation structure is in `docs/architecture/ROUTES.md` and `docs/architecture/FRONTEND_STRUCTURE.md`; inspect the affected source only as needed.
- Profile UI V2: read `docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md`; when its navigation intersects B01-D Scope A, also read `docs/architecture/PROFILE_UI_V2_B01_PHASE_BOUNDARY_D_INTEGRATION_CONTRACT_V1.md` and the relevant B01 branch above. Apply only the signed local coverage; retain unchanged Profile application/version constraints.
- Explicit historical V1 review: read the original `docs/architecture/WECHAT_INTERACTION_CONTRACT.md`. It is SUPERSEDED historical V1 and remains immutable. An old document's V1 citation does not restore its current authority; current general interaction behavior routes to V2, with the applicable signed B01/Profile local boundary when needed.

The 2026-10-13 closeout records Scope A CLOSED_WITH_RISKS after implementation, while Scope B remains DEFERRED_NOT_VERIFIED, SUCCESSOR_ACTIVATED=FALSE and PRODUCTION_RELEASE_READY=FALSE. Signed NOT_STARTED / APPROVED_PENDING_IMPLEMENTATION / runtime_activation=false fields retain their signing-time/governance meaning. Contract constraints, current source implementation, closeout evidence, successor activation and production release are separate; none implies another. Closeout is audit evidence, not a Frozen Contract.

Non-B01 tasks do not load B01 reports. Do not recursively load historical references; CONTRACT_INDEX remains fallback-only, not a prerequisite for using this Skill.

Derive behavior from that Contract; do not create a second interaction spec. Preserve its single-action chain, validation timing, Draft/error/navigation rules. If the change also touches class syntax, `wx.*`, generated JS or shared event propagation, additionally use `wechat-runtime-compat`.

Run only the interaction runtime covering the changed flow plus any directly dependent page/domain check. Broaden only for shared code, failure, or an explicit Contract gate. Keep automated / DevTools / ADB / manual Android evidence distinct.
