const config = require("./config");
const auth = require("./auth");

function buildHeader() {
  const header = { "content-type": "application/json" };
  const session = auth.getAuth();
  if (session && session.token) {
    header.Authorization = "Bearer " + session.token;
  }
  if (config.mode === "cloud") {
    header["X-WX-SERVICE"] = config.service;
  }
  return header;
}

/** 两种调用方式的响应结构一致，统一在这里处理。 */
function normalize(res, path, resolve, reject) {
  const body = (res && res.data) || {};
  const error = body.error || {};
  const statusCode = res && res.statusCode;

  if (statusCode === 401) {
    if (path === "/auth/login") {
      reject({
        code: "UNAUTHORIZED",
        message: error.message || "账号或密码不正确",
      });
      return;
    }
    auth.redirectToLogin();
    reject({
      code: "UNAUTHORIZED",
      message: error.message || "登录已过期",
      handled: true,
    });
    return;
  }

  if (statusCode >= 200 && statusCode < 300 && body.ok) {
    resolve(body.data);
    return;
  }

  if (body.ok === false && error.message) {
    reject({
      code: error.code || "ERROR",
      message: error.message,
      status: statusCode,
      details: error.details || [],
    });
    return;
  }

  // 云托管网关自身的错误通常不是标准 envelope。
  reject({
    code: "ERROR",
    message: statusCode
      ? "服务暂不可用（" + statusCode + "）"
      : "请求失败，请稍后再试",
    status: statusCode,
  });
}

function networkError(reject, error) {
  console.error("[request]", error);
  reject({ code: "NETWORK", message: "网络连接失败，请检查网络后重试" });
}

function request(path, options) {
  const opts = options || {};
  const method = opts.method || "GET";
  const header = buildHeader();

  return new Promise((resolve, reject) => {
    if (config.mode === "cloud") {
      if (!wx.cloud || !wx.cloud.callContainer) {
        reject({
          code: "CLOUD_UNAVAILABLE",
          message: "当前微信版本不支持云托管调用，请升级微信",
        });
        return;
      }

      wx.cloud
        .callContainer({
          config: { env: config.envId },
          path: config.apiPrefix + path,
          method,
          header,
          data: opts.data,
          timeout: 10000,
        })
        .then((res) => normalize(res, path, resolve, reject))
        .catch((error) => networkError(reject, error));
      return;
    }

    wx.request({
      url: config.httpBaseURL + path,
      method,
      data: opts.data,
      header,
      timeout: 10000,
      success(res) {
        normalize(res, path, resolve, reject);
      },
      fail(error) {
        networkError(reject, error);
      },
    });
  });
}

function get(path) {
  return request(path);
}

function post(path, data) {
  return request(path, { method: "POST", data: data || {} });
}

module.exports = { request, get, post };
