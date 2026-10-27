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
function institutionChoices(synthetic){return {'ningyue-yiyang-center':'柠月颐养中心',...(synthetic?{'synthetic-reception-b':'合成接待点 B（虚构）'}:{})}}
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
  for(const button of $('list').children)if(button.dataset.requestId===id&&button.querySelector('strong'))button.querySelector('strong').textContent=kindText[item.kind]+' · '+statusText[item.status]
  for(const select of document.querySelectorAll('.institution-options')){
    if(synthetic&&!select.querySelector('[value="synthetic-reception-b"]')){const o=element('option','合成接待点 B（虚构）');o.value='synthetic-reception-b';select.append(o)}
  }
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
    field(form,'反馈关联机构（反馈时必填）','institutionId','text','',{'':'请选择',...institutionChoices(synthetic)})
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
  field(form,'机构','institutionId','text',v.institutionId||item.institutionId||'ningyue-yiyang-center',institutionChoices(item.datasetMode==='SYNTHETIC_TEST_ONLY'))
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
    for(const v of result.visits){const button=element('button',`${time(v.start)} — ${time(v.end)} · ${v.institutionName} · ${v.staffId} · ${visitText[v.status]}`,'request');button.addEventListener('click',()=>loadDetail(v.requestId,null));target.append(button)}
    for(const b of result.blocks){const row=element('p',`${b.staffId} 不可用：${time(b.start)} — ${time(b.end)} `);const remove=element('button','移除不可用时段');remove.addEventListener('click',async()=>{remove.disabled=true;try{await api('/resources',{method:'POST',headers:{'X-P1-CSRF':csrf},body:JSON.stringify({action:'REMOVE_BLOCK',blockId:b.id})});form.requestSubmit()}catch(e){$('message').textContent=e.message}finally{remove.disabled=false}});row.append(remove);target.append(row)}
    if(!result.visits.length&&!result.blocks.length)target.textContent='该区间没有安排或不可用时段。'
  }catch(e){if(generation===calendarGeneration&&sessionEpoch===epoch)target.textContent=e.message}
})
function renderResources(){
  const {form,section}=formSection('登记负责人不可用')
  field(form,'负责人标识','staffId','text','顾问一').required=true;field(form,'开始（北京时间）','start','datetime-local').required=true;field(form,'结束（北京时间）','end','datetime-local').required=true
  mutationForm(form,'resource-block','/resources',()=>{const d=new FormData(form);return {action:'BLOCK',blockId:crypto.randomUUID(),staffId:String(d.get('staffId')).trim(),start:utcInput(d.get('start')),end:utcInput(d.get('end'))}},()=>{form.reset();$('calendarFilter').requestSubmit()});$('resources').append(section)
  const capacity=formSection('仅在机构明确限定时设置容量')
  field(capacity.form,'机构','institutionId','text','ningyue-yiyang-center',{'ningyue-yiyang-center':'柠月颐养中心','synthetic-reception-b':'合成接待点 B（仅合成环境）'})
  const input=field(capacity.form,'同时接待组数（0 = 未配置，不限制）','capacity','number',0);input.max='100'
  capacity.form.append(element('p','这是手工明确配置，不代表已核实机构真实接待能力。存在未来确认行程时需先处理行程。','muted'))
  mutationForm(capacity.form,'resource-capacity','/resources',()=>{const d=new FormData(capacity.form);return {action:'CAPACITY',institutionId:d.get('institutionId'),capacity:Number(d.get('capacity'))}},()=>Promise.resolve());$('resources').append(capacity.section)
}
renderResources()
