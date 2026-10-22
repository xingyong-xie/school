const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");

Page({
  data: {
    loading: true,
    error: "",
    children: [],
    childNames: [],
    childIndex: 0,
    month: fmt.monthString(),
    summary: null,
    records: [],
    lateHint: "",
  },

  onLoad(options) {
    this.initialChildId =
      options && options.childId ? Number(options.childId) : null;
  },

  onShow() {
    if (!auth.ensureAuth()) return;

    const app = getApp();
    if (app.globalData.selectedChildId) {
      this.initialChildId = app.globalData.selectedChildId;
      app.globalData.selectedChildId = null;
    }

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
      this.setData({ loading: false, summary: null, records: [] });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const data = await api.attendance(child.id, this.data.month);
      const summary = data.summary || {};
      this.setData({
        summary,
        records: data.records || [],
        lateHint: summary.lateDays ? "其中迟到 " + summary.lateDays + " 天" : "",
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

  onMonthChange(e) {
    this.setData({ month: e.detail.value });
    this.load();
  },

  prevMonth() {
    this.setData({ month: fmt.shiftMonth(this.data.month, -1) });
    this.load();
  },

  nextMonth() {
    this.setData({ month: fmt.shiftMonth(this.data.month, 1) });
    this.load();
  },

  retry() {
    if (this.data.children.length) this.load();
    else this.loadChildren();
  },
});
