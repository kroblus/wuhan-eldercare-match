# React 后台 Light Swiss SaaS 视觉重构

任务 ADMIN-VISUAL-REFINEMENT-V2-20261028；2026-10-28，北京时间。基于实际 HEAD `57d29f2b1bfa3c4ec6adbc1ee76f90d5eaf3b6cc`，保留其前置磁盘工具、清理记录和原工作树修改。React18、Vite、Arco、独立TypeScript与全部后端接口继续沿用。

## 界面改变

- Shell：侧栏212px、桌面顶栏64px、内容区28px内边距；缩小Logo和菜单间距，删除侧栏长说明。内容自然占满可用宽度，未通过任意放大页面掩盖截图画布问题。
- Tokens：冷灰背景 `#F7F9FC`、白色内容、分隔线 `#E8EDF3`、正文 `#1F2937`、说明 `#667085`、品牌橙 `#FF6A00`、按下 `#E85E00`；标题约25px、正文14px、辅助约13px。灰色标签提高文字对比度，成功/警告/错误继续使用独立语义色。
- 工作台：单一中文标题、真实状态总数、无橙色顶边的紧凑KPI，左侧待联系列表、右侧五个快捷入口；不伪造今日新增或增长率。
- 需求：状态/类型/机构常显，日期折叠，查询旁增加重置；服务器分页不变。普通表格去外框、弱化分隔线，合成来源标记保留但改中性色；详情抽屉减少嵌套卡片边框。
- 日程：日期范围和时间成为主要线索，查询按钮恢复普通宽度，操作按钮单行；资源现状与低频维护折叠，原冲突与结果处理保留。
- 机构：名称为标题，稳定ID作为辅助元数据；基础资料、公开介绍、公示价格分组展开，高级JSON保持折叠。保存草稿移到表单顶部；右侧为紧凑的来源确认、版本发布及独立服务资格区。必填校验失败会展开基础资料并聚焦，防止错误藏在折叠内。
- 报告：去装饰标题和橙色指标线，固定批次标签中性化，批次/口径元数据可展开，指标与业务明细使用统一布局。完整范围、同批快照、筛选变化失效及服务器XLSX保持原逻辑。
- 登录：删除巨大橙色圆环及英文装饰，桌面保留克制双栏；窄屏仅保留小品牌和登录表单。

分组使用原生details，折叠不会卸载表单、清空价格或丢弃输入；没有新增自动请求、轮询、存储、发布或新的业务状态。服务端规则、Session/Cookie/CSRF、原操作ID及未知结果恢复不变。

## 真实视觉修正循环

第一轮先打开工作台。测得1440px实际视口、body同宽、侧栏212px、顶栏64px；原截图右/下空白来自浏览器返回的画布，不是页面宽度。查看实拍后修正了重复橙色状态、表格外框及指标留白。

第二轮逐页操作：日程查询按钮被Arco表单自动撑满，已用操作容器恢复正常宽度；日程操作列换行已调整；机构首屏原本看不到保存，已移到顶部；折叠必填字段的错误隐藏问题已补展开与定位。375px冲突表曾自动滚到右侧，已改桌面并列/窄屏逐项堆叠；采用服务器资料后残留旧提示已修复。150%字号测量发现Arco弹窗正文与详情字段仍固定14px，已针对浮层继承修正。所有修正保留原业务处理函数。

前后截图与本轮原始记录统一放在 [本轮证据目录](../../../output/admin-visual-refinement-v2-20261028/)，[并排对照](../../../output/admin-visual-refinement-v2-20261028/compare.html)。沿用同一合成库，启动器新增测试记录，不能把不同时间的计数声称完全相同；具体差异由对照页说明。截图不进入Git或Drive回执。

最终图入口：[登录](../../../output/admin-visual-refinement-v2-20261028/gui/round2-login-1440.jpg)、[工作台](../../../output/admin-visual-refinement-v2-20261028/gui/round2-dashboard-1440.jpg)、[需求](../../../output/admin-visual-refinement-v2-20261028/gui/round2-requests-1440.jpg)、[日程](../../../output/admin-visual-refinement-v2-20261028/gui/round2-visits-fixed-1440.jpg)、[机构列表](../../../output/admin-visual-refinement-v2-20261028/gui/round2-institutions-1440.jpg)、[机构编辑](../../../output/admin-visual-refinement-v2-20261028/gui/round2-institution-editor-final-1440.jpg)、[报告](../../../output/admin-visual-refinement-v2-20261028/gui/round2-report-1440.jpg)、[375/150差异比较](../../../output/admin-visual-refinement-v2-20261028/gui/round2-institution-conflict-font-fixed-375-150.jpg)、[1280/150最终表格](../../../output/admin-visual-refinement-v2-20261028/gui/dashboard-1280-font150-final.jpg)、[375/150最终表格](../../../output/admin-visual-refinement-v2-20261028/gui/dashboard-375-font150-final.jpg)。

[GUI完整记录](../../../output/admin-visual-refinement-v2-20261028/gui/gui-summary.md)区分截图时点：部分旧需求/日程/机构图的视口与状态不同，仅作风格参考；尺寸矩阵中最后两张最终图含表格字号修复，其余矩阵图早于该修复。真实浏览器150%缩放未取得证据。本轮机构对比是单标签编辑与服务器比较，真实双标签409证据来自此前V1，本轮组件冲突回归保持通过，不冒充重新做过双标签GUI。

## 验证与试用

本轮39项组件/客户端测试通过（含新增“折叠必填字段校验失败展开、保留输入且不写入”回归），未配置本机服务时明确跳过1项live测试。真实HTTP契约测试支持显式 `ADMIN_LOCAL_RUNTIME`，本轮使用新私有凭证文件，未覆盖上轮私有文件。

使用本轮隔离服务再次运行全部测试：40项通过、0跳过，见 [最终前端与HTTP日志](../../../output/admin-visual-refinement-v2-20261028/frontend-tests-final.log)。应用阅读字号150%下，已实际读取浮层正文/字段/按钮、详情字段、下拉显示及选项为21px，次要文字19.53px；针对表格额外补足Arco尺寸规则覆盖。代表页面检查1440、1280、768、375及100%/150%；系统比例不能取精确1024，使用1023/1025两侧记录，不伪称精确1024。

实际浏览器合成业务：联系→待确认→双方确认→改期→取消；第二场成功记录到访。未来行程提前记录到访被服务端拒绝，未放松业务校验。机构保存草稿14→确认15→发布第4版成功，服务接入仍关闭；逐项采用服务器值保留其他本地输入，丢弃后字段和提示一致。报告生成固定批次并点击同批Excel导出；下载事件等待超时，只证明发起，尚无文件落盘证据。未尝试绕过此前对 `chrome://downloads/` 的策略拒绝。

朋友试用使用现有隔离启动工具，在主根PowerShell执行：

```powershell
./server/tools/resume-p1-synthetic-mysql.ps1
./server/tools/start-p1-synthetic.ps1 -DatabaseSettings output/p1-1/mysql.private.json -JavaExecutable "$env:JAVA_HOME/bin/java.exe" -OutputDirectory output/admin-visual-refinement-v2-20261028/backend
```

打开 `http://127.0.0.1:18341/p1-admin/`，只在本机查看对应输出目录的 `runtime.private.json` 获取合成账号。结束使用 `./server/tools/stop-p1-synthetic.ps1 -OutputDirectory output/admin-visual-refinement-v2-20261028/backend`。全新电脑需自行准备隔离库，私有配置不在Git。

源码检查：`npm --prefix admin-web run typecheck`、`npm --prefix admin-web test`、`npm --prefix admin-web run build`、`npm run check:admin-web`。打包使用既有 `mvn -f server/pom.xml -DskipTests package`；此前先运行根 `npm ci`。本轮未修改后端领域规则或小程序源码，因此不重复63项后端领域测试或微信构建。

本轮保持本机合成范围；生产资源、正式HTTPS、真实身份/资料授权、朋友独立验收不因视觉完成而获得批准。未部署云服务器、未开启真实业务、未微信上传。

## 最终打包

Maven构建通过，沿用原自动安装/类型检查/Vite构建/递归资源打包链。实际生产型JAR包含23个静态文件，36项HTTP资源、已知深路由及404边界检查通过；同源 `/p1-admin/`、`/api/` 和默认关闭策略保持。此次完整GUI运行于Vite同源代理，最终JAR另用真实进程HTTP验证，不混称为本轮JAR浏览器认证验收。

JAR SHA256：`6a68052b075bbefe37c807bcaa2cf34a30e5ad2fb148e1ff65704546c480541c`。见 [打包日志](../../../output/admin-visual-refinement-v2-20261028/backend/package-final.log)、[实际JAR检查](../../../output/admin-visual-refinement-v2-20261028/backend/jar-smoke-final/result.json)。最终格式化后40项测试再次通过。

[资源体积](../../../output/admin-visual-refinement-v2-20261028/assets-final.json)：首屏JS 638,106字节、CSS 274,090字节，本机gzip分别194,858与30,442字节，五个业务路由保持懒加载；未增加第二套UI库、在线字体或图表依赖。未重测公网/手机性能。

下一步由Owner查看并排图并独立试用，确认整体视觉是否符合预期；人工补验精确1024视口、真实浏览器150%缩放、Excel下载落盘及正式HTTPS。Git/CI/Drive真实结果在本次交付回执记录，不为写回SHA制造额外提交。
