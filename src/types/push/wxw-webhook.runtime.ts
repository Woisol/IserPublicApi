// 基础消息类型枚举
export enum WxwMessageType {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  IMAGE = 'image',
  NEWS = 'news',
  FILE = 'file',
  TEMPLATE_CARD = 'template_card',
}

// 模板卡片消息类型枚举
export enum WxwTemplateCardType {
  TEXT_NOTICE = 'text_notice',
  NEWS_NOTICE = 'news_notice',
  BUTTON_INTERACTION = 'button_interaction',
  VOTE_INTERACTION = 'vote_interaction',
  MULTIPLE_INTERACTION = 'multiple_interaction',
}

// 错误码枚举
export enum WxwErrorCode {
  SUCCESS = 0,
  INVALID_WEBHOOK = 93000,
  INVALID_MSGTYPE = 93001,
  INVALID_TEXT = 93002,
  INVALID_MARKDOWN = 93003,
  INVALID_IMAGE = 93004,
  INVALID_NEWS = 93005,
  INVALID_FILE = 93006,
  UPLOAD_MEDIA_FAILED = 93007,
  INVALID_TEMPLATE_CARD = 93008,
  TOO_FREQUENT = 45009,
}

