// 类型从 .d.ts 引入；值从 runtime 模块引入，避免运行时加载 .d.ts
import type {
  WxwMarkdownMessage,
  WxwMessageBuilder,
  WxwNewsArticle,
} from '@app/types/push/wxw-webhook';
import { WxwMessageType } from '@app/types/push/wxw-webhook.runtime';

// import {
//   WxwMessageBuilder
// } from '@type/push';

export function wxwMessageBuilder(): WxwMessageBuilder {
  return {
    text(content, mentions?) {
      return {
        msgtype: WxwMessageType.TEXT,
        text: {
          content,
          mentioned_list: mentions?.map((m) => m.userid),
          mentioned_mobile_list: mentions?.map((m) => m.mobile),
        },
      };
    },
    markdown(content) {
      return {
        msgtype: WxwMessageType.MARKDOWN,
        markdown: { content },
      };
    },
    image(base64, md5) {
      return {
        msgtype: WxwMessageType.IMAGE,
        image: { base64, md5 },
      };
    },
    news(articles) {
      return {
        msgtype: WxwMessageType.NEWS,
        news: { articles },
      };
    },
    file(media_id) {
      return {
        msgtype: WxwMessageType.FILE,
        file: { media_id },
      };
    },
    templateCard(card) {
      return {
        msgtype: WxwMessageType.TEMPLATE_CARD,
        template_card: card,
      };
    },
  };
}

// 使用示例和类型守卫
export const WXWMessageHelper = {
  /**
   * 连通性测试消息
   */
  _createTestMessage() {
    const content = `### 这是一条测试消息
  `;
    return wxwMessageBuilder().markdown(content);
  },

  /**
   * 创建简单的通知消息
   */
  createNotification(
    title: string,
    content: string,
    // mentions?: WxwMentionUser[],
  ) {
    const message = `### ${title}\n\n${content}`;
    return wxwMessageBuilder().markdown(message);
  },

  /**
   * 创建系统告警消息
   */
  createAlertMessage(
    level: 'INFO' | 'WARN' | 'ERROR',
    system: string,
    message: string,
    timestamp?: Date,
  ): WxwMarkdownMessage {
    const time = timestamp
      ? timestamp.toLocaleString('zh-CN')
      : new Date().toLocaleString('zh-CN');
    const emoji = level === 'ERROR' ? '🚨' : level === 'WARN' ? '⚠️' : 'ℹ️';

    const content = `${emoji} **系统告警**

**级别**: ${level}
**系统**: ${system}
**时间**: ${time}
**消息**: ${message}`;

    return wxwMessageBuilder().markdown(content);
  },
} as const;
