# 开发 Mock 数据政策

> 适用项目：武汉养老机构精准匹配小程序 / 养老对接小程序
> 文档定位：长期定义 Mock / synthetic 数据与真实业务事实之间的边界。
> 本文件不把历史 Bootstrap、Phase 3A-3、Phase 4C-1 等阶段实施细节视为当前默认规则。

## 1. 目的

开发阶段允许使用 Mock / synthetic 数据，只用于：

- 页面结构开发；
- 状态覆盖；
- 导航与交互验证；
- application integration；
- 冻结领域规则的客户端接入验证；
- 自动化测试与 regression fixture。

Mock / synthetic 数据不是业务事实，不得被：

- 截图；
- 演示；
- 测试结果；
- 页面文案；
- 推荐解释；
- 顾问说明；

描述成真实合作机构数据。

## 2. 基本原则

### 2.1 Mock ≠ 真实机构事实

任何 Mock / synthetic record 都不能因为：

- 字段结构完整；
- verification 枚举合法；
- evaluator 可运行；
- UI 能正常展示；

而被解释成真实机构已核验事实。

### 2.2 Unknown 不等于 False

未知、未提供、不可用、未核验、已过期等状态应保持独立语义。

不得为了页面完整度，把未知值补成看似合理的：

- 价格；
- 床位；
- 护理比例；
- 人员数量；
- 护理能力；
- 特殊护理；
- 房型；
- 医疗能力；
- 康复能力；
- 资质；
- VR；
- 用户评分。

### 2.3 Mock 不得污染 Frozen Domain

Mock / synthetic 数据可以用于验证已冻结 Domain 的输入输出，但不得：

- 修改 Frozen Contract；
- 反向推导新的 Recommendation 权重；
- 生成真实机构结论；
- 把测试值写回 Institution verified data；
- 通过 UI 观察反向改变真实机构事实。

## 3. Provenance 与可见标识

任何用于 App 开发态展示的机构 Mock，应保留明确 provenance。

历史 DTO 可能使用：

```text
dataProvenance: 'MOCK_DEVELOPMENT_ONLY'
```

正式 Institution record 可能使用：

```text
recordProvenance: 'MOCK_DEVELOPMENT_ONLY'
```

使用哪一个字段，以当前对应 schema / Frozen Contract 为准；不得为了兼容而新增第二套 provenance 语义。

如果 Mock 会进入用户可见开发页面，应有明确 UI 标识，例如：

```text
开发 Mock 数据
```

机构名称应使用不会被误认为真实合作机构的示例名称，例如：

```text
示例机构 A（Mock）
```

不得使用真实机构品牌名承载未经核验的合成事实。

## 4. 字段语义

| 值 / 状态 | 含义 | UI 原则 |
|---|---|---|
| `null` | 数据未提供或不适用 | “暂未提供”或隐藏，按当前页面 Contract |
| `unknown` | 当前无法确认 | “需咨询” / “待确认” / “暂无数据”，按当前页面 Contract |
| `unverified` | 有信息但未完成有效核验 | 不得展示为已确认事实 |
| `expired` | 曾核验但已失效 | 应显示过期 / 待重新确认语义 |
| `unavailable` | 当前明确不可用或无法提供 | 不得压平为 unknown |
| `MOCK_DEVELOPMENT_ONLY` | 仅开发 / 测试 | 必须保持 Mock 身份 |
| `VERIFIED` | 真实有效核验状态 | 只有真实业务核验链才能产生 |

精确字段枚举以当前 Institution / Verification Frozen Contract 为准。

## 5. Synthetic Verification

开发态 synthetic verification 可以使用正式字段结构验证：

- UI 状态；
- application snapshot；
- view model；
- evaluator；
- interaction；
- regression。

但 synthetic evidence 必须能够明确表明它不是现实机构核验。

原则：

```text
synthetic verification structure
≠
real-world verified institution fact
```

生产数据不得沿用仅供测试的 synthetic evidence。

## 6. VR 与媒体

- 没有真实、合法、可展示的 VR 数据时，不创建假 VR URL、假全景图或伪 Viewer；
- Mock / synthetic VR 不得混入生产 Institution record；
- 没有真实媒体时，页面应保持对应 unknown / unavailable / hidden 状态；
- 测试若需要 VR 正向 fixture，应保持 TEST_ONLY / synthetic 隔离，不得被生产 App import。

## 7. Recommendation 与能力字段

Mock / synthetic capability 可以用于验证 Frozen Recommendation / ElderProfile / Institution application integration，但：

- 不生成真实机构匹配百分比；
- 不把 synthetic capability 解释成合作机构真实护理能力；
- 不因为测试数据能得到 Exact / SoftNear / Conditional 等结果，就把该结果当作真实运营结论；
- V1.2 新增的 CareProcess、VisitEvaluation、AIConversation、Consultant interaction 等数据仍不得污染 Recommendation V2；
- 未来若 Recommendation 使用新数据，必须由新的正式 Contract 明确授权。

## 8. Mock Provider 与 Fixture 隔离

必须区分：

```text
miniprogram/mock/**
```

和：

```text
scripts/fixtures/**
```

两者用途不同：

- `miniprogram/mock/**`：开发态显式 provider；
- `scripts/fixtures/**`：自动化 / runtime / regression 测试数据。

要求：

- 生产 App 不得 import 测试 fixture；
- 测试 fixture 不得被重新包装成生产 Institution catalog；
- 开发 Mock 不得因为进入 application path 就失去 Mock provenance；
- synthetic 区域、价格、能力等不得反向进入真实 Assessment 选项或生产目录。

## 9. 用户反馈与平台核验事实隔离

用户带看评价、现场观察和主观评分属于 USER_REPORTED_DATA。

例如：

```text
用户说“没看到护理记录”
```

只能成为：

- 用户反馈；
- 待复核线索；
- VerificationLead（若当前产品流程支持）。

不能直接改写成：

```text
Institution verified fact = 不存在护理记录
```

如需更新真实机构事实，必须经过人工核验、Evidence / Verification 更新和新的 Institution record revision。

## 10. 进入真实数据阶段的门槛

真实机构数据进入产品前，应按当前正式 Contract / Product Source 要求核验相关字段。

可能包括但不限于：

- 名称；
- 地址 / 地图；
- 官方联系方式；
- 顾问联系方式的身份区分；
- 价格；
- 护理能力；
- 特殊护理；
- CareProcess；
- 医疗与康复；
- 房型与设施；
- 膳食；
- 活动；
- 交通与医院距离；
- 媒体 / VR；
- 资质；
- 核验状态与公开日期。

缺失字段继续保持合法的 unknown / unavailable / unverified / expired 等状态，不用 Mock 补齐。

## 11. 当前 V1.2 边界

在当前 V1.2：

- InstitutionCareProcess 是可核验机构事实，但不进入 Recommendation V2 排序；
- AIConversation / AIMessage 不写回 Institution / Recommendation；
- InstitutionVisit / VisitEvaluation 属于服务闭环与用户反馈；
- VisitEvaluation 不生成公开评分权重；
- Mock / synthetic 数据不得改变上述边界。

如果后续产品版本改变这些关系，必须以新的 Product Source / Frozen Contract 为准，而不是直接修改 Mock 数据来“先实现”。

## 12. Source of Truth

本文件只定义 Mock / synthetic 数据政策。

优先级：

```text
Current Product Source / Frozen Architecture Contract
    >
当前正式 schema / validator / application boundary
    >
MOCK_DATA_POLICY.md
    >
历史 Bootstrap / Phase 授权说明
```

如果历史 Phase 文档与当前 Frozen Contract 冲突，历史 Phase 说明不再作为当前默认规则。
