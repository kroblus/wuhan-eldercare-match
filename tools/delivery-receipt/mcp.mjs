import { Contract, submitDeliveryReceipt } from './client.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const tool = {
  name: 'submit_delivery_receipt',
  description: 'Submit one short project delivery receipt to the fixed cloud inbox. Reuse its original UUID/time/commit on retry. UNKNOWN is not delivery success. No Drive reads or file management.',
  inputSchema: Contract.schema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}

export async function dispatch(request, submit = submitDeliveryReceipt) {
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }
  }
  if (request.id === undefined) return null
  const reply = value => ({ jsonrpc: '2.0', id: request.id, result: value })
  const error = (code, message) => ({ jsonrpc: '2.0', id: request.id, error: { code, message } })
  if (request.method === 'initialize') return reply({
    protocolVersion: '2025-06-18', capabilities: { tools: {} },
    serverInfo: { name: 'wuhan-delivery-receipt', version: '1.0.0' }
  })
  if (request.method === 'ping') return reply({})
  if (request.method === 'tools/list') return reply({ tools: [tool] })
  if (request.method !== 'tools/call') return error(-32601, 'Method not found')
  if (!Contract.exact(request.params, ['name', 'arguments']) || request.params.name !== tool.name) {
    return error(-32602, 'Only submit_delivery_receipt is available')
  }
  const result = await submit(request.params.arguments)
  return reply({ content: [{ type: 'text', text: JSON.stringify(result) }],
    isError: !['CREATED', 'ALREADY_CREATED'].includes(result.status) })
}

// MCP stdio is newline-delimited JSON-RPC. Bound messages before parsing.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.stdin.setEncoding('utf8')
  let buffer = ''
  let chain = Promise.resolve()
  const output = value => { if (value) process.stdout.write(JSON.stringify(value) + '\n') }
  process.stdin.on('data', chunk => {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      chain = chain.then(async () => {
        if (Buffer.byteLength(line) > 16384) return output({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large' } })
        let request
        try { request = JSON.parse(line) } catch (_) {
          return output({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
        }
        output(await dispatch(request))
      }).catch(() => output({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }))
    }
    if (Buffer.byteLength(buffer) > 16384) process.exit(1)
  })
}
