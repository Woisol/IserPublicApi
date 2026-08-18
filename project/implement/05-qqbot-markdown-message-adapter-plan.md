# QQ Bot Markdown 消息适配实施计划

## 1. 目标

当前 `QqbotAdapter` 的五类业务通知大多调用 `QqbotMessageService.sendText`，其中 repo 只发送事件名，未使用已经存在的 QQ Markdown 发送能力。本计划参考 `WxworkAdapter` 的现有 Markdown 信息模板，将业务 details 渲染为 QQ 原生 Markdown，并在标题中嵌入服务端托管的主题图片。

本轮已确认：

- 所有业务推送统一使用 QQ `msg_type=2` Markdown；有对应素材的消息在标题中嵌入图片。
- 不引入 Ark、Embed、文件、语音、视频、输入状态或 Markdown 自定义模板 ID；本轮使用 QQ Markdown 原生图片语法。
- repo 保留当前 wxwork 实现已经包含的全部信息和事件分支，不把整个 GitHub payload 无差别输出。
- 不扩展五类业务 details，不修改推送路由、channel 格式和 QQ API endpoint。
- 图片资源纳入本服务仓库，由 Nest 提供 `/assets` 路由；开发阶段不设置缓存。
- 图片只用于分类和状态视觉增强，标题文字仍必须在图片前以文本存在，保证 QQ 消息预览中图片显示为 `[图片]` 时仍能立即获取关键信息。

## 2. QQ 消息协议边界

发送服务保留现有协议封装：

```json
{
  "msg_type": 2,
  "markdown": {
    "content": "# 标题\n内容"
  }
}
```

`QqbotMessageService.sendMarkdown` 继续负责生成上述请求体；被动回复仍使用 `sendText`，不改变 `msg_id`、`event_id` 和 `msg_seq` 上下文逻辑。

有图片时，Markdown 内容必须严格采用以下形式：

```text
# ${title}![HeroImg #600px #200px](${BASE_URL}/assets/img/push/...png)

${details}
```

标题和图片之间不插入换行或空行，依赖 QQ 客户端的自动换行行为，使图片在消息预览中不单独占用一行。图片后保留一个空行再开始详情。没有图片时输出标题和详情，不生成无效的相对 URL。

QQ Markdown 可使用标题、加粗、斜体、删除线、链接、图片、列表、引用、分隔线和换行。本轮使用标题、加粗、代码、链接、列表、引用、分隔线和服务端静态图片。图片不承载唯一业务信息，动态详情仍使用可复制、可搜索的 Markdown 文本。

目标为群聊、单聊和频道时均可以发送 Markdown。Embed 只支持频道，Ark 虽支持多种场景但需要模板变量和额外权限，因此不作为本轮降级或分流方案。

调研依据为用户提供的消息类型页面及其 Markdown、Ark、Embed、富媒体子页面。该站点页面标注为非官方维护文档，实施前应以 QQ 官方开放平台同名接口的最新字段约束做最终校验。

## 3. 渲染职责与公共约束

### QqbotAdapter

- `sendGameDaily`、`sendWeather`、`sendRepo`、`sendMcServer`、`sendDevice` 均调用对应的 Markdown 构造函数后再调用 `sendMarkdown`。
- `QqbotAdapter` 不直接拼接标题、图片语法和详情字段；展示规则统一下沉到 `markdown-message-helper.ts`。
- 渲染只读取公共业务 details，不 import wxwork 类型，不生成 `<font>` 标签。
- 保持 wxwork 已确认的文案、字段、截断长度、时间格式、百分比精度和降级文案。
- 使用 QQ 支持的 Markdown 结构表达状态：标题和 emoji 表达事件类型，粗体表达字段名，引用或列表表达详情，代码标记表达分支、百分比等适合等宽阅读的值。
- 对来自 GitHub 或其他外部 payload 的文本统一处理 Markdown 特殊字符，避免正文、提交信息、标题破坏链接、列表和强调语法。
- 对可选值保留当前 wxwork 的降级行为，不因 `null`、空列表或缺失字段生成无效 Markdown。

### markdownMessageHelper

在 `src/apps/push/services/adapters/qqbot/markdown-message-helper.ts` 新增 `QqbotMarkdownMessageHelper`，作为 Nest `@Injectable()` provider 注入 `QqbotAdapter`。helper 暴露五个消息类型专属的公开构造方法：

```ts
buildGameDailyMarkdown(details: GameDailyPushDetails): string;
buildWeatherMarkdown(details: WeatherPushDetails): string;
buildRepoMarkdown(details: RepoPushDetails): string;
buildMcServerMarkdown(details: McServerPushDetails): string;
buildDeviceMarkdown(details: DevicePushDetails): string;
```

每个方法负责对应消息类型的完整渲染：标题、图片资源选择、`BASE_URL` URL 拼接和详情 Markdown。类内部使用私有公共逻辑统一生成图片语法和标题结构，不让业务 service 依赖该 helper。

helper 可以持有基础设施状态，但不持有业务状态：

- 实例创建时创建一次 `CompactLogger(QqbotMarkdownMessageHelper.name)`，不在每条消息中动态创建 logger。
- 可使用 `missingBaseUrlWarned` 等最小标志，确保 `BASE_URL` 缺失的告警不会在每次推送时重复刷屏。
- 不缓存业务 details、图片内容、请求结果或跨消息渲染数据。
- `BASE_URL` 仍在每次构造消息时读取，使测试和运行时配置行为明确；缺失时返回无图 Markdown。

图片选择属于 helper 的展示职责：

- 资源根固定为 `/assets/img/push/`。
- `BASE_URL` 每次构造消息时读取，约定为不带末尾 `/` 的公网 origin。
- `BASE_URL` 缺失或为空时跳过图片，继续返回标题和详情；helper 使用自身 logger 按实例只告警一次，不使用 localhost 或相对路径作为 QQ 图片 URL。
- 图片 alt 固定为 `HeroImg`，尺寸固定为 `#600px #200px`。
- 游戏名称不能直接拼接为任意文件路径；只复用 `gameName2GameChannel` 生成 slug，再通过允许列表选择 `genshin`、`star_rail` 或 `fallback`。

### 消息长度与转义

- 复用当前 wxwork 的 Issue 正文最多 200 字、Release 发布说明最多 300 字规则。
- 不新增静默截断；若 QQ 接口对 Markdown 长度有更严格限制，实施时增加明确的适配器级长度校验或统一截断，并补充测试。
- 链接 URL 使用 payload 中已有的 GitHub `html_url`，显示文本和 URL 均按 Markdown 安全规则处理。
- 普通字段值使用 `\n> **字段**：值` 或列表格式；多行正文使用独立引用块或段落，不能直接拼接未经处理的原文。

## 4. 各消息类型计划

### 4.1 game-daily

保持现有四种业务状态，并按游戏和状态选择图片：

- `wakeupSuccessful === false`：短告警标题，例如 `# ❌ 电脑唤醒失败`，使用 `wakeup.failed.png`，下方显示“请及时检查并修复问题”。
- `status === 'finished'`：标题为游戏名和“每日任务已完成”。
- `status === 'unfinished'`：标题为游戏名和“每日任务未完成”。
- `status === 'failed'`：标题为游戏名和“每日完成情况获取失败”，详情显示 `failureReason`，无原因时显示“无法获取日志”。

完成、未完成和失败状态继续展开 `detail` 中的每个日志条目。每个键值使用粗体字段名和独立行；对象或空值按当前 wxwork 的语义处理，不引入企微字体颜色。

游戏图片路径规则：

- `Genshin` 经 `gameName2GameChannel` 得到 `genshin`，使用 `games/genshin.{status}.png`。
- `Star Rail` 经 `gameName2GameChannel` 得到 `star_rail`，使用 `games/star_rail.{status}.png`。
- 其他游戏使用 `games/fallback.{status}.png`。
- `finished`、`unfinished`、`failed` 三种状态均有对应图片；不把任意外部 `gameName` 当成 URL 文件名。

### 4.2 weather

不增加天气领域字段，只改展示形式：

- `minutely-rain`：标题显示降雨预警，使用 `weather.minutely.png`；正文依次显示预计开始倒计时、降雨量时间线、峰值降雨量和峰值时间。
- `daily-rain`：标题显示当天降雨预警，使用 `weather.daily.png`；每个 `WeatherRainPeriod` 展示为单个小时或起止小时区间的列表。
- 降雨数值保持两位小数，时间线保持 `|` 分隔，小时格式保持当前 wxwork 逻辑。
- 保留现有 `⚠️` 预警标识和无额外字段的约束。

### 4.3 repo

按 `GitHubWebhookEvent` 分派，字段和截断规则与 wxwork 当前实现一致。当前素材没有 member、issues、release 专属图片，因此这三类自然降级为标题和详情；不跨类别复用 workflow 图片：

#### member

- `added`：新增协作者，显示成员 login 和仓库链接。
- `removed`：移除协作者，显示成员 login 和仓库链接。
- `edited`：权限变更，显示仓库、成员、from/to 权限；缺失变更值显示“未知”。
- 其他 action：显示“未知操作”和操作类型，保持当前兜底分支。

#### issues

- `opened`：显示 Issue 编号与标题链接、仓库链接、创建者、GitHub 创建时间和最多 200 字描述。
- 其他 action：显示 action 可读标题、Issue 链接、仓库、操作者和 `receivedAt`。
- 不在本轮新增 labels、assignee、changes 等 wxwork 当前未展示字段。

#### release

- `published`：显示 tag 链接、版本名称、仓库链接、发布时间和最多 300 字发布说明。
- 其他 action：显示版本链接、仓库链接和 `receivedAt` 操作时间。
- 不在本轮新增 release assets、下载次数或变更正文。

#### workflow_run

- 业务服务仍只发送 `action === 'completed'` 的事件。
- `success`、`failure` 和其他 conclusion 分别使用成功、失败和通用结束标题；`success` 使用 `workflow.success.png`，`failure` 使用 `workflow.failed.png`，其他 conclusion 无图；失败保留“请及时检查并修复问题”。
- 显示清理过 emoji 的提交首行摘要、仓库链接、分支代码、执行时长。
- 保留当前缺失时间时显示“未知”的持续时间逻辑。

所有 action/conclusion 标题采用可读中文和状态 emoji；GitHub URL 均生成 QQ Markdown 链接。

### 4.4 mcserver

- `server_started`：单行启动成功标题，无图。
- `server_stopped`：单行服务器关闭标题，无图。
- `player_joined`：显示玩家加入标题，使用 `mcserver.join.png`，并展示当前在线人数和玩家列表。
- `player_left`：显示玩家离开标题，使用 `mcserver.leave.png`，并展示游玩时长、当前在线人数和玩家列表。
- `currentPlayers` 为空时显示“当前没有玩家在线”，缺失 `playTime` 时显示“未知”。

保持现有 `currentPlayers.length` 和玩家列表语义，不增加服务器地址、版本或延迟字段。

### 4.5 device

- CPU `critical` 使用严重告警标题和 `device.extrahigh.png`，`warning` 使用普通高负载预警标题和 `device.high.png`。
- 展示 CPU 使用率、内存使用率、检测时间、平台、CPU 型号、核心数和格式化运行时长。
- 内存 `normal`、`warning`、`critical` 继续保留三档语义；使用加粗或代码标记表达，不使用 wxwork `<font>`。
- 有超阈值进程时按名称、PID、占用率列出；无进程时保留当前阈值说明。
- 百分比保持两位小数，运行时长复用当前天/小时/分钟格式化逻辑。

## 5. 静态资源服务与部署

### Nest 静态资源

新增 `@nestjs/serve-static` 依赖，使用官方 `ServeStaticModule` 在 `AppModule` 声明：

- `rootPath` 为 `join(process.cwd(), 'assets')`。
- `serveRoot` 为 `/assets`。
- 开发阶段关闭缓存响应行为，例如设置静态服务的 `maxAge: 0` 并关闭 ETag/缓存控制，具体以 `@nestjs/serve-static` 对 Express 5 的选项类型为准。
- 只暴露仓库中的 `assets` 目录，不把 `.env`、bot key 或其他项目文件作为静态资源。

### GitHub Actions

当前部署由 self-hosted GitHub Actions 将 `dist/*` 复制到 PM2 工作目录。本轮同步修改 workflow：

- 将仓库 `assets` 复制到部署目录的 `assets` 子目录。
- 新增 `BASE_URL: ${{ secrets.BASE_URL }}` 生产环境变量。
- 不在 workflow 中写入 QQ 凭证或其他敏感信息。
- Dockerfile 不纳入本轮修改；后续若恢复 Docker 部署，必须同步复制 `assets`。

### 资源文件重命名

执行以下资源改名，代码和测试只使用新名称：

- `wakup.failed.png` -> `wakeup.failed.png`
- `weather.hourly.png` -> `weather.minutely.png`
- `weather.daily.png` 保持不变
- `games/starrail.*.png` -> `games/star_rail.*.png`

## 6. 文件与实现顺序

1. 安装 `@nestjs/serve-static`，在 `AppModule` 注册 `/assets` 静态资源路由。
2. 按确认结果重命名图片素材，保留五类业务对应的现有资产和游戏 fallback 资产。
3. 新增 `QqbotMarkdownMessageHelper` provider，实现五个公开 Markdown 构造方法及统一图片 URL/模板逻辑；在 `QqbotAdapter` 中注入该 provider。
4. 在 helper 中迁移当前 QQ adapter 的五类领域渲染逻辑，并按 wxwork 当前字段、截断规则和降级文案保持信息等价。
5. 在 `qqbot.adapter.ts` 将五个 `sendXxx` 的发送入口切换为调用 helper 后的 `sendMarkdown`；移除 DroidSpace 外部占位图片 URL。
6. 更新 GitHub Actions，复制 `assets` 并注入 `BASE_URL` Secret。
7. 增加 Markdown 特殊字符和多行外部文本的安全处理，至少覆盖 repo 标题、Issue/Release 正文和 workflow 提交信息。
8. 不修改 `push-message.d.ts`、业务 service、channel 配置和 callback 命令回复协议；若编译暴露 details 类型不兼容，再只做必要的类型修正。

## 6. 测试计划

### QQ message service

- `sendMarkdown` 请求体为 `msg_type: 2`，内容位于 `markdown.content`。
- group、user、guild-channel 使用正确 endpoint。
- 带 `messageId` 时只发送 `msg_id`，不发送 `event_id`；`msg_seq` 保持现有行为。
- API 错误继续包含状态码、官方错误码和 trace id，且不泄露 token。

### QQ adapter

- game-daily 覆盖唤醒失败、finished、unfinished、failed、空详情和失败原因缺失。
- weather 覆盖分钟降雨时间线/峰值/时间，以及单小时和连续时段。
- repo 覆盖 member added/removed/edited/未知 action、Issue opened/其他 action、Release published/其他 action、workflow success/failure/其他 conclusion。
- repo 断言不再只出现事件名，且包含已确认的仓库、链接、操作者、时间、摘要和状态字段。
- mcserver 覆盖启动、停止、加入、离开、空玩家列表和缺失游玩时长。
- device 覆盖 CPU critical/warning、内存三档、有/无高 CPU 进程。
- 每类测试断言发送的是 Markdown 而不是文本，并断言关键内容和链接存在。
- 外部文本含 `*`、`_`、`[`、`]`、反引号和换行时，输出不会破坏既有 Markdown 结构。

### Markdown helper 和静态资源

- `QqbotMarkdownMessageHelper` 作为 Nest provider 可被 `QqbotAdapter` 注入，且实例只创建一次 logger，不在每条消息中动态创建 logger。
- 五个公开 helper 方法分别覆盖对应 details 类型，并输出完整标题、可选图片和详情。
- 有图时断言标题和 `![HeroImg #600px #200px](...)` 在同一行，图片后有一个空行。
- `BASE_URL` 缺失时五类消息仍可生成标题和详情，不出现 `undefined/assets`、`localhost` 或相对图片路径。
- `BASE_URL` 缺失时只产生一次配置告警，后续消息仍正常生成无图 Markdown。
- Genshin、Star Rail 和未知游戏分别选择 `genshin`、`star_rail` 和 `fallback` 的状态图片。
- `workflow.success`、`workflow.failed`、天气、Minecraft 加入/离开、设备高负载和唤醒失败选择正确图片；无对应素材的分支不跨类别复用图片。
- 使用 Nest HTTP 测试确认 `/assets/img/push/...png` 可访问、Content-Type 为 `image/png`，且开发阶段不产生持久缓存策略。
- 修改后的 GitHub Actions 文件包含 `assets` 复制和 `BASE_URL` Secret 注入。

执行：

```text
npm run build
npm test -- --runInBand
```

## 7. 验收标准

- 五类业务通知均通过 QQ `msg_type=2` 发送。
- 有对应素材的消息使用服务端 `/assets` 图片 URL，并严格使用标题与图片同一行的 Markdown 模板。
- repo 不再只发送 `GitHub 事件：<event>`，而是准确包含当前 wxwork 已实现的信息。
- QQ 消息中不出现 wxwork `<font>`、wxwork 协议字段或 Ark/Embed 富媒体字段。
- 群聊、单聊和频道目标仍使用既有 endpoint 与 channel 解析规则。
- 缺失可选数据、空列表和外部特殊字符不会造成无效 Markdown 或未处理异常。
- `BASE_URL` 缺失时业务消息仍能发送文本 Markdown；未知游戏使用对应状态的 fallback 图片。
- GitHub Actions 发布后的 PM2 工作目录同时包含 `dist` 和 `assets`，QQ 服务端可以访问图片 URL。
- 被动命令回复仍使用文本消息和原事件引用上下文。
- `npm run build` 与完整 Jest 测试通过。

## 8. 非目标

- 不修改 GitHub webhook 接收和业务事件过滤逻辑。
- 不新增 repo details 字段，不全量展示 GitHub payload。
- 不申请或依赖 QQ Markdown 自定义模板。
- 不实现 Ark、Embed、文件、语音、视频上传和输入状态通知；本轮的图片仅是仓库静态 PNG 的 Markdown 引用。
- 不调整 wxwork 的现有消息样式和协议实现。
