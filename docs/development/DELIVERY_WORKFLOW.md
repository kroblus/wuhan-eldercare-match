# 轻量交付：相关验证 → GitHub → Drive 短回执

Owner 已于 2026-10-27 授权日常开发完成后自动 commit/push 与短回执投递；不再要求逐次审批。此流程不负责部署、微信上传/提审/发布。

## 一次性安装

在唯一主根核实 origin 仓库为 kroblus/wuhan-eldercare-match，读取当前分支及 upstream，不根据文件夹名选 main。保留原有工作树与权限。初次查看 push 会触发的 workflow/部署配置，避免未授权生产发布；以后仅配置变化时重查，不每轮重复审计。

确认现有可用 Drive 工具。必须让 Codex 仅能调用“新建本项目短回执”；服务端固定收件箱，不接受任意文件 ID、目录、读取或更新请求。优先复用已有受限工具；不默认增加 Agent、hooks、队列服务或 GitHub Actions。

若现有 MCP 能筛选工具，按真实服务名/工具名使用 enabled_tools 白名单，但白名单本身不限制任意 folder_id，需受限封装或服务端限制。若只有完整 Google Drive 插件，写入 MD 禁读只是行为约束，不能标记硬权限已完成。不要把泛用 Google OAuth token 放在 Codex 可直接读取的环境后宣称只能写。

缺少受限通道时，先启用 GitHub 自动交付和本地短回执；将 DRIVE_WRITE_ONLY 标记 PENDING_SETUP，明确所缺的授权/接入，不偷偷读取 Drive。ChatGPT 的连接不因这条规则失去管理能力。

`.codex/delivery-targets.json` 是本项目的定位数据，不是 Codex 内置配置项，不会自行触发任何同步。该不含凭证的定位文件应进入版本管理；如被现有 .codex 忽略规则屏蔽，只补这个文件的放行。投递回执保留在被忽略的 output/，不为写回 SHA 反复 amend 或制造新提交。

## 每次任务收尾

1. 做与本任务有关的验证，同步确有变化的根进度/阶段索引。纯问答不触发提交。
2. 核对起始修改与本次 diff，排除凭证、output、恢复 ZIP、数据库和无关工作；按目标文件暂存。已暂存的别人工作用于保留，不直接混入此次 commit。
3. 创建一个能理解的提交，推送当前已核实 upstream（或首次确定的同名工作分支）。不自动切 main/新建平行 worktree，不强推。远程有分歧保留本地提交，报告原因，不自动重写历史。
4. 核对远程分支 SHA；若并发出现更新，核对本次 SHA 是否已在其历史中。记录实际结果，不仅凭命令已发出认定成功。
5. 本地生成稳定 receipt_id 的短回执，经只写工具提交至固定收件箱。写入返回 ID/URL 作为投递凭证，不读回内容。

正常完成不用等待手机验收才允许备份已实现代码；回执如实写“自动化通过，手机待验收”。测试失败的任务不伪报完成：可保存明确标注 WIP 的工作到非发布分支；不将坏状态悄悄推入发布分支。

## 回执格式

文件名：`YYYYMMDD-HHmmss-task-shortsha-receiptid.md`（北京时间，任务名短且可读）。

```text
receipt_id: <一次任务固定ID，重试不改变>
time: <ISO8601，含+08:00>
task: <任务名>
branch: <实际分支>
commit: <完整SHA或NO_CODE_CHANGE>
push: VERIFIED / FAILED / NOT_NEEDED

完成：<用户能理解的变化>
验证：<实际执行结果；未做的分开说>
遗留：<没有则写无；不要复述所有历史问题>
下一步：<一句话>
```

正文四行总长不超过300中文字符；链接、SHA等元数据不算叙述字数。仅写本次增量，不写完整日志或复制阶段报告。

## 失败只影响同步，不推倒已完成开发

Git 失败：保留提交及本地回执，明确未推送；不伪造远程链接。Drive 失败：Git 成功保持有效，留本地 outbox 和已知投递状态。超时结果不明时用稳定 receipt_id，服务端支持幂等则重放；否则报告 UNKNOWN，不读取 Drive 去重，也不盲目重复投递。
后续当前会话或下一次交付可补发本地待办，不承诺后台重试。ChatGPT 在对话中处理 Drive 的读取、去重、精简与归档。

验收只需要一次：GitHub 实际可见提交、短回执实际写入指定收件箱、Codex 无 Drive 读取工具/替代读取路径的受限配置已核对。没有做到哪项就标明，不造 PASS。

## 本机接入状态（2026-10-27）

- Git：origin 已核实为本项目私有仓库；当前分支为 `codex/unified-source-baseline`，upstream 为同名 origin 分支。不切 main。现有 workflow 仅源码检查，push 触发限定 main；仓库无 Webhook、Pages 或既有 deployment，未发现本次分支推送的部署副作用。实际推送状态与完整 SHA 记录在本地回执。
- 首次备份按 V4/C1、C2-A（Owner 本轮明确授权单独备份）、V5 三组提交。既有业务验证沿用对应记录，本轮仅核对配置与文档，不声称重跑业务验收。原始 GUI 截图/调用日志 `docs/design/*-evidence/`、output 和恢复包保留本地；历史报告中的本地证据链接不代表 GitHub 已包含这些附件。
- `DRIVE_WRITE_ONLY=PENDING_SETUP`：项目 MCP 只有微信服务，用户 MCP 为 node_repl；当前 Drive 为通用插件，没有只接收短回执、服务端固定收件箱的受限工具。未修改模型/TOML、MCP、Skills 或权限，也未调用 Drive 读取/写入工具。
- Drive 禁读目前只是行为约束，不是工具级只写权限。所缺的是受限回执工具及其接入：服务端固定 `.codex/delivery-targets.json` 中的收件箱，只允许 create，最好按 receipt_id 幂等；Codex 端仅开放该实际工具，禁止替代读取路径。通用插件的读取/管理能力尚未被工具级移除，不能宣称只写接入完成。
- 回执保存在 `output/sync-outbox/`；在受限通道接好前不使用通用插件代投，不启动后台任务。该 JSON 是定位与状态数据，AGENTS 是任务收尾约定，二者不会自行执行推送。
