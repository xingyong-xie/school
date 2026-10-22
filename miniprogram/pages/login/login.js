const api = require("../../utils/api");
const auth = require("../../utils/auth");
const config = require("../../utils/config");

Page({
  data: {
    username: "",
    password: "",
    error: "",
    notice: "",
    loading: false,
    demo: config.showDemoHint,
  },

  onLoad(options) {
    if (auth.hasValidToken()) {
      wx.reLaunch({ url: "/pages/home/home" });
      return;
    }
    if (options && options.notice === "expired") {
      this.setData({ notice: "登录已过期，请重新登录" });
    }
  },

  onUsername(e) {
    this.setData({ username: e.detail.value, error: "" });
  },

  onPassword(e) {
    this.setData({ password: e.detail.value, error: "" });
  },

  onDemoTap() {
    this.setData({ username: "p001", password: "parent123", error: "" });
  },

  async onSubmit() {
    if (this.data.loading) return;
    const username = this.data.username.trim();
    const password = this.data.password;
    if (!username || !password) {
      this.setData({ error: "请输入账号和密码" });
      return;
    }

    this.setData({ loading: true, error: "", notice: "" });
    try {
      const data = await api.login(username, password);
      if (!data.user || data.user.role !== "PARENT") {
        this.setData({ error: "家长端仅供家长账号使用", loading: false });
        return;
      }
      auth.saveAuth(data);
      wx.reLaunch({ url: "/pages/home/home" });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "登录失败，请稍后再试", loading: false });
    }
  },
});
