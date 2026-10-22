# Recommendation Preview Application Integration

状态：`FROZEN_PHASE_4C_1`

版本：`recommendation-preview-integration-v1`

## 1. Scope and data flow

```text
future Page -> buildRecommendationPreview({ evaluationAsOf })
                 |-> AssessmentDraftStore.getDraft() (one snapshot per call)
                 |      -> deriveElderProfilePreview(snapshot)
                 |-> InstitutionCatalogService -> InstitutionCatalogProvider
                 |      -> validateInstitutionRecord(each complete record)
                 -> evaluateRecommendationPreview(full preview, full catalog,
                      datasetVersion, datasetMode, evaluationAsOf,
                      frozen rulesetVersion and policyVersion)
                 -> RecommendationPreview or stable application error
```

冻结 Domain 的实际公开名称是 `evaluateRecommendationPreview`，对应需求中的 Recommendation Preview derivation；本阶段不重命名领域 API。Application 只编排，不投影 verification、不推导 ADL/cognition、不判断 care compatibility、不排序、不产生理由或 NO_EXACT_MATCH。

位置：`miniprogram/services/`。Page 不直接读取 Provider / Mock；本阶段不接 Page、不实现 ViewModel、WXML、Less 或 Result UI。

## 2. Catalog provider and service

- `InstitutionCatalogProvider.loadCatalog()` 返回 Promise，完整 payload 为 `{ datasetVersion, datasetMode, records }`，records 使用冻结 `InstitutionRecord`。
- `datasetMode` 沿用 `PRODUCTION | MOCK_DEVELOPMENT_ONLY`；当前默认 Provider 固定是后者，无环境探测或 production fallback。
- `createInstitutionCatalogService(provider)` 建立小型显式边界，`institutionCatalogService` 是默认开发实例。成功只返回 Contract-compatible 的完整 records；未来 HTTP Provider 使用同一个接口，本阶段不实现 HTTP。
- Provider 不按老人情况、status、provenance、verification、tier 或 top-N 裁剪；准入/排除及 full pool manifest 均由冻结 Domain 决定。
- Service 先校验 envelope、逐条调用正式 `validateInstitutionRecord()`、检查重复 institutionId。**任一非法记录拒绝整个 catalog**；禁止 exclude-invalid、静默修复、补业务默认值。验证顺序确定，不返回局部成功。
- 空 records 返回 `NO_INSTITUTIONS_AVAILABLE`，不是机构不适合，不构造假 NO_EXACT_MATCH。
- records/revisions/datasetVersion 原样传递；Service 不生成 manifest，不把 datasetVersion 当真实完整机构池的认证。

## 3. Legacy migration decision

本阶段采用**独立 V1 Catalog 接口的增量迁移**。Bootstrap `InstitutionServiceContract` / `institutionService` 仅保留给现有 home / preference 兼容链，明确标为 legacy；新 application consumer 禁止使用 legacy DTO。

不实现 legacy -> V1 adapter：当前两条 Bootstrap DTO 的 regionCode/regionDisplayName 为空，Migration Plan §2 明确要求此情况拒绝，无法无损形成 V1 record。旧自由文本价格、服务标签也不具备可映射证据。新开发 Catalog 是独立、明确合成的 V1 facts，不是把旧记录补值升级。

这是本次产品授权的 migration 第一个 application consumer 切换；不全局替换旧 service，不切换 Assessment Region Catalog 或 Page。旧 Mock 区域保持空；开发合成区域不得进入冻结问卷真实区域选项。后续真实 Provider / 区域目录迁移继续遵守 Migration Plan 的 validator、current field verification 与 Assessment regression 顺序。

后续若需要 adapter，仍须版本化纯模块：缺失 capability=unknown、verification=unverified、price=null/unknown、availability=unknown；缺失必需身份/区域拒绝；不得 missing->false/supported/0，不得 legacy VERIFIED -> field verified。

## 4. Development-only catalog and synthetic evidence

- 所有 App 开发记录仅在 `miniprogram/mock/`；`scripts/fixtures/**` 只属于测试，App 不得 import。
- 数量固定为 8 个示例 A–H（Mock），非真实武汉品牌；文件声明“仅开发演示，不是真实机构数据”。
- V1 的正式记录字段为 `recordProvenance = MOCK_DEVELOPMENT_ONLY`。Mock Policy 中旧 DTO 的 `dataProvenance` 对应此 V1 字段，不额外发明字段，也不使用 `VERIFIED` 记录 provenance。
- 本次产品明确允许 App 开发 Catalog 使用 DEVELOPMENT SYNTHETIC verification，覆盖 Institution Contract §16 当时仅 test harness 的阶段限制；不改变任何冻结枚举、生产 verified 定义或 projection。合成 evidence 的 sourceNote 明确包含 `DEVELOPMENT_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA`，不是现实机构核验结果。
- known facts 可使用冻结 field verification `verified` 仅作合成分支测试，且整个记录/输出始终保留 MOCK_DEVELOPMENT_ONLY；生产数据不得复用。
- 记录仅含事实，不含 recommended、matchingTier、score 或预计算推荐结果。用有差异的事实覆盖 Exact / Soft-near / Conditional / Unverified / Ineligible，实际结果由真实 Engine 按当次 Draft 计算，不承诺固定分类。
- 未提供的字段保持 unknown/unavailable + null，能力保持 unknown + unverified；未知价格不得补 0。合成费用/区域/能力/availability 不参考或暗示真实市场事实。
- 无真实 VR：url=null、coverMediaId=null、scenes=[]；无假媒体、资质或全景内容。
- 下一阶段 UI 必须显示“开发 Mock 数据”，并说明合成核验不是现实核验；本阶段没有 UI，因此不声称该 UI Gate 已实现。

## 5. Application entry and time

`createRecommendationPreviewService({ readDraftSnapshot, catalogService })` 只提供两个简单函数/对象依赖的测试边界，不是 DI framework。公开构建方法与默认 `buildRecommendationPreview` 均要求 `{ evaluationAsOf: string }`。

每次调用只读取一次最新 Draft 并立即 derive Profile Preview；失败不加载 catalog、不调用 Recommendation evaluator。Catalog 异步加载期间仍使用本次快照，不混入新答案；下一次调用重新读取，无缓存。

evaluationAsOf 不可省略，不自动补当前时间；原字符串传给 Domain 的现有 ISO validator。未来 Page 如需当前时间，在 application 调用入口只生成一次 ISO，再显式传入。测试使用固定时间。evaluationAsOf 不是 completedAt，不生成任何正式身份。

## 6. Error model and privacy

Application Result：`{ ok: true, value: RecommendationPreview } | { ok: false, error }`。

稳定错误：

| code | 语义 |
| --- | --- |
| ASSESSMENT_PREVIEW_ERROR | Draft 读取/结构/完成态/Preview derivation 失败；不调用 Recommendation |
| INSTITUTION_CATALOG_ERROR | Provider load 失败或 catalog envelope 不合法 |
| INVALID_INSTITUTION_RECORD | 任一记录无法通过 validator，或重复 institutionId；整池失败 |
| NO_INSTITUTIONS_AVAILABLE | 合法空 catalog，无领域结果 |
| RECOMMENDATION_DERIVATION_ERROR | 冻结 Recommendation evaluator 拒绝，例如非法 evaluationAsOf |

可附稳定 causeCode 与数值 recordIndex；不向调用方转发任意 exception.message、未知字段路径、原始 payload、答案、Profile dump、sourceNote/sourceReference 或 Secret。Domain error code 可保留，路径不透传不可信内容。错误不伪装为匹配失败、空数组成功或 partial Preview。

## 7. Identity and persistence

唯一链路为 Draft -> ElderProfilePreview -> RecommendationPreview。禁止 CompletedAssessment、formal ElderProfile / Recommendation、assessmentId / elderId / recommendationId / completedAt 伪造。

`RECOMMENDATION_PREVIEW_PERSISTENCE = FORBIDDEN_V1`。

Service 不写 Draft、不写 storage、不新增 Store、不保存 Preview、不缓存 Catalog。开发 Provider 每次提供隔离的内存记录，调用方修改不能污染后续加载；未来缓存/HTTP/sync 留给 API 阶段。

## 8. Gates and evidence

固定 INTEGRATION-001–015：完整/不完整 Draft、非法/空机构池、完整 8 条输入、max3、Unverified/Ineligible 不入卡、独立 Conditional、availability 无排序影响、固定时间 deepEqual、全池 permutation、Draft 修改重算、无持久化、App 不导入测试 fixtures。另覆盖 load/envelope/重复 ID/时间错误、错误脱敏和 Provider 隔离。

回归全部 Recommendation / Institution / ElderProfile / Preview / Profile / Assessment / Interaction；TS 5.9 application + 实际 WeChat TS 4.1.2 定向覆盖新增 service/provider/mock/types 与它们的 runtime dependency，检查 emit/class fields/runtime assumptions；既有实际 DevTools cache 仅证明旧页面 regression，不能声称新 integration 已打包。独立 matching_engine 只读审查结论为 PASS；qa_reviewer 对最终工作树独立验收。

本轮不提交 Git，不进入 Recommendation UI。冻结 Assessment / Interaction / ElderProfile / Preview / Institution / Recommendation 业务契约不变。
