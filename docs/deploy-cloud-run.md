# 微信云托管部署指南

本项目使用 Docker 容器部署到微信云托管，数据库为云托管 MySQL；小程序通过 `wx.cloud.callContainer` 调用，无需配置 request 合法域名。Web 管理端与 API 在同一个容器中。

## 0. 前置条件

- 已注册的小程序 **AppID**（不能使用 `touristappid`）。
- 微信云开发 / 云托管环境（与小程序同一主体）。
- 云托管 MySQL 实例。
- 本机安装 Docker（仅构建镜像、数据迁移时需要）。

## 1. 创建云托管服务

1. 在微信云托管控制台创建环境，并关联小程序 AppID。
2. 创建 MySQL 实例，记录：
   - 内网地址（host 或 host:port）
   - 数据库名（例如 `kindergarten`）
   - 用户名 / 密码
3. 创建服务，服务名例如 `kindergarten-web`（必须与 `miniprogram/utils/config.js` 的 `SERVICE` 一致）。
4. 服务端口填 **80**（容器内 `PORT=80`）。
5. 健康检查路径填 **`/api/health`**，期望 200。
6. 启动超时建议 **120 秒**，首次启动需要执行数据库迁移。

## 2. 配置环境变量

在云托管服务的环境变量中配置：

```env
MYSQL_ADDRESS=10.x.x.x:3306
MYSQL_USERNAME=app
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=kindergarten
AUTH_SECRET=<openssl rand -base64 48>
TZ=Asia/Shanghai
```

说明：

- 不需要设置 `DATABASE_URL`，入口脚本会自动拼接并做 URL 编码。
- `AUTH_SECRET` 必须替换为随机长字符串，否则会话可被伪造。
- `TZ` 必须为 `Asia/Shanghai`，否则凌晨的“今天/本月”会偏移。

## 3. 部署容器

### 方式 A：代码仓库部署

在云托管控制台选择从代码仓库部署，使用仓库根目录的 `Dockerfile`。

### 方式 B：本地构建并推送镜像

```bash
docker build -t kindergarten-web .
# 按控制台镜像仓库说明打 tag 并 push
```

容器启动流程（`docker/entrypoint.sh`）：

1. 由 `MYSQL_*` 拼接 `DATABASE_URL`（连接池 `connection_limit=5`）。
2. 执行 `prisma migrate deploy`。
3. 启动 `next start -p 80`。

镜像基于 `node:20-bookworm-slim`，构建阶段在 Linux 上执行 `prisma generate`，会自动生成对应的查询引擎。

## 4. 数据迁移

首次部署后，数据库是空的。二选一：

### 新环境：写入演示数据

在容器/任务中执行一次：

```bash
npm run db:seed
```

> 生产环境慎用，`seed` 会清空全部业务数据。

### 从旧 SQLite 迁移

导入脚本使用 Node 内置 `node:sqlite`，需要 Node 22.5+（推荐 Node 24）；应用运行时仍可使用 Node 20。

先在本地校验源数据：

```bash
npm run db:import -- --dry-run
```

预期行数：User 10 / Teacher 3 / SchoolClass 3 / Student 12 / Attendance 128 / LeaveRequest 4 / Schedule 60 / FeeItem 4 / Payment 32（以实际源库为准）。

写入云 MySQL 的方式：

**推荐：临时开放 MySQL 公网访问**

1. 在云数据库控制台临时开启公网地址，并用安全组限制为你的出口 IP。
2. 本地 `.env` 的 `DATABASE_URL` 指向该公网地址。
3. 执行：
   ```bash
   npm run db:import -- --yes --reset-target
   ```
4. 校验行数与最大 ID 输出全部为 OK。
5. 关闭公网访问。

**无公网 / 仅 VPC：导出 JSON 后导入**

```bash
# 本地导出（只读 SQLite）
npm run db:import -- --export data.sqlite.json
```

把 JSON 放入一个一次性任务或临时容器（能访问云 MySQL 的环境），执行：

```bash
npm run db:import -- --from-json data.sqlite.json --yes --reset-target
```

> `--reset-target` 会清空目标表，确认目标库正确后再执行。导入脚本默认 dry-run，必须显式 `--yes`。

## 5. 小程序配置

编辑 `miniprogram/utils/config.js`：

```js
const MODE = "cloud";
const ENV_ID = "<云开发环境 ID>";
const SERVICE = "kindergarten-web";
```

- 必须使用真实小程序 AppID，并在开发者工具中确认已关联云环境。
- `project.config.json` 中的 `appid` 从 `touristappid` 改为真实 AppID。
- 云托管调用不需要在公众平台配置 request 合法域名。
- 基础库需 ≥ 2.23.0（项目当前使用 3.4.0）。

本地调试可把 `MODE` 改为 `"http"`，继续请求 `http://localhost:3000`。

## 6. Web 管理端访问

- 云托管会提供默认 HTTPS 域名，可用于调试管理后台。
- 如果默认域名在微信内访问受限，建议绑定**自定义域名 + HTTPS 证书**；面向中国大陆用户时域名需备案。
- 生产环境 Cookie 带 `Secure`，必须通过 HTTPS 访问。
- 如果登录或表单提交报 Origin 校验错误，在 `next.config.mjs` 增加：
  ```js
  experimental: {
    serverActions: {
      allowedOrigins: ["你的域名"],
    },
  },
  ```
  然后重新构建。

## 7. 扩缩容与连接数

- 每个容器实例的 Prisma 连接池为 5（`connection_limit=5`）。
- **最大实例数 × 5 必须小于 MySQL 最大连接数**，否则会出现连接失败。
- 小规模使用建议最小实例 1、最大实例 3；若开启缩容到 0，需接受冷启动延迟。

## 8. 上线验收清单

- [ ] 容器日志显示 `prisma migrate deploy` 成功
- [ ] `/api/health` 返回 200
- [ ] Web 登录 `admin/admin123` 成功
- [ ] Web 提交一次表单（如新增考勤），确认 Server Actions 正常
- [ ] 小程序 `p001/parent123` 登录成功
- [ ] 家长只能看到自己的孩子；越权访问返回 404
- [ ] `t001` / `admin` 访问 `/api/miniapp/*` 返回 403
- [ ] 各表行数与源库一致
- [ ] 出生日期、缴费时间、当天考勤显示正确（时区 Asia/Shanghai）
- [ ] 重启服务不会重复建表或重复迁移

## 9. 常见问题

**Prisma 报找不到查询引擎**

镜像必须在 Linux 构建阶段执行 `prisma generate`；不要直接复制 Mac 上生成的 `node_modules`。

**健康检查一直失败**

检查 `MYSQL_*` 是否正确、MySQL 是否允许容器所在 VPC 访问，以及迁移是否超时（调大启动超时）。

**登录后立刻掉线 / Cookie 不生效**

生产环境 Cookie 为 `Secure`，请使用 HTTPS 访问；同时确认 `AUTH_SECRET` 已设置且未变更。

**时间显示差 8 小时**

容器未设置 `TZ=Asia/Shanghai`。

**小程序请求失败**

确认 `MODE="cloud"`、`ENV_ID` 与 `SERVICE` 正确、AppID 已关联云环境；本地 HTTP 模式则需要勾选“不校验合法域名”。
