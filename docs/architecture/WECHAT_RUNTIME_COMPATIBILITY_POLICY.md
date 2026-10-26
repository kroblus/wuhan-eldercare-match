# 微信小程序 Runtime 兼容政策

本文是模型无关的长期工程政策，适用于所有修改 `miniprogram/**`、生成 JavaScript 检查器或相关
构建配置的任务。它不改变业务 Contract，也不授权扩展产品范围。

微信真机可运行是最终兼容标准。TypeScript、微信开发者工具编译、Simulator 或 MCP 验证都是不同层级的
工程证据，不能单独替代人工真机证据。

公共组件 Action、导航、disabled/loading 与失败反馈的业务交互语义只以
`WECHAT_INTERACTION_CONTRACT_V2.md` 为准；本文不维护第二份交互 Contract。

## 1. Generated JavaScript 风险

TypeScript class property initializer 曾被微信编译链保留为 JavaScript class-field syntax：

```js
class AssessmentDraftStore {
  draft = readInitialDraft();
}

class NavigationGuard {
  lockedActions = new Set();
}
```

不支持该语法的运行环境会在模块加载时失败。历史受影响模块包括：

- `store/assessment-draft.js`
- `utils/navigation-guard.js`

真机调试包曾在 `pages/assessment/history.js` 拒绝可选链 `?.`（`Unexpected token .`）。当前 TS ES2020 和既有编译配置可能保留该语法；不得以 DevTools 可执行或 TS 编译成功替代真机调试包兼容性。小程序源码避免使用 `?.` / `??`，使用保持 null/undefined 语义的显式守卫；不通过修改正式 AppID、编译配置或业务状态绕过。

## 2. Class 编码规则

TypeScript class 中不得使用 property initializer。必须先声明字段，再在 constructor 中赋值：

```ts
class CompatibleStore {
  private items: Set<string>

  constructor() {
    this.items = new Set<string>()
  }
}
```

新增或修改 class 时应同时检查：

1. 源码是否存在 property initializer。
2. arrow-function property 是否依赖词法 `this`；禁止机械改成普通方法。
3. 微信开发者工具最新产物是否仍包含 class fields。

不得为规避生成代码问题而随意改变 `tsconfig`、编译链、公开 API、数据结构或领域类型。

## 3. Generated artifact Gate

当前项目使用 `project.config.json` 中的微信 `typescript` 与 `less` compiler plugins，源码目录不落盘生成 JS。当前可检查的实际产物位于微信开发者工具的项目编译缓存；缓存文件没有 `.js` 扩展名，但内部包含 `define("<module>.js", ...)` 的真实生成代码和 source map。

涉及 class 或生成 JavaScript 兼容性的变更，在 DevTools 完成最新编译后运行：

```text
npm run check:wechat-js-compat
```

检查器必须：

- 只读，不修改任何构建产物。
- 自动定位当前项目的 DevTools 编译缓存；也支持用 `--artifact-dir` 指定解包后的真实产物目录。
- 只分析生成 JavaScript 正文，不扫描 source map 内嵌的 TypeScript 源码。
- 复用仓库或微信开发者工具现有的 TypeScript parser，通过 AST 识别 class fields；
- 同时检查生成正文中的可选链与 nullish coalescing；字符串、注释和 source map 内嵌源码不作为语法命中；
- History 页面及其 view-model/user-loop 必须进入覆盖；可用 `--scope history` 取得明确标识的局部结果，不能代替默认全局 Gate；
- 检查每个含 class 的当前 TypeScript 模块都有对应产物，且产物时间不早于源码。
- FAIL 时打印生成模块、产物文件、行列和附近代码。
- 找不到产物、产物不完整或产物过期时直接 FAIL，不以源码检查冒充产物检查。

只有修改检查器本身时才需要运行其自测：

```text
npm run check:wechat-js-compat:self-test
```

## 4. 产物新鲜度与有效性

- 产物必须来自当前项目和当前源码；旧缓存不能冒充本轮编译。
- 每个受影响的含 class TypeScript 模块都应有对应生成产物。
- 产物时间不得早于相关源码；找不到、过期或不完整时应直接报告缺少有效证据。
- Source map 中内嵌的 TypeScript 不能当作生成 JavaScript 正文。
- 未检查实际生成产物时，不得声称 generated-JS compatibility 已通过。

## 5. 验证工具与证据边界

微信开发者工具、Simulator 和 WeChat DevTools MCP 可以作为编译、页面检查和自动化验证能力使用，但不得在
仓库文档中记录 MCP Token、端口或本机路径。

报告时必须区分：

- TypeScript/source 检查；
- DevTools fresh generated artifact；
- Simulator/MCP 自动化；
- 人工真机验证。

只有实际取得的证据才能报告为通过。历史设备验证记录不能自动证明后续变更仍通过。
