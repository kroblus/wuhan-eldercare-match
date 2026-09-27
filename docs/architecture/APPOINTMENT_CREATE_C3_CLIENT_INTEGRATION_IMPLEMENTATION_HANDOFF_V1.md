# Appointment Create / C3 Client Integration — Implementation Handoff V1

状态：`FROZEN_IMPLEMENTATION_HANDOFF / NOT_STARTED`

冻结基线：`3d9834edceab1d1e4e5f2fab75a32576a72e6a95`

```text
HANDOFF_ID = APPOINTMENT_CREATE_C3_CLIENT_INTEGRATION_IMPLEMENTATION_HANDOFF_V1
VERSION = V1
POST_C3_TRANSACTIONAL_SUCCESSOR_DISCOVERY = PASS
PHASE_NAME = Appointment Create / C3 Client Integration
PHASE_TYPE = MINIPROGRAM_CROSS_LAYER_INTEGRATION
PHASE_ID = TO_BE_DEFINED_BY_PROJECT_GOVERNANCE
PRODUCT_DECISIONS = CLOSED
SOURCE_CONFLICT = PRESENT_BUT_OWNER_RESOLVED_FOR_V1
NEW_CONTRACT_REQUIRED = NO
IMPLEMENTATION_HANDOFF_REQUIRED = YES
IMPLEMENTATION = NOT_STARTED
IMPLEMENTATION_READY = TRUE
EXPECTED_BACKEND_CHANGE = NO
EXPECTED_NEW_FLYWAY = NO
NEW_SCHEMA_EXPECTED = NO
REAL_PHONE_REQUIRED_FOR_IMPLEMENTATION = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
C3_FORMAL_APPOINTMENT_SUBMISSION = STILL_CLOSED
BLOCKERS = 0
```

本文冻结下一小程序跨层集成的责任和 Gate，不修改 Product 或 Frozen Contract，不开放生产预约能力，也不实现页面。只有经审核的 client integration 可以消费既有 C5、Elder、Institution、C6 与 C3 能力。

## 1. Authority and source identity

依次遵守：

1. `docs/product/README.md` 指定的两份 V1.2 Product PDF，特别是页面级 PRD 的 Appointment Create、Success、我的预约、隐私与跳转要求。
2. `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md`（C1）：字段语义、草稿、显式提交、精确 Institution revision、联系用途、幂等、回执与状态语义。
3. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md`（C3）和 `V1_2_C2_IMPLEMENTATION_HANDOFF.md`：可信主体、公开结果、候选隔离、同 key 重试和错误 taxonomy。
4. `V1_2_C5_IMPLEMENTATION_HANDOFF.md`、`V1_2_C6_IMPLEMENTATION_HANDOFF.md`：opaque session evidence、C6 purpose-bound phone evidence 与未完成的真实 Provider Gate。
5. `AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1.md`、其 Implementation Handoff、及 `C3_CANONICAL_REFERENCE_ELDER_BINDING_TRANSACTIONAL_INTEGRATION_IMPLEMENTATION_HANDOFF_V1.md`：V1 单 Elder 绑定、显式 establish、canonical reference 事务与精确授权。
6. `WECHAT_INTERACTION_CONTRACT.md`：物理点击、单一事件链、validation、Back、错误和导航行为。
7. 当前已提交 Backend HTTP DTO 与 Mini Program Application/service/page 仅用于识别 API 和实现现状，不覆盖上述语义。

当前起始源码身份为 `3d9834edceab1d1e4e5f2fab75a32576a72e6a95`。Product 多老人 wording 与 Elder V1 的差异已由 Owner 批准收窄并写入 Frozen Elder Contract；本 Handoff 不重开该决定。`CONTRACT_INDEX.md` 与 archive 不作为本 Handoff 的依据。

## 2. Preconditions and current capability

前置能力已完成且应直接复用：C5 trusted session；ElderRecord 建立/解析；Institution 精确 current/published/appointment-operational eligibility；C3 原子 Visit create-or-replay；C6 后端手机号交换与用途限定消费；owner-read、Lifecycle、Evaluation。

当前缺口是 Mini Program `pages/appointment/create.*` 和 `success.*` 仍为 scaffold；预约页面没有字段、C5/Elder consumer、C3 HTTP transport、成功回执 Gate 或表单交互。顾问页已经有一个独立 C6 `/phone/verify` 消费者，但它用于当次顾问联系授权，不可复用于 Appointment。Appointment Application port 当前期待包含私有 `candidate` 的内部结果，而公开 C3 HTTP 只返回安全 `SubmissionResultV1`；未来适配必须迁就公开接口。

当前 Institution Detail route parser 可从现有 list/detail flow 携带并验证 canonical `institutionId + recordRevision`。Institution Detail 页面暂时没有 Appointment CTA；唯一现有 `/pages/appointment/create` 导航来自没有 Institution 身份的全局 Consultant 页。后续实现必须接上精确 Detail 身份，不能推断机构。

## 3. Scope

本阶段范围仅为一个可闭合的用户流：

```text
explicit Appointment entry
  → exact Institution context
  → C5 session and sole Elder resolution
  → minimum source-supported form
  → explicit final submit / one-time phone authorization
  → C3 public HTTP request and safe receipt adapter
  → accepted/replayed-only success navigation
```

包括 create 页面、必要的 Institution Detail / Consultant entry wiring、最小 Appointment view/application/transport adapter、Elder client consumer、一次性 code 提交、同 key retry 与 public-safe 最小 Success 展示。不得扩展为 Elder CRUD 或完整顾问/运营流程。

不包括：Appointment create 以外的新 Backend 领域能力、C3 transaction 重做、Owner-read/Lifecycle/Evaluation 改造、我的预约联系/取消、Operations/Admin UI、Recommendation/Institution verified facts、Assessment/Profile 持久化、真实 phone rollout、生产发布或多 Elder。

## 4. Entry and exact Institution context

| 入口 | 当前身份来源 | 后续实现行为 |
|---|---|---|
| Institution Detail | `parseInstitutionDetailRouteQuery` 校验后的 `identity.institutionId` 与正整数 `identity.recordRevision` | 在该精确 Detail 上增加“预约看院” CTA；只把这一对值传入 create。Detail 当前是否为 latest/eligible 不能由本地页面决定，C3 最终判断。 |
| 全局 Consultant 页 | 当前 `onAppointmentTap` 只打开 `/pages/appointment/create`，没有 Institution 身份 | 改为打开现有 Institution List；用户明确选择列表机构进入其精确 Detail 后，再点 Appointment CTA。Consultant、assignment 或 ConsultantProfile 不能选择/推导机构。 |
| 直接 URL、分享链接、其他无上下文入口 | 可能缺少字段或只带机构名/旧 `id` | create 校验 canonical `institutionId + recordRevision`；缺少、非法或不完整则 fail closed，显示可见错误并返回/引导至 Institution List。此状态不得 GET/POST Elder、获取手机号、preflight 授权或提交 C3。 |
| Recommendation / direct Detail | 已有详情 route 的 canonical pair；Recommendation 的源上下文不是预约 authority | 仅传 canonical pair；不得从卡片文本、列表下标、Recommendation/Profile 或缓存重建 ID。 |

Revision 在 Mini Program route/Domain 中为正整数；C3 body 使用其 canonical 十进制字符串（不补零、不转换到最新值）。若 route 指向历史或已失效 revision，不得自动用 latest 替代；可要求用户返回并明确打开当前 Detail。Institution 当前没有面向 Mini Program 的 eligibility/preflight HTTP。客户端展示已选详情只表示上下文，不显示“可预约/已授权”；C3 事务的拒绝是权威结果。Preflight、页面缓存或本地 published/display 状态均不是写权限。

## 5. V1 Elder boundary and explicit create

```text
ONE_RESPONSIBLE_C5_USER → AT_MOST_ONE_ELDER_RECORD
ONE_ELDER_RECORD → EXACTLY_ONE_RESPONSIBLE_C5_USER
FAMILY_ACCOUNT_MODEL_V1 = NONE
MULTI_ELDER_MANAGEMENT_V1 = NOT_SUPPORTED
APPOINTMENT_ELDER_SELECTION_V1 = IMPLICIT_SINGLE_BOUND_RECORD
```

没有 Elder selector、列表、切换、添加另一个老人、家庭/共享/授权 UI。页面只表达“当前绑定的老人档案”；当前 ElderRecord 不提供可供本表单显示的姓名，不能编造姓名或从 Assessment/Profile 推断。若页面需要展示 Elder identity，只能用服务端解析的现存绑定，不把 opaque `elderId` 当作公开姓名。

触发顺序：页面加载不做身份请求或建立；登录本身不建立；Institution context/preflight/read 不建立。用户完成本地必填 Appointment 字段并物理点击明确的“提交预约申请”后，该 action 才构成显式 Appointment intent。此时可以取得 C5 session、先 GET `/api/v1/elder-record` resolve；若已绑定，继续使用该 opaque `elderId` 作可选 assertion；若明确 `not_found`，才 POST `/api/v1/elder-record` 进行 current-user establish。服务端只接受 `X-Auth-Evidence`，POST 无 owner/body；不能传入伪造 userId 或 elderId。C3 随后仍按当前 C5 principal 重解析唯一 Elder；客户端值永远只是 assertion。

如果明确提交意图后 Elder establish 成功、后续电话或 C3 失败，ElderRecord 保持有效；不得删除或重新创建，表单字段保留，下一次提交仍重新 resolve 当前服务端绑定。Missing/expired/invalid C5、resolve/create unavailable 和异常均 fail closed；手机号、openid、页面字段、Assessment/Profile、历史 Visit 都不是 identity fallback。C5 前端只能复用 `C5AuthenticatedBackendSessionV1` 获得的 opaque `sessionEvidence + expiresAt`，在 service 内设置 `X-Auth-Evidence`；绝不本地伪造 `userId`（当前 backend auth response 不返回 userId）、不按 phone 生成 principal，也不把 session evidence 放进 Page/ViewModel、route、storage draft、日志或错误。

## 6. Form fields, validation and payload

| 页面概念 / wire 字段 | 来源与正式要求 | 本地校验 | C3 提交映射 / authority | 失败时草稿 |
|---|---|---|---|---|
| 机构 / `institutionId`, `institutionRecordRevision` | Detail 的 canonical identity，必填；名称仅来自对应 revision 的 display snapshot | 必须同时存在；ID 合法；revision 为安全范围正整数 | ID 原样，revision canonical decimal string。服务端验证 exact current + published + 显式 operational authorization | 保留已选上下文；不 fallback latest |
| 老人 / `elderId` | 服务端唯一当前绑定记录，正式提交必有；无用户选择 | 本地不能生成；只能消费 Elder resolve/establish 的 opaque ID | body 可省略，或传已解析值作为相等 assertion；C3 权威重解析 | 不清空表单；Elder 已建档不回滚 |
| 预约日期 / `visitDate` | 用户明确日期，必填 | 规范 `YYYY-MM-DD` 且为真实日历日期；不增加未冻结的可预约日期范围 | 同名字符串字段；仅为意向，不生成时间戳 | 保留 |
| 预约时间 / `visitTimePreference` | 用户明确时间偏好，必填 | 去空白后非空，最多 80 字符；不增加服务端未定义的时间段 enum | 同名字符串字段；不是 `scheduledAt` | 保留 |
| 人数 / `participantCount` | 用户输入陪同/参与人数，必填 | 正整数 1–1000，与现有 C2/C3 validator 一致 | 同名数字字段 | 保留 |
| 接送 / `pickupRequested` | Product 标注“真实支持时”；当前没有客户端可证明的支持来源 | 当前 UI **不显示**、不推断、不发送该字段；仅未来存在真实支持来源时可选传 Boolean | Backend 接收可选值不代表本地可声明支持 | 不适用 |
| 联系人 / `contactName` | 用户输入，正式提交必填 | trim 后 1–200 字符；页面附近展示 inline error | 同名 private 字段；不从 Elder/Profile/账号推导 | 保留 |
| 联系电话 / `phone` | 用户在明确 Appointment 场景手工输入，正式提交必填；它不是 C5 identity | trim 后 6–32 字符，只允许数字、`+()-`、空格，数字数 6–20；服务端仍权威验证 | 同名 private 字段。C6 code 对应的 Provider phone 必须与用户所填号码一致；不从顾问/机构电话回填或 fallback | 保留，用户可更正后用新鲜 code 重试 |
| 备注 / `notes` | 用户自愿输入，optional | 未输入则省略；若输入，trim 后 1–2000 字符 | 同名 private 字段；不得从健康答案/Profile自动预填，也不写 Institution fact | 保留 |

Client mirrors existing `validateAppointmentSubmissionV1` structural checks for `contractVersion = appointment-institution-visit-contract-v1`, `kind = appointment_submission_v1`, field types and current transport bounds; C3 validation remains final authority. `idempotencyKey` 是 client 内部每次逻辑提交 attempt 的 opaque key，不是页面字段，不含 PII，符合当前 C3 8–128 字符限制与格式约束。正文不得包含客户端 `userId`、`visitId`、`consultantId`、状态、操作时间、auth evidence 或 phone code。phone、contactName、notes 可在 create 页私有表单 state/view-model 中暂存和保留以支持本次表单及同 key retry；不得进入 route、跨页 navigation payload、Success/public ViewModel、logs、analytics、mock 或错误。canonical fingerprint 仅可在本地私有 service state 用于同 key 一致性校验，不得对外投影或记录。

## 7. Interaction and form-state contract

Appointment Action 遵守 `WECHAT_INTERACTION_CONTRACT.md` 的单链原则：

```text
1 physical tap → 1 component event → 1 page/application action → at most 1 navigation
```

Submit 在无异步占用时保持物理可点击；不得只因表单 invalid 而禁用。一次物理点击先做 local validation：invalid 时零 C5/Elder/phone/C3 request、零导航；显示字段附近 inline error，并按统一 `wx.nextTick`/首错定位模式滚动至第一个错误。修正字段后清除对应错误。有效时每个异步链最多启动一次；重复点击仅忽略/合并该 in-flight action，不能生成多个 Elder POST、phone callback、key、C3 attempt 或导航。loading/disabled 只代表真实异步锁，失败、同步异常、原生 API `fail/complete` 都释放 guard 并给出可见可恢复反馈。

Back 始终可点击，不先验证、不触发网络/授权、不清表单。存在页面栈时返回上页；根栈直接打开时转至明确 Institution List 业务路由，不能把无结果 `navigateBack` 当成功。NavigationGuard 只作第二层防御，不替代唯一事件链。

以下 recoverable failures 均保留有效表单字段：缺失/过期 session、Elder resolve/establish failure、手机号授权拒绝/取消/no-code/provider unavailable、号码不匹配、Institution stale/unavailable、C3 validation/contact/reference rejection、idempotency conflict、network/service/technical failure。不得因失败清除字段或把 local form 显示为 submitted/requested；无需仅为普通表单做跨重启草稿恢复。联系人/电话仅在明确 Appointment action 后可进入 local draft，遵守 C1 数据最小化。

## 8. C6 one-time phone code and C3 request

当前已有 `/api/v1/auth/wechat/phone/verify` 会把传入的一次性微信 `code` 交 Provider 消费，公开 response 只返回 `phoneEvidenceOutcome`，不返回 phone number 或可重用 token。当前 Consultant contact consent 使用该 route；Appointment 禁止调用 `verifyC6PhoneAuthorization`/`/phone/verify` 后再提交同一个 code。

当前 C3 `POST /api/v1/appointment-submissions` 的 `X-Phone-Auth-Evidence` 是直接交给 `WeChatPurposeBoundContactVerifier` 的 fresh WeChat `getPhoneNumber` code。新建分支由 C3 用 `appointment_or_consultant_contact` purpose 对 Provider exchange 一次，并校验结果 phone 与 body `phone` 一致。Body `phoneAuthorization = explicit` 是冻结的显式授权声明，不是 credential。故 Appointment 只在用户显式点击最终 native `open-type="getPhoneNumber"`“授权手机号并提交”后取得 code；用同一 code 直接请求 C3 一次，不经过 `/phone/verify`。用户电话号码仍由用户手工输入，code callback 本身不返回可用于填表的 phone； mismatch 映射到 client-safe contact failure，保留值并允许用户更正/重新授权。

推荐 action chain：常规 Submit 先校验并启动这次显式预约 intent、取得 C5 session、resolve/必要时 establish sole Elder，然后页面呈现明确说明用途的原生 phone authorization submit control；该 control 的一次 tap 只产生一个 callback 与一个 C3 dispatch。若现有 Mini Program/API 技术无法在原生授权手势前做同步 validation，则使用上述两步控件，不在 invalid 表单时请求 phone。授权拒绝、取消、无 code、`getPhoneNumber` fail 或 capability/provider unavailable：不发 C3、不写 Visit、不进 Success；恢复按钮并保留表单。不得改以测试号码、缓存 phone、固定号码或 synthetic production success 兜底。

Network result ambiguity：C3 在最终 create 前先按可信 C5 owner + idempotency key 查 committed exact replay；已提交且 canonical body 相同则返回原 `replayed` receipt，不再验证/消耗本次 phone code。若旧请求没有提交，retry 仍用同一 key + 完全相同 canonical body，但用户必须重新执行显式 native phone authorization，向新尝试提供 fresh code。客户端绝不重发/假设旧 code 可复用，绝不调用 `/phone/verify`；不得盲目换 key 逃离未知结果。Retry key 与原 request 在可重试页面状态中保持稳定，直到 authoritative success/replay 或明确 source-supported terminal resolution。

`REAL_PHONE = DEFERRED`、`G13 = NOT_REOPENED`。真实微信账号能力、隐私配置与 provider positive E2E 未证实；本 Handoff 的 code flow 是源代码可实现的路径设计，不是 phone authorization 的真实通过证据。

## 9. Idempotency lifecycle

- 一次明确 submit intent 创建一个 key；rapid tap、异步 callback、网络重试、同一表单的 retry 均复用该 key。
- C3 canonical body 按现有 C1/C2 顺序和 normalizer 建立；exact Institution pair、Elder assertion、预约字段、contactName、phone、固定 purpose/authorization 和已提供的 optional values 共同定义同一请求。Phone evidence header、C5 session evidence 和可变 Institution eligibility 不进 canonical body。
- 同 key + 同 canonical body + 服务端已提交 → 原 Visit 的 `replayed` receipt；同 key + 不同 body → `IDEMPOTENCY_CONFLICT`，不得静默当成功或偷偷换 key。
- 联系拒绝、Elder/Institution/validation rejection 等确定未提交结果后，用户未改变任何 canonical 值的同一逻辑 retry 可保留 key，并在 phone retry 时取 fresh code。用户有意改变任一 canonical 字段或创建新的预约意图，只有在前一 outcome 已知/已解决后才创建新 key。
- HTTP dispatch 后的 timeout/disconnect 是 outcome unknown，不能告诉用户“未提交”；保留表单、旧 canonical body 和 key，重试使用同 key。当前要求至少覆盖快速点击、callback chain、transient network 与 page-local retry；Product/C1 没有要求一般草稿跨 app restart 自动恢复，未来 implementation 不得把通用跨会话草稿恢复扩为必需产品能力。应用销毁本地 pending 状态后不得自动重提、造成功或自动生成 key 并称为原 retry。

## 10. C3 public transport and safe result adapter

请求固定由 appointment service transport 发出：

```http
POST /api/v1/appointment-submissions
Content-Type: application/json
X-Auth-Evidence: <C5 opaque sessionEvidence>
X-Phone-Auth-Evidence: <fresh getPhoneNumber code>
```

```json
{
  "contractVersion": "appointment-institution-visit-contract-v1",
  "kind": "appointment_submission_v1",
  "idempotencyKey": "<opaque stable key>",
  "institutionId": "<exact id>",
  "institutionRecordRevision": "<canonical positive decimal string>",
  "elderId": "<optional server-resolved equality assertion>",
  "visitDate": "<YYYY-MM-DD>",
  "visitTimePreference": "<user preference>",
  "participantCount": 1,
  "contactName": "<private user input>",
  "phone": "<private user input>",
  "phonePurpose": "appointment_or_consultant_contact",
  "phoneAuthorization": "explicit",
  "notes": "<optional private user input>"
}
```

`pickupRequested` is omitted unless a truthful supported pickup capability is later established. `elderId` may be omitted; if included it is only an assertion. No locally fabricated `userId` is required: Backend derives owner from `X-Auth-Evidence`.

Normal public `SubmissionResultV1` shape is `{ outcome, code, receipt }`. Only `outcome=accepted|replayed`, consistent code, and a valid receipt may enter success. Receipt exact safe shape is:

```text
contractVersion = appointment-institution-visit-contract-v1
kind = appointment_submission_receipt_v1
visitId = nonblank opaque server value
institutionId = exact submitted institutionId
institutionRecordRevision = exact submitted decimal revision
status = requested
acceptedAt = valid server timestamp
publicMessage = 预约申请已提交
```

Validate the complete wire shape and outcome/code agreement before application projection. Server does not echo Elder, date/time/count or Institution display name in the public receipt: the page may show only (a) the safe server receipt above and (b) a minimal `submittedSummary` copied from this exact normalized request and its exact source Detail display snapshot. That summary is explicitly client-submitted intent, not a server Visit/lifecycle projection. Never fabricate an `InstitutionVisitV1`, `InstitutionVisitPublicSnapshotV1`, owner, phone, status transition or internal candidate to satisfy old `AppointmentSubmissionPortV1`.

Required layers:

```text
SubmissionResultV1 public transport DTO
  → strict AppointmentSubmissionTransportResponseV1 parser
  → client-safe Application accepted receipt or error union
  → minimal submitted summary + validated receipt in one-shot in-memory navigation state
  → Success Page ViewModel
```

Replace the Application port’s internal-candidate dependency with the public-safe transport/receipt boundary. Do not change Backend DTO to re-expose `candidate`, `PersistedVisitCandidateV1`, `userId`, `elderId`, `contactName`, phone, authorization facts, repository IDs or transaction/audit internals. For unexpected non-success/error-handler shape (including internal result with `candidate:null`), malformed DTO, mismatched Institution pair, wrong status/message, unknown outcome, HTTP error or parser error: no success; return safe technical/service result and retain fields. Ignore body stack/provider/network text and map only known C1/C3 codes to existing Application taxonomy:

| Public C3 result | Page-safe mapping |
|---|---|
| `rejected/AUTH_REQUIRED` | `AUTH_REQUIRED`; offer source-supported login/session retry |
| `rejected/CONTACT_REQUIRED` | `CONTACT_REQUIRED`; explain authorization/contact needs retry, no phone details |
| `rejected/VALIDATION_FAILED` | `VALIDATION_FAILED`; safe general form feedback/inline mapping only for known local fields |
| `rejected/REFERENCE_UNAVAILABLE` | `REFERENCE_UNAVAILABLE`; safe Institution/Elder unavailable message; no existence/owner/auth reason |
| `conflict/IDEMPOTENCY_CONFLICT` | `IDEMPOTENCY_CONFLICT`; preserve form and same-attempt state; never silently generate another key |
| `unavailable/SERVICE_UNAVAILABLE` | `SERVICE_UNAVAILABLE`; retry-safe visible message |
| `technical_failure/TECHNICAL_FAILURE`, unknown/malformed shape | `TECHNICAL_FAILURE`; generic recoverable message |
| network failure before/after dispatch | safe transport failure; after dispatch mark outcome unknown and same-key retry only |

Backend’s global malformed/unexpected handler can return a non-public internal DTO shape with null candidate; strict client parser must reject it, and its null candidate carries no data. Optional error-envelope hardening is not a prerequisite to this integration. Do not reveal whether a foreign Elder exists, userId/binding, hidden Institution authorization, private phone evidence, internal exception or operator identity.

## 11. Success, state, and navigation

Only a fully validated C3 `accepted` or `replayed` receipt for the exact submitted Institution pair may arm one success navigation. A request dispatch, valid local form, Elder creation, preflight/detail load, phone callback, `/phone/verify`, local mock, unknown network outcome, `requested` local draft or any non-success result never opens Success.

Success receives the public receipt plus exact, normalized, non-private submitted summary through one-shot in-memory state (e.g. page-scoped/app service result channel); do not put phone, contactName, session/code, Elder owner, candidate or private evidence in route/query. Do not treat arbitrary `visitId` route parameter as proof. Reload/deep-link/forged route without the in-memory validated receipt fails closed and returns to the form/list or renders unavailable; it does not show success. Success navigation is guarded and runs once; callback/navigation error releases guard with visible recoverable behavior.

Minimal Success may display the same-revision Institution display name if available, user-submitted visit date/time preference and participant count from the submitted summary, plus receipt `requested`/`acceptedAt` with wording “预约申请已提交”. The summary values remain the user's submitted intent; current lifecycle truth comes only from owner-read/Operations. Do not say “预约成功/已确认/已安排”, infer availability or use requested as current status. The current skeleton may be replaced only by this minimal receipt-gated page; a standalone unguarded success UI is out of scope.

After and only after the receipt gate, provide the Product Success actions using existing destinations. The page-level PRD V1.2 p35 §34 requires the primary Consultant action; MVP V1.2 p19 §17 adds the two secondary actions:

| Success action | Exact existing destination | Frozen behavior |
|---|---|---|
| Primary `联系养老顾问` | Consultant tab `/pages/consultant/index` | Switch to the existing Consultant page. Do not pass appointment/elder/contact/phone context or claim a Consultant was notified, assigned, or followed up. This CTA does not trigger C6 phone authorization by itself. |
| Secondary `查看我的预约` | `/pages/appointment/index` | Open the existing owner-read list without a `visitId` or fabricated Visit payload; that page independently loads visits for the authenticated owner. Do not add contact, cancel, or lifecycle behavior here. |
| Secondary `返回首页` | Home tab `/pages/home/index` | Switch to the existing Home tab; carry no private form or receipt data in route parameters. |

Use tab switching for the existing Home and Consultant tab destinations and the page route for My Appointments, with one navigation guard per physical action. Navigation failure keeps the validated receipt-backed Success screen visible and offers a recoverable retry; it never repeats C3 submission. These actions cannot be reached through an unvalidated/deep-linked Success route.

## 12. Production/test and domain isolation

- C5/C6/Elder/Institution missing, invalid, stale, unpublished or unavailable production state fails closed. Empty production data is valid. No production mock provider, fixed phone, fake Elder, hidden grant, fixture success, fallback Institution, seeded visit or TEST_ONLY import.
- Synthetic positive path is permitted only in tests with explicit TEST_ONLY provenance; it proves mapping/navigation logic only, never REAL_PHONE or real Appointment E2E.
- Recommendation writes/recompute/rerank = 0. No Safety/Eligibility/Exactness/PriorityFitVector/Rank Tuple changes.
- No Institution verified-fact, published, revision, CareProcess, availability, map, official phone or appointment authorization mutation. Client consumes only display + exact revision identity.
- No Assessment/ElderProfile identity or production persistence, owner transfer, family/multi-Elder behavior, Visit creation except the exact C3 committed request, lifecycle mutation, Evaluation create/write, or C3 transaction change.
- No new Backend endpoint/change or schema is expected. Reuse current `/api/v1/elder-record` GET/POST, C5 auth, C3 public submit, and Institution Detail route identity. If a needed source semantic is absent, stop with exact gap; do not silently add V9 or expand Backend.

## 13. Future verification and evidence boundary

The next implementation needs direct Appointment Interaction Runtime coverage for required/partial/valid inputs, exact/missing Institution pair, C5/Elder no-create-on-load, explicit establishment, phone denial/no-code, mismatch, retry, public receipt strict parsing, accepted/replayed navigation, direct Success route, failure state retention, rapid taps, Back and guard release. Keep automated, DevTools, Android and real-provider evidence labeled separately.

Because this changes user-visible WeChat behavior, require fresh WeChat DevTools compile/route interaction and generated JS compatibility (`check:wechat-js-compat` plus self-test and the directly relevant TypeScript/appointment runtime checks). These do not replace a final Android 17 real-device interaction Gate. Android Gate covers list/detail/create entry, fields/scroll/keyboard, Back/root-stack fallback, inline validation/first error, rapid taps, Elder explicit action, native phone denial/unavailable, retry release, no duplicate navigation, deep-link fail-safe and no fake success. Positive real-phone/success-page real submission is **not mandatory while `REAL_PHONE = DEFERRED`**; test-only accepted/replayed DTO can prove receipt-to-one-navigation logic, and real device must prove success cannot be reached without a valid persisted receipt. Do not use real personal data, phone/provider enrollment, production DB, Owner MySQL 3306, real phone tests or trial release for this implementation.

Keep labels unchanged:

```text
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
REAL_PHONE_POSITIVE_EVIDENCE = NOT_RUN
REAL_PHONE_E2E = NOT_RUN
REAL_USER_ELDER_BINDING_E2E = NOT_RUN
REAL_APPOINTMENT_SUBMISSION = NOT_RUN
CROSS_DEVICE_E2E = NOT_RUN
TRIAL_RELEASE_E2E = NOT_RUN
```

Phone-path classification at this frozen baseline:

```text
GET_PHONE_NUMBER_CLIENT_ENTRY = EXISTS_ELSEWHERE / MISSING_ON_APPOINTMENT
BACKEND_PHONE_EXCHANGE = COMPLETE
C3_CONTACT_CONSUMPTION = COMPLETE
ONE_TIME_CODE_FLOW = FROZEN
REAL_PROVIDER_POSITIVE_EVIDENCE = NOT_RUN
ACCOUNT_CAPABILITY = DEFERRED_OR_UNKNOWN
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
```

The current Mini Program `getPhoneNumber` entry belongs to the separate Consultant flow; no Appointment-specific control/callback is wired at this baseline. Backend C3 already accepts and consumes the fresh code directly on the new-submission path, but that source capability is not evidence of successful real Provider exchange or of this app/account's eligibility. Implementation must add the Appointment-specific explicit native action and report automated, DevTools, Android and real Provider evidence as separate results.

## 14. Deferred downstream candidates

`My Appointments` contact/view Institution/cancel request is a distinct downstream successor. Cancellation request receipt, authorization, operator handling and lifecycle transition need their own boundary; ordinary C5 must not call Operations lifecycle mutation. Real phone/provider rollout and production/cross-device/trial evidence remain deferred. This Handoff does not preselect or execute any later successor.

## 15. Mandatory implementation Gates

本表 `G01–G30` 是本 Handoff 的未来实现 Gates；既有 real-phone Gate `G13 = NOT_REOPENED` 属于另一命名空间，仍保持未重开。

| Gate | Required evidence |
|---|---|
| G01 Source identity | Implementation/test/QA evidence belongs to the reviewed source; protected worktree changes remain untouched. |
| G02 Frozen source conformance | Current Product, C1/C2/C3/C5/C6/Elder and this Handoff agree; no Frozen Contract edit. |
| G03 One-Elder V1 | One responsible C5 user to at most one record; no family/multi-Elder/sharing. |
| G04 Form mapping | Only §6 fields and source-backed validations/map are used. |
| G05 Exact Institution context | Both canonical ID and revision arrive from actual list/detail selection. |
| G06 Preflight isolation | No client readiness/cache/published check authorizes C3 write. |
| G07 Explicit Elder consumer | Existing GET; POST establish only after validated explicit Appointment intent. |
| G08 No implicit create | Page load, login, read, preflight and phone callback alone create no Elder. |
| G09 Elder ID firewall | No generated/profile/assessment/foreign id; resolved id is only optional assertion. |
| G10 One-time C6 path | Fresh native phone code is sent directly to C3 with explicit purpose and submitted phone. |
| G11 No double consumption | Appointment never calls `/phone/verify` for a code it then sends to C3. |
| G12 Phone intent/privacy | `getPhoneNumber` only on final explicit Appointment/contact action; denial/unavailability fails visibly and safely. |
| G13 Stable idempotency | One opaque key per semantic attempt; same canonical request keeps it; content change/new attempt gets new key only after known/settled outcome. |
| G14 Ambiguous retry | Unknown dispatch outcome is not “failed”; same key/body, fresh phone code; C3 exact replay returns original receipt before code consumption. |
| G15 Public receipt adapter | Strict `SubmissionResultV1` and nested receipt parse; exact request Institution pair checked. |
| G16 Internal candidate firewall | Private candidate/user/contact/auth/repository/transaction facts are never re-exposed to preserve old app port. |
| G17 Validation/first error | Physical Submit click then validation; inline errors, first error visible, zero request/navigation on invalid. |
| G18 Form preservation | All recoverable failures preserve valid fields and are visibly retryable. |
| G19 Success Gate | Exactly one navigation only after valid accepted/replayed persisted receipt. |
| G20 Success truth | `requested` and copy mean “预约申请已提交”, never confirmed/scheduled/completed. |
| G21 Single action | One physical tap through one event channel and one logical action; separate in-flight guards. |
| G22 TEST_ONLY isolation | Positive fixtures are tests only; production empty/unavailable state fails closed. |
| G23 Domain isolation | No lifecycle/Evaluation/Recommendation writes or semantic changes. |
| G24 Backend/schema boundary | No new Backend domain or Flyway; unexpected need is reported, not slipped into this phase. |
| G25 Runtime automation | Appointment interaction regression exercises handlers and actual runtime behavior, not route/text grep alone. |
| G26 WeChat compatibility | TypeScript/JSON/WXML/generated JS and `wx.*` parameters match current supported typings. |
| G27 Fresh DevTools | Fresh project compile and reachable negative/recoverable flow evidence pass. |
| G28 Android 17 | Manual Android 17 interaction Gate in §13 passes; report manual vs automated accurately. |
| G29 Worktree/source safety | Only authorized Mini Program files change; no protected `.codex/**`, secrets, production data, push or unrelated files. |
| G30 Independent QA | Read-only diff-driven QA finds zero Critical/High issues across identity, code consumption, idempotency, receipt firewall and navigation. |

## 16. Handoff PASS and next-task decision

Handoff is frozen because Product decisions remain closed, V1 Elder semantics and exact required form fields are known, existing Detail/List routes provide an honest exact Institution source, C5 session and Elder create are implementable without client authority, direct C3 phone-code consumption is supported, and public C3 receipt carries sufficient safe persisted identity/status to gate Success. The Success display's date/time/count are explicitly the already-submitted request summary, not fabricated server data. Strictly rejecting an unexpected error DTO is safe and does not require a Backend change. No unresolved semantic conflict or Owner decision blocks implementation.

If an implementation discovers a mismatch with these source facts, stop at the smallest seam and report it; do not change Frozen Product/Contract or expose candidate data. For C3 public receipt/schema changes requiring new semantics, successor is `C3 Public Receipt Contract Reconciliation`; a true one-time phone/API incompatibility is `C6 / C3 Phone Credential Integration Reconciliation`; lack of an exact context source is `Appointment Entry Context Reconciliation`.

```text
APPOINTMENT_CREATE_C3_CLIENT_INTEGRATION_HANDOFF = FROZEN
PRODUCT_DECISIONS = CLOSED
NEW_CONTRACT_REQUIRED = NO
SOURCE_CONFLICT = PRESENT_BUT_OWNER_RESOLVED_FOR_V1
ONE_ELDER_V1_BOUNDARY = FROZEN
ELDER_CREATE_CLIENT_BOUNDARY = FROZEN
ELDER_CREATE_TRIGGER = EXPLICIT_APPOINTMENT_INTENT
PAGE_LOAD_ELDER_CREATE = FORBIDDEN
INSTITUTION_CONTEXT = EXACT_ID_AND_REVISION
PREFLIGHT_WRITE_AUTHORITY = ISOLATED
PHONE_ONE_TIME_CREDENTIAL_FLOW = FROZEN
PHONE_DOUBLE_CONSUMPTION = FORBIDDEN
C3_PUBLIC_RECEIPT_ADAPTER = FROZEN
SERVER_INTERNAL_CANDIDATE_EXPOSURE = FORBIDDEN
CLIENT_IDEMPOTENCY_LIFECYCLE = FROZEN
AMBIGUOUS_NETWORK_RETRY = SAFE_REPLAY
FAILURE_FORM_STATE_PRESERVATION = FROZEN
SUCCESS_NAVIGATION_GATE = ACCEPTED_OR_REPLAYED_RECEIPT_ONLY
SUCCESS_COPY = APPOINTMENT_REQUEST_SUBMITTED_ONLY
EXPECTED_BACKEND_CHANGE = NO
EXPECTED_NEW_FLYWAY = NO
REAL_PHONE_REQUIRED_FOR_IMPLEMENTATION = NO
REAL_PHONE = DEFERRED
G13 = NOT_REOPENED
REAL_PERSONAL_DATA = NOT_USED
C3_FORMAL_APPOINTMENT_SUBMISSION = STILL_CLOSED
IMPLEMENTATION_READY = TRUE
BLOCKERS = 0
READY_FOR_NEXT_TASK = TRUE
NEXT_RECOMMENDED_TASK = Implement Appointment Create / C3 Client Integration
```

## 17. Explicit future non-goals

No real phone/provider/privacy certification, real personal-data E2E, FamilyAccount, multi-Elder, Elder management CRUD, Appointment cancellation, Operations lifecycle UI, Evaluation changes, Recommendation changes, Institution verified-fact changes, schema/migration, C3 transactional rewrite, owner-read rewrite, production rollout or successor implementation is included.
