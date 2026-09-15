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

V2.1 的一次性迁移记录已归档，仅在审查历史迁移时显式读取，不是日常任务前置材料。
