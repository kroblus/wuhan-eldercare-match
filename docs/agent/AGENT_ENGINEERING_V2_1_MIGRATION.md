# Agent Engineering V2.1 — Quota-Balanced Migration

目标：在 V2 的“薄 AGENTS + 精简 Agent + 按需 Skill + Contract routing”基础上，进一步减少重复上下文、重复 Agent 与重复测试，不改变 frozen 业务语义。

## Replace

- `AGENTS.md`
- `.codex/agents/wechat_frontend.toml`
- `.codex/agents/backend_domain.toml`
- `.codex/agents/matching_engine.toml`
- `.codex/agents/qa_reviewer.toml`

## Add

- `.agents/skills/wechat-runtime-compat/SKILL.md`
- `.agents/skills/wechat-interaction/SKILL.md`
- `.agents/skills/recommendation-v2/SKILL.md`
- `docs/architecture/CONTRACT_INDEX.md`
- `docs/agent/MODEL_STRATEGIES.md`

## Archive / remove from active path

- `prompts/PROJECT_BOOTSTRAP_PROMPT.md`
- `prompts/SOL_FIRST_PROMPT.md`
- `docs/architecture/BOOTSTRAP.md`
- `00_START_HERE_完整创建流程.md`（归档，或另写当前人类 onboarding）
- `optional/chief_orchestrator.toml`（建议归档/删除；主会话已是总控）

建议目录：

```text
docs/archive/bootstrap/
  PROJECT_BOOTSTRAP_PROMPT_2026-08-26.md
  SOL_FIRST_PROMPT_2026-08-26.md
  BOOTSTRAP_DECISION_2026-08-26.md

docs/archive/onboarding/
  00_START_HERE_V1.md
```

## Keep unchanged

- `.codex/config.toml`（第一阶段继续 Sol baseline）
- `docs/product/README.md` 与当前 V1.2 产品 PDF
- 所有 frozen Assessment / ElderProfile / Recommendation / Institution Contract 正文
- `WECHAT_INTERACTION_CONTRACT.md`
- `Luna Max 微信小程序兼容性长期约束.md`
- `MOCK_DATA_POLICY.md`
- `FRONTEND_STRUCTURE.md`
- `package.json` 与现有 runtime scripts

## V2.1 quota changes vs V2

- `CONTRACT_INDEX.md` 从“每任务必读”改为“跨域/版本不明时才读”。
- 主会话新增 `delegate before deep-read`，避免主线程与 Luna 重复全文读取大型 Contract。
- 四个 Agent 不再默认打开 Index。
- 三个 Skill 只保留触发条件、Source of Truth、关键 Gate，删除重复操作手册。
- QA 不因小型可逆改动默认介入，也不在相关 Gate 通过后继续扩大测试。
- Task prompt 不再要求每次显式读取 CONTRACT_INDEX。

本迁移只改 Agent engineering 文本，不应修改 production code、frozen Contract 或业务数据。
