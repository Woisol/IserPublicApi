# Weather Service 调用逻辑说明

这份文档只解释当前天气模块“怎么被调用、会不会改状态、什么时候会请求天气 API”，方便后续继续重构时先看整体，再看代码。

## 1. 对外入口

当前天气模块主要有 5 个外部入口，分成两类：

### 1.1 自动入口

- `heartbeat()`
  - Cron: `0 */5 0-1,8-23 * * *`
  - 作用：统一心跳入口
  - 行为：调用 `advanceWeatherEngineTick()`，由引擎自己判断这次是不是需要真正请求天气 API

- `morningPlannig()`
  - Cron: `0 0 8 * * *`
  - 作用：每天 8 点刷新当天降雨计划
  - 行为：调用 `refreshDailyPlan()`

- `afternoonPlanning()`
  - Cron: `0 0 16 * * *`
  - 作用：每天 16 点再次刷新当天降雨计划，补晚间天气变化
  - 行为：调用 `refreshDailyPlan()`

### 1.2 手动入口

- `previewRainStartAlert()`
  - 路由：`GET /push/weather/check/minutely`
  - 作用：只预览“开始下雨提醒”的文案
  - 行为：会请求分钟级天气，但不会推进状态机

- `previewDailyPlan()`
  - 路由：`GET /push/weather/check/daily`
  - 作用：只预览当天雨段计划
  - 行为：会请求逐小时天气，但不会推进状态机

- `armNextNoRainNotification()`
  - 路由：`POST /push/weather/notify/next-no-rain`
  - 作用：手动开启一次“停雨通知跟踪”
  - 行为：会立刻请求一次分钟级天气，并决定是否进入 `stopMode = watch/precise`

- `getRuntimeStatus()`
  - 路由：`GET /push/weather/status`
  - 作用：查看当前运行态快照
  - 行为：纯读取，不请求天气 API，不改状态

## 2. 状态机怎么分

当前状态拆成两条线：

- `startMode`
  - `idle | watch | precise`
  - 负责“开始下雨提醒”

- `stopMode`
  - `off | watch | precise`
  - 负责“停雨提醒”
  - 默认是 `off`
  - 只有手动调用 `next-no-rain` 之后才可能切到 `watch/precise`

### 2.1 startMode 的含义

- `idle`
  - 当前没有需要立刻盯的降雨开始点
  - 下一次检查时间通常会退到最近的 16:00 或次日 08:00

- `watch`
  - 已经知道当天后续有雨，或者当前雨段已经开始
  - 会按 30 分钟节奏观察分钟级数据

- `precise`
  - 已经接近预计降雨开始点
  - 会按 5 分钟节奏观察分钟级数据

### 2.2 stopMode 的含义

- `off`
  - 完全不跟踪停雨

- `watch`
  - 已经手动开启停雨跟踪，但停雨点还比较远
  - 30 分钟观察一次

- `precise`
  - 已经接近停雨点
  - 5 分钟观察一次

## 3. 自动流程怎么走

### 3.1 每天 08:00 / 16:00

`refreshDailyPlan()` 会：

1. 调 `forecastClient.fetchHourlyWeather()` 拉逐小时天气
2. 调 `buildRainPeriods()` 把小时数据转成连续雨段
3. 把雨段写进 `trackingState`
4. 调 `updateStartTrackingFromPlan()`，更新 `startMode / nextStartCheckAt / nextRainStartAt`

这个步骤只影响“开始下雨提醒”相关状态，不会自动开启停雨跟踪。

### 3.2 每 5 分钟 heartbeat

`advanceWeatherEngineTick()` 会做两件事：

1. `ensureTodayPlan(now)`
   - 如果当天计划还没加载，就先刷新一次日级计划

2. 并行推进两条线
   - `checkRainStart(now)`
   - `advanceStopTracking(now)`

返回值结构：

- `start.sent`
- `stop.sent`
- `start.nextCheckAt`
- `stop.nextCheckAt`

它只是本次推进结果，不等于完整运行态。

## 4. 开始下雨提醒怎么触发

真正负责“开始下雨提醒”的核心是 `checkRainStart()`。

它有两种模式：

- `previewOnly: true`
  - 只给 `previewRainStartAlert()` 用
  - 只返回提醒文案，不改任何状态

- `previewOnly: false`
  - 给自动心跳用
  - 会根据运行态决定是否推进状态机

### 4.1 自动推进时的逻辑

1. 如果 `nextStartCheckAt` 还没到，直接返回，不请求分钟级
2. 到时后请求 `fetchMinutelyPrecipitation()`
3. 用 `analyzeRainStart()` 解析：
   - 下一次下雨时间
   - 提醒文案
4. 根据目标时间决定：
   - `idle`
   - `watch`
   - `precise`
5. 如果已经进入 `precise`，且该开始下雨事件还没发过：
   - 发送消息
   - 记录去重 key
   - 再调用 `refreshDailyPlan()` 刷新后续雨段计划

### 4.2 请求失败时

如果分钟级请求失败，不会持续每 5 分钟死磕。

当前处理是：

- 把 `startMode` 回收到 `watch`
- 把 `nextStartCheckAt` 推迟 30 分钟

所以失败后是“退避重试”，不是“下一次 heartbeat 立刻继续打 API”。

## 5. 停雨提醒怎么触发

停雨提醒的关键点是：

- 默认完全关闭
- 不会因为日级计划自动进入 `stopMode`
- 只有手动调用 `armNextNoRainNotification()` 才开始

### 5.1 手动武装时

`armNextNoRainNotification()` 会：

1. 立刻请求一次分钟级天气
2. 用 `analyzeRainStop()` 分析：
   - 未来 2 小时内是否有雨
   - 候选停雨点
   - 未来连续无雨时长
3. 根据结果决定：
   - 直接发送停雨消息
   - 进入 `stopMode = precise`
   - 进入 `stopMode = watch`
   - 维持 `stopMode = off`

### 5.2 heartbeat 推进停雨跟踪

只要 `stopMode !== off`，heartbeat 里的 `advanceStopTracking()` 才会真正工作：

1. 如果 `nextStopCheckAt` 还没到，直接返回
2. 到时后请求分钟级天气
3. 再次走 `analyzeRainStop()`
4. 如果已经满足停雨发送条件：
   - 发消息
   - 记录去重 key
   - 清空 `stopMode`
5. 如果还没满足，但已经有候选停雨点：
   - 更新为 `watch` 或 `precise`
   - 推进 `nextStopCheckAt`

### 5.3 停雨文案来源

停雨文案完全来自分钟级分析，不会额外再请求一次天气：

- `✅ 预计雨已基本停止，未来约 35min 无雨`
- `✅ 预计雨已基本停止，未来至少 2h 无雨`

这里的“未来至少 2h”只是当前分钟级视野给出的上限，不表示真的做了更远时间的天气查询。

## 6. 文件职责

### 6.1 外层 facade

- `src/apps/push/services/applications/weather.service.ts`
  - 对 Nest 暴露服务类
  - 放 cron、公共入口、流程编排
  - 不再承担底层时间工具和纯分析逻辑

### 6.2 内部模块

- `src/apps/push/services/applications/weather.service/forecast.service.ts`
  - 只管请求和风天气 API

- `src/apps/push/services/applications/weather.service/analyzer.ts`
  - 只管把天气数据分析成：
    - 雨段
    - 开始下雨提醒
    - 停雨提醒

- `src/apps/push/services/applications/weather.service/detector-state.ts`
  - 只管运行态存储和去重 key

- `src/apps/push/services/applications/weather.service/time.utils.ts`
  - 只管时间工具

## 7. 看代码时推荐顺序

如果你之后还要继续重构，建议按这个顺序看：

1. `weather.controller.ts`
   - 先看哪些入口是纯预览，哪些是有副作用的

2. `weather.service.ts`
   - 再看 facade 怎么把自动流和手动流串起来

3. `analyzer.ts`
   - 再看“开始下雨”和“停雨”到底是怎么判的

4. `detector-state.ts`
   - 最后看状态里究竟保存了什么

这样会比直接从 `heartbeat()` 一路跳进所有 helper 容易很多。

## 8. 当前最容易混淆的点

- `previewDailyPlan()` 和 `refreshDailyPlan()` 名字很像，但前者不改状态，后者会写回状态
- `previewRainStartAlert()` 只是路由预览，不会推进状态机
- `armNextNoRainNotification()` 不是“立刻保证会发送停雨通知”，而是“立刻进入一次停雨分析和必要的后续跟踪”
- `advanceWeatherEngineTick()` 是统一心跳入口，不是只处理某一种通知

如果后面继续瘦身，优先可以考虑再把 `weather.service.ts` 里的“start 流程”和“stop 流程”拆成两个 orchestrator，这样主文件会再清楚一层。
