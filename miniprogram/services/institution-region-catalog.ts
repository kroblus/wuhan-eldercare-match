import type { Institution } from '../types/domain'

export interface InstitutionRegionCatalogOption {
  value: string
  label: string
}

export interface InstitutionRegionCatalog {
  options: InstitutionRegionCatalogOption[]
  catalogVersion: string
}

export type InstitutionRegionCatalogFailureReason = 'conflicting_label'

export interface InstitutionRegionCatalogError {
  ok: false
  reason: InstitutionRegionCatalogFailureReason
  regionCode: string
}

export interface InstitutionRegionCatalogSuccess {
  ok: true
  catalog: InstitutionRegionCatalog
}

export type InstitutionRegionCatalogResult = InstitutionRegionCatalogSuccess | InstitutionRegionCatalogError

const EMPTY_CATALOG_VERSION = 'institution-region-catalog-v1-empty'

const compareStable = (left: string, right: string): number => {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

const hashCanonicalEntries = (canonicalEntries: string): string => {
  let hash = 2166136261
  for (let index = 0; index < canonicalEntries.length; index += 1) {
    hash ^= canonicalEntries.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const isUsableRegionPart = (value: unknown, reservedValue?: string): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.trim()
  return normalized.length > 0
    && normalized !== 'unknown'
    && normalized !== '需咨询'
    && normalized !== reservedValue
}

/**
 * 从已核验机构生成确定性的区域目录。
 * Mock/UNKNOWN 机构会被过滤；同一 code 出现不同展示名视为数据错误，避免静默选择。
 */
export const buildInstitutionRegionCatalog = (institutions: readonly Institution[]): InstitutionRegionCatalogResult => {
  const labelsByCode: Record<string, string> = {}

  institutions.forEach((institution) => {
    if (institution.dataProvenance !== 'VERIFIED') {
      return
    }
    if (!isUsableRegionPart(institution.regionCode, 'no_preference')
      || !isUsableRegionPart(institution.regionDisplayName, '不限制')) {
      return
    }

    const regionCode = institution.regionCode.trim()
    const regionDisplayName = institution.regionDisplayName.trim()
    const existingLabel = labelsByCode[regionCode]
    if (existingLabel !== undefined && existingLabel !== regionDisplayName) {
      return
    }
    labelsByCode[regionCode] = regionDisplayName
  })

  const validVerifiedEntries = institutions
    .filter((institution) => institution.dataProvenance === 'VERIFIED')
    .map((institution) => {
      const regionCode = isUsableRegionPart(institution.regionCode, 'no_preference')
        ? institution.regionCode.trim()
        : ''
      const regionDisplayName = isUsableRegionPart(institution.regionDisplayName, '不限制')
        ? institution.regionDisplayName.trim()
        : ''
      return { regionCode, regionDisplayName }
    })
    .filter((entry) => entry.regionCode.length > 0 && entry.regionDisplayName.length > 0)

  const conflict = validVerifiedEntries.find((entry) => labelsByCode[entry.regionCode] !== entry.regionDisplayName)
  if (conflict) {
    return { ok: false, reason: 'conflicting_label', regionCode: conflict.regionCode }
  }

  const regionCodes = Object.keys(labelsByCode).sort(compareStable)
  const options = regionCodes.map((regionCode) => ({
    value: regionCode,
    label: labelsByCode[regionCode],
  }))
  const canonicalEntries = options.map((option) => `${JSON.stringify(option.value)}:${JSON.stringify(option.label)}`).join('|')
  const catalogVersion = options.length === 0
    ? EMPTY_CATALOG_VERSION
    : `institution-region-catalog-v1-${hashCanonicalEntries(canonicalEntries)}`

  return {
    ok: true,
    catalog: {
      options,
      catalogVersion,
    },
  }
}
