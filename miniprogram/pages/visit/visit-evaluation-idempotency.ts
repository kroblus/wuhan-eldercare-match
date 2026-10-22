/** Creates the opaque client key for one logical production write attempt. */
export const createWeChatVisitEvaluationIdempotencyKeyV1 = (): Promise<string> =>
  new Promise((resolve, reject) => {
    wx.getRandomValues({
      length: 16,
      success: (result) => {
        try {
          const bytes = new Uint8Array(result.randomValues)
          if (bytes.length !== 16) {
            reject(new Error('idempotency_key_unavailable'))
            return
          }
          const hex = Array.prototype.map.call(bytes, (byte: number) => {
            const value = byte.toString(16)
            return value.length === 1 ? `0${value}` : value
          }).join('') as string
          resolve(`ve1-${hex}`)
        } catch (_error) {
          reject(new Error('idempotency_key_unavailable'))
        }
      },
      fail: () => reject(new Error('idempotency_key_unavailable')),
    })
  })
