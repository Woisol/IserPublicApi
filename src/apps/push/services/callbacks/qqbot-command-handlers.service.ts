import { Injectable } from '@nestjs/common';
import type { QqbotCommandContext } from '@app/apps/push/types/qqbot';
import {
  PushApplicationsDeviceMonitorService,
  PushApplicationsGameDailyService,
  PushApplicationsWeatherService,
} from '../applications';
import { QqbotCommandRouterService } from './qqbot-command-router.service';

@Injectable()
export class QqbotCommandHandlersService {
  constructor(
    router: QqbotCommandRouterService,
    deviceService: PushApplicationsDeviceMonitorService,
    gameDailyService: PushApplicationsGameDailyService,
    weatherService: PushApplicationsWeatherService,
  ) {
    router.register({
      command: 'status',
      aliases: ['sysinfo'],
      description: '查看设备状态',
      usage: '/status',
      handle: () => this.formatSystemInfo(deviceService.getSystemInfo()),
    });

    router.register({
      command: 'weather',
      aliases: ['rain'],
      description: '查看降雨预报，默认检查未来一小时',
      usage: '/weather [minutely|daily]',
      handle: (context) => this.handleWeather(context, weatherService),
    });

    router.register({
      command: 'wake',
      description: '唤醒电脑（仅白名单用户）',
      usage: '/wake',
      handle: (context) => this.handleWake(context, gameDailyService),
    });

    router.register({
      command: 'game-daily',
      aliases: ['gd'],
      description: '查询游戏每日任务状态',
      usage: '/game-daily <Genshin|Star Rail>',
      handle: (context) => this.handleGameDaily(context, gameDailyService),
    });
  }

  private formatSystemInfo(
    info: ReturnType<PushApplicationsDeviceMonitorService['getSystemInfo']>,
  ): string {
    return [
      '系统状态',
      `负载：${info.loadAvg.length ? info.loadAvg.map((value) => value.toFixed(2)).join(' / ') : '未知'}`,
      `内存：${info.memoryUsage.toFixed(2)}%（可用 ${info.freeMemory} / 总计 ${info.totalMemory}）`,
      `系统：${info.platform}`,
      `CPU 型号：${info.cpuModel}`,
      `核心数：${info.cpuCount}`,
      `运行时间：${info.uptime}`,
    ].join('\n');
  }

  private async handleWeather(
    context: QqbotCommandContext,
    weatherService: PushApplicationsWeatherService,
  ): Promise<string> {
    const mode = context.args[0]?.toLowerCase() || 'minutely';
    if (mode !== 'minutely' && mode !== 'daily') {
      return '用法：/weather [minutely|daily]';
    }

    const result =
      mode === 'daily'
        ? await weatherService.testDailyCheck()
        : await weatherService.testMinutelyCheck();
    if (!result.shouldAlert) {
      return mode === 'daily'
        ? '今天暂无明显降雨预报'
        : '未来一小时暂无降雨预报';
    }
    if (mode === 'daily' && result.details?.kind === 'daily-rain') {
      return [
        '今日降雨预报',
        ...result.details.periods.map(
          (period) =>
            `- ${this.formatHour(period.startTime)}-${this.formatHour(period.endTime)}`,
        ),
      ].join('\n');
    }
    if (result.details?.kind === 'minutely-rain') {
      return [
        '未来一小时降雨预报',
        `预计开始：${result.details.startsAt.toLocaleTimeString('zh-CN')}`,
        `降雨量：${result.details.precipitationTimeline.map((value) => `${value.toFixed(2)}mm`).join(' | ')}`,
        `峰值：${result.details.peakPrecipitation.toFixed(2)}mm（${result.details.peakAt.toLocaleTimeString('zh-CN')}）`,
      ].join('\n');
    }
    return '暂无可用天气数据';
  }

  private async handleWake(
    context: QqbotCommandContext,
    gameDailyService: PushApplicationsGameDailyService,
  ): Promise<string> {
    const whiteList = (process.env.QQBOT_COMMAND_WHITE_LIST || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!whiteList.includes(context.userId)) {
      console.warn(
        `Unauthorized wake command attempt by userId=${context.userId}`,
      );
      return '你没有权限执行此命令';
    }
    const result = await gameDailyService.wakeUpComputer();
    return result.wakeupSuccessful
      ? '已发送电脑唤醒信号'
      : '电脑唤醒失败，请检查服务日志';
  }

  private async handleGameDaily(
    context: QqbotCommandContext,
    gameDailyService: PushApplicationsGameDailyService,
  ): Promise<string> {
    const inputGameName = context.args.join(' ');
    if (!inputGameName) return '用法：/game-daily <Genshin|Star Rail>';
    const gameName =
      inputGameName.toLowerCase() === 'genshin'
        ? 'Genshin'
        : inputGameName.toLowerCase() === 'star rail'
          ? 'Star Rail'
          : inputGameName;
    const details = await gameDailyService.queryGameDailyCheck(gameName);
    if (details.status === 'failed') {
      return `${details.gameName}：查询失败${details.failureReason ? `，${details.failureReason}` : ''}`;
    }
    const status = details.status === 'finished' ? '已完成' : '未完成';
    const detailText = details.detail
      .flatMap((item) =>
        Object.entries(item).map(
          ([name, value]) => `${name}：${value || '未知'}`,
        ),
      )
      .join('\n');
    return [`${details.gameName}每日任务：${status}`, detailText]
      .filter(Boolean)
      .join('\n');
  }

  private formatHour(value: Date): string {
    return value.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
