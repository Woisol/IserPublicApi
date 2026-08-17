import { Injectable } from '@nestjs/common';
import { QqbotAuthService } from './qqbot-auth.service';
import type { QqbotChannel } from '@app/apps/push/types/push-message';

interface QqbotReplyContext {
  messageId?: string;
  eventId?: string;
  msgSeq?: number;
}

@Injectable()
export class QqbotMessageService {
  constructor(private readonly authService: QqbotAuthService) {}

  async sendText(
    channel: QqbotChannel,
    content: string,
    context?: QqbotReplyContext,
  ): Promise<void> {
    await this.send(channel, { msg_type: 0, content }, context);
  }

  async sendMarkdown(
    channel: QqbotChannel,
    content: string,
    context?: QqbotReplyContext,
  ): Promise<void> {
    await this.send(
      channel,
      {
        msg_type: 2,
        markdown: { content },
      },
      context,
    );
  }

  private async send(
    channel: QqbotChannel,
    body: Record<string, unknown>,
    context?: QqbotReplyContext,
  ): Promise<void> {
    const target =
      typeof channel === 'string'
        ? { type: 'group' as const, id: channel }
        : channel;
    const endpoint = {
      group: `/v2/groups/${target.id}/messages`,
      user: `/v2/users/${target.id}/messages`,
      'guild-channel': `/channels/${target.id}/messages`,
    }[target.type];
    const requestBody = { ...body };

    // QQ 要求 msg_id 与 event_id 二选一；消息事件优先使用 msg_id。
    if (context?.messageId) {
      requestBody.msg_id = context.messageId;
    } else if (context?.eventId) {
      requestBody.event_id = context.eventId;
    }
    if (context?.msgSeq) requestBody.msg_seq = context.msgSeq;

    const accessToken = await this.authService.getAccessToken();
    const response = await fetch(`https://api.bot.qq.com${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `QQBot ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });
    const result = (await response.json()) as {
      err_code?: number;
      code?: number;
      message?: string;
      trace_id?: string;
    };
    const errorCode = result.err_code ?? result.code ?? 0;
    if (!response.ok) {
      throw new Error(
        `QQ Bot message HTTP error: ${response.status}` +
          (errorCode ? `, err_code: ${errorCode}` : '') +
          (result.message ? `, message: ${result.message}` : '') +
          (result.trace_id ? `, trace_id: ${result.trace_id}` : ''),
      );
    }
    if (errorCode !== 0) {
      throw new Error(
        `QQ Bot message error: ${result.message || errorCode}` +
          (result.trace_id ? ` (trace_id: ${result.trace_id})` : ''),
      );
    }
  }
}
