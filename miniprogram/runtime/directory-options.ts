// Existing Classic B search keys: application enums, never administrative codes.
export const directoryNatureOptions = Object.freeze([
  { value: 'all', label: '全部性质' }, { value: 'public', label: '公办' },
  { value: 'public_built_private_operated', label: '公建民营' },
  { value: 'private', label: '民办' }, { value: 'unknown', label: '性质待确认' },
].map(option => Object.freeze(option)))
export const directoryDistrictOptions = Object.freeze([
  { value: 'all', label: '全部区域' }, { value: 'jiangan', label: '江岸区' },
  { value: 'jianghan', label: '江汉区' }, { value: 'qiaokou', label: '硚口区' },
  { value: 'hanyang', label: '汉阳区' }, { value: 'wuchang', label: '武昌区' },
  { value: 'qingshan', label: '青山区' }, { value: 'hongshan', label: '洪山区' },
  { value: 'dongxihu', label: '东西湖区' }, { value: 'hannan', label: '汉南区' },
  { value: 'caidian', label: '蔡甸区' }, { value: 'jiangxia', label: '江夏区' },
  { value: 'huangpi', label: '黄陂区' }, { value: 'xinzhou', label: '新洲区' },
  { value: 'unknown', label: '区域待确认' },
].map(option => Object.freeze(option)))
