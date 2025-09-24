# 天气监控服务

基于和风天气API实现的自动降雨预警功能，支持分钟级降水预报和全天降雨监控。

## 功能特性

- **分钟级监控**: 每30分钟检查一次，如果1小时后要下雨则发送预警
- **全天监控**: 每天早上8点检查今天全天是否会下雨
- **自动推送**: 通过企业微信机器人发送预警消息
- **手动触发**: 提供API接口支持手动检查和测试
- **灵活配置**: 支持动态配置监控位置和API参数

## 环境变量配置

在 `.env` 文件中配置以下环境变量：

```bash
# 和风天气API密钥
QWEATHER_API_KEY=your_qweather_api_key

# 和风天气API主机
QWEATHER_API_HOST=https://devapi.qweather.com

# 监控位置坐标
QWEATHER_LOCATION=116.41,39.92
```

### 获取和风天气API密钥

1. 访问 [和风天气开发者平台](https://dev.qweather.com/)
2. 注册账号并登录
3. 创建新项目
4. 获取API Key
5. 将API Key配置到环境变量中

## API接口

### 获取服务状态

```
GET /push/weather/status
```

### 获取当前配置

```
GET /push/weather/config
```

### 更新配置

```
POST /push/weather/config
Content-Type: application/json

{
  "location": "116.41,39.92",
  "apiKey": "your_new_api_key",
  "apiHost": "https://devapi.qweather.com"
}
```

### 手动触发分钟级检查

```
POST /push/weather/check/minutely
```

### 手动触发全天检查

```
POST /push/weather/check/daily
```

### 健康检查

```
GET /push/weather/health
```

## 消息格式

### 分钟级降雨预警

```
「Weather」⚠️ 30min 后降雨概率 75%
```

### 全天降雨预警

```
「Weather」⚠️ 今天14-16点可能下雨
```

## 定时任务

- **分钟级监控**: `0 */30 * * * *` (每30分钟执行)
- **全天监控**: `0 0 8 * * *` (每天早上8点执行)

## 使用示例

### 1. 启动服务

确保已配置环境变量，启动NestJS应用：

```bash
npm run start:dev
```

### 2. 检查服务状态

```bash
curl http://localhost:3000/push/weather/status
```

### 3. 手动测试分钟级检查

```bash
curl -X POST http://localhost:3000/push/weather/check/minutely
```

### 4. 手动测试全天检查

```bash
curl -X POST http://localhost:3000/push/weather/check/daily
```

### 5. 更新监控位置

```bash
curl -X POST http://localhost:3000/push/weather/config \
  -H "Content-Type: application/json" \
  -d '{"location": "121.47,31.23"}'
```

## 故障排除

### 1. API密钥未配置

**现象**: 服务状态显示 "disabled - missing API key"
**解决**: 在环境变量中配置 `QWEATHER_API_KEY`

### 2. API请求失败

**现象**: 日志显示 "Failed to fetch weather data"
**检查**:

- API密钥是否正确
- 网络连接是否正常
- API配额是否用完

### 3. 定时任务不执行

**现象**: 没有收到自动预警消息
**检查**:

- ScheduleModule 是否正确配置
- 服务是否正常启动
- 日志中是否有错误信息

### 4. 推送消息发送失败

**现象**: 预警触发但未收到消息
**检查**:

- 企业微信机器人配置是否正确
- 推送服务是否正常工作
- 频道配置是否正确

## 开发说明

### 文件结构

```
src/apps/push/
├── types/applications/
│   └── weather.d.ts              # 类型定义
├── services/applications/
│   └── weather.service.ts        # 天气监控服务
└── controllers/applications/
    └── weather.controller.ts     # API控制器
```

### 扩展功能

可以基于现有架构扩展以下功能：

- 多地点监控
- 更多天气事件预警(雪、风、雾霾等)
- 自定义预警阈值
- 历史数据记录
- 预警统计分析

## 许可证

本项目使用 MIT 许可证。使用和风天气API需遵守其相应的服务条款。
