Component({
  properties: {
    warmSwiss: { type: Boolean, value: false },
    wideNext: { type: Boolean, value: false },
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
    backDisabled: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    onBackAction() {
      if (this.data.backDisabled) {
        return
      }
      this.triggerEvent('back', {}, { bubbles: false, composed: false })
    },
    onNextAction() {
      if (this.data.nextDisabled) {
        return
      }
      this.triggerEvent('next', {}, { bubbles: false, composed: false })
    },
  },
})
