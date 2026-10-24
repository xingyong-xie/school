const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");
const media = require("../../utils/media");

Page({
  data: {
    loading: true,
    error: "",
    children: [],
    childNames: [],
    childIndex: 0,
    month: fmt.monthString(),
    summary: null,
    entries: [],
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
      this.setData({ loading: false, summary: null, entries: [] });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const data = await api.diaries(child.id, this.data.month);
      const entries = (data.entries || []).map((entry) => ({
        ...entry,
        photoUrls: media.resolveUrls(
          (entry.photos || []).map((photo) => photo.url),
        ),
      }));
      this.setData({
        summary: data.summary || {},
        entries,
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

  onPhotoTap(e) {
    const entryIndex = Number(e.currentTarget.dataset.entry);
    const photoIndex = Number(e.currentTarget.dataset.photo);
    const entry = this.data.entries[entryIndex];
    if (!entry || !entry.photoUrls.length) return;
    wx.previewImage({
      current: entry.photoUrls[photoIndex],
      urls: entry.photoUrls,
    });
  },

  retry() {
    if (this.data.children.length) this.load();
    else this.loadChildren();
  },
});
