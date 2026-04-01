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
  atHour,
  dateKey,
  plusDays,
  plusMinutes,
} from './weather.service/index.service';

@Injectable()
export class WeatherService implements OnModuleInit {
  private readonly logger = new CompactLogger(WeatherService.name);

  private readonly _config: WeatherMonitorConfig = {
    location: process.env.QWEATHER_LOCATION,
    apiKey: process.env.QWEATHER_API_KEY || '',
    apiHost: process.env.QWEATHER_API_HOST || 'devapi.qweather.com',
  };

  private readonly trackingState = new WeatherDetectorStateStore();
  private readonly forecastClient = new WeatherForecastService(
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
    void this.refreshDailyPlan(new Date());
  }

  // #region 三个自动方法
  /**
   * 8 点到 25 点(?)每5分钟运行一次心跳，根据 nextCheckAt 决定是否真正请求天气接口
   */
  @Cron('0 */5 0-1,8-23 * * *')
  async heartbeat() {
    if (!this._config.apiKey) {
      return;
    }

    try {
      const decision = await this.advanceWeatherEngineTick();
      this.logger.debug('Weather engine tick result:', decision);
    } catch (error) {
      this.logger.error('Weather engine tick failed:', error);
    }
  }

  /**
   * 每天早上8点重建当天降雨计划
   */
  @Cron('0 0 8 * * *')
  async morningPlannig() {
    if (!this._config.apiKey) {
      return;
    }

    await this.refreshDailyPlan(new Date());
  }

  /**
   * 下午4点再做一次全天粗筛，补齐晚间天气变化
   */
  @Cron('0 0 16 * * *')
  async afternoonPlanning() {
    if (!this._config.apiKey) {
      return;
    }

    await this.refreshDailyPlan(new Date());
  }

  // #region 下雨预警
  /**
   * checkRainStart(now, { previewOnly: true }) 的包装，主要用于手动请求路由
   */
  async previewRainStartAlert(now = new Date()): Promise<WeatherAlertResult> {
    return this.checkRainStart(now, { previewOnly: true });
  }

  async refreshDailyPlan(now = new Date()): Promise<WeatherDailyCheckResult> {
    const rainPeriods = await this.loadDailyPlan(now);
    return {
      rainPeriods,
      status: this.getRuntimeStatus(),
    };
  }

  async previewDailyPlan(now = new Date()): Promise<WeatherDailyCheckResult> {
    const rainPeriods = await this.loadDailyPlan(now, { persist: false });
    return {
      rainPeriods,
      status: this.getRuntimeStatus(),
    };
  }

  // !核心方法
  /**
   * 根据小时级数据分析降雨段，不加参数默认更新状态
   */
  private async loadDailyPlan(now: Date): Promise<WeatherRainPeriod[]>;
  /**
   * 根据小时级数据分析降雨段
   */
  private async loadDailyPlan(
    now: Date,
    options: { persist: boolean },
  ): Promise<WeatherRainPeriod[]>;
  private async loadDailyPlan(
    now: Date,
    options: { persist: boolean } = { persist: true },
  ): Promise<WeatherRainPeriod[]> {
    const response = await this.forecastClient.fetchHourlyWeather();
    const rainPeriods = buildRainPeriods(response?.hourly ?? [], now);

    if (options.persist) {
      this.trackingState.setDailyPlan(dateKey(now), rainPeriods);
      this.updateStartTrackingFromPlan(now, rainPeriods);
    }

    return rainPeriods;
  }

  /**
   * 根据降雨段更新状态机
   */
  private updateStartTrackingFromPlan(
    now: Date,
    rainPeriods: WeatherRainPeriod[],
  ) {
    const trackedPeriod = rainPeriods.find(
      (period) => period.endTime.getTime() > now.getTime(),
    );

    // 当天没有降雨期
    if (!trackedPeriod) {
      this.trackingState.setStartTracking(
        'idle',
        this.getNextDailyPlanningTime(now),
      );
      return;
    }

    const periodAlreadyStarted =
      trackedPeriod.startTime.getTime() <= now.getTime();
    const startMode = periodAlreadyStarted
      ? 'watch'
      : this.getStartTrackingMode(now, trackedPeriod.startTime);
    const nextCheckAt =
      startMode === 'idle' ? plusMinutes(trackedPeriod.startTime, -60) : now;

    this.trackingState.setStartTracking(
      startMode,
      nextCheckAt,
      periodAlreadyStarted ? undefined : trackedPeriod.startTime,
    );
  }

  /**
   *
   */
  private async checkRainStart(
    now: Date,
  ): Promise<WeatherEngineDecision['start']>;
  // options: { previewOnly: false },
  private async checkRainStart(
    now: Date,
    options: { previewOnly: boolean },
  ): Promise<WeatherAlertResult>;
  private async checkRainStart(
    now: Date,
    options: { previewOnly: boolean } = { previewOnly: false },
  ): Promise<WeatherAlertResult | WeatherEngineDecision['start']> {
    if (options.previewOnly) {
      const response = await this.forecastClient.fetchMinutelyPrecipitation();
      if (!response?.minutely) {
        return { shouldAlert: false };
      }

      const analysis = analyzeRainStart(response.minutely, now);
      return {
        shouldAlert: Boolean(analysis.nextRainStartAt),
        message: analysis.message,
        time: analysis.nextRainStartAt,
      };
    }

    const state = this.trackingState.getRawState();
    if (
      !state.nextStartCheckAt ||
      state.nextStartCheckAt.getTime() > now.getTime()
    ) {
      return {
        sent: false,
        nextCheckAt: state.nextStartCheckAt,
      };
    }

    const response = await this.forecastClient.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      const retryMode =
        state.startMode === 'precise' || state.startMode === 'idle'
          ? 'watch'
          : state.startMode;
      const nextCheckAt = plusMinutes(now, 30);
      this.trackingState.setStartTracking(
        retryMode,
        nextCheckAt,
        state.nextRainStartAt,
      );
      return {
        sent: false,
        nextCheckAt,
      };
    }

    const analysis = analyzeRainStart(response.minutely, now);
    if (!analysis.nextRainStartAt || !analysis.message) {
      this.updateStartTrackingFromPlan(now, state.rainPeriods);
      return {
        sent: false,
        nextCheckAt: this.trackingState.getSnapshot().nextStartCheckAt,
      };
    }

    const startMode = this.getStartTrackingMode(now, analysis.nextRainStartAt);
    const nextCheckAt = this.getNextStartTrackingCheckAt(
      now,
      startMode,
      analysis.nextRainStartAt,
    );
    this.trackingState.setStartTracking(
      startMode,
      nextCheckAt,
      analysis.nextRainStartAt,
    );

    if (
      startMode === 'precise' &&
      !this.trackingState.hasSentStartAlert(analysis.nextRainStartAt)
    ) {
      await this.sendRainAlert(analysis.message);
      this.trackingState.rememberStartAlert(analysis.nextRainStartAt);
      await this.refreshDailyPlan(now);
      return {
        sent: true,
        message: analysis.message,
        nextCheckAt: this.trackingState.getSnapshot().nextStartCheckAt,
      };
    }

    return {
      sent: false,
      nextCheckAt,
    };
  }

  private getStartTrackingMode(
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

  private getNextStartTrackingCheckAt(
    now: Date,
    startMode: 'idle' | 'watch' | 'precise',
    targetTime: Date,
  ): Date {
    if (startMode === 'precise') {
      return plusMinutes(now, 5);
    }

    if (startMode === 'watch') {
      const preciseBoundary = plusMinutes(targetTime, -10);
      const halfHourLater = plusMinutes(now, 30);
      return preciseBoundary.getTime() > now.getTime() &&
        preciseBoundary.getTime() < halfHourLater.getTime()
        ? preciseBoundary
        : halfHourLater;
    }

    return this.getNextDailyPlanningTime(now);
  }

  // #region 停雨通知
  /**
   * 请求停雨通知主入口
   */
  async armNextNoRainNotification(
    now = new Date(),
  ): Promise<WeatherNotifyResult> {
    if (!this._config.apiKey) {
      return {
        armed: false,
        stopMode: 'off',
        hasRainWithin2Hours: false,
        sent: false,
        reason: 'missing-api-key',
      };
    }

    const response = await this.forecastClient.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      this.trackingState.clearStopTracking();
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
      this.trackingState.rememberStopAlert(analysis.nextRainStopAt);
      this.trackingState.clearStopTracking();
      return {
        armed: false,
        stopMode: 'off',
        hasRainWithin2Hours: analysis.hasRainWithin2Hours,
        nextRainStopAt: analysis.nextRainStopAt,
        noRainDurationMinutes: analysis.noRainDurationMinutes,
        sent: true,
        message: analysis.message,
        reason: 'sent-immediately',
      };
    }

    if (!analysis.hasRainWithin2Hours && !analysis.shouldTrack) {
      this.trackingState.clearStopTracking();
      return {
        armed: false,
        stopMode: 'off',
        hasRainWithin2Hours: false,
        sent: false,
        reason: 'no-rain-within-2h',
      };
    }

    if (analysis.nextRainStopAt) {
      const stopMode = this.getStopTrackingMode(now, analysis.nextRainStopAt);
      const nextCheckAt = this.getNextStopTrackingCheckAt(
        now,
        stopMode,
        analysis.nextRainStopAt,
      );
      this.trackingState.setStopTracking(
        stopMode,
        nextCheckAt,
        analysis.nextRainStopAt,
      );

      return {
        armed: true,
        stopMode,
        nextCheckAt,
        hasRainWithin2Hours: analysis.hasRainWithin2Hours,
        nextRainStopAt: analysis.nextRainStopAt,
        noRainDurationMinutes: analysis.noRainDurationMinutes,
        sent: false,
        reason: 'tracking-stop',
      };
    }

    const nextCheckAt = plusMinutes(now, 30);
    this.trackingState.setStopTracking('watch', nextCheckAt);
    return {
      armed: true,
      stopMode: 'watch',
      nextCheckAt,
      hasRainWithin2Hours: analysis.hasRainWithin2Hours,
      noRainDurationMinutes: analysis.noRainDurationMinutes,
      sent: false,
      reason: 'waiting-for-stop-window',
    };
  }

  private async advanceStopTracking(
    now: Date,
  ): Promise<WeatherEngineDecision['stop']> {
    const state = this.trackingState.getRawState();
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

    const response = await this.forecastClient.fetchMinutelyPrecipitation();
    if (!response?.minutely) {
      const nextCheckAt = plusMinutes(now, 30);
      this.trackingState.setStopTracking(
        'watch',
        nextCheckAt,
        state.nextRainStopAt,
      );
      return {
        sent: false,
        nextCheckAt,
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
      if (!this.trackingState.hasSentStopAlert(analysis.nextRainStopAt)) {
        await this.sendRainAlert(analysis.message);
        this.trackingState.rememberStopAlert(analysis.nextRainStopAt);
      }
      this.trackingState.clearStopTracking();
      return {
        sent: true,
        message: analysis.message,
      };
    }

    if (!analysis.hasRainWithin2Hours && !analysis.shouldTrack) {
      this.trackingState.clearStopTracking();
      return { sent: false };
    }

    if (analysis.nextRainStopAt) {
      const stopMode = this.getStopTrackingMode(now, analysis.nextRainStopAt);
      const nextCheckAt = this.getNextStopTrackingCheckAt(
        now,
        stopMode,
        analysis.nextRainStopAt,
      );
      this.trackingState.setStopTracking(
        stopMode,
        nextCheckAt,
        analysis.nextRainStopAt,
      );
      return {
        sent: false,
        nextCheckAt,
      };
    }

    const nextCheckAt = plusMinutes(now, 30);
    this.trackingState.setStopTracking(
      'watch',
      nextCheckAt,
      state.nextRainStopAt,
    );
    return {
      sent: false,
      nextCheckAt,
    };
  }

  private getStopTrackingMode(
    now: Date,
    targetTime: Date,
  ): 'watch' | 'precise' {
    const minutesUntilTarget = Math.round(
      (targetTime.getTime() - now.getTime()) / (1000 * 60),
    );

    return minutesUntilTarget <= 10 ? 'precise' : 'watch';
  }

  private getNextStopTrackingCheckAt(
    now: Date,
    stopMode: 'watch' | 'precise',
    targetTime: Date,
  ): Date {
    if (stopMode === 'precise') {
      return plusMinutes(now, 5);
    }

    const preciseBoundary = plusMinutes(targetTime, -10);
    const halfHourLater = plusMinutes(now, 30);
    return preciseBoundary.getTime() > now.getTime() &&
      preciseBoundary.getTime() < halfHourLater.getTime()
      ? preciseBoundary
      : halfHourLater;
  }

  // #region general
  async advanceWeatherEngineTick(
    now = new Date(),
  ): Promise<WeatherEngineDecision> {
    if (!this._config.apiKey) {
      return {
        start: { sent: false },
        stop: { sent: false },
      };
    }

    await this.ensureTodayPlan(now);

    return {
      start: await this.checkRainStart(now, { previewOnly: false }),
      stop: await this.advanceStopTracking(now),
    };
  }

  getRuntimeStatus(): WeatherRuntimeStatus {
    return this.trackingState.getSnapshot();
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

  private async ensureTodayPlan(now: Date) {
    const state = this.trackingState.getRawState();
    if (state.plannedDate === dateKey(now)) {
      return;
    }

    await this.refreshDailyPlan(now);
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

  private getNextDailyPlanningTime(now: Date): Date {
    const todayAt16 = atHour(now, 16);
    if (todayAt16.getTime() > now.getTime()) {
      return todayAt16;
    }

    return atHour(plusDays(now, 1), 8);
  }
}
