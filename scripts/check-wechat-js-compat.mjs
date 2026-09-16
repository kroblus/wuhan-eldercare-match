import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectConfigPath = path.join(repositoryRoot, 'project.config.json')
const cacheModulePattern = /define\("([^"\r\n]+\.js)"/
const sourceMapMarker = '//# sourceMappingURL='
const staleToleranceMs = 2000
const a13RequiredSourcePaths = [
  'mock/institution-catalog.mock.ts',
  'mock/institution-public-content.mock.ts',
  'pages/recommendation/result.ts',
  'services/institution-catalog-v1-1.ts',
  'services/institution-catalog-v1-2-1.ts',
  'services/institution-public-content-v1.ts',
  'services/institution-v1-2-1-presentation.ts',
  'services/institution-list-detail-application.ts',
  'services/institution-list-detail-page.ts',
  'services/institution-presentation.ts',
  'services/institution-recommendation-source.ts',
  'services/institution-record-resolver.ts',
  'services/institution-source-context.ts',
]
const a14RequiredSourcePaths = [
  'pages/institution/detail.ts',
  'pages/institution/detail-view-model.ts',
]
const b6RequiredSourcePaths = [
  'pages/home/index.ts',
  'pages/service/ai-chat/index.ts',
  'pages/service/ai-chat/index-view-model.ts',
  'services/ai-consultation-page.ts',
]

const walkFiles = async (root, accept = () => true) => {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'miniprogram_npm') {
        files.push(...await walkFiles(entryPath, accept))
      }
    } else if (entry.isFile() && accept(entryPath)) {
      files.push(entryPath)
    }
  }
  return files
}

const getDevToolsProfiles = async () => {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    return []
  }
  const root = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(root)) {
    return []
  }
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
}

const loadTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    return { parser: require(path.resolve(explicitPath)), parserPath: path.resolve(explicitPath) }
  }

  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch {
    // The repository intentionally has no TypeScript runtime dependency.
  }

  const candidates = []
  for (const profile of await getDevToolsProfiles()) {
    const runtimeRoot = path.join(profile, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) {
      continue
    }
    for (const runtime of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or install/open WeChat DevTools')
  }
  return { parser: require(candidates[0].parserPath), parserPath: candidates[0].parserPath }
}

const createSourceFile = (ts, fileName, source, scriptKind) =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)

const containsClass = (ts, source, fileName) => {
  const sourceFile = createSourceFile(ts, fileName, source, ts.ScriptKind.TS)
  let found = false
  const visit = (node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

const findClassFields = (ts, source, fileName) => {
  const sourceFile = createSourceFile(ts, fileName, source, ts.ScriptKind.JS)
  const findings = []
  const visit = (node) => {
    const parent = node.parent
    const insideClass = parent && (ts.isClassDeclaration(parent) || ts.isClassExpression(parent))
    if (insideClass && ts.isPropertyDeclaration(node)) {
      findings.push({
        className: parent.name?.getText(sourceFile) || '<anonymous>',
        kind: node.initializer ? 'initializer' : 'declaration',
        position: node.name?.getStart(sourceFile) ?? node.getStart(sourceFile),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}

const readProject = async () => {
  const configuration = JSON.parse(await readFile(projectConfigPath, 'utf8'))
  return {
    configuration,
    sourceRoot: path.resolve(repositoryRoot, configuration.miniprogramRoot || 'miniprogram/'),
  }
}

const getClassSourceModules = async (ts, sourceRoot) => {
  const modules = []
  const sourceFiles = await walkFiles(sourceRoot, (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts'))
  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, 'utf8')
    if (!containsClass(ts, source, sourceFile)) {
      continue
    }
    const relativePath = path.relative(sourceRoot, sourceFile).split(path.sep).join('/')
    modules.push({
      moduleName: relativePath.replace(/\.ts$/, '.js'),
      sourceFile,
      sourceMtimeMs: (await stat(sourceFile)).mtimeMs,
    })
  }
  return modules
}

const getRequiredSourceModules = async (sourceRoot, relativePaths) => {
  const modules = []
  for (const relativePath of relativePaths) {
    const sourceFile = path.join(sourceRoot, ...relativePath.split('/'))
    if (!existsSync(sourceFile)) {
      throw new Error(`required TypeScript source is missing: ${relativePath}`)
    }
    modules.push({
      moduleName: relativePath.replace(/\.ts$/, '.js'),
      sourceFile,
      sourceMtimeMs: (await stat(sourceFile)).mtimeMs,
    })
  }
  return modules
}

const mergeSourceModules = (...groups) => {
  const byModuleName = new Map()
  for (const sourceModule of groups.flat()) {
    const existing = byModuleName.get(sourceModule.moduleName)
    if (!existing || existing.sourceMtimeMs < sourceModule.sourceMtimeMs) {
      byModuleName.set(sourceModule.moduleName, sourceModule)
    }
  }
  return [...byModuleName.values()]
}

const extractJavaScriptUnit = async (filePath, artifactRoot) => {
  const fileStats = await stat(filePath)
  const text = (await readFile(filePath)).toString('utf8')
  const cacheModule = cacheModulePattern.exec(text)
  if (cacheModule) {
    const start = cacheModule.index
    const sourceMapStart = text.lastIndexOf(sourceMapMarker)
    return {
      moduleName: cacheModule[1].replace(/^\//, ''),
      code: text.slice(start, sourceMapStart > start ? sourceMapStart : text.length),
      filePath,
      mtimeMs: fileStats.mtimeMs,
    }
  }
  if (!/\.(?:c|m)?js$/i.test(filePath)) {
    return undefined
  }
  const sourceMapStart = text.lastIndexOf(sourceMapMarker)
  return {
    moduleName: path.relative(artifactRoot, filePath).split(path.sep).join('/').replace(/^\//, ''),
    code: text.slice(0, sourceMapStart === -1 ? text.length : sourceMapStart),
    filePath,
    mtimeMs: fileStats.mtimeMs,
  }
}

const loadArtifactUnits = async (artifactRoot) => {
  const rootStats = await stat(artifactRoot)
  const files = rootStats.isFile() ? [artifactRoot] : await walkFiles(artifactRoot)
  const units = []
  for (const filePath of files) {
    const unit = await extractJavaScriptUnit(filePath, rootStats.isFile() ? path.dirname(artifactRoot) : artifactRoot)
    if (unit) {
      units.push(unit)
    }
  }
  return units
}

const findCurrentDevToolsCache = async (requiredModules) => {
  const matches = []
  for (const profile of await getDevToolsProfiles()) {
    const cacheRoot = path.join(profile, 'WeappCache', 'WeappCompileCache')
    if (!existsSync(cacheRoot)) {
      continue
    }
    for (const cache of await readdir(cacheRoot, { withFileTypes: true })) {
      if (!cache.isDirectory()) {
        continue
      }
      const artifactRoot = path.join(cacheRoot, cache.name)
      const units = await loadArtifactUnits(artifactRoot)
      const names = new Set(units.map((unit) => unit.moduleName))
      if (requiredModules.every((moduleName) => names.has(moduleName))) {
        matches.push({ artifactRoot, units, newest: Math.max(...units.map((unit) => unit.mtimeMs)) })
      }
    }
  }
  matches.sort((left, right) => right.newest - left.newest)
  return matches[0]
}

const locateArtifacts = async (options, configuration, requiredModules) => {
  const explicit = options.artifactDirectory || process.env.WECHAT_JS_ARTIFACT_DIR
  if (explicit) {
    const artifactRoot = path.resolve(repositoryRoot, explicit)
    if (!existsSync(artifactRoot)) {
      throw new Error(`artifact path does not exist: ${artifactRoot}`)
    }
    return { artifactRoot, units: await loadArtifactUnits(artifactRoot), source: 'explicit artifact path' }
  }

  const outputPath = configuration.setting?.babelSetting?.outputPath || configuration.setting?.swcSetting?.outputPath
  if (outputPath) {
    const artifactRoot = path.resolve(repositoryRoot, outputPath)
    if (existsSync(artifactRoot)) {
      return { artifactRoot, units: await loadArtifactUnits(artifactRoot), source: 'project.config.json outputPath' }
    }
  }

  const cache = await findCurrentDevToolsCache(requiredModules.map((item) => item.moduleName))
  if (!cache) {
    throw new Error('current DevTools artifacts not found; compile the project or pass --artifact-dir')
  }
  return { ...cache, source: 'WeChat DevTools WeappCompileCache' }
}

const verifyCoverage = (requiredModules, units) => {
  const unitByModule = new Map(units.map((unit) => [unit.moduleName, unit]))
  const errors = []
  for (const sourceModule of requiredModules) {
    const unit = unitByModule.get(sourceModule.moduleName)
    if (!unit) {
      errors.push(`missing generated required module: ${sourceModule.moduleName}`)
    } else if (unit.mtimeMs + staleToleranceMs < sourceModule.sourceMtimeMs) {
      errors.push(`stale generated required module: ${sourceModule.moduleName}`)
    }
  }
  if (errors.length > 0) {
    console.error('FAIL: generated JavaScript coverage is incomplete or stale')
    errors.forEach((error) => console.error(`- ${error}`))
    return false
  }
  return true
}

const getContext = (source, position) => {
  const before = source.slice(0, position).split('\n')
  const line = before.length
  const column = before[before.length - 1].length + 1
  const lines = source.split(/\r?\n/)
  const start = Math.max(1, line - 1)
  const end = Math.min(lines.length, line + 1)
  const width = String(end).length
  const context = []
  for (let current = start; current <= end; current += 1) {
    context.push(`${current === line ? '>' : ' '} ${String(current).padStart(width, ' ')} | ${lines[current - 1]}`)
  }
  return { line, column, text: context.join('\n') }
}

const reportClassFields = (ts, units) => {
  const findings = units.flatMap((unit) =>
    findClassFields(ts, unit.code, unit.moduleName).map((finding) => ({
      ...finding,
      unit,
      context: getContext(unit.code, finding.position),
    })),
  )
  if (findings.length === 0) {
    return true
  }
  console.error(`FAIL: unsupported JavaScript class-field syntax found (${findings.length})`)
  for (const finding of findings) {
    console.error(`\n${finding.unit.moduleName}:${finding.context.line}:${finding.context.column}`)
    console.error(`artifact: ${finding.unit.filePath}`)
    console.error(`class: ${finding.className}; kind: ${finding.kind}`)
    console.error(finding.context.text)
  }
  return false
}

const goodFixture = `
class Compatible {
  constructor() { this.value = 1; }
  method(argument = 1) { return { value: argument }; }
}
const text = "class Fake { value = 1; }";
`

const badFixture = `
class AssessmentDraftStore { draft = readInitialDraft(); }
class NavigationGuard { lockedActions = new Set(); }
class OtherIncompatibleFields {
  #secret = 2;
  callback = () => {};
  empty;
  [computed] = 4;
}
`

const runSelfTest = (ts) => {
  const safeCount = findClassFields(ts, goodFixture, 'safe.js').length
  const unsafeCount = findClassFields(ts, badFixture, 'unsafe.js').length
  if (safeCount !== 0 || unsafeCount !== 6) {
    throw new Error(`detector self-test mismatch: safe=${safeCount}, unsafe=${unsafeCount}`)
  }
  console.log('SELF_TEST PASS: both historical incidents and 4 class-field variants detected; method assignments ignored')
}

const parseArguments = (args) => {
  const options = { selfTest: false, selfTestFail: false, artifactDirectory: undefined }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--self-test') {
      options.selfTest = true
    } else if (args[index] === '--self-test-fail') {
      options.selfTestFail = true
    } else if (args[index] === '--artifact-dir' && args[index + 1]) {
      options.artifactDirectory = args[index + 1]
      index += 1
    } else if (args[index] === '--help') {
      console.log('Usage: node scripts/check-wechat-js-compat.mjs [--artifact-dir <path>] [--self-test|--self-test-fail]')
      process.exit(0)
    } else {
      throw new Error(`unknown or incomplete argument: ${args[index]}`)
    }
  }
  return options
}

const runRepositoryCheck = async (ts, parserPath, options) => {
  const { configuration, sourceRoot } = await readProject()
  const classModules = await getClassSourceModules(ts, sourceRoot)
  if (classModules.length === 0) {
    throw new Error(`no TypeScript class sources found under ${sourceRoot}`)
  }
  const a13RequiredModules = await getRequiredSourceModules(sourceRoot, a13RequiredSourcePaths)
  const a14RequiredModules = await getRequiredSourceModules(sourceRoot, a14RequiredSourcePaths)
  const b6RequiredModules = await getRequiredSourceModules(sourceRoot, b6RequiredSourcePaths)
  const requiredModules = mergeSourceModules(
    classModules,
    a13RequiredModules,
    a14RequiredModules,
    b6RequiredModules,
  )
  const artifacts = await locateArtifacts(options, configuration, requiredModules)
  if (artifacts.units.length === 0) {
    throw new Error(`no generated JavaScript found under ${artifacts.artifactRoot}`)
  }

  console.log(`PARSER: TypeScript ${ts.version} (${parserPath})`)
  console.log(`ARTIFACT_SOURCE: ${artifacts.source}`)
  console.log(`ARTIFACT_ROOT: ${artifacts.artifactRoot}`)
  console.log(`GENERATED_JS_MODULES: ${artifacts.units.length}`)
  console.log(`CLASS_SOURCE_MODULES: ${classModules.map((item) => item.moduleName).join(', ')}`)
  console.log(`A1_3_REQUIRED_GENERATED_MODULES: ${a13RequiredModules.map((item) => item.moduleName).join(', ')}`)
  console.log(`A1_4_REQUIRED_GENERATED_MODULES: ${a14RequiredModules.map((item) => item.moduleName).join(', ')}`)
  console.log(`B6_REQUIRED_GENERATED_MODULES: ${b6RequiredModules.map((item) => item.moduleName).join(', ')}`)

  const passed = verifyCoverage(requiredModules, artifacts.units) && reportClassFields(ts, artifacts.units)
  if (!passed) {
    process.exitCode = 1
    return
  }
  console.log(`PASS: ${artifacts.units.length} generated JavaScript modules contain no unsupported class-field syntax`)
}

try {
  const options = parseArguments(process.argv.slice(2))
  if (options.selfTest && options.selfTestFail) {
    throw new Error('--self-test and --self-test-fail cannot be combined')
  }
  const { parser, parserPath } = await loadTypeScriptParser()
  if (options.selfTest) {
    runSelfTest(parser)
  } else if (options.selfTestFail) {
    const unit = { moduleName: 'self-test/incompatible.js', code: badFixture, filePath: '<in-memory>', mtimeMs: Date.now() }
    if (reportClassFields(parser, [unit])) {
      throw new Error('negative self-test did not fail')
    }
    process.exitCode = 1
  } else {
    await runRepositoryCheck(parser, parserPath, options)
  }
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
