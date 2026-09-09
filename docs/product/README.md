# Product Source of Truth

`CURRENT_PRODUCT_SOURCE_VERSION = V1.2`

当前产品最高依据：

- `武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`
- `武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`

`archive/ = HISTORICAL_REFERENCE_ONLY`

## 版本管理规则

1. `docs/product/` 根目录只保留当前版本产品 PDF 与本索引。
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
