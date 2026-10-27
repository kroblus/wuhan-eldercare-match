# V2.1-B1.2.2 最终微调与体积核查交接

日期：2026-10-23。STATUS = COMPLETE（本地实现完成；Owner Android最终验收待完成）。

- BASE_B1_2_1_COMMIT = `934acbb3a0df70f82f6c9e0f00bb8ae4fa46de0c`
- BRANCH = `codex/v2-1-b1-2-2-final-polish`
- WORKTREE = `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-2`
- Owner结论沿用 VISUAL_PASS_WITH_MINOR_POLISH；A2/N2/NTC-A方向不重开；本轮仍N1，B2未开始。
- DOC_IMPACT = AUDIT_ONLY。本轮没有Contract、TS业务逻辑、数据、Provider、构建器或预算阈值修改。

## 两处修复

430px旧卡片等宽列把“地址资料已提供 · 详情可查”拆出孤立“可查”。现在地址、收费各有一致样式的独立标题与正文，地址较宽、收费较窄；430/390保持紧凑双列，375原生检查正常，320/150%自然纵排。“详情可查”按词组完整换行，不固定高度或裁切。原address/addressStatus/price字段、条件与字符串完全保留，没有把unknown、unavailable、unverified、expired转为已提供，也没有推导坐标、补充地址、号码或价格。风险notes逐条原文、长名称、0/1性质标签及单一整卡详情事件保持。新增标题“地址资料”与原状态开头略有重复，这是保留原投影全文的轻微阅读取舍，不损失状态含义。

首页查找服务卡的可见辅助文案改为“搜索与筛选机构”，主标题仍“查找养老机构”。旧字串仅作为visibility:hidden、aria-hidden的自然排版尺寸参照；新文案独立定位在原说明起点，以严格保持不同宽度/字号下的原按钮高度及点击范围。未加父级事件，仍复用focusSearch。首次原生检查发现嵌套text结构的子选择器未生效，已改成带明确class的view/text并重新双构建、截图和检查；最终截图只有新说明。Hero、品牌、小铃铛标记及原有公告空状态未改。

## 原生证据

所有after页面PNG均为实际微信DevTools模拟器截图，宽度/字号用wx.getSystemInfoSync确认。before从上述B1.2.1提交证据只读复制，未改历史工作区。

| 场景 | B1.2.1 | B1.2.2 |
| --- | --- | --- |
| 430普通及特定风险卡 | [之前](v2-1-b1-2-2-evidence/before-cards-430.png) | [之后](v2-1-b1-2-2-evidence/after-cards-430.png) |
| 430首页服务说明 | [之前](v2-1-b1-2-2-evidence/before-home-430.png) | [之后](v2-1-b1-2-2-evidence/after-home-430.png) |

另见 [390卡片](v2-1-b1-2-2-evidence/after-cards-390.png)、[375卡片](v2-1-b1-2-2-evidence/after-cards-375.png)、[320/150%长名称及状态](v2-1-b1-2-2-evidence/after-card-320-font150.png)、[完整风险](v2-1-b1-2-2-evidence/after-risk-320-font150.png)、[零标签](v2-1-b1-2-2-evidence/after-zero-tag-320-font150.png)、[服务入口](v2-1-b1-2-2-evidence/after-services-320-font150.png)、[演示卡片](v2-1-b1-2-2-evidence/demo-card-375.png)。

[430原生量测](v2-1-b1-2-2-evidence/measure-430.json)中地址与费用正文top相同、各自一行高27.20px；普通卡235.73px、风险卡312.52px，与B1.2.1相同。服务卡高150.6875px，整个服务组top440.1771px，与B1.2.1相同。[320/150%量测](v2-1-b1-2-2-evidence/measure-320-font150.json)的服务组高351.7917px，也与B1.2.1一致；大字号卡片自然增长。page query对带子组合器的group查询返回空数组，未用它冒充列量测；430采用实际地址/费用元素的boundingClientRect及截图核对。

390原生搜索“武汉”得到8条全部结果。进入详情的institutionId=wh-hanyang-social-welfare、recordRevision=1、source=direct_link；返回后keyword=武汉、count8、active=true、scrollTop514均恢复。320/150%零标签真实样本为江岸区机构，count1、factTags=[]、原地址状态保留。演示原生加载后visible2/count12/allDemo=true。没有触发真实拨号、预约或登录授权。

## 包体积：已取得什么

通过本机DevTools“界面→打开视图→代码依赖分析”，分别查看并导出production/demo。界面证据：[production](v2-1-b1-2-2-evidence/production-code-deps.jpg)、[demo](v2-1-b1-2-2-evidence/demo-code-deps.jpg)。导出摘要：[production](v2-1-b1-2-2-evidence/production-package-analysis.json)、[demo](v2-1-b1-2-2-evidence/demo-package-analysis.json)、[隔离与资源核对](v2-1-b1-2-2-evidence/package-comparison.json)。原始完整导出保存在本工作区output/v2-1-b1-2-2/*-code-deps.raw.json，摘要记录其SHA256。

| 指标 | production | demo |
| --- | ---: | ---: |
| DevTools依赖分析界面主包 | 1.30MB | 1.94MB |
| 导出allSize（源文件bytes） | 1,361,113 | 2,031,411 |
| 文件数/唯一文件路径数 | 354 | 353 |
| 分包数 | 0 | 0 |
| 资源bytes | 5,299 | 423,329 |
| 无依赖代码文件 | 9 / 19,394 bytes | 9 / 19,394 bytes |
| 相同内容重复资源数（SHA256） | 0 | 0 |
| 外模式专属文件 | 0 | 0 |
| 最终微信编译打包/签名主包 | NOT_AVAILABLE | NOT_AVAILABLE |

重要区别：这里拿到的是DevTools代码静态依赖分析，不是上传/预览返回的最终代码包。其allSize与本地运行目录原始文件求和完全相同，不能据此声称已取得微信最终主包或发布门禁PASS。本次会话未建立可安全调用的最终包分析路径，未配置CI私钥或另行接入CI；没有调用预览、上传或获取凭证来补数字。因此最终包、压缩/编译后文件表及平台上传校验为NOT_AVAILABLE/NOT_RUN。[微信官方CI文档](https://github.com/wechat-miniprogram/miniprogram-ci-dist/blob/master/README.md)分别定义预览返回的subPackageInfo及getCompiledResult，该接口的存在不代表本轮已执行或取得结果；预览的4M开关不能直接当作正式发布限制或本项目预算调整依据。

资源差异明确：production仅6张TabBar图，共5,299 bytes；demo另有既有assets/vr-synthetic-test.jpg，418,030 bytes，以及demo/institutions.data.js，313,212 bytes。production不含这些演示专属文件，demo不含production/专属文件，未混资料或修改资源。demo源目录比production大670,298 bytes，主要来自既有演示材料与模式差异，不来自本轮图片或依赖。

两模式9个无依赖文件均为独立WXSS：pages/showcase/shared.wxss及styles/下的assessment-warm-swiss、base、brand-content、browse-buttons、family-reading、institution-directory、mixins、tokens。Less已在页面样式中内联，构建仍输出这些独立文件；这是可进一步核对的重复产物候选。未据此直接删除源样式或改构建器，也未声称发布时一定被剔除。已有ignoreUploadUnusedFiles=true不等于本轮取得了最终打包剔除证据。

## 本地预算及B2风险

现有scripts/check-run-mode-package-size.mjs由V1.8提交f0083bfff292b56780f97b1cbf0b999c892fae08引入：按project.config.json的miniprogramRoot，递归求和dist/production/miniprogram和dist/demo/miniprogram，禁止混入TS/Less/map/log/zip等。它不计算整个dist、不包括.source、docs、node_modules，也没有模拟微信最终编译压缩或依赖剔除。

阈值为2*1024*1024-64*1024=2,031,616 bytes；原注释以传统2MiB主包基线保留64KiB打包余量。这是保守的项目本地防线，不是从本次微信实际包反推的上限。官方能力可能按流程、AppID和预览/发布条件不同，须以目标环境实际包与门禁为准；本轮没有提高或重定义该阈值。

| 本地runtime bytes | B1.2.1 | B1.2.2 | 变化 |
| --- | ---: | ---: | ---: |
| production | 1,360,934 | 1,361,113 | +179 |
| demo | 2,031,232 | 2,031,411 | +179 |

双模式门禁PASS；production余670,503 bytes，demo仅余205 bytes。安全减重限于合并地址/价格/辅助文字重复样式，抵消新增分组标题和尺寸保留结构的部分字节。没有为了空间删除风险、测试、隔离或业务代码。无依赖产物造成约19KiB本地统计差异，建议后续经独立验证决定是否停止输出这些独立产物，或并列记录全运行目录与实际可达/打包指标；当前门禁继续保留。

B2复用已存在目录页作为Tab不必复制整页，但TabBar资源、文案或迁移胶水代码都可能超过demo剩余205 bytes；不能因production余量较大就视作双模式无风险。B2必须先取得Owner本轮Android验收和明确授权，再量测导航改动增量，必要时单独验证上述构建产物优化；不在本轮扩展分包或删除业务模块。

## 验证、委派与交付边界

- 双构建：TypeScript4.1.2、Less、WXML及生成JS PASS，production211/demo206模块、30路由。
- B1交互126、B1.1视觉86、B1.2首页43、本轮扩展后的B1.2.1视觉52 assertions PASS（比原40新增12条，未建新框架）。
- Institution列表22/详情32/V1.2.1交互16、Assessment V2 44、Recommendation V2 68固定及确定性、NavigationGuard10 PASS。
- production/demo run-mode-convergence、targeted TS、双模式生成JS全模块兼容PASS；不引入可选链/class fields。
- git diff检查、五源文件范围与Hero/品牌/铃铛WXML精确一致检查PASS。预算、构建器、app.json、首页TS、目录展示投影无diff。
- 原生环境：DevTools2.02.2609232 Nightly/基础库2.32.3；430/390/375标准与320/150%定向截图。首次窗口连接/本地bundle加载失败后重开本轮窗口恢复；设备/字体切换出现routeDone webviewId诊断，随后交互可完成，不称console全绿。
- 手工中文拼音组合、Android真机、实际软键盘、实拨电话/地图及最终微信包：NOT_RUN。模拟器、Node及运行时字符串输入证据没有冒充Owner设备验收。

AGENT_DELEGATION_REPORT：wechat_frontend/b122_card_layout独占卡片WXML/LESS及原检查适配，完成后暂停；主会话处理短文案、尺寸保留、整合、构建、原生证据及包审计；qa_reviewer/b122_diff_qa只读diff-driven复核，已检查最终卡片/服务截图与语义，PASS_WITH_RISKS，无阻塞，指出标题与原状态开头的轻微重复。没有启动后端/匹配Agent。

实际源码变动仅：首页index.wxml/index.less、共享institution-directory.wxml/institution-directory.less、check-v2-1-b1-2-1-visual.mjs；另新增本交接和v2-1-b1-2-2-evidence。无正式或演示数据变更；无push/PR/merge/上传/提审/发布；其他历史工作区保持原状。

Owner Android重点：中文拼音连续输入、搜索定位与键盘、名称/区域/性质AND及清除/展开、长名称/地址收费/完整风险、详情返回滚动、合法电话/地图、铃铛开关与放大字号。B2须在本轮最终验收及明确授权之后。

NEXT = OWNER_B1_FINAL_ANDROID_ACCEPTANCE
