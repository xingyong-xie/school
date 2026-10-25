const auth = require("../../utils/auth");
const session = require("../../utils/session");

Page({
  data: {
    user: null,
    classes: [],
    initial: "师",
    version: "1.0.0",
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    const saved = auth.getAuth();
    const user = saved ? saved.user : null;
    this.setData({
      user,
      initial: user && user.name ? user.name.slice(0, 1) : "师",
    });
    this.loadContext();
  },

  async loadContext() {
    try {
      const context = await session.ensureContext();
      this.setData({ classes: context.classes || [], user: context.user || this.data.user });
    } catch (err) {
      if (err.handled) return;
    }
  },

  openStudents() {
    wx.navigateTo({ url: "/pages/students/students" });
  },

  openDiaries() {
    const context = getApp().globalData;
    wx.navigateTo({
      url:
        "/pages/diary-list/diary-list" +
        (context.selectedClassId ? "?classId=" + context.selectedClassId : ""),
    });
  },

  openSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" });
  },

  openFees() {
    wx.navigateTo({ url: "/pages/fees/fees" });
  },

  onAbout() {
    wx.showModal({
      title: "关于教师端",
      content: "奇奥德幼儿园教师工作台，用于考勤登记、请假审批、成长日记与班级信息查看。",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前教师账号吗？",
      confirmText: "退出",
      confirmColor: "#c53030",
      success: (res) => {
        if (!res.confirm) return;
        auth.clearAuth();
        session.clearContext();
        wx.reLaunch({ url: "/pages/login/login" });
      },
    });
  },
});
