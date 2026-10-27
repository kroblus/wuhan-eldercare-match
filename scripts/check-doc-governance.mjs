import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const registryRelativePath = 'docs/architecture/DOC_REGISTRY.json'
const registryPath = path.join(repositoryRoot, registryRelativePath)
const failures = []

const validStatuses = new Set(['CURRENT', 'FROZEN', 'SUPERSEDED', 'HISTORICAL', 'UNCERTAIN'])
const validKinds = new Set(['CONTRACT', 'POLICY', 'ROUTER', 'REFERENCE', 'PROPOSAL', 'AUDIT', 'HANDOFF', 'REDIRECT'])
const validNormativeValues = new Set([true, false, 'PHASE_BOUNDARY_ONLY'])

const normalizeRelativePath = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '')
const toAbsolutePath = (relativePath) => path.resolve(repositoryRoot, relativePath)
const isInsideRepository = (absolutePath) => {
  const relative = path.relative(repositoryRoot, absolutePath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

const addFailure = (message) => failures.push(message)

if (!fs.existsSync(registryPath)) {
  console.error(`FAIL: missing registry ${registryRelativePath}`)
  process.exit(1)
}

let registry
try {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
} catch (error) {
  console.error(`FAIL: invalid JSON in ${registryRelativePath}: ${error.message}`)
  process.exit(1)
}

if (!registry || registry.schema_version !== 1 || !Array.isArray(registry.entries)) {
  addFailure('registry must contain schema_version=1 and an entries array')
}

const entries = Array.isArray(registry.entries) ? registry.entries : []
const entriesByPath = new Map()
const seenDocIds = new Set()

for (const [index, entry] of entries.entries()) {
  const label = `entry[${index}]`
  const requiredStringFields = ['path', 'doc_id', 'status', 'kind', 'owner']
  for (const field of requiredStringFields) {
    if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
      addFailure(`${label}.${field} must be a non-empty string`)
    }
  }
  if (!entry || typeof entry !== 'object') {
    continue
  }

  const relativePath = typeof entry.path === 'string' ? normalizeRelativePath(entry.path) : ''
  if (relativePath !== entry.path) {
    addFailure(`${label}.path must use normalized forward slashes: ${entry.path}`)
  }
  if (!validStatuses.has(entry.status)) {
    addFailure(`${label}.status is invalid: ${entry.status}`)
  }
  if (!validKinds.has(entry.kind)) {
    addFailure(`${label}.kind is invalid: ${entry.kind}`)
  }
  if (!validNormativeValues.has(entry.normative)) {
    addFailure(`${label}.normative must be true, false, or PHASE_BOUNDARY_ONLY`)
  }
  if (seenDocIds.has(entry.doc_id)) {
    addFailure(`duplicate doc_id: ${entry.doc_id}`)
  }
  seenDocIds.add(entry.doc_id)
  if (entriesByPath.has(relativePath)) {
    addFailure(`duplicate registry path: ${relativePath}`)
  }
  entriesByPath.set(relativePath, entry)

  const absolutePath = toAbsolutePath(relativePath)
  if (!isInsideRepository(absolutePath) || !fs.existsSync(absolutePath)) {
    addFailure(`registry path does not exist inside repository: ${relativePath}`)
  }
  if (relativePath.startsWith('docs/archive/') && entry.status === 'CURRENT') {
    addFailure(`archive entry cannot be CURRENT: ${relativePath}`)
  }

  for (const field of ['superseded_by', 'archive_target']) {
    const target = entry[field]
    if (target !== null && target !== undefined) {
      if (typeof target !== 'string' || target.trim() === '') {
        addFailure(`${relativePath}.${field} must be null or a non-empty path`)
        continue
      }
      const normalizedTarget = normalizeRelativePath(target)
      const absoluteTarget = toAbsolutePath(normalizedTarget)
      if (!isInsideRepository(absoluteTarget) || !fs.existsSync(absoluteTarget)) {
        addFailure(`${relativePath}.${field} cannot be resolved: ${target}`)
      }
    }
  }

  if (entry.kind === 'REDIRECT' && fs.existsSync(absolutePath)) {
    if (!entry.archive_target) {
      addFailure(`redirect must define archive_target: ${relativePath}`)
    } else {
      const text = fs.readFileSync(absolutePath, 'utf8')
      const requiredMarkers = [
        `DOC_STATUS = ${entry.status}`,
        'DOC_KIND = REDIRECT',
        'NORMATIVE = FALSE',
        `ARCHIVED_AT = \`${entry.archive_target}\``
      ]
      for (const marker of requiredMarkers) {
        if (!text.includes(marker)) {
          addFailure(`redirect ${relativePath} is missing marker: ${marker}`)
        }
      }
    }
  }
}

const listFiles = (directory, predicate) => {
  if (!fs.existsSync(directory)) {
    return []
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const absolutePath = path.join(directory, item.name)
    if (item.isDirectory()) {
      return listFiles(absolutePath, predicate)
    }
    return predicate(absolutePath) ? [absolutePath] : []
  })
}

const activeMarkdownFiles = [
  path.join(repositoryRoot, 'README.md'),
  ...listFiles(path.join(repositoryRoot, 'docs', 'architecture'), (file) => file.endsWith('.md')),
  ...listFiles(path.join(repositoryRoot, 'docs', 'agent'), (file) => file.endsWith('.md')),
  ...fs.readdirSync(path.join(repositoryRoot, 'docs', 'product'), { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.endsWith('.md'))
    .map((item) => path.join(repositoryRoot, 'docs', 'product', item.name))
]

for (const absolutePath of activeMarkdownFiles) {
  const relativePath = normalizeRelativePath(path.relative(repositoryRoot, absolutePath))
  const entry = entriesByPath.get(relativePath)
  if (!entry) {
    addFailure(`active Markdown is not registered: ${relativePath}`)
    continue
  }
  const filename = path.basename(relativePath)
  const isLifecycleDocument = /(PROPOSAL|AUDIT|MIGRATION_PLAN)/i.test(filename)
  if (isLifecycleDocument && fs.statSync(absolutePath).size > 2048
      && !['CURRENT', 'FROZEN'].includes(entry.status)) {
    addFailure(`large lifecycle document must not remain active: ${relativePath}`)
  }
}

for (const entry of entries) {
  if (!['CURRENT', 'FROZEN'].includes(entry.status)) {
    continue
  }
  if (entry.path.startsWith('docs/archive/')) {
    addFailure(`CURRENT/FROZEN document cannot live in archive: ${entry.path}`)
  }
  if (!entriesByPath.has(normalizeRelativePath(entry.path))) {
    addFailure(`CURRENT/FROZEN document is not registered: ${entry.path}`)
  }
}

const referenceCandidates = (sourceRelativePath, rawReference) => {
  const reference = normalizeRelativePath(rawReference.trim().replace(/[?#].*$/, ''))
  const sourceDirectory = path.posix.dirname(sourceRelativePath)
  const candidates = reference.startsWith('docs/') || reference === 'AGENTS.md' || reference === 'package.json'
    ? [reference]
    : [
        path.posix.join(sourceDirectory, reference),
        reference,
        path.posix.join('docs/architecture', reference),
        path.posix.join('docs/agent', reference),
        path.posix.join('docs/product', reference),
        path.posix.join('docs/design', reference)
      ]
  return [...new Set(candidates.map(normalizeRelativePath))]
}

const resolveReference = (sourceRelativePath, rawReference) => {
  for (const candidate of referenceCandidates(sourceRelativePath, rawReference)) {
    const absolutePath = toAbsolutePath(candidate)
    if (isInsideRepository(absolutePath) && fs.existsSync(absolutePath)) {
      return candidate
    }
  }
  return null
}

const extractDocumentReferences = (text) => {
  const references = new Set()
  const patterns = [
    /\]\(([^)]+?\.(?:md|json))(?:#[^)]+)?\)/gi,
    /`([^`\r\n]+?\.(?:md|json))`/gi
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      references.add(match[1])
    }
  }
  return [...references]
}

for (const absolutePath of activeMarkdownFiles) {
  const sourceRelativePath = normalizeRelativePath(path.relative(repositoryRoot, absolutePath))
  const text = fs.readFileSync(absolutePath, 'utf8')
  for (const reference of extractDocumentReferences(text)) {
    if (!resolveReference(sourceRelativePath, reference)) {
      addFailure(`unresolved document reference in ${sourceRelativePath}: ${reference}`)
    }
  }
}

const contractIndexPath = path.join(repositoryRoot, 'docs', 'architecture', 'CONTRACT_INDEX.md')
if (fs.existsSync(contractIndexPath)) {
  const indexText = fs.readFileSync(contractIndexPath, 'utf8')
  const tableText = indexText.split('Defaults:')[0]
  for (const line of tableText.split(/\r?\n/)) {
    if (!line.startsWith('|') || /^\|[-:| ]+\|$/.test(line)) {
      continue
    }
    const columns = line.split('|').map((value) => value.trim())
    const primarySource = columns[2] || ''
    if (primarySource === 'Primary source') {
      continue
    }
    for (const reference of extractDocumentReferences(primarySource)) {
      const resolved = resolveReference('docs/architecture/CONTRACT_INDEX.md', reference)
      if (!resolved) {
        addFailure(`CONTRACT_INDEX Primary source cannot be resolved: ${reference}`)
        continue
      }
      const targetEntry = entriesByPath.get(resolved)
      if (!targetEntry || !['CURRENT', 'FROZEN'].includes(targetEntry.status)) {
        addFailure(`CONTRACT_INDEX Primary source must be CURRENT/FROZEN: ${reference}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation governance check failed with ${failures.length} issue(s):`)
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Documentation governance check passed: ${entries.length} registry entries, ${activeMarkdownFiles.length} active Markdown files.`)
