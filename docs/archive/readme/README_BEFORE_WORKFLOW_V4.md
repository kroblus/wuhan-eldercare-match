> 历史快照：仅调整归档后的相对链接；原始字节保存在恢复 ZIP 中。

# 武汉养老机构精准匹配小程序

面向武汉本地老人及其家庭的养老需求评估与机构匹配微信小程序。

## 项目入口

- [当前产品资料](../../../docs/product/README.md)
- [当前架构与文档生命周期](../../../docs/architecture/README.md)
- [项目级 Agent 规则](../../../AGENTS.md)

## Source of Truth

当前产品版本由 `docs/product/README.md` 指定；对应版本的 Frozen Contract / Ruleset 冻结业务语义。
`docs/architecture/CONTRACT_INDEX.md` 仅在任务跨领域、版本归属不明或无法确定直接 Contract 时作为 fallback router。
Proposal、Audit、Migration、redirect stub 与 `docs/archive/**` 默认不是当前实现依据。

## 开发与验证

### 共用源码的正式／演示本地构建

```text
npm run build:production
npm run build:demo
npm run check:run-mode-convergence
npm run check:institution-vr-runtime
```

打开生成的 `dist/production/project.config.json` 或 `dist/demo/project.config.json`。
`dist/` 是可重建产物，不是第二套源码；修改页面、组件、Assessment/Profile/Recommendation 时仍只改
`miniprogram/`。构建复用本机微信 TypeScript 4.1.2、Less 和 WXML 编译器；非默认安装位置可传
`-- --install-root <开发者工具安装目录>`。检查双模式前先生成两个构建。

- `miniprogram/` 直接打开仍是既有开发 Mock 调试入口，不能冒充正式构建。PRODUCTION 构建在数据提供者边界移除开发机构和公开内容 Mock，不包含演示数据、按钮或合成全景；当前只读提供者已接入武汉市社会福利院的公开名称、区域、地址与机构固定电话；价格、能力、床位、坐标和 VR 保持未知，未开放平台预约。字段来源和核验范围见 [正式目录说明](../../../modes/production/README.md)。真实业务服务与校验保留，未接入真实数据库或变更 Frozen Contract。
- DEMO 在构建时加入 `modes/demo/` 适配器：12 条独立虚构机构、评估样例、内存草稿和演示服务状态。首页“加载演示数据”后可进入同一列表、详情、评估、画像、推荐及 VR/地图页面。重置清理本次草稿、推荐上下文、模拟预约/带看/评价；不读写真实 Storage，不保存真实联系人。
- 两个既有工程当前使用相同 AppID，本轮保留原配置。演示构建仅允许 `develop`，在 App 注册前阻断网络、身份、电话、位置跳转、真实存储及云 API；预约/评价表单在演示构建中使用同一演示服务组件，移除原生手机号授权入口。此为本地应用隔离，**不是平台 AppID 隔离或发布就绪证明**。不要上传或发布这些本地产物。
- 正式详情仅在既有核验投影允许时显示地图/VR。地图继续使用 GCJ-02 和 `wx.openLocation`；VR 按冻结模型打开已核验 HTTPS 平台 URL，仍需真实素材、微信业务域名及真机验证。原生球形渲染器供技术页和演示包共用，合成图片明确标为非机构实景，不能关联到机构 VR 入口。
- `daqian-showcase-official-preview-v1` 保留为 V1.6 对照与回退；日常新开发不再同步其页面、引擎或 Store。既有公开演示构建配置保存在 `modes/demo-project.config.json`，新构建不再依赖旧工程。旧演示的完整 DemoSession 历史、带看档案及顾问展示尚未全部等价迁移，不能声称全部双工程收敛完成。

320px、390px 与微信真机大字号、地图服务及真实全景域名仍需 Owner 验证；Simulator、离线编译、运行测试分别作为对应层级证据。

`DEVELOPMENT_MODE = SOLO_FAST_ITERATION`，`PRIORITY = WORKING_BUSINESS_FEATURES`。
默认由主 Codex 直接完成明确需求，专项 Agent、Skills、MCP 按需使用；完整约定见 [AGENTS.md](../../../AGENTS.md)。
允许合理重构旧页面与导航，历史阶段关闭不构成新的审批门禁。

验证按影响选择，不默认全量回归、大型 Build/SHA 归档或多份报告；业务、隐私、身份和发布授权边界保留。
可用脚本以 `package.json` 为准；仅改文档生命周期或引用时，可运行：

```text
npm run check:doc-governance
```

微信生成 JavaScript 的兼容边界见
`docs/architecture/WECHAT_RUNTIME_COMPATIBILITY_POLICY.md`；具体业务实现与验证要求以受影响的 CURRENT/FROZEN 文档为准。

## 按需资料

- [正式工程持续状态（Google Drive）](https://drive.google.com/file/d/1ZIhRrG-MZr8YAVUM-PQ7mENvmPwDYbcW/view)：历史状态按文内日期解释，不用演示版结论覆盖。
- [专项 Agent 与模型选择](../../../docs/agent/README_AGENT_ENGINEERING_V2_1.md)：可选工具说明，日常开发规则以 AGENTS 为准。
- [Personal Records 工作包收口](../../../docs/development/WARM_SWISS_PERSONAL_RECORDS_PROGRESS_V1.md)：仅该工作包状态，不代表整个产品验收。
- [已完成的前端跨工程路由修复](../../../docs/archive/agent/AGENT_FRONTEND_ROUTING_FIX_HANDOFF.md)：历史实现原因与验证证据，旧阶段审批和下一步措辞不作为当前指令。

`docs/archive/` 与 `output/` 中的旧设计、实施、QA 和 Build 资料按需追溯，保留原证据位置；其中同名“当前/最终/下一阶段”只属于记录时的任务。`tmp/` 可能含独有截图和未提交工具，不整体清空。业务 Contract 与当前运行配置不在清理范围内。

## 旧演示与临时目录（按需追溯）

- [partner-demo](../../../archive/recovery/2026-10-27-workflow-v4/retired-main-trees/partner-demo/README.md)：旧 S1 隔离空壳，退役归档候选，保留原测试依赖与证据。
- [partner-demo-s2](../../../archive/recovery/2026-10-27-workflow-v4/retired-main-trees/partner-demo-s2/README.md)：S2 生成器模板，含独立状态模拟；先保留独有实现，再决定归档。
- [showcase/vr-map-interactive-v1](../../../archive/recovery/2026-10-27-workflow-v4/retired-main-trees/showcase/vr-map-interactive-v1/README.md)：旧 VR/地图教学工具，含独有素材与生成器，不能当 TMP 删除。

上述路径不参与当前产品包，但仍被旧工具或历史证据引用；本轮未整目录移动/删除。它们与当前 `miniprogram/pages/showcase/`、Classic B 工程及两工程各自 `tmp/` 分开处理。`tmp` 中的未提交截图、图册脚本和历史副本按用途保留，不整体清空。
