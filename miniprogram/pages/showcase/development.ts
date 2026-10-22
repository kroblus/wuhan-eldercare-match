// Registered for source integration, but unavailable in trial/release builds.
export function isDevelopmentBuild(): boolean {
  try { return wx.getAccountInfoSync().miniProgram.envVersion === 'develop' } catch (_) { return false }
}
