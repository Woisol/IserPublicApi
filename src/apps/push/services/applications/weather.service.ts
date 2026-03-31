/**
 * 天气监控服务
 * 基于和风天气API实现降雨预警功能
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type {
  WeatherAlertResult,
  WeatherDailyCheckResult,
  WeatherEngineDecision,
  WeatherMonitorConfig,
  WeatherNotifyResult,
  WeatherRainPeriod,
  WeatherRuntimeStatus,
} from '../../types/applications/weather.d';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import {
  WeatherDetectorStateStore,
  WeatherForecastService,
  analyzeRainStart,
  analyzeRainStop,
  buildRainPeriods,
} from './weather.service/index.service';

@Injectable()
export class WeatherService implements OnModuleInit {
  /** 天气监控服务 */
  private readonly logger = new CompactLogger(WeatherService.name);

  // 默认配置
  private readonly _config: WeatherMonitorConfig = {
    location: process.env.QWEATHER_LOCATION,
    apiKey: process.env.QWEATHER_API_KEY || '',
    apiHost: process.env.QWEATHER_API_HOST || 'devapi.qweather.com',
  };

  private readonly detectorState = new WeatherDetectorStateStore();
  private readonly forecastService = new WeatherForecastService(
    () => this._config,
    this.logger,
  );

  constructor(private readonly pushService: PushService) {}

  onModuleInit() {
    this.logger.log('Weather monitoring service initialized');

    if (!this._config.apiKey) {
      this.logger.warn(
        'QWEATHER_API_KEY is not configured, weather monitoring will be disabled',
      );
      return;
    }

    this.logger.log(
      `Weather monitoring for location: ${this._config.location}`,
    );
    void this.rebuildDailyPlan(new Date());
  }

  /**
   * 每5分钟运行一次心跳，根据 nextCheckAt 决定是否真正请求天气接口
   */
  @Cron('0 */5 * * * *')
  async heartbeat() {
    if (!this._config.apiKey) {
      return;
    }

    try {
      const decision = await this.runEngineTick();
      this.logger.debug('Weather engine tick result:', decision);
    } catch (error) {
      this.logger.error('Weather engine tick failed:', error);
    }
  }

  /**
   * 每天早上8点重建当天降雨计划
   */
  @Cron('0 0 8 * * *')
  async morningPlanning() {
    if (!this._config.apiKey) {
      return;
    }

    await this.rebuildDailyPlan(new Date());
  }

  /**
   * 下午4点再做一次全天粗筛，补齐晚间天气变化
   */
  @Cron('0 0 16 * * *')
  async afternoonPlanning() {
    if (!this._config.apiKey) {
      return;
    }

    await this.rebuildDailyPlan(new Date());
  }

  async runEngineTick(now = new Date()): Promise<WeatherEngineDecision> {
    if (!this._config.apiKey) {
      return {
        start: { sent: false },
        stop: { sent: false },
      };
    }

    await this.ensureDailyPlan(now);

    const startDecision = await this.processRainStart(now);
    const stopDecision = await this.processRainStop(now);

    return {
      start: startDecision,
      stop: stopDecision,
    };
  }

  async notifyNextNoRain(now = new Date()): Promise<WeatherNotifyResult> {
    if (!this._config.apiKey) {
      return {
        armed: false,
        stopMode: 'off',
        hasRainWithin2Hours: false,
        sent: false,
        reason: 'missing-api-key',
      };
    }

    const response = await this.forecastService.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      this.detectorState.clearStopTracking();
      return {
        armed: false,
        stopMode: 'off',
        hasRainWithin2Hours: false,
        sent: false,
        reason: 'minutely-unavailable',
      };
    }

    const analysis = analyzeRainStop(response.minutely, now);
    if (
      analysis.shouldNotifyNow &&
      analysis.message &&
      analysis.nextRainStopAt
    ) {
      await this.sendRainAlert(analysis.message);
      this.detectorState.rememberStopAlert(analysis.nextRainStopAt);
      this.detectorState.clearStopTracking();
      return {
        armed: false,
        stopMode: 'off',
        nextCheckAt: undefined,
        hasRainWithin2Hours: analysis.hasRainWithin2Hours,
        nextRainStopAt: analysis.nextRainStopAt,
        noRainDurationMinutes: analysis.noRainDurationMinutes,
        sent: true,
        message: analysis.message,
        reason: 'sent-immediately',
      };
    }

    if (!analysis.hasRainWithin2Hours && !analysis.shouldTrack) {
      this.detectorState.clearStopTracking();
      return {
        armed: false,
        stopMode: 'off',
        nextCheckAt: undefined,
        hasRainWithin2Hours: false,
        sent: false,
        reason: 'no-rain-within-2h',
      };
    }

    if (analysis.nextRainStopAt) {
      const mode = this.resolveModeForTarget(now, analysis.nextRainStopAt);
      const nextCheckAt = this.computeFollowUpCheckAt(
        now,
        mode,
        analysis.nextRainStopAt,
      );
      this.detectorState.setStopTracking(
        mode,
        nextCheckAt,
        analysis.nextRainStopAt,
      );

      return {
        armed: true,
        stopMode: mode,
        nextCheckAt,
        hasRainWithin2Hours: analysis.hasRainWithin2Hours,
        nextRainStopAt: analysis.nextRainStopAt,
        noRainDurationMinutes: analysis.noRainDurationMinutes,
        sent: false,
        reason: 'tracking-stop',
      };
    }

    const fallbackCheckAt = this.addMinutes(now, 30);
    this.detectorState.setStopTracking('watch', fallbackCheckAt);
    return {
      armed: true,
      stopMode: 'watch',
      nextCheckAt: fallbackCheckAt,
      hasRainWithin2Hours: analysis.hasRainWithin2Hours,
      noRainDurationMinutes: analysis.noRainDurationMinutes,
      sent: false,
      reason: 'waiting-for-stop-window',
    };
  }

  async testMinutelyCheck(now = new Date()): Promise<WeatherAlertResult> {
    const response = await this.forecastService.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      return { shouldAlert: false };
    }

    const analysis = analyzeRainStart(response.minutely, now);
    return {
      shouldAlert: !!analysis.nextRainStartAt,
      message: analysis.message,
      time: analysis.nextRainStartAt,
    };
  }

  async testDailyCheck(now = new Date()): Promise<WeatherDailyCheckResult> {
    const rainPeriods = await this.rebuildDailyPlan(now);
    return {
      rainPeriods,
      status: this.getRuntimeStatus(),
    };
  }

  getRuntimeStatus(): WeatherRuntimeStatus {
    return this.detectorState.getSnapshot();
  }

  /**
   * 更新天气监控配置
   */
  updateConfig(newConfig: Partial<WeatherMonitorConfig>) {
    Object.assign(this._config, newConfig);
    this.logger.log('Weather monitor config updated:', newConfig);
  }

  /**
   * 获取当前配置
   */
  get config(): WeatherMonitorConfig {
    return { ...this._config };
  }

  private async ensureDailyPlan(now: Date) {
    const state = this.detectorState.getRawState();
    if (state.plannedDate === this.formatDateKey(now)) {
      return;
    }

    await this.rebuildDailyPlan(now);
  }

  private async rebuildDailyPlan(now: Date): Promise<WeatherRainPeriod[]> {
    const response = await this.forecastService.fetchHourlyWeather();
    const rainPeriods = buildRainPeriods(response?.hourly ?? [], now);
    this.detectorState.setDailyPlan(this.formatDateKey(now), rainPeriods);
    this.syncStartTracking(now, rainPeriods);
    return rainPeriods;
  }

  private syncStartTracking(now: Date, rainPeriods: WeatherRainPeriod[]) {
    const nextPeriod = rainPeriods.find(
      (period) => period.startTime.getTime() > now.getTime(),
    );

    if (!nextPeriod) {
      this.detectorState.setStartTracking(
        'idle',
        this.computeNextCoarseCheck(now),
      );
      return;
    }

    const mode = this.resolveModeForTarget(now, nextPeriod.startTime);
    const nextCheckAt =
      mode === 'idle' ? this.addMinutes(nextPeriod.startTime, -60) : now;
    this.detectorState.setStartTracking(
      mode,
      nextCheckAt,
      nextPeriod.startTime,
    );
  }

  private async processRainStart(
    now: Date,
  ): Promise<WeatherEngineDecision['start']> {
    const state = this.detectorState.getRawState();
    if (
      !state.nextStartCheckAt ||
      state.nextStartCheckAt.getTime() > now.getTime()
    ) {
      return {
        sent: false,
        nextCheckAt: state.nextStartCheckAt,
      };
    }

    const response = await this.forecastService.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      return {
        sent: false,
        nextCheckAt: this.addMinutes(now, 30),
      };
    }

    const analysis = analyzeRainStart(response.minutely, now);
    if (!analysis.nextRainStartAt || !analysis.message) {
      this.syncStartTracking(now, state.rainPeriods);
      return {
        sent: false,
        nextCheckAt: this.detectorState.getSnapshot().nextStartCheckAt,
      };
    }

    const mode = this.resolveModeForTarget(now, analysis.nextRainStartAt);
    const nextCheckAt = this.computeFollowUpCheckAt(
      now,
      mode,
      analysis.nextRainStartAt,
    );
    this.detectorState.setStartTracking(
      mode,
      nextCheckAt,
      analysis.nextRainStartAt,
    );

    if (
      mode === 'precise' &&
      !this.detectorState.hasSentStartAlert(analysis.nextRainStartAt)
    ) {
      await this.sendRainAlert(analysis.message);
      this.detectorState.rememberStartAlert(analysis.nextRainStartAt);
      await this.rebuildDailyPlan(now);
      return {
        sent: true,
        message: analysis.message,
        nextCheckAt: this.detectorState.getSnapshot().nextStartCheckAt,
      };
    }

    return {
      sent: false,
      nextCheckAt,
    };
  }

  private async processRainStop(
    now: Date,
  ): Promise<WeatherEngineDecision['stop']> {
    const state = this.detectorState.getRawState();
    if (state.stopMode === 'off') {
      return { sent: false };
    }

    if (
      state.nextStopCheckAt &&
      state.nextStopCheckAt.getTime() > now.getTime()
    ) {
      return {
        sent: false,
        nextCheckAt: state.nextStopCheckAt,
      };
    }

    const response = await this.forecastService.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      this.detectorState.setStopTracking('watch', this.addMinutes(now, 30));
      return {
        sent: false,
        nextCheckAt: this.detectorState.getSnapshot().nextStopCheckAt,
      };
    }

    const analysis = analyzeRainStop(
      response.minutely,
      now,
      state.nextRainStopAt,
    );
    if (
      analysis.shouldNotifyNow &&
      analysis.message &&
      analysis.nextRainStopAt
    ) {
      if (!this.detectorState.hasSentStopAlert(analysis.nextRainStopAt)) {
        await this.sendRainAlert(analysis.message);
        this.detectorState.rememberStopAlert(analysis.nextRainStopAt);
      }
      this.detectorState.clearStopTracking();
      return {
        sent: true,
        message: analysis.message,
      };
    }

    if (!analysis.hasRainWithin2Hours && !analysis.shouldTrack) {
      this.detectorState.clearStopTracking();
      return { sent: false };
    }

    if (analysis.nextRainStopAt) {
      const mode = this.resolveModeForTarget(now, analysis.nextRainStopAt);
      const nextCheckAt = this.computeFollowUpCheckAt(
        now,
        mode,
        analysis.nextRainStopAt,
      );
      this.detectorState.setStopTracking(
        mode,
        nextCheckAt,
        analysis.nextRainStopAt,
      );
      return {
        sent: false,
        nextCheckAt,
      };
    }

    const nextCheckAt = this.addMinutes(now, 30);
    this.detectorState.setStopTracking(
      'watch',
      nextCheckAt,
      state.nextRainStopAt,
    );
    return {
      sent: false,
      nextCheckAt,
    };
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

  private resolveModeForTarget(
    now: Date,
    targetTime: Date,
  ): 'idle' | 'watch' | 'precise' {
    const minutesUntilTarget = Math.round(
      (targetTime.getTime() - now.getTime()) / (1000 * 60),
    );

    if (minutesUntilTarget <= 10) {
      return 'precise';
    }

    if (minutesUntilTarget <= 60) {
      return 'watch';
    }

    return 'idle';
  }

  private computeFollowUpCheckAt(
    now: Date,
    mode: 'idle' | 'watch' | 'precise',
    targetTime: Date,
  ): Date {
    if (mode === 'precise') {
      return this.addMinutes(now, 5);
    }

    if (mode === 'watch') {
      const preciseBoundary = this.addMinutes(targetTime, -10);
      const halfHourLater = this.addMinutes(now, 30);
      return preciseBoundary.getTime() > now.getTime() &&
        preciseBoundary.getTime() < halfHourLater.getTime()
        ? preciseBoundary
        : halfHourLater;
    }

    return this.computeNextCoarseCheck(now);
  }

  private computeNextCoarseCheck(now: Date): Date {
    const todayAt16 = new Date(now);
    todayAt16.setHours(16, 0, 0, 0);
    if (todayAt16.getTime() > now.getTime()) {
      return todayAt16;
    }

    const tomorrowAt8 = new Date(now);
    tomorrowAt8.setDate(tomorrowAt8.getDate() + 1);
    tomorrowAt8.setHours(8, 0, 0, 0);
    return tomorrowAt8;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
