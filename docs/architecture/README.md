# Architecture Documentation

当前产品版本与产品文档入口以 `docs/product/README.md` 为准。业务语义按以下优先级解释：

```text
current Product Source
  -> applicable versioned Frozen Contract / Ruleset
  -> CURRENT architecture policy or registry
  -> explicit historical evidence when needed
```

文档状态：

- `CURRENT`：当前可维护的工程政策、路由或参考资料。
- `FROZEN`：指定版本/范围内的规范性契约；不得就地改写其业务语义。
- `HISTORICAL`：阶段、审计、决策或迁移历史，不是当前事实。
- `SUPERSEDED`：已有明确后继来源，不再作为规范依据。
- `UNCERTAIN`：需要人工决定生命周期，不能作为 Source of Truth。

`docs/architecture/` active 层只保留 CURRENT、FROZEN、阶段边界必须保留的 Handoff，以及为不可修改
Frozen 引用提供路径兼容的极小 redirect stub。Frozen Contract 是其版本范围内的 normative source。

`CONTRACT_INDEX.md` 只是跨域或版本不明时的 fallback router，不是每个任务的默认前置阅读。
`docs/archive/**` 默认不是 current truth；只有任务明确需要历史决策、审计或 successor 设计证据时才读取。
Redirect stub 只保存生命周期和 archive 路径，不是 normative source。

文档路径 Gate 检查 active Markdown 及 Frozen 入站引用。Archive 正文按原始历史快照保存，其中记录的退役名称或
当时路径不重新解释为当前引用，也不要求为其创建新的 active stub；archive target 自身仍必须存在并可读取。

机械可检查的文档生命周期登记在 `docs/architecture/DOC_REGISTRY.json`。
