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
import { MarkdownMessageHelper } from '../markdown-message-helper';

@Injectable()
export class QqbotAdapter implements PushAdapter {
  readonly name = 'qqbot' as const;

  constructor(
    private readonly messageService: QqbotMessageService,
    private readonly botKeyLoader: BotKeyLoader,
    private readonly markdownHelper: MarkdownMessageHelper,
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
    await this.messageService.sendMarkdown(
      this.resolveChannel(channel),
      this.markdownHelper.buildGameDailyMarkdown(details),
    );
  }

  async sendWeather(
    channel: PushChannelTarget,
    details: WeatherPushDetails,
  ): Promise<void> {
    await this.messageService.sendMarkdown(
      this.resolveChannel(channel),
      this.markdownHelper.buildWeatherMarkdown(details),
    );
  }

  async sendRepo(
    channel: PushChannelTarget,
    details: RepoPushDetails,
  ): Promise<void> {
    await this.messageService.sendMarkdown(
      this.resolveChannel(channel),
      this.markdownHelper.buildRepoMarkdown(details),
    );
  }

  async sendMcServer(
    channel: PushChannelTarget,
    details: McServerPushDetails,
  ): Promise<void> {
    await this.messageService.sendMarkdown(
      this.resolveChannel(channel),
      this.markdownHelper.buildMcServerMarkdown(details),
    );
  }

  async sendDevice(
    channel: PushChannelTarget,
    details: DevicePushDetails,
  ): Promise<void> {
    await this.messageService.sendMarkdown(
      this.resolveChannel(channel),
      this.markdownHelper.buildDeviceMarkdown(details),
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
