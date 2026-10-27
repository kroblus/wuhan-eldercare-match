import type { DemoAssessment } from './session'
import { deriveHistoricalProfileDisplayV1 } from '../domain/assessment-history/profile-display'

export const basicRecordRows = (record: DemoAssessment) => {
  const answers = record.assessmentSnapshot.answers
  const genders: Record<string, string> = { female: '女', male: '男' }
  const gender = genders[answers['basic.gender']] || '性别未填写'
  const living: Record<string, string> = { alone: '独居', with_spouse: '与配偶同住', with_children: '与子女同住', with_other_relatives: '与其他亲属同住', hospitalized: '当前住院', in_eldercare_institution: '已入住养老机构', other: '其他' }
  return [
    { label: '性别与年龄', value: gender + ' · ' + answers['basic.age'] + '岁' },
    { label: '居住情况', value: living[answers['basic.livingStatus'] || ''] || '居住情况待确认' },
  ]
}
export const savedProfileRows = (record: DemoAssessment) => {
  const profile = deriveHistoricalProfileDisplayV1(record.assessmentSnapshot)
  return profile.ok ? profile.display.rows : []
}
export const assessmentSummary = (record: DemoAssessment): string => savedProfileRows(record).slice(0, 2).map(row => row.value).join(' · ')
