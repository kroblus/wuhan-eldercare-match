# Global Consultant Application Snapshot Contract V1

状态：`FROZEN_PHASE_V1_2_B2_1`

Contract 版本：`global-consultant-snapshot-contract-v1`

Product 版本：`V1.2`

冻结日期：`2026-09-16`

```text
GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT = FROZEN_PHASE_V1_2_B2_1
GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_VERSION = global-consultant-snapshot-contract-v1
OPTION_C_APPROVED = TRUE
GLOBAL_CONSULTANT_SNAPSHOT_REQUIRED = TRUE
GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_CONTRACT_LEVEL
GLOBAL_CONSULTANT_SELECTION = EXPLICIT_PLATFORM_CONFIGURATION
GLOBAL_CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE
GLOBAL_CONSULTANT_INSTITUTION_VERIFIED_FACT_ROLE = NONE
B1_FROZEN_CONTRACT_CHANGE = 0
B2_RUNTIME_CHANGE = 0
PRODUCTION_IMPLEMENTATION_AUTHORIZED = FALSE
```

本文件为无 Institution context 的平台级 Consultant consumer 冻结唯一合法的 global selection 与
public/application snapshot 语义。首个 consumer 是独立 Tab `/pages/consultant/index`。本文是对 B1/B2 的增量
successor，不修改 `CONSULTANT_PERMISSION_CONTRACT_V1.md` 的 Consultant、contact、permission 或 Institution-bound
assignment 语义，也不修改现有 B2 runtime。

本文只冻结语义和后续 Foundation 边界；不实现 production code、Provider、Backend、Page、电话 action 或 QR UI。

## 1. Authority and Normative Language

本文使用：

- **MUST / 必须**：实现不得偏离；
- **MUST NOT / 禁止**：任何层均不得提供该行为；
- **MAY / 可以**：允许但不强制，不得被实现升级为永久 mandatory policy。

本 Contract 的直接 authority 顺序为：

1. 项目负责人正式批准 `OPTION_C_APPROVED = TRUE` 与 `GLOBAL_CONSULTANT_SNAPSHOT_REQUIRED = TRUE`；
2. 当前 Product Source：`docs/product/README.md` 路由的 V1.2 产品文档；
3. frozen `CONSULTANT_PERMISSION_CONTRACT_V1.md`；
4. frozen `V1_2_B2_IMPLEMENTATION_HANDOFF.md` 与已通过的 B2 Institution-bound Foundation；
5. CURRENT `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md`；
6. 本 Contract 对无 Institution context 的新增语义。

如本文与 B1 对 ConsultantProfile、phone、QR/media、permission、Recommendation isolation 或 Institution isolation 的
既有语义发生冲突，以 B1 为准并停止实现；不得修改 B1 或 B2 来适配本文。本文只解决 contextless consumer 的 selection
与 snapshot identity 缺口。

## 2. Frozen Scope

### 2.1 In scope

- platform-level global Consultant selection ownership 与 authoritative source role；
- explicit configuration、missing、unavailable、unknown 与 invalid/failure 边界；
- versioned Global Consultant public/application snapshot；
- B1 public ConsultantProfile、phone 与 QR/media projection 的复用规则；
- Global 与 Institution-bound Consultant application context isolation；
- anonymous/public permission 与 privacy boundary；
- Recommendation V2 与 Institution verified fact isolation；
- 后续 B2.1 Foundation implementation 的稳定输入和输出边界。

### 2.2 Out of scope

- production runtime、Provider、Page、ViewModel、WXML、Less 或 navigation；
- Institution-bound assignment/default resolver 的任何修改；
- Backend API、DTO、DB schema、persistence、auth、media storage、review workflow 或运营后台；
- 真实 Consultant、global configuration、phone 或 QR 数据录入；
- User.phone、Appointment、AI、Visit、CRM 或跨页面入口实现；
- Recommendation V2、Institution frozen semantics、B1/B2 frozen semantics 或 Product Source 修改。

## 3. Frozen Decisions

| ID | Frozen decision |
|---|---|
| B2.1-D1 | Global Consultant selection 归属 Consultant Service 的 platform-level configuration，不归属 Institution Domain |
| B2.1-D2 | Global selection 只能来自 explicit authoritative configuration；consumer、Page、route、Recommendation 或 Institution 不得推断 |
| B2.1-D3 | Institution `DEFAULT_CONSULTANT` 与 Global explicit selection 是两个独立 selection role；不得互相隐式推导 |
| B2.1-D4 | Global Snapshot 有独立 kind/version/context identity，不含 `institutionId`、`recordRevision` 或 assignment |
| B2.1-D5 | Global Snapshot 复用 B1 的 Consultant public profile、phone 和 QR/media eligibility，不建立第二套规则 |
| B2.1-D6 | global configuration missing/unavailable/unknown 是可观察的安全结果；invalid input/provider/projection failure 不伪装成合法 Snapshot |
| B2.1-D7 | Global consumer 不要求登录或 User.phone；公开顾问电话与用户本人手机号授权继续完全分离 |
| B2.1-D8 | Global Consultant 对 Recommendation matching 和 Institution verified facts 的作用均为 `NONE` |

## 4. Two Legal Consultant Application Contexts

V1.2 存在两个并列、不可互相冒充的 Consultant Application context：

```text
Institution-bound context
  canonical Institution identity
  -> Institution assignment / allowed DEFAULT_CONSULTANT fallback
  -> InstitutionConsultantContactApplicationSnapshotV1

Global platform context
  explicit platform-level configuration
  -> configured consultantId
  -> ConsultantProfile validation and B1 public projection
  -> GlobalConsultantPublicApplicationSnapshotV1
```

Institution-bound 路径继续由 B1/B2 定义，必须保留 canonical `institutionId + recordRevision` context。Global 路径明确
没有 Institution context，禁止：

- 放入 fake、null、空字符串或任意 `institutionId`；
- 硬编码、伪造或借用 `recordRevision`；
- 选择任意 Institution 或第一条 Institution assignment；
- 调用 Institution resolver 或 Institution default fallback；
- 将 Global selection 写回 assignment、Institution record 或 verified facts。

内部实现 MAY 共享纯 phone/QR projection helper，但两个 public snapshot 的 kind、versioned contract 与 context identity
必须保持不同。

## 5. Global Selection Ownership and Configuration

### 5.1 Stable role

V1 的稳定 selection role 为：

```ts
type GlobalConsultantSelectionRoleV1 = 'platform_primary_consultant'
```

该 role 表示“平台无 Institution context 的主顾问入口”，不是 Consultant 身份、Institution assignment、Backend record ID
或 UI route。V1 只冻结一个显式 slot；多顾问轮班、自动区域路由、随机选择或 user-selected Consultant 均未获批准。

### 5.2 Authoritative source and mutation

- domain owner：Consultant Service；
- authoritative source role：platform-level configuration；
- mutation authority：B1 定义的 authorized Operations；
- public consumer：read-only；
- Page/ViewModel、小程序客户端、普通用户和 Consultant 本人均不得生成、选择或修改配置；
- future Backend/operations implementation 必须保留 review/audit responsibility，但本文不冻结 API、DB 或审计存储。

### 5.3 Configuration semantics

等价的 validated Foundation representation 必须能够表达：

```ts
type GlobalConsultantSelectionConfigurationV1 =
  | {
      role: 'platform_primary_consultant'
      sourceState: 'configured'
      consultantId: string
    }
  | {
      role: 'platform_primary_consultant'
      sourceState: 'missing' | 'unavailable' | 'unknown'
    }
```

语义如下：

- `configured`：authoritative configuration 显式指向一个 stable `consultantId`；
- `missing`：authoritative slot 不存在或被显式清空；
- `unavailable`：source 明确表示当前不能提供 selection；
- `unknown`：source truth 无法可靠确定，禁止猜测；
- invalid shape、空/非法 consultantId、错误 role、冲突的多个值或 Provider 非法 payload：Application failure，不是合法 state。

实际字段名和存储形式 MAY 由 B2.1 Foundation 最小化，但上述 role/state 语义不可改变。跨进程协议、HTTP/RPC、DTO、
同步/异步形式和持久化 schema 留给未来 Backend Contract。

## 6. DEFAULT_CONSULTANT Role Separation

B1/B2 的 `DEFAULT_CONSULTANT` 继续只属于 Institution assignment path：

```text
institution assignment is exactly missing
  -> configured Institution DEFAULT_CONSULTANT strategy may participate
```

Global path 必须独立为：

```text
platform_primary_consultant configuration is explicitly configured
  -> exact configured consultantId may participate
```

如果两个配置当前指向相同 `consultantId`，只表示两个 authoritative roles 恰好引用同一 ConsultantProfile；不表示：

- Institution default 自动成为 Global selection；
- Global selection 自动成为 Institution default 或 assignment；
- 一个配置缺失时可以读取另一个配置补位；
- inactive、unknown、invalid 或 Provider failure 可以触发另一 role 的 fallback。

## 7. Versioned Public/Application Output

### 7.1 Global Snapshot

V1 public-safe success snapshot 冻结为以下等价 shape：

```ts
type GlobalConsultantSelectionStatusV1 =
  | 'configured'
  | 'missing'
  | 'unavailable'
  | 'unknown'

type GlobalConsultantResolutionStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'

interface GlobalConsultantPublicApplicationSnapshotV1 {
  kind: 'global_consultant_public_application_snapshot_v1'
  contractVersion: 'global-consultant-snapshot-contract-v1'
  context: {
    kind: 'platform_global_consultant'
    selectionRole: 'platform_primary_consultant'
    selectionSource: 'platform_configuration'
  }
  snapshotAsOf: string
  dataProvenance: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  selectionStatus: GlobalConsultantSelectionStatusV1
  resolutionStatus: GlobalConsultantResolutionStatusV1
  consultant: ConsultantPublicProfileV1 | null
}
```

`ConsultantPublicProfileV1`、`dataProvenance` 和 channel projections 复用 B1/B2 的 frozen semantics。新 Contract 不复制或
修改其字段意义。`snapshotAsOf` 必须显式输入，Domain 不读取隐式 wall clock。

V1 Global resolution 不包含 `ambiguous`：该 slot 必须是单值 explicit configuration；冲突的多个 raw configuration 是
invalid Application failure。不得为“类型统一”把 Institution-bound `ambiguous` 注入 Global Snapshot。

### 7.2 Valid state mapping

| Input condition | `selectionStatus` | `resolutionStatus` | `consultant` |
|---|---|---|---|
| explicit configuration + active valid profile | `configured` | 按 B1 phone/QR projection 导出的合法状态 | B1 public-safe profile |
| explicit configuration + inactive profile | `configured` | `inactive` | `null` |
| explicit configuration + profile service status unknown | `configured` | `unknown` | `null` |
| explicit configuration + profile missing | `configured` | `missing` | `null` |
| global configuration missing | `missing` | `missing` | `null` |
| global configuration unavailable | `unavailable` | `unavailable` | `null` |
| global configuration unknown | `unknown` | `unknown` | `null` |

active valid profile 可以在 phone/QR 均不公开时仍作为 public profile 输出；其 overall `resolutionStatus` 必须继续使用 B1/B2
channel-derived 规则。selection 成功不承诺 phone 或 QR available，两类 channel 必须独立表达。

### 7.3 Failure boundary

以下情况不得生成合法 Snapshot：

- request、`snapshotAsOf` 或 provenance invalid；
- global configuration shape/role/consultantId invalid 或冲突；
- configured profile payload invalid 或 consultantId 不匹配；
- Provider 抛错或返回非法 payload；
- media resolution invalid/failure；
- projection invariant failure。

Foundation 必须以 versioned Application result 区分“合法 Snapshot”与“Application failure”。面向未来 Page 的 failure
只能暴露 public-safe unavailable representation，不得暴露 raw payload、internal cause、stack、credential 或 Provider detail。
内部 failure code MAY 用于 targeted QA，但不是 Backend protocol，也不得被 WXML 当作 Domain state。

public-safe result 的稳定边界冻结为以下等价 shape：

```ts
interface GlobalConsultantPublicApplicationFailureV1 {
  kind: 'global_consultant_public_application_failure_v1'
  status: 'unavailable'
}

type GlobalConsultantPublicApplicationResultV1 =
  | {
      ok: true
      value: GlobalConsultantPublicApplicationSnapshotV1
    }
  | {
      ok: false
      error: GlobalConsultantPublicApplicationFailureV1
    }
```

未来 Page/ViewModel 只能消费该 public-safe result：成功时消费 Snapshot，失败时消费稳定的 unavailable presentation state。
Foundation MAY 在 public result 之前保留 versioned internal failure category 供 QA 和 adapter mapping 使用，但不得把 cause、raw
payload 或 Provider detail 传给 Page。是否允许 UI retry 属于未来 interaction handoff，不由本 Contract 推断。

`missing / inactive / unknown / expired / unavailable` 是合法业务/application state；invalid/provider/projection failure 是
技术或 trust-boundary failure。二者不得压平为同一个数据事实。

## 8. Public-safe Field Boundary

Global public/application output MAY 只包含 §7 明确列出的 context/version/provenance/state 字段和 B1
`ConsultantPublicProfileV1`。禁止进入 snapshot 或 public failure：

- raw Global configuration record 或 mutation metadata；
- Institution identity、assignment、default configuration 或 Institution official contact；
- raw ConsultantProfile、private profile、private notes 或 internal service flags；
- internal media ID、storage locator、management URL、review/audit metadata；
- credential、Secret、AppSecret、access token 或 local config；
- User.phone、consent evidence、Appointment record 或健康/Assessment 数据；
- internal Provider、resolver 或 failure implementation detail。

Future Page/ViewModel 只消费 versioned public-safe Global Application output，不得自行读取 configuration、选择 Consultant、
验证 raw profile 或重新推导 contact/media eligibility。

## 9. Phone and QR/Media Conformance

### 9.1 Platform Consultant phone

Global Snapshot 必须复用 B1 `ConsultantPublicPhoneProjectionV1`：

- 只有 configured、approved、active 且号码合法时为 `available`；
- pending/rejected 不暴露 value 并按 B1 映射为 non-available；unknown/unavailable/missing 保持 B1 projection；
- `dialValue` 仅在 public action eligible 时出现；
- label 只能表达平台养老顾问/带看顾问身份；
- `PLATFORM_CONSULTANT_PHONE != INSTITUTION_OFFICIAL_PHONE`；
- 禁止从 Institution official contact、route query、Mock 或 User.phone fallback。

### 9.2 Enterprise WeChat QR/media

Global Snapshot 必须复用 B1 `ConsultantPublicWechatQrProjectionV1`：

B1 QR public eligibility 中的“assignment resolution 合法”是 Institution-bound context 的 resolution prerequisite。对本文
新增的 Global context，其唯一等价 prerequisite 冻结为：`platform_primary_consultant` 已从 authoritative platform
configuration 显式、合法地解析出 exact `consultantId`，且加载到的 valid ConsultantProfile 与该 ID 一致。Global 路径：

- 不创建或读取 Institution assignment；
- 不调用 Institution assignment/default resolver；
- 不把 Global selection 命名或存储为 assignment；
- 不修改 B1 Institution-bound path 的 assignment prerequisite；
- 除此 context prerequisite 外，B1 的 profile service、source、review、lifecycle、`snapshotAsOf` media validation 和
  public-safe resolver 条件全部原样适用。

- 只有真实、approved、active、未过期且 public media resolver 当前确认合法时可输出 `publicImageUrl`；
- unavailable、inactive、expired、unknown、missing 必须保留；
- pending/rejected 不得冒充 public-ready；
- internal media ID、placeholder、fake URL 或 synthetic production QR 禁止公开；
- Global selection/profile success 不代表 QR success；合法 fallback 仅为同一 Consultant 的 eligible platform phone。

本文不冻结 QR upload、approval、storage、CDN、signing、rotation 或 Backend lifecycle implementation。

## 10. Permission and Privacy

继承 B1 permission/privacy boundary：

- anonymous visitor 可以读取合法 Global public snapshot；
- 打开 `/pages/consultant/index`、查看平台顾问电话或 QR 不要求登录；
- Global resolution 不读取、请求、保存或推断 User.phone；
- 查看顾问公开电话不等于用户本人手机号授权；
- snapshot generation 不创建 Appointment、contact request 或任何持久化记录；
- logging/audit 必须遵守最小化原则，不得记录完整 raw profile、phone payload、media locator、User.phone 或 Secret。

用户本人手机号、授权、Appointment purpose、retention/deletion 和 Backend access control 继续由 B1 与未来对应 Contract 管理，
不属于本 Contract 的 implementation scope。

## 11. Isolation Invariants

### 11.1 Recommendation V2

```text
GLOBAL_CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE
```

Global configuration、consultantId、profile、phone、QR、availability 和 snapshot 不得改变 Recommendation Safety、Eligibility、
Exactness、Tier、PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH`、cards 或 ordering。Recommendation 到 Consultant Tab 的
navigation 不构成 selection input 或 matching evidence。

### 11.2 Institution

```text
GLOBAL_CONSULTANT_INSTITUTION_VERIFIED_FACT_ROLE = NONE
```

Global Consultant 不是 Institution fact，不得：

- 改变 Institution revision、Verification、Evidence、Capability、qualification、price 或 availability；
- 读取 Institution official phone 作为 fallback；
- 创建/修改 Institution assignment；
- 把 global selection 写回 Institution record；
- 以 Global context 伪装 Institution-bound snapshot。

## 12. Mock and Fixture Boundary

遵守 `MOCK_DATA_POLICY.md`：

- test-only fixture 必须显式 `TEST_ONLY_SYNTHETIC` 或等价 provenance；
- development mock 必须保持 `MOCK_DEVELOPMENT_ONLY`，且只能从显式开发入口启用；
- production App 不得 import fixture 或将 synthetic global configuration、consultantId、phone、QR 当作真实事实；
- 没有 production global configuration 时，production 必须显示 safe missing/unavailable，而不是启用测试数据；
- fixture 不得进入 Recommendation 或 Institution factual path。

## 13. Downstream Boundary and Change Policy

未来 B2.1 Foundation MUST 依本文实现：

- versioned global selection/config types and validation；
- read-only Foundation port；
- deterministic global resolver；
- public-safe Global Snapshot/application result；
- B1/B2 phone/QR projection reuse；
- state/failure、mock、Recommendation 和 Institution isolation tests。

该 read-only port 只是小程序 Foundation trust boundary，不是 REST/RPC/Backend DTO Contract。API、DB、auth、production
provider、media infrastructure、真实数据 onboarding 与 operations UI 必须由后续独立阶段/Contract 决定。

任何以下变化必须发布新的 Contract revision 或 successor phase，不得就地改写本文：

- 多 global Consultant、轮班/区域/个性化/Recommendation-driven selection；
- consumer 自选 Consultant；
- Global 与 Institution default/assignment 互相 fallback；
- public field、contact eligibility、permission 或 privacy 语义变化；
- Global Consultant 进入 Recommendation matching 或 Institution facts。

## 14. Freeze Result

```text
OPTION_C_APPROVED = CAPTURED
GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_CONTRACT_LEVEL
GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT = FROZEN
B1_FROZEN_CONTRACT = UNCHANGED
B2_IMPLEMENTATION = UNCHANGED
B3_READINESS = BLOCKED_PENDING_B2_1_IMPLEMENTATION
```

本 Contract Freeze 关闭“应采用什么 Global selection/snapshot 语义”的决策 blocker，但不提供 runtime Foundation。只有
B2.1 implementation 完成并通过 mandatory Gates 后，B3 definition 才可恢复；本文件本身不授权 B3 implementation。
