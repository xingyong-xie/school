/**
 * 运行模式：
 * - "cloud"：微信云托管，通过 wx.cloud.callContainer 调用，无需配置 request 合法域名。
 *   需要真实小程序 AppID，并填写下方 ENV_ID / SERVICE。
 * - "http"：本地或普通 HTTPS 域名调试，使用 wx.request。
 */
const MODE = "http";

// 云开发环境 ID（微信云托管所属环境）
const ENV_ID = "your-cloud-env-id";
// 云托管服务名（控制台创建服务时的名称）
const SERVICE = "kindergarten-web";

const HTTP_HOSTS = {
  dev: "http://localhost:3000",
  prod: "https://your-domain.example.com",
};
const HTTP_ENV = "dev";

// 云托管服务的公网 HTTPS 域名，用于成长日记等 <image> 资源。
// 需要在公众平台「服务器域名 → downloadFile 合法域名」中加入该域名。
const MEDIA_HOST = "https://your-domain.example.com";

module.exports = {
  mode: MODE,
  envId: ENV_ID,
  service: SERVICE,
  apiPrefix: "/api",
  httpBaseURL: HTTP_HOSTS[HTTP_ENV] + "/api",
  mediaBaseURL: MODE === "cloud" ? MEDIA_HOST : HTTP_HOSTS[HTTP_ENV],
  showDemoHint: MODE === "http" && HTTP_ENV === "dev",
};
