'use strict'
const $ = id => document.getElementById(id)
const API = '/api/v1/p1-service/admin'
const VERSION = 'p1-service-request-v1'
const operationErrors={STAFF_CONFLICT:'负责人时段冲突（含交通/准备缓冲），旧安排已保留。',SUBJECT_CONFLICT:'同一认证账号已有冲突安排，旧安排已保留。',STAFF_UNAVAILABLE:'负责人该时段不可用。',INSTITUTION_CAPACITY_CONFLICT:'超过已配置的机构接待容量。',STALE_REVISION:'安排已由其他操作更新，请刷新后核对。',BOTH_CONFIRMATIONS_REQUIRED:'家属与机构均确认后才能确认排期。',REQUEST_CLOSED:'申请已取消或结束联系，不能重新安排。',VISIT_ENDED:'这场已结束，不能覆盖历史。',INVALID_ACTUAL_TIME:'实际记录时间不正确，未来行程不能记录到访。',FEEDBACK_SOURCE_REQUIRED:'入住反馈需要注明来源与关联机构。',IDEMPOTENCY_CONFLICT:'操作编号已用于其他内容，请刷新并核对实际记录。',INVALID_NEXT_ACTION:'下次联系需为未来时间，并填写下一动作；拒绝联系后不生成待办。',ACTIVE_SCHEDULES_EXIST:'该机构仍有未来确认行程，请先处理，再调整容量。',VISIT_ID_CONFLICT:'看院编号已被使用，请刷新后重试。'}
let csrf = '', epoch = 0, listGeneration = 0, detailGeneration = 0, loginBusy = false, pageOffset=0
const statusText = { PENDING_CONTACT:'待联系', FOLLOWING_UP:'联系跟进中', PENDING_ARRANGEMENT:'待安排', CONFIRMED:'已有确认带看', VISITED:'已记录到访', NO_SHOW:'未到访', CLOSED:'已结束联系', CANCELLED:'已取消' }
const kindText = { CONSULTATION:'普通咨询', VISIT_INTENT:'带看意向' }
const relationshipText = { SELF:'本人', FAMILY:'家属', OTHER:'其他合法受托人' }
const scenarioText = { LONG_TERM:'长期养老', SHORT_STAY:'短期托养', POST_OPERATION:'术后阶段', UNDECIDED:'尚未确定' }
const element = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node }
const time = value => value ? new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', dateStyle:'short', timeStyle:'medium' }).format(new Date(value)) : '尚未发生'
function signedOut() { epoch++; csrf=''; $('workspace').hidden=true; $('logout').hidden=true; $('loginPanel').hidden=false; $('list').replaceChildren(); $('detail').replaceChildren(element('h2','需求详情')); if(window.clearP1Operations)window.clearP1Operations(); }
async function api(path, options={}) {
  const sessionEpoch=epoch
  const response = await fetch(API + path, { credentials:'same-origin', cache:'no-store', ...options,
    headers:{ Accept:'application/json', ...(options.body ? { 'Content-Type':'application/json' } : {}), ...options.headers }, signal:AbortSignal.timeout(15000) })
  if (response.status===401) { if (sessionEpoch===epoch) signedOut(); throw new Error('登录已失效，请重新登录。') }
  if (!response.ok) {
    const body=await response.json().catch(()=>({})), error=new Error(operationErrors[body.code] || (response.status===503 ? '服务暂不可用。未确认写入结果时请使用原操作重试。' : response.status===403 ? '操作未获授权，请重新登录后重试。' : '请求失败，请检查输入并重试。'))
    error.httpStatus=response.status;throw error
  }
  const result=await response.json()
  if (!result || result.contractVersion!==VERSION) throw new Error('响应格式不正确，未展示需求资料。')
  return result
}
function showSession(session) {
  if (!session.authenticated || typeof session.csrfToken!=='string') throw new Error('管理员会话无效。')
  epoch++; csrf=session.csrfToken; $('workspace').hidden=false; $('logout').hidden=false; $('loginPanel').hidden=true; $('message').textContent=''
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); if (loginBusy) return; loginBusy=true
  const button=event.target.querySelector('button'); button.disabled=true; $('message').textContent=''
  try {
    const data=new FormData(event.target)
    showSession(await api('/login', { method:'POST', headers:{'X-P1-Admin-Request':'1'}, body:JSON.stringify({username:data.get('username'),password:data.get('password')}) }))
    event.target.elements.password.value=''; await loadList()
  } catch (_) { $('message').textContent='登录未完成。请核对管理员账号及服务配置后重试。' }
  finally { loginBusy=false; button.disabled=false }
})
$('logout').addEventListener('click', async () => {
  $('logout').disabled=true
  try { await api('/logout',{method:'POST',headers:{'X-P1-CSRF':csrf}}); signedOut(); $('message').textContent='已退出登录。' }
  catch (_) { $('message').textContent='退出结果尚未确认，请重试。'; }
  finally { $('logout').disabled=false }
})
function validItem(item) {
  return item && typeof item.id==='string' && /^[0-9a-f-]{36}$/i.test(item.id) && statusText[item.status] && kindText[item.kind]
    && ['PRODUCTION','SYNTHETIC_TEST_ONLY'].includes(item.datasetMode) && Number.isFinite(Date.parse(item.createdAt))
}
async function loadList() {
  const generation=++listGeneration, sessionEpoch=epoch
  ++detailGeneration; $('detail').replaceChildren(element('h2','需求详情'),element('p','请选择一条需求。'))
  const query=new URLSearchParams({limit:'50',offset:String(pageOffset)})
  for (const [key,value] of new FormData($('filters'))) if (value) query.set(key,value)
  $('message').textContent=''; $('list').replaceChildren(element('p','正在读取需求…'))
  try {
    const result=await api('/requests?'+query)
    if (generation!==listGeneration || sessionEpoch!==epoch) return
    if (!Array.isArray(result.items) || !result.items.every(validItem)) throw new Error('响应资料不完整，请重试。')
    $('count').textContent=result.items.length?`共 ${result.total} 条 · ${pageOffset+1}—${pageOffset+result.items.length}`:`共 ${result.total} 条`
    $('previousPage').disabled=pageOffset===0; $('nextPage').disabled=!result.hasMore
    $('list').replaceChildren()
    if (!result.items.length) $('list').append(element('p','当前筛选范围内没有需求。'))
    for (const item of result.items) {
      const button=element('button','', 'request'); button.setAttribute('aria-pressed','false')
      button.dataset.requestId=item.id
      button.append(element('strong', `${kindText[item.kind]} · ${statusText[item.status]}`),element('span',item.institutionName || '请顾问协助推荐'),element('span',time(item.createdAt)+' · 北京时间'))
      button.append(element('span',item.datasetMode==='SYNTHETIC_TEST_ONLY'?'合成测试 · 非真实待办':'正式服务申请',item.datasetMode==='SYNTHETIC_TEST_ONLY'?'test':'badge'))
      button.addEventListener('click',()=>loadDetail(item.id,button)); $('list').append(button)
    }
  } catch (error) { if (generation===listGeneration && sessionEpoch===epoch) { $('list').replaceChildren(element('p','读取失败，不能判断是否有待办。')); $('message').textContent=error.message || '读取失败，请重试。' } }
}
$('filters').addEventListener('submit',event=>{event.preventDefault(); pageOffset=0; loadList()})
$('previousPage').addEventListener('click',()=>{pageOffset=Math.max(0,pageOffset-50);loadList()})
$('nextPage').addEventListener('click',()=>{pageOffset+=50;loadList()})
async function loadDetail(id, button) {
  const generation=++detailGeneration, sessionEpoch=epoch
  $('detail').replaceChildren(element('h2','正在读取详情…'))
  try {
    const result=await api('/requests/'+encodeURIComponent(id))
    if (generation!==detailGeneration || sessionEpoch!==epoch) return
    const item=result.item
    if (!validItem(item) || item.id!==id || !Array.isArray(result.events)) throw new Error('详情关联不正确，请重试。')
    for (const entry of $('list').children) entry.setAttribute('aria-pressed',String(entry===button))
    $('detail').replaceChildren(element('h2',kindText[item.kind]+' · '+statusText[item.status]))
    if (item.datasetMode==='SYNTHETIC_TEST_ONLY') $('detail').append(element('p','合成测试：不是朋友的真实待办。','banner'))
    const dl=document.createElement('dl')
    const fields=[['目标机构',item.institutionName || '请顾问协助推荐'],['联系人',item.contactName],['手机（仅本次服务使用）',item.contactPhone],['关系',relationshipText[item.relationship]],['服务场景',scenarioText[item.serviceScenario]],['意向窗口（未确认）',item.preferredWindow || '待协商'],['参加人数',String(item.partySize)],['协助说明',item.assistanceNote || '未填写'],['来源',item.source==='MINIPROGRAM'?'小程序主动申请':item.source==='SYNTHETIC_TEST_ONLY'?'合成测试':'来源待核对'],['创建时间（北京时间）',time(item.createdAt)],['告知版本',item.consentVersion]]
    for(const [label,value] of fields) dl.append(element('dt',label),element('dd',value || '未提供'))
    $('detail').append(dl)
    renderOperations(result)
    $('detail').focus({preventScroll:true}); if (window.innerWidth<1100 || document.body.dataset.fontPercent==='150') $('detail').scrollIntoView({behavior:'smooth'})
  } catch (error) { if(generation===detailGeneration && sessionEpoch===epoch) $('detail').replaceChildren(element('h2','详情读取失败'),element('p',error.message || '请选择该需求重试。')) }
}
const bootstrapEpoch=epoch
api('/session').then(session=>{if(epoch!==bootstrapEpoch)return; showSession(session); return loadList()}).catch(()=>{if(!csrf) { signedOut(); $('message').textContent='请使用管理员账号登录。' }})
