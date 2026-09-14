# Agent Engineering V2.1 — Quota-Balanced

目标：保持 V2 的 Contract/Skill 路由质量，同时让日常额度尽可能接近或低于旧版。

核心变化：

1. `CONTRACT_INDEX.md` 只做 fallback router，不再每任务必读。
2. 主线程采用 `delegate before deep-read`，避免主线程与专项 Agent 重复读取大型 Contract。
3. Skill 压缩，只保留触发、Source of Truth 和关键 Gate。
4. QA 按风险介入；小型可逆改动不默认启动独立 QA。
5. 默认模型继续 Sol MAX + Luna MAX；Astra 只做可选 pilot/escalation。

应用时优先阅读 `docs/agent/AGENT_ENGINEERING_V2_1_MIGRATION.md`。
