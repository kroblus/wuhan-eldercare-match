# Partner Demo S1 Isolation Shell V0.1

`STATUS = HISTORICAL_IMPLEMENTATION_REFERENCE` — 仅描述已实现的 S1 演示外壳边界；不是产品或 Frozen Contract。此目录及其构建身份只能用于开发合成数据演示，不能用于正式发布。

## 当前适用范围（2026-10-22）

此为旧 S1 空白隔离外壳，未提供当前 Classic B 之外的业务功能；建议 `RETIRE_AND_ARCHIVE`，尚未执行退役或搬迁。当前演示产品见 [Classic B 开发约定](../../daqian-showcase-official-preview-v1/AGENTS.md)。下方“本阶段/未来S2/下一阶段审批”仅描述原 S1 任务，不是当前个人开发流程。

本目录仍被 `scripts/check-partner-demo-s1.mjs`、`scripts/check-partner-demo-worktree.mjs` 和 `scripts/support/partner-demo-isolation-check.mjs` 按固定路径引用，直接搬迁会使旧检查失效。旧证据在 `output/partner-demo-s1-isolation-shell-v0-1/`；当前业务包不依赖本目录。整目录操作须由 Owner 确认，并保留恢复旧路径的方式。

## 独立入口与构建

- 独立工程配置：`partner-demo/project.config.json`，保留正式配置的现有 AppID。
- 独立源码根：`partner-demo/miniprogram/`；正式源码根仍为仓库根配置的 `miniprogram/`。没有复制、修改或重定向正式页面、Draft 或 Provider。
- 唯一注册页：`pages/demo/index`。固定展示「开发演示｜全部为合成数据｜非真实机构或预约」。只有销毁内存会话的退出按钮。
- 本外壳使用原生 App/Page、CommonJS ES5 源码、WXML/WXSS，不需要复用正式业务组件。独立工程不启用 TS/Less 插件；正式工程的 TS/Less 配置保持原样。
- `build-profile.json` 与源码根内 `runtime/build-identity.json` 必须一致，且具有固定 `buildId / kind / scope / provenance`。未提供、损坏或不匹配身份时，不建立会话。普通 `DEMO_MODE` 无效。
- 身份只是本工程的显式标记，不是密码、签名或完整隔离机制。隔离还依赖独立构建根、闭合依赖图、无平台能力的组合、拒绝型 Adapter 与离线负向测试。
- 不注册生产 Tab、分包、插件、认证、远程资源、导航目的地或授权控件。任何路由请求均拒绝；入口 query 非空时拒绝。
- 本阶段没有运行微信工具链，也没有验证实际微信包内容。该配置是待后续工具链验证的独立工程配置，不能据此宣称实际包隔离已通过。

## 依赖与会话

`app.js / pages/demo/index.js → runtime/host.js → identity.js + shell.js → dependencies.js`

导入只读取演示源码中的身份 JSON；不读取平台存储，不导入生产模块，也不在导入时建立会话。App launch / Page load 在身份与入口检查通过后建立一个内存会话；重复启动同一个活动会话不会替换它。

`createDemoSession(identity)` 只组合以下演示接口，拒绝接受任何生产 Adapter：

| 接口 | S1 行为 |
| --- | --- |
| `memory.read(key) / write(key, envelope)` | 仅闭包内存；写入必须标记 `provenance=development-synthetic`；读写脱离调用方对象引用 |
| `institutionSource.list()` | 返回显式开发 provenance 和空机构数组；不填充养老业务 Fixture |
| `businessActions.perform(action, payload)` | 所有操作默认返回 `S1_BUSINESS_ACTION_NOT_IMPLEMENTED`，不读取 payload，不执行回调 |
| `externalActions.perform(action, payload)` | 所有已知与未知操作返回 `EXTERNAL_ACTION_DENIED`，没有 `wx` 或客户端依赖 |
| `isAlive() / destroy()` | 销毁替换内部内存并撤销旧 handle；重复销毁安全；不调用 Draft clear/reset/migration |

Shell 不向页面暴露状态存取能力或生产 Adapter。退出、App hide、Page unload 都只销毁会话。App error / page-not-found 关闭会话，不回退或跳转到生产页面。隐藏后重新显示不会恢复内存；新的合法 Page load 可以建立全新的空会话。

## 离线检查

从仓库根目录执行，无需安装依赖、网络或微信工具链：

```text
node scripts/check-partner-demo-s1.mjs
```

该脚本用 Node VM 加载真实演示 App/Page handler；所有模拟 `wx` 属性访问都会记录并抛错，受保护 Draft key 只有合成哨兵。测试不导入生产 Draft 模块、不读取实际用户存储。静态检查只读取源码、工程配置以及相关 private override，不读取 DevTools 缓存。

静态检查覆盖：根目录分离、相同 AppID、身份对应、闭合文件白名单、相对且不越界的 CommonJS 依赖、无 `wx`/网络/动态模块加载、无原生外部动作/远程资源、生产源码没有演示引用或强制带包配置。它是针对当前闭合 S1 源码的保守检查，不是任意 JavaScript 的安全沙箱。新增能力、语法、组件、文件、private 配置或构建钩子必须重新检查；不得机械放宽白名单来通过 Gate。

证据输出：`output/partner-demo-s1-isolation-shell-v0-1/offline-test-results.json`。Node 模拟通过只代表离线证据，不代表微信原生运行、打包、Simulator、ADB 或人工安卓验证通过。

## S2 的最小接入面与审批

未来 F01/F02 可以在本独立根内使用会话 memory、明确开发 provenance 的合成机构来源，以及独立的纯内存业务动作 Adapter。需要先明确批准场景范围、合成 Fixture 字段、展示与路由，以及纯领域函数的版本和允许复用清单；复用函数必须保持无 Draft/认证/网络导入。不能为了复用页面把生产 Provider 注入当前组合。

Owner 下一阶段必须分别明确批准：S2 F01/F02 实现；微信工具链工程导入与实际构建/包内容验证（含 private override、AppID 与运行身份）；平台预览所需通信；安卓微信现场验收。预览上传、部署、发布需要各自额外授权。当前没有 F01/F02/F03 页面、数据 Fixture 或场景按钮。

后续实际构建必须复查生产包不含演示入口/合成 Fixture，演示包不含生产页面/数据客户端/Draft/认证模块，且实际缓存/产物中的身份与此独立配置一致。还需验证当前工具链对独立工程根、CommonJS、生命周期、WXML/WXSS 与安卓微信的实际行为。本阶段不检查、不运行这些操作。
