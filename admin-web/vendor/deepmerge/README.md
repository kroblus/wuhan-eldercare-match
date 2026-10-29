# deepmerge 本地安全补丁

来源：npm `deepmerge@4.3.1` 的 `dist/cjs.js`、`index.d.ts` 与 MIT 许可。
原始 `dist/cjs.js` SHA256：`2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`。

2026-10-29 [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) 尚无上游修复版，Ant Design Mobile 5.43.0 仍依赖该库。保留原实现及签名，仅在复制 target 和 source 的两处写入前拒绝 `__proto__`、`constructor`、`prototype`，包括递归合并。避免只防 source 而让 target 自有属性或空原型对象修改返回对象原型。

通过 package.json 的直接 file 依赖固定补丁，再用 `$deepmerge` override 让 antd-mobile 解析到同一份；完整 npm ci 会使用此目录，无 postinstall 脚本、无手改 node_modules。包名明确是本地补丁，不冒充上游修复版。npm audit 不扫描本地补丁源码；其零告警结果必须与 `src/test/deepmerge-security.test.ts` 的攻击输入和兼容测试一起解释，不能视为上游已修复。

保留对象/数组深拷贝、数组拼接、React元素/Date/RegExp、符号键、自定义合并和all入口。禁止键被丢弃是安全补丁的明确行为改变；当前Mobile仅用来合并表单提示文案，不涉及机构事实/价格JSON。上游正式修复并完成等效测试后，删除直接file依赖、override与本目录，恢复官方依赖。
