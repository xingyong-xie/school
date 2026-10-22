const api = require("../../utils/api");
const auth = require("../../utils/auth");

Page({
  data: {
    loading: true,
    error: "",
    classes: [],
    classNames: [],
    classIndex: 0,
    className: "",
    ageGroup: "",
    weekdays: [],
    hasItems: false,
  },

  onLoad(options) {
    this.initialClassId =
      options && options.classId ? Number(options.classId) : null;
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    this.load(this.initialClassId);
    this.initialClassId = null;
  },

  onPullDownRefresh() {
    const current = this.data.classes[this.data.classIndex];
    this.load(current ? current.id : null).then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh(),
    );
  },

  async load(classId) {
    this.setData({ loading: !this.data.weekdays.length, error: "" });
    try {
      const data = await api.schedule(classId);
      const classes = data.classes || [];
      let classIndex = 0;
      if (data.classId) {
        const index = classes.findIndex((item) => item.id === data.classId);
        if (index >= 0) classIndex = index;
      }
      const weekdays = data.weekdays || [];
      const hasItems = weekdays.some((day) => (day.items || []).length > 0);

      this.setData({
        classes,
        classNames: classes.map((item) => {
          const names = item.childNames || [];
          return names.length ? item.name + " · " + names.join("、") : item.name;
        }),
        classIndex,
        className: data.className || "",
        ageGroup: data.ageGroup || "",
        weekdays,
        hasItems,
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onClassChange(e) {
    const classIndex = Number(e.detail.value);
    const current = this.data.classes[classIndex];
    this.setData({ classIndex });
    if (current) this.load(current.id);
  },

  retry() {
    const current = this.data.classes[this.data.classIndex];
    this.load(current ? current.id : null);
  },
});
