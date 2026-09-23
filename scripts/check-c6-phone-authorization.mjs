import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const authServicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'c6-phone-authorization.ts')
const consultantPagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'consultant', 'index.ts')
const wxDeclarationPath = path.join(repositoryRoot, 'typings', 'index.d.ts')

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return require(path.resolve(explicitPath))
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const profiles = existsSync(profileRoot) ? readdirSync(profileRoot, { withFileTypes: true }) : []
  for (const profile of profiles) {
    if (!profile.isDirectory()) continue
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) continue
    for (const runtime of readdirSync(runtimeRoot, { withFileTypes: true })) {
      if (!runtime.isDirectory()) continue
      const file = path.join(runtimeRoot, runtime.name, 'lib', 'typescript.js')
      if (!existsSync(file)) continue
      const typescript = require(file)
      if (typescript.version === '4.1.2') return typescript
    }
  }
  throw new Error('WeChat TypeScript 4.1.2 parser is required')
}

const typescript = loadWechatTypeScript()
const readSource = (file) => readFileSync(file, 'utf8')

const assertTypeChecks = () => {
  const configFile = typescript.readConfigFile(path.join(repositoryRoot, 'tsconfig.json'), typescript.sys.readFile)
  assert.equal(configFile.error, undefined, 'root TypeScript configuration is readable')
  const parsed = typescript.parseJsonConfigFileContent(configFile.config, typescript.sys, repositoryRoot)
  const program = typescript.createProgram(
    [authServicePath, consultantPagePath, wxDeclarationPath],
    { ...parsed.options, noEmit: true },
  )
  const errors = typescript.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
  if (errors.length > 0) {
    const details = errors.map((diagnostic) => {
      const location = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null
      const fileName = diagnostic.file ? path.relative(repositoryRoot, diagnostic.file.fileName) : 'tsconfig'
      const line = location ? location.line + 1 : 0
      return `${fileName}:${line} ${typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
    })
    throw new Error(`C6 targeted TypeScript diagnostics:\n${details.join('\n')}`)
  }
}

const loadModule = (file, globals = {}, stubs = {}) => {
  const source = readSource(file)
  const transpiled = typescript.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2019,
      strict: true,
    },
  })
  const errors = (transpiled.diagnostics || []).filter((diagnostic) =>
    diagnostic.category === typescript.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, 'targeted source transpiles without syntax errors')

  const module = { exports: {} }
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, ...globals })
  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request]
    throw new Error('unexpected frontend runtime import')
  }
  vm.runInContext(`(function(require,module,exports){${transpiled.outputText}\n})`, context, { filename: file })(
    localRequire,
    module,
    module.exports,
  )
  return module.exports
}

const expectedRequestKeys = (value, expectedKeys) =>
  value && typeof value === 'object'
  && Object.keys(value).sort().join('|') === [...expectedKeys].sort().join('|')

const createAuthSuccess = (sessionEvidence = 'unit-session-evidence-only') => ({
  contractVersion: 'wechat-authenticated-principal-contract-v1',
  kind: 'wechat_authentication_result_v1',
  outcome: 'AUTHENTICATED',
  code: 'AUTHENTICATED',
  sessionEvidence,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
})

const createPhoneSuccess = () => ({
  contractVersion: 'authenticated-visit-submission-persistence-contract-v1',
  kind: 'purpose_bound_phone_verification_result_v1',
  authResolution: 'authenticated',
  phoneEvidenceOutcome: 'authorized',
})

const loadPhoneService = (wx) => loadModule(authServicePath, { wx })

const runPhoneServiceCases = () => {
  const requestCalls = []
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    login(options) {
      options.success({ code: 'unit-login-code-only' })
    },
    request(options) {
      requestCalls.push(options)
      if (options.url.endsWith('/api/v1/auth/wechat')) {
        options.success({ statusCode: 200, data: createAuthSuccess() })
        return
      }
      options.success({ statusCode: 200, data: createPhoneSuccess() })
    },
  }
  const service = loadPhoneService(wx)
  let result = null
  service.verifyC6PhoneAuthorization('unit-phone-code-only', (value) => { result = value })

  assert.equal(result && result.authResolution, 'authenticated', 'C5 session resolves before phone verification')
  assert.equal(result && result.phoneEvidenceOutcome, 'authorized', 'authorized C3 phone outcome is returned')
  assert.equal(requestCalls.length, 2, 'flow makes one C5 and one phone-verification request')
  const authRequest = requestCalls[0]
  const phoneRequest = requestCalls[1]
  assert.ok(authRequest.url.endsWith('/api/v1/auth/wechat'), 'first request uses the C5 auth boundary')
  assert.ok(expectedRequestKeys(authRequest.data, ['contractVersion', 'kind', 'loginCode']), 'C5 request shape is exact')
  assert.equal(authRequest.data.contractVersion, 'wechat-authenticated-principal-contract-v1', 'C5 contract version is exact')
  assert.equal(authRequest.data.kind, 'wechat_authentication_request_v1', 'C5 request kind is exact')
  assert.ok(phoneRequest.url.endsWith('/api/v1/auth/wechat/phone/verify'), 'second request uses C6 phone verifier')
  assert.ok(expectedRequestKeys(phoneRequest.data, ['contractVersion', 'kind', 'purpose', 'code']), 'phone request shape is exact')
  assert.equal(phoneRequest.data.contractVersion, 'authenticated-visit-submission-persistence-contract-v1', 'phone contract version is exact')
  assert.equal(phoneRequest.data.kind, 'purpose_bound_phone_verification_request_v1', 'phone request kind is exact')
  assert.equal(phoneRequest.data.purpose, 'appointment_or_consultant_contact', 'phone purpose is frozen C3 value')
  assert.equal(phoneRequest.header['X-Auth-Evidence'], 'unit-session-evidence-only', 'fresh C5 evidence is sent only as auth header')
  assert.ok(expectedRequestKeys(result, ['authResolution', 'phoneEvidenceOutcome']), 'client result excludes provider and credential fields')

  const rejectedAuthRequests = []
  const rejectedAuth = loadPhoneService({
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    login(options) { options.success({ code: 'unit-login-code-only' }) },
    request(options) {
      rejectedAuthRequests.push(options)
      options.success({
        statusCode: 200,
        data: {
          contractVersion: 'wechat-authenticated-principal-contract-v1',
          kind: 'wechat_authentication_result_v1',
          outcome: 'UNAVAILABLE',
          code: 'SERVICE_UNAVAILABLE',
          sessionEvidence: null,
          expiresAt: null,
        },
      })
    },
  })
  let authFailure = null
  rejectedAuth.verifyC6PhoneAuthorization('unit-phone-code-only', (value) => { authFailure = value })
  assert.equal(rejectedAuthRequests.length, 1, 'failed C5 auth prevents phone provider request')
  assert.equal(authFailure && authFailure.phoneEvidenceOutcome, null, 'phone outcome stays null when C5 auth fails')

  const expiredSessionCalls = []
  const expiredSession = loadPhoneService({
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    login(options) { options.success({ code: 'unit-login-code-only' }) },
    request(options) {
      expiredSessionCalls.push(options)
      options.success({
        statusCode: 200,
        data: {
          ...createAuthSuccess(),
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      })
    },
  })
  let expiredSessionResult = null
  expiredSession.verifyC6PhoneAuthorization('unit-phone-code-only', (value) => { expiredSessionResult = value })
  assert.equal(expiredSessionCalls.length, 1, 'expired C5 session prevents phone provider request')
  assert.equal(expiredSessionResult && expiredSessionResult.phoneEvidenceOutcome, null, 'expired C5 session cannot authorize contact')

  const missingCodeCalls = []
  const missingCodeService = loadPhoneService({
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    login() { missingCodeCalls.push('login') },
    request() { missingCodeCalls.push('request') },
  })
  let missingCodeResult = null
  missingCodeService.verifyC6PhoneAuthorization('', (value) => { missingCodeResult = value })
  assert.equal(missingCodeCalls.length, 0, 'missing phone code fails before auth or provider network call')
  assert.equal(missingCodeResult && missingCodeResult.phoneEvidenceOutcome, null, 'missing local proof creates no authorized outcome')

  let nonDevelopmentLoginCalls = 0
  const nonDevelopmentService = loadPhoneService({
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
    login() { nonDevelopmentLoginCalls += 1 },
    request() { nonDevelopmentLoginCalls += 1 },
  })
  let nonDevelopmentResult = null
  nonDevelopmentService.verifyC6PhoneAuthorization('unit-phone-code-only', (value) => { nonDevelopmentResult = value })
  assert.equal(nonDevelopmentLoginCalls, 0, 'unconfigured release origin fails closed before network')
  assert.equal(nonDevelopmentResult && nonDevelopmentResult.phoneEvidenceOutcome, null, 'unconfigured release cannot authorize contact')
}

const runConsultantPageCases = () => {
  let pageConfig = null
  let serviceCalls = 0
  let lastPhoneCode = ''
  const wx = {}
  loadModule(consultantPagePath, {
    wx,
    Component: (value) => { pageConfig = value },
  }, {
    '../../services/consultant-global-page': { buildGlobalConsultantPageApplicationV1() { return {} } },
    './index-view-model': { createConsultantPageViewModelV1() { return {} } },
    '../../utils/navigation-guard': {
      getNavigationGuard() { return { acquire() { return true }, release() {} } },
      navigateToWithGuard() {},
      resetNavigationGuard() {},
    },
    '../../services/c6-phone-authorization': {
      verifyC6PhoneAuthorization(code, complete) {
        serviceCalls += 1
        lastPhoneCode = code
        complete({ authResolution: 'authenticated', phoneEvidenceOutcome: 'authorized' })
      },
    },
  })
  assert.ok(pageConfig && pageConfig.methods, 'Consultant page registers the authorization action')

  const makePage = () => {
    const data = { ...pageConfig.data }
    return {
      data,
      setData(update) { Object.assign(data, update) },
    }
  }

  const deniedPage = makePage()
  pageConfig.methods.onPhoneAuthorization.call(deniedPage, {
    detail: { errMsg: 'getPhoneNumber:fail user deny' },
  })
  assert.equal(serviceCalls, 0, 'declined consent makes no C5 or provider request')
  assert.ok(deniedPage.data.phoneAuthorizationMessage.indexOf('尚未授权') >= 0, 'decline is shown as a safe non-success message')

  const authorizedPage = makePage()
  pageConfig.methods.onPhoneAuthorization.call(authorizedPage, {
    detail: { code: 'unit-phone-code-only' },
  })
  assert.equal(serviceCalls, 1, 'one explicit consent sends one verifier flow')
  assert.equal(lastPhoneCode, 'unit-phone-code-only', 'callback proof is forwarded without page storage')
  assert.equal(authorizedPage.data.phoneAuthorizationLoading, false, 'loading clears after verification')
  assert.ok(authorizedPage.data.phoneAuthorizationMessage.indexOf('没有提交联系申请或预约') >= 0, 'success does not imply contact or Appointment submission')
  assert.ok(authorizedPage.data.phoneAuthorizationMessage.indexOf('unit-phone-code-only') < 0, 'one-time code is absent from user-visible state')
}

const runMarkupChecks = () => {
  const markup = readSource(path.join(repositoryRoot, 'miniprogram', 'pages', 'consultant', 'index.wxml'))
  assert.ok(markup.includes('open-type="getPhoneNumber"'), 'explicit native phone consent action is present')
  assert.ok(markup.includes('bindgetphonenumber="onPhoneAuthorization"'), 'phone consent event has one page handler')
  assert.ok(markup.includes('不发送联系申请或预约'), 'copy separates evidence verification from submission')
  assert.ok(markup.includes('不保存可复用凭证'), 'copy states that phone proof is not retained')
}

const run = () => {
  assertTypeChecks()
  runPhoneServiceCases()
  runConsultantPageCases()
  runMarkupChecks()
  console.log(`C6_PHONE_AUTHORIZATION_TARGETED_TESTS = PASS (TypeScript ${typescript.version})`)
}

run()
