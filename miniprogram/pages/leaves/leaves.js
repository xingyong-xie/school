const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");

const TABS = [
  { key: "ALL", label: "全部", countKey: "all" },
  { key: "PENDING", label: "待审批", countKey: "pending" },
  { key: "APPROVED", label: "已批准", countKey: "approved" },
  { key: "REJECTED", label: "已驳回", countKey: "rejected" },
];

Page({
  data: {
    status: "ALL",
    tabs: TABS.map((tab) => ({ key: tab.key, label: tab.label, count: 0 })),
    leaves: [],
    loading: true,
    error: "",
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
    this.setData({ loading: !this.data.leaves.length, error: "" });
    try {
      const data = await api.leaves(this.data.status);
      const counts = data.counts || {};
      const tabs = TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        count: counts[tab.countKey] || 0,
      }));
      const leaves = (data.leaves || []).map((leave) => ({
        ...leave,
        dateText: fmt.dateRangeText(leave.startDate, leave.endDate),
      }));
      this.setData({ tabs, leaves, loading: false });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.status) return;
    this.setData({ status: key, leaves: [] });
    this.load();
  },

  onCancel(e) {
    const id = e.detail.id;
    if (!id) return;
    wx.showModal({
      title: "撤销请假",
      content: "确定撤销这条请假申请吗？",
      confirmText: "撤销",
      confirmColor: "#c53030",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.cancelLeave(id);
          wx.showToast({ title: "已撤销", icon: "success" });
          this.load();
        } catch (err) {
          if (err.handled) return;
          wx.showToast({ title: err.message || "撤销失败", icon: "none" });
        }
      },
    });
  },

  openCreate() {
    wx.navigateTo({ url: "/pages/leave-create/leave-create" });
  },

  retry() {
    this.load();
  },
});
