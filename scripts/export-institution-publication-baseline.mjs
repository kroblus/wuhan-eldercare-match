// Local export only. Import is an explicit authenticated admin action.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = process.cwd(), built = path.join(root, 'dist/production')
const marker = JSON.parse(fs.readFileSync(path.join(built, '.shared-build.json'), 'utf8'))
assert.equal(marker.mode, 'production')
assert.equal(marker.status, 'PASS_LOCAL_BUILD', 'Run npm run build:production before exporting')
const runtime = createWechatTsRuntime(loadWechatTypeScript().ts)
const load = file => runtime.load(path.join(built, 'miniprogram', file + '.js'))
const { readModeCatalog, readProductionRevision } = load('production/catalog')
const catalog = readModeCatalog()
assert.equal(load('services/institution-catalog-validation-v121').validateInstitutionCatalogPayloadV121(catalog).ok, true)
const historicalRecords = []
for (const pointer of catalog.currentPointers) {
  for (let revision = 1; revision < pointer.recordRevision; revision++) {
    const record = readProductionRevision(pointer.institutionId, revision)
    assert.ok(record, `Missing original version: ${pointer.institutionId}#${revision}`)
    historicalRecords.push(record)
  }
}
const output = path.resolve(root, process.argv[2] || 'output/institution-publication-baseline/baseline.json')
const relativeOutput = path.relative(path.join(root, 'output'), output)
assert.ok(relativeOutput && !relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput), 'Export must stay under this project output directory')
const content = JSON.stringify({ catalog, historicalRecords }, null, 2) + '\n'
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, content, { flag: 'wx' })
console.log(JSON.stringify({ output, currentRecords: catalog.records.length, historicalRecords: historicalRecords.length,
  sha256: createHash('sha256').update(content).digest('hex'), buildTime: marker.builtAt, action: 'LOCAL_EXPORT_ONLY' }))
