// Backend bridge to the exact pure Assessment V2 validator. Never log answers.
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const emit = result => process.stdout.write(JSON.stringify(result) + '\n')
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('runtime')
  const root = process.argv[process.argv.indexOf('--source-root') + 1]
  if (!root || !existsSync(path.join(root, 'assessment-v2.ts'))) throw new Error('source')
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
    if (Buffer.byteLength(input) > 65536) throw new Error('bounded')
  }
  const { validateAssessmentAnswersV2 } = await import(pathToFileURL(path.join(root, 'assessment-v2.ts')).href)
  emit({ valid: validateAssessmentAnswersV2(JSON.parse(input), true).valid, technicalFailure: false })
} catch {
  emit({ valid: false, technicalFailure: true })
  process.exitCode = 2
}
