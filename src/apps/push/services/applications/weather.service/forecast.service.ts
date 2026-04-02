import { CompactLogger } from '@app/common/utils/logger';
import type {
  HourlyWeatherResponse,
  MinutelyPrecipitationResponse,
  WeatherMonitorConfig,
} from '../../../types/applications/weather.d';
import { retry } from '../../../utils/fetch';
import { dateKey } from './index.service';

type QueryType = 'hourly' | 'minutely';
type RequestTimes = Record<QueryType, number>;

/**
 * WeatherForecastService - 和风天气 API 封装，获取天气预报数据
 */
export class WeatherForecastService {
  private requestRecord: Record<string, RequestTimes> = {};
  private readonly logger: CompactLogger = new CompactLogger(
    WeatherForecastService.name,
  );
  constructor(
    private readonly getConfig: () => WeatherMonitorConfig,
    // private readonly logger: CompactLogger,
  ) {}

  /**
   * fetchMinutelyPrecipitation - 获取分钟级降水预报数据，返回未来1小时内的降水情况
   * @returns Promise<MinutelyPrecipitationResponse | null>
   *  - summary: 分钟降水描述
   *  - minutely: 未来1小时内每5分钟的降水预报数据列表
   *    - fxTime: 预报时间
   *    - precip: 5分钟累计降水量，单位毫米
   *    - type: 降水类型，雨或雪
   * 如果请求失败或数据异常，返回 null
   */
  async fetchMinutelyPrecipitation(): Promise<MinutelyPrecipitationResponse | null> {
    const config = this.getConfig();
    const url = `${config.apiHost}/v7/minutely/5m?location=${config.location}`;

    try {
      const response = await retry(
        () =>
          fetch(url, {
            headers: {
              'X-QW-Api-Key': config.apiKey,
            },
          }),
        {
          retries: 2,
          delayMs: 1000,
          shouldRetry: (res) => !res.ok,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as MinutelyPrecipitationResponse;
      if (data.code !== '200') {
        throw new Error(`API error! code: ${data.code}`);
      }

      this._increaseRequestCount('minutely');

      return data;
    } catch (error) {
      this.logger.error('Failed to fetch minutely precipitation data:', error);
      return null;
    }
  }

  //! 类内实现函数重载😋
  /**
   * fetchHourlyWeather - 获取逐小时天气预报数据，默认获取未来24小时数据
   * @returns Promise<HourlyWeatherResponse | null>
   */
  fetchHourlyWeather(): Promise<HourlyWeatherResponse | null>;
  /**
   * fetchHourlyWeather - 获取逐小时天气预报数据
   * @param hours - 预报时长，支持 '24h'、'72h'、'168h'
   * @returns Promise<HourlyWeatherResponse | null>
   */
  fetchHourlyWeather(
    hours: '24h' | '72h' | '168h',
  ): Promise<HourlyWeatherResponse | null>;
  async fetchHourlyWeather(
    hours: '24h' | '72h' | '168h' = '24h',
  ): Promise<HourlyWeatherResponse | null> {
    const config = this.getConfig();
    const url = `${config.apiHost}/v7/weather/${hours}?location=${config.location}`;

    try {
      const response = await retry(
        () =>
          fetch(url, {
            headers: {
              'X-QW-Api-Key': config.apiKey,
            },
          }),
        {
          retries: 2,
          delayMs: 1000,
          shouldRetry: (res) => !res.ok,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as HourlyWeatherResponse;
      if (data.code !== '200') {
        throw new Error(`API error! code: ${data.code}`);
      }
      this._increaseRequestCount('hourly');
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch hourly weather data:', error);
      return null;
    }
  }

  private _increaseRequestCount(type: QueryType): void {
    const key = dateKey(new Date());
    if (!this.requestRecord[key]) {
      const previousDay = Object.keys(this.requestRecord).pop();
      if (previousDay) {
        this.logger.info(
          `${previousDay}'s request count: ${Object.entries(
            this.requestRecord[previousDay],
          )
            .map(([t, count]) => `${t}: ${count}`)
            .join(', ')}`,
        );
      }
      // 直接清空之前的数据
      this.requestRecord = {};
      this.requestRecord[key] = { hourly: 0, minutely: 0 };
    }
    this.requestRecord[key][type] += 1;
  }

  getRequestCount(): RequestTimes;
  getRequestCount(type: QueryType): number;
  getRequestCount(type?: QueryType): RequestTimes | number {
    const key = dateKey(new Date());
    if (!type) {
      return this.requestRecord[key] || { hourly: 0, minutely: 0 };
    }
    return this.requestRecord[key]?.[type] || 0;
  }
}
