# 小程序前端结构与所有权

> 适用项目：武汉养老机构精准匹配小程序 / 养老对接小程序
> 文档定位：前端长期稳定结构、模块职责与所有权约束。
> 本文件不记录某个历史 Phase 的临时实施步骤；阶段性实现细节应由对应 Contract、交接摘要或任务记录承载。

## 1. 技术基线

- 微信原生小程序；
- TypeScript；
- WXML；
- Less，由微信开发者工具现有编译插件处理；
- 不引入额外 UI 框架或复杂构建层。

## 2. 目录职责

```text
miniprogram/
├─ pages/       页面与页面级交互
├─ components/  小而稳定的公共组件
├─ styles/      Less token、mixins 和全局基础样式
├─ types/       领域类型与 service contract 类型
├─ domain/      不依赖页面、Store、wx 或网络的纯领域规则
├─ services/    页面唯一的数据访问入口
├─ store/       评估草稿等跨页状态
├─ runtime/     构建适配端口：草稿存储、目录展示元数据与可选演示素材
├─ mock/        仅开发使用的显式 Mock provider
└─ utils/       无业务状态的通用工具
```

`modes/demo/` 只包含合成数据、独立内存 Session、启动隔离及模拟服务组件；正式与演示均由
`scripts/build-run-mode.mjs` 组合 `miniprogram/` 的同一页面、组件与领域规则，生成忽略目录
`dist/production`、`dist/demo`。构建时选择数据提供者及草稿存储适配器，不使用页面参数或 Storage
开关授予演示权限。源码目录直接打开保留开发 Mock；正式模式以 `build:production` 输出为准。
正式构建通过 modes/production/ 提供带逐字段政府来源证据的只读目录；行政区划 resolver 必须显式配置并严格匹配，未核验事实保持 unknown。公开目录不赋予预约能力，不能回退至演示数据。

### 2.1 页面与组件

- `pages/` 负责页面展示、页面级交互、页面生命周期和应用层调用；
- `components/` 只承载小而稳定、可复用的 UI/交互单元；
- 页面和组件不得复制 Frozen Contract 中的领域算法；
- 页面展示只消费合法的 Application / Service 输出，不直接解释底层 verification、evidence 或领域判定。

顾问 Tab `pages/consultant/index` 与非 Tab `pages/consultant/consultation` 通过 `consultant-page.ts` 注册同一页面实现，复用 `index.wxml` / `index.less`、现有 ViewModel 和 Global Consultant Application。两条路由只在返回箭头可见性上不同，不按来源选择顾问或复制联系、授权逻辑。消费者导航范围见 `ROUTES.md`。

机构详情可打开既有公共 FAQ 页 `service/ai-chat/index`；该导航不传递老人、推荐、机构身份或快照。FAQ 页面只解释既有获准资料，明确未读取本次个性化上下文，答复后定位最新消息；转人工仍使用顾问 Tab。此入口不增加 Provider、模型、存储或业务写入能力。

页面实例级导航保护由 `utils/navigation-guard.ts` 承担。需要回到既有 non-Tab 目录的局部入口先查合法祖先；有祖先返回原实例，无祖先由调用者明确选择 push 或替换当前错误页。我的页面与共用说明页的 non-Tab Next 复用实例 guard，失败释放，页面再次显示时重置；导航 helper 本身不增加老人档案或 History 数据能力。

我的页直接展示老人档案、我的评估、我的预约入口；评估入口只guard导航至既有 `pages/assessment/history`，不传owner/Elder/Assessment参数，不导入History/身份/Draft服务，不预先发起读取。失败在入口旁提示，返回后释放guard。History目标页继续遵守原有capability、身份和TEST_ONLY来源门禁；增加导航入口不代表历史读取或保存已开放。帮助继续使用既有养老顾问Tab。

History 页面通过独立 `services/completed-assessment-history.ts` 读取 C5 认证后的完成态元数据，不读取 Draft Store 或复用 Visit Provider。当前后端只实现独立提案的 TEST_ONLY disposable 数据源，普通未配置环境保持 UNAVAILABLE；服务端来源显式展示为隔离合成保存记录，不代表生产历史已开放。分页仅使用 owner-scoped cursor；页面 hide/detached 后拒绝迟到响应，加载更多保持单一 Action 和 pending guard。页面不自动保存评估、不改当前 Profile/Recommendation。额外服务器 user-loop capability 仅在隔离 TEST_ONLY 环境开放 History 内联操作区；`completed-assessment-user-loop.ts` 负责显式保存的固定幂等意图、授权详情读取及空草稿检查，`history-user-loop.ts` 负责私有 capability/lifecycle 状态和返回列表位置。普通读取不加载 Draft Store；显式保存通过门禁后读取 Draft 并保留；D03/D04 已批准的新评估确认流程仅在可信保存且答案未修改时比较替换单活动槽，不调用 clear/reset。历史画像只展示已保存的最小不可变 Profile display V1；旧记录缺失时 unavailable，历史 Recommendation 通过独立 owner-scoped `/{id}/recommendation` 读取保存时的 Formal V2 受控投影。服务器来源与能力缺失时不生成快照；旧记录 unavailable、合法 no-safe、unsupported version 与网络错误分别展示。`domain/assessment-history/recommendation-view.ts` 只做版本/绑定/结构守卫与已有显示词典投影，不导入当前 Draft/Catalog/算法；保存时的独立 `recommendation-display.ts` 调用现行 Formal core，保持版本与候选顺序。内联子视图返回原画像/列表，来源明确 TEST_ONLY/Mock，机构当前事实不能补写。未保存修改、待确认或恢复证据不足的草稿阻止替换，可继续现有 Intro；已保存未修改草稿经确认创建独立空会话，合法空 V2 context 使用既有 Intro → Basic，不新增路由或多草稿语义。开发合同草案见 `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`，状态仍为 PROPOSED_NOT_FROZEN；此实现事实不赋予草案 Frozen 权威或真实敏感数据收集授权。

History client 在 C5 获取会话前读取不含身份/记录的 public capability；未开放、旧后端缺少 endpoint 或来源未获本阶段 TEST_ONLY 授权时不触发 History-driven 登录。生产来源仍未批准；该探测不代替后端归属校验。

Assessment 阶段的局部导航由 `utils/assessment-phase-navigation.ts` 协调，复用实例 guard，按实际页面栈、目标题组、单个 API 栈变化和剩余步骤计算容量。只负责已签署 B01-D Scope A 的题组入口、前进边界、确认后 Intro-only 重置和 Intro 一次性目标交接；临时交接仅包含稳定 step/来源，绑定页面与操作有效性，不承载答案或业务上下文，不持久化，不构成通用导航框架或全局业务 Store。Budget 保留既有校验/保存门禁后建立 Profile 根；Profile 的原 version-dispatched Application、onShow 刷新和四状态保持。独立深业务 Scope B 的恢复协议不属于此 helper。

预约 Create 的异步请求与页面展示生命周期分离：页面私有状态只负责实例有效性、前台/栈顶位置和结果页导航，业务请求及幂等仍由原 client/service 负责。迟到受理回执保持原业务事实；失效页面不能执行跳转或写入新页面展示态。页面 guard 不承担取消请求、修改预约状态或持久化个人数据的职责。

### 2.1.1 隔离原生功能演示（开发构建）

`pages/showcase/**` 是独立开发展示边界，仍在当前小程序源码中注册，只有 `envVersion=develop` 才加载内容；未取得开发构建信息时关闭。没有正式产品导航入口。`navigation.ts` 仅允许三个演示 route，返回不会进入业务页；不复用机构 Provider、Draft、C5、History、Visit、Appointment、Evaluation 或 Recommendation。该局部隔离不证明整个工程启动/热编译期间无业务请求，也不产生独立 TEST AppID。

`sphere-renderer.ts` 实现原生 WebGL 球体内壁 UV 纹理与透视相机，仅在视角变更时绘制；隐藏、卸载释放图形资源、图片回调和动画请求。几何校准纹理显式标为程序生成、非照片。真实照片仅从用户相册取得本地临时文件，经 Owner 授权/隐私/完整球形投影确认及 JPEG 尺寸和元数据检查后交给 Canvas Image；路径只存在页面私有临时状态，不进入 setData、日志、Store、上传或机构资料。`scripts/prepare-showcase-panorama.py` 可在仓库外生成无元数据压缩副本与本地 provenance manifest；它不自动识别人脸/证件，也不证明投影，人工检查仍必要。未经 Owner 提供与检查，家庭实景验收保持等待。

`map-real` 使用原生 map 的武汉城市视野、平移/缩放、中心点只读与复位；无自定义 POI、机构坐标、geocoding、用户定位或 `wx.openLocation`。地图服务底图网络读取与业务请求边界分别审计；updated 事件不能证明瓦片完整加载，超时/空白需明确反馈。正式 Institution VR 和 map-ready 判断继续只来自原 frozen Contract 与 presentation application，不消费演示状态。

### 2.2 Domain

`miniprogram/domain/**` 承载不依赖 Page、Component、Store、Service、Mock、网络和 `wx.*` 的纯领域逻辑。

领域模块：

- 只依赖自身允许的稳定类型与纯模块；
- 不读取页面状态；
- 不直接持久化；
- 不直接访问机构 Provider、网络或微信运行时；
- Frozen Domain 的精确规则以对应 Frozen Contract 为最高依据，本文件不复制其算法细节。

### 2.3 Services

`miniprogram/services/**` 是页面和组件访问业务数据与 application capability 的统一入口。

基本方向：

```text
Page / Component
      ↓
Service / Application contract
      ↓
Mock provider（开发阶段）或未来 Backend / HTTP provider
```

要求：

- 页面不得直接调用 `wx.request` 获取业务数据；
- Mock provider 与未来真实 provider 应尽量共享稳定 contract；
- 登录、重试、错误映射、数据来源判断不应分散到各页面；
- 新 application consumer 不应依赖已明确标记为 legacy 的 DTO 或兼容路径；
- 具体某一领域的 provider、snapshot、evaluator、validator 边界，以对应当前 Contract 为准。

## 3. Less 策略

- `tokens.less`：颜色、字号、行高、间距、圆角、边框、阴影和触控尺寸；
- `mixins.less`：少量复用模式，例如卡片、点击区域、文本截断和焦点态；
- `base.less`：页面背景、默认文字、盒模型和基础可访问性样式；
- `app.less`：导入全局基础样式；
- 页面与组件需要编译期变量或 mixin 时，显式导入对应 Less 文件。

视觉方向继续保持：

- 温暖；
- 可信；
- 克制；
- 面向 35–65 岁家庭决策者；
- 优先保证高对比、清楚层级、舒适行高；
- 主要触控区域至少约 88rpx；
- 不为单个页面引入复杂动画或独立设计体系。

## 4. 基础组件职责

| 组件 | 职责 | 不负责 |
|---|---|---|
| `page-container` | 页面安全区、通用边距和标题壳层 | 业务取数 |
| `section-card` | 内容分区和标题 | 领域判断 |
| `primary-button` | 统一主要操作和禁用/loading 外观 | 登录或提交逻辑 |
| `tag` | 标签和状态短文本 | 推断推荐理由 |
| `state-panel` | empty/error/loading/development 状态 | 伪造成功状态 |

现有 `navigation-bar` 优先复用；只有确认无法满足当前路由壳层时才做局部调整。

新增或修改公共组件时，应优先保持：

- 单一职责；
- 稳定输入输出；
- 不内嵌页面业务状态；
- 不复制领域规则；
- 不制造第二套导航、校验或数据访问路径。

## 5. 数据访问与展示边界

### 5.1 页面不得越层读取

Page / Component 不应直接读取：

- raw provider record；
- schema version；
- internal evidence；
- 私有 verification locator；
- 领域 validator 内部实现；
- 仅测试使用 fixture。

页面应消费已经面向 UI 的稳定 application / view model / display snapshot。

### 5.2 Verification / Evidence

如果页面展示机构资料：

- availability；
- effective verification；
- public verification date；

应保持语义分离。

UI 不应泄露内部 evidence、精确内部 locator、私有 source metadata 或其他不面向用户的核验信息。

### 5.3 Legacy 路径

历史兼容 service / DTO 可以继续存在于明确的 legacy 使用范围，但：

- 新 consumer 不默认依赖 legacy DTO；
- 不因为兼容旧页面而复制一套新的领域语义；
- legacy 的退出或替换应由独立任务明确推进，而不是在无关任务中顺手重构。

## 6. Mock 与 Fixture 隔离

- `miniprogram/mock/**` 只用于开发态显式 Mock provider；
- `scripts/fixtures/**` 属于测试 / runtime fixture，不应作为生产 App 数据源；
- 生产代码不得导入测试 fixture；
- Mock / synthetic 数据不得被页面或文案包装成真实合作机构事实；
- 更完整的规则见 `MOCK_DATA_POLICY.md`。

## 7. 微信运行时与 DevTools

微信 DevTools / MCP 属于开发和验证工具能力，不改变前端模块所有权。

使用原则：

- 只有任务风险需要时，才升级到 DevTools / Simulator / 自动化验证；
- 纯文案、简单 Less、低风险静态修改不默认启动完整运行时验证；
- DevTools / Simulator / MCP 自动化证据不能替代要求明确的 Android / iOS 人工真机 Gate；
- 具体 MCP 连接方式、Token、端口和本机路径不得写入本文件。

## 8. 文件所有权

- `wechat_frontend`：主要负责 `miniprogram/**` 中的页面、组件、WXML、Less、客户端交互及前端 application integration；
- `backend_domain`：未来 `server/**`、API、数据库、持久化、鉴权和后端领域边界；
- `matching_engine`：ElderProfile / Recommendation 等明确纯领域规则及其对应 runtime / fixtures，精确范围以当前 Agent ownership 与 Frozen Contract 为准；
- `qa_reviewer`：只读审查，不拥有功能实现；
- Main session / orchestrator：负责跨模块契约协调、集成决策与最终验收。

具体主线程模型和 Reasoning effort 不属于模块所有权；由当前任务的模型路由建议和用户选择决定。

## 9. Source of Truth

本文件只定义前端长期稳定结构与所有权，不复制业务规则。

优先级：

```text
Current Product Source / Frozen Architecture Contract
    >
当前代码与冻结实现
    >
AGENTS.md / Agent ownership / Repo Skills
    >
FRONTEND_STRUCTURE.md
    >
历史阶段实现说明
```

若本文件与当前 Frozen Contract 或当前正式实现证据冲突，以更高优先级来源为准。


TEST_ONLY History cold-start recovery: explicit save prepares a server-bound random intent and verifies metadata-only local persistence before sending answers. History opens with scope-checked reconciliation and an explicit retry-query action; unknown results block new submission. No new page route or production save entrance. The scoped backend `save-intents/scope`, `save-intents`, `save-intents/reconcile` endpoints reuse C5 + sole Elder transaction authorization and completion metadata; V4 runs only in the existing isolated disposable migration chain. Proposal policy/details: `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`. No Frozen or Draft semantics changed.


TEST_ONLY Session lifecycle: D03/D04 approved behavior is implemented only in the isolated History operation area; the whole History proposal remains PROPOSED_NOT_FROZEN. V5 adds immutable AssessmentSession → SaveIntent → CompletedAssessment associations. Same-session preparation/replay never creates a second completion. Initial registration allows one scoped root; explicit `assessment-sessions/new` requires an authorized completed predecessor and idempotently returns one successor for the durable candidate context. Save acknowledgment retains Draft. The private confirmation action can replace the existing single active slot only after trusted original-payload ACK evidence, unchanged answers and fresh C5/Elder checks; cancel/edited/pending/unknown/cold-proof-missing states preserve and block. `history-assessment-session.ts` stores only non-sensitive context/transition metadata, with SWITCH_REQUESTED readback before the new-session request and SWITCH_PREPARED before single-slot CAS. No clear/reset, new sensitive local backup, formal Recommendation UI, production route or real-user enablement. Existing Intro → Basic navigation is reused. Cold-start reconciliation remains supported; lack of content evidence never becomes permission to replace Draft. See the latest Owner decision update and Session lifecycle boundary in `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`.


Decision alignment TEST_ONLY increment: the latest D01–D12 approval levels and formal-release plan are in the current register and Release Readiness section of COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md, still PROPOSED_NOT_FROZEN. History Save now opens a private single-use confirmation; cancel creates no intent/upload, confirmation rechecks answers/C5/sole-Elder/environment. It explicitly disclaims equality with the anonymous Preview and is not sensitive-data consent. Owner-scoped POST assessment-sessions/inspect-context reads only workflow state; missing/corrupt recovery markers block resubmission, and ALREADY_PREPARED cannot become a fresh request. V6 preserves non-sensitive context provenance with a unique claim to prevent cross-scope reassignment of inherited Draft contexts; no answer/history backfill, cleanup or production migration. Unassociated legacy intents/completions fence new allocations (RECOVERY_REQUIRED/LEGACY_RECOVERY_REQUIRED) while old authorized reads, original late completion and replay remain available. Existing A→B and cold recovery stay; late list/detail/Recommendation replies recheck current scope. Scope GET uses base isolated History authorization for metadata-only reads; prepare/reconcile still require user-loop. No formal Recommendation UI, route, real identity, sensitive consent/deletion or production enablement is implemented. Human recovery channel/terminal closure, D08 release/retention, D09 final fields, D10 real source and D11/D12 detailed processes still require approval.

Controlled Result Save UI: the quiet block after Consultant CTA retains original cards/ranking/actions/safe-area layout. recommendation-save-build.ts remains null in the normal build; no URL/storage activation or passive auth/History request. After independent reviewed build admission, explicit C5/sole-Elder verification and explicit trusted Preview request may show a separate server-controlled synthetic projection. trusted-assessment-preview.ts validates/maps pinned display only; recommendation-result-save.ts checks actual projected page data and private one-use D02 proof. completed-assessment-user-loop.ts reuses existing Session/SaveIntent/persist-before-POST/idempotent save and cold reconcile, with memory-only candidate/nonce/input fingerprint and unchanged seven-field durable recovery. No anonymous claim or upper-card promotion; no Domain/Frozen shape/production route changes. Server V7 binds candidate to authorized owner/Elder/namespace/Session and commits pinned snapshots atomically (only final completion identity/time remapped). Independent TEST AppID/package/transport evidence remains unavailable, so device submission is blocked; virtual controller HTTP tests do not approve a build. See Controlled Result UI and trusted Preview binding in COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md, still PROPOSED_NOT_FROZEN.
