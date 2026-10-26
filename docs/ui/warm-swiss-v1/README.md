# Warm Swiss UI V1

Status = `FROZEN_VISUAL_BASELINE`

Current version = `V1.2 / CURRENT`

Current visual baseline = [WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf](WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf)

Document role: `VISUAL_IMPLEMENTATION_BASELINE`

该 PDF 负责 visual style、layout、typography、spacing、color、borders、visual component presentation 和 page composition；不负责 business semantics、frozen domain rules、stable codes、real institution facts 或 backend state。Frozen business Contract 永远高于视觉基线。

## 当前开发适用范围

保留冻结 PDF 作为历史视觉基线，业务 Contract 始终优先。按 [根开发约定](../../../AGENTS.md) 的个人快速迭代模式，Owner 已授权的页面布局、组件、导航和产品结构调整可以偏离历史 UI 方案；不因旧技术阶段关闭而重新要求阶段审批。此说明不修改 PDF 或任何 Frozen 业务语义。

## V1.2 Errata

- `basic.primaryCaregiver` corrected from visual multi-select/Checkbox to Frozen Contract `single_choice` / Radio.
- Helper copy clarified to describe the primary responsible caregiver：
  “选填，请选择目前承担主要照护责任的一方；如多人共同照护，请选择主要负责人。”
- No business Contract or runtime behavior changed.

Historical visual baseline = [WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_1.pdf](WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_1.pdf)

V1.1 status = `SUPERSEDED_BY_V1_2`

Reason = `primaryCaregiver control-semantic errata`。保留 V1.1 原文件用于历史追溯；除本次勘误与版本标识外，V1.2 沿用 V1.1 的内容和视觉排版。

## Synthetic visual content

设计图中的 synthetic assessment answers、mock institutions、prices、VR imagery、phone / contact placeholders 及 other demonstration data 不能被实现成真实生产事实；Mock / synthetic 内容须保持显式开发 provenance。

## Implementation ownership

Warm Swiss UI implementation = `MAIN_SESSION_ONLY`。Ownership rule 以 [root AGENTS.md](../../../AGENTS.md) 为准；模型由当前 runtime/session 选择。

## 历史实施资料

同目录 UI 1–6B 的12份 `IMPLEMENTATION_REPORT` 只用于追溯当时实现与证据，不是当前开发规则或必须重跑的验收流程；本轮原位按历史资料保留，避免破坏旧相对引用。UI 0 已通过既有入口归档。不要批量删除这些报告或视觉 PDF；当前产品调整遵循根 AGENTS.md 的授权范围与业务契约。
