# Android 真机与本机 HTTPS 验收

2026-10-29，接续后台依赖兼容升级。**已完成一台 Android 真机的 HTTP 定向交互验收，以及本机实际 JAR 的可信 HTTPS 登录/会话验收。真实浏览器150%缩放仅获用户手动设置确认，受工具策略限制未独立取证；手机HTTPS、手机文件落地与正式域名部署仍未验证。**

## 实际结果

| 范围 | 已取得的证据 |
|---|---|
| Android设备 | MEIZU 20 Pro，Android16，物理屏幕1440×3200，Chrome；通过ADB reverse连接本机5176隔离合成服务。用户手动完成登录，自动输入受手机输入法影响，未把凭证发到聊天。 |
| 真机触摸/键盘 | 实际触摸五模块，需求筛选“已到访”显示9条；机构表单唤起真实虚拟键盘输入测试值，未保存离开提示、返回核对保值、确认丢弃均通过，没有保存/发布机构资料。 |
| 真机报告/横屏/退出 | 生成合成报告预览，同批Excel按钮可用；未点击下载。横屏呈桌面布局，截图未覆盖报告预览区域，不判断跨方向预览是否保留；设备旋转设置已恢复原值。退出显示登录页。 |
| 可信本机TLS | 用户明确批准临时信任仅含localhost/127.0.0.1、两天有效的证书。Windows链验证通过；实际生产JAR监听127.0.0.1:18443，严格验证证书的HTTP检查通过，协商TLS1.3。没有跳过证书验证、没有手机安装证书。 |
| HTTPS浏览器 | 无证书拦截，登录/机构列表可读，刷新保留会话；退出后刷新仍未登录。DOM引用的script/link/img未见HTTP。工具未能读取isSecureContext或完整网络资源，不把它写成全网络混合内容审计。 |
| Secure Cookie/CSRF | 实际HTTPS登录返回Secure、HttpOnly、SameSite=Strict及限定路径Cookie；已登录session读取成功；无CSRF退出403，有CSRF退出成功，旧会话随后401。浏览器会话保持/退出实测与HTTP诊断互补。 |
| 真实150%缩放 | 初次快捷键未改变可测视口/DPR；chrome设置页被工具策略拒绝，未绕过。用户随后手动设置150%并保留菜单，但工具仍禁止替代界面取证。**只记录人工确认，不标记独立缩放GUI通过。** |

[GUI详细记录](../../../output/admin-device-https-20261029/gui-summary.md)、[缩放限制](../../../output/admin-device-https-20261029/zoom-observation.md)、[HTTPS检查](../../../output/admin-device-https-20261029/https-http-checks.json)。截图及凭证只在忽略的output内；不提交设备序列号、账户信息或私钥。

代表性真机截图：[触摸筛选](../../../output/admin-device-https-20261029/phone-filter-result.png)、[虚拟键盘](../../../output/admin-device-https-20261029/phone-editor-keyboard.png)、[未保存保护](../../../output/admin-device-https-20261029/phone-unsaved.png)、[横屏](../../../output/admin-device-https-20261029/phone-landscape.png)。

## 发现与修复

本机实际JAR保留production认证配置，使用隔离可丢弃数据库，关闭P1 intake、正式身份与历史写入，仅临时启用机构维护使现有管理员登录可用。需求/日程等因此按既有边界返回503，这是业务开关的预期行为，不能作为HTTPS失败或改为开放真实服务。

但前端把此类**只读503**也提示成“写入结果尚未确认”，容易让人误以为刚发生写操作。现已区分GET/HEAD与写请求：读取失败提示“服务暂不可用，请稍后刷新。”；写请求仍保留不确定结果警告。新增两项边界回归，未放宽认证、CSRF或幂等。

新增[本机HTTPS诊断启动器](../../../server/tools/serve-admin-https-local.mjs)，复用实际JAR，强制回环地址/固定18443、显式可丢弃MySQL及output内私密证书配置；随机诊断密码只写runtime.private.json。端口占用时拒绝启动且不覆盖原凭证。该脚本不导入证书信任，证书准备和系统信任变更须单独获得授权，不是生产部署入口。

## 最终验证与清理

- 前端71/71、0跳过，含本轮读取/写入错误提示回归及实际合成服务契约。[结果](../../../output/admin-device-https-20261029/frontend-tests.json)
- Java21完整Maven执行npm ci、typecheck、Vite build并打包成功；最终JAR21个静态文件哈希及36项真实HTTP检查通过。[构建](../../../output/admin-device-https-20261029/maven-final.log)、[资源/路由](../../../output/admin-device-https-20261029/jar-smoke.log)
- 最终产物严格证书验证的8项HTTPS诊断通过；移动CSS预加载/分包/无Arco约束通过。[包体](../../../output/admin-device-https-20261029/assets-final.json)
- 最终修复版经HTTPS浏览器复核，工作台/需求只读503提示已正确；机构列表、刷新保会话、退出后刷新未登录再次通过。
- 已检查启动器语法、正常启动和端口占用拒绝；不重新宣称跑过历史63项后端回归。
- 临时HTTPS诊断已关闭，当前用户的本次证书信任已移除，真机ADB的本次5176映射已撤销；其他信任项未改，手机未安装证书。[清理记录](../../../output/admin-device-https-20261029/tls/cleanup.json)。未清空用户浏览器数据。

下一步是可独立取证的真实浏览器缩放、手机HTTPS与文件下载，以及正式域名/部署环境验收。本轮不部署生产、不合并main；原有小程序、配置和归档WIP保留。
