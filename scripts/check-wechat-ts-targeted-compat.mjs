import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsconfigPath = path.join(repositoryRoot, 'tsconfig.json')
const elderProfileDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile')
const elderProfileTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'elder-profile.ts')
const elderProfileV2TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'elder-profile-v2.ts')
const elderProfileV2DomainRoot = path.join(elderProfileDomainRoot, 'v2')
const elderProfileV2EntryPath = path.join(elderProfileV2DomainRoot, 'index.ts')
const elderProfileV2FormalPath = path.join(elderProfileV2DomainRoot, 'derive-elder-profile-v2.ts')
const elderProfileV2PreviewPath = path.join(elderProfileV2DomainRoot, 'derive-elder-profile-preview-v2.ts')
const institutionDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution')
const institutionTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution.ts')
const institutionV11TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-v1-1.ts')
const institutionV11DomainRoot = path.join(institutionDomainRoot, 'v1-1')
const institutionV11EntryPath = path.join(institutionV11DomainRoot, 'index.ts')
const institutionV11ValidatorPath = path.join(institutionV11DomainRoot, 'validate-institution-v1-1.ts')
const institutionV11ProjectionPath = path.join(institutionV11DomainRoot, 'project-to-v1.ts')
const institutionV12TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-v1-2.ts')
const institutionV121TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-v1-2-1.ts')
const institutionV12DomainRoot = path.join(institutionDomainRoot, 'v1-2')
const institutionV121DomainRoot = path.join(institutionDomainRoot, 'v1-2-1')
const institutionV12EntryPath = path.join(institutionV12DomainRoot, 'index.ts')
const institutionV121EntryPath = path.join(institutionV121DomainRoot, 'index.ts')
const recommendationDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation')
const recommendationTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'recommendation.ts')
const recommendationEntryPath = path.join(recommendationDomainRoot, 'index.ts')
const recommendationV2TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'recommendation-v2.ts')
const recommendationPreviewV2TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'recommendation-preview-v2.ts')
const institutionCatalogV11TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-catalog-v1-1.ts')
const institutionListDetailTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-list-detail.ts')
const institutionCatalogV121TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-catalog-v1-2-1.ts')
const institutionPublicContentV1TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-public-content-v1.ts')
const recommendationV2EntryPath = path.join(recommendationDomainRoot, 'v2', 'index.ts')
const recommendationV2PreviewEvaluatorPath = path.join(recommendationDomainRoot, 'v2', 'evaluate-recommendation-preview-v2.ts')
const applicationServiceRoot = path.join(repositoryRoot, 'miniprogram', 'services')
const applicationMockRoot = path.join(repositoryRoot, 'miniprogram', 'mock')
const integrationTypePaths = [
  path.join(repositoryRoot, 'miniprogram', 'types', 'institution-catalog.ts'),
  path.join(repositoryRoot, 'miniprogram', 'types', 'recommendation-preview.ts'),
  path.join(repositoryRoot, 'miniprogram', 'types', 'profile-application-v2.ts'),
  path.join(repositoryRoot, 'miniprogram', 'types', 'recommendation-result-v2.ts'),
  recommendationV2TypePath,
  recommendationPreviewV2TypePath,
  institutionCatalogV11TypePath,
  institutionListDetailTypePath,
]
const draftStorePath = path.join(repositoryRoot, 'miniprogram', 'store', 'assessment-draft.ts')
const assessmentV2TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'assessment-v2.ts')
const assessmentMigrationPath = path.join(repositoryRoot, 'miniprogram', 'utils', 'assessment-migration.ts')
const assessmentResumePath = path.join(repositoryRoot, 'miniprogram', 'utils', 'assessment-resume.ts')
const assessmentV2PageTargets = [
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'intro.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'basic.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'health.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'adl.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'cognitive.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'preference.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'budget.ts'),
]
const wechatDeclarationPath = path.join(repositoryRoot, 'typings', 'index.d.ts')
const profilePagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'profile.ts')
const profileViewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'profile-view-model.ts')
const profileV2ViewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'assessment', 'profile-v2-view-model.ts')
const profileV2ApplicationPath = path.join(repositoryRoot, 'miniprogram', 'services', 'profile-application-v2.ts')
const navigationBarPath = path.join(repositoryRoot, 'miniprogram', 'components', 'navigation-bar', 'navigation-bar.ts')
const profileCompatibilityTargets = [profilePagePath, profileViewModelPath, profileV2ViewModelPath, profileV2ApplicationPath, navigationBarPath]
const recommendationResultPagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'recommendation', 'result.ts')
const recommendationResultViewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'recommendation', 'result-view-model.ts')
const recommendationResultV2ViewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'recommendation', 'result-v2-view-model.ts')
const recommendationResultApplicationPath = path.join(repositoryRoot, 'miniprogram', 'services', 'recommendation-result-application.ts')
const recommendationResultCompatibilityTargets = [recommendationResultPagePath, recommendationResultViewModelPath, recommendationResultV2ViewModelPath, recommendationResultApplicationPath]
const institutionListDetailCompatibilityTargets = [
  path.join(applicationServiceRoot, 'institution-detail-route.ts'),
  path.join(applicationServiceRoot, 'institution-display-projection-v11.ts'),
  path.join(applicationServiceRoot, 'institution-list-detail-application.ts'),
  path.join(applicationServiceRoot, 'institution-presentation.ts'),
  path.join(applicationServiceRoot, 'institution-recommendation-source.ts'),
  path.join(applicationServiceRoot, 'institution-record-resolver.ts'),
  path.join(applicationServiceRoot, 'institution-source-context.ts'),
  institutionListDetailTypePath,
]
// A0-3 live Page/ViewModel/Home composition is listed explicitly.  The
// application-service walk above is intentionally not relied on to prove
// that these page entry points passed the WeChat TypeScript parser.
const institutionListDetailPageCompatibilityTargets = [
  path.join(repositoryRoot, 'miniprogram', 'pages', 'institution', 'index.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'institution', 'detail.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'institution', 'list-view-model.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'institution', 'detail-view-model.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'home', 'index.ts'),
  path.join(repositoryRoot, 'miniprogram', 'pages', 'recommendation', 'recommendation-display-semantics.ts'),
  path.join(applicationServiceRoot, 'institution-list-detail-page.ts'),
]
// A1-3 application integration is called out explicitly so a missing provider,
// adapter or public-content boundary cannot be hidden by the broad directory walk.
const institutionV121CatalogIntegrationCompatibilityTargets = [
  institutionCatalogV121TypePath,
  institutionPublicContentV1TypePath,
  path.join(applicationServiceRoot, 'institution-catalog-v1-2-1.ts'),
  path.join(applicationServiceRoot, 'institution-public-content-v1.ts'),
  path.join(applicationServiceRoot, 'institution-v1-2-1-presentation.ts'),
  path.join(applicationMockRoot, 'institution-catalog.mock.ts'),
  path.join(applicationMockRoot, 'institution-public-content.mock.ts'),
]

const normalizePath = (filePath) => path.resolve(filePath).toLowerCase()

const walkTypeScriptFiles = async (root) => {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkTypeScriptFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }
  return files
}

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    if (!existsSync(parserPath)) {
      throw new Error(`WECHAT_TYPESCRIPT_PATH does not exist: ${parserPath}`)
    }
    return { parser: require(parserPath), parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat DevTools TypeScript not found; set WECHAT_TYPESCRIPT_PATH explicitly')
  }

  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) {
    throw new Error('WeChat DevTools profile directory not found')
  }

  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) {
      continue
    }
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) {
      continue
    }
    for (const runtimePackage of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtimePackage.name, 'lib', 'typescript.js')
      if (runtimePackage.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('WeChat DevTools TypeScript not found; open DevTools or set WECHAT_TYPESCRIPT_PATH')
  }

  const parserPath = candidates[0].parserPath
  return { parser: require(parserPath), parserPath, source: 'WeChat DevTools mptslib' }
}

const diagnosticText = (ts, diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || typeof diagnostic.start !== 'number') {
    return message
  }
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const relativePath = path.relative(repositoryRoot, diagnostic.file.fileName)
  return `${relativePath}:${location.line + 1}:${location.character + 1} ${message}`
}

const findClassFields = (ts, fileName, source, scriptKind) => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
  const findings = []
  const visit = (node) => {
    const parent = node.parent
    const insideClass = parent && (ts.isClassDeclaration(parent) || ts.isClassExpression(parent))
    // TS declarations initialized in constructors are the required project pattern.
    // JS must contain no fields at all; TS may contain declarations, not initializers.
    if (insideClass && ts.isPropertyDeclaration(node)
      && (scriptKind === ts.ScriptKind.JS || node.initializer)) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      findings.push(`${fileName}:${location.line + 1}:${location.character + 1} ${node.getText(sourceFile)}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}

const inspectRuntimeSurface = (ts, fileName, source) => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const externalImports = []
  const unsupportedRuntimeFeatures = []
  const unsupportedIdentifiers = new Set(['structuredClone', 'WeakRef', 'FinalizationRegistry', 'BigInt'])
  const unsupportedProperties = new Set(['at', 'findLast', 'findLastIndex', 'replaceAll'])
  const unsupportedStaticMembers = new Set(['Promise.any', 'Object.hasOwn', 'Array.fromAsync'])

  const visit = (node) => {
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require'
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      const request = node.arguments[0].text
      if (!request.startsWith('.')) {
        externalImports.push(`${fileName}: require(${JSON.stringify(request)})`)
      }
    }

    if (ts.isIdentifier(node) && unsupportedIdentifiers.has(node.text)) {
      unsupportedRuntimeFeatures.push(`${fileName}: ${node.text}`)
    }

    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text
      if (unsupportedProperties.has(propertyName)) {
        unsupportedRuntimeFeatures.push(`${fileName}: .${propertyName}`)
      }
      if (ts.isIdentifier(node.expression)
        && unsupportedStaticMembers.has(`${node.expression.text}.${propertyName}`)) {
        unsupportedRuntimeFeatures.push(`${fileName}: ${node.expression.text}.${propertyName}`)
      }
    }

    if (node.kind === ts.SyntaxKind.BigIntLiteral
      || node.kind === ts.SyntaxKind.QuestionDotToken
      || node.kind === ts.SyntaxKind.QuestionQuestionToken) {
      unsupportedRuntimeFeatures.push(`${fileName}: ${ts.SyntaxKind[node.kind]}`)
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const helperPattern = /\b(?:__awaiter|__generator|__spreadArray|__spreadArrays|__assign|regeneratorRuntime)\b|\b(?:tslib|core-js)\b/g
  const helperMatches = source.match(helperPattern) || []
  helperMatches.forEach((helper) => unsupportedRuntimeFeatures.push(`${fileName}: ${helper}`))

  return { externalImports, unsupportedRuntimeFeatures }
}

const assertNoConfigErrors = (ts, diagnostics) => {
  const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) {
    throw new Error(`tsconfig diagnostics:\n${errors.map((diagnostic) => diagnosticText(ts, diagnostic)).join('\n')}`)
  }
}

const run = async () => {
  const { parser: ts, parserPath, source: parserSource } = await loadWechatTypeScript()
  const applicationTargets = [
    ...await walkTypeScriptFiles(applicationServiceRoot),
    ...await walkTypeScriptFiles(applicationMockRoot),
    ...integrationTypePaths,
    draftStorePath,
    assessmentV2TypePath,
    assessmentMigrationPath,
    assessmentResumePath,
    ...assessmentV2PageTargets,
    ...recommendationResultCompatibilityTargets,
    ...institutionListDetailPageCompatibilityTargets,
  ]
  const targetFiles = [
    ...await walkTypeScriptFiles(elderProfileDomainRoot),
    ...await walkTypeScriptFiles(institutionDomainRoot),
    ...await walkTypeScriptFiles(recommendationDomainRoot),
    elderProfileTypePath,
    elderProfileV2TypePath,
    institutionTypePath,
    institutionV11TypePath,
    institutionV12TypePath,
    institutionV121TypePath,
    recommendationTypePath,
    recommendationV2TypePath,
    recommendationPreviewV2TypePath,
    institutionCatalogV11TypePath,
    ...applicationTargets,
  ].sort()
  const requiredTargets = [
    elderProfileTypePath, elderProfileV2TypePath,
    elderProfileV2EntryPath, elderProfileV2FormalPath, elderProfileV2PreviewPath,
    institutionTypePath, institutionV11TypePath, institutionV12TypePath, institutionV121TypePath,
    institutionV11EntryPath, institutionV11ValidatorPath, institutionV11ProjectionPath,
    institutionV12EntryPath, institutionV121EntryPath,
    recommendationTypePath, recommendationEntryPath,
    recommendationV2TypePath, recommendationV2EntryPath,
    recommendationV2PreviewEvaluatorPath,
    recommendationPreviewV2TypePath, institutionCatalogV11TypePath,
    ...profileCompatibilityTargets, ...integrationTypePaths,
    ...institutionListDetailCompatibilityTargets, wechatDeclarationPath,
    ...institutionListDetailPageCompatibilityTargets,
    ...institutionV121CatalogIntegrationCompatibilityTargets,
    assessmentV2TypePath, assessmentMigrationPath, assessmentResumePath,
    ...assessmentV2PageTargets,
    path.join(applicationServiceRoot, 'recommendation-preview.ts'),
    path.join(applicationServiceRoot, 'institution-catalog.ts'),
    path.join(applicationMockRoot, 'institution-catalog.mock.ts'),
    path.join(applicationServiceRoot, 'recommendation-preview-v2.ts'),
    path.join(applicationServiceRoot, 'institution-catalog-v1-1.ts'),
    ...recommendationResultCompatibilityTargets,
  ]
  const missingTargets = requiredTargets.filter((filePath) => !existsSync(filePath))
  if (targetFiles.length === 0 || missingTargets.length > 0) {
    throw new Error(`targeted TypeScript sources are missing:\n${missingTargets.map((filePath) => path.relative(repositoryRoot, filePath)).join('\n')}`)
  }

  const configResult = ts.readConfigFile(tsconfigPath, (fileName) => readFileSync(fileName, 'utf8'))
  if (configResult.error) {
    throw new Error(diagnosticText(ts, configResult.error))
  }
  const parsedConfig = ts.parseJsonConfigFileContent(configResult.config, ts.sys, repositoryRoot, undefined, tsconfigPath)
  assertNoConfigErrors(ts, parsedConfig.errors)

  const compilerOptions = {
    ...parsedConfig.options,
    noEmit: false,
    noEmitOnError: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    inlineSourceMap: false,
    inlineSources: false,
    incremental: false,
    composite: false,
    outDir: undefined,
    outFile: undefined,
    tsBuildInfoFile: undefined,
  }
  const host = ts.createCompilerHost(compilerOptions)
  const emittedJavaScript = []
  const emittedSourcePaths = new Set()
  host.writeFile = (fileName, data, _writeByteOrderMark, _onError, sourceFiles) => {
    if (!fileName.endsWith('.js')) {
      return
    }
    emittedJavaScript.push({ fileName, source: data })
    for (const sourceFile of sourceFiles || []) {
      emittedSourcePaths.add(normalizePath(sourceFile.fileName))
    }
  }

  // Full diagnostics for the application/service graph with the real wx declarations.
  // No stub Store, no replacement declarations, no skipLibCheck or error suppression.
  const program = ts.createProgram([...targetFiles, wechatDeclarationPath], compilerOptions, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const diagnosticErrors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  if (diagnosticErrors.length > 0) {
    throw new Error(`targeted TypeScript diagnostics:\n${diagnosticErrors.map((diagnostic) => diagnosticText(ts, diagnostic)).join('\n')}`)
  }

  const emitResult = program.emit()
  const emitErrors = emitResult.diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  if (emitResult.emitSkipped || emitErrors.length > 0) {
    throw new Error(`targeted emit failed:\n${emitErrors.map((diagnostic) => diagnosticText(ts, diagnostic)).join('\n')}`)
  }

  const profileSyntaxErrors = []
  for (const profileTarget of profileCompatibilityTargets) {
    const source = readFileSync(profileTarget, 'utf8')
    const transpiled = ts.transpileModule(source, {
      compilerOptions,
      fileName: profileTarget,
      reportDiagnostics: true,
    })
    const errors = (transpiled.diagnostics || [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    profileSyntaxErrors.push(...errors)
    emittedJavaScript.push({ fileName: `${profileTarget}.js`, source: transpiled.outputText })
  }
  if (profileSyntaxErrors.length > 0) {
    throw new Error(`Profile targeted TypeScript syntax diagnostics:\n${profileSyntaxErrors.map((diagnostic) => diagnosticText(ts, diagnostic)).join('\n')}`)
  }

  const missingEmits = targetFiles.filter((fileName) => !emittedSourcePaths.has(normalizePath(fileName)))
  if (missingEmits.length > 0) {
    throw new Error(`targeted sources were not emitted in memory:\n${missingEmits.map((fileName) => path.relative(repositoryRoot, fileName)).join('\n')}`)
  }

  const sourceClassFields = []
  for (const targetFile of [...targetFiles, ...profileCompatibilityTargets]) {
    sourceClassFields.push(...findClassFields(
      ts,
      path.relative(repositoryRoot, targetFile),
      readFileSync(targetFile, 'utf8'),
      ts.ScriptKind.TS,
    ))
  }

  const emittedClassFields = []
  const externalImports = []
  const unsupportedRuntimeFeatures = []
  for (const emitted of emittedJavaScript) {
    const relativeOutputPath = path.relative(repositoryRoot, emitted.fileName)
    emittedClassFields.push(...findClassFields(ts, relativeOutputPath, emitted.source, ts.ScriptKind.JS))
    const runtimeSurface = inspectRuntimeSurface(ts, relativeOutputPath, emitted.source)
    externalImports.push(...runtimeSurface.externalImports)
    unsupportedRuntimeFeatures.push(...runtimeSurface.unsupportedRuntimeFeatures)
  }

  if (sourceClassFields.length > 0) {
    throw new Error(`source class property initializer is forbidden:\n${sourceClassFields.join('\n')}`)
  }
  if (emittedClassFields.length > 0) {
    throw new Error(`unsupported emitted class-field syntax:\n${emittedClassFields.join('\n')}`)
  }
  if (externalImports.length > 0) {
    throw new Error(`external runtime imports are forbidden:\n${externalImports.join('\n')}`)
  }
  if (unsupportedRuntimeFeatures.length > 0) {
    throw new Error(`additional runtime/polyfill assumptions detected:\n${[...new Set(unsupportedRuntimeFeatures)].join('\n')}`)
  }

  const compilerTarget = ts.ScriptTarget[compilerOptions.target] || String(compilerOptions.target)
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${ts.version} (${parserPath})`)
  console.log(`COMPILER_TARGET: ${compilerTarget}`)
  console.log(`TARGET_ROOTS: ${targetFiles.length + profileCompatibilityTargets.length}`)
  console.log(`RECOMMENDATION_TARGETS: ${targetFiles.filter((fileName) => fileName === recommendationTypePath || fileName.startsWith(`${recommendationDomainRoot}${path.sep}`)).length}`)
  console.log(`INSTITUTION_V1_1_TARGETS: ${targetFiles.filter((fileName) => fileName === institutionV11TypePath || fileName.startsWith(`${institutionV11DomainRoot}${path.sep}`)).length}`)
  console.log(`INSTITUTION_V1_2_TARGETS: ${targetFiles.filter((fileName) => fileName === institutionV12TypePath || fileName.startsWith(`${institutionV12DomainRoot}${path.sep}`)).length}`)
  console.log(`INSTITUTION_V1_2_1_TARGETS: ${targetFiles.filter((fileName) => fileName === institutionV121TypePath || fileName.startsWith(`${institutionV121DomainRoot}${path.sep}`)).length}`)
  console.log(`ELDER_PROFILE_V2_TARGETS: ${targetFiles.filter((fileName) => fileName === elderProfileV2TypePath || fileName.startsWith(`${elderProfileV2DomainRoot}${path.sep}`)).length}`)
  console.log(`APPLICATION_SERVICE_PROVIDER_MOCK_STORE_TARGETS: ${applicationTargets.length}`)
  console.log(`INSTITUTION_LIST_DETAIL_A0_2_TARGETS: ${institutionListDetailCompatibilityTargets.length}`)
  console.log(`INSTITUTION_LIST_DETAIL_A0_3_PAGE_TARGETS: ${institutionListDetailPageCompatibilityTargets.length}`)
  console.log(`INSTITUTION_V1_2_1_CATALOG_INTEGRATION_TARGETS: ${institutionV121CatalogIntegrationCompatibilityTargets.length}`)
  console.log('APPLICATION_DEPENDENCIES: full diagnostics with official wx typings; no suppression')
  console.log(`PROFILE_SYNTAX_TARGETS: ${profileCompatibilityTargets.length}`)
  console.log(`EMITTED_JS_MODULES_IN_MEMORY: ${emittedJavaScript.length}`)
  console.log(`TYPESCRIPT_DIAGNOSTIC_ERRORS: ${diagnosticErrors.length}`)
  console.log(`PROFILE_SYNTAX_DIAGNOSTIC_ERRORS: ${profileSyntaxErrors.length}`)
  console.log(`SOURCE_CLASS_INITIALIZERS: ${sourceClassFields.length}`)
  console.log(`EMITTED_CLASS_FIELDS: ${emittedClassFields.length}`)
  console.log(`EXTERNAL_RUNTIME_IMPORTS: ${externalImports.length}`)
  console.log(`ADDITIONAL_RUNTIME_POLYFILL_ASSUMPTIONS: ${unsupportedRuntimeFeatures.length}`)
  console.log('WECHAT_TYPESCRIPT_TARGETED_COMPATIBILITY = PASS')
}

run().catch((error) => {
  console.error('WECHAT_TYPESCRIPT_TARGETED_COMPATIBILITY = FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
