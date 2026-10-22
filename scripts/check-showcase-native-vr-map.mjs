import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { requireShowcaseVerificationOutput } from './support/showcase-verification-output.mjs'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'
const out = requireShowcaseVerificationOutput(process.argv.slice(2))
const { ts } = loadWechatTypeScript()
const base = 'miniprogram/pages/showcase'
fs.mkdirSync(out, { recursive: true })
const compilerOptions = { ...ts.readConfigFile('tsconfig.json', ts.sys.readFile).config.compilerOptions }
const parsed = ts.convertCompilerOptionsFromJson(compilerOptions, process.cwd())
const files = fs.readdirSync(base).filter(name => name.endsWith('.ts')).map(name => path.resolve(base, name))
const program = ts.createProgram([...files, path.resolve('typings/index.d.ts')], { ...parsed.options, noEmit: true })
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error)
const diagnostics = ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: f => f, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' })
fs.writeFileSync(out + '/typescript.log', diagnostics || 'TS 4.1.2 semantic check PASS\n')
assert.equal(errors.length, 0, diagnostics)
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name) }
const timers = new Map(), frames = new Map()
let nextTimer = 0, nextFrame = 0, definition, chooseOptions, modalOptions, readOptions, centerOptions
const nav = [], counters = { textureDelete: 0, bufferDelete: 0, shaderDelete: 0, programDelete: 0, draw: 0, imageUpload: 0, loss: 0 }
let lose = false, shaderOK = true, contextLost = false, createdImage
const canvasListeners = new Map()
const gl = new Proxy({
  createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}),
  getShaderParameter: () => shaderOK, getProgramParameter: () => true, getParameter: () => 4096,
  getAttribLocation: () => 0, getUniformLocation: () => ({}), getError: () => 0,
  isContextLost: () => contextLost,
  getExtension: () => ({ loseContext() { counters.loss++ } }),
  deleteTexture() { counters.textureDelete++ }, deleteBuffer() { counters.bufferDelete++ },
  deleteShader() { counters.shaderDelete++ }, deleteProgram() { counters.programDelete++ },
  drawElements() { counters.draw++ }, texImage2D(...args) { if (args.length === 6) counters.imageUpload++ },
}, { get(target, name) { if (name in target) return target[name]; if (/^[A-Z_0-9]+$/.test(String(name))) return name === 'NO_ERROR' ? 0 : 1; return () => {} } })
const canvas = {
  width: 0, height: 0, getContext: () => lose ? null : gl,
  requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id },
  cancelAnimationFrame(id) { frames.delete(id) },
  addEventListener(name, listener) { if (!canvasListeners.has(name)) canvasListeners.set(name, new Set()); canvasListeners.get(name).add(listener) },
  removeEventListener(name, listener) { if (canvasListeners.has(name)) canvasListeners.get(name).delete(listener) },
  createImage() { return createdImage = { width: 1024, height: 512 } },
}
let pages = [], navFail = false
const definitions = new Map()
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  nextTick: fn => fn(), getSystemInfoSync: () => ({ pixelRatio: 3 }),
  createSelectorQuery: () => ({ in() { return this }, select() { return this }, fields() { return this }, exec(fn) { fn([{ node: canvas, width: 320, height: 250 }]) } }),
  showModal: options => { modalOptions = options }, chooseImage: options => { chooseOptions = options },
  getFileSystemManager: () => ({ readFile: options => { readOptions = options } }),
  createMapContext: () => ({ getCenterLocation: options => { centerOptions = options } }),
  navigateTo: options => { nav.push(['navigateTo', options.url]); if (navFail) options.fail() },
  navigateBack: options => { nav.push(['navigateBack', options.delta]); if (navFail) options.fail() },
  redirectTo: options => { nav.push(['redirectTo', options.url]); if (navFail) options.fail() },
}
const runtime = createWechatTsRuntime(ts, { wx, Page: d => { definition = d }, getCurrentPages: () => pages,
  setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id }, clearTimeout: id => timers.delete(id) })
const sphere = runtime.load(path.resolve(base, 'sphere-renderer.ts'))
const input = runtime.load(path.resolve(base, 'panorama-input.ts'))
const navigation = runtime.load(path.resolve(base, 'navigation.ts'))
const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
function page(file) {
  if (!definitions.has(file)) { runtime.load(path.resolve(base, file)); definitions.set(file, definition) }
  const spec = definitions.get(file)
  const instance = { ...spec, data: structuredClone(spec.data), setData(patch, done) { Object.assign(this.data, patch); if (done) done() } }
  if (instance.onLoad) instance.onLoad()
  return instance
}
function jpeg(width = 1024, height = 512, metadata = false) {
  const bytes = [255,216]
  if (metadata) bytes.push(255,225,0,4,1,2)
  bytes.push(255,192,0,11,8,height >> 8,height & 255,width >> 8,width & 255,1,1,17,0,255,218,0,2,0,255,217)
  return Uint8Array.from(bytes).buffer
}
test('TS4.1.2 semantic compile + emitted JS parse, no class fields', () => {
  for (const file of files) {
    const emit = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS } }).outputText
    const parsedJS = ts.createSourceFile(file + '.js', emit, ts.ScriptTarget.ES2017, true, ts.ScriptKind.JS)
    assert.equal(parsedJS.parseDiagnostics.length, 0)
    function visit(node) { assert.ok(!ts.isPropertyDeclaration(node)); ts.forEachChild(node, visit) } visit(parsedJS)
    fs.mkdirSync(out + '/offline-js', { recursive: true }); fs.writeFileSync(out + '/offline-js/' + path.basename(file, '.ts') + '.js', emit)
  }
})
test('sphere vertices lie on unit sphere; indexed seam and perspective view', () => {
  const geometry = sphere.sphereGeometry(); assert.equal(geometry.indices.length, 64 * 32 * 6)
  for (let i = 0; i < geometry.vertices.length; i += 5) assert.ok(Math.abs(Math.hypot(...geometry.vertices.slice(i, i + 3)) - 1) < 1e-6)
  for (const index of geometry.indices) assert.ok(index < geometry.vertices.length / 5)
})
test('horizontal/vertical drag, pitch clamp, pinch and bounds', () => {
  const view = sphere.moveView(sphere.initialView(), [{ x: 0, y: 0 }], [{ x: -100, y: 120 }]); assert.equal(view.yaw, 25); assert.equal(view.pitch, 30)
  assert.equal(sphere.moveView(view, [{ x: 0, y: 0 }], [{ x: 0, y: 2000 }]).pitch, 85)
  assert.equal(sphere.moveView(view, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 200, y: 0 }]).fov, 37.5)
  const transition = [{ x: 0, y: 0 }]
  assert.deepEqual(sphere.moveView(view, transition, [{ x: 0, y: 0 }, { x: 100, y: 0 }]), view)
  assert.deepEqual(sphere.moveView(view, [{ x: 0, y: 0 }, { x: 100, y: 0 }], transition), view)
  assert.equal(sphere.moveView({ yaw: 0, pitch: 0, fov: 36 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 1000, y: 0 }]).fov, 35)
  assert.equal(sphere.moveView({ yaw: 0, pitch: 0, fov: 99 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 2, y: 0 }]).fov, 100)
  assert.equal(sphere.moveView({ yaw: 0, pitch: 0, fov: 75 }, [{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]).fov, 75)
})
test('photo intake dimensions, size/projection limit and metadata fail closed', () => {
  assert.equal(input.inspectPanoramaJpeg(jpeg()).width, 1024)
  assert.throws(() => input.inspectPanoramaJpeg(jpeg(1000, 500, true)), /元数据/)
  assert.throws(() => input.inspectPanoramaJpeg(jpeg(1200, 400)), /完整球形/)
  assert.throws(() => input.inspectPanoramaJpeg(new ArrayBuffer(8 * 1024 * 1024 + 1)))
  const appended = new Uint8Array(jpeg().byteLength + 4); appended.set(new Uint8Array(jpeg())); appended.set([1,2,3,4], jpeg().byteLength)
  assert.throws(() => input.inspectPanoramaJpeg(appended.buffer), /附加内容/)
})
test('WebGL unsupported and failed shader clean up instead of fake display', () => {
  lose = true; assert.throws(() => sphere.createSphereRenderer(canvas, 320, 250, 1, () => {})); lose = false
  shaderOK = false; const before = counters.shaderDelete; assert.throws(() => sphere.createSphereRenderer(canvas, 320, 250, 1, () => {})); assert.ok(counters.shaderDelete > before); shaderOK = true
})
test('on-demand frames coalesce, no continuous animation, cleanup idempotent', () => {
  const renderer = sphere.createSphereRenderer(canvas, 320, 250, 3, () => {})
  renderer.loadCalibration(); renderer.requestDraw({ yaw: 20, pitch: 10, fov: 50 }); assert.equal(frames.size, 1)
  assert.equal(canvasListeners.get('webglcontextlost').size, 1)
  flushFrames(); assert.equal(frames.size, 0); assert.equal(canvas.width, 640)
  renderer.requestDraw(sphere.initialView()); const staleFrame = [...frames.values()][0]
  const before = { texture: counters.textureDelete, buffers: counters.bufferDelete, shaders: counters.shaderDelete,
    programs: counters.programDelete, loss: counters.loss, draw: counters.draw }
  renderer.dispose(); renderer.dispose()
  assert.equal(frames.size, 0); assert.equal(canvasListeners.get('webglcontextlost').size, 0)
  assert.equal(counters.textureDelete, before.texture + 1); assert.equal(counters.bufferDelete, before.buffers + 2)
  assert.equal(counters.shaderDelete, before.shaders + 2); assert.equal(counters.programDelete, before.programs + 1)
  assert.equal(counters.loss, before.loss + 1)
  staleFrame(); assert.equal(counters.draw, before.draw)
})
test('local Canvas Image texture load, timeout/cancel and remote URL rejection', () => {
  const renderer = sphere.createSphereRenderer(canvas, 320, 250, 1, () => {})
  let result; renderer.loadLocal('https://example.com/private.jpg', 1024, 512, error => { result = error }); assert.equal(result, true)
  result = undefined; renderer.loadLocal('https://usr/private.jpg', 1024, 512, error => { result = error }); assert.equal(result, true)
  renderer.loadLocal('wxfile://tmp/clean.jpg', 1024, 512, error => { result = error }); const image = createdImage; image.onload(); assert.equal(result, false); assert.equal(counters.imageUpload, 1)
  renderer.loadLocal('wxfile://tmp/second.jpg', 1024, 512, () => assert.fail('late image callback')); const late = createdImage.onload
  renderer.dispose(); late(); assert.equal(timers.size, 0)
})
test('local image timeout reports failure once and ignores a late decode callback', () => {
  const renderer = sphere.createSphereRenderer(canvas, 320, 250, 1, () => {})
  let result, calls = 0
  renderer.loadLocal('wxfile://tmp/timeout.jpg', 1024, 512, error => { result = error; calls++ })
  const lateLoad = createdImage.onload, timeout = [...timers.values()][0]
  timeout()
  assert.equal(result, true); assert.equal(calls, 1); assert.equal(timers.size, 0)
  lateLoad(); assert.equal(calls, 1)
  renderer.dispose()
})
test('context loss reports failure and frees pending frames', () => {
  let fatal = 0; const renderer = sphere.createSphereRenderer(canvas, 320, 250, 1, () => fatal++)
  renderer.loadCalibration(); contextLost = true; flushFrames(); assert.equal(fatal, 1); contextLost = false; renderer.dispose()
})
const vr = page('vr-real.ts'); vr.onReady()
test('VR action buttons, reset, hide/unload and safe remount', () => {
  vr.useCalibration(); vr.touchStart({ touches: [{ x: 0, y: 0 }] }); vr.touchMove({ touches: [{ x: -160, y: 80 }] }); assert.equal(vr.data.yaw, 40); assert.equal(vr.data.pitch, 20)
  vr.zoomIn(); assert.equal(vr.data.fov, 65); vr.resetView(); assert.equal(vr.data.fov, 75); assert.equal(vr.data.yaw, 0)
  vr.onHide(); assert.equal(vr.data.rendered, false); assert.equal(frames.size, 0); vr.onShow(); assert.equal(vr.data.rendered, true)
})
test('VR one-to-two-to-one touch transitions, bounded button zoom and reset', () => {
  vr.useCalibration()
  vr.touchStart({ touches: [{ x: 100, y: 100 }] })
  vr.touchMove({ touches: [{ x: 110, y: 100 }] })
  const yawBeforePinch = vr.data.yaw
  vr.touchStart({ touches: [{ x: 110, y: 100 }, { x: 210, y: 100 }] })
  vr.touchMove({ touches: [{ x: 110, y: 100 }, { x: 230, y: 100 }] })
  assert.ok(vr.data.fov < 75)
  const fovAfterPinch = vr.data.fov
  vr.touchEnd({ touches: [{ x: 110, y: 100 }] })
  vr.touchMove({ touches: [{ x: 120, y: 110 }] })
  assert.equal(vr.data.fov, fovAfterPinch)
  assert.notEqual(vr.data.yaw, yawBeforePinch)
  for (let i = 0; i < 12; i++) vr.zoomIn()
  assert.equal(vr.data.fov, 35)
  for (let i = 0; i < 12; i++) vr.zoomOut()
  assert.equal(vr.data.fov, 100)
  vr.resetView(); assert.deepEqual([vr.data.yaw, vr.data.pitch, vr.data.fov], [0, 0, 75])
})
test('picker confirmation cancel, failure and late file read after hide', () => {
  vr.chooseLocalPhoto(); modalOptions.success({ confirm: false }); assert.equal(vr.data.choosing, false)
  vr.chooseLocalPhoto(); modalOptions.success({ confirm: true }); chooseOptions.fail(); assert.equal(vr.data.choosing, false)
  vr.chooseLocalPhoto(); modalOptions.success({ confirm: true }); chooseOptions.success({ tempFilePaths: ['wxfile://tmp/photo.jpg'] }); const late = readOptions
  vr.onHide(); late.success({ data: jpeg() }); assert.equal(vr.data.rendered, false); vr.onShow()
})
test('picker hides and returns, photo read stays private and unload rejects callbacks', () => {
  vr.chooseLocalPhoto(); modalOptions.success({ confirm: true }); vr.onHide()
  chooseOptions.success({ tempFilePaths: ['wxfile://tmp/photo.jpg'] }); vr.onShow()
  readOptions.success({ data: jpeg() }); createdImage.onload(); assert.equal(vr.data.rendered, true)
  assert.ok(!JSON.stringify(vr.data).includes('wxfile'))
  vr.onUnload(); assert.equal(frames.size, 0); assert.equal(timers.size, 0)
})
test('rapid VR hide/show cycles do not retain listeners, frames or duplicate renderers', () => {
  const lifecycleVr = page('vr-real.ts'); lifecycleVr.onReady(); lifecycleVr.useCalibration()
  for (let i = 0; i < 3; i++) {
    assert.equal(canvasListeners.get('webglcontextlost').size, 1)
    lifecycleVr.onHide()
    lifecycleVr.onHide()
    assert.equal(canvasListeners.get('webglcontextlost').size, 0)
    assert.equal(frames.size, 0)
    lifecycleVr.onShow()
    assert.equal(lifecycleVr.data.rendered, true)
    assert.equal(canvasListeners.get('webglcontextlost').size, 1)
  }
  lifecycleVr.onUnload()
  assert.equal(canvasListeners.get('webglcontextlost').size, 0)
  assert.equal(frames.size, 0)
})
const map = page('map-real.ts'); map.onShow()
test('map pending/timeout/retry and updated event is not tile verification', () => {
  assert.equal(map.data.loading, true); const timeout = [...timers.values()][0]; timeout(); assert.match(map.data.error, /原生地图/)
  map.retryMap(); const oldId = map.data.mapId; map.retryMap(); map.mapUpdated({ target: { id: oldId } }); assert.equal(map.data.updated, false)
  map.mapUpdated({ target: { id: map.data.mapId } }); assert.equal(map.data.updated, true); assert.equal(map.data.loading, false)
})
test('map center read/late callbacks, reset and reenter without geolocation', () => {
  centerOptions.success({ latitude: 30.6, longitude: 114.4 }); assert.match(map.data.center, /30.60000/)
  map.regionChanged({ target: { id: map.data.mapId }, type: 'end' }); const late = centerOptions
  map.onHide(); const center = map.data.center; late.success({ latitude: 1, longitude: 1 }); assert.equal(map.data.center, center)
  map.onShow(); map.resetMap(); assert.equal(map.data.latitude, 30.59); map.onUnload()
})
test('map hide, remount and unload reject stale update, timeout and center callbacks', () => {
  const lifecycleMap = page('map-real.ts'); lifecycleMap.onShow()
  const firstId = lifecycleMap.data.mapId, staleTimeout = [...timers.values()][0]
  const errorBefore = lifecycleMap.data.error
  lifecycleMap.onHide()
  assert.equal(lifecycleMap.data.mapVisible, false); assert.equal(timers.size, 0)
  staleTimeout(); lifecycleMap.mapUpdated({ target: { id: firstId } })
  assert.equal(lifecycleMap.data.error, errorBefore); assert.equal(lifecycleMap.data.updated, false)
  lifecycleMap.onShow()
  const secondId = lifecycleMap.data.mapId
  assert.notEqual(secondId, firstId)
  lifecycleMap.mapUpdated({ target: { id: firstId } }); assert.equal(lifecycleMap.data.updated, false)
  lifecycleMap.mapUpdated({ target: { id: secondId } }); assert.equal(lifecycleMap.data.updated, true)
  const lateCenter = centerOptions, centerBeforeUnload = lifecycleMap.data.center
  lifecycleMap.onUnload(); lateCenter.success({ latitude: 1, longitude: 1 })
  assert.equal(lifecycleMap.data.center, centerBeforeUnload); assert.equal(timers.size, 0)
})
test('navigation is single action, fail releases guard, back stays in showcase', () => {
  const p = {}; nav.length = 0; pages = [{ route: 'pages/appointment/create' }, {}]; navigation.backToShowcase(p, () => {}); assert.deepEqual(nav[0], ['redirectTo', '/pages/showcase/index'])
  navigation.unlock(p); navFail = true; navigation.openShowcase(p, 'pages/showcase/vr-real', () => {}); navigation.openShowcase(p, 'pages/showcase/vr-real', () => {}); assert.equal(nav.length, 3); navFail = false
  navigation.unlock(p); pages = [{ route: 'pages/showcase/index' }, {}]; navigation.backToShowcase(p, () => {}); assert.equal(nav[3][0], 'navigateBack')
})
test('no business/provider/storage/location calls, no POI/remote texture/HTML fallback', () => {
  const source = fs.readdirSync(base).filter(f => /\.(ts|wxml)$/.test(f)).map(f => fs.readFileSync(base + '/' + f, 'utf8')).join('\n')
  assert.doesNotMatch(source, /wx\.(request|uploadFile|downloadFile|getLocation|openLocation|login|setStorage|saveFile)|from ['"].*(services|mock|store|domain)|<web-view|<image/)
  const wxml = fs.readFileSync(base + '/map-real.wxml', 'utf8'); assert.match(wxml, /<map /); assert.doesNotMatch(wxml, /markers=|bindmarkertap/)
  const app = JSON.parse(fs.readFileSync('miniprogram/app.json')); for (const name of ['index','vr-real','map-real']) assert.ok(app.pages.includes('pages/showcase/' + name))
})
test('trial/release and unknown build fail closed with no rendering or navigation', () => {
  const original = wx.getAccountInfoSync
  for (const envVersion of ['trial', 'release', undefined]) {
    wx.getAccountInfoSync = () => ({ miniProgram: { envVersion } })
    const p = page('vr-real.ts'); p.onReady(); assert.equal(p.data.allowed, false); assert.equal(p.data.rendered, false); p.onUnload()
    const m = page('map-real.ts'); m.onShow(); assert.equal(m.data.mapVisible, false); m.onUnload()
    const i = page('index.ts'); const before = nav.length; i.openMap(); i.openVr(); assert.equal(nav.length, before)
  }
  wx.getAccountInfoSync = original
})
// Vendor offline WXML; Less/WXSS are separately verified by the actual DevTools build.
const vendor = 'D:/DailyAPP/微信web开发者工具/resources/app.asar.unpacked/node_modules'
const pageNames = ['index', 'vr-real', 'map-real']
for (const [name, bin, args, cwd] of [
  ['wxml', 'wcc.exe', ['-o', path.resolve(out, 'wxml-generated.js'), ...pageNames.map(name => 'pages/showcase/' + name + '.wxml')], path.resolve('miniprogram')],
]) {
  const result = spawnSync(path.join(vendor, 'wcc-exec', bin), args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  fs.writeFileSync(out + '/' + name + '.log', (result.stdout || '') + (result.stderr || ''))
  assert.equal(result.status, 0, name + ' offline vendor compiler: ' + result.stderr)
  passed++; console.log('PASS offline vendor ' + name)
}
fs.writeFileSync(path.join(out, 'offline-results.json'), JSON.stringify({ status: 'PASS', passed, typescript: ts.version,
  outputDir: out, evidence: 'UNIT_MOCKS_AND_OFFLINE_VENDOR_COMPILERS_NOT_NATIVE_INTERACTION' }, null, 2))
console.log('PASS ' + passed + ' checks; evidence: ' + out)
