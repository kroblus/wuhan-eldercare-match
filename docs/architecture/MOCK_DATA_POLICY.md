# 开发 Mock 数据政策

## 目的

Bootstrap 阶段允许使用 Mock 机构记录，只为开发页面结构、状态和导航。Mock 不是业务事实，不得被截图、演示、测试结果或文案描述成真实合作机构数据。

## 三重标识

每条机构 Mock 必须同时具备：

1. **文件级标识**：文件顶部声明“仅开发演示，不得当作真实机构数据”。
2. **记录级标识**：`dataProvenance: 'MOCK_DEVELOPMENT_ONLY'`。
3. **UI 级标识**：卡片或页面可见位置显示“开发 Mock 数据”。

机构名称必须明确使用“示例机构 A（Mock）”一类名称，不使用可能被误认为真实武汉机构的品牌名称。

## 字段语义

| 值 | 含义 | UI 建议 |
|---|---|---|
| `null` | 数据未提供或不适用 | “暂未提供” |
| `unknown` | 当前无法确认 | “需咨询”或“暂无数据” |
| `MOCK_DEVELOPMENT_ONLY` | 仅开发测试记录 | “开发 Mock 数据” |
| `VERIFIED` | 经过业务核验的真实数据 | Bootstrap 不得使用 |

未知值不能替换为看似合理的价格、床位数量、护理比例、人员数量、能力、资质或评价。

## VR 规则

- Bootstrap 的 `vrUrl` 必须为 `null`。
- 不创建假全景图、假场景地址或伪 VR Viewer。
- VR 骨架显示“暂无真实 VR 内容，需等待合作方提供并核验”。

## 推荐与能力字段

- 本批可以定义护理能力字段结构，但不能将 Mock 值写成真实机构事实。
- 不生成匹配百分比。
- 不实现硬过滤、权重排序或推荐理由算法。
- 未来推荐理由只能由已核验机构字段支撑。

## 进入真实数据阶段的门槛

真实机构记录进入产品前必须逐项核验名称、地址、价格、护理能力、医疗与康复、房型、媒体、VR、资质及更新时间。缺失字段继续保持空值，不以 Mock 补齐。

## Phase 4C-1 授权增量

以上 Bootstrap 限制保留其阶段含义。本次产品批准独立的 8 条 V1 开发 Catalog，
只用合成 price/region/type/capability/availability facts 验证已冻结 Recommendation Domain 的客户端接入。
不把合成值补到 legacy 记录，不根据真实市场猜机构事实。

V1 记录的 provenance 字段是冻结的 `recordProvenance: 'MOCK_DEVELOPMENT_ONLY'`，
旧 DTO 仍使用 `dataProvenance`；不得新增 `VERIFIED` 记录 provenance。
开发合成 verification 可使用冻结字段枚举，但其 evidence 必须声明
`DEVELOPMENT_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA`，不代表现实人工核验。
生产数据不得使用这些证据；完整输出保留 MOCK dataset mode，下一阶段 UI 必须显示“开发 Mock 数据”。
这不改变生产字段级 verified 定义，不把测试 fixture 变成 App 数据源。

开发 Catalog 与 `scripts/fixtures/**` 分开所有权；合成区域不得进入 Assessment 的真实区域目录。
VR 始终为空且无伪媒体。精确接口、错误和全池校验规则见
`RECOMMENDATION_PREVIEW_INTEGRATION_CONTRACT.md`。
