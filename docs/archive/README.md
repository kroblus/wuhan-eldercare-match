# 历史资料导航

日常开发只从 [根 README](../../README.md) 找当前任务。这里用于追溯旧决定、旧版本或早期流程；没有这些问题时，无须读取下表文件。

**“归档”首先表示退出默认阅读范围。** 原文件可以继续留在原路径，避免打断既有链接、脚本和版本依据。报告中的“等待批准”“未实现”“下一步”是当时记录；当前任务按照用户现有授权、当前代码和适用规则推进。

## 旧流程与早期入口

整理前的[主根 README](readme/README_BEFORE_WORKFLOW_V4.md)和[活动根 README](readme/README_ACTIVE_BEFORE_WORKFLOW_V4.md)已单独保留；其中旧进度、验收缺口和绝对路径只描述当时。

| 历史资料 | 为什么不作为日常入口 | 什么时候仍有用 | 当前入口 |
|---|---|---|---|
| [Agent Engineering V2.1](../agent/README_AGENT_ENGINEERING_V2_1.md) | 保存旧分工、先委派及阶段流程，容易触发重复分派和审批。 | 需要解释早期任务为什么采用某种交接流程时。 | [根 AGENTS.md](../../AGENTS.md)。 |
| [旧模型策略](../agent/MODEL_STRATEGIES.md) | 模型名、预算与任务分工可能已更新，不应在多份文档里重复维护。 | 查旧模型配置的来源或迁移理由时。 | [当前模型说明](../../.codex/README.md) 与实际 `.codex/config.toml`。 |
| [V1 入门指南](onboarding/00_START_HERE_V1.md) | 早期启动入口；文件名含 START_HERE 不表示今天仍要从这里开始。 | 查最初约束和项目设定时。 | [根 README](../../README.md)。 |
| [项目初始化提示](bootstrap/PROJECT_BOOTSTRAP_PROMPT_2026-08-26.md) | 用于项目创建时期，不是今天每轮要重复执行的任务。 | 追溯初始化假设时。 | [根 README](../../README.md) 与当前用户任务。 |
| [旧 SOL 首轮提示](bootstrap/SOL_FIRST_PROMPT_2026-08-26.md) | 保存旧启动指令和停点。 | 解释早期模型角色或任务起点时。 | [根 AGENTS.md](../../AGENTS.md)。 |

## 旧主工程与源码材料

2026-10-27 本机已保全并归档以下独有材料。统一恢复目录为 `archive/recovery/2026-10-27-workflow-v4`；[恢复说明](../../archive/recovery/2026-10-27-workflow-v4/README.md)包含快照、清单和 Git 历史。主根既有 output/tmp 证据保持原位。

| 原位置 | 是什么与当前替代入口 | 何时需要 | 恢复位置 |
|---|---|---|---|
| `partner-demo/` 与旧 S1 检查 | 旧单页外壳；现在演示用主根 modes/demo → dist/demo | 追溯 S1 隔离或旧展示决定 | `retired-main-trees/partner-demo`、`retired-main-trees/scripts`；完整旧工作文件亦在 main-working-files.zip |
| `partner-demo-s2/` 与生成器/Fixture | 六份独有模板；不直接合并到当前 Demo | 研究旧演示状态机或复现 S2 | `retired-main-trees/partner-demo-s2` 与 `retired-main-trees/scripts`；所需 Fixture 不声明完整可复现，按原生成器与快照查证 |
| `showcase/vr-map-interactive-v1/` | 旧教学工具、原创全景与生成器；不同于当前 miniprogram/pages/showcase | 复用素材或教学浏览器工具 | `retired-main-trees/showcase/vr-map-interactive-v1`；原相对结构保留 |
| 旧主工程 `server/` | 后端参考；History 为 TEST_ONLY，当前 C2 未正式接通 | 做实际后端/身份/历史任务时才看 | 原位 `server/` 与必要后端桥接/检查；README 已注明历史 TEST_ONLY 状态 |
| 截图中的阶段/验收目录 | 可能是 worktree、独立仓库或复制品；无法从名字确认重复 | 查未迁入的独有代码、素材或证据 | `sibling-inventory.json` 已记录 25 个目录的 Git/修改情况；独有内容待查，未删除 |

实际主根与活动 linked worktree 分属不同仓库。最新活动源码已迁入；旧活动目录因 Windows 拒绝移动，仍保留原路径和 Git 关联。`archive/recovery/` 是一次搬迁的恢复材料，不是新的日常开发目录。收拢步骤见[工作区说明](../current/WORKSPACE.md)。

## 阶段报告和原始证据

| 历史资料 | 为什么按需读取 | 什么时候仍有用 | 先打开哪里 |
|---|---|---|---|
| `docs/design/V2_1_B1*_HANDOFF.md` | 记录 B1 至 B1.2.4 的多轮视觉迭代；早期状态已有后继。 | 查某次颜色、布局、卡片操作的决定与原始验证时。 | [阶段索引：较早视觉阶段](../phases/README.md)。 |
| C1 评审、同步审计、实施计划 | 保留实施之前的推导，部分“未冻结／未实现／未运行测试”已过时。 | 查设计理由或比较计划与实现时。 | [阶段索引](../phases/README.md)，当前结果直接看 [C1-A 实施报告](../design/V1_3_C1_A_IMPLEMENTATION_REPORT.md)。 |
| UI 初次巡检、Batch A／B 与层级报告 | 同一问题存在后续修复，旧缺口不能全部再次列为待办。 | 按 GUI 编号、页面或具体现象排查回归时。 | [阶段索引](../phases/README.md)，选择对应模块一行。 |
| B1.2.5／B1.2.6 Demo 与上传报告 | 当时上传、手机反馈、后续本地代码属于不同时间点。 | 查验具体版本、上传回执或演示连续性时。 | [阶段索引](../phases/README.md)，先看后续版本与反馈。 |
| `docs/design/*-evidence/`、`output/` | 截图、日志和 JSON 用于核对特定结果，数量多，不适合默认全文加载。 | 报告结论存疑、需要复现某次界面或追查错误时。 | 对应阶段总结中的具体证据链接；按需打开文件，不递归读整个目录。 |

阶段报告的明细、中文状态和后继关系只维护在 [阶段索引](../phases/README.md)，本页不重复维护报告明细。

## 旧版本规则：保留适用范围，不按日期作废

| 文件 | 今天如何使用 |
|---|---|
| [旧微信交互契约](../architecture/WECHAT_INTERACTION_CONTRACT.md) | 已有 [V2 后继](../architecture/WECHAT_INTERACTION_CONTRACT_V2.md)。通常修改当前交互读 V2；只有解释旧引用时读旧版。 |
| [Assessment V1](../architecture/ASSESSMENT_CONTRACT.md) | 27 题／21 必填属于旧版本。当前问卷读 [Assessment V2](../architecture/ASSESSMENT_CONTRACT_V2.md) 及实际类型：32 题／26 必填／6 选填；查旧快照或迁移时仍可能需要 V1。 |
| [Recommendation 基础契约](../architecture/RECOMMENDATION_CONTRACT.md)、[V2](../architecture/RECOMMENDATION_CONTRACT_V2.md)、[C1](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md) | 版本之间有继承和独立通道，不能整体认定“文件旧所以无效”。按任务读取适用版本；普通文案或样式改动不用通读所有契约。 |
| [契约索引](../architecture/CONTRACT_INDEX.md) | 修改业务规则时用于确认适用范围；名字含 Contract 不代表已批准，仍需看状态与实际引用。不作为每轮启动必读。 |

## 以后归档时怎么做

默认只更新相应索引中的状态和后继链接，保留原路径与正文。确需搬迁时，在那次搬迁内检查实际反向引用并修正路径；不为所有日常任务增加额外检查。任何文件删除都要以确认无独有成果和用户授权为依据，不能因为它旧、内容长或未跟踪就自动清理。
