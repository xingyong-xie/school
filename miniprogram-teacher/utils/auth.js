const KEY = "kg_teacher_token";
const LOGIN_URL = "/pages/login/login";

function getAuth() {
  try {
    return wx.getStorageSync(KEY) || null;
  } catch (e) {
    return null;
  }
}

function saveAuth(data) {
  wx.setStorageSync(KEY, {
    token: data.token,
    expiresAt: data.expiresAt,
    user: data.user,
  });
}

function clearAuth() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) {
    // ignore
  }
}

function hasValidToken() {
  const auth = getAuth();
  if (!auth || !auth.token) return false;
  if (auth.expiresAt) {
    const expiresAt = Date.parse(auth.expiresAt);
    if (!isNaN(expiresAt) && expiresAt <= Date.now() + 60 * 1000) {
      clearAuth();
      return false;
    }
  }
  return true;
}

function ensureAuth() {
  if (hasValidToken()) return true;
  wx.reLaunch({ url: LOGIN_URL + "?notice=expired" });
  return false;
}

function redirectToLogin() {
  clearAuth();
  wx.reLaunch({ url: LOGIN_URL + "?notice=expired" });
}

module.exports = {
  getAuth,
  saveAuth,
  clearAuth,
  hasValidToken,
  ensureAuth,
  redirectToLogin,
};
