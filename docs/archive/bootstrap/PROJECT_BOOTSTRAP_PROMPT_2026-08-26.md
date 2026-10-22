# 项目骨架创建提示词（在你已经创建好微信开发者工具项目后使用）

请先阅读 AGENTS.md。

目标：把当前刚创建的微信原生 TypeScript 小程序整理成适合长期开发和多 Agent 协作的项目骨架，但暂时不要完整实现业务页面。

要求：

1. 保留微信开发者工具生成的必要配置文件，不破坏 AppID/项目配置。
2. 建立清晰目录：
   - miniprogram/pages
   - miniprogram/components
   - miniprogram/services
   - miniprogram/store
   - miniprogram/utils
   - miniprogram/types
   - miniprogram/mock
   - docs/product
   - docs/architecture
   - server（如果后端尚未创建，只放 README，不要伪造后端实现）
3. 创建 20 个 P0 页面路由骨架，但每页只做最小可运行占位，禁止一次性塞入全部业务逻辑。
4. 底部 Tab 只保留：首页 / 养老顾问 / 我的。
5. 建立基础设计 token：字号、间距、圆角、边框、主色、正文色、弱文本色、背景色。
6. 建立最少量可复用组件策略：PageContainer、SectionCard、PrimaryButton、Tag、EmptyState 等；不要先做一个庞大设计系统。
7. 建立类型定义：Elder、Assessment、Institution、Recommendation、Appointment 的最小接口。
8. 建立 mock 数据，并在所有 mock 数据文件顶部明确写明“仅开发演示，不得当作真实机构数据”。
9. 建立统一服务层接口，页面不要到处直接 wx.request。
10. 编译并修复所有基础错误。
11. 让 qa_reviewer 独立检查项目是否能编译、路由是否存在、是否有超范围实现。

完成后给出：目录树、关键设计决策、编译结果、下一步建议。
