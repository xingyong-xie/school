const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");
const session = require("../../utils/session");

function studentStatus(student) {
  if (student.outstandingCents <= 0) {
    return { statusLabel: "已缴清", tone: "green" };
  }
  if (student.paidCents > 0) {
    return { statusLabel: "部分缴纳", tone: "amber" };
  }
  return { statusLabel: "未缴费", tone: "red" };
}

Page({
  data: {
    loading: true,
    error: "",
    classes: [],
    selectedClassId: null,
    className: "",
    summary: null,
    feeItems: [],
    students: [],
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
    this.setData({ loading: !this.data.summary, error: "" });
    try {
      const context = await session.ensureContext();
      const data = await api.fees(context.selectedClassId);
      const summary = data.summary || {};
      this.setData({
        classes: data.classes || context.classes || [],
        selectedClassId: data.classId,
        className: data.className || "",
        summary: {
          ...summary,
          expectedText: fmt.fmtMoney(summary.expectedCents),
          paidText: fmt.fmtMoney(summary.paidCents),
          outstandingText: fmt.fmtMoney(summary.outstandingCents),
          rateText: (summary.collectionRate || 0) + "%",
        },
        feeItems: (data.feeItems || []).map((item) => ({
          ...item,
          amountText: fmt.fmtMoney(item.amountCents),
        })),
        students: (data.students || []).map((student) => ({
          ...student,
          expectedText: fmt.fmtMoney(student.expectedCents),
          paidText: fmt.fmtMoney(student.paidCents),
          outstandingText: fmt.fmtMoney(student.outstandingCents),
          ...studentStatus(student),
        })),
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onClassChange(e) {
    session.selectClass(e.detail.classId);
    this.setData({ summary: null, students: [], feeItems: [] });
    this.load();
  },

  retry() {
    this.load();
  },
});
