# Phase V1.2-B2 Implementation Handoff — Consultant Domain & Application Foundation

状态：`FROZEN_PHASE_V1_2_B2_DEFINITION`

冻结日期：`2026-09-16`

```text
NEXT_PHASE_ID = V1.2-B2
NEXT_PHASE_NAME = Consultant Domain & Application Foundation
B2_PHASE_KIND = DOMAIN_APPLICATION_FOUNDATION_IMPLEMENTATION
B2_PHASE_DEFINITION = PASS
B2_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B2 = NOT_STARTED
PRODUCT_DECISIONS_REQUIRED = 0
PRE_B2_DEFINITION_HEAD = 99161b3ec95ecb9e6cdd9925d189cf2205093192
PRODUCTION_CODE_CHANGE_BY_DEFINITION_TASK = 0
RUNTIME_CODE_CHANGE_BY_DEFINITION_TASK = 0
TEST_CODE_CHANGE_BY_DEFINITION_TASK = 0
MOCK_DATA_CHANGE_BY_DEFINITION_TASK = 0
READY_TO_START_V1_2_B2 = TRUE
```

## 1. Phase Transition and Authority

本文件正式建立以下阶段链路：

```text
Phase V1.2-B1 Consultant & Permission Contract Freeze
  -> PASS / CONSULTANT_PERMISSION_CONTRACT_V1 = FROZEN
  -> Phase V1.2-B2 Consultant Domain & Application Foundation
  -> future B2 production implementation and mandatory automated Gates
  -> only after implementation evidence: PHASE_V1_2_B2 = PASS
```

项目负责人已批准 B2 的 ID、名称和 phase-definition 范围。B2 实现的 Consultant/Permission 业务语义唯一来源是
`CONSULTANT_PERMISSION_CONTRACT_V1.md`；本 handoff 只冻结工程切片、ownership、完成 Gates 和后继边界，不修改或
复制第二套 B1 产品规则。

本阶段必须始终使用完整标识 `V1.2-B2 — Consultant Domain & Application Foundation`。它与 Recommendation
文档中历史使用的方案标签 “B2 DISPLAY_ONLY_NOT_SCORABLE” 无关，后者不构成本阶段的 ID、范围或路由来源。

Source of Truth 顺序：

```text
Current Product Source
  -> CONSULTANT_PERMISSION_CONTRACT_V1.md and other directly affected Frozen Contracts
  -> FRONTEND_STRUCTURE.md / MOCK_DATA_POLICY.md
  -> this B2 phase boundary
  -> implementation details and fixtures
```

如实现与 B1 冲突，以 B1 为准并停止实现；不得修改 B1 来适配代码。A1-5 与 B1 的 PASS 状态不因 B2 定义或实现
而重新打开。

## 2. Goal

B2 的目标是把 B1 已冻结的 Consultant、assignment、contact、media 和 public/application projection 语义落入
可验证、确定性的微信小程序 runtime foundation，使未来 UI 只消费一个 public-safe Consultant Application Snapshot，
无需自行解释 raw Consultant record、assignment、default fallback、service status、phone 或 QR eligibility。

B2 只完成 Domain/Application foundation，不交付用户可见 Consultant UI、生产 Backend 或真实 Consultant 数据。

## 3. Preconditions

B2 开始前必须保持：

- `PHASE_V1_2_A1_5 = PASS`；
- `PHASE_V1_2_B1 = PASS`；
- `CONSULTANT_PERMISSION_CONTRACT_V1 = FROZEN`；
- B2 实现以本 handoff、B1 Contract、当前 `FRONTEND_STRUCTURE.md` 和 `MOCK_DATA_POLICY.md` 为输入；
- 若实现开始前相关 Frozen Contract 已发布显式 successor，必须先做定向 impact check，不能静默混用版本；
- 无需等待真实 Consultant、Backend、QR/CDN、登录或运营后台，这些不是 foundation blocker。

## 4. In Scope

B2 production implementation 只允许覆盖以下工程基础：

1. B1-backed、versioned Consultant runtime types；
2. raw/input 到 validated Consultant、assignment、default configuration 和 contact/media state 的纯 validation；
3. 不改变业务事实的最小 normalization；不得补默认事实或压平状态；
4. Institution → Consultant assignment 的纯 deterministic resolver；
5. 仅在 assignment 明确 `missing` 时参与的 configured `DEFAULT_CONSULTANT` strategy；
6. phone、QR/media、service status 与 overall resolution 的纯 eligibility/projection；
7. public-safe `InstitutionConsultantContactApplicationSnapshotV1` orchestration；
8. read-only Provider port / application service boundary；
9. 合法 resolution state 与 invalid/provider failure 的稳定区分；
10. Domain/runtime fixtures、targeted compatibility checks 和 isolation assertions；
11. 实现所必需的最小 CURRENT 文档更新。

B2 可以定义 foundation 内部、versioned 的 TypeScript validation/application failure codes 和 read-only provider port，
但它们只能表达 B1 语义及技术失败，不能新增产品状态或联系渠道，也不是 public API、Backend protocol 或新的跨域
Contract。任何跨进程/Backend 协议必须由后续独立 Contract 冻结。允许一个薄的 in-memory/test provider adapter；开发
Mock provider 仅在验证 application boundary 确有必要时添加，并必须遵守 §10。

## 5. Out of Scope

B2 不实现：

- Consultant Page、Component、WXML、Less、ViewModel 或用户交互；
- Institution Detail、Home、Recommendation Result 或其他页面的 Consultant 接入；
- route/navigation、拨号或展示二维码的 UI action；
- 生产 Consultant/assignment/default/phone/QR provider；
- 真实顾问电话、真实企业微信 QR 或真实 assignment 录入；
- Backend API、`server/**`、数据库、ORM、migration、persistence 或 cache infrastructure；
- authentication、authorization Backend、登录或 User.phone 授权；
- QR upload、review workflow、media storage、CDN、URL signing 或 rotation job；
- Operations admin UI、CRM、Appointment、AI Assistant、InstitutionVisit 或 VisitEvaluation；
- Recommendation V2、Institution frozen semantics、B1 Contract 或 Product Source 修改。

若实现需要 Page/ViewModel/navigation/user-visible behavior，属于 scope expansion，必须先重新定义 UI、Fresh DevTools 和
real-device Gates；不得在 B2 中顺带接入。

## 6. Layer and Ownership Boundary

稳定调用方向：

```text
B1-backed versioned types
  -> pure Consultant validators and resolution rules
  -> read-only Provider port + Application orchestration
  -> public-safe InstitutionConsultantContactApplicationSnapshotV1
  -> future Page / ViewModel (not B2)
```

### 6.1 Repository placement

后续实现应遵守当前仓库结构：

- `miniprogram/types/consultant*.ts`：B1-backed public/runtime types，不保存状态或执行 I/O；
- `miniprogram/domain/consultant/**`：纯 validation、assignment/default resolution、contact eligibility 与状态派生；
- `miniprogram/services/consultant*.ts`：Provider port、Application orchestration、错误映射和 public-safe snapshot 输出；
- `scripts/fixtures/**` 与对应 targeted check：仅测试数据和 deterministic assertions；
- `miniprogram/mock/**`：仅在获准的显式开发 Mock provider 确有必要时使用。

具体文件数量和内部命名可以按实现最小化，但不得把纯领域规则写入 Page、Store、Mock 或网络 adapter，也不得让 Domain
依赖 `wx.*`、Service、Provider、Page 或全局时间。

### 6.2 Ownership

- 业务语义 owner：B1 定义的 Consultant Service；
- 小程序 types/domain/application implementation owner：`wechat_frontend`；
- 未来 `server/**`、production provider、API、persistence、auth、media/audit infrastructure owner：`backend_domain`；
- Recommendation engine 不是 B2 owner；`matching_engine` 只在 isolation regression 确有需要时定向审查；
- `qa_reviewer`：最终 diff 的独立只读 QA；
- Main session：跨文档冲突、集成与 Gate 验收。

文件 ownership 不改变 B1 的事实发布权限。小程序 runtime 只能验证和投影输入，不能成为 Consultant/assignment/contact/
media 的 authoritative source，也不能执行 mutation。

## 7. Runtime and Validation Boundary

### 7.1 Trusted boundary

Raw provider payload、default configuration 和 media resolution 均是不可信 application input。B2 必须先验证，再解析和
投影；不得因 TypeScript shape 看似完整就视为合法事实。

允许的 normalization 仅限不改变事实语义的结构处理。禁止：

- 生成 consultantId、assignmentId、institutionId、phone、QR URL 或 display identity；
- `unknown -> unavailable/active/false`；
- `missing -> inactive/unavailable`；
- `expired -> inactive`；
- `pending_review/rejected -> approved`；
- 根据 Institution、Recommendation、route 或页面文案推断 Consultant。

所有时间相关判断必须使用显式 `snapshotAsOf`；Domain 不调用 `Date.now()`，不读取随机数、storage 或环境状态。

### 7.2 Valid resolution versus application failure

B1 的 `available / unavailable / inactive / expired / unknown / missing / ambiguous` 是成功生成 Application Snapshot 后可观察的
合法 resolution states。

以下情况不得伪装成上述合法状态或成功空结果：

- invalid canonical Institution context；
- invalid Consultant/profile/assignment/default payload；
- invalid `snapshotAsOf`；
- Provider load/contract failure；
- unexpected public-media resolver failure；
- snapshot construction invariant violation。

B2 必须以稳定、受限、不泄露 raw payload/credential 的内部 Application failure code 返回。确切 code 名称由 B2
implementation 在 foundation 内冻结并测试，但至少区分 invalid input、provider failure 与 projection failure；这些 code
不得成为未批准的 public/Backend protocol。Provider 已明确返回的合法
`unknown/unavailable/inactive/expired/missing` 状态不是 exception，仍按 B1 投影。

## 8. Assignment and DEFAULT_CONSULTANT Resolution

B2 resolver 的固定顺序：

```text
validate canonical (institutionId, recordRevision) context
  -> validate and inspect institution-specific assignment state
  -> unique active assignment: resolve its ConsultantProfile
  -> assignment confirmed missing only: inspect explicitly configured DEFAULT_CONSULTANT
  -> inactive / unknown / ambiguous / invalid: fail closed; never try default
  -> validate profile and service status
  -> project eligible phone / QR channels
  -> derive public-safe snapshot
```

约束：

- assignment 绑定稳定 `institutionId`；`recordRevision` 只属于调用 context，不进入 assignment fact；
- 一个 Consultant 可服务多个 Institution；每个 Institution snapshot 最多解析一个 Consultant；
- 多个 current active 候选或冲突关系输出 `ambiguous`、`consultant=null` 并阻断 default；
- inactive assignment 是显式 tombstone，必须阻断 default；
- `DEFAULT_CONSULTANT` 只有 authoritative configuration 明确启用后才存在，不得硬编码在 Institution、Page、route 或 Mock；
- default 只在 assignment 确认 `missing` 时参与，并经过与显式 Consultant 相同的 profile/contact Gates；
- default 未配置不得伪造 assignment；default config 非法属于 Application failure；
- assignment/profile/contact 的变化不得写入或生成 Institution revision。

## 9. Public-safe Application Projection

B2 的唯一 UI-facing 成功输出是 B1 定义的 versioned public/application snapshot。未来 Page/ViewModel 不得读取或接收：

- raw ConsultantProfile 或 assignment collection；
- internal `wechatQrMediaId`、storage key、management URL、review attachment 或 credential；
- private phone、User.phone、consent、排班、private notes 或 audit metadata；
- raw Assessment、完整 ElderProfile/Recommendation/Institution record；
- Provider implementation detail 或 default configuration object。

### 9.1 Phone

- 只有 configured + approved + active 且值合法的平台顾问电话可以输出 `displayValue/dialValue`；
- 非 available projection 不携带完整号码，`actionAvailable=false`；
- label 只使用 B1 允许的“养老顾问电话/带看顾问电话”；
- 平台顾问电话与 Institution official phone 不共享 source、projection、label 或 fallback；禁止双向替代。

### 9.2 QR/media

- B2 只消费注入的、当前 `snapshotAsOf` 下的 public-media resolution，不实现媒体基础设施；
- 只有 B1 全部 eligibility 成立时输出 `publicImageUrl`；内部 media reference 永不公开；
- `pending_review/rejected` 在内部仍不同，public projection 均为 `unavailable`；
- `inactive / expired / unknown / missing` 保留相应 public state，任何状态都不得继续显示旧 URL；
- QR 不可用时只可 fallback 到同一 Consultant 的合法 platform phone；不得生成 placeholder/fake QR、fake phone 或借用
  Institution official phone；
- unexpected resolver failure 返回 Application failure；明确的合法非可用 media result 才进入 snapshot state mapping。

### 9.3 Overall status

Overall resolution 必须遵守 B1 §10.3 的 gate 顺序和 derivation：

- assignment/profile gate 未通过时不读取缓存 contact；
- 至少一个合法 channel available 才能整体 `available`；
- 无 available 但存在 channel unknown 时为 `unknown`；
- QR expired 且 phone unavailable/missing 时为 `expired`；
- 两个 channel 都 missing 时为 `missing`；
- 其余已知非可用组合为 `unavailable`；
- application snapshot 必须保留稳定 code，未来 UI 文案映射不得反改语义。

## 10. Mock and Fixture Boundary

B2 的自动化 fixture 应优先位于 `scripts/fixtures/**`，只用于 validator、resolver、projection 和 application orchestration
测试。它们必须是 `TEST_ONLY_SYNTHETIC` 或当前测试体系的等价显式标识，不得被 production App import。

若确需 `miniprogram/mock/**` 开发 provider：

- snapshot/data 必须标记 `MOCK_DEVELOPMENT_ONLY` 并在未来可见 UI 中披露；
- 不得包含真实个人 phone、真实未批准 contact、fake/placeholder QR 或可被误认成真实顾问的事实；
- synthetic assignment/default config 不构成 production assignment truth；
- synthetic snapshot 不得缓存、导出或重新包装成 production public fact；
- 缺失真实 approved media 时使用合法 non-available state，不制造 URL；
- 测试 fixture 和开发 Mock 不能互相冒充，也不得通过 Service 导入关系绕过隔离。

B2 不要求创建用户可见开发 Mock；只用 test fixtures 即可满足 foundation Gate。

## 11. Recommendation and Institution Isolation

```text
CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE
CONSULTANT_DATA_INSTITUTION_VERIFIED_FACT_ROLE = NONE
```

B2 types、resolver、contacts、service status、assignment、default config 和 snapshot：

- 不进入 Recommendation V2 input、manifest、matching projection、Eligibility、Exactness、PriorityFitVector、Rank Tuple、
  tie-break、card ordering 或 `NO_EXACT_MATCH`；
- 不产生 consultantScore、availability score、manual/AI rerank 或 Recommendation override；
- 不修改 Institution official contact、Capability、CareProcess、qualification、price、availability、Evidence、Verification、
  provenance、record status 或 `recordRevision`；
- 只允许作为独立 display-only Consultant sidecar，由未来 UI phase 接入。

实现不得复制完整 Recommendation 算法。Isolation evidence 应定向证明相同 Recommendation 输入在 Consultant sidecar
变化前后 semantic result deep-equal；只有实际共享依赖发生变化时才扩大 Recommendation regression。

## 12. Mandatory B2 Implementation Gates

以下 Gates 在未来 B2 implementation 中全部 mandatory；本 definition task 不执行它们。

### GATE 1 — CONTRACT_CONFORMANCE

- runtime types、validation、resolver、projection 与 B1 一致；
- 不新增状态、fallback、权限或联系渠道；
- B1 frozen semantic diff 为 0。

### GATE 2 — CONSULTANT_RUNTIME

- versioned Consultant/profile/assignment/contact/media representation 和 validators 完成；
- invalid、unknown、unavailable、inactive、expired、missing、ambiguous 不被压平；
- 相同显式输入与 `snapshotAsOf` 产生 deep-equal output；
- fixture manifest 固定 case ID，检查缺失、重复和意外跳过。

### GATE 3 — ASSIGNMENT_RESOLUTION

至少覆盖：valid explicit assignment、missing without default、missing with eligible configured default、inactive blocks default、
unknown blocks default、ambiguous blocks default、invalid input/application failure、profile missing/inactive/unknown，以及合法
contact-unavailable result。每例断言 `assignmentSource`、`resolutionStatus` 和 Consultant nullability。

### GATE 4 — APPLICATION_PROJECTION

- phone、QR 和 overall status 遵守 B1 eligibility/derivation；
- snapshot 只含 B1 public-safe allowlist；
- forbidden internal/private fields 不存在；
- valid non-available states 与 invalid/provider/projection failures 分开；
- route、storage 和全局状态无隐式依赖。

### GATE 5 — CONTACT_IDENTITY_ISOLATION

- platform Consultant phone/QR 从不读取、覆盖或 fallback 到 Institution official contact；
- projection label、source 和 value 不混同；
- 缺失 contact 不生成 placeholder/fake data。

### GATE 6 — RECOMMENDATION_ISOLATION

- Consultant sidecar 的添加、修改、删除不改变 Recommendation semantic result；
- 默认运行 B2-specific isolation assertions；仅在共享 Recommendation dependency 被修改时运行受影响的额外回归，
  不默认重跑全部历史 fixtures。

### GATE 7 — INSTITUTION_ISOLATION

- resolver 只读取 canonical Institution identity context；
- assignment/snapshot 变化不修改 Institution object、verified facts 或 revision；
- 无 broad object spread/duck typing 把 Consultant 字段并入 Institution projection。

### GATE 8 — MOCK_ISOLATION

- production graph 不 import `scripts/fixtures/**`；
- development Mock 保持显式 provenance；
- 无真实个人电话、fake/placeholder QR 或 synthetic production assignment/snapshot；
- static import/provenance assertions PASS。

### GATE 9 — TYPESCRIPT_WECHAT_COMPATIBILITY

- B2 新增的 `miniprogram/**` TypeScript 通过当前适用的 targeted TypeScript check；
- 生成 JavaScript 满足当前 WeChat runtime compatibility policy；
- 不引入不受当前 toolchain 支持的 class fields/runtime syntax、隐式 Node API 或浏览器专用假设；
- 只扩展覆盖 B2 新模块及其真实 runtime dependencies，不机械运行所有历史 compatibility tests。

### GATE 10 — TARGETED_QA

独立 QA 只审查最终 B2 diff、B1 conformance、state/failure completeness、fixture anti-green、public allowlist、Mock/contact/
Recommendation/Institution isolation 和 production/UI/backend scope containment。未触及的页面与全仓历史功能不自动纳入。

## 13. Evidence Policy

未来 B2 completion evidence 必须分开报告：

```text
AUTOMATED_DOMAIN_APPLICATION_EVIDENCE = REQUIRED
TARGETED_WECHAT_TYPESCRIPT_GENERATED_JS_EVIDENCE = REQUIRED
TARGETED_QA_EVIDENCE = REQUIRED
FRESH_DEVTOOLS_GATE = NOT_MANDATORY
ANDROID_REAL_DEVICE_GATE = NOT_MANDATORY
```

理由：正式 B2 scope 不包含 Page、ViewModel、navigation、WXML、Less 或 user-visible interaction。Targeted generated-JS
compatibility 是自动化 runtime compatibility evidence，不等于 DevTools UI 或真机证据。

如果实际实现触及任何用户可见接入，B2 scope 已被突破；必须先得到新的 phase/Gate 批准并重新判断 Fresh DevTools、
interaction 和 Android/iOS real-device evidence，不能用本节豁免。

## 14. Completion Criteria

只有未来 implementation 同时满足以下条件，才能宣布 `PHASE_V1_2_B2 = PASS`：

1. §12 全部 mandatory Gates PASS；
2. B1 frozen semantic、Product Source、Recommendation V2 与 Institution frozen semantic diff 均为 0；
3. public-safe snapshot 是 future UI 唯一 Consultant application input；
4. invalid/provider failure 不伪装为合法 non-available state；
5. production graph 无 test fixture、fake phone/QR 或 synthetic production fact；
6. production Backend、UI、真实数据和权限实现未被提前纳入；
7. independent targeted QA PASS；
8. Git change set 可追溯且没有混入本机私有配置或无关修改；
9. blockers 为 0。

本 definition task 的成功只允许：

```text
B2_PHASE_DEFINITION = PASS
B2_IMPLEMENTATION_HANDOFF = FROZEN
READY_TO_START_V1_2_B2 = TRUE
PHASE_V1_2_B2 = NOT_STARTED
```

## 15. Non-blocking Implementation Dependencies

以下事项尚未完成，但不阻止 foundation implementation：

- production Consultant/assignment/default configuration authoritative source；
- REST/RPC endpoint、API version 和 Backend；
- DB、persistence、audit storage 与 mutation workflow；
- 真实顾问资料、企业批准 phone/QR onboarding；
- QR review/upload/storage/CDN/rotation infrastructure；
- authentication、authorization 和 User.phone consent implementation；
- Consultant UI 与 Institution Detail integration。

B2 可通过纯函数、read-only ports、显式合法状态和 test-only fixtures 完成，不得以这些依赖未就绪为由伪造生产资料。

## 16. Successor Boundary

B2 实现 PASS 后，才适合评估 Consultant UI Integration。该后继阶段必须只消费 B2 public-safe snapshot，并重新定义
Page/ViewModel、interaction、Fresh DevTools 和 real-device Gates 是否适用。

本文件不为该后继阶段命名、编号、批准或冻结范围，也不授权当前任务开始 UI implementation。

## 17. Change Policy

本 handoff 冻结的是 B2 implementation slice 和 mandatory Gates，不是新的 Consultant business Contract。任何会改变
identity、assignment/default resolution、contact/QR eligibility、permission/privacy、Recommendation/Institution isolation
或 public snapshot semantics 的要求，必须先走 B1 successor/versioned Contract；不得在 B2 代码、fixture 或错误映射中
静默改变。

纯 additive 的内部组织可在 B2 implementation 中按当前结构最小化，但不得改变公开 version、稳定 state、Application
allowlist、layer ownership 或本 handoff 的 out-of-scope。范围扩张必须由项目负责人另行批准。

## 18. Definition Review Record

```text
WECHAT_FRONTEND_BOUNDARY_REVIEW = PASS
BACKEND_DOMAIN_BOUNDARY_REVIEW = PASS
QA_REVIEW = PASS_AFTER_FINDING_CLOSED
QA_TARGET_SCOPE = B2_HANDOFF + DOC_REGISTRY_ENTRY
PRODUCT_DECISION_BLOCKER = NONE
```

- `wechat_frontend`：确认 types → pure Domain → Service/Application → future Page/ViewModel 边界、B1 public snapshot、
  targeted compatibility 以及 DevTools/Android 非 mandatory 结论成立；
- `backend_domain`：确认 B2 的 ports 只读且非 authoritative；API、DB、auth、media、audit、生产 provider 和 mutation
  均留给后续 Backend Contract/phase；
- `qa_reviewer`：确认 scope、state、assignment/default、projection、isolation、Gates 和 registry 完整；首轮要求澄清内部
  failure codes/provider port 不得被视为 public/Backend protocol，该 finding 已关闭。
