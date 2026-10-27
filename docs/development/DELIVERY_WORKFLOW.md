# 轻量交付：相关验证 → GitHub → Drive 短回执

Owner 已于 2026-10-27 授权日常开发完成后自动 commit/push 与短回执投递；不再要求逐次审批。此流程不负责部署、微信上传/提审/发布。

## 内置插件接入

在唯一主根核实 origin 仓库为 kroblus/wuhan-eldercare-match，读取当前分支及 upstream，不根据文件夹名选 main。保留原有工作树与权限。初次查看 push 会触发的 workflow/部署配置，避免未授权生产发布；以后仅配置变化时重查，不每轮重复审计。

优先使用 Codex 桌面版内置 Google Drive 插件。项目 `.codex/config.toml` 启用插件及对应 connector，设置 `default_tools_enabled=false`，仅放行 `tools.upload_file.enabled=true`。新会话在需要时通过 Sources → Use plugins 选择 Google Drive，再核对实际工具只有上传；不为此断开 ChatGPT 的 Drive 连接。

仅新建短回执至已知 `10_CODEX_INBOX`（ID 见定位文件），禁止搜索、读取、列目录、更新、移动、删除或其他管理操作。工具白名单限制操作种类，目标文件夹仍由调用参数和行为约定限定，不是服务端固定目录权限，也不是系统级隔离。不要获取 Google OAuth token，不通过浏览器/脚本绕过禁读。

如果插件无法接收本地 Markdown 或无法指定目标文件夹，采用“Codex 推送 GitHub、ChatGPT 维护 Drive”：本地保留短回执，由 ChatGPT 对话完成 Drive 整理。不增加上传桥接或其他基础设施。自建 `delivery-receipt` MCP 已禁用，已提交源码仅作备选，不再要求部署 Apps Script。

`.codex/delivery-targets.json` 是本项目的定位数据，不是 Codex 内置配置项，不会自行触发任何同步。该不含凭证的定位文件应进入版本管理；如被现有 .codex 忽略规则屏蔽，只补这个文件的放行。投递回执保留在被忽略的 output/，不为写回 SHA 反复 amend 或制造新提交。

## 每次任务收尾

1. 做与本任务有关的验证，同步确有变化的根进度/阶段索引。纯问答不触发提交。
2. 核对起始修改与本次 diff，排除凭证、output、恢复 ZIP、数据库和无关工作；按目标文件暂存。已暂存的别人工作用于保留，不直接混入此次 commit。
3. 创建一个能理解的提交，推送当前已核实 upstream（或首次确定的同名工作分支）。不自动切 main/新建平行 worktree，不强推。远程有分歧保留本地提交，报告原因，不自动重写历史。
4. 核对远程分支 SHA；若并发出现更新，核对本次 SHA 是否已在其历史中。记录实际结果，不仅凭命令已发出认定成功。
5. 本地生成稳定 receipt_id 的短回执；内置上传通道实际可用时，只上传该回执到指定收件箱。以创建响应的 ID/URL/parents 为证据，不读回内容；响应不含实际父目录时请 Owner 或 ChatGPT 对话核对，不声称落点已确认。通道不可用则留本地 outbox，交 ChatGPT 维护 Drive。

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
内置上传不假定具备 receipt_id 幂等性；UNKNOWN 不自动重传。后续补发前由 Owner/ChatGPT 对话处理重复判断，不承诺后台重试。ChatGPT 在对话中处理 Drive 的读取、去重、精简与归档。

分别记录 GitHub 推送、实际上传、文件落点及新会话工具白名单验证结果。未取得的证据不造 PASS；选用 ChatGPT 维护 Drive 不再以部署接收器作为完成条件。

## 本机接入状态（2026-10-27）

- Git：origin 已核实为本项目私有仓库；当前分支为 `codex/unified-source-baseline`，upstream 为同名 origin 分支。不切 main。现有 workflow 仅源码检查，push 触发限定 main；仓库无 Webhook、Pages 或既有 deployment，未发现本次分支推送的部署副作用。实际推送状态与完整 SHA 记录在本地回执。
- 首次备份按 V4/C1、C2-A（Owner 本轮明确授权单独备份）、V5 三组提交。既有业务验证沿用对应记录，本轮仅核对配置与文档，不声称重跑业务验收。原始 GUI 截图/调用日志 `docs/design/*-evidence/`、output 和恢复包保留本地；历史报告中的本地证据链接不代表 GitHub 已包含这些附件。
- 内置插件已验证：新会话实际只暴露 `upload_file`；一次上传接受本地 Markdown 绝对路径与指定父目录。创建响应确认父目录为 `1d-DE2eNyq78DnbZspC_UpvExUHke1aFR`（10_CODEX_INBOX），未读取 Drive 回验。测试文件 ID：`1K5NXkn7kmQxQQ2dtr0WZpxJoJyu78w6t`；[创建的测试回执](https://drive.google.com/file/d/1K5NXkn7kmQxQQ2dtr0WZpxJoJyu78w6t/view?usp=drivesdk)。本地证据：`output/drive-plugin-check/result.json`。
- 本项目 Drive 插件已恢复，默认关闭所有工具，仅 `upload_file` 放行；模型、微信 MCP、Skills、原权限和 ChatGPT 全局连接保持。新会话已自动加载插件，无需再手动选择；其他会话若未出现，可在 Sources → Use plugins 选择 Google Drive，并重新核对实际白名单。
- 自建 `delivery-receipt` MCP 已禁用，源码保留在 `tools/delivery-receipt/` 作为备选；不再部署 Apps Script，不要求提供投递密钥。新会话的白名单验证不代表本机或 Google 账户具有系统级只写权限；插件指定目录仍是调用约束。
- 本次只做一次新测试回执上传，未补发或删除既有回执。旧回执继续保存在 `output/sync-outbox/`，保留原 ID/时间/commit；UNKNOWN 不自动重传，不创建额外基础设施。日后通道不可用时，直接退回 Codex 推送 GitHub、ChatGPT 维护 Drive。
