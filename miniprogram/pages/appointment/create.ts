import {
  buildInstitutionDetailPageSnapshot,
} from '../../services/institution-list-detail-page'
import {
  parseInstitutionDetailRouteQuery,
} from '../../services/institution-detail-route'
import {
  createAppointmentSuccessHandoffV1,
  createProductionAppointmentCreateClientV1,
  consumeAppointmentInstitutionDisplaySnapshotV1,
  validateAppointmentCreateFormV1,
} from '../../services/appointment-create-client'
import type { AppointmentCreateClientV1, AppointmentElderPrepareResultV1 } from '../../services/appointment-create-client'
import {
  createElderRecordReadOnlyDiagnosticClientV1,
  isElderRecordDiagnosticDevelopRuntimeV1,
} from '../../services/elder-record-read-only-diagnostic'
import type {
  ElderRecordReadOnlyDiagnosticClientV1,
  ElderRecordReadOnlyDiagnosticResultV1,
} from '../../services/elder-record-read-only-diagnostic'
import type {
  AppointmentCreateFieldV1,
  AppointmentCreateFormErrorsV1,
  AppointmentCreateFormV1,
  AppointmentCreateInstitutionV1,
} from '../../types/appointment-create-v1'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type AppointmentCreatePageState = 'loading' | 'ready' | 'route_error' | 'institution_unavailable'
type ElderDiagnosticPageState = 'idle' | 'loading' | ElderRecordReadOnlyDiagnosticResultV1['kind']

interface AppointmentCreatePageData {
  pageState: AppointmentCreatePageState
  pageTitle: string
  pageDescription: string
  institution: AppointmentCreateInstitutionV1 | null
  form: AppointmentCreateFormV1
  formErrors: AppointmentCreateFormErrorsV1
  firstErrorAnchor: string
  actionMessage: string
  actionMessageTone: 'error' | 'info'
  preparingElder: boolean
  prepared: boolean
  phoneSubmitting: boolean
  outcomeUnknown: boolean
  terminalConflict: boolean
  formLocked: boolean
  receiptReady: boolean
  successNavigationFailed: boolean
  showElderReadOnlyDiagnostic: boolean
  elderDiagnosticState: ElderDiagnosticPageState
}

interface AppointmentInputEvent {
  detail?: { value?: unknown; code?: unknown; errMsg?: unknown }
}

interface AppointmentPagePrivateState {
  client: AppointmentCreateClientV1
  institution: AppointmentCreateInstitutionV1 | null
  preparedElderId: string | null
  prepareRunning: boolean
  phoneRunning: boolean
  outcomeUnknown: boolean
  terminalConflict: boolean
  successHandoffId: string | null
  navigationPending: boolean
  elderReadOnlyDiagnosticClient: ElderRecordReadOnlyDiagnosticClientV1
  elderReadOnlyDiagnosticRunning: boolean
}

const pagePrivateState = new WeakMap<object, AppointmentPagePrivateState>()
const APPOINTMENT_LIST_URL = '/pages/institution/index'

const createPrivateState = (): AppointmentPagePrivateState => ({
  client: createProductionAppointmentCreateClientV1(),
  institution: null,
  preparedElderId: null,
  prepareRunning: false,
  phoneRunning: false,
  outcomeUnknown: false,
  terminalConflict: false,
  successHandoffId: null,
  navigationPending: false,
  elderReadOnlyDiagnosticClient: createElderRecordReadOnlyDiagnosticClientV1(),
  elderReadOnlyDiagnosticRunning: false,
})

const getPrivateState = (instance: object): AppointmentPagePrivateState => {
  const existing = pagePrivateState.get(instance)
  if (existing) return existing
  const created = createPrivateState()
  pagePrivateState.set(instance, created)
  return created
}

const readTextValue = (event: AppointmentInputEvent): string =>
  event && event.detail && typeof event.detail.value === 'string' ? event.detail.value : ''

const routeErrorMessage = (code: string): string => {
  if (code === 'ROUTE_RECORD_REVISION_INVALID') return '机构资料版本无效，请从合作机构列表重新打开机构详情。'
  return '预约入口缺少有效的机构资料，请先从合作机构列表选择机构。'
}

const elderPrepareMessage = (result: AppointmentElderPrepareResultV1): string => {
  if (result.kind === 'auth_required') return '当前登录状态暂不可用，请稍后重新发起预约。'
  if (result.kind === 'unavailable') return '老人档案暂不可用，表单内容已保留，请稍后重试。'
  return ''
}

const submissionErrorMessage = (code: string): string => {
  if (code === 'AUTH_REQUIRED') return '当前登录状态暂不可用，预约申请尚未确认提交。请稍后重新尝试。'
  if (code === 'CONTACT_REQUIRED') return '手机号授权未完成或与填写号码不一致，请检查号码后重新授权。'
  if (code === 'VALIDATION_FAILED') return '预约信息暂未通过服务端校验，请检查填写内容后重试。'
  if (code === 'REFERENCE_UNAVAILABLE') return '当前机构或预约信息暂不可用。资料版本不会自动切换，请返回机构详情重新确认。'
  if (code === 'IDEMPOTENCY_CONFLICT') return '本次预约提交与已有请求发生冲突。为避免重复申请，请返回机构详情后重新开始。'
  if (code === 'SERVICE_UNAVAILABLE') return '预约服务暂不可用，表单内容已保留，请稍后重试。'
  return '预约申请暂时无法确认，请保持填写内容不变，重新授权后安全重试。'
}

const updateFormField = (
  instance: WechatMiniprogram.Page.Instance<AppointmentCreatePageData, WechatMiniprogram.IAnyObject>,
  field: Exclude<AppointmentCreateFieldV1, 'institution'>,
  value: string,
): void => {
  const state = getPrivateState(instance)
  if (state.outcomeUnknown || state.prepareRunning || state.phoneRunning) return
  const errors: AppointmentCreateFormErrorsV1 = { ...instance.data.formErrors }
  delete errors[field]
  if (state.preparedElderId !== null) state.preparedElderId = null
  instance.setData({
    form: { ...instance.data.form, [field]: value },
    formErrors: errors,
    firstErrorAnchor: '',
    prepared: false,
    actionMessage: '',
    actionMessageTone: 'info',
    formLocked: false,
  })
}

const scrollToFirstError = (anchor: string): void => {
  if (!anchor) return
  wx.nextTick(() => {
    wx.pageScrollTo({ selector: `#${anchor}`, duration: 220 })
  })
}

const elderPreparedMessage = (): string =>
  '当前账号唯一绑定的老人档案已准备好。下一步将申请微信手机号，仅用于提交本次预约。'

const isAuthorizationDenied = (event: AppointmentInputEvent): boolean => {
  const errMsg = event && event.detail && event.detail.errMsg
  if (typeof errMsg !== 'string') return false
  const normalized = errMsg.toLowerCase()
  return normalized.indexOf('deny') >= 0 || normalized.indexOf('cancel') >= 0
}

const phoneCallbackMessage = (event: AppointmentInputEvent): string =>
  isAuthorizationDenied(event)
    ? '你未授权手机号，预约申请尚未提交。填写内容已保留，可重新操作。'
    : '未取得本次预约所需的手机号授权凭证，预约申请尚未提交。请重试。'

const navigateToSuccess = (
  instance: WechatMiniprogram.Page.Instance<AppointmentCreatePageData, WechatMiniprogram.IAnyObject>,
): void => {
  const state = getPrivateState(instance)
  if (!state.successHandoffId || state.navigationPending) return
  state.navigationPending = true
  instance.setData({ successNavigationFailed: false })
  let succeeded = false
  let failed = false
  const releaseWithError = (): void => {
    if (failed) return
    failed = true
    state.navigationPending = false
    instance.setData({
      successNavigationFailed: true,
      actionMessage: '预约申请已提交，但结果页暂时无法打开。可以重试查看，不会重复提交。',
      actionMessageTone: 'info',
    })
  }
  try {
    wx.redirectTo({
      url: `/pages/appointment/success?handoffId=${encodeURIComponent(state.successHandoffId)}`,
      success: () => { succeeded = true },
      fail: releaseWithError,
      complete: () => { if (!succeeded) releaseWithError() },
    })
  } catch (_error) {
    releaseWithError()
  }
}

const resolveInstitutionDisplayName = async (
  query: Record<string, string | undefined>,
  instance: WechatMiniprogram.Page.Instance<AppointmentCreatePageData, WechatMiniprogram.IAnyObject>,
  identity: { institutionId: string; recordRevision: number },
): Promise<void> => {
  const state = getPrivateState(instance)
  const handoffName = consumeAppointmentInstitutionDisplaySnapshotV1(
    identity.institutionId,
    identity.recordRevision,
  )
  if (handoffName) {
    const institution = { identity, displayName: handoffName }
    state.institution = institution
    instance.setData({
      pageState: 'ready',
      institution,
      pageTitle: '预约看院',
      pageDescription: '填写本次看院意向和联系人信息。提交后以服务端回执为准。',
    })
    return
  }

  try {
    const route = parseInstitutionDetailRouteQuery(query)
    if (!route.ok) {
      instance.setData({
        pageState: 'route_error',
        institution: null,
        pageTitle: '预约看院',
        pageDescription: routeErrorMessage(route.error.code),
      })
      return
    }
    const result = await buildInstitutionDetailPageSnapshot(route.value)
    if (!result.ok) {
      instance.setData({
        pageState: 'institution_unavailable',
        institution: null,
        pageTitle: '预约看院',
        pageDescription: '当前指定版本的机构资料暂不可用。页面不会自动切换到其他版本。',
      })
      return
    }
    const nameFact = result.value.sections.basic.name
    if (nameFact.availability !== 'provided' || typeof nameFact.value !== 'string'
      || nameFact.value.trim().length === 0) {
      instance.setData({
        pageState: 'institution_unavailable',
        institution: null,
        pageTitle: '预约看院',
        pageDescription: '当前指定版本没有可展示的机构名称，请返回合作机构列表重新选择。',
      })
      return
    }
    const institution: AppointmentCreateInstitutionV1 = {
      identity,
      displayName: nameFact.value,
    }
    state.institution = institution
    instance.setData({
      pageState: 'ready',
      institution,
      pageTitle: '预约看院',
      pageDescription: '填写本次看院意向和联系人信息。提交后以服务端回执为准。',
    })
  } catch (_error) {
    instance.setData({
      pageState: 'institution_unavailable',
      institution: null,
      pageTitle: '预约看院',
      pageDescription: '当前机构资料暂时无法读取，请稍后重试。页面不会自动切换版本。',
    })
  }
}

Page({
  data: {
    pageState: 'loading',
    pageTitle: '预约看院',
    pageDescription: '正在读取本次选择的机构资料。',
    institution: null,
    form: {
      visitDate: '',
      visitTimePreference: '',
      participantCount: '',
      contactName: '',
      phone: '',
      notes: '',
    },
    formErrors: {},
    firstErrorAnchor: '',
    actionMessage: '',
    actionMessageTone: 'info',
    preparingElder: false,
    prepared: false,
    phoneSubmitting: false,
    outcomeUnknown: false,
    terminalConflict: false,
    formLocked: false,
    receiptReady: false,
    successNavigationFailed: false,
    showElderReadOnlyDiagnostic: isElderRecordDiagnosticDevelopRuntimeV1(),
    elderDiagnosticState: 'idle',
  } as AppointmentCreatePageData,

  onLoad(query: Record<string, string | undefined>) {
    const state = createPrivateState()
    pagePrivateState.set(this, state)
    const parsed = parseInstitutionDetailRouteQuery(query)
    if (!parsed.ok) {
      this.setData({
        pageState: 'route_error',
        pageTitle: '预约看院',
        pageDescription: routeErrorMessage(parsed.error.code),
      })
      return
    }
    resolveInstitutionDisplayName(query, this, parsed.value.identity)
  },

  onShow() {
    resetNavigationGuard(this)
  },

  onChooseInstitution() {
    navigateToWithGuard(this, 'appointment.create.chooseInstitution', APPOINTMENT_LIST_URL, undefined, () => {
      this.setData({
        actionMessage: '暂时无法打开合作机构列表，请稍后重试。',
        actionMessageTone: 'error',
      })
    })
  },

  async onReadOnlyElderDiagnostic() {
    if (!isElderRecordDiagnosticDevelopRuntimeV1()) return
    const state = getPrivateState(this)
    if (state.elderReadOnlyDiagnosticRunning) return

    state.elderReadOnlyDiagnosticRunning = true
    try {
      this.setData({ elderDiagnosticState: 'loading' })
      const result = await state.elderReadOnlyDiagnosticClient.resolveCurrentElderRecordReadOnly()
      this.setData({ elderDiagnosticState: result.kind })
    } catch (_error) {
      this.setData({ elderDiagnosticState: 'service_unavailable' })
    } finally {
      state.elderReadOnlyDiagnosticRunning = false
    }
  },

  onVisitDateChange(event: AppointmentInputEvent) {
    updateFormField(this, 'visitDate', readTextValue(event))
  },

  onVisitTimePreferenceInput(event: AppointmentInputEvent) {
    updateFormField(this, 'visitTimePreference', readTextValue(event))
  },

  onParticipantCountInput(event: AppointmentInputEvent) {
    updateFormField(this, 'participantCount', readTextValue(event))
  },

  onContactNameInput(event: AppointmentInputEvent) {
    updateFormField(this, 'contactName', readTextValue(event))
  },

  onPhoneInput(event: AppointmentInputEvent) {
    updateFormField(this, 'phone', readTextValue(event))
  },

  onNotesInput(event: AppointmentInputEvent) {
    updateFormField(this, 'notes', readTextValue(event))
  },

  async onPrepareAppointment() {
    const state = getPrivateState(this)
    if (this.data.pageState !== 'ready' || state.prepareRunning || state.phoneRunning
      || state.outcomeUnknown || state.terminalConflict || this.data.receiptReady) return
    const validation = validateAppointmentCreateFormV1(this.data.form, state.institution)
    if (!validation.valid) {
      const order: AppointmentCreateFieldV1[] = [
        'institution', 'visitDate', 'visitTimePreference', 'participantCount', 'contactName', 'phone', 'notes',
      ]
      let firstError: AppointmentCreateFieldV1 | '' = ''
      for (let index = 0; index < order.length; index += 1) {
        if (validation.errors[order[index]]) {
          firstError = order[index]
          break
        }
      }
      const anchor = firstError && firstError !== 'institution' ? `appointment-field-${firstError}` : ''
      this.setData({
        formErrors: validation.errors,
        firstErrorAnchor: anchor,
        actionMessage: firstError === 'institution' ? validation.errors.institution || '' : '',
        actionMessageTone: 'error',
      })
      scrollToFirstError(anchor)
      return
    }

    state.prepareRunning = true
    state.preparedElderId = null
    this.setData({
      preparingElder: true,
      prepared: false,
      formLocked: true,
      actionMessage: '正在确认当前账号已绑定的老人档案。',
      actionMessageTone: 'info',
      formErrors: {},
      firstErrorAnchor: '',
    })
    let result: AppointmentElderPrepareResultV1
    try {
      result = await state.client.resolveOrEstablishElderAfterIntent()
    } catch (_error) {
      result = { kind: 'unavailable' }
    }
    state.prepareRunning = false
    if (result.kind !== 'ready') {
      this.setData({
        preparingElder: false,
        prepared: false,
        formLocked: false,
        actionMessage: elderPrepareMessage(result),
        actionMessageTone: 'error',
      })
      return
    }
    state.preparedElderId = result.elderId
    this.setData({
      preparingElder: false,
      prepared: true,
      formLocked: false,
      actionMessage: elderPreparedMessage(),
      actionMessageTone: 'info',
    })
  },

  async onPhoneAuthorization(event: AppointmentInputEvent) {
    const state = getPrivateState(this)
    if (state.phoneRunning || !this.data.prepared
      || !state.preparedElderId || !state.institution || state.terminalConflict) return
    const phoneCode = event && event.detail && typeof event.detail.code === 'string'
      ? event.detail.code : ''
    if (phoneCode.trim().length === 0) {
      this.setData({
        phoneSubmitting: false,
        actionMessage: phoneCallbackMessage(event),
        actionMessageTone: 'error',
      })
      return
    }

    const validation = validateAppointmentCreateFormV1(this.data.form, state.institution)
    if (!validation.valid) {
      state.preparedElderId = null
      this.setData({
        prepared: false,
        formErrors: validation.errors,
        phoneSubmitting: false,
        actionMessage: '预约信息发生变化，请检查表单后重新继续。',
        actionMessageTone: 'error',
      })
      return
    }

    state.phoneRunning = true
    this.setData({ phoneSubmitting: true, formLocked: true, actionMessage: '' })
    let result
    try {
      result = await state.client.submit({
        institution: state.institution,
        elderId: state.preparedElderId,
        form: this.data.form,
        phoneCode,
      })
    } catch (_error) {
      result = { kind: 'outcome_unknown' as const }
    }
    state.phoneRunning = false

    if (result.kind === 'accepted') {
      const normalized = validateAppointmentCreateFormV1(this.data.form, state.institution)
      if (!normalized.valid || !normalized.normalized) {
        state.outcomeUnknown = true
        this.setData({
          phoneSubmitting: false,
          outcomeUnknown: true,
          formLocked: true,
          actionMessage: '预约申请已收到服务端回执，但本地摘要无法校验。请从“我的预约”查看当前记录。',
          actionMessageTone: 'info',
        })
        return
      }
      const revision = String(state.institution.identity.recordRevision)
      const handoff = createAppointmentSuccessHandoffV1(result.receipt, {
        institutionId: state.institution.identity.institutionId,
        institutionRecordRevision: revision,
        institutionName: state.institution.displayName,
        visitDate: normalized.normalized.visitDate,
        visitTimePreference: normalized.normalized.visitTimePreference,
        participantCount: normalized.normalized.participantCount,
      })
      state.successHandoffId = handoff.id
      this.setData({
        phoneSubmitting: false,
        formLocked: true,
        receiptReady: true,
        actionMessage: '预约申请已提交，正在打开结果页。',
        actionMessageTone: 'info',
      })
      navigateToSuccess(this)
      return
    }

    if (result.kind === 'outcome_unknown' || result.kind === 'attempt_unresolved') {
      state.outcomeUnknown = true
      this.setData({
        phoneSubmitting: false,
        outcomeUnknown: true,
        formLocked: true,
        actionMessage: '提交结果暂时无法确认。请保持填写内容不变，重新授权后安全重试；若已提交，服务端会返回原结果。',
        actionMessageTone: 'error',
      })
      return
    }

    const isConflict = result.code === 'IDEMPOTENCY_CONFLICT'
    state.preparedElderId = null
    state.terminalConflict = isConflict
    this.setData({
      phoneSubmitting: false,
      prepared: false,
      formLocked: false,
      terminalConflict: isConflict,
      actionMessage: submissionErrorMessage(result.code),
      actionMessageTone: 'error',
    })
  },

  onRetrySuccessNavigation() {
    navigateToSuccess(this)
  },

  onReturnToInstitution() {
    navigateToWithGuard(this, 'appointment.create.returnInstitutionList', APPOINTMENT_LIST_URL, undefined, () => {
      this.setData({
        actionMessage: '暂时无法返回合作机构列表，请使用页面左上角返回。',
        actionMessageTone: 'error',
      })
    })
  },
})
