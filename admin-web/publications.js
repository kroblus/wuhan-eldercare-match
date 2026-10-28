'use strict'
// Institution facts, publication and service access have separate server-side boundaries.
;(() => {
  const CONTRACT='institution-publications-v1'
  const message=$('institutionMessage'),list=$('institutionList'),editor=$('institutionEditor')
  const states={NONE:'尚无草稿',DRAFT:'资料草稿',CONFIRMED:'已人工确认',PUBLISHED:'已发布'}
  const errors={STALE_DRAFT_REVISION:'草稿已由其他操作更新。本地输入已保留，请查询服务器版本后核对。',BASE_REVISION_CONFLICT:'当前发布版本已变化，请加载服务器草稿核对后重新确认。',CONFIRMATION_REQUIRED:'这份草稿尚未完成人工确认，或确认已失效。',IDEMPOTENCY_CONFLICT:'操作编号已用于其他内容，请查询服务器状态后核对。',STALE_ACCESS_REVISION:'服务接入状态已变化，请刷新后重新核对。',BASELINE_REVISION_CONFLICT:'已有同一机构版本的内容不同，未覆盖原资料。',INVALID_INPUT:'请检查输入内容与必填项。',INVALID_PUBLIC_PROFILE:'公开介绍或价目表格式不正确。金额须为非负整数元，合计须与分项相符。',INVALID_CONFIRMATION_DATE:'请填写实际人工确认日期，不能使用未来日期。',INVALID_RECORD:'机构资料未通过领域校验，请检查高级资料中的对应字段。',INSTITUTION_NOT_PUBLISHED:'机构尚未发布有效版本，暂不能启用服务。',PUBLICATION_UNAVAILABLE:'机构资料维护暂未开通。其他工作区域可继续使用。',VALIDATOR_UNAVAILABLE:'资料校验暂不可用，未发布新版本。',NOT_FOUND:'未找到对应机构资料，请刷新列表核对。'}
  let listGeneration=0,editorGeneration=0,current=null,dirty=false,busy=false,templateBusy=false,conflict=false
  let pendingDraft=null,pendingPublish=null,pendingAccess=null,pendingImport=null,importBusy=false
  let controls=null
  const request=async(path,options={})=>{
    const result=await api(path,options,CONTRACT)
    if(!['PRODUCTION','SYNTHETIC_TEST_ONLY'].includes(result.dataEnvironment))throw Error('资料环境标记缺失，未展示机构资料。')
    return result
  }
  const mutation=(method,body)=>({method,headers:{'X-P1-CSRF':csrf},body:JSON.stringify(body)})
  const validId=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{1,99}$/.test(value)
  const revision=value=>Number.isSafeInteger(value)&&value>=0
  const isCurrent=(generation,sessionEpoch)=>generation===editorGeneration&&sessionEpoch===epoch&&!!csrf
  const describe=error=>{
    let text=errors[error.code]||error.message||'结果尚未确认，请查询服务器状态或使用原操作重试。'
    if(Array.isArray(error.validationIssues))text+=' '+error.validationIssues.slice(0,8).map(issue=>String(issue.path||'')+'：'+String(issue.code||'')).join('；')
    return text
  }
  const signature=value=>value&&typeof value==='object'?Array.isArray(value)?'['+value.map(signature).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signature(value[key])).join(',')+'}':JSON.stringify(value)
  const sameContent=(item,body)=>signature(item.record)===signature(body.record)&&signature(item.publicProfile)===signature(body.publicProfile)
  const samePublishedContent=(item,body)=>{
    if(sameContent(item,body))return true
    const record=JSON.parse(JSON.stringify(body.record));record.recordRevision=item.publishedRecordRevision;record.recordStatus='published'
    for(const evidence of record.evidence||[])evidence.recordRevision=item.publishedRecordRevision
    return sameContent(item,{record,publicProfile:body.publicProfile})
  }
  const validProfile=(profile,id)=>profile===null||!!profile&&profile.schemaVersion==='institution-public-profile-v1'&&profile.id===id
    &&['name','source','room','address','nature','tagNote','otherFees','priceNote','historyNote'].every(key=>typeof profile[key]==='string')
    &&Array.isArray(profile.tags)&&profile.tags.every(value=>typeof value==='string')&&Array.isArray(profile.prices)
    &&profile.prices.every(row=>row&&typeof row.level==='string'&&['bed','care','food','total'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0)&&row.total===row.bed+row.care+row.food)
  function readItem(result,id){
    const item=result.item
    if(!item||item.institutionId!==id||!revision(item.draftRevision)||!Object.hasOwn(states,item.status)
      ||!(item.currentRecordRevision===null||Number.isSafeInteger(item.currentRecordRevision)&&item.currentRecordRevision>0)
      ||!item.serviceAccess||typeof item.serviceAccess.enabled!=='boolean'||!revision(item.serviceAccess.accessRevision)
      ||!(item.record===null||item.record&&item.record.institutionId===id)||!validProfile(item.publicProfile,id)
      ||!(item.confirmation===null||item.confirmation&&['sourceReference','confirmedBy','confirmedOn'].every(key=>typeof item.confirmation[key]==='string'))
      ||!(item.publishedRecordRevision===null||Number.isSafeInteger(item.publishedRecordRevision)&&item.publishedRecordRevision>0))throw Error('机构草稿响应不完整，未替换本地输入。')
    return item
  }
  function canLeave(){
    if(busy||templateBusy){message.textContent='正在处理当前资料，请等待完成后继续。';return false}
    if(pendingDraft||pendingPublish||pendingAccess){message.textContent='当前写入结果尚未确认，请先查询服务器状态或使用原操作重试。';return false}
    return !dirty||window.confirm('本地修改尚未保存。是否放弃本地修改并读取服务器资料？')
  }
  function updateControls(){
    if(!controls)return
    const locked=busy||templateBusy||!!pendingDraft||!!pendingPublish||!!pendingAccess
    for(const input of controls.form.querySelectorAll('input,textarea,select,button'))input.disabled=locked
    controls.save.disabled=busy||templateBusy||!!pendingPublish||!!pendingAccess||conflict||(!pendingDraft&&!dirty)
    controls.save.textContent=pendingDraft?'使用原内容重试保存':'保存草稿'
    for(const input of controls.confirmForm.querySelectorAll('input,textarea,button'))input.disabled=locked||dirty||conflict||current.draftRevision===0
    controls.publish.disabled=busy||templateBusy||!!pendingDraft||!!pendingAccess||conflict||dirty||(!pendingPublish&&(current.status!=='CONFIRMED'||!current.confirmation))
    controls.publish.textContent=pendingPublish?'使用原操作重试发布':'发布已确认版本'
    controls.refresh.disabled=busy||templateBusy
    const needsPublication=!current.currentRecordRevision&&!current.serviceAccess.enabled
    for(const input of controls.accessForm.querySelectorAll('input,textarea,button'))input.disabled=locked||conflict||(!pendingAccess&&needsPublication)
    controls.accessSubmit.disabled=busy||templateBusy||!!pendingPublish||!!pendingDraft||conflict||(!pendingAccess&&needsPublication)
    controls.accessSubmit.textContent=pendingAccess?'使用原操作重试接入设置':'保存服务接入设置'
    controls.state.textContent=dirty?'本地有未保存修改；保存后需重新人工确认。':`${states[current.status]||'新机构草稿'} · 草稿 ${current.draftRevision} · 当前发布 ${current.currentRecordRevision||'暂无'}`
  }
  function changed(){dirty=true;updateControls()}
  function profileFromForm(form,id){
    if(!form.elements.hasProfile.checked)return null
    const text=name=>String(form.elements[name].value).trim()
    const prices=[]
    for(const row of controls.prices.children){
      const values={level:row.querySelector('[name=level]').value.trim()}
      for(const key of ['bed','care','food','total']){
        const value=row.querySelector(`[name=${key}]`).value
        if(value===''||!Number.isSafeInteger(Number(value))||Number(value)<0)throw Error('价目表金额须为非负整数元；没有已公开资料时请移除该行。')
        values[key]=Number(value)
      }
      if(!values.level||values.total!==values.bed+values.care+values.food)throw Error('请填写公示护理档位，并核对床位、护理、伙食分项与总月费。')
      prices.push(values)
    }
    return {schemaVersion:'institution-public-profile-v1',id,name:text('name'),source:text('source'),room:text('room'),address:text('address'),nature:text('nature'),tags:text('tags').split(/\n/).map(value=>value.trim()).filter(Boolean),tagNote:text('tagNote'),prices,otherFees:text('otherFees'),priceNote:text('priceNote'),historyNote:text('historyNote')}
  }
  function candidate(){
    let record
    try{record=JSON.parse(controls.record.value)}catch(_){throw Error('高级机构资料不是有效 JSON，请先修正后再保存。')}
    if(!record||record.institutionId!==current.institutionId)throw Error('高级资料中的机构 ID 必须与当前机构一致。')
    if(!controls.form.elements.name.value.trim())throw Error('请填写机构公开名称。')
    if(!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(controls.form.elements.regionCode.value.trim())||!controls.form.elements.regionDisplayName.value.trim())throw Error('请按机构资料填写所属地区代码和名称；地区未知时先核实，不自动填入某个区。')
    return {record,publicProfile:profileFromForm(controls.form,current.institutionId)}
  }
  function addPrice(values={}){
    const row=element('div','','publication-price-row')
    for(const [name,label] of [['level','公示护理档位'],['bed','床位费 / 月'],['care','护理费 / 月'],['food','伙食费 / 月'],['total','总月费']]){
      const input=field(row,label,name,name==='level'?'text':'number',values[name]??'')
      if(name!=='level'){input.min='0';input.max='10000000';input.step='1'}else input.maxLength=80
    }
    const remove=element('button','移除此行');remove.type='button';remove.addEventListener('click',()=>{row.remove();changed()});row.append(remove);controls.prices.append(row)
  }
  function renderEditor(item){
    current=item;dirty=false;conflict=false;editor.replaceChildren()
    const title=element('h3',item.publicProfile?.name||item.record?.identity?.name?.value||item.institutionId),state=element('p','','publication-state')
    editor.append(title,element('p',`稳定 ID：${item.institutionId}`,'muted'),state)
    const refresh=element('button','查询服务器草稿 / 发布状态');refresh.type='button';refresh.addEventListener('click',refreshCurrent);editor.append(refresh)
    const form=document.createElement('form');form.className='publication-form'
    const profile=item.publicProfile||{},name=field(form,'机构公开名称','name','text',profile.name||item.record?.identity?.name?.value||'');name.maxLength=200
    const regionCode=field(form,'所属地区代码（按已确认资料填写）','regionCode','text',item.record?.identity?.regionCode?.value||'');regionCode.maxLength=64
    const regionDisplayName=field(form,'所属地区名称','regionDisplayName','text',item.record?.identity?.regionDisplayName?.value||'');regionDisplayName.maxLength=200
    form.append(element('p','名称与所属地区是机构身份的必填项。请核对代码与名称对应；录入不自动获得“已核验”资格，护理能力另行核实。','muted'))
    const hasProfile=field(form,'同时发布详细介绍与价目表','hasProfile','checkbox',!!item.publicProfile)
    const profileFields=element('div','','publication-profile-fields');form.append(profileFields)
    for(const [key,label,max] of [['source','公开资料来源（保留原文标题 / 引用）',1000],['room','价目表适用房型',200],['address','公开地址 / 入口说明（未确认请明确注明）',1000],['nature','机构性质及核对说明',500],['tags','展示标签（每行一条）',1000],['tagNote','标签来源与边界说明',1000]]){
      const input=field(profileFields,label,key,key==='tags'||key==='tagNote'?'textarea':'text',key==='tags'?(profile.tags||[]).join('\n'):profile[key]||'');input.maxLength=max
    }
    profileFields.append(element('p','价目表单位为元 / 月。使用来源中的护理档位，不按问卷自动定档；短托价格不由月费除以 30 生成。','muted'))
    const prices=element('div','','publication-prices');profileFields.append(prices)
    const add=element('button','增加一行公示价');add.type='button';add.addEventListener('click',()=>{addPrice();changed()});profileFields.append(add)
    for(const [key,label] of [['otherFees','另列费用及使用 / 退还条件'],['priceNote','费用口径、适用限制及待确认信息'],['historyNote','本次资料与旧版本的关系说明']])field(profileFields,label,key,'textarea',profile[key]||'').maxLength=2000
    const advanced=document.createElement('details');advanced.append(element('summary','高级机构资料与护理证据（完整 JSON）'),element('p','这里的核验状态、证据和护理能力分别校验。详细介绍中的标签不会自动变成医疗资格、护理接收结论或可预约资格。','muted'))
    const record=field(advanced,'完整 Institution V1.2.1 资料','record','textarea',JSON.stringify(item.record,null,2));record.rows=16;record.spellcheck=false;record.className='publication-record';form.append(advanced)
    const save=element('button','保存草稿','primary');save.type='submit';form.append(save);editor.append(form)
    const confirmSection=element('section','','publication-step');confirmSection.append(element('h3','人工确认这份草稿'),element('p','请填写实际完成的核对信息。修改并保存资料后，原确认将失效。','muted'))
    const confirmForm=document.createElement('form');confirmForm.className='publication-form'
    const confirmation=item.confirmation||{}
    field(confirmForm,'本次确认来源引用','sourceReference','textarea',confirmation.sourceReference||'').maxLength=1000
    field(confirmForm,'实际确认人 / 可追溯标识','confirmedBy','text',confirmation.confirmedBy||'').maxLength=200
    field(confirmForm,'实际人工确认日期','confirmedOn','date',confirmation.confirmedOn||'')
    for(const input of confirmForm.querySelectorAll('input,textarea'))input.required=true
    const confirm=element('button','确认这份已保存草稿');confirm.type='submit';confirmForm.append(confirm);confirmSection.append(confirmForm);editor.append(confirmSection)
    const publish=element('button','发布已确认版本','primary');publish.type='button';publish.addEventListener('click',publishCurrent);editor.append(publish)
    const publicationFeedback=element('p','','operation-feedback');publicationFeedback.setAttribute('role','status');editor.append(publicationFeedback)
    if(item.publishedRecordRevision){
      const link=element('a',`读取已发布的第 ${item.publishedRecordRevision} 版公开资料`);link.href='/api/v1/institution-publications/'+encodeURIComponent(item.institutionId)+'/revisions/'+item.publishedRecordRevision;link.target='_blank';link.rel='noopener noreferrer';editor.append(link)
    }
    const accessSection=element('section','','publication-step');accessSection.append(element('h3','平台免费服务接入'),element('p','公开资料发布与平台接单分别管理。接入表示平台接受咨询和带看意向，不代表护理资格、床位、官方合作认证或确认预约。','muted'))
    const accessForm=document.createElement('form');accessForm.className='publication-form'
    field(accessForm,'允许接收本机构的新咨询 / 带看意向','enabled','checkbox',item.serviceAccess.enabled)
    field(accessForm,'本次服务接入决定的来源 / 确认说明','sourceReference','textarea').maxLength=1000
    const accessSubmit=element('button','保存服务接入设置');accessSubmit.type='submit';accessForm.append(accessSubmit);accessSection.append(accessForm);editor.append(accessSection)
    controls={form,record,prices,profileFields,save,confirmForm,publish,refresh,state,accessForm,accessSubmit,feedback:publicationFeedback}
    for(const row of profile.prices||[])addPrice(row)
    profileFields.hidden=!hasProfile.checked
    hasProfile.addEventListener('change',()=>{profileFields.hidden=!hasProfile.checked})
    const identityInputs={name,regionCode,regionDisplayName}
    for(const [key,input] of Object.entries(identityInputs))input.addEventListener('input',()=>{
      try{
        const next=JSON.parse(record.value),value=input.value.trim()
        if(next.identity&&next.identity[key]?.value!==value){next.identity[key]=value?{availability:'provided',value,verification:{status:'unverified',evidenceIds:[]}}:{availability:'unknown',value:null,verification:{status:'unverified',evidenceIds:[]}};if(Array.isArray(next.evidence))next.evidence=next.evidence.filter(entry=>entry.fieldPath!=='identity.'+key);record.value=JSON.stringify(next,null,2)}
      }catch(_){/* Keep invalid advanced input for the operator to correct. */}
    })
    record.addEventListener('input',()=>{try{const next=JSON.parse(record.value);for(const [key,input] of Object.entries(identityInputs))input.value=next.identity?.[key]?.value||''}catch(_){/* An incomplete JSON edit is expected while typing. */}})
    form.addEventListener('input',changed);form.addEventListener('change',changed)
    form.addEventListener('submit',saveCurrent);confirmForm.addEventListener('submit',confirmCurrent);accessForm.addEventListener('submit',saveAccess)
    updateControls()
  }
  async function saveCurrent(event){
    event.preventDefault();if(busy||templateBusy||pendingPublish||pendingAccess||conflict)return
    const generation=editorGeneration,sessionEpoch=epoch
    if(!pendingDraft){try{const body=candidate();pendingDraft=current.draftRevision===0?{path:'/institutions',method:'POST',body:{institutionId:current.institutionId,...body}}:{path:'/institutions/'+encodeURIComponent(current.institutionId)+'/draft',method:'PUT',body:{expectedDraftRevision:current.draftRevision,...body}}}catch(error){controls.feedback.textContent=error.message;return}}
    busy=true;updateControls()
    try{
      const response=await request(pendingDraft.path,mutation(pendingDraft.method,pendingDraft.body))
      if(!isCurrent(generation,sessionEpoch))return
      const next=readItem(response,current.institutionId);pendingDraft=null;renderEditor(next);controls.feedback.textContent='草稿已保存。请核对资料后完成人工确认。';loadInstitutions()
    }catch(error){if(isCurrent(generation,sessionEpoch)){if(error.httpStatus>=400&&error.httpStatus<500){pendingDraft=null;conflict=error.httpStatus===409}controls.feedback.textContent=describe(error)}}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function confirmCurrent(event){
    event.preventDefault();if(busy||templateBusy||dirty||pendingDraft||pendingPublish||pendingAccess||conflict)return
    const form=controls.confirmForm,body={expectedDraftRevision:current.draftRevision,sourceReference:form.elements.sourceReference.value.trim(),confirmedBy:form.elements.confirmedBy.value.trim(),confirmedOn:form.elements.confirmedOn.value}
    if(!body.sourceReference||!body.confirmedBy||!/^\d{4}-\d{2}-\d{2}$/.test(body.confirmedOn)){controls.feedback.textContent='请填写实际来源、确认人和确认日期。';return}
    const generation=editorGeneration,sessionEpoch=epoch;busy=true;updateControls()
    try{const response=await request('/institutions/'+encodeURIComponent(current.institutionId)+'/confirm',mutation('POST',body));if(!isCurrent(generation,sessionEpoch))return;renderEditor(readItem(response,current.institutionId));controls.feedback.textContent='这份已保存草稿已记录人工确认，可以发布。';loadInstitutions()}
    catch(error){if(isCurrent(generation,sessionEpoch)){conflict=error.httpStatus===409||!error.httpStatus;controls.feedback.textContent=describe(error)+(error.httpStatus?'':' 请先查询服务器草稿，核对是否已确认。')}}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function publishCurrent(){
    if(busy||templateBusy||dirty||pendingDraft||pendingAccess||conflict||(!pendingPublish&&(current.status!=='CONFIRMED'||!current.confirmation)))return
    if(!pendingPublish)pendingPublish={body:{operationId:crypto.randomUUID(),expectedDraftRevision:current.draftRevision},record:current.record,publicProfile:current.publicProfile}
    const generation=editorGeneration,sessionEpoch=epoch;busy=true;updateControls()
    try{const response=await request('/institutions/'+encodeURIComponent(current.institutionId)+'/publish',mutation('POST',pendingPublish.body));if(!isCurrent(generation,sessionEpoch))return;const publication=response.publication;if(!publication||publication.institutionId!==current.institutionId||!Number.isSafeInteger(publication.recordRevision)||!['PUBLISHED','REPLAYED'].includes(publication.status))throw Error('未确认发布响应，请查询服务器状态。');const next=readItem(response,current.institutionId);pendingPublish=null;renderEditor(next);controls.feedback.textContent=`服务器已确认发布第 ${publication.recordRevision} 版。旧版本保留；平台服务接入状态单独设置。`;loadInstitutions()}
    catch(error){if(isCurrent(generation,sessionEpoch)){if(error.httpStatus>=400&&error.httpStatus<500){pendingPublish=null;conflict=error.httpStatus===409}controls.feedback.textContent=describe(error)}}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function saveAccess(event){
    event.preventDefault();if(busy||templateBusy||pendingPublish||pendingDraft||conflict)return
    if(!pendingAccess){const sourceReference=controls.accessForm.elements.sourceReference.value.trim();if(!sourceReference){controls.feedback.textContent='请填写本次服务接入决定的来源或确认说明。';return}pendingAccess={operationId:crypto.randomUUID(),expectedAccessRevision:current.serviceAccess.accessRevision,enabled:controls.accessForm.elements.enabled.checked,sourceReference}}
    const generation=editorGeneration,sessionEpoch=epoch;busy=true;updateControls()
    try{const result=await request('/institutions/'+encodeURIComponent(current.institutionId)+'/service-access',mutation('POST',pendingAccess));if(!isCurrent(generation,sessionEpoch))return;const access=result.access;if(!access||access.institutionId!==current.institutionId||typeof access.enabled!=='boolean'||!revision(access.accessRevision))throw Error('未确认服务接入状态，请查询服务器后重试原操作。');current.serviceAccess={enabled:access.enabled,accessRevision:access.accessRevision};pendingAccess=null;controls.accessForm.elements.enabled.checked=access.enabled;controls.feedback.textContent=access.enabled?'平台已允许接收本机构的新服务申请。':'平台已停止接收本机构的新服务申请；旧记录保留。';loadServiceInstitutions();loadInstitutions()}
    catch(error){if(isCurrent(generation,sessionEpoch)){if(error.httpStatus>=400&&error.httpStatus<500){pendingAccess=null;conflict=error.httpStatus===409}controls.feedback.textContent=describe(error)}}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function refreshCurrent(){
    if(busy||!current)return
    if(!pendingDraft&&!pendingPublish&&!pendingAccess&&!canLeave())return
    const generation=editorGeneration,sessionEpoch=epoch;busy=true;updateControls()
    try{
      const result=await request('/institutions/'+encodeURIComponent(current.institutionId)+'/draft');if(!isCurrent(generation,sessionEpoch))return;const item=readItem(result,current.institutionId)
      if(pendingDraft){if(!sameContent(item,pendingDraft.body)){controls.feedback.textContent='服务器草稿与本次保存内容尚未一致。本地内容已保留，可用原内容重试保存。';return}pendingDraft=null}
      if(pendingPublish){if(item.status!=='PUBLISHED'||!samePublishedContent(item,pendingPublish)){controls.feedback.textContent='尚未确认这次发布完成。当前原内容和操作编号已保留，请重试原发布操作。';return}pendingPublish=null}
      if(pendingAccess){if(item.serviceAccess.enabled!==pendingAccess.enabled||item.serviceAccess.accessRevision<=pendingAccess.expectedAccessRevision){controls.feedback.textContent='尚未确认服务接入设置完成。请用原操作重试。';return}pendingAccess=null;if(dirty){current.serviceAccess=item.serviceAccess;controls.accessForm.elements.enabled.checked=item.serviceAccess.enabled;controls.feedback.textContent='已核对服务接入设置；本地未保存的资料仍保留。';return}}
      renderEditor(item);controls.feedback.textContent='已读取服务器实际草稿与发布状态。'
    }catch(error){if(isCurrent(generation,sessionEpoch))controls.feedback.textContent=describe(error)}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function openDraft(id){
    if(!canLeave())return
    const generation=++editorGeneration,sessionEpoch=epoch;busy=true;updateControls();message.textContent='正在读取机构资料…'
    try{const result=await request('/institutions/'+encodeURIComponent(id)+'/draft');if(!isCurrent(generation,sessionEpoch))return;renderEditor(readItem(result,id));message.textContent='';editor.focus({preventScroll:true})}
    catch(error){if(isCurrent(generation,sessionEpoch))message.textContent=describe(error)}
    finally{if(isCurrent(generation,sessionEpoch)){busy=false;updateControls()}}
  }
  async function loadServiceInstitutions(){
    const sessionEpoch=epoch
    try{const result=await api('/service-institutions');if(sessionEpoch===epoch&&csrf)window.setP1InstitutionChoices(result.serviceInstitutions)}catch(error){if(sessionEpoch===epoch&&csrf)$('message').textContent=error.message||'服务机构名单未读取成功，请重新登录或刷新。'}
  }
  async function loadInstitutions(){
    const generation=++listGeneration,sessionEpoch=epoch;const button=$('refreshInstitutions');button.disabled=true
    try{
      const result=await request('/institutions');if(generation!==listGeneration||sessionEpoch!==epoch||!csrf)return
      if(!Array.isArray(result.items)||!result.items.every(item=>item&&validId(item.institutionId)&&typeof item.name==='string'&&revision(item.draftRevision)&&Object.hasOwn(states,item.status)))throw Error('机构列表格式不完整。')
      list.replaceChildren()
      if(result.dataEnvironment==='SYNTHETIC_TEST_ONLY')list.append(element('p','合成研发环境：机构和来源仅用于测试，不代表真实服务。','banner'))
      if(!result.items.length)list.append(element('p','尚无机构草稿，可准备新机构或显式导入现有目录。','muted'))
      for(const item of result.items){const choice=element('button','','request');choice.type='button';choice.dataset.institutionId=item.institutionId;choice.append(element('strong',item.name||item.institutionId),element('span',`${states[item.status]} · 当前版 ${item.currentRecordRevision||'暂无'}`));choice.addEventListener('click',()=>openDraft(item.institutionId));list.append(choice)}
    }catch(error){if(generation===listGeneration&&sessionEpoch===epoch&&csrf){list.replaceChildren(element('p','未取得机构列表，请重试。'));message.textContent=describe(error)}}
    finally{if(generation===listGeneration&&sessionEpoch===epoch)button.disabled=false}
  }
  $('newInstitutionForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!canLeave())return
    const id=event.target.elements.institutionId.value.trim();if(!validId(id)){message.textContent='请填写合法的稳定机构 ID。';return}
    const generation=++editorGeneration,sessionEpoch=epoch,button=event.target.querySelector('button');templateBusy=true;button.disabled=true;updateControls()
    try{const result=await request('/institutions/template?'+new URLSearchParams({institutionId:id}));if(!isCurrent(generation,sessionEpoch))return;if(!result.record||result.record.institutionId!==id)throw Error('未取得合法的新机构模板。');renderEditor({institutionId:id,draftRevision:0,baseRecordRevision:null,currentRecordRevision:null,status:'DRAFT',record:result.record,publicProfile:null,confirmation:null,publishedRecordRevision:null,serviceAccess:{enabled:false,accessRevision:0}});dirty=true;updateControls();message.textContent='新机构模板已准备。只有保存后才写入服务器草稿；模板中的未知事实需要按实际来源维护。'}
    catch(error){if(isCurrent(generation,sessionEpoch))message.textContent=describe(error)}finally{if(generation===editorGeneration&&sessionEpoch===epoch){templateBusy=false;button.disabled=false;updateControls()}}
  })
  $('baselineImportForm').elements.catalogFile.addEventListener('change',async event=>{
    const form=$('baselineImportForm'),feedback=form.querySelector('.operation-feedback'),sessionEpoch=epoch,file=event.target.files[0]
    if(!file||pendingImport||importBusy)return
    if(file.size>12*1024*1024){feedback.textContent='文件超过 12 MiB，请核对是否为正确目录。';return}
    try{const value=await file.text();if(sessionEpoch===epoch&&csrf)form.elements.catalog.value=value}catch(_){if(sessionEpoch===epoch)feedback.textContent='文件读取失败，请重选文件或粘贴 JSON。'}
  })
  $('baselineImportForm').addEventListener('submit',async event=>{
    event.preventDefault();if(importBusy)return
    const form=event.target,feedback=form.querySelector('.operation-feedback'),button=form.querySelector('button'),sessionEpoch=epoch
    if(!pendingImport){try{if(!form.elements.preserveExistingFacts.checked)throw Error('请先确认本次只迁移已有版本并保留原核验日期。');const sourceReference=form.elements.sourceReference.value.trim();if(!sourceReference)throw Error('请填写本次迁移来源引用。');const imported=JSON.parse(form.elements.catalog.value);pendingImport={operationId:crypto.randomUUID(),sourceReference,preserveExistingFacts:true,...(imported.catalog?{catalog:imported.catalog,historicalRecords:imported.historicalRecords||[]}:{catalog:imported})}}catch(error){feedback.textContent=error.message||'目录 JSON 不正确，请核对。';return}}
    importBusy=true;for(const input of form.querySelectorAll('input,textarea,button'))input.disabled=true
    try{const result=await request('/institutions/import-baseline',mutation('POST',pendingImport));if(sessionEpoch!==epoch||!csrf)return;if(!revision(result.imported)||typeof result.replayed!=='boolean')throw Error('未确认导入结果，请查询或重试原操作。');pendingImport=null;feedback.textContent=`服务器已确认导入 ${result.imported} 条已有版本，原事实和核验日期保留。`;loadInstitutions()}
    catch(error){if(sessionEpoch===epoch&&csrf){if(error.httpStatus>=400&&error.httpStatus<500)pendingImport=null;feedback.textContent=describe(error)}}
    finally{if(sessionEpoch===epoch){importBusy=false;for(const input of form.querySelectorAll('input,textarea'))input.disabled=!!pendingImport;button.disabled=false;button.textContent=pendingImport?'使用原操作重试导入':'导入现有目录'}}
  })
  $('refreshInstitutions').addEventListener('click',()=>{loadInstitutions();loadServiceInstitutions()})
  window.loadInstitutionWorkspace=()=>{loadServiceInstitutions();loadInstitutions()}
  window.clearInstitutionWorkspace=()=>{
    ++listGeneration;++editorGeneration;current=null;controls=null;dirty=false;busy=false;templateBusy=false;conflict=false;pendingDraft=null;pendingPublish=null;pendingAccess=null;pendingImport=null;importBusy=false
    editor.replaceChildren(element('h3','选择机构开始维护'));list.replaceChildren();message.textContent='';$('newInstitutionForm').reset();$('baselineImportForm').reset();for(const input of $('baselineImportForm').querySelectorAll('input,textarea,button'))input.disabled=false
    for(const input of $('newInstitutionForm').querySelectorAll('input,button'))input.disabled=false
    $('refreshInstitutions').disabled=false;window.setP1InstitutionChoices([])
  }
  window.addEventListener('beforeunload',event=>{if(dirty||busy||pendingDraft||pendingPublish||pendingAccess||pendingImport){event.preventDefault();event.returnValue=''}})
  if(csrf)window.loadInstitutionWorkspace()
})()
