# V5 回执通道：Owner 一页安装说明

**代码和本地 Mock 已验证；尚未授权、部署或真实投递。** 不升级工作流、不接入业务 server。接收器只有创建回执能力；这是工具通道边界，不是整台电脑的系统级隔离。

1. **创建云端脚本。** 在 [Google Apps Script](https://script.google.com/home/start) 用拥有收件箱写权限的账号新建独立项目，名称可填“武汉养老 V5 回执”。在编辑器将 [Code.js](apps-script/Code.js) 内容粘入 `Code.gs`；点文件旁 `+ → 脚本` 新建 `Contract.gs`，粘入 [Contract.js](apps-script/Contract.js)。云端文件名后缀为 `.gs`，内容直接复制，不上传本地调用端。
2. **填清单与专用凭证。** 左侧“项目设置”勾选显示 `appsscript.json`，回编辑器用[清单](apps-script/appsscript.json)替换；确认“服务”包含 Drive API v3（如未出现，点服务 `+` 添加）。在“项目设置 → 脚本属性”新增 `RECEIPT_TOKEN`，值为独立生成的 **64 位小写十六进制随机密钥**。不要使用 Google token、密码或其他项目密钥。下方命令由你在本机 PowerShell 手动运行，仅放到剪贴板，不输出正文：

   ```powershell
   $receiptBytes = New-Object byte[] 32
   $receiptRng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $receiptRng.GetBytes($receiptBytes)
   $receiptRng.Dispose()
   (($receiptBytes | ForEach-Object { $_.ToString('x2') }) -join '') | Set-Clipboard
   ```

3. **你授权并部署。** 右上“部署 → 新部署 → Web 应用”：执行身份选“我”，访问权限选“任何人”，授权后复制以 `/exec` 结尾的 URL。外层匿名可达，`doPost` 内强制校验专用凭证；GET 不提供数据。若账号组织策略不允许该方式，停在 `PENDING_SETUP`，不要改成转交 Google OAuth 凭证。固定现有目录需要云端 Drive 授权，清单的 Drive scope 本身较宽；约束由这份只调用 `Files.create` 的代码实施，Google 授权始终留在云端。此步骤是实际部署，须由你操作。
4. **本地保存专用凭证。** 在本项目根运行 `powershell -NoProfile -File tools/delivery-receipt/configure.ps1`，按提示填刚部署的 `/exec` URL，并在隐藏输入框粘贴同一 `RECEIPT_TOKEN`。不要把凭证发进聊天。脚本仅写 `.codex/delivery-receipt.local.json`：密钥由当前 Windows 用户的 DPAPI 加密，文件被 Git 忽略，不发请求。完成后可 `Set-Clipboard -Value ''` 清掉剪贴板。换 Windows 用户/机器须重新配置；这不是操作系统对当前用户的防读隔离。
5. **重载本项目并核对工具。** 项目 `.codex/config.toml` 已登记 `delivery-receipt` MCP，白名单只有 `submit_delivery_receipt`，并按本机插件 ID 禁用通用 Drive connector/plugin；未更改全局连接。重启本项目会话/重新加载 MCP 后，让 Codex核对实际可见工具：有这一个回执工具，**没有通用 Drive 读取/管理工具**。本轮旧会话仍暴露 45 个通用 Drive 工具，新增 MCP 尚未热加载；配置解析通过不等于运行中已隐藏。若重载后仍暴露，继续保持 `PENDING_SETUP`，不要为此断开 ChatGPT 对话的 Drive 连接。
6. **补发原回执。** 上述两项连通条件确认后，使用工具提交原回执，或在本机运行：

   ```powershell
   node tools/delivery-receipt/resend.mjs ac516a92-e859-4729-b6b1-16a4a6b63e2e
   ```

   此入口仅按 UUID 在本地 outbox 选择唯一回执，不接受路径或 URL；保留原时间 `2026-10-27T22:32:08+08:00`、原 SHA `a762b862ed4976761d993cca3502fb35f2774272` 和正文，移除旧本地目录标记后发送。只认 `CREATED / ALREADY_CREATED` 和返回的文件 ID/链接，不读 Drive 回验；你或 ChatGPT 对话核对落点和内容。随后再按各自 ID 补发本轮工具开发回执，不能用新成果替换旧回执。

接收器固定目录为 `1d-DE2eNyq78DnbZspC_UpvExUHke1aFR`。元数据限 UUID v4、北京时间到秒、64 字符任务名、至多 102 字符 `codex/` 分支及完整 SHA/推送状态；四行正文合计至多 300 Unicode 字符（含标签/换行），无额外字段、URL 或文件路径。专用 token 可在两端更换，不改变已有回执 ID。

**不确定结果：** 本地状态留在 `output/sync-outbox/.delivery-state/`，不自动轮询/重试。云端使用 Script Properties 保存摘要和状态、Script Lock 串行化创建；同 ID 不同内容拒绝。创建前持久化 `PENDING`，创建后记录 ID；若创建响应或完成记录丢失，保留 `UNKNOWN`，再次同 ID 提交也不再次创建。仅 HTTP 回包丢失且云端已记成功时，同 ID 手动重试可取回创建回执。不要删除脚本属性、复制成另一个项目或更换 ID 来消除 UNKNOWN；由 Owner 核对后人工处理。属性容量/配额用尽会失败关闭，不自动清理幂等记录。若本地进程崩溃留 `.lock`，确认无调用进程后由 Owner 移除对应锁，再以原 ID 重试；不删除状态文件。

本地验证：`node --test tools/delivery-receipt/check.test.mjs`。测试不使用 Google 连接或真实凭证；涵盖鉴权、非法参数、长度、固定目录、重复/冲突、失败/UNKNOWN、HTTP 重定向、单工具 stdio 和旧回执保真。真实投递须另行记录。

实现依据：[Google Web Apps](https://developers.google.com/apps-script/guides/web)、[Advanced Drive create](https://developers.google.com/apps-script/advanced/drive)、[ContentService 响应重定向](https://developers.google.com/apps-script/guides/content)、[Codex 项目 MCP](https://learn.chatgpt.com/docs/extend/mcp)、[应用启停配置](https://learn.chatgpt.com/docs/config-file/config-reference)。
