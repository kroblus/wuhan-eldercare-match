// Public browsing only: respect WeChat text preference without changing business state.
export const readBrowseFontStyle = (): string => {
  try {
    const size = wx.getSystemInfoSync().fontSizeSetting
    if (!Number.isFinite(size) || size <= 16) return ''
    return [['body', 16], ['meta', 14], ['control', 16], ['title', 20], ['hero', 23]]
      .map(([name, base]) => '--browse-' + name + '-size:' + Number(base) * size / 16 + 'px').join(';')
  } catch (_error) { return '' }
}
