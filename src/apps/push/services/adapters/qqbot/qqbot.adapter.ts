import { Injectable } from '@nestjs/common';
import type {
  DevicePushDetails,
  ComfyUiPushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  PushChannelTarget,
  RepoPushDetails,
  WeatherPushDetails,
  PushMessageDetailsMap,
  PushMessageType,
  PushChannelInput,
  GeneralPushDetails,
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

  async send<T extends PushMessageType>(
    type: T,
    channel: PushChannelInput | undefined,
    details: PushMessageDetailsMap[T],
  ): Promise<void> {
    const target = typeof channel === 'string' ? channel : channel?.qqbot;
    if (!target)
      throw new Error(`Missing qqbot channel for push message: ${type}`);
    const content = (() => {
      switch (type) {
        case 'game-daily':
          return this.markdownHelper.buildGameDailyMarkdown(
            details as GameDailyPushDetails,
          );
        case 'weather':
          return this.markdownHelper.buildWeatherMarkdown(
            details as WeatherPushDetails,
          );
        case 'repo':
          return this.markdownHelper.buildRepoMarkdown(
            details as RepoPushDetails,
          );
        case 'mcserver':
          return this.markdownHelper.buildMcServerMarkdown(
            details as McServerPushDetails,
          );
        case 'device':
          return this.markdownHelper.buildDeviceMarkdown(
            details as DevicePushDetails,
          );
        case 'comfyui':
          return this.markdownHelper.buildComfyUiMarkdown(
            details as ComfyUiPushDetails,
          );
        case 'general':
          return this.markdownHelper.buildGeneralMarkdown(
            details as GeneralPushDetails,
          );
      }
    })();
    await this.messageService.sendMarkdown(
      this.resolveChannel(target),
      content,
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
