# Agent Engineering — Solo Fast Iteration

`DEVELOPMENT_MODE = SOLO_FAST_ITERATION`
`PRIORITY = WORKING_BUSINESS_FEATURES`

日常开发以 [根 AGENTS.md](../../AGENTS.md) 为协作规则入口。本文件保留原路径供引用；V2.1 的专项 Agent、Skills 和风险验证能力继续可用，默认流程已改为个人开发快速迭代。

- 当前主 Codex 默认直接理解相关代码、实现需求并验证；不强制 specialist delegation 或 delegate-before-deep-read。
- 复杂跨域或委派能节约时间时才用专项 Agent；实际委派后由实现者深读必要 Contract，主会话处理范围、冲突与集成，避免重复阅读。
- `CONTRACT_INDEX.md` 仅作 fallback router；只加载相关 Contract 和触发的 Skill，不默认读历史阶段报告。
- QA、测试及设备证据按影响选择，不默认全量回归、多 Agent 审计、大型 Build/SHA 清单或阶段归档。Frozen 业务安全 Gate 与隐私/身份边界保留。
- 旧 UI 可以在授权范围内重构；Warm Swiss 正式工程视觉工作仍由主会话完成，边界见根规则。技术阶段关闭不等于产品设计永远不可调整。
- 主会话模型由当前会话选择；专项角色和默认值来自 `.codex`，不重复维护模型路由表。按任务复杂度、风险、耗时和额度选择，不要求每轮先推荐模型或审批。局部开发不擅改模型默认值、Sandbox、权限或密钥设置。

历史迁移、旧审批和已关闭阶段只作追溯，不作为普通需求的新前置条件。普通任务按根规则简报，不要求实施、审计和交接三份独立文档。
