import type { CapabilitySource, CapabilityRevisionChange } from './capability-evidence'
export const capabilityReviewDate = '2026-10-23'
const document = (title: string, publisher: string, url: string, publishedOn: string | null, publicationNote = '', sourceType: CapabilitySource['sourceType'] = 'official_document', institutionIds: readonly string[] = []): CapabilitySource => ({
  institutionIds,
  title, publisher, url, publishedOn, publicationNote, sourceType,
  reviewedOn: capabilityReviewDate, reviewDueOn: '2026-11-22', reviewState: 'available',
})
export const capabilitySources: Readonly<Record<string, CapabilitySource>> = {
  first: document('武汉市社会福利院', '武汉市民政局', 'https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/jgjj/jgsz/xsjg/201912/t20191220_255274.shtml', '2024-01-02', '', 'official_document', ['wh-social-welfare-institute']),
  hanyang: document('汉阳区开展经济困难失能老人集中照护服务公告', '汉阳区民政局', 'https://www.hanyang.gov.cn/bmxxgk/zfgzjg/qmzj/fdzdgknr/shbz01/ylfw/202406/t20240606_2412994.shtml', '2024-06-06', '', 'official_document', ['wh-hanyang-social-welfare']),
  hongshan: document('洪山区收住经济困难失能老年人养老机构通告', '洪山区民政局', 'https://www.hongshan.gov.cn/zfbm/mzj/fdzdgknr/tzgg/202404/t20240425_2393546.shtml', '2024-04-25', '', 'official_document', ['wh-hongshan-social-welfare']),
  openDay: document('汉阳区关于开展养老机构开放日活动的公告', '汉阳区民政局', 'https://www.hanyang.gov.cn/zwgk_38/xxgkml/gysyjs/shbz/ylfw/202609/t20260921_2851947.shtml', '2026-09-18', '发布日期采用页面正文，不采用URL日期；活动已结束，不作为持续开放或预约依据。', 'official_document', ['wh-hanyang-social-welfare', 'wh-taibao-hanyang']),
  hanyangAttachment: document('汉阳区社会福利院养老机构开放日体验活动方案', '汉阳区民政局（公告附件）', 'https://www.hanyang.gov.cn/zwgk_38/xxgkml/gysyjs/shbz/ylfw/202609/P020260921625611798419.pdf', null, '附件未单独标注发布日期；关联公告2026-09-18，活动日期2026-09-24，二者不冒充附件发布日期。', 'official_document', ['wh-hanyang-social-welfare']),
  taibaoAttachment: document('太保家园养老机构开放日活动实施方案', '汉阳区民政局（公告附件）', 'https://www.hanyang.gov.cn/zwgk_38/xxgkml/gysyjs/shbz/ylfw/202609/P020260921625611961160.pdf', null, '附件未单独标注发布日期；关联公告2026-09-18，活动日期2026-09-23。', 'official_document', ['wh-taibao-hanyang']),
  taibao: document('太保家园第九园：武汉国际颐养社区开业', '中国太平洋保险官网', 'https://life.cpic.com.cn/c/2024-11-04/1867397.shtml', null, '正文明确开业事件日期2024-10-23，未展示独立发稿日期；不从URL推定发布日期。', 'institution_provided', ['wh-taibao-hanyang']),
  taibaoProfile: document('武汉国际颐养社区', '太保家园官网', 'https://mtbjy.cpic.com.cn/mtbjy/jybj/whgjyysq/', null, '页面未标注服务资料的发布日期或有效期。', 'institution_provided', ['wh-taibao-hanyang']),
}
export interface CapabilityResearchObservation {
  fieldPaths: readonly string[]; sourceKeys: readonly string[]
  originalStatement: string | null; conclusion: string; question: string
}
export interface CapabilityResearchCase {
  institutionId: string; recordRevision: number; name: string
  reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY'
  observations: readonly CapabilityResearchObservation[]
}
const feeReview = (sourceKeys: readonly string[]): CapabilityResearchObservation => ({ fieldPaths: ['price.referenceMonthlyPrice'], sourceKeys,
  originalStatement: null, conclusion: '所核对原文未给出当前完整收费表、一次性费用和入住材料清单；不能将活动、历史接收范围或某个房型变为当期总费用。',
  question: '请提供当期房型、照护等级收费、包含项目、押金或一次性费用，以及入住评估与材料清单。' })
export const capabilityResearchCases: readonly CapabilityResearchCase[] = [
  { institutionId: 'wh-social-welfare-institute', recordRevision: 1, name: '武汉市社会福利院', reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', observations: [
    { fieldPaths: ['capabilities.specialCare.rehabilitation_training'], sourceKeys: ['first'], originalStatement: '生活照料、康复护理、医疗保健',
      conclusion: '历史机构职能概述，不足以核对当前康复训练项目、接收范围及专项护理；不把概述转换为已核实支持。', question: '目前开展哪些康复训练，是否需要个案评估，适用于哪些照护情况？' }, feeReview(['first']),
  ] },
  { institutionId: 'wh-hanyang-social-welfare', recordRevision: 1, name: '武汉市汉阳区社会福利院', reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', observations: [
    { fieldPaths: ['capabilities.careLevelAcceptance.disabled', 'capabilities.careLevelAcceptance.severely_disabled'], sourceKeys: ['hanyang'], originalStatement: '具备收住完全失能老年人的服务条件',
      conclusion: '2024年特定救助项目条件；国标完全失能4级不能直接等同平台失能或重度失能代码，且未证明当前普遍接收。', question: '请分别确认平台五档生活照护需求的当前接收范围、例外情况与评估要求。' },
    { fieldPaths: ['capabilities.specialCare.rehabilitation_training'], sourceKeys: ['openDay', 'hanyangAttachment'], originalStatement: '体验照护、文娱、康复服务',
      conclusion: '2026年开放日参观安排与团队概况，不是逐项护理能力证明；活动已结束，不代表当前可预约。', question: '请提供当前康复训练的具体服务清单、限制和有效说明。' }, feeReview(['hanyang', 'openDay', 'hanyangAttachment']),
  ] },
  { institutionId: 'wh-hongshan-social-welfare', recordRevision: 1, name: '武汉市洪山区社会福利院', reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', observations: [
    { fieldPaths: ['capabilities.careLevelAcceptance.disabled', 'capabilities.careLevelAcceptance.severely_disabled'], sourceKeys: ['hongshan'], originalStatement: '具备收住完全失能老年人的服务条件',
      conclusion: '历史经济困难失能老人项目，不能外推当前普遍接收条件；国标等级与平台分档无直接核定对应。', question: '目前接收哪些生活功能依赖情况，哪些情况需要另行评估？' }, feeReview(['hongshan']),
  ] },
  { institutionId: 'wh-taibao-hanyang', recordRevision: 1, name: '太保家园（武汉）养老服务有限公司', reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY', observations: [
    { fieldPaths: ['capabilities.cognitiveSupport.dementia_acceptance', 'capabilities.cognitiveSupport.wandering_risk_support', 'capabilities.specialCare.dementia_unit'], sourceKeys: ['taibao', 'taibaoAttachment'], originalStatement: '积极推进“乐忆家”认知症照护专区的落地',
      conclusion: '历史新闻中的建设计划与附件记忆照护介绍，不能证明专区已经启用，也不证明高走失风险接收能力。', question: '认知症专区是否已投入使用，接收范围及走失风险照护条件分别是什么？' },
    { fieldPaths: ['rehabilitationSupport.features.postoperative_rehabilitation', 'capabilities.specialCare.rehabilitation_training'], sourceKeys: ['taibaoAttachment'], originalStatement: '记忆照护、术后康复、慢病管理',
      conclusion: '附件简介虽提及术后康复，但未明确服务日期、具体训练与适用条件；不从康复介绍推定专项训练能力。', question: '术后康复具体提供哪些项目，当前是否开展，是否需要医疗或机构评估？' },
    { fieldPaths: ['capabilities.careLevelAcceptance.independent', 'capabilities.careLevelAcceptance.light_care'], sourceKeys: ['taibaoProfile'], originalStatement: '自理、协助、专业护理',
      conclusion: '未标注日期的概括介绍，不能把协助生活等同平台轻度照护或其他接收等级。', question: '请分别核对当前自理、轻度照护与其他照护等级的接收条件。' }, feeReview(['taibaoAttachment', 'taibaoProfile']),
  ] },
]

// No public material reviewed in this batch satisfies a current, exact-field
// capability conclusion. Pending observations NEVER become provider patches.
export const productionCapabilityRevisions: readonly CapabilityRevisionChange[] = []
