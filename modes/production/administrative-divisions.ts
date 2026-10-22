import type { AdministrativeDivisionResolver } from '../domain/institution/v1-2-1/public-location'

// Reviewed municipal districts only; never map development zones to a district.
// Source: https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/ 武汉行政区划; reviewed 2026-10-22.
export const reviewedDistricts = [
  { code: '420102', displayName: '江岸区', searchKey: 'jiangan' },
  { code: '420103', displayName: '江汉区', searchKey: 'jianghan' },
  { code: '420104', displayName: '硚口区', searchKey: 'qiaokou' },
  { code: '420105', displayName: '汉阳区', searchKey: 'hanyang' },
  { code: '420106', displayName: '武昌区', searchKey: 'wuchang' },
  { code: '420107', displayName: '青山区', searchKey: 'qingshan' },
  { code: '420111', displayName: '洪山区', searchKey: 'hongshan' },
  { code: '420112', displayName: '东西湖区', searchKey: 'dongxihu' },
] as const
export const administrativeDivisionResolver: AdministrativeDivisionResolver = {
  isValidHierarchy: address => address.countryCode === 'CN'
    && address.province.code === '420000' && address.province.displayName === '湖北省'
    && address.city.code === '420100' && address.city.displayName === '武汉市'
    && reviewedDistricts.some(district => district.code === address.district.code && district.displayName === address.district.displayName),
}
