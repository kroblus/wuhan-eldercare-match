import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { assessmentV2Fixtures, makeCompleteV2Answers } from './fixtures/assessment-v2-fixtures.mjs'
const vectors = [...assessmentV2Fixtures,
  { answers: makeCompleteV2Answers({ 'basic.hasInstitutionExperience': 'false' }), expectedValid: false },
  { answers: {}, expectedValid: false },
  { answers: { kind: 'assessment_draft' }, expectedValid: false },
]
for (const vector of vectors) {
  const result = spawnSync(process.execPath, ['--no-warnings', 'server/tools/validate-completed-assessment.mjs', '--source-root', 'miniprogram/types'], {
    encoding: 'utf8', input: JSON.stringify(vector.answers), timeout: 10000,
  })
  assert.equal(result.status, 0)
  const response = JSON.parse(result.stdout)
  assert.equal(response.technicalFailure, false)
  assert.equal(response.valid, vector.expectedValid)
  assert.deepEqual(Object.keys(response).sort(), ['technicalFailure', 'valid'], 'no answers/issues logged')
}
console.log(`PASS: ${vectors.length} shared Assessment V2 contract vectors through the exact backend validator bridge`)
