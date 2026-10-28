import { backToShowcase } from '../pages/showcase/navigation'
import type { ShowcaseContext } from '../types/showcase-context'
export const resolveShowcaseContext = async (_query: Record<string, string | undefined>): Promise<ShowcaseContext | null> => null
export const backFromShowcase = (page: object, _context: ShowcaseContext | null, fail: () => void): void => backToShowcase(page, fail)
export const panoramaNotice = '演示资料，仅用于体验拖动与缩放，不关联机构身份。'
