const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");
const media = require("../../utils/media");
const session = require("../../utils/session");

Page({
  data: {
    loading: true,
    error: "",
    month: fmt.monthString(),
    targetType: "CLASS",
    targetName: "",
    classId: null,
    studentId: null,
    summary: null,
    entries: [],
    hasPhotos: false,
  },

  onLoad(options) {
    this.studentId =
      options && options.studentId ? Number(options.studentId) : null;
    this.classId = options && options.classId ? Number(options.classId) : null;
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    this.prepare();
  },

  onPullDownRefresh() {
    this.prepare().then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh(),
    );
  },

  async prepare() {
    this.setData({ loading: !this.data.entries.length, error: "" });
    try {
      const context = await session.ensureContext();

      if (this.studentId) {
        const student = await api.student(this.studentId);
        this.setData({
          targetType: "CHILD",
          targetName: student.name,
          studentId: this.studentId,
          classId: null,
        });
      } else {
        const classId = this.classId || context.selectedClassId;
        if (!classId) {
          this.setData({
            loading: false,
            targetName: "",
            classId: null,
          });
          return;
        }
        const schoolClass = (context.classes || []).find(
          (item) => item.id === classId,
        );
        this.classId = classId;
        this.setData({
          targetType: "CLASS",
          targetName: schoolClass ? schoolClass.name : "班级",
          classId,
          studentId: null,
        });
      }

      await this.load();
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  async load() {
    const params = { month: this.data.month };
    if (this.studentId) params.studentId = this.studentId;
    else params.classId = this.classId;

    this.setData({ loading: !this.data.entries.length, error: "" });
    try {
      const data = await api.diaries(params);
      const entries = (data.entries || []).map((entry) => ({
        ...entry,
        photoUrls: media.resolveUrls(
          (entry.photos || []).map((photo) => photo.url),
        ),
      }));
      this.setData({
        summary: data.summary || {},
        entries,
        hasPhotos: entries.some((entry) => entry.photoUrls.length > 0),
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onMonthChange(e) {
    this.setData({ month: e.detail.value, entries: [] });
    this.load();
  },

  prevMonth() {
    this.setData({ month: fmt.shiftMonth(this.data.month, -1), entries: [] });
    this.load();
  },

  nextMonth() {
    this.setData({ month: fmt.shiftMonth(this.data.month, 1), entries: [] });
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

  writeDiary() {
    const query = this.studentId
      ? "studentId=" + this.studentId
      : "classId=" + this.classId;
    wx.navigateTo({ url: "/pages/diary-edit/diary-edit?" + query });
  },

  editEntry(e) {
    wx.navigateTo({
      url: "/pages/diary-edit/diary-edit?id=" + e.currentTarget.dataset.id,
    });
  },

  deleteEntry(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: "删除日记",
      content: "删除后无法恢复，确定删除这篇成长日记吗？",
      confirmText: "删除",
      confirmColor: "#c53030",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "删除中" });
        try {
          await api.deleteDiary(id);
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          this.load();
        } catch (err) {
          wx.hideLoading();
          if (err.handled) return;
          wx.showToast({ title: err.message || "删除失败", icon: "none" });
        }
      },
    });
  },

  retry() {
    this.prepare();
  },
});
