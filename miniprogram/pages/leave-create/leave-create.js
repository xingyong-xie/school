const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");
const labels = require("../../utils/labels");

Page({
  data: {
    loading: true,
    error: "",
    children: [],
    childNames: [],
    childIndex: 0,
    types: labels.LEAVE_TYPES,
    typeLabels: labels.LEAVE_TYPES.map((item) => item.label),
    typeIndex: 0,
    today: fmt.todayString(),
    startDate: fmt.todayString(),
    endDate: fmt.todayString(),
    reason: "",
    submitting: false,
  },

  onLoad(options) {
    this.initialChildId =
      options && options.childId ? Number(options.childId) : null;
    this.loadChildren();
  },

  async loadChildren() {
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.me();
      const children = data.children || [];
      let childIndex = 0;
      if (this.initialChildId) {
        const index = children.findIndex(
          (child) => child.id === this.initialChildId,
        );
        if (index >= 0) childIndex = index;
      }
      this.setData({
        children,
        childNames: children.map((child) => child.name),
        childIndex,
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onChildChange(e) {
    this.setData({ childIndex: Number(e.detail.value) });
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
  },

  onStartDate(e) {
    const startDate = e.detail.value;
    const endDate = this.data.endDate < startDate ? startDate : this.data.endDate;
    this.setData({ startDate, endDate });
  },

  onEndDate(e) {
    this.setData({ endDate: e.detail.value });
  },

  onReason(e) {
    this.setData({ reason: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!auth.ensureAuth()) return;

    const child = this.data.children[this.data.childIndex];
    const type = this.data.types[this.data.typeIndex];
    const reason = this.data.reason.trim();

    if (!child) {
      wx.showToast({ title: "请选择幼儿", icon: "none" });
      return;
    }
    if (!type) {
      wx.showToast({ title: "请选择请假类型", icon: "none" });
      return;
    }
    if (!reason) {
      wx.showToast({ title: "请填写请假事由", icon: "none" });
      return;
    }
    if (this.data.endDate < this.data.startDate) {
      wx.showToast({ title: "结束日期不能早于开始日期", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.createLeave({
        studentId: child.id,
        type: type.value,
        startDate: this.data.startDate,
        endDate: this.data.endDate,
        reason,
      });
      wx.showToast({ title: "已提交，等待审核", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/leaves/leaves" });
      }, 700);
    } catch (err) {
      if (err.handled) return;
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || "提交失败", icon: "none" });
    }
  },

  retry() {
    this.loadChildren();
  },
});
