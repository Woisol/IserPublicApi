/**
 * 企业微信消息推送（Webhook）接口类型定义
 * 基于企业微信官方文档: https://developer.work.weixin.qq.com/document/path/99110
 */

import { WxwMessageType } from './wxw-webhook.runtime';

// 基础消息结构
export interface WxwBaseMessage {
  msgtype: WxwMessageType;
}

// 文本消息
export interface WxwTextMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.TEXT;
  text: {
    content: string;
    mentioned_list?: string[]; // @指定成员userid列表
    mentioned_mobile_list?: string[]; // @指定成员手机号列表
  };
}

// Markdown消息
export interface WxwMarkdownMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.MARKDOWN;
  markdown: {
    content: string;
  };
}

// 图片消息
export interface WxwImageMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.IMAGE;
  image: {
    base64: string; // 图片base64编码
    md5: string; // 图片md5值
  };
}

// 图文消息文章项
export interface WxwNewsArticle {
  title: string; // 标题
  description?: string; // 描述
  url: string; // 跳转链接
  picurl?: string; // 图片链接
}

// 图文消息
export interface WxwNewsMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.NEWS;
  news: {
    articles: WxwNewsArticle[];
  };
}

// 文件消息
export interface WxwFileMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.FILE;
  file: {
    media_id: string; // 文件media_id
  };
}

// 卡片按钮
export interface WxwCardButton {
  type: number; // 按钮类型
  text: string; // 按钮文案
  style?: number; // 按钮样式
  key?: string; // 按钮key值
  url?: string; // 跳转链接
}

// 卡片动作
export interface WxwCardAction {
  type: number; // 动作类型
  url?: string; // 跳转链接
  appid?: string; // 小程序appid
  pagepath?: string; // 小程序页面路径
}

// 文本通知模板卡片
export interface WxwTextNoticeCard {
  card_type: WxwTemplateCardType.TEXT_NOTICE;
  source: {
    icon_url?: string;
    desc?: string;
    desc_color?: number;
  };
  main_title: {
    title?: string;
    desc?: string;
  };
  emphasis_content?: {
    title?: string;
    desc?: string;
  };
  quote_area?: {
    type?: number;
    url?: string;
    appid?: string;
    pagepath?: string;
    title?: string;
    quote_text?: string;
  };
  sub_title_text?: string;
  horizontal_content_list?: Array<{
    keyname: string;
    value?: string;
    type?: number;
    url?: string;
    media_id?: string;
    userid?: string;
  }>;
  jump_list?: Array<{
    type: number;
    url?: string;
    title?: string;
    appid?: string;
    pagepath?: string;
  }>;
  card_action?: WxwCardAction;
}

// 图文展示模板卡片
export interface WxwNewsNoticeCard {
  card_type: WxwTemplateCardType.NEWS_NOTICE;
  source: {
    icon_url?: string;
    desc?: string;
    desc_color?: number;
  };
  main_title: {
    title?: string;
    desc?: string;
  };
  card_image: {
    url: string;
    aspect_ratio?: number;
  };
  image_text_area?: {
    type?: number;
    url?: string;
    title?: string;
    desc?: string;
    image_url?: string;
  };
  quote_area?: {
    type?: number;
    url?: string;
    appid?: string;
    pagepath?: string;
    title?: string;
    quote_text?: string;
  };
  vertical_content_list?: Array<{
    title: string;
    desc?: string;
  }>;
  horizontal_content_list?: Array<{
    keyname: string;
    value?: string;
    type?: number;
    url?: string;
    media_id?: string;
    userid?: string;
  }>;
  jump_list?: Array<{
    type: number;
    url?: string;
    title?: string;
    appid?: string;
    pagepath?: string;
  }>;
  card_action?: WxwCardAction;
}

// 按钮交互模板卡片
export interface WxwButtonInteractionCard {
  card_type: WxwTemplateCardType.BUTTON_INTERACTION;
  source: {
    icon_url?: string;
    desc?: string;
    desc_color?: number;
  };
  main_title: {
    title?: string;
    desc?: string;
  };
  sub_title_text?: string;
  horizontal_content_list?: Array<{
    keyname: string;
    value?: string;
    type?: number;
    url?: string;
    media_id?: string;
    userid?: string;
  }>;
  card_action?: WxwCardAction;
  button_selection?: {
    question_key: string;
    title?: string;
    option_list: Array<{
      id: string;
      text: string;
    }>;
    selected_id?: string;
  };
  button_list?: WxwCardButton[];
}

// 投票选择模板卡片
export interface WxwVoteInteractionCard {
  card_type: WxwTemplateCardType.VOTE_INTERACTION;
  source: {
    icon_url?: string;
    desc?: string;
    desc_color?: number;
  };
  main_title: {
    title?: string;
    desc?: string;
  };
  checkbox?: {
    question_key: string;
    option_list: Array<{
      id: string;
      text: string;
      is_checked: boolean;
    }>;
    mode?: number;
  };
  submit_button?: {
    text: string;
    key: string;
  };
}

// 多项选择模板卡片
export interface WxwMultipleInteractionCard {
  card_type: WxwTemplateCardType.MULTIPLE_INTERACTION;
  source: {
    icon_url?: string;
    desc?: string;
    desc_color?: number;
  };
  main_title: {
    title?: string;
    desc?: string;
  };
  select_list?: Array<{
    question_key: string;
    title?: string;
    selected_id?: string;
    option_list: Array<{
      id: string;
      text: string;
    }>;
  }>;
  submit_button?: {
    text: string;
    key: string;
  };
}

// 模板卡片消息联合类型
export type WxwTemplateCard =
  | WxwTextNoticeCard
  | WxwNewsNoticeCard
  | WxwButtonInteractionCard
  | WxwVoteInteractionCard
  | WxwMultipleInteractionCard;

// 模板卡片消息
export interface WxwTemplateCardMessage extends WxwBaseMessage {
  msgtype: WxwMessageType.TEMPLATE_CARD;
  template_card: WxwTemplateCard;
}

// 所有消息类型的联合类型
export type WxwMessage =
  | WxwTextMessage
  | WxwMarkdownMessage
  | WxwImageMessage
  | WxwNewsMessage
  | WxwFileMessage
  | WxwTemplateCardMessage;

// Webhook 请求体
export interface WxwWebhookRequest {
  key?: string; // webhook机器人的key（可选，用于身份验证）
  [(K in WxwMessageType) as WxwMessage['msgtype']]: WxwMessage extends {
    msgtype: K;
  }
    ? WxwMessage
    : never;
}

// Webhook 响应
export interface WxwWebhookResponse {
  errcode: number;
  errmsg: string;
}

// 常用工具类型
export interface WxwMentionUser {
  userid?: string;
  mobile?: string;
}

// 快速构建消息的工具函数类型
export type WxwMessageBuilder = {
  text: (content: string, mentions?: WxwMentionUser[]) => WxwTextMessage;
  markdown: (content: string) => WxwMarkdownMessage;
  image: (base64: string, md5: string) => WxwImageMessage;
  news: (articles: WxwNewsArticle[]) => WxwNewsMessage;
  file: (mediaId: string) => WxwFileMessage;
  templateCard: (card: WxwTemplateCard) => WxwTemplateCardMessage;
};

// 导出默认类型
export default WxwMessage;
