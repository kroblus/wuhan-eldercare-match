# 武汉养老机构精准匹配小程序 — Project Agent Contract

## 1. 项目目标

开发武汉本地养老机构精准匹配微信小程序 MVP。

核心业务闭环：

老人情况评估 → 老人需求画像 → 精准推荐 → 机构详情 → VR 看院 → 养老顾问 → 实地预约 → 后续成交入住

任何实现都必须优先保证这条链路真实、可用、可测试。

## 2. 当前 MVP 边界

- V1 仅服务武汉市。
- 当前合作养老机构约 7–8 家。
- 机构以月费用约 3500 元以上的中高端机构为主。
- 产品定位是“精选机构池 + 精准推荐”，不是“养老机构大全”。
- 不建设全国城市体系。
- 不建设复杂地图搜索。
- 不建设养老资讯门户。
- 不建设社区、商城、直播。
- 不建设 AI 对话养老顾问。
- 不建设复杂横向对比系统。
- 不建设政策自动补贴测算。

发现需求明显超出 MVP 时，先停止扩张并向主 SOL 会话报告。

## 3. P0 页面

当前 P0 业务页面共 20 个：

1. 首页
2. 评估说明
3. 老人基本情况
4. 健康情况
5. 日常生活能力
6. 认知与特殊护理
7. 养老需求与偏好
8. 预算与入住计划
9. 老人需求画像确认
10. 评估结果与机构推荐
11. 合作机构列表
12. 机构详情
13. VR 看院
14. 养老顾问
15. 预约看院
16. 预约成功
17. 我的
18. 老人档案
19. 我的评估
20. 我的预约

还必须覆盖：空状态、网络失败、登录授权、无完全匹配机构状态。

## 4. 核心产品原则

### 4.1 先评估，后推荐

用户允许直接浏览机构，但产品主路径必须突出：

评估 → 画像 → 推荐。

### 4.2 推荐必须可解释

禁止只向用户展示“匹配度 92%”并以此作为主要依据。

推荐必须给出真实理由，例如：

- 接收半失能老人
- 支持轮椅老人
- 提供康复训练
- 支持夜间护理
- 价格符合预算

### 4.3 真实数据优先

严禁虚构：

- 机构价格
- 床位数量或床位状态
- 医生/护士/护理员数量
- 护理员与老人比例
- 资质
- 医疗能力
- 特殊护理能力
- 用户评价
- VR 场景

缺失时明确显示“暂未提供”“需咨询”“暂无数据”。

### 4.4 推荐系统 V1 不使用 LLM 决策

推荐必须 deterministic、可测试、可解释。

推荐流程：

评估答案 → 老人画像 → 硬性条件过滤 → 候选机构 → 权重排序 → 推荐理由 → 推荐结果

硬性条件优先考虑：认知症接收、走失风险、鼻饲、导尿、压疮、重度失能等真实护理能力。

## 5. 核心数据对象

至少考虑：

- User
- Elder
- Assessment
- AssessmentAnswer
- ElderProfile
- Institution
- InstitutionService
- InstitutionRoom
- InstitutionPrice
- InstitutionMedia
- InstitutionVR
- InstitutionQualification
- Recommendation
- RecommendationReason
- Consultant
- Appointment

重新评估必须创建新的 Assessment；禁止覆盖历史评估结果。

Recommendation 必须绑定生成它的 Assessment。

## 6. 登录、手机号与隐私

匿名用户允许：

- 浏览首页
- 浏览机构列表
- 浏览机构详情
- 查看图片与 VR
- 填写评估

以下场景可要求微信登录：

- 保存评估
- 保存老人档案
- 预约
- 查看历史记录
- 后续收藏（如实现）

不要进入小程序就强制登录。

不要在登录时强制获取手机号。

手机号仅在以下场景获取：

- 预约看院
- 用户明确要求顾问联系

V1 不采集身份证号码。

老人健康、认知和特殊护理数据属于高敏感业务数据，必须最小化采集并清楚说明用途。

## 7. 技术基线

除非主 SOL 明确批准，不随意替换技术栈。

推荐基线：

- 客户端：微信原生小程序 + TypeScript + WXML + Less（保留当前微信官方模板及微信开发者工具现有 Less 插件，不迁移为纯 WXSS）
- 前端构建：尽量使用微信开发者工具原生能力，减少额外构建层
- 后端：Spring Boot 3.x + Java 21
- 数据库：MySQL 8.x
- 缓存：V1 默认不引入 Redis，除非有明确性能/状态需求
- 媒体/VR：先以真实 URL/平台地址接入，禁止伪造 VR 内容
- Git：所有重要修改必须可通过 Git diff 审查

如果仓库已经采用其他技术栈，优先遵循仓库实际情况，并向主 SOL 报告差异。

## 8. Agent 角色与文件所有权

### 主 SOL 会话

负责：

- 架构
- 任务拆分
- 依赖顺序
- API 契约
- 冲突解决
- 集成
- 最终验收

主 SOL 不应为了“多 Agent”而机械启动所有 Luna。

### wechat_frontend

主要负责：

- `miniprogram/**`
- 页面、组件、WXML/Less/TS
- 前端状态与表单
- 微信授权 UX
- VR 前端壳层

### backend_domain

主要负责：

- `server/**`
- API
- 数据库
- 登录态
- Elder / Assessment / Institution / Appointment 等领域对象

### matching_engine

主要负责：

- 推荐语义
- ADL 分类
- 老人画像推导
- 硬性过滤
- 权重排序
- 推荐理由
- 无完全匹配策略

### qa_reviewer

主要负责：

- 独立审查
- 测试
- PRD 对照
- 隐私与授权检查
- 回归风险

QA 默认不直接大规模重写业务代码。

## 9. 多 Agent 协作规则

任何 Agent 接到任务时必须先：

1. 阅读本 `AGENTS.md`。
2. 阅读任务相关 PRD/文档。
3. 检查当前仓库实际状态。
4. 确认任务边界。
5. 查找是否已有实现。
6. 尽量复用现有组件/服务。
7. 再开始修改。

禁止两个实现 Agent 同时拥有同一批核心文件。

当一个新功能需要前后端同时开发时：

1. 主 SOL 先确定 API contract。
2. 冻结契约。
3. 再并行分配 frontend / backend。
4. 最后由 qa_reviewer 独立检查。

## 10. 推荐任务路由

- 纯 UI：wechat_frontend → qa_reviewer
- 普通后端 CRUD：backend_domain → qa_reviewer
- 推荐算法：matching_engine（必要时 + backend_domain）→ qa_reviewer
- 完整纵向功能：主 SOL 先定契约 → frontend + backend 并行 → qa_reviewer
- 大型架构改动：主 SOL 先分析，不直接把决策甩给 Luna

## 11. 完成任务的统一返回格式

每个 Agent 完成后必须返回：

### STATUS
完成 / 部分完成 / 阻塞

### CHANGES
做了什么。

### FILES
修改或重点检查了哪些文件。

### TESTS
运行了什么验证，结果如何。

### RISKS
仍然存在的风险。

### FOLLOW_UP
建议主 SOL 下一步做什么。

禁止只回复“完成了”。

## 12. 微信真机 JavaScript 与事件兼容性

微信真机可运行是最终兼容标准。TypeScript 编译通过和微信开发者工具模拟器通过，均不能替代真机兼容性检查。

### 12.1 禁止 class property initializer

禁止：

```ts
class Example {
  private value = 1
  private readonly items = new Set<string>()
}
```

必须声明字段，并在构造器内初始化：

```ts
class Example {
  private value: number
  private readonly items: Set<string>

  constructor() {
    this.value = 1
    this.items = new Set<string>()
  }
}
```

禁止机械地把 arrow-function property 改成普通方法。修改前必须确认并保留原有 `this` 绑定语义。

任何新增或修改 class 的任务结束前必须：

1. 审计源码中的 class property initializer。
2. 在微信开发者工具完成一次最新编译。
3. 运行 `npm run check:wechat-js-compat` 检查实际生成的微信 JavaScript。
4. 确认产物中不存在 `class Xxx { something = ... }` 或无初始化 class field。

检测器缺失产物、找不到当前项目产物或发现产物早于相关 class 源码时，均不得判定 PASS。

本项目已发生真实事故：

- `store/assessment-draft.js` 曾生成 `draft = readInitialDraft()`。
- `utils/navigation-guard.js` 曾生成 `lockedActions = new Set()`。

### 12.2 公共组件只允许一个业务 Action 通道

公共组件不得同时依赖原生 `tap` 冒泡与同名 `triggerEvent('tap')` 执行同一业务操作。

跨组件业务事件必须使用语义明确的自定义事件名，例如 `action`、`next`、`back`，并显式设置 `bubbles` 与 `composed`。推荐模式：

```ts
this.triggerEvent('action', {}, { bubbles: false, composed: false })
```

```xml
<primary-button bind:action="handleAction" />
```

禁止同时在同一个自定义组件上使用 `bindtap` 触发同一业务 handler。多层转发时，每层只能发出一次业务事件，例如：

`PrimaryButton → Footer action → Page handler`

页面 wrapper 不得再用原生 `tap` 冒泡重复执行同一操作。确需冒泡时，必须在组件契约中说明原因和边界。

导航 guard 只能作为事件根因修复后的第二层防御，不能用 debounce 或 guard 掩盖双事件通道。

### 12.3 QA Gate

涉及 `miniprogram/**` 的 class、公共交互组件或导航修改时，QA 至少检查：

1. 源码 class 初始化方式。
2. `npm run check:wechat-js-compat` 的最新产物 PASS。
3. 公共组件单一 Action 通道及明确的事件传播选项。
4. 导航 guard 返回页面后可再次使用。
5. 微信开发者工具编译结果。
6. 可获得时的真实设备证据，并明确区分项目负责人手工复测、ADB 验证与自动化测试。

如果无法检查实际生成的 JavaScript，QA 最多只能给出 `PASS_WITH_RISKS`，不得给出 `PASS`。
