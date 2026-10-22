// Publication dates belong to the document, never to its crawl or URL filename.
export interface PublicSource {
  title: string; publisher: string; url: string; publishedOn: string | null
  publicationNote?: string; reviewedOn: string; validUntil: string
  reviewState: 'available' | 'unavailable' | 'conflicting'
}
export const reviewedOn = '2026-10-22'
export const reviewValidUntil = '2027-01-20T23:59:59.000Z'
const source = (title: string, publisher: string, url: string, publishedOn: string | null, publicationNote?: string): PublicSource =>
  ({ title, publisher, url, publishedOn, publicationNote, reviewedOn, validUntil: reviewValidUntil, reviewState: 'available' })
export const publicSources = {
  metropolitan2026: source('2026武汉都市圈养老机构清单', '潜江市民政局（政府门户公开）', 'https://www.hbqj.gov.cn/xxgk/zc/qtwj/gsgg/202606/t20260615_5958211.html', '2026-06-15'),
  jiangan2026: source('江岸区养老机构名单', '武汉市江岸区人民政府', 'https://www.jiangan.gov.cn/jaxxw/zfxxgk/fdzdgk/shgysy_41394/shjzhshfl/ylfw/yljgcx/202110/t20211026_1819861.shtml', '2026-07-30'),
  hanyang2025: source('2025年汉阳区备案养老机构信息', '汉阳区政府门户养老服务栏目', 'https://www.hanyang.gov.cn/zwgk_38/xxgkml/gysyjs/shbz/ylfw/202511/P020251117443595692803.pdf', null, '文件标注2025年度；附件本身未标注发布日期，不从文件名推断。'),
  dongxihu2025: source('2025年东西湖区养老机构备案信息表', '东西湖区民政局', 'https://www.dxh.gov.cn/ZWGK/QZFXXGKML/GGFWXX_devsavepath/SHBZ_devsavepath/ylfw/202511/t20251112_2676023.shtml', '2025-11-12'),
  hongshan2024: source('洪山区收住经济困难失能老年人养老机构通告', '洪山区民政局', 'https://www.hongshan.gov.cn/zfbm/mzj/fdzdgknr/tzgg/202404/t20240425_2393546.shtml', '2024-04-25'),
  hongshanProfile: source('武汉市洪山区社会福利院公共设施资料', '洪山区人民政府门户网站', 'https://www.hongshan.gov.cn/gzfw/ggsscx/yly/202112/t20211222_1878762.shtml', null),
  qiaokouProfile: source('武汉市硚口区社会福利院简介', '硚口区民政局', 'https://www.qiaokou.gov.cn/bsfw/bmfw/yljg/201808/t20180807_112656.shtml', '2022-05-11', '页面标注2022-12-30更新；联系电话与2026名录不同，本轮不提供该院拨号入口。'),
  hanyangProfile: source('汉阳区民政局机构职能及二级单位', '汉阳区民政局', 'https://www.hanyang.gov.cn/bmxxgk/zfgzjg/qmzj/fdzdgknr/jgjj05/jgzn/202106/t20210630_1729868.shtml', null),
  firstProfile: source('武汉市社会福利院', '武汉市民政局', 'https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/jgjj/jgsz/xsjg/201912/t20191220_255274.shtml', '2024-01-02'),
  registry2024: source('养老机构“双随机、一公开”检查对象名录库', '武汉市民政局', 'https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/qtzdgknr/ssj/202401/t20240104_2335959.shtml', '2024-01-04'),
  divisions: source('云上武汉展示中心·武汉行政区划', '武汉市自然资源和城乡建设局', 'https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/', null),
}
export type PublicSourceKey = keyof typeof publicSources
