import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)

export const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const file = path.resolve(explicitPath)
    assert.ok(existsSync(file), `WECHAT_TYPESCRIPT_PATH does not exist: ${file}`)
    const ts = require(file)
    assert.equal(ts.version, '4.1.2', `expected WeChat TypeScript 4.1.2, got ${ts.version}`)
    return { ts, file }
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const candidates = []
  if (existsSync(profileRoot)) {
    for (const profile of readdirSync(profileRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(runtimeRoot)) continue
      for (const runtime of readdirSync(runtimeRoot, { withFileTypes: true })) {
        const file = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(file)) {
          const ts = require(file)
          if (ts.version === '4.1.2') candidates.push({ file, mtime: statSync(file).mtimeMs })
        }
      }
    }
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  assert.ok(candidates.length > 0, 'WeChat TypeScript 4.1.2 parser is required')
  return { ts: require(candidates[0].file), file: candidates[0].file }
}

export const createWechatTsRuntime = (typescript, globals = {}) => {
  const cache = new Map()
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    ...globals,
  })
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.js`,
      `${base}.json`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.js'),
    ]
    const resolved = candidates.find((file) => existsSync(file) && statSync(file).isFile())
    assert.ok(resolved, `cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (file) => {
    const resolved = path.resolve(file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = resolved.endsWith('.ts')
      ? typescript.transpileModule(source, {
        fileName: resolved,
        reportDiagnostics: true,
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          strict: true,
        },
      })
      : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((item) => item.category === typescript.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire,
      module,
      module.exports,
    )
    return module.exports
  }
  return { context, load }
}
