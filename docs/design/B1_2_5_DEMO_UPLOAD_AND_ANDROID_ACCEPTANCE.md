# B1.2.5 Demo 上传与 Android 17 验收

2026-10-24。Owner 已授权基于当前 B1.2.4 + B1.2.5 工作区准备并上传新版 Demo 体验版。只进行构建、检查及测试上传，无新功能、Frozen Contract 修改、Git commit/push、正式提审或发布。

## 上传状态

- UPLOAD_SUCCESS = SUCCESS。已查询原任务的最终 success / execution_success；没有重复上传。
- ANDROID_ACCEPTANCE = NOT_RUN_PENDING_OWNER。
- 工作区：`C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`；上传目标仅 `dist/demo`。
- AppID：`wx69f6bd834cebca33`，当前登录账号可管理，后台名称“学习画像”。生产构建不上传。
- 实际上传版本：`1.2.5-demo.1024.1730`；原任务完成时间：2026-10-24 17:32:00.953（北京时间，updatedAt=1792834320953）。回执没有单独服务器提交时间字段，此处明确使用任务完成时间。
- 备注：B1.2.4+B1.2.5 Demo TEST ONLY；档案/历史/预约贯通及三步评价展示修复；21评分+费用判断；仅 Owner Android17 验收，禁止正式发布。
- DevTools 提示上一份提交已选为体验版，本次上传会替换体验版；属于 Owner 本轮授权的新版 Demo 更新。
- 原 MCP upload 任务 `confirmation_upload_de13adb7-ec8b-4f54-97d2-8546e7497a3e` 在 Owner 确认后查询为 success，result.success=true。原始最终回执已保存至 `output/b1-2-5-upload-20261024-1730/upload-task-result.json`。
- 原上传任务成功已确认，但尚未独立取得新版体验版二维码或访问成功证明。Owner 可从微信公众平台“小程序 → 版本管理 → 体验版”查看当前体验版二维码，并核对版本 `1.2.5-demo.1024.1730`；此为访问路径说明，不作为已经扫码访问成功的证据。本次没有重复上传。

## 上传前检查

| 项目 | 结果 |
| --- | --- |
| Demo / Production 双构建 | PASS：TypeScript 4.1.2、Less、原生离线 WXML、生成语法 |
| 连续案例与快照 | PASS：check:b1-2-5-continuity；实体稳定、历史快照、重复加载、评价幂等及正式隔离 |
| 三步评价 | 43 cases PASS：21 评分、费用清楚/不清楚、七费项、护理/交接、标签上限、200 字、只读/重试/防重；含模拟键盘高度事件 |
| 机构地图/VR | 地图/电话交互 16 cases PASS（mocked，无真实调用）；VR revision/provenance/HTTPS/核验与不可用 Gate PASS |
| B1.2.4 / 首页 | 卡片 112 assertions、首页 43 assertions PASS |
| Demo 隔离 | convergence PASS：develop/trial 可用、release/错误身份拒绝、真实 API 不转发；Production 不含 Demo Provider |
| 生成 JS | Demo 210 / Production 214 modules PASS |
| 预算 / diff | 原预算检查、git diff --check PASS；既有 EOL 提示不变 |
| 当前原生运行身份 | mode=DEMO、appId=wx69f6bd834cebca33、envVersion=develop |

TEST ONLY 限制保留：App 前安装身份与 API Gate，真实网络、登录、Storage、拨号、地图和云调用受阻。没有为了真机测试放开权限或允许 release。后台 AppID 名称不改变为产品机构事实。

## 包体积

| 指标 | bytes | 证据性质 |
| --- | ---: | --- |
| Demo runtime | 2,004,717 | 本地 miniprogram 运行文件求和 |
| Production runtime | 1,341,026 | 本地 miniprogram 运行文件求和，不上传 |
| 微信预览编译包 TOTAL | 1,949,172 | 本轮实际 CLI preview 打包返回 size.total；exit 0 |
| 项目原预算 | 2,031,616 | 未提高阈值；预览编译包余 82,444 bytes |
| 最终 upload 返回体积 | 1,949,172 | 原 upload 最终任务 result.info.size.total，packages 仅 TOTAL；与预览结果一致 |

为在 upload 前校验实际编译包，对同一 Demo 执行一次 preview，未 auto-preview 推送手机。其二维码仅是打包校验产物，不作为新版体验版入口。原始 `preview-package-info.json`、预检及 pendingTask 位于本地 `output/b1-2-5-upload-20261024-1730/`。生产源码、包阈值和编译权限未修改。

## Android 17 真机验收清单

全部状态初始均为 NOT_RUN，由 Owner 在新版体验版实际完成后记录设备、Android/微信版本、字体设置、步骤、结果及必要截图。不得只凭上传成功改成 PASS。

| 检查 | 操作及预期 |
| --- | --- |
| 版本与启动 | 从确认后的体验版入口进入，核对实际版本；可见 TEST ONLY / 演示资料标识，进入首页载入案例。无真实登录/授权流程 |
| 老人档案 | “我的→老人档案”区分两位老人，姓名、基本摘要、关联评估入口清楚；无内部 ID，无捏造信息 |
| 评估历史 | 列表清楚显示老人、完成时间、结果及入口；结果按四组展示当次快照；修改当前需求不覆盖历史 |
| 预约 | 区分机构、状态、时间待确认、查看机构；仅显式 completed Visit 提供评价入口，不从日期推导完成 |
| 地图 / VR | 从预约查看对应机构；缺院址/Geo 显示原因且不能导航；VR 显示该机构资料不可用，返回仍是原机构；无城市中心点或通用实景冒充 |
| 三步及 21 评分 | 整体 1–5、考虑意愿；逐项滚动点击全部 21 项数字评分，数字完整可点；费用另为清楚/不清楚，不出现第 22 项数字分 |
| 费用与观察 | 七类费用说明、护理记录、交接及交接内容可操作；保留未确认和互斥行为；最满意/最担心分别最多三项 |
| 200 字及软键盘 | 输入/粘贴到 200 字，计数和上限正确；键盘弹出时输入光标、最后一行可见；收起后 footer 恢复；切前后台输入不丢失 |
| 底部与字号 | 默认及放大字体下滚动到每步最后一行；上/下一步、修改和提交文字完整、无内容遮挡；关注手势安全区与键盘切换 |
| 摘要与修改 | 确认摘要分组完整，逐组修改后返回摘要保持已填内容；退回前一步再进不丢失 |
| 提交与防重 | 连续快速点提交只产生一次评价；成功后返回预约显示查看；再次进入同一评价为只读，无可提交按钮；只模拟案例，不调用真实预约/网络 |
| 返回与重复加载 | 多次返回、再次进入、再次载入同一案例，无重复老人/历史/预约；已保存评价仍对应原 Visit |
| 关闭重开（暖启动） | 关闭小程序再立即打开，微信若保留同一进程/会话则数据保留；记录实际行为，不把关闭界面等同进程销毁 |
| 完全冷启动 | 完全结束微信/小程序进程再打开：Demo 为内存会话，之前新增草稿/评价清除，需重新载入初始案例；原 Fixture 的预置评价仍会随案例恢复。不得期望跨进程持久保存或写真实 Storage |

不通过时记录具体页面和操作；保持安全 Gate，不为完成验收放开真实 API。上传完成后停止自动操作，等待 Owner 回报 Android 17 结果。
