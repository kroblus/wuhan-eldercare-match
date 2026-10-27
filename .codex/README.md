> 本机合入记录（2026-10-27）：已合并项目主模型 Sol 6.1 medium、通用子模型 Sol medium、并发上限 2 与六个独立角色 TOML；原 MCP 启动器、权限及三个 Skill 未变。CLI 0.164.0-alpha.11.1 的 strict startup 配置校验通过；实际模型目录列出 Sol 6.1、Terra 6.1、Luna。用户级 service_tier=default，项目未覆盖；不能据此声称当前会话已切换模型/速度。当前会话已有四角色的模型设置已刷新，新 computer_operator/repo_explorer 未出现在本轮角色工具列表，需新会话确认。未调用 Terra 执行任务。微信 CLI 已完成两个主根产物的开窗/截图；既有 MCP 配置保持，未声称本轮重连验证 MCP。

# Codex 配置：Pro 200 美元的个人开发用法

核对日期：2026-10-27。这里给项目默认值；实际可用模型、推理等级、登录方式和剩余额度以你的客户端为准。

## 模型怎么选

| 工作 | 模型 / 推理 | 为什么这样配 |
| --- | --- | --- |
| 日常实现、普通 Bug、页面集成 | `gpt-6.1-sol` / `medium` | 默认主力，兼顾实现质量和等待时间 |
| 复杂推荐、身份、正式历史、跨模块问题 | `gpt-6.1-sol` / `high` | 对业务边界多做推理；不因文件多就自动开 Max |
| 多轮仍未解决的问题、关键方案取舍 | `gpt-6-astra` / `high` | 把更强模型用在真正费判断的地方；结果明确后可切回 Sol |
| 文件定位、调用关系、资料摘取、清晰的小改 | `gpt-6-luna` / `medium`，极简单任务可 low | 专用检索角色用它；不让它默认承担复杂推荐或持久化实现 |
| 微信开发者工具/浏览器/桌面界面操作、复现、截图与视觉复核 | `gpt-6.1-terra` / `medium` | 专用 `computer_operator`，按用户当前偏好默认承接实际 GUI 任务；复杂视觉问题再考虑 high |

Pro 月费不是等额 API 充值。通过 ChatGPT 登录 Codex 使用订阅用量；改为 API Key 是另一套计费。当前官方说明 Pro 无五小时限制，但仍可能有周限制；用量看 `/status` 或产品用量页，不按固定“能做多少次任务”估算。

本配置不启用 Fast。首次打开检查是否是 Standard：用户级配置若已经启用 Fast，项目省略 `service_tier` 不会覆盖它，需要在界面切回或用 `/fast` 切换。官方当前说明 Fast 消耗订阅用量为 Standard 的 2.5 倍；Pro 200 不包含 Ultrafast。Ultra 推理与 Ultrafast 速度档是不同设置，日常均不必用。

## 日常切换

在客户端模型菜单或 CLI `/model` 选择模型及推理。另开 CLI 会话可直接指定：

```powershell
codex -m gpt-6.1-sol -c model_reasoning_effort=medium
codex -m gpt-6.1-sol -c model_reasoning_effort=high
codex -m gpt-6-astra -c model_reasoning_effort=high
codex -m gpt-6-luna -c model_reasoning_effort=medium
codex -m gpt-6.1-terra -c model_reasoning_effort=medium
```

这些是替代选择，不要五个一起开。若模型不可用，使用客户端实际列出的模型；不要猜 `gpt-6.1-luna` 等未核实名称。

## 这几个文件各管什么

| 文件 | 作用 |
| --- | --- |
| 根 `AGENTS.md` | 项目协作规则：直接实现、按影响验证、中文交付 |
| `.codex/config.toml` | 主模型、默认子模型、并发上限及沿用的 MCP 入口 |
| `.codex/agents/wechat_frontend.toml` | Sol Medium，按需处理页面 |
| `.codex/agents/matching_engine.toml` | Sol High，按需处理推荐与评估规则 |
| `.codex/agents/backend_domain.toml` | Sol High，仅有实际后端范围时使用 |
| `.codex/agents/qa_reviewer.toml` | Sol High，仅复杂或高风险改动需要独立检查时使用 |
| `.codex/agents/repo_explorer.toml` | 新增 Luna Medium，限定范围查文件和证据 |
| `.codex/agents/computer_operator.toml` | Terra Medium，界面操作与视觉复核；同一实例一个操作者 |
| `.codex/wechatide-mcp.ps1` | 原有微信 MCP 启动方式；从环境变量读取 Token |

默认主会话自己完成工作。这些角色可供选择，不组成六步流水线。并发上限 2 指两个子代理，不含主会话。

角色文件显式配置模型/推理；按当前官方规则，这些值会覆盖父会话与默认选择。若真要让某个固定角色改用 Astra，需要更改其模型设置或改由已切到 Astra 的主会话处理；不能假定主会话升级后所有固定角色也会升级。未指定角色的子代理也会继续使用这里配置的默认 Sol，而非自动继承 Astra。

角色中的“只读”是工作职责，不是独立沙盒。当前自定义 Agent 继承父会话权限；把 `sandbox_mode = "read-only"` 写进角色文件不能覆盖父会话。这里去掉了这些容易误解的字段，保留清楚的只读指令。

## Terra 如何派工

官方名称为 GPT-6.1 Terra，模型 ID 为 `gpt-6.1-terra`，文件后缀为 `.toml`。官方要求 Codex CLI **0.159.0 或更新版本**；先在本机模型菜单核对可用性，未提供该模型时不能靠写文件解锁。图形客户端也以实际模型列表为准。

配置文件声明角色及模型；根 AGENTS 的分工规则使主会话遇到 GUI 任务时默认选择它。这是可理解的任务路由，不是 TOML 层自动拦截所有工具调用。现成命令行构建、测试或 API 操作继续直接使用。

Terra 继承父会话实际开放的工具、MCP、权限与登录状态；角色文件本身不会安装电脑操控插件，也不能把浏览器工具变成整个 Windows 桌面控制。已有微信 MCP 能提供哪些操作，以本机实际返回的工具为准。同一窗口/浏览器会话/开发者工具实例仅由一位 Agent 操作，主会话可并行读代码。

例如：主会话实现按钮修复 → computer_operator 在实际 Demo 工程复现并截图 → 主会话汇总结果。小改不自动扩成全项目巡检；截图和日志放 `output/<任务名>/`。本包没有声称已在用户本机加载 Terra 或执行电脑自动化。

## 生效与本机合并

1. 本项目配置放在当前开发目录内，不能仅放在兄弟主目录。第二个源码包明确排除了 Agent 配置；请先看本机已有内容再合并。
2. 若已有 `.codex/config.toml`，合并模型与 agents 默认值；保留其他 MCP、provider、权限、路径和本地设置。同名微信 MCP 优先保留已验证可用的本机参数，不盲目整文件替换。
3. 项目配置只在可信项目中读取；信任由本机客户端决定。不要在仓库内伪造信任条目或绕过系统权限。已有 `AGENTS.override.md` 或更近目录的 AGENTS 可能覆盖根规则，需要按实际入口检查。
4. 配置大体优先级：CLI 显式值 > 项目配置 > 指定个人 profile > 用户配置 > 默认值。因此“切个人 profile”不一定覆盖项目里的模型；本项目优先用 `/model` 或 `-m/-c`。
5. 官方 Codex 0.134.0 起个人 profile 使用 `~/.codex/<名称>.config.toml` 独立文件，旧 `[profiles.<名称>]` 与顶层 `profile=` 不再受支持。本包没有为了凑数量再加多套 profile。
6. 改好后打开一个新会话核对实际模型与说明，必要时问 Codex“当前读到了哪些项目指令、模型和角色？”。未在本机实际观察之前，只能说静态配置完成。

主目录旧 `config.sol.example.toml`、`config.astra-pilot.example.toml` 只是示例；它们不会因为文件存在就自动成为默认配置，也不应覆盖带 MCP 的实际配置。

## Skills 怎么处理

现有 `wechat-interaction`、`wechat-runtime-compat`、`recommendation-v2` 三个 Skill 合计约 4.7KB，已经很小。保留、按相关任务使用即可，本包没有新增 Skill 或安装到个人技能列表。

仓库级路径为 `.agents/skills/<名称>/SKILL.md`；第二包没包含它们，不能据此断言本机缺失。若本机存在，原内容保留。若不存在，AGENTS 和[任务地图](../docs/current/TASK_MAP.md)已经提供相应规则入口，可继续工作；需要复用时再从你现有主目录恢复这三个项目技能。

交互 Skill 中的旧 B01 Closeout 是历史取证入口；一般任务不应被其缺失卡住。新的 C1 规则直接由任务地图和 matching_engine 路由，不需要再建立“C1 规划 Skill、审批 Skill、报告 Skill”。

## 上下文与配置保存

`README.md` 是唯一日常资料入口，`AGENTS.md` 明确要求先读取其短进度和导航，再按任务选择资料。阶段与历史索引按需打开，Markdown 链接不会因你读了入口就自动把所有目标正文一起读进来。Codex 仍会有系统/用户指令、适用 AGENTS、对话和工具上下文，因此不能承诺字面上只有一个 README。已经进入旧会话的内容也不会因文件归档自动消失。不要把长 README 加入自动指令 fallback，也不靠未获官方确认的 `.codexignore` 机制宣称隔离上下文。`.gitignore` 影响 Git 与部分搜索行为，不是 AI 阅读权限墙。

本包对 `.gitignore` 只开放不含凭证的项目配置、角色、说明与启动脚本；其他 `.codex` 本机状态仍忽略。这让下次源码导出有机会包含协作配置。若导出脚本仍显式排除 Agent 配置，还需调整该导出脚本；本次没有提供脚本，未声称已修复。

不需要 hooks、`requirements.toml`、企业审批策略文件、自动全量 QA 或定时扫描来完成本次优化。

## 官方依据

- [模型与推理等级](https://learn.chatgpt.com/docs/models)
- [Pro、用量与 API 计费](https://learn.chatgpt.com/docs/pricing)
- [Fast / Ultrafast](https://learn.chatgpt.com/docs/agent-configuration/speed)
- [配置优先级与项目可信状态](https://learn.chatgpt.com/docs/config-file/config-basic)
- [Profiles 与 CLI 覆盖](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [配置字段](https://learn.chatgpt.com/docs/config-file/config-reference)
- [自定义 Agent 与权限继承](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [AGENTS 发现规则](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Skills](https://learn.chatgpt.com/docs/build-skills)
