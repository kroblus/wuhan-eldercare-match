---
name: recommendation-v2
description: Use for Recommendation V2 eligibility, exactness, ranking, reasons/differences, or V2 integration.
---

# Recommendation V2

For semantic changes read:
- `docs/architecture/RECOMMENDATION_CONTRACT_V2.md`
- `docs/architecture/RECOMMENDATION_RULE_CONTRACT_V2.md`

Read upstream contracts only when the changed code actually depends on them: ElderProfile V2 for readiness/evidence, Institution V1.2.1 for schema/projection, Assessment V2 for answer semantics. UI-only changes use the relevant UI/integration Contract without reloading all upstream semantics.

Never infer V2 from old V1 prompts/proposals. Preserve frozen Safety-first behavior, versioned paths, evidence-backed stable codes, and V1.2 Recommendation isolation.

Normally run `check:recommendation-v2-runtime`; add V1 regression only when shared V1 safety/projection code can be affected, and add preview/UI/upstream checks only for the changed layer or an explicit Contract gate.
