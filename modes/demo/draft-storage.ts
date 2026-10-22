// No wx Storage reads, writes, clears or migration of a real user's draft.
let memory: { [key: string]: unknown } = {}
const clone = (value: unknown): unknown => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
export const draftStorage = {
  getStorageSync: (key: string): unknown => clone(memory[key]),
  setStorageSync: (key: string, value: unknown): void => { memory[key] = clone(value) },
  removeStorageSync: (key: string): void => { delete memory[key] },
}
export const resetDemoMemory = (): void => { memory = {} }
