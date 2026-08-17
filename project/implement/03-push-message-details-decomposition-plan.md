# Push 消息 Details 解构计划

## 1. 目标

当前第一轮适配器已隔离企微 HTTP 和协议类型，但 `GameDailyPushDetails`、`RepoPushDetails`、`McServerPushDetails`、`DevicePushDetails` 仍是 `title`、`content`、`type` 等展示模型，业务服务依然拼接了 emoji、企微字体标签、Markdown 链接和中文字段名。

本轮目标是让业务服务仅传递领域事实。`WxworkAdapter` 针对每个消息 type 从领域 details 构造完整的企微消息，包括：

- 标题、emoji、成功/警告颜色。
- Markdown 格式、链接、代码标记和字段标签。
- 数据缺失时的降级文案。
- 时间、百分比、持续时间、玩家列表等展示格式。

完成后，应用目录和公共 `push-message.d.ts` 不得再出现 `title`、`content`、`markdown`、`Wxw*` 或企微 `<font>` 标签等展示字段。

## 2. 公共类型调整

删除当前通用展示类型：

```ts
StructuredPushDetails
PushDetailContent
```

将 `PushMessageDetailsMap` 保持为按业务消息 type 分派，但每一项改为独立、不可互相替代的领域类型。

```ts
export interface PushMessageDetailsMap {
  'game-daily': GameDailyPushDetails;
  weather: WeatherPushDetails;
  repo: RepoPushDetails;
  mcserver: McServerPushDetails;
  device: DevicePushDetails;
}
```

`PushService` 的三参数接口和 `PushAdapter` 的五个发送方法不变。变化仅发生在 details 类型与各适配器的实现。

## 3. Game Daily

### Details 类型

```ts
export interface GameDailyPushDetails {
  gameName: string;
  status: 'finished' | 'unfinished' | 'failed';
  detail: GameLogDetailResult[];
  wakeupSuccessful?: boolean;
  failureReason?: string;
}
```

字段含义：

- `gameName`：用于标识本次每日任务所属游戏；不能从 channel 反推，因为不同适配器的 channel 命名不保证一致。
- `status`：`finished` 对应当前 `dailyCompleted=true`，`unfinished` 对应查询成功但未完成，`failed` 对应日志请求或解析失败。
- `detail`：直接复用当前的 `GameLogDetailResult[]`；保留日志查询结果，不在业务层改造成展示数组。
- `wakeupSuccessful`：仅唤醒流程传入。当前只有失败时发送消息，因此实际通知值为 `false`；预留 `true` 以支持后续发送唤醒成功通知。
- `failureReason`：失败原因原始文本，例如请求异常的 `Error.message`；适配器决定是否、以及如何显示。

### 业务服务迁移

- `processGameDailyCheck` 删除 `message` 变量和所有标题/emoji/中文说明构造。
- 日志不可用时发送 `{ gameName, status: 'failed', detail: [], failureReason: '无法获取日志' }`。
- 查询完成时发送 `{ gameName, status: dailyCompleted ? 'finished' : 'unfinished', detail: logRes.details }`。
- catch 分支发送 `{ gameName, status: 'failed', detail: [], failureReason }`。
- `wakeUpComputer` 失败时仅发送 `{ wakeupSuccessful: false }`，不再生成醒目文字或企微标签。
- 保留 `gameName2GameChannel`，因为这是应用选择目标 channel 的领域映射，不属于消息展示。

### wxwork 渲染职责

- `wakeupSuccessful === false` 时发送当前等价的“电脑唤醒失败，请检查”通知。
- `finished`、`unfinished`、`failed` 分别生成已完成、未完成、获取失败的标题和颜色。
- 将 `detail` 中的键值对转换成企微结构化 Markdown。
- `failureReason` 有值时显示为失败详情；无值时使用适配器默认文案。

## 4. Weather

### Details 类型

```ts
export type WeatherPushDetails =
  | {
      kind: 'minutely-rain';
      startsAt: Date;
      precipitationTimeline: number[];
      peakPrecipitation: number;
      peakAt: Date;
    }
  | {
      kind: 'daily-rain';
      periods: WeatherRainPeriod[];
    };
```

### 业务服务迁移

- 分钟级检查保留筛选、峰值计算和时间计算，但不再构造 `预计 xx min 后开始下雨` 字符串。
- 将 `rainPoints` 映射为数值 `precipitationTimeline`，首个降雨点作为 `startsAt`，峰值点作为 `peakPrecipitation` 和 `peakAt`。
- 全天检查直接传递已有的 `WeatherRainPeriod[]`，不再生成 `x-y点` 文案。
- `WeatherAlertResult` 将 `message?: string` 替换为 `details?: WeatherPushDetails`；所有发送判断改为读取 `result.details`。
- `testMinutelyCheck` 和 `testDailyCheck` 的返回值同步改为领域 details。这是当前仅用于测试的公开方法，调用方不依赖现有消息文本。

### wxwork 渲染职责

- 分钟级消息计算距离 `startsAt` 的分钟数，将时间线格式化为 `0.80mm|1.50mm`，标记峰值和峰值时间。
- 全天消息将每个 `WeatherRainPeriod` 格式化为单点或区间小时，拼接中文自然语言。
- 使用当前等价的预警 emoji 和文本样式。

## 5. Repo

### Details 类型

```ts
export interface RepoPushDetails {
  event: GitHubWebhookEvent;
  payload: GitHubWebhookPayload;
  receivedAt: Date;
}
```

`event` 与 `payload` 已是仓库领域的原始事实。保留整份 payload 可以避免应用层为当前企微版式预先截断 Issue 正文、格式化时间、组装 Markdown 链接；其他适配器也能从相同数据选取自己需要的字段。

### 业务服务迁移

- `_handleMemberEvent`、`_handleIssuesEvent`、`_handleReleaseEvent`、`_handleWorkflowRunEvent` 保留事件过滤和 `WebhookProcessResult` 的领域处理。
- 删除各 handler 的 `RepoPushDetails`、`type`、`title`、`content` 构造。
- 发送通知统一传入 `{ event, payload, receivedAt: new Date() }`。
- workflow 的 `action !== 'completed'` 仍不发送；完成事件不再在 service 中处理 success/failure 标题、提交摘要、持续时间和提醒文字。
- 将仅用于企微展示的 `shorttenGitMessage` 从 `applications/repo/repo.util.ts` 移至 wxwork 适配器私有 helper；相应测试跟随迁移。

### wxwork 渲染职责

- 按 `event` 分派 member、issue、release、workflow 消息格式。
- 根据 action/conclusion 生成标题、颜色和状态提示。
- 截断 Issue/Release 正文，格式化 `receivedAt`、GitHub 时间和 workflow 持续时长。
- 为仓库、Issue、Release、工作流生成企微 Markdown 链接和代码格式。
- 为 workflow 的非 success/failure conclusion 增加明确的默认渲染分支，避免当前可能将未赋值消息传给发送器的问题。

## 6. McServer

### Details 类型

复用已有的应用领域 payload，避免复制事件字段：

```ts
export type McServerPushDetails = McServerWebhookPayload;
```

即：

```ts
{
  event: 'server_started' | 'server_stopped' | 'player_joined' | 'player_left';
  playerName?: string;
  currentPlayers?: string[];
  playTime?: string;
}
```

### 业务服务迁移

- `sendServerStart`、`sendServerStop` 直接发送对应 event。
- `sendPlayerJoin`、`sendPlayerLeave` 直接发送玩家名、在线玩家数组和游玩时长。
- 删除 `_sendMarkdownToChannel`、`_sendMarkdownInfoToChannel`。
- 删除只用于展示的 `formatMcServerPlayerList` utility；玩家数组直接传给 adapter。

### wxwork 渲染职责

- 服务器启动/停止构造简短 Markdown。
- 玩家进入/离开根据 event 选择 emoji、颜色和标题。
- 根据 `currentPlayers.length` 生成在线人数；空数组显示“当前没有玩家在线”，否则使用 ` | ` 拼接列表。
- `playTime` 缺失时显示“未知”。

## 7. Device

### Details 类型

```ts
export interface DevicePushDetails {
  cpuUsage: number;
  cpuSeverity: 'warning' | 'critical';
  memoryUsage: number;
  memorySeverity: 'normal' | 'warning' | 'critical';
  checkedAt: Date;
  platform: string;
  cpuModel: string;
  cpuCount: number;
  uptimeSeconds: number;
  highCpuApplications: HighCpuApplication[];
  highCpuApplicationThreshold: number;
}
```

### 业务服务迁移

- `sendHighCpuAlert` 仅计算 CPU/内存使用率、严重等级、进程列表和机器原始信息。
- 不构造百分号、反引号、企微 font 标签、“高 CPU 应用”字典或中文字段名。
- `getSystemInfo` 可继续供其他监控逻辑使用；详情构造时从 `os.uptime()` 取得原始秒数，不传已格式化的 `uptime` 字符串。
- 删除 `sendStructuredNotification`，在 `sendHighCpuAlert` 中直接调用 `sendMessage('device', { wxwork: 'monitor' }, details)`。

### wxwork 渲染职责

- 根据 severity 选择 CPU 与内存的警告样式。
- 格式化百分比、检测时间和运行时长。
- 展示平台、CPU 型号和核心数。
- 有高 CPU 进程时将其转成 `名称 (PID) -> 使用率`；无进程时根据阈值输出当前等价的说明。

## 8. WxworkAdapter 改造

每个公开发送方法只接收本轮的领域 details，并调用该消息类型专属的私有构造方法：

```ts
sendGameDaily(channel, details) {
  return this.send(channel, this.buildGameDailyMessage(details));
}
```

企微消息 builder 保持为底层协议工具。每个 `sendGameDaily`、`sendWeather`、`sendRepo`、`sendMcServer`、`sendDevice` 直接内联调用 `markdown`、`markdownInfo` 等 builder 方法；业务服务不可直接调用或 import 它们。

## 9. 测试计划

1. 调整 PushService 单元测试，继续验证 type 到 adapter 方法的分发。
2. 为 wxwork 适配器的每种 `build*Message` 增加测试，断言业务输入产生当前等价的企微 `msgtype` 与 Markdown 内容。
3. game-daily 覆盖 finished、unfinished、failed、`wakeupSuccessful=false`。
4. weather 覆盖分钟级时间线/峰值和全天单小时/连续时段。
5. repo 覆盖 member added/removed/edited、Issue opened/default、Release published/default、workflow success/failure/其他 conclusion。
6. mcserver 覆盖启动、停止、加入、离开和空玩家列表。
7. device 覆盖 CPU critical/warning、内存三档状态、有/无高 CPU 进程。
8. 调整 weather 现有测试，断言领域 `details`，不再断言业务服务生成的最终中文消息。
9. 执行 `npm run build`、`npm test -- --runInBand`，并全仓检索业务服务中的 `title:`、`content:`、`markdown:`、`<font` 与 `Wxw` 残留。

## 10. 非目标

- 不新增 qqbot 实现，只确保 details 不携带 wxwork 协议信息，以便后续实现。
- 不变更 bot-key.json 格式、`WEBHOOK_SEND_ADAPTER`、channel 选择规则或 webhook 重试策略。
- 不改变现有 controller 路径、GitHub webhook 处理结果和天气监控调度逻辑，除 `testMinutelyCheck`/`testDailyCheck` 返回的测试数据形态外。
