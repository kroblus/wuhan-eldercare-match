# Agent Engineering V2.1 — Quota-Balanced

目标：保持 V2 的 Contract/Skill 路由质量，同时让日常额度尽可能接近或低于旧版。

长期原则：

1. `CONTRACT_INDEX.md` 只做 fallback router，不再每任务必读。
2. 主线程采用 `delegate before deep-read`，避免主线程与专项 Agent 重复读取大型 Contract。
3. Skill 按任务触发，只加载直接相关的 Source of Truth 和关键 Gate。
4. QA 按风险介入；小型可逆改动不默认启动独立 QA。
5. 有明确专项所有者时使用 specialist delegation；跨域架构、冲突判断、集成与最终验收仍由主会话负责。

Main session 的模型与 reasoning 属于当前 session、配置和 runtime selection，不是 Agent Engineering
架构常量。Subagent runtime defaults 以当前 `.codex/config.toml` 为准，本文不重复写死模型名称。

## Scoped Ownership Overrides

V2.1 允许项目负责人针对明确阶段或任务设置 scoped ownership override；root `AGENTS.md` 是 ownership rule 的主要治理真相。当前 Warm Swiss UI 重构阶段采用 `UI_IMPLEMENTATION_OWNER = MAIN_SESSION_ONLY`，在该 scope 内优先于普通 specialist ownership 和 delegate-before-deep-read，由 Main session 自己读取必要视觉基线与相关 Contract 并完成 UI implementation。

此例外只覆盖 Warm Swiss UI scope，不删除 `wechat_frontend`、不禁用其他 specialist、不关闭 Agent Engineering，不修改 Frozen Contract、Skills、MCP 或 risk-based QA 原则。scope 外保持普通专项 ownership；阶段结束后恢复普通 V2.1 specialist routing。

Main session model 与 reasoning 仍由当前 runtime/session 选择，此 ownership override 不记录或冻结模型名称，也不修改 `.codex/config.toml` 的 subagent defaults。

V2.1 的一次性迁移记录已归档，仅在审查历史迁移时显式读取，不是日常任务前置材料。
