import { Injectable } from '@nestjs/common';
import type {
  QqbotC2cMessageEvent,
  QqbotGroupMessageEvent,
  QqbotPayload,
  QqbotValidationData,
} from '@app/apps/push/types/qqbot';
import { QqbotEventDeduplicatorService } from './qqbot-event-deduplicator.service';
import { QqbotCommandRouterService } from './qqbot-command-router.service';
import { QqbotMessageService } from '../adapters/qqbot/qqbot-message.service';

@Injectable()
export class QqbotCallbackService {
  constructor(
    private readonly deduplicator: QqbotEventDeduplicatorService,
    private readonly commandRouter: QqbotCommandRouterService,
    private readonly messageService: QqbotMessageService,
  ) {}

  createValidationResponse(payload: QqbotPayload<QqbotValidationData>) {
    return {
      plain_token: payload.d.plain_token,
      event_ts: payload.d.event_ts,
    };
  }

  async handleEvent(payload: QqbotPayload<unknown>): Promise<void> {
    if (payload.op !== 0) return;
    if (
      payload.t !== 'GROUP_MESSAGE_CREATE' &&
      payload.t !== 'GROUP_AT_MESSAGE_CREATE' &&
      payload.t !== 'C2C_MESSAGE_CREATE'
    )
      return;
    const event = payload.d as QqbotGroupMessageEvent | QqbotC2cMessageEvent;
    const eventKey =
      event.message_scene?.ext?.find((item) => item.startsWith('msg_idx=')) ||
      event.id;
    if (this.deduplicator.isDuplicate(eventKey)) return;

    const isGroup =
      payload.t === 'GROUP_MESSAGE_CREATE' ||
      payload.t === 'GROUP_AT_MESSAGE_CREATE';
    const context = {
      source: isGroup ? ('group' as const) : ('user' as const),
      target: isGroup
        ? {
            type: 'group' as const,
            id: (event as QqbotGroupMessageEvent).group_openid,
          }
        : {
            type: 'user' as const,
            id: (event as QqbotC2cMessageEvent).author.user_openid,
          },
      userId:
        event.author.member_openid ||
        event.author.user_openid ||
        event.author.id ||
        '',
      messageId: event.id,
      eventId: payload.id,
      commandText: event.content,
      args: [],
      msgSeq: 1,
      rawEvent: event,
    };
    const reply = await this.commandRouter.route(context);
    if (reply) {
      await this.messageService.sendText(context.target, reply, {
        messageId: context.messageId,
        eventId: context.eventId,
        msgSeq: context.msgSeq,
      });
    }
  }
}
