"""Build Batch A handoff from measured files; does not modify source or Git."""
import pathlib, json, subprocess, hashlib, datetime
P = pathlib.Path(__file__).resolve().parent
R = P.parents[2]
E = P.name+'/'
baseline = json.loads((P/'baseline.json').read_text(encoding='utf-8'))
checks = json.loads((P/'regression-results.json').read_text(encoding='utf-8'))
builds = {m:json.loads((R/f'dist/{m}/.shared-build.json').read_text(encoding='utf-8')) for m in ['demo','production']}
changed = [f for f,h in baseline['hashes'].items() if not (R/f).exists() or hashlib.sha256((R/f).read_bytes()).hexdigest()!=h]
new = [f.relative_to(R).as_posix() for d in ['miniprogram','modes','scripts'] for f in (R/d).rglob('*') if f.is_file() and f.relative_to(R).as_posix() not in baseline['hashes']]
assert all(hashlib.sha256((R/f).read_bytes()).hexdigest()==h for f,h in baseline['protectedUntracked'].items())
assert 'miniprogram/styles/tokens.less' not in changed
assert all(c['exitCode']==0 for c in checks)
captures = []
for f in sorted(P.glob('*.json')):
    try:
        d=json.loads(f.read_text(encoding='utf-8-sig'))
        page=d['page']['result']['currentPage']; system=d['system']['result']['systemInfo']['result']
        if not (P/(f.stem+'.png')).exists(): continue
        captures.append({'name':f.stem, 'route':page['path'], 'query':page.get('query',{}), 'width':system['windowWidth'], 'height':system['windowHeight'], 'font':system['fontSizeSetting'], 'platform':system['platform'], 'sdk':system['SDKVersion'], 'mode':'Production' if f.stem.startswith('production-') else 'Demo'})
    except (KeyError,TypeError): pass
(P/'capture-index.json').write_text(json.dumps(captures,ensure_ascii=False,indent=2),encoding='utf-8')
verification = {'time':datetime.datetime.now().isoformat(), 'baseline':baseline['head'], 'changedExistingSourceFiles':changed, 'newSourceFiles':new, 'protectedPriorReportsUnchanged':True, 'tokensBytesUnchanged':True, 'gitStatus':subprocess.check_output(['git','status','--short'],cwd=R,text=True), 'builds':builds, 'regressions':len(checks)}
(P/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
def link(name, root=E): return '['+name+']('+root+name+')'
report = ['''# GLOBAL_UI_UX_FIX_BATCH_A_V1

`GLOBAL_UI_UX_FIX_BATCH_A_V1 = READY_FOR_OWNER_REVIEW`。2026-10-25，北京时间。本轮只修复GUI-008、002、005、007的展示；没有扩大为全站视觉改造。

| ISSUE_ID | 最终状态 | 结论 |
| --- | --- | --- |
| GUI-008 | FIXED_AND_VERIFIED | 正式服务关闭独立展示；真实机构读取失败/路由错误保留；返回正常，提交仍受限 |
| GUI-002 | FIXED_AND_VERIFIED | Demo/Production普通目录导航均为“养老机构”；推荐上下文标题未变 |
| GUI-005 | FIXED_WITH_GAPS | 完成且无日期显示“看院时间：未记录”；时间语义已修复，但320/150%记录页长评价按钮仍有既有裁切，未授权改样式 |
| GUI-007 | FIXED_AND_VERIFIED | 仅Demo卡片移除确切Mock后缀；演示来源标识及推荐快照、排序不变 |

`DOC_IMPACT = AUDIT_ONLY`。未commit、push、上传、提审或发布。没有改变已上传体验版1.2.6-demo.1025.0039；本地改动等待Owner审查，不冒充新版已交付手机。

## 基线与范围

- 工作区：`C:\\Users\\16562\\WeChatProjects\\wuhan-eldercare-v2-1-b1-2-4`。
- 基线提交：`7ae07b9b78e4502940fd9812c6a838e4ddf2cc06`；分支`codex/v2-1-b1-2-4-card-actions-visual`。
- 原有tokens.less状态、上传交接记录、全站审查报告和证据均保留；没有清理、重写行尾或暂存。前后文件摘要见`baseline.json`/`verification.json`。
- 已读取审查报告、原生证据索引、B1.2.6交接；交互以WeChat Interaction V2、Runtime政策和适用预约Contract为边界。日期偏好不是运营确认时间，不以日期经过推导completed。
- 独立只读QA核对最终diff与9项回归记录，未发现阻断性Contract、持久化或排序越界；未将Agent审查冒充原生验收。

## 四项根因与修改

### GUI-008

原`canRequestInstitutionService=false`与真实资料读取失败共用`institution_unavailable`，WXML把两者都称为“机构资料暂不可用”。新增的`service_unavailable`仅为页面展示状态，不是业务状态机字段。

服务Gate仍为onLoad第一分支，Production策略仍固定false。关闭态标题为“预约服务尚未开放”，说明为“目前暂不支持在线提交看院预约。您可以先浏览养老机构资料，了解服务内容。”，按钮为“返回养老机构”。返回失败文案同步中性化。机构读取失败、指定版本不可用、无名称及无效路由沿用各自错误态，不换版本、不开放提交。

文件：`miniprogram/pages/appointment/create.ts`、`create.wxml`。原生点击返回确实进入机构目录；隔离VM检查关闭时零资料读取/零提交，以及返回失败可重试。Gate-on错误分支仅在测试VM通过stub验证，没有修改正式Gate或在DevTools伪造正式可用资料。

### GUI-002

基础WXML导航保留旧称“合作机构”，而Production构建会替换成“养老机构”。直接将同一导航标题改为“养老机构”；不改资料、排序、搜索或核验状态。`sourceContextRef`对应正文“推荐机构资料”保留。首页既有“查找养老机构”等入口语义一致，未扩大改首页。

文件：`miniprogram/pages/institution/index.wxml`。Demo虚构/演示来源标识继续保留，不新增合作关系断言。

### GUI-005

原Demo记录与创建页对所有状态硬编码“预约时间：具体时间待确认”。新增Demo专用纯展示函数`appointmentTimePresentation`，两页共用：completed缺时间→“看院时间 / 未记录”；cancelled缺时间→“预约时间 / 未记录”；requested/contacting/scheduled缺时间仍为“预约时间 / 具体时间待确认”；显式已格式化日期则原样展示。

当前DemoFlow本来没有日期字段，因此页面不从assessment完成时间、acceptedAt或当前日期补造看院时间；未加持久化字段、未改Fixture状态。正式owner-read已有visitDate/visitTimePreference展示未改，也没有把其请求偏好包装为实际完成时间。

文件：`modes/demo/appointment-time.ts`、`record-pages.ts`、`pages/appointment/create.ts`、`pages/appointment/create.wxml`。五状态×有/无日期的10例见`appointment-time-matrix.json`，这是纯展示函数的TEST_ONLY输入覆盖；不是伪造五种真实页面记录。实际原生数据含requested/completed，页间映射、completed评价入口与重复加载另行集成验证。

### GUI-007

合成Fixture中区域原值有`（Mock 演示目录）`后缀，原投影直接拼到卡片。仅在Demo构建组合中对既有syntheticIdentity+unverified区域显示移除这个确切后缀。原始Fixture、字段、provenance、snapshot均不变，Production不执行该映射。

文件：`scripts/support/demo-story-composition.mjs`。页面继续显示“演示数据 · 虚构机构”和“演示区域：江岸区”。修复前后完整卡片view model比较只允许这一后缀差异，身份/revision、顺序、数量、原因、差异和其余字段完全一致，见`recommendation-before.json`及专项检查。

## 修改文件

以下为本批源码与针对性测试，不含原有dirty文件：
''']
report += ['\n'.join('- `'+f+'`' for f in changed+new)+'\n']
report += ['''
新增文档为本报告和本批证据目录；原GLOBAL_UI_UX_AUDIT_V1及冻结交接保持历史事实，不回写为“全站已修复”。专项脚本直接运行`node scripts/check-global-ui-ux-batch-a.mjs`，未改package.json脚本配置。

## 修改前后截图

修复前直接引用上一轮实际WXML/WXSS截图；修复后为本轮新构建。截图像素宽受模拟器缩放影响，以同名JSON的逻辑宽/字号为准。

[四项前后对照总览](global-ui-ux-fix-batch-a-v1-evidence/before-after-overview.jpg)仅作阅览缩图；原始截图见下表。

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
''']
for title,before,after in [
 ('GUI-008 / Production320','production-320-appointment-create.png','production-320-closed.png'),
 ('GUI-002 / Demo375','demo-375-institution-index.png','demo-375-directory.png'),
 ('GUI-005 / Demo320创建页','demo-320-appointment-create.png','demo-320-booking.png'),
 ('GUI-005 / Demo375已完成筛选','demo-375-appointments-completed.png','demo-375-completed-filter.png'),
 ('GUI-007 / Demo375推荐','demo-375-recommendation-result.png','demo-375-recommendation.png'),
]:
    report.append('| '+title+' | '+link(before,'global-ui-ux-audit-v1-evidence/')+' | '+link(after)+' |\n')
report += ['''
## 原生尺寸、交互与几何

使用已有微信开发者工具官方CLI与Computer Use实际设备菜单/坐标点击，真实WXML/WXSS；不以HTML、直接调用页面业务handler或Mock宽度替代。320为TEST_ONLY_320x568，375为iPhone mini，430为Pro Max；150%为16→24字号投影，不是Android系统测试。每张截图独立读取当前route/query/systemInfo，没有复用其他页面的windowHeight。

Demo SDK3.17.3，Production SDK2.32.3，platform均为devtools；保留既有运行配置，不把不同SDK当作严格同环境实验。完整逐图索引与几何JSON见证据README。

| 页面 / 模式 | 320 | 375 | 430 | 320/150% |
| --- | --- | --- | --- | --- |
''']
for mode,label in [('demo','directory'),('demo','recommendation'),('demo','booking'),('demo','records'),('production','directory'),('production','closed')]:
    report.append('| '+mode+'/'+label+' | '+' | '.join(link(mode+'-'+size+'-'+label+'.png') for size in ['320','375','430','320-font150'])+' |\n')
report += ['''
初始/末尾与推荐中段截图用于区分“滚动经过导航”与“最后内容不可到达”。新时间占位、目录标题、区域文案和服务关闭提示未见新增裁切/孤字/横向溢出；创建页末尾动作可滚到。150%记录页原有“查看看院评价”按钮文字确有裁切，相关文案、CSS及按钮路径均未改，本报告不标整页视觉PASS；保留给字体/按钮后续批次。

实际页面跳转与搜索证据在本目录的interaction文件及calls.jsonl；原生操作与测试VM证据分开，不将单元测试当作真实手机点击。合法completed评价仍可进入；没有在本轮提交新评价。服务关闭页不出现预约提交入口，也未联系真实机构或顾问。`interaction-results.json`逐条核对六次跳转的实际route/query：普通目录→详情、推荐→指定机构（revision=1、recommendation及sourceContextRef完整）、返回推荐、completed看院→评价、返回看院安排、正式关闭页→目录。另有搜索“春和”及实际清除按钮恢复12条的前后截图。

独立几何示例（CSS逻辑px，详见同名offset/size文件）：

| 条件 / 元素 | 宽×高 |
| --- | ---: |
| Demo320/150% 创建页story-shell | 320×888.32 |
| Demo320/150% 推荐recommendation-shell | 286×2884.57 |
| Demo320/150% 记录demo-records | 294×1804.01 |
| Production320/150% 关闭页page-shell | 286×434 |
| Production375 关闭页page-shell | 335×559 |
| Production430 关闭页page-shell | 386×625 |
| Demo375 创建页story-shell | 375.33×625 |
| Demo430 创建页story-shell | 430×598.60 |

高度超过视口时以实际滚到底的截图判断末项可达；375.33为既有rpx子像素读数，不将小数取整冒充严格像素边界。容器宽度本身不能证明内部按钮文字没有裁切，记录页已如实单列风险。

原始calls.jsonl保留设备/字号切换后的automator超时，以及早期错误测量选择器`.page-shell`在推荐页未找到的失败。恢复编译后使用`.recommendation-shell`，有效覆盖以最终截图/元数据为准；job文件只是计划，不是PASS记录。预约runtime两处旧文案断言同步更新后通过，早期记录保留在`regression-before-copy-expectation-update.json`。

## 构建、兼容与回归

| 命令 | 结果 |
| --- | --- |
''']
for c in checks: report.append('| `'+' '.join(c['command'])+'` | PASS |\n')
report += ['\n结果为本轮实际执行，见'+link('regression-results.json')+'。9组包括专项、B1.2.5连续性、B1.2.6 Story/顾问定位/重复加载、模式隔离、双JS、预算、推荐UI及预约runtime；没有无依据重跑全项目。\n']
report += ['''
### 包体积

| 构建 | 本轮runtime bytes | 历史对照 | 增量 | 原预算 | 剩余 |
| --- | ---: | ---: | ---: | ---: | ---: |
''']
for m,old in [('demo',1942871),('production',1341026)]:
    n=builds[m]['packageBytes'];report.append(f'| {m} | {n:,} | {old:,} | +{n-old:,} | 2,031,616 | {2031616-n:,} |\n')
report += ['''
构建成功，未提高预算。以上为运行文件字节求和；本轮微信最终上传包`NOT_RUN`，未上传，不能将runtime bytes描述为最终微信包体积。

## 隔离与剩余风险

- Production Gate仍false；真实请求、登录、电话、客服、Storage、外部导航等Demo限制保留。构建隔离检查确认正式产物不含Demo顾问、Story Provider、演示管理或合成资源。
- Assessment/ElderProfile/Recommendation领域算法、Institution事实与revision、Fixture、快照、地图/VR/顾问/评价数据及所有样式Token未改。只读QA未发现越界。
- GUI-005时间文案已验证，320/150%长评价按钮裁切尚未关闭；字体响应及旧孤字仍属于原GUI-001/004后续范围。本轮不为补齐视觉PASS改全局Token或组件。
- 五态日期矩阵属于展示层测试，现有Demo无日期字段；正式Gate-on真实机构读取失败只在隔离VM验证，未放开正式Gate制造原生可用状态。
- `ANDROID_RETEST = NOT_RUN`；本轮没有Android真机/软键盘/系统字号证据，Owner此前B1.2.6 PASS不扩展为本批手机验收。
- 后续建议先由Owner确认本批文案及剩余按钮风险，再授权GUI-001/004字体与换行批次；GUI-006、媒体可选提示和产品取舍仍未实施。

本轮完成后停止，等待Owner审阅；不自动提交、上传或发布。
''']
(R/'docs/design/GLOBAL_UI_UX_FIX_BATCH_A_V1.md').write_text(''.join(report),encoding='utf-8')
readme=['# Batch A 原生证据索引\n\nPNG是原生渲染；同名JSON记录独立route/query/system。offset/size是元素独立实测，拼图仅供阅览；calls.jsonl含失败，jobs不是通过回执。\n\n| 模式 | 路由 | 逻辑宽/字号 | PNG | 元数据 |\n| --- | --- | --- | --- | --- |\n']
for c in captures:readme.append('| '+c['mode']+' | /'+c['route']+' | '+str(c['width'])+'/'+str(c['font'])+' | '+link(c['name']+'.png','')+' | '+link(c['name']+'.json','')+' |\n')
readme+=['\n时间矩阵为纯展示helper，不是业务状态投影或持久化日期；新旧推荐卡片逐字段比较见recommendation-before.json和专项脚本。\n']
(P/'README.md').write_text(''.join(readme),encoding='utf-8')
print(json.dumps({'captures':len(captures),'changedSource':changed,'newSource':new,'regressions':len(checks),'budgets':{m:builds[m]['packageBytes'] for m in builds}},ensure_ascii=False,indent=2))
