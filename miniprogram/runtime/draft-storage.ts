// The DEMO build substitutes an in-memory adapter at this boundary.
export const draftStorage = {
  getStorageSync: (key: string): unknown => wx.getStorageSync(key),
  setStorageSync: (key: string, value: unknown): void => wx.setStorageSync(key, value),
  removeStorageSync: (key: string): void => wx.removeStorageSync(key),
}
