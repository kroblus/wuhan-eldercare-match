// Bounded, pure, save-time projection. No current Draft or Recommendation data.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('runtime')
  const root = process.argv[process.argv.indexOf('--source-root') + 1]
  if (!root) throw new Error('source')
  registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL) {
      const candidate = new URL(specifier + '.ts', context.parentURL)
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
    }
    return nextResolve(specifier, context)
  } })
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    input += chunk
    if (Buffer.byteLength(input) > 131072) throw new Error('bounded')
  }
  const { deriveHistoricalProfileDisplayV1 } = await import(pathToFileURL(path.join(root, 'domain/assessment-history/profile-display.ts')).href)
  const result = deriveHistoricalProfileDisplayV1(JSON.parse(input))
  process.stdout.write(JSON.stringify(result) + '\n')
} catch {
  process.stdout.write('{"ok":false,"technicalFailure":true}\n')
  process.exitCode = 2
}
