# P1-1：接住咨询与带看意向

2026-10-28。按 [P1 R1](../../product/p1/IMPLEMENTATION_P1.md)实现；整体下一步只在[根 README](../../../README.md)维护。未升级 V5，未修改 C1/C2 冻结领域，不部署或上传微信。

## 已能做什么

- 首页进入独立公示与服务意向页。柠月双人间五档月费为 3600/4200/5100/6300/7200；床位、护理、伙食分开，首次医疗备用金5000与床品900另列，不自动判定护理档。医养结合/术后康养/短期托养只作展示方向；地址和具体接收条件仍待核对。
- 用户主动申请普通咨询或带看，填写必要联系人、关系、服务场景、目标机构、意向窗口、人数和选填出行协助；独立 `p1-service-request-v1`，不读取或补造旧问卷。咨询待联系、带看待安排，没有确认时段。
- 本人通过 C5 会话查询、取消；服务端验证所有权。请求 ID 幂等，同 ID 改内容拒绝，并发不重复写入。取消/提交事件在同一事务内记录；没有虚构已联系、已预约或已到访事件。
- `/p1-admin/` 是同源网页后台，单管理员独立密码会话、HttpOnly/SameSite Cookie 与退出 CSRF；普通用户 token 不能获得全库。需求按状态、类型、机构、北京时间日期筛选，查看必要联系资料和实际事件。无 SQL 或 Google 凭据进入网页。
- 小程序网络失败保留原申请编号/正文，双击合并；卸载后的旧结果不覆盖页面。联系人不写 Storage 或日志。Demo 不发出 P1 服务请求；合成环境明确标记、服务端确定来源和模式。

## 本机试用

后台合成地址：`http://127.0.0.1:18341/p1-admin/`。仅限本机，不能从朋友手机或外网访问。此次合成管理员账号与临时密码只在主根 `output/p1-1/runtime.private.json`；Owner 在本机查看后输入，不把文件、密码或截图传到聊天/GitHub/Drive。

朋友可坐在这台电脑前：登录 → 看明确标记“合成测试”的普通咨询/待安排需求 → 打开详情 → 按状态、类型或日期筛选 → 检查空态 → 清除筛选刷新 → 退出。这是工作步骤试用，不能当成真实客户待办。当前没有跟进编辑、负责人分配或确认排期；这些属于 P1-2。

需重启时，用 Java 21+，从主根执行 `server/tools/start-p1-synthetic.ps1 -DatabaseSettings output/p1-1/mysql.private.json -JavaExecutable <本机Java21路径>`。脚本只接受 output 下、非3306 loopback、专用 disposable P1 schema；不自动部署，不打印密码。运行凭据每次启动重新生成。原隔离 MySQL 进程必须仍可用；私有配置/数据库不进入仓库。

## 实际验证

- `npm run check:p1`：五档加总/语义、输入与告知、响应 ID/模式校验、Demo 零网络、C5 过期恢复、原 ID 重试、双击、失败与卸载后异步保护通过。
- `node scripts/check-p1-http.mjs --synthetic-runtime output/p1-1/runtime.private.json`：实际复用客户端 → 合成 C5 HTTP → 隔离 MySQL → 管理员详情 → 本人隔离 → 取消/事件幂等 → 退出通过。真实微信登录 Provider 未验证。
- Java P1 边界6项、真实MySQL16项与 C5复用16项，共38项通过、0跳过；证据 `output/p1-1/backend-test-summary.json`。MySQL 为真实 8.0 隔离实例，非 Mock，未触碰正式3306。实际生产 jar 在临时18342端口以默认配置启动，确认真实写入关闭、告知为空、后台静态页可访问、提交返回503；验证后仅停止该临时进程。
- Production/Demo 构建通过 TypeScript4.1.2、Less、原生WXML及生成JS检查；31路由。模式隔离、首页防重导航10/10、机构列表详情231/231通过。为完成构建修复旧脚本仍匹配 `cloneValue` 的失效模式注入；目录测试仅补放行既有无副作用的验证适配文件，未修改旧推荐算法。
- DevTools：320/375/430 CSS px、页面字号变量注入24px（150%），公示、长告知和底部操作可换行滚动；实际首页点击进入新页通过。375 使用 Mac 模拟机型，仅验证 CSS 宽度。修复了首轮字号未消费的问题。截图 `output/p1-1/320-font24-first.jpg`、`320-font24-form-bottom.jpg`、`375-font24-form-bottom.jpg`、`430-font24-form-bottom.jpg`。
- 浏览器：后台登录、列表、详情、筛选空态、刷新及退出通过，桌面与375px窄屏正常（`admin-desktop.png`、`admin-375.png`）。后台150%字号 **NOT_RUN**：自动化按键未产生可证实的缩放，需 Owner 补验。以上均为合成数据与桌面工具，手机仍未验收。

## 真实服务仍缺什么

正式写入默认关闭。配置入口为 `server/src/main/resources/application.yml`：`P1_INTAKE_ENABLED`、获批的 `P1_NOTICE_VERSION/TEXT/APPROVAL_REF`、独立 `P1_ADMIN_USERNAME/PASSWORD_HASH`，以及可选真实平台公开号码 `P1_PLATFORM_PHONE`。密码只接受 PBKDF2 摘要；Google/OAuth 与 P1 无关。缺号码只影响拨号，缺获批告知/持久化/真实身份能力则不能受理。

当前客户端复用已有 C5 开发环境来源解析：只有 develop 可显式接测试服务，trial/release 没有正式 API 来源就保持不可用。真实开通还需独立的生产 API/HTTPS/微信域名接线、真实 C5、管理员凭据配置、获批告知与保留/代办规则、地址入口与实际机构条件确认；本轮没有部署。短托日价/最短入住、备用金退还条件保持未知。

Owner 手机验收、朋友真实工作试用、真实微信鉴权、生产 MySQL/正式服务和消息通知均未验证或未开通。P1-2 可在此闭环上实现联系与排期，不能把当前意向当成已预约；P1-3 报表仍待开发。
