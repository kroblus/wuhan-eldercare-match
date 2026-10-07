Component({
  properties: {
    warmSwiss: { type: Boolean, value: false },
    // Opt-in layout only; selection values and the change event stay unchanged.
    fullWidthOptions: { type: Object, value: {} },
    singleColumn: { type: Boolean, value: false },
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
