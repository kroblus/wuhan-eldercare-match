import assert from 'node:assert/strict'

// Presentation-only overrides for DEMO. Keep production wording and domain states intact.
export function composeDemoUserCopy(source) {
  const replace = (file, before, after) => {
    const text = source.get(file).toString()
    assert.ok(text.includes(before), 'Demo copy anchor missing: ' + file + ' / ' + before)
    source.set(file, Buffer.from(text.replaceAll(before, after)))
  }
  const copy = {
    'pages/home/index.wxml': [
      ['普通公开目录，不作推荐排序。收费、护理与入住条件需向机构核实。', '以下为虚构机构，用于体验搜索与筛选；列表顺序不代表适合程度。'],
      ['打开独立机构目录 →', '查看全部机构 →'],
      ['资料说明与服务边界', '使用说明'],
      ['公开资料用于了解机构，不代表平台合作或接收承诺。资料未知不等于机构没有该项服务；公开电话不代表已实拨确认。政策与科普供阅读参考，不作个人诊断或补贴资格判断。', '机构资料、费用和护理能力均为演示示例，不可用于真实选院。咨询和预约仅供体验，不会联系真人。政策与科普请结合各页来源和适用范围阅读，不用于个人诊断或补贴资格判断。'],
      ['养老顾问服务说明', '体验顾问咨询'],
    ],
    'pages/assessment/intro.wxml': [
      ['共六步，可以按自己的节奏填写。草稿成功保存在本机后，回来可以继续。', '共六步，可以按自己的节奏填写。内容仅在本次体验期间暂存；重置演示或小程序重新启动后，新增内容会清除。'],
      ['当前为本机开发态评估预览，用于整理需求与匹配参考，不是医疗诊断，也不代表已保存为历史评估。后续联系顾问或预约看院，需由您明确操作。', '本次为演示评估，用于体验需求整理与机构匹配，不是医疗诊断。填写完成不代表已存入评估记录；咨询和预约均为模拟体验。'],
    ],
    'pages/assessment/basic.wxml': [
      ['先了解老人的基本生活情况。草稿成功保存在本机后，回来可以继续；请留意页面底部的保存提示。', '先了解老人的基本生活情况。填写内容仅在本次体验期间暂存；重置演示或小程序重新启动后，新增内容会清除。'],
    ],
    'pages/assessment/budget.wxml': [
      ['查看老人需求画像 →', '查看照护需求 →'],
      ['这里仅记录协助意愿，联系方式将在后续明确联系时按流程处理', '本次仅体验意愿填写，不会有人联系您'],
      ['如果之后明确预约看院或希望顾问联系，再按对应流程处理联系方式。', '演示咨询和预约不获取联系方式，也不会联系真人。'],
    ],
    'pages/assessment/profile.wxml': [
      ['照护等级与具体行动、照护方式分别呈现。', '老人日常需要哪些帮助'],
      ['这是对生活适配的提示，不是医学诊断或护理等级。', '根据您的回答整理进食与饮食需求，供进一步沟通参考。'],
      ['本次问卷已填写完成。以下事项是根据回答发现的具体待确认条件，不代表漏填；仅在实际情况或回答有变化时修改，重复勾选相同答案不会消除真实待确认项。', '问卷已填完，以下照护情况还需要确认。请按提示核对；如果回答符合实际，可以保留原答案。'],
      ['下一页会核对本次照护需求与机构资料。资料不足时不会生成推荐，你仍可浏览机构目录并了解公开联系方式。', '下一页会将照护需求与虚构机构资料进行匹配。资料不足时不会生成推荐，您仍可浏览演示机构目录。'],
    ],
    'pages/assessment/profile-v2-view-model.ts': [
      ['headline: `${displayName} · ${facts.age} 岁`,', "headline: `${displayName.replace(/^合成老人/, '演示老人').replace(/[（(]TEST ONLY[）)]/g, '').trim()} · ${facts.age} 岁`,"],
    ],
    'pages/institution/index.wxml': [
      ['正在读取合作机构资料', '正在读取演示机构资料'],
      ['正在通过当前资料目录整理可展示内容。', '请稍候，正在整理机构列表。'],
    ],
    'pages/institution/detail.wxml': [
      ['咨询养老顾问', '体验顾问咨询'],
      ['当前机构未关联合法全景场景，独立演示素材不代表该机构真实场景。', '暂无该机构的真实全景。演示空间仅用于体验，不代表机构实景。'],
    ],
    'pages/recommendation/result.wxml': [
      ['以下入口为公开资料目录，并非根据当前照护需求确认适合的推荐名单。可按名称、区域、性质查找，再到详情查看地址与公开电话。', '以下为演示机构目录，可按名称、区域和性质查找。目录中的机构不代表已满足本次照护需求。'],
    ],
    'pages/service/ai-chat/index.wxml': [
      ['只解释已经批准的公开资料，不替代医疗、机构或顾问的正式判断。', '查看养老常见问题的参考回答，不替代医疗、机构或顾问的正式判断。'],
      ['当前使用已批准 FAQ，未接入在线模型；本页未读取本次老人画像、推荐或机构上下文。', '回答来自预先整理的常见问题，不会结合本次评估或所选机构提供个别建议。'],
      ['可回答已批准的常见问题；未匹配的问题会提示资料不足，复杂事项请联系养老顾问。当前未接入在线模型。', '暂未找到对应回答，您可以换个问题。演示顾问仅提供示例问答。'],
      ['当前会话', '本次问答'],
      ['需要人工协助？', '体验顾问咨询'],
      ['顾问可以协助解释已有资料、确认需要人工跟进的事项，但不会替代医疗专业判断。', '查看示例问答，不会联系真人顾问或发送预约请求。'],
      ['联系养老顾问', '体验顾问咨询'],
    ],
    'pages/service/ai-chat/index-view-model.ts': [
      ['已批准 FAQ · 常见问题检索，未接入在线模型。', '回答来源：预先整理的常见问题。'],
      ['本次暂无可用回答；不会以未获批准的资料补全。', '暂未找到可参考的回答。'],
      ['没有找到适用的已批准资料，不会推测答案；可换个问题或联系养老顾问。', '暂未找到对应的参考资料，请换个问题。演示顾问仅提供示例问答。'],
      ['请检查网络后重试，页面不会展示内部错误信息。', '请检查网络后重试。'],
      ['请稍后重试，或直接联系养老顾问。', '请稍后重试，或查看顾问示例问答。'],
      ['建议联系养老顾问', '这个问题还需进一步确认'],
    ],
    'pages/assessment/intro.ts': [
      ['草稿已保存在本机，仅用于本次开发体验', '本次填写已暂存，重置演示或重新启动后清除'],
      ['本机保存失败，当前答案只在本次打开期间保留，请重试', '本次填写暂存失败，请重试'],
      ['本机会清除当前未完成的草稿，但不会影响任何历史评估。', '将清除当前未完成的填写内容，已有演示评估记录不受影响。'],
      ['本机草稿清理失败，未开始新的评估，请重试。', '暂未清除填写内容，未开始新的评估，请重试。'],
    ],
    'services/institution-presentation.ts': [
      ['开发演示数据\\n以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。', '演示数据：费用与护理能力均为虚构示例。'],
    ],
  }
  for (const [file, entries] of Object.entries(copy)) {
    for (const [before, after] of entries) replace(file, before, after)
  }
  for (const step of ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']) {
    const file = 'pages/assessment/' + step + '.ts'
    replace(file, '已保存到本机（开发态），不会同步服务器', '本次填写已暂存')
    replace(file, '已从本机草稿恢复（开发态）', '已恢复本次暂存的填写内容')
    replace(file, '会尝试保存到本机开发态草稿', '会暂存本次填写内容')
    replace(file, '本机保存失败', '本次填写暂存失败')
  }
  // These are display terms only; never replace provenance codes or data field names.
  for (const [file, bytes] of source) {
    if (!/^pages\/.*\.(ts|wxml)$/.test(file) && !/^components\/demo-tools\/.*\.wxml$/.test(file) && file !== 'templates/institution-directory.wxml') continue
    source.set(file, Buffer.from(bytes.toString()
      .replaceAll('老人需求画像', '老人照护需求')
      .replaceAll('查看需求画像', '查看照护需求')
      .replaceAll('演示记录仅保留在本次会话，重置或重启后清除。', '新增演示记录仅在本次体验期间保留，重置演示或小程序重新启动后清除。')
      .replaceAll('TEST ONLY · ', '')
      .replaceAll(' · TEST ONLY', '')
      .replaceAll('TEST ONLY 模拟拨号', '体验模拟拨号')))
  }
}
