import { Injectable, Logger } from '@nestjs/common';
import { PushServiceHelper, wxwMessageBuilder } from './helper';
import WxwMessage, { WxwErrorCode, WxwMentionUser, WxwMessageType, WxwNewsArticle, WxwWebhookResponse } from '@app/types/push/wxw-webhook';

// 推送服务配置接口
export interface PushServiceConfig {
  webhookUrl?: string;
  timeout?: number; // 请求超时时间（毫秒）
  retryCount?: number; // 重试次数
  enableLogging?: boolean; // 是否启用日志
}
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly builder = wxwMessageBuilder();
  private readonly helper = PushServiceHelper;
  private readonly config: PushServiceConfig;

  constructor(config: PushServiceConfig = {}) {
    this.config = {
      webhookUrl: process.env.WXWORK_WEBHOOK_URL || '',
      timeout: 10000, // 默认10秒超时
      retryCount: 3, // 默认重试3次
      enableLogging: true, // 默认启用日志
      ...config,
    };
  }

  /**
   * 发送消息到企微群
   * @param message 要发送的消息
   */
  async _sendMessage(message: WxwMessage): Promise<WxwWebhookResponse> {
    // 验证消息格式
    if (!this.validateMessage(message)) {
      throw new Error('Invalid message format');
    }

    const url = this.config.webhookUrl;
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    let lastError: Error;

    // 怎么请求重试都给我写好了😂 @todo 使用库并迁移到 common
    for (let attempt = 1; attempt <= this.config.retryCount; attempt++) {
      try {
        if (this.config.enableLogging) {
          this.logger.debug(
            `Sending message to webhook (attempt ${attempt}): ${url}`,
            message,
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: WxwWebhookResponse = await response.json();

        if (result.errcode !== WxwErrorCode.SUCCESS) {
          // 某些错误不需要重试
          if (
            result.errcode === WxwErrorCode.INVALID_WEBHOOK ||
            result.errcode === WxwErrorCode.INVALID_MSGTYPE ||
            result.errcode === WxwErrorCode.INVALID_TEXT ||
            result.errcode === WxwErrorCode.INVALID_MARKDOWN ||
            result.errcode === WxwErrorCode.INVALID_IMAGE ||
            result.errcode === WxwErrorCode.INVALID_NEWS ||
            result.errcode === WxwErrorCode.INVALID_FILE ||
            result.errcode === WxwErrorCode.INVALID_TEMPLATE_CARD
          ) {
            throw new Error(
              `WeChat Work API error: ${result.errmsg} (${result.errcode})`,
            );
          }

          throw new Error(
            `WeChat Work API error: ${result.errmsg} (${result.errcode})`,
          );
        }

        if (this.config.enableLogging) {
          this.logger.debug('Message sent successfully', result);
        }
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retryCount) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 指数退避
          if (this.config.enableLogging) {
            this.logger.warn(
              `Attempt ${attempt} failed, retrying in ${delay}ms...`,
              error,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (this.config.enableLogging) {
      this.logger.error('All retry attempts failed', lastError);
    }
    throw lastError;
  }

  // /**
  //  * 批量发送消息到多个群
  //  * @param webhookUrls 群机器人webhook地址列表
  //  * @param message 要发送的消息
  //  */
  // async sendMessageToMultipleGroups(
  //   webhookUrls: string[],
  //   message: WxwMessage
  // ): Promise<WxwWebhookResponse[]> {
  //   const promises = webhookUrls.map(url => this.sendMessage(url, message));
  //   return Promise.all(promises);
  // }

  /**
   * 连通性消息测试
   */
  async sendTestMessage(): Promise<WxwWebhookResponse> {
    const message = this.helper._createTestMessage();
    return this._sendMessage(message);
  }

  /**
   * 发送简单文本消息的便捷方法
   * @param content 消息内容
   * @param mentions 要@的用户列表
   */
  async sendTextMessage(
    content: string,
    mentions?: WxwMentionUser[],
  ): Promise<WxwWebhookResponse> {
    const message = this.builder.text(content, mentions);
    return this._sendMessage(message);
  }

  /**
   * 发送Markdown消息的便捷方法
   * @param content Markdown格式的消息内容
   */
  async sendMarkdownMessage(content: string): Promise<WxwWebhookResponse> {
    const message = this.builder.markdown(content);
    return this._sendMessage(message);
  }

  /**
   * 发送图文消息的便捷方法
   * @param articles 图文消息文章列表
   */
  async sendNewsMessage(
    articles: WxwNewsArticle[],
  ): Promise<WxwWebhookResponse> {
    const message = this.builder.news(articles);
    return this._sendMessage(message);
  }

  /**
   * 验证消息格式是否正确
   * @param message 要验证的消息
   */
  validateMessage(message: WxwMessage): boolean {
    try {
      // 基本验证
      if (!message.msgtype) {
        throw new Error('Message type is required');
      }

      switch (message.msgtype) {
        case WxwMessageType.TEXT:
          if (!message.text?.content) {
            throw new Error('Text message content is required');
          }
          break;
        case WxwMessageType.MARKDOWN:
          if (!message.markdown?.content) {
            throw new Error('Markdown message content is required');
          }
          break;
        case WxwMessageType.IMAGE:
          if (!message.image?.base64 || !message.image?.md5) {
            throw new Error('Image message base64 and md5 are required');
          }
          break;
        case WxwMessageType.NEWS:
          if (!message.news?.articles || message.news.articles.length === 0) {
            throw new Error('News message articles are required');
          }
          break;
        case WxwMessageType.FILE:
          if (!message.file?.media_id) {
            throw new Error('File message media_id is required');
          }
          break;
        case WxwMessageType.TEMPLATE_CARD:
          if (!message.template_card) {
            throw new Error('Template card content is required');
          }
          break;
        default:
          throw new Error(`Unknown message type: ${(message as any).msgtype}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Message validation failed', error);
      return false;
    }
  }

  /**
   * 更新服务配置
   * @param config 新的配置项
   */
  updateConfig(config: Partial<PushServiceConfig>) {
    Object.assign(this.config, config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): PushServiceConfig {
    return { ...this.config };
  }

  // /**
  //  * 创建@所有人的提及列表
  //  */
  // mentionAll(): WxwMentionUser[] {
  //   return [{ userid: '@all' }];
  // }

  // /**
  //  * 创建@特定用户的提及列表
  //  * @param userIds 用户ID列表
  //  */
  // mentionUsers(userIds: string[]): WxwMentionUser[] {
  //   return userIds.map(userid => ({ userid }));
  // }

  // /**
  //  * 创建@手机号用户的提及列表
  //  * @param mobiles 手机号列表
  //  */
  // mentionMobiles(mobiles: string[]): WxwMentionUser[] {
  //   return mobiles.map(mobile => ({ mobile }));
  // }
}

// // 导出便捷的工厂函数
// export function createPushService(config?: PushServiceConfig): PushService {
//   return new PushService(config);
// }
