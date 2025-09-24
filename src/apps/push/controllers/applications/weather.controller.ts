/**
 * 天气服务控制器
 * 提供天气监控相关的API接口
 */
import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { PushApplicationsWeatherService } from '../../services/applications/weather.service';
import type {
  WeatherAlertResult,
  WeatherMonitorConfig,
} from '../../types/applications/weather.d';

@Controller('push/weather')
export class ApplicationsWeatherController {
  private readonly logger = new Logger(ApplicationsWeatherController.name);

  constructor(
    private readonly weatherService: PushApplicationsWeatherService,
  ) {}

  /**
   * 获取当前天气监控配置
   */
  @Get('config')
  getConfig(): WeatherMonitorConfig {
    return this.weatherService.getConfig();
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
    result: WeatherAlertResult;
    message?: string;
  }> {
    try {
      const result = await this.weatherService.testDailyCheck();
      return {
        success: true,
        result,
        message: result.shouldAlert
          ? 'Daily rain alert would be sent'
          : 'No rain expected today',
      };
    } catch (error) {
      this.logger.error('Manual daily check failed:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  @Get('status')
  getStatus() {
    const config = this.weatherService.getConfig();
    return {
      enabled: !!config.apiKey,
      location: config.location,
      apiHost: config.apiHost,
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
