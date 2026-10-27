# Warm Swiss UI-0 代表页实现与验收记录

日期：2026-10-07。本文为实现审计记录，不替代产品 Source 或 Frozen Contract。

STATUS = PASS_WITH_RISKS

## 范围与来源

Main session 独立完成；未启动 subagent。视觉依据为本目录 README 与 `WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_1.pdf`，重点对照 PDF 第 15、16、21 页。仅迁移首页、老人基本情况、机构详情及直接共享依赖，未开始第 4 页。

Frozen Assessment V2 的 `basic.primaryCaregiver` 是 single_choice。项目负责人确认本阶段保留冻结单选，将视觉稿中的多选列为偏差。其他字段、stable code、必填规则、条件字段、草稿、校验和导航语义保持原实现。

## UI_FOUNDATION：只读审计结论

1. 已有基础：`styles/tokens.less` 包含品牌/背景/文字/状态色、24/30/34/42/52rpx 字号、8/16/24/32/40/48/64rpx spacing、12/20/28rpx 与 pill 圆角、88rpx 触控尺寸和 card shadow；`mixins.less` 有文字、卡片、触控与 safe-bottom helper。全局 `app.less` 导入 base，三 Tab 由 `app.json` 的原生 tabBar 提供。
2. 可复用：原字体栈、字号基础、spacing scale、12rpx 小圆角、88rpx 触控尺寸、业务 success/warning/error/info 状态色、现有按钮/选项/进度/页脚/导航栏组件，以及 detail display-safe view model。
3. 需要补齐：冻结背景/墨色/细线/terracotta、各 typography role、96rpx CTA、统一 sticky footer reserve、页内编号标题与平面 section presentation。采用原 token 文件中的 opt-in `@ws-*` 别名，没有新增平行样式目录。
4. 重复/收敛：原卡片与页面样式重复声明 margin、border、radius、品牌色；只将三个代表页收敛到有限 scale 和 Warm Swiss 别名。旧 token 值、全局 card helper、app style 未整体替换。
5. 安全 primitive：三个页面复用编号标题/平面页 surface；Basic 和 Detail 复用 sticky footer/safe reserve；现有组件以默认 false 的 `warmSwiss` 属性选择展示。没有新建万能组件。
6. 交互边界：primary-button 与 assessment-footer 的事件链、single/multi choice 的值与事件、navigation-bar 的返回/Tab fallback、Basic clickable Next 与首错滚动、detail 电话/地图/VR/预约 guard 均不能按视觉重写。进度只替换显示，六步路由保持原实现。

## TOKENS_CHANGED

原 `styles/tokens.less` 新增 opt-in Warm Swiss role：background #FBFAF7、surface 白色、ink #111827、secondary #4B5563、muted #6B7280、border #D9D6D0、accent #D9572A、soft #FAEEE8。业务状态色继续使用原语义值，verified 保留绿色。

Typography 覆盖 page/hero/section/field/body/helper/meta/number/CTA；hero 56rpx，其余复用原字号。页边距 40rpx、section gap 48rpx、radius 12rpx、主/次按钮 96rpx、radio/checkbox/input 88rpx、divider 1rpx。Footer reserve 256rpx 加 safe-area；footer 自身包含 safe-area padding。

## SHARED_COMPONENTS_CHANGED

七个既有组件：primary-button、assessment-footer、navigation-bar、single-choice、multi-choice、progress-header、question-section。均通过 `warmSwiss=false` 默认值保留其他页面原展示。radio 使用圆形指示器，checkbox 使用方形指示器；选中态使用 restrained accent 与 soft background。导航栏在 opt-in 模式固定，并保留实际高度占位。

## PAGES

| 页面 | 结果 | 实现与运行证据 |
| --- | --- | --- |
| HOME | PASS | Editorial hero、评估 CTA、合作机构链接、01–03 信息层级、真实来源机构列表、顾问/AI 链接、原生三 Tab。原 loading/error/Mock disclosure 与 handler 保留。 |
| ASSESSMENT_BASIC | PASS | 1/6、六段进度、01–04、adaptive radio/checkbox grid、姓名/数字输入、conditional exit reasons、sticky Previous/Next。首错 anchor 补偿固定 header 实测高度，invalid Next 显示 inline error 且留在原页。 |
| INSTITUTION_DETAIL | PASS | Cover/identity/reference fee/quick actions，01–09 编号内容与细线 key/value，真实 unknown/unverified 状态，sticky 顾问/预约入口。无推荐上下文时不伪造 01 内容。 |

BUSINESS_BEHAVIOR_CHANGED = FALSE

CONTRACT_CHANGES = NONE

说明：新增详情底部“咨询顾问”展示入口使用现有全局顾问 Tab `/pages/consultant/index`，不附带机构顾问分配或虚构 contact source；增加 ready/revision/navigation guards 与可见失败重试。预约沿用原 handler/source/context。Basic 新增 TS 仅测量 header 供视觉 anchor 使用。Detail view model 仅补充四个既有护理经验 stable code 的中文展示标签。Recommendation、backend、verified facts、Assessment definitions、AI、VisitEvaluation 均未修改。

## TESTS

最终批次全部 PASS，摘要见 `../../../output/warm-swiss-ui-0/test-results.json`：

- `check:wechat-ts-targeted-compat`：WeChat TypeScript 4.1.2 静态兼容检查通过。
- `check:assessment-interactions`：44 runtime cases + 2 structural checks。
- `check:institution-navigation-a0-4-interactions`：25/25。
- `check:institution-detail-page-runtime`：32/32。
- `check:institution-detail-v1-2-1-ui-runtime`：39/39。
- `check:institution-detail-v1-2-1-interactions`：16/16。
- `check:warm-swiss-ui0-runtime`：新增顾问入口 state gates、单次导航、失败可见/重试、生命周期与同步异常通过。
- `check:wechat-js-compat`：检查当前 DevTools 实际生成缓存的 159 个 JS module，无不支持的 class-field syntax；使用显式当前缓存参数完成 artifact/freshness 检查。
- `git diff --check`：通过。无 staged changes。

此外已通过首页 AI 入口相关 `check:ai-b6-runtime` 与原预约入口 `check:appointment-create-runtime`。现有 detail structural check 仅同步 CTA 展示文案，原事件绑定断言保留。

## DEVTOOLS

DEVTOOLS = PASS（用户实际点击编译 + Main session MCP refresh、页面运行、WXML 编译摘要与截图检查）

初期项目窗口调用超时且截图只有 2×2 像素。用户显示窗口并回复“已编译”，Main session 重新连接 canonical project 后取得完整 512×1103 PNG。之后 simulator refresh 成功，三个页面均实际渲染，当前 generated JS compat 通过。`compile_wxml` 可用；`compile_wxss` 不接收项目 Less，因此 Less 的验证依据为实际 DevTools 渲染和当前编译产物，没有生成或提交额外 WXSS。

Runtime viewport 为 390px CSS 宽度。检查了首页首屏/机构/帮助与 Tab；Basic 顶部/中部/input/底部 conditional checkbox/inline error；Detail hero/护理/医疗/费用/核验与 footer。Detail 最后正文底部距 footer 顶部实测约 60px；Basic 04 选项、conditional fields、草稿状态均可滚动到 footer 之上。

Basic selected/input/error 截图使用显式测试状态；测试结束后恢复原草稿值并删除临时备份。没有把截图中的选中答案写成默认值。机构截图使用原开发 Mock 数据集，继续显示 Mock provenance。

MCP 坐标点击受 `App.CDPEnable` 不支持限制，组件内部 selector 也不能跨隔离边界。Radio/Checkbox 使用组件公开事件触发，输入使用 element input，Next 使用页面现有 method；实际 handler、状态、草稿与页面停留均验证。此证据不等同真实触屏点击，通过相关 runtime event-chain tests 补充验证。

### 截图证据

以下路径均相对仓库根目录，原图来自 DevTools Simulator：

总览：`output/warm-swiss-ui-0/evidence-overview.png`（三张首屏原图缩放拼接，标注测试与 Mock provenance）。

- `output/warm-swiss-ui-0/home-first.png`
- `output/warm-swiss-ui-0/home-institutions.png`
- `output/warm-swiss-ui-0/home-help-tabs.png`
- `output/warm-swiss-ui-0/basic-top.png`
- `output/warm-swiss-ui-0/basic-middle-input.png`
- `output/warm-swiss-ui-0/basic-bottom-checkbox.png`
- `output/warm-swiss-ui-0/basic-inline-error.png`
- `output/warm-swiss-ui-0/detail-top.png`
- `output/warm-swiss-ui-0/detail-care.png`
- `output/warm-swiss-ui-0/detail-middle.png`
- `output/warm-swiss-ui-0/detail-fees-verification.png`
- `output/warm-swiss-ui-0/detail-bottom.png`

ANDROID_17_MANUAL_GATE = PENDING

## VISUAL_DEVIATIONS

- 主要照护者保留 Frozen single-choice Radio，项目负责人已确认；checkbox 代表状态由原 conditional 离院原因展示。
- 保留现有 Mock 名称/参考费、未知与核验状态、来源说明；无真实图片时使用资料占位，不复制 PDF 合成照片/价格/床位。
- Detail 保留 Contract 要求的细分状态、版本、来源与说明，实际内容比 PDF 更长；直接入口没有推荐上下文时不显示虚构推荐理由。
- 三个 Bottom Tabs 使用原生实现与原配色/文字，不新增 PDF 图标或改变 tab 行为。
- 细行因状态说明与较长标签可换行；以可读性与真实信息优先，不做像素级复制。

## AFFECTED_OTHER_PAGES

NONE。旧 token 值及全局 style 不变；组件 opt-in 属性默认 false。其余 20 页未迁移，相关页面行为未改变。

## RISKS 与工作区边界

- Android 17 真机未取得直接证据，保留最终全量 UI closeout 的人工 Gate。
- 本阶段实际截图验证 390px CSS viewport；其他设备宽度与真实触屏仍需后续人工检查。
- 电话/地图/VR 按当前资料不可用或待确认，不把不可用动作声称为真实服务调用成功；相关 guard 由既有 interaction tests 覆盖。

UNTOUCHED_PRE_EXISTING_CHANGES = PRESERVED：原有 `.codex/agents/backend_domain.toml`、`matching_engine.toml`、`qa_reviewer.toml`、`.codex/config.astra-pilot.example.toml`、`config.sol.example.toml`、`config.toml` 及原 `output/pdf` 均未改动、restore、reset、checkout 或 stage。

DOC_IMPACT = AUDIT_ONLY

READY_FOR_WARM_SWISS_UI_1 = TRUE（技术基础与三个代表页可供审阅；进入 UI-1 仍等待项目负责人确认视觉结果）

没有 commit，没有自动进入剩余 20 页迁移。

VISUAL_BASELINE_CONFLICT_RESOLVED = WARM_SWISS_UI_FINAL_AUDIT_CODEX_HANDOFF_V1_2.pdf
