/**
 * Phase V1.2-A0-3 interaction gate.
 *
 * This is intentionally a small source-level harness.  It verifies the
 * physical-action contract at the Page/WXML boundary without booting wx or
 * pretending that the A0-4 navigation gate has been released.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const institutionRoot = path.join(appRoot, 'pages', 'institution')
const homeRoot = path.join(appRoot, 'pages', 'home')

const read = (file) => readFileSync(file, 'utf8')
const listTs = read(path.join(institutionRoot, 'index.ts'))
const listWxml = read(path.join(institutionRoot, 'index.wxml'))
const detailTs = read(path.join(institutionRoot, 'detail.ts'))
const detailWxml = read(path.join(institutionRoot, 'detail.wxml'))
const homeTs = read(path.join(homeRoot, 'index.ts'))
const homeWxml = read(path.join(homeRoot, 'index.wxml'))

const functionBody = (source, name) => {
  const start = source.indexOf(`${name}(`)
  if (start < 0) return ''
  const open = source.indexOf('{', start)
  if (open < 0) return ''
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, index + 1)
    }
  }
  return source.slice(open)
}

const failures = []
const executed = []
const run = (id, description, callback) => {
  assert.match(id, /^INTERACTION-\d{3}$/)
  assert.ok(!executed.includes(id), `duplicate case ${id}`)
  try {
    callback()
    executed.push(id)
    console.log(`PASS ${id} ${description}`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = () => {
  assert.ok(existsSync(path.join(institutionRoot, 'index.ts')))
  assert.ok(existsSync(path.join(institutionRoot, 'detail.ts')))

  run('INTERACTION-001', 'List onLoad has one initial application load', () => {
    assert.equal((listTs.match(/this\.loadList\(sourceContextRef\)/g) || []).length, 1)
    assert.match(listTs, /onLoad\s*\(query/)
    assert.match(listTs, /buildInstitutionListPageSnapshot/)
  })
  run('INTERACTION-002', 'List loading prevents duplicate retry work', () => {
    const body = functionBody(listTs, 'onRetry')
    assert.match(body, /pageState\s*===\s*['"]loading['"]/)
    assert.match(body, /this\.loadList\(this\.data\.sourceContextRef\)/)
  })
  run('INTERACTION-003', 'List card action is visibly blocked and never navigates', () => {
    const body = functionBody(listTs, 'onCardTap')
    assert.match(body, /actionErrorMessage/)
    assert.match(body, /不会打开详情页面|开发验证中/)
    assert.equal(/navigateTo|redirectTo|switchTab|reLaunch/.test(body), false)
    assert.match(listWxml, /bindtap="onCardTap"/)
  })
  run('INTERACTION-004', 'List rapid card taps remain one visible action channel', () => {
    assert.equal((listWxml.match(/bindtap="onCardTap"/g) || []).length, 1)
    assert.equal((listTs.match(/onCardTap\s*\(/g) || []).length, 1)
    assert.equal(/triggerEvent\(['"]tap['"]/.test(listTs), false)
    assert.match(functionBody(listTs, 'onCardTap'), /blockedCardActions\.delete\(this\)/)
  })
  run('INTERACTION-005', 'List Back uses guard and gives failure feedback', () => {
    assert.match(listTs, /const runBack\s*=\s*\([\s\S]*?getNavigationGuard/)
    assert.match(listTs, /const runBack\s*=\s*[\s\S]*?(navigateBack|redirectTo)/)
    assert.match(listTs, /const runBack\s*=\s*[\s\S]*?onFailure\(\)/)
    assert.match(listTs, /暂时无法返回/)
  })
  run('INTERACTION-006', 'Detail parses route before any application build', () => {
    assert.match(detailTs, /parseInstitutionDetailRouteQuery\(query\)/)
    const onLoad = functionBody(detailTs, 'onLoad')
    assert.match(onLoad, /parseInstitutionDetailRouteQuery/)
    assert.match(onLoad, /this\.buildRoute\(parsed\.value\)/)
    assert.ok(onLoad.indexOf('parseInstitutionDetailRouteQuery') < onLoad.indexOf('this.buildRoute'))
  })
  run('INTERACTION-007', 'Detail invalid route returns without building', () => {
    const onLoad = functionBody(detailTs, 'onLoad')
    assert.match(onLoad, /if\s*\(!parsed\.ok\)/)
    const invalidStart = onLoad.indexOf('if (!parsed.ok)')
    const buildStart = onLoad.indexOf('this.buildRoute(parsed.value)')
    assert.ok(invalidStart >= 0 && buildStart > invalidStart)
    assert.ok(onLoad.slice(invalidStart, buildStart).includes('return'))
  })
  run('INTERACTION-008', 'Detail onShow only resets guard, never rebuilds', () => {
    const body = functionBody(detailTs, 'onShow')
    assert.match(body, /resetNavigationGuard/)
    assert.equal(/buildRoute|buildInstitutionDetailPageSnapshot|setData/.test(body), false)
  })
  run('INTERACTION-009', 'Detail retry is a single guarded route rebuild', () => {
    const body = functionBody(detailTs, 'onRetry')
    assert.match(body, /pageState\s*===\s*['"]loading['"]|isSwitchingRevision/)
    assert.match(body, /routeByPage\.get/)
    assert.match(body, /this\.buildRoute\(route\)/)
  })
  run('INTERACTION-010', 'Detail current switch is guarded and clears stale state', () => {
    const body = functionBody(detailTs, 'onViewCurrentRevision')
    assert.match(body, /isSwitchingRevision/)
    assert.match(body, /getNavigationGuard/)
    assert.match(body, /buildInstitutionCurrentRevisionSnapshot/)
    assert.match(body, /recommendation|viewModel/)
    assert.match(detailWxml, /bindtap="onViewCurrentRevision"/)
  })
  run('INTERACTION-011', 'Detail Back stays one channel with failure feedback', () => {
    const body = functionBody(detailTs, 'onBackToList')
    assert.match(body, /runBack/)
    assert.match(detailTs, /onNavigationFailure/)
    assert.match(detailTs, /暂时无法返回/)
    assert.equal((detailWxml.match(/bind:navigationfail="onNavigationFailure"/g) || []).length, 1)
  })
  run('INTERACTION-012', 'Detail VR action is blocked without navigation', () => {
    const body = functionBody(detailTs, 'onVrTap')
    assert.match(body, /actionErrorMessage/)
    assert.equal(/navigateTo|redirectTo|switchTab|reLaunch/.test(body), false)
    assert.match(detailWxml, /bindtap="onVrTap"/)
  })
  run('INTERACTION-013', 'Home no longer propagates legacy id-only detail routes', () => {
    assert.equal(/\?id=|detail\?id=|query\.id/.test(homeTs), false)
    assert.equal(/\?id=|detail\?id=/.test(homeWxml), false)
    assert.match(homeTs, /openInstitution|openInstitutions/)
  })
  run('INTERACTION-014', 'Home institution stays blocked and Consultant uses one guarded navigation', () => {
    const body = functionBody(homeTs, 'openInstitution')
    assert.ok(body.length > 0)
    assert.match(body, /setData|开发|详情|institutionId|recordRevision/)
    assert.equal(/pages\/institution\/detail\?/.test(body), false)
    assert.match(body, /blockedInstitutionActions\.delete\(this\)/)
    const consultantBody = functionBody(homeTs, 'openConsultant')
    assert.match(consultantBody, /switchToConsultantWithGuard/)
    assert.match(homeTs, /getNavigationGuard/)
    assert.match(homeTs, /success:[\s\S]*fail[\s\S]*complete:/)
    assert.equal(/wx\.request|wx\.login|phoneNumber/.test(homeTs + homeWxml), false)
  })
  run('INTERACTION-015', 'List/detail pages use no forbidden network or auth APIs', () => {
    const all = listTs + listWxml + detailTs + detailWxml
    assert.equal(/wx\.request|wx\.login|getPhoneNumber|phoneNumber/.test(all), false)
    assert.equal(/triggerEvent\(['"]tap['"]/.test(all), false)
  })
  run('INTERACTION-016', 'Blocked routes expose no accidental direct navigation', () => {
    const all = listTs + detailTs + homeTs
    const listCard = functionBody(listTs, 'onCardTap')
    const vr = functionBody(detailTs, 'onVrTap')
    assert.equal(/navigateTo|switchTab|reLaunch/.test(listCard + vr), false)
    assert.match(all, /getNavigationGuard/)
  })

  assert.deepEqual(executed, Array.from({ length: 16 }, (_, index) => `INTERACTION-${String(index + 1).padStart(3, '0')}`))
  if (failures.length > 0) throw new Error(`${failures.length} interaction case(s) failed\n${failures.join('\n')}`)
  console.log(`INTERACTION_CASES: ${executed.length}/16 PASS`)
  console.log('INSTITUTION_LIST_DETAIL_INTERACTIONS = PASS')
}

try {
  main()
} catch (error) {
  console.error('INSTITUTION_LIST_DETAIL_INTERACTIONS = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
}
