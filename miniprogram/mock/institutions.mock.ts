/**
 * MOCK_DEVELOPMENT_ONLY
 *
 * 本文件仅用于 Bootstrap UI 与路由流程，不代表任何真实合作机构。
 * 禁止把这些记录当作生产机构、价格、护理能力或 VR 数据。
 */
import type { Institution } from '../types/domain'

export const MOCK_INSTITUTIONS: Institution[] = [
  {
    id: 'mock-institution-001',
    name: '武汉养老机构示例 A（Mock）',
    regionCode: null,
    regionDisplayName: null,
    address: null,
    institutionType: null,
    coverImageUrl: null,
    monthlyFee: null,
    services: [],
    media: [],
    vr: {
      status: 'unknown',
      url: null,
      previewImageUrl: null,
      dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    },
    price: {
      monthlyRange: null,
      deposit: null,
      note: '需咨询',
      dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    },
    dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
  },
  {
    id: 'mock-institution-002',
    name: '武汉养老机构示例 B（Mock）',
    regionCode: null,
    regionDisplayName: null,
    address: null,
    institutionType: null,
    coverImageUrl: null,
    monthlyFee: null,
    services: [],
    media: [],
    vr: {
      status: 'unknown',
      url: null,
      previewImageUrl: null,
      dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    },
    price: {
      monthlyRange: null,
      deposit: null,
      note: '需咨询',
      dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    },
    dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
  },
]
