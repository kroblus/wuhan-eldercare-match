# Phase V1.2-B3 Implementation Handoff — Consultant UI Integration

状态：`FROZEN_PHASE_V1_2_B3_DEFINITION`

更新日期：2026-09-16

```text
NEXT_PHASE_ID = V1.2-B3
NEXT_PHASE_NAME = Consultant UI Integration
B3_PHASE_KIND = USER_VISIBLE_MINIPROGRAM_UI_INTEGRATION
B3_PHASE_DEFINITION = PASS
B3_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B3 = NOT_STARTED
GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_IMPLEMENTATION_LEVEL
PRE_B3_DEFINITION_HEAD = bef85de95863920a34a7b7fcb047097b19a575aa
EXISTING_IMPLEMENTATION_CONFLICT = NONE
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_CODE_CHANGE_BY_DEFINITION_TASK = 0
RUNTIME_CODE_CHANGE_BY_DEFINITION_TASK = 0
TEST_CODE_CHANGE_BY_DEFINITION_TASK = 0
READY_TO_START_V1_2_B3 = TRUE
```

本文是 B3 的 phase boundary 与 implementation handoff，不是新的业务 Contract，不覆盖 B1 Consultant/Permission、B2/B2.1
Foundation 或 Current Product Source。本定义任务不授权、也不包含任何 production/runtime/test/mock code change。

## 1. Authority and Transition

B3 的直接依据是：

1. Current Product Source V1.2 中的独立养老顾问页面、平台顾问电话、企业微信二维码与预约带看入口；
2. frozen `CONSULTANT_PERMISSION_CONTRACT_V1.md`；
3. frozen `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md`；
4. frozen `V1_2_B2_1_IMPLEMENTATION_HANDOFF.md` 与已通过的 B2.1 Global Foundation；
5. `FRONTEND_STRUCTURE.md`、`MOCK_DATA_POLICY.md`、`WECHAT_INTERACTION_CONTRACT.md`；
6. 当前 `/pages/consultant/index` 与 `/pages/appointment/create` 安全 scaffold。

正式转换链：

```text
V1.2-B1 Consultant/Permission Contract = FROZEN
  -> V1.2-B2 Institution-bound Foundation = PASS
  -> V1.2-B2.1 Global Consultant Snapshot Foundation = PASS
  -> GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_IMPLEMENTATION_LEVEL
  -> V1.2-B3 Consultant UI Integration = READY_TO_START
```

B2.1 已为无 Institution context 的 Tab 提供独立、versioned、public-safe Application result。此前阻止 B3 definition 的
`GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY` 已关闭；B3 不再重新讨论 Global selection、Institution assignment 或
`DEFAULT_CONSULTANT`。

## 2. Goal

B3 只把 B2.1 `GlobalConsultantPublicApplicationResultV1` 接入 `/pages/consultant/index`，形成真实用户可见的养老顾问页：

```text
explicit platform global configuration
  -> B2.1 Global Consultant Foundation
  -> public-safe Global Consultant Application result
  -> B3 Page ViewModel mapping
  -> WXML
  -> allowed WeChat user actions
```

Page/ViewModel 不选择 Consultant，不解释 assignment/default，不重新判断 profile、phone 或 QR eligibility，也不读取 raw
Provider record。B3 的完成目标是 UI mapping 与 interaction integration，不是 Consultant、Backend、Appointment 或媒体平台实现。

## 3. Preconditions

B3 implementation 开始前必须保持：

- `PHASE_V1_2_A1_5 = PASS`；
- `PHASE_V1_2_B1 = PASS`，Consultant/Permission Contract frozen；
- `PHASE_V1_2_B2 = PASS`，Institution-bound Foundation unchanged；
- `PHASE_V1_2_B2_1 = PASS`，Global Foundation complete；
- `GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_IMPLEMENTATION_LEVEL`；
- 当前 Consultant route 仍是 `pages/consultant/index` Tab；
- 当前 Appointment route 仍是 `pages/appointment/create` non-Tab honest scaffold。

任何前置 frozen semantics 的变更都不属于 B3；必须单独 impact analysis，而不是由 Page 代码吸收。

## 4. Current Scaffold Baseline

当前 `/pages/consultant/index` 已提供安全 scaffold：Tab 壳层、顾问服务说明、无虚构数据的 empty state、预约入口与可见导航
失败反馈。它没有读取 raw Consultant 数据，也没有制造 phone/QR，因此不存在必须在 definition task 中修复的 Frozen Source 冲突。

B3 implementation 应增量复用现有 navigation bar、page container、section/state components 和诚实文案边界，并：

- 用 Global Application result 驱动的 ViewModel 替换静态 Consultant 数据状态；
- 保留或收敛现有预约 scaffold 入口，不重建整个页面结构；
- 为 phone、预约导航与 reload 增加符合 interaction Contract 的 guard、失败反馈和 retry；
- 不因 UI 接入修改 B2/B2.1 runtime semantics。

当前 `/pages/appointment/create` 明确表示“真实提交待接入”，不创建预约记录、不索取 User.phone、不导航到成功页。B3 可将
它作为薄导航目标，但不能把该 scaffold 描述成正式预约已提交或机构已确认。

当前 production global provider、真实 Consultant phone 和 approved QR 尚未准备，属于非阻塞 implementation dependency。B3
必须在缺少这些依赖时完成安全 missing/unavailable UI；不得以缺少真实数据为理由接入 synthetic production data，也不得把
Backend/operations implementation 扩入 B3。

## 5. In Scope

B3 production implementation 只允许覆盖以下能力：

1. `/pages/consultant/index` Page、WXML、Less 与必要 JSON/component registration；
2. 纯 Page ViewModel/display mapping，将 B2.1 public-safe success/failure 映射为稳定 UI state；
3. 调用 B2.1 Global Application capability 的最薄 Service/Application composition；
4. 顾问公开身份、平台角色、合法服务范围和 Product Source 服务说明；
5. 平台养老顾问 phone display 与 eligible `wx.makePhoneCall` action；
6. public-ready enterprise WeChat QR image 与平台原生长按识别能力；
7. available/unavailable/inactive/expired/unknown/missing/public-safe failure 的诚实展示；
8. 匿名访问与 no-User.phone/no-login privacy boundary；
9. 到现有 `/pages/appointment/create` scaffold 的薄导航；
10. B3-only test fixture、ViewModel/runtime/interaction checks、targeted compatibility 与 evidence；
11. 对既有 Home、Recommendation 与 Institution VR `switchTab` 入口不被破坏的 smoke evidence，不新增或重构入口。

最薄 Service/Application composition 只能返回 B2.1 定义的 public-safe result。若没有权威 production Global Consultant
configuration/provider，它必须 fail closed 或返回 Contract 合法的 missing/unavailable state；不得在 Page 内构造 raw profile、
选择 Consultant、启用 test fixture，或借此冻结 Backend endpoint/storage protocol。

## 6. Out of Scope

B3 不包含：

- Home、Recommendation Result、Institution Detail 或其他页面的新 Consultant entry/integration；
- Institution-bound Consultant UI；
- Global selection、Institution assignment 或 `DEFAULT_CONSULTANT` 语义修改；
- Backend API、database、persistence、production provider infrastructure 或 operations console；
- login/authentication/authorization 或 User.phone consent；
- 正式 Appointment Domain、submission、confirmation、record、persistence 或 Backend；
- AI Assistant、InstitutionVisit、VisitEvaluation、CRM；
- QR upload、approval、storage、CDN、signing 或 rotation；
- 真实 Consultant/phone/QR 的运营录入；
- Recommendation V2 或 Institution verified semantics 修改；
- B3 successor 的编号、命名或冻结。

已有 Home、Recommendation 与 Institution VR cross-entry 可做不破坏 smoke；B3 不借此扩展 cross-entry 业务范围。

## 7. Layer and Ownership Boundary

稳定调用方向：

```text
B2.1 GlobalConsultantPublicApplicationResultV1
  -> B3 pure display/ViewModel mapping
  -> Page state
  -> WXML
  -> explicitly eligible WeChat action
```

### 7.1 Domain/Application ownership

B1/B2/B2.1 继续独占：

- Global Consultant selection；
- Institution assignment 与 default fallback；
- raw ConsultantProfile validation；
- profile/service eligibility；
- public phone eligibility 与 dial value；
- public QR/media eligibility 与 public image URL；
- public-safe Application result/failure boundary。

### 7.2 ViewModel/Page ownership

ViewModel 只负责：

- public display copy 与 label；
- section visibility；
- action enabled/disabled；
- loading、empty、unavailable、error 的 display-safe state；
- 将 Application-facing stable state 映射为 WXML 所需的 primitive fields。

Page 只负责 lifecycle、调用 Service/Application、`setData`、guarded action、微信 API 与可见 failure feedback。WXML 不执行
Domain 判断，不读取 raw record，不根据空字符串猜 eligibility。

### 7.3 Provider boundary

B3 MAY 增加最薄的前端 application composition seam 以取得 B2.1 public result；它不得暴露 raw provider/config/profile，且不得
冻结未来 Backend API/DTO/transport。当没有 authorized production source 时，composition 只允许产生 B2.1 合法的
missing/unavailable/public-safe failure。真实 provider infrastructure 仍属后续 Backend/operations scope。

## 8. ViewModel and Stable UI States

ViewModel 必须 deterministic：相同 Global public result 产生深等价 display state，不读取隐式 Institution、route query、storage、
User.phone 或 test fixture。

| Application condition | UI obligation | Prohibited interpretation |
|---|---|---|
| `ok: false` public-safe failure | 可见的暂不可用/加载失败状态；允许用户显式 reload | 不展示 internal cause/provider detail；不伪装为业务 `missing` |
| selection/profile `missing` | 诚实表达尚未配置/暂未提供 | 不使用 Institution default 或任意顾问补位 |
| `unknown` | 表达当前无法确认 | 不压平成 inactive/false |
| `inactive` | 表达当前不提供公开服务；无 contact action | 不显示为 active consultant |
| `unavailable` | 表达当前不可用；保留每个 channel 自己的状态 | 不生成 phone/QR |
| `expired` | 表达公开渠道已过期/待更新；只保留仍 eligible 的另一 channel | 不显示过期 QR |
| `available` | 展示合法 identity 与各自 eligible channels | 不承诺两种 channel 均存在 |

合法 active public profile 可在 phone/QR 均不可用时继续显示公开 identity；phone 与 QR visibility/action 必须独立映射。B3
不得把 overall state 当作第二套 eligibility rule。

## 9. Consultant Identity and Copy

页面只展示 Snapshot/Product Source 支持的：

- 顾问公开 display identity；
- “养老顾问”或“带看顾问”的平台角色；
- 合法 public service scope，例如已投影的武汉服务范围；
- Product Source 已定义的服务说明。

不得创造从业资格、医疗身份、核验认证、机构员工身份、合作承诺或其他未进入 public Snapshot 的事实。平台 phone 的 label 必须
明确是“养老顾问电话”或等价平台身份，不得写作“养老院电话”“机构官方电话”或“机构联系电话”。

## 10. Phone Display and Interaction

Phone section 只消费 `ConsultantPublicPhoneProjectionV1` 的 public label、display value、dial value 与 action eligibility：

- `PLATFORM_CONSULTANT_PHONE != INSTITUTION_OFFICIAL_PHONE`；
- Page 不读取 Institution phone，不硬编码号码，不使用 fixture/raw profile phone；
- Page 不自行 normalize、validate 或重写 dial value；
- unavailable action 不绑定可执行 phone handler，或 handler 必须在 API 前 fail closed；
- eligible 单次物理点击最多调用一次 `wx.makePhoneCall`；
- in-flight rapid tap 被 guard 拒绝；
- `success/fail/complete` 后状态可确定释放，失败后允许下一次独立点击重试；
- `fail` 与同步 exception 必须释放 guard，并给出用户可感知的 failure feedback；
- implementation 必须核对当前官方 typings，不用 `as any` 绕过 API shape。

一次成功完成不代表永久禁用 phone；“不重复触发”只约束同一次 action/in-flight 链路。

## 11. Enterprise WeChat QR Display

只有 Snapshot 的 public QR projection 已提供 eligible `publicImageUrl` 时，UI 才展示有效企业微信二维码。B3：

- 不重新检查 approval/lifecycle/expiration/media source；
- 不读取或展示 internal media ID/storage locator；
- 不创建 placeholder、fake URL 或 synthetic production QR；
- pending/rejected/expired/unavailable/unknown/missing 不显示为 public-ready；
- 可使用微信 image 的平台原生长按菜单能力支持识别，但不新增“点击即添加”逻辑；
- 文案不得保证用户长按/识别后一定成功添加企业微信；
- QR unavailable 时保留仍 eligible 的平台 phone；两者均不可用时显示安全诚实的 unavailable state。

QR 本身没有业务 API side effect 时，不为满足 interaction Gate 人为增加 tap handler。

## 12. Permission and Privacy

`/pages/consultant/index` 是匿名可访问的公开服务页面。打开页面、查看 Consultant identity、phone 或 QR：

- 不要求登录；
- 不请求、读取、保存或推断 User.phone；
- 不创建 Appointment/contact/persistence record；
- 不记录 raw profile、完整 phone payload、internal media locator、provider detail、Secret 或 private notes；
- 不把“查看平台顾问公开电话”解释为“授权获取用户本人手机号”。

UI 只能消费 public-safe result，技术错误只显示稳定公开错误，不泄露 stack/internal cause。

## 13. Appointment CTA Boundary

Product Source 包含“预约带看”入口，当前 repo 已注册 `/pages/appointment/create` honest scaffold。因此 B3 将 CTA 纳入 scope，
但只允许：

- `wx.navigateTo('/pages/appointment/create')` 的薄导航；
- 单次 action 最多一次 navigation API；
- rapid tap guard；
- navigation fail 可见反馈、guard release 与 retry；
- 从 scaffold `navigateBack` 返回 Consultant Tab；
- CTA/目标页文案继续说明正式提交尚未接入。

禁止声称预约已提交、已确认、机构已接受或已保存；禁止在 B3 增加表单、User.phone、record、success page 或 Backend side
effect。

## 14. Required Interaction Matrix

| Action | Element / eligibility | Handler and side effect | Guard / disabled / loading | Failure and retry | Navigation |
|---|---|---|---|---|---|
| Initial load | Page lifecycle | 调最薄 Application composition，映射 public result | 仅围绕真实调用显示 loading；不制造假延迟 | public-safe error 可见；显式 reload 可重试 | none |
| Reload | error/unavailable retry control | 每次 action 最多一次 application reload | in-flight disabled/guarded | 失败保留公开错误；完成后可再试 | none |
| Phone | ViewModel `phoneActionAvailable = true` | 每次 action 最多一次 `wx.makePhoneCall` | in-flight guard；不可用时 disabled/hidden | fail/exception 可见、释放 guard；下一次点击可重试 | none |
| Unavailable phone | no eligible dial value | 不调用 phone API | disabled/hidden | 显示合法 unavailable copy | none |
| QR | public-ready image only | 显示图片和平台原生长按能力；无自定义 tap side effect | no artificial loading | 不承诺识别/添加成功；不可用时不展示有效 QR | none |
| Appointment CTA | existing honest scaffold route | 每次 action 最多一次 `wx.navigateTo` | navigation guard；in-flight duplicate rejected | fail/exception 可见、释放 guard；可重试 | `/pages/appointment/create` |
| Return from appointment | target page/back control | 不创建业务记录 | platform navigation state | platform failure 如可观察则诚实反馈 | `navigateBack` to Consultant Tab |
| Tab entry/switch | registered Consultant tab | existing `switchTab` consumer reaches same Page | existing guarded entry behavior unchanged | existing consumer feedback unchanged | tab semantics; no fake back stack |
| Consultant Tab root Back | navigation bar/root page | no custom back action | back control disabled；no handler | none | no-op；不制造上一页 |

任何新增/修改 Action 在 implementation 完成前必须核对 WXML event chain、handler count、wx API callbacks、Back/Tab semantics 与
error visibility。共同 invariant：`1 physical tap -> 1 handler chain -> at most 1 wx/navigation API call`。

## 15. Global / Institution UI Context Isolation

B3 必须保持：

```text
GLOBAL_UI_CONTEXT_ISOLATION = PASS
institutionId dependency = 0
recordRevision dependency = 0
Institution assignment resolver calls = 0
Institution default fallback calls = 0
Institution official phone fallback = 0
Institution data mutation = 0
```

Page/route query/ViewModel 不得重新引入 Institution identity。Home/Recommendation `switchTab` 只是 navigation consumer，不是
Global selection input，也不赋予 Recommendation matching role。

## 16. Mock and Real-data Boundary

B3 automated tests MAY 使用显式 test-only public result/ViewModel fixture 覆盖 phone-ready、QR-ready、phone-only、QR-only、
inactive、expired、missing、unknown、unavailable 与 technical failure。但：

- fixture 只存在于 test/runtime gate，不进入 production import graph；
- synthetic phone/QR/config/profile 不成为 production truth；
- production 缺少真实 global config/phone/approved QR 时，真实 App 只能显示 Contract 合法的 missing/unavailable state；
- Fresh DevTools 与 Android 不得通过注入 production fixture 获得正向 phone/QR；
- 自动化正向 fixture evidence 与 production real-device reachability 必须分开报告。

## 17. Mandatory Implementation Gates

未来 B3 implementation 必须全部满足以下 Gates，才能输出 `PHASE_V1_2_B3 = PASS`。

### Gate 1 — B1/B2/B2.1 Conformance

- Page 只消费 B2.1 public-safe result；
- no raw config/profile/provider/assignment/default access；
- no duplicate phone/QR eligibility；
- frozen sources 无 semantic diff。

### Gate 2 — Page/ViewModel Runtime

至少覆盖 available、phone-only、QR-only、unavailable、inactive、expired、unknown、missing 与 public-safe failure 的正式等价
UI states。mapping deterministic，WXML 不执行 Domain 推断。

### Gate 3 — Global UI Context Isolation

以 runtime/structural evidence 证明 §15 的六项为零；route/query/Page/ViewModel 无 Institution dependency。

### Gate 4 — Contact Identity

平台 Consultant phone 的 source、label、display 与 action 正确；无 Institution official contact fallback 或身份混淆。

### Gate 5 — Phone Interaction

覆盖 eligible call、unavailable no-call、rapid tap、single API call、visible failure、guard release 与 retry success。核对官方 typings
和 WXML -> handler -> API 完整 event chain。

### Gate 6 — QR Display and Interaction

覆盖 public-ready display、phone/QR independent states、expired/pending/rejected/unavailable/invalid/failure 不冒充 ready、无 internal
media ID、无 placeholder。若无自定义 QR action，不人为新增 tap behavior。

### Gate 7 — Permission and Privacy

anonymous access；no login；no User.phone request；no raw/private/internal fields；no record/persistence side effect。

### Gate 8 — Appointment CTA

覆盖合法 route、single navigation、rapid tap、visible failure、guard release/retry、return behavior 与 honest scaffold copy；无
Appointment Domain/record/confirmation expansion。

### Gate 9 — Mock Isolation

production import graph 的 test-only Consultant UI fixture imports = 0；无 synthetic phone/QR/config contamination。

### Gate 10 — WeChat Compatibility

按 changed files 运行 targeted TypeScript、generated-JS 与 interaction compatibility。只覆盖 B3 及其实际 shared dependencies，
不默认扩大到所有历史 compatibility suites。

### Gate 11 — Fresh DevTools

```text
FRESH_DEVTOOLS_GATE = MANDATORY
```

必须针对最终 B3 working-tree build 获取新证据，至少确认：

- `/pages/consultant/index` compile/load 成功，console 无相关 runtime exception；
- production 合法状态与 Global result -> UI mapping 正确；
- 当前真实可达 phone/QR/unavailable state 正确；
- existing Home、Recommendation 与 Institution VR `switchTab` entry smoke 不被破坏；
- Appointment CTA、return 与 Consultant Tab semantics 正确；
- Consultant Tab 根页 back control disabled/no-op，不制造历史栈；
- test-only positive fixture 未进入 production App。

Fresh DevTools 只验证当前可合法触达状态；自动化 fixture 的 phone/QR positive case 不得接入 production build 伪造 UI evidence。

### Gate 12 — Android 17 Manual Real Device

```text
ANDROID_REAL_DEVICE_GATE = MANDATORY
```

必须独立验证当前 production build 合法可达状态：页面加载、Tab 切换、既有 Home/Recommendation/Institution VR 入口、Tab 根页
Back disabled/no-op、identity/service copy、available/unavailable channels、合法 phone action、QR display、Appointment CTA/return、
rapid tap、failure feedback，以及 Android 特有点击/navigation/白屏/crash/render 问题。

若真实 phone 或 approved QR 不存在，其正向 production case记录为 `NOT_REACHABLE`，不得写成 PASS；同时必须具备：

1. automated test-only fixture positive coverage；
2. production unavailable state Android PASS；
3. 未把 synthetic data 接入 production。

### Gate 13 — Targeted QA

final diff 只按真实风险审查：Snapshot-only consumption、raw/domain leakage、Global/Institution isolation、contact identity、phone
interaction、QR authenticity、permission/privacy、mock contamination、scope expansion 与 automated/DevTools/manual evidence classification。
不默认重审 Recommendation、Assessment 或完整 Institution。

## 18. Evidence Classification

B3 implementation completion 必须分开报告：

```text
AUTOMATED_EVIDENCE
DEVTOOLS_EVIDENCE
MANUAL_REAL_DEVICE_EVIDENCE
```

- Automated：ViewModel/runtime/interaction/isolation/mock/compatibility；
- DevTools：final working-tree build 的 fresh compile/runtime/page evidence；
- Manual：项目负责人或明确人工执行者在 Android 17 微信真机对 production build 的证据。

DevTools/Simulator 不能替代 Android；test fixture positive coverage 不能冒充 production phone/QR 真机可达。A1-5 或其他 phase 的旧
Android evidence 不能替代 B3。

## 19. Completion and Verdict Rules

只有 Gate 1–13 全部满足，未来才可输出：

```text
PHASE_V1_2_B3 = PASS
B3_IMPLEMENTATION = COMPLETE
BLOCKERS = 0
READY_FOR_B3_SUCCESSOR = TRUE
```

如果 automated、Fresh DevTools、QA 均 PASS，但 mandatory Android 17 manual evidence 尚未完成：

```text
PHASE_V1_2_B3 = PASS_WITH_RISKS
ANDROID_B3 = PENDING_MANUAL_REAL_DEVICE_VERIFICATION
READY_FOR_B3_SUCCESSOR = FALSE
```

以下必须 `BLOCKED`，不得由 PASS_WITH_RISKS 掩盖：Page 绕过 public Snapshot、读取 raw Consultant/Institution 数据、调用
Institution resolver/default、production fixture contamination、duplicate phone/navigation call、失败无反馈或不可重试、privacy
violation、mandatory runtime/compatibility/DevTools failure、Android actual failure，或必须修改 Frozen Contract 才能完成。

本 definition task 的成功状态仅为：

```text
B3_PHASE_DEFINITION = PASS
B3_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B3 = NOT_STARTED
READY_TO_START_V1_2_B3 = TRUE
```

## 20. Successor and Change Policy

- B3 PASS 后才评估 cross-entry、Institution-bound UI 或其他 successor；本文不提前命名/冻结；
- Global selection/snapshot、phone/QR eligibility、permission 或 Institution/Recommendation isolation 变化需要新的 versioned Contract；
- Backend/provider/real-data/media operations 需要独立 phase/Contract，不得混入 B3 UI；
- ViewModel copy/layout/interaction implementation MAY 在本文边界内调整，但不能改变 public result 或事实身份；
- 如果 production implementation 超出 §5 或触及 Frozen semantics，必须报告 scope expansion，不得静默扩大 Gate。
