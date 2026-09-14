# Bootstrap 决策记录

状态：已冻结，等待本批实现与 QA 验收
日期：2026-08-26

## 目标

把现有微信官方 TypeScript + Less 模板整理为可持续开发的 MVP 骨架。本批只交付工程结构和最小可运行页面壳层，不交付完整业务页面。

## 已冻结决策

1. 保留微信官方 TypeScript + Less 模板和 `less` 编译插件。
2. 全局设计基础使用：
   - `miniprogram/styles/tokens.less`
   - `miniprogram/styles/mixins.less`
   - `miniprogram/styles/base.less`
3. 页面样式继续使用 `.less`。
4. P0 仍按 20 个业务页面管理，但工程注册 21 个物理路由；“老人档案”包含列表和详情两个路由。
5. TabBar 只包含：首页、养老顾问、我的。
6. 第一阶段只使用明确标注的开发 Mock 数据；不接入任何未核验机构事实或虚构 VR。
7. 后端本批只创建 `server/README.md`，不创建 Spring Boot/MySQL 正式工程。
8. 小程序默认匿名优先；本批不实现微信登录、手机号授权和预约落库。
9. 所有页面通过 service 层读取数据，页面层不散落 `wx.request`。

## 本批范围

- Git 忽略与本机配置隔离；
- Less 设计 token、mixins 和基础样式；
- 少量基础组件；
- 最小领域类型、Mock provider、service contract、评估草稿 store；
- 21 个物理路由最小骨架；
- 空状态、错误状态、开发状态的公共表达；
- 微信开发者工具编译和路由结构验证；
- 独立 QA 验收。

## 明确不做

- 完整 20 页业务 UI；
- ADL、画像推导、硬过滤、权重排序或推荐理由算法；
- 正式 API、数据库、登录态或持久化；
- 手机号授权和真实预约；
- 真实机构数据、评价、资质、床位或 VR；
- 收藏、我的推荐、顾问详情、复杂筛选/对比、地图、资讯、全国城市等 P1/P2 功能。

## 验收门槛

1. `app.json` 注册 21 个物理路由和 3 个 Tab。
2. 每个路由存在 `.ts`、`.json`、`.wxml`、`.less` 文件。
3. 启动不触发 `wx.login`、头像授权或手机号授权。
4. 页面不直接调用 `wx.request`。
5. Mock 文件、记录和可见 UI 均有明确开发标识；VR URL 保持空值。
6. `project.config.json` 的 AppID 和 Less 编译能力未被修改。
7. 微信开发者工具编译无致命错误；若环境无法自动调用工具，必须明确记录为待人工验证，不能伪报通过。
8. `qa_reviewer` 给出独立结论后，主 SOL 才能验收。
