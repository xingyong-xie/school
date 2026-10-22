/**
 * 运行模式：
 * - "cloud"：微信云托管，通过 wx.cloud.callContainer 调用，无需配置 request 合法域名。
 *   需要真实小程序 AppID，并填写下方 ENV_ID / SERVICE。
 * - "http"：本地或普通 HTTPS 域名调试，使用 wx.request。
 */
const MODE = "cloud";

// 云开发环境 ID（微信云托管所属环境）
const ENV_ID = "your-cloud-env-id";
// 云托管服务名（控制台创建服务时的名称）
const SERVICE = "kindergarten-web";

const HTTP_HOSTS = {
  dev: "http://localhost:3000",
  prod: "https://your-domain.example.com",
};
const HTTP_ENV = "dev";

module.exports = {
  mode: MODE,
  envId: ENV_ID,
  service: SERVICE,
  apiPrefix: "/api",
  httpBaseURL: HTTP_HOSTS[HTTP_ENV] + "/api",
  showDemoHint: MODE === "http" && HTTP_ENV === "dev",
};
