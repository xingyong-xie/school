const { get, post, patch, del } = require("./request");

function query(params) {
  const parts = [];
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") return;
    parts.push(key + "=" + encodeURIComponent(value));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

module.exports = {
  login(username, password) {
    return post("/auth/login", { username, password });
  },
  me() {
    return get("/teacher/me");
  },
  dashboard(classId) {
    return get("/teacher/dashboard" + query({ classId }));
  },
  attendance(classId, date) {
    return get("/teacher/attendance" + query({ classId, date }));
  },
  saveAttendance(classId, date, rows) {
    return post("/teacher/attendance", { classId, date, rows });
  },
  leaves(status, classId) {
    return get("/teacher/leaves" + query({ status, classId }));
  },
  reviewLeave(id, decision, reviewNote) {
    return post("/teacher/leaves/" + id + "/review", {
      decision,
      reviewNote: reviewNote || "",
    });
  },
  students(classId, status) {
    return get("/teacher/students" + query({ classId, status }));
  },
  student(id) {
    return get("/teacher/students/" + id);
  },
  diaries(params) {
    return get("/teacher/diaries" + query(params));
  },
  diary(id) {
    return get("/teacher/diaries/" + id);
  },
  createDiary(payload) {
    return post("/teacher/diaries", payload);
  },
  updateDiary(id, payload) {
    return patch("/teacher/diaries/" + id, payload);
  },
  deleteDiary(id) {
    return del("/teacher/diaries/" + id);
  },
  addDiaryPhoto(id, dataBase64) {
    return post("/teacher/diaries/" + id + "/photos", { dataBase64 });
  },
  removeDiaryPhoto(id, photoId) {
    return del("/teacher/diaries/" + id + "/photos/" + photoId);
  },
  schedule(classId) {
    return get("/teacher/schedule" + query({ classId }));
  },
  fees(classId) {
    return get("/teacher/fees" + query({ classId }));
  },
};
