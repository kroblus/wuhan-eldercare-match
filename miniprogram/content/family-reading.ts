export interface ReadingSource { id: string; title: string; url: string; scope: string; published: string }
export interface ReadingSection { title: string; paragraphs: readonly string[] }
export interface FamilyReading { title: string; kicker: string; introduction: string; notice: string; sections: readonly ReadingSection[]; sources: readonly ReadingSource[] }
export const reviewedOn = '2026-10-22'
const feeSource: ReadingSource = { id: 'fees', title: '中国政府网：养老机构预收费监管与交费提醒', scope: '全国 · 通用参考', published: '2024-05-14', url: 'https://app.www.gov.cn/govdata/gov/202405/14/514934/article.html' }
const contractSource: ReadingSource = { id: 'contract', title: '市场监管总局：养老机构服务合同示范文本', scope: '全国 · 2016版示范文本，非个别机构合同', published: '2016-11', url: 'https://htsfwb.samr.gov.cn/View?id=e03e2457-b807-4344-ba56-ae02c1ff0272' }
export const familyReading: Record<'policy' | 'education' | 'admission', FamilyReading> = {
  policy: {
    title: '养老补贴政策', kicker: '政策先看适用范围',
    introduction: '为武汉家属整理的官方资料索引。先分清全国项目、省级实施和本地办理，再核对个人条件。',
    notice: '本页不办理补贴，也不判定领取资格。金额、材料、承接机构及叠加规则，以当期官方审核为准；本小程序的需求评估不能替代官方能力评估。',
    sections: [
      { title: '01 / 全国：2026年养老服务消费补贴', paragraphs: ['两部门通知将面向中度以上失能老年人的养老服务消费补贴项目在全国启动，项目周期为2026年1月至12月。', '这是特定年度项目，不等同于所有老人都能领取现金。先向官方了解能力评估、服务范围与参与机构。'] },
      { title: '02 / 湖北：电子消费券的实施说明', paragraphs: ['湖北省民政厅的政策解读说明，通过“民政通”发放电子消费券，用于符合项目要求的养老服务。', '省级实施说明需与武汉办理渠道结合查看；本页不推断个人可领额度或所有目录机构都能核销。'] },
      { title: '03 / 武汉：在哪里核对办理流程', paragraphs: ['武汉市民政局公开答复提示，可在“民政通”APP或小程序查看申请流程，具体问题向所在区民政部门了解。', '准备咨询：老人是否符合项目条件、是否需要重新评估、意向机构是否参与、哪些费用可抵扣。不要先付费再假定一定有补贴。'] },
      { title: '04 / 武汉：高龄津贴另行查询', paragraphs: ['高龄津贴与养老服务消费补贴是不同事项。市民政局提供高龄津贴查询说明，可核对年龄、户籍、登记与现行标准。', '不能把全国、省、市政策的金额直接相加；尚未核实的叠加、领取条件和申请地点，不在本页作确定结论。'] },
    ],
    sources: [
      { id: 'national', title: '中国老龄协会：两部门全面启动通知', scope: '全国 · 2026年度项目', published: '2026-01-22', url: 'https://www.cncaprc.gov.cn/xxzcfg/770060.jhtml' },
      { id: 'hubei', title: '湖北省民政厅政策解读（鄂州市民政局转载）', scope: '湖北省 · 补贴形式', published: '2026-01-28', url: 'https://mzj.ezhou.gov.cn/xxgk/zc/zcjd/202601/t20260128_748464.html' },
      { id: 'wuhan', title: '武汉市政府：市民政局关于民政通办理的公开答复', scope: '武汉市 · 办理渠道参考', published: '2026-01-28', url: 'https://www.wuhan.gov.cn/hdjl/lxgs/202601/t20260128_2720327.shtml' },
      { id: 'age', title: '武汉市民政局：高龄津贴发放标准', scope: '武汉市 · 另一项津贴政策', published: '以原页标注为准', url: 'https://mzj.wuhan.gov.cn/bmfw/bmcx/202111/t20211129_1861572.shtml' },
    ],
  },
  education: {
    title: '养老科普', kicker: '把照护问题，问得具体一点',
    introduction: '先观察每天需要哪些帮助，再讨论怎样照护。老人自己的意愿和熟悉的生活习惯，也需要被认真听见。',
    notice: '本页是一般照护与选院知识，不作个人诊断或失能等级认定。身体情况明显变化时请寻求医疗或专业评估帮助。',
    sections: [
      { title: '01 / 什么时候可以考虑机构照护', paragraphs: ['看看进食、如厕、洗澡、穿衣、走动等日常活动，是否需要持续协助；再看看夜间是否有人照看、家人能否长期承担。', '把具体困难与老人意愿列成清单，比较居家、社区支持和机构照护。年龄本身不能替代照护需求判断。'] },
      { title: '02 / 自理、部分依赖与更多照护', paragraphs: ['日常能自己完成的事，尽量保留老人的自主参与；部分活动需要帮助时，问清协助发生在哪些环节；多项活动依赖他人时，要重点核实持续照护安排。', '“半失能”“失能”在口语中常被笼统使用。不要靠称呼确定等级、护理方案或补贴资格，应以相应专业评估为准。'] },
      { title: '03 / 参观时看什么、问什么', paragraphs: ['亲自看通道、卫生间、照明与防滑设施；了解夜间响应、人员排班和突发情况处理。防跌倒需要同时关注老人状态与周围环境。', '请机构说明与老人具体需求对应的服务、人员及边界；听到“都能护理”时，继续问由谁做、何时做、怎样记录和联系家属。'] },
      { title: '04 / 把收费拆开来看', paragraphs: ['请机构分别列出床位、照护、餐费、一次性项目与押金，问清哪些按月、按次或另行计费。目录参考价格不等于完整账单。', '核对收费公示与合同，了解调整、退款及收款账户。保留合同和付款凭证，对投资返利或高回报承诺保持警惕。'] },
    ],
    sources: [
      { id: 'falls', title: '中国疾控中心：预防老年人跌倒健康教育核心信息', scope: '全国 · 防跌倒科普参考', published: '2024-09-23', url: 'https://ncncd.chinacdc.cn/xzzq/202409/t20240923_311832.htm' }, feeSource, contractSource,
    ],
  },
  admission: {
    title: '入住指南', kicker: '从了解需求，到安心准备',
    introduction: '不用一次决定所有事情。带着下面的顺序，一步步核实，给老人和家人留出讨论时间。',
    notice: '实际入住条件、所需材料和费用，以机构当期确认结果及双方合同为准。本指南不代表机构已开放接收或平台已开放预约。',
    sections: [
      { title: '01 / 了解需求', paragraphs: ['与老人沟通居住意愿，整理日常照护、生活习惯、位置偏好和可持续预算。可使用已有需求评估作梳理参考。'] },
      { title: '02 / 筛选机构', paragraphs: ['用名称、区域、性质缩小目录范围，再进入详情核对资料。未知信息继续列为待问项，不把资料缺失理解为机构具备能力。'] },
      { title: '03 / 联系核实', paragraphs: ['向机构确认当前接收条件、照护安排、床位和完整费用，请对方说明与老人情况有关的限制。公开电话是否可接通也需实际确认。'] },
      { title: '04 / 预约参观', paragraphs: ['与机构直接确认时间、联系人及参观安排。现场带着照护问题清单查看环境和服务；尚未确认的预约不视为已预约成功。'] },
      { title: '05 / 确认费用与合同', paragraphs: ['逐项核对收费、服务边界、押金、调价和退费约定。核对签约与收款主体，理解合同后再决定，保留签署文本和付款凭证。'] },
      { title: '06 / 入住准备', paragraphs: ['请机构提供当期材料清单，再准备证件、相关健康资料、用药说明及个人物品。明确紧急联系人和日常沟通方式，只向必要的接收方提供资料。'] },
    ],
    sources: [contractSource, feeSource],
  },
}
