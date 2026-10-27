// Identity + pre-App API interception is an independent barrier from data adapters.
// Build-time inclusion only; this module is absent from PRODUCTION output.
export const installDemoGuards = (expectedAppId: string): void => {
  const account = wx.getAccountInfoSync().miniProgram
  if (account.appId !== expectedAppId || (account.envVersion !== 'develop' && account.envVersion !== 'trial')) throw new Error('DEMO_IDENTITY_GATE_CLOSED')
  const api = wx as unknown as { [key: string]: unknown }
  const deny = (target: { [key: string]: unknown }, name: string): void => {
    if (typeof target[name] !== 'function') return
    const blocked = (): never => { throw new Error('DEMO_API_BLOCKED:' + name) }
    target[name] = blocked
    if (target[name] !== blocked) throw new Error('DEMO_GUARD_INSTALL_FAILED')
  }
  for (const name of ['request','uploadFile','downloadFile','connectSocket','login','authorize','getUserInfo','getUserProfile','getPhoneNumber','getLocation','chooseLocation','openLocation','chooseImage','chooseMedia','getFileSystemManager','getStorage','getStorageSync','setStorage','setStorageSync','removeStorage','removeStorageSync','clearStorage','clearStorageSync','getStorageInfo','getStorageInfoSync','batchGetStorage','batchGetStorageSync','batchSetStorage','batchSetStorageSync','requestPayment','makePhoneCall','openCustomerServiceChat','addPhoneContact','getRecorderManager','startRecord','setClipboardData','getClipboardData','createUDPSocket','createTCPSocket','preDownloadSubpackage','loadSubpackage','createVKSession','getRealtimeLogManager','getLogManager','getBackgroundFetchData','setBackgroundFetchToken','getBackgroundFetchToken']) deny(api, name)
  if (api.cloud && (typeof api.cloud === 'object' || typeof api.cloud === 'function')) {
    const cloud = api.cloud as { [key: string]: unknown }
    // Guard all exposed cloud methods, including new SDK methods.
    for (const name of Object.getOwnPropertyNames(cloud)) deny(cloud, name)
    for (const name of ['init','callFunction','database','uploadFile','downloadFile','deleteFile','getTempFileURL','Cloud','connectContainer','callContainer']) deny(cloud, name)
  }
}
