import { GeneralController } from '../src/apps/push/controllers/general.controller';

describe('GeneralController', () => {
  it('parses GET details as JSON when possible and uses the fixed channel', async () => {
    const pushService = { sendMessage: jest.fn() };
    const controller = new GeneralController(pushService as any);

    await controller.sendByQuery({
      title: '状态',
      pic: 'server/running.png',
      details: '{"状态":"运行中"}',
    });

    expect(pushService.sendMessage).toHaveBeenCalledWith('general', 'general', {
      title: '状态',
      pic: 'server/running.png',
      details: { 状态: '运行中' },
    });
  });

  it('keeps non-JSON GET details as plain text', async () => {
    const pushService = { sendMessage: jest.fn() };
    const controller = new GeneralController(pushService as any);

    await controller.sendByQuery({ title: '状态', details: '运行中' });

    expect(pushService.sendMessage).toHaveBeenCalledWith('general', 'general', {
      title: '状态',
      details: '运行中',
    });
  });

  it('passes POST body through to the fixed channel', async () => {
    const pushService = { sendMessage: jest.fn() };
    const controller = new GeneralController(pushService as any);
    const body = { title: '状态', details: { 状态: '运行中' } };

    await controller.sendByBody(body);

    expect(pushService.sendMessage).toHaveBeenCalledWith(
      'general',
      'general',
      body,
    );
  });
});
