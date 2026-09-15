# Model Strategy — Runtime Selected

## Runtime source

Main-session model and reasoning are selected by the current session/runtime. Subagent defaults come from the current
`.codex/config.toml`. Agent Engineering documents do not duplicate or freeze those runtime values.

## Selection principles

1. Match model/reasoning selection to task complexity, risk, latency and available quota.
2. Use specialist ownership to reduce duplicated context; a model name does not replace domain routing.
3. Do not silently change repository runtime defaults as part of an unrelated feature or documentation task.
4. When comparing model configurations, keep the code baseline and task scope stable and record the runtime selection with the result.

## Quota rules

1. **Delegate before deep-read**: if a bounded subagent owns the task, the main thread routes first and lets that agent read the large Contract. Main deep-reads only for cross-domain design/conflict/integration.
2. Do not call QA for every tiny reversible edit. Use independent QA for frozen-domain behavior, cross-boundary work, shared interaction/runtime infrastructure, or explicit acceptance requests.
3. Do not default-load `CONTRACT_INDEX.md`; it is a fallback router.
4. Do not load multiple Skills unless their trigger surfaces actually overlap.
5. Stop expanding tests after the relevant Gate passes unless shared code, a failure, or the Contract justifies more.
