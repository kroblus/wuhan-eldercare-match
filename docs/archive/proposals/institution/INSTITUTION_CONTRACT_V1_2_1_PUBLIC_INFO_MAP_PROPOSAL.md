# Institution Contract V1.2.1 — Public Info & Map Successor Proposal

状态：`APPROVED_PHASE_V1_2_A1_1B / SUPERSEDED_BY_FROZEN_CONTRACT`

提议版本：`institution-contract-v1.2.1`

```text
ARCHITECTURE_PROPOSAL_ONLY = TRUE
PRODUCTION_CODE_CHANGE = 0
PROJECT_OWNER_DECISIONS = APPROVED
CURRENT_PRODUCT_SOURCE_VERSION = V1.2
INSTITUTION_CONTRACT_V1_2 = FROZEN_PHASE_V1_2_A1 / UNCHANGED
INSTITUTION_CONTRACT_SUCCESSOR = institution-contract-v1.2.1 / APPROVED
FROZEN_CONTRACT = INSTITUTION_CONTRACT_V1_2_1.md
SUCCESSOR_KIND = ADDITIVE_PATCH_SUCCESSOR
CANONICAL_INSTITUTION_IDENTITY = institutionId + recordRevision / UNCHANGED
LATEST_INSTITUTION_IMPLEMENTATION_TARGET = institution-contract-v1.2.1 / APPROVED
OFFICIAL_PHONE_RECOMMENDATION_ROLE = NONE
ADDRESS_RECOMMENDATION_ROLE = NONE_V1_2
GEO_RECOMMENDATION_ROLE = NONE_V1_2
PUBLIC_INTRODUCTION_RECOMMENDATION_ROLE = NONE
MAP_READY_COORDINATE_SYSTEM = gcj02 / APPROVED
MAP_ROLE = INSTITUTION_LOCATION_DISPLAY_ONLY_V1_2
DETAIL_RUNTIME_GEOCODING = FORBIDDEN_V1_2
PUBLIC_INTRODUCTION_DOMAIN_PLACEMENT = SEPARATE_PRESENTATION_CONTENT / APPROVED
PUBLIC_INTRODUCTION_CAPABILITY_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_CARE_PROCESS_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_RECOMMENDATION_INPUT = FORBIDDEN
```

本文件记录 `institution-contract-v1.2.1` 的 successor 方案及项目负责人最终审批。正式冻结语义见
`INSTITUTION_CONTRACT_V1_2_1.md`；本文件不再作为实现时的最高 Contract，不授权 TypeScript、validator、
projection、provider、Mock、Page、WXML、Less、`wx.openLocation`、`wx.makePhoneCall`、Backend 或真实机构数据
实现。已经冻结并提交的 `INSTITUTION_CONTRACT_V1_2.md` 保持不可变。

## 1. Source of Truth and Evidence Boundary

按优先级，本 Proposal 服从：

1. 项目负责人对 Phase V1.2-A1-1B 的新增需求与边界；
2. `docs/product/README.md`；
3. `docs/product/武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`；
4. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`；
5. frozen `INSTITUTION_CONTRACT_V1_2.md`；
6. accepted `INSTITUTION_CONTRACT_V1_2_CARE_PROCESS_PROPOSAL.md` 与
   `V1_2_CHANGE_IMPACT_ANALYSIS.md`；
7. frozen `INSTITUTION_CONTRACT_V1_1.md`、`INSTITUTION_CAPABILITY_CONTRACT.md`、
   `RECOMMENDATION_CONTRACT_V2.md` 与 `RECOMMENDATION_RULE_CONTRACT_V2.md`；
8. frozen `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` 与 A0 canonical List/Detail
   infrastructure；
9. `WECHAT_INTERACTION_CONTRACT.md`、`MOCK_DATA_POLICY.md`、`FRONTEND_STRUCTURE.md` 与根目录
   `AGENTS.md`；
10. 当前项目微信官方 typings 与微信官方自动生成 API typings。

两份 V1.2 PDF 已明确：

- 当前平台电话应命名为“养老顾问电话/带看顾问电话”；
- 不得把平台顾问电话命名为机构官方联系电话；
- 若未来录入机构官方电话，必须与平台顾问电话使用独立字段和独立展示区域；
- Recommendation V2 不因 V1.2 新增展示资料改变。

结构化地址、带坐标系的 Geo、地图 action gate、公开简介及其 revision 策略，是本轮 Product Owner
新增增量。旧 PDF 没有完整冻结这些字段，本 Proposal 不把它们追溯性写回旧产品源。

## 2. Successor Version Strategy

提议正式关系：

```text
institution-contract-v1.1
  -> institution-contract-v1.2
  -> institution-contract-v1.2.1
```

`institution-contract-v1.2.1` 是 Institution Domain Contract 的 additive patch successor，不是 Product
V1.3，也不是 Institution V2。它继承 V1.2 全部字段与语义，并只增加：

```text
required officialContact subrecord
required publicLocation subrecord
V1.2.1 evidence value snapshot variants
```

“required”只表示 exact record shape 必须包含 subrecord；未知资料仍用 frozen availability axis 表达，不能因
required 而补造号码、地址或坐标。

本 Proposal 已获批；A1-2 应直接实现 `institution-contract-v1.2.1`。禁止先实现 V1.2 production runtime，
再进行一次 V1.2→V1.2.1 业务迁移。V1.2 Contract 仍必须保留 validator/projection 兼容目标，因为它已经是
合法、冻结的历史 schema。

## 3. Canonical Identity and Ownership

唯一 Institution canonical identity 继续是：

```text
institutionId + recordRevision
```

不得新增 `locationId`、`contactId`、`introId` 或 child revision 作为第二种 Institution identity。
`officialPhoneKey` 仅用于同一父 revision 内定位电话 child；`contentRevision` 仅版本化公开展示文案。二者均不能
替代 Institution canonical identity、route identity 或 Recommendation source identity。

概念 record shape：

```ts
type InstitutionContractVersionV121 = 'institution-contract-v1.2.1'

interface InstitutionRecordV121
  extends Omit<InstitutionRecordV12, 'contractVersion' | 'evidence'> {
  contractVersion: InstitutionContractVersionV121
  officialContact: InstitutionOfficialContactV1
  publicLocation: InstitutionPublicLocationV1
  evidence: readonly InstitutionEvidenceV121[]
}
```

`careProcess` 完整继承 frozen V1.2；Capability V1、V1.1 facts、operations、media、VR、qualifications 和所有
既有字段不删除、不重命名、不重解释。

## 4. Existing Legacy Basic Fields

Frozen V1/V1.1 已存在：

```text
identity.address: InstitutionField<string>
identity.coordinates: InstitutionField<GeoCoordinates>
identity.publicContact: InstitutionField<string>
```

它们不能被假装成“本轮才新增”，也不能原地改类型。V1.2.1 采用以下兼容策略：

1. 三个 inherited fields 原值、availability、verification、evidence 与语义保持不变；
2. `identity.address` 是 legacy display string，不自动升级为 structured address；
3. `identity.coordinates` 没有 coordinate-system discriminator，不自动升级为 map-ready Geo；
4. `identity.publicContact` 是 legacy broad public-contact string，不自动升级为机构官方电话；
5. V1.2.1 新 Page/projector 不得从 legacy `publicContact` 生成可拨号 action；
6. V1.1/V1.2→V1.2.1 migration 默认将新增 subrecords 置为显式 unknown，除非经过独立资料录入、校验与核验；
7. 禁止从 legacy 地址运行时 geocode，禁止猜测坐标系，禁止把顾问号码复制到 official phone；
8. 不以模糊字符串比较或经纬度数值相等，宣称 legacy 与新字段等价；具体 bridge 规则见 §4.1；
9. 新 consumer 以 V1.2.1 `officialContact` / `publicLocation` 为 action 权威来源；legacy fields 仅作为显式
   compatibility projection 的 inherited facts。

### 4.1 Deterministic Legacy Bridge

Legacy bridge 只允许以下确定性结论：

- `identity.address` 与由 `publicLocation.address.value` canonical components 确定性生成的 display address 只有在
  两者均 provided，且各自经过 NFC、CRLF/CR→LF、outer trim 后 code-point exact equal 时，migration 才可以
  记录“文本等价”；不做简称、标点、行政层级或模糊语义匹配；
- 两个地址文本不 exact equal 不会由 validator 自动判定哪个正确，也不会自动修正；migration 保持新增 structured
  address 为 unknown，交由运营重新核验；只有明确 evidence 证明同一 revision 内事实冲突时，整条 candidate 才
  fail closed；
- `identity.coordinates` 因缺少 coordinate-system discriminator，数值即使与新 Geo 相等也不能证明坐标体系
  相等；不得仅凭相同 latitude/longitude 将它升级为 GCJ-02；
- 只有 ingestion/ops 持有明确的源坐标系材料，完成受控转换或证明原值已是 GCJ-02，并为新
  `publicLocation.geo` 建立独立 evidence closure 后，才能写入新 Geo；该 migration assertion 不写入 Page，
  也不改变 legacy field；
- 新 Geo 与 legacy coordinates 并存不形成 implicit equivalence。若明确 evidence 证明二者对同一 revision
  描述了冲突位置，则 candidate fail closed，不能选一个“看起来更合理”的值；
- `identity.publicContact` 永不作为 official phone migration source。V1.2.1 current Detail 不在“机构官方
  联系方式”或顾问区显示它，也不提供拨号；它只随 explicit older-version projection 保留。历史 V1/V1.1/V1.2
  consumer 仍按各自 frozen Contract 处理。

## 5. Official Contact Model

### 5.1 Proposed Shape

```ts
type InstitutionOfficialPhonePurposeCode =
  | 'main'
  | 'admission_consultation'
  | 'service'
  | 'other'

type InstitutionOfficialPhoneNumberV1 =
  | {
      kind: 'mainland_mobile'
      countryCallingCode: '+86'
      nationalNumber: string
      extension: null
    }
  | {
      kind: 'mainland_landline'
      countryCallingCode: '+86'
      areaCode: string
      subscriberNumber: string
      extension: string | null
    }

interface InstitutionOfficialPhoneValueV1 {
  purpose: InstitutionOfficialPhonePurposeCode
  otherPurposeNote: string | null
  number: InstitutionOfficialPhoneNumberV1
}

interface InstitutionOfficialPhoneV1 {
  officialPhoneKey: string
  phone: InstitutionField<InstitutionOfficialPhoneValueV1>
}

type InstitutionOfficialPhoneDirectoryPresenceCode = 'present' | 'absent'

interface InstitutionOfficialContactV1 {
  schemaVersion: 'institution-official-contact-v1'
  phoneDirectoryPresence: InstitutionField<InstitutionOfficialPhoneDirectoryPresenceCode>
  officialPhones: readonly InstitutionOfficialPhoneV1[]
}
```

采用多个号码，而不是单一 `phone`。稳定 purpose inventory 建议首版直接冻结四项，因为“总机/入住咨询/服务台/
其他”已经由 Product Owner 明确提出，且四项仍是克制 inventory。中文 label 由 ViewModel 映射，不能用任意运营
字符串替代 stable code。

Purpose=`other` 时 `otherPurposeNote` 必须是 normalization 后 1–80 Unicode code points 的单行纯文本；其他
purpose 时必须为 null。该说明不替代 stable purpose，也不参与 Recommendation。

`officialPhoneKey` 必须是同一父 revision 内唯一、非空的稳定 child key。它只定位 entry，不是全局 contactId，
不能单独路由，也没有独立 revision。建议复用现有 stable identifier 规则：

```text
/^[a-z0-9][a-z0-9_-]{2,63}$/
```

### 5.2 Directory and Child Invariants

| directory fact | `officialPhones` | required meaning |
|---|---:|---|
| provided + present | non-empty | 至少记录一个 official phone fact |
| provided + absent | empty | 已形成“无公开官方号码”事实；verification 仍决定可信度 |
| unknown + null | empty | 尚未获得明确目录资料 |
| unavailable + null | empty | 已明确资料不可公开/不适用 |

`provided + present` 下每个 child `phone` 必须是 `availability=provided` 且 value 非空；未知号码不创建空 child。
号码未知由 directory outer `unknown` 表达。号码失效但仍需历史展示时保留 provided value，并通过 verification
表达 `expired`，不得改成空字符串。

所有 phone values、purpose、顺序及 verification/evidence 都属于父 `recordRevision`。数组采用 purpose priority
+ canonical phone comparator + `officialPhoneKey` final tie-break 的 deterministic canonical ordering；purpose
固定顺序：

```text
main -> admission_consultation -> service -> other
```

同 purpose 多个号码时，先按 `kind + canonical base digits + extension-or-empty` 的 code-point key 排列，再以
`officialPhoneKey` code-point order 作最终 tie-break。重复 key、重复完整 canonical phone value或非 canonical
顺序均拒绝，不能静默去重/排序；不增加运营 `displayOrder`。

### 5.3 Phone Syntax

Canonical value 只支持当前明确需要的两种中国大陆公开号码：

- `mainland_mobile`：`nationalNumber` 必须为 11 位 ASCII digits，首位序列满足 `1[3-9]`；不允许 extension；
- `mainland_landline`：`areaCode` 为以 `0` 开头的 3–4 位 ASCII digits，`subscriberNumber` 为 7–8 位 ASCII
  digits，`extension` 为 null 或 1–6 位 ASCII digits；
- `countryCallingCode` 首版固定为 `+86`；
- canonical fields 不保存空格、括号、连字符、`ext.`、中文说明或 URI；格式化只发生在 display projector；
- 400/800、境外号码、短号码与 SIP/URL 首版不猜测；出现真实业务需求时发布 phone-value successor。

必须拒绝：空字符串、“暂无”、“咨询顾问”、URL、二维码内容、包含说明文字的字符串、NaN/数字类型、多个号码
拼在一个 value、超长 extension。手机格式规则不能用于拒绝合法固定电话。

分机号只作为展示信息；未来 `wx.makePhoneCall` 首版拨打 base landline，不自动拼接按键序列。是否由终端支持自动
分机不作为 Domain 假设。

### 5.4 Availability, Verification and Evidence

官方电话继续复用 frozen：

```text
InstitutionField<T>
InstitutionFieldVerification
InstitutionEvidence[]
provided / unknown / unavailable
unverified / verified / expired
current_verified / unverified / expired (explicit evaluationAsOf)
```

不创建第二套 OfficialPhone verification enum。Directory presence 和每个 provided phone entry 均分别绑定
evidence。`verified/expired` 必须有完整 evidence closure；`unverified` 可以有空 evidenceIds，但已有 ID 时必须
闭合。公开投影不得泄漏 evidence locator、内部核验人员、附件 ID 或精确时间。

V1.2.1 evidence snapshot 建议只增量增加 discriminator：

```ts
type InstitutionEvidenceValueSnapshotV121 =
  | InstitutionEvidenceValueSnapshot
  | { valueType: 'official_phone'; value: InstitutionOfficialPhoneValueV1 }
  | { valueType: 'structured_address'; value: InstitutionAddressV1 }
  | { valueType: 'geo_location'; value: InstitutionGeoLocationV1 }
```

这是 frozen evidence closure 的 additive value vocabulary，不是新的 evidence system。Directory presence 继续使用
既有 `stable_code` snapshot。Exact conceptual evidence shape 为：

```ts
interface InstitutionEvidenceBaseV121
  extends Omit<InstitutionEvidenceBase, 'valueSnapshot'> {
  valueSnapshot: InstitutionEvidenceValueSnapshotV121
}

type InstitutionEvidenceV121 =
  InstitutionEvidenceBaseV121
  & InstitutionEvidenceSourceLocator
  & (
    | { verificationStatus: 'unverified'; verifiedAt?: never; validUntil?: never }
    | { verificationStatus: 'verified'; verifiedAt: string; validUntil?: string }
    | { verificationStatus: 'expired'; verifiedAt: string; validUntil: string }
  )
```

除 `valueSnapshot` 增量 union 外，字段、source locator、status/time、closure 与 exact-key 语义均继承 V1，不能
新增宽松 metadata bag。

Canonical new field paths：

```text
officialContact.phoneDirectoryPresence
officialContact.officialPhones.<officialPhoneKey>.phone
publicLocation.address
publicLocation.geo
```

`<officialPhoneKey>` 是已经通过 stable identifier validator 的 path segment，不是数组 index。该 keyed path
规则只用于 V1.2.1 新 phone collection，不追溯性改变 frozen 既有 array field paths。V121 evidence validator
必须把 key 精确解析到 canonical array 中唯一 child；不得按当前 index 或 display order 定位。

### 5.5 Public Display and Call Action Policy

建议采用“显示值但限制 action”的透明策略：

| phone state | public number | status label | one-tap call |
|---|---|---|---|
| provided + valid + current_verified | show | 机构官方电话 / 已核验日期（date-only） | enabled |
| provided + valid + unverified + allowed source closure | show | 机构提供，平台待核验 | disabled |
| provided + valid + unverified without allowed source closure | hide | 官方电话待确认 | disabled |
| provided + valid + expired | hide full number | 机构电话资料已过核验期，请联系养老顾问确认 | disabled |
| unknown | no number | 官方电话待确认 | disabled |
| unavailable | no number | 暂无可公开官方电话 | disabled |
| invalid record | no snapshot | stable projection error | disabled |

`CALL_ACTION_AVAILABLE = TRUE` 只在 directory presence 与目标 phone 均能投影为 current-verified、号码 syntax
有效、record 可公开展示时成立。Page 不得只检查字符串非空。

未来拨号 projector 必须从已经校验的结构化号码确定性地产生 `dialValue`：手机使用 `nationalNumber`；固定电话使用
`areaCode + subscriberNumber`；首版不把 `countryCallingCode`、空格、连字符、说明文字或 `extension` 拼入
`wx.makePhoneCall.phoneNumber`。`dialValue` 不是新的 Domain fact，不持久化，也不得反向覆盖 canonical phone。
若后续需要境外号码或自动分机，必须发布 phone-value successor 并重新核对官方 API/真机行为。

公开 date-only verification 延续 frozen V1.2 D1：从已经校验的 `verifiedAt` 自身携带的 offset/时区字符串直接
取 `YYYY-MM-DD` calendar-date segment；不得按设备 locale/timezone 二次换日，不公开小时、分钟或秒。

未来调用 `wx.makePhoneCall` 必须由一次显式用户 action 发起，携带 `fail` callback，失败后给可见反馈并释放
action guard；不得页面加载时自动拨号，不要求微信登录，也不获取用户手机号授权。

## 6. Official Institution vs Platform Consultant Boundary

冻结关系保持为两条独立链：

```text
InstitutionRecordV121
  -> officialContact
  -> institution official phone facts

Institution canonical identity
  -> ConsultantAssignment
  -> ConsultantProfile
  -> platform eldercare / visit consultant phone
```

未来 Detail 必须分区并使用明确标题：

```text
机构官方联系方式
养老顾问 / 带看顾问
```

禁止：

- 把 `ConsultantProfile.phone`、`DEFAULT_CONSULTANT.phone` 或朋友号码写入 `officialPhones`；
- 把 institution official phone 作为平台顾问 assignment fallback；
- 用统一“联系电话”数组混合两类号码；
- 从 inherited `identity.publicContact` 猜号码归属；
- 因任一号码存在而推导另一业务对象存在。

两个公开 action 都可以不登录，但文案、来源、availability、verification、故障处理与运营 ownership 必须分开。

## 7. Structured Address Model

### 7.1 Proposed Shape

```ts
interface InstitutionAdministrativeAreaV1 {
  code: string
  displayName: string
}

interface InstitutionAddressV1 {
  countryCode: 'CN'
  province: InstitutionAdministrativeAreaV1
  city: InstitutionAdministrativeAreaV1
  district: InstitutionAdministrativeAreaV1
  addressLine: string
  postalCode: string | null
}

interface InstitutionPublicLocationV1 {
  schemaVersion: 'institution-public-location-v1'
  address: InstitutionField<InstitutionAddressV1>
  geo: InstitutionField<InstitutionGeoLocationV1>
}
```

`address` 是整体 Institution fact，拥有独立 availability、verification 和 evidence。其 value 的 canonical source
只有结构化 components，不再保存第二份独立 `formattedAddress` fact。Application/projector 按冻结格式确定性
生成 display-only `formattedAddress`；Geo 服务地图定位，与地址 components 保持分离。

### 7.2 Required Matrix

`address.availability=provided` 时必须同时满足：

- `countryCode='CN'`；
- province、city、district 的 `code` 和 `displayName` 均为非空规范值；
- `addressLine` 非空，描述区/县之后的街道、道路、门牌或园区详细信息；
- `postalCode` 首版不强制，缺失使用 null，不得用空字符串或“暂无”；
- code 来自受控 location catalog，不由 Page hard-code `city=Wuhan`，不从 displayName 反推；
- `formattedAddress` 必须由 Application/projector 使用同一确定性格式规则生成；Page 不自行拼接。

建议确定性格式为：

```text
province.displayName + city.displayName + district.displayName + addressLine
```

各 component trim 后不得重复包含父级前缀；validator 做 exact equality，不做模糊地址解析。若现实地址需要乡镇/
街道层级，首版包含在 `addressLine`，不提前建设全国地址树。

`address.availability=unknown|unavailable` 时 value 必须为 null。缺失信息必须为 unknown；不得补湖北省、武汉市、
默认区、中心点或 legacy string 拆分结果。

建议长度上限（Unicode code points，normalization 后）：area code 1–64，displayName 1–40，addressLine 1–200，
派生 formattedAddress 1–300，postalCode 若存在则 1–16 ASCII letters/digits/hyphen。具体行政区 code catalog在后续
persistence/ops Contract 冻结，不由 Page 拥有。

### 7.3 Address Verification

Address 的 verification 与 evidence 只证明该 structured address value。它不证明：

- Geo marker 正确；
- region preference code 相等；
- 交通便利；
- 医院距离；
- 机构在该地址仍营业；
- 用户到该机构的距离或路线。

`unavailable` 只用于已确认无法公开/不适用，普通“尚未录入”必须是 unknown。地址变更、availability、stored
verification、evidence binding、`verifiedAt` 或 `validUntil` 变化都 bump parent revision；仅时间自然经过
`validUntil` 不写新 revision。

## 8. Geo Model and Coordinate System

### 8.1 Proposed Shape

```ts
type InstitutionMapReadyCoordinateSystemV1 = 'gcj02'

interface InstitutionGeoLocationV1 {
  latitude: number
  longitude: number
  coordinateSystem: InstitutionMapReadyCoordinateSystemV1
}
```

`publicLocation.geo` 是 `InstitutionField<InstitutionGeoLocationV1>`。Provided Geo 必须：

- latitude/longitude 均为 finite number；
- `-90 <= latitude <= 90`；
- `-180 <= longitude <= 180`；
- 不得是 `(0, 0)` 占位；
- `coordinateSystem='gcj02'`；
- 不接受 stringly typed `"30.1,114.1"`；
- 不接受缺失/unknown/unsupported coordinateSystem 的 provided value。

若外部源是 WGS84、BD-09 或其他体系，必须由 ingestion/backend/ops 在资料入库前使用受控转换与人工核验，
保存最终 GCJ-02 fact。Page、Detail projector 和地图点击 handler 均不得临时转换。

### 8.2 Official WeChat Contract Evidence

本 Proposal 于 2026-09-12 核对：

- 当前项目 `typings/types/wx/lib.wx.api.d.ts` 的 `OpenLocationOption` 明确要求 latitude/longitude 使用
  GCJ-02，范围分别为 `[-90,90]` 与 `[-180,180]`；并提供 `success/fail/complete`；
- 当前微信官方 `wechat-miniprogram/api-typings`（HEAD
  `6092df9100c73b84e140c20b9a42a8e8799e0660`）给出相同要求；
- 官方 typings 的 `MapContext.getCenterLocation` 说明返回 GCJ-02，可用于 `wx.openLocation`；
- 官方示例也以 `wx.getLocation({ type: 'gcj02' })` 结果调用 `wx.openLocation`。

因此提议：

```text
MAP_READY_COORDINATE_SYSTEM = gcj02
```

`wx.openLocation` 没有 coordinate-system option，调用方必须已经持有 GCJ-02 target coordinate；不能把 WGS84
值原样传入后期待微信自动判断。后续实现仍需按 `AGENTS.md` 再次核对当时官方 API parameter contract，不能只凭
本 Proposal 或 TypeScript compile。

官方参考：

- https://github.com/wechat-miniprogram/api-typings
- https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L9352-L9368
- https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L18971-L18976

### 8.3 Independent Address and Geo Verification

强制：

```text
ADDRESS_VERIFICATION != GEO_VERIFICATION
```

允许：

```text
address = current_verified
geo = unverified | expired | unknown | unavailable
```

此时地址可按自身状态展示，地图 action 不可开放。反向 `geo=current_verified + address=unknown` 也不能开放
map action，不能用坐标反向补造地址。

Address 与 Geo 均嵌入同一 Institution parent revision，不存在独立 addressRevision/geoRevision。两者 evidence
必须绑定同一 `institutionId + recordRevision`；cross-revision evidence、悬空 evidence 或与 valueSnapshot 不一致
均使整条 record 失败。由此“address/geo revision mismatch”在合法 Domain 中不可表示。

## 9. Map Role, Availability and Interaction

### 9.1 Frozen Scope Proposal

```text
MAP_ROLE = INSTITUTION_LOCATION_DISPLAY_ONLY_V1_2
DETAIL_RUNTIME_GEOCODING = FORBIDDEN_V1_2
DISTANCE_RECOMMENDATION = FORBIDDEN_V1_2
```

本能力只显示某一家机构的固定位置并在显式点击后打开微信地图。它不包括附近机构、用户位置、距离计算、驾车
时长、地图排行榜、全国地图或按距离推荐。

### 9.2 Map Availability Gate

建议 `MAP_ACTION_AVAILABLE = TRUE` 仅在以下全部成立时：

1. record 已通过 exact V1.2.1 validation 且可公开展示；
2. address `availability=provided`；
3. address effective verification=`current_verified`；
4. geo `availability=provided`；
5. geo effective verification=`current_verified`；
6. latitude/longitude finite、范围合法且非占位；
7. `coordinateSystem='gcj02'`；
8. address/geo evidence 均闭合并绑定当前 canonical revision；
9. Page 收到 projector 已生成的 available snapshot。

任何条件不满足，action 必须 unavailable。建议 UI 保留 disabled“查看地图”操作并在当前地址卡片内显示首要原因，
而不是静默隐藏，让用户能区分“地址可读但坐标待核验”和“暂无位置资料”。

合法 record 可生成的稳定 display status：

```text
available
address_unknown
address_unavailable
address_unverified
address_expired
geo_unknown
geo_unavailable
geo_unverified
geo_expired
```

`invalid_geo`、`unsupported_coordinate_system` 是 Domain validation error；`projection_error` 是 application
error。三者均不得生成一个看似合法的 `InstitutionMapDisplaySnapshotV1`。Page 应进入既有稳定错误态，而不是
把 invalid record 降级成 map unavailable。Page 不根据 `if (latitude && longitude)`、字符串非空或 truthiness
自行决定 action。

### 9.3 Map Display Snapshot

未来 application projection 建议输出：

```ts
interface InstitutionMapDisplaySnapshotV1 {
  status: InstitutionMapDisplayStatusV1
  institutionName: string
  formattedAddress: string | null
  latitude: number | null
  longitude: number | null
  coordinateSystem: 'gcj02' | null
  addressVerification: InstitutionEffectiveVerification | null
  geoVerification: InstitutionEffectiveVerification | null
  mapActionAvailable: boolean
}
```

数据链必须是：

```text
Institution Domain record
  -> explicit contractVersion dispatch
  -> exact validator
  -> version projector
  -> InstitutionMapDisplaySnapshot
  -> Detail ViewModel
  -> Page / future map action
```

Public snapshot 不包含 raw evidence、source locator、内部备注、核验人员、附件 ID 或精确 timestamp。

### 9.4 UI Strategy

建议采用方案 B：

```text
Detail 地址卡片
  + formatted address / verification state
  + explicit “查看地图” action
  -> wx.openLocation only after user tap
```

不在当前已经很长的 Detail 中常驻大地图。理由：7–8 家精选池不需要地图浏览器；地址卡片加载轻、触控路径清晰，
也减少 map component 的层级、cover-view、滚动、z-index 与真机 hit-testing 风险。未来若真实用户证据支持，可在
独立 UI successor 评估方案 C，但不改变 Domain Geo。

未来 `wx.openLocation` 必须：

- 只在一次明确 custom `action` 后调用；
- 遵守 `1 physical tap -> 1 business action -> at most 1 wx API call`；
- 使用 action guard 防 rapid tap，guard 只是第二层防御；
- 提供 success/fail/complete，并在 fail 后展示可见错误、释放 guard；
- 不在 Page load/onShow 自动打开；
- 不依赖 runtime geocoder 或网络补坐标；
- 参数 name/address 来自 display-safe snapshot，坐标来自 verified GCJ-02 snapshot。

建议 A1-4 API parameter policy：latitude/longitude 原样取 verified snapshot；`name` 取已清洗的 institutionName；
`address` 取 formattedAddress；`scale` 固定为 typings 合法范围内的 `16`。若 name/address 未通过未来明确的
长度/字符清洗，action fail closed，不把 raw text 直接传给 API。未来 UI Contract 必须重新核对当时官方
typings/API contract，并测试 `success/fail/complete`；本 Proposal 不执行 API。

### 9.5 User Location Permission Boundary

查看某机构固定位置时，目标 latitude/longitude 已由 Institution fact 提供；当前流程不得调用 `wx.getLocation`，
不得自动请求 `scope.userLocation`，也不要求登录或手机号授权。

“从我的位置导航”、用户到机构距离、附近搜索属于新产品能力；若未来提出，必须单独评估用户授权、隐私、坐标
转换、距离 comparator 和 Recommendation successor。本 Proposal 不预授权。

### 9.6 Existing Transport and Hospital Facts

新增 Geo 不自动重新计算或覆盖：

- 地铁/公交/车辆通达事实；
- 医院名称、类别、distanceMeters、travelTimeMinutes 或来源；
- transportScore、医院距离分或 distance ranking。

这些仍按 frozen V1.1 Contract 与 Recommendation V2 `NOT_YET_SCORABLE` 边界。若未来需要空间计算，必须发布
独立规则、方法与 source/revision contract。

## 10. Public Institution Introduction

### 10.1 Domain Classification

机构简介属于：

```text
PUBLIC_PRESENTATION_CONTENT
```

它不是护理/医疗事实、Capability、CareProcess、Qualification、Recommendation reason、verified institution
rating 或 evidence summary。简介中的自然语言不得覆盖任何结构化事实。

### 10.2 Proposed Separate Public Content Model

建议不把简介放入 `InstitutionRecordV121`，而建立独立 presentation content：

```ts
type InstitutionPublicContentSourceTypeV1 =
  | 'institution_supplied'
  | 'platform_edited'

type InstitutionPublicContentPublicationStatusV1 =
  | 'draft'
  | 'published'
  | 'archived'

type InstitutionPublicIntroductionV1 =
  | {
      availability: 'provided'
      text: string
      sourceType: InstitutionPublicContentSourceTypeV1
    }
  | {
      availability: 'unknown' | 'unavailable'
      text: null
      sourceType: null
    }

interface InstitutionPublicContentV1 {
  schemaVersion: 'institution-public-content-v1'
  institutionId: string
  contentRevision: number
  publicationStatus: InstitutionPublicContentPublicationStatusV1
  introduction: InstitutionPublicIntroductionV1
  updatedAt: string
}
```

`contentRevision` 是 positive integer，用于 exact presentation snapshot pin，不是 Institution identity，也不参与
Recommendation manifest。Current head 必须由 content provider 显式给出，不能靠最大 revision 猜测。

采用独立对象的原因：标点、品牌文案、发展历程或段落调整不应 bump factual `recordRevision`，不应让
Recommendation source 看起来发生事实变化，也不应产生“机构能力已更新”的误导。

状态组合矩阵建议冻结为：

| publicationStatus | introduction state | public display | invariant |
|---|---|---|---|
| draft | provided / unknown / unavailable | hidden | 可编辑但不可公开 |
| published | provided only | visible when exact content revision resolves | text/sourceType 必须合法 |
| published | unknown / unavailable | invalid content record | 不发布空简介 |
| archived | provided / unknown / unavailable | hidden | 新 contentRevision 表示归档；旧 revision 不覆盖 |

`updatedAt` 必须是合法、带时区/offset 的 ISO 8601 timestamp；publicationStatus、introduction、sourceType 或
updatedAt 的业务变化创建新 `contentRevision`。`contentRevision` 不允许覆盖旧值，且不能由最大整数猜 current
head。

### 10.3 Source and Publication Review

首版 source inventory 建议只保留：

```text
institution_supplied
platform_edited
```

`sourceType` 表示内容来源，不是事实 verification。`published` 必须经过人工内容审核；内部审核人、审批日志可由
未来 Backend 保存，但不进入 public content projection。

禁止 `AI_generated` 直接发布。未来即使 AI 辅助润色，也必须由人审定后作为 `platform_edited` 发布，并保留
内部审计；本阶段不实现 AI 生成简介。

### 10.4 Format and Length

建议冻结：

```text
PUBLIC_INTRODUCTION_FORMAT = PLAIN_TEXT_WITH_LINE_BREAKS
PUBLIC_INTRODUCTION_MAX_LENGTH = 2000_UNICODE_CODE_POINTS
```

Provided text 在 NFC normalization、CRLF/CR→LF 和 outer trim 后必须为 1–2000 Unicode code points。允许 LF
换行；拒绝 NUL、其他不可见 control characters、arbitrary HTML、可执行内容、rich-text nodes、embedded
external images。WXML 只按文本渲染，不把内容解释为 HTML/Markdown；图片继续由 cover/gallery/VR 管理。

2000 code points 足以容纳约 7–8 家精选机构的多段公开介绍，又能限制异常 payload；它不是极小营销摘要限制。
未来若确有长篇内容需求，应发布 content schema successor，不用服务端静默放宽。

### 10.5 Fact Derivation Prohibition

正式建议锁定：

```text
PUBLIC_INTRODUCTION_CAPABILITY_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_CARE_PROCESS_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_RECOMMENDATION_INPUT = FORBIDDEN
```

例如简介中的“24 小时专业照护”“医养结合”“武汉顶级”“床位充足”均不能生成或修改：

- `round_the_clock_care`、`night_care` 或其他 Capability；
- `shiftHandover24h`、care record 或 CareProcess；
- 价格、床位、医疗、资质、rating；
- eligibility、tier、rank、reason、difference 或 `NO_EXACT_MATCH`。

具体可核验陈述只有在相应结构化 Institution fact 中通过独立 verification 后，才按该事实自己的显示规则呈现。
UI 不得给整段简介标“已核验”，避免暗示每句话都被事实核验。

### 10.6 Historical and Pinned Detail Policy

建议采用 content revision exact pin 策略：

- `DIRECT_CURRENT`：解析明确的 current published `InstitutionPublicContentV1`；provided 时显示；
- `RECOMMENDATION_PINNED` / `HISTORICAL_READ_ONLY`：只有 source context 另行 exact pin 了
  `institutionId + contentRevision` 才显示该版本；
- historical/pinned context 没有 content revision 时隐藏简介，不无标识混入 current 文案；
- pinned content 缺失/archived/invalid 时不 latest fallback，可显示中性“该版本未附机构简介”；
- 若未来产品更偏好显示 current introduction，必须明确标“当前机构简介（非推荐生成时快照）”，并在独立 UI
  Contract 改决策；本 Proposal 推荐 exact-pin-or-hide。

Content reference 应属于 application/source-context presentation manifest，不写入 Recommendation V2 Domain，
不改变 Recommendation identity 或 cards。

## 11. Revision Bump Matrix

| Change | Institution `recordRevision` | Public `contentRevision` | Notes |
|---|---:|---:|---|
| official phone value/purpose/order | yes | no | factual public contact changed |
| official phone availability/verification/evidence/time | yes | no | follows R1 |
| structured address value | yes | no | factual location changed |
| address availability/verification/evidence/time | yes | no | follows R1 |
| Geo value/coordinate system | yes | no | factual map location changed |
| Geo availability/verification/evidence/time | yes | no | follows R1 |
| only time passes beyond fact `validUntil` | no | no | effective status changes at evaluationAsOf |
| introduction text/source/publication status | no | yes | separate presentation content |
| introduction `updatedAt` / review publication | no | yes | old content revision immutable |
| UI labels/order/formatting only | no | no | no domain semantic change |
| CareProcess | frozen V1.2 R1 | no | unchanged policy |

旧 Institution revisions 与旧 PublicContent revisions 都不可覆盖。Public content edit 不应触发 Institution
“资料事实已更新”提示；如同一次运营操作还变更 phone/address/geo，则各自 revision 轴按事实分别更新。

## 12. Explicit Projections

### 12.1 V1.2.1 to V1.2

概念函数：

```text
projectInstitutionRecordV121ToV12(record)
```

必须：

1. exact validate V1.2.1；
2. 按 V1.2 root/child manifest 显式 allowlist 构造；
3. 输出 `contractVersion='institution-contract-v1.2'`；
4. 保留相同 `institutionId + recordRevision`；
5. 完整保留所有 V1.1 inherited facts、V1.2 `careProcess` 及对应合法 evidence；
6. drop `officialContact`、`publicLocation`；
7. drop `officialContact.*` 与 `publicLocation.*` evidence；
8. 不修改 inherited `identity.address`、`identity.coordinates`、`identity.publicContact`；
9. 不把新增 structured values 回填到 legacy fields；
10. exact validate V1.2 output；任何失败整体返回 stable projection error。

Public introduction 不在 Institution record 内，无需投影，也不得被塞入 V1.2 描述字段。

### 12.2 V1.2.1 to V1.1

Recommendation canonical path 建议采用单一直接 projection：

```text
InstitutionRecordV121
  -> exact V1.2.1 validation
  -> explicit V1.1 allowlist projection
  -> exact V1.1 validation
  -> frozen Recommendation V2
```

`projectInstitutionRecordV121ToV11()` 必须直接复制全部 frozen V1.1 fields/capabilities/extensions/evidence，
保留相同 canonical identity，drop：

```text
careProcess
officialContact
publicLocation
careProcess.* evidence
officialContact.* evidence
publicLocation.* evidence
```

不允许 `spread/delete`、JSON clone/filter、duck typing、silent downgrade、latest fallback 或 partial result。

仍必须实现并测试 V121→V12 compatibility projection，以及以下路径一致性：

```text
direct V121 -> V11
deepEqual
V121 -> V12 -> V11
```

Direct V121→V11 是 Recommendation 的唯一 canonical production path；多级链只作为 compatibility parity gate，
避免后续两条实际 engine path 漂移。

## 13. Recommendation V2 Isolation and Parity

官方电话、structured address、Geo、public introduction、CareProcess 均不得进入或改变：

- eligibility / hard filter / Safety Core；
- `EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE`；
- PriorityFitVector；
- Rank Tuple、tie-break、candidate order；
- reason/difference 选择、内容或排序；
- `NO_EXACT_MATCH`；
- cards 上限、候选补足或 availability semantics；
- Institution Capability V1。

Service 不得先按“有电话/地址/坐标/简介/离得近”prefilter 或 rerank catalog。Recommendation V2 仍只接收
经过 direct V121→V11 exact projection 的完整 pool。

Parity 必须区分：

- same `institutionId + recordRevision` 且 V1.1 facts 相等：V11 与 V121 projection 的 Recommendation V2
  complete observable result deep-equal；
- 真实 phone/address/geo 变化会 bump recordRevision：matching business semantics 必须不变，但 source
  identity/manifest 可以合法变化，不能错误要求含 provenance 的全对象跨 revision deep-equal；
- introduction 变化只 bump contentRevision：Recommendation V2 输入、identity、manifest 与完整结果均不得变化。

未来“距离优先推荐”需要新的 Recommendation Contract/Ruleset successor 与明确 comparator；不能修改 frozen V2。

## 14. A0, List and Detail Compatibility

### 14.1 A0 Canonical Infrastructure

A0 继续使用 `institutionId + recordRevision` route/source identity、exact revision resolution、rapid-action guard、
Back/fallback 和 fail-closed behavior。未来链路必须为：

```text
Provider
  -> explicit contractVersion dispatch
  -> exact version validator
  -> version-specific projector
  -> stable Application Snapshot
  -> ViewModel
  -> Page
```

Page 不读取 raw V1.2.1 record、Mock、evidence 或 schema，不判断字段存在性，不自行解释 verification，也不按
最大 revision fallback。

### 14.2 List Impact

List Card 继续克制，不增加：完整地址、official phone、完整简介、坐标或地图。继续展示 cover、name、region、
type、reference price、verified display tags 与 VR state。区名继续使用合法 `identity.regionCode +
regionDisplayName` projection，不从 structured address 重新解析。

### 14.3 Detail Impact

未来 Detail 推荐顺序：

1. cover；
2. institution name；
3. region / type；
4. short public introduction（只有合法 public-content snapshot）；
5. structured address card + map status/action；
6. institution official contact；
7. recommendation context（存在合法 Assessment/Recommendation source 时）；
8. VR / gallery；
9. Capability / CareProcess / staffing / medical / rooms / meals / activity / transport / price /
   qualifications；
10. 独立“养老顾问/带看顾问”咨询区域。

Recommendation-pinned Detail 的 tier/reasons/differences 继续来自同一 source snapshot。Official contact、location、
intro 只作为 display sections，不得污染 Recommendation context。若页面过长，Intro 建议折叠为 3–5 行并支持
“展开”，但不得截断 Domain value或改变 plain-text semantics。

## 15. Public Action and Privacy Boundary

查看地图与拨打机构公开电话：

- 不要求登录；
- 不要求手机号授权；
- 查看机构固定位置不请求用户 location permission；
- 只由用户显式 action 触发；
- 不在页面加载时自动执行；
- 必须遵守 single custom Action channel 与微信 API fail-visible 规则。

Public Detail 最多输出：合法公开值、effective verification state、获批的 date-only verified date、content source
label。禁止输出内部核验人员、source locator、后台附件 ID、文件系统路径、内部备注、Secret、AppSecret、token
或精确核验 timestamp。

## 16. Mock and Development Policy

当前 8 条 Institution 记录继续是 `MOCK_DEVELOPMENT_ONLY`。未来 V1.2.1 development catalog 必须：

- 文件级、record 级、UI 级三层 Mock 标识；
- official phone 默认 unknown；需要 interaction fixture 时使用明显 synthetic、不会误呼真实主体的号码；
- synthetic address 明确是开发地址，不使用真实养老机构品牌/地址；
- Geo 使用专用 test fixture 或明确 synthetic development location，不复制真实养老院坐标；
- introduction 使用明确 synthetic 文案；
- 不把 Mock 标记为 production verified；
- 地图/电话 action 的 current-verified 分支优先在 test harness 使用 `TEST_SYNTHETIC_VERIFIED /
  NOT_REAL_INSTITUTION_DATA`；
- UI 继续显示“开发 Mock 数据”。

不得为了让地图“看起来能跳”填真实养老院坐标或 `(0,0)`，也不得使用朋友号码冒充 institution official phone。

## 17. Required Runtime and Integration Test Plan

### 17.1 Phone

至少覆盖：

1. valid Wuhan-style landline structure；
2. valid mainland mobile；
3. landline with valid extension；
4. mobile with extension rejected；
5. multiple official numbers and canonical order；
6. each stable purpose code；
7. directory unknown；
8. directory unavailable；
9. provided absent + empty array；
10. provided present + empty array rejected；
11. duplicate key/value rejected；
12. unverified + allowed source closure 显示号码但 call disabled；
13. unverified without allowed source closure 隐藏号码且 call disabled；
14. expired raw/historical value 保留，但 public full number hidden 且 call disabled；
15. current verified valid value call enabled；
16. empty/placeholder/text/URL/QR/multi-number string rejected；
17. consultant number cannot be sourced/projected into official phone；
18. legacy `identity.publicContact` never enables official call；
19. evidence institution/revision/path/snapshot/status/time closure；
20. `wx.makePhoneCall` future parameter/fail handling contract test；
21. one tap produces at most one wx call; rapid tap does not duplicate；
22. `other` purpose requires note，其他 purpose 拒绝 note。

### 17.2 Map

至少覆盖：

1. valid current-verified address + current-verified GCJ-02 Geo -> available；
2. address verified + Geo unknown -> unavailable；
3. address verified + Geo unverified/expired -> unavailable；
4. address unknown + Geo provided/current -> unavailable；
5. address unavailable -> unavailable；
6. invalid latitude/longitude/NaN/Infinity -> record rejected；
7. `(0,0)` placeholder rejected；
8. unsupported/missing coordinate system rejected；
9. legacy coordinates without coordinate system never become map-ready；
10. address/Geo evidence from another revision rejected；
11. inherited/new address or coordinate conflict rejected；
12. no runtime geocoder/network lookup；
13. no `wx.getLocation`/location permission request；
14. projector emits stable status and Page consumes `mapActionAvailable`；
15. future `wx.openLocation` parameter contract, fail-visible and guard release；
16. direct/current/pinned/historical exact revision behavior；
17. synthetic fixtures only; no real institution location；
18. transport/hospital facts and Recommendation results unchanged。

### 17.3 Introduction

至少覆盖：

1. unknown/unavailable introduction；
2. valid plain text；
3. LF line breaks and CRLF normalization；
4. empty-after-trim rejected；
5. exactly 2000 code points pass；
6. over-limit reject；
7. HTML/script/rich-text treated as forbidden input, not rendered；
8. `institution_supplied`；
9. `platform_edited` + human publication gate；
10. AI direct-publish source rejected；
11. draft/archived not public；
12. current direct Detail uses explicit current published content；
13. pinned exact content revision；
14. historical without pin hides; no latest fallback；
15. intro edit bumps contentRevision but not recordRevision；
16. Recommendation input/manifest/result deepEqual across intro edits；
17. no Capability/CareProcess/price/bed/rating derivation from text。

### 17.4 Projection, Dispatch and Regression

至少覆盖：

- valid/all-unknown V1.2.1 exact records；
- exact-key/child-schema/canonical-order failures；
- V121→V12 exact output and V1.2 revalidation；
- V121→V11 exact output and V1.1 revalidation；
- direct V121→V11 equals V121→V12→V11；
- all successor fields/evidence absent from older projections；
- V1/V1.1/V1.2 records unchanged；
- unknown future version fail closed；
- Institution V1/V1.1, Recommendation V1/V2, Assessment, ElderProfile, Profile, Preview, A0 List/Detail and
  interaction regression；
- TypeScript 5.9 application, WeChat TS 4.1.2 targeted, generated JS compatibility, self-test, JSON,
  DevTools and later Android evidence separately labelled。

## 18. Schema Dispatch

未来必须按 root version 精确分派：

```text
institution-contract-v1.1
  -> validateInstitutionRecordV11
  -> V1.1 projector

institution-contract-v1.2
  -> validateInstitutionRecordV12
  -> V1.2 projector
  -> Recommendation only: project V12 to V11

institution-contract-v1.2.1
  -> validateInstitutionRecordV121
  -> V1.2.1 projector
  -> compatibility: project V121 to V12
  -> Recommendation only: project V121 directly to V11

missing / malformed / unknown future version
  -> FAIL_CLOSED with stable error
```

禁止用 `'location' in record`、`'officialPhones' in record`、`'careProcess' in record`、duck typing 或 optional
field fallback 判断版本。Current catalog 任一 invalid record 继续整池失败；historical exact lookup 不得用 latest
revision 替代。

Public content 使用独立 `schemaVersion='institution-public-content-v1'` dispatch，但其 failure 只影响简介 section，
不能让 invalid marketing copy改变 Institution validation 或 Recommendation。具体 fail-open/hide 与 error reporting
应在 Public Content application Contract 冻结；默认 consumer-safe 行为是 hide invalid content、记录 stable
non-sensitive application error，不回退到 current/other revision。

## 19. Stable Error Families

未来实现建议至少保持以下稳定 application/domain error family；错误 payload 不包含完整 record/evidence/profile：

```text
INVALID_INSTITUTION_V121_RECORD
INVALID_OFFICIAL_CONTACT
INVALID_OFFICIAL_PHONE
INVALID_STRUCTURED_ADDRESS
INVALID_GEO_LOCATION
UNSUPPORTED_COORDINATE_SYSTEM
V121_EVIDENCE_CLOSURE_ERROR
V121_TO_V12_PROJECTION_ERROR
V121_TO_V11_PROJECTION_ERROR
PUBLIC_CONTENT_VALIDATION_ERROR
PUBLIC_CONTENT_REVISION_NOT_FOUND
MAP_ACTION_UNAVAILABLE
PHONE_ACTION_UNAVAILABLE
```

具体 leaf code inventory 在 Freeze Contract/A1-2 实现前确定；不得依赖自由文本判断。

## 20. Implementation Target and Sequencing

项目负责人已批准本 Proposal：

```text
LATEST_INSTITUTION_IMPLEMENTATION_TARGET = institution-contract-v1.2.1
```

建议后续依赖顺序：

1. **A1-1C Contract Freeze**：把已批准决策写入独立 V1.2.1 Frozen Contract；不改 V1.2；
2. **A1-2 Domain runtime**：V1.2.1 types、exact validator、evidence、V121→V12/V11 projections、dispatch、
   Recommendation parity；无 UI；
3. **A1-3 Catalog/application**：synthetic development migration、provider、stable official-contact/location/content
   snapshots；无 Backend；
4. **A1-4 Detail UI Contract/implementation**：Intro/address/map/official phone sections与公开 actions；顾问区仍独立；
5. **A1-5 Final gates**：runtime、TypeScript、DevTools、Android、QA；人工/自动证据明确分开。

不应先实现 V1.2 runtime 再做 V1.2.1 migration，也不应跳过 Domain Gate 直接做 map/phone Page。

## 21. Product Decisions Required

以下是项目负责人已经批准的产品决策；代码命名、validator 组织与文件布局不要求产品决策。

| ID | Decision | Recommended choice | Alternative / impact |
|---|---|---|---|
| D1 | Institution successor | `institution-contract-v1.2.1` additive patch | 原地改 V1.2 禁止；V2 过度升级 |
| D2 | official phone cardinality | multiple `officialPhones[]` | 单号码无法表达总机/入住咨询/服务台 |
| D3 | phone purpose inventory | `main/admission_consultation/service/other`；`other` 必须附说明 | `main/other` 更小但立即丢失已明确业务语义 |
| D4 | phone display policy | unverified 合法来源可显示并标待核验、禁拨；expired 隐藏完整号码并引导顾问确认 | expired 不再作为当前官方联系方式公开 |
| D5 | structured address minimum / source | CN + province/city/district code/name + addressLine；postalCode optional；components 是唯一 canonical source，formattedAddress 由 projector 派生 | 存双份地址事实会产生漂移 |
| D6 | canonical map coordinate system | `gcj02` | unresolved 会阻断“map-ready”声明 |
| D7 | map interaction | Detail 地址卡片 + 显式“查看地图” | 常驻 map 增加长页性能/触控复杂度 |
| D8 | map action gate | address 与 Geo 均 current-verified + valid GCJ-02 | 只校验 Geo 会显示未经确认地址；只校验地址需要 runtime geocode |
| D9 | introduction placement | separate `InstitutionPublicContentV1` | 嵌入 record 会因文案改动 bump factual revision |
| D10 | historical introduction | exact contentRevision pin；无 pin 则隐藏 | 显示 current 需醒目标“当前简介”，会产生时间混合 |
| D11 | introduction format/limit | plain text with LF，max 2000 Unicode code points | arbitrary rich text 扩大安全与渲染面 |

上述 D1–D11 已由项目负责人全部批准，并冻结到 `INSTITUTION_CONTRACT_V1_2_1.md`。本 Proposal 保留决策历史；
后续实现必须以 Frozen Contract 为准，不得从本历史文档选择旧候选方案。

## 22. Agent Review Record

本节由 Phase V1.2-A1-1B 独立只读审查完成后更新：

```text
BACKEND_DOMAIN_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
WECHAT_FRONTEND_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
MATCHING_ENGINE_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
QA_VERDICT = PASS / BLOCKERS_0
```

- `backend_domain`：successor、双轴 verification、evidence path、revision 与 projection 方向成立；已补足 legacy
  坐标不可按数值升级、stable phone key、V1.2.1 evidence shape、public-content 状态矩阵等确定性边界；A1-1B
  审查时的剩余风险是 Contract 尚未冻结且 runtime validator 尚未实现。
- `wechat_frontend`：GCJ-02、地图 gate、电话/顾问隔离、显式 action 与历史简介策略成立；已补足
  `wx.openLocation` 参数策略、date-only 规则、Interaction Contract 引用及 deterministic `dialValue`；剩余风险是
  后续 Page/投影/真机 Gate 尚未实现。
- `matching_engine`：完整 Institution pool、canonical identity、V121→V11 推荐投影与 Recommendation V2 隔离成立；
  V121→V12→V11 只作为兼容 parity，不得成为额外推荐语义路径；剩余风险是未来 projection/runtime fixtures 尚未实现。
- `qa_reviewer`：Proposal 状态、successor、phone/consultant 隔离、address/Geo 双轴、GCJ-02、map gate、public
  content、projection、Recommendation isolation、A0/Mock/隐私与 docs-only 边界均通过；确认 frozen V1.2 blob 与
  HEAD 相同，生产/runtime/UI/backend diff 为 0。后续 runtime、DevTools 与 Android 验证属于实现阶段 Gate。

## 23. Scope Boundary

本 Proposal 的实现量保持为 0：

```text
Institution V1.2.1 TypeScript/runtime/validator = 0
V1.2/V1.1 projection implementation = 0
schema dispatch implementation = 0
provider/catalog/mock migration = 0
Institution List/Detail production change = 0
map component = 0
wx.openLocation = 0
wx.makePhoneCall = 0
runtime geocoding = 0
user location permission = 0
CareProcess runtime = 0
Consultant/AI/Visit/Evaluation = 0
Recommendation V2 change = 0
Backend/API/DB/persistence = 0
real Wuhan institution data = 0
```

本 Proposal 的批准已经转化为独立 Frozen Contract；这仍不等于 V1.2.1 runtime 已实现、已编译、已通过
DevTools 或已通过 Android 真机。
