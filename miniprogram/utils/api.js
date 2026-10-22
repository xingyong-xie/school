const { get, post } = require("./request");

module.exports = {
  login(username, password) {
    return post("/auth/login", { username, password });
  },
  me() {
    return get("/miniapp/me");
  },
  home() {
    return get("/miniapp/home");
  },
  child(id) {
    return get("/miniapp/children/" + id);
  },
  attendance(id, month) {
    return get(
      "/miniapp/children/" +
        id +
        "/attendance?month=" +
        encodeURIComponent(month || ""),
    );
  },
  fees(id) {
    return get("/miniapp/children/" + id + "/fees");
  },
  leaves(status) {
    return get("/miniapp/leaves?status=" + encodeURIComponent(status || "ALL"));
  },
  createLeave(payload) {
    return post("/miniapp/leaves", payload);
  },
  cancelLeave(id) {
    return post("/miniapp/leaves/" + id + "/cancel", {});
  },
  schedule(classId) {
    return get(
      "/miniapp/schedule" + (classId ? "?classId=" + encodeURIComponent(classId) : ""),
    );
  },
};
