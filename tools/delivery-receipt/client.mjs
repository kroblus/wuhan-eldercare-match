import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import Contract from './apps-script/Contract.js'

export { Contract }
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const outbox = path.join(root, 'output/sync-outbox')
const settingsFile = path.join(root, '.codex/delivery-receipt.local.json')
const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/
const success = new Set(['CREATED', 'ALREADY_CREATED'])

export function loadSettings() {
  // The only secret is a receiver-specific token protected with Windows DPAPI.
  // No Google OAuth credential, arbitrary endpoint argument or environment override.
  return fs.readFile(settingsFile, 'utf8').then(text => {
    const settings = JSON.parse(text.replace(/^\uFEFF/, ''))
    if (!Contract.exact(settings, ['endpoint', 'encryptedToken'])
      || typeof settings.endpoint !== 'string' || !endpointPattern.test(settings.endpoint)
      || typeof settings.encryptedToken !== 'string' || !/^[0-9a-f]{100,4096}$/i.test(settings.encryptedToken)
      || process.platform !== 'win32') throw new Error('PENDING_SETUP')
    const script = "$ErrorActionPreference='Stop'; $s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }"
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: settings.encryptedToken, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 8192
    })
    if (result.status !== 0 || !/^[0-9a-f]{64}$/.test(result.stdout || '')) throw new Error('PENDING_SETUP')
    return { endpoint: settings.endpoint, token: result.stdout }
  })
}

export async function postReceipt(receipt, settings, fetcher = fetch) {
  if (!settings || !endpointPattern.test(settings.endpoint || '') || !/^[0-9a-f]{64}$/.test(settings.token || '')) {
    return { receipt_id: receipt.receipt_id, status: 'PENDING_SETUP', code: 'LOCAL_CONFIGURATION_REQUIRED' }
  }
  try {
    const signal = AbortSignal.timeout(25000)
    let response = await fetcher(settings.endpoint, {
      method: 'POST', redirect: 'manual', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: settings.token, receipt })
    })
    // Apps Script ContentService redirects its newly generated response, not a Drive read.
    // Never replay credentials to another host or follow a 307/308 POST redirect.
    if ([302, 303].includes(response.status)) {
      const location = new URL(response.headers.get('location'))
      if (location.protocol !== 'https:' || location.hostname !== 'script.googleusercontent.com'
        || location.port || location.username || location.password || location.pathname !== '/macros/echo') {
        throw new Error('UNSAFE_REDIRECT')
      }
      response = await fetcher(location.href, { method: 'GET', redirect: 'manual', signal })
    }
    if (response.status !== 200) throw new Error('HTTP_UNCERTAIN')
    let bytes = 0
    const chunks = []
    for await (const chunk of response.body) {
      bytes += chunk.length
      if (bytes > 4096) throw new Error('RESPONSE_TOO_LARGE')
      chunks.push(Buffer.from(chunk))
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (success.has(value.status)) {
      if (!Contract.exact(value, ['receipt_id', 'status', 'file_id', 'url'])
        || value.receipt_id !== receipt.receipt_id || typeof value.file_id !== 'string'
        || !/^[A-Za-z0-9_-]{10,200}$/.test(value.file_id)
        || value.url !== `https://drive.google.com/file/d/${value.file_id}/view`) throw new Error('INVALID_RESPONSE')
      return value
    }
    const allowedCodes = {
      REJECTED: ['INVALID_REQUEST', 'UNAUTHORIZED', 'INVALID_RECEIPT', 'ID_CONFLICT', 'METHOD_NOT_ALLOWED'],
      NOT_ACCEPTED: ['NOT_CONFIGURED', 'BUSY'],
      UNKNOWN: ['CREATION_UNCERTAIN', 'RECEIVER_UNCERTAIN']
    }
    if (!allowedCodes[value.status]?.includes(value.code)
      || Object.keys(value).some(k => !['receipt_id', 'status', 'code'].includes(k))
      || (value.receipt_id !== undefined && value.receipt_id !== receipt.receipt_id)) throw new Error('INVALID_RESPONSE')
    return { receipt_id: receipt.receipt_id, status: value.status, code: value.code }
  } catch (_) {
    // No automatic retry, provider payload, token or raw exception in the result/log.
    return { receipt_id: receipt.receipt_id, status: 'UNKNOWN', code: 'TRANSPORT_UNCERTAIN' }
  }
}

// Dependency injection is only for in-process tests; not exposed by MCP/CLI/config.
export function createSubmitter({ directory = outbox, settings = loadSettings, transport = postReceipt } = {}) {
  return async function submitDeliveryReceipt(receipt) {
    if (!Contract.validate(receipt)) return { status: 'REJECTED', code: 'INVALID_RECEIPT' }
    const canonical = Contract.canonical(receipt)
    const digest = createHash('sha256').update(canonical).digest('hex')
    const stateDirectory = path.join(directory, '.delivery-state')
    const file = path.join(stateDirectory, `${receipt.receipt_id}.json`)
    let lock
    let attempted = false
    try {
      await fs.mkdir(stateDirectory, { recursive: true })
      try { lock = await fs.open(`${file}.lock`, 'wx') } catch (_) {
        return { receipt_id: receipt.receipt_id, status: 'NOT_ACCEPTED', code: 'LOCAL_BUSY' }
      }
      let prior
      try { prior = JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      if (prior && prior.digest !== digest) return { receipt_id: receipt.receipt_id, status: 'REJECTED', code: 'ID_CONFLICT' }
      if (prior && success.has(prior.result?.status)) return prior.result
      const save = async result => {
        await fs.writeFile(`${file}.tmp`, JSON.stringify({ digest, receipt, result }, null, 2) + '\n', { mode: 0o600 })
        await fs.rename(`${file}.tmp`, file)
      }
      let configuration
      try { configuration = await settings() } catch (_) {
        const result = { receipt_id: receipt.receipt_id, status: 'PENDING_SETUP', code: 'LOCAL_CONFIGURATION_REQUIRED' }
        // An earlier ambiguous delivery remains UNKNOWN, even when credentials are now absent.
        if (prior?.result?.status === 'UNKNOWN') return prior.result
        await save(result)
        return result
      }
      const unknown = { receipt_id: receipt.receipt_id, status: 'UNKNOWN', code: 'TRANSPORT_UNCERTAIN' }
      await save(unknown)
      attempted = true
      const result = await transport(receipt, configuration)
      // Auth/config failures cannot prove an earlier ambiguous create did not happen.
      if (prior?.result?.status === 'UNKNOWN' && !success.has(result.status) && result.status !== 'UNKNOWN') return prior.result
      await save(result)
      return result
    } catch (_) {
      return { receipt_id: receipt.receipt_id, status: attempted ? 'UNKNOWN' : 'NOT_ACCEPTED', code: 'LOCAL_STATE_UNCERTAIN' }
    } finally {
      if (lock) {
        await lock.close().catch(() => {})
        await fs.unlink(`${file}.lock`).catch(() => {})
      }
    }
  }
}

export const submitDeliveryReceipt = createSubmitter()
