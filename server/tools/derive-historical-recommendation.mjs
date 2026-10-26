// Trusted server capture input only. No client recommendation JSON, current Draft or read-time evaluation.
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
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(specifier + suffix, context.parentURL)
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
      }
    }
    return nextResolve(specifier, context)
  } })
  let input = ''; process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 1048576) throw new Error('bound') }
  const { captureHistoricalRecommendationV1 } = await import(pathToFileURL(path.join(root, 'domain/assessment-history/recommendation-display.ts')).href)
  process.stdout.write(JSON.stringify(captureHistoricalRecommendationV1(JSON.parse(input))) + '\n')
} catch { process.stdout.write('{"ok":false,"technicalFailure":true}\n'); process.exitCode = 2 }
