import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parserRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
const targetFiles = [
  path.join(repositoryRoot, 'miniprogram', 'types', 'appointment-institution-visit-v1.ts'),
  path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'validate-appointment-institution-visit.ts'),
  path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'lifecycle.ts'),
  path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'idempotency.ts'),
  path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'project-appointment-institution-visit.ts'),
  path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'index.ts'),
  path.join(repositoryRoot, 'miniprogram', 'services', 'appointment-institution-visit-application.ts'),
]

const findParser = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return { parser: require(path.resolve(explicitPath)), source: 'WECHAT_TYPESCRIPT_PATH' }
  assert.ok(parserRoot, 'WeChat DevTools TypeScript parser is required')
  const fs = require('node:fs')
  const candidates = []
  if (fs.existsSync(parserRoot)) {
    for (const profile of fs.readdirSync(parserRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const runtimeRoot = path.join(parserRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!fs.existsSync(runtimeRoot)) continue
      for (const runtime of fs.readdirSync(runtimeRoot, { withFileTypes: true })) {
        const file = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && fs.existsSync(file)) candidates.push(file)
      }
    }
  }
  assert.ok(candidates.length > 0, 'WeChat DevTools TypeScript parser is required')
  return { parser: require(candidates[0]), source: 'WeChat DevTools mptslib' }
}

const diagnosticText = (ts, diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

const run = () => {
  const { parser: ts, source } = findParser()
  assert.equal(ts.version, '4.1.2', `expected WeChat TypeScript 4.1.2, got ${ts.version}`)
  targetFiles.forEach((file) => assert.ok(require('node:fs').existsSync(file), `missing target: ${file}`))
  const options = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    strict: true,
    noEmitOnError: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['lib.es2020.d.ts'],
  }
  const emitted = []
  const host = ts.createCompilerHost(options)
  host.writeFile = (fileName, data) => {
    if (fileName.endsWith('.js')) emitted.push({ fileName, source: data })
  }
  const program = ts.createProgram(targetFiles, options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `TypeScript diagnostics:\n${errors.map((error) => diagnosticText(ts, error)).join('\n')}`)
  const emitResult = program.emit()
  const emitErrors = emitResult.diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  assert.equal(emitErrors.length, 0, `emit diagnostics:\n${emitErrors.map((error) => diagnosticText(ts, error)).join('\n')}`)
  const classFields = emitted.filter((item) => /\bclass\s+[^\{]+\{\s*(?:\w+\s*=|#\w+)/s.test(item.source))
  const externalImports = emitted.flatMap((item) => [...item.source.matchAll(/require\((['"])(.*?)\1\)/g)].map((match) => match[2]).filter((value) => !value.startsWith('.')))
  assert.equal(classFields.length, 0, `class fields in: ${classFields.map((item) => item.fileName).join(', ')}`)
  assert.equal(externalImports.length, 0, `external runtime imports: ${externalImports.join(', ')}`)
  console.log(`C2_WECHAT_COMPAT_PARSER_SOURCE: ${source}`)
  console.log(`C2_WECHAT_COMPAT_TARGET_COUNT: ${targetFiles.length}`)
  console.log(`C2_TYPESCRIPT_DIAGNOSTIC_ERRORS: ${errors.length}`)
  console.log(`C2_EMITTED_JS_MODULES: ${emitted.length}`)
  console.log(`C2_EMITTED_CLASS_FIELDS: ${classFields.length}`)
  console.log(`C2_EXTERNAL_RUNTIME_IMPORTS: ${externalImports.length}`)
  console.log('C2_WECHAT_TYPESCRIPT_COMPATIBILITY = PASS')
}

run()
