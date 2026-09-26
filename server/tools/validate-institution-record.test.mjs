import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  enrichInstitutionV121,
  makeValidInstitutionV12,
  makeValidInstitutionV121,
} from '../../scripts/fixtures/institution-v1-2-1-fixtures.mjs'
import { validInstitutionV11Fixtures } from '../../scripts/fixtures/institution-v1-1-fixtures.mjs'
import { validInstitutionFixtures } from '../../scripts/fixtures/institution-fixtures.mjs'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const bridge = path.join(repositoryRoot, 'server', 'tools', 'validate-institution-record.mjs')
const sourceRoot = path.join(repositoryRoot, 'miniprogram')

const validate = (input) => {
  const result = spawnSync(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    bridge, '--source-root', sourceRoot,
  ], { input: JSON.stringify(input), encoding: 'utf8' })
  return { status: result.status, output: JSON.parse(result.stdout) }
}

test('accepts the complete synthetic V1.2.1 record with lawful unknown fields', () => {
  const result = validate({ record: makeValidInstitutionV121() })
  assert.equal(result.status, 0)
  assert.deepEqual(result.output, { valid: true, issues: [] })
})

test('dispatches existing V1, V1.1 and V1.2 validators without changing their semantics', () => {
  for (const record of [
    validInstitutionFixtures[0].record,
    validInstitutionV11Fixtures[0].record,
    makeValidInstitutionV12(),
  ]) {
    const result = validate({ record })
    assert.equal(result.status, 0)
    assert.equal(result.output.valid, true, JSON.stringify(result.output.issues))
  }
})

test('rejects an incomplete record through the full successor validator chain', () => {
  const result = validate({ record: { contractVersion: 'institution-contract-v1.2.1' } })
  assert.equal(result.status, 0)
  assert.equal(result.output.valid, false)
  assert.ok(result.output.issues.some((issue) => issue.code === 'INVALID_CARE_PROCESS_SHAPE'))
})

test('fails closed for a provided address without an authoritative code catalog', () => {
  const record = enrichInstitutionV121(makeValidInstitutionV121(), {
    careProcess: false,
    contact: false,
  })
  const result = validate({ record })
  assert.equal(result.status, 0)
  assert.equal(result.output.valid, false)
  assert.ok(result.output.issues.some((issue) =>
    issue.code === 'ADMINISTRATIVE_DIVISION_RESOLVER_NOT_CONFIGURED'))
})

test('rejects an unknown contract version without running a fallback validator', () => {
  const record = makeValidInstitutionV121()
  record.contractVersion = 'institution-contract-unknown'
  const result = validate({ record })
  assert.equal(result.status, 0)
  assert.deepEqual(result.output.issues, [{ code: 'INVALID_CONTRACT_VERSION', path: 'contractVersion' }])
})
