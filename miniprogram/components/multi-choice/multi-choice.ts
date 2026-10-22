interface MultiChoiceOption {
  value: string
  label: string
}

interface RenderedMultiChoiceOption extends MultiChoiceOption {
  selected: boolean
}

const buildRenderedOptions = (
  options: readonly MultiChoiceOption[],
  values: readonly string[],
): RenderedMultiChoiceOption[] => options.map((option) => ({
  ...option,
  selected: values.indexOf(option.value) >= 0,
}))

Component({
  properties: {
    warmSwiss: { type: Boolean, value: false },
    // Opt-in layout only; selection values and the change/limit events stay unchanged.
    fullWidthOptions: { type: Object, value: {} },
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
  data: {
    renderedOptions: [] as RenderedMultiChoiceOption[],
  },
  observers: {
    'options, values'(options: MultiChoiceOption[], values: string[]) {
      this.setData({
        renderedOptions: buildRenderedOptions(
          Array.isArray(options) ? options : [],
          Array.isArray(values) ? values : [],
        ),
      })
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
