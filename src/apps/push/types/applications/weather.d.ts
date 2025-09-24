// 和风天气 API 类型定义

// 基础响应类型
export interface QWeatherBaseResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  refer: {
    sources: string[];
    license: string[];
  };
}

// 分钟级降水预报接口
export interface MinutelyPrecipitationData {
  fxTime: string; // 预报时间
  precip: string; // 5分钟累计降水量，单位毫米
  type: 'rain' | 'snow'; // 降水类型：雨、雪
}

export interface MinutelyPrecipitationResponse extends QWeatherBaseResponse {
  summary: string; // 分钟降水描述
  minutely: MinutelyPrecipitationData[];
}

// 逐小时天气预报接口
export interface HourlyWeatherData {
  fxTime: string; // 预报时间
  temp: string; // 温度，摄氏度
  icon: string; // 天气状况图标代码
  text: string; // 天气状况文字描述
  wind360: string; // 风向360角度
  windDir: string; // 风向
  windScale: string; // 风力等级
  windSpeed: string; // 风速，公里/小时
  humidity: string; // 相对湿度，百分比
  precip: string; // 当前小时累计降水量，毫米
  pop: string; // 逐小时预报降水概率，百分比
  pressure: string; // 大气压强，百帕
  cloud: string; // 云量，百分比
  dew: string; // 露点温度
}

export interface HourlyWeatherResponse extends QWeatherBaseResponse {
  hourly: HourlyWeatherData[];
}

// 天气监控相关类型
export interface RainAlert {
  type: 'minutely' | 'hourly';
  message: string;
  time: Date;
  probability?: number;
  precipAmount?: number;
}

export interface WeatherMonitorConfig {
  location: string; // 经纬度坐标，如 "116.41,39.92"
  apiKey: string; // 和风天气 API Key
  apiHost: string; // API 主机地址
}

export interface WeatherAlertResult {
  shouldAlert: boolean;
  alertType: WeatherAlertType;
  message?: string;
  time?: Date;
}
