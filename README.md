# 武汉养老机构精准匹配小程序

面向武汉本地老人及其家庭的养老需求评估与机构匹配微信小程序。

## 项目入口

- [当前产品资料](docs/product/README.md)
- [当前架构与文档生命周期](docs/architecture/README.md)
- [Agent Engineering V2.1](docs/agent/README_AGENT_ENGINEERING_V2_1.md)
- [项目级 Agent 规则](AGENTS.md)

## Source of Truth

当前产品版本由 `docs/product/README.md` 指定；对应版本的 Frozen Contract / Ruleset 冻结业务语义。
`docs/architecture/CONTRACT_INDEX.md` 仅在任务跨领域、版本归属不明或无法确定直接 Contract 时作为 fallback router。
Proposal、Audit、Migration、redirect stub 与 `docs/archive/**` 默认不是当前实现依据。

## 开发与验证

可用脚本以 `package.json` 为准。文档生命周期与引用的机械检查使用：

```text
npm run check:doc-governance
```

微信生成 JavaScript 的兼容边界见
`docs/architecture/WECHAT_RUNTIME_COMPATIBILITY_POLICY.md`；具体业务实现与验证要求以受影响的 CURRENT/FROZEN 文档为准。
