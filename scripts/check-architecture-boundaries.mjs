// Source-only dependency guard. Uses the same parser and collector for sources and fixtures.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { checkModeSource } from './check-mode-source.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const { ts } = loadWechatTypeScript()

const collect = (file, text) => {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const imports = [], forbidden = []
  const add = (node, kind) => {
    if (node && ts.isStringLiteralLike(node)) imports.push({ specifier: node.text, kind })
    else forbidden.push(`nonliteral ${kind}`)
  }
  const visit = node => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, 'import')
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier, 'export')
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression, 'import-equals')
    }
    if (ts.isImportTypeNode(node)) {
      add(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined, 'import-type')
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (node.arguments.length !== 1) forbidden.push('invalid module call')
      else add(node.arguments[0], node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic-import' : 'require')
    }
    if (ts.isIdentifier(node) && node.text === 'wx') forbidden.push('wx identifier in pure module')
    ts.forEachChild(node, visit)
  }
  visit(ast)
  if (ast.parseDiagnostics.length) forbidden.push('TypeScript parse error')
  return { imports, forbidden }
}

const inspect = (file, text, exists) => {
  const result = collect(file, text)
  const allowed = file.startsWith('domain/') ? ['domain/', 'types/'] : ['domain/', 'types/', 'presentation/']
  for (const { specifier, kind } of result.imports) {
    if (!specifier.startsWith('.')) {
      result.forbidden.push(`external ${kind}: ${specifier}`)
      continue
    }
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    const target = [base, `${base}.ts`, `${base}/index.ts`].find(exists)
    if (!target) result.forbidden.push(`unresolved ${kind}: ${specifier}`)
    else if (!allowed.some(prefix => target.startsWith(prefix))) {
      result.forbidden.push(`forbidden layer ${kind}: ${specifier} -> ${target}`)
    }
  }
  return result
}

// Exercise every supported syntax form against the real collector, including type-only edges.
const fixtureFiles = new Set(['domain/example.ts', 'types/example.ts', 'presentation/example.ts',
  'pages/example.ts', 'services/example.ts', 'runtime/example.ts', 'mock/example.ts'])
const fixtureExists = file => fixtureFiles.has(file)
const positive = [
  ['domain/check.ts', "import type { A } from '../types/example'; export * from './example';"],
  ['domain/check.ts', "import A = require('../types/example'); type B = import('./example').B;"],
  ['domain/check.ts', "const a = require('./example'); const b = import('../types/example');"],
  ['presentation/check.ts', "import { A } from '../domain/example'; export * from './example';"],
]
for (const [file, text] of positive) assert.deepEqual(inspect(file, text, fixtureExists).forbidden, [])
const negative = [
  "import type { A } from '../pages/example'",
  "export * from '../services/example'",
  "const a = require('../runtime/example')",
  "const a = import('../mock/example')",
  "import A = require('../pages/example')",
  "type A = import('../services/example').A",
  "import fs from 'node:fs'",
  'const a = require(variable)',
  'const a = import(variable)',
  'wx.getStorageSync("key")',
  "import A from '../../outside'",
]
for (const text of negative) {
  assert.ok(inspect('domain/check.ts', text, fixtureExists).forbidden.length > 0, `fixture escaped: ${text}`)
}
assert.ok(inspect('presentation/check.ts', "export * from '../pages/example'", fixtureExists).forbidden.length > 0)

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name)
  assert.ok(!entry.isSymbolicLink(), `Unexpected source symlink: ${file}`)
  return entry.isDirectory() ? walk(file) : file.endsWith('.ts') ? [file] : []
})
const files = ['domain', 'presentation'].flatMap(dir => walk(path.join(appRoot, dir)))
const exists = relative => {
  const file = path.resolve(appRoot, relative)
  return fs.existsSync(file) && fs.statSync(file).isFile()
}
const failures = []
const inspected = new Set()
let edges = 0
for (const file of files) {
  const relative = path.relative(appRoot, file).replaceAll('\\', '/')
  if (inspected.has(relative)) continue
  inspected.add(relative)
  const result = inspect(relative, fs.readFileSync(file, 'utf8'), exists)
  edges += result.imports.length
  failures.push(...result.forbidden.map(reason => `${relative}: ${reason}`))
  // Follow the allowed type boundary as well, so a type re-export cannot hide
  // a transitive page/service dependency from the pure-module roots.
  for (const { specifier } of result.imports) {
    if (!specifier.startsWith('.')) continue
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
    const target = [base, `${base}.ts`, `${base}/index.ts`].find(exists)
    if (target && target.startsWith('types/') && !inspected.has(target)) files.push(path.join(appRoot, target))
  }
}
assert.deepEqual(failures, [], failures.join('\n'))
console.log(`ARCHITECTURE_BOUNDARIES: ${inspected.size} pure/type modules, ${edges} dependency edges; ${positive.length} positive and ${negative.length + 1} negative fixtures PASS`)
checkModeSource(root)
