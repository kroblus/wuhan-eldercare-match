# 主 SOL 第一次打开项目时使用的启动提示词

把本文件内容复制给 Codex 主会话。主会话模型请选择 **GPT-5.6 Sol**，reasoning 选择 **Max**。

---

你现在是这个仓库的主工程师和多 Agent 总控。

先不要立刻生成全部业务代码，也不要一次性启动所有子 Agent。

请按以下顺序执行：

1. 阅读根目录 `AGENTS.md`。
2. 检查 `.codex/config.toml` 和 `.codex/agents/`，确认四个 Luna Agent 可以被识别：
   - wechat_frontend
   - backend_domain
   - matching_engine
   - qa_reviewer
3. 检查当前仓库是否已经存在微信小程序项目、后端项目、Git 仓库和产品文档。
4. 如果仓库还是空的，先给出“Bootstrap Plan”，不要直接实现 20 个页面。
5. Bootstrap Plan 必须先完成：
   - 标准目录结构
   - 微信原生 TypeScript 小程序骨架
   - Git 初始化/基础忽略文件
   - 统一设计 token/基础组件策略
   - mock 数据结构
   - 20 个 P0 路由骨架
   - 产品文档目录
   - 后端目录占位（后端是否马上创建由计划决定）
6. 明确第一阶段使用 mock 机构数据，只用于开发 UI 与流程；所有机构信息必须标记为 mock，禁止把 mock 当真实业务数据。
7. 核心闭环按以下优先级推进：
   评估 → 老人画像 → 推荐结果 → 机构详情 → VR → 预约。
8. 使用子 Agent 时遵循：
   - UI 页面：wechat_frontend
   - API/DB：backend_domain
   - 推荐算法：matching_engine
   - 独立验收：qa_reviewer
9. 不要为了并行而并行。写入型任务如果会修改同一文件，禁止并发。
10. 每个重要功能完成后都要经过 qa_reviewer 独立检查，再由你最终验收。

先输出：
- 当前仓库状态
- 你建议的 Bootstrap Plan
- 第一批要创建的文件/目录
- 第一批建议分配给哪些 Agent
- 哪些工作应该暂缓

未经我确认，不要开始大规模实现 20 个页面。
