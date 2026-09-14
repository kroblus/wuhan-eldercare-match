# Task Prompt Template（可选；不自动加载）

目标：<一句话说明要实现/修复什么>

范围：<页面/模块/文件；知道时再写>

本任务特有限制：<不要重复 AGENTS 的全局规则>

完成标准：实现请求行为；运行与改动相关的 Contract Gate/tests；修复本次改动造成的失败；只有真实产品/Contract blocker 才停下来请求决策。

请按 `AGENTS.md` 自主路由。任务领域明确时直接读取对应 Contract；只有跨域或 Source of Truth 不明确时才查 `CONTRACT_INDEX.md`。不要预读全仓库文档。
