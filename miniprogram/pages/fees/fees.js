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
    childName: "",
    summary: null,
    items: [],
    payments: [],
  },

  onLoad(options) {
    this.initialChildId =
      options && options.childId ? Number(options.childId) : null;
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    if (!this.data.children.length) {
      this.loadChildren();
      return;
    }
    if (this.initialChildId) {
      const index = this.data.children.findIndex(
        (child) => child.id === this.initialChildId,
      );
      this.initialChildId = null;
      if (index >= 0 && index !== this.data.childIndex) {
        this.setData({ childIndex: index });
      }
    }
    this.load();
  },

  onPullDownRefresh() {
    const work = this.data.children.length ? this.load() : this.loadChildren();
    work.then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh(),
    );
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
        this.initialChildId = null;
      }
      this.setData({
        children,
        childNames: children.map((child) => child.name),
        childIndex,
      });
      if (children.length) {
        await this.load();
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  async load() {
    const child = this.data.children[this.data.childIndex];
    if (!child) {
      this.setData({ loading: false, summary: null, items: [], payments: [] });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const data = await api.fees(child.id);
      const rawSummary = data.summary || {};
      const summary = {
        totalAmountText: fmt.fmtMoney(rawSummary.totalAmountCents),
        totalPaidText: fmt.fmtMoney(rawSummary.totalPaidCents),
        totalOutstandingText: fmt.fmtMoney(rawSummary.totalOutstandingCents),
        hasOutstanding: rawSummary.totalOutstandingCents > 0,
      };
      const items = (data.items || []).map((item) => {
        const statusInfo = labels.FEE_STATUS[item.status] || {
          label: "",
          tone: "gray",
        };
        return {
          ...item,
          statusLabel: statusInfo.label,
          tone: statusInfo.tone,
          amountText: fmt.fmtMoney(item.amountCents),
          paidText: fmt.fmtMoney(item.paidCents),
          remainingText: fmt.fmtMoney(item.remainingCents),
        };
      });
      const payments = (data.payments || []).map((payment) => ({
        ...payment,
        amountText: fmt.fmtMoney(payment.amountCents),
      }));

      this.setData({
        summary,
        items,
        payments,
        childName: child.name,
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onChildChange(e) {
    this.setData({ childIndex: Number(e.detail.value) });
    this.load();
  },

  retry() {
    if (this.data.children.length) this.load();
    else this.loadChildren();
  },
});
