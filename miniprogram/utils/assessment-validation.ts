import type { AssessmentQuestionId } from '../types/assessment'
import type { AssessmentQuestionIdV2 } from '../types/assessment-v2'

const ASSESSMENT_ERROR_SCROLL_DURATION = 220

/**
 * 页面级题目锚点只由稳定 question ID 生成，避免依赖中文文案或组件内部节点。
 */
export const getAssessmentQuestionAnchorId = (questionId: AssessmentQuestionId | AssessmentQuestionIdV2): string =>
  `assessment-question-${questionId.replace(/[^a-zA-Z0-9]+/g, '-')}`

/** 将页面滚动到题目外层锚点；调用方应在更新错误状态后调用。 */
export const scrollToAssessmentQuestion = (questionId: AssessmentQuestionId | AssessmentQuestionIdV2): void => {
  const selector = `#${getAssessmentQuestionAnchorId(questionId)}`
  wx.nextTick(() => {
    wx.pageScrollTo({
      selector,
      duration: ASSESSMENT_ERROR_SCROLL_DURATION,
    })
  })
}
