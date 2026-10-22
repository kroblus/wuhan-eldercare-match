# Legacy Institution DTO Migration Plan

状态：`FROZEN_PHASE_4A_2_BOUNDARY`

本文件冻结 Bootstrap `types/domain.ts::Institution` 到 `institution-contract-v1` 的迁移边界。本阶段不实现 adapter、不修改 Service、Mock provider、Region Catalog 或页面。

## 1. Current Dependency Boundary

```text
home / assessment.preference
  -> institution.service.ts
  -> services/mock/institution.service.mock.ts
  -> mock/institutions.mock.ts
  -> types/domain.ts::Institution (legacy)

assessment.preference
  -> institution-region-catalog.ts
  -> types/domain.ts::Institution (legacy record-level provenance)
```

`miniprogram/types/institution.ts` 与 `miniprogram/domain/institution/**` 不得被上述生产链路引用，直到独立迁移阶段获得批准。

## 2. Lossless-only Mapping Rules

| Legacy field | Future migration | Forbidden |
| --- | --- | --- |
| `id` | 非空且满足稳定 ID 规则时映射 `institutionId` | 缺失 ID 不得填 unknown，应拒绝记录 |
| `name` | 原值映射 `identity.name`，verification=`unverified` | 猜测名称 |
| `regionCode/regionDisplayName` | 原值可映射 provided + unverified；缺失不猜测，并报告无法形成合法 V1 Record | 从地址或武汉行政区常量猜 code |
| `address` | 原值映射 display-supporting + unverified | 从地址反推 verified region |
| `institutionType` | 默认不迁移；只有显式 stable-code mapping 才能进入 `supportedTypes` | 解析中文、自动生成 primaryType |
| `coverImageUrl` | 默认不迁移为 `coverMediaId` | 从 URL 生成虚构 media ID |
| `monthlyFee/price.monthlyRange/deposit` | 保持 explicit unknown/unavailable | 解析自由文本、补 0/Infinity、猜金额 |
| `services[]` | 只有显式 stable-code adapter 可迁移为 display service + unverified | 将 legacy supported 变成护理 capability supported |
| `media[]` | 只有 ID、分类、角色、URL 全部可验证时才迁移 | 把 `vr_preview` 变成 VR scene |
| `vr` | 缺少真实 URL、cover 或 scene 时保持 unavailable/unknown | 创建假 URL、scene 或 Viewer |
| `dataProvenance` | `MOCK_DEVELOPMENT_ONLY` 可保持记录 provenance | legacy `VERIFIED` 升级为字段 verified |

所有缺失 capability 必须构造成完整 frozen key matrix，raw status=`unknown`、verification=`unverified`。缺失价格必须 explicit unknown；任何 adapter 都不得产生 effective supported/unsupported。

## 3. Why Adapter Is Deferred

1. 当前没有生产 Page/Service 消费新 Contract；
2. legacy 自由文本无法无损映射结构化价格、能力和 Evidence；
3. 提前接入会把 Bootstrap Mock 的记录级 provenance 误当字段级 verification；
4. 本阶段只需要 validator fixtures，不需要生产 provider migration。

如后续实现 adapter，它必须是独立 pure module、版本化、只做无损映射，并先通过 `validateInstitutionRecord()`；不得在同一变更中替换页面或 Recommendation 输入。

## 4. Region Catalog Migration

当前 Region Catalog 继续使用 legacy DTO。由于现有 Bootstrap records 是 `MOCK_DEVELOPMENT_ONLY` 且区域为空，当前空目录语义保持不变；不得为测试添加武汉行政区常量。

未来新 Contract Region Catalog 只有同时满足以下条件才能纳入机构区域：

```text
recordStatus = published
identity.regionCode = provided
identity.regionDisplayName = provided
两字段 verification = current verified
记录通过 institution-contract-v1 validator
```

`recordProvenance`、地址、页面中文或 primaryType 均不能替代字段级 verification。正式迁移时必须同步更新 Assessment runtime 中的 legacy catalog fixtures，但不得改变已冻结 preference.region 答案语义。

## 5. Ordered Migration Gate

1. Institution V1 Contract、validator 与 verification projection 已冻结并通过；
2. API/DTO contract 单独冻结；
3. 建立 lossless adapter 与专用 Mock migration fixtures；
4. 切换 Region Catalog 并回归 Assessment preference；
5. 切换 Service 返回类型；
6. 最后才允许页面消费新 Institution Record。

任何步骤不得顺带实现 Recommendation、真实机构数据或 Backend。
