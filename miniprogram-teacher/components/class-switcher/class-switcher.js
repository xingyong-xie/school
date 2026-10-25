Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    classes: { type: Array, value: [] },
    value: { type: Number, value: 0 },
    placeholder: { type: String, value: "暂无班级" },
  },
  data: {
    names: [],
    index: 0,
  },
  observers: {
    "classes, value": function (classes, value) {
      const list = classes || [];
      const names = list.map((item) => item.name);
      let index = list.findIndex((item) => item.id === value);
      if (index < 0) index = 0;
      this.setData({ names, index });
    },
  },
  methods: {
    onChange(e) {
      const index = Number(e.detail.value);
      const item = this.data.classes[index];
      if (!item) return;
      this.setData({ index });
      this.triggerEvent("classchange", { classId: item.id, index });
    },
  },
});
