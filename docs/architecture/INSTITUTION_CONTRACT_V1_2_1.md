# Institution Contract V1.2.1

状态：`FROZEN_PHASE_V1_2_A1_1C`

版本：`institution-contract-v1.2.1`

```text
INSTITUTION_CONTRACT_V1_2 = FROZEN_PREDECESSOR / UNCHANGED
INSTITUTION_CONTRACT_V1_2_1 = ADDITIVE_PATCH_SUCCESSOR
PROJECT_OWNER_DECISIONS = APPROVED
CURRENT_PRODUCT_SOURCE_VERSION = V1.2
LATEST_INSTITUTION_IMPLEMENTATION_TARGET = institution-contract-v1.2.1
CANONICAL_INSTITUTION_IDENTITY = institutionId + recordRevision
OFFICIAL_PHONE_MODEL = MULTIPLE_OFFICIAL_PHONES
OFFICIAL_CONTACT_RECOMMENDATION_ROLE = NONE
ADDRESS_RECOMMENDATION_ROLE = NONE_V1_2
GEO_RECOMMENDATION_ROLE = NONE_V1_2
PUBLIC_INTRODUCTION_RECOMMENDATION_ROLE = NONE
MAP_READY_COORDINATE_SYSTEM = gcj02
MAP_ROLE = INSTITUTION_LOCATION_DISPLAY_ONLY_V1_2
DETAIL_RUNTIME_GEOCODING = FORBIDDEN_V1_2
PUBLIC_INTRODUCTION_DOMAIN_PLACEMENT = SEPARATE_PRESENTATION_CONTENT
PUBLIC_CONTENT_HISTORY_POLICY = EXACT_PIN_OR_HIDE
V121_TO_V11_RECOMMENDATION_PROJECTION = DIRECT_V121_TO_V11
RECOMMENDATION_V2_CHANGE = FORBIDDEN
PRODUCTION_CODE_CHANGE = 0
```

本文件冻结 `institution-contract-v1.2.1` 的领域、投影、公开展示与版本边界。V1.2.1 是已冻结
`institution-contract-v1.2` 的 additive patch successor，只新增机构官方联系方式、结构化公开地址、地图可用
Geo 和独立公开简介内容契约。它不原地修改 V1.2，不改变 Institution Capability V1、CareProcess、
Recommendation V2、A0 canonical identity 或产品版本。

本阶段仅冻结 Contract，不授权 TypeScript runtime、validator、projection、provider、Mock、Page、WXML、Less、
`wx.openLocation`、`wx.makePhoneCall`、Backend 或真实武汉机构数据实现。

## 1. Source of Truth

按优先级，本 Contract 服从：

1. 项目负责人对 Phase V1.2-A1-1C 的正式批准及 D1–D11 最终决策；
2. `docs/product/README.md` 与两份 V1.2 产品 PDF；
3. frozen `INSTITUTION_CONTRACT_V1_2.md`；
4. frozen `INSTITUTION_CONTRACT_V1_1.md` 与 `INSTITUTION_CAPABILITY_CONTRACT.md`；
5. frozen `RECOMMENDATION_CONTRACT_V2.md` 与 `RECOMMENDATION_RULE_CONTRACT_V2.md`；
6. frozen `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md` 与 A0 canonical List/Detail infrastructure；
7. accepted `V1_2_CHANGE_IMPACT_ANALYSIS.md`；
8. approved `INSTITUTION_CONTRACT_V1_2_1_PUBLIC_INFO_MAP_PROPOSAL.md`，仅作为设计与审批历史；
9. `WECHAT_INTERACTION_CONTRACT.md`、`MOCK_DATA_POLICY.md`、`FRONTEND_STRUCTURE.md` 与根目录 `AGENTS.md`；
10. 当前项目微信 typings 与微信官方自动生成 API typings。

如 Proposal、UI 文案、旧 DTO、Mock 或未来实现与本 Contract 冲突，以本 Contract 为准。产品 PDF 已明确平台
养老顾问电话与未来机构官方电话必须分离；结构化地址、Geo、地图 gate 和公开简介的完整字段是项目负责人在
V1.2 内批准的本 Contract 增量，不追溯性声称旧 PDF 已冻结全部字段。

## 2. Frozen Product Decisions

| ID | Frozen decision |
|---|---|
| D1 | `institution-contract-v1.2.1` 是 V1.2 additive patch successor；Product 仍为 V1.2 |
| D2 | 官方联系电话使用多个 `officialPhones[]` |
| D3 | purpose 为 `main / admission_consultation / service / other`；`other` 必须附说明 |
| D4 | current-verified 显示且可拨；合法来源 unverified 显示并标待核验、不可拨；expired 隐藏完整号码 |
| D5 | canonical address source 是 CN + 省/市/区 code/name + addressLine；postalCode optional；formattedAddress 派生 |
| D6 | map-ready canonical coordinate system 为 `gcj02` |
| D7 | Detail 使用地址卡片 + 显式“查看地图”，不常驻大型 map component |
| D8 | address 与 Geo 均 current-verified、合法并闭合到同一 revision 才开放 map action |
| D9 | 简介属于独立 `InstitutionPublicContentV1`，不进入 factual Institution record |
| D10 | historical/pinned 简介采用 exact contentRevision pin；未 pin 或不可解析时隐藏 |
| D11 | 简介为纯文本换行格式，上限 2000 Unicode code points |

以上均为 frozen 产品决策，不是实现建议。

## 3. Successor Version and Canonical Identity

正式版本关系：

```text
institution-contract-v1.1
  -> institution-contract-v1.2
  -> institution-contract-v1.2.1
```

产品版本继续为 V1.2；不得机械命名为 Product V1.3 或 Institution V2。V1.2 是 immutable predecessor 和合法
compatibility target，V1.2.1 是 A1-2 唯一最新实现目标。禁止先实现 V1.2 runtime 再迁移到 V1.2.1。

唯一 Institution canonical identity 继续是：

```text
institutionId + recordRevision
```

不得增加 `contactId`、`locationId`、`introId`、child revision 或数组 index 作为第二机构 identity。
`officialPhoneKey` 只定位父 revision 内的电话 child；`contentRevision` 只定位展示内容版本，二者都不是
Institution canonical identity、route identity 或 Recommendation source identity。

## 4. Frozen Conceptual Record Shape

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

V1.2.1 完整继承 V1.2 的 V1.1 facts、Capability V1、CareProcess、operations、media、VR、qualifications 与
所有既有语义；不删除、不重命名、不补默认值、不重新解释。

`officialContact` 与 `publicLocation` 是 required exact-shape subrecord。Required shape 不等于 required known
data；无可靠资料时必须使用合法 `unknown + null + unverified + empty evidenceIds`，不得补造。

## 5. Universal Fact and Verification Axes

官方电话、地址和 Geo 全部复用 frozen：

```text
InstitutionField<T>
availability = provided / unknown / unavailable
stored verification = unverified / verified / expired
effective display = current_verified / unverified / expired
```

合法组合继续服从 V1.2：

| availability | value | stored verification | evidence |
|---|---|---|---|
| provided | 合法非空 T | unverified | 可空；非空必须闭合 |
| provided | 合法非空 T | verified | non-empty exact closure |
| provided | 合法非空 T | expired | non-empty exact closure |
| unknown | null | 仅 unverified | 必须为空 |
| unavailable | null | unverified | 可空；非空必须闭合 |
| unavailable | null | verified | non-empty，snapshot=`unavailable` |
| unavailable | null | expired | non-empty，历史 unavailable closure |

禁止把 missing、空字符串、0、false、unknown、unavailable、unverified 与业务否定或确定事实相互转换。
Effective verification 必须在调用方显式传入的 `evaluationAsOf` 下由 pure projector 计算；Domain 不读取当前时间。

## 6. Official Contact Model

### 6.1 Stable Codes and Shape

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

Purpose 语义：

- `main`：机构主要公开联系方式；
- `admission_consultation`：机构自身入住咨询，不是平台顾问；
- `service`：机构其他公开服务电话；
- `other`：不能归入前三项的官方电话，必须有 `otherPurposeNote`。

Purpose 只用于结构化展示与运营维护，Recommendation role 为 NONE。中文 label 由 projector/ViewModel 根据
stable code 映射，不允许用任意 label 替代 stable purpose。

### 6.2 Directory and Child Invariants

| directory fact | officialPhones | meaning |
|---|---:|---|
| provided + present | non-empty | 至少一个合法 official phone child |
| provided + absent | empty | 来源明确称无公开官方号码；verification 决定可信度 |
| unknown + null | empty | 没有足够资料 |
| unavailable + null | empty | 已声明不可公开或不适用 |

每个 child `phone` 必须为 `availability=provided` 且 value 非空；未知号码由 directory outer unknown 表达，
不得创建空 child。Parent 不是 `provided + present` 时任何 child 均非法。重复 key、重复完整 canonical phone、
非法 order 或 orphan evidence 使整条 record fail closed，validator 不自动修复。

`officialPhoneKey` 在同一父 revision 内唯一并满足：

```text
/^[a-z0-9][a-z0-9_-]{2,63}$/
```

它是 evidence fieldPath 的稳定 child segment，不是全局 ID，也没有独立 revision。

### 6.3 Phone Syntax

- Mobile：`nationalNumber` 为 11 位 ASCII digits，满足 `1[3-9][0-9]{9}`；extension 必须 null；
- Landline：`areaCode` 为 `0` 开头的 3–4 位 ASCII digits，`subscriberNumber` 为 7–8 位 ASCII digits；
- Landline extension 为 null 或 1–6 位 ASCII digits；
- `countryCallingCode` 首版固定 `+86`；
- `otherPurposeNote`：purpose=`other` 时必须是 normalization 后 1–80 Unicode code points 的单行纯文本；
  其他 purpose 时必须为 null；
- canonical value 不含空格、括号、连字符、`ext.`、URI、label 或说明文字。

拒绝空字符串、“暂无”“联系顾问”、URL、二维码内容、多号码拼接、数字类型、NaN、400/800、境外号码、短号及
未冻结格式。出现真实新增号码类型时发布 phone-value successor，不放宽当前 validator。

### 6.4 Deterministic Ordering

数组 canonical order：

1. purpose priority：`main → admission_consultation → service → other`；
2. 同 purpose 按 `kind + canonical base digits + extension-or-empty` 的 code-point key；
3. 最后按 `officialPhoneKey` code-point order。

Full canonical phone value 重复、key 重复、输入非 canonical order 均拒绝，不静默排序/去重。不增加运营
`displayOrder`；未来若需要手工展示顺序，只能进入 presentation metadata，且 Recommendation role 为 NONE。

### 6.5 Dial Value

未来 phone projector 从已校验 value 确定性生成、但不持久化：

```text
mobile dialValue   = nationalNumber
landline dialValue = areaCode + subscriberNumber
```

不得加入 `+86`、extension、空格、连字符、label 或说明文字。Extension 首版 DISPLAY_ONLY；不假设
`wx.makePhoneCall` 能可靠自动拨分机。Page 不自行拼号，dialValue 不反向覆盖 canonical phone。

## 7. Phone Verification, Display and Action

Directory presence 和每个 provided phone 分别绑定 verification/evidence；child 不继承 parent verification。
Call action 要求 directory 与目标 child 都是 current-verified、号码合法、record 可公开且 snapshot available。

冻结公开策略：

| state | public number | public status | call action |
|---|---|---|---|
| current-verified | 显示完整号码 | 机构官方电话 + date-only 核验日期 | enabled |
| unverified + allowed source closure | 显示完整号码 | 机构提供，平台待核验 | disabled |
| unverified without allowed source closure | 不显示号码 | 官方联系电话待确认 | disabled |
| expired | 不显示完整号码 | 机构电话资料已过核验期，请联系养老顾问确认 | disabled |
| unknown | 不显示号码 | 官方联系电话待确认 | disabled |
| unavailable | 不显示号码 | 当前暂无可提供的官方联系电话 | disabled |
| invalid record | 不生成 phone snapshot | stable application/domain error | disabled |

Unverified number 只有至少一个 evidenceId 闭合到现有合法 Institution source type，且 sourceReference/sourceNote、
institution、revision、path、snapshot 与 unverified status 均一致时，才满足 allowed source closure。Empty-evidence
unverified fact 可在 Domain 内合法存在，但不能公开完整号码。

首版允许形成该 public-source closure 的 source type 沿用现有受控 inventory：`institution_provided`、
`platform_manual_verification`、`official_document`、`contract_material`、`on_site_verification`。Source type 只说明
材料来源，不自动把 stored status 从 unverified 提升为 verified；unknown source 或自由文本来源不能公开号码。

Expired value 和 evidence 继续存在于不可变历史 record，只是不得作为 current 官方联系方式公开。不得用顾问电话
替代 expired 官方号码。公开 verified date 沿用 V1.2 D1：取已校验 `verifiedAt` 自带 offset/时区字符串的
`YYYY-MM-DD` segment，不按设备时区换日。

未来 `wx.makePhoneCall` 只能由显式用户 action、`callActionAvailable=true` 和 snapshot `dialValue` 触发；每次
物理点击最多一次 API 调用。必须核对当时官方 typings/API contract，并处理 success/fail/complete、可见失败反馈
与 action guard 释放。不得自动拨号，不要求登录或用户手机号授权。

## 8. Official Institution vs Consultant Boundary

冻结为两条独立关系：

```text
InstitutionRecordV121
  -> officialContact
  -> institution official public facts

Institution
  -> ConsultantAssignment
  -> ConsultantProfile / DEFAULT_CONSULTANT
  -> platform eldercare / visit consultant
```

禁止 official→consultant fallback、consultant→official fallback、把员工/朋友私人号码写入 officialContact，或把
机构号码写入 DEFAULT_CONSULTANT。未来 Detail 必须把“机构官方电话”与“养老顾问电话/带看顾问电话”明显分区；
统一“联系电话”标签不合格。

Legacy `identity.publicContact` 继续是 V1/V1.1/V1.2 broad string，不自动升级成 official phone，不生成
dialValue，不进入新 official/consultant 区。V1.2.1 current Detail 以 `officialContact` 为唯一机构官方电话来源。

## 9. Structured Address Model

### 9.1 Canonical Shape

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

Structured components 是唯一 canonical address fact。Domain 不保存第二份独立 `formattedAddress`。Geo 是另一个
独立 fact，不属于 address value。

### 9.2 Required Matrix and Validation

`address.availability=provided` 时必须同时具备：

- `countryCode='CN'`；
- province/city/district 的受控 `code` 与非空 `displayName`；
- 非空 `addressLine`，描述区县后的街道、道路、门牌或园区信息；
- `postalCode` 为 null 或 1–16 位 ASCII letters/digits/hyphen。

Normalization 后建议 exact bounds：area code 1–64，displayName 1–40，addressLine 1–200 Unicode code points。
禁止 district/addressLine 空字符串、“暂无”、一整段 free-text 替代 components、默认湖北/武汉/中心点或 Page
hard-code。Unknown/unavailable 必须 value=null，不允许空对象。

行政区 code catalog 属于后续 ingestion/ops Contract；Page 不拥有 catalog，不从 displayName 反推 code。

### 9.3 Formatted Address Policy

冻结：

```text
STRUCTURED_ADDRESS_COMPONENTS = CANONICAL_SOURCE
FORMATTED_ADDRESS = DERIVED_APPLICATION_DISPLAY_VALUE
```

Application/projector 对 normalization 后的 components 按固定顺序确定性生成：

```text
province.displayName + city.displayName + district.displayName + addressLine
```

每个 component outer trim；结果必须为 1–300 Unicode code points。Page 不拼地址，Domain record 不持久化
formattedAddress，且不得把 formatter output 反写成第二事实。若未来改为存 snapshot，必须发布 Contract successor
并由 validator 证明与 components exact equal。

Legacy `identity.address` 仍是旧 display string。迁移默认不拆分、不猜行政区；只有独立资料录入、validation 与
evidence closure 才能形成 structured address。Legacy text 与派生 display address 的 exact normalized equality
最多记录兼容性等价，不自动产生 verification。

### 9.4 Address Verification

Address 整体拥有独立 availability、verification、evidence。Address verified 只证明 structured components，不
证明 Geo、机构营业、region preference、交通便利、医院距离、用户距离或路线。

`unavailable` 只用于已声明无法公开/不适用；普通未录入为 unknown。Address value、availability、stored
verification、evidence binding、verifiedAt/validUntil 的业务变化均 bump parent revision。

## 10. Geo Model and Coordinate System

```ts
type InstitutionMapReadyCoordinateSystemV1 = 'gcj02'

interface InstitutionGeoLocationV1 {
  latitude: number
  longitude: number
  coordinateSystem: InstitutionMapReadyCoordinateSystemV1
}
```

Provided Geo 必须满足：

- latitude/longitude 是 finite number；
- latitude ∈ `[-90, 90]`；
- longitude ∈ `[-180, 180]`；
- `(0,0)` 作为占位明确拒绝；
- `coordinateSystem='gcj02'`；
- 不接受 stringly typed coordinate 或缺失/unknown coordinate system。

本 Contract 于 2026-09-12 核对项目 `typings/types/wx/lib.wx.api.d.ts` 以及微信官方自动生成
`wechat-miniprogram/api-typings`：`OpenLocationOption` 要求 latitude/longitude 使用 GCJ-02 并提供
success/fail/complete；`MapContext.getCenterLocation` 返回 GCJ-02 并可用于 `wx.openLocation`。冻结：

```text
MAP_READY_COORDINATE_SYSTEM = gcj02
```

官方依据：

- https://github.com/wechat-miniprogram/api-typings
- https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L9352-L9368
- https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L18971-L18976

外部 WGS84、BD-09 或其他坐标必须在 ingestion/backend/ops 阶段受控转换、人工核验并保存最终 GCJ-02 fact。
Page、projector 与 click handler 均不得临时转换或猜测。

Legacy `identity.coordinates` 没有 coordinate-system discriminator，数值相等也不能证明 GCJ-02，不自动升级。
只有独立来源明确坐标系、受控转换/证明且对新 Geo 建立 evidence closure 时才能写入 V1.2.1。

## 11. Geo Verification and Address Independence

冻结：

```text
ADDRESS_VERIFICATION != GEO_VERIFICATION
```

Geo 拥有独立 availability、verification、evidence。Address current-verified 不能令 Geo verified；Geo verified
也不能令 Address verified。允许 address current-verified + geo unverified，此时地址可展示，map action 不可用。

如果明确 evidence 证明同一 Institution revision 的 address 与 Geo 描述冲突，整条 candidate fail closed；不得
选择“看起来合理”的一个。Geo 变化、availability、verification、evidence binding 和核验时间变化 bump parent
revision；仅时间自然经过 validUntil 不 bump。

## 12. V1.2.1 Evidence Contract

V1.2.1 复用 V1/V1.1/V1.2 evidence system，不创建第二套 verification/evidence：

```ts
type InstitutionEvidenceValueSnapshotV121 =
  | InstitutionEvidenceValueSnapshotV12
  | { valueType: 'official_phone'; value: InstitutionOfficialPhoneValueV1 }
  | { valueType: 'structured_address'; value: InstitutionAddressV1 }
  | { valueType: 'geo_location'; value: InstitutionGeoLocationV1 }

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

Canonical new field paths：

```text
officialContact.phoneDirectoryPresence
officialContact.officialPhones.<officialPhoneKey>.phone
publicLocation.address
publicLocation.geo
```

Directory presence 使用 `stable_code` snapshot；phone/address/geo 使用各自 typed snapshot；unavailable assertion
使用 stable code `unavailable`。`<officialPhoneKey>` 必须由 stable identifier validator 精确解析到唯一 child，
不是数组 index。

每个 evidence 闭合：same institutionId、same recordRevision、exact fieldPath、typed exact valueSnapshot、same
verification status/time、合法 source locator。Verified/expired 必须 non-empty；orphan、duplicate、跨机构、跨
revision、path/snapshot/status/time 不一致使整条 record 失败。Public projection 不泄漏 raw evidence、内部备注、
核验人、附件 ID、路径或精确 timestamp。

## 13. Map Role and Availability Gate

冻结范围：

```text
MAP_ROLE = INSTITUTION_LOCATION_DISPLAY_ONLY_V1_2
DETAIL_RUNTIME_GEOCODING = FORBIDDEN_V1_2
DISTANCE_RECOMMENDATION = FORBIDDEN_V1_2
```

`MAP_LOCATION_ACTION_AVAILABLE = TRUE` 仅在以下全部成立：

1. root exact V1.2.1 validator PASS 且 record 可公开；
2. address availability=provided；
3. address effective verification=current_verified；
4. geo availability=provided；
5. geo effective verification=current_verified；
6. latitude/longitude finite、范围合法、非占位；
7. coordinateSystem=gcj02；
8. address/geo evidence 均闭合到同一 institutionId + recordRevision；
9. projector 成功生成 available map snapshot。

任何条件失败即 FALSE。合法 record 的稳定 unavailable status：

```text
address_unknown
address_unavailable
address_unverified
address_expired
geo_unknown
geo_unavailable
geo_unverified
geo_expired
```

Invalid Geo/coordinate system 是 Domain validation error，projection failure 是 application error；二者不得伪装
成合法 unavailable snapshot。Page 不用 truthiness、字符串或 `if (latitude && longitude)` 决定 action。

## 14. Map Display Snapshot and Interaction

未来 application projection 输出：

```ts
type InstitutionMapDisplayStatusV1 =
  | 'available'
  | 'address_unknown'
  | 'address_unavailable'
  | 'address_unverified'
  | 'address_expired'
  | 'geo_unknown'
  | 'geo_unavailable'
  | 'geo_unverified'
  | 'geo_expired'

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

Snapshot relation 冻结：

- `status='available'` 时 formattedAddress、latitude、longitude、coordinateSystem 必须全部非空，且
  `mapActionAvailable=true`；
- `status!='available'` 时 `mapActionAvailable=false`，latitude、longitude、coordinateSystem 必须全部为 null；
- unavailable map snapshot 不得携带“暂时不用但 Page 仍可读取”的 raw coordinate；
- formattedAddress 是否保留由 address 自身 public-display policy 决定；地址可合法展示但仅 Geo gate 不满足时可非空；
- invalid record 不生成上述 snapshot，进入稳定 Domain/Application error。

数据链：

```text
Institution Domain
  -> contractVersion dispatch
  -> exact validator
  -> version projector
  -> InstitutionMapDisplaySnapshot
  -> Detail ViewModel
  -> Page / future map action
```

UI 冻结方向是 Detail 地址卡片 + 显式“查看地图”，不常驻大型 map component。地址可展示但 map gate 不满足
时继续展示地址，并显示 disabled action 与区域内原因，例如“地图位置待核验”；不得隐藏地址或提供无反馈 action。

未来 `wx.openLocation` 仅在显式 custom action 且 `mapActionAvailable=true` 时调用；一次物理点击最多一次 API。
坐标原样取 verified snapshot，name 使用清洗后的机构名，address 使用派生 formattedAddress，scale 初始固定为
typings 合法值 16。实现时必须重新核对当时官方 API contract，处理 success/fail/complete、可见错误与 guard
释放。不得页面加载时自动打开、运行时 geocode 或网络补坐标。

## 15. User Location and Distance Boundary

查看机构固定位置不得调用 `wx.getLocation`、请求 `scope.userLocation`、要求登录或手机号授权。当前功能不包括：

- 从用户当前位置出发；
- 用户到机构距离；
- 附近机构搜索；
- 直线/驾车/步行距离；
- 地图排行榜或距离排序。

新增 Geo 不自动重算或覆盖现有 transport、医院距离、交通便利度或 travel-time facts。未来若做用户位置或空间
计算，必须单独冻结授权、隐私、数据源、坐标转换与 Recommendation Contract successor。

## 16. Public Institution Content Model

机构简介属于 `PUBLIC_PRESENTATION_CONTENT`，不是 Institution factual record、Capability、CareProcess、
Qualification、Medical、Recommendation reason 或 verified rating。

冻结独立 shape：

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

`contentRevision` 是 positive integer，只版本化 presentation content，不是 Institution identity，不进入 route、
facts、evidence、Recommendation manifest 或 recordRevision。Current head 必须由 provider 显式给出，不能按最大
revision 猜测。

### 16.1 Publication Matrix

| publicationStatus | introduction | public display |
|---|---|---|
| draft | provided/unknown/unavailable | hidden |
| published | provided only | exact revision 可解析时 visible |
| published | unknown/unavailable | invalid content record |
| archived | provided/unknown/unavailable | hidden；不覆盖旧 revision |

`updatedAt` 必须是合法、带 timezone/offset 的 ISO 8601 timestamp。Content、source、publicationStatus 或
updatedAt 的业务变化创建新 contentRevision；旧 revision immutable。

### 16.2 Source, Format and Review

Source 仅为 `institution_supplied / platform_edited`。Published 必须经过人工内容审核；source 是来源，不是 field
verification。不得给整段简介标 `current_verified`。AI 直接发布 forbidden；未来 AI 辅助文字必须人工审批后
保存为 `platform_edited`，本 Contract 不授权 AI。

格式冻结：

```text
PUBLIC_INTRODUCTION_FORMAT = PLAIN_TEXT_WITH_LINE_BREAKS
PUBLIC_INTRODUCTION_MAX_LENGTH = 2000_UNICODE_CODE_POINTS
```

Provided text 经 NFC、CRLF/CR→LF、outer trim 后为 1–2000 Unicode code points；按 Unicode code points 计数，
不能用 UTF-16 code units 误伤 emoji/扩展字符。允许 LF，拒绝 NUL、其他不可见 control characters、HTML、
arbitrary rich text nodes、scripts、iframe、自动 embed URL 和外部图片。WXML 只按文本渲染；媒体继续由
cover/gallery/VR 管理。

### 16.3 Fact Derivation Prohibition

冻结：

```text
PUBLIC_INTRODUCTION_CAPABILITY_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_CARE_PROCESS_DERIVATION = FORBIDDEN
PUBLIC_INTRODUCTION_RECOMMENDATION_INPUT = FORBIDDEN
```

简介中的“24小时护理”“五星”“医保定点”“医生值班”等自然语言不能生成或修改 Capability、CareProcess、
Qualification、Medical、价格、床位、rating、eligibility、tier、rank、reason 或 difference。正式事实只来自
对应结构化 Institution fact 及其 verification。

## 17. Public Content Resolver and Historical Policy

未来最小读取能力：

```text
CurrentInstitutionPublicContentResolver
  -> explicit current head only

ExactPublicContentRevisionResolver(institutionId, contentRevision)
  -> exact immutable revision only
```

冻结历史策略：

- `DIRECT_CURRENT`：仅显示 explicit current head 且 status=published 的 provided introduction；
- `RECOMMENDATION_PINNED / HISTORICAL_READ_ONLY`：source context 精确 pin 了
  `institutionId + contentRevision` 且 resolver 找到该 published revision时才显示；
- 未 pin、缺失、invalid 或不能解析时隐藏 section；
- 禁止 latest fallback，禁止把 current 营销文案无标识混入历史推荐；
- archived current head 不公开，但既有 exact-pinned immutable published revision可继续按其自身状态解析。

本阶段无 Backend，不实现假 production history store。Public content failure 只影响简介 section并返回稳定、无
敏感信息的 application error；不得使合法 Institution record 或 Recommendation 失败，也不得 fallback 其他版本。

## 18. Revision Bump Policy

| Change | Institution recordRevision | Public contentRevision |
|---|---:|---:|
| official phone value/purpose/note/directory/order | bump | no |
| official phone availability/verification/evidence/time | bump | no |
| structured address components/availability | bump | no |
| address verification/evidence/time | bump | no |
| Geo value/availability/verification/evidence/time | bump | no |
| CareProcess business change | follow frozen V1.2: bump | no |
| only time naturally passes validUntil | no | no |
| introduction text/source/publication/updatedAt | no | new content revision |
| UI wording/display formatting | no | no unless stored public content changes |

旧 Institution revision 与旧 content revision 均不可覆盖。Internal storage migration 且 semantic binding 完全相同
不 bump；evidence semantic binding 或核验时间变化必须 bump Institution parent revision。

## 19. Explicit V1.2.1 to V1.2 Projection

概念函数：

```text
projectInstitutionRecordV121ToV12(record)
```

必须：

1. exact validate V1.2.1；
2. 依据 V1.2 root/child manifest 显式 allowlist 构造；
3. 输出 `contractVersion='institution-contract-v1.2'`；
4. 保留完全相同 `institutionId + recordRevision`；
5. 保留全部 V1.1 facts、Capability V1、V1.2 CareProcess及合法 V1.2 evidence；
6. drop `officialContact`、`publicLocation`；
7. drop `officialContact.*`、`publicLocation.*` evidence；
8. 不修改 legacy identity.address/coordinates/publicContact；
9. 不把新 address/Geo/phone 回填 legacy fields；
10. exact validate V1.2 output；任一步失败整体返回 stable projection error。

禁止 spread+delete、JSON clone/filter、duck typing、silent downgrade、partial result 或 latest fallback。
PublicContent 不在 Institution record 内，不参与本 projection。

## 20. Direct V1.2.1 to V1.1 Recommendation Projection

Recommendation V2 唯一 canonical production path：

```text
InstitutionRecordV121
  -> exact V1.2.1 validation
  -> direct explicit V1.1 allowlist projection
  -> exact V1.1 validation
  -> frozen Recommendation V2
```

`projectInstitutionRecordV121ToV11()` 保留全部 V1.1 fields、Capability、operations、identity/revision 与合法
V1.1 evidence；显式 drop：

```text
careProcess
officialContact
publicLocation
careProcess.* evidence
officialContact.* evidence
publicLocation.* evidence
```

不得让 Recommendation V2 接收 V1.2/V1.2.1 union，不得在 Recommendation 内 duck-type 或消费新增字段。

## 21. Projection and Recommendation Parity

Compatibility path：

```text
V121 -> V12 -> V11
```

它只用于 Gate，不得成为第二 production Recommendation path。未来必须证明：

```text
projectV121ToV11(v121)
deepEqual
projectV12ToV11(projectV121ToV12(v121))
```

对于相同 institutionId、recordRevision 和 V1.1 facts，两条 V1.1 projection 的 observable semantics 及进入同一
ElderProfile/dataset/policy/evaluationAsOf 后的 Recommendation V2 结果必须一致。

官方电话、地址、Geo、PublicContent 与 CareProcess 不得改变：

- eligibility / Safety Core；
- EXACT、SOFT_NEAR、CONDITIONAL、UNVERIFIED、INELIGIBLE；
- PriorityFitVector；
- Rank Tuple、tie-break、candidate order；
- reason、difference、NO_EXACT_MATCH；
- MAX_3 或候选补足；
- Institution Capability V1。

Service 不得按电话、地址完整度、Geo、简介、地图可用、距离或 CareProcess prefilter/rerank catalog。真实
phone/address/Geo/CareProcess 变化会合法 bump recordRevision，因此 source identity/manifest 可变，但 matching
business semantics 不变。PublicContent 只变 contentRevision，Recommendation input、identity、manifest 和完整
结果均不得变化。未来距离推荐必须发布 Recommendation Contract/Ruleset successor。

## 22. A0, List and Detail Compatibility

A0 canonical route、exact resolver、rapid-action guard 与 Back 语义不变。数据链继续是：

```text
Provider
  -> root contractVersion dispatch
  -> exact validator
  -> version projector
  -> stable application snapshot
  -> ViewModel
  -> Page
```

Page/ViewModel 不读取 raw V121 record、不判断 contractVersion/evidence、不访问 Mock、不拼地址、不转换坐标、不
决定 phone/map availability、不 latest fallback。Current catalog 与 exact historical lookup继续分开。

Structured address 必须进入独立 `officialAddress` snapshot/section；不得覆盖、重解释或复用当前 A0 legacy
`basic.address` 行。Legacy 与新地址可以在兼容阶段并存，但 consumer 必须清楚其 schema source。

List 首版不增加完整地址、官方电话、地图或完整简介；继续展示 cover、name、region、type、reference price、
合法 tags 与 VR state，不变成信息墙。区名继续使用既有合法 region，不从 structured address 解析。

未来 Detail projector 可以新增稳定 sections：publicIntroduction、officialAddress、mapLocation、officialContact、
careProcess。建议顺序：基础信息 → 合法 current/pinned intro → 地址/地图 → 机构官方电话 → Recommendation context
→ VR/gallery → Capability → CareProcess → 其他资料 → 独立养老顾问区。具体 WXML/LESS 留 A1-4。

未来 map/phone action 不得复用 `state-panel` 的 bubbling action 形成多 handler，也不得在 Page 再绑定
`navigation-bar` back notification 执行第二次返回。每条公开 action 必须遵守
`1 physical tap -> 1 custom action -> at most 1 wx API invocation`；guard 只能作第二层防御。

## 23. Mock and Development Policy

当前 8 条记录仍是 `MOCK_DEVELOPMENT_ONLY`。未来 V1.2.1 synthetic official phone/address/Geo/introduction 必须：

- 文件、record、UI 三层明确 `SYNTHETIC_DEVELOPMENT_ONLY` / Mock；
- 不使用真实武汉养老院品牌、电话、地址或坐标；
- 不伪装 production VERIFIED；
- 缺失资料保持 unknown，不补 false/supported/0；
- 地图测试使用专门 synthetic fixture，不为截图借用真实养老院坐标；
- 不添加虚构 VR；
- Mock 文件只保存 Institution facts，不写 recommended、tier、score 或地图可用结论。

Test fixtures 只能位于 `scripts/fixtures/**`，生产 App 不得 import。Development catalog 与 test fixture ownership
继续分离。

## 24. Privacy and Public Evidence Boundary

已通过策略 gate 的机构官方电话与公开地址可以展示。Public projection 不得包含 evidence source locator、内部
核验人、附件 ID、内部备注、文件路径、精确核验时间或敏感 metadata。

PublicContent 不得包含员工私人手机号、老人 PII/PHI、内部业务备注、未授权附件或个人定位。地图只消费机构固定
位置，不采集用户位置。电话和地图 action 均不要求登录、用户手机号或额外健康数据。

## 25. Explicit Schema Dispatch

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
  -> Recommendation only: direct project V121 to V11

missing / malformed / unknown future version
  -> FAIL_CLOSED
```

禁止 `'officialContact' in record`、`'publicLocation' in record`、`'careProcess' in record`、field presence、duck
typing、silent downgrade、partial acceptance 或 latest fallback。

PublicContent 按独立 `schemaVersion='institution-public-content-v1'` dispatch；它不改变 Institution schema version，
失败只影响简介 section。

## 26. Stable Error Families

未来 A1-2/A1-3 至少使用稳定 error family；不得依赖自由文本判断或返回完整 record/evidence：

```text
INVALID_INSTITUTION_V121_RECORD
INVALID_OFFICIAL_CONTACT
INVALID_OFFICIAL_PHONE
INVALID_OFFICIAL_PHONE_ORDER
INVALID_STRUCTURED_ADDRESS
INVALID_GEO_LOCATION
UNSUPPORTED_COORDINATE_SYSTEM
V121_EVIDENCE_CLOSURE_ERROR
V121_TO_V12_PROJECTION_ERROR
V121_TO_V11_PROJECTION_ERROR
UNSUPPORTED_INSTITUTION_CONTRACT_VERSION
PUBLIC_CONTENT_VALIDATION_ERROR
PUBLIC_CONTENT_REVISION_NOT_FOUND
MAP_ACTION_UNAVAILABLE
PHONE_ACTION_UNAVAILABLE
```

具体 leaf code inventory 在 runtime 实现前确定，但不能改变本 Contract 语义。

## 27. Required Future Runtime and Integration Gates

### 27.1 Official Phone

至少覆盖：

1. valid mobile、landline、landline extension；
2. invalid digits、country code、extension、URL/text/QR/multiple-number string；
3. all four purpose codes；other note required/forbidden matrix；
4. directory present/absent/unknown/unavailable relation；
5. multiple phones、duplicate key/value、canonical ordering 与 input permutation；
6. deterministic dialValue，extension 不进入拨号；
7. current-verified/unverified allowed source/unverified empty evidence/expired display matrix；
8. directory/child independent verification 与 current time projection；
9. exact evidence institution/revision/keyed path/snapshot/status/time closure；
10. official 与 consultant 双向 contamination fixture；
11. one tap ≤ one API call、rapid tap、fail-visible、guard release。

### 27.2 Address and Map

至少覆盖：

1. valid canonical components 与 deterministic formattedAddress；
2. unknown/unavailable null；empty component/free-text-only/default Wuhan rejected；
3. address verification independent from Geo；
4. valid current-verified address + current-verified GCJ-02 Geo → available；
5. address/Geo unknown、unavailable、unverified、expired 的全部关键组合；
6. invalid latitude/longitude、NaN/Infinity、string、(0,0)、unsupported system；
7. evidence revision/path/snapshot mismatch；
8. legacy coordinates cannot establish GCJ-02；no runtime geocoding；
9. stable map snapshot/status and Page consumes gate；
10. openLocation parameter/fail/guard Contract；
11. no wx.getLocation/login/phone authorization；
12. transport/hospital/Recommendation unchanged。

### 27.3 Public Content

至少覆盖：

1. draft/published/archived matrix；published requires provided；
2. valid plain text、LF normalization、empty/control/HTML/over-2000 rejection；
3. Unicode code-point count with emoji/extended characters；
4. institution_supplied/platform_edited；AI_generated rejected；
5. valid ISO updatedAt、positive contentRevision、immutability；
6. explicit current resolver、不按最大 revision猜 head；
7. exact historical pin、missing/archived/no-pin hides without latest fallback；
8. introduction change does not bump Institution revision；
9. no Capability/CareProcess/Qualification/Recommendation derivation；
10. public content failure isolated from Institution/Recommendation。

### 27.4 Projection, Dispatch and Regression

至少覆盖：

1. valid V121 exact shape 与 all-unknown enrichment；
2. missing/extra/unknown schema versions fail closed；
3. V121→V12 exact allowlist and output validation；
4. V121→V11 direct exact allowlist and output validation；
5. direct vs V121→V12→V11 deepEqual parity；
6. V1.1/V1.2/V1.2.1 explicit dispatch；
7. complete catalog enters Recommendation，无 prefilter/rerank；
8. all Recommendation V2 semantic fields unchanged；
9. recordRevision/provenance 合法差异与 contentRevision isolation；
10. A0 current/exact resolver、List/Detail/navigation regression；
11. App 不 import scripts fixtures；无真实武汉机构数据；
12. TypeScript 5.9、WeChat TS 4.1.2 targeted、generated JS compatibility、DevTools、Android 与 QA。

## 28. Implementation Sequence

Contract Freeze 后严格按顺序：

1. **A1-2 Domain runtime**：V1.2.1 types、exact validator、official-phone canonicalizer、address formatter/
   validator、Geo validator、evidence closure、schema dispatch、V121→V12、direct V121→V11、Recommendation
   parity、PublicContent types/validator/resolver contract；无 UI；
2. **A1-3 Catalog/application**：synthetic V1.2.1 Mock、provider/catalog、PublicContent current provider、A0 stable
   snapshots；无 Backend；
3. **A1-4 Detail UI**：简介、地址、查看地图、官方电话、CareProcess；顾问仍独立；
4. **A1-5 Final Gate**：全 runtime、fresh DevTools、Android 17 manual real-device 与 QA，证据类型分别标注。

禁止跳过 A1-2 直接实现 Page/API，也禁止先实现 V1.2 再迁移 V1.2.1。

## 29. Agent Review Record

```text
BACKEND_DOMAIN_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
WECHAT_FRONTEND_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
MATCHING_ENGINE_REVIEW = PASS_WITH_RISKS / BLOCKERS_0
QA_VERDICT = PASS / BLOCKERS_0
```

- `backend_domain`：successor、record shape、phone/address/Geo evidence、revision、projection、PublicContent 与未来
  persistence 边界成立；`otherPurposeNote` 已同时存在于 Proposal 与 Frozen Contract。剩余风险是行政区 catalog、
  runtime validator 和后端持久化尚未实现。
- `wechat_frontend`：GCJ-02、map/phone gate、official/consultant 分区、projector-derived address、历史简介和 single
  action 边界成立；已补充 unavailable snapshot coordinate=null、独立 officialAddress 及既有冒泡风险约束。剩余
  风险是 application snapshot、Page、DevTools 与真机 Gate 尚未实现。
- `matching_engine`：direct V121→V11 production path、multi-hop parity Gate、完整 catalog 与 Recommendation V2
  isolation 成立；剩余风险是 projection/dispatch/parity runtime 尚未实现，当前 Recommendation application 仍为
  V1.1-only。
- `qa_reviewer`：首轮发现并阻断 Proposal 中两项旧电话测试语义；修正为 unverified source-closure 分支与 expired
  public full-number hidden 后复核通过。D1–D11、formattedAddress 单一来源、双轴 Geo、PublicContent、projection、
  Recommendation/A0/Mock/隐私及 docs-only Git 边界均通过。

## 30. Frozen Scope Boundary

本次 docs-only Freeze 的实现量为 0：

```text
InstitutionRecordV121 TypeScript/runtime/validator = 0
V121 projection code = 0
schema dispatch code = 0
provider/catalog/mock migration = 0
PublicContent runtime/resolver/store = 0
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
real Wuhan Institution data = 0
```

`INSTITUTION_CONTRACT_V1_2_1 = FROZEN_PHASE_V1_2_A1_1C` 只授权按 §28 进入独立 A1-2，不代表 runtime、
DevTools、Android 或 production implementation 已经完成。
