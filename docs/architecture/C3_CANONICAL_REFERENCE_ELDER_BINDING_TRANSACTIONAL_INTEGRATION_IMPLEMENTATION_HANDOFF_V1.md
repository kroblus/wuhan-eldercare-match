# C3 Canonical Reference and Elder Binding Transactional Integration — Implementation Handoff V1

状态：`FROZEN_IMPLEMENTATION_HANDOFF / IMPLEMENTATION_NOT_STARTED`

冻结基线：`d3f9c6426680820ec6aaa4d738813c23394be173`

```text
HANDOFF_ID = C3_CANONICAL_REFERENCE_ELDER_BINDING_TRANSACTIONAL_INTEGRATION_IMPLEMENTATION_HANDOFF_V1
VERSION = V1
PHASE_NAME = C3 Canonical Reference and Elder Binding Transactional Integration
PHASE_TYPE = BACKEND_TRANSACTIONAL_INTEGRATION
PHASE_ID = TO_BE_DEFINED_BY_PROJECT_GOVERNANCE
PRODUCT_DECISIONS = CLOSED
SOURCE_CONFLICT = NONE
NEW_CONTRACT_REQUIRED = NO
IMPLEMENTATION_READY = TRUE
EXPECTED_NEW_FLYWAY = NO
REAL_PHONE_REQUIRED_FOR_IMPLEMENTATION = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
C6_REAL_PHONE_G13 = NOT_REOPENED
C3_FORMAL_APPOINTMENT_SUBMISSION = STILL_CLOSED
```

本文只冻结下一实现阶段的责任、事务不变量和验收证据，不修改 Frozen 业务语义，也不宣布正式预约提交已开放。`AppointmentReferenceReader` 的 readiness 结果不能成为 Visit 写入授权。

## 1. Source of Truth and preconditions

按以下来源的现行、冻结语义实施：

1. `docs/product/README.md` 指定的两份 V1.2 Product PDF，以及 `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`（C1）：显式预约意图、草稿、`requested`、精确机构版本、提交与重放语义。
2. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`（C3）：C5 身份、用途限定联系证据、canonical reference、单一权威 create-or-replay 事务、幂等与安全结果。
3. `V1_2_C5_IMPLEMENTATION_HANDOFF.md` 的现行 authenticated session 边界与 `V1_2_C6_IMPLEMENTATION_HANDOFF.md` 的 purpose-bound contact 边界：分别仅提供可信用户主体与经授权的联系证据；手机号不建立身份。
4. `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1.md` 和 `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_IMPLEMENTATION_HANDOFF_V1.md`：一名 C5 用户至多一个 ElderRecord、显式首次建立、客户端 ID 仅为断言、禁止历史回填。
5. `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` 的当前/历史 revision 与发布语义、Elder Frozen Contract 的精确版本 appointment-operational authorization 要求，以及既有 `InstitutionAppointmentEligibilityResolver`。`published` 只代表发布，不代表可预约。
6. 已提交的 Backend、V1–V8 Flyway、定向测试只作为当前能力与待集成缺口的实现证据，不能覆盖以上来源。

Elder Production Foundation 已关闭；C5、Elder identity、Institution eligibility、C3 Visit/idempotency persistence、owner-read、Operations lifecycle 和 Evaluation 已各自存在。实现不得重建这些能力或改变它们的语义。真实电话与真实预约提交的证据仍延期。

## 2. Current gap and scope

`DefaultBoundaryConfiguration` 的 production `ReferenceAuthorizer` 返回 `UNAVAILABLE`。`ProductionAppointmentReferenceReader` 是分步只读的前置能力；`VisitSubmissionService` 目前在调用 `JdbcVisitSubmissionRepository.createOrReplay` 前，在仓储事务外解析身份、验证联系证据及调用 reference authorizer。现有仓储事务只原子化 Visit 与幂等行。因此把 Reader 接到 Authorizer，或把若干页面 preflight 结果拼接后写 Visit，都不满足 C3 §8。

下一阶段在范围内：生产 C3 canonical authorizer 集成；显式 Elder establish 消费边界；C5→唯一现存 Elder 的事务内解析与客户端断言；复用同一 Institution eligibility 语义的事务内授权；C6 可信联系证据的最终消费；C3 create-or-replay 编排、并发与 TOCTOU 证明；必要的最小 application/client 接缝；定向测试及隔离 MySQL 事务证据。

范围外：完整 `appointment/create` 或 success UI、真实 `getPhoneNumber` 正向验收、真实 WeChat provider / G13、Elder CRUD/选择器、FamilyAccount、多老人、共享或转移、Owner 3306/生产数据库、旧 Visit owner-read/lifecycle/Evaluation 改造、Recommendation、Institution verified facts、生产发布。不得因本 Handoff 直接宣称正式提交开放。

## 3. Authority chain and explicit Elder establishment

```text
explicit Appointment intent
  -> valid server-trusted C5 principal
  -> if absent, explicit current-user Elder establish use case
  -> formal C3 transaction re-resolves sole existing bound ElderRecord
  -> optional client elderId equality assertion
  -> exact current + published + explicitly authorized Institution revision
  -> authorized purpose-bound contact evidence
  -> durable owner/key/canonical-payload create-or-replay
  -> one committed requested Visit or original committed receipt
```

首次 Elder 建立只能由明确的 Appointment 提交意图下的 application action 调用现有 current-user establish 能力。该 action 使用 C5 principal；客户端不得指定 owner 或生成权威 `elderId`。登录、打开页面、GET resolve、preflight、无记录检测和 `ReferenceAuthorizer.authorize(...)` 均不得隐式建档。当前 Mini Program 尚无该接口的生产消费者；后续实现须建立最小接缝，并协调当前 C3 `SubmissionCommandV1` 必填 `elderId` 的传递方式：写入权威值始终来自服务端重新解析，客户端值仅为可选断言；不得以客户端必填类型迫使无绑定草稿伪造 ID。本阶段不展开完整页面。无绑定的正式 C3 submit 必须失败关闭，不能用 Assessment、Profile、草稿、历史 Visit、手机号、openid 或客户端 `elderId` 补出身份。

显式 establish 成功后，C3 仍从**当时的** C5 principal 重新解析唯一绑定 Elder；请求 `elderId` 只在解析后作相等断言。匹配可继续；不匹配、foreign 或 unknown 一律隐私安全地失败，不能泄露存在性、owner 或绑定详情。重复/并发 establish 继续依赖已实现的唯一约束和收敛逻辑，不得生成第二 Elder。

ElderRecord 是独立、稳定的 subject identity。若 establish 已成功但随后联系、机构、幂等或 Visit 事务失败，该 ElderRecord 保留，新增 Visit 为零，已输入的本地草稿仍可恢复；不得删除 Elder 以伪装整体回滚。幂等重放不能再次触发 establish。未绑定草稿不得通过伪造 `elderId` 满足当前客户端类型；具体表单存储与交互留给后续 UI 阶段。

## 4. Canonical Institution and reference responsibilities

新 Visit 必须引用请求给出的**精确** `(institutionId, institutionRecordRevision)`。同一 authoritative evaluator/repository 语义须同时证实：该版本是当前 head、该精确版本 `published`、同一精确版本存在有效的独立 appointment-operational authorization。缺失、撤销、未发布、历史版本或不确定状态全部拒绝；不得 latest fallback，也不得用 published、Consultant、电话、地图、CareProcess 或 Recommendation 推断预约授权。

`AppointmentReferenceReader` 继续只用于显示、preflight 或 readiness；它不写 Visit，也不授予最终写权限。生产 `ReferenceAuthorizer` 或等价 port 在 C3 写事务中承担或委托 C5/Elder/Institution 最终检查，但不得创建 Elder、修改机构事实、写 Visit、绕过联系 Gate 或幂等。写入编排与 Visit persistence 仍属于 C3。授权状态是独立 server-owned operational source，不能写回 Institution verified facts。实现须复用既有 Institution eligibility 语义，不在 C3 复制一份会漂移的规则。

## 5. One authoritative C3 transaction and TOCTOU

一次新 Visit 的权威事务必须覆盖：当前可信 principal、唯一 Elder 绑定及可选 assertion、精确 Institution eligibility、用途限定联系证据的服务端验证/消费、owner/key/canonical-payload 幂等判断、Visit 与幂等持久化以及提交后的 receipt truth。所有决定新 Visit 可否写入的数据库事实必须在最终写边界重新读取；preflight、客户端缓存和事务外 Reader 结果不能替代重检。

实现可采用同一事务管理器/连接、事务内仓储协作者或等价技术，但 C5/Elder/Institution 读取与 C3 create-or-replay 必须处于**同一权威 datasource/事务边界**，不得各自获取自动提交连接后声称原子性。实现还必须选择并证明适当的锁、隔离或等价序列化机制，使授权读与撤销/版本变化及最终新写有明确线性化次序；仅加 `@Transactional` 或仅共享连接而允许读后撤销竞态，不满足 Gate。外部 WeChat provider 网络交换不要求放入数据库事务；它先产出服务端可验证的用途限定证据，C3 在最终边界验证/消费可信结果，不能信任客户端传入的 phone/authorization 字符串或事务外的过期判定。不得新增 C6 未冻结的有效期、单次使用或轮换规则。

强制 TOCTOU 场景：T0 Reader 显示可预约；T1 同版本运营授权撤销并提交；T2 使用一个尚无已提交 Visit 的新幂等 key 正式提交。T2 必须观察撤销并拒绝，新增 Visit 为零。相同原则适用于 C5 会话、Elder 绑定、当前版本、发布状态及联系证据。针对 Elder，使用 synthetic repository fixture 表达 preflight assertion 与事务时唯一绑定不符；不得发明 V1 ownership transfer。

每种新提交失败或不确定状态——无有效 C5、无 Elder、断言不符、机构未知/历史/未发布/未授权/撤销、联系证据缺失/拒绝/无效、幂等冲突、仓储/事务失败——均须新增 Visit 数为零、无 accepted receipt，并保留草稿。只有事务提交成功可产生 `accepted`；已提交原请求的合法重放返回原 receipt，不新增 Visit。新 Visit 初态只能是 `requested`；用户期望日期/时间不是 `scheduledAt`，提交不等于机构确认或完成。

## 6. Contact, idempotency and replay

C6 的目的限定为 `appointment_or_consultant_contact`，联系证据只准证明该联系值可用于该目的，不证明账户身份或 Elder owner。正式新写入仍要求有效 `contactName`、用途绑定 User.phone 和显式授权证据。机构电话、顾问电话与 synthetic fixture 均不能充当生产 User.phone。真实 provider 能力、G13 和真实手机号端到端证据不属于本实现 Gate；无真实生产证据时仍 fail closed。

C3 §9 的幂等作用域仍为可信 `userId + opaque idempotencyKey + canonical normalized submission payload`。当前 `SubmissionCommandV1.canonicalMaterial()` 已包含精确机构/版本、Elder 引用、预约意图、联系名/电话/用途/授权声明及允许的可选字段；实现须验证这些字段在新的 server-resolved Elder 与可信联系证据接线后仍代表 C1/C3 所要求的同一逻辑请求。客户端断言不能变成 Elder authority；可变的机构授权/发布事实不能被塞进客户端 fingerprint 当请求身份。私有原文或 fingerprint 不得进入页面、日志、路由或公开错误。

在权威事务中先确认当前 C5 身份，再按该 owner/key 读取已提交记录并比较 canonical 内容：相同则按 C1 §11.2 与 C3 §9 返回原 `visitId` 和语义相同的 receipt；不同则 conflict、无第二 Visit。**只有没有已提交记录、需要新建 Visit 的分支**才继续重检当前 Elder、Institution 与联系证据，然后原子写入 Visit/幂等记录。不同 key 不发明跨 key 去重。重放绝不能触发新的 Elder 建立或 Visit 写入。当前机构授权的后续撤销不倒改既有 Visit/receipt；撤销后的**新尝试**必须被当前授权 Gate 拒绝。不得借“重放”接受一个并不存在的 committed result，也不得把 mutable authorization 状态当作 canonical request 字段。若实现遇到 C1/C3 未决定的证明时效边缘，保持 fail closed 并单独报告精确语义缺口，不自行制定新电话规则。

当前仓储的 owner/key 唯一约束、hash 比较和并发 duplicate-key 收敛可复用，但既有并发测试只覆盖仓储层；新实现必须验证完整 C5/reference/contact/Visit 集成路径。事务失败不能留下部分 Visit 或 durable accepted 幂等记录；网络结果不确定时用原 key 重试查询权威提交事实。

## 7. Schema, legacy and isolation

`EXPECTED_NEW_FLYWAY = NO`：V1 已有 Visit 和持久幂等，V2 有 C5，V5 有机构 revision/current head，V8 有唯一 Elder binding 与精确版本运营授权。所需缺口是事务/授权协作，不是新业务表。实现若发现**不可避免**的持久能力缺口，须先记录具体原因及最小 forward-only migration 范围，再复核本 Handoff；不得惯性创建 V9 或修改 V1–V8。

禁止从旧 Visit 的 `elder_id`、owner、Assessment、电话、openid、姓名、Evaluation 或 Recommendation 自动创建 Elder/binding；`LEGACY_ELDER_BACKFILL = FORBIDDEN_AND_ZERO`。不得修改历史 `elder_id`、强迫旧 Visit 补新 Elder FK、改变旧 owner-read、requested/contacting/scheduled/completed/cancelled lifecycle 或 completed Visit 的 Evaluation eligibility。Elder 建立不产生 Evaluation 权限。Recommendation 的 Safety/Eligibility/Exactness/PriorityFitVector/Rank Tuple 与 Institution verified facts 均保持隔离。生产环境无假 Elder、假授权或 TEST_ONLY fallback；空状态合法且缺数据失败关闭。

## 8. Implementation evidence strategy

- **定向 unit/service**：有效 C5/唯一 Elder/匹配断言/精确当前已发布且授权机构/可信联系证据；无绑定、不匹配/foreign/unknown Elder；历史或未发布机构、缺失及撤销的运营授权；无联系证据；相同请求 replay、变更内容 conflict；全部失败新增 Visit 为零、公开错误不枚举。
- **隔离 MySQL 8-compatible**：完整集成事务及授权/写入使用同一有效边界；T0 eligible→T1 revoke→T2 new-key submit 拒绝且零 Visit；并发撤销与写入的序列化次序；stale Elder assertion；联系失败；同 key 同内容并发提交恰一 Visit/稳定 replay；同 key 不同内容冲突；提交中持久化失败回滚；旧 Visit count、`elder_id`、owner-read/lifecycle/Evaluation 兼容。
- **migration**：若仍无 schema 变化，不机械重跑全 Flyway chain；若确需新迁移，验证 V1→latest、V8→latest、重复迁移 no-op、旧 Visit 保留与零回填。严禁 Owner 3306、生产 DB、真实个人数据。
- **evidence labels**：synthetic C5/Institution/Elder/C6 contact 只证明事务逻辑，不升级 `REAL_PHONE`、`REAL_PHONE_E2E`、`REAL_APPOINTMENT_SUBMISSION`。本 Handoff 无 Maven/MySQL/DevTools/Android 测试要求；未来若只改 Backend，Fresh DevTools/Android 不是默认 Gate；若实际改用户可见小程序交互，补定向微信兼容与相应运行证据。

## 9. Mandatory implementation Gates

下表 `G01–G30` 仅是**本 Handoff 的实施 Gate 编号**；其中本地 `G13` 是联系证据消费 Gate，与 C6 的真实电话 `G13` 无关。后者保持 `NOT_REOPENED`。

| Gate | 必须证明 |
|---|---|
| G01 | 起始 commit/source identity 与受保护工作区、最终 diff 可追溯 |
| G02 | C1/C3 及 C5/C6/Elder/Institution Frozen 语义一致 |
| G03 | C5 server-trusted principal 是唯一 end-user authority |
| G04 | 首次 Elder 建立是明确 Appointment intent application action，登录/读取/Authorizer 无隐式创建 |
| G05 | C3 事务重新解析唯一已有 Elder；无绑定失败关闭 |
| G06 | client `elderId` 只作相等断言，不作 lookup authority |
| G07 | foreign/unknown Elder 与私有授权状态不被枚举 |
| G08 | Institution eligibility 复用单一 canonical 语义来源 |
| G09 | 请求的精确 revision 必须是当前 revision，无 latest fallback |
| G10 | 精确当前 revision 必须 `published` |
| G11 | 精确 revision 必须另有显式未撤销运营预约授权 |
| G12 | 新写入事务内重检与并发撤销的 TOCTOU 证明 |
| G13 | C6 用途限定联系证据仍是新写入前置条件；本 Gate 不重开真实电话 G13 |
| G14 | C5/Elder/Institution/contact/idempotency/Visit 共属有效权威事务边界 |
| G15 | `ReferenceAuthorizer`/Reader 不隐式建 Elder、写 Visit 或改事实 |
| G16 | 同 owner/key/canonical 请求只重放原已提交 Visit |
| G17 | 同 key 不同 canonical 内容 conflict，零第二 Visit |
| G18 | 所有新写授权/持久失败零新增 Visit、无 accepted receipt |
| G19 | 新 Visit 初态 `requested`，receipt 不声称 confirmed/scheduled/completed |
| G20 | 历史 Visit、owner-read、lifecycle、Evaluation 保持可用 |
| G21 | 旧 Visit 不回填 Elder/binding、不修改历史 `elder_id` |
| G22 | 真实电话延期、G13 不重开、synthetic evidence 不升级真实状态 |
| G23 | Recommendation 与 Institution verified facts 不被运营授权污染 |
| G24 | TEST_ONLY 仅在测试，无生产 seed/default grant/fallback |
| G25 | 无新 Flyway；如确有持久能力缺口先做最小变更复核 |
| G26 | 使用隔离 disposable MySQL 并按 schema 变化选择 migration 范围 |
| G27 | 完整集成路径的并发同 key 提交恰一 Visit |
| G28 | 按受影响 C3/C5/C6/Elder/Institution/legacy seam 定向回归 |
| G29 | 最终 source、测试、工作区及暂存集可核对，不带入无关修改 |
| G30 | 独立只读 QA 无 Critical/High blocker |

所有 G01–G30 PASS 才能宣称本阶段实现完成。真实电话、真实用户绑定、真实预约提交、跨设备或体验版 E2E 仍分别记为 `NOT_RUN`，不得由 synthetic MySQL 推断。后续 UI/phone/rollout 阶段仍需另行选择和验收。

## 10. Handoff pass criteria and next task

本 Handoff 冻结了显式 Elder 建立、canonical reference、事务责任、TOCTOU、联系证据、幂等、失败零写、schema 及测试 Gate；没有改变 Frozen Contract 或打开 Appointment success。下一任务仅为 **Implement C3 Canonical Reference and Elder Binding Transactional Integration**。实现完成也不自动将 `C3_FORMAL_APPOINTMENT_SUBMISSION` 改为 `OPEN`，或把 `REAL_APPOINTMENT_SUBMISSION` 标记为 `PASS`。

## 11. Final Transactional Integration Closeout — 2026-09-27

本节记录当前 phase lifecycle 与证据对账。前文的现状描述和下一任务保留为冻结 Handoff 时的历史快照；本节不改变其实施语义、任何 Frozen Contract 或 production source。

```text
C3_CANONICAL_REFERENCE_TRANSACTIONAL_INTEGRATION_HANDOFF = FROZEN
HANDOFF_COMMIT = f9064a0d66f80dddba5fb1f29aa03cd19e62d20d
TESTED_IMPLEMENTATION_SOURCE = c2b94e5d18311f049c82812f05af355d39320c4f
IMPLEMENTATION_COMMIT = c2b94e5d18311f049c82812f05af355d39320c4f
SOURCE_IDENTITY_RECONCILIATION = PASS
C3_HANDOFF_CONFORMANCE = PASS
C3_HANDOFF_GATES = G01-G30 PASS
C3_CANONICAL_TRANSACTIONAL_INTEGRATION = PASS_WITH_RISKS
C3_TRANSACTIONAL_IMPLEMENTATION = COMPLETE
C3_TRANSACTIONAL_PHASE = CLOSED
BLOCKERS = 0
READY_FOR_C3_SUCCESSOR = TRUE
C3_FORMAL_APPOINTMENT_SUBMISSION = STILL_CLOSED
```

`f9064a0d..c2b94e5d` 是直接父子提交，实施 diff 仅有 32 个本任务相关 `server/**` 文件；没有混入文档、小程序、新 Flyway 或 V1–V8 修改。实施提交后没有相关 source/schema/test 改动，暂存集为空；预存的七处 `.codex/**` 改动保持未暂存且不属于测试 source。公开响应私有 candidate 暴露、非事务降级写入、lifecycle 前进后精确重放这三项 QA 问题均在实施提交中修复。

修复后的同一源码通过 54/54 定向回归。隔离 MySQL Community Server 8.0.34 在 127.0.0.1:33458 的最终空库运行完成 V1→V8 迁移 8/8 与事务集成 11/11，覆盖撤销先于新提交时零 Visit、两条属于同一 owner 的 C5 session 并发同 key 恰一 Visit、持久化故障回滚、旧 Visit 保留及零 legacy Elder 回填。跨 owner 的同名 key 由现有 `(user_id, idempotency_key)` 主键和按 owner 限定的查询隔离；该并发测试不冒充跨用户测试。定向测试和最终 MySQL 运行均发生在三项修复之后、实施提交之前；提交后无相关源码改动，故证据绑定 `c2b94e5d`，本 closeout 未机械重跑。

新写入在同一 JDBC 事务内重检 C5、唯一已有 Elder、客户端 `elderId` 相等断言、精确当前且已发布并获显式运营预约授权的机构版本，再原子写入 Visit 与幂等记录；只读 `AppointmentReferenceReader` 的 preflight 不能授权写入。缺少事务能力时失败关闭。用途限定 C6 联系证据是新写入前置条件，外部 provider 交换不在数据库事务内。已提交的同 owner/key/canonical 请求重放原 `visitId` 和提交时 `requested` receipt；它不表示当前 Visit lifecycle。MySQL 用例在 Visit 已成为 `contacting` 后验证重放仍返回原回执，且数据库中的 `contacting` 不被改写。公开 HTTP 仅返回安全 receipt。独立只读 closeout QA 为 PASS_WITH_RISKS，无 Critical/High blocker。

非阻断环境残留：合成 MySQL 服务已停止，33458 无监听；临时数据目录留在仓库外，按执行策略不做破坏性清理。`REAL_PERSONAL_DATA = NOT_USED`、`REAL_PHONE = DEFERRED`、真实电话 `G13 = NOT_REOPENED`；`REAL_PHONE_E2E`、`REAL_USER_ELDER_BINDING_E2E`、`REAL_APPOINTMENT_SUBMISSION`、`CROSS_DEVICE_E2E`、`TRIAL_RELEASE_E2E` 均为 `NOT_RUN`。Synthetic 事务证据不升级真实环境状态，也不打开正式 Appointment 提交。

当前下一任务仅为 **Post-C3-Transactional-Integration Successor Discovery**。本 closeout 不选择或实施后继功能，也不更新 Drive-only 的 Living Current-State Router。
