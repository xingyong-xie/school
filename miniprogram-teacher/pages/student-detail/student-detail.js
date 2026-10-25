const api = require("../../utils/api");
const auth = require("../../utils/auth");

const GENDER_LABELS = { MALE: "男", FEMALE: "女" };
const STATUS_LABELS = { ACTIVE: "在园", GRADUATED: "已毕业", LEFT: "已离园" };

Page({
  data: {
    loading: true,
    error: "",
    student: null,
    initial: "幼",
  },

  onLoad(options) {
    this.studentId = options && options.id ? Number(options.id) : 0;
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
    if (!this.studentId) {
      this.setData({ loading: false, error: "幼儿参数无效" });
      return;
    }
    this.setData({ loading: !this.data.student, error: "" });
    try {
      const student = await api.student(this.studentId);
      this.setData({
        student: {
          ...student,
          genderLabel: GENDER_LABELS[student.gender] || "",
          statusLabel: STATUS_LABELS[student.status] || student.status,
        },
        initial: student.name ? student.name.slice(0, 1) : "幼",
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  callParent() {
    const parent = this.data.student && this.data.student.parent;
    if (!parent || !parent.phone) {
      wx.showToast({ title: "暂未登记联系电话", icon: "none" });
      return;
    }
    wx.makePhoneCall({ phoneNumber: parent.phone });
  },

  writeDiary() {
    wx.navigateTo({
      url: "/pages/diary-edit/diary-edit?studentId=" + this.studentId,
    });
  },

  openDiaries() {
    wx.navigateTo({
      url: "/pages/diary-list/diary-list?studentId=" + this.studentId,
    });
  },

  retry() {
    this.load();
  },
});
