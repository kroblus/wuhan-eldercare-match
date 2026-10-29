# 后台依赖漏洞兼容升级

2026-10-29，接续绿色后台A版交付。后台 npm 审计由8项告警降为0；Router、Zod、Vitest升级至包含修复的版本，Mobile的deepmerge采用可追溯的最小本地补丁。完整构建、69项前端测试和桌面/手机定向GUI复核通过。未部署生产、未修改小程序依赖或业务契约。

## 修改与兼容处理

| 依赖 | 原锁定版本 → 当前版本 | 处理 |
|---|---|---|
| react-router-dom / react-router | 6.30.6 → 7.18.5 | 保留React18、现有Data Router、basename及路由结构，不引入SSR或框架模式。 |
| zod | 3.25.76 → 4.6.7 | record显式声明字符串键；保留旧UUID形状ID接受范围，用guid校验；unknown字段显式optional保留原先“缺失/未知/false”区别；不改写事实或历史版本。 |
| vitest及配套包 | 3.2.7 → 4.1.12 | 使用已修复的4.x版本，移除旧tinypool链；保持现有Vite7、Node24和测试配置，不为消除告警升级到5.x。 |
| deepmerge | 4.3.1 → 本地4.3.1-patch.1 | 上游暂无修复版，保留Mobile5.43.0；对target/source两处属性写入拒绝原型相关键。 |

deepmerge保留MIT许可、原始文件SHA及补丁说明，见[维护说明](../../../admin-web/vendor/deepmerge/README.md)。直接file依赖加`$deepmerge` override，npm ci和实际Mobile消费者解析均已验证；不依赖postinstall脚本，也不修改node_modules来交付。初次file override曾留下错误相对链接，已重新生成相关锁文件条目，并通过完整npm ci消除；不采用中间“零告警”作为通过依据。

**npm audit不审查本地补丁源码。** 本次“0告警”指注册表依赖审计结果；本地补丁另以攻击回归证明target/source、空原型、嵌套对象和数组不能污染返回对象原型。普通深拷贝、数组拼接、符号键、React元素、Date/RegExp、自定义合并与all入口通过兼容测试。当前Mobile仅在表单提示文案合并使用deepmerge，机构JSON不经过此库。上游正式修复后应删除本地依赖/override/补丁目录，并重跑等效测试。

## 本轮验证

| 检查 | 实际结果 |
|---|---|
| npm审计/依赖解析 | 0低、0中、0高、0严重；npm ls正常，Mobile和直接依赖指向同一补丁。[最终审计](../../../output/admin-dependency-upgrade-20261029/audit-final.json)、[依赖树](../../../output/admin-dependency-upgrade-20261029/dependency-tree.txt) |
| 类型与前端测试 | 类型检查通过，69/69通过、0跳过。包含原60项、本地补丁6项、Zod兼容3项；实际本机合成Session/分页/日程/机构草稿/报告快照和同批XLSX仍通过。[测试结果](../../../output/admin-dependency-upgrade-20261029/tests-final.json) |
| 浏览器定向回归 | 桌面1440与手机375五模块；筛选319→105、详情、未保存离开保护与取消保值、报告预览与下载入口、退出重登通过。只生成合成报告快照，没有保存/发布业务资料。[GUI记录](../../../output/admin-dependency-upgrade-20261029/gui-summary.md) |
| 完整Maven构建 | 实际npm ci、typecheck、Vite build和Java21 JAR打包成功，未跳过前端。[日志](../../../output/admin-dependency-upgrade-20261029/maven-build.log) |
| 实际JAR资源与路由 | 21个静态文件哈希匹配、36项真实HTTP通过，业务默认关闭。[结果](../../../output/admin-dependency-upgrade-20261029/jar-smoke.log) |
| 实际JAR认证 | 13项HTTP通过，Cookie Secure/HttpOnly/SameSite/路径正确，业务记录计数未变；不是HTTPS浏览器证据。[结果](../../../output/admin-dependency-upgrade-20261029/jar-auth.log) |
| 补丁打包执行 | 使用当前Vite配置将补丁真实打包，执行恶意target输入后返回对象原型保持正常。[结果](../../../output/admin-dependency-upgrade-20261029/merge-bundle-probe.log) |
| 静态资源约束 | 路由及两端组件保持按需加载，手机CSS预加载通过，Arco仍不存在，小程序TS4.1.2保持。[包体](../../../output/admin-dependency-upgrade-20261029/assets.json) |

升级后工作台闭包JS：桌面1,078,866字节/gzip349,686，手机544,413/gzip182,404；相比上次约增加66KB原始/24KB gzip。CSS与上一轮一致。gzip仅本机计算，桌面大chunk警告仍在；没有为了安全升级另做无关性能重构。

本轮下载入口确认发起下载，实际XLSX内容由live接口测试验证，没有重新核对文件落盘；上一轮用户提供文件的下载闭环仍是历史证据。真机、真实浏览器缩放、虚拟键盘、Safari/WebView和HTTPS浏览器不在本轮已验证范围。无后端业务改动，不重复声称跑过63项后端回归。

## 依据与下一步

版本核对来自本轮官方npm元数据与[React Router变更记录](https://reactrouter.com/changelog)、[Zod4迁移指南](https://zod.dev/v4/changelog)、[Vitest4迁移指南](https://v4.vitest.dev/guide/migration.html)、[deepmerge安全公告](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)。

本机兼容升级已完成，按当前工作分支提交推送；不合并main、不生产部署。后续安排设备/HTTPS验收；deepmerge有上游修复后再替换本地补丁，当前不创建后台监控任务。开始时的.codex配置、小程序样式、PDF归档及旧证据WIP未纳入提交。
