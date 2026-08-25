import type { InstitutionServiceContract } from './contracts'
import { mockInstitutionService } from './mock/institution.service.mock'

/**
 * 页面只依赖这个接口；后续接入真实 API 时替换 provider，不在页面散落网络请求调用。
 * 当前 provider 明确为开发期 Mock。
 */
export const institutionService: InstitutionServiceContract = mockInstitutionService
