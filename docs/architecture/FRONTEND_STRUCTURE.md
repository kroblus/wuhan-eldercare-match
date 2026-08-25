# 小程序前端结构与所有权

## 技术基线

- 微信原生小程序；
- TypeScript；
- WXML；
- Less，由微信开发者工具现有编译插件处理；
- 不引入额外 UI 框架或复杂构建层。

## 目录职责

```text
miniprogram/
├─ pages/       页面与页面级交互
├─ components/  小而稳定的公共组件
├─ styles/      Less token、mixins 和全局基础样式
├─ types/       领域类型与 service contract 类型
├─ services/    页面唯一的数据访问入口
├─ store/       评估草稿等跨页状态
├─ mock/        仅开发使用的显式 Mock provider
└─ utils/       无业务状态的通用工具
```

## Less 策略

- `tokens.less`：颜色、字号、行高、间距、圆角、边框、阴影和触控尺寸。
- `mixins.less`：少量复用模式，例如卡片、点击区域、文本截断和焦点态。
- `base.less`：页面背景、默认文字、盒模型和基础可访问性样式。
- `app.less`：导入全局基础样式。
- 页面与组件需要编译期变量或 mixin 时显式导入对应 Less 文件。

视觉方向为“温暖、可信、克制”：服务 35–65 岁家庭决策者，优先保证高对比、清楚层级、舒适行高和至少 88rpx 的主要触控区域。本批不实现复杂动画或完整品牌视觉。

## 首批基础组件

| 组件 | 职责 | 不负责 |
|---|---|---|
| `page-container` | 页面安全区、通用边距和标题壳层 | 业务取数 |
| `section-card` | 内容分区和标题 | 领域判断 |
| `primary-button` | 统一主要操作和禁用/loading 外观 | 登录或提交逻辑 |
| `tag` | 标签和状态短文本 | 推断推荐理由 |
| `state-panel` | empty/error/loading/development 状态 | 伪造成功状态 |

现有 `navigation-bar` 优先复用，只有确认无法满足当前路由壳层时才做局部调整。

## 数据访问规则

```text
Page / Component
      ↓
Service contract
      ↓
Mock provider（Bootstrap）或未来 HTTP provider
```

- 页面不得直接调用 `wx.request`。
- Mock 与未来 HTTP 实现共享稳定 service contract。
- 登录、重试、错误映射和数据来源判断不得分散到页面。

## 文件所有权

- `wechat_frontend`：`miniprogram/**`。
- `backend_domain`：未来 `server/**`。
- `matching_engine`：未来推荐规则模块及其测试，开始前由主 SOL 冻结位置。
- `qa_reviewer`：只读审查，不拥有功能实现。
- 主 SOL：跨模块契约、集成和最终验收。
