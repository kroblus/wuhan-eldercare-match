import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { loadInstalledLess } from './support/installed-less.mjs'
import { minify } from 'terser'
import { checkRunModePackageSize } from './check-run-mode-package-size.mjs'

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
const source = new Map(walk(path.join(root, 'miniprogram')).map(f => [path.relative(path.join(root, 'miniprogram'), f).replaceAll('\\', '/'), fs.readFileSync(f)]))
if (mode === 'production') {
  for (const file of walk(path.join(root, 'modes/production'))) source.set('production/' + path.relative(path.join(root, 'modes/production'), file).replaceAll('\\', '/'), fs.readFileSync(file))
  source.set('runtime/institution-validation.ts', Buffer.from("import { administrativeDivisionResolver } from '../production/administrative-divisions'\nexport const institutionValidationOptions = {administrativeDivisionResolver}\n"))
  source.set('runtime/institution-service-access.ts', Buffer.from("export { canRequestInstitutionService } from '../production/catalog'\n"))
  source.set('runtime/directory-metadata.ts', Buffer.from("export { readDirectoryMetadata, directoryNatureOptions, directoryDistrictOptions } from '../production/directory-metadata'\n"))
  source.set('runtime/institution-source-notes.ts', Buffer.from("export { readInstitutionSourceNotes, readInstitutionDirectoryInfo } from '../production/source-notes'\n"))
  for (const [file, bytes] of source) if (/^pages\/(home|institution)\/.*\.(ts|wxml)$/.test(file)) {
    source.set(file, Buffer.from(bytes.toString().replaceAll('合作机构', '养老机构').replaceAll('仅加载当前本地开发目录', '仅展示已核对的公开机构资料').replaceAll('当前本地开发目录未能读取', '机构公开资料暂时未能读取')))
  }
}
// Build-time composition. Neither data selection nor API protection reads query/Storage flags.
source.set('mock/institution-catalog.mock.ts', Buffer.from(`
import type { InstitutionCatalogPayload } from '../types/institution-catalog'
export { readModeCatalog } from '../${mode === 'demo' ? 'demo' : 'production'}/catalog'
export const mockInstitutionCatalogProvider = { loadCatalog: async (): Promise<InstitutionCatalogPayload> => ({datasetVersion:'legacy-provider-not-configured',datasetMode:'PRODUCTION',records:[]}) }
`))
const catalogService = source.get('services/institution-catalog-v1-2-1.ts').toString()
source.set('services/institution-catalog-v1-2-1.ts', Buffer.from(catalogService.replace(/import \{ MOCK_INSTITUTION_CATALOG_V121 \}/, 'import { readModeCatalog }').replace('cloneValue(MOCK_INSTITUTION_CATALOG_V121)', 'cloneValue(readModeCatalog())')))
source.set('mock/institution-public-content.mock.ts', Buffer.from("export const MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG = {records:[],currentHeads:[]}\n"))
source.set('mock/institutions.mock.ts', Buffer.from("import type { Institution } from '../types/domain'\nexport const MOCK_INSTITUTIONS: Institution[] = []\n"))
source.set('pages/showcase/development.ts', Buffer.from(`export function isDevelopmentBuild(): boolean { return ${mode === 'demo'} }\n`))
const formalConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json')))
let config = { ...formalConfig }
if (mode === 'demo') {
  // The public build configuration was preserved from V1.6; the old checkout
  // is now a reference only and is not required to build or run either mode.
  config = JSON.parse(fs.readFileSync(path.join(root, 'modes/demo-project.config.json')))
  assert.ok(typeof config.appid === 'string' && config.appid.length > 0)
  // Both existing checkouts currently share an AppID. Preserve it, require develop,
  // and use the pre-App network/storage guard; do not claim platform identity isolation.
  for (const file of walk(path.join(root, 'modes/demo'))) {
    const name = path.basename(file)
    const relative = ['draft-storage.ts','directory-metadata.ts','panorama-sample.ts'].includes(name) ? 'runtime/' + name : name.endsWith('.jpg') ? 'assets/' + name : /^tools\./.test(name) ? 'components/demo-tools/demo-tools' + path.extname(name) : 'demo/' + name
    source.set(relative, fs.readFileSync(file))
  }
  source.set('app.ts', Buffer.from(`import { installDemoGuards } from './demo/guard'\ninstallDemoGuards(${JSON.stringify(config.appid)})\nApp({globalData:{runMode:'DEMO'}})\n`))
  const homeConfig = JSON.parse(source.get('pages/home/index.json'))
  homeConfig.usingComponents['demo-tools'] = '/components/demo-tools/demo-tools'
  source.set('pages/home/index.json', Buffer.from(JSON.stringify(homeConfig)))
  const homeMarkup = source.get('pages/home/index.wxml').toString()
  assert.ok(homeMarkup.includes('<!-- demo-home-entry -->'), 'Missing auxiliary demo entry slot')
  source.set('pages/home/index.wxml', Buffer.from(homeMarkup.replace('<!-- demo-home-entry -->', '<demo-tools id="demo-tools" compact-home="{{true}}" bind:changed="retryLoad"></demo-tools>')))
  const mineConfig = JSON.parse(source.get('pages/mine/index.json'))
  mineConfig.usingComponents['demo-tools'] = '/components/demo-tools/demo-tools'
  source.set('pages/mine/index.json', Buffer.from(JSON.stringify(mineConfig)))
  source.set('pages/mine/index.wxml', Buffer.from(source.get('pages/mine/index.wxml').toString().replace('</page-container>', '<demo-tools id="demo-settings"></demo-tools>\n</page-container>')))
  // Native open-type phone authorization cannot be intercepted by patching wx.
  // These demo surfaces use the same isolated service component instead of exposing
  // the real contact/submission form. Routes and production source stay intact.
  for (const route of ['pages/appointment/create', 'pages/appointment/index', 'pages/visit/evaluation']) {
    const json = JSON.parse(source.get(route + '.json'))
    json.usingComponents = { ...json.usingComponents, 'demo-tools': '/components/demo-tools/demo-tools', 'navigation-bar': '/components/navigation-bar/navigation-bar' }
    source.set(route + '.json', Buffer.from(JSON.stringify(json)))
    source.set(route + '.wxml', Buffer.from('<navigation-bar warmSwiss="{{true}}" title="演示服务" back="{{true}}" fallbackUrl="/pages/home/index" fallbackIsTab="{{true}}" guardBack="{{true}}" navigationFailureMessage="返回失败，请重试"></navigation-bar>\n<demo-tools id="demo-tools" service-only="{{true}}"' + (route.endsWith('/create') ? ' institution-id="{{institution.identity.institutionId}}"' : '') + '></demo-tools>\n'))
  }
  for (const [file, data] of source) if (file.endsWith('.wxml')) {
    const text = data.toString().replace(/<button\b[^>]*open-type="getPhoneNumber"[^>]*>[\s\S]*?<\/button>/g, '<view>演示环境不获取手机号，也不联系真人顾问。</view>')
    assert.ok(!/open-type=/.test(text), 'Unhandled native authorization surface in demo: ' + file)
    source.set(file, Buffer.from(text))
  }
} else {
  source.set('app.ts', Buffer.from("App({globalData:{runMode:'PRODUCTION'}})\n"))
}
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
    put(runtime, file.replace(/\.less$/, '.wxss'), result.css)
  }
}
for (const file of modules) {
  // CommonJS modules stay separate. Preserve all public properties, callbacks
  // and require paths; only shorten lexical names and remove formatting.
  const result = await minify(emitted.get(file), {
    ecma: 5,
    compress: false,
    mangle: { toplevel: true, properties: false, reserved: ['require', 'module', 'exports'] },
    format: { comments: false },
  })
  assert.ok(result.code, 'Empty minified module: ' + file)
  put(runtime, file, result.code + '\n')
}
// Remove stale generated files only, never the open project directory itself.
for (const file of walk(runtime)) if (!writtenRuntime.has(path.resolve(file))) {
  assert.ok(path.resolve(file).startsWith(path.resolve(runtime) + path.sep))
  fs.unlinkSync(file)
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
