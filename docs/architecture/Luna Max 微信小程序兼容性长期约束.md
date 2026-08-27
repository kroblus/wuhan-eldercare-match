# Luna Max 微信小程序兼容性长期约束

## 1. 约束地位与适用范围

本文是本仓库正式工程约束，适用于主 SOL、`wechat_frontend`、`qa_reviewer` 以及所有修改 `miniprogram/**` 的 Agent。

微信真机可运行是最终兼容标准。TypeScript 编译通过、微信开发者工具模拟器通过，只是必要检查，不能单独证明真机兼容。

本文不改变 Assessment Contract，也不授权扩展 ADL、Cognitive、Preference、Budget、Profile、Recommendation 或 Backend 业务范围。

## 2. 已确认的真机事故

### 2.1 双业务事件通道

`PrimaryButton` 曾同时产生原生 `tap` 冒泡与 `triggerEvent('tap')`。父页面监听同名事件后，一次物理点击会进入两次业务 handler，并连续执行两次 `wx.navigateTo`，形成重复页面栈。

### 2.2 生成 JavaScript 保留 class fields

TypeScript class property initializer 曾被微信编译链保留为 JavaScript class-field syntax：

```js
class AssessmentDraftStore {
  draft = readInitialDraft();
}

class NavigationGuard {
  lockedActions = new Set();
}
```

Android 真机运行时因此报 `SyntaxError: Unexpected token =`。受影响模块为：

- `store/assessment-draft.js`
- `utils/navigation-guard.js`

## 3. Class 编码规则

TypeScript class 中不得使用 property initializer。必须先声明字段，再在 constructor 中赋值：

```ts
class CompatibleStore {
  private items: Set<string>

  constructor() {
    this.items = new Set<string>()
  }
}
```

新增或修改 class 时必须同时检查：

1. 源码是否存在 property initializer。
2. arrow-function property 是否依赖词法 `this`；禁止机械改成普通方法。
3. 微信开发者工具最新产物是否仍包含 class fields。

不得通过随意调整 `tsconfig`、Babel、数据结构、公开 API 或类型策略来规避问题。

## 4. 公共组件事件模型

每次用户操作只能有一个业务 Action 通道。

推荐模式：

```ts
handleAction() {
  if (this.data.disabled || this.data.loading) {
    return
  }

  this.triggerEvent('action', {}, { bubbles: false, composed: false })
}
```

```xml
<primary-button bind:action="handleStart" />
```

规则如下：

- 禁止同时用 native `tap` bubbling 与同名 `triggerEvent('tap')` 执行业务操作。
- 自定义组件外部不得再用 `bindtap` 绑定同一业务 handler。
- 跨组件事件使用明确的 `action`、`next`、`back` 等名称。
- `bubbles` 与 `composed` 必须显式声明；默认优先 `false / false`。
- 多层转发时每层只转发一次，页面最终 handler 只接收一个业务事件。
- 导航 guard 是第二层保险，不能替代事件根因修复，也不能用 debounce 掩盖双通道。

## 5. 自动检查 Gate

当前项目使用 `project.config.json` 中的微信 `typescript` 与 `less` compiler plugins，源码目录不落盘生成 JS。当前可检查的实际产物位于微信开发者工具的项目编译缓存；缓存文件没有 `.js` 扩展名，但内部包含 `define("<module>.js", ...)` 的真实生成代码和 source map。

在 DevTools 完成最新编译后运行：

```text
npm run check:wechat-js-compat
```

检测器：

- 只读，不修改任何构建产物。
- 自动定位当前项目的 DevTools 编译缓存；也支持用 `--artifact-dir` 指定解包后的真实产物目录。
- 只分析生成 JavaScript 正文，不扫描 source map 内嵌的 TypeScript 源码。
- 复用仓库或微信开发者工具现有的 TypeScript parser，通过 AST 识别 class fields；不新增 npm 依赖，也不对全仓源码使用粗暴正则。
- 检查每个含 class 的当前 TypeScript 模块都有对应产物，且产物时间不早于源码。
- FAIL 时打印生成模块、产物文件、行列和附近代码。
- 找不到产物、产物不完整或产物过期时直接 FAIL，不以源码检查冒充产物检查。

检测器自身验证：

```text
npm run check:wechat-js-compat:self-test
```

## 6. QA Gate

涉及 class、公共组件事件或导航的修改，`qa_reviewer` 必须独立确认：

1. Agent Rules 已生效且 Agent TOML 可解析。
2. 自动检查的正向、负向自测有效。
3. 当前 DevTools 产物通过 class-field 检查。
4. `PrimaryButton` 仅发出非冒泡、非 composed 的 `action`。
5. `AssessmentFooter` 的 `next` / `back` 每层只触发一次。
6. navigation guard 使用兼容的 constructor 初始化，并仍可在返回页面后重置。
7. Basic / Health、草稿和首错定位没有回归。
8. 没有修改业务 Contract 或扩展业务范围。

如果实际生成 JavaScript 未被检查，结论最多为 `PASS_WITH_RISKS`。

## 7. Android 17 证据记录

Android 17 real-device retest was manually completed by the project owner.

这是一条项目负责人手工真机复测记录，不是 Codex 自动化测试，也不是 Codex 通过 ADB 完成的验证。
