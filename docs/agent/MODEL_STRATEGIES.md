# Model Strategy — Quota Balanced

## Default

Keep the project default on `gpt-5.6-sol` + `max`; keep bounded subagents on `gpt-5.6-luna` + `max`.

Goal: get the context-routing gains of Agent Engineering V2.1 without changing the model-cost variable at the same time.

## Quota rules

1. **Delegate before deep-read**: if a bounded subagent owns the task, the main thread routes first and lets that agent read the large Contract. Main deep-reads only for cross-domain design/conflict/integration.
2. Do not call QA for every tiny reversible edit. Use independent QA for frozen-domain behavior, cross-boundary work, shared interaction/runtime infrastructure, or explicit acceptance requests.
3. Do not default-load `CONTRACT_INDEX.md`; it is a fallback router.
4. Do not load multiple Skills unless their trigger surfaces actually overlap.
5. Stop expanding tests after the relevant Gate passes unless shared code, a failure, or the Contract justifies more.

## Astra pilot

Use Astra as an escalation/pilot model for difficult cross-domain architecture, Contract design, hard debugging, or final high-stakes audit rather than making it the default immediately.

For A/B, keep the same commit and subagent setup; compare irrelevant-document reads, agent count, test count, retries, unrelated diff, first-pass success and client-visible quota use.
