# Product Source of Truth

`CURRENT_PRODUCT_SOURCE_VERSION = V1.2`

当前 V1.2 产品基线依据（既有实现继续受适用 Frozen Contract 约束）：

- `武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`
- `武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`

`archive/ = HISTORICAL_REFERENCE_ONLY`

## V1.3 目标规则与阶段状态

B1.2.6 Demo 已通过 Owner 真机验收，验收体验版为 `1.2.6-demo.1025.0039`（Owner 确认）；这不代表 V1.3 或正式历史已实现。保留 `CURRENT_PRODUCT_SOURCE_VERSION = V1.2`，用于标识既有产品基线；以下为已确认的 V1.3 目标规则及 C1 后继规范。

| 状态 | 当前结论 |
|---|---|
| `PRODUCT_POLICY_OWNER_CONFIRMED` | 六项 V1.3 产品决策已确认 |
| `C1_TECH_RULES_FROZEN_BY_OWNER` | 初步参考独立技术规则已由 Owner 冻结 |
| `C1_CODE_NOT_IMPLEMENTED` | C1 尚未实现，冻结不等于编码授权 |
| `C1_NEW_TESTS_NOT_RUN` | R01–R12 已固定规格，尚未执行 |
| `C2_ARCHITECTURE_OPEN` | 单老人正式历史的后端、身份、授权、存储及接口仍待设计 |
| `OVERALL_V1_3_NOT_COMPLETE` | V1.3 尚未整体完成或发布 |

适用依据与入口：

1. [V1.3 产品规则：六项 Owner 决策](RECOMMENDATION_AND_HISTORY_PRODUCT_RULES_V1_3_DRAFT.md)。文件名保留 `DRAFT`，不改变已确认产品决策的效力，也不表示整体工程契约已冻结。
2. [V1.3 页面级 PRD 补充](PAGE_LEVEL_PRD_V1_3_ADDENDUM.md)与 [V1.3 MVP 页面流程补充](MVP_PAGE_FLOW_V1_3_ADDENDUM.md)：定义目标页面行为，正式保存属于后续 C2。
3. [C1 独立 Frozen Contract](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md)：新增初步参考通道的准入、封闭白名单、证据、排序、组合状态及验收规格的权威实现依据。
4. [V1.3 后继契约审查与 C2 开放项](../design/PRODUCT_V1_3_SUCCESSOR_CONTRACT_REVIEW.md)：C1 概述服从独立契约；C2 仍为设计稿，不能据此开启正式历史。

**按适用范围使用依据**：既有功能与历史 V2 快照继续遵守原 Frozen V2 Contract；V1.3 产品方向遵守六项 Owner 决策；新增 C1 通道遵守独立 C1 Frozen Contract。产品文件和早期设计中的“普通收护类型”等宽泛示例，不扩张 C1 `BASIC_SERVICE`（仅已核验房型或餐次）。两条饮食明确冲突否决仅作用于 C1，不倒灌原 V2。真实冲突须报告 Owner，并通过显式 successor/version 处理。

**阶段追溯**：产品文件中“技术待审／未冻结”、PRD 中 tie-break 待审、后继审查稿或 C1 §10 中“尚未同步”属于同步／冻结前的记录；本入口记录后续 Owner 冻结及五份文档现已纳入的状态。[早期 C1 技术评审](../design/V1_3_C1_REFERENCE_TECH_CONTRACT_REVIEW.md)的 `REVIEW_ONLY_NOT_FROZEN`、`READY_FOR_C1_TECH_FREEZE_REVIEW=YES` 等历史结论保留，不代表当前 C1 仍未冻结。规格固定、测试通过、代码完成和版本发布必须分别判断。

本轮核查与遗留文档差异见 [C1 文档同步审计](../design/V1_3_C1_DOCUMENT_SYNC_AUDIT.md)。本次仅同步文档入口，未授权 C1 编码、C2 实施或发布。

## 版本管理规则

1. `docs/product/` 根目录保留当前产品 PDF、本索引及已明确标识阶段的 V1.3 产品规则和补充文件；后继文件不自动替代既有实现基线。
2. `archive/vX.X/` 保存历史版本；历史 PDF 不得覆盖当前产品要求。
3. Product PDF 变化不得自动覆盖 frozen Architecture Contract。
4. Product Source 与 frozen Contract 出现变化时，必须先完成 Change Impact Analysis，再判定 `UNCHANGED`、`COMPATIBLE_EXTENSION`、`VERSION_BUMP_REQUIRED` 或 `BREAKING_CHANGE`。
5. Agent 不得根据新 PDF 直接批量修改生产代码。

## V1.2 边界

- V1.2-A：`InstitutionCareProcess`
- V1.2-B：AI Consultation + Consultant / Enterprise WeChat
- V1.2-C：`InstitutionVisit` + `VisitEvaluation`

`V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN`

上述新模块当前不得改变 Recommendation V2 Safety Core、Eligibility Tier、Exactness、PriorityFitVector、Rank Tuple 或 `NO_EXACT_MATCH`。AI 不重新计算或排序 Recommendation V2；VisitEvaluation 不进入 Recommendation V2。
