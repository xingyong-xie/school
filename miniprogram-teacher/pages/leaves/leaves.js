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
    loading: true,
    error: "",
    status: "ALL",
    tabs: TABS.map((tab) => ({ ...tab, count: 0 })),
    leaves: [],
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
      this.setData({
        tabs: TABS.map((tab) => ({ ...tab, count: counts[tab.countKey] || 0 })),
        leaves: (data.leaves || []).map((leave) => ({
          ...leave,
          dateText: fmt.dateRangeText(leave.startDate, leave.endDate),
        })),
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onTabTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.status) return;
    this.setData({ status, leaves: [] });
    this.load();
  },

  onReview(e) {
    const id = Number(e.currentTarget.dataset.id);
    const decision = e.currentTarget.dataset.decision;
    const studentName = e.currentTarget.dataset.name;
    const approved = decision === "APPROVED";

    wx.showModal({
      title: approved ? "批准请假" : "驳回请假",
      content: studentName
        ? "为「" + studentName + "」" + (approved ? "批准" : "驳回") + "这条申请"
        : "",
      editable: true,
      placeholderText: "审批备注（可选）",
      confirmText: approved ? "批准" : "驳回",
      confirmColor: approved ? "#2e7d68" : "#c53030",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "处理中" });
        try {
          await api.reviewLeave(id, decision, res.content || "");
          wx.hideLoading();
          wx.showToast({
            title: approved ? "已批准" : "已驳回",
            icon: "success",
          });
          this.load();
        } catch (err) {
          wx.hideLoading();
          if (err.handled) return;
          wx.showToast({ title: err.message || "操作失败", icon: "none" });
        }
      },
    });
  },

  retry() {
    this.load();
  },
});
