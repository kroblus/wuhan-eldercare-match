# Authenticated Elder Record Identity and Responsible User Binding — Implementation Handoff V1

状态：`FROZEN_IMPLEMENTATION_HANDOFF / NOT_STARTED`

冻结基线：`b287db140c1b4dcc758bcf824dcc1ea8cc67e2b8`

```text
HANDOFF_ID = AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_IMPLEMENTATION_HANDOFF_V1
PHASE_NAME = Authenticated Elder Record Identity and Responsible User Binding Production Foundation
PHASE_TYPE = BACKEND_DOMAIN_FOUNDATION
PHASE_ID = TO_BE_DEFINED_BY_PROJECT_GOVERNANCE
SOURCE_CONTRACT = AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1 / FROZEN
PRODUCT_DECISIONS = CLOSED
IMPLEMENTATION = NOT_STARTED
IMPLEMENTATION_READY = TRUE
REAL_PHONE_REQUIRED_FOR_SELECTED_PHASE = NO
LEGACY_ELDER_BACKFILL = FORBIDDEN
EXPECTED_NEW_FLYWAY = YES
```

本文冻结下一后端 Foundation 的实现范围、依赖、迁移兼容、失败关闭与验收证据。它只落实已有 Frozen Contract，不创建新的业务身份、授权或 Institution 语义，不实现 Mini Program 页面或正式 Appointment 成功流程。

## 1. Source of Truth

按以下顺序实施：

1. `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1.md`：V1 一名 C5 负责用户与一个 ElderRecord 的身份、绑定和 Appointment 引用语义；其中对多老人 PRD 表述的收窄是已记录的 Owner 决策。
2. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`（C3）：C5 trusted principal、正式 Visit 提交的引用授权、失败关闭与幂等边界。
3. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`（C1）：Visit 身份引用及精确 Institution revision 语义。
4. `ASSESSMENT_CONTRACT_V2.md`、`ELDER_PROFILE_CONTRACT_V2.md`：Assessment 与派生 Profile 的身份分离和历史版本语义。
5. `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md`：`published` 的公开展示含义及 Institution 历史 revision 边界。
6. 当前 C5 session、C3 Visit 提交/reference seam、Institution revision repository 与 Flyway V1–V7，只作为可复用实现事实。
7. 本 Handoff 只约束阶段范围和证据，不覆盖以上 Contract。

本轮定向检查得到的实现事实：

- C5 已由 `C5AuthEvidenceResolver` 和 JDBC session repository 把有效 session 解析成服务端 `TrustedPrincipal(userId)`；V2 持久化 auth identity/session。复用该边界，不增加第二套用户身份。
- C3 已有 `ReferenceAuthorizer` seam；当前缺省实现为 `UNAVAILABLE`。没有生产 ElderRecord repository、Elder identity binding 或 Assessment 持久层。`institution_visit_v1.elder_id` 当前是非空字符串列，不是可证明的 ElderRecord ownership 关系。
- Flyway 当前链为 V1–V7。V1 已有 Visit 数据结构，V2 为 C5，V5 为 Institution revision/current-head，V6 为 Operations principal 与 Visit grant，V7 为 Visit lifecycle audit。新迁移必须追加到该链；实现时按实际最新版本选号，不在本文冻结版本号。
- V5 可解析已发布 revision 和 current head；发布快照写入 `recordStatus=published`。该值仅表示可展示。没有找到按精确 `institutionId + revision` 记录的 Appointment eligibility Operations 授权来源。V6 的授权对象是 Visit lifecycle，不是 Institution appointment eligibility。
- Backend 没有 Assessment/ElderProfile production repository、service 或 migration。本阶段不得把 Assessment production persistence 顺带纳入；只能提供稳定的 ElderRecord association application boundary，供后续拥有 Assessment 语义的实现调用。

这些是基于本次定向路径检查的 capability 结果，不代表完成全仓审计。

## 2. Goal and Dependency Shape

建立一个后端可信身份/引用基础：

```text
C5 session
  -> trusted userId
  -> resolve or establish that user's sole server-owned ElderRecord
  -> resolve Appointment Elder reference from the binding
  -> validate exact current + published Institution revision
  -> validate explicit Operations appointment-eligibility authorization
  -> return a minimal authorized reference result to its owning application use case
```

完成后，正式 Appointment 调用方能从服务端获得唯一 Elder 引用，并在写入前验证机构引用资格。任何前置缺失都返回稳定的拒绝/不可用结果且不创建 Visit。该 Foundation 不代表 Appointment create/success flow 可用。

## 3. In Scope

### 3.1 Elder identity and responsible-user binding

- 持久化最小 `ElderRecord` identity 与唯一 responsible C5 `userId` 绑定；只保存实现稳定身份所需字段和服务端审计时间，不保存姓名、电话、健康答案、Assessment 内容、证件或完整 Profile。
- 提供服务端生成不透明、稳定 `elderId` 的 application/persistence boundary；C5 resolver 是唯一用户身份输入。
- 支持 authenticated user 尚无记录时的明确后端 establish/resolve use case，以及已有记录的 owner-safe resolution。重复或并发调用收敛到同一个 binding。
- 对已绑定用户创建第二个可用记录、换绑、跨账号访问或使用客户端自报 owner 均失败关闭。
- 为下游 Assessment/Profile 消费者定义内部 association seam：只传 trusted user principal / resolved `elderId` 和 Consumer Contract 明确允许的引用，不把 local draft ID、`assessmentId` 或 ElderProfile 当作 identity。

首次绑定只能由明确的服务端 application use case 发起。登录、普通读取、fixture 命中或“目前没有记录”本身不能静默创建 ElderRecord。该 use case 不扩展为 Assessment 生产持久化或新的用户界面。

### 3.2 Appointment reference authorization foundation

- 实现服务端按 C5 principal 解析其唯一绑定 ElderRecord；请求携带 `elderId` 时只把它当 assertion，与服务端解析值不符则拒绝。
- 让现有 C3 `ReferenceAuthorizer` 获得生产可用的只读授权能力，或提供等价 application port；其判断必须基于服务端当前 principal、Elder binding 和 Institution authority。
- Institution 检查必须绑定精确的 `(institutionId, institutionRecordRevision)`，并同时确认该 revision 是当前 revision、状态为 `published`，且存在针对同一精确 revision 的显式 Operations appointment-eligibility 授权。
- 当前代码缺少最后一项授权来源。实现可增加最小、server-owned、受控写入的授权记录/配置源，并记录可追溯的批准来源和服务端变更事实。不得新增自助用户/运营授权页面、广泛 RBAC、通用机构管理员角色或默认授权。来源未配置、记录缺失、无法解析、授权已撤销或 revision 不匹配一律不可预约；若所选来源支持有效期，过期也必须失败关闭，但本 Handoff 不要求新增有效期规则。
- 显示用历史 revision resolver 与新 Appointment eligibility resolver 必须分离。历史 exact display success 不代表当前可预约；不得用 latest revision 替代请求 revision。
- 本阶段不创建或确认 Appointment/Visit，不改变 Visit 状态，不接 Mini Program create/success 页面。reference authorization 成功只表示该引用前置条件通过，不是 Visit 提交成功。

## 4. Authority Model and Client Firewall

服务端权威字段：

| 信息 | 唯一来源 |
|---|---|
| responsible `userId` | 现有 C5 authenticated session resolver |
| `elderId` | 服务端稳定 ID source 与已持久化 binding |
| binding cardinality | 数据库约束 + application transaction/concurrency handling |
| Institution current revision | V5 current-head/revision authority 或等价可信 source |
| `recordStatus` | 指定精确 revision 的服务端发布快照 |
| appointment eligibility | 对指定精确 revision 的显式 Operations authorization source |
| created / recorded timestamps | 服务端时钟 |

客户端不得指定或覆盖 `userId`、owner/responsible user、权威 `elderId`、机构最新 revision、`recordStatus`、eligibility、批准者或授权状态。兼容性请求可以带一个 `elderId` assertion，但服务端必须解析后比较。多余同名字段不得影响可信结果。

严禁以手机号、raw OpenID、姓名、local draft ID、Assessment ID/Profile key、推荐结果、访问路由参数或 TEST_ONLY fixture 作为身份/授权来源。

## 5. Persistence and Migration Policy

- 必须新增 forward-only Flyway migration，版本号由实现按真实 migration chain 决定。不得修改 V1–V7。
- 新 schema 必须能 enforce：一个 authenticated C5 `userId` 至多一个 V1 bound ElderRecord；一个 ElderRecord 恰好一个 responsible C5 user。并发创建、重试或跨事务竞争不得生成两个可用 `elderId`。
- 授权来源如落库，必须将授权精确绑定到 `institutionId + institutionRecordRevision`，且能表达有授权、无授权及撤销后的非授权结果；未配置不等于允许。有效期不是本 Handoff 的必需字段。具体表、列、编码和并发技术由实现决定。
- migration 在已有 V1–V7 数据库上升级不得重写或删除 Visit、Evaluation、C5 session、Institution revision/head、Operations 或 lifecycle audit 数据；升级后的第二次启动必须通过 Flyway validation。
- 现有 `institution_visit_v1.elder_id` 值无法证明来源、身份或 owner binding。禁止从其值、phone/name、历史 Evaluation、fixture、local draft 或 Assessment/Profile 反向创建、认领或回填 ElderRecord/binding。
- 不得为旧 Visit 自动赋予新 FK/owner 语义。若旧非空 `elder_id` 使直接 FK 不兼容，采用分阶段/新引用策略；保留历史原值，不能伪造 parent rows 或删除旧 Visit。任何新引用约束只能作用于能被新权威流程证明的数据，并保持旧 Appointment owner-read/Evaluation 读取兼容。
- 任何 FK、字段或 DTO 变化须保持旧 Visit 的 `elderId` 和精确 Institution revision 历史读取不变；对无法验证的旧引用维持原有历史/不可用语义，不能推断出新 owner。
- empty production source 是合法状态。测试可使用 synthetic C5/Visit/Institution 数据；生产环境不得自动 seed、test fallback 或默认 grant。

## 6. API and Application Boundary

不冻结新的 HTTP path 或 wire DTO。实现应遵循现有 API/result/error architecture，并提供最小服务端 application capability，语义上覆盖：

1. 在已认证 C5 principal 下 resolve/establish 当前 sole ElderRecord binding；
2. owner-safe resolve 当前 user 的 ElderRecord 引用；
3. 校验 Appointment 请求的 Elder assertion 是否与 binding 一致；
4. 对 exact Institution revision 计算 `eligible / ineligible / unavailable`，仅 `eligible` 可用于后续正式 Appointment 提交；
5. 对无绑定、错配/他人记录、非 current/unpublished revision、无显式 Operations 授权、source unavailable 和技术失败保持明确分离且 fail closed。

不要返回完整 C5 User、raw session evidence、Elder health/Profile/Assessment、Institution snapshot/evidence、Operations credentials 或授权内部 Secret。错误响应不得让未授权用户枚举他人 ElderRecord 是否存在。

具体创建触发点、路由、DTO 名称、ID 算法、存储格式及操作授权 source 的技术接入属于本阶段受 Contract 约束的实现选择；不得通过这些选择改变 V1 产品模型。

## 7. Explicitly Out of Scope

- Mini Program 页面、绑定/选择 Elder UI、Appointment create/success UI 或 production provider 改造；
- 完整 Assessment 或 ElderProfile production persistence/迁移/派生；
- Appointment/Visit 正式创建、状态转换、运营工作台、通知、SMS、CRM/日历；
- 家庭/多 Elder、邀请、共享、代理、转移、切换、替换、删除或 recovery 语义；
- 真实手机号/phone authorization、G13、真实老人/健康/机构数据；
- Institution verified fact/evidence/revision 内容更新；
- Recommendation 读取、写入、重排、评分或派生；
- Admin UI、广泛 RBAC、全机构管理员/顾问身份系统；
- trial/release 配置、真实账号/Cross-device E2E 或发布准备。

## 8. Compatibility and Downstream Impact

- C5 API/session 和 `userId` 身份语义保持不变。
- C3/C1 Frozen Contract 不修改。任何后续 Visit create consumer 都必须继续执行 C3 的鉴权、联系授权、幂等和事务约束；本 Handoff 不宣称正式预约提交已解锁。
- 当前 C3 `ReferenceAuthorizer` 默认 fail-closed。其生产实现不得通过 reference 成功绕过 C3 的其他未满足 gate，也不得返回 synthetic accepted receipt。
- V1–V7 数据与旧 Visit 查询兼容；不进行旧 Elder ownership backfill。若未来新的 Appointment request DTO 要求字段，必须作为兼容扩展处理，并且不得把客户端字段升级为 authority。
- 前端和 matching 当前接口不应因该 Foundation 变化；没有 Mini Program production wiring，也不修改 Assessment/Profile 或 Recommendation 消费模型。若后续需改变公共 DTO 或已冻结消费者，先按兼容性与 Contract successor 规则处理。
- Assessment 生产存储保持缺失/未开始。本阶段只建立 identity association boundary；Assessment 合法持久化、历史版本写入和首次 bind 触发仍归其 owning implementation phase。

## 9. Required Future Validation

以下验证属于未来实现任务，不在本 Handoff Freeze 执行：

- 针对 Elder identity/resolver/authorizer 的 unit/application tests：身份可信来源、validation、错配、hidden/not-authorized、unavailable、技术失败；
- disposable MySQL 上从正式 V1–V7 升级至新 migration，检查 Flyway history/重复启动和已有数据保留；
- 一个用户首次并发/重试建立记录最终只有一个 elderId；重复创建不产生第二条；一个 ElderRecord 不会绑定两个用户；
- C5 session 失效、user A/B 隔离、伪造 userId/owner/elderId、未绑定、跨账号、生产图中无 TEST_ONLY fallback；
- exact current + published + explicit appointment authorization 正向检查；历史 revision、非 current、unpublished、无/撤销/不可用授权均失败关闭；若所选来源支持有效期，还须验证过期后失败关闭；
- 新引用与旧 `institution_visit_v1.elder_id` 数据兼容，不回填/重写旧值，历史 owner-read 与 Evaluation context 不回归；
- Assessment draft/localDraftId/Profile ID 不能成为 ElderRecord authority；不触碰既有 Assessment/Profile 历史；
- 失败事务回滚，不残留孤儿 identity/binding/grant；不修改 Institution verified facts、Recommendation 或 Visit status；
- independent diff-driven Backend QA 和必要的 C5/C3/Appointment owner-read 定向回归。

必须使用 disposable MySQL 验证迁移与真实 JDBC 并发/约束行为；H2/mock 不能替代该 migration/cardinality Gate。不得访问 Owner 或 production database。

## 10. Mandatory Gates

| Gate | Future implementation acceptance |
|---|---|
| G01 Frozen source conformance | 精确实现 Elder Contract V1 及 C1/C3/Assessment/Profile/Institution 边界；不重开已关闭 Owner 决策。 |
| G02 C5 reuse | 仅使用 C5 resolver 得到 trusted `userId`；不改造第二套 auth/session。 |
| G03 Stable identity | `elderId` 由服务端生成、opaque、稳定；不从 client/个人/Assessment/Profile 标识派生。 |
| G04 One-user cardinality | 每个 C5 `userId` 最多一个当前可用 binding，数据库与 application 同时保护。 |
| G05 One-record owner | 每个 ElderRecord 恰有一个 responsible C5 user；无转移、共享或 delegation。 |
| G06 Retry and concurrency | 重复/并发首次建立收敛到同一记录；失败/回滚不留下第二个或半绑定。 |
| G07 Establishment trigger | 不在 login/普通 read 自动建档；只由明确、已授权服务端 use case 调用。 |
| G08 Client authority firewall | userId/owner、权威 elderId、Institution state/eligibility 不接受客户端覆盖；可选 elderId 仅 assertion。 |
| G09 Owner isolation | 其他 C5 user 的记录以既有隐私/隐藏语义拒绝，且不泄露是否存在。 |
| G10 Data minimization | Elder identity store/API 不夹带姓名、电话、健康、Assessment、Profile 或证件数据。 |
| G11 Assessment separation | local draft、assessmentId、答案或完成状态均不是 elderId/owner proof。 |
| G12 Profile separation | ElderProfile 是派生业务快照，不是持久身份；历史/Profile 语义不变。 |
| G13 Visit reference resolver | Appointment Elder 引用解析到 principal 唯一绑定，错配或缺绑定不通过。 |
| G14 Institution exact identity | eligibility 针对请求的精确 institutionId + revision。 |
| G15 Current and published | exact revision 必须是 current head 且 `published`；不得从历史 display 成功推断。 |
| G16 Explicit eligibility source | 必须检查精确 revision 的显式 Operations 授权；缺失/unknown/unavailable/已撤销均拒绝。若所选来源支持有效期，过期亦拒绝。 |
| G17 Controlled grant provenance | 若新增授权存储，授予/撤销经受控、可追溯的 server-side 来源；不自授、不默认、不 seed。 |
| G18 Historical isolation | 不用 latest fallback；旧 Visit 的 institution/Elder identity 及历史读保持原值。 |
| G19 No legacy backfill | 不从旧 Visit、phone、name、openid、draft、Assessment/Profile、Evaluation 或 fixture 推断 owner/binding。 |
| G20 Migration safety | 新 Flyway 只追加；V1–V7 升级和 second startup 正常，已有 Visit/Evaluation/C5/Institution/Operations 数据不破坏。 |
| G21 Legacy compatibility | 旧 `elder_id` 无法验证时保留原有读取兼容，不加会破坏历史行的强制 FK/NOT NULL 语义。 |
| G22 C3 isolation | reference pass 不绕过 C3 auth/contact/idempotency/atomic persistence gates；本阶段不生成 Visit accepted success。 |
| G23 Operations isolation | Operations authorization 只表达合同允许的 Institution appointment eligibility，不授 Elder ownership、Consultant 全局权限或 Visit lifecycle 权限外能力。 |
| G24 Evaluation isolation | Evaluation 不能建立/改变 Elder binding；completed prerequisite 与评价写入语义不变。 |
| G25 Institution and Recommendation isolation | 不更新 verified Institution facts/revisions，不触发 Recommendation 变化。 |
| G26 Test/production isolation | Synthetic fixtures 只在 TEST_ONLY；生产缺失来源不 fallback。 |
| G27 Phone/sensitive boundary | 本 Foundation 阶段 REAL_PHONE_REQUIRED=NO；不读真实个人/健康或公司主体数据，不触发 G13。正式 Appointment 提交仍遵守 C3 独立边界。 |
| G28 Disposable MySQL evidence | 使用隔离 disposable MySQL 完成真实迁移、JDBC/cardinality/concurrency 和 round-trip/rollback 证据。 |
| G29 Targeted regression | 本次直接相关 Backend/C5/C3/Institution/Appointment owner-read checks 通过；不要求无关全仓 QA。 |
| G30 Independent review | 独立 diff-driven QA 确认范围、Authority、兼容性、数据边界和证据。 |

## 11. Pass Criteria and Fail-Stop Rules

只有 G01–G30 全部有证据，才可报告：

```text
ELDER_IDENTITY_PRODUCTION_FOUNDATION = PASS
RESPONSIBLE_USER_BINDING = PASS
APPOINTMENT_REFERENCE_AUTHORIZATION_FOUNDATION = PASS
LEGACY_ELDER_BACKFILL = FORBIDDEN / PASS
```

这不代表 Assessment production persistence、正式 Appointment create/UI、真实微信登录交换、真实用户 E2E、phone、trial/release 或生产发布通过。

下列任一情况必须 fail closed，并停止对应能力：

- 当前请求不能解析到唯一合法 C5 principal；
- 一个 C5 用户已存在可用绑定但还要创建第二个，或关系唯一性无法由 DB/app 可靠保证；
- 新旧 Visit 引用关系无法区分且修复要求推断/回填历史 owner；
- Institution 当前版本、`published` 或精确 appointment eligibility 授权无法证实；
- 授权源只能通过自助客户端、无审计默认值或 TEST_ONLY fixture 建立；
- migration 会重写/丢弃旧业务记录，或旧 Appointment owner-read/Evaluation 读取无法兼容；
- 需要改变 Frozen Contract、Product Source、Assessment/Profile 历史语义或 Recommendation；
- 需要真实手机号/个人数据或修改 C5 identity 才能完成。

如果发现 Frozen Source 冲突，不在实现或本文中静默改写；报告最小冲突并停止受影响部分。

## 12. Governance Snapshot

```text
PRODUCTION_CODE_CHANGE_IN_HANDOFF = 0
RUNTIME_CODE_CHANGE_IN_HANDOFF = 0
TEST_CODE_CHANGE_IN_HANDOFF = 0
SCHEMA_CHANGE_IN_HANDOFF = 0
FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_CHANGE = 0
DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED
IMPLEMENTATION_READY = TRUE
IMPLEMENTATION_HANDOFF_READY = TRUE
PHASE_IMPLEMENTATION = NOT_STARTED
```

实现阶段若改变长期 Backend boundary，应按仓库治理更新对应 CURRENT architecture/reference；不得修改旧 Frozen Contract 正文。实现阶段自行选择 API/table/column/ID algorithm/transaction/locking 技术，前提是所有 mandatory gates 通过。

## 13. Next Task

唯一建议的下一任务：

**Implement Authenticated Elder Record Identity and Responsible User Binding Production Foundation**

实施任务应单独确定实际文件、API 兼容面、新 Flyway 版本和验证命令；不能由本 Handoff 推断出正式 `V1.2-C7` 编号，也不能扩大到 Appointment create/success UI。
