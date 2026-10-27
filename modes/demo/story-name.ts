// UI alias for the existing story entity; does not rewrite its revision or snapshots.
export const storyInstitutionId = 'demo-inst-chunhe-home'
export const storyDisplayName = (id: string, fallback = ''): string => id === storyInstitutionId
  ? '虚构示例·春和颐养中心' : fallback.replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, '')
