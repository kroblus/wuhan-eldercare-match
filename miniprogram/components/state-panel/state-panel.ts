Component({
  properties: {
    state: {
      type: String,
      value: 'empty',
    },
    title: {
      type: String,
      value: '暂时没有内容',
    },
    message: {
      type: String,
      value: '',
    },
    actionText: {
      type: String,
      value: '',
    },
  },
  methods: {
    onAction() {
      this.triggerEvent('action', {}, { bubbles: true, composed: true })
    },
  },
})
