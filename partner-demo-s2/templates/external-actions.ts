// Explicit adapter: original actions in staged page copies cannot call native externals.
export const denyDemoExternalAction = (options?: { fail?: (error: unknown) => void; complete?: (error: unknown) => void }): void => {
  const error = { errMsg: 'TEST_ONLY: 演示不提供真实电话、地图或授权操作' }
  if (options && options.fail) options.fail(error)
  if (options && options.complete) options.complete(error)
}
