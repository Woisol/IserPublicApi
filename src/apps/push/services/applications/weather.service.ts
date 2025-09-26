/**
 * 天气监控服务
 * 基于和风天气API实现降雨预警功能
 * - 每半小时检查分钟级降水预报，如果1小时后要下雨则预警
 * - 每天早上8点检查全天降雨情况，如果下雨则预警
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type {
  MinutelyPrecipitationResponse,
  HourlyWeatherResponse,
  HourlyWeatherData,
  WeatherMonitorConfig,
  WeatherAlertResult,
} from '../../types/applications/weather.d';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';

@Injectable()
export class PushApplicationsWeatherService implements OnModuleInit {
  /** 天气监控服务 */
  private readonly logger = new CompactLogger(
    PushApplicationsWeatherService.name,
  );

  // 默认配置
  private readonly config: WeatherMonitorConfig = {
    location: process.env.QWEATHER_LOCATION,
    apiKey: process.env.QWEATHER_API_KEY || '',
    apiHost: process.env.QWEATHER_API_HOST || 'https://devapi.qweather.com',
  };

  constructor(private readonly pushService: PushService) {}

  onModuleInit() {
    this.logger.log('Weather monitoring service initialized');

    if (!this.config.apiKey) {
      this.logger.warn(
        'QWEATHER_API_KEY is not configured, weather monitoring will be disabled',
      );
      return;
    }

    // 可以在这里进行初始化检查
    this.logger.log(`Weather monitoring for location: ${this.config.location}`);
  }

  /**
   * 每半个整点执行分钟级降水检查
   * 检查未来1小时是否会下雨
   */
  @Cron('0 0,30 * * * *') // 每小时的0分和30分执行
  async checkMinutelyRain() {
    if (!this.config.apiKey) {
      return;
    }

    try {
      // this.logger.log('Checking minutely rain forecast...');

      const result = await this.checkMinutelyRainForecast();
      this.logger.info('Minutely rain forecast result:', result);
      if (result.shouldAlert && result.message) {
        await this.sendRainAlert(result.message);
        this.logger.log(`Minutely rain alert sent: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to check minutely rain forecast:', error);
    }
  }

  /**
   * 每天早上8点检查全天降雨情况
   */
  @Cron('0 0 8 * * *') // 每天早上8点
  async checkDailyRain() {
    if (!this.config.apiKey) {
      return;
    }

    try {
      // this.logger.log('Checking daily rain forecast...');

      const result = await this.checkDailyRainForecast();
      if (result.shouldAlert && result.message) {
        await this.sendRainAlert(result.message);
        this.logger.log(`Daily rain alert sent: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to check daily rain forecast:', error);
    }
  }

  /**
   * 检查分钟级降水预报
   * 分析未来1小时（12个时间点，每5分钟一个）是否会下雨
   */
  private async checkMinutelyRainForecast(): Promise<WeatherAlertResult> {
    try {
      const response = await this.fetchMinutelyPrecipitation();

      if (!response || !response.minutely) {
        return {
          shouldAlert: false,
        };
      }

      // 检查未来1小时内的降水情况
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      // 找到未来1小时内会下雨的时间点
      const rainPoints = response.minutely.filter((item) => {
        const itemTime = new Date(item.fxTime);
        return itemTime <= oneHourLater && parseFloat(item.precip) > 0;
      });

      if (rainPoints.length === 0) {
        return {
          shouldAlert: false,
        };
      }

      // 计算距离第一次降雨的时间
      const firstRainTime = new Date(rainPoints[0].fxTime);
      const minutesUntilRain = Math.round(
        (firstRainTime.getTime() - now.getTime()) / (1000 * 60),
      );

      // 基于降水量计算降雨概率
      // 使用更科学的方法：考虑降水强度分布和时间点数量
      const precipValues = rainPoints.map((item) => parseFloat(item.precip));
      const maxPrecip = Math.max(...precipValues);
      const avgPrecip =
        precipValues.reduce((sum, val) => sum + val, 0) / precipValues.length;

      // 降水概率计算公式：
      // 1. 基础概率 = 有降水时间点数 / 总检查时间点数 * 100
      // 2. 强度修正 = 基于平均降水量的对数函数
      // 3. 峰值修正 = 考虑最大降水强度
      const baseProbability = (rainPoints.length / 12) * 100; // 12个5分钟时间点 = 1小时
      const intensityFactor = Math.min(
        1 + Math.log10(avgPrecip + 0.1) * 0.3,
        2,
      ); // 强度因子
      const peakFactor = maxPrecip > 1 ? 1.2 : 1; // 峰值因子：如果有时间点降水量>1mm则提升20%

      const probability = Math.min(
        Math.round(baseProbability * intensityFactor * peakFactor),
        100,
      );

      const message = `⚠️ ${minutesUntilRain}min 后降雨概率 ${probability}%
预报降水量：[${rainPoints.map((p) => `${p.precip}mm`).join(', ')}]`;

      return {
        shouldAlert: probability >= 50,
        message,
        time: firstRainTime,
      };
    } catch (error) {
      this.logger.error('Error checking minutely rain forecast:', error);
      return { shouldAlert: false };
    }
  }

  /**
   * 检查全天降雨预报
   * 分析今天全天24小时是否会下雨
   */
  private async checkDailyRainForecast(): Promise<WeatherAlertResult> {
    try {
      const response = await this.fetchHourlyWeather('24h');

      if (!response || !response.hourly) {
        return { shouldAlert: false };
      }

      // 筛选出今天会下雨的时间段
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const rainHours = response.hourly.filter((item) => {
        const itemTime = new Date(item.fxTime);
        return (
          itemTime >= today &&
          itemTime < tomorrow &&
          (parseFloat(item.precip) > 0 || parseFloat(item.pop) > 30)
        );
      });

      if (rainHours.length === 0) {
        return { shouldAlert: false };
      }

      // 构建降雨时间段描述
      const rainPeriods = this.groupConsecutiveRainHours(rainHours);
      const timeDescription = rainPeriods
        .map((period) => {
          if (period.length === 1) {
            return `${new Date(period[0].fxTime).getHours()}点`;
          } else {
            const startHour = new Date(period[0].fxTime).getHours();
            const endHour = new Date(
              period[period.length - 1].fxTime,
            ).getHours();
            return `${startHour}-${endHour}点`;
          }
        })
        .join('、');

      const message = `⚠️ 今天${timeDescription}可能下雨`;

      return {
        shouldAlert: true,
        message,
        time: new Date(rainHours[0].fxTime),
      };
    } catch (error) {
      this.logger.error('Error checking daily rain forecast:', error);
      return { shouldAlert: false };
    }
  }

  /**
   * 将连续的降雨小时分组
   */
  private groupConsecutiveRainHours(
    rainHours: HourlyWeatherData[],
  ): HourlyWeatherData[][] {
    if (rainHours.length === 0) return [];

    const groups: HourlyWeatherData[][] = [];
    let currentGroup = [rainHours[0]];

    for (let i = 1; i < rainHours.length; i++) {
      const currentTime = new Date(rainHours[i].fxTime).getHours();
      const previousTime = new Date(rainHours[i - 1].fxTime).getHours();

      // 如果是连续的小时，加入当前组
      if (
        currentTime - previousTime === 1 ||
        (previousTime === 23 && currentTime === 0)
      ) {
        currentGroup.push(rainHours[i]);
      } else {
        // 开始新组
        groups.push(currentGroup);
        currentGroup = [rainHours[i]];
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  /**
   * 获取分钟级降水数据
   */
  private async fetchMinutelyPrecipitation(): Promise<MinutelyPrecipitationResponse | null> {
    const url = `https://${this.config.apiHost}/v7/minutely/5m?location=${this.config.location}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-QW-Api-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as MinutelyPrecipitationResponse;

      if (data.code !== '200') {
        throw new Error(`API error! code: ${data.code}`);
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to fetch minutely precipitation data:', error);
      return null;
    }
  }

  /**
   * 获取逐小时天气数据
   */
  private async fetchHourlyWeather(
    hours: '24h' | '72h' | '168h' = '24h',
  ): Promise<HourlyWeatherResponse | null> {
    const url = `https://${this.config.apiHost}/v7/weather/${hours}?location=${this.config.location}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-QW-Api-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as HourlyWeatherResponse;

      if (data.code !== '200') {
        throw new Error(`API error! code: ${data.code}`);
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to fetch hourly weather data:', error);
      return null;
    }
  }

  /**
   * 发送天气预警消息
   */
  private async sendRainAlert(message: string) {
    try {
      await this.pushService.sendTextMessage(message, 'weather');
    } catch (error) {
      this.logger.error('Failed to send rain alert:', error);
      throw error;
    }
  }

  /**
   * 手动触发分钟级降水检查（用于测试）
   */
  async testMinutelyCheck(): Promise<WeatherAlertResult> {
    this.logger.log('Manual minutely rain check triggered');
    return await this.checkMinutelyRainForecast();
  }

  /**
   * 手动触发全天降雨检查（用于测试）
   */
  async testDailyCheck(): Promise<WeatherAlertResult> {
    this.logger.log('Manual daily rain check triggered');
    return await this.checkDailyRainForecast();
  }

  /**
   * 更新天气监控配置
   */
  updateConfig(newConfig: Partial<WeatherMonitorConfig>) {
    Object.assign(this.config, newConfig);
    this.logger.log('Weather monitor config updated:', newConfig);
  }

  /**
   * 获取当前配置
   */
  getConfig(): WeatherMonitorConfig {
    return { ...this.config };
  }
}
