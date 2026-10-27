# 产品资料入口

项目当前进度统一看[根 README](../../README.md)。本页维护产品版本和规则入口，不重复维护实现、验收或上传状态。

日常讨论功能先按需看[当前 PRD](CURRENT_PRD.md)或[当前 MVP](CURRENT_MVP.md)。两份说明已对照 2026-10-27 的 Demo 图册、现有源码与后继要求，区分现有展示和待实现目标；精确字段、算法与版本兼容仍按适用契约。

## 原始产品基线

`CURRENT_PRODUCT_SOURCE_VERSION = V1.2`

此标记用于识别原产品基线，不表示所有页面仍停在旧版，也不表示 V1.3 已整体交付。原 PDF 保留版本和日期，不用新说明覆盖原件：

- 武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf
- 武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf

本次已在主根 docs/product 保留两份原始 V1.2 PDF，并校验恢复快照；未覆盖原件。普通任务无需读完整 PDF。

## 已确认的 V1.3 方向与适用规则

| 你需要了解什么 | 按需打开 |
|---|---|
| 六项已确认产品决定：参考推荐、显式保存、首期单老人等 | [V1.3 产品规则](RECOMMENDATION_AND_HISTORY_PRODUCT_RULES_V1_3_DRAFT.md)，文件名 DRAFT 不撤销后来已确认的决定 |
| 目标页面和用户路径 | [页面级 PRD 补充](PAGE_LEVEL_PRD_V1_3_ADDENDUM.md)与[MVP 流程补充](MVP_PAGE_FLOW_V1_3_ADDENDUM.md) |
| C1 独立初步参考的精确资格、证据、排序和组合 | [C1 契约](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md)，已有后继冻结依据 |
| 正式历史 C2 的设计输入和开放问题 | [后继契约审查](../design/PRODUCT_V1_3_SUCCESSOR_CONTRACT_REVIEW.md)，设计输入不等于可用服务 |
| 某阶段到底完成了什么、验到哪里 | [阶段索引](../phases/README.md)中的对应记录；最新整体进度仍看根 README |

**适用范围**：既有功能和 V2 历史快照继续遵守原 V2 契约；V1.3 产品方向依六项已确认决定；新增 C1 通道依独立 C1 契约。C1 的 BASIC_SERVICE 仅含已核验房型或餐次；早期稿中的宽泛“普通收护类型”等例子不能扩大它。C1 的饮食冲突否决不倒灌到原 V2。

早期审查、同步审计和计划中的“未冻结、未实现、测试未运行、尚未同步”是当时状态，不覆盖后来的代码或证据。查过程时从阶段索引选择需要的一份，不重新执行旧审批停点。

## 原有模块边界

V1.2-A 为 InstitutionCareProcess，V1.2-B 为咨询助手与顾问/企业微信，V1.2-C 为看院记录与评价。这些模块不改变 Recommendation V2 的 Safety Core、Eligibility Tier、Exactness、PriorityFitVector、Rank Tuple 或 NO_EXACT_MATCH。AI 不重算/重排推荐，用户评价不直接进入推荐算法。

`V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN`

## 怎样更新文档

普通文字、样式、兼容修复直接更新受影响部分，不另建影响分析报告或审批。业务语义改变时简述影响并使用明确的后继版本，保留旧快照/旧规则兼容；已获授权就继续完成。PDF 或新截图不自动覆盖适用契约。

阶段成果与历史全文按[阶段索引](../phases/README.md)和[历史导航](../archive/README.md)追溯；不要把所有旧合同按日期批量作废，也不要把它们变成每轮必读材料。
