import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// Resolve existing ancestors too, so junctions/symlinks cannot redirect a new child.
function resolvedTarget(input) {
  let current = path.resolve(input)
  const tail = []
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    assert.notEqual(parent, current, 'No existing output ancestor')
    tail.unshift(path.basename(current)); current = parent
  }
  return path.join(fs.realpathSync(current), ...tail)
}
function isChild(parent, target) {
  const relative = path.relative(parent, target)
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
}
function requiredFlag(argv, name) {
  const index = argv.indexOf(name)
  assert.ok(index >= 0 && argv.lastIndexOf(name) === index && argv[index + 1] && !argv[index + 1].startsWith('--'),
    'Required: ' + name + ' <path>; use a fresh verification subdirectory and this run\'s baseline')
  return argv[index + 1]
}

// Validation is read-only. The caller may mkdir/write only after this returns.
export function requireShowcaseVerificationOutput(argv) {
  const requested = requiredFlag(argv, '--output-dir')
  const baselineFile = fs.realpathSync(requiredFlag(argv, '--baseline'))
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
  assert.ok(baseline.files && typeof baseline.files === 'object' && !Array.isArray(baseline.files) && baseline.head && baseline.indexHash,
    'Expected a preserved workspace baseline with files, HEAD and index hashes')
  const taskRoot = fs.realpathSync(path.dirname(baselineFile))
  const outputRoot = resolvedTarget(path.join(repositoryRoot, 'output'))
  const output = resolvedTarget(requested)
  assert.ok(isChild(outputRoot, taskRoot), 'Baseline must belong to a task under repository output/')
  assert.ok(isChild(taskRoot, output), 'Output must be a new child of this run\'s baseline directory, not repository/output/task root or another task')
  const protectedRoots = new Set(Object.keys(baseline.files).map(file => /^output\/([^/]+)\//.exec(file.replaceAll('\\', '/'))).filter(Boolean).map(match => match[1]))
  for (const name of protectedRoots) {
    const historical = resolvedTarget(path.join(outputRoot, name))
    assert.ok(output !== historical && !isChild(historical, output), 'Refusing protected historical output: ' + name)
  }
  if (fs.existsSync(output)) {
    assert.ok(fs.statSync(output).isDirectory() && fs.readdirSync(output).length === 0, 'Refusing to overwrite a nonempty verification directory; choose a new child')
  }
  return output
}
