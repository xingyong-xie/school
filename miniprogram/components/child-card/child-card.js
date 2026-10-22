Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    child: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      this.triggerEvent("childtap", { id: this.data.child.id });
    },
  },
});
