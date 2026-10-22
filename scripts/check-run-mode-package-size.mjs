import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Raw file bytes are a local guard, not a claim about WeChat's final package.
// Leave 64 KiB below the 2 MiB main-package limit for packaging overhead.
export const sourceBudgetBytes = 2 * 1024 * 1024 - 64 * 1024
export function checkRunModePackageSize(project) {
  const config = JSON.parse(fs.readFileSync(path.join(project, 'project.config.json')))
  const runtime = path.resolve(project, config.miniprogramRoot)
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), 'Unexpected package symlink')
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
  const files = walk(runtime)
  assert.ok(files.some(file => path.relative(runtime, file) === 'app.json'))
  assert.ok(files.every(file => !/\.(ts|less|map|log|zip|bundle)$/.test(file)), 'Source or diagnostic files in runtime package')
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0)
  assert.ok(bytes <= sourceBudgetBytes, `${path.basename(project)} source ${Math.ceil(bytes / 1024)} KiB exceeds local budget ${sourceBudgetBytes / 1024} KiB; reduce runtime size before device debugging`)
  console.log(`${path.basename(project).toUpperCase()}: runtime files ${Math.ceil(bytes / 1024)} KiB; budget ${sourceBudgetBytes / 1024} KiB PASS (final WeChat package still requires DevTools verification)`)
  return bytes
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const mode of ['production', 'demo']) checkRunModePackageSize(path.join(root, 'dist', mode))
}
