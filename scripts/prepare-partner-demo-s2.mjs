import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'miniprogram')
const templateRoot = path.join(root, 'partner-demo-s2/templates')
const evidenceRoot = path.join(root, 'output/partner-demo-s2b-interactive-implementation')
const { ts } = loadWechatTypeScript()
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const fixtureRoot = path.join(root, 'output/partner-demo-s2a-synthetic-domain-pack')
const fixture = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'synthetic-fixtures.json'), 'utf8'))
const recordEvidence = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'institution-records-test-only.json'), 'utf8'))
const records = recordEvidence.records.map((entry) => entry.v121Record)
const pages = [
  'pages/home/index', 'pages/consultant/index', 'pages/mine/index',
  ...['intro', 'basic', 'health', 'adl', 'cognitive', 'preference', 'budget', 'profile'].map((name) => `pages/assessment/${name}`),
  'pages/recommendation/result', 'pages/institution/index', 'pages/institution/detail',
  'pages/service/ai-chat/index', 'pages/appointment/create', 'pages/appointment/success',
  'pages/appointment/index', 'pages/visit/evaluation',
]
const productionConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const app = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'))
app.pages = pages
const projectConfig = {
  description: 'TEST_ONLY 合成机构洽谈开发演示', projectname: 'wuhan-partner-demo-s2',
  appid: productionConfig.appid, compileType: 'miniprogram', miniprogramRoot: 'miniprogram/',
  srcMiniprogramRoot: 'miniprogram/', libVersion: productionConfig.libVersion,
  setting: { useCompilerPlugins: ['typescript', 'less'], es6: false, enhance: false,
    minified: false, compileHotReLoad: false, ignoreUploadUnusedFiles: true,
    minifyWXSS: true, minifyWXML: true, uploadWithSourceMap: false },
  packOptions: { ignore: [], include: [] },
}
const virtual = new Map()
const json = (value) => JSON.stringify(value, null, 2) + '\n'
const set = (name, value) => virtual.set(name, typeof value === 'string' ? value : json(value))
set('app.json', app)
set('app.ts', "// TEST_ONLY S2 identity, no storage or authentication.\nimport { BUILD_IDENTITY } from './demo/data'\nApp({ globalData: { demoIdentity: BUILD_IDENTITY }, onLaunch() { if (BUILD_IDENTITY !== 'PARTNER_DEMO_S2_TEST_ONLY') throw new Error('DEMO_IDENTITY_REQUIRED') } })\n")
set('demo/data.ts', `// Entirely synthetic. Never a production Institution catalog.\nexport const BUILD_IDENTITY = 'PARTNER_DEMO_S2_TEST_ONLY'\nexport const DEMO_AS_OF = ${JSON.stringify(fixture.fixedAsOf)}\nexport const SYNTHETIC_ANSWERS: any = ${JSON.stringify(fixture.answers)}\nexport const DEMO_ROUTES = ${JSON.stringify(pages)}\n`)
set('demo/platform-layout.ts', `// TEST_ONLY presentation metrics. Never reads storage or business data.
export const getDemoAssessmentHeaderHeight = (): number => {
  try {
    const info = wx.getSystemInfoSync()
    const top = info && info.safeArea && info.safeArea.top
    return (info && info.platform === 'ios' ? 44 : 48)
      + (typeof top === 'number' && Number.isFinite(top) && top >= 0 ? top : 0)
  } catch (_error) { return 48 }
}
`)
set('mock/institution-catalog.mock.ts', `// S2A TEST_ONLY synthetic records, no real institutions.\nimport type { InstitutionCatalogPayloadV121 } from '../types/institution-catalog-v1-2-1'\nexport const MOCK_INSTITUTION_CATALOG_V121: InstitutionCatalogPayloadV121 = ${JSON.stringify({ datasetVersion: fixture.datasetVersion, datasetMode: 'MOCK_DEVELOPMENT_ONLY', records, currentPointers: records.map((r) => ({ institutionId: r.institutionId, recordRevision: r.recordRevision })), presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] } })}\n`)
set('mock/institution-public-content.mock.ts', 'export const MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG = { records: [], currentHeads: [] }\n')
set('store/assessment-draft.ts', fs.readFileSync(path.join(templateRoot, 'assessment-draft.ts'), 'utf8'))
set('demo/external-actions.ts', fs.readFileSync(path.join(templateRoot, 'external-actions.ts'), 'utf8'))
for (const name of ['appointment-create-client', 'appointment-owner-read', 'business-session', 'visit-evaluation-providers']) {
  set(`services/${name}.ts`, fs.readFileSync(path.join(templateRoot, 'business', `${name}.ts`), 'utf8'))
}
set('services/elder-record-read-only-diagnostic.ts', `// No account or diagnostic network in the demo.\nexport type ElderRecordReadOnlyDiagnosticResultV1 = { kind: 'service_unavailable' }\nexport type ElderRecordReadOnlyDiagnosticClientV1 = { resolveCurrentElderRecordReadOnly(): Promise<ElderRecordReadOnlyDiagnosticResultV1> }\nexport const isElderRecordDiagnosticDevelopRuntimeV1 = () => false\nexport const createElderRecordReadOnlyDiagnosticClientV1 = (): ElderRecordReadOnlyDiagnosticClientV1 => ({ resolveCurrentElderRecordReadOnly: async () => ({kind: 'service_unavailable'}) })\n`)
set('pages/visit/visit-evaluation-idempotency.ts', "export const createWeChatVisitEvaluationIdempotencyKeyV1 = async () => 'TEST_ONLY_NO_PRODUCTION_SUBMIT'\n")
set('services/c6-phone-authorization.ts', `export type C6PhoneAuthorizationResult = any\nexport type C6PhoneEvidenceOutcome = any\nexport const verifyC6PhoneAuthorization = async () => ({ authResolution:'unavailable', phoneEvidenceOutcome:null })\n`)

function replaceOnce(source, from, to, name) {
  if (!source.includes(from)) throw new Error(`staged patch anchor missing: ${name}: ${from.slice(0, 90)}`)
  return source.replace(from, to)
}
function patch(name, source) {
  if (name === 'pages/assessment/intro.wxml') source = source.replace('先花几分钟，\\n了解老人的真实需求。', '先花几分钟，了解合成老人的需求。')
  // Layout information may be incomplete while an Android page first mounts.
  // This is presentation-only resilience, not a change to assessment rules.
  if (name.startsWith('pages/assessment/') && name.endsWith('.ts') && source.includes('system.safeArea.top')) {
    source = "import { getDemoAssessmentHeaderHeight } from '../../demo/platform-layout'\n" + source
    source = source.replace('    const system = wx.getSystemInfoSync()\n', '')
      .replace("(system.platform === 'android' ? 48 : 44) + system.safeArea.top", 'getDemoAssessmentHeaderHeight()')
  }
  if (name.startsWith('pages/assessment/') && name.endsWith('.wxml')) source = source.replace(/error="\{\{([^}]+)\}\}"/g, 'error="{{$1 || \'\'}}"')
  // The generated demo only accepts V2 in-memory assessments. Prune legacy
  // application composition; keep the original V2 derivation and rules intact.
  if (name === 'services/profile-application-v2.ts') {
    source = source.replace("import { deriveElderProfilePreview } from '../domain/elder-profile/derive-elder-profile-preview'\n", '')
    const start = source.indexOf('export const buildProfileApplicationSnapshot =')
    const end = source.indexOf('/** Kept as a type-only compatibility export', start)
    if (start < 0 || end < 0) throw new Error('V2 profile facade anchor missing')
    source = source.slice(0, start) + `export const buildProfileApplicationSnapshot = (): ProfileApplicationResult => {
  const result = buildProfileApplicationSnapshotV2()
  return result.ok ? { ok:true, version:2, value:result.value }
    : { ok:false, version:2, error:result.error, hasAnswers:hasDraftAnswers(assessmentDraftStore.getDraft()) }
}

` + source.slice(end)
  }
  if (name === 'services/recommendation-result-application.ts') source = `// TEST_ONLY V2-only composition; unchanged original V2 domain implementation.
import { assessmentDraftStore } from '../store/assessment-draft'
import { createRecommendationPreviewServiceV2 } from './recommendation-preview-v2'
import { institutionCatalogServiceV11 } from './institution-catalog-v1-1'
export const buildRecommendationResultApplicationSnapshot = async (input: {evaluationAsOf:string}) => {
  const result = await createRecommendationPreviewServiceV2({draftSource:assessmentDraftStore, institutionCatalog:institutionCatalogServiceV11}).buildResultSnapshot(input.evaluationAsOf)
  return result.ok ? {ok:true, version:2, value:result.value} : {ok:false, version:2, error:result.error}
}
`
  if (name === 'pages/home/index.ts') {
    source = "import { assessmentDraftStore } from '../../store/assessment-draft'\nimport { resetDemoBusinessSession } from '../../services/business-session'\n" + source
    source = replaceOnce(source, '    startAssessment() {', `    loadSyntheticDemo() {\n      navigateToWithGuard(this, 'home.startAssessment', '/pages/assessment/intro', (options) => {\n        assessmentDraftStore.loadSyntheticAnswers()\n        resetDemoBusinessSession()\n        wx.reLaunch(options as WechatMiniprogram.ReLaunchOption)\n      }, () => wx.showToast({title:'无法开始演示，请重试', icon:'none'}))\n    },\n    resetSyntheticDemo() {\n      const guard = getNavigationGuard(this)\n      if (!guard.acquire('home.resetDemo')) return\n      wx.showModal({ title:'重置合成演示？', content:'只清除本次演示内存，不影响原工程草稿。', confirmText:'重置演示', success:(result) => { if(result.confirm) { assessmentDraftStore.clear(); resetDemoBusinessSession(); wx.showToast({title:'演示已重置', icon:'none'}) } }, fail:() => wx.showToast({title:'暂时无法重置',icon:'none'}), complete:() => guard.release('home.resetDemo') })\n    },\n    startAssessment() {`, name)
  }
  if (name === 'pages/home/index.wxml') source = replaceOnce(source, '<view class="home-hero">', '<view class="home-hero"><primary-button warmSwiss="{{true}}" text="加载合成答案并开始演示 →" bind:action="loadSyntheticDemo"></primary-button><button bindtap="resetSyntheticDemo">重置演示内存</button>', name)
  if (name === 'pages/assessment/intro.ts') source = source.replace('草稿已保存在本机，仅用于本次开发体验', '合成答案仅保存在演示内存，关闭小程序后不保证保留').replace('本机会清除当前未完成的草稿，但不会影响任何历史评估。', '仅清除本次演示内存，不读取或影响原工程草稿。')
  if (name === 'services/institution-list-detail-page.ts') source = source.replace('const currentEvaluationAsOf = (): string => new Date().toISOString()', `const currentEvaluationAsOf = (): string => '${fixture.fixedAsOf}'`)
  if (name === 'pages/recommendation/result.ts') source = source.replaceAll('new Date().toISOString()', JSON.stringify(fixture.fixedAsOf))
  if (name === 'components/navigation-bar/navigation-bar.wxml') source = source.replace('<text>{{title}}</text>', '<view class="demo-header-title"><text>{{title}}</text><text class="demo-header-mark">开发演示｜全部为合成数据｜非真实机构或预约</text></view>')
  if (name === 'components/navigation-bar/navigation-bar.less') source += '\n.demo-header-title { display:flex;flex-direction:column;align-items:center; }\n.demo-header-mark { font-size:22rpx;font-weight:400;color:#D9572A;white-space:nowrap; }\n'
  if (name === 'pages/consultant/index.wxml') source = source.replace(/<view class="consultant-section">\s*<view class="ws-section-heading"><text class="ws-section-number">03<\/text>[\s\S]*?<\/view>\s*<view class="consultant-section consultant-selection">/, '<view class="consultant-section"><text>演示未配置对外顾问联系方式，不提供姓名、电话、二维码或手机号授权。</text></view><view class="consultant-section consultant-selection">')
  if (name === 'pages/mine/index.ts') source = source.replace("nextUrl: '/pages/elder/index'", "nextUrl: '/pages/assessment/profile'").replace('查看老人档案骨架', '查看合成需求画像')
  if (name === 'pages/mine/index.wxml') source = source.replace('title=""', 'title="演示记录"').replaceAll('查看老人档案', '查看合成画像').replace('档案资料暂不可读取。当前入口提供档案说明，不展示已保存的老人资料。', '仅展示本次内存会话的合成评估画像，不读取真实档案。').replace('查看当前账号的预约记录。身份确认与记录读取在进入预约页后进行。', '查看本次演示内存中的模拟预约和 TEST_ONLY 评价。').replace('暂不登录也可以浏览机构、图片、VR 和填写评估。查看需要身份确认的记录时，将在对应服务中按需进行。', '演示全程使用虚构数据和本地内存，不登录、不授权手机号、不联系真实机构。')
  if (name === 'pages/appointment/create.ts') {
    source = source.replace('async onPhoneAuthorization(event: AppointmentInputEvent)', 'async onDemoSubmit(event: AppointmentInputEvent)')
    source = source.replace(/    const phoneCode = event[\s\S]*?    const validation = validateAppointmentCreateFormV1/, "    const phoneCode = '' // Ordinary local action, no native authorization.\n\n    const validation = validateAppointmentCreateFormV1")
    source = source.replaceAll('提交后以服务端回执为准。', '仅产生本地模拟回执，不联系机构。').replaceAll('当前账号唯一绑定的老人档案已准备好。下一步将申请微信手机号，仅用于提交本次预约。', '合成老人引用已准备好。下一步仅提交本地模拟预约，不申请微信手机号。').replaceAll('正在确认当前账号已绑定的老人档案。', '正在准备合成老人引用。').replaceAll('预约申请已提交，正在打开结果页。', '本地模拟预约已记录，正在打开演示结果页。')
    source = source.replace("visitDate: '',", "visitDate: '2026-10-20',").replace("visitTimePreference: '',", "visitTimePreference: '上午（合成意向）',").replace("participantCount: '',", "participantCount: '2',").replace("contactName: '',", "contactName: '合成联系人甲',").replace("phone: '',", "phone: '13800000000',").replace("notes: '',", "notes: 'TEST_ONLY 合成预约，不联系任何人',")
  }
  if (name === 'pages/appointment/create.wxml') source = source.replace('open-type="getPhoneNumber"', '').replace('bindgetphonenumber="onPhoneAuthorization"', 'bindtap="onDemoSubmit"').replaceAll('授权手机号并提交预约', '确认本地模拟预约').replaceAll('重新授权并安全重试', '重试本地模拟预约').replaceAll('提交仅表示预约申请已送达，不代表机构已确认或安排看院。', '全部为合成意向，仅写入演示内存，不联系机构或真实用户。').replaceAll('提交预约', '模拟预约').replaceAll('申请已提交', '模拟已记录')
  if (name === 'pages/appointment/create.wxml') source = source
    .replaceAll('当前账号绑定档案已准备好', '合成老人引用已准备好').replaceAll('提交时确认当前账号绑定档案', '准备本地合成老人引用')
    .replaceAll('仅检查当前登录账号的老人档案绑定状态，不创建档案或模拟预约。', '仅使用本地合成老人引用，不读取账号或真实档案。')
    .replaceAll('仅用于联系本次预约。填写号码不代表已完成微信手机号授权。', '仅填写虚构联系人和测试号码；不联系任何人，不授权手机号。')
    .replaceAll('提交时还需向微信申请本次预约的一次性手机号授权', '仅填写合成测试号码，不拨打或发送')
    .replaceAll('等待本次预约手机号授权', '准备好确认本地模拟预约').replaceAll('提交前需完成手机号授权', '提交前先准备合成老人引用')
    .replaceAll('手机号仅用于本次预约联系，不作为登录身份。填写联系电话后，仍需在提交时通过微信授权。', '全部为合成意向，仅写入演示内存；无登录、手机号授权或真实提交。')
  if (name === 'pages/appointment/index.wxml') source = source.replace('新的预约记录将在服务可用后显示。', '从合成机构详情创建本地模拟预约后，此处会显示演示记录。')
  if (name === 'pages/appointment/success.ts') source = source.replace("'/pages/appointment/index', undefined,", "'/pages/appointment/index', (options) => wx.reLaunch(options as WechatMiniprogram.ReLaunchOption),")
  if (name === 'pages/appointment/success.wxml') source = source.replaceAll('{{handoff.receipt.publicMessage}}', '本地模拟预约已记录').replace("{{pageState === 'ready' && handoff ? handoff.receipt.publicMessage : '预约申请结果'}}", '本地模拟预约结果').replaceAll('申请已经送达，仍需顾问或机构进一步确认看院安排。', '仅写入本次演示内存，未发送至机构或顾问。').replaceAll('服务端接收时间', '模拟记录时间').replaceAll('看院时间、机构接待安排与必要补充信息，需要进一步沟通确认。', '可在模拟预约列表推进演示阶段，并进入 TEST_ONLY 看院评价。').replaceAll('服务端记录', '本地模拟记录')
  if (name === 'pages/visit/evaluation.ts') {
    source = source.replace("import { createProductionVisitEvaluationProvidersV1 } from './visit-evaluation-production-context'", "import { createDemoVisitEvaluationProvidersV1 } from '../../services/visit-evaluation-providers'")
    source = replaceOnce(source, `  const providers = createProductionVisitEvaluationProvidersV1()\n  const application = createVisitEvaluationUiApplicationV1({\n    productionContextProvider: providers.contextProvider,\n    productionSubmitProvider: providers.submitProvider,\n  })`, `  const providers = createDemoVisitEvaluationProvidersV1()\n  const application = createVisitEvaluationUiApplicationV1({\n    testOnlyContextProvider: providers.contextProvider,\n    testOnlySubmitProvider: providers.submitProvider,\n  })`, name)
    source = source.replaceAll('正在通过当前账号确认这条预约记录。', '正在读取本地 TEST_ONLY 模拟 Visit。')
  }
  if (name === 'pages/appointment/index.ts') {
    source = "import { advanceDemoVisitStatus } from '../../services/business-session'\n" + source
    source = source.replace('  onShow()', `  async onAdvanceDemoVisit(event: WechatMiniprogram.BaseEvent) {\n    const visitId = String(event.currentTarget.dataset.visitId || '')\n    advanceDemoVisitStatus(visitId)\n    await loadAppointments(this)\n  },\n  onShow()`)
    source = source.replace('  onShow() {\n    resetNavigationGuard(this)\n  }', '  onShow() {\n    resetNavigationGuard(this)\n    return loadAppointments(this)\n  }')
  }
  if (name === 'pages/appointment/index.wxml') source = source.replace('预约状态以服务端或授权运营记录为准。', 'TEST_ONLY 模拟进展，仅保存在演示内存，不代表真实机构确认或带看。').replace('<view class="appointment-card__detail">', '<button wx:if="{{item.status !== \'completed\' && item.status !== \'cancelled\'}}" data-visit-id="{{item.visitId}}" bindtap="onAdvanceDemoVisit">推进下一模拟阶段（不联系机构）</button><view class="appointment-card__detail">')
  if (name === 'pages/appointment/list-view-model.ts') source = source.replaceAll("requested: '待确认 · 已提交'", "requested: '模拟 · 已记录'").replaceAll("contacting: '待确认 · 顾问联系中'", "contacting: '模拟 · 联系阶段'").replaceAll("scheduled: '已确认'", "scheduled: '模拟 · 安排阶段'").replaceAll("completed: '已完成'", "completed: '模拟 · 带看完成'")
  // Business external actions use an explicit reject adapter, never wx replacement.
  if (/wx\.(?:makePhoneCall|openLocation)\s*\(/.test(source)) {
    const relative = path.posix.relative(path.posix.dirname(name), 'demo/external-actions').replace(/^(?!\.)/, './')
    source = `import { denyDemoExternalAction } from '${relative}'\n` + source.replace(/wx\.(?:makePhoneCall|openLocation)\s*\(/g, 'denyDemoExternalAction(')
  }
  return source
}

const files = new Map()
const sources = []
function resolveLocal(specifier, importer) {
  if (/^(?:data:|https?:|#|%23)/.test(specifier)) return null
  const base = specifier.startsWith('/') ? specifier.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier))
  if (base.startsWith('../') || path.isAbsolute(base)) throw new Error(`dependency outside miniprogramRoot: ${specifier}`)
  const options = [base, `${base}.ts`, `${base}.js`, `${base}.json`, `${base}.less`, `${base}.wxss`, `${base}/index.ts`]
  const found = options.find((name) => virtual.has(name) || fs.existsSync(path.join(sourceRoot, name)) && fs.statSync(path.join(sourceRoot, name)).isFile())
  if (!found) throw new Error(`unresolved ${specifier} from ${importer}`)
  return found
}
function visit(name) {
  if (files.has(name)) return
  const originalPath = path.join(sourceRoot, name)
  let content = virtual.get(name)
  let originalSha256 = null
  if (content === undefined) {
    const bytes = fs.readFileSync(originalPath)
    originalSha256 = sha(bytes)
    content = /\.(ts|js|json|wxml|less|wxss)$/.test(name) ? patch(name, bytes.toString('utf8').replaceAll('\r\n', '\n')) : bytes
  }
  files.set(name, content)
  sources.push({ path: name, source: virtual.has(name) ? 'demo-template-or-s2a-fixture' : `miniprogram/${name}`, originalSha256, generatedSha256: sha(content) })
  if (name.endsWith('.ts') || name.endsWith('.js')) {
    const output = name.endsWith('.ts') ? ts.transpileModule(content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 }, reportDiagnostics: true }) : { outputText:content }
    if ((output.diagnostics || []).some((d) => d.category === ts.DiagnosticCategory.Error)) throw new Error(`TS syntax failed: ${name}`)
    for (const match of output.outputText.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (!match[1].startsWith('.')) throw new Error(`nonlocal dependency ${match[1]} in ${name}`)
      visit(resolveLocal(match[1], name))
    }
  }
  if (name.endsWith('.json')) {
    const definition = JSON.parse(content)
    for (const route of Object.values(definition.usingComponents || {})) {
      const component = resolveLocal(route + '.json', name).slice(0, -5)
      for (const extension of ['.ts', '.json', '.wxml', '.less']) visit(component + extension)
    }
  }
  if (name.endsWith('.less') || name.endsWith('.wxss')) {
    for (const match of content.matchAll(/@import\s+(?:\([^)]*\)\s*)?['"]([^'"]+)['"]/g)) visit(resolveLocal(match[1], name))
    for (const match of content.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) { const target = resolveLocal(match[1], name); if (target) visit(target) }
  }
  if (name.endsWith('.wxml')) {
    for (const match of content.matchAll(/(?:src|poster)=["']([^"'{]+)["']/g)) { const target = resolveLocal(match[1], name); if (target) visit(target) }
  }
}
for (const name of ['app.ts', 'app.json', 'app.less', 'sitemap.json']) visit(name)
for (const page of pages) for (const ext of ['.ts', '.json', '.wxml', '.less']) visit(page + ext)
for (const item of app.tabBar.list) for (const field of ['iconPath', 'selectedIconPath']) if (item[field]) visit(item[field])
for (const [name, content] of files) {
  if (/\.(ts|js)$/.test(name) && /wx\.(?:request|login|getStorageSync|setStorageSync|removeStorageSync|clearStorageSync|uploadFile|downloadFile|makePhoneCall|openLocation)\s*\(/.test(content)) throw new Error(`forbidden runtime action in staged ${name}`)
  if (name.endsWith('.wxml') && /open-type=["']getPhoneNumber["']/.test(content)) throw new Error(`native phone authorization left in ${name}`)
}
const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'wuhan-partner-demo-s2-'))
const mini = path.join(destination, 'miniprogram')
for (const [name, content] of files) {
  const target = path.join(mini, name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}
fs.writeFileSync(path.join(destination, 'project.config.json'), json(projectConfig))
const manifest = { identity:'PARTNER_DEMO_S2_TEST_ONLY', appid:projectConfig.appid, fixedAsOf:fixture.fixedAsOf, files:sources.sort((a,b) => a.path.localeCompare(b.path)), configSha256:sha(json(projectConfig)), nativePhoneAuthorization:false, productionFallback:false }
fs.writeFileSync(path.join(destination, 'demo-source-manifest.json'), json(manifest))
fs.mkdirSync(evidenceRoot, { recursive:true })
fs.writeFileSync(path.join(evidenceRoot, 'generated-project.json'), json({ project:destination, miniprogramRoot:mini, manifest, nodeVersion:process.version }))
console.log(JSON.stringify({ project:destination, files:files.size, identity:manifest.identity, appid:projectConfig.appid }))
