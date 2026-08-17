# Push 推送抽象调研

## 1. 当前实现

当前 `PushService` 位于 `src/apps/push/services/index.ts`，职责混合在一个类中：

- 从环境变量读取企微 webhook 基础地址。
- 通过 `BotKeyLoader` 根据目标频道读取 `bot-key.json` 中的 key。
- 构建企微 text、markdown、news、template card 等协议消息。
- 校验企微协议消息。
- 执行 webhook HTTP 请求、超时控制、日志记录。
- 对外暴露 `sendTextMessage`、`sendMarkdownMessage`、`sendMarkdownInfoMessage`、`sendNewsMessage` 等企微协议方法。

`src/apps/push/services/wxw-message-helper.ts` 同时包含企微消息 builder 和通知辅助方法。现有业务服务直接依赖这些企微协议方法，因此业务层与企业微信协议耦合。

## 2. 现有调用方

业务发送调用分布在以下服务：

- `services/applications/game-daily.service.ts`
- `services/applications/weather.service.ts`
- `services/applications/repo.service.ts`
- `services/applications/mcserver.service.ts`
- `services/applications/device.service.ts`

现有消息主要是结构化 Markdown，也有天气文本消息。原始 `messages.controller.ts` 提供的 `:channel/msg`、`:channel/md`、`:channel/pt` 接口已确认不再保留，因此对应 controller、raw redirect controller 和旧便捷发送方法都应删除或不再作为公共 API。

## 3. channel 语义

需要区分两个概念：

- `sendAdapter`：发送适配器类型，例如 `wxwork`，由 `.env` 配置。
- `channel`：某个发送适配器下的目标频道。不同适配器的频道标识可能不同。

统一入口采用三个参数：

```ts
pushService.sendMessage(type, channels, details)
```

其中 `channels` 为可选的适配器到目标频道映射：

```ts
Partial<Record<PushChannel, string>>
```

示例：

```ts
pushService.sendMessage(
  'game-daily',
  { wxwork: 'genshin', qqbot: 'genshin-group' },
  details,
)
```

当前环境变量最终命名为：

```env
WEBHOOK_SEND_ADAPTER=wxwork
```

## 4. 目标边界

业务 details 类型不允许直接使用 `WxwMarkdownInfo` 等企微协议类型。企微消息 builder、企微协议校验、bot key 读取和 webhook 请求全部下沉到 `wxwork` 适配器内部。

`PushService` 负责：

- 对外提供类型安全的 `sendMessage` 入口。
- 按消息 type 分发到 `sendGameDaily`、`sendWeather`、`sendRepo`、`sendMcServer`、`sendDevice` 等内部方法。
- 根据 `.env` 的 `WEBHOOK_SEND_ADAPTER` 选择适配器。
- 将 `channels` 传给适配器。

适配器负责：

- 针对每一种业务消息类型实现发送方法。
- 将业务 details 转换为自身协议。
- 读取自身适配器所需的目标 channel 配置。
- 执行实际发送请求。

缺少当前适配器对应的 channel 时，只记录 error 日志并跳过发送，不抛出异常。其他请求失败、协议错误和配置错误沿用明确的错误处理策略，并在实现阶段补充测试确认。
