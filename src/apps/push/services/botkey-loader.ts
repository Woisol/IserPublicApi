import { CompactLogger } from '@app/common/utils/logger';
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface BotKeyConfig {
  [channel: string]: string;
}

@Injectable()
export class BotKeyLoader {
  private readonly logger = new CompactLogger(BotKeyLoader.name);
  private botKeys: BotKeyConfig = {};

  private _loadBotKeys(adapter: string): void {
    const configPath = path.join(process.cwd(), `bot-key.${adapter}.json`);
    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      this.botKeys = JSON.parse(configData) as BotKeyConfig;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        this.logger.warn(
          `bot-key.${adapter}.json not found, creating default config`,
        );
        const defaultConfig: BotKeyConfig = { general: '' };
        try {
          fs.writeFileSync(
            configPath,
            JSON.stringify(defaultConfig, null, 2),
            'utf-8',
          );
          this.botKeys = defaultConfig;
        } catch (writeError) {
          this.logger.error(
            `Failed to create bot-key.${adapter}.json:`,
            writeError,
          );
          this.botKeys = {};
        }
      } else {
        this.logger.error(`Failed to load bot-key.${adapter}.json:`, error);
        this.botKeys = {};
      }
    }
  }

  public getBotKey(adapter: string, channel: string): string | null {
    this._loadBotKeys(adapter);
    const key = this.botKeys[channel];
    if (!key) {
      this.logger.warn(`No key found for ${adapter} channel: ${channel}`);
      return null;
    }
    return key;
  }

  public getWebhookUrl(channel: string): string | null {
    const key = this.getBotKey('wxwork', channel);
    if (!key) return null;

    const webhookUrl =
      process.env.WXWORK_WEBHOOK_URL ||
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';
    return `${webhookUrl}?key=${key}`;
  }

  public getAvailableChannels(
    adapter = process.env.WEBHOOK_SEND_ADAPTER || 'wxwork',
  ): string[] {
    this._loadBotKeys(adapter);
    return Object.keys(this.botKeys);
  }
}
