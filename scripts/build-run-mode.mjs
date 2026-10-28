import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { loadInstalledLess } from './support/installed-less.mjs'
import { minify } from 'terser'
import { checkRunModePackageSize } from './check-run-mode-package-size.mjs'
import { selectModeSource } from './support/select-mode-source.mjs'
import { verifySelectedSources } from './check-mode-source.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
assert.ok(['production', 'demo'].includes(mode), 'Use production or demo')
const installArg = process.argv.indexOf('--install-root')
const pathInstall = (process.env.PATH || '').split(path.delimiter).find(dir => fs.existsSync(path.join(dir, 'wechatide.cmd')) && fs.existsSync(path.join(dir, 'resources/app.asar')))
const install = installArg >= 0 ? process.argv[installArg + 1] : process.env.WECHAT_DEVTOOLS_INSTALL || pathInstall
assert.ok(install, 'Set WECHAT_DEVTOOLS_INSTALL or pass --install-root; no compiler download is performed')
const out = path.resolve(root, 'dist', mode)
// Only replace an explicitly marked, generated output under this repository's dist.
assert.equal(path.dirname(out), path.resolve(root, 'dist'))
assert.notEqual(out, path.resolve(root, 'miniprogram'))
if (fs.existsSync(out)) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, '.shared-build.json'))).kind, 'generated_shared_run_mode')
}
fs.mkdirSync(out, { recursive: true })
const marker = { kind: 'generated_shared_run_mode', mode, source: '../..', builtAt: new Date().toISOString(), status: 'BUILDING' }
fs.writeFileSync(path.join(out, '.shared-build.json'), JSON.stringify(marker, null, 2))
const runtime = path.join(out, 'miniprogram'), staged = path.join(out, '.source')
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  assert.ok(!e.isSymbolicLink(), 'No symlink source')
  const f = path.join(dir, e.name)
  return e.isDirectory() ? walk(f) : [f]
})
const writtenRuntime = new Set()
const put = (base, file, data) => { const f = path.join(base, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); if (base === runtime) writtenRuntime.add(path.resolve(f)) }
const { source, config, origins } = selectModeSource(root, mode)
verifySelectedSources(root, mode, { source, config, origins })
put(out, 'source-origins.json', JSON.stringify(Object.fromEntries(origins), null, 2) + '\n')
// WeChat's module loader does not implement Node-style require(JSON). Compile
// data into ordinary modules; JSON remains the authoring format outside the app.
for (const [file, data] of [...source]) if (/^(demo|production)\//.test(file) && file.endsWith('.json')) {
  source.set(file.replace(/\.json$/, '.data.ts'), Buffer.from('const data = ' + data.toString() + '\nexport default data\n'))
}
for (const [file, data] of source) if (file.endsWith('.ts')) source.set(file, Buffer.from(data.toString().replace(/(from\s+['"][^'"]+)\.json(['"])/g, '$1.data$2')))
for (const [file, data] of source) if (/\.(ts|json)$/.test(file)) put(staged, file, data)
const { ts } = loadWechatTypeScript(), less = loadInstalledLess(install)
const originalOptions = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile).config.compilerOptions
const parsed = ts.convertCompilerOptionsFromJson(originalOptions, root)
const tsFiles = [...source.keys()].filter(f => f.endsWith('.ts')).map(f => path.join(staged, f))
const options = { ...parsed.options, resolveJsonModule: true, noEmit: true }
const program = ts.createProgram([...tsFiles, path.join(root, 'typings/index.d.ts')], options)
const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error)
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
const emitted = new Map()
for (const [file, bytes] of source) {
  if (!file.endsWith('.ts')) continue
  const code = ts.transpileModule(bytes.toString(), { fileName: file, compilerOptions: { ...parsed.options, resolveJsonModule: true } }).outputText
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.ES2020, true)
  const check = n => { assert.ok(!ts.isPropertyDeclaration(n) && !n.questionDotToken, 'Unsupported generated syntax: ' + file); assert.ok(!(ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken), file); ts.forEachChild(n, check) }
  check(ast)
  emitted.set(file.replace(/\.ts$/, '.js'), code)
}
const app = JSON.parse(source.get('app.json')), modules = new Set()
const collect = file => {
  if (modules.has(file)) return
  assert.ok(emitted.has(file), 'Unresolved runtime module ' + file)
  modules.add(file)
  const ast = ts.createSourceFile(file, emitted.get(file), ts.ScriptTarget.ES2020, true)
  const visit = n => {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'require') {
      assert.ok(n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0]))
      const spec = n.arguments[0].text
      assert.ok(spec.startsWith('.'), 'External runtime import')
      const resolved = path.posix.normalize(path.posix.dirname(file) + '/' + spec)
      if (resolved.endsWith('.json')) { assert.ok(source.has(resolved)); put(runtime, resolved, source.get(resolved)) }
      else collect(resolved + '.js')
    }
    ts.forEachChild(n, visit)
  }
  visit(ast)
}
collect('app.js')
for (const route of app.pages) { assert.ok(source.has(route + '.ts') && source.has(route + '.wxml') && source.has(route + '.json'), 'Invalid route ' + route); collect(route + '.js') }
for (const [file, data] of source) {
  if (file.endsWith('.json') && file !== 'app.json' && !file.startsWith('demo/')) {
    const json = JSON.parse(data)
    for (const value of Object.values(json.usingComponents || {})) {
      if (!value.startsWith('plugin:')) collect(path.posix.normalize(value.startsWith('/') ? value.slice(1) : path.posix.dirname(file) + '/' + value) + '.js')
    }
  }
  if (/\.(wxml|json|png|jpg|jpeg|gif|svg|wxs)$/.test(file) && !/^(demo|production)\//.test(file)) put(runtime, file, data)
  if (file.endsWith('.less')) {
    // Less imports resolve against the authoritative source, except generated demo component.
    const filename = file.startsWith('components/demo-tools/') ? path.join(staged, file) : path.join(root, 'miniprogram', file)
    if (file.startsWith('components/demo-tools/')) {
      for (const [name, content] of source) if (name.startsWith('styles/') && name.endsWith('.less')) put(staged, name, content)
    }
    const result = await less.render(data.toString(), { filename, javascriptEnabled: false, compress: true })
    // This shared Less is fully inlined into its page consumers. Do not also
    // package an unused standalone copy; retain source and compile validation.
    if (!['styles/institution-directory.less', 'styles/browse-buttons.less'].includes(file)) put(runtime, file.replace(/\.less$/, '.wxss'), result.css)
  }
}
for (const file of modules) {
  // CommonJS modules stay separate; no property mangling, unsafe transforms,
  // cross-module assumptions or dropping function arguments used by APIs.
  const result = await minify(emitted.get(file), {
    ecma: 5,
    compress: { passes: 1, unsafe: false, pure_getters: false, keep_fargs: true },
    mangle: { toplevel: true, properties: false, reserved: ['require', 'module', 'exports'] },
    format: { comments: false },
  })
  assert.ok(result.code, 'Empty minified module: ' + file)
  put(runtime, file, result.code + '\n')
}
// Reuse the exact compiled base prefix in each style scope. Expanding this
// import reproduces the previous bytes, including declaration order.
const baseStyle = fs.readFileSync(path.join(runtime, 'styles/base.wxss'), 'utf8')
let deduplicatedStyleBytes = 0
for (const file of walk(runtime).filter(file => file.endsWith('.wxss') && file !== path.join(runtime, 'styles/base.wxss'))) {
  const css = fs.readFileSync(file, 'utf8')
  if (!css.startsWith(baseStyle)) continue
  const ref = path.relative(path.dirname(file), path.join(runtime, 'styles/base.wxss')).replaceAll('\\', '/')
  const prefix = `@import "${ref}";`
  assert.equal(baseStyle + css.slice(baseStyle.length), css)
  fs.writeFileSync(file, prefix + css.slice(baseStyle.length))
  deduplicatedStyleBytes += Buffer.byteLength(baseStyle) - Buffer.byteLength(prefix)
}
console.log(`Exact base style reuse saved ${deduplicatedStyleBytes} bytes`)
// Remove stale generated files only, never the open project directory itself.
for (const file of walk(runtime)) if (!writtenRuntime.has(path.resolve(file))) {
  assert.ok(path.resolve(file).startsWith(path.resolve(runtime) + path.sep))
  fs.unlinkSync(file)
}
// Fail closed if a future runtime consumer starts importing the omitted copy.
for (const file of walk(runtime).filter(file => /\.(wxss|wxml|json|js)$/.test(file))) {
  const cssSource = fs.readFileSync(file, 'utf8')
  assert.ok(!['institution-directory.wxss', 'browse-buttons.wxss'].some(name => cssSource.includes(name)), 'Omitted standalone WXSS now has a runtime consumer: ' + file)
}
if (mode === 'production') assert.ok(![...modules].some(f => f.startsWith('demo/') || f.includes('demo-tools')))
config.projectname = 'eldercare-shared-' + mode
config.miniprogramRoot = 'miniprogram/'
config.srcMiniprogramRoot = 'miniprogram/'
// Output contains already compiled JS/WXSS. Source compiler plugins stay unchanged.
config.setting = { ...config.setting, useCompilerPlugins: [], minified: true, minifyWXSS: true, minifyWXML: true, uploadWithSourceMap: false }
assert.ok(!config.cloudfunctionRoot && !config.cloudbaseRoot)
put(out, 'project.config.json', JSON.stringify(config, null, 2) + '\n')
// Offline native WXML compiler: local files only, no preview/upload side effect.
const compiler = path.join(install, 'resources/app.asar.unpacked/node_modules/wcc-exec/wcc.exe')
const templates = [...source.keys()].filter(f => f.endsWith('.wxml'))
const compiled = spawnSync(compiler, ['-o', path.join(out, 'wxml-compiled.js'), ...templates], { cwd: runtime, encoding: 'utf8', windowsHide: true, timeout: 60000 })
assert.equal(compiled.status, 0, (compiled.stdout || '') + (compiled.stderr || '') + (compiled.error || ''))
const packageBytes = checkRunModePackageSize(out)
put(out, '.shared-build.json', JSON.stringify({ ...marker, status: 'PASS_LOCAL_BUILD', routes: app.pages.length, modules: modules.size, packageBytes, provider: mode === 'demo' ? 'ISOLATED_SYNTHETIC_MEMORY' : 'REVIEWED_PUBLIC_DIRECTORY_READ_ONLY' }, null, 2) + '\n')
console.log(`${mode.toUpperCase()}: TypeScript 4.1.2 + Less + native WXML + generated syntax PASS; ${app.pages.length} routes; ${modules.size} modules. Open dist/${mode}/project.config.json.`)
