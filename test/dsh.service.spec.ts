import { PushApplicationsAgentService } from '../src/apps/push/services/applications/agent/agent.service';

describe('PushApplicationsAgentService', () => {
  it('sends the independent agent type to the agent channel', async () => {
    const pushService = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    const service = new PushApplicationsAgentService(pushService as any);
    const details = { kind: 'done' as const, message: '任务已完成' };

    await expect(service.processPush(details)).resolves.toEqual(details);
    expect(pushService.sendMessage).toHaveBeenCalledWith(
      'agent',
      'agent',
      details,
    );
  });
});
