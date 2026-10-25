const api = require("../../utils/api");
const auth = require("../../utils/auth");
const session = require("../../utils/session");

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

  onShow() {
    if (!auth.ensureAuth()) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh(),
    );
  },

  async load() {
    this.setData({ loading: !this.data.weekdays.length, error: "" });
    try {
      const context = await session.ensureContext();
      const data = await api.schedule(context.selectedClassId);
      const classes = data.classes || context.classes || [];
      let classIndex = 0;
      if (data.classId) {
        const index = classes.findIndex((item) => item.id === data.classId);
        if (index >= 0) classIndex = index;
      }
      const weekdays = data.weekdays || [];
      const hasItems = weekdays.some((day) => (day.items || []).length > 0);

      this.setData({
        classes,
        classNames: classes.map((item) => item.name),
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
    session.selectClass(e.detail.classId);
    this.load();
  },

  retry() {
    this.load();
  },
});
