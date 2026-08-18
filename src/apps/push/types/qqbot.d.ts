export interface QqbotPayload<T = unknown> {
  id?: string;
  op: number;
  s?: number;
  t?: string;
  d: T;
}

export interface QqbotValidationData {
  plain_token: string;
  event_ts: string;
}

export interface QqbotUser {
  id?: string;
  user_openid?: string;
  member_openid?: string;
  username?: string;
  bot?: boolean;
}

export interface QqbotMessageScene {
  ext?: string[];
}

export interface QqbotMessageEvent {
  id: string;
  content: string;
  timestamp?: string;
  author: QqbotUser;
  message_scene?: QqbotMessageScene;
}

export interface QqbotGroupMessageEvent extends QqbotMessageEvent {
  group_openid: string;
}

export interface QqbotC2cMessageEvent extends QqbotMessageEvent {
  author: QqbotUser & { user_openid: string };
}

export interface QqbotCommandContext {
  source: 'group' | 'user';
  target: {
    type: 'group' | 'user';
    id: string;
  };
  userId: string;
  messageId: string;
  eventId?: string;
  commandText: string;
  args: string[];
  msgSeq: number;
  rawEvent: QqbotMessageEvent;
}

export interface QqbotCommandHandler {
  readonly command: string;
  readonly aliases?: string[];
  readonly description?: string;
  readonly usage?: string;
  handle(context: QqbotCommandContext): string | Promise<string>;
}
