import { BadRequestException } from '@nestjs/common';
import { DshController } from '../src/apps/push/controllers/agent/dsh.controller';

describe('DshController', () => {
  const createController = () => {
    const agentService = {
      processPush: jest.fn().mockResolvedValue(undefined),
    };
    return { controller: new DshController(agentService as any), agentService };
  };

  it.each(['done', 'ask', 'question', 'error'] as const)(
    'passes %s as an independent agent message',
    async (kind) => {
      const { controller, agentService } = createController();
      const message = '任务内容\n\n保留正文格式';

      await expect(
        controller.processPush({ kind, message }),
      ).resolves.toBeUndefined();
      expect(agentService.processPush).toHaveBeenCalledWith({ kind, message });
    },
  );

  it.each([
    null,
    [],
    'not-an-object',
    { message: '正文' },
    { kind: 'unknown', message: '正文' },
    { kind: 'done' },
    { kind: 'done', message: '' },
    { kind: 'done', message: 123 },
  ])('rejects invalid payload %j', async (body) => {
    const { controller, agentService } = createController();

    expect(() => controller.processPush(body)).toThrow(BadRequestException);
    expect(agentService.processPush).not.toHaveBeenCalled();
  });
});
