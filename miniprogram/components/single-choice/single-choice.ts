Component({
  properties: {
    options: {
      type: Array,
      value: [],
    },
    value: {
      type: String,
      value: '',
    },
  },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const value = event.currentTarget.dataset.value as string
      this.triggerEvent('change', { value }, { bubbles: true, composed: true })
    },
  },
})
