# 武汉养老机构精准匹配小程序

面向武汉本地老人及其家庭的养老需求评估与机构匹配微信小程序。

## V1.8 真实机构目录

正式只读目录现有11家真实机构，覆盖8区、7家有公开固定电话；首页布局和组合筛选沿用V1.7。
详情提供联系准备清单，资料缺失集中说明；没有合作依据的机构仍不开放平台预约。
扩充路径、逐字段来源、复核期限及已跳过的冲突资料见 [正式目录说明](modes/production/README.md)。
`npm run check:production-directory-data` 可在普通Node环境配合固定TypeScript 4.1.2及WECHAT_TYPESCRIPT_PATH运行；GitHub Actions仅覆盖源码回归，完整双构建仍需本机微信工具。本轮仅本地验证，远端CI尚未执行。

## V1.7 首页

首页直接按名称、武汉区级区域和性质组合搜索，复用独立目录的筛选函数、卡片和详情身份。
首页按搜索、机构结果、需求评估、实用阅读排列；卡片只保留摘要，详细费用、照护及逐项核验资料可在详情展开。
正式目录仅展示已有真实资料；性质未核验时保留“性质待确认”，不从名称推断。
养老补贴、科普及入住指南使用共享阅读页，保留官方来源、资料核对日期及适用范围；内容不判定个人补贴资格或医疗状况。
演示模式保留12家合成机构、启动隔离和内存模拟服务；首页仅保留“载入演示案例”和简短身份提示。重置、评估样例、匹配结果及模拟预约／带看／评价位于“我的 → 演示设置”；重置需确认，只清理本次内存演示记录。

双构建后运行 `npm run check:v1-7-homepage` 验证组合搜索、重置、空结果、详情、内容页和返回。
新历史的来源和导出范围见 [SOURCE_BASELINE.md](SOURCE_BASELINE.md)。
构建模式的生成 JS 检查显式选择本次产物：`npm run check:wechat-js-compat -- --artifact-dir dist/production/miniprogram`
或 `dist/demo/miniprogram`，避免误读其他源码工程遗留的 DevTools 编译缓存。

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

- `miniprogram/` 直接打开仍是既有开发 Mock 调试入口，不能冒充正式构建。PRODUCTION 构建在数据提供者边界移除开发机构和公开内容 Mock，不包含演示数据、按钮或合成全景；当前只读提供者已接入11家武汉真实机构的可核对公开资料，7家有公开固定电话；价格、能力、床位、坐标和 VR 保持未知，未开放平台预约。字段来源和核验范围见 [正式目录说明](modes/production/README.md)。真实业务服务与校验保留，未接入真实数据库或变更 Frozen Contract。
- DEMO 在构建时加入 `modes/demo/` 适配器：12 条独立虚构机构、评估样例、内存草稿和演示服务状态。首页“载入演示案例”后可进入同一列表、详情、评估、画像、推荐及 VR/地图页面；“我的 → 演示设置”管理案例及模拟服务。重置清理本次草稿、推荐上下文、模拟预约/带看/评价；不读写真实 Storage，不保存真实联系人。
- 两个既有工程当前使用相同 AppID，本轮保留原配置。演示构建仅允许 `develop`，在 App 注册前阻断网络、身份、电话、位置跳转、真实存储及云 API；预约/评价表单在演示构建中使用同一演示服务组件，移除原生手机号授权入口。此为本地应用隔离，**不是平台 AppID 隔离或发布就绪证明**。不要上传或发布这些本地产物。
- 正式详情仅在既有核验投影允许时显示地图/VR。地图继续使用 GCJ-02 和 `wx.openLocation`；VR 按冻结模型打开已核验 HTTPS 平台 URL，仍需真实素材、微信业务域名及真机验证。原生球形渲染器供技术页和演示包共用，合成图片明确标为非机构实景，不能关联到机构 VR 入口。
- `daqian-showcase-official-preview-v1` 保留为 V1.6 对照与回退；日常新开发不再同步其页面、引擎或 Store。既有公开演示构建配置保存在 `modes/demo-project.config.json`，新构建不再依赖旧工程。旧演示的完整 DemoSession 历史、带看档案及顾问展示尚未全部等价迁移，不能声称全部双工程收敛完成。

320px、390px 与微信真机大字号、地图服务及真实全景域名仍需 Owner 验证；Simulator、离线编译、运行测试分别作为对应层级证据。

可用脚本以 `package.json` 为准。文档生命周期与引用的机械检查使用：

```text
npm run check:doc-governance
```

微信生成 JavaScript 的兼容边界见
`docs/architecture/WECHAT_RUNTIME_COMPATIBILITY_POLICY.md`；具体业务实现与验证要求以受影响的 CURRENT/FROZEN 文档为准。
