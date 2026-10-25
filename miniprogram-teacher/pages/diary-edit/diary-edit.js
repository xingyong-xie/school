const api = require("../../utils/api");
const auth = require("../../utils/auth");
const diaries = require("../../utils/diaries");
const fmt = require("../../utils/format");
const media = require("../../utils/media");
const session = require("../../utils/session");

const MOOD_OPTIONS = [{ value: "", label: "不设置心情" }].concat(diaries.MOODS);

Page({
  data: {
    loading: true,
    error: "",
    saving: false,
    mode: "create",
    entryId: null,
    targetType: "CLASS",
    targetLabel: "",
    classId: null,
    classes: [],
    students: [],
    studentNames: [],
    studentIndex: 0,
    date: fmt.todayString(),
    title: "",
    content: "",
    moodOptions: MOOD_OPTIONS,
    moodLabels: MOOD_OPTIONS.map((item) => item.label),
    mood: "",
    moodIndex: 0,
    photos: [],
    maxPhotos: diaries.MAX_PHOTOS,
    canDelete: false,
  },

  onLoad(options) {
    this.localCounter = 0;
    this.removedPhotoIds = [];
    this.entryId =
      options && options.id ? Number(options.id) : null;
    this.initialStudentId =
      options && options.studentId ? Number(options.studentId) : null;
    this.initialClassId =
      options && options.classId ? Number(options.classId) : null;
  },

  onShow() {
    if (!auth.ensureAuth()) return;
    if (this.entryId) {
      this.setData({ mode: "edit", entryId: this.entryId, loading: true });
      this.loadEntry();
    } else {
      this.prepareCreate();
    }
  },

  async prepareCreate() {
    if (this.prepared) return;
    this.setData({ loading: true, error: "" });
    try {
      const context = await session.ensureContext();
      const classes = context.classes || [];
      const classId =
        this.initialClassId || context.selectedClassId || (classes[0] && classes[0].id);
      if (!classId) {
        this.setData({
          loading: false,
          error: "暂未分配班级，请联系园务管理员",
          classes,
        });
        return;
      }

      this.prepared = true;
      this.setData({ classes, classId, targetType: "CLASS" });
      await this.loadStudents(classId);

      if (this.initialStudentId) {
        await this.selectStudent(this.initialStudentId);
      }
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  async loadStudents(classId) {
    const data = await api.students(classId, "ACTIVE");
    const students = data.students || [];
    this.setData({
      students,
      studentNames: students.map((item) => item.name),
      studentIndex: 0,
      loading: false,
    });
    return students;
  },

  async selectStudent(studentId) {
    let students = this.data.students;
    if (!students.some((item) => item.id === studentId)) {
      students = await this.loadStudents(this.data.classId);
    }
    const index = students.findIndex((item) => item.id === studentId);
    if (index >= 0) {
      this.setData({
        targetType: "CHILD",
        studentIndex: index,
      });
    }
  },

  async loadEntry() {
    this.setData({ loading: true, error: "" });
    try {
      const entry = await api.diary(this.entryId);
      const moodIndex = Math.max(
        0,
        MOOD_OPTIONS.findIndex((item) => item.value === (entry.mood || "")),
      );
      const photos = (entry.photos || []).map((photo) => ({
        key: "photo-" + photo.id,
        id: photo.id,
        url: media.resolveMediaUrl(photo.url),
        local: false,
      }));

      this.setData({
        mode: "edit",
        entryId: entry.id,
        targetType: entry.target,
        targetLabel:
          entry.target === "CLASS"
            ? entry.className
            : entry.studentName,
        classId: entry.classId,
        studentId: entry.studentId,
        date: entry.date,
        title: entry.title || "",
        content: entry.content,
        mood: entry.mood || "",
        moodIndex,
        photos,
        canDelete: entry.canDelete,
        loading: false,
      });
    } catch (err) {
      if (err.handled) return;
      this.setData({ error: err.message || "加载失败", loading: false });
    }
  },

  onTargetType(e) {
    const targetType = e.currentTarget.dataset.type;
    if (targetType === this.data.targetType) return;
    this.setData({ targetType });
    if (targetType === "CHILD" && !this.data.students.length) {
      this.loadStudents(this.data.classId).catch((err) => {
        if (err.handled) return;
        wx.showToast({ title: err.message || "加载幼儿失败", icon: "none" });
      });
    }
  },

  onStudentChange(e) {
    this.setData({ studentIndex: Number(e.detail.value) });
  },

  async onClassChange(e) {
    const classId = e.detail.classId;
    session.selectClass(classId);
    this.setData({ classId, students: [], studentNames: [], studentIndex: 0 });
    if (this.data.targetType === "CHILD") {
      try {
        await this.loadStudents(classId);
      } catch (err) {
        if (err.handled) return;
        wx.showToast({ title: err.message || "加载幼儿失败", icon: "none" });
      }
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onMoodChange(e) {
    const moodIndex = Number(e.detail.value);
    this.setData({
      moodIndex,
      mood: MOOD_OPTIONS[moodIndex] ? MOOD_OPTIONS[moodIndex].value : "",
    });
  },

  async onAddPhoto() {
    const remaining = this.data.maxPhotos - this.data.photos.length;
    if (remaining <= 0) return;
    try {
      const tempFiles = await diaries.chooseImages(remaining);
      const photos = this.data.photos.slice();
      for (const file of tempFiles) {
        if (file.size && file.size > diaries.MAX_PHOTO_BYTES) {
          wx.showToast({
            title: "每张照片不能超过 2MB",
            icon: "none",
          });
          continue;
        }
        this.localCounter += 1;
        photos.push({
          key: "local-" + this.localCounter,
          tempFilePath: file.tempFilePath,
          local: true,
        });
      }
      this.setData({ photos });
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf("cancel") >= 0) return;
      wx.showToast({ title: "选择照片失败", icon: "none" });
    }
  },

  previewPhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const urls = this.data.photos.map(
      (photo) => photo.url || photo.tempFilePath,
    );
    if (!urls.length) return;
    wx.previewImage({ current: urls[index], urls });
  },

  onRemovePhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photo = this.data.photos[index];
    if (!photo) return;
    if (!photo.local && photo.id) {
      this.removedPhotoIds.push(photo.id);
    }
    const photos = this.data.photos.slice();
    photos.splice(index, 1);
    this.setData({ photos });
  },

  buildPayload() {
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: "请填写日记内容", icon: "none" });
      return null;
    }
    const payload = {
      date: this.data.date,
      title: this.data.title.trim(),
      content,
      mood: this.data.mood,
    };
    if (this.data.mode === "create") {
      if (this.data.targetType === "CHILD") {
        const student = this.data.students[this.data.studentIndex];
        if (!student) {
          wx.showToast({ title: "请选择幼儿", icon: "none" });
          return null;
        }
        payload.studentId = student.id;
      } else {
        if (!this.data.classId) {
          wx.showToast({ title: "请选择班级", icon: "none" });
          return null;
        }
        payload.classId = this.data.classId;
      }
    }
    return payload;
  },

  async onSave() {
    if (this.data.saving) return;
    const payload = this.buildPayload();
    if (!payload) return;

    this.setData({ saving: true });
    if (this.data.mode === "create") {
      await this.saveCreate(payload);
    } else {
      await this.saveEdit(payload);
    }
  },

  async saveCreate(payload) {
    let created = null;
    try {
      created = await api.createDiary(payload);
    } catch (err) {
      this.setData({ saving: false });
      if (err.handled) return;
      wx.showToast({ title: err.message || "发布失败", icon: "none" });
      return;
    }

    const localPhotos = this.data.photos.filter((item) => item.local);
    if (localPhotos.length) {
      try {
        await diaries.uploadPhotos(
          created.id,
          localPhotos.map((item) => ({ tempFilePath: item.tempFilePath })),
        );
      } catch (err) {
        let cleaned = false;
        try {
          await api.deleteDiary(created.id);
          cleaned = true;
        } catch (cleanupError) {
          // 保留已创建的日记，让教师进入编辑页补充照片。
        }
        if (cleaned) {
          this.setData({ saving: false });
          wx.showToast({
            title: err.message || "照片上传失败，日记未保存",
            icon: "none",
          });
          setTimeout(() => this.goBack(), 900);
        } else {
          this.entryId = created.id;
          this.setData({
            mode: "edit",
            entryId: created.id,
            canDelete: true,
            saving: false,
          });
          wx.showModal({
            title: "照片未全部上传",
            content: "日记已保存，但照片上传失败。请在编辑页重新添加照片。",
            showCancel: false,
            confirmText: "继续编辑",
            success: () => this.loadEntry(),
          });
        }
        return;
      }
    }

    wx.showToast({ title: "日记已发布", icon: "success" });
    setTimeout(() => this.goBack(), 700);
  },

  async saveEdit(payload) {
    try {
      await api.updateDiary(this.entryId, payload);
    } catch (err) {
      this.setData({ saving: false });
      if (err.handled) return;
      wx.showToast({ title: err.message || "保存失败", icon: "none" });
      return;
    }

    const localPhotos = this.data.photos.filter((item) => item.local);
    if (localPhotos.length) {
      try {
        await diaries.uploadPhotos(
          this.entryId,
          localPhotos.map((item) => ({ tempFilePath: item.tempFilePath })),
        );
      } catch (err) {
        this.setData({ saving: false });
        wx.showToast({
          title: err.message || "照片上传失败，请重试",
          icon: "none",
        });
        await this.loadEntry();
        return;
      }
    }

    for (const photoId of this.removedPhotoIds) {
      try {
        await api.removeDiaryPhoto(this.entryId, photoId);
      } catch (err) {
        this.setData({ saving: false });
        if (err.handled) return;
        wx.showToast({
          title: err.message || "部分照片删除失败",
          icon: "none",
        });
        await this.loadEntry();
        return;
      }
    }

    this.setData({ saving: false });
    wx.showToast({ title: "已保存", icon: "success" });
    setTimeout(() => this.goBack(), 700);
  },

  onDelete() {
    wx.showModal({
      title: "删除日记",
      content: "删除后无法恢复，确定删除这篇成长日记吗？",
      confirmText: "删除",
      confirmColor: "#c53030",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "删除中" });
        try {
          await api.deleteDiary(this.entryId);
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => this.goBack(), 600);
        } catch (err) {
          wx.hideLoading();
          if (err.handled) return;
          wx.showToast({ title: err.message || "删除失败", icon: "none" });
        }
      },
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.redirectTo({ url: "/pages/diary-list/diary-list" });
    }
  },

  retry() {
    if (this.data.mode === "edit") this.loadEntry();
    else {
      this.prepared = false;
      this.prepareCreate();
    }
  },
});
