Component({
  properties: {
    warmSwiss: { type: Boolean, value: false },
    title: {
      type: String,
      value: '',
    },
    hint: {
      type: String,
      value: '',
    },
    required: {
      type: Boolean,
      value: false,
    },
    error: {
      type: String,
      value: '',
    },
  },
})
