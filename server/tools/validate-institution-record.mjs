/**
 * Internal publisher validation bridge. The only runtime sources loaded here
 * are the frozen Institution domain validators packaged from miniprogram/.
 * No fixture, page, wx API, or provider is part of this dependency graph.
 *
 * Protocol: stdin {"record": <full server-bound record>}; stdout one JSON
 * validation result. A nonzero exit denotes a technical validation failure.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MIN_NODE_MAJOR = 24
const sourceOption = process.argv.indexOf('--source-root')
const sourceRoot = sourceOption >= 0 && process.argv[sourceOption + 1]
  ? path.resolve(process.argv[sourceOption + 1])
  : null

const emit = (result) => process.stdout.write(`${JSON.stringify(result)}\n`)
const failTechnical = (code) => {
  emit({ valid: false, technicalFailure: true, issues: [{ code, path: '$' }] })
  process.exitCode = 2
}

if (Number(process.versions.node.split('.')[0]) < MIN_NODE_MAJOR) {
  failTechnical('NODE_24_REQUIRED')
} else if (!sourceRoot || !existsSync(path.join(sourceRoot, 'domain', 'institution'))) {
  failTechnical('INSTITUTION_VALIDATOR_SOURCE_MISSING')
} else {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && path.extname(specifier) === '' && context.parentURL) {
        const candidate = new URL(`${specifier}.ts`, context.parentURL)
        if (existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context)
        }
      }
      return nextResolve(specifier, context)
    },
  })

  try {
    let input = ''
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) input += chunk
    const envelope = JSON.parse(input)
    if (typeof envelope?.templateInstitutionId === 'string' && /^[a-z][a-z0-9-]{1,99}$/.test(envelope.templateInstitutionId)) {
      const modulePath = path.join(sourceRoot, 'domain', 'institution', 'v1-2-1', 'unknown-record.ts')
      const { createUnknownProductionRecord } = await import(pathToFileURL(modulePath).href)
      emit({ record: createUnknownProductionRecord(envelope.templateInstitutionId, 1) })
    } else {
    const record = envelope && typeof envelope === 'object' ? envelope.record : null
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      emit({ valid: false, issues: [{ code: 'INVALID_INSTITUTION_RECORD', path: '$' }] })
    } else {
      const version = record.contractVersion
      const entrypoints = {
        'institution-contract-v1': ['validate-institution.ts', 'validateInstitutionRecord'],
        'institution-contract-v1.1': ['v1-1/validate-institution-v1-1.ts', 'validateInstitutionRecordV11'],
        'institution-contract-v1.2': ['v1-2/validate-institution-v1-2.ts', 'validateInstitutionRecordV12'],
        'institution-contract-v1.2.1': ['v1-2-1/validate-institution-v1-2-1.ts', 'validateInstitutionRecordV121'],
      }
      const entrypoint = entrypoints[version]
      if (!entrypoint) {
        emit({ valid: false, issues: [{ code: 'INVALID_CONTRACT_VERSION', path: 'contractVersion' }] })
      } else {
        const modulePath = path.join(sourceRoot, 'domain', 'institution', entrypoint[0])
        const validatorModule = await import(pathToFileURL(modulePath).href)
        let options = {}
        if (version === 'institution-contract-v1.2.1') {
          const divisions = path.join(sourceRoot, 'runtime', 'administrative-divisions.ts')
          if (existsSync(divisions)) options = { administrativeDivisionResolver: (await import(pathToFileURL(divisions).href)).administrativeDivisionResolver }
        }
        const validation = validatorModule[entrypoint[1]](record, options)
        emit(validation.ok
          ? { valid: true, issues: [] }
          : { valid: false, issues: validation.issues.map(({ code, path: issuePath }) => ({ code, path: issuePath })) })
      }
    }
    }
  } catch (_error) {
    // Never print raw records, file contents, source references, or stack traces.
    failTechnical('INSTITUTION_VALIDATOR_RUNTIME_FAILURE')
  }
}
