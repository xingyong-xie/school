Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    leave: { type: Object, value: {} },
    showCancel: { type: Boolean, value: true },
  },
  methods: {
    onCancel() {
      this.triggerEvent("cancel", { id: this.data.leave.id });
    },
  },
});
