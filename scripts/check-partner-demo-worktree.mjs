import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidence = path.join(root, 'output/partner-demo-s1-isolation-shell-v0-1')
const owned = (name) => name.startsWith('partner-demo/') || name.startsWith('output/partner-demo-s1-isolation-shell-v0-1/') || [
  'scripts/check-partner-demo-worktree.mjs',
  'scripts/check-partner-demo-s1.mjs',
  'scripts/support/partner-demo-isolation-check.mjs',
].includes(name)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const digest = (name) => createHash('sha256').update(readFileSync(name)).digest('hex')
const names = (text) => text.split('\0').filter(Boolean)
const snapshot = () => {
  const tracked = names(git('ls-files', '-z'))
  const untracked = names(git('ls-files', '--others', '--exclude-standard', '-z')).filter((name) => !owned(name))
  const status = names(git('status', '--porcelain=v1', '-z')).filter((entry) => !owned(entry.slice(3)))
  const index = path.resolve(root, git('rev-parse', '--git-path', 'index').trim())
  const files = [...new Set([...tracked, ...untracked, 'project.private.config.json'])].filter((name) => existsSync(path.join(root, name)))
  return {
    HEAD: git('rev-parse', 'HEAD').trim(), BRANCH: git('branch', '--show-current').trim(),
    WORKTREE: root, INDEX_STATE: { hash: digest(index), entries: git('ls-files', '--stage', '-z'), diff: git('diff', '--cached', '--binary') },
    status, PRE_EXISTING_UNTRACKED_FILES: untracked,
    hashes: Object.fromEntries(files.map((name) => [name, digest(path.join(root, name))])),
  }
}
mkdirSync(evidence, { recursive: true })
const beforePath = path.join(evidence, 'worktree-before.json')
if (process.argv[2] === 'capture') {
  if (existsSync(beforePath)) throw new Error('Refusing to overwrite initial evidence')
  const before = snapshot()
  writeFileSync(beforePath, JSON.stringify(before, null, 2) + '\n')
  console.log(JSON.stringify({ HEAD: before.HEAD, BRANCH: before.BRANCH, WORKTREE: before.WORKTREE, indexHash: before.INDEX_STATE.hash, protectedFiles: Object.keys(before.hashes).length, preExistingUntracked: before.PRE_EXISTING_UNTRACKED_FILES.length }))
} else if (process.argv[2] === 'verify') {
  const before = JSON.parse(readFileSync(beforePath, 'utf8'))
  const after = snapshot()
  const changed = Object.entries(before.hashes).filter(([name, hash]) => after.hashes[name] !== hash).map(([name]) => name)
  const unchanged = ['HEAD', 'BRANCH', 'WORKTREE', 'INDEX_STATE', 'status', 'PRE_EXISTING_UNTRACKED_FILES'].every((key) => JSON.stringify(before[key]) === JSON.stringify(after[key]))
  const result = { pass: unchanged && changed.length === 0, protectedFiles: Object.keys(before.hashes).length, changed, gitAndIndexUnchanged: unchanged }
  writeFileSync(path.join(evidence, 'worktree-preservation.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
  if (!result.pass) process.exitCode = 1
} else throw new Error('Use capture or verify')
