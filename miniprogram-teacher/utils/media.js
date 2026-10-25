const config = require("./config");

/** 将服务端返回的相对图片地址拼接为可访问的完整地址。 */
function resolveMediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  const base = config.mediaBaseURL || "";
  return base.replace(/\/$/, "") + url;
}

function resolveUrls(urls) {
  return (urls || []).map(resolveMediaUrl);
}

module.exports = { resolveMediaUrl, resolveUrls };
