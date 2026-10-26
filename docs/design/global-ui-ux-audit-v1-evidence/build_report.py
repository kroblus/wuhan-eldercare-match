"""Build an audit document from captured evidence; never assigns test PASS."""
import json,pathlib,collections,hashlib,subprocess,datetime
P=pathlib.Path(__file__).resolve().parent
R=P.parents[2]
routes=json.loads((R/'miniprogram/app.json').read_text(encoding='utf-8-sig'))['pages']
issues=json.loads((P/'issues.json').read_text(encoding='utf-8'))
captures=[]
for f in sorted(P.glob('*.json')):
    try:
        d=json.loads(f.read_text(encoding='utf-8-sig'))
        page=d['page']['result']['currentPage']
        system=d['system']['result']['systemInfo']['result']
        if not (P/(f.stem+'.png')).exists(): continue
        captures.append({'name':f.stem,'route':page['path'],'query':page.get('query',{}),'mode':'Production' if f.stem.startswith('production-') else 'Demo','width':system['windowWidth'],'height':system['windowHeight'],'font':system['fontSizeSetting'],'sdk':system['SDKVersion']})
    except (KeyError,TypeError): continue
(P/'capture-index.json').write_text(json.dumps(captures,ensure_ascii=False,indent=2),encoding='utf-8')
def link(name,base='global-ui-ux-audit-v1-evidence/'):
    return '['+name+']('+base+name+')'
def cell(s): return str(s).replace('|','\\|').replace('\n','<br>')
state={
 'pages/home/index':'已加载案例/首页', 'pages/assessment/intro':'说明/已有草稿',
 'pages/assessment/profile':'Demo当前画像；Production评估未完成',
 'pages/recommendation/result':'Demo相近候选；Production评估信息未就绪',
 'pages/institution/index':'目录/搜索空结果/清除恢复',
 'pages/institution/detail':'有效指定版本/推荐来源；缺少版本的受控错误态',
 'pages/institution/vr':'无已核验机构全景；无上下文错误',
 'pages/consultant/index':'Demo无机构的完整介绍；Production待配置',
 'pages/consultant/consultation':'Demo关联机构；Production待配置',
 'pages/service/ai-chat/index':'FAQ输入/本地回复；未读取老人画像',
 'pages/appointment/create':'Demo合法completed案例；Production预约服务未开放；缺少上下文',
 'pages/appointment/success':'无一次性回执的受控不可用态；成功态NOT_REACHED',
 'pages/mine/index':'Demo三类记录；Production匿名浏览',
 'pages/elder/index':'Demo两位老人；Production读取能力不可用',
 'pages/elder/detail':'Demo指定老人分组；Production详情不可用',
 'pages/assessment/history':'Demo列表及保存的当次快照；Production历史读取不可用',
 'pages/appointment/index':'Demo三记录/已完成筛选；Production服务不可用',
 'pages/visit/evaluation':'Demo合法completed三步/21评分/200字/已提交只读；Production无有效上下文',
 'pages/showcase/index':'Demo次级管理；Production受限提示',
 'pages/showcase/vr-real':'Demo机构上下文自动载入/独立工具手动空态/合成全景；Production不载入',
 'pages/showcase/map-real':'Demo城市路网/重试/拖动；Production不载入',
 'pages/service/policy/index':'政策阅读页正常态',
 'pages/service/education/index':'养老科普阅读页正常态',
 'pages/service/admission/index':'入住指南阅读页正常态',
}
interaction={
 'pages/home/index':'真实点击已加载案例→画像；双击推荐单导航',
 'pages/assessment/basic':'输入49/实际Next/内联错误不跳转；恢复78',
 'pages/assessment/profile':'真实点击推荐；双击仅一条页栈记录',
 'pages/recommendation/result':'候选滚入视口→实际tap→合法sourceContextRef详情',
 'pages/institution/index':'输入不存在名称→空结果→实际清除按钮恢复12条',
 'pages/institution/detail':'实际点击地图/VR/顾问；媒体返回保留原推荐上下文',
 'pages/consultant/index':'实际联系/FAQ；320/150%医疗回复在视口内',
 'pages/consultant/consultation':'联系/三问/关联预约；机构上下文回执',
 'pages/service/ai-chat/index':'点选问题/实际发送/可见本地FAQ回复；软键盘NOT_RUN',
 'pages/appointment/create':'Demo实际进入合法评价；Production未提交',
 'pages/visit/evaluation':'实际三步；21/21逐项滚动点击；200字；只读；本轮未新提交',
 'pages/appointment/index':'实际completed筛选；记录入口',
 'pages/showcase/map-real':'实际原生拖动/重试/返回',
 'pages/showcase/vr-real':'实际载入/拖动/拉近/返回',
}
byroute={r:[c for c in captures if c['route']==r] for r in routes}
matrix=[]
for r,cs in byroute.items():
    ds=[c for c in cs if c['mode']=='Demo']; ps=[c for c in cs if c['mode']=='Production']
    widths=sorted({c['width'] for c in ds if c['font']==16})
    fonts=sorted({c['width'] for c in ds if c['font']==24})
    picks=[]
    for mode in ['Demo','Production']:
        subset=[c for c in cs if c['mode']==mode]
        if subset: picks.append(subset[0]['name']+'.png')
    mode='DEMO_UI / PRODUCTION_UI' if ps else 'DEMO_UI；共享结构只读核对'
    result='REVIEWED：发现问题见清单' if any('/'+r in i['PAGE_ROUTE'] for i in issues) else 'REVIEWED：仅所列状态'
    if r=='pages/appointment/success': result='REVIEWED_CONTROLLED_STATE；成功回执NOT_REACHED'
    row={'ROUTE':'/'+r,'MODE':mode,'STATE_CHECKED':state.get(r,'六步表单现有合法演示答案/阅读页正常态'),
         'VIEWPORT_CHECKED':'D '+','.join(map(str,widths))+'px'+('；24字号@'+','.join(map(str,fonts)) if fonts else '')+('；P '+','.join(map(str,sorted({c['width'] for c in ps})))+'px' if ps else ''),
         'INTERACTION_CHECKED':interaction.get(r,'原生进入及可视内容检查；长页适用时滚动；未穷举所有按钮'),
         'EVIDENCE':picks,'RESULT':result}
    matrix.append(row)
(P/'coverage-matrix.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2),encoding='utf-8')
counts=collections.Counter(i['PRIORITY'] for i in issues)
b=json.loads((P/'baseline.json').read_text(encoding='utf-8'))
changed=[f for f,h in b['sourceHashes'].items() if not (R/f).exists() or hashlib.sha256((R/f).read_bytes()).hexdigest()!=h]
git=subprocess.check_output(['git','status','--short'],cwd=R,text=True)
verification={'time':datetime.datetime.now().isoformat(),'baselineCommit':b['head'],'sourceFilesCompared':len(b['sourceHashes']),'changedSourceFiles':changed,'gitStatus':git,'counts':dict(counts),'capturedRoutes':len([r for r,cs in byroute.items() if cs]),'productionRoutes':len({c['route'] for c in captures if c['mode']=='Production'})}
(P/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
report=['# Global UI/UX Audit V1\n',
'''## 执行摘要

`GLOBAL_UI_UX_AUDIT_V1 = PARTIAL`。全部30个注册路由已完成本轮原生页面巡检，核心页面已补真实320/375/430px和24字号投影。报告可供Owner选择修复批次，但不将尚未执行的软键盘、真实服务状态及全部异常状态标为通过，也不将首屏截图等同整页交互验收。

`SOURCE_CODE_CHANGED = NO`；`READY_FOR_OWNER_REVIEW = YES`（审查清单可审，不代表功能修复完成或发布就绪）。`DOC_IMPACT = AUDIT_ONLY`。

本轮只创建本报告和证据目录。未修改业务源码、样式Token、Contract、Fixture、实体/历史快照或正式数据；未commit、push、上传、提审、发布。
''',
f"- 注册路由：{len(routes)}，无子包；实际查看：{verification['capturedRoutes']}，完全未进入路由：{len(routes)-verification['capturedRoutes']}。\n- Production差异/受控状态原生查看：{verification['productionRoutes']}个路由，其余共享结构不冒充Production实测。\n- 已确认：P0 **{counts['P0']}**、P1 **{counts['P1']}**、P2 **{counts['P2']}**；另有Observation **{counts['Observation']}**。P0=0只表示本轮未确认P0。\n- 核心问题：窄屏字号及大字号响应不一致、正式预约不可用原因的标题表达；其余为局部排版、术语与记录文案。\n",
'''## 基线和证据边界

- 工作区：`C:\\Users\\16562\\WeChatProjects\\wuhan-eldercare-v2-1-b1-2-4`。
- HEAD：`7ae07b9b78e4502940fd9812c6a838e4ddf2cc06`；分支：`codex/v2-1-b1-2-4-card-actions-visual`。
- Owner在本任务提供体验版`1.2.6-demo.1025.0039`及`OWNER_EXPERIENCE_ACCEPTANCE=PASS`，属于Owner手动反馈。本轮检查本地构建，未重新核验后台体验版指向，也未上传。
- 初始已有`tokens.less`工作区状态提示和未跟踪的B1.2.6上传报告，均保留。源码逐字节前后比对见`verification.json`，不通过重写行尾清理Git状态。
- Delegate-before-deep-read：只读Agent核对30路由、无子包、模式组合和安全Gate；主会话执行原生查看和视觉判断。没有委派视觉实现。
- 视觉依据：原工程Warm Swiss V1.2 PDF（历史视觉基线）、当前FRONTEND_STRUCTURE、B1.2.4亮橙Owner Amendment、B1.2.5/6交接及当前冻结实现。历史PDF的色值不覆盖后续Owner已验收设计。
- 业务依据按Contract索引和相关实际页面/应用投影按需读取；本轮没有重算推荐或改写Assessment/Institution/VisitEvaluation语义。

### 本轮实际方法

使用已配置微信开发者工具Skill的CLI执行原生路由、元素tap/input、页面滚动、截图、元素offset/size/style；用Computer Use直接点击DevTools里的业务按钮和真实设备菜单，拖动map/Canvas。没有用浏览器HTML模拟WXML，也没有靠直接调用业务事件处理函数宣称点击成功。

320px为已有`TEST_ONLY_320x568`真实设备视口，375为iPhone mini，430为iPhone Pro Max；不是在430画面里缩窄内容。每张标准证据有同名JSON，记录路由/参数及同批视口系统快照；同一批会复用首个页面的systemInfo，宽度/字号固定，windowHeight不作为逐页几何测量。offset/size/style文件才是对应元素的独立读数。PNG像素宽408/479/549（正式窗口560）包含DevTools缩放，不能当作逻辑视口。拼图仅用于阅览，不用于像素测量。

150%通过DevTools字体菜单从16改成24，再重进页面，真实宽度不变；未修改业务状态、未mock视口或放宽权限。基本情况页10/12px在24设置下仍未变，属于发现的问题，不写成150%排版PASS。长顾问名、老人名、机构名和只读长摘要仅用页面展示字段投影，截图内注明投影，未改变Provider、ID或保存快照。离页/重编译后恢复。

Demo本轮SDK为3.17.3，Production窗口为2.32.3；两者运行时均为devtools。保留当前配置，差异结论不冒充同SDK对照实验。没有Android ADB/当前真机证据。
''',
'''## 页面覆盖矩阵

一行对应一个实际注册路由。DEMO_UI/PRODUCTION_UI表示实际取证模式；SHARED_UI是实现归属，不是用Demo替代Production通过。完整截图/参数/字号索引见证据目录`capture-index.json`与`README.md`。

| ROUTE | MODE | STATE_CHECKED | VIEWPORT_CHECKED | INTERACTION_CHECKED | EVIDENCE | RESULT |
| --- | --- | --- | --- | --- | --- | --- |
''']
for row in matrix:
    vals=[row[k] for k in ['ROUTE','MODE','STATE_CHECKED','VIEWPORT_CHECKED','INTERACTION_CHECKED']]
    vals+=['<br>'.join(link(f) for f in row['EVIDENCE']),row['RESULT']]
    report.append('| '+' | '.join(cell(v) for v in vals)+' |\n')
report += ['''
## 原生交互与几何摘录

| 实际检查 | 本轮结果与限制 | 证据 |
| --- | --- | --- |
| 首页→画像→推荐→指定机构 | 真实点击；双击推荐仅增加一个推荐页；详情保留institutionId/revision/recommendation/sourceContextRef | `demo-430-flow-*.json/png`、`demo-430-doubletap-stack.json` |
| 机构地图 | 首次截图底图未就绪；重试后看到道路，真实拖动改变城区视野，返回原机构；不把初始空白误报持续故障 | `demo-430-map-retry/drag/return` |
| 机构全景 | 合法机构上下文自动载入，实际拖动、拉近并返回同一机构；独立工具的手动空态仅记GUI-003 Observation | `demo-430-vr-enter/loaded/drag/zoom/return` |
| 顾问Tab/关联详情 | 联系、三问回复、关联预约均实点；Tab未虚构机构；未联系真人 | `demo-375-consultant-*`、`demo-375-faq-*`、`demo-375-booking-from-consultant` |
| 150%顾问回复 | 医疗回复left20/top79.83、width280/height269.56px，正文底349.40px，小于514px视口，截图回复可见 | `demo-320-font150-reply-offset/size.json`及PNG |
| 21项评分 | 21/21逐项滚动后tap，aria-checked均true；点击前top169.75–170.5px；普通评分控件375px下约60.67×44px | `matrix-21-taps.json`、`demo-375-matrix-group-*`、calls.jsonl |
| 评价三步与输入 | 实际进入三步；200字符计数200/剩余0；摘要/修改入口可见；提交前末项可滚到；未在本轮新增提交 | `demo-375-evaluation-*` |
| 已提交评价 | 使用合法预置garden Visit，已有只读摘要且没有提交按钮；不由日期造completed | `demo-320-evaluation-readonly*` |
| 档案/历史 | 两老人/两保存评估/三预约，保存快照分组及推荐差异可滚至末尾；不是当前草稿替代历史 | `demo-375-history-snapshot*`、记录页PNG |
| 空搜索/恢复 | 不存在名称显示0条和清除操作；真正点击清除按钮恢复12条 | `demo-430-search-empty`、`demo-430-search-clear-button` |
| 表单错误 | 输入49后实际点击Next仍停基本页；内联错误可见，之后恢复78；未伪造成功完成 | `demo-430-basic-age49/validation` |
| 本地FAQ | 实点问题及发送，已有批准FAQ回复显示在视口；未接入在线模型 | `demo-430-ai-before-send/reply` |
| 字号/控件尺寸 | 320下说明10px、输入12px、保存提示10px，输入框286×37px；16→24不变 | `demo-320-font-geometry.json`、`demo-320-font150-font-geometry.json` |

固定底栏检查区分“当前位置内容经过底栏”和“滚动到底后最后内容无法到达”：本轮375px六步末项、历史末尾和三步评价长摘要均可滚到，不把正常滚动经过底栏当成遮挡缺陷。软键盘尚无当前Android实证。

### 未达到状态 / 尚未执行

| 项目 | 标记 | 原因 |
| --- | --- | --- |
| Android软键盘、系统大字号、原生手势多指体验 | NOT_RUN | 本轮没有连接真机；DevTools与Owner历史PASS独立记录，不能替代当前专项证据 |
| Production真实登录、服务预约成功、合法一次性成功回执、真实联系 | NOT_REACHED | 当前能力受控不可用；不造身份/回执，不发真实预约/通信来凑覆盖 |
| Production合法completed评价与真实服务端失败重试 | NOT_REACHED | 无当前合法账号和Visit上下文；本轮未提交真实记录 |
| expired/unverified/unknown的全部排列、网络失败及长期loading | NOT_REACHED（未穷举） | 未改变业务时钟、核验事实或Provider来制造状态；已实测正式Geo/VR待确认及无资源态 |
| Demo管理重置后的空会话、全部管理模拟按钮 | NOT_RUN | 未清空当前会话来制造状态，保留当前演示记录；本轮加载导航重复进入不复制记录的表现已查，显式重新载入未实点 |
| 每个控件、每个选项、所有返回与重进排列 | NOT_RUN（未穷举） | 当前审查采用风险取样；直接路由的截图不算完整业务跳转；未把历史交互回归PASS改成本轮PASS |
| 全量阅读正文、所有深层展开及三视口每一滚动位置 | PARTIAL | 已查首屏/代表末尾及核心风险布局；尚非每一页面每一行的穷尽测量 |

因此总体保留PARTIAL；本轮已确认的问题可先审查，不宣称全量体验验收完成。

## 问题清单

推测原因均明确标注；建议仅为后续批次，没有实施。P0本轮未确认。
''']
for severity in ['P1','P2','Observation']:
    report.append('\n### '+severity+'\n\n')
    for issue in issues:
        if issue['PRIORITY']!=severity: continue
        report.append('#### '+issue['ISSUE_ID']+' — '+issue['ISSUE_TYPE']+'\n\n| 字段 | 记录 |\n| --- | --- |\n')
        for k,v in issue.items():
            if k=='EVIDENCE': v='<br>'.join(link(f) for f in v)
            report.append('| '+k+' | '+cell(v)+' |\n')
report += ['''
## 跨页一致性与建议批次

1. **字号与控件**：像素字体变量已用于Story/浏览页，旧评估与部分结果/助手保持rpx；同一次150%设置的响应明显不同。优先处理GUI-001，不能靠缩放截图或全块nowrap规避。
2. **标题与状态**：Demo目录旧称、正式预约面板的服务关闭/资料不可用混用是两个不同问题（GUI-002/008）。不将未知资料说成没有服务，也不开放预约Gate。
3. **媒体首次反馈**：地图重试后可用；机构上下文全景会自动载入，已撤回额外手动载入的业务缺陷判断；GUI-003只涉及次级工具可选提示，不是正式verification应放宽。
4. **文本节奏**：大字号短句孤字、历史差异通用提示重复、完成记录时间占位及Mock术语可局部改善。页边距/卡片密度允许按页面职责不同，不强行把Editorial和表单做成相同密度。
5. **颜色/按钮**：亮橙与实心青绿并存已列Observation；不把历史PDF陶土橙直接当作当前必须恢复的Token。没有观察到因此发生误操作，不建议全局换色。
6. **底栏/TabBar**：核心末项可达；应继续保留现有footer实测留位及安全区。软键盘是独立缺口，不用静态图补PASS。

| 建议批次 | 问题 | 最小范围 / 进入条件 | 必要回归 |
| --- | --- | --- | --- |
| A：受控态与局部文案 | GUI-008、002、005、007 | Owner选定标题/占位文案；仅展示映射；不动权限、实体与快照 | 对应错误态/记录、双构建与隔离相关检查 |
| B：Demo次级工具空态（可选） | GUI-003 | Owner决定是否改善独立工具空画面提示；保留机构上下文现有自动载入 | 320/375/430实际进入、加载/失败、拖动、返回；正式VR Gate回归 |
| C：共享字体适配 | GUI-001 | 单独开放冻结视觉的字体范围；不改全局Token、不变契约 | 六步/画像/推荐/助手，三视口150%、首错定位、底栏及真机键盘 |
| D：排版与差异可读性 | GUI-004、006 | 保留完整字段语义与推荐顺序；Owner确认语义断行和重复提示分组 | 长名/长摘要、大字体、快照不变 |
| E：产品/视觉取舍 | GUI-O01/O02/O03 | 先由Owner明确按钮强调色、首页优先级、草稿与保存案例称谓 | 获授权后再定；本轮不实施 |

### 不建议本轮直接实施

- 不为截图补造机构地址/Geo、VR实景、真实顾问联系方式、床位/价格或核验状态。
- 不为消除空态开放正式服务、调用真实拨号/客服/预约、注入伪账号或completed Visit。
- 不删除必要Demo来源，不以评价改变机构事实/推荐；不改Assessment字段、21评分与独立费用判断。
- 不全局重设颜色、字号或缩减复杂表单来贴图；真正契约变化须另开明确后继版本。

## 历史证据的使用与当前文档

参考B1.2.4交接及Owner亮橙补充、B1.2.5连续性报告、B1.2.6冻结/顾问专项/上传交付记录，用于定位合法入口与既有边界。本轮未重复历史全部构建/自动化检查，其PASS只属于历史记录。旧上传报告仍可能保留PENDING_OWNER的当时快照，本任务Owner新反馈作为本报告基线单独记录；没有擅自改写已有未提交上传文档。

本轮没有结构或契约变更，FRONTEND_STRUCTURE及Contract不改。源文件完整性、问题字段与本报告证据链接另行核对；没有因此触发无关全项目测试或文档治理修复。

## 取证异常与排除项

VR初步判断曾混用独立工具空态与机构业务入口；补查320/430截图及实际组合source的sampleActive/resolveStory后，确认机构入口自动载入，GUI-003降为可选Observation。没有把初步判断保留为已确认P1。

早期Promise型automation_evaluate导致DevTools克隆错误，随后出现无效webview/空白；恢复后改用已注册runtime/element查询，不将那组空白算产品缺陷或有效覆盖。初始CMD包装器截断带&的详情查询，保留为缺少版本的受控错误截图；后续使用官方CLI入口安全传参，并通过真实推荐点击取得完整sourceContextRef。

工具对空字符串input及部分伪类选择器的行为不符合预期：`demo-430-search-clear.png`未清空，不算通过；有效清除证据为`demo-430-search-clear-button.png`。评价第三步以之后真实Computer Use点击及最终覆盖截图为准，不把失败的查找/误选步骤列PASS。原始calls.jsonl包含成功与失败，任务job文件是操作计划，不是自动通过回执。

模拟器窗口切换/字号切换后的旧帧及首帧空地图不做缺陷依据；实际地图路网、全景加载和拖动都有后续原生证据。Native窗口快照观察时先聚焦对应窗口，防止遮挡混淆。报告不引用浏览器页面作为小程序运行证据。

## 交付与后续

本报告和证据是本轮新增未提交成果，保持原有dirty文件；源文件前后字节比对结果见`verification.json`。审查状态为PARTIAL，问题清单可供Owner排序与授权。下一步等待Owner选择修复批次或补充设备/受限状态验收，不自动实施修复或发布操作。
''']
(R/'docs/design/GLOBAL_UI_UX_AUDIT_V1.md').write_text(''.join(report),encoding='utf-8')
readme=['# 原生证据索引\n\n同名JSON记录原生route/query/system信息；PNG为原生WXML/WXSS。job文件只是操作计划，calls.jsonl保留失败。展示投影在文件名标为long/font150，不改变快照。完整矩阵与限制见主报告。\n\n| 模式 | 路由 | 逻辑宽/字号 | 截图 | 元数据 |\n| --- | --- | --- | --- | --- |\n']
for c in captures:
    readme.append('| '+c['mode']+' | /'+c['route']+' | '+str(c['width'])+' / '+str(c['font'])+' | '+link(c['name']+'.png','')+' | '+link(c['name']+'.json','')+' |\n')
(P/'README.md').write_text(''.join(readme),encoding='utf-8')
print(json.dumps(verification,ensure_ascii=False,indent=2))
