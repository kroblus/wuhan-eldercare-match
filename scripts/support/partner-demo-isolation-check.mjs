import { readFileSync, readdirSync, realpathSync, lstatSync, existsSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

export const demoFiles = [
  'app.js', 'app.json', 'sitemap.json',
  'pages/demo/index.js', 'pages/demo/index.json', 'pages/demo/index.wxml', 'pages/demo/index.wxss',
  'runtime/build-identity.json', 'runtime/identity.js', 'runtime/dependencies.js', 'runtime/shell.js', 'runtime/host.js',
]
const within = (root, file) => file === root || file.startsWith(root + path.sep)
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name)
    assert(!lstatSync(file).isSymbolicLink(), 'Source links are not allowed by this isolation check')
    return entry.isDirectory() ? walk(file) : [file]
  })
}

// Deliberately bounded source guard for the closed S1 CommonJS root, not a JS sandbox.
export function checkDemoJavaScript(source, file, root) {
  assert(!/\b(?:wx|fetch|XMLHttpRequest|WebSocket|globalThis|global|process|eval|Function|WebAssembly|constructor|import|export)\b/.test(source), `Forbidden capability or syntax: ${file}`)
  const literals = [...source.matchAll(/\brequire\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g)]
  const remainder = source.replace(/\brequire\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g, '')
  assert(!/\brequire\b|module\s*\[/.test(remainder), `Indirect module loading: ${file}`)
  for (const [, , specifier] of literals) {
    assert(specifier.startsWith('.'), `Non-relative dependency: ${file}`)
    const resolved = path.resolve(path.dirname(file), specifier)
    const target = path.extname(resolved) ? resolved : resolved + '.js'
    assert(within(root, target), `Escaped demo dependency: ${file}`)
    assert(demoFiles.includes(path.relative(root, target).replaceAll('\\', '/')), `Dependency outside S1 allowlist: ${file}`)
  }
  assert(!/https?:\/\/|wss?:\/\/|cloud:\/\//i.test(source), `Remote resource: ${file}`)
  return literals.length
}

export function checkIsolation(repositoryRoot) {
  const productionConfig = json(path.join(repositoryRoot, 'project.config.json'))
  const productionRoot = realpathSync(path.resolve(repositoryRoot, productionConfig.miniprogramRoot))
  const demoProject = path.join(repositoryRoot, 'partner-demo')
  const config = json(path.join(demoProject, 'project.config.json'))
  const profile = json(path.join(demoProject, 'build-profile.json'))
  const root = realpathSync(path.resolve(demoProject, config.miniprogramRoot))
  assert.equal(root, path.join(demoProject, 'miniprogram'))
  assert(!within(productionRoot, root) && !within(root, productionRoot), 'Build roots must be disjoint')
  assert.equal(config.appid, productionConfig.appid, 'Existing AppID must be retained')
  assert.equal(config.compileType, 'miniprogram')
  assert.equal(config.srcMiniprogramRoot, config.miniprogramRoot)
  assert.equal(profile.miniprogramRoot, config.miniprogramRoot)
  assert.equal(profile.runtimeIdentityPath, 'runtime/build-identity.json')
  assert.equal(profile.releaseReady, false)
  const identity = json(path.join(root, profile.runtimeIdentityPath))
  for (const key of ['buildId', 'kind', 'scope', 'provenance']) assert.equal(identity[key], profile[key], `Build identity mismatch: ${key}`)
  assert.deepEqual(identity, { buildId: 'partner-demo-s1-isolation-shell-v0-1', kind: 'isolated-partner-demo', scope: 'DEMO_SHELL_ONLY', provenance: 'development-synthetic' })
  assert.deepEqual(config.packOptions, { ignore: [], include: [] })
  assert(!config.cloudfunctionRoot && !config.pluginRoot && !config.scripts)
  // A later machine-local override must be explicitly reviewed rather than silently merged.
  assert(!readdirSync(demoProject).some((name) => name.endsWith('.private.config.json')), 'Demo private override requires new review')
  for (const key of ['miniprogramRoot', 'srcMiniprogramRoot']) {
    if (productionConfig[key]) assert.equal(realpathSync(path.resolve(repositoryRoot, productionConfig[key])), productionRoot)
  }
  assert.deepEqual(productionConfig.packOptions?.include ?? [], [], 'Production package include rules require new review')
  assert(!productionConfig.scripts, 'Production build hooks require new review')
  const privatePath = path.join(repositoryRoot, 'project.private.config.json')
  if (existsSync(privatePath)) {
    const privateConfig = json(privatePath)
    for (const key of ['miniprogramRoot', 'srcMiniprogramRoot']) {
      if (privateConfig[key]) assert.equal(realpathSync(path.resolve(repositoryRoot, privateConfig[key])), productionRoot, 'Production private root override requires review')
    }
    if (privateConfig.appid) assert.equal(privateConfig.appid, config.appid, 'Production private AppID override requires review')
    assert.deepEqual(privateConfig.packOptions?.include ?? [], [], 'Production private include requires review')
    assert(!privateConfig.scripts, 'Production private build hooks require review')
  }
  const files = walk(root)
  assert.deepEqual(files.map((file) => path.relative(root, file).replaceAll('\\', '/')).sort(), [...demoFiles].sort())
  let demoEdges = 0
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    if (file.endsWith('.js')) demoEdges += checkDemoJavaScript(source, file, root)
    if (file.endsWith('.json')) json(file)
    assert(!/https?:\/\/|wss?:\/\/|cloud:\/\//i.test(source), `Remote resource: ${file}`)
    if (file.endsWith('.wxml')) assert(!/<(?:image|web-view|map|navigator|audio|video|live-player|wxs)\b|open-type\s*=|\b(?:src|url)\s*=|<(?:import|include)\b/i.test(source), 'Native external or imported presentation is not allowed in S1')
    if (file.endsWith('.wxss')) assert(!/@import|url\s*\(/i.test(source), 'Imported or remote style is not allowed in S1')
  }
  const app = json(path.join(root, 'app.json'))
  assert.deepEqual(app.pages, ['pages/demo/index'])
  assert.deepEqual(Object.keys(app).sort(), ['pages', 'sitemapLocation', 'style', 'window'].sort())
  assert.deepEqual(json(path.join(root, 'pages/demo/index.json')), { usingComponents: {} })
  const template = readFileSync(path.join(root, 'pages/demo/index.wxml'), 'utf8')
  assert(template.includes('开发演示｜全部为合成数据｜非真实机构或预约'))
  assert.equal((template.match(/bindtap=/g) ?? []).length, 1)
  assert(template.includes('bindtap="onExit"'))
  // Static package-membership/reference check only; do not execute production modules.
  const productionFiles = walk(productionRoot)
  let productionReferences = 0
  for (const file of productionFiles.filter((file) => /\.(?:ts|js|json|wxml|less|wxss)$/.test(file))) {
    const source = readFileSync(file, 'utf8')
    assert(!/partner-demo|partner_demo|partnerDemo/.test(source), `Production references demo: ${file}`)
    const references = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+|\b(?:src|is|path|iconPath|selectedIconPath)\s*[:=]\s*)(['"])([^'"\r\n]+)\1/g)]
    for (const [, , specifier] of references) {
      productionReferences++
      if (specifier.startsWith('.')) {
        assert(!within(demoProject, path.resolve(path.dirname(file), specifier)), `Production dependency enters demo: ${file}`)
      }
    }
  }
  return { demoSourceFiles: files.length, demoStaticEdges: demoEdges, productionSourceFiles: productionFiles.length, productionStaticReferences: productionReferences, disjointRoots: true, sameAppId: true, actualPackageVerification: 'NOT_VERIFIED' }
}
