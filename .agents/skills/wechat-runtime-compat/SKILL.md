---
name: wechat-runtime-compat
description: Use for Mini Program class syntax, wx.* calls, generated-JS compatibility, or shared component event propagation.
---

# WeChat runtime compatibility

Read `docs/architecture/Luna Max 微信小程序兼容性长期约束.md` only for the affected surface.

Keep the current TS/Less toolchain. Do not introduce class property initializers under `miniprogram/**`; preserve lexical `this`. Shared business actions must have one event path. When `wx.*` calls/parameters change, verify current project typings/API constraints and visible failure/state release for user-visible paths.

Verification: fresh DevTools artifact + `npm run check:wechat-js-compat` for generated-JS/class changes; self-test only when checker changes; targeted TS compatibility when relevant; affected interaction runtime for shared-event changes. Never claim DevTools/Android evidence that was not actually obtained.
