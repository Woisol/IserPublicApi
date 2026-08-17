# QQ Bot Webhook 命令路由实施计划

## 1. 目标与边界

本阶段接入 QQ 官方机器人 Webhook 回调，入口固定为：

```text
POST /cb/qqmsg
```

第一版只实现命令路由，不实现通用聊天、AI 对话、消息历史或复杂会话状态。

第一版支持：

- QQ Webhook 回调地址验证。
- Ed25519 签名验证。
- `op = 0` 事件接收。
- HTTP Callback ACK。
- 群聊 @机器人命令。
- QQ 单聊命令。
- 命令解析、命令注册和 handler 分发。
- 使用 QQ 官方 API 对原事件进行被动回复。
- 基础事件去重。

第一版暂不支持：

- WebSocket Gateway。
- 全量群消息监听。
- 频道事件和频道命令。
- 富媒体命令参数。
- 多轮会话。
- 命令权限体系之外的复杂用户管理。

## 2. 当前已确认的 QQ 协议约束

### 回调验证

QQ 首次验证请求的 payload 中包含：

```json
{
  "op": 13,
  "d": {
    "plain_token": "...",
    "event_ts": "..."
  }
}
```

需要使用 Bot Secret 按官方规则生成 Ed25519 私钥，并对：

```text
event_ts + plain_token
```

进行签名，返回：

```json
{
  "plain_token": "...",
  "signature": "..."
}
```

### 普通事件

普通事件使用：

```json
{
  "op": 0,
  "t": "GROUP_AT_MESSAGE_CREATE",
  "s": 42,
  "d": {}
}
```

验签使用 HTTP 原始 body，签名内容为：

```text
X-Signature-Timestamp + rawBody
```

签名 header：

```text
X-Signature-Ed25519
X-Signature-Timestamp
```

### 命令事件

第一版处理：

- `GROUP_AT_MESSAGE_CREATE`
- `C2C_MESSAGE_CREATE`
- `GROUP_MESSAGE_CREATE`（全量群消息）

群消息事件中使用：

- `group_openid` 作为群目标。
- `id` 作为消息 ID。
- `content` 作为去除 @机器人前缀后的文本。
- `message_scene.ext` 中的 `msg_idx` 用于去重和引用上下文。

单聊事件中使用：

- `author.user_openid` 作为用户目标。
- `id` 作为消息 ID。
- `content` 作为命令文本。
- `message_scene.ext` 中的 `msg_idx` 用于去重。

## 3. 目录结构

在现有 push 模块下新增 QQ 回调和 QQ 适配器目录：

```text
src/apps/push/
├─ controllers/
│  ├─ callbacks/
│  │  ├─ qqbot-callback.controller.ts
│  │  └─ index.ts
│  └─ index.ts
├─ services/
│  ├─ adapters/
│  │  ├─ qqbot/
│  │  │  ├─ qqbot.adapter.ts
│  │  │  ├─ qqbot-auth.service.ts
│  │  │  ├─ qqbot-message.service.ts
│  │  │  ├─ qqbot-command-router.service.ts
│  │  │  └─ index.ts
│  │  └─ index.ts
│  ├─ callbacks/
│  │  ├─ qqbot-callback.service.ts
│  │  ├─ qqbot-signature.service.ts
│  │  ├─ qqbot-event-deduplicator.service.ts
│  │  └─ index.ts
│  └─ ...
├─ types/
│  ├─ qqbot.d.ts
│  ├─ qqbot.runtime.ts
│  └─ ...
└─ push.module.ts
```

具体文件可以按照现有导出习惯微调，但回调接收、签名校验、命令路由和 QQ 发送能力应保持独立职责。

## 4. 环境变量

新增以下环境变量：

```env
QQBOT_APP_ID=
QQBOT_APP_SECRET=
QQBOT_COMMAND_PREFIX=/
```

其中：

- `QQBOT_APP_ID`：官方 Bot AppID。
- `QQBOT_APP_SECRET`：官方 Bot Secret，用于获取 Access Token 和回调验签。
- `QQBOT_COMMAND_PREFIX`：默认 `/`。

不把任何 AppSecret、签名密钥或 Access Token 写入代码、测试 fixture 或日志。

启动时校验：

- 当 `WEBHOOK_SEND_ADAPTER=qqbot` 时，`QQBOT_APP_ID` 和 `QQBOT_APP_SECRET` 必须存在，否则应用启动失败。
- 当当前发送适配器不是 `qqbot` 时，不因为 QQ 配置缺失阻止应用启动，避免未启用的适配器影响其他环境。
- QQ 回调 controller 是否始终注册不影响启动；若未配置 QQ 凭证，回调请求应返回明确的服务未配置错误。

## 5. Channel 类型

保留字符串输入，并规定字符串默认表示 QQ 群：

```ts
export type QqbotChannel =
  | string
  | {
      type: 'group' | 'user' | 'guild-channel';
      id: string;
    };
```

示例：

```ts
{ qqbot: 'group-openid' }
```

等价于：

```ts
{
  qqbot: {
    type: 'group',
    id: 'group-openid',
  },
}
```

显式目标：

```ts
{
  qqbot: {
    type: 'user',
    id: 'user-openid',
  },
}
```

或：

```ts
{
  qqbot: {
    type: 'guild-channel',
    id: 'channel-id',
  },
}
```

QQ 适配器内部必须先标准化 channel，再根据目标类型选择不同的发送接口。不能把三种目标 ID 直接拼成一个 URL。

## 6. QQ 适配器与 Access Token

### `QqbotAuthService`

负责：

1. 调用：

   ```text
   POST https://api.bot.qq.com/app/getAppAccessToken
   ```

2. 使用 `AppID` 和 `AppSecret` 获取 Access Token。
3. 缓存 Access Token 和过期时间。
4. 在过期前刷新，建议提前 60 秒刷新。
5. 并发请求时复用同一个刷新 Promise，避免多个请求同时刷新 token。
6. 不在日志中输出 Access Token 或 Secret。

### `QqbotAdapter`

实现统一 `PushAdapter` 接口：

- `name = 'qqbot'`
- `sendGameDaily`
- `sendWeather`
- `sendRepo`
- `sendMcServer`
- `sendDevice`

消息渲染逻辑直接内联在每个 `sendXxx` 方法中，与当前 wxwork 适配器保持一致。QQ 适配器只使用业务 details，不依赖 wxwork 类型。

第一版消息能力：

- 文本消息。
- Markdown 消息，具体按目标接口支持情况发送。
- 暂不发送图片、文件和键盘。

发送请求统一使用：

```http
Authorization: QQBot ACCESS_TOKEN
Content-Type: application/json
```

群聊、单聊、频道使用不同 REST 接口和请求字段。对于字符串默认群目标，调用群消息接口。

### 被动回复

回调事件的被动回复必须携带原事件上下文：

- `msg_id` 或 `event_id`。
- `msg_seq` 按同一事件递增或使用稳定的初始值。

命令路由返回的回复结果应由 QQ message service 统一封装，业务 handler 不直接拼 URL、token 或 QQ 请求体。

## 7. Webhook Controller

新增 controller：

```ts
@Controller('cb')
export class QqbotCallbackController {
  @Post('qqmsg')
  handle(@Req() request: Request, @Res() response: Response) {}
}
```

`/cb/qqmsg` 必须排除现有 `AuthorityApiKeyMiddleware`。QQ 平台不会携带项目内部的 `authority-api-key`，回调安全性完全由 QQ 官方 Ed25519 签名校验负责。

### 原始 body

在 `main.ts` 创建 Nest app 时开启 raw body 支持，或使用 Express parser `verify` 保存原始字节：

```ts
NestFactory.create(AppModule, { rawBody: true })
```

使用 `request.rawBody` 进行验签，不使用 `JSON.stringify(request.body)` 重建签名内容。

如项目的 Express 类型没有 `rawBody` 字段，新增局部类型扩展，不使用全局 `any` 扩散。

### 请求处理顺序

1. 读取 raw body。
2. 校验签名 header。
3. 解析 QQ Payload。
4. `op = 13`：完成回调地址验证并返回 `plain_token` 与签名。
5. `op = 0`：处理事件。
6. 非支持事件：返回成功 ACK，不进入命令路由。
7. 重复事件：返回成功 ACK，不重复执行 handler。
8. 新事件：先快速返回 HTTP Callback ACK，再异步执行命令路由。

验签失败、payload 无法解析和配置缺失应返回合适的 4xx/5xx，不执行任何命令。

### ACK

普通事件采用 HTTP Callback ACK，避免 QQ 因超时重试：

```json
{
  "op": 12
}
```

命令处理不应阻塞回调 HTTP 响应。被动回复由后续 QQ REST API 请求发送。

## 8. 事件去重

新增轻量内存去重服务，至少使用以下优先级：

1. `message_scene.ext` 中的 `msg_idx`。
2. payload 顶层 `id`。

服务需要：

- 设置有限 TTL，例如 10 分钟。
- 只记录已接受处理的事件。
- 定期清理过期键，避免长期增长。
- 明确单实例内存去重不跨进程；当前服务为单实例部署时足够。
- 后续若水平扩展，再替换为 Redis 等共享存储。

## 9. 命令模型

### 标准化事件

回调服务先把 QQ 原始事件转换为平台无关的命令上下文：

```ts
export interface QqbotCommandContext {
  source: 'group' | 'user';
  target: {
    type: 'group' | 'user';
    id: string;
  };
  userId: string;
  messageId: string;
  eventId?: string;
  commandText: string;
  args: string[];
  rawEvent: unknown;
}
```

### 解析规则

1. 群聊使用 QQ 已移除 @前缀的 `content`，同时支持全量群消息 `GROUP_MESSAGE_CREATE`。
2. 单聊直接使用 `content`。
3. 去除首尾空白。
4. 只处理以 `QQBOT_COMMAND_PREFIX` 开头的文本。
5. 去掉前缀后按空白切分：

   ```text
   /status today
   ```

   解析为：

   ```ts
   command = 'status';
   args = ['today'];
   ```

6. 命令名称统一转小写。
7. 空命令返回帮助信息。
8. 未知命令返回简短提示，不回显敏感配置或内部异常。

### Handler 接口

```ts
export interface QqbotCommandHandler {
  readonly command: string;
  readonly aliases?: string[];
  handle(context: QqbotCommandContext):
    | Promise<string | QqbotReply>
    | string
    | QqbotReply;
}
```

`QqbotCommandRouterService` 负责：

- 注册 handler。
- 检测 command/alias 冲突并在启动时抛错。
- 根据命令名称选择 handler。
- 捕获 handler 异常并转换为通用错误回复。
- 将回复交给 QQ message service。

第一版至少注册：

- `help`：输出已注册命令列表。

业务命令不在本阶段凭空增加。后续将现有应用能力逐个包装成 handler，例如状态查询、游戏每日查询和天气检查。

## 10. 模块与依赖注入

`PushModule` 中注册：

- `QqbotAuthService`
- `QqbotAdapter`
- `QqbotSignatureService`
- `QqbotEventDeduplicatorService`
- `QqbotCommandRouterService`
- `QqbotCallbackService`
- `QqbotCallbackController`

QQ adapter 需要加入当前 `PUSH_ADAPTERS` 注册表，使：

```env
WEBHOOK_SEND_ADAPTER=qqbot
```

时 `PushService` 自动选择 QQ adapter。

如果 QQ adapter provider 已注册但当前环境没有启用 qqbot，不应提前获取 token；token 应在实际发送或回调回复时懒加载。

## 11. 测试计划

### 签名和回调

- 正确签名通过。
- 缺失签名 header 拒绝。
- 错误签名拒绝。
- `op = 13` 返回正确的 plain token 和签名。
- `op = 0` 返回 ACK。
- 非支持事件返回 ACK 且不执行命令。
- 重复事件只执行一次。

### Access Token

- 首次请求获取 token。
- 未过期时复用缓存。
- 接近过期时刷新。
- 并发请求只产生一次刷新请求。
- token 请求失败时不泄露 secret。

### Channel 和发送

- 字符串 channel 默认解析为 group。
- 显式 group/user/guild-channel 选择正确接口。
- `channels.qqbot` 缺失时记录 error，不产生发送请求。
- QQ API 错误响应转换为明确异常并记录安全日志。

### 命令路由

- 群聊 @命令正确解析。
- 单聊命令正确解析。
- 命令前缀不匹配时忽略。
- alias 正确分发。
- 空命令返回 help。
- 未知命令返回提示。
- handler 异常被隔离，不导致 webhook controller 抛出未处理异常。
- handler 回复携带正确 `msg_id`/目标上下文。
- 重复事件不重复回复。

测试只使用虚拟 AppID、Secret、签名和目标 ID，不写入真实凭证。

## 12. 实施顺序

1. 新增 QQ 类型、Payload、事件和命令上下文定义。
2. 调整 `QqbotChannel`，保留字符串默认群聊兼容形式。
3. 开启 Nest raw body 支持并新增签名服务。
4. 新增 QQ Access Token 缓存服务。
5. 新增 QQ message service 和 `QqbotAdapter`。
6. 将 QQ adapter 加入 `PUSH_ADAPTERS` 注册表。
7. 新增 QQ callback service/controller，注册 `/cb/qqmsg`。
8. 实现回调验证、验签、ACK 和事件去重。
9. 实现命令上下文标准化与 command router。
10. 注册 `help` handler，预留业务 handler 扩展点。
11. 新增单元测试和 controller 测试。
12. 更新 `.env` 示例，不写入敏感值。
13. 执行 build、Jest 和全仓残留检索。

## 13. 验收标准

- `POST /cb/qqmsg` 可通过 QQ 回调地址验证。
- 非法签名不会进入命令路由。
- 支持的 QQ 消息事件能在规定时间内返回 ACK。
- 重复事件不会重复执行命令。
- `/help` 能在群聊和单聊中正确回复。
- QQ 群字符串 channel 默认调用群消息接口。
- 显式 user/channel channel 调用对应接口。
- `WEBHOOK_SEND_ADAPTER=qqbot` 时 PushService 自动使用 QqbotAdapter。
- Access Token 自动缓存和刷新。
- QQ credentials 缺失时不会写入日志或错误响应。
- 不引入 WebSocket Gateway 连接。
- `npm run build` 和所有 Jest 测试通过。
