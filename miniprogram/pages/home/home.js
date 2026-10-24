const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");

Page({
  data: {
    loading: true,
    error: "",
    home: null,
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
    this.setData({ loading: !this.data.home, error: "" });
    try {
      const home = await api.home();

      home.stats = home.stats || {};
      home.stats.outstandingText = fmt.fmtMoney(home.stats.outstandingCents);
      home.children = (home.children || []).map((child) => ({
        ...child,
        initial: child.name ? child.name.slice(0, 1) : "奇",
        outstandingText: fmt.fmtMoney(child.outstandingCents),
      }));
      home.pendingLeaves = (home.pendingLeaves || []).map((leave) => ({
        ...leave,
        dateText: fmt.dateRangeText(leave.startDate, leave.endDate),
      }));
      home.recentPayments = (home.recentPayments || []).map((payment) => ({
        ...payment,
        amountText: fmt.fmtMoney(payment.amountCents),
      }));

      this.setData({ home, loading: false });
      wx.setNavigationBarTitle({ title: "你好，" + home.greetingName });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  retry() {
    this.load();
  },

  openChild(e) {
    const id = e.detail.id;
    if (!id) return;
    getApp().globalData.selectedChildId = id;
    wx.switchTab({ url: "/pages/attendance/attendance" });
  },

  openAttendanceTab() {
    wx.switchTab({ url: "/pages/attendance/attendance" });
  },

  openLeaves() {
    wx.switchTab({ url: "/pages/leaves/leaves" });
  },

  openCreate() {
    wx.navigateTo({ url: "/pages/leave-create/leave-create" });
  },

  openFees() {
    wx.navigateTo({ url: "/pages/fees/fees" });
  },

  openSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" });
  },

  openDiaries() {
    const children = (this.data.home && this.data.home.children) || [];
    const suffix = children.length ? "?childId=" + children[0].id : "";
    wx.navigateTo({ url: "/pages/diary/diary" + suffix });
  },
});
