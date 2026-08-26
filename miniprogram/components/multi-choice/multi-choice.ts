Component({
  properties: {
    options: {
      type: Array,
      value: [],
    },
    values: {
      type: Array,
      value: [],
    },
    max: {
      type: Number,
      value: 0,
    },
  },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const value = event.currentTarget.dataset.value as string
      const currentValues = [...(this.data.values as string[])]
      const existingIndex = currentValues.indexOf(value)
      if (existingIndex >= 0) {
        currentValues.splice(existingIndex, 1)
      } else if (!this.data.max || currentValues.length < this.data.max) {
        currentValues.push(value)
      } else {
        this.triggerEvent('limit', { max: this.data.max }, { bubbles: true, composed: true })
        return
      }
      this.triggerEvent('change', { values: currentValues }, { bubbles: true, composed: true })
    },
  },
})
