import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sessionPath = path.join(repositoryRoot, 'miniprogram', 'services', 'c5-authenticated-backend-session.ts')
const DEVELOPMENT_ORIGIN_KEY = '__dev_backend_origin_v1'
const PRIVATE_LAN_HTTP_ORIGIN = 'http://10.123.45.67:8080'
const failures = []
const cases = []

const runCase = (name, callback) => {
  cases.push(name)
  try {
    callback()
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const run = () => {
  const { ts } = loadWechatTypeScript()
  let storedOrigin = PRIVATE_LAN_HTTP_ORIGIN
  let environment = 'develop'
  const storageReads = []
  const runtime = createWechatTsRuntime(ts, {
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
      getStorageSync: (key) => {
        storageReads.push(key)
        return storedOrigin
      },
    },
  })
  const module = runtime.load(sessionPath)

  runCase('EXPLICIT_PRIVATE_LAN_HTTP_AND_HTTPS_ORIGINS_ACCEPTED', () => {
    for (const origin of [
      PRIVATE_LAN_HTTP_ORIGIN,
      'http://172.16.0.2:8080',
      'http://192.168.0.2:8080',
      'http://elder-dev.local:8080',
      'http://[fd12:3456::2]:8080',
      'https://elder-api.example.test',
      'https://10.123.45.67:8443',
    ]) {
      assert.equal(module.resolveC5BackendOriginV1('develop', origin), origin, origin)
    }
  })

  runCase('MISSING_OR_INVALID_ORIGIN_FAILS_CLOSED', () => {
    for (const origin of [
      undefined,
      null,
      '',
      '   ',
      ' http://10.123.45.67:8080',
      'http://10.123.45.67:8080 ',
      'http://127.0.0.1:8080',
      'http://127.10.20.30:8080',
      'http://127.1:8080',
      'https://127.1',
      'https://0x7f.0.0.1',
      'https://localhost:8080',
      'https://dev.localhost:8080',
      'https://[::1]:8080',
      'https://[0:0:0:0:0:0:0:1]:8080',
      'https://[::]:8080',
      'http://0.0.0.0:8080',
      'http://192.0.2.20:8080',
      'http://elder-api.example.test:8080',
      'http://10.123.45.67',
      'http://10.123.45.67:0',
      'http://10.123.45.67:65536',
      'http://10.123.45.67:abc',
      'https://name:password@elder-api.example.test',
      'https://elder-api.example.test/path',
      'https://elder-api.example.test/?query=1',
      'https://elder-api.example.test#fragment',
      'ftp://elder-api.example.test',
      'https://999.999.999.999',
    ]) {
      assert.equal(module.resolveC5BackendOriginV1('develop', origin), '', String(origin))
    }
  })

  runCase('TRIAL_AND_RELEASE_ALWAYS_IGNORE_DEVELOP_ORIGIN', () => {
    for (const nonDevelopEnvironment of ['trial', 'release', 'invalid', undefined]) {
      assert.equal(module.resolveC5BackendOriginV1(nonDevelopEnvironment, PRIVATE_LAN_HTTP_ORIGIN), '')
    }
  })

  runCase('DEFAULT_TRANSPORT_READS_ONE_LOCAL_KEY_AND_RESOLVES_CONFIGURED_ORIGIN', () => {
    const transport = module.createDefaultWeChatC5BackendTransportV1()
    const sessionClient = module.createC5AuthenticatedBackendSessionClientV1(transport)
    assert.equal(sessionClient.resolveBackendOrigin(), PRIVATE_LAN_HTTP_ORIGIN)
    assert.deepEqual(storageReads, [DEVELOPMENT_ORIGIN_KEY])
  })

  runCase('NON_DEVELOP_ENVIRONMENT_DOES_NOT_READ_OR_USE_LOCAL_ORIGIN', () => {
    const transport = module.createDefaultWeChatC5BackendTransportV1()
    const sessionClient = module.createC5AuthenticatedBackendSessionClientV1(transport)
    storageReads.length = 0
    environment = 'trial'
    assert.equal(sessionClient.resolveBackendOrigin(), '')
    assert.deepEqual(storageReads, [])
    environment = 'develop'
  })

  runCase('STORAGE_FAILURE_AND_ABSENT_STORAGE_API_FAIL_CLOSED', () => {
    const transport = module.createDefaultWeChatC5BackendTransportV1()
    const sessionClient = module.createC5AuthenticatedBackendSessionClientV1(transport)
    runtime.context.wx.getStorageSync = () => { throw new Error('synthetic storage failure') }
    assert.equal(sessionClient.resolveBackendOrigin(), '')
    runtime.context.wx.getStorageSync = undefined
    assert.equal(sessionClient.resolveBackendOrigin(), '')
  })

  if (failures.length > 0) {
    process.stderr.write(`C5 development backend origin checks failed (${failures.length}/${cases.length})\n`)
    for (const failure of failures) process.stderr.write(`- ${failure}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`C5 development backend origin checks passed (${cases.length}/${cases.length})\n`)
}

run()
