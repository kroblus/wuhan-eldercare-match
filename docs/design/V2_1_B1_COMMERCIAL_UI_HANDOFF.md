# V2.1-B1 商业化原生 UI 交接

日期：2026-10-23。实现完成、本地交付；验收门禁仍等待 Owner 微信 Android 真机检查。未 push、PR、merge、上传或发布。

- BASE_MAIN_COMMIT = ecd411a777625729f8ee6a605b6b05dfa8648e18。已 fetch 并核对远端 main；本地 main 仍为 aaa08ed，保留原状，新 worktree 从 origin/main 创建。
- SOURCE_A2_COMMIT = b476d6b0e3d5d379fcc2860219ce530c3c084f77。
- BRANCH = codex/v2-1-b1-commercial-ui。
- OWNER_DESIGN_DIRECTION_APPROVED = A2 + N2 + NTC-A；依据 Owner 本轮明确授权记录，覆盖 A2 设计文档原有“待评审”的设计方向状态。不是业务 Contract 新冻结版本。
- 来源：A2 独立工作区内 docs/design/V2_1_A2_CONTENT_SERVICE_HOME_BASELINE.md、V2_1_A2_TAG_EVIDENCE_RULES.md、V2_1_A_COMMERCIAL_UX_BASELINE.md，以及 design/v2-1-a2 的 HTML/CSS/JS 和截图。只读参考，未复制 fixture 或整体 cherry-pick。
- DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED。同步 README 与 FRONTEND_STRUCTURE；稳定 main 没有独立 Living Current Status 更新机制，本轮不覆盖历史阶段状态。

## 实际实现与兼容边界

首页 /pages/home/index：紧凑品牌 → 顶部公告 → 两条政策/科普导读 → 查找/需求双服务 → 原位搜索 → 普通目录 → 入住/收费阅读 → 资料说明。N1 底栏不变。主要字号沿用 Warm Swiss，320px 规则将双入口纵排；未复制原型状态栏、胶囊或 Home Indicator。

默认加载后只截取原顺序前2家；展开/收起在首页进行。非空关键词或非默认区域/性质显示全部合法匹配，继续使用现有名称+区域+性质 AND predicate，不改 Provider 或排序。清除全部恢复预览，清关键词保留筛选。加载失败局限于目录；评估、阅读等仍可操作。刷新保留现有结果高度和输入节点；返回保留条件及展开状态，重新读取资料仍有世代/卸载保护。原生 pageScrollTo 定位后 focus 输入；失败可重试。

共享目录卡用于首页与普通机构列表。补充只读展示复用现有详情应用投影，identity/revision/evaluationAsOf 保持一致。推荐来源列表跳过普通目录补充，原 sourceContextRef、分组与排序保持。List 按 Frozen Institution V1.2.1 §22 只显示地址资料状态，完整地址留在详情；电话也只显示状态，不含号码/拨号动作。复用每条 phone.statusLabel，待核验/过期/未知/不可用及混合状态保留，不把电话存在说成已实拨。原有机构特定风险保留，补充投影失败退回基础卡与原风险。

T1 事实分别置于区域/性质、地址状态、电话状态；因已重复而不生成 chips，当前 factTags 为0且无空容器。类型不推出护理特质，T2/T3 在正式和演示中均未接入。无数据、证据、能力或 Frozen Contract 变化。

详情 /pages/institution/detail：身份、位置/电话、护理费用待确认、入住指南、详细来源分层。沿用原 VM、CareProcess、verification/availability/date、map/phone actions、canonical route/revision/sourceContextRef。新增入住指南入口有导航保护与失败反馈，无预约承诺。

三类阅读 /pages/service/{policy,education,admission}/index：共用原内容服务，原段落/来源/核对日2026-10-22不变；政策分开展示全国通知发布日2026-01-22与平台核对日、地域/官方网址；科普强化章节；入住指南呈现六步，第四步标题为“与机构确认参观”。增加相关内容入口，保留来源复制与失败重试。不判定资格或诊断。

公告：顶部普通内容区按钮，位于既有自定义导航安全区下；wx.showModal 正常空状态“当前暂无可展示的公告。”，有“关闭”按钮。无数据/后台/未读角标/已读存储/订阅消息/全局浮球。状态不会清除查询或主动滚动页面。

N2 = DEFERRED_TO_B2；ANNOUNCEMENT_REAL_DATA = NOT_IMPLEMENTED。app.json、顾问 switchTab、Assessment、Recommendation、Institution 冻结语义、正式与演示资料均未修改。

## 验证证据

下列为本地命令通过，Node VM 不等于微信或 Android 真机。

| 检查 | 结果 |
| --- | --- |
| build:production / build:demo | PASS：TS4.1.2、LESS、原生WXML、资源/30路由、生成语法 |
| check:v2-1-b1-ui | PASS：production/demo，122断言+N1路由；预览、展开、搜索/返回、失败重试、加载竞态/卸载、过期、电话混合状态、阅读失败近邻反馈 |
| check:v1-7-homepage / check:real-institution-provider | PASS：双模式组合筛选、清除、无结果、canonical详情、全部11家正式机构与数据边界 |
| check:institution-list-page-runtime / check:institution-detail-page-runtime | PASS：22 / 32 |
| check:institution-detail-v1-2-1-ui-runtime / check:institution-detail-v1-2-1-interactions | PASS：39 / 16（合法电话、地图及失败、rapid tap） |
| check:institution-list-detail-interactions / check:navigation-home-dedup-p0 | PASS：17 / 10，N1及来源上下文 |
| check:assessment-v2-runtime / check:recommendation-v2-runtime | PASS：44 / 68固定用例+95 ancillary，含NO_EXACT_MATCH及不可变性 |
| check:capability-evidence / check:production-directory-data | PASS，未变更资料 |
| check:run-mode-convergence | PASS：真实/合成隔离、12详情、V2链路；demo不转发真实存储/网络/身份/电话 |
| check:wechat-ts-targeted-compat | PASS |
| check:wechat-js-compat -- --artifact-dir dist/{production,demo}/miniprogram | PASS：210 / 205本轮生成模块，无class fields/可选链/空值合并 |
| git diff --check | PASS |

DevTools = PARTIAL_PASS。实际微信模拟器430px：A2首页及N1、默认2/11、搜索定位并focus、输入中文字符串（非真实IME）、区域/性质方法级AND、无结果、详情canonical参数及返回保留条件、三类阅读、演示初始空态/载入12家/预览2家/搜索3/加区域1/详情。正式详情原生电话按钮以mock API验证调用1次，已restore，无真实拨号；地图操作通过运行时fixture回归，未实际打开地图。

公告取得原生空状态截图；模拟器坐标点“关闭”受工具 App.CDPEnable unimplemented 限制，真实按钮关闭未完成自动化验收；Node VM已覆盖complete释放及失败重试。DevTools刷新/跨页曾发生routeDone不一致与超时，重新打开仅B1窗口后取得三类阅读画面，不把超时算通过。资料和截图保存在本地 ignored output/v2-1-b1/；policy/education/admission截图均已人工查看。

NOT_RUN：Android人工真机；320/375/390px真实模拟器画面；系统放大字号；真实中文IME/软键盘、输入焦点长时稳定性；真实拨号接通/地图；真实公告关闭及滚动恢复；微信最终主包体积。430px画面不替代其他尺寸；CSS窄屏规则与Node字符串输入不替代设备证据。

构建运行目录文件字节（仅miniprogram/，不是dist总量，也不是微信最终主包）：production 1,334,382 → 1,356,864，demo 2,004,680 → 2,027,162，均+22,482 bytes。demo距本地1,984KiB预算尚余4,454 bytes，需Owner用DevTools真实包信息确认；未擅改预算或构建压缩规则。

## 专项委派与复核

AGENT_DELEGATION_REPORT：Owner补充策略后启用QUOTA_BALANCED_SPECIALIST_DELEGATION。

- 主线程：Warm Swiss全部WXML/LESS视觉、跨页集成、DevTools、构建、文档和本地提交；补充指令前已完成首轮实现，没有重做委派以扩大工作。
- wechat_frontend / frontend_interaction_finish：仅home/index.ts、institution/directory-presentation.ts、check-v2-1-b1-ui.mjs；补异步生命周期、地址范围、电话状态、失败风险保留与定向断言。源码目标TS检查和临时source-overlay通过；最终门禁采用主线程fresh双构建，不以overlay冒充。
- qa_reviewer / b1_diff_qa：只读diff-driven复核，未构建/写入。发现的完整地址越界、电话状态泛化、底部失败反馈不可见、旧测试fallback断言保留均已修正；最终只读结论 PASS_WITH_RISKS，无剩余阻断；主线程最终fresh双构建和122断言已通过。低风险：同一阅读导航错误会在上/下部入口各有一份相同alert，便于近邻反馈；未拆成按入口独立状态。预约动态CTA文案断言已补回。
- backend_domain、matching_engine：未启动，未触及后端或领域规则实施。

## Owner Android真机重点与B2前置条件

先打开正式dist/production；核对首页密度、双入口/定位/键盘、默认2/展开/收起、名称+区域+性质AND、无结果/清除、快点详情与返回条件/滚动、卡片无重复标签/无完整地址号码且有特定风险。核对详情合法拨号/地图状态、入住指南返回和原推荐来源上下文。检查三类阅读、来源复制、公告打开/关闭不丢搜索；覆盖320/375/390/430与放大字号。另打开dist/demo确认开发模式、载入/重置/重载12家及隔离，勿提交真实业务。

B2仅在Owner完成B1微信Android验收并明确授权后开始；独立设计新普通目录Tab容器，保留带sourceContextRef旧non-Tab目录，集中迁移顾问switchTab调用、fallback及来源返回栈，回归多次进入/快速点击/失败重试。真实公告另属B3，不能随B2自动上线。

## 实际文件清单

- README.md
- docs/architecture/FRONTEND_STRUCTURE.md
- docs/design/V2_1_B1_COMMERCIAL_UI_HANDOFF.md
- miniprogram/pages/home/index.less
- miniprogram/pages/home/index.ts
- miniprogram/pages/home/index.wxml
- miniprogram/pages/institution/detail.less
- miniprogram/pages/institution/detail.ts
- miniprogram/pages/institution/detail.wxml
- miniprogram/pages/institution/directory-presentation.ts
- miniprogram/pages/institution/index.ts
- miniprogram/pages/institution/list-view-model.ts
- miniprogram/pages/service/admission/index.wxml
- miniprogram/pages/service/education/index.wxml
- miniprogram/pages/service/policy/index.wxml
- miniprogram/pages/service/reading-page.ts
- miniprogram/styles/family-reading.less
- miniprogram/styles/institution-directory.less
- miniprogram/templates/family-reading.wxml
- miniprogram/templates/institution-directory.wxml
- package.json
- scripts/check-institution-detail-page-runtime.mjs
- scripts/check-institution-list-page-runtime.mjs
- scripts/check-navigation-home-dedup-p0.mjs
- scripts/check-real-institution-provider.mjs
- scripts/check-v1-7-homepage.mjs
- scripts/check-v2-1-b1-ui.mjs

WORKSPACES_PRESERVED = YES：原工程c7f5703（63项既有状态条目保留）；main checkout aaa08ed干净，V2.0 c0f373c、V2.1-A 06b32da、A2 b476d6b干净且未改HEAD。B1由本轮创建；仅更新共享Git fetched refs与新增B1分支/提交。
