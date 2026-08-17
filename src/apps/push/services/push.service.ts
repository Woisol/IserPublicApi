import { Inject, Injectable } from '@nestjs/common';
import { CompactLogger } from '@app/common/utils/logger';
import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  PushChannels,
  PushMessageDetailsMap,
  PushMessageType,
  RepoPushDetails,
  WeatherPushDetails,
} from '@app/apps/push/types/push-message';
import type { PushAdapter } from '@app/apps/push/types/push-adapter';
import { PUSH_ADAPTERS } from './adapters';

@Injectable()
export class PushService {
  private readonly logger = new CompactLogger(PushService.name);
  private readonly sendAdapter: PushAdapter['name'];
  private readonly adapter: PushAdapter;

  // 这里通过 Symbol 作为注入标识，是为了让 Nest 能按唯一 token 注入适配器数组。
  // 这样可以避免使用字符串时的重名冲突，也能把具体注入哪一个适配器的责任交给模块配置。
  constructor(@Inject(PUSH_ADAPTERS) adapters: PushAdapter[]) {
    const configuredAdapter = process.env.WEBHOOK_SEND_ADAPTER?.trim();
    if (!configuredAdapter) {
      throw new Error(
        'WEBHOOK_SEND_ADAPTER is required to start the push service',
      );
    }

    const adapter = adapters.find(
      (candidate) => candidate.name === configuredAdapter,
    );
    if (!adapter) {
      throw new Error(
        `Webhook send adapter '${configuredAdapter}' is not registered`,
      );
    }

    this.sendAdapter = adapter.name;
    this.adapter = adapter;
  }

  getAvailableChannels(): string[] {
    return this.adapter.getAvailableChannels();
  }

  async sendMessage<T extends PushMessageType>(
    type: T,
    channels: PushChannels | undefined,
    details: PushMessageDetailsMap[T],
  ): Promise<void> {
    switch (type) {
      case 'game-daily':
        return this.sendGameDaily(channels, details as GameDailyPushDetails);
      case 'weather':
        return this.sendWeather(channels, details as WeatherPushDetails);
      case 'repo':
        return this.sendRepo(channels, details as RepoPushDetails);
      case 'mcserver':
        return this.sendMcServer(channels, details as McServerPushDetails);
      case 'device':
        return this.sendDevice(channels, details as DevicePushDetails);
    }
  }

  private async sendGameDaily(
    channels: PushChannels | undefined,
    details: GameDailyPushDetails,
  ): Promise<void> {
    const channel = this.getChannel('game-daily', channels);
    if (channel) await this.adapter.sendGameDaily(channel, details);
  }

  private async sendWeather(
    channels: PushChannels | undefined,
    details: WeatherPushDetails,
  ): Promise<void> {
    const channel = this.getChannel('weather', channels);
    if (channel) await this.adapter.sendWeather(channel, details);
  }

  private async sendRepo(
    channels: PushChannels | undefined,
    details: RepoPushDetails,
  ): Promise<void> {
    const channel = this.getChannel('repo', channels);
    if (channel) await this.adapter.sendRepo(channel, details);
  }

  private async sendMcServer(
    channels: PushChannels | undefined,
    details: McServerPushDetails,
  ): Promise<void> {
    const channel = this.getChannel('mcserver', channels);
    if (channel) await this.adapter.sendMcServer(channel, details);
  }

  private async sendDevice(
    channels: PushChannels | undefined,
    details: DevicePushDetails,
  ): Promise<void> {
    const channel = this.getChannel('device', channels);
    if (channel) await this.adapter.sendDevice(channel, details);
  }

  private getChannel(
    type: PushMessageType,
    channels: PushChannels | undefined,
  ): string | undefined {
    const channel = channels?.[this.sendAdapter];
    if (!channel) {
      this.logger.error(
        `Missing ${this.sendAdapter} channel for push message: ${type}`,
      );
      return undefined;
    }
    return channel;
  }
}
