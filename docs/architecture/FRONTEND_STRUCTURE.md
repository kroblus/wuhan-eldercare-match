# 小程序前端结构与所有权

V2.1-B1：首页采用 A2 资讯与双服务入口，继续使用 N1 TabBar。原位查询共用 `institution-directory-search`；首页仅在无查询条件且未展开时截取普通目录前 2 条，主动查询显示全部匹配。`pages/institution/directory-presentation.ts` 为普通目录卡片复用现有详情应用投影，保持同一 identity/revision/evaluationAsOf，只补充地址资料状态、电话状态与原有风险；List 不展示完整地址或电话号码；不生成护理特质或改变推荐。三个静态阅读路由继续共用内容 Service / 阅读模板。公告入口仅打开原生空状态，不读取公告数据或保存已读。

B1.1：普通目录展示投影仅将已核验的机构性质分配到一个事实标签，避免副标题重复；不生成护理能力、价格或距离标签。`utils/browse-font.ts` 将微信字号偏好映射到首页和目录页的 `--browse-*` 变量，通过内置 `page-meta` 应用；不改变评估和详情的业务状态。

B1.2：首页复用该字体和交互机制，采用品牌/铃铛横排、原生品牌构图、可换行三资讯网格及双服务卡。共享目录模板只重组现有资料显示；演示工具插槽位于搜索区之前，搜索控件与结果区保持相邻，数据和导航规则不变。

V1.9 结果页仍消费冻结 Recommendation V2 应用快照，`result-v2-view-model.ts` 仅映射原有状态、依据和差异。普通目录入口不注册推荐 sourceContext；候选详情继续使用 canonical identity 和同源上下文。页面隐藏/卸载使未完成的刷新失效，重新显示时读取最新画像。详情的咨询清单只读取已有候选差异，不重新计算推荐。

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

V1.8正式只读目录位于`modes/production/`：来源登记、精简机构数据行、逐字段记录构建器及行政区划表共同供给现有Institution投影。目录性质使用绑定正式身份和revision的证据旁表；不改变Frozen护理类型或推荐输入。新增机构不需要改动搜索、卡片及详情核心。电话与地图／VR仍由原有可信状态决定是否可操作。

```text
miniprogram/
├─ pages/       页面与页面级交互
├─ components/  小而稳定的公共组件
├─ styles/      Less token、mixins 和全局基础样式
├─ types/       领域类型与 service contract 类型
├─ domain/      不依赖页面、Store、wx 或网络的纯领域规则
├─ presentation/ 可被前端与服务端复用的纯展示投影
├─ services/    页面唯一的数据访问入口
├─ store/       评估草稿等跨页状态
├─ runtime/     构建选择的启动、目录、存储、文案与展示导航端口
├─ mock/        仅开发使用的显式 Mock provider
└─ utils/       无业务状态的通用工具
```

`modes/demo/` 包含合成数据、独立内存 Session、启动隔离、模拟服务组件及只在演示构建选择的记录页适配器；正式与演示均由
`scripts/support/select-mode-source.mjs` 选择共享文件和模式适配器，`scripts/build-run-mode.mjs` 编译为忽略目录
`dist/production`、`dist/demo`。构建时选择数据提供者及草稿存储适配器，不使用页面参数或 Storage
开关授予演示权限。源码目录直接打开保留开发 Mock；正式模式以 `build:production` 输出为准。
正式构建通过 modes/production/ 提供带逐字段政府来源证据的只读目录；行政区划 resolver 必须显式配置并严格匹配，未核验事实保持 unknown。公开目录不赋予预约能力，不能回退至演示数据。

2026-10-28 架构收敛：模式行为写在 `modes/<mode>/runtime/`，模式独有页面在 `modes/<mode>/pages/`，共享页面的完整静态模板/组件配置覆盖在 `modes/<mode>/overrides/`。选择顺序为共享源码 → 双模式共用 runtime → 模式页面/runtime → overrides；修改已覆盖模板时直接编辑对应模式文件。不同模式可以共用页面逻辑，构建器不再搜索中文文案或替换 TypeScript 函数体。运行文案由 `runtime/presentation-copy` 处理，展示别名与导航由独立端口处理；它们不写回事实、推荐或旧快照。`source-origins.json` 记录实际选中文件，构建前逐字节核对来源；唯一生成的运行值是公开 AppID，JSON 转普通模块属于微信编译适配。

Demo 连续场景由 `modes/demo/scenario.ts` 声明显式 TEST_ONLY ID，`session.ts` 保存老人、已完成合成 Assessment / Profile / Recommendation 快照、预约与 completed Visit、私有评价；重复载入不重置、不复制，显式重置或进程重启清除。老人/历史/预约页从同一会话读取；历史结果只展示保存快照，重新保存已完成草稿追加新记录。记录页共用 `modes/demo/pages/records.wxml` / `records.less`，由 `record-presentation.ts` 和 `utils/display-date.ts` 生成分组摘要及中国日期展示；实体 ID 仅用于路由与关联，另存评估操作只在 TEST ONLY 工具区提供。`runtime/evaluation-session.ts` 是评价会话端口：正式实现不提供演示数据，Demo 构建接入隔离上下文、展示姓名、编辑草稿和一次提交后的只读评价。三步评价复用正式表单和既有校验；21 项数字评分与费用清楚/不清楚保持冻结编码。评价页按实际 footer 高度预留末尾空间，键盘高度事件只调整展示，已提交查看隐藏提交按钮。构建器精确复用基础 WXSS 前缀，不改变样式顺序或包预算，不新增分包。

### 2.1 页面与组件

B1.2.6 的业务演示由上述 Demo runtime 与完整模板覆盖组合。Demo App 首次启动幂等初始化案例；首页轻量引导进入画像与推荐，“我的”以三类记录为主，管理操作位于 Demo 专属的 `pages/showcase/index` 演示设置。`demo/story.ts` 校验现有详情路由、当前 revision、来源上下文和会话 epoch；`story-name.ts` 只为既有主讲实体提供展示别名，不改机构事实或历史快照。详情中的 `demo-story-preview` 保留机构上下文进入既有原生地图 / WebGL 全景引擎；城市视野不标院址，合成全景不成为核验 VR。`demo/consultant.ts` 与 Demo 预约页提供固定演示回复及内存记录；Tab 不虚构选中机构，completed 判定和三步评价仍使用原端口。顾问操作在渲染后按实际导航栏高度定位既有问答 / 回复，并拒绝离页后的滚动；不新增通信或更改视觉。生产构建不包含这些 Provider、组件、管理入口或合成媒体，正式顾问及地图 / VR Gate 保持原实现。

V1.7 首页与独立机构目录通过 `services/institution-directory-search.ts` 复用原名称/性质/区域谓词，
通过 `templates/institution-directory.wxml` 和对应共享 Less 复用搜索控件及卡片。筛选保留目录顺序，
不参与 Recommendation V2。正式的目录元数据仅消费当前已核对地址，机构性质未知时不推断。
`content/family-reading.ts` 提供三类静态阅读内容和来源，三个 service 路由复用 reading-page 注册与阅读模板，
无身份、健康答案读取或业务写入；官方网址复制失败时保留可选择的网址及反馈，不绕过演示 API 隔离。

- `pages/` 负责页面展示、页面级交互、页面生命周期和应用层调用；
- `components/` 只承载小而稳定、可复用的 UI/交互单元；
- 页面和组件不得复制 Frozen Contract 中的领域算法；
- 页面展示只消费合法的 Application / Service 输出，不直接解释底层 verification、evidence 或领域判定。

### 2.2 Domain

`miniprogram/domain/**` 承载不依赖 Page、Component、Store、Service、Mock、网络和 `wx.*` 的纯领域逻辑。

领域模块：

- 只依赖自身允许的稳定类型与纯模块；
- 不读取页面状态；
- 不直接持久化；
- 不直接访问机构 Provider、网络或微信运行时；
- Frozen Domain 的精确规则以对应 Frozen Contract 为最高依据，本文件不复制其算法细节。

`domain/` 仅依赖 domain/types；新增 `presentation/` 仅依赖 domain/types/presentation。机构 V1.2.1 纯校验/投影位于 `domain/institution/v1-2-1/catalog.ts`，V1.1 展示投影位于 `domain/institution/display-projection-v11.ts`；Service 负责注入行政区 resolver 和 Provider。推荐显示语义位于 `domain/recommendation/v2/display-semantics.ts`。画像与推荐共享 ViewModel 位于 `presentation/assessment/`、`presentation/recommendation/`；旧 pages/services 路径保留兼容导出，新服务端引用直接使用纯路径。服务端资源只打包纯 domain/presentation/types，不引入微信、Demo 或默认 Provider。

`check:architecture-boundaries` 用 AST 检查类型与运行导入、转导出、require/import() 和 wx，含能拒绝越层的负样本；同时检查模式来源和入口闭包。工作分支 `codex/**`、main 推送和 PR 执行源码 CI，包含 C1 三项和 P1。双模式原生 WXML/Less 编译、产物隔离与 `check:mode-adapters-runtime` 仍为本机检查，不把 Linux 源码 CI 当成微信编译或手机通过。

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
