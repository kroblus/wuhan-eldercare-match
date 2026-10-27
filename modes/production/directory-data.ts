import type { PublicSourceKey } from './sources'
export type DirectoryNature = 'public' | 'public_built_private_operated' | 'private'
export interface SourcedValue<T> { value: T; sources: readonly PublicSourceKey[] }
export interface PublicDirectoryEntry {
  institutionId: string; recordRevision: number
  name: SourcedValue<string>; districtCode: string; address: SourcedValue<string>
  phone?: SourcedValue<string>; nature?: SourcedValue<DirectoryNature>
  aliases?: readonly string[]; identityNote: string; notes?: readonly string[]
}
// Curated rows only: no contact-person names/mobile numbers, capacity, fee or capability imports.
// Ownership is directory metadata, not InstitutionType (care positioning) or a matching input.
export const publicDirectoryEntries: readonly PublicDirectoryEntry[] = [
  {
    institutionId: 'wh-jiangan-social-welfare', recordRevision: 1,
    name: { value: '武汉市江岸区社会福利院', sources: ['jiangan2026', 'metropolitan2026'] }, districtCode: '420102',
    address: { value: '兴盛路203号', sources: ['jiangan2026', 'registry2024'] },
    identityNote: '区级名单与市级检查名录同名同址；与江汉区市属社会福利院为不同机构。',
    notes: ['公开名单仅列联系人手机号，本页未将其作为机构官方固定电话。'],
  },
  {
    institutionId: 'wh-qiaokou-social-welfare', recordRevision: 1,
    name: { value: '武汉市硚口区社会福利院', sources: ['qiaokouProfile'] }, districtCode: '420104',
    address: { value: '工农路6号', sources: ['qiaokouProfile', 'metropolitan2026'] },
    aliases: ['硚口区社会福利院', '武汉市硚口区社会福利院（老年公寓）'],
    identityNote: '全称、老年公寓称谓及名录简称对应工农路6号同一院址；未另建重复条目。',
    notes: ['不同政府公开资料列示的联系电话不一致，尚未核实，暂不提供拨号入口。'],
  },
  {
    institutionId: 'wh-hanyang-social-welfare', recordRevision: 1,
    name: { value: '武汉市汉阳区社会福利院', sources: ['metropolitan2026', 'hanyangProfile'] }, districtCode: '420105',
    address: { value: '鲤鱼洲路28号', sources: ['hanyang2025', 'hanyangProfile'] },
    phone: { value: '50765120', sources: ['metropolitan2026', 'hanyang2025'] }, nature: { value: 'public', sources: ['hanyang2025'] },
    identityNote: '备案简称与全称对应同址；鲤鱼洲28号与鲤鱼洲路28号经区级资料交叉确认，固定电话一致。',
  },
  {
    institutionId: 'wh-taibao-hanyang', recordRevision: 1,
    name: { value: '太保家园（武汉）养老服务有限公司', sources: ['metropolitan2026'] }, districtCode: '420105',
    address: { value: '四新中路8号', sources: ['metropolitan2026', 'hanyang2025'] },
    phone: { value: '59330999', sources: ['metropolitan2026', 'hanyang2025'] }, nature: { value: 'private', sources: ['hanyang2025'] },
    aliases: ['太保家园（武汉）国际颐养社区'],
    identityNote: '2025备案社区称谓与2026主体名称通过同址、同固定电话交叉对应；仅收录一个身份，不推断其他分院。',
  },
  {
    institutionId: 'wh-zhaoshang-guanyi-hanyang', recordRevision: 1,
    name: { value: '武汉市汉阳区招商观颐之家颐养院', sources: ['metropolitan2026'] }, districtCode: '420105',
    address: { value: '江城大道288号蔚湖轩22栋', sources: ['metropolitan2026', 'hanyang2025'] },
    phone: { value: '84888266', sources: ['metropolitan2026', 'hanyang2025'] }, nature: { value: 'private', sources: ['hanyang2025'] },
    aliases: ['招商观颐之家颐养院'],
    identityNote: '全称与区级备案简称通过同一楼栋地址及固定电话对应，不按简称重复收录。',
  },
  {
    institutionId: 'wh-wuchang-social-welfare', recordRevision: 1,
    name: { value: '武昌区社会福利院', sources: ['metropolitan2026'] }, districtCode: '420106',
    address: { value: '粮道街109号', sources: ['metropolitan2026'] }, phone: { value: '88873947', sources: ['metropolitan2026'] },
    identityNote: '2026政府公开名录第94行；不把单位预算中项目负责人电话作为机构咨询电话。',
  },
  {
    institutionId: 'wh-qingshan-social-welfare', recordRevision: 1,
    name: { value: '武汉市青山区社会福利院', sources: ['metropolitan2026'] }, districtCode: '420107',
    address: { value: '白玉山康寿路1号', sources: ['metropolitan2026'] },
    identityNote: '采用2026政府公开名录第115行；与青山镇街综合养老服务中心为不同名称和地址。',
    notes: ['公开名单仅列联系人手机号，本页未将其作为机构官方固定电话。'],
  },
  {
    institutionId: 'wh-hongshan-social-welfare', recordRevision: 1,
    name: { value: '武汉市洪山区社会福利院', sources: ['hongshanProfile'] }, districtCode: '420111',
    address: { value: '张家湾街烽胜路47号', sources: ['hongshan2024', 'metropolitan2026'] }, phone: { value: '88772151', sources: ['hongshan2024'] },
    nature: { value: 'public', sources: ['hongshanProfile'] },
    identityNote: '区政府公共设施页全称与2026名录简称对应同址；仅取名称、院址、公开固定电话及明确公办描述。',
    notes: ['固定电话来自2024年政府通告，尚未实拨确认；该通告不作为当前接收条件或护理能力承诺。'],
  },
  {
    institutionId: 'wh-dongxihu-baiquan-eldercare', recordRevision: 1,
    name: { value: '东西湖区柏泉街卫生院医养融合康复服务中心', sources: ['metropolitan2026'] }, districtCode: '420112',
    address: { value: '柏泉街商业街8号', sources: ['metropolitan2026', 'dongxihu2025'] }, phone: { value: '83234102', sources: ['metropolitan2026'] },
    nature: { value: 'public', sources: ['dongxihu2025'] }, aliases: ['武汉市东西湖区柏泉街卫生院医养融合康复服务中心'],
    identityNote: '2025备案第11行与2026名录第137行同名同商业街8号；不从卫生院名称推断照护或医疗能力。',
  },
  {
    institutionId: 'wh-dongxihu-jiangjunlu-eldercare', recordRevision: 1,
    name: { value: '东西湖区将军路街卫生院医养融合康复服务中心', sources: ['metropolitan2026'] }, districtCode: '420112',
    address: { value: '将军一路108号', sources: ['metropolitan2026', 'dongxihu2025'] }, nature: { value: 'public', sources: ['dongxihu2025'] },
    aliases: ['武汉市东西湖区将军路街医养融合康复服务中心'],
    identityNote: '2025备案第7行与2026名录第138行同一将军一路108号；合并称谓，不推断具体能力。',
    notes: ['公开名单仅列联系人手机号，本页未将其作为机构官方固定电话。'],
  },
]
