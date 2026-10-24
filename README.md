# 武汉养老机构精准匹配小程序

面向武汉本地老人及其家庭的养老需求评估与机构匹配微信小程序。

## V2.1-B1 首页与阅读体验

首页采用 A2 资讯与服务融合布局，提供两条内容导读、查找机构／了解照护需求双入口及原位搜索。
无条件时预览普通目录前2家，可原位展开；名称、区域、性质按原 AND 规则查询时显示全部匹配。
目录卡只展示现有证据支持的基础资料状态和机构特定提醒，不展示完整地址或电话，不生成护理优势标签。
详情保留合法拨号、地图及原版本上下文；三类阅读页复用原内容和日期。顶部公告只提供真实空状态，无公告数据或未读数。
TabBar 仍为首页／养老顾问／我的；N2 迁移留至 B2。运行 `npm run check:v2-1-b1-ui` 检查双模式展示与交互。
实施范围、证据及 Owner 真机检查见 [B1 交接](docs/design/V2_1_B1_COMMERCIAL_UI_HANDOFF.md)。

B1.1 细化首页资讯分组、主次服务入口和暖橙点缀；普通目录将已核验性质移至单个事实标签，未知性质保留文字。首页与机构目录随微信字号设置放大，窄屏自然换行。运行 `npm run check:v2-1-b1-1-visual` 检查展示投影、生成样式对比度及字号映射；原生截图和验收范围见 [B1.1 交接](docs/design/V2_1_B1_1_VISUAL_HIERARCHY_HANDOFF.md)。

B1.2 按 Owner 参考图重排首页：横向品牌与公告铃铛、无照片的轻量品牌构图、三类资讯组合卡、青绿/暖橙双服务卡、原位搜索和资料分组卡片。未采用参考图中的机构照片、无证据特征、服务承诺或四栏导航。运行 `npm run check:v2-1-b1-2-home`；原生对比及验收边界见 [B1.2 交接](docs/design/V2_1_B1_2_HOMEPAGE_VISUAL_HANDOFF.md)。

## V1.8 真实机构目录

正式只读目录现有11家真实机构，覆盖8区、7家有公开固定电话；组合筛选沿用V1.7，首页布局见V2.1-B1。
详情提供联系准备清单，资料缺失集中说明；没有合作依据的机构仍不开放平台预约。
扩充路径、逐字段来源、复核期限及已跳过的冲突资料见 [正式目录说明](modes/production/README.md)。
`npm run check:production-directory-data` 可在普通Node环境配合固定TypeScript 4.1.2及WECHAT_TYPESCRIPT_PATH运行；GitHub Actions仅覆盖源码回归，完整双构建仍需本机微信工具。本轮仅本地验证，远端CI尚未执行。

## V1.7 首页（历史布局，当前见 V2.1-B1）

首页直接按名称、武汉区级区域和性质组合搜索，复用独立目录的筛选函数、卡片和详情身份。
首页按搜索、机构结果、需求评估、实用阅读排列；卡片只保留摘要，详细费用、照护及逐项核验资料可在详情展开。
正式目录仅展示已有真实资料；性质未核验时保留“性质待确认”，不从名称推断。
养老补贴、科普及入住指南使用共享阅读页，保留官方来源、资料核对日期及适用范围；内容不判定个人补贴资格或医疗状况。
演示模式保留12家合成机构、启动隔离和内存模拟服务；首页仅保留“载入演示案例”和简短身份提示。重置、评估样例、匹配结果及模拟预约／带看／评价位于“我的 → 演示设置”；重置需确认，只清理本次内存演示记录。

双构建后运行 `npm run check:v1-7-homepage` 验证组合搜索、重置、空结果、详情、内容页和返回。
V1.9 继续使用冻结的 Assessment / ElderProfile / Recommendation V2，产品 Source of Truth 仍为 V1.2。结果页区分护理条件可确认、相近候选、需进一步评估、老人信息待澄清及无法安全推荐；不补卡、不引入评分。正式11家机构的护理资料不足时不生成推荐卡；“浏览已收录的养老机构”走普通目录，不携带推荐上下文，候选详情仍使用同源版本上下文。卡片默认最多展示3条依据，安全差异全部保留，补充资料可展开。运行 `npm run check:v1-9-assessment-recommendation` 验证双模式闭环；`-- --source-only` 为不依赖微信构建的CI子集。
新历史的来源和导出范围见 [SOURCE_BASELINE.md](SOURCE_BASELINE.md)。
V2.0 护理公开资料核查与字段接入说明见 [正式护理证据接入](docs/architecture/PRODUCTION_CAPABILITY_EVIDENCE.md)。待核验记录不参与推荐；运行 `npm run check:capability-evidence` 验证证据、不可变版本和冻结推荐链路。本轮4家机构的19项匹配护理能力均仍为unknown，未用宣传或历史接收说明制造推荐卡。
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
构建会压缩运行时 JavaScript 和样式，并检查源码文件总量不超过 1984 KiB，为 2 MiB 主包预留 64 KiB 余量；也可执行 `npm run check:run-mode-package-size`。此为本地体积检查，最终微信包和真机调试仍以开发者工具结果为准。
`dist/` 是可重建产物，不是第二套源码；共享页面与领域规则维护在 `miniprogram/`，Demo 专属展示覆盖维护在 `modes/demo/`，由构建器组合，不能直接改生成目录。构建复用本机微信 TypeScript 4.1.2、Less 和 WXML 编译器；非默认安装位置可传
`-- --install-root <开发者工具安装目录>`。检查双模式前先生成两个构建。

- `miniprogram/` 直接打开仍是既有开发 Mock 调试入口，不能冒充正式构建。PRODUCTION 构建在数据提供者边界移除开发机构和公开内容 Mock，不包含演示数据、按钮或合成全景；当前只读提供者已接入11家武汉真实机构的可核对公开资料，7家有公开固定电话；价格、能力、床位、坐标和 VR 保持未知，未开放平台预约。字段来源和核验范围见 [正式目录说明](modes/production/README.md)。真实业务服务与校验保留，未接入真实数据库或变更 Frozen Contract。
- DEMO 在构建时加入 `modes/demo/` 适配器：12 条独立虚构机构、已完成评估快照、多老人记录、内存草稿和模拟服务状态。首次启动自动幂等初始化案例，首页轻量引导进入画像和推荐；“我的”以老人、评估、预约为主，管理能力位于“演示设置”。主讲机构详情可进入带上下文的城市地图、合成全景、虚构顾问与模拟预约；只有合法 completed Visit 能进入三步评价。重复载入不重置或复制，显式重置 / 进程销毁清除新增内存数据；不读写真实 Storage、不保存真实联系人。
- 两个既有工程当前使用相同 AppID，保留原配置。Demo 身份 Gate 仅接受预期 AppID 的 `develop` / `trial`，在 App 注册前阻断网络、身份、电话、位置跳转、真实存储及云 API；预约页不触发原生手机号授权或真实请求，评价复用既有完整表单与隔离会话端口。此为本地应用隔离，**不是平台 AppID 隔离或发布就绪证明**；体验版上传、提审和发布须分别取得 Owner 授权。
- 正式地图/VR 保持原核验与不可用原因：地图仅在核验后允许 GCJ-02 / `wx.openLocation`，VR按冻结模型消费已核验HTTPS资源，缺资料时不能操作。Demo 专属 Provider 可为稳定主讲机构提供无院址标记的城市视野与可交互合成空间，明确非真实机构实景，不写正式 Geo / VR、不放宽正式 Gate。
- `daqian-showcase-official-preview-v1` 保留为 V1.6 对照与回退；日常新开发不再同步其页面、引擎或 Store。既有公开演示构建配置保存在 `modes/demo-project.config.json`，新构建不再依赖旧工程。B1.2.5 / B1.2.6 交付记录、评价和虚构顾问演示，不宣称旧独立工程全部功能等价迁移。

B1.2.6 已获 Owner 2026-10-24（北京时间）视觉、业务流程及修复版顾问六项 Android 手动复测通过，2026-10-25完成本地冻结检查。320/375/430px与150%投影保留原生DevTools证据；Codex ADB自动化为NOT_RUN，微信最终上传包体积仍未取得。实际冻结范围、记录与后续上传授权边界见 [B1.2.6交接报告](docs/design/B1_2_6_DEMO_STORY_REPORT.md)。真实机构地图/VR素材与域名核验仍属既有边界。

可用脚本以 `package.json` 为准。文档生命周期与引用的机械检查使用：

```text
npm run check:doc-governance
```

微信生成 JavaScript 的兼容边界见
`docs/architecture/WECHAT_RUNTIME_COMPATIBILITY_POLICY.md`；具体业务实现与验证要求以受影响的 CURRENT/FROZEN 文档为准。
