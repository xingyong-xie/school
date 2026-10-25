Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    student: { type: Object, value: null },
  },
  data: {
    initial: "幼",
  },
  observers: {
    student(value) {
      this.setData({
        initial: value && value.name ? value.name.slice(0, 1) : "幼",
      });
    },
  },
  methods: {
    onTap() {
      if (!this.data.student) return;
      this.triggerEvent("studenttap", { id: this.data.student.id });
    },
  },
});
