import { Injectable } from '@nestjs/common';
import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  PushChannelTarget,
  RepoPushDetails,
  WeatherPushDetails,
} from '@app/apps/push/types/push-message';
import type { PushAdapter } from '@app/apps/push/types/push-adapter';
import { QqbotMessageService } from './qqbot-message.service';
import { BotKeyLoader } from '../../botkey-loader';

@Injectable()
export class QqbotAdapter implements PushAdapter {
  readonly name = 'qqbot' as const;

  constructor(
    private readonly messageService: QqbotMessageService,
    private readonly botKeyLoader: BotKeyLoader,
  ) {
    if (
      process.env.WEBHOOK_SEND_ADAPTER === 'qqbot' &&
      (!process.env.QQBOT_APP_ID || !process.env.QQBOT_APP_SECRET)
    ) {
      throw new Error(
        'QQBOT_APP_ID and QQBOT_APP_SECRET are required when WEBHOOK_SEND_ADAPTER=qqbot',
      );
    }
  }

  getAvailableChannels(): string[] {
    return this.botKeyLoader.getAvailableChannels(this.name);
  }

  async sendGameDaily(
    channel: PushChannelTarget,
    details: GameDailyPushDetails,
  ): Promise<void> {
    const content =
      details.wakeupSuccessful === false
        ? '❌ 电脑唤醒失败\n请及时检查并修复问题'
        : details.status === 'failed'
          ? `⚠️ ${details.gameName} 每日完成情况获取失败\n${details.failureReason || '无法获取日志'}`
          : `${details.status === 'finished' ? '✅' : '❌'} ${details.gameName} 每日任务${details.status === 'finished' ? '已完成' : '未完成'}\n${details.detail
              .map((item) =>
                Object.entries(item)
                  .map(([key, value]) => `${key}: ${value || ''}`)
                  .join('\n'),
              )
              .join('\n')}`;
    await this.messageService.sendText(this.resolveChannel(channel), content);
  }

  async sendWeather(
    channel: PushChannelTarget,
    details: WeatherPushDetails,
  ): Promise<void> {
    const content =
      details.kind === 'minutely-rain'
        ? `预计 ${Math.max(Math.round((details.startsAt.getTime() - Date.now()) / 60000), 0)}min 后开始下雨\n降雨量 ${details.precipitationTimeline.map((value) => `${value.toFixed(2)}mm`).join('|')}，峰值 ${details.peakPrecipitation.toFixed(2)}mm`
        : `今天${details.periods.map((period) => `${period.startTime.getHours()}-${period.endTime.getHours()}点`).join('、')}可能下雨`;
    await this.messageService.sendText(this.resolveChannel(channel), content);
  }

  async sendRepo(
    channel: PushChannelTarget,
    details: RepoPushDetails,
  ): Promise<void> {
    await this.messageService.sendText(
      this.resolveChannel(channel),
      `GitHub 事件：${details.event}`,
    );
  }

  async sendMcServer(
    channel: PushChannelTarget,
    details: McServerPushDetails,
  ): Promise<void> {
    await this.messageService.sendText(
      this.resolveChannel(channel),
      `Minecraft 事件：${details.event}`,
    );
  }

  async sendDevice(
    channel: PushChannelTarget,
    details: DevicePushDetails,
  ): Promise<void> {
    await this.messageService.sendText(
      this.resolveChannel(channel),
      `设备告警：CPU ${details.cpuUsage.toFixed(2)}%，内存 ${details.memoryUsage.toFixed(2)}%`,
    );
  }

  private resolveChannel(channel: PushChannelTarget): PushChannelTarget {
    if (typeof channel !== 'string') return channel;

    const groupOpenid = this.botKeyLoader.getBotKey(this.name, channel);
    if (!groupOpenid) {
      throw new Error(
        `Channel '${channel}' not found in bot-key.${this.name}.json`,
      );
    }
    return {
      type: 'group',
      id: groupOpenid,
    };
  }
}
