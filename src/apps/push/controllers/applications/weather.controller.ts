/**
 * 天气服务控制器
 * 提供天气监控相关的API接口
 */
import { Controller, Get, Post, Body } from '@nestjs/common';
import type {
  WeatherAlertResult,
  WeatherDailyCheckResult,
  WeatherMonitorConfig,
  WeatherNotifyResult,
} from '../../types/applications/weather.d';
import { CompactLogger } from '@app/common/utils/logger';
import { PushApplicationsWeatherService } from '../../services/applications';

@Controller('push/weather')
export class ApplicationsWeatherController {
  private readonly logger = new CompactLogger(
    ApplicationsWeatherController.name,
  );

  constructor(
    private readonly weatherService: PushApplicationsWeatherService,
  ) {}

  /**
   * 获取当前天气监控配置
   */
  @Get('config')
  getConfig(): WeatherMonitorConfig {
    return this.weatherService.config;
  }

  /**
   * 更新天气监控配置
   */
  @Post('config')
  updateConfig(@Body() config: Partial<WeatherMonitorConfig>) {
    this.logger.log('Updating weather monitor config:', config);
    this.weatherService.updateConfig(config);
    return { success: true, message: 'Weather monitor config updated' };
  }

  /**
   * 手动触发分钟级降水检查
   */
  @Get('check/minutely')
  async checkMinutely(): Promise<{
    success: boolean;
    result: WeatherAlertResult;
    message?: string;
  }> {
    try {
      const result = await this.weatherService.testMinutelyCheck();
      return {
        success: true,
        result,
        message: result.shouldAlert
          ? 'Rain alert would be sent'
          : 'No rain detected in next hour',
      };
    } catch (error) {
      this.logger.error('Manual minutely check failed:', error);
      throw error;
    }
  }

  /**
   * 手动触发全天降雨检查
   */
  @Get('check/daily')
  async checkDaily(): Promise<{
    success: boolean;
    result: WeatherDailyCheckResult;
    message?: string;
  }> {
    try {
      const result = await this.weatherService.testDailyCheck();
      return {
        success: true,
        result,
        message: result.rainPeriods.length
          ? 'Daily rain periods were planned'
          : 'No rain expected today',
      };
    } catch (error) {
      this.logger.error('Manual daily check failed:', error);
      throw error;
    }
  }

  /**
   * 手动触发一次停雨跟踪初始化
   */
  @Post('notify/next-no-rain')
  async notifyNextNoRain(): Promise<{
    success: boolean;
    result: WeatherNotifyResult;
  }> {
    const result = await this.weatherService.notifyNextNoRain();
    return {
      success: true,
      result,
    };
  }

  /**
   * 获取服务状态
   */
  @Get('status')
  getStatus() {
    const config = this.weatherService.config;
    const runtime = this.weatherService.getRuntimeStatus();
    return {
      enabled: !!config.apiKey,
      location: config.location,
      apiHost: config.apiHost,
      runtime,
      lastCheck: new Date().toISOString(),
      status: config.apiKey ? 'active' : 'disabled - missing API key',
    };
  }

  /**
   * 健康检查接口
   */
  @Get('health')
  healthCheck() {
    return {
      service: 'weather-monitor',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
