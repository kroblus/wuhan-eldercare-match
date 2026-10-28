import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const { ts } = loadWechatTypeScript()
for (const mode of ['demo', 'production']) {
  const base = path.resolve('dist', mode, 'miniprogram')
  const runtime = createWechatTsRuntime(ts, { wx: { getStorageSync() {} }, setTimeout, clearTimeout })
  const load = file => runtime.load(path.join(base, file + '.js'))
  const text = load('runtime/presentation-copy').modeText
  const display = load('runtime/institution-display')
  const navigation = load('runtime/institution-navigation')
  const originalDisclosure = '开发演示数据\n以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。'
  assert.equal(text(originalDisclosure), mode === 'demo' ? '演示数据：费用与护理能力均为虚构示例。' : originalDisclosure.replace('合作机构', '养老机构'))
  assert.equal(text('未经修改的普通说明'), '未经修改的普通说明')
  assert.equal(text('已保存到本机（开发态），不会同步服务器'), mode === 'demo' ? '本次填写已暂存' : '已保存到本机（开发态），不会同步服务器')
  for (const name of ['合成老人（TEST ONLY）', '  测试  ', '演示·合成老人 (TEST ONLY)  ']) {
    const headline = `${name} · 80 岁`
    assert.equal(display.profileHeadline(headline), mode === 'demo'
      ? `${name.replace(/^合成老人/, '演示老人').replace(/[（(]TEST ONLY[）)]/g, '').trim()} · 80 岁` : headline)
  }
  const card = { institutionId: 'demo-inst-chunhe-home', recordRevision: 1, name: '演示名称：春和', region: '演示区域：汉阳（Mock 演示目录）', reasonCodes: ['KEEP'], rank: 1 }
  const view = { state: 'ready_exact', cards: [card], conditionalCards: [{ ...card, institutionId: 'demo-inst-other', rank: 2 }], noExactMatch: null }
  const before = JSON.stringify(view)
  const presented = display.presentRecommendationNames(view)
  assert.equal(JSON.stringify(view), before, 'Presentation cannot write back into its input')
  assert.equal(presented.state, view.state)
  assert.equal(presented.noExactMatch, view.noExactMatch)
  for (const key of ['cards', 'conditionalCards']) for (let i = 0; i < view[key].length; i++) {
    const { name, region, ...facts } = presented[key][i]
    const { name: _name, region: _region, ...original } = view[key][i]
    assert.deepEqual(facts, original, 'Display aliases cannot alter identity, revision, reasons or order')
    assert.equal(region, mode === 'demo' ? '演示区域：汉阳' : card.region)
  }
  assert.equal(presented.cards[0].name, mode === 'demo' ? '虚构示例·春和颐养中心' : card.name)
  const route = { identity: { institutionId: card.institutionId, recordRevision: 1 }, source: 'recommendation', sourceContextRef: 'synthetic:context#1' }
  const preview = navigation.detailPreview(route)
  const appointment = navigation.appointmentDestination(route)
  if (mode === 'demo') {
    assert.ok(preview.hideLocation)
    for (const url of [preview.detailPreviewUrl, appointment, navigation.consultationDestination(route)]) {
      assert.ok(url.includes('institutionId=demo-inst-chunhe-home&recordRevision=1'))
      assert.ok(url.includes('source=recommendation'))
      assert.ok(url.includes('sourceContextRef=synthetic%3Acontext%231'))
    }
    assert.equal(navigation.detailPreview({ ...route, identity: { ...route.identity, recordRevision: 2 } }).hideLocation, false)
  } else {
    assert.equal(preview.hideLocation, false)
    assert.equal(preview.detailPreviewUrl, '')
    assert.equal(appointment, '/pages/appointment/create?institutionId=demo-inst-chunhe-home&recordRevision=1')
    assert.equal(await load('runtime/showcase-context').resolveShowcaseContext({ institutionId: card.institutionId }), null)
  }
  assert.equal(JSON.parse(fs.readFileSync(path.resolve('dist', mode, '.shared-build.json'))).status, 'PASS_LOCAL_BUILD')
  console.log(`PASS ${mode}: runtime copy, display-only aliases, immutable input, canonical navigation and resource context`)
}
