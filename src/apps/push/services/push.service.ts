import { Injectable } from '@nestjs/common';
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
import { WxworkAdapter } from './adapters';

@Injectable()
export class PushService {
  private readonly logger = new CompactLogger(PushService.name);
  private readonly sendAdapter = process.env.WEBHOOK_SEND_ADAPTER;

  constructor(private readonly wxworkAdapter: WxworkAdapter) {}

  getAvailableChannels(): string[] {
    if (this.sendAdapter !== 'wxwork') {
      this.logger.error(
        `Unsupported webhook send adapter: ${this.sendAdapter}`,
      );
      return [];
    }
    return this.wxworkAdapter.getAvailableChannels();
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
    const channel = this.getWxworkChannel('game-daily', channels);
    if (channel) await this.wxworkAdapter.sendGameDaily(channel, details);
  }

  private async sendWeather(
    channels: PushChannels | undefined,
    details: WeatherPushDetails,
  ): Promise<void> {
    const channel = this.getWxworkChannel('weather', channels);
    if (channel) await this.wxworkAdapter.sendWeather(channel, details);
  }

  private async sendRepo(
    channels: PushChannels | undefined,
    details: RepoPushDetails,
  ): Promise<void> {
    const channel = this.getWxworkChannel('repo', channels);
    if (channel) await this.wxworkAdapter.sendRepo(channel, details);
  }

  private async sendMcServer(
    channels: PushChannels | undefined,
    details: McServerPushDetails,
  ): Promise<void> {
    const channel = this.getWxworkChannel('mcserver', channels);
    if (channel) await this.wxworkAdapter.sendMcServer(channel, details);
  }

  private async sendDevice(
    channels: PushChannels | undefined,
    details: DevicePushDetails,
  ): Promise<void> {
    const channel = this.getWxworkChannel('device', channels);
    if (channel) await this.wxworkAdapter.sendDevice(channel, details);
  }

  private getWxworkChannel(
    type: PushMessageType,
    channels: PushChannels | undefined,
  ): string | undefined {
    if (this.sendAdapter !== 'wxwork') {
      this.logger.error(
        `Unsupported webhook send adapter for ${type}: ${this.sendAdapter}`,
      );
      return undefined;
    }

    const channel = channels?.wxwork;
    if (!channel) {
      this.logger.error(`Missing wxwork channel for push message: ${type}`);
      return undefined;
    }
    return channel;
  }
}
