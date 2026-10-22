export interface PanoramaDimensions { width: number; height: number }
// Strict local demo intake: only a bounded JPEG with no APP1..APP15/COM metadata.
// Aspect ratio cannot prove projection. Owner must separately attest full-sphere capture.
export function inspectPanoramaJpeg(buffer: ArrayBuffer): PanoramaDimensions {
  const bytes = new Uint8Array(buffer)
  if (bytes.length > 8 * 1024 * 1024 || bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216) {
    throw new Error('仅接受不超过 8 MB 的脱敏 JPEG 副本')
  }
  let offset = 2
  let dimensions: PanoramaDimensions | null = null
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) throw new Error('JPEG 结构无效')
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 218) {
      const scanLength = bytes[offset] * 256 + bytes[offset + 1]
      if (scanLength < 2 || offset + scanLength >= bytes.length) throw new Error('JPEG 图像数据无效')
      offset += scanLength
      let ended = false
      while (offset + 1 < bytes.length) {
        if (bytes[offset++] !== 255) continue
        const code = bytes[offset++]
        if (code === 0 || (code >= 208 && code <= 215)) continue
        if (code === 217 && offset === bytes.length) { ended = true; break }
        throw new Error('拒绝扫描间元数据、渐进多扫描或附加内容；请使用准备工具重新编码副本')
      }
      if (!ended) throw new Error('JPEG 数据不完整')
      break
    }
    if (marker === 217) throw new Error('JPEG 缺少图像数据')
    const length = bytes[offset] * 256 + bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) throw new Error('JPEG 结构无效')
    if ((marker >= 225 && marker <= 239) || marker === 254) {
      throw new Error('仍含 EXIF / XMP / ICC 或备注；请先制作无元数据副本')
    }
    if (marker === 224 && (length !== 16 || bytes[offset + 2] !== 74 || bytes[offset + 3] !== 70 || bytes[offset + 4] !== 73 || bytes[offset + 5] !== 70 || bytes[offset + 6] !== 0 || bytes[offset + 14] !== 0 || bytes[offset + 15] !== 0)) {
      throw new Error('拒绝 JPEG 内嵌缩略图或非标准元数据；请重新制作副本')
    }
    if (marker === 194) throw new Error('请使用准备工具导出 baseline JPEG 副本')
    if (marker === 192) {
      if (length < 8) throw new Error('JPEG 尺寸无效')
      dimensions = { height: bytes[offset + 3] * 256 + bytes[offset + 4], width: bytes[offset + 5] * 256 + bytes[offset + 6] }
    }
    offset += length
  }
  if (!dimensions || dimensions.width !== dimensions.height * 2 || dimensions.width < 512 || dimensions.width > 4096) {
    throw new Error('需要 512–4096 像素宽、2:1 的完整球形等距柱状投影 JPEG；普通横向全景暂不接入')
  }
  return dimensions
}
