# P0 页面与物理路由

## 规则

- 产品按 20 个 P0 业务页面管理。
- “老人档案”是一个 P0 业务模块，但工程包含列表和详情两个物理路由。
- 因此 Bootstrap 共注册 21 个物理路由。
- 本批路由只提供可编译、可识别、可导航的最小壳层。

## 路由表

| P0 | 业务页面 | 物理路由 | Tab | 本批状态 |
|---:|---|---|---|---|
| 01 | 首页 | `pages/home/index` | 首页 | 骨架 |
| 02 | 评估说明 | `pages/assessment/intro` | - | 骨架 |
| 03 | 老人基本情况 | `pages/assessment/basic` | - | 骨架 |
| 04 | 健康情况 | `pages/assessment/health` | - | 骨架 |
| 05 | 日常生活能力 | `pages/assessment/adl` | - | 骨架 |
| 06 | 认知与特殊护理 | `pages/assessment/cognitive` | - | 骨架 |
| 07 | 养老需求与偏好 | `pages/assessment/preference` | - | 骨架 |
| 08 | 预算与入住计划 | `pages/assessment/budget` | - | 骨架 |
| 09 | 老人需求画像确认 | `pages/assessment/profile` | - | 骨架 |
| 10 | 评估结果与机构推荐 | `pages/recommendation/result` | - | 骨架 |
| 11 | 合作机构列表 | `pages/institution/index` | - | 骨架 |
| 12 | 机构详情 | `pages/institution/detail` | - | 骨架 |
| 13 | VR 看院 | `pages/institution/vr` | - | 无真实 VR 空状态骨架 |
| 14 | 养老顾问 | `pages/consultant/index` | 养老顾问 | 骨架 |
| 15 | 预约看院 | `pages/appointment/create` | - | 骨架 |
| 16 | 预约成功 | `pages/appointment/success` | - | 仅真实提交结果可进入的说明骨架 |
| 17 | 我的 | `pages/mine/index` | 我的 | 匿名状态骨架 |
| 18 | 老人档案 | `pages/elder/index` | - | 列表骨架 |
| 18 | 老人档案 | `pages/elder/detail` | - | 配套详情骨架 |
| 19 | 我的评估 | `pages/assessment/history` | - | 骨架 |
| 20 | 我的预约 | `pages/appointment/index` | - | 骨架 |

## 核心闭环优先级

后续业务实现严格按以下顺序推进：

> 评估 → 老人画像 → 推荐结果 → 机构详情 → VR → 预约

路由存在不代表业务完成。每个里程碑必须单独实现、验证并由 QA 独立检查。
