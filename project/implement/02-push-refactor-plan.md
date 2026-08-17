# Push 推送抽象实施计划

## 1. 目标目录结构

按应用领域拆分现有 `applications`，每个应用独立目录；应用原有 `utils` 合并到对应目录中。类型统一放在 `src/apps/push/types`。

```text
src/apps/push/
├─ controllers/
│  ├─ applications/
│  ├─ channels.controller.ts
│  └─ index.ts
├─ services/
│  ├─ adapters/
│  │  ├─ index.ts
│  │  ├─ push-adapter.interface.ts
│  │  └─ wxwork/
│  │     ├─ index.ts
│  │     ├─ wxwork.adapter.ts
│  │     ├─ wxwork-message-builder.ts
│  │     └─ wxwork-message-helper.ts
│  ├─ applications/
│  │  ├─ device/
│  │  │  ├─ device.service.ts
│  │  │  └─ device.util.ts
│  │  ├─ game-daily/
│  │  │  ├─ game-daily.service.ts
│  │  │  └─ game-daily.util.ts
│  │  ├─ mcserver/
│  │  │  ├─ mcserver.service.ts
│  │  │  └─ mcserver.util.ts
│  │  ├─ repo/
│  │  │  ├─ repo.service.ts
│  │  │  └─ repo.util.ts
│  │  ├─ weather/
│  │  │  └─ weather.service.ts
│  │  └─ index.ts
│  ├─ botkey-loader.ts
│  └─ push.service.ts
├─ types/
│  ├─ applications/
│  │  ├─ device.d.ts
│  │  ├─ game-daily.d.ts
│  │  ├─ mcserver.d.ts
│  │  ├─ repo.d.ts
│  │  └─ weather.d.ts
│  ├─ push-message.d.ts
│  ├─ push-channel.d.ts
│  └─ wxwork-webhook.d.ts
└─ push.module.ts
```

具体文件名可按项目现有导出习惯微调，但不再保留 `services/applications/utils` 和根部的通用 `wxw-message-helper.ts`。

## 2. 类型设计

新增统一的 channel 类型和消息类型：

```ts
export type PushChannel = 'wxwork' | 'qqbot';

export type PushChannels = Partial<Record<PushChannel, string>>;

export type PushMessageType =
  | 'game-daily'
  | 'weather'
  | 'repo'
  | 'mcserver'
  | 'device';
```

`details` 使用按 type 关联的泛型/重载，保证调用方不能把错误的 details 传给消息类型：

```ts
sendMessage(
  type: 'game-daily',
  channels: PushChannels,
  details: GameDailyPushDetails,
): Promise<PushSendResult>;
```

业务 details 表达业务事实，而不是企微 Markdown 结构。例如 game-daily details 包含游戏名、完成状态和详情数据；wxwork 适配器再决定如何渲染标题、颜色和 Markdown。

需要根据当前业务代码整理并补齐以下 details：

- `GameDailyPushDetails`
- `WeatherPushDetails`
- `RepoPushDetails`
- `McServerPushDetails`
- `DevicePushDetails`

repo 当前已经先生成 Markdown 文案，实施时应将这部分逐步收敛为 repo 业务 details；如果一次性拆分会显著扩大风险，可先定义能表达现有通知内容的结构，再由适配器完成企微格式转换。

## 3. PushService 改造

1. 将 `services/index.ts` 改为明确的 `push.service.ts`，并更新所有 import。
2. 注入适配器集合或使用明确的适配器映射，根据 `process.env.WEBHOOK_SEND_ADAPTER` 选择当前发送适配器。
3. 实现 `sendMessage(type, channels, details)`。
4. 在 `sendMessage` 内按 type 分发到内部的 `sendGameDaily`、`sendWeather`、`sendRepo`、`sendMcServer`、`sendDevice`。
5. 每个内部方法只负责调用当前适配器同名的业务发送方法，不构建企微协议。
6. 删除对外的 `sendTextMessage`、`sendMarkdownMessage`、`sendMarkdownInfoMessage`、`sendNewsMessage`、模板卡片方法和测试消息方法。
7. 保留 `getAvailableChannels`，但明确它是当前 `wxwork` 适配器的目标频道查询，不把它误认为所有适配器的频道集合。
8. 重新检查 `push.module.ts` 和 `applications.module.ts` 的 provider，避免 `PushService`、`BotKeyLoader` 被重复注册造成不同实例。

## 4. wxwork 适配器

1. 将现有 `wxw-message-helper.ts` 的 builder 和 helper 迁移到 `services/adapters/wxwork/`。
2. 将 `WxwMessage`、`WxwMarkdownInfo`、企微响应和 builder 类型统一迁移到 `src/apps/push/types/wxwork-webhook.*`，避免业务服务依赖它们。
3. 在 `WxworkAdapter` 中实现每一种业务消息方法：
   - `sendGameDaily`
   - `sendWeather`
   - `sendRepo`
   - `sendMcServer`
   - `sendDevice`
4. 适配器内部统一完成业务 details 到企微消息的转换。
5. 将现有企微 validation、timeout、webhook URL 和 bot key 逻辑迁入适配器边界。
6. 检查当前请求是否需要恢复旧注释中曾实现的重试逻辑；实施时以当前实际行为为基准，不额外扩大范围。
7. 当 `channels.wxwork` 缺失时记录 error 并跳过发送；日志中包含消息类型和适配器名，但不打印 webhook key。

## 5. 应用目录迁移

按应用逐个迁移，保持业务逻辑不变，仅替换推送调用和相对路径：

1. `game-daily`
   - 移动 service。
   - 将 `utils/game-daily.ts` 合并为 `game-daily.util.ts`。
   - 将 `WxwMarkdownInfo` 消息构建改为 `sendMessage('game-daily', channels, details)`。
2. `weather`
   - 移动 service。
   - 将天气告警改为 `weather` details。
3. `repo`
   - 移动 service。
   - 将 `utils/repo.ts` 合并为 `repo.util.ts`。
   - 将 GitHub 事件通知改为 repo details。
4. `mcserver`
   - 移动 service。
   - 将 `utils/mcserver.ts` 合并为 `mcserver.util.ts`。
   - 将服务器和玩家事件改为 mcserver details。
5. `device`
   - 移动 service。
   - 将设备告警改为 device details。

同步更新 controller、module、index 导出和所有测试 import。

## 6. 删除范围

删除以下不再需要的入口或能力：

- `messages.controller.ts` 中的 `:channel/msg`、`:channel/md`、`:channel/pt` 接口。
- `raw.controller.ts` 的两个 redirect 接口。
- `PushService` 的企微协议便捷发送公共方法。
- 业务服务对 `WxwMarkdownInfo` 的直接依赖。
- `services/applications/utils/` 目录。

删除前全仓检索旧方法和旧路径，确保没有残余调用。`channels.controller.ts` 是否保留取决于 `getAvailableChannels` 是否仍有使用价值；若保留，应在响应中说明当前适配器。

## 7. 测试计划

新增或调整以下测试：

- PushService 根据消息 type 调用正确的内部业务分发方法。
- PushService 根据 `WEBHOOK_SEND_ADAPTER=wxwork` 选择 wxwork 适配器。
- `channels.wxwork` 未提供时只记录 error，不调用 fetch，不抛出异常。
- wxwork 适配器正确把每种业务 details 转换为企微消息。
- wxwork webhook 成功响应、HTTP 错误、超时和企微错误码的处理。
- 旧 controller 路由不再注册。
- 现有 game-daily、weather、repo、mcserver、device 行为测试继续通过。

测试中通过替换 `process.env` 和 mock adapter/fetch 隔离环境变量与网络请求，不写入真实 webhook URL、key 或其他敏感配置。

## 8. 实施顺序

1. 创建统一类型和适配器接口。
2. 移动并整理应用目录和类型 import，不改变业务行为。
3. 抽取 wxwork 适配器，先保持现有企微渲染结果一致。
4. 重写 PushService 统一入口和适配器选择。
5. 迁移五个应用服务的推送调用。
6. 删除旧消息 controller、redirect controller 和旧公共发送方法。
7. 修改 `.env` 中的适配器变量名和值。
8. 更新 module/provider/export。
9. 执行格式检查、构建和测试，并全仓检索旧 API 残留。

## 9. 验收标准

- 应用只通过 `sendMessage(type, channels, details)` 发起业务推送。
- 业务层不 import 企微 webhook 类型。
- 当前 `WEBHOOK_SEND_ADAPTER=wxwork` 时，所有现有业务通知仍能发送到原目标频道。
- 未提供目标 channel 时只记录 error，不产生网络请求。
- 旧 `:channel/msg`、`:channel/md`、`:channel/pt` 路由不存在。
- 企微协议构建和 HTTP 细节只存在于 wxwork 适配器内。
- `npm run build` 和相关 Jest 测试通过。
