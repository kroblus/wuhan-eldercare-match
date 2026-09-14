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
| Mock/synthetic data | `MOCK_DATA_POLICY.md` | affected Institution/Recommendation Contract |
| Frontend structure/ownership | `FRONTEND_STRUCTURE.md` | affected business Contract |
| Test command | `package.json` + affected Contract gate | relevant Skill |

Defaults:
- Proposal / Freeze Record / archived Product / old Bootstrap docs are historical, not active truth.
- Do not recursively load every document referenced by a Contract; expand only when the current change depends on that semantic.
- If two active Contracts truly conflict, report exact locations; do not guess by filename/date.
