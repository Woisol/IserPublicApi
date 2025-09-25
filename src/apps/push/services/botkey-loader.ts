import { CompactLogger } from '@app/common/utils/logger';
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Bot Key 配置接口
export interface BotKeyConfig {
  [channel: string]: string;
}

@Injectable()
export class BotKeyLoader {
  private readonly logger = new CompactLogger(BotKeyLoader.name);
  private botKeys: BotKeyConfig = {};
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'bot-key.json');
    this._loadBotKeys();
  }

  /**
   * 加载 bot-key.json 配置文件
   */
  private _loadBotKeys(): void {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.botKeys = JSON.parse(configData) as BotKeyConfig;
      // this.logger.log('Bot keys loaded successfully');
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        // 文件不存在，创建默认配置
        this.logger.warn('bot-key.json not found, creating default config');

        const defaultConfig: BotKeyConfig = {
          general: '',
        };

        try {
          fs.writeFileSync(
            this.configPath,
            JSON.stringify(defaultConfig, null, 2),
            'utf-8',
          );
          this.botKeys = defaultConfig;
          this.logger.log('Default bot-key.json created successfully');
        } catch (writeError) {
          this.logger.error(
            'Failed to create default config file:',
            writeError,
          );
          this.botKeys = {};
        }
      } else {
        // 其他错误（权限问题、JSON解析错误等）
        this.logger.error('Failed to load bot keys:', error);
        this.botKeys = {};
      }
    }
  }

  /**
   * 获取指定渠道的 bot key
   * @param channel 渠道名称
   * @returns 对应的 bot key 或 null
   */
  private _getBotKey(channel: string): string | null {
    this._loadBotKeys();
    const key = this.botKeys[channel];
    if (!key) {
      this.logger.warn(`No key found for channel: ${channel}`);
      return null;
    }
    return key;
  }

  /**
   * 获取指定渠道的 webhook URL
   * @param channel 渠道名称
   * @returns 对应的 webhook URL 或 null
   */
  public getWebhookUrl(channel: string): string | null {
    const key = this._getBotKey(channel);
    if (!key) {
      return null;
    }

    // 构建企微机器人 webhook URL
    return `${process.env.WXWORK_WEBHOOK_URL}?key=${key}`;
  }

  /**
   * 获取所有可用的渠道
   * @returns 渠道名称数组
   */
  public getAvailableChannels(): string[] {
    return Object.keys(this.botKeys);
  }

  // /**
  //  * 检查指定渠道是否存在
  //  * @param channel 渠道名称
  //  * @returns 是否存在该渠道
  //  */
  // public hasChannel(channel: string): boolean {
  //   return channel in this.botKeys;
  // }

  // /**
  //  * 添加或更新渠道配置
  //  * @param channel 渠道名称
  //  * @param key bot key
  //  */
  // public setBotKey(channel: string, key: string): void {
  //   this.botKeys[channel] = key;
  //   this.saveBotKeys();
  // }

  // /**
  //  * 删除渠道配置
  //  * @param channel 渠道名称
  //  */
  // public removeBotKey(channel: string): boolean {
  //   if (this.hasChannel(channel)) {
  //     delete this.botKeys[channel];
  //     this.saveBotKeys();
  //     return true;
  //   }
  //   return false;
  // }

  // /**
  //  * 保存配置到文件
  //  */
  // private saveBotKeys(): void {
  //   try {
  //     fs.writeFileSync(
  //       this.configPath,
  //       JSON.stringify(this.botKeys, null, 2),
  //       'utf-8',
  //     );
  //     this.logger.log('Bot keys saved successfully');
  //   } catch (error) {
  //     this.logger.error('Failed to save bot keys:', error);
  //   }
  // }

  // /**
  //  * 获取所有bot keys的副本
  //  * @returns bot keys 配置对象的副本
  //  */
  // public getAllBotKeys(): BotKeyConfig {
  //   return { ...this.botKeys };
  // }

  // /**
  //  * 批量设置bot keys
  //  * @param config 新的配置对象
  //  */
  // public setBotKeys(config: BotKeyConfig): void {
  //   this.botKeys = { ...config };
  //   this.saveBotKeys();
  // }

  // /**
  //  * 清空所有配置
  //  */
  // public clearBotKeys(): void {
  //   this.botKeys = {};
  //   this.saveBotKeys();
  // }
}
