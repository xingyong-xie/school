const api = require("../../utils/api");
const auth = require("../../utils/auth");
const session = require("../../utils/session");

Page({
  data: {
    loading: true,
    error: "",
    classes: [],
    selectedClassId: null,
    className: "",
    ageGroup: "",
    status: "ACTIVE",
    students: [],
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
    this.setData({ loading: !this.data.students.length, error: "" });
    try {
      const context = await session.ensureContext();
      if (!context.selectedClassId) {
        this.setData({
          classes: context.classes,
          selectedClassId: null,
          students: [],
          loading: false,
        });
        return;
      }

      const data = await api.students(context.selectedClassId, this.data.status);
      this.setData({
        classes: data.classes || context.classes,
        selectedClassId: data.classId,
        className: data.className || "",
        ageGroup: data.ageGroup || "",
        students: data.students || [],
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onClassChange(e) {
    session.selectClass(e.detail.classId);
    this.setData({ students: [] });
    this.load();
  },

  onStatusTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.status) return;
    this.setData({ status, students: [] });
    this.load();
  },

  openStudent(e) {
    wx.navigateTo({
      url: "/pages/student-detail/student-detail?id=" + e.detail.id,
    });
  },

  retry() {
    this.load();
  },
});
