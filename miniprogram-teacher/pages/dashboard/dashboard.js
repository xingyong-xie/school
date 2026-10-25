const api = require("../../utils/api");
const auth = require("../../utils/auth");
const session = require("../../utils/session");

Page({
  data: {
    loading: true,
    error: "",
    classes: [],
    selectedClassId: null,
    dashboard: null,
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
    this.setData({ loading: !this.data.dashboard, error: "" });
    try {
      const context = await session.ensureContext();
      if (!context.selectedClassId) {
        this.setData({
          classes: context.classes,
          selectedClassId: null,
          dashboard: null,
          loading: false,
        });
        return;
      }

      const dashboard = await api.dashboard(context.selectedClassId);
      this.setData({
        classes: dashboard.classes || context.classes,
        selectedClassId: dashboard.selectedClassId,
        dashboard,
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

  goStudents() {
    wx.navigateTo({ url: "/pages/students/students" });
  },

  goDiaries() {
    const classId = this.data.selectedClassId;
    wx.navigateTo({
      url: "/pages/diary-list/diary-list" + (classId ? "?classId=" + classId : ""),
    });
  },

  goSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" });
  },

  goFees() {
    wx.navigateTo({ url: "/pages/fees/fees" });
  },

  goAttendance() {
    wx.switchTab({ url: "/pages/attendance/attendance" });
  },

  goLeaves() {
    wx.switchTab({ url: "/pages/leaves/leaves" });
  },

  openStudent(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/student-detail/student-detail?id=" + id });
  },

  retry() {
    this.load();
  },
});
