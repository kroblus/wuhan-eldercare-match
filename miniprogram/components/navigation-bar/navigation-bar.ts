const pendingRootTabFallbacks = new WeakSet<object>()
const pendingBackOperations = new WeakMap<object, { succeeded: boolean }>()
type NavigationBarLayoutLifecycleMetadata = {
  __navigationBarLayoutRequestToken?: object
}

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {
    warmSwiss: { type: Boolean, value: false },
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    background: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: true
    },
    loading: {
      type: Boolean,
      value: false
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    animated: {
      // 显示隐藏的时候opacity动画效果
      type: Boolean,
      value: true
    },
    show: {
      // 显示隐藏导航，隐藏的时候navigation-bar的高度占位还在
      type: Boolean,
      value: true,
      observer: '_showChange'
    },
    // back为true的时候，返回的页面深度
    delta: {
      type: Number,
      value: 1
    },
    // 当前页面是根栈时的明确业务回退路径；为空时保留原有无导航行为。
    fallbackUrl: {
      type: String,
      value: ''
    },
    // TabBar destinations require switchTab; ordinary pages keep redirectTo.
    fallbackIsTab: {
      type: Boolean,
      value: false
    },
    // Opt-in for pages with an approved root fallback; legacy callers keep their behavior.
    guardBack: { type: Boolean, value: false },
    navigationFailureMessage: { type: String, value: '' },
  },
  /**
   * 组件的初始数据
   */
  data: {
    displayStyle: ''
  },
  lifetimes: {
    detached() {
      const layoutOwner = this as unknown as NavigationBarLayoutLifecycleMetadata
      layoutOwner.__navigationBarLayoutRequestToken = undefined
      pendingBackOperations.delete(this)
    },
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect()
      const layoutOwner = this as unknown as NavigationBarLayoutLifecycleMetadata
      const layoutRequestToken = {}
      layoutOwner.__navigationBarLayoutRequestToken = layoutRequestToken
      wx.getSystemInfo({
        success: (res) => {
          if (layoutOwner.__navigationBarLayoutRequestToken !== layoutRequestToken) return
          const isAndroid = res.platform === 'android'
          const isDevtools = res.platform === 'devtools'
          this.setData({
            ios: !isAndroid,
            innerPaddingRight: `padding-right: ${res.windowWidth - rect.left}px`,
            leftWidth: `width: ${res.windowWidth - rect.left }px`,
            safeAreaTop: isDevtools || isAndroid ? `height: calc(var(--height) + ${res.safeArea.top}px); padding-top: ${res.safeArea.top}px` : ``
          })
        }
      })
    },
  },
  pageLifetimes: {
    show() {
      // A source page shown again must be able to start a new Back operation.
      pendingBackOperations.delete(this)
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _guardedBack() {
      if (pendingBackOperations.has(this)) return
      const operation = { succeeded: false }
      pendingBackOperations.set(this, operation)
      const notifyFailure = () => {
        if (pendingBackOperations.get(this) !== operation || operation.succeeded) return
        pendingBackOperations.delete(this)
        if (this.data.navigationFailureMessage) {
          wx.showToast({ title: this.data.navigationFailureMessage, icon: 'none' })
        } else {
          this.triggerEvent('navigationfail', { action: 'back' }, { bubbles: false, composed: false })
        }
      }
      const callbacks = {
        success: () => { operation.succeeded = true },
        fail: notifyFailure,
        complete: () => { if (!operation.succeeded) notifyFailure() },
      }
      try {
        const pages = getCurrentPages()
        if (!Array.isArray(pages) || pages.length === 0) {
          notifyFailure()
          return
        }
        for (let index = 0; index < pages.length; index += 1) {
          const page = pages[index]
          if (!page || typeof page !== 'object' || typeof page.route !== 'string' || !page.route) {
            notifyFailure()
            return
          }
        }
        if (pages.length > 1) {
          const delta = this.data.delta
          if (!Number.isInteger(delta) || delta <= 0 || delta >= pages.length) {
            notifyFailure()
            return
          }
          wx.navigateBack({ delta, ...callbacks })
        } else if (this.data.fallbackUrl) {
          if (this.data.fallbackIsTab) {
            wx.switchTab({ url: this.data.fallbackUrl, ...callbacks })
          } else {
            wx.redirectTo({ url: this.data.fallbackUrl, ...callbacks })
          }
        } else {
          notifyFailure()
        }
      } catch (_error) {
        notifyFailure()
      }
    },
    _showChange(show: boolean) {
      const animated = this.data.animated
      let displayStyle = ''
      if (animated) {
        displayStyle = `opacity: ${
          show ? '1' : '0'
        };transition:opacity 0.5s;`
      } else {
        displayStyle = `display: ${show ? '' : 'none'}`
      }
      this.setData({
        displayStyle
      })
    },
    back() {
      if (this.data.guardBack) {
        this._guardedBack()
        return
      }
      const data = this.data
      const pages = getCurrentPages()
      const isRootTabFallback = pages.length <= 1 && Boolean(data.fallbackUrl && data.fallbackIsTab)
      let failureReported = false
      const notifyNavigationFailure = () => {
        if (failureReported) return
        failureReported = true
        if (isRootTabFallback) pendingRootTabFallbacks.delete(this)
        this.triggerEvent(
          'navigationfail',
          { action: 'back' },
          { bubbles: false, composed: false },
        )
      }
      if (pages.length > 1 && data.delta) {
        wx.navigateBack({
          delta: data.delta,
          fail: notifyNavigationFailure,
        })
      } else if (pages.length <= 1 && data.fallbackUrl) {
        const fallbackOptions = {
          url: data.fallbackUrl,
          fail: notifyNavigationFailure,
        }
        if (data.fallbackIsTab) {
          if (pendingRootTabFallbacks.has(this)) return
          pendingRootTabFallbacks.add(this)
          let succeeded = false
          try {
            wx.switchTab({
              url: data.fallbackUrl,
              success: () => { succeeded = true },
              fail: notifyNavigationFailure,
              complete: () => { if (!succeeded) notifyNavigationFailure() },
            })
          } catch (_error) {
            notifyNavigationFailure()
          }
        } else {
          wx.redirectTo(fallbackOptions)
        }
      }
      this.triggerEvent('back', { delta: data.delta }, { bubbles: false, composed: false })
    }
  },
})
