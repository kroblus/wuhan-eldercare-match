import type { AdministrativeDivisionResolver } from '../domain/institution/v1-2-1/public-location'

// Bounded hierarchy for the reviewed first institution only. Unknown districts
// fail closed until the provider's reviewed division list is explicitly extended.
// Source: https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/ (武汉行政区划), reviewed 2026-10-22.
export const administrativeDivisionResolver: AdministrativeDivisionResolver = {
  isValidHierarchy: address => address.countryCode === 'CN'
    && address.province.code === '420000' && address.province.displayName === '湖北省'
    && address.city.code === '420100' && address.city.displayName === '武汉市'
    && address.district.code === '420103' && address.district.displayName === '江汉区',
}
