import { QqbotMessageService } from '../src/apps/push/services/adapters/qqbot/qqbot-message.service';

describe('QqbotMessageService', () => {
  it('sends a group reply with msg_id but without event_id', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'reply-id' }),
    });
    const authService = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    };
    const service = new QqbotMessageService(authService as any);

    await service.sendText(
      { type: 'group', id: 'group-openid' },
      '收到',
      { messageId: 'message-id', eventId: 'event-id', msgSeq: 1 },
    );

    const request = (global.fetch as jest.Mock).mock.calls[0];
    expect(request[0]).toBe(
      'https://api.bot.qq.com/v2/groups/group-openid/messages',
    );
    expect(JSON.parse(request[1].body)).toEqual({
      msg_type: 0,
      content: '收到',
      msg_id: 'message-id',
      msg_seq: 1,
    });
  });

  it('reports the official err_code and trace_id', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        err_code: 40034005,
        message: '消息被去重',
        trace_id: 'trace-id',
      }),
    });
    const service = new QqbotMessageService({
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    } as any);

    await expect(
      service.sendText({ type: 'group', id: 'group-openid' }, '收到'),
    ).rejects.toThrow(
      'QQ Bot message HTTP error: 400, err_code: 40034005, message: 消息被去重, trace_id: trace-id',
    );
  });
});
