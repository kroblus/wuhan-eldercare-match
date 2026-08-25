import type { AssessmentAnswer, AssessmentDraft } from '../types/domain'

const STORAGE_KEY = 'wuhan-eldercare-match.assessment-draft.v1'

const createEmptyDraft = (): AssessmentDraft => ({
  id: null,
  elderId: null,
  status: 'draft',
  answers: [],
  updatedAt: new Date().toISOString(),
  dataProvenance: 'USER_PROVIDED',
})

const readDraft = (): AssessmentDraft => {
  const saved = wx.getStorageSync(STORAGE_KEY) as Partial<AssessmentDraft> | undefined
  if (!saved || !Array.isArray(saved.answers)) {
    return createEmptyDraft()
  }

  return {
    ...createEmptyDraft(),
    ...saved,
    status: 'draft',
    answers: saved.answers as AssessmentAnswer[],
    dataProvenance: 'USER_PROVIDED',
  }
}

export type AssessmentDraftListener = (draft: AssessmentDraft) => void

export class AssessmentDraftStore {
  private draft: AssessmentDraft = readDraft()
  private listeners: AssessmentDraftListener[] = []

  getDraft(): AssessmentDraft {
    return {
      ...this.draft,
      answers: [...this.draft.answers],
    }
  }

  setAnswer(answer: AssessmentAnswer): AssessmentDraft {
    const index = this.draft.answers.findIndex((item) => item.questionKey === answer.questionKey)
    const answers = [...this.draft.answers]
    if (index >= 0) {
      answers[index] = answer
    } else {
      answers.push(answer)
    }
    this.draft = {
      ...this.draft,
      answers,
      updatedAt: new Date().toISOString(),
    }
    this.persistAndNotify()
    return this.getDraft()
  }

  replaceDraft(draft: AssessmentDraft): AssessmentDraft {
    this.draft = {
      ...draft,
      status: 'draft',
      answers: [...draft.answers],
      dataProvenance: 'USER_PROVIDED',
      updatedAt: new Date().toISOString(),
    }
    this.persistAndNotify()
    return this.getDraft()
  }

  clear(): void {
    this.draft = createEmptyDraft()
    wx.removeStorageSync(STORAGE_KEY)
    this.notify()
  }

  subscribe(listener: AssessmentDraftListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  private persistAndNotify(): void {
    wx.setStorageSync(STORAGE_KEY, this.draft)
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getDraft()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}

export const assessmentDraftStore = new AssessmentDraftStore()
