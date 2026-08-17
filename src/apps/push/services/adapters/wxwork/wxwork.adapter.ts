import { Injectable } from '@nestjs/common';
import { CompactLogger } from '@app/common/utils/logger';
import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  RepoPushDetails,
  WeatherPushDetails,
} from '@app/apps/push/types/push-message';
import type {
  WxwMarkdownInfo,
  WxwMessage,
  WxwWebhookResponse,
} from '@app/apps/push/types/wxwork-webhook';
import { WxwMessageType } from '@app/apps/push/types/wxwork-webhook.runtime';
import { BotKeyLoader } from '../../botkey-loader';
import type { PushAdapter } from '@app/apps/push/types/push-adapter';
import { wxworkMessageBuilder } from './wxwork-message-builder';

@Injectable()
export class WxworkAdapter implements PushAdapter {
  private readonly logger = new CompactLogger(WxworkAdapter.name);
  private readonly builder = wxworkMessageBuilder();
  private readonly timeout = 10000;

  constructor(private readonly botKeyLoader: BotKeyLoader) {}

  getAvailableChannels(): string[] {
    return this.botKeyLoader.getAvailableChannels();
  }

  async sendGameDaily(
    channel: string,
    details: GameDailyPushDetails,
  ): Promise<void> {
    await this.sendMarkdownInfo(channel, details);
  }

  async sendWeather(
    channel: string,
    details: WeatherPushDetails,
  ): Promise<void> {
    await this.send(channel, this.builder.text(details.message));
  }

  async sendRepo(channel: string, details: RepoPushDetails): Promise<void> {
    await this.sendMarkdownInfo(channel, details);
  }

  async sendMcServer(
    channel: string,
    details: McServerPushDetails,
  ): Promise<void> {
    const message = details.markdown
      ? this.builder.markdown(details.markdown)
      : this.builder.markdownInfo(details);
    await this.send(channel, message);
  }

  async sendDevice(channel: string, details: DevicePushDetails): Promise<void> {
    await this.sendMarkdownInfo(channel, details);
  }

  private async sendMarkdownInfo(
    channel: string,
    details: WxwMarkdownInfo,
  ): Promise<void> {
    await this.send(channel, this.builder.markdownInfo(details));
  }

  private async send(channel: string, message: WxwMessage): Promise<void> {
    if (!this.validateMessage(message)) {
      throw new Error('Invalid wxwork message format');
    }

    const webhookUrl = this.botKeyLoader.getWebhookUrl(channel);
    if (!webhookUrl) {
      throw new Error(
        `Channel '${channel}' not found or has no key configured`,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as WxwWebhookResponse;
      if (result.errcode !== 0) {
        throw new Error(
          `Wxwork API error: ${result.errmsg} (${result.errcode})`,
        );
      }
      this.logger.log(`Message sent to channel ${channel}:`, result);
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channel}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateMessage(message: WxwMessage): boolean {
    switch (message.msgtype) {
      case WxwMessageType.TEXT:
        return Boolean(message.text?.content);
      case WxwMessageType.MARKDOWN:
        return Boolean(message.markdown?.content);
      case WxwMessageType.IMAGE:
        return Boolean(message.image?.base64 && message.image.md5);
      case WxwMessageType.NEWS:
        return Boolean(message.news?.articles.length);
      case WxwMessageType.FILE:
        return Boolean(message.file?.media_id);
      case WxwMessageType.TEMPLATE_CARD:
        return Boolean(message.template_card);
    }
  }
}
