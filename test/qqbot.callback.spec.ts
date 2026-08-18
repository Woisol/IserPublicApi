import { QqbotCallbackService } from '../src/apps/push/services/callbacks/qqbot-callback.service';

describe('QqbotCallbackService', () => {
  it('routes full group messages using the group target', async () => {
    const commandRouter = {
      route: jest.fn().mockResolvedValue('收到命令'),
    };
    const deduplicator = {
      isDuplicate: jest.fn().mockReturnValue(false),
    };
    const messageService = {
      sendText: jest.fn().mockResolvedValue(undefined),
    };
    const service = new QqbotCallbackService(
      deduplicator as any,
      commandRouter as any,
      messageService as any,
    );

    await service.handleEvent({
      op: 0,
      id: 'event-id',
      t: 'GROUP_MESSAGE_CREATE',
      d: {
        id: 'message-id',
        group_openid: 'group-openid',
        content: '/status',
        author: { member_openid: 'user-openid' },
        message_scene: { ext: ['msg_idx=message-index'] },
      },
    });

    expect(commandRouter.route).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'group',
        target: { type: 'group', id: 'group-openid' },
        commandText: '/status',
      }),
    );
    expect(messageService.sendText).toHaveBeenCalledWith(
      { type: 'group', id: 'group-openid' },
      '收到命令',
      { messageId: 'message-id', eventId: 'event-id', msgSeq: 1 },
    );
  });

  it('passes the author identity to command handlers', async () => {
    const commandRouter = { route: jest.fn().mockResolvedValue(undefined) };
    const deduplicator = { isDuplicate: jest.fn().mockReturnValue(false) };
    const messageService = { sendText: jest.fn() };
    const service = new QqbotCallbackService(
      deduplicator as any,
      commandRouter as any,
      messageService as any,
    );

    await service.handleEvent({
      op: 0,
      id: 'event-id',
      t: 'C2C_MESSAGE_CREATE',
      d: {
        id: 'message-id',
        content: '/wake',
        author: { user_openid: 'user-openid' },
      },
    });

    expect(commandRouter.route).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'user', userId: 'user-openid' }),
    );
  });
});
