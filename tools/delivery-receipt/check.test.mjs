import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Contract, root, createSubmitter, postReceipt } from './client.mjs'
import { dispatch } from './mcp.mjs'
import { parseLocalReceipt, loadLocalReceipt } from './resend.mjs'

const source = await Promise.all(['Contract.js', 'Code.js'].map(name =>
  fs.readFile(new URL(`./apps-script/${name}`, import.meta.url), 'utf8')))
const token = 'a'.repeat(64) // SYNTHETIC_TEST_ONLY, never a deployment credential.
const endpoint = 'https://script.google.com/macros/s/' + 'x'.repeat(32) + '/exec'
const receipt = () => ({
  receipt_id: 'ac516a92-e859-4729-b6b1-16a4a6b63e2e', time: '2026-10-27T22:32:08+08:00',
  task: 'workflow-v5-test', branch: 'codex/unified-source-baseline', commit: 'b'.repeat(40), push: 'VERIFIED',
  body: '完成：合成回执。\n验证：定向检查。\n遗留：尚未真实投递。\n下一步：Owner 部署。'
})
const created = r => ({ receipt_id: r.receipt_id, status: 'CREATED', file_id: 'synthetic_file_12345', url: 'https://drive.google.com/file/d/synthetic_file_12345/view' })
const jsonResponse = value => new Response(JSON.stringify(value), { status: 200 })

function cloud(options = {}) {
  const ledger = new Map([['RECEIPT_TOKEN', token]])
  const calls = []
  let held = false
  const context = vm.createContext({
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => ledger.get(key) ?? null,
      setProperty: (key, value) => {
        if (options.failPending && JSON.parse(value).status === 'PENDING') throw new Error('synthetic storage failure')
        if (options.failCompleted && JSON.parse(value).status === 'CREATED') throw new Error('synthetic storage failure')
        ledger.set(key, value)
      }
    }) },
    LockService: { getScriptLock: () => ({
      tryLock: () => { if (options.busy || held) return false; held = true; return true },
      hasLock: () => held, releaseLock: () => { held = false }
    }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()],
      newBlob: (body, mimeType, name) => ({ body, mimeType, name }) },
    Drive: { Files: { create: (metadata, blob, fields) => {
      calls.push({ metadata: JSON.parse(JSON.stringify(metadata)), blob, fields: JSON.parse(JSON.stringify(fields)) })
      if (options.failCreate) throw new Error('synthetic lost create response')
      return { id: 'synthetic_file_12345' }
    } } }
  })
  source.forEach(code => vm.runInContext(code, context))
  return {
    ledger, calls, context,
    post: (r = receipt(), credential = token, extra = {}) => context.doPost({
      postData: { type: 'application/json', contents: JSON.stringify({ credential, receipt: r, ...extra }) }, parameters: {}
    })
  }
}

test('cloud: valid create uses only fixed parent and emits only creation acknowledgement', () => {
  const c = cloud(); const r = receipt(); const result = c.post(r)
  assert.deepEqual(result, created(r))
  assert.equal(c.calls.length, 1)
  assert.deepEqual(c.calls[0].metadata.parents, ['1d-DE2eNyq78DnbZspC_UpvExUHke1aFR'])
  assert.deepEqual(c.calls[0].fields, { fields: 'id' })
  assert.equal(c.calls[0].blob.body, Contract.document(r))
  assert.ok(!JSON.stringify(result).includes(r.body))
  assert.ok(!JSON.stringify([...c.ledger.values()].slice(1)).includes(r.body))
})

test('cloud: wrong/missing credentials cannot inspect ledger or create', () => {
  for (const credential of ['b'.repeat(64), '', null, { token }]) {
    const c = cloud(); assert.equal(c.post(receipt(), credential).code, 'UNAUTHORIZED'); assert.equal(c.calls.length, 0)
  }
  const c = cloud(); c.ledger.delete('RECEIPT_TOKEN')
  assert.equal(c.post().code, 'NOT_CONFIGURED'); assert.equal(c.calls.length, 0)
})

test('cloud: arbitrary folder/file/URL/path/operation and envelope extras are rejected', () => {
  for (const key of ['folder_id', 'file_id', 'url', 'path', 'operation', '__proto__']) {
    const c = cloud()
    const r = JSON.parse(JSON.stringify(receipt()).slice(0, -1) + `,"${key}":"forbidden"}`)
    assert.equal(c.post(r).code, 'INVALID_RECEIPT')
    assert.equal(c.post(receipt(), token, { [key]: 'forbidden' }).code, 'INVALID_REQUEST')
    assert.equal(c.calls.length, 0)
  }
})

test('contract: metadata bounds, true calendar validity, four-line body and Unicode length', () => {
  const cases = [
    { time: '2026-02-30T00:00:00+08:00' }, { time: '2026-10-27T25:00:00+08:00' },
    { time: '2026-10-27T22:32:08Z' }, { task: 'x'.repeat(65) }, { task: '../../file' },
    { branch: 'main' }, { branch: 'codex/a/../b' }, { branch: 'codex/' + 'a'.repeat(100) },
    { commit: 'abc' }, { commit: 'NO_CODE_CHANGE' }, { push: 'SUCCESS' },
    { receipt_id: '../file' }, { body: '完成：x\n验证：x\n遗留：x' },
    { body: '完成：\n验证：x\n遗留：x\n下一步：x' }, { body: receipt().body + '\n额外：x' },
    { body: '完成：https://example.com\n验证：x\n遗留：x\n下一步：x' },
    { body: '完成：C:\\secret\n验证：x\n遗留：x\n下一步：x' },
    { body: '完成：/etc/passwd\n验证：x\n遗留：x\n下一步：x' }
  ]
  for (const changes of cases) {
    const r = { ...receipt(), ...changes }; assert.equal(Contract.validate(r), false, JSON.stringify(changes))
    assert.equal(cloud().post(r).code, 'INVALID_RECEIPT')
  }
  const fixed = '完成：\n验证：x\n遗留：x\n下一步：x'
  const r = { ...receipt(), body: fixed.replace('完成：', '完成：' + '😀'.repeat(300 - Array.from(fixed).length)) }
  assert.equal(Contract.validate(r), true)
  assert.equal(cloud().post(r).status, 'CREATED')
  r.body += '字'
  assert.equal(Contract.validate(r), false); assert.equal(cloud().post(r).code, 'INVALID_RECEIPT')
})

test('cloud: same UUID/content is idempotent; different content is rejected', () => {
  const c = cloud(); const r = receipt()
  assert.equal(c.post(r).status, 'CREATED')
  assert.equal(c.post(Object.fromEntries(Object.entries(r).reverse())).status, 'ALREADY_CREATED')
  assert.equal(c.post({ ...r, task: 'different-task' }).code, 'ID_CONFLICT')
  assert.equal(c.calls.length, 1)
})

test('cloud: create failure or completion-ledger failure stays UNKNOWN; retry never creates again', () => {
  for (const options of [{ failCreate: true }, { failCompleted: true }]) {
    const c = cloud(options)
    assert.equal(c.post().status, 'UNKNOWN')
    assert.equal(c.post().status, 'UNKNOWN')
    assert.equal(c.post({ ...receipt(), task: 'different-task' }).code, 'ID_CONFLICT')
    assert.equal(c.calls.length, 1)
  }
})

test('cloud: pending ledger failure is fail-closed, lock contention creates nothing, GET exposes nothing', () => {
  const c = cloud({ failPending: true }); assert.equal(c.post().status, 'UNKNOWN'); assert.equal(c.calls.length, 0)
  const busy = cloud({ busy: true }); assert.equal(busy.post().code, 'BUSY'); assert.equal(busy.calls.length, 0)
  assert.equal(c.context.doGet().code, 'METHOD_NOT_ALLOWED')
  assert.equal(c.context.doPost({ queryString: 'operation=list', postData: { type: 'application/json', contents: '{}' } }).code, 'INVALID_REQUEST')
  assert.equal(c.context.doPost({ postData: { type: 'application/json', contents: 'x'.repeat(8193) } }).code, 'INVALID_REQUEST')
  assert.equal(c.context.doPost({ postData: { type: 'application/json', contents: 'not json' } }).code, 'INVALID_REQUEST')
})

test('client: only fixed HTTPS endpoint; redirect consumes acknowledgement without forwarding credential', async () => {
  const r = receipt(); const calls = []
  const result = await postReceipt(r, { endpoint, token }, async (url, init) => {
    calls.push({ url, init })
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/macros/echo?user_content_key=synthetic' } }) : jsonResponse(created(r))
  })
  assert.deepEqual(result, created(r)); assert.equal(calls.length, 2)
  assert.equal(calls[1].init.method, 'GET'); assert.equal(calls[1].init.body, undefined)
  assert.ok(!JSON.stringify(calls[1]).includes(token))
  let count = 0
  assert.equal((await postReceipt(r, { endpoint: 'https://evil.example/exec', token }, async () => { count++ })).status, 'PENDING_SETUP')
  assert.equal(count, 0)
})

test('client: timeout, HTTP failure, malformed/extra response and unsafe redirect remain UNKNOWN without retries', async () => {
  const responses = [
    () => { throw new Error('SYNTHETIC credential should never appear: ' + token) },
    () => new Response('private provider response', { status: 500 }),
    () => new Response('not JSON', { status: 200 }),
    () => jsonResponse({ ...created(receipt()), body: 'not allowed' }),
    () => jsonResponse({ ...created(receipt()), receipt_id: 'wrong' }),
    () => jsonResponse({ ...created(receipt()), url: 'https://evil.example' }),
    () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }),
    () => new Response(null, { status: 307, headers: { location: endpoint } }),
    () => new Response('x'.repeat(4097), { status: 200 })
  ]
  for (const response of responses) {
    let count = 0
    const result = await postReceipt(receipt(), { endpoint, token }, async () => { count++; return response() })
    assert.equal(result.status, 'UNKNOWN'); assert.equal(count, 1); assert.ok(!JSON.stringify(result).includes(token))
  }
  const c = cloud()
  const rejected = await postReceipt(receipt(), { endpoint, token: 'b'.repeat(64) }, async (_, init) => {
    const request = JSON.parse(init.body); return jsonResponse(c.post(request.receipt, request.credential))
  })
  assert.equal(rejected.status, 'REJECTED'); assert.equal(c.calls.length, 0)
})

async function stateDirectory() {
  const directory = path.join(root, 'output/delivery-receipt/tests')
  await fs.mkdir(directory, { recursive: true })
  return fs.mkdtemp(path.join(directory, 'case-'))
}

test('local: missing configuration saves only a pending receipt, no network/secret', async () => {
  const directory = await stateDirectory(); let requests = 0
  const submit = createSubmitter({ directory, settings: async () => { throw new Error('missing') }, transport: async () => { requests++ } })
  assert.equal((await submit(receipt())).status, 'PENDING_SETUP'); assert.equal(requests, 0)
  const saved = await fs.readFile(path.join(directory, '.delivery-state', receipt().receipt_id + '.json'), 'utf8')
  assert.ok(!saved.includes(token)); assert.equal(JSON.parse(saved).receipt.time, receipt().time)
  assert.equal((await submit({ ...receipt(), task: 'changed' })).code, 'ID_CONFLICT')
})

test('local + cloud: lost HTTP acknowledgement recovers through ledger, no second creation', async () => {
  const c = cloud(); const directory = await stateDirectory(); let count = 0
  const submit = createSubmitter({ directory, settings: async () => ({ endpoint, token }), transport: (r, s) => postReceipt(r, s, async (_, init) => {
    const request = JSON.parse(init.body); const value = c.post(request.receipt, request.credential)
    if (++count === 1) throw new Error('response lost after creation')
    return jsonResponse(value)
  }) })
  assert.equal((await submit(receipt())).status, 'UNKNOWN')
  assert.equal(count, 1)
  assert.equal((await submit(receipt())).status, 'ALREADY_CREATED')
  assert.equal((await submit(receipt())).status, 'ALREADY_CREATED')
  assert.equal(c.calls.length, 1); assert.equal(count, 2)
})

test('local: UNKNOWN survives missing credentials or later authentication failure', async () => {
  const directory = await stateDirectory()
  await createSubmitter({ directory, settings: async () => ({}), transport: async () => { throw new Error('lost') } })(receipt())
  const missing = createSubmitter({ directory, settings: async () => { throw new Error('missing') } })
  assert.equal((await missing(receipt())).status, 'UNKNOWN')
  const denied = createSubmitter({ directory, settings: async () => ({}), transport: async () => ({ status: 'REJECTED', code: 'UNAUTHORIZED' }) })
  assert.equal((await denied(receipt())).status, 'UNKNOWN')
})

test('MCP: exactly one tool; no resources/read/list-file/operation endpoint', async () => {
  const request = (method, params) => ({ jsonrpc: '2.0', id: 1, method, params })
  const list = await dispatch(request('tools/list'))
  assert.deepEqual(list.result.tools.map(t => t.name), ['submit_delivery_receipt'])
  assert.equal(list.result.tools[0].inputSchema.additionalProperties, false)
  let count = 0
  assert.equal((await dispatch(request('tools/call', { name: 'read_file', arguments: {} }), async () => { count++ })).error.code, -32602)
  assert.equal((await dispatch(request('resources/list'))).error.code, -32601)
  assert.equal(count, 0)
  const result = await dispatch(request('tools/call', { name: 'submit_delivery_receipt', arguments: receipt() }), async r => created(r))
  assert.equal(result.result.isError, false)
})

test('MCP: real stdio initialization/discovery and invalid-call transcript', () => {
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'submit_delivery_receipt', arguments: { folder_id: 'forbidden' } } }
  ]
  const run = spawnSync(process.execPath, ['tools/delivery-receipt/mcp.mjs'], { cwd: root, input: requests.map(r => JSON.stringify(r)).join('\n') + '\n', encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0); assert.equal(run.stderr, '')
  const replies = run.stdout.trim().split('\n').map(JSON.parse)
  assert.equal(replies.length, 3); assert.equal(replies[0].result.protocolVersion, '2025-06-18')
  assert.equal(replies[1].result.tools.length, 1); assert.equal(replies[2].result.isError, true)
})

test('original local receipt: preserve UUID/time/commit/body; no folder ID in outbound payload', async () => {
  // Portable fixture with the original delivery metadata; does not require local output history.
  const directory = await stateDirectory()
  const originalId = 'ac516a92-e859-4729-b6b1-16a4a6b63e2e'
  const fixture = { ...receipt(), task: 'workflow-v5-initial-sync', commit: 'a762b862ed4976761d993cca3502fb35f2774272',
    body: '完成：合入 V5。\n验证：原验证记录。\n遗留：未投递。\n下一步：受限通道补发。' }
  await fs.writeFile(path.join(directory, `20261027-test-${originalId}.md`),
    Contract.document(fixture).replace('\n\n', '\ndrive: PENDING_SETUP_NOT_SENT\ndrive_folder_id: 1d-DE2eNyq78DnbZspC_UpvExUHke1aFR\n\n'))
  const original = await loadLocalReceipt(originalId, directory)
  assert.equal(original.time, '2026-10-27T22:32:08+08:00')
  assert.equal(original.commit, 'a762b862ed4976761d993cca3502fb35f2774272')
  assert.equal(original.task, 'workflow-v5-initial-sync')
  assert.equal(Object.hasOwn(original, 'drive_folder_id'), false)
  assert.ok(original.body.startsWith('完成：合入 V5'))
  assert.throws(() => parseLocalReceipt(Contract.document(receipt()).replace('task: workflow-v5-test', 'operation: read')))
  await assert.rejects(() => loadLocalReceipt('../not-a-receipt'))
})
