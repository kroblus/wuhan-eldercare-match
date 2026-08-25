Component({
  properties: {
    text: {
      type: String,
      value: '继续',
    },
    variant: {
      type: String,
      value: 'primary',
    },
    loading: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    block: {
      type: Boolean,
      value: true,
    },
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', {}, { bubbles: true, composed: true })
    },
  },
})
