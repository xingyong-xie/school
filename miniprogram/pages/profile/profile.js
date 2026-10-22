const api = require("../../utils/api");
const auth = require("../../utils/auth");

Page({
  data: {
    user: null,
    initial: "家",
    childrenCount: 0,
    version: "1.0.0",
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    const session = auth.getAuth();
    const user = session ? session.user : null;
    this.setData({
      user,
      initial: user && user.name ? user.name.slice(0, 1) : "家",
    });
    this.load();
  },

  async load() {
    try {
      const data = await api.me();
      this.setData({ childrenCount: data.childrenCount || 0 });
    } catch (err) {
      // 401 已由 request 统一跳转，其余静默处理。
    }
  },

  openSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" });
  },

  openFees() {
    wx.navigateTo({ url: "/pages/fees/fees" });
  },

  openLeaves() {
    wx.switchTab({ url: "/pages/leaves/leaves" });
  },

  onAbout() {
    wx.showModal({
      title: "关于奇奥德",
      content: "家长端 v" + this.data.version + "\n查看孩子考勤、请假与缴费情况。",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前家长账号吗？",
      confirmText: "退出",
      confirmColor: "#c53030",
      success: (res) => {
        if (!res.confirm) return;
        auth.clearAuth();
        wx.reLaunch({ url: "/pages/login/login" });
      },
    });
  },
});
