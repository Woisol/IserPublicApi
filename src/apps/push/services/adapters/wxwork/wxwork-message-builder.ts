import type {
  WxwMarkdownInfo,
  WxwMessageBuilder,
} from '@app/apps/push/types/wxwork-webhook';
import { WxwMessageType } from '@app/apps/push/types/wxwork-webhook.runtime';

export function wxworkMessageBuilder(): WxwMessageBuilder {
  return {
    text(content, mentions) {
      return {
        msgtype: WxwMessageType.TEXT,
        text: {
          content,
          mentioned_list: mentions?.map((mention) => mention.userid),
          mentioned_mobile_list: mentions?.map((mention) => mention.mobile),
        },
      };
    },
    markdown(content) {
      return {
        msgtype: WxwMessageType.MARKDOWN,
        markdown: { content },
      };
    },
    markdownInfo(info: WxwMarkdownInfo) {
      let content = `${info.type ? '「' + info.type + '」' : ''}${info.title}`;
      info.content.forEach((value) => {
        if (typeof value === 'string') {
          content += `\n${value}`;
          return;
        }
        const subtitle = Object.keys(value)[0];
        const detail = Object.values(value)[0] ?? '';
        if (typeof detail === 'object') {
          content += `\n\n**${subtitle}**`;
          Object.entries(detail).forEach(([key, entry]) => {
            content += `\n> <font color="comment">${key}：</font>${entry}`;
          });
        } else {
          content += `\n> <font color="comment">${subtitle}：</font>${detail}`;
        }
      });
      return this.markdown(content);
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
    file(mediaId) {
      return {
        msgtype: WxwMessageType.FILE,
        file: { media_id: mediaId },
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
