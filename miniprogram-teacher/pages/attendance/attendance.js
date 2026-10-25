const api = require("../../utils/api");
const auth = require("../../utils/auth");
const fmt = require("../../utils/format");
const labels = require("../../utils/labels");
const session = require("../../utils/session");

const STATUS_OPTIONS = ["PRESENT", "LATE", "SICK", "PERSONAL", "ABSENT"].map(
  (value) => ({ value, label: labels.ATTENDANCE_LABELS[value] }),
);

const STATUS_TONES = {
  PRESENT: "green",
  LATE: "amber",
  SICK: "blue",
  PERSONAL: "blue",
  ABSENT: "red",
};

Page({
  data: {
    loading: true,
    error: "",
    saving: false,
    dirty: false,
    classes: [],
    selectedClassId: null,
    date: fmt.todayString(),
    statusOptions: STATUS_OPTIONS,
    students: [],
    summary: { total: 0, recorded: 0, presentOrLate: 0 },
  },

  onLoad(options) {
    if (options && options.date) {
      this.setData({ date: options.date });
    }
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
    this.setData({ loading: !this.data.students.length, error: "" });
    try {
      const context = await session.ensureContext();
      if (!context.selectedClassId) {
        this.setData({
          classes: context.classes,
          selectedClassId: null,
          students: [],
          loading: false,
        });
        return;
      }

      const data = await api.attendance(context.selectedClassId, this.data.date);
      const students = (data.students || []).map((student) => {
        const draftStatus = student.status || "PRESENT";
        return {
          ...student,
          draftStatus,
          draftLabel: labels.ATTENDANCE_LABELS[draftStatus],
          draftTone: STATUS_TONES[draftStatus],
          draftNote: student.note || "",
        };
      });

      this.setData({
        classes: data.classes || context.classes,
        selectedClassId: data.classId,
        students,
        summary: data.summary || { total: 0, recorded: 0, presentOrLate: 0 },
        dirty: false,
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onClassChange(e) {
    session.selectClass(e.detail.classId);
    this.setData({ students: [] });
    this.load();
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value, students: [] });
    this.load();
  },

  onStatusTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = e.currentTarget.dataset.value;
    this.setData({
      ["students[" + index + "].draftStatus"]: value,
      ["students[" + index + "].draftLabel"]: labels.ATTENDANCE_LABELS[value],
      ["students[" + index + "].draftTone"]: STATUS_TONES[value],
      dirty: true,
    });
  },

  onNoteInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      ["students[" + index + "].draftNote"]: e.detail.value,
      dirty: true,
    });
  },

  markAllPresent() {
    const students = this.data.students.map((student) => ({
      ...student,
      draftStatus: "PRESENT",
      draftLabel: labels.ATTENDANCE_LABELS.PRESENT,
      draftTone: STATUS_TONES.PRESENT,
    }));
    this.setData({ students, dirty: true });
  },

  async onSave() {
    if (this.data.saving || !this.data.students.length) return;
    this.setData({ saving: true });
    try {
      await api.saveAttendance(
        this.data.selectedClassId,
        this.data.date,
        this.data.students.map((student) => ({
          studentId: student.id,
          status: student.draftStatus,
          note: student.draftNote || "",
        })),
      );
      wx.showToast({ title: "考勤已保存", icon: "success" });
      this.setData({ saving: false, dirty: false });
      await this.load();
    } catch (err) {
      this.setData({ saving: false });
      if (err.handled) return;
      wx.showToast({ title: err.message || "保存失败", icon: "none" });
    }
  },

  retry() {
    this.load();
  },
});
