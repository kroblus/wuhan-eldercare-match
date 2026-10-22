// Scoped fresh DevTools generated-code proof. Never accepts offline emit as native evidence.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import { requireShowcaseVerificationOutput } from './support/showcase-verification-output.mjs'
const artifactRoot = process.argv[process.argv.indexOf('--artifact-dir') + 1]
assert.ok(process.argv.includes('--artifact-dir') && artifactRoot, 'Supply the actual WeappCompileCache directory')
const outputRoot = requireShowcaseVerificationOutput(process.argv.slice(2))
const { ts } = loadWechatTypeScript()
const required = fs.readdirSync('miniprogram/pages/showcase').filter(f => f.endsWith('.ts')).map(f => 'pages/showcase/' + f.replace(/\.ts$/, '.js'))
const found = new Map()
function walk(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) { walk(file); continue }
    const raw = fs.readFileSync(file, 'utf8'), match = /define\("(pages\/showcase\/[^"\r\n]+\.js)"/.exec(raw)
    if (!match || !required.includes(match[1])) continue
    const start = match.index, end = raw.indexOf('//# sourceMappingURL=', start)
    assert.ok(end > start, 'Expected native compiler source map: ' + match[1])
    const code = raw.slice(start, end).trim()
    const mapMatch = /sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)/.exec(raw.slice(end))
    assert.ok(mapMatch, 'Expected inline native source map: ' + match[1])
    const map = JSON.parse(Buffer.from(mapMatch[1], 'base64').toString('utf8'))
    const sourceFile = 'miniprogram/' + match[1].replace(/\.js$/, '.ts'), source = fs.readFileSync(sourceFile, 'utf8')
    assert.ok((map.sourcesContent || []).some(content => content.replace(/\r\n/g, '\n') === source.replace(/\r\n/g, '\n')), 'Source differs from native map: ' + match[1])
    assert.ok(fs.statSync(file).mtimeMs + 2000 >= fs.statSync(sourceFile).mtimeMs, 'Stale native module: ' + match[1])
    const parsed = ts.createSourceFile(match[1], code, ts.ScriptTarget.ES2017, true, ts.ScriptKind.JS)
    assert.equal(parsed.parseDiagnostics.length, 0, 'Generated JS parse failure: ' + match[1])
    function visit(node) { assert.ok(!ts.isPropertyDeclaration(node), 'Generated class field: ' + match[1]); ts.forEachChild(node, visit) } visit(parsed)
    found.set(match[1], { sourceFile, artifact: file, mtime: fs.statSync(file).mtimeMs, sourceMapMatches: true })
    const output = path.join(outputRoot, 'native-js', path.basename(match[1]))
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, code)
  }
}
walk(artifactRoot)
for (const module of required) assert.ok(found.has(module), 'Missing actual native artifact: ' + module)
const result = { status: 'PASS', evidence: 'ACTUAL_DEVTOOLS_COMPILE_CACHE_WITH_EXACT_CURRENT_SOURCE_MAP', parser: ts.version, modules: [...found.values()] }
fs.mkdirSync(outputRoot, { recursive: true })
fs.writeFileSync(path.join(outputRoot, 'native-artifacts.json'), JSON.stringify(result, null, 2))
console.log('PASS fresh actual DevTools JS: ' + found.size + ' modules, matching source maps, no class fields')
