# S2 TEST_ONLY 交互演示工程

`STATUS = HISTORICAL_GENERATOR_REFERENCE`

这是旧 S2 TEST_ONLY 生成器模板说明；不改变生产 Contract、领域规则或正式交付状态。当前日常演示产品见 [Classic B 开发约定](../../daqian-showcase-official-preview-v1/AGENTS.md)，本目录不是一份可直接导入的独立微信工程。

六份模板仍被 `scripts/prepare-partner-demo-s2.mjs` 和 S2 business/runtime 检查使用，且未在当前 Classic B 中找到同字节副本。尤其 `templates/business/business-session.ts` 的 requested → contacting → scheduled → completed 状态模拟，与 Classic B 的待联系意向/固定历史带看语义不同；不能在清理时丢弃，也不能直接合并进当前业务。建议 `EXTRACT_UNIQUE_ASSETS_THEN_ARCHIVE`：先保留六份模板及生成器、Fixture、测试/验收引用，再由 Owner 决定整目录归档。

旧 `S2B_STATUS.json` 记录的临时生成工程目前缺少 project.config.json，不把原验收等同于该临时路径今天仍可运行。下方生成/检查/预览步骤仅在明确复现旧 S2 时按需使用，不是当前开发前置条件，不自动运行生成器。

运行 `node scripts/prepare-partner-demo-s2.mjs`，在系统临时目录生成独立工程。脚本输出项目路径；同一份输入的文件内容和配置保持确定。用微信开发者工具打开输出目录的 `project.config.json`，从首页运行。使用现有 AppID 和 TS/Less 插件，所有修改仅发生在生成副本中。

生成入口复用现有 Warm Swiss 页面和必要的运行时依赖。Assessment 只使用独立内存 Draft；加载合成答案和重置只操作当前演示会话。关闭运行环境后数据不保证保留。原工程 Draft 的键、迁移和持久化实现不导入。

机构来源为 S2A 的三份 TEST_ONLY 合成 V1.2.1 记录。原 V2 画像和推荐领域代码逐字复用，生成副本的 application facade 只支持 V2，移除未使用的 V1 composition。默认输入产生 NO_EXACT_MATCH，只有 Alpha 接近匹配卡片；三份候选仍可在机构列表中查看。

预约 client、owner read 和评价 providers 使用共享内存会话。预约表单普通按钮不使用 getPhoneNumber。同一 Visit 仅按 requested → contacting → scheduled → completed 推进模拟状态；只有 completed 提供 TEST_ONLY 评价上下文。重复提交有本地幂等保护，重置使旧会话意向失效。联系人、电话号码和备注不会保存进 Visit。退出、重置不会触及真实草稿。

电话和地图调用由显式拒绝 adapter 替换；FAQ 使用现有批准内容，未配置顾问保持未配置展示。生成时拒绝残留的存储、业务网络、真实登录及上传下载调用，不替换全局 wx。

离线检查：

```powershell
node scripts/check-partner-demo-s2-runtime.mjs
node scripts/check-partner-demo-s2-business.mjs
```

runtime 检查需先生成工程，使用 output 中当前项目绑定。Node、开发者工具模拟器、实际生成 JavaScript 检查和安卓人工验收是不同证据。预览仅属于开发测试；生产发布不在此工程的授权范围。安卓七步流程未经 Owner 明确确认前，不设置 INTERACTIVE_DEMO_READY。

当前实施证据位于 `output/partner-demo-s2b-interactive-implementation/`。预览和自动化仅应针对该目录绑定的生成工程；不要打开原正式项目进行本演示测试。
