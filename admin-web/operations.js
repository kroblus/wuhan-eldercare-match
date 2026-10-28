'use strict'
const visitText={DRAFT:'待双方确认',CONFIRMED:'已确认',CANCELLED:'已取消',ARRIVED:'已到访',NO_SHOW:'未到访'}
const resultText={CONNECTED:'已接通',NO_ANSWER:'未接通',REFUSED:'拒绝联系（结束联系）',MOVED_IN:'反馈已入住',NOT_MOVED_IN:'反馈未入住',UNKNOWN_FEEDBACK:'入住情况未知'}
const eventText={REQUEST_SUBMITTED:'提交申请',REQUEST_CANCELLED:'取消申请',FOLLOWUP:'联系 / 反馈',VISIT_SAVE_DRAFT:'保存待确认',VISIT_CONFIRM:'双方确认带看',VISIT_RESCHEDULE:'改期',VISIT_CANCEL:'取消这场',VISIT_ARRIVE:'记录到访',VISIT_NO_SHOW:'记录未到访'}
const pendingOperations=new Map()
let reportSnapshot=null, reportGeneration=0, calendarGeneration=0
window.clearP1Operations=()=>{pendingOperations.clear();reportSnapshot=null;++reportGeneration;++calendarGeneration;$('reportPreview').replaceChildren();$('calendarEntries').replaceChildren();$('downloadReport').disabled=true}
const beijingInput=value=>value?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):''
const utcInput=value=>value?new Date(value+':00+08:00').toISOString():null
const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10)
for(const name of ['calendarFilter','reportFilter']) { $(name).elements.from.value=today;$(name).elements.to.value=today }
$('fontSize').addEventListener('change',event=>{document.documentElement.style.fontSize=event.target.value+'px';document.body.dataset.fontPercent=event.target.value==='24'?'150':'100'})
function field(form,label,name,type='text',value='',options=null) {
  const wrapper=element('label',label),input=document.createElement(options?'select':type==='textarea'?'textarea':'input');input.name=name
  if(options)for(const [key,text] of Object.entries(options)){const o=element('option',text);o.value=key;input.append(o)}
  else if(type!=='textarea')input.type=type
  if(type==='checkbox')input.checked=!!value;else input.value=value===null?'':value
  if(type==='number'){input.min='0';input.max='240'}
  wrapper.append(input);form.append(wrapper);return input
}
let serviceInstitutionRows=[]
function institutionChoices(){return Object.fromEntries(serviceInstitutionRows.filter(row=>row.enabled).map(row=>[row.institutionId,row.institutionName]))}
window.setP1InstitutionChoices=rows=>{
  if(!Array.isArray(rows)||!rows.every(row=>row&&typeof row.institutionId==='string'&&typeof row.institutionName==='string'&&typeof row.enabled==='boolean'))throw Error('机构服务名单格式不正确。')
  serviceInstitutionRows=rows
  for(const select of document.querySelectorAll('.institution-options,.institution-active-options')){
    const selected=select.value,old=select.selectedOptions[0],placeholder=select.dataset.placeholder||select.options[0]?.textContent||'请选择'
    select.dataset.placeholder=placeholder;select.replaceChildren()
    const blank=element('option',placeholder);blank.value='';select.append(blank)
    for(const row of rows.filter(row=>!select.classList.contains('institution-active-options')||row.enabled)){
      const option=element('option',row.institutionName+(row.enabled?'':'（已停用）'));option.value=row.institutionId;select.append(option)
    }
    if(selected&&!Array.from(select.options).some(option=>option.value===selected)){const option=element('option',old?.textContent||selected+'（历史机构）');option.value=selected;select.append(option)}
    select.value=selected
  }
}
function formSection(title){const section=element('section','', 'operation-section');section.append(element('h3',title));const form=document.createElement('form');form.className='operation-form';section.append(form);return {section,form}}
function mutationForm(form,key,path,bodyFactory,onSaved) {
  const feedback=element('p','','operation-feedback');feedback.setAttribute('role','status');form.append(feedback)
  const submit=element('button',pendingOperations.has(key)?'使用原操作重试':'保存记录','primary');submit.type='submit';form.append(submit)
  const lockFields=locked=>{for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=locked}
  if(pendingOperations.has(key)){lockFields(true);feedback.textContent='上次结果未确认。将重试保留的原文与编号；也可先刷新详情核对。'}
  let busy=false
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return
    let body=pendingOperations.get(key)
    if(!body){try{body=bodyFactory();pendingOperations.set(key,body)}catch(_){feedback.textContent='请检查时间与必填项。';return}}
    busy=true;submit.disabled=true;lockFields(true);const sessionEpoch=epoch
    try{
      await api(path,{method:'POST',headers:{'X-P1-CSRF':csrf},body:JSON.stringify(body)})
      pendingOperations.delete(key);if(sessionEpoch!==epoch)return
      ++calendarGeneration;$('calendarEntries').replaceChildren(element('p','记录已更新，请重新查询日程以查看最新安排。'))
      feedback.textContent='服务器已保存。';await onSaved()
    }catch(error){
      if(sessionEpoch!==epoch)return
      if(error.httpStatus>=400&&error.httpStatus<500){pendingOperations.delete(key);lockFields(false);submit.textContent='核对后重新保存'}
      else submit.textContent='使用原操作重试'
      feedback.textContent=error.message || '结果尚未确认，请使用原操作重试。'
    }finally{busy=false;submit.disabled=false;if(!pendingOperations.has(key)){lockFields(false);submit.textContent='保存记录'}}
  })
}
function renderOperations(result) {
  const item=result.item,id=item.id,synthetic=item.datasetMode==='SYNTHETIC_TEST_ONLY',root=$('detail')
  const recorded=new Set(result.events.map(event=>event.operationId).filter(Boolean));for(const [key,body] of pendingOperations)if(recorded.has(body.operationId))pendingOperations.delete(key)
  for(const button of $('list').children)if(button.dataset.requestId===id&&button.querySelector('strong'))button.querySelector('strong').textContent=kindText[item.kind]+' · '+statusText[item.status]
  const refresh=element('button','刷新这份需求');refresh.addEventListener('click',()=>loadDetail(id,null));root.append(refresh)
  if(result.nextContact&&result.nextContact.nextContactAt&&!['CANCELLED','CLOSED'].includes(item.status))root.append(element('p',`下一动作：${result.nextContact.nextAction} · ${time(result.nextContact.nextContactAt)}（北京时间）`,'banner'))
  if(item.status!=='CANCELLED') {
    const {section,form}=formSection('记录本次联系与后续反馈')
    const contactOptions=['CLOSED'].includes(item.status)?Object.fromEntries(Object.entries(resultText).filter(([key])=>!['CONNECTED','NO_ANSWER','REFUSED'].includes(key))):resultText
    field(form,'实际联系 / 反馈结果','result','text','CONNECTED',contactOptions)
    field(form,'内部备注（不返回普通用户）','note','textarea').maxLength=500
    field(form,'下次联系（北京时间，选填）','nextContactAt','datetime-local')
    field(form,'下一动作（有下次时间时必填）','nextAction').maxLength=200
    field(form,'入住反馈来源（反馈时必填）','feedbackSource','text','',{'':'未记录',FAMILY:'家属明确反馈',INSTITUTION:'机构明确反馈',CONSULTANT:'顾问明确核实'})
    field(form,'反馈关联机构（反馈时必填）','institutionId','text','',{'':'请选择',...institutionChoices()}).className='institution-active-options'
    form.append(element('p','拒绝联系将结束待办并取消未完成行程。入住只记录反馈，不涉及签约、收费或结算。','muted'))
    mutationForm(form,id+'/followup','/requests/'+id+'/followups',()=>{const d=new FormData(form);return {operationId:crypto.randomUUID(),result:d.get('result'),note:String(d.get('note')).trim()||null,nextContactAt:utcInput(d.get('nextContactAt')),nextAction:String(d.get('nextAction')).trim()||null,feedbackSource:d.get('feedbackSource')||null,institutionId:d.get('institutionId')||null}},()=>loadDetail(id,null))
    root.append(section)
  }
  root.append(element('h3','逐场带看安排'))
  if(!item.visits.length)root.append(element('p','尚无安排。意向不会自动确认或占用时段。','muted'))
  for(const visit of item.visits){
    const card=element('article','','visit-card');card.append(element('h4',visit.institutionName+' · '+visitText[visit.status]),element('p',`${time(visit.start)} 至 ${time(visit.end)}（北京时间）`),element('p',`负责人：${visit.staffId} · 前缓冲 ${visit.bufferBefore} 分钟 / 后缓冲 ${visit.bufferAfter} 分钟`),element('p','集合说明：'+visit.meetingNote))
    if(visit.actualAt)card.append(element('p','实际记录：'+time(visit.actualAt)))
    if(['DRAFT','CONFIRMED'].includes(visit.status)&&!['CANCELLED','CLOSED'].includes(item.status)){
      card.append(visitEditor(item,visit))
      const {form,section}=formSection('这场的取消 / 到访结果')
      field(form,'操作','action','text','CANCEL',visit.status==='CONFIRMED'?{CANCEL:'取消这场',ARRIVE:'记录已到访',NO_SHOW:'记录未到访'}:{CANCEL:'取消这场'})
      field(form,'实际时间（到访 / 未到访时必填，北京时间）','actualAt','datetime-local',beijingInput(new Date().toISOString()))
      mutationForm(form,id+'/'+visit.id+'/outcome','/requests/'+id+'/visits',()=>{const d=new FormData(form);return {operationId:crypto.randomUUID(),visitId:visit.id,expectedRevision:visit.revision,action:d.get('action'),...(d.get('action')==='CANCEL'?{}:{actualAt:utcInput(d.get('actualAt'))})}},()=>loadDetail(id,null));card.append(section)
    }
    root.append(card)
  }
  if(!['CANCELLED','CLOSED'].includes(item.status))root.append(visitEditor(item,null))
  root.append(element('h3','实际事件（内部）'))
  const events=[...result.events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt))
  for(const event of events){const details=event.details||{};const line=element('div',`${eventText[event.type]||'已记录事件'} · ${time(event.occurredAt)}`,'event');
    if(event.type==='FOLLOWUP'){line.append(element('p',resultText[details.result]||details.result));if(details.note)line.append(element('p',details.note));if(details.feedbackSource)line.append(element('p','反馈来源：'+({FAMILY:'家属',INSTITUTION:'机构',CONSULTANT:'顾问'})[details.feedbackSource]))}
    root.append(line)
  }
}
function visitEditor(item,visit) {
  const {section,form}=formSection(visit?(visit.status==='CONFIRMED'?'改期（重新取得双方确认）':'编辑待确认行程'):'新增另一场带看')
  const key=item.id+'/'+(visit?visit.id:'new')+'/schedule',saved=pendingOperations.get(key),v=saved||visit||{}
  const selectedInstitution=v.institutionId||item.institutionId||'',choices={'':'请选择机构',...institutionChoices()}
  if(selectedInstitution&&!choices[selectedInstitution])choices[selectedInstitution]=(v.institutionName||item.institutionName||selectedInstitution)+'（历史机构，需重新核对接入状态）'
  field(form,'机构','institutionId','text',selectedInstitution,choices).className='institution-active-options'
  field(form,'带看负责人标识（同一人请保持一致）','staffId','text',v.staffId||'顾问一').maxLength=80
  field(form,'开始（北京时间）','start','datetime-local',beijingInput(v.start)).required=true
  field(form,'结束（北京时间）','end','datetime-local',beijingInput(v.end)).required=true
  field(form,'提前准备缓冲（分钟）','bufferBefore','number',v.bufferBefore||0)
  field(form,'结束后交通缓冲（分钟，可调，未测路线）','bufferAfter','number',v.bufferAfter||0)
  field(form,'集合与出行说明（用户可见）','meetingNote','textarea',v.meetingNote||'').maxLength=300;form.elements.meetingNote.required=true
  field(form,'已取得家属确认','familyConfirmed','checkbox',!!v.familyConfirmed)
  field(form,'已取得机构确认','institutionConfirmed','checkbox',!!v.institutionConfirmed)
  if(!visit||visit.status==='DRAFT')field(form,'保存方式','action','text',v.action||'SAVE_DRAFT',{SAVE_DRAFT:'仅存待确认，不占用时段',CONFIRM:'双方确认，核对冲突后排期'})
  form.append(element('p','确认 / 改期以服务器事务结果为准。失败保留原安排；不会自动发送消息。','muted'))
  mutationForm(form,key,'/requests/'+item.id+'/visits',()=>{const d=new FormData(form);return {operationId:crypto.randomUUID(),visitId:visit?visit.id:crypto.randomUUID(),expectedRevision:visit?visit.revision:0,action:visit&&visit.status==='CONFIRMED'?'RESCHEDULE':d.get('action'),institutionId:d.get('institutionId'),staffId:String(d.get('staffId')).trim(),start:utcInput(d.get('start')),end:utcInput(d.get('end')),bufferBefore:Number(d.get('bufferBefore')),bufferAfter:Number(d.get('bufferAfter')),familyConfirmed:d.get('familyConfirmed')==='on',institutionConfirmed:d.get('institutionConfirmed')==='on',meetingNote:String(d.get('meetingNote')).trim()}},()=>loadDetail(item.id,null))
  return section
}
$('calendarFilter').addEventListener('submit',async event=>{
  event.preventDefault();const generation=++calendarGeneration,sessionEpoch=epoch,form=event.target;const query=new URLSearchParams(new FormData(form));const target=$('calendarEntries');target.textContent='读取日程…'
  try{const result=await api('/calendar?'+query);if(generation!==calendarGeneration||sessionEpoch!==epoch)return;target.replaceChildren()
    target.append(element('p',result.capacities.length?result.capacities.map(c=>`${c.institutionName}：已手工配置同时接待 ${c.capacity} 组`).join('；'):'机构接待容量未配置，不额外限制组数；负责人和本人冲突仍须检查。','muted'))
    for(const v of result.visits){const button=element('button',`${time(v.start)} — ${time(v.end)} · ${v.institutionName} · ${v.staffId} · ${visitText[v.status]}`,'request');button.addEventListener('click',()=>loadDetail(v.requestId,null));target.append(button)}
    for(const b of result.blocks){const row=element('p',`${b.staffId} 不可用：${time(b.start)} — ${time(b.end)} `);const remove=element('button','移除不可用时段');remove.addEventListener('click',async()=>{remove.disabled=true;try{await api('/resources',{method:'POST',headers:{'X-P1-CSRF':csrf},body:JSON.stringify({action:'REMOVE_BLOCK',blockId:b.id})});form.requestSubmit()}catch(e){$('message').textContent=e.message}finally{remove.disabled=false}});row.append(remove);target.append(row)}
    if(!result.visits.length&&!result.blocks.length)target.append(element('p','该区间没有安排或不可用时段。'))
  }catch(e){if(generation===calendarGeneration&&sessionEpoch===epoch)target.textContent=e.message}
})
function renderResources(){
  const {form,section}=formSection('登记负责人不可用')
  field(form,'负责人标识','staffId','text','顾问一').required=true;field(form,'开始（北京时间）','start','datetime-local').required=true;field(form,'结束（北京时间）','end','datetime-local').required=true
  mutationForm(form,'resource-block','/resources',()=>{const d=new FormData(form);return {action:'BLOCK',blockId:crypto.randomUUID(),staffId:String(d.get('staffId')).trim(),start:utcInput(d.get('start')),end:utcInput(d.get('end'))}},()=>{form.reset();$('calendarFilter').requestSubmit()});$('resources').append(section)
  const capacity=formSection('仅在机构明确限定时设置容量')
  field(capacity.form,'机构','institutionId','text','',{'':'请选择机构',...institutionChoices()}).className='institution-active-options'
  const input=field(capacity.form,'同时接待组数（0 = 未配置，不限制）','capacity','number',0);input.max='100'
  capacity.form.append(element('p','这是手工明确配置，不代表已核实机构真实接待能力。存在未来确认行程时需先处理行程。','muted'))
  mutationForm(capacity.form,'resource-capacity','/resources',()=>{const d=new FormData(capacity.form);return {action:'CAPACITY',institutionId:d.get('institutionId'),capacity:Number(d.get('capacity'))}},()=>Promise.resolve());$('resources').append(capacity.section)
}
renderResources()
const metricLabels={newRequests:'新需求（条）',visitIntentRequests:'关联带看意向（条）',contactEvents:'期间联系记录（次）',connectedEvents:'已接通（次）',noAnswerEvents:'未接通（次）',refusedEvents:'拒绝联系（次）',confirmedSessions:'期间首次确认（场）',rescheduledEvents:'期间改期（次）',arrivedSessions:'期间实际到访（场）',arrivedRequests:'期间到访去重需求（条）',cancelledSessions:'取消带看（场）',noShowSessions:'未到访（场）',movedInFeedbackEvents:'有来源入住反馈（次）',notMovedInFeedbackEvents:'未入住反馈（次）',unknownFeedbackEvents:'未知入住反馈（次）'}
const sourceLabels={MINIPROGRAM:'小程序主动申请',OFFLINE_MANUAL:'线下人工来源',SELF_TEST:'员工自测',SYNTHETIC_TEST_ONLY:'合成测试',UNKNOWN:'来源未知'}
function reportTable(headers,rows){const wrap=element('div','','table-scroll'),table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');if(headers.length>2){table.classList.add('wide-table');wrap.tabIndex=0;wrap.setAttribute('aria-label','可左右滚动的报告表格')}for(const title of headers){const th=element('th',title);th.scope='col';tr.append(th)}head.append(tr);table.append(head);const body=document.createElement('tbody');for(const values of rows){const line=document.createElement('tr');for(const value of values)line.append(element('td',String(value)));body.append(line)}table.append(body);wrap.append(table);return wrap}
$('reportFilter').addEventListener('input',()=>{++reportGeneration;reportSnapshot=null;$('downloadReport').disabled=true;$('reportPreview').textContent='筛选已更改，请重新生成报告。'})
$('reportFilter').addEventListener('submit',async event=>{
  event.preventDefault();const generation=++reportGeneration,sessionEpoch=epoch,button=event.target.querySelector('button'),target=$('reportPreview');button.disabled=true;$('downloadReport').disabled=true;reportSnapshot=null;target.textContent='正在查询完整筛选范围并固定本批次…'
  try{const d=new FormData(event.target),response=await api('/reports',{method:'POST',headers:{'X-P1-CSRF':csrf},body:JSON.stringify({from:d.get('from'),to:d.get('to'),institutionId:d.get('institutionId')||null,source:d.get('source')||null})});if(generation!==reportGeneration||sessionEpoch!==epoch)return
    const report=response.report;reportSnapshot=report;target.replaceChildren(element('p',report.warning,'banner'),element('p',`${report.institutionName}\n${report.from} 至 ${report.to}（含结束日）\n生成 / 观察截止：${time(report.generatedAt)}（北京时间）\n来源：${report.sourceFilter}\n口径：${report.policyVersion}\n批次：${report.snapshotId}`,'report-meta'))
    const grid=element('div','','metric-grid');for(const key of ['newRequests','contactEvents','confirmedSessions','arrivedSessions']){const cell=element('div',metricLabels[key],'metric');cell.append(element('strong',String(report.metrics[key])));grid.append(cell)}target.append(grid)
    target.append(element('h3','期间活动'),reportTable(['指标','实际数量'],Object.entries(metricLabels).map(([key,label])=>[label,report.metrics[key]])))
    target.append(element('h3','同批需求转化'),element('p',`同批需求分母 ${report.metrics.cohortDenominator} 条；其中明确到访 ${report.metrics.cohortArrivedRequests} 条。到访率：${report.metrics.cohortArrivalRate===null?'无可用比率':(report.metrics.cohortArrivalRate*100).toFixed(1)+'%'}。分母是本区间创建的关联需求，观察至本批生成时刻。`))
    target.append(element('h3','需求画像'),reportTable(['维度','分类','需求数（条）','说明'],report.profiles.map(p=>[p.dimension,p.category,p.count===null?'不展示':p.count,p.note])))
    target.append(element('h3','分机构成果'),element('p','各机构行独立去重，平台总数不能由这些行相加。','muted'),reportTable(['机构','新需求（条）','确认（场）','到访（场）','到访需求（条）','入住反馈（次）'],report.institutions.map(row=>[row.institutionName,row.metrics.newRequests,row.metrics.confirmedSessions,row.metrics.arrivedSessions,row.metrics.arrivedRequests,row.metrics.movedInFeedbackEvents])))
    target.append(element('h3','数据来源'),reportTable(['来源','同批需求（条）'],report.sources.map(s=>[sourceLabels[s.source]||'来源未知',s.count])))
    const details=document.createElement('details');details.append(element('summary','统计口径与小样本规则'));for(const rule of report.rules)details.append(element('p',rule));target.append(details);$('downloadReport').disabled=false
  }catch(error){if(generation===reportGeneration&&sessionEpoch===epoch)target.textContent=error.message||'未生成报告，请重试。'}finally{button.disabled=false}
})
$('downloadReport').addEventListener('click',async()=>{
  const report=reportSnapshot;if(!report)return;const sessionEpoch=epoch,generation=reportGeneration;const button=$('downloadReport');button.disabled=true
  try{const response=await fetch(API+'/reports/'+encodeURIComponent(report.snapshotId)+'/xlsx',{credentials:'same-origin',cache:'no-store',headers:{'X-P1-CSRF':csrf},signal:AbortSignal.timeout(30000)})
    if(response.status===401){if(sessionEpoch===epoch)signedOut();throw Error('登录失效，请重新登录。')}
    if(!response.ok||!response.headers.get('content-type')?.includes('spreadsheetml'))throw Error('导出未完成，请重试原批次。')
    const blob=await response.blob();if(sessionEpoch!==epoch||generation!==reportGeneration)return
    const generatedDay=new Date(Date.parse(report.generatedAt)+8*3600000).toISOString().slice(0,10)
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`快康养-${report.institutionId||'平台'}-${report.from}-${report.to}-${generatedDay}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)
    $('message').textContent='已生成本批次聚合 Excel。文件不含个人或隐藏明细。'
  }catch(e){if(sessionEpoch===epoch)$('message').textContent=e.message}finally{if(sessionEpoch===epoch&&generation===reportGeneration)button.disabled=false}
})
