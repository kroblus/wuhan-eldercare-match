# V2.1-B1.2 首页视觉交接

日期：2026-10-23。STATUS = COMPLETE（本地实现及验证完成；Owner视觉及Android验收待完成）。

- BASE_B1_1_COMMIT = `2e634b5289e36f1f3f95e05403935faba366f28e`
- BRANCH = `codex/v2-1-b1-2-commercial-home`
- WORKTREE = `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2`
- Owner 参考：本轮附图 `codex-clipboard-ca8e6ee5-89f4-4533-9405-22699950ede5.png`，已实际查看。
- 参考图提供空间布局和色彩方向，不提供机构事实、照片授权、公告数据或业务承诺。

## 边界及参考图取舍

已采用横向品牌与小铃铛、青绿/暖橙品牌构图、三类资讯网格、双核心服务卡及连续搜索结果区。Hero以原生几何家庭陪伴插画、文字和柔和渐变构成，无图片资源或外部图片请求；320px隐藏纯装饰图形，为文字让出空间。参考图中的真实机构照片、未读数字、四栏导航，以及医养结合、价格友好、离家近和“优质机构推荐”等内容均未采用。未来若加入通用情景图片，需要另行确认授权、非机构实景标识及体积方案，当前没有新增素材。

与B1.1相比，顶部公告不再单独占一整行；原长资讯导读与重复的底部阅读区合并为三个短入口；服务卡保持主青绿/辅暖橙的明确区别。430/390/375标准字号均为三资讯列，320标准为2+1，大字号自然转为单列。原生截图发现的政策标题末字/箭头孤行通过短标题“补贴政策”和短摘要修正，完整语义保留在无障碍标签；资讯与服务卡均顶部对齐，消除文案行数不同造成的图标错位。

继续复用 `@color-accent = #A84F25`。暖橙实际用于Hero关键行、政策入口底色/图标、评估服务卡、目录栏目强调线、合法公办/公建民营标签及详情提示；青绿继续用于品牌和主要查找操作，民办事实标签沿用青绿。入住指南辅助色来自既有 `@color-info`，没有建立另一套Token。风险继续使用明确文字和中性区域，不包装为优势。

Assessment、Recommendation、Institution 证据及版本语义不变；保留 N1。默认预览2家，主动名称/区域/性质 AND 查询显示全部匹配；正式资料和演示资料不混合。公告继续使用 B1 的可关闭原生空状态。

机构卡片改为身份/区域/性质事实标签、地址和费用状态组、机构特定风险及电话/详情操作组，未添加建筑占位照片或环境推断。既有只读性质投影仍只生成0或1个标签（模板支持0—3），未知或过期事实无正面标签，不重复区域/性质/电话信息，List仍不展示完整地址或号码。所有身份、recordRevision和来源上下文保持原样。

演示工具插槽移到搜索之前，使两种模式的搜索控件和结果区直接相邻。查找定位补上固定导航偏移：胶囊bottom+8px，几何读取失败回退96px；保留原有NavigationGuard、世代保护、异常反馈及重试。安装的旧API类型声明缺少offsetTop，因此仅对此次调用使用局部交叉类型；实际原生基础库已验证该参数生效，没有修改全局类型或业务API。

铃铛位于既有自定义导航安全占位之后。430px原生量测胶囊bottom=89px，铃铛top=103.54px，无重叠、未读数或持久化已读。点击仍显示“当前暂无可展示的公告。”并可关闭。

## 原生视觉证据

所有下列截图均来自实际微信DevTools模拟器。B1.1对照从其已提交的原生证据只读复制，来源提交即上述基线；没有使用HTML或Chromium替代，没有缩放整张参考图作为页面。

| 对比场景 | B1.1 | B1.2 |
| --- | --- | --- |
| 430px首页 | [之前](v2-1-b1-2-evidence/before-home-430.png) | [之后](v2-1-b1-2-evidence/after-home-430.png) |
| 390px首页 | [之前](v2-1-b1-2-evidence/before-home-390.png) | [之后](v2-1-b1-2-evidence/after-home-390.png) |
| 430px机构卡片 | [之前](v2-1-b1-2-evidence/before-cards-430.png) | [之后](v2-1-b1-2-evidence/after-cards-430.png) |

标准字号首页另见 [375px](v2-1-b1-2-evidence/after-home-375.png)、[320px](v2-1-b1-2-evidence/after-home-320.png)。宽度以真实 `wx.getSystemInfoSync().windowWidth` 为准，PNG像素尺寸随模拟器显示比例不同。标准fontSizeSetting=16。

320px/150%通过原生菜单设置fontSizeSetting=24，computed新闻标题字号实际为24px：[顶部](v2-1-b1-2-evidence/after-home-320-font150.png)、[资讯](v2-1-b1-2-evidence/after-reading-320-font150.png)、[服务](v2-1-b1-2-evidence/after-services-320-font150.png)、[长机构名称](v2-1-b1-2-evidence/after-cards-320-font150.png)、[末项与底部安全区](v2-1-b1-2-evidence/after-bottom-320-font150.png)。允许自然滚动，未发现横向截断或末项被TabBar永久覆盖。

- [搜索8条全部结果及筛选器](v2-1-b1-2-evidence/search-results-430.png)：实际输入“武汉”，activeQuery=true、visible=resultCount=8，进入详情返回后仍为8条且条件保留。
- [真实搜索无结果](v2-1-b1-2-evidence/search-empty-430.png)。区域8（东西湖）+性质1（公办）+名称“卫生院”的AND事件回归结果为2条，清除恢复默认2/11。
- [零标签真实机构](v2-1-b1-2-evidence/production-zero-tags-430.png)：江岸区记录性质待确认，风险及电话状态仍可见，未从社会福利院名称推断公办。单标签见上述普通目录卡片对比。
- [载入12条演示资料后的零标签卡](v2-1-b1-2-evidence/demo-zero-tags-430.png)：ready=true，首页预览2条，均明确标记演示；没有修改演示资料或注入视觉夹具。早先一次截取实际为空状态，已由主线程重新载入、连续取证并替换，最终图为真实演示卡片。
- [铃铛公告空状态](v2-1-b1-2-evidence/announcement-empty-430.png)，已实际关闭并返回首页。
- [320px/150%定位搜索](v2-1-b1-2-evidence/search-focus-320-font150.png)：inputTop 1301.82 − scrollTop 1234.67 = 67.15px，capsule.bottom=59px；430px对应649.26−552=97.26px，capsule.bottom=89px。两个宽度均为胶囊下约8px，输入框没有落到固定导航背后。

## 验证记录

| 检查 | 结果 |
| --- | --- |
| B1双模式交互 | `check:v2-1-b1-ui`，126 assertions PASS，含预览/展开/主动查询/清除/失败重试/返回/异步竞态/公告/阅读/定位偏移与异常回退 |
| B1.1证据及视觉 | `check:v2-1-b1-1-visual`，86 assertions PASS；保留原有证据、过期、风险、身份和隔离断言，只适配已替换的视觉选择器 |
| B1.2首页结构 | `check:v2-1-b1-2-home`，43 assertions PASS；检查原生产物的空间组、搜索结果相邻、演示插槽、N1及假承诺/图片排除；不冒充设备布局测试 |
| 已有首页与模式隔离 | `check:v1-7-homepage`、`check:run-mode-convergence` PASS |
| 冻结业务安全 | Assessment V2 44、Recommendation V2 68固定案例及确定性/不可变性、Institution列表22/详情32/V1.2.1交互16、导航去重10，均PASS |
| 微信兼容 | 双模式TypeScript 4.1.2、Less、原生WXML及生成语法构建PASS；targeted TS兼容PASS；生成JS全模块production211/demo206 PASS，无可选链/空值合并/不支持的class fields |
| 实际DevTools | 2.02.2609232 Nightly、基础库2.32.3；上述布局及搜索截图、三类阅读路由、Assessment intro、详情进入返回、公告打开关闭PASS；最后错误日志过滤无命中 |

检查的生成WXSS颜色组合：政策/标签橙字浅橙底4.79:1、青绿标签5.57:1、白字主服务卡6.52:1、评估摘要5.18:1、风险文字5.72:1，满足检查范围内普通文字4.5:1。状态同时依赖文字和布局区分。

原始测试输出在截图目录中保存为17份 `*.log.txt`；截图19张。文档治理检查为BASELINE_FAIL：本轮与B1.1均为相同21项既有问题，差集0，未扩大修复历史文档范围。新增交接链接逐项检查。

| 运行目录 | B1.1 | B1.2 | 增量 |
| --- | ---: | ---: | ---: |
| production | 1,359,711 | 1,360,521 | +810 bytes |
| demo | 2,030,009 | 2,030,819 | +810 bytes |

`build:production`、`build:demo`、`check:run-mode-package-size`均PASS。既有预算2,031,616 bytes，demo剩余797 bytes，未提高门禁。通过替换旧样式和删除首页重复阅读布局抵消新增构图成本；19张文档截图不进入miniprogram包。WECHAT_PACKAGE_SIZE = NOT_RUN：没有取得微信最终代码包信息，运行目录字节不冒充最终主包，也不把整个dist合计作为主包。

## 协作、文件与验收

AGENT_DELEGATION_REPORT：`/root/b12_frontend`（wechat_frontend）实施首页WXML/Less、共享卡片/搜索视觉及三个checker的必要更新/新增；主线程负责搜索安全偏移、原生发现后的文案/对齐修正、演示插槽位置、构建/回归/截图/文档/提交。`/root/b12_diff_qa`（qa_reviewer）只读diff-driven复核源码、参考图、相关冻结片段及原生证据，无阻断发现；指出搜索相邻断言缺口和早期演示截图错误，均已处理。QA最终复核归档320px/150%图、实际载入演示卡及交接后结论PASS_WITH_RISKS，风险为Android/最终微信包未验证和体积余量较小，未重复运行主线程测试。未委派后端/匹配引擎，因为没有对应领域实现。

运行源码改动：`pages/home/index.wxml`、`index.less`、`index.ts`；`templates/institution-directory.wxml`、`styles/institution-directory.less`。未修改只读投影、Provider、机构资料、冻结Contract、Assessment/Recommendation规则、app.json或后端API。

测试/配置：`package.json`，`scripts/check-v2-1-b1-ui.mjs`、`check-v2-1-b1-1-visual.mjs`、新增`check-v2-1-b1-2-home.mjs`。文档：README、FRONTEND_STRUCTURE、本交接及`v2-1-b1-2-evidence/`。DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED。实现与本文件一起本地提交，SHA见本分支HEAD及最终交接。

Owner重点检查：新首页的品牌构图/橙色节奏与三资讯网格；Android标准/放大字号和长名称；查找按钮定位后中文拼音组合/软键盘与AND筛选；详情返回及合法电话/地图；铃铛关闭与N1底部末项。现有拨号/地图运行测试使用模拟wx API，没有进行真实拨号。

Android真机验收由Owner完成；未取得的设备证据一律NOT_RUN。本轮仅本地提交，不push、PR、merge、上传、发布或自动启动B2。

RISKS = demo预算余量797 bytes；Android字号/中文输入法/实际拨号地图/微信最终包仍未验收；DevTools不等于Android。B1与B1.1工作区保持干净，其他历史工作区未修改或清理。B2需Owner验收本轮并明确授权后独立启动。

NEXT = OWNER_B1_2_VISUAL_REVIEW
