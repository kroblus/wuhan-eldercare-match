# Consultant & Permission Contract V1

状态：`FROZEN_PHASE_V1_2_B1`

Contract 版本：`consultant-permission-contract-v1`

Product 版本：`V1.2`

冻结日期：`2026-09-15`

```text
CONSULTANT_PERMISSION_CONTRACT = FROZEN_PHASE_V1_2_B1
CONSULTANT_PROFILE_CONTRACT_VERSION = consultant-permission-contract-v1
POST_A1_PHASE_APPROVAL = APPROVED
CONTRACT_REVIEW_BASELINE = 9a03e03edf68d0afe7206e7b873586118dcb9c77
PROJECT_OWNER_DECISIONS = APPROVED
PRODUCT_DECISIONS_REQUIRED = 0
PLATFORM_CONSULTANT_CONTACT_IS_INSTITUTION_OFFICIAL_CONTACT = FALSE
DEFAULT_CONSULTANT_POLICY = OPTIONAL_MVP_STRATEGY
CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE
CONSULTANT_DATA_INSTITUTION_VERIFIED_FACT_ROLE = NONE
PRODUCTION_IMPLEMENTATION_AUTHORIZED = FALSE
PRODUCTION_CODE_CHANGE = 0
```

本文件冻结 V1.2 平台养老顾问服务、Institution → Consultant assignment、公开联系方式、企业微信 QR/media、
public/application projection 与 Permission/Privacy 的唯一正式语义。后续 Consultant UI、Institution Detail 顾问
入口、Appointment contact flow、Backend、persistence、authentication、authorization 与 privacy implementation
必须服从本 Contract。

本文不实现上述能力，也不冻结 REST endpoint、数据库 schema、云厂商、CRM、媒体 CDN、具体登录方案或加密算法。

## 1. Normative Language and Source of Truth

本文使用：

- **MUST / 必须**：实现不得偏离；
- **MUST NOT / 禁止**：任何层均不得提供该行为；
- **MAY / 可以**：允许但不强制，不得被实现升级为永久 mandatory policy。

Source of Truth 优先级：

1. 项目负责人对 `V1.2-B1 — Consultant & Permission Contract Freeze` 的正式批准；
2. `docs/product/README.md` 与两份当前 V1.2 Product PDF；
3. frozen `INSTITUTION_CONTRACT_V1_2_1.md`；
4. frozen `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md`；
5. frozen `RECOMMENDATION_CONTRACT_V2.md` 与 `RECOMMENDATION_RULE_CONTRACT_V2.md`；
6. `DOMAIN_CONTRACT.md`、`MOCK_DATA_POLICY.md`、`FRONTEND_STRUCTURE.md` 与根目录 `AGENTS.md`；
7. accepted `V1_2_CHANGE_IMPACT_ANALYSIS.md`，仅作影响、候选范围与决策历史，不是 frozen truth。

当前 Product Source 明确：

- `ConsultantProfile` 承载顾问稳定身份、展示名、平台顾问电话、企业微信媒体和服务状态；
- MVP 可以让所有机构指向 `DEFAULT_CONSULTANT`，不是必须永久采用；
- 联系电话必须标为“养老顾问电话/带看顾问电话”，不得标为养老院官方电话；
- 游客可以查看/联系顾问与企业微信；
- 用户手机号只在明确预约或明确要求顾问联系时获取；
- Consultant interaction 不得改变 Recommendation V2。

如未来实现、旧 scaffold、Mock、candidate analysis 或 UI 文案与本文冲突，以本文为准。若 Current Product Source
未来发生实质变化，应先做 Change Impact Analysis，再决定兼容扩展或发布新的 Contract version。

## 2. Frozen Scope

### 2.1 In scope

- Consultant identity、公开 identity 与服务状态；
- service scope/region 的公开语义；
- Institution → Consultant assignment 与 resolution；
- 平台顾问电话和企业微信 QR/media；
- contact channel public eligibility、rotation、expiry 与 fallback；
- public/application projection；
- ownership、mutation、review 与 audit responsibility；
- anonymous、authenticated user、consultant、operations 的权限边界；
- user phone purpose limitation、最小化、脱敏、留存与删除原则；
- Recommendation V2 与 Institution verified fact isolation；
- downstream implementation boundary。

### 2.2 Out of scope

- production UI、runtime、provider、API、DB、ORM、migration 或运营后台；
- 真实 Consultant、电话、QR、assignment 或 User.phone 数据录入；
- QR storage/CDN/upload、微信登录、consent token 或 Secret 管理实现；
- Appointment/Visit/Evaluation/AI/CRM 业务实现；
- 具体加密算法、密钥管理、retention TTL、物理审计表或删除 job；
- Recommendation V2、Institution frozen semantics 或 Product Source 修改。

## 3. Frozen Product Decisions

| ID | Frozen decision |
|---|---|
| B1-D1 | `ConsultantProfile` 属于独立 Consultant Service，不属于 Institution factual record |
| B1-D2 | `consultantId` 是稳定顾问身份；电话、二维码或展示名变化不得生成新顾问身份 |
| B1-D3 | assignment 是独立关系；resolver 接收 canonical Institution context，但 assignment 绑定稳定 `institutionId`，不绑定或修改 Institution `recordRevision` |
| B1-D4 | 一个 Consultant 可以服务多个 Institution；V1 public/application resolution 对单个 Institution 只输出零或一个已解析顾问，歧义必须 fail closed |
| B1-D5 | `DEFAULT_CONSULTANT` 是显式配置后才可启用的 optional MVP strategy，只在 institution-specific assignment `missing` 时参与；不是长期 MUST，也不是 inactive/unknown/conflict 的隐式 fallback |
| B1-D6 | Consultant/assignment/phone/QR/service status 的 domain owner 是 Consultant Service；只有企业授权 Operations 可以发布或修改公开事实 |
| B1-D7 | 平台顾问 contact 与 Institution official contact 是不同 identity、source、projection、label 和 lifecycle；禁止双向 fallback |
| B1-D8 | 只有企业批准、真实且当前有效的 QR media 才能公开；placeholder、个人临时二维码和永久客户端缓存均禁止 |
| B1-D9 | public/application projection 由 Service/Provider 生成；Page 不读取 raw record、内部 media locator、audit 或 private data |
| B1-D10 | 查看顾问公开电话不等于授权读取用户本人手机号；手机号只在明确联系/预约目的的操作点请求 |
| B1-D11 | Consultant、assignment、contact、QR 与 service status 对 Recommendation V2 和 Institution verified facts 的作用均为 `NONE` |

这些决定关闭 B1 Contract Freeze 所需的核心产品空洞。未来多顾问同时展示、轮班选择、区域自动路由或顾问
self-service publishing 均未获产品批准；若要增加，必须版本化扩展，不能由实现猜测。

## 4. Domain Ownership and Relationship

稳定关系冻结为：

```text
InstitutionCanonicalIdentity (institutionId + recordRevision context)
  -> ConsultantAssignmentService.resolveForInstitution(...)
  -> independent ConsultantAssignment keyed by institutionId
  -> ConsultantProfile
  -> Consultant public/application projection
  -> Consultant/visit action slot
```

领域所有权：

```text
Consultant Service owns:
  ConsultantProfile
  ConsultantAssignment
  platform consultant phone
  enterprise WeChat media reference and public eligibility
  consultant service status

Institution Domain owns:
  Institution official contact
  Institution verified facts/evidence/revision

User/Appointment domain owns:
  User.phone consent and purpose-bound contact request
```

Consultant Service 可以读取用于解析的 canonical Institution identity，但不得写回 Institution record、Evidence、
Capability、CareProcess、officialContact、record status 或 record revision。

## 5. ConsultantProfile

### 5.1 Stable responsibility

`ConsultantProfile` 表达企业提供的养老顾问服务身份与当前公开联系配置。它不是机构员工名录、机构官方联系方式、
用户账号、预约记录或 Recommendation candidate。

稳定语义字段：

```ts
type ConsultantServiceStatusV1 = 'active' | 'inactive' | 'unknown'

interface ConsultantServiceAreaV1 {
  /** 企业批准的公开服务区域名称；V1.2 当前产品范围为武汉 */
  displayName: string
}

interface ConsultantProfileV1 {
  contractVersion: 'consultant-permission-contract-v1'
  consultantId: string
  displayName: string
  serviceStatus: ConsultantServiceStatusV1
  serviceArea: ConsultantServiceAreaV1
  platformPhone: ConsultantPlatformPhoneConfigV1
  enterpriseWechatQr: ConsultantWechatQrConfigV1
}
```

具体 storage 可以使用等价 schema，但必须保留上述语义和状态，不得以手机号、微信 media ID、displayName 或
Institution ID 代替 `consultantId`。

### 5.2 Identity and display boundary

- `consultantId` 必须稳定、非手机号、非二维码 ID、非 Institution ID；
- `displayName` 是企业批准的公开展示身份，不自动证明职业资格或 Institution 雇佣关系；
- `serviceArea` 只表达公开服务范围，不进入 Institution region fact 或 Recommendation region fit；
- `active` 只表示顾问服务当前可以参与公开 resolution，仍需合法 assignment 和 contact channel；
- `inactive` 表示当前不允许公开联系，不能等同删除或不存在；
- `unknown` 表示运营状态尚不能确认，必须 fail closed，不得当成 active；
- profile 缺失是 `missing` resolution，不得改写成 `inactive`、`unavailable` 或 `unknown`。

### 5.3 Internal-only data

排班、私人手机号、身份证明材料、内部备注、审核人、actor、audit log、媒体管理地址、原始附件、credential、
Secret 与未批准联系方式均不得进入 public/application projection。

## 6. Institution → Consultant Assignment

### 6.1 Assignment semantics

```ts
type ConsultantAssignmentStatusV1 = 'active' | 'inactive'

interface InstitutionConsultantAssignmentV1 {
  assignmentId: string
  institutionId: string
  consultantId: string
  status: ConsultantAssignmentStatusV1
}
```

`assignmentId` 是 relation identity；`institutionId` 指向稳定 Institution entity。resolver 必须接收当前调用的
canonical `(institutionId, recordRevision)` context，以维持 Detail/source identity，但不得把 `recordRevision`
变成 assignment fact，也不得因 assignment 变化创建或覆盖 Institution revision。

一个 Consultant 可以被多个 assignment 引用。V1 public/application projector 对一个 Institution context 最多输出
一个已解析顾问；raw provider 若返回多个当前 active 候选或互相冲突的 current assignment，必须输出
`resolutionStatus='ambiguous'`、`consultant=null` 并 fail closed。它不能继续尝试 `DEFAULT_CONSULTANT`，客户端也不得
自行挑选。invalid input/provider failure 不伪装为合法 resolution snapshot；具体 error code 留给 successor Contract。

### 6.2 Resolution order

```text
valid canonical Institution context
  -> inspect institution-specific assignment state
  -> unique active assignment: resolve that Consultant
  -> no assignment record (`missing`) only: try explicitly configured DEFAULT_CONSULTANT
  -> inactive / unknown / ambiguous assignment: fail closed; do not try default
  -> otherwise no public Consultant resolution
```

`DEFAULT_CONSULTANT`：

- MAY 作为 MVP 配置，使多个/全部当前机构共享一个顾问；
- 只有 authoritative configuration 显式启用时才参与 resolution；
- 只在 institution-specific assignment 确认 `missing` 时参与；inactive、unknown、ambiguous 或 invalid 不得触发；
- 不得硬编码在 Institution record、Page、route 或 Mock；
- 必须与普通 ConsultantProfile 经过相同 service status、phone 与 QR eligibility Gate；
- 不是 official-contact fallback，也不意味着某位顾问永久负责所有机构；
- 未配置时不得伪造默认 assignment。

无 assignment、assignment inactive、assignment ambiguous、profile missing、service inactive 与状态 unknown 必须保留
不同 resolution code。Inactive assignment 是显式 tombstone：它阻断 default resolution；未来若要改变该策略，必须
发布新 Contract version，不能由 resolver 自行选择。

## 7. Contact Identity Separation

硬不变量：

```text
PLATFORM_CONSULTANT_CONTACT != INSTITUTION_OFFICIAL_CONTACT
```

| Dimension | Platform Consultant Contact | Institution Official Contact |
|---|---|---|
| owner | Consultant Service / authorized enterprise Operations | Institution Domain / verified official-contact process |
| subject | `consultantId` / assignment | `institutionId + recordRevision` official fact |
| phone meaning | 养老顾问/带看顾问电话 | 机构官方电话 |
| public projection | Consultant contact snapshot | Institution V1.2.1 official-contact snapshot |
| UI label | “养老顾问电话”或“带看顾问电话” | “机构官方电话” |
| lifecycle | Consultant service/contact configuration | Institution field verification/evidence/revision |
| Recommendation role | none | none |

禁止：

- official → consultant fallback；
- consultant → official fallback；
- 把顾问电话写入 `officialContact`、legacy Institution contact 或 Institution evidence；
- 把机构官方电话写入 ConsultantProfile/`DEFAULT_CONSULTANT`；
- 使用“联系电话”一个模糊区域合并两类 identity；
- 因机构官方号码 missing/unverified/expired 而显示顾问电话为机构官方号码；
- 因顾问 channel 不可用而把机构官方电话冒充平台顾问 fallback。

同一页面未来可以分别展示两类 contact，但必须来自各自 projection、分别命名、分别触发 action。

## 8. Platform Phone and Enterprise WeChat Media

### 8.1 Platform consultant phone

内部配置语义：

```ts
type ContactReviewStatusV1 = 'approved' | 'pending_review' | 'rejected' | 'unknown'

type ConsultantPlatformPhoneConfigV1 =
  | {
      sourceState: 'configured'
      value: string
      reviewStatus: ContactReviewStatusV1
    }
  | { sourceState: 'unavailable' }
  | { sourceState: 'unknown' }
```

只有 `sourceState='configured' + reviewStatus='approved' + serviceStatus='active'` 才可生成 public phone
`available`。`pending_review`、`rejected`、`unknown` 或非法号码均不得把完整号码带入客户端。

### 8.2 Enterprise WeChat QR/media

```ts
type WechatQrReviewStatusV1 = 'approved' | 'pending_review' | 'rejected' | 'unknown'
type WechatQrLifecycleStatusV1 = 'active' | 'inactive' | 'expired' | 'unknown'

type ConsultantWechatQrConfigV1 =
  | {
      sourceState: 'configured'
      wechatQrMediaId: string
      reviewStatus: WechatQrReviewStatusV1
      lifecycleStatus: WechatQrLifecycleStatusV1
    }
  | { sourceState: 'unavailable' }
  | { sourceState: 'unknown' }
```

`wechatQrMediaId` 是 Consultant/企业媒体服务的内部 authoritative reference，不是可直接公开的静态路径、
原始管理 URL 或永久 CDN URL。

Public eligibility 必须同时满足：

1. profile `serviceStatus='active'`；
2. assignment resolution 合法；
3. source configured；
4. enterprise review `approved`；
5. lifecycle `active`；
6. Provider 在显式 `snapshotAsOf` 确认媒体仍有效；
7. public media resolver 返回合法、客户端可读的 public-safe image projection。

任一条件不满足都不得输出 QR image。`pending_review`、`rejected`、`inactive`、`expired`、`unknown`、missing
media、解析失败或过期 public URL 均不得继续显示旧二维码。

内部 review 到 public projection 的映射冻结为：

| Internal review/lifecycle | Public QR status | Image | Fallback |
|---|---|---|---|
| `approved + active` 且其余 eligibility 全部满足 | `available` | 当前 public-safe image | phone 仍可并列显示 |
| `pending_review` | `unavailable` | none | 可使用合法 platform phone |
| `rejected` | `unavailable` | none | 可使用合法 platform phone |
| review `unknown` | `unknown` | none | 可使用合法 platform phone |
| `approved + inactive` | `inactive` | none | 可使用合法 platform phone |
| `approved + expired` | `expired` | none | 可使用合法 platform phone |
| lifecycle `unknown` | `unknown` | none | 可使用合法 platform phone |

`pending_review` 与 `rejected` 在 internal Operations/audit record 中保持不同语义；public projection 有意只暴露
“当前不可公开”而不泄露审核细节。该 public 映射不是把两种 internal state 改写为同一事实。

### 8.3 Rotation, revocation and cache

- 录入、替换、批准、轮换、失效和撤销只能由企业授权 Operations/媒体流程执行并留下审计；
- 轮换必须发布新的 current public projection，旧 reference 立即失去 current display eligibility；
- 删除 storage object 前后的历史/audit 保留方式由后续 Backend Contract 决定，但删除不得让旧 URL 继续成为 truth；
- 前端不得把 QR image、resolved URL 或可用状态缓存为永久事实；每个 snapshot 必须有明确 `snapshotAsOf`；
- 本 Contract 不冻结媒体厂商、上传 API、URL 签名方式、缓存 TTL 或 CDN。

### 8.4 Fallback

```text
QR available -> may display approved QR; may also display approved platform phone
QR unavailable/inactive/expired/unknown/missing or internal pending_review/rejected
  -> do not render QR container
  -> use approved available platform consultant phone if present
phone and QR both unavailable
  -> explicit consultant contact unavailable state
```

Fallback 只能使用同一 Consultant projection 中合法的平台顾问电话。不得生成 placeholder QR、二维码文本、
个人临时二维码、假 phone，或退回 Institution official phone 冒充顾问 channel。

## 9. State Model

不同轴不得压平：

| State | Domain | Frozen meaning | Public behavior |
|---|---|---|---|
| `active` | Consultant service / assignment / QR lifecycle | authoritative source 明确当前 active | 继续后续 eligibility Gate，不自动等于 contact available |
| `inactive` | Consultant service / assignment / QR lifecycle | authoritative source 明确停用 | 不公开该 channel/contact；保留 inactive 语义 |
| `unavailable` | phone/QR source or derived contact result | authoritative source 明确当前没有可用 channel | 不生成 value/media；可走合法 fallback |
| `expired` | QR lifecycle/public projection | 曾有 media，但当前有效期/生命周期已结束 | 不显示旧 media；可走合法 phone fallback |
| `unknown` | service/source/review/lifecycle resolution | 当前无法确认真实状态 | fail closed；不得当 active/unavailable/false |
| `missing` | profile/assignment/media resolution | 所需对象或 reference 不存在 | 明确 resolution gap；不得改写成 inactive/unknown |
| `ambiguous` | assignment resolution | 存在多个 current active 候选或冲突关系，无法唯一解析 | `consultant=null`；阻断 default；客户端不得选择 |

`unknown != inactive`、`unknown != unavailable`、`missing != unavailable`、`expired != inactive`。UI 可以把多个
非可用状态映射为克制的用户文案，但 application snapshot 必须保留稳定状态 code，不能丢失语义。

## 10. Public and Application Projection

Page/Component 只能消费 public-safe Application Snapshot，不得读取 raw ConsultantProfile、assignment collection、
后台 record 或内部 media reference。

### 10.1 Public channel shapes

```ts
type ConsultantPublicPhoneProjectionV1 =
  | {
      status: 'available'
      label: '养老顾问电话' | '带看顾问电话'
      displayValue: string
      dialValue: string
      actionAvailable: true
    }
  | {
      status: 'unavailable' | 'unknown' | 'missing'
      label: '养老顾问电话' | '带看顾问电话'
      displayValue?: never
      dialValue?: never
      actionAvailable: false
    }

type ConsultantPublicWechatQrProjectionV1 =
  | {
      status: 'available'
      label: '企业微信养老顾问'
      publicImageUrl: string
      actionAvailable: true
    }
  | {
      status: 'unavailable' | 'inactive' | 'expired' | 'unknown' | 'missing'
      label: '企业微信养老顾问'
      publicImageUrl?: never
      actionAvailable: false
    }
```

`dialValue` 是明确 public consultant service number，不是 User.phone。`publicImageUrl` 是媒体服务解析出的
public-safe current resource；不得用 `wechatQrMediaId`、storage key、管理 URL 或 credential 代替。

### 10.2 Consultant public profile

```ts
interface ConsultantPublicProfileV1 {
  consultantId: string
  displayName: string
  serviceStatus: ConsultantServiceStatusV1
  serviceAreaDisplayName: string
  phone: ConsultantPublicPhoneProjectionV1
  enterpriseWechatQr: ConsultantPublicWechatQrProjectionV1
}
```

### 10.3 Institution contact application snapshot

```ts
type ConsultantResolutionStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'
  | 'ambiguous'

interface InstitutionConsultantContactApplicationSnapshotV1 {
  kind: 'institution_consultant_contact_application_snapshot_v1'
  contractVersion: 'consultant-permission-contract-v1'
  institutionIdentity: {
    institutionId: string
    recordRevision: number
  }
  snapshotAsOf: string
  dataProvenance: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  assignmentSource: 'institution_assignment' | 'default_consultant' | null
  resolutionStatus: ConsultantResolutionStatusV1
  consultant: ConsultantPublicProfileV1 | null
}
```

Projection rules：

- 先完成 assignment resolution：unique active assignment → 使用该 assignment；assignment `missing` → 仅此时尝试
  eligible configured default；无 assignment 且无 eligible default → `missing`；assignment inactive → `inactive`；
  assignment unknown → `unknown`；assignment ambiguous → `ambiguous`；
- assignment 成功解析后再执行 profile gate：profile missing → `missing`；profile inactive → `inactive`；profile unknown →
  `unknown`；这些非成功状态均不读取缓存 contact；
- 只有 assignment/profile gate 通过后才计算 channels：任一合法 channel available → `available`；无 available 但任一
  channel unknown → `unknown`；QR expired 且 phone unavailable/missing → `expired`；两个 channel 都 missing →
  `missing`；其余已知非可用组合 → `unavailable`；
- `available` 仅在 Consultant active 且至少一个合法 contact channel available 时成立；
- inactive service/assignment 必须返回 `inactive`，不得返回 available；
- ambiguous assignment 必须返回 `resolutionStatus='ambiguous'`、`consultant=null` 并阻断 default；invalid snapshot
  或 provider error 不生成合法 snapshot；客户端不得随机选 Consultant；
- development Mock 必须携带 `MOCK_DEVELOPMENT_ONLY` 并可见披露；不得包含真实个人 phone 或 fake QR；
- route/query 不携带 phone、QR URL、displayName、assignment object 或 User.phone；
- Page 不从 Institution name、region、Recommendation、旧 DTO 或 route 参数推断 Consultant。

### 10.4 Forbidden public/application fields

Public/application projection 永远不得包含：

- raw backend Consultant/assignment record；
- internal `wechatQrMediaId`、storage key、管理 URL、下载凭证或审核附件；
- private phone、身份证明、排班、internal service notes；
- reviewer/actor identity、audit log、source locator、内部 timestamps 或 retention metadata；
- User.phone、user consent record、Appointment private fields；
- raw Assessment、完整 ElderProfile/Recommendation/Institution record；
- Institution evidence locator、合同附件、核验人或其他 Secret/config/credential。

## 11. Availability and User-facing Behavior

| Condition | Stable application result | Required behavior |
|---|---|---|
| active Consultant + valid assignment + phone and/or QR available | `available` | 清楚标注平台顾问 identity；只开放合法 action |
| no institution assignment + eligible explicit default + available channel | `available` with `assignmentSource='default_consultant'` | 与普通 assignment 相同 Gate，不暗示永久负责 |
| no assignment and no explicit default | `missing` | 顾问入口 unavailable/empty；不造 default |
| assignment inactive（无论 default 是否配置）或 Consultant inactive | `inactive` | 不公开 contact；阻断 default；不得继续使用缓存值 |
| multiple active/conflicting assignment | `ambiguous` | `consultant=null`；阻断 default；客户端显示安全不可用态 |
| Consultant/service/source cannot be confirmed | `unknown` | fail closed；显示“当前无法确认/暂不可用”等克制文案 |
| QR expired but phone available | overall `available`, QR `expired` | 隐藏 QR，仅显示合法顾问电话 |
| all contact channels unavailable | `unavailable` | 明确当前无法联系；不借用机构官方电话 |

顾问可以帮助确认床位/费用不代表 `ConsultantProfile` 自身是床位、价格或入住事实。任何实时结论仍需其所属
正式数据源，Contact CTA 不得宣称已确认、有床、可立即入住或预约成功。

## 12. Permission Matrix

Product permission 表达业务允许性；Frontend gate 只改善 UX，不能替代 Backend authorization。

| Action | Anonymous visitor | Authenticated ordinary user | Consultant | Operations |
|---|---|---|---|---|
| 查看 approved Consultant public projection | allowed | allowed | allowed | allowed |
| 查看 public consultant phone / approved QR | allowed；不登录、不取 User.phone | allowed；不额外取 User.phone | allowed | allowed |
| 打开公开顾问联系入口 | allowed | allowed | n/a | n/a |
| 请求顾问联系本人 | 可在明确 action 点进入 consent/login flow；未同意不得提交 | allowed with purpose-bound consent | 只处理被授权 request | 可按最小业务权限处理 |
| 创建正式 Appointment | action point 可要求登录和必要 User.phone | allowed when successor Contract permits | 可协助，不冒充用户 | 可代录但必须保留 actor |
| 读取 User.phone | forbidden without explicit contact/appointment purpose | 仅本人已 consent 的业务流 | 仅 assignment/业务处理所需且授权 | 最小权限、受审计 |
| 新建/修改 ConsultantProfile | forbidden | forbidden | forbidden；未来 self-service 必须另行版本化批准 | allowed with role, review and audit |
| 修改 assignment/service status/phone/QR | forbidden | forbidden | forbidden unless future version grants reviewed capability | allowed with role, review and audit |
| 修改 Institution verified facts | forbidden | forbidden | forbidden | 仅走 Institution Contract 的独立审核流程 |
| 改变 Recommendation | forbidden | forbidden | forbidden | forbidden under Recommendation V2 |

Anonymous 浏览首页、Institution、Assessment、合法 Consultant contact 与 AI 初询不要求预先登录。保存历史、
正式 Appointment/Visit/Evaluation 等持久化行为由对应 successor Contract 在明确操作点设置登录 Gate。

## 13. User Phone and Privacy Boundary

硬区分：

```text
READ_PUBLIC_CONSULTANT_PHONE
  !=
REQUEST_USER_OWN_PHONE_AUTHORIZATION
```

### 13.1 Purpose limitation and consent

- User.phone 只可在用户明确发起预约或明确要求顾问联系本人的操作点请求；
- 不得在进入小程序、Home、Institution Detail、Consultant public page、Profile、Recommendation Result 或打开
  AI 初询时强制请求；
- consent 必须对应明确 purpose、当前 action 和可理解说明；拒绝不得阻止纯公开浏览；
- phone 不得复用于未告知的营销、Recommendation、机构核验或 AI training；
- Consultant public phone 是企业公开服务号码，不是对 User.phone 授权的替代或证明。

### 13.2 Data minimization and display

- 客户端、API 与业务角色只读取当前 purpose 必需的最小字段；
- 非本人/非授权业务界面不得显示完整 User.phone；需要展示时默认脱敏；
- 不把 User.phone 放入 route/query、analytics event、console、error、screenshot fixture 或 public snapshot；
- 不向 Consultant/Operations 传递完整 Assessment、健康答案、ElderProfile 或 Recommendation，只因联系请求并不
  产生读取这些数据的权限；
- Secret、AppSecret、API key、DB credential 永远不得进入小程序、Mock、日志或 Git。

### 13.3 Audit, retention and deletion principles

- production sensitive read/write 必须由 Backend 独立校验 identity、role、object ownership、assignment、purpose 与
  state；Frontend gate 不能作为授权证据；
- 对 phone access、profile/assignment/contact/media mutation 记录 actor、action、target stable identity、purpose、
  time 与 result；audit event 不复制完整 phone、QR bytes、健康数据或 private notes；
- User.phone 只保留履行明确 purpose、合规义务和争议处理所需的最短期限；目的终止、用户合法撤回/删除请求或
  retention policy 到期时按后续 Backend Contract 删除或不可逆去标识；
- 具体 encryption algorithm、key management、retention TTL、backup deletion、export workflow 和 audit storage
  由后续 Backend/Privacy implementation Contract 冻结，不能由客户端决定；
- 在上述实现级 policy 尚未批准前，不得上线 production User.phone persistence。

## 14. Recommendation V2 Isolation

```text
CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE
CONSULTANT_RECOMMENDATION_INPUT = FORBIDDEN
CONSULTANT_RECOMMENDATION_OUTPUT_SEMANTICS = UNCHANGED
```

`ConsultantProfile`、assignment、phone、QR、service area、service status、contact availability 与 contact interaction：

- 不进入 Recommendation V2 input、Institution matching projection 或 manifest；
- 不改变 Safety Core、Eligibility 或 `EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE`；
- 不进入 PriorityFitVector、Rank Tuple、tie-break、candidate inclusion/exclusion 或 cards order；
- 不改变 `NO_EXACT_MATCH`、MAX_3、reason、difference 或 gap；
- 不生成 `consultantScore`、顾问覆盖分、availability score、AI/manual rerank 或 override；
- 可以存在于独立 display-only Consultant sidecar，但不得合并进 Recommendation semantic result。

同一 Profile、Institution catalog、datasetVersion 与 `evaluationAsOf` 下，添加/修改/删除 Consultant display sidecar
前后，Recommendation V2 全部 semantic fields 必须 deep-equal。Recommendation 的 Institution input 继续只走
frozen V1.2.1 → V1.1 explicit allowlist projection；禁止 object spread、duck typing 或 broad union 把 Consultant
字段送入 Recommendation。

未来若产品要求顾问覆盖范围、服务状态或联系可用性影响推荐，必须发布新的 Recommendation Contract/Ruleset
version 并重新走产品审批、determinism、fixtures 和 QA；不得修改本文或由 Consultant implementation 偷渡。

## 15. Institution Isolation

```text
CONSULTANT_DATA_INSTITUTION_VERIFIED_FACT_ROLE = NONE
```

Consultant data 不属于且不得写入：

- Institution official phone/address/Geo/public introduction；
- Institution Capability、CareProcess、qualification、price、bed availability；
- Verification、Evidence、field availability、record status 或 provenance；
- Institution `recordRevision` 或 Recommendation projection。

assignment/profile/contact/media/service status 变化只改变 Consultant Service 自身状态和 projection，不创建、覆盖或
解释 Institution revision。顾问或用户提供的机构信息最多可以在未来形成独立待核验线索；未经 Institution 正式
人工核验、evidence closure 与新 revision，不能成为 verified fact。本 B1 不启用该线索流程。

## 16. Ownership and Mutation Authority

| Object/fact | Domain owner | Publish/mutation authority | Public consumer |
|---|---|---|---|
| ConsultantProfile identity/display/service area | Consultant Service | authorized Operations；需审查与 audit | Consultant public projector |
| Consultant service status | Consultant Service | authorized Operations | resolver/projector |
| InstitutionConsultantAssignment | Consultant Assignment Service | authorized Operations | resolver only；Page 不读 raw relation |
| platform consultant phone | Consultant Service Configuration | authorized Operations after review | public phone projector |
| enterprise WeChat QR/media | enterprise media service under Consultant domain | authorized Operations/media reviewer | public media resolver/projector |
| Institution official contact | Institution Domain | Institution verification/revision workflow | Institution official-contact projector |
| User.phone and consent | User/contact-request domain | user consent + authorized Backend processing | purpose-bound workflow only |

普通用户不能修改任何平台核验 Consultant fact。Consultant 默认不能自行发布/替换其 phone、QR、assignment 或
service status；未来 self-service 若获批，必须新增明确 role、review 与 audit，不得让客户端直接写 authoritative fact。

## 17. Downstream Implementation Contract

后续实现可以稳定依赖：

1. `consultantId` stable identity；
2. independent assignment relation 与 optional configured default strategy；
3. Consultant service/phone/QR 多轴状态；
4. public-safe profile/channel/application snapshot；
5. contact identity separation 与 fallback；
6. permission matrix、User.phone purpose boundary 与 audit/retention principles；
7. Recommendation/Institution isolation；
8. production source、review、Backend authorization 与 no-fake-data Gate。

后续实现仍需另行决定/冻结：

- phase ID、implementation slice 与 acceptance Gates；
- exact TypeScript validator/service errors and provider protocol；
- REST/RPC endpoint、idempotency、API versioning；
- DB schema、ORM、migration 与 history storage；
- 微信登录/手机号交换技术方案；
- encryption/key management、retention TTL、backup/deletion workflow；
- QR upload/review/CDN/URL mechanism；
- production Consultant/assignment/media onboarding；
- Operations admin UI 与 granular role implementation。

这些 implementation choices 不得改变 B1 frozen semantics。无 secure Backend/authoritative provider 时，前端只可
实现明确 unavailable/empty/error 或符合 `MOCK_DATA_POLICY.md` 的开发态；不得放入真实个人电话或 fake QR。

## 18. B1 Contract Gates

| Gate | Frozen evidence | Result |
|---|---|---|
| Phase handoff | `V1_2_B1_PHASE_HANDOFF.md` | `PASS` |
| Consultant completeness | §§4–11 | `PASS` |
| Contact identity separation | §7 + Institution V1.2.1 §8 | `PASS` |
| Permission/privacy | §§12–13 | `PASS` |
| State model | §§5、8、9 | `PASS` |
| Public projection | §10 | `PASS` |
| Recommendation isolation | §14 + frozen Recommendation V2 references | `PASS` |
| Institution isolation | §15 + Institution V1.2.1 | `PASS` |
| Cross-document consistency | Product V1.2、Institution V1.2.1、Recommendation V2 定向审查 | `PASS` |
| Contract QA | independent diff-driven QA | `PASS` |
| Production isolation | only architecture/handoff/index docs changed | `PASS` |

## 19. Specialist and QA Review Record

```text
BACKEND_DOMAIN_REVIEW = PASS
WECHAT_FRONTEND_REVIEW = PASS
MATCHING_ENGINE_REVIEW = PASS
CONTRACT_QA = PASS_AFTER_FINDINGS_CLOSED
```

专项审查确认：

- Consultant、assignment、phone、QR、permission/privacy 的 domain/public/backend 边界足以供 successor 实现；
- Page 只消费 public-safe application snapshot，不读取 raw record、internal media、audit 或 User.phone；
- Consultant sidecar 对 Recommendation V2 semantic result 的作用为零；
- assignment/default resolution、ambiguous state、QR pending/rejected public mapping 与 overall status derivation 已闭合；
- 未发现 Product Source、Institution V1.2.1、List/Detail integration 或 Recommendation V2 的 active conflict；
- 本阶段 production/runtime/mock data change 均为 0。

## 20. Freeze Status and Change Policy

```text
PHASE_V1_2_B1 = PASS
CONSULTANT_PERMISSION_CONTRACT = FROZEN
CONTACT_IDENTITY_SEPARATION = PASS
PERMISSION_PRIVACY_BOUNDARY = PASS
STATE_MODEL = PASS
PUBLIC_PROJECTION = PASS
RECOMMENDATION_ISOLATION = PASS
INSTITUTION_ISOLATION = PASS
CROSS_DOCUMENT_CONSISTENCY = PASS
CONTRACT_QA = PASS
PRODUCTION_CODE_CHANGE = 0
BLOCKERS = 0
READY_FOR_B1_IMPLEMENTATION_SUCCESSOR = TRUE
```

本 Freeze 只授权未来单独批准的 implementation phase 依赖这些语义；它不授权当前任务创建生产代码、Backend、
真实联系方式、媒体或个人数据。后续重大改变必须发布 `consultant-permission-contract-v2` 或明确 additive
successor，并执行相应 Change Impact、产品批准与 QA；禁止由代码、配置、Mock 或 UI 文案静默改义。
