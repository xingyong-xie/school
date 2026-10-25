const api = require("./api");

const CLASS_KEY = "kg_teacher_class_id";

/** 拉取教师与班级上下文；force=true 时强制刷新。 */
async function ensureContext(force) {
  const app = getApp();
  if (!force && app.globalData.classes && app.globalData.classes.length) {
    return app.globalData;
  }

  const data = await api.me();
  const classes = data.classes || [];
  let selectedClassId =
    app.globalData.selectedClassId || wx.getStorageSync(CLASS_KEY) || null;
  if (!classes.some((item) => item.id === selectedClassId)) {
    selectedClassId = data.defaultClassId || (classes[0] ? classes[0].id : null);
  }

  app.globalData.user = data.user;
  app.globalData.classes = classes;
  app.globalData.selectedClassId = selectedClassId;
  if (selectedClassId) wx.setStorageSync(CLASS_KEY, selectedClassId);

  return app.globalData;
}

function selectClass(classId) {
  const app = getApp();
  app.globalData.selectedClassId = classId;
  wx.setStorageSync(CLASS_KEY, classId);
}

function currentClass() {
  const app = getApp();
  return (app.globalData.classes || []).find(
    (item) => item.id === app.globalData.selectedClassId,
  );
}

function clearContext() {
  const app = getApp();
  app.globalData.user = null;
  app.globalData.classes = [];
  app.globalData.selectedClassId = null;
  try {
    wx.removeStorageSync(CLASS_KEY);
  } catch (e) {
    // ignore
  }
}

module.exports = {
  ensureContext,
  selectClass,
  currentClass,
  clearContext,
};
