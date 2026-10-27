import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Contract, outbox, submitDeliveryReceipt } from './client.mjs'

export function parseLocalReceipt(text) {
  const parts = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd().split('\n\n')
  if (parts.length !== 2) throw new Error('INVALID_LOCAL_RECEIPT')
  const receipt = {}
  const seen = new Set()
  for (const line of parts[0].split('\n')) {
    const match = /^([a-z_]+): (.+)$/.exec(line)
    if (!match || seen.has(match[1])) throw new Error('INVALID_LOCAL_RECEIPT')
    const [, key, value] = match
    seen.add(key)
    if (['receipt_id', 'time', 'task', 'branch', 'commit', 'push'].includes(key)) receipt[key] = value
    else if (key === 'drive_folder_id' && value === '1d-DE2eNyq78DnbZspC_UpvExUHke1aFR') continue
    else if (key === 'drive' && ['PENDING_SETUP_NOT_SENT', 'UNKNOWN', 'NOT_SENT'].includes(value)) continue
    else throw new Error('INVALID_LOCAL_RECEIPT')
  }
  receipt.body = parts[1]
  if (!Contract.validate(receipt)) throw new Error('INVALID_LOCAL_RECEIPT')
  return receipt
}

export async function loadLocalReceipt(id, directory = outbox) {
  if (!new RegExp(Contract.schema.properties.receipt_id.pattern).test(id || '')) throw new Error('INVALID_RECEIPT_ID')
  const files = (await fs.readdir(directory)).filter(name => name.endsWith(`-${id}.md`))
  if (files.length !== 1) throw new Error('RECEIPT_NOT_UNIQUE')
  const receipt = parseLocalReceipt(await fs.readFile(path.join(directory, files[0]), 'utf8'))
  if (receipt.receipt_id !== id) throw new Error('RECEIPT_ID_MISMATCH')
  return receipt
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 3) throw new Error('RECEIPT_ID_REQUIRED')
    const result = await submitDeliveryReceipt(await loadLocalReceipt(process.argv[2]))
    process.stdout.write(JSON.stringify(result) + '\n')
    if (!['CREATED', 'ALREADY_CREATED'].includes(result.status)) process.exitCode = 1
  } catch (_) {
    process.stderr.write('Local receipt is missing, ambiguous, invalid, or inaccessible; nothing submitted.\n')
    process.exitCode = 1
  }
}
