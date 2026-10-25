const auth = require("./utils/auth");
const config = require("./utils/config");

App({
  onLaunch() {
    if (config.mode === "cloud") {
      try {
        if (!wx.cloud) throw new Error("当前基础库不支持云开发");
        wx.cloud.init({ env: config.envId, traceUser: true });
        this.globalData.cloudReady = true;
      } catch (error) {
        console.error("[cloud] init failed", error);
      }
    }

    // 不在启动时强制跳转，由各页面 onShow 调用 ensureAuth 处理登录态。
    this.globalData.hasSession = auth.hasValidToken();
  },
  globalData: {
    hasSession: false,
    cloudReady: false,
    user: null,
    classes: [],
    selectedClassId: null,
  },
});
