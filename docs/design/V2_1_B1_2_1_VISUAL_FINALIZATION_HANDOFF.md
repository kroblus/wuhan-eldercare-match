# V2.1-B1.2.1 首页与机构卡片视觉收尾

日期：2026-10-23。STATUS = COMPLETE（本地实现完成；Owner视觉与Android验收待完成）。

- BASE_B1_2_COMMIT = `1809633f40f62c7c3cd8cd0a8070b6b6523de22f`
- BRANCH = `codex/v2-1-b1-2-1-visual-finalization`
- WORKTREE = `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-1`
- OWNER_DESIGN_DIRECTION_APPROVED = A2 + N2 + NTC-A；本轮实际仍为N1，N2未开始。
- 来源：Owner本轮B1.2.1请求；B1.2原生实现及已提交截图。B1.2沿用的A2设计SHA为 `b476d6b0e3d5d379fcc2860219ce530c3c084f77`。
- DOC_IMPACT = AUDIT_ONLY：新增本轮交接与证据，没有业务Contract版本变更。

## 问题与实际改动

Owner指出普通卡片过高、顶部公告文字占位过重、Hero重复文案，以及320px/150%字号主要任务发现困难。本轮只改首页WXML/LESS、共享普通目录卡片WXML/LESS、相关展示检查和package脚本注册；未改任何TS业务逻辑、展示投影、正式/演示资料、app.json、服务端、身份或预约。

卡片收成三组：完整机构名与区域/合法性质同行；地址资料/费用状态两列，在大字号下自然纵排；公开电话状态和不少于44px的详情操作。移除两条分隔线及多余间距，机构特定风险继续逐条独立全文显示，不用固定高度、ellipsis、折叠或隐藏来缩卡。普通卡无风险区时自然更短。共享整卡仍只有一个onCardTap路径，canonical institutionId、recordRevision及来源参数保持原样。

既有只读性质投影保持0或1个T1事实标签；区域和电话状态不重复贴标签。未知性质保留“性质待确认”，无标签时没有空容器。unknown/unavailable/unverified/expired语义及全部notes照读原VM；不生成T2/T3、价格/护理/距离优势，也不从名称推断能力。不增加完整地址或电话号码。

Hero仅保留“了解养老需求 / 查找机构资料”及“为家人做好养老准备”。标准屏保留B1.2原生几何家庭人物和现有青绿/暖橙。<=340px隐藏装饰及重复品牌副标题，增加复用focusSearch的44px查找按钮；原资讯和双服务入口顺序保持。窄屏首屏没有两个同权重主CTA；字体仍随系统放大，没有缩小系统字号。

公告为46px圆形icon-only按钮，保留“查看平台公告”可访问名称。沿用已有自定义导航安全占位与原生空状态“当前暂无可展示的公告。”，可关闭，无未读数、假公告、后台或持久化已读。430px铃铛top110.40px、胶囊bottom89px；320px/150%铃铛top71.25px、胶囊bottom59px，均不重叠。

## 原生前后证据和量测

全部after截图均来自实际微信DevTools模拟器，非HTML/Chromium。before截图从B1.2上述基线提交只读复制；before几何值从本轮output/baseline-production中的B1.2构建副本重新原生量测，未改历史工程。PNG尺寸受模拟器显示比例影响，CSS宽度和字号以wx.getSystemInfoSync为准。标准fontSizeSetting=16；125%=20；150%=24。

| 场景 | B1.2 | B1.2.1 |
| --- | --- | --- |
| 430px首页 | [之前](v2-1-b1-2-1-evidence/before-home-430.png) | [之后](v2-1-b1-2-1-evidence/after-home-430.png) |
| 390px首页 | [之前](v2-1-b1-2-1-evidence/before-home-390.png) | [之后](v2-1-b1-2-1-evidence/after-home-390.png) |
| 320px/150%首页 | [之前](v2-1-b1-2-1-evidence/before-home-320-font150.png) | [之后](v2-1-b1-2-1-evidence/after-home-320-font150.png) |
| 430px普通卡及风险卡 | [之前](v2-1-b1-2-1-evidence/before-cards-430.png) | [之后](v2-1-b1-2-1-evidence/after-cards-430.png) |

另有 [375px](v2-1-b1-2-1-evidence/after-home-375.png)、[320px](v2-1-b1-2-1-evidence/after-home-320.png)、[320px/125%](v2-1-b1-2-1-evidence/after-home-320-font125.png)、[390px卡片](v2-1-b1-2-1-evidence/after-cards-390.png)。

原生wx.createSelectorQuery.boundingClientRect与automator element offset测量，单位CSS px，非PNG估算：

| 同机构、同宽度、同字号 | B1.2 | B1.2.1 | 变化 |
| --- | ---: | ---: | ---: |
| 430/16 Hero | 164.39 | 127.99 | -36.40 |
| 430/16 普通卡：柏泉街卫生院机构 | 313.46 | 235.73 | -77.73（24.8%） |
| 430/16 风险卡：将军路街卫生院机构 | 394.25 | 312.52 | -81.73（20.7%） |
| 320/24 Hero | 292.56 | 214.98 | -77.58 |
| 320/24 普通卡 | 571.22 | 480.29 | -90.93 |
| 320/24 风险卡 | 716.80 | 621.88 | -94.93 |

320/150%首个实际查找任务入口由原服务卡top930.03px改善为Hero按钮top287.48px、bottom331.48px、高44px；windowHeight514px，首屏可见。Hero标题computed font-size=34.5px，保留系统放大。[点击后搜索框](v2-1-b1-2-1-evidence/search-focus-320-font150.png)绝对top1147.72-scrollTop1080=视口top67.72px，胶囊bottom59px，searchFocus=true。B1.2 capsule.bottom+8偏移、96px回退、NavigationGuard、失败重试均未修改。

[长名称与一个性质标签](v2-1-b1-2-1-evidence/one-tag-long-name-320-font150.png)、[完整风险文字](v2-1-b1-2-1-evidence/risk-complete-320-font150.png)、[零标签](v2-1-b1-2-1-evidence/zero-tag-320-font150.png)。150%风险卡自然高于一屏，允许纵向滚动；完整风险截图显示原文，没有通过裁切内容降低高度。零标签样本为真实江岸区机构，tags=[]、性质待确认。

[公告原生空状态](v2-1-b1-2-1-evidence/announcement-empty-430.png)打开后实际点“关闭”，首页scrollTop仍0。[中文AND筛选](v2-1-b1-2-1-evidence/chinese-and-filters-390.png)为“卫生院”+东西湖区+公办=2条；清除后“武汉”=8条全部结果；[详情返回](v2-1-b1-2-1-evidence/detail-return-390.png)keyword=武汉、count8、scrollTop514均恢复，详情路由携带institutionId=wh-hanyang-social-welfare、recordRevision=1、source=direct_link。320/150%清除关键词后keyword为空、active=false、visible2、count11。

量测原始值：[native-measurements.json](v2-1-b1-2-1-evidence/native-measurements.json)。page查询原生input返回null，因此该项使用独立element offset及page.scrollTop交叉验证，不将null作成功。

## 构建和相关回归

| 检查 | 结果与证据范围 |
| --- | --- |
| B1首页交互 | check:v2-1-b1-ui：126 assertions PASS；双模式预览/展开/名称区域性质AND/清除/无结果/失败重试/加载竞态/返回/快速点击/公告与阅读 |
| B1.1显示证据 | check:v2-1-b1-1-visual：86 assertions PASS；双模式性质分配、去重、过期、风险、身份、隔离及颜色对比 |
| B1.2首页结构 | check:v2-1-b1-2-home：43 assertions PASS；只适配两个独立查找按钮，不削弱单事件链要求 |
| B1.2.1展示 | check:v2-1-b1-2-1-visual：40 assertions PASS；紧凑布局、风险无截断、0标签、44px、窄屏入口和偏移保留；不是设备测试 |
| 业务回归 | Assessment V2 44；Recommendation V2 68固定案例及确定性/不变性；列表22、详情32、V1.2.1交互16、NavigationGuard10，均PASS |
| 原有首页/隔离 | check:v1-7-homepage、check:run-mode-convergence PASS；生产排除演示、演示无真实网络/Storage转发 |
| 微信兼容 | production/demo TypeScript4.1.2、Less、WXML双构建PASS；targeted TS零错误；生成JS production211/demo206全模块PASS，无可选链/不支持class fields |
| 实际生产DevTools | 六组首页、卡片、定位搜索、中文字符串与组合筛选、清除、详情与返回、公告打开关闭PASS；基础库2.32.3、DevTools2.02.2609232 Nightly |
| 实际演示DevTools | 首次窗口模拟器无响应，限定重启本轮窗口后恢复；320/150%首页、Hero定位、默认2/共12，输入“虚构”显示12条、allDemo=true，PASS |
| 手工中文IME / Android | NOT_RUN；automation.input中文字符串不能代替真实输入法组合过程，也不能代替真机 |

演示原生证据：[首页](v2-1-b1-2-1-evidence/demo-home-320-font150.png)、[主动查询12条](v2-1-b1-2-1-evidence/demo-search-320-font150.png)、[有演示标识的卡片](v2-1-b1-2-1-evidence/demo-card-320-font150.png)。演示工具和数据保持独立，未将演示资料写入production。

原生设备/字体热切换时曾出现“routeDone with a webviewId ... that is not the current page”工具运行日志；随后生产交互和截图可完成，不声称console全绿。首次演示项目连接超时且工具提示模拟器长时间无响应；仅停止/重开本轮演示窗口及关闭本轮基线副本窗口后恢复，未关闭或清理历史窗口/工作区。重试成功前的超时不记PASS。

| 本地runtime文件预算统计 | B1.2 bytes | B1.2.1 bytes | 增量 |
| --- | ---: | ---: | ---: |
| production | 1,360,521 | 1,360,934 | +413 |
| demo | 2,030,819 | 2,031,232 | +413 |

LOCAL_SIZE_BUDGET=2,031,616 bytes，双模式PASS；demo余384 bytes。未提高预算、未加依赖、图片、字体或框架。上述是既有本地runtime统计，WECHAT_PACKAGE_SIZE=NOT_RUN，不能替代DevTools真实主包信息。

## 委派、文件与后续门禁

AGENT_DELEGATION_REPORT：

- wechat_frontend / b121_frontend：独占首页和共享卡片WXML/LESS、B1.2 checker适配及新增40项checker；完成后暂停写入。未改业务TS/数据。
- qa_reviewer / b121_diff_qa：只读diff-driven复核，检查相关交互和Institution证据边界及全部生产原生截图；PASS_WITH_RISKS，无阻塞发现；未重跑主线程测试、未从PNG推断几何值。
- 主会话：独立工作区、需求边界、整合、package命令、双构建、相关回归、原生操作/量测、交接、本地提交。未调用backend_domain/matching_engine，因为未触及其实现边界。

实际源文件清单：
`miniprogram/pages/home/index.wxml`、`miniprogram/pages/home/index.less`、`miniprogram/templates/institution-directory.wxml`、`miniprogram/styles/institution-directory.less`、`scripts/check-v2-1-b1-2-home.mjs`、`scripts/check-v2-1-b1-2-1-visual.mjs`、`package.json`；另新增本交接和同级v2-1-b1-2-1-evidence证据目录。全部最终文件可由本轮commit的git show --name-only查看。

WORKSPACES_PRESERVED=YES：原工程及B1/B1.1/B1.2/A2等历史目录未写入、重置或清理；基线编译副本和本轮全部操作位于新工作区。没有push/PR/merge/上传/提审/发布。Assessment/Recommendation/Institution Frozen语义、生产和演示数据均未变；N1保留，N2_MIGRATION=NOT_STARTED。

Owner Android重点检查：标准和系统大字号首屏查找可见性、查找后搜索框与软键盘位置、真实中文拼音组合/连续输入、区域/性质AND及清除/展开/无结果、快速双击、机构详情和返回条件/滚动恢复、长名称与完整风险/零标签、公告开关及胶囊、合法电话和地图既有操作。自动化合法电话测试没有实际拨打电话。

B2前置条件：Owner完成B1.2.1视觉及Android验收并明确授权B2；先独立评估N1顾问Tab消费者、机构目录目标与推荐来源上下文迁移，再单独实施导航Contract兼容方案。本轮不自行开始。

NEXT = OWNER_B1_2_1_VISUAL_AND_ANDROID_REVIEW

