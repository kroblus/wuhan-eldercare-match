Component({
  properties: {
    nextText: {
      type: String,
      value: '下一步',
    },
    backText: {
      type: String,
      value: '保存并退出',
    },
    nextDisabled: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    onBack() {
      this.triggerEvent('back', {}, { bubbles: true, composed: true })
    },
    onNext() {
      if (this.data.nextDisabled) {
        return
      }
      this.triggerEvent('next', {}, { bubbles: true, composed: true })
    },
  },
})
