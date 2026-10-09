# ISer Public API

基于 [NestJS](https://nestjs.com/) 的私有通知推送与自动化服务。它把 GitHub、天气、设备、Minecraft 服务器、ComfyUI、游戏每日任务等事件，统一通过**企业微信机器人**或 **QQ 官方机器人**推送到指定群聊，并支持通过 QQ 机器人命令主动查询状态。

## 功能特性

- **多适配器推送**：通过 `WEBHOOK_SEND_ADAPTER` 在 `wxwork`（企业微信）与 `qqbot`（QQ 官方机器人）之间切换，业务层无需关心底层协议。
- **类型安全的消息入口**：`PushService.sendMessage(type, channels, details)` 按消息类型分发，`details` 与 `type` 强关联。
- **GitHub Webhook 通知**：接收协作者变更、Issue、Release、Workflow Run 等事件并推送。
- **天气降雨预警**：基于和风天气 API，每 30 分钟检查分钟级降水，每天早上 8 点检查全天降雨。
- **设备负载监控**：检测本机 CPU / 内存占用，连续高负荷时告警，并列出高占用进程。
- **Minecraft 服务器事件**：服务器启停、玩家加入 / 离开通知。
- **ComfyUI 生成结果**：生成成功 / 失败及参数通知。
- **游戏每日任务**：读取本地 BetterGI / March7thAssistant 日志，判断原神、星穹铁道的每日任务完成情况。
- **QQ 机器人命令**：`/help`、`/status`、`/weather`、`/wake`、`/game-daily` 等命令路由，支持群聊与单聊，含 Ed25519 验签与事件去重。
- **静态资源服务**：推送消息中的配图由 `/assets` 目录提供。

## 技术栈

- **运行时**：Node.js `>=20`，包管理使用 pnpm `8.10.0`
- **框架**：NestJS 11（Express 平台）、`@nestjs/schedule` 定时任务
- **构建**：Nest CLI + webpack（`nest-cli.json` 开启 webpack）
- **测试**：Jest
- **代码规范**：ESLint + Prettier，Husky pre-commit 钩子（格式化 + 测试）

## 目录结构

```text
src/
├─ main.ts                     # 启动入口（加载 .env、开启 rawBody）
├─ app.module.ts               # 根模块（静态资源、定时任务、鉴权中间件）
├─ app.controller.ts / .service.ts
├─ common/
│  ├─ middleware/              # AuthorityApiKeyMiddleware
│  └─ utils/                   # CompactLogger、格式化工具
├─ types/global.d.ts
└─ apps/push/                  # 推送核心模块
   ├─ push.module.ts
   ├─ applications/            # PushApplicationsModule（聚合控制器与 provider）
   ├─ controllers/
   │  ├─ applications/         # repo / weather / game-daily / mcserver / comfyui
   │  ├─ callbacks/            # QQ 回调控制器
   │  ├─ channels.controller.ts
   │  ├─ general.controller.ts
   │  └─ utils/query.ts        # query 参数解析
   ├─ services/
   │  ├─ push.service.ts       # 统一推送入口
   │  ├─ botkey-loader.ts      # 读取 bot-key.<adapter>.json
   │  ├─ adapters/             # wxwork / qqbot 适配器与消息渲染
   │  ├─ callbacks/            # QQ 验签、去重、命令路由与 handler
   │  └─ applications/         # 各业务应用服务
   └─ types/                   # 全局与各应用类型定义
assets/                        # 运行时静态资源（推送配图）
docs/                          # 功能文档
project/                       # 设计与迁移方案文档
```

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm 8.10.0

### 安装与运行

```bash
# 安装依赖
pnpm install

# 开发模式（watch）
pnpm run start:dev

# 构建
pnpm run build

# 生产模式运行
pnpm run start:prod
```

启动时会自动加载项目根目录的 `.env`（见 `src/main.ts`），服务默认监听 `SERVER_PORT`（默认 3000）。

### 环境变量

复制 `.env.example` 为 `.env` 并按需填写。主要变量如下（完整字段与注释以 `.env.example` 为准）：

| 变量 | 说明 |
| --- | --- |
| `SERVER_PORT` | 服务监听端口，默认 `3000` |
| `BASE_URL` | 对外可访问的基础地址，用于拼接推送图片链接 |
| `AUTHORITY_API_KEY` | 内部接口鉴权密钥 |
| `WEBHOOK_SEND_ADAPTER` | 发送适配器，`wxwork` 或 `qqbot` |
| `QQBOT_APP_ID` / `QQBOT_APP_SECRET` | QQ 官方机器人凭证，`WEBHOOK_SEND_ADAPTER=qqbot` 时必填 |
| `QQBOT_COMMAND_PREFIX` | QQ 命令前缀，默认 `/` |
| `QQBOT_COMMAND_WHITE_LIST` | 允许执行敏感命令（如 `/wake`）的用户 openid 列表，逗号分隔 |
| `WXWORK_WEBHOOK_URL` | 企业微信 webhook 基础地址，内部已内置，可按需覆盖 |
| `QWEATHER_LOCATION` | 和风天气监控位置（经纬度，最多两位小数） |
| `QWEATHER_API_KEY` / `QWEATHER_API_HOST` | 和风天气 API 密钥与主机 |
| `GAMELOG_BASEURL` | 游戏日志服务基础地址 |
| `GAMELOG_GENSHINLOGSURL` / `GAMELOG_STARRAILLOGSURL` | 原神 / 星穹铁道日志目录 |

> 请勿将真实密钥写入代码或提交到仓库，`.env` 已被 `.gitignore` 忽略。

### 机器人频道配置

频道与目标的映射保存在 `bot-key.<adapter>.json` 中（如 `bot-key.wxwork.json`、`bot-key.qqbot.json`），该文件同样被 `.gitignore` 忽略。文件缺失时会自动创建一个包含默认项 `{"general": ""}` 的空配置。

```json
{
  "general": "<企业微信 webhook key 或 QQ 群 openid>",
  "repo": "...",
  "weather": "...",
  "monitor": "...",
  "genshin": "...",
  "star_rail": "...",
  "mcserver": "..."
}
```

- `wxwork` 适配器中，值是企业微信机器人的 webhook `key`。
- `qqbot` 适配器中，值是 QQ 群的 `group_openid`（字符串 channel 默认按群处理）。

## HTTP 接口

除标注外，`/push/*` 路由均需在请求头携带 `authority-api-key`，其值为 `AUTHORITY_API_KEY` 的 MD5；`push/repo`、`push/game-daily` 以及 QQ 回调 `cb/qqmsg` 不经过该中间件鉴权。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 服务占位响应 |
| GET | `/push/channels` | 查询当前适配器下可用频道 |
| GET / POST | `/push/general` | 通用消息推送（`title`、`pic`、`details`） |
| POST | `/push/repo` | 接收 GitHub Webhook 事件 |
| GET / POST | `/push/weather/config` | 获取 / 更新天气监控配置 |
| GET | `/push/weather/check/minutely` | 手动触发分钟级降水检查 |
| GET | `/push/weather/check/daily` | 手动触发全天降雨检查 |
| GET | `/push/weather/status` | 天气服务状态 |
| GET | `/push/weather/health` | 天气服务健康检查 |
| GET / POST | `/push/game-daily` | 查询并推送游戏每日任务状态 |
| GET | `/push/game-daily/wake` | 唤醒电脑 |
| POST | `/push/mcserver` | MC 服务器事件 Webhook |
| GET / POST | `/push/mcserver/started` \| `stopped` \| `player-join` \| `player-leave` | 手动触发服务器 / 玩家事件 |
| GET / POST | `/push/comfyui` | ComfyUI 生成结果推送 |
| POST | `/cb/qqmsg` | QQ 官方机器人回调（Ed25519 验签） |
| GET | `/assets/**` | 静态资源 |

> 业务行为相同、仅请求方法不同的参数型路由使用同一个控制器方法同时绑定 GET 与 POST；参数优先从非空 body 解析，body 为空时回退到 query。

## 推送架构

业务服务只调用统一的 `PushService`，由适配器负责把业务 `details` 转换为各平台协议：

```ts
// 消息类型：game-daily | weather | repo | mcserver | device | comfyui | general
await pushService.sendMessage('game-daily', 'genshin', details);
```

- `PushService` 根据 `WEBHOOK_SEND_ADAPTER` 选择已注册的适配器（`wxwork` 或 `qqbot`）。
- 适配器实现 `PushAdapter` 接口，将业务数据渲染为企业微信 Markdown / 文本，或 QQ Markdown / 文本。
- `channels` 支持字符串（按适配器默认语义）或 `{ wxwork, qqbot }` 映射，用于按适配器指定不同目标频道。
- `PushMessageDetailsMap` 保证每种 `type` 只能传入对应的 `details` 类型。

## 部署

项目通过 GitHub Actions（`.github/workflows/deploy-iser-public-api.yml`）在 `main` 分支 push 时，于 self-hosted runner 上构建并发布：

1. `pnpm install` + `pnpm run build`。
2. 将 `dist`、`assets`、`package.json`、`ecosystem.config.js` 复制到 `~/servers/iser-public-api`。
3. 使用 `ecosystem.config.js` 以 production 环境启动 PM2 进程并 `pm2 save`。

生产环境约定：

- 端口 `6990`，应用入口为构建后的 `main.js`。
- PM2 应用名 `ISerPublicApi`，单实例 fork 模式，最大内存 200M。
- 运行时静态资源 `assets` 必须与产物一同发布，不能只发布 `dist`。
- 敏感配置通过 GitHub Secrets 注入，不写入仓库。

## 测试

```bash
# 单元测试
pnpm run test

# watch 模式
pnpm run test:watch

# 覆盖率
pnpm run test:cov

# e2e
pnpm run test:e2e

# 代码检查与格式化
pnpm run lint
pnpm run format
```

## 相关文档

- `docs/push/applications/weather-monitor.md`：天气监控服务说明
- `project/implement/`：推送抽象、QQ 命令等设计与实施计划
- `project/docs/`：CI 迁移与部署方案

## 许可证

MIT
