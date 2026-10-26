# wechat_frontend 跨工程路由最小修复交接

TASK = WECHAT_FRONTEND_CROSS_PROJECT_ROUTING_FIX_V1
日期：2026-10-20（Asia/Shanghai）
DOC_KIND = AUDIT_ONLY

## 根因、来源与修改

旧 `wechat_frontend` description 和 developer 指令把正式 root `AGENTS.md` 的 Warm Swiss 例外无条件用于所有任务，没有先判断实际目标工程。因此由正式工程会话派发演示 UI 任务时，也会返回 `ROUTE_BACK_TO_MAIN`。V0 记录与该行为一致；本轮不改写 V0 历史结果。

实际来源是正式工程 `C:/Users/16562/WeChatProjects/wuhan-eldercare-match/.codex/config.toml` 的 `[agents]` 全局开关/默认值，以及 `.codex/agents/wechat_frontend.toml` 独立角色文件。角色通过目录中的独立 TOML 及其 `name` 识别，不需要新增 `config_file` 注册。当前会话可用角色和文件一致。此机制与 [OpenAI 官方 Subagents 文档](https://learn.chatgpt.com/docs/agent-configuration/subagents) 一致。

仅修改一份现有配置：`.codex/agents/wechat_frontend.toml` 的 `description`、`developer_instructions`。`name`、`model = gpt-6.1-sol`、`model_reasoning_effort = high`、原有 sandbox 字段与其余前端指令未变。另新增本交接文件，没有创建新 Agent 定义或审计文件夹。

| 修改前 | 修改后 |
|---|---|
| 根据 root Warm Swiss scope 无条件排除视觉工作 | 先按明确授权的目标文件、解析后绝对路径及完整目录边界识别工程，不以当前 cwd 或配置来源代替目标 |
| 独立演示任务可能被当作正式冻结页面 | 正式目标保留原 Main-only；演示目标先实际读自己的根 AGENTS.md，承接已批准、已授权范围内的前端设计与实现 |
| 两工程适用范围未说明 | 混合/不明目标先交主会话拆分；演示例外不扩散到正式工程，不自动批准 V0 或启动 V1，不自动授予目录权限 |

正式根 AGENTS.md、演示根 AGENTS.md 均保持原文。AppID、网络/Storage 拒绝、DemoSession、隐私、Assessment、Profile/Recommendation、机构/历史关联、评价资格、幂等等继续有效。主要照护者仍为选填单选；字段类型/校验变更仍交回主会话协调冻结语义。

## 最小验证结果

TOML 解析通过；字段比较确认只有上述两个字段变化，原“实现主任务明确要求的微信前端工作”起的公共指令后缀完全一致。定向比对9个文件 SHA-256，仅该角色 TOML 变化；其余8个（项目 config、其他三个角色、两份根 AGENTS.md、V0交接与执行记录）未变。没有全仓扫描或 Git 操作，不把这组哈希称为全部应用/历史构建证明。

修改后新建**既有** `wechat_frontend` 探测实例 `/root/frontend_routing_probe_v1`，未覆盖模型或 reasoning，未读取角色 TOML 来冒充加载。实例明确回报其实际 developer 指令已包含 `Cross-project target ownership`，不再只有无条件 Warm Swiss 例外；随后实际只读演示 AGENTS.md。探测没有写文件，也没有设计或实现页面。

| 场景 | 实际结果 | 证据边界 |
|---|---|---|
| A 正式冻结视觉未获重设计授权 | `ROUTE_BACK_TO_MAIN`，不允许前端 Agent 自行修改 | 新实例的路由分类，非真实页面修改 |
| B 假设已批准的演示首页 V1 UX | 由 `wechat_frontend` 承担，Main 集成；权限及授权范围成立时可实现 | 实际读演示 AGENTS.md；仅假设探测，不构成本轮 V1 授权 |
| C 主要照护者改多选数组/改校验 | 交回 Main 协调领域变更，不允许擅改 | 识别为业务语义变更，未改字段 |
| D QA | `qa_reviewer` 的 `sandbox_mode = read-only`、角色与指令文件哈希均未变 | 静态核对，未运行 QA 写入试验或完整 QA |

新探测实例已经加载新规则，故**本轮不需要重启主会话来让后续新建实例读取这次修改**。不推定此前已启动实例会更新；后续委派应创建新的既有 `wechat_frontend` 实例，不沿用 V0 中已拒绝的旧实例。

若在未来新会话复验：从正式工程启动，指明演示目标绝对路径，要求新 `wechat_frontend` 先读演示 AGENTS.md，再对 A/B/C 仅作路由分类且禁止写入；分别期待 Main、前端承接、Main领域协调。D 只读检查 QA 配置，不作写入试验。若未加载新规则，再重新打开该正式工程会话并复验，不修改全局配置。

权限限制：角色路由接受不等于文件系统授权。[官方文档](https://learn.chatgpt.com/docs/agent-configuration/subagents) 说明子 Agent 继承父会话权限，自定义角色中的 sandbox 字段不能建立独立于父会话的只读沙盒。本轮保留 QA 的只读配置/职责，未改变父会话权限，不声称已验证操作系统层强制只读。

## 最终状态

```text
STATUS = PASS_WITH_RISKS
TASK = WECHAT_FRONTEND_CROSS_PROJECT_ROUTING_FIX_V1
CONFIG_SOURCE = C:/Users/16562/WeChatProjects/wuhan-eldercare-match/.codex/config.toml + .codex/agents/wechat_frontend.toml
FRONTEND_AGENT = wechat_frontend (EXISTING_ROLE)
FRONTEND_MODEL = gpt-6.1-sol
FRONTEND_REASONING = high
QA_AGENT = qa_reviewer / READ_ONLY_CONFIG_AND_ROLE_UNCHANGED
ROOT_CAUSE = UNCONDITIONAL_FORMAL_WARM_SWISS_SCOPE_WITHOUT_TARGET_PROJECT_DISPATCH
FILES_MODIFIED = .codex/agents/wechat_frontend.toml (DESCRIPTION_AND_DEVELOPER_INSTRUCTIONS_ONLY)
FILES_CREATED = AGENT_FRONTEND_ROUTING_FIX_HANDOFF.md
ROUTING_RULE_CHANGED = TARGET_PATH_FIRST / FORMAL_MAIN_ONLY / AUTHORIZED_DEMO_FRONTEND / DOMAIN_CHANGE_TO_MAIN
FORMAL_WARM_SWISS_PROTECTED = TRUE
DEMO_UX_RULES_SUPPORTED = TRUE
DEMO_AGENTS_MD_REQUIRED = TRUE
SCENARIO_A_FORMAL = PASS_MINIMAL_AGENT_PROBE / ROUTE_BACK_TO_MAIN
SCENARIO_B_DEMO = PASS_MINIMAL_AGENT_PROBE / ACCEPT_FRONTEND_OWNERSHIP / NO_IMPLEMENTATION
SCENARIO_C_CONTRACT = PASS_MINIMAL_AGENT_PROBE / REFER_DOMAIN_CHANGE_TO_MAIN
SCENARIO_D_QA = PASS_STATIC / NO_QA_PERMISSION_CHANGE
CONFIG_RELOAD_REQUIRED = NO_FOR_NEWLY_SPAWNED_VERIFIED_INSTANCE / OLD_INSTANCES_NOT_ASSUMED_REFRESHED
ROUTING_VERIFICATION_METHOD = TOML_PARSE + FIELD_COMPARISON + SCOPED_HASHES + EXISTING_ROLE_FRESH_SPAWN_DRY_RUN
ROUTING_VERIFICATION_LIMITS = CLASSIFICATION_ONLY / NO_APPLICATION_OR_OS_WRITE_ISOLATION_TEST
APPLICATION_SOURCE_MODIFIED = FALSE
FROZEN_CONTRACT_MODIFIED = FALSE
GIT_WRITES = NONE
DEVTOOLS = NOT_RUN
ANDROID = NOT_RUN
UPLOAD = NOT_PERFORMED
PRODUCTION_RELEASE = FALSE
DOC_IMPACT = AUDIT_ONLY
RISKS = OLD_AGENT_INSTANCES_NOT_VERIFIED_REFRESHED / ROUTING_DOES_NOT_GRANT_DIRECTORY_PERMISSIONS
NEXT_OWNER_ACTION = REVIEW_HANDOFF / EXPLICITLY_AUTHORIZE_V1_SCOPE_BEFORE_IMPLEMENTATION
```

后续 V1 在 Owner 明确批准蓝图与实施范围、目录权限成立后，可以正式委派给新建的既有 `wechat_frontend`。本次只是修复配置与探测路由，未批准或开始 V1。当前规范已经区分两工程职责，本轮无需另改产品或 Frozen 文档。完成后停止，等待 Owner 确认。
