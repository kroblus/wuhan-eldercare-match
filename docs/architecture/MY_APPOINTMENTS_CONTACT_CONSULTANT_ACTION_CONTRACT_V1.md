# My Appointments → Contact Consultant Action Contract V1

状态：`FROZEN`

Contract ID：`MY_APPOINTMENTS_CONTACT_CONSULTANT_ACTION_CONTRACT_V1`

Contract 版本：`V1`

Product 版本：`V1.2`

冻结日期：`2026-09-27`

## 1. Purpose and authority

本 Contract 仅冻结“我的预约”卡片中“联系顾问”动作的 V1 语义、状态可见性与后续实现边界。它是现有平台全局顾问公开服务的下游消费者，不重新定义顾问选择、联系方式、Visit 或机构事实。

直接依据按范围解释：

1. `docs/product/README.md` 指向的 V1.2 页面级 PRD 与 MVP 页面方案：要求预约卡操作按业务状态显示，但未给出“联系顾问”的完整五状态矩阵。
2. 项目负责人明确决定：本动作联系平台全局顾问；五状态可见性采用本 Contract §4 的 Option C。**Option C 是 Owner 批准的 V1 政策，不是 Product PDF 已有的矩阵。**
3. `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`、`CONSULTANT_PERMISSION_CONTRACT_V1.md`：全局公开顾问与机构 assignment、公开联系渠道和隐私边界。
4. `APPOINTMENT_PRODUCTION_OWNER_READ_CONTRACT_V1.md`、`APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`：本人 Visit 列表、后端状态事实与生命周期权限。
5. `WECHAT_INTERACTION_CONTRACT.md`：单一 Action 事件链与导航失败恢复。

上游 Frozen Contract 的既有语义不因本 Contract 改写。本文中“必须／禁止”约束后续消费者；本次冻结本身不表示按钮已实现。

## 2. Owner decisions and action identity

```text
OWNER_DECISION_1 = GLOBAL_PLATFORM_CONSULTANT
OWNER_DECISION_2 = STATUS_VISIBILITY_OPTION_C
MY_APPOINTMENTS_CONTACT_ACTION = OPEN_GLOBAL_CONSULTANT_SERVICE
CONTACT_ACTION_DESTINATION = GLOBAL_CONSULTANT_PUBLIC_SERVICE_SURFACE
CURRENT_ROUTE = /pages/consultant/index
```

“联系顾问”表示进入**平台养老顾问服务入口**。它不表示联系本次预约的负责人、该机构的专属顾问或负责带看的顾问。卡片可以使用“联系顾问／平台养老顾问”等不暗示专属关系的表述；不得写成“您的专属顾问”“本次预约顾问”“该机构顾问”等缺乏绑定事实的文案。

此动作不是直接拨打电话、请求顾问回拨、提交预约、创建联系请求或确认顾问在线。成功导航只证明打开了公开服务页面，不证明真实顾问、电话或二维码当前可用，也不证明预约已确认。

## 3. Consultant authority and identity minimization

全局顾问仍由现有显式平台配置 `platform_primary_consultant`、顾问验证和 Global Consultant Public Snapshot 决定。顾问公开信息与可用性只由现有 Global Consultant Application／Page 展示；预约卡不得读取原始 `ConsultantProfile`、全局配置、号码来源或二维码内部资料，不得复制其状态机。

本动作**禁止**调用 Institution assignment resolver、Institution DEFAULT_CONSULTANT fallback 或按 `institutionId`、`recordRevision`、Visit 推断顾问。C1 允许 Visit 在另有授权解析时携带可选的权威 `consultantId`；这一既有语义保持不变，但本动作不读取、不要求、不返回、不推导该值。`Visit → Consultant`、`Institution → Appointment Consultant` 绑定均非本动作的 V1 前置条件；不得为此在 Visit 或 owner-read 中新增 `consultantId`、assignment ID 或等价权威字段。

打开全局页不需要转发 `userId`、`elderId`、`visitId`、`institutionId`、`recordRevision`、User.phone、评估答案、Visit 对象、备注或运营记录。导航来源不能成为全局顾问选择的 authority。

## 4. Owner-approved Visit-status visibility

My Appointments 必须以 owner-read 提供的**后端权威 Visit status**应用下表；不得按日期、页面状态、评价存在与否或用户点击推断状态。

| Visit status | “联系顾问”卡片入口 | V1 来源 |
| --- | --- | --- |
| `requested` | `SHOW` | Owner-approved Option C |
| `contacting` | `SHOW` | Owner-approved Option C |
| `scheduled` | `SHOW` | Owner-approved Option C |
| `completed` | `SHOW` | Owner-approved Option C |
| `cancelled` | `HIDE` | Owner-approved Option C |

`SHOW` 只决定**该预约卡入口**的呈现，不保证全局顾问联系渠道可用。`completed` 显示入口不重开 Visit，且必须与现有 Evaluation 入口并存，不互相替代。`cancelled` 隐藏该卡入口，不删除历史 Visit、不改变取消状态，也不禁止用户从其他合法入口访问平台顾问 Tab。五种状态的业务意义与合法转换继续由 Appointment／Operations 边界决定。

## 5. Destination and interaction

现有 `/pages/consultant/index` 是 Tab 页。后续实现必须通过 `wx.switchTab` 打开它，不得对该 Tab 使用 `wx.navigateTo` 或发明第二条顾问路由。卡片 Action 必须遵守既有小程序交互契约：一次物理点击最多一个页面 Action 和一次导航；快速连续点击不得重复 `switchTab`；同步异常或导航失败释放保护、给出可见失败反馈并允许重试。返回来源页后应能再次执行合法 Action。不能靠防重锁掩盖重复的组件事件通道。

点击卡片只负责导航，不直接读取顾问电话／QR，也不自动触发目标页现有的独立“授权手机号用于后续联系”控件。My Appointments 本人的 owner-read 登录边界保持不变；访问现有公开顾问页不新增二次登录要求。

## 6. Contact data, unavailable state and privacy

`CONSULTANT_PUBLIC_PHONE`、`USER_PHONE`、`INSTITUTION_OFFICIAL_PHONE` 是三种不同身份，不得互相替代或 fallback。顾问公开电话、经批准的企业微信 QR 是否可展示、可拨打，只由现有 Global Consultant public-safe snapshot 及其 active、approved、expired、invalid、unknown 等规则决定。本 Contract 不新增电话或 QR 权威。

卡片点击不调用 `wx.getPhoneNumber`、`/phone/verify`、C6 provider exchange，不创建预约 phone evidence，不读取、保存或要求 User.phone。“请顾问联系我”是另一个需明确目的与授权的潜在业务动作，不由本入口暗含。目标页已有的独立手机号授权控件仍是独立交互，不能由卡片自动启动。

缺少合法全局顾问或联系渠道时，由现有 Global Consultant Page／Application 诚实显示 `missing`、`unavailable`、`inactive`、`expired`、`unknown` 等适用状态；不得硬编码私人号码、使用机构官方电话、机构默认顾问、Visit 假绑定或生产测试数据兜底。生产代码不得导入合成顾问、合成电话、合成 QR 或 TEST_ONLY 配置。

## 7. Visit lifecycle and cross-domain isolation

用户点击“联系顾问”**不等于**权威 Visit 状态 `contacting`。导航不写入 `requested`、`contacting`、`scheduled`、`completed`、`cancelled`，不调用 Operations mutation，不创建 Visit、联系请求、回执或运营审计事实。状态变更仍须满足现有 Backend／Operations 权限与证据。

此动作不修改 Recommendation 的 Safety、Eligibility、Exactness、PriorityFitVector、Rank Tuple 或排序；不修改 Institution 的核验、CareProcess、价格、床位、地图、官方电话或 recordRevision；不读写 Elder 身份、不引入多 Elder、不改变 Evaluation 或用户取消语义。View Institution 的历史版本展示、取消请求及其权限均留给各自后继。

## 8. Downstream consumer boundary

后续小程序实现可在已有 My Appointments 卡片上消费后端 Visit status，按 §4 决定入口呈现，并使用单一 Action 事件链与 `wx.switchTab` 导航到现有全局顾问页。入口本身不需要新 Backend、owner-read DTO、schema、Flyway、顾问 assignment 或 User.phone 集成。全局顾问真实配置／渠道供应属于其现有独立边界，不得因入口可见而伪造可用状态。

合同冻结不等于动作实现；运行时、DevTools、Android 和真实服务证据由后续实施阶段分别验证。

## 9. Mandatory gates

本次冻结验收须确认下表 G01–G18 的**规范已定义且与来源一致**；其中 G12–G13 的实际导航、防重与失败恢复运行证据由后续实现阶段验证，本次 docs-only 冻结不声称已完成运行测试。G07 的矩阵来源必须标为 **Owner-approved Option C**，不能错误归属给 Product PDF。

| Gate | 必须成立的边界 |
| --- | --- |
| G01 SOURCE_IDENTITY | 基线为 `6731528558a16d0d6f1eb0b5a2412df28e86b2cd`；冻结提交只含本 Contract、最小 registry/index 登记，排除七处受保护的既有 `.codex/**` 未暂存改动 |
| G02 PRODUCT_SUPPORT | V1.2 Product 要求预约卡按业务状态展示动作；不虚构 Product 自带矩阵 |
| G03 OWNER_DECISION_INCORPORATED | 全局顾问与 Option C 两项 Owner 决定均完整写入 |
| G04 GLOBAL_CONSULTANT_AUTHORITY | 仅消费现有 Global Consultant public-safe snapshot |
| G05 NO_VISIT_OR_INSTITUTION_ASSIGNMENT | 不查、推断或新增 Visit／Institution 顾问绑定 |
| G06 CONTACT_ACTION_SEMANTIC | 动作为进入平台顾问服务，不等于拨号、回拨或预约事实 |
| G07 STATUS_VISIBILITY_MATRIX | `requested/contacting/scheduled/completed=SHOW`，`cancelled=HIDE` |
| G08 GLOBAL_PUBLIC_SNAPSHOT_AUTHORITY | 公开电话／QR／可用性仍由 Global Consultant Application／Page 决定 |
| G09 MISSING_UNAVAILABLE_BEHAVIOR | 缺失、不可用及失效状态诚实呈现，无虚构 fallback |
| G10 CONTACT_IDENTITY_SEPARATION | 顾问公开电话、User.phone、机构官方电话不混用 |
| G11 USER_PHONE_PRIVACY | 卡片导航不请求、读取或保存 User.phone |
| G12 NAVIGATION_SEMANTICS | Tab 使用 `wx.switchTab`，不使用 `wx.navigateTo` |
| G13 SINGLE_ACTION_INTERACTION | 一次点击最多一次导航；失败释放并可重试 |
| G14 LIFECYCLE_ISOLATION | 点击不产生 `contacting` 或任何 Visit 状态写入 |
| G15 CROSS_DOMAIN_ISOLATION | Recommendation、Institution、Elder、Evaluation、取消语义不受改动 |
| G16 MOCK_PRODUCTION_ISOLATION | 生产无合成顾问、电话、QR 或测试 fixture fallback |
| G17 DOWNSTREAM_CONSUMER_BOUNDARY | 仅预约卡可见性与现有全局顾问 Tab 导航；无 Backend/schema/owner-read 扩张 |
| G18 DOCUMENT_GOVERNANCE_AND_QA | 新 Frozen 文档正确登记、文档检查及独立 QA 通过 |

## 10. Explicit non-goals and successor readiness

本 Contract 不实现卡片按钮，不覆盖 View Institution、历史机构详情、用户取消／Operations、Assessment History、手机号 provider、回拨、正式预约正向发布、跨设备或体验版／发布版验证；不实现或配置真实全局顾问、号码与 QR，也不创建 Visit／Institution 顾问 assignment。

当 G01–G18 通过并完成 docs-only 冻结提交后，才可判断下一实现是否需要单独 Handoff。本 Contract 不授权在本次文档任务中修改小程序或服务端运行时代码。
