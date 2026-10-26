# 页面与物理路由注册表

`miniprogram/app.json` 是物理 route 的 runtime truth。本文只提供人类与 Agent 可读的同步注册表，
不记录项目进度、实现完成度或阶段顺序，也不授权增加尚未注册的 route。

“老人档案”使用列表和详情两个物理 route；顾问 Tab 与保留父栈的咨询页复用同一实现。当前共有 27 个物理 route（含 3 个仅开发构建可用的隔离功能演示 route）。

| 业务页面 | 物理 route | 类型 | 稳定用途 |
|---|---|---|---|
| 首页 | `pages/home/index` | Tab：首页 | 产品入口与主要服务入口 |
| 评估说明 | `pages/assessment/intro` | Non-Tab | 进入评估前的说明 |
| 老人基本情况 | `pages/assessment/basic` | Non-Tab | 采集基本情况 |
| 健康情况 | `pages/assessment/health` | Non-Tab | 采集健康相关答案 |
| 日常生活能力 | `pages/assessment/adl` | Non-Tab | 采集 ADL 答案 |
| 认知与特殊护理 | `pages/assessment/cognitive` | Non-Tab | 采集认知与特殊护理答案 |
| 养老需求与偏好 | `pages/assessment/preference` | Non-Tab | 采集入住偏好 |
| 预算与入住计划 | `pages/assessment/budget` | Non-Tab | 采集预算与入住计划 |
| 老人需求画像确认 | `pages/assessment/profile` | Non-Tab | 展示评估画像 |
| 评估结果与机构推荐 | `pages/recommendation/result` | Non-Tab | 展示推荐结果 |
| 合作机构列表 | `pages/institution/index` | Non-Tab | 展示机构列表 |
| 机构详情 | `pages/institution/detail` | Non-Tab | 展示机构详情 |
| VR 看院 | `pages/institution/vr` | Non-Tab | 展示可用的 VR 看院入口或对应状态 |
| 养老顾问 | `pages/consultant/index` | Tab：养老顾问 | 顾问服务入口 |
| 跨页咨询顾问 | `pages/consultant/consultation` | Non-Tab | 机构详情、预约结果的公开顾问入口；返回既有父页 |
| 养老咨询助手 / FAQ | `pages/service/ai-chat/index` | Non-Tab | 公共 FAQ 与咨询说明 |
| 预约看院 | `pages/appointment/create` | Non-Tab | 发起预约申请 |
| 预约成功 | `pages/appointment/success` | Non-Tab | 展示预约申请结果 |
| 我的 | `pages/mine/index` | Tab：我的 | 匿名个人服务记录入口；老人档案、我的评估、我的预约分别以guard导航至既有non-Tab页，帮助沿用顾问Tab；本页不提前认证/读取记录 |
| 老人档案列表 | `pages/elder/index` | Non-Tab | 展示老人档案列表 |
| 老人档案详情 | `pages/elder/detail` | Non-Tab | 展示老人档案详情 |
| 我的评估 | `pages/assessment/history` | Non-Tab | 独立 C5 History 元数据 Provider；未配置保持 UNAVAILABLE。隔离 TEST_ONLY 分支支持显式保存、历史画像与 Formal Recommendation 不可变快照的内联只读查看，以及已保存未修改草稿经确认切换到独立空会话的 Intro 入口；未保存修改/未知状态保留并阻断，原列表位置保留，无新路由，生产操作不开放 |
| 我的预约 | `pages/appointment/index` | Non-Tab | 展示预约记录入口 |
| 看院评价 | `pages/visit/evaluation` | Non-Tab | 展示既有看院评价能力 |
| 功能演示（开发专用） | `pages/showcase/index` | Non-Tab | 隔离开发入口；无正式产品入口，trial/release 构建关闭 |
| 全景技术演示 | `pages/showcase/vr-real` | Non-Tab | 原生 Canvas WebGL；本地授权脱敏全景或显式几何校准纹理，不关联机构 |
| 武汉地图技术演示 | `pages/showcase/map-real` | Non-Tab | 原生 map 城市底图；无机构点位、用户定位或导航 |

开发者工具使用指定页编译直接进入 `pages/showcase/index`。这三页使用独立开发导航白名单与自定义导航区域，返回只到演示首页，不提供 History、预约、评价、评估保存或正式机构页面出口。注册 route 不代表新增公开产品功能、独立 TEST AppID、生产授权或安全复演 Gate 已完成；整工程默认启动和热编译仍须按开发安全运行说明审计。普通产品页面不链接演示入口。

机构详情与预约结果通过 `navigateTo` 打开 `pages/consultant/consultation`，不转发机构、画像或预约数据。父页面保留原实例，返回使用 `navigateBack`；咨询页单独处于根栈时，返回箭头通过 `switchTab` 打开顾问 Tab。主动 Tab 切换仍使用微信原有语义。

AI/FAQ 人工转接与我的预约卡片联系顾问仍按各自 Frozen Contract 使用 `switchTab`；对应 successor 明确批准前，不将非 Tab 入口推广到这两处。

机构详情的“看院常见问题”通过实例级导航保护 `navigateTo` 打开既有 `pages/service/ai-chat/index`，不附带 query 或老人、推荐、机构上下文；返回保留详情原实例。当前该页仅使用获准公共 FAQ，未接入在线模型或个性化快照。

顾问页“选择合作机构”优先寻找当前页面栈中最近的机构目录祖先，一次 `navigateBack(delta)` 返回其原实例，保留目录的 direct/recommendation 来源和浏览上下文；没有目录祖先时使用一次 `navigateTo` 打开正常目录。无效预约入口的目录出口同样优先返回既有目录；没有目录祖先时使用 `redirectTo` 替换无效预约页，按钮显示“重新浏览合作机构”。不会在一次操作中组合多种导航 API。

六步 Assessment 仍使用现有六个物理路由。返回文案依据实际父页面显示，根栈则依据既有业务 fallback；中途续填父页为 Intro 时显示“返回评估说明”。文案调整不创建前序步骤、不改变 Back/Next 校验或 Draft。父栈和根栈的返回失败均提供可见反馈并允许重试。

Scope A 评估阶段导航按已签署 B01-D successor 实施：Budget 本组校验、全评估完成门禁及本机保存全部成功后，一次 `reLaunch` 打开现有 Profile 路由，Profile 成为真实根。Profile 根箭头及“返回首页”使用 Home Tab 的 `switchTab`；非根箭头返回实际父页。六组修改优先返回合法且容量安全的步骤祖先，无祖先且安全时 `navigateTo` 保留真实 Profile 父页。

Assessment/Profile 重新进入题组及前五步 Next 按实际栈、所选 API 和剩余步骤检查容量。不足时先确认离开当前浏览路径，取消不导航；确认后只 `reLaunch` Intro。一次性目标只携带稳定 step 和合法 Assessment/Profile 来源；Intro 显示目标，另一次显式操作重验后才 `navigateTo`，不自动进入、不持久化意图、不修改 Draft Schema/currentStep。普通独立根 Intro 的既有 `redirectTo` 分支保留。

独立深 Profile/Result/Institution/Appointment 业务链属于 Scope B，重置及上下文迁移仍延期；Profile 的推荐入口在实栈已满或来源不是当前有效页时只给出可见反馈，不执行已知不安全的 push，不发起业务 reset 或迁移。上述局部阶段导航不能解释为全局栈安全、Android 真机验收或生产激活。签署合同状态与登记不由源码实施自动转换。

预约受理回执仍由有效的当前 Create 页面 `redirectTo` 申请结果，替换表单。页面实例已卸载、隐藏或不再是当前栈顶时，迟到回执不得改变当前页面；阻止页面跳转不取消已发出的业务请求，不将已受理回执表示为失败。保留在栈中的 Create 再次显示时可继续打开已收到的结果。


TEST_ONLY History cold-start recovery: explicit save prepares a server-bound random intent and verifies metadata-only local persistence before sending answers. History opens with scope-checked reconciliation and an explicit retry-query action; unknown results block new submission. No new page route or production save entrance. The scoped backend `save-intents/scope`, `save-intents`, `save-intents/reconcile` endpoints reuse C5 + sole Elder transaction authorization and completion metadata; V4 runs only in the existing isolated disposable migration chain. Proposal policy/details: `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`. No Frozen or Draft semantics changed.


TEST_ONLY Session lifecycle: D03/D04 approved behavior is implemented only in the isolated History operation area; the whole History proposal remains PROPOSED_NOT_FROZEN. V5 adds immutable AssessmentSession → SaveIntent → CompletedAssessment associations. Same-session preparation/replay never creates a second completion. Initial registration allows one scoped root; explicit `assessment-sessions/new` requires an authorized completed predecessor and idempotently returns one successor for the durable candidate context. Save acknowledgment retains Draft. The private confirmation action can replace the existing single active slot only after trusted original-payload ACK evidence, unchanged answers and fresh C5/Elder checks; cancel/edited/pending/unknown/cold-proof-missing states preserve and block. `history-assessment-session.ts` stores only non-sensitive context/transition metadata, with SWITCH_REQUESTED readback before the new-session request and SWITCH_PREPARED before single-slot CAS. No clear/reset, new sensitive local backup, formal Recommendation UI, production route or real-user enablement. Existing Intro → Basic navigation is reused. Cold-start reconciliation remains supported; lack of content evidence never becomes permission to replace Draft. See the latest Owner decision update and Session lifecycle boundary in `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`.


Decision alignment TEST_ONLY increment: the latest D01–D12 approval levels and formal-release plan are in the current register and Release Readiness section of COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md, still PROPOSED_NOT_FROZEN. History Save now opens a private single-use confirmation; cancel creates no intent/upload, confirmation rechecks answers/C5/sole-Elder/environment. It explicitly disclaims equality with the anonymous Preview and is not sensitive-data consent. Owner-scoped POST assessment-sessions/inspect-context reads only workflow state; missing/corrupt recovery markers block resubmission, and ALREADY_PREPARED cannot become a fresh request. V6 preserves non-sensitive context provenance with a unique claim to prevent cross-scope reassignment of inherited Draft contexts; no answer/history backfill, cleanup or production migration. Unassociated legacy intents/completions fence new allocations (RECOVERY_REQUIRED/LEGACY_RECOVERY_REQUIRED) while old authorized reads, original late completion and replay remain available. Existing A→B and cold recovery stay; late list/detail/Recommendation replies recheck current scope. Scope GET uses base isolated History authorization for metadata-only reads; prepare/reconcile still require user-loop. No formal Recommendation UI, route, real identity, sensitive consent/deletion or production enablement is implemented. Human recovery channel/terminal closure, D08 release/retention, D09 final fields, D10 real source and D11/D12 detailed processes still require approval.

Controlled Result Save UI uses the existing recommendation/result and assessment/history routes; no new route registration. A quiet block after Consultant CTA can show separate server-trusted synthetic Profile/Recommendation projection and D02 save only after independently reviewed TEST build plus server C5/sole-Elder gates. Anonymous upper cards remain local, and normal build remains null/hidden with no passive login. The existing guarded History route reads committed immutable snapshots; pending saves reconcile original intent. Independent TEST AppID/package evidence remains unavailable, so actual device submit is blocked. See Controlled Result UI and trusted Preview binding in COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md (PROPOSED_NOT_FROZEN), and FRONTEND_STRUCTURE.md for application boundaries.
