import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectModeSource } from './support/select-mode-source.mjs'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

/** Verify the raw selection before the compiler's JSON-to-module normalization. */
export function verifySelectedSources(root, mode, selected) {
  assert.ok(mode === 'demo' || mode === 'production')
  const { source, origins, config } = selected
  assert.equal(source.size, origins.size, 'Every selected file needs one origin')
  let sourceFiles = 0, typeScriptFiles = 0
  for (const [destination, bytes] of source) {
    assert.equal(path.posix.normalize(destination), destination, `Noncanonical destination: ${destination}`)
    assert.ok(!destination.startsWith('../') && !path.posix.isAbsolute(destination), 'Source destination escapes project')
    const origin = origins.get(destination)
    assert.equal(typeof origin, 'string', `Missing source origin: ${destination}`)
    if (origin.startsWith('generated:')) {
      assert.equal(destination, 'runtime/app-config.ts', 'Only public app identity may be generated')
      assert.equal(origin, 'generated:public-app-id')
      assert.equal(bytes.toString(), 'export const DEMO_APP_ID = ' + JSON.stringify(mode === 'demo' ? config.appid : '') + '\n')
      continue
    }
    const allowedOrigins = ['miniprogram/', 'modes/shared/runtime/', `modes/${mode}/`]
    assert.ok(allowedOrigins.some(prefix => origin.startsWith(prefix)), `Cross-mode origin: ${destination} <- ${origin}`)
    const absolute = path.resolve(root, origin)
    assert.ok(absolute.startsWith(path.resolve(root) + path.sep), 'Source origin escapes repository')
    assert.equal(fs.lstatSync(absolute).isSymbolicLink(), false, 'Source origin cannot be a symlink')
    assert.ok(Buffer.from(bytes).equals(fs.readFileSync(absolute)), `Selected bytes differ from origin: ${destination}`)
    sourceFiles++
    if (destination.endsWith('.ts')) typeScriptFiles++
  }
  for (const destination of origins.keys()) assert.ok(source.has(destination), `Orphan origin: ${destination}`)

  // Public entry points select complete mode-owned adapters, with no query or
  // Storage flag involved in choosing the application or catalog implementation.
  assert.equal(origins.get('app.ts'), 'miniprogram/app.ts')
  assert.equal(origins.get('services/institution-catalog-v1-2-1.ts'), 'miniprogram/services/institution-catalog-v1-2-1.ts')
  assert.equal(origins.get('runtime/application.ts'), `modes/${mode}/runtime/application.ts`)
  assert.equal(origins.get('runtime/institution-catalog-provider.ts'), `modes/${mode}/runtime/institution-catalog-provider.ts`)
  assert.equal(origins.get('runtime/legacy-institution-data.ts'), 'modes/shared/runtime/legacy-institution-data.ts')
  assert.equal(origins.get(`${mode}/catalog.ts`), `modes/${mode}/catalog.ts`)
  if (mode === 'production') {
    for (const destination of source.keys()) assert.ok(!destination.startsWith('demo/'), 'Production selects a demo module')
  }

  // Parse the two entry graphs without compiling or executing wx. This catches
  // an adapter importing the opposite mode even if its own origin is legitimate.
  const { ts } = loadWechatTypeScript()
  const seen = new Set()
  const visit = file => {
    if (seen.has(file)) return
    seen.add(file)
    const content = source.get(file)
    assert.ok(content, `Unresolved selected source: ${file}`)
    if (!file.endsWith('.ts')) return
    const ast = ts.createSourceFile(file, content.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length, 0, `Cannot parse selected source: ${file}`)
    const dependency = node => {
      assert.ok(node && ts.isStringLiteralLike(node), `Nonliteral selected dependency: ${file}`)
      const specifier = node.text
      assert.ok(specifier.startsWith('.'), `External selected dependency: ${file} -> ${specifier}`)
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      const target = [base, base + '.ts', base + '/index.ts'].find(candidate => source.has(candidate))
      assert.ok(target, `Unresolved selected dependency: ${file} -> ${specifier}`)
      if (mode === 'production') assert.ok(!target.startsWith('demo/'), 'Production entry graph reaches demo')
      else assert.ok(!target.startsWith('production/'), 'Demo entry graph reaches production')
      visit(target)
    }
    const walk = node => {
      if (ts.isImportDeclaration(node)) dependency(node.moduleSpecifier)
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) dependency(node.moduleSpecifier)
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) dependency(node.moduleReference.expression)
      if (ts.isImportTypeNode(node)) dependency(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined)
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        assert.equal(node.arguments.length, 1)
        dependency(node.arguments[0])
      }
      ts.forEachChild(node, walk)
    }
    walk(ast)
  }
  visit('app.ts')
  visit('services/institution-catalog-v1-2-1.ts')
  assert.ok(seen.has('runtime/application.ts'), 'App must initialize its selected runtime adapter')
  assert.ok(seen.has('runtime/institution-catalog-provider.ts'), 'Catalog service must use its selected provider adapter')
  assert.ok(seen.has(`${mode}/catalog.ts`), 'Catalog adapter must reach the mode-owned catalog')
  return { mode, sourceFiles, typeScriptFiles, entryGraphFiles: seen.size }
}

export function checkModeSource(root) {
  const selected = Object.fromEntries(['demo', 'production'].map(mode => [mode, selectModeSource(root, mode)]))
  const results = ['demo', 'production'].map(mode => verifySelectedSources(root, mode, selected[mode]))
  const copy = mode => ({ ...selected[mode], source: new Map(selected[mode].source), origins: new Map(selected[mode].origins) })
  const changed = copy('demo')
  changed.source.set('app.ts', Buffer.from(changed.source.get('app.ts') + '\nApp({ injected: true })\n'))
  assert.throws(() => verifySelectedSources(root, 'demo', changed), /Selected bytes differ from origin/)
  const fakeGenerated = copy('production')
  fakeGenerated.origins.set('app.ts', 'generated:behavior-injection')
  assert.throws(() => verifySelectedSources(root, 'production', fakeGenerated), /Only public app identity/)
  const crossMode = copy('production')
  crossMode.origins.set('runtime/application.ts', 'modes/demo/runtime/application.ts')
  crossMode.source.set('runtime/application.ts', selected.demo.source.get('runtime/application.ts'))
  assert.throws(() => verifySelectedSources(root, 'production', crossMode), /Cross-mode origin/)
  console.log('MODE_SOURCE: exact file bytes, explicit App/catalog adapters and separated entry graphs; 2 positive / 3 negative samples PASS')
  results.forEach(result => console.log(JSON.stringify(result)))
  return results
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkModeSource(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
}
