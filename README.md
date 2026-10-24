<p align="left"><img src="public/logo.jpg" alt="奇奥德幼儿园" width="120" /></p>

# 奇奥德幼儿园 · 教务管理系统

面向幼儿园的通用教务管理系统，覆盖幼儿档案、班级与教师管理、考勤登记、请假审批、班级课程表和收费管理，内置管理员、教师、家长三类角色。支持 Web 管理端与家长端微信小程序，可部署到微信云托管。

## 功能

| 模块 | 管理员 | 教师 | 家长 |
| --- | --- | --- | --- |
| 工作台 | 全园数据概览、待审批请假、收费进度 | 本班幼儿、今日考勤、待审批请假 | 孩子出勤、待缴费用、请假进度 |
| 幼儿档案 | 增删改查、绑定家长账号 | 查看本班幼儿 | 查看自己孩子 |
| 班级管理 | 创建、编辑、分配主班教师 | 查看负责班级 | — |
| 教师管理 | 创建教师账号、重置密码 | — | — |
| 考勤管理 | 所有班级登记 | 负责班级登记 | 查看孩子月度考勤 |
| 请假管理 | 审批全部申请 | 审批本班申请 | 提交/撤销申请 |
| 课程表 | 维护课程 | 查看本班 | 查看孩子班级 |
| 成长日记 | 编写/编辑/删除日记与照片（可关联幼儿或班级） | 记录本班幼儿与班级 | 查看孩子图文日记与班级日记 |
| 收费管理 | 收费项目、缴费登记、收缴统计 | 本班收费进度 | 应缴/已缴/待缴与记录 |

## 技术栈

- Next.js 14（App Router、Server Actions）
- React 18 + TypeScript
- Prisma 6 + MySQL 8（本地 Docker Compose / 微信云托管 MySQL）
- 手写 CSS 设计系统（无 UI 组件库）
- 认证：scrypt 密码哈希 + HMAC 签名的 HttpOnly Cookie，无第三方认证依赖
- 家长端微信小程序：原生 WXML / WXSS / JS，通过 `wx.cloud.callContainer` 或 `/api/miniapp/*` Bearer Token 接口访问同一套数据
- 部署：Docker 容器 + 微信云托管（`Dockerfile` / `docker-compose.yml`）

## 快速开始（本地）

```bash
docker compose up -d db   # 启动本地 MySQL（首次需等待 healthy）
npm install               # postinstall 会执行 prisma generate
npm run db:migrate        # 应用 prisma/migrations
npm run db:seed           # 写入演示数据（会清空现有数据）
npm run dev               # http://localhost:3000
```

一步重置数据库并写入演示数据：

```bash
npm run db:reset
```

如果要从旧版 SQLite 数据库迁移数据（保留原 ID 与关联；导入脚本使用 `node:sqlite`，需 Node 22.5+，推荐 Node 24）：

```bash
npm run db:import -- --dry-run                      # 只读取源库并打印统计
npm run db:import -- --yes --reset-target           # 写入 DATABASE_URL 指向的 MySQL
npm run db:import -- --export data.sqlite.json      # 导出 JSON
npm run db:import -- --from-json data.sqlite.json --yes --reset-target
```

## 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `admin123` |
| 教师 | `t001`、`t002`、`t003` | `teacher123` |
| 家长 | `p001` ～ `p006` | `parent123` |

新增幼儿时可顺带创建家长账号，登录账号为家长手机号，初始密码 `123456`；新增教师时初始密码同样默认为 `123456`。

## 家长端微信小程序

`miniprogram/` 是原生微信小程序，仅面向家长角色，提供：

- 首页：孩子档案、今日考勤、本月出勤、待缴费用、待审批请假、最近缴费
- 考勤：按孩子切换、按月查看考勤记录
- 请假：提交申请、按状态筛选、撤销待审批申请
- 收费：应缴 / 已缴 / 待缴、收费项目与缴费记录（只读，不接微信支付）
- 课程表：按孩子所在班级查看
- 成长日记：按孩子、月份查看图文日记，班级日记混排显示并带「班级」标识，支持照片大图预览
- 我的：账号信息、课程表入口、退出登录

### 运行模式

在 `miniprogram/utils/config.js` 中切换：

```js
const MODE = "cloud"; // "cloud"：微信云托管；"http"：本地/普通域名调试
const ENV_ID = "your-cloud-env-id";   // 云开发环境 ID
const SERVICE = "kindergarten-web";   // 云托管服务名
```

- **cloud**：通过 `wx.cloud.callContainer` 调用，不需要配置 request 合法域名。需要真实小程序 AppID，并关联同一主体的云开发环境。
- **http**：本地调试使用 `http://localhost:3000`，需在开发者工具中勾选「不校验合法域名」。
- 使用账号密码登录，不依赖 AppSecret / openid；管理员 / 教师账号可以登录但无法访问家长端接口（403）。

### 本地调试（HTTP 模式）

1. 保持 Web 端服务运行：`npm run dev`。
2. 打开微信开发者工具，导入目录 `miniprogram/`，AppID 可用 `touristappid`。
3. 将 `config.js` 的 `MODE` 设为 `"http"`，勾选「不校验合法域名」。
4. 使用 `p001 / parent123` 登录。

### 云托管发布

- 完整步骤见 [docs/deploy-cloud-run.md](docs/deploy-cloud-run.md)。
- 将 `MODE` 设为 `"cloud"`，填写 `ENV_ID` 和 `SERVICE`，并把 `project.config.json` 的 AppID 换成真实 AppID。
- 云托管服务端口 80，健康检查路径 `/api/health`。
- 发布前需注册正式小程序 AppID，并完成小程序备案。

## 常用命令

```bash
npm run dev            # 开发模式
npm run build          # 生产构建（含类型检查）
npm run start          # 启动生产服务
npm run typecheck      # 单独执行 TypeScript 类型检查
npm run db:migrate     # 应用 Prisma 迁移（prisma migrate deploy）
npm run db:migrate:dev # 修改 schema 后创建并应用迁移
npm run db:seed        # 写入/重置演示数据
npm run db:reset       # 重置数据库并自动 seed
npm run db:import      # SQLite -> MySQL 数据导入（默认 dry-run）
npx prisma studio      # 可视化管理数据
```

## 目录结构

```
prisma/
  schema.prisma                 # 数据模型（MySQL）
  migrations/                   # Prisma 迁移历史
  seed.js                       # 演示数据脚本
  import-sqlite.js              # 旧 SQLite 数据导入脚本
  dev.db                        # 旧 SQLite 数据（本地备份，不入库）
docker/
  entrypoint.sh                 # 云托管容器入口：迁移 + 启动
Dockerfile                      # 云托管镜像
docker-compose.yml              # 本地 MySQL
docs/
  deploy-cloud-run.md           # 微信云托管部署与数据迁移
miniprogram/                    # 家长端微信小程序（原生）
  pages/                        # 登录、首页、考勤、请假、收费、课表、成长日记、我的
  components/                   # 状态徽章、孩子卡片、统计块等
  utils/                        # 请求封装、登录态、格式化、主题色
src/
  actions/                      # Server Actions（按业务拆分，含权限校验）
  app/
    api/                        # 小程序 JSON 接口（Bearer Token）与健康检查
      auth/login/
      miniapp/
      health/
    login/                      # 登录页
    (portal)/                   # 登录后的后台页面与整体布局
  components/                   # 共享 UI 与服务端表单组件
  lib/
    auth.ts                     # 密码哈希、会话签名与读写（Cookie + Bearer 共用）
    guards.ts                   # 登录/角色/班级/孩子范围校验
    api.ts                      # 接口鉴权、JSON 解析、错误处理
    json.ts                     # 统一成功/错误响应格式
    services/                   # 登录、请假、家长收费等服务层
    db.ts                       # Prisma 单例
    constants.ts                # 枚举中文文案
    format.ts                   # 金额、日期、年龄格式化
    forms.ts                    # FormData 读取与跳转参数
    params.ts                   # searchParams 读取
```

## 环境变量

本地复制 `.env.example` 为 `.env`：

```env
DATABASE_URL="mysql://app:app_password@127.0.0.1:3306/kindergarten"
AUTH_SECRET="请替换为随机长字符串"
```

微信云托管（在服务环境变量中配置）：

```env
MYSQL_ADDRESS=10.x.x.x:3306
MYSQL_USERNAME=app
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=kindergarten
AUTH_SECRET=<随机长字符串>
TZ=Asia/Shanghai
```

容器启动时会用 `MYSQL_*` 拼接 `DATABASE_URL`，执行 `prisma migrate deploy` 后启动 Next.js。

生产注意：

1. 必须设置随机 `AUTH_SECRET`。
2. 通过 HTTPS 访问（生产环境 Cookie 带 `Secure`）。
3. 容器时区必须为 `Asia/Shanghai`，否则“今天/本月”在凌晨会偏移。
4. 不要在生产执行 `db:seed`，会清空数据。

## 数据说明

- 数据库为 MySQL 8，迁移文件在 `prisma/migrations/`。
- 所有金额以「分」存储（`amountCents`），避免浮点误差。
- 考勤日期、请假日期、收费截止日期使用 `YYYY-MM-DD` 字符串，避免时区偏移。
- 出生日期、缴费时间使用 `DateTime`；容器统一 `TZ=Asia/Shanghai`。
- 长文本字段（请假事由、备注、地址、收费说明）使用 MySQL `TEXT`。
- 收费项目的应缴总额按「项目金额 × 当前在园幼儿数」计算；小程序接口按收费项目逐项计算待缴余额（项目之间不互相抵扣）。
- 成长日记可关联某个幼儿或某个班级（二选一）；班级日记对该班全体家长可见。
- 成长日记照片以 BLOB 存入 MySQL（单张 ≤2MB，每篇最多 6 张），通过 `/api/diary-photos/[id]` 鉴权读取；Web 与小程序图片地址带短时媒体令牌（`?mt=`，6 小时有效），小程序需在公众平台配置 downloadFile 合法域名。
