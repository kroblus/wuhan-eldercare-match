# 武汉养老机构精准匹配小程序 — 开发约定

`DEVELOPMENT_MODE = SOLO_FAST_ITERATION`
`PRIORITY = WORKING_BUSINESS_FEATURES`

## 日常开发

- 需求明确时，由当前主 Codex 阅读相关代码并直接实现、验证；简单任务尽量一轮完成。仅重大业务决策、危险操作或不明确的核心需求需要 Owner 决定，独立工作继续。
- 默认单 Agent。复杂跨域或委派能明显节约时间时才使用专项 Agent；不强制先委派再深读，不默认独立 QA 或全套 Agent。实际委派时划清文件范围，避免重复阅读和并发修改同一文件。
- 允许合并页面、简化导航、重构组件、调整信息架构、复用逻辑及删除确认无引用的开发辅助代码。阶段关闭和历史 UI 冻结不限制新的已授权实现；数据迁移、公开 API、不兼容字段变化须先评估。
- 使用 Git 保留可回退状态；提交按当前授权和工程约定执行，不擅自 push、改写历史、上传体验版、提审或发布。保留既有未提交改动。

## 按需查阅与业务底线

- 当前产品入口：[docs/product/README.md](docs/product/README.md)。业务语义以适用版本 Frozen Contract / Ruleset 为准；实现可修改，真正改变契约时说明最小影响并由 Owner 决定，走显式 successor/version/migration，不改写旧 Frozen 语义。
- `docs/architecture/CONTRACT_INDEX.md` 仅作 fallback router，跨域、版本或直接 Contract 不明确时再读；不默认深读全部 Contract。Proposal、历史审计、归档、旧阶段 Handoff 不覆盖当前业务依据，也不构成每轮审批流程。
- 不伪造机构价格、床位、人员、护理/医疗能力、资质、评价、电话、地址、坐标、VR 或政策事实。Mock / synthetic 必须显式保留开发来源；`unknown / unavailable / unverified / expired / false` 按所属 Contract 保持不同语义。
- Institution verified facts、公开内容、运营状态、用户反馈/VisitEvaluation 保持权威边界。V1.2 CareProcess、AI、Consultant、Visit/Evaluation、电话/地址/Geo/简介不得改变 Recommendation V2 的 Safety、Eligibility、Exactness、PriorityFitVector、Rank Tuple 或 `NO_EXACT_MATCH`，除非新版本 Contract 明确批准。
- AI 只解释允许读取的快照/已核验展示数据，不重算、重排或写回推荐及机构核验事实。历史 CompletedAssessment、ElderProfile / Recommendation、Institution revision 不就地升级或覆盖。
- 保留数据库、持久化、身份和微信平台权限要求；健康、认知、护理及联系方式最小化读取传递，不记录完整健康答案/Profile。AppSecret、密钥和真实凭证不得进入前端、日志或仓库。
- 正式与独立演示工程保持环境、数据、身份、网络、存储和真实提交隔离；`catalogId` 不冒充 `institutionId`。跨工程任务按授权目标绝对路径读取各自 AGENTS.md，不假定兄弟配置自动继承。

## 可选工具与 UI

- 按需使用 `wechat_frontend`（前端）、`backend_domain`（后端/持久化）、`matching_engine`（纯领域规则）、`qa_reviewer`（独立只读审查）。保留现有配置和模型选择，不把模型推荐变成前置审批。
- 本正式工程 Warm Swiss 视觉实现仍由主会话独占（`UI_IMPLEMENTATION_OWNER = MAIN_SESSION_ONLY`），无需因此启动 QA。`docs/ui/warm-swiss-v1/` PDF 是视觉参考基线，业务 Contract 优先；Owner 已授权的页面和产品调整可以偏离历史 UI 方案，不需恢复旧阶段审批。该 ownership 不扩散到独立演示工程。
- Skills 按触发加载：`wechat-interaction` 用于 action/validation/navigation/loading/Assessment 交互；`wechat-runtime-compat` 用于 class、`wx.*`、生成 JS、共享事件；`recommendation-v2` 用于推荐 V2 语义/集成。纯文案、纯视觉样式不加载无关 Skill。保留 MCP 与安全设置，不为提速放宽 Sandbox、密钥或发布权限。

## 验证与交付

- 验证按请求行为、改动文件、受影响 Contract 和真实回归面选择，脚本以 `package.json` 为准。小 UI 做编译和直接相关检查；搜索/数据/导航做交互回归及必要真机测试；身份/支付/隐私/持久化/线上发布提高强度；纯配置/文档做语法和引用检查。
- 相关检查通过后不无理由扩大；不默认全项目测试、多 Agent 交叉审计、大型 Build/SHA 清单、阶段归档或多份报告。保留业务安全 Gate；区分自动化、DevTools、ADB 与人工真机证据，未取得的如实说明。
- 每轮简报 `STATUS / CHANGES / USER_VISIBLE_RESULT / TESTS / RISKS / NEXT`。`DOC_IMPACT = NONE | CURRENT_DOC_UPDATE_REQUIRED | NEW_CONTRACT_REQUIRED | AUDIT_ONLY`；仅长期结构变化更新对应 CURRENT 文档，真正契约变化走新版本，普通小改不新增治理报告。
