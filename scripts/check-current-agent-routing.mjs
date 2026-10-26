/**
 * R03-A only: explicit current entry/reference/authority checks.
 * No recursive document scan, writes, subprocesses or dependencies.
 * Natural-language precedence and arbitrary conditional instructions still
 * require human review; the imperative detector below is deliberately bounded.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const architecture = 'docs/architecture/'
const skills = ['wechat-interaction', 'wechat-runtime-compat', 'recommendation-v2']
const skillPaths = skills.map((name) => '.agents/skills/' + name + '/SKILL.md')
const P = {
  agents: 'AGENTS.md',
  index: architecture + 'CONTRACT_INDEX.md',
  readme: architecture + 'README.md',
  engineering: 'docs/agent/README_AGENT_ENGINEERING_V2_1.md',
  registry: architecture + 'DOC_REGISTRY.json',
  v1: architecture + 'WECHAT_INTERACTION_CONTRACT.md',
  v2: architecture + 'WECHAT_INTERACTION_CONTRACT_V2.md',
  b01: architecture + 'WECHAT_INTERACTION_B01_PHASE_BOUNDARY_D_SUCCESSOR_V1.md',
  profile: architecture + 'PROFILE_UI_V2_INTEGRATION_CONTRACT.md',
  profileB01: architecture + 'PROFILE_UI_V2_B01_PHASE_BOUNDARY_D_INTEGRATION_CONTRACT_V1.md',
  routes: architecture + 'ROUTES.md',
  structure: architecture + 'FRONTEND_STRUCTURE.md',
  closeout: 'output/b01-phase-boundary-d-scope-a-implementation-v1/FINAL_CLOSEOUT.md',
}
const entries = [P.agents, ...skillPaths, P.index, P.readme, P.engineering]
const b01Targets = [P.v2, P.b01, P.profile, P.profileB01, P.routes, P.structure, P.closeout]
const b01Only = new Set([P.b01, P.profileB01, P.closeout])
const expectedCloseout = {
  DOC_KIND: 'AUDIT',
  NORMATIVE: 'FALSE',
  B01_SCOPE_A_IMPLEMENTATION: 'COMPLETE',
  B01_SCOPE_A_FINAL_CLOSEOUT: 'CLOSED_WITH_RISKS',
  B01_SCOPE_B: 'DEFERRED_NOT_VERIFIED',
  GLOBAL_NAVIGATION_PASS: 'FALSE',
  SUCCESSOR_ACTIVATED: 'FALSE',
  PRODUCTION_RELEASE_READY: 'FALSE',
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const references = (text) => [...new Set([
  ...Array.from(text.matchAll(/\x60([^\x60\r\n]+?\.md)\x60/g), (m) => m[1]),
  ...Array.from(text.matchAll(/\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g), (m) => m[1]),
])]

const candidates = (source, reference) => {
  if (/^[a-z]+:|^[\\/]/i.test(reference)) return []
  const ref = reference.replaceAll('\\', '/')
  const rooted = /^(?:docs|output|\.agents)\//.test(ref) || ref === P.agents
  return [...new Set((rooted ? [ref] : [
    path.posix.join(path.posix.dirname(source), ref),
    ref,
    architecture + ref,
    'docs/agent/' + ref,
    'docs/product/' + ref,
  ]).map((p) => path.posix.normalize(p)))]
    .filter((p) => p !== '..' && !p.startsWith('../') && !path.posix.isAbsolute(p))
}

const resolve = (input, source, reference) =>
  candidates(source, reference).find((p) => input.available.has(p))
const refSet = (input, source, text) =>
  new Set(references(text).map((ref) => resolve(input, source, ref)).filter(Boolean))
const paragraphs = (text) => text.split(/\r?\n\s*\r?\n/)

// A bullet can wrap across lines; no exact paragraph, line number or title match.
const bulletBlocks = (text) => Array.from(
  text.matchAll(/^\s*[-*] [^\r\n]*(?:\r?\n(?!\s*[-*] |#|\s*$)[^\r\n]+)*/gm), (m) => m[0],
)
const commonSkillText = (text) => text.split(/^\s*[-*] /m)[0]
const b01Section = (text) => {
  const sections = Array.from(text.matchAll(/^## (.+)\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/gm))
  return sections.find((m) => /\bB01\b.*Scope\s*A/i.test(m[1]))
}
const primaryCells = (text) => text.split(/\r?\n/)
  .filter((line) => /^\|/.test(line) && !/^\|[-:| ]+\|$/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  .filter((cells) => cells.length === 3 && cells[1] !== 'Primary source')

const assignments = (text) => {
  const result = new Map()
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*([A-Z][A-Z0-9_]*|\d{4}-\d{2}-\d{2})\b/g)) {
    const values = result.get(m[1]) || new Set()
    values.add(m[2])
    result.set(m[1], values)
  }
  return result
}
const iniHeader = (text) => (text.match(/^\x60{3}ini\s*\r?\n([\s\S]*?)^\x60{3}/m) || [])[1] || ''
const isNegative = (text) => /\b(?:do not|must not|never)\b|不要|不得|禁止|不应|不需要|不是|不再/i.test(text)
const isConditional = (text) => /\b(?:if|when|only|unless|relevant|affected)\b|按需|仅当|只有|相关|触发|若|时/i.test(text)
const isDirective = (text) => /\b(?:read|load|use|must|required|always)\b|必读|加载|读取|必须/i.test(text)

const disclosureIssues = (input) => {
  const issues = []
  const graph = new Map(skillPaths.map((p) => [p, new Set()]))
  for (const source of entries) {
    for (const line of (input.texts.get(source) || '').split(/\r?\n/)) {
      if (!isDirective(line) || isNegative(line)) continue
      const allTasks = /\b(?:all|every)\s+(?:Codex\s+|WeChat\s+)?(?:tasks?|interaction tasks?)\b|所有.*任务|每个.*任务/i.test(line)
      const global = allTasks || /\b(?:always|unconditionally|by default)\b|无条件|默认.*(?:读取|加载)/i.test(line)
      const lineRefs = refSet(input, source, line)
      const bulkTarget = /CONTRACT_INDEX|\bB01\b.*(?:reports?|history|historical)|(?:all|every|全部|所有).*(?:Frozen|Contract)/i.test(line)
        || [...b01Only].some((p) => lineRefs.has(p))
      if (global && bulkTarget && !isConditional(line)) issues.push('UNCONDITIONAL_BULK_LOAD: ' + source)
      if (/(?:all|every|所有|全部).*(?:skills?|Skill).*(?:each other|(?:all|every|全部|所有).*skills?|互相|彼此)/i.test(line)
        && !isConditional(line)) {
        issues.push('UNCONDITIONAL_SKILLS: ' + source)
      }
      if (graph.has(source) && !isConditional(line)) {
        skills.forEach((name, index) => {
          if (line.includes(name) || refSet(input, source, line).has(skillPaths[index])) {
            graph.get(source).add(skillPaths[index])
          }
        })
      }
    }
  }
  const visited = new Set()
  const active = new Set()
  const visit = (source) => {
    if (active.has(source)) return true
    if (visited.has(source)) return false
    active.add(source)
    for (const target of graph.get(source)) if (visit(target)) return true
    active.delete(source)
    visited.add(source)
    return false
  }
  if (skillPaths.some(visit)) issues.push('MANDATORY_SKILL_CYCLE')
  return issues
}

/**
 * Pure checker: fixtures can remove/change texts, availability or authority
 * metadata without touching the worktree. "general" ignores the optional B01
 * branch; the normal CLI checks all R03-A routes.
 */
export const checkRouting = (input, scope = 'all') => {
  const errors = []
  const need = (condition, code) => { if (!condition) errors.push(code) }
  const text = (p) => input.texts.get(p) || ''
  const state = (p) => input.registry.get(p)
  const hasRefs = (source, block, targets) => targets.every((p) => refSet(input, source, block).has(p))
  for (const p of entries) {
    need(input.available.has(p) && text(p).trim().length > 0 && !p.startsWith('docs/archive/'), 'ENTRY_MISSING: ' + p)
  }
  for (const p of [P.index, P.readme, P.engineering]) need(state(p)?.status === 'CURRENT', 'CURRENT_AUTHORITY: ' + p)
  for (const [index, p] of skillPaths.entries()) {
    const frontmatter = (text(p).match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || ''
    need(new RegExp('^name:\\s*' + skills[index] + '\\s*$', 'm').test(frontmatter)
      && /^description:\s*\S.+/m.test(frontmatter), 'SKILL_ENTRY: ' + p)
  }
  for (const source of entries) {
    for (const reference of references(text(source))) {
      // Optional B01 branches are not prerequisites for a general task.
      if (scope === 'general' && candidates(source, reference).some((p) => b01Only.has(p))) continue
      need(Boolean(resolve(input, source, reference)), 'REFERENCE_MISSING: ' + source + ' -> ' + reference)
    }
  }
  need(state(P.v1)?.status === 'SUPERSEDED' && state(P.v1)?.superseded_by === P.v2
    && state(P.v1)?.normative === false && input.available.has(P.v1), 'LEGACY_AUTHORITY')
  need(state(P.v2)?.status === 'FROZEN' && state(P.v2)?.normative === true
    && input.available.has(P.v2), 'CURRENT_V2_AUTHORITY')

  const interaction = skillPaths[0]
  const common = refSet(input, interaction, commonSkillText(text(interaction)))
  need(common.has(P.v2) && !common.has(P.v1), 'GENERAL_INTERACTION_ROUTE')
  need(![...b01Only].some((p) => common.has(p)), 'GENERAL_REQUIRES_B01')
  need(primaryCells(text(P.index)).some((cells) => /Assessment.*(?:actions|navigation)/i.test(cells[0])
    && hasRefs(P.index, cells[1], [P.v2]) && !refSet(input, P.index, cells[1]).has(P.v1)), 'INDEX_GENERAL_V2_ROUTE')
  for (const cells of primaryCells(text(P.index))) {
    for (const p of refSet(input, P.index, cells[1])) {
      if (scope === 'general' && b01Only.has(p)) continue
      need(['CURRENT', 'FROZEN'].includes(state(p)?.status), 'PRIMARY_AUTHORITY: ' + p)
    }
  }
  for (const source of [interaction, P.index]) {
    need(paragraphs(text(source)).some((block) => hasRefs(source, block, [P.v1])
      && /\bSUPERSEDED\b/.test(block)), 'LEGACY_ROUTING_NOTICE: ' + source)
  }
  for (const source of [P.agents, P.index, P.readme, P.engineering, interaction]) {
    need(text(source).split(/\r?\n/).some((line) => /CONTRACT_INDEX|Contract Index/i.test(line)
      && /fallback|不要默认|不是.*默认|不再.*必读/i.test(line)), 'FALLBACK_GUARD: ' + source)
  }
  errors.push(...disclosureIssues(input))

  if (scope !== 'general') {
    // Explicit status declarations in current entrypoints must not contradict
    // the linked closeout. Free-form prose/inference remains a manual check.
    for (const source of entries) {
      const declared = assignments(text(source))
      for (const [key, expected] of Object.entries(expectedCloseout)) {
        if (['DOC_KIND', 'NORMATIVE'].includes(key) || !declared.has(key)) continue
        need(declared.get(key).size === 1 && declared.get(key).has(expected), 'CURRENT_DECLARATION: ' + source + ':' + key)
      }
    }
    for (const p of b01Targets) need(input.available.has(p), 'B01_TARGET_MISSING: ' + p)
    for (const p of [P.routes, P.structure]) need(state(p)?.status === 'CURRENT', 'CURRENT_STRUCTURE_AUTHORITY: ' + p)
    need(bulletBlocks(text(interaction)).some((block) =>
      hasRefs(interaction, block, [P.b01, P.closeout, P.routes, P.structure])
      && /\bB01\b/.test(block)), 'SKILL_B01_ROUTE')
    need(bulletBlocks(text(interaction)).some((block) =>
      hasRefs(interaction, block, [P.profile, P.profileB01]) && isConditional(block)), 'SKILL_PROFILE_ROUTE')
    need(state(P.profile)?.status === 'FROZEN', 'PROFILE_AUTHORITY')
    const section = b01Section(text(P.index))
    need(Boolean(section) && hasRefs(P.index, section?.[2] || '', b01Targets), 'INDEX_B01_ROUTE')
    const closeoutHeader = iniHeader(text(P.closeout))
    const facts = assignments(closeoutHeader)
    for (const [key, expected] of Object.entries(expectedCloseout)) {
      need(facts.get(key)?.size === 1 && facts.get(key).has(expected), 'CLOSEOUT_FACT: ' + key)
    }
    const currentFacts = assignments(section?.[2] || '')
    for (const key of Object.keys(expectedCloseout).filter((key) => !['DOC_KIND', 'NORMATIVE'].includes(key))) {
      need(currentFacts.get(key)?.size === 1 && currentFacts.get(key).has(expectedCloseout[key]), 'CURRENT_FACT: ' + key)
    }
    const date = (closeoutHeader.match(/^CLOSEOUT_DATE\s*=\s*(\d{4}-\d{2}-\d{2})\s*$/m) || [])[1]
    need(Boolean(date) && section?.[1].includes(date), 'CLOSEOUT_DATE_ROUTE')
    for (const [p, predecessor] of [[P.b01, P.v2], [P.profileB01, P.profile]]) {
      const entry = state(p)
      need(entry?.status === 'FROZEN' && entry?.normative === true && entry?.signed_scope === 'A' && entry?.excluded_scope === 'B'
        && entry?.runtime_activation === false && entry?.scoped_predecessors?.includes(predecessor), 'SIGNED_BOUNDARY: ' + p)
      const headerFacts = assignments(iniHeader(text(p)))
      for (const [key, expected] of Object.entries({ SIGNED_SCOPE: 'A', EXCLUDED_SCOPE: 'B', RUNTIME_ACTIVATION: 'FALSE' })) {
        need(headerFacts.get(key)?.size === 1 && headerFacts.get(key).has(expected), 'SIGNED_HEADER: ' + p + ':' + key)
      }
    }
  }
  return [...new Set(errors)]
}

const loadInput = () => {
  const input = { texts: new Map(), available: new Set(), registry: new Map() }
  const readable = (p) => {
    try {
      const absolute = path.join(root, p)
      const stat = fs.statSync(absolute)
      if (!stat.isFile() || stat.size === 0) return false
      fs.accessSync(absolute, fs.constants.R_OK)
      input.available.add(p)
      return true
    } catch { return false }
  }
  for (const p of [...entries, P.registry, P.closeout]) {
    if (readable(p)) input.texts.set(p, fs.readFileSync(path.join(root, p), 'utf8'))
  }
  const registry = JSON.parse(input.texts.get(P.registry) || '{}')
  if (!Array.isArray(registry.entries)) throw new Error('REGISTRY_UNREADABLE_OR_INVALID')
  input.registry = new Map(registry.entries.map((entry) => [entry.path, entry]))
  for (const p of b01Targets) readable(p)
  for (const p of [P.b01, P.profileB01]) {
    if (!input.available.has(p)) continue
    // Only signed header metadata; no full Frozen semantics/body scan.
    const fd = fs.openSync(path.join(root, p), 'r')
    try {
      const buffer = Buffer.alloc(16384)
      const count = fs.readSync(fd, buffer, 0, buffer.length, 0)
      input.texts.set(p, buffer.toString('utf8', 0, count))
    } finally { fs.closeSync(fd) }
  }
  for (const source of entries) {
    for (const reference of references(input.texts.get(source) || '')) {
      for (const candidate of candidates(source, reference)) if (readable(candidate)) break
    }
  }
  return input
}

const copyInput = (input) => ({
  texts: new Map(input.texts),
  available: new Set(input.available),
  registry: new Map([...input.registry].map(([p, entry]) => [p, structuredClone(entry)])),
})
const editText = (input, p, before, after) => {
  assert.ok(input.texts.get(p).includes(before), 'fixture mutation target absent: ' + p)
  input.texts.set(p, input.texts.get(p).replaceAll(before, after))
}

const selfTest = (baseline) => {
  const cases = []
  const run = (name, mutation, expectedCode = null, scope = 'all') => {
    const input = copyInput(baseline)
    mutation(input)
    const errors = checkRouting(input, scope)
    if (expectedCode) assert.ok(errors.some((error) => error.startsWith(expectedCode)), name + ': expected ' + expectedCode)
    else assert.deepEqual(errors, [], name)
    cases.push(name)
  }
  run('current entries', () => {})
  for (const p of entries) run('missing entry ' + p, (i) => { i.available.delete(p); i.texts.delete(p) }, 'ENTRY_MISSING')
  run('missing required V2 path', (i) => i.available.delete(P.v2), 'REFERENCE_MISSING')
  run('missing Closeout evidence', (i) => { i.available.delete(P.closeout); i.texts.delete(P.closeout) }, 'CLOSEOUT_FACT')
  run('broken Skill Closeout edge', (i) => editText(i, skillPaths[0], P.closeout, 'output/TEST_ONLY_MISSING.md'), 'SKILL_B01_ROUTE')
  run('broken index Closeout edge', (i) => editText(i, P.index, '../../' + P.closeout, '../../output/TEST_ONLY_MISSING.md'), 'INDEX_B01_ROUTE')
  run('non-B01 independence', (i) => {
    for (const p of b01Only) { i.available.delete(p); i.texts.delete(p); i.registry.delete(p) }
  }, null, 'general')
  run('V1 incorrectly promoted in Registry', (i) => { i.registry.get(P.v1).status = 'FROZEN' }, 'LEGACY_AUTHORITY')
  run('V1 replacing general V2 route', (i) => editText(i, skillPaths[0], P.v2, P.v1), 'GENERAL_INTERACTION_ROUTE')
  run('historical V1 citation remains legal', (i) => {
    i.texts.set(P.engineering, i.texts.get(P.engineering) + '\nHistorical reference: ' + String.fromCharCode(96) + P.v1 + String.fromCharCode(96) + '.\n')
  })
  run('Scope B false acceptance in current index', (i) => editText(i, P.index, 'B01_SCOPE_B=DEFERRED_NOT_VERIFIED', 'B01_SCOPE_B=PASS'), 'CURRENT_FACT')
  run('Scope B false acceptance in authoritative header', (i) => {
    i.texts.set(P.closeout, i.texts.get(P.closeout).replace(/B01_SCOPE_B\s*=\s*DEFERRED_NOT_VERIFIED/, 'B01_SCOPE_B = PASS'))
  }, 'CLOSEOUT_FACT')
  run('history cannot rescue missing Closeout header', (i) => {
    const original = i.texts.get(P.closeout)
    i.texts.set(P.closeout, original.replace(/B01_SCOPE_A_FINAL_CLOSEOUT\s*=\s*CLOSED_WITH_RISKS/, 'B01_SCOPE_A_FINAL_CLOSEOUT = PENDING')
      + '\nHistorical note: B01_SCOPE_A_FINAL_CLOSEOUT = CLOSED_WITH_RISKS\n')
  }, 'CLOSEOUT_FACT')
  run('activation must remain independent', (i) => editText(i, P.index, 'SUCCESSOR_ACTIVATED=FALSE', 'SUCCESSOR_ACTIVATED=TRUE'), 'CURRENT_FACT')
  run('Skill cannot declare successor activated', (i) =>
    editText(i, skillPaths[0], 'SUCCESSOR_ACTIVATED=FALSE', 'SUCCESSOR_ACTIVATED=TRUE'), 'CURRENT_DECLARATION')
  run('Skill cannot explicitly accept Scope B', (i) => {
    i.texts.set(skillPaths[0], i.texts.get(skillPaths[0]) + '\nB01_SCOPE_B=PASS\n')
  }, 'CURRENT_DECLARATION')
  run('V2 incorrectly demoted in Registry', (i) => { i.registry.get(P.v2).status = 'SUPERSEDED' }, 'CURRENT_V2_AUTHORITY')
  run('signed activation cannot be changed', (i) => { i.registry.get(P.b01).runtime_activation = true }, 'SIGNED_BOUNDARY')
  run('CURRENT structure cannot be replaced by history', (i) => { i.registry.get(P.routes).status = 'HISTORICAL' }, 'CURRENT_STRUCTURE_AUTHORITY')
  run('Closeout cannot become a default prerequisite', (i) => {
    i.texts.set(skillPaths[0], i.texts.get(skillPaths[0]) + '\nAlways read ' + String.fromCharCode(96) + P.closeout + String.fromCharCode(96) + '.\n')
  }, 'UNCONDITIONAL_BULK_LOAD')
  run('Profile conditional edge lost', (i) => editText(i, skillPaths[0], P.profileB01, P.profile), 'SKILL_PROFILE_ROUTE')
  run('explicit mandatory Skill cycle', (i) => {
    i.texts.set(skillPaths[1], i.texts.get(skillPaths[1]) + '\nMust load wechat-interaction.\n')
    i.texts.set(skillPaths[0], i.texts.get(skillPaths[0]) + '\nMust load wechat-runtime-compat.\n')
  }, 'MANDATORY_SKILL_CYCLE')
  for (const directive of [
    'Every Codex task must read CONTRACT_INDEX.md.',
    'All interaction tasks must load all B01 historical reports.',
    'Every task must load all Frozen Contracts.',
    'All skills must load each other.',
  ]) {
    run('bulk directive ' + directive, (i) => i.texts.set(P.agents, i.texts.get(P.agents) + '\n' + directive + '\n'),
      directive.includes('skills') ? 'UNCONDITIONAL_SKILLS' : 'UNCONDITIONAL_BULK_LOAD')
  }
  // Formatting changes do not change path/metadata semantics.
  run('whitespace reflow', (i) => {
    for (const p of entries) i.texts.set(p, i.texts.get(p).replace(/\r?\n/g, '\r\n'))
    i.texts.set(P.closeout, i.texts.get(P.closeout).replace(/ = /g, '   =   '))
  })
  return cases.length
}

const main = () => {
  const start = performance.now()
  const input = loadInput()
  const errors = checkRouting(input)
  if (errors.length) throw new Error(errors.join('\n'))
  const cases = selfTest(input)
  console.log('R03_A_CURRENT_ENTRY_COVERAGE = PASS')
  console.log('R01_ROUTE_REGRESSION = PASS')
  console.log('R02_ROUTE_REGRESSION = PASS')
  console.log('B01_CLOSEOUT_ROUTE = PASS')
  console.log('PROFILE_INTEGRATION_ROUTE = PASS')
  console.log('LEGACY_V1_HANDLING = PASS')
  console.log('PROGRESSIVE_DISCLOSURE = PASS (explicit guards/directives and mandatory Skill graph only)')
  console.log('NEGATIVE_FIXTURE_CHECKS = PASS (' + cases + ' TEST_ONLY in-memory cases, including positive controls)')
  console.log('MANUAL_REVIEW_REQUIRED = natural-language precedence/conditional intent and full Agent behavior; not machine-proven')
  console.log('R03_B_UI_DEVELOPMENT_COVERAGE = DEFERRED')
  console.log('R03_C_TOML_PROMPT_COVERAGE = DEFERRED')
  console.log('CURRENT_ROUTING_GATE = PASS (' + input.texts.size + ' entry/evidence/header reads; '
    + input.available.size + ' explicit paths; ' + Math.round(performance.now() - start) + ' ms)')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) {
    console.error('CURRENT_ROUTING_GATE = FAIL\n' + (error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}
