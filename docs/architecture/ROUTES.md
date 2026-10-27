# 页面与物理路由注册表

`miniprogram/app.json` 是物理 route 的 runtime truth。本文只提供人类与 Agent 可读的同步注册表，
不记录项目进度、实现完成度或阶段顺序，也不授权增加尚未注册的 route。

“老人档案”是一个业务模块，在工程中使用列表和详情两个物理 route。当前注册30个物理 route，以 app.json 为准。

V1.7 首页直接查询机构，独立 `pages/institution/index` 路由继续可用。
新增非 Tab 阅读入口 `pages/service/policy/index`（养老补贴）、`pages/service/education/index`（科普）、
`pages/service/admission/index`（入住指南）；共用静态内容与阅读页面实现，返回首页使用 switchTab。
这些入口不要求登录、评估或健康资料，也不开放真实预约。

| 业务页面 | 物理 route | 类型 | 稳定用途 |
|---|---|---|---|
| 首页 | `pages/home/index` | Tab：首页 | 产品入口与主要服务入口 |
| 评估说明 | `pages/assessment/intro` | Non-Tab | 进入评估前的说明 |
| 老人基本情况 | `pages/assessment/basic` | Non-Tab | 采集基本情况 |
| 健康情况 | `pages/assessment/health` | Non-Tab | 采集健康相关答案 |
| 日常生活能力 | `pages/assessment/adl` | Non-Tab | 采集 ADL 答案 |
| 认知与特殊护理 | `pages/assessment/cognitive` | Non-Tab | 采集认知与特殊护理答案 |
| 养老需求与偏好 | `pages/assessment/preference` | Non-Tab | 采集入住偏好 |
| 预算与入住计划 | `pages/assessment/budget` | Non-Tab | 采集预算与入住计划 |
| 老人需求画像确认 | `pages/assessment/profile` | Non-Tab | 展示评估画像 |
| 评估结果与机构推荐 | `pages/recommendation/result` | Non-Tab | 展示推荐结果 |
| 合作机构列表 | `pages/institution/index` | Non-Tab | 展示机构列表 |
| 机构详情 | `pages/institution/detail` | Non-Tab | 展示机构详情 |
| VR 看院 | `pages/institution/vr` | Non-Tab | 展示可用的 VR 看院入口或对应状态 |
| 养老顾问 | `pages/consultant/index` | Tab：养老顾问 | 顾问服务入口 |
| 预约看院 | `pages/appointment/create` | Non-Tab | 发起预约申请 |
| 预约成功 | `pages/appointment/success` | Non-Tab | 展示预约申请结果 |
| 我的 | `pages/mine/index` | Tab：我的 | 用户相关功能入口 |
| 老人档案列表 | `pages/elder/index` | Non-Tab | 展示老人档案列表 |
| 老人档案详情 | `pages/elder/detail` | Non-Tab | 展示老人档案详情 |
| 我的评估 | `pages/assessment/history` | Non-Tab | 展示评估历史入口 |
| 我的预约 | `pages/appointment/index` | Non-Tab | 展示预约记录入口 |
