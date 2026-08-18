import { QqbotAdapter } from '../src/apps/push/services/adapters/qqbot/qqbot.adapter';

describe('QqbotAdapter', () => {
  const messageService = {
    sendMarkdown: jest.fn().mockResolvedValue(undefined),
  };
  const botKeyLoader = {
    getBotKey: jest.fn(() => 'group-openid'),
  };
  const markdownHelper = {
    buildGameDailyMarkdown: jest.fn(() => '# game'),
    buildWeatherMarkdown: jest.fn(() => '# weather'),
    buildRepoMarkdown: jest.fn(() => '# repo'),
    buildMcServerMarkdown: jest.fn(() => '# mcserver'),
    buildDeviceMarkdown: jest.fn(() => '# device'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_SEND_ADAPTER = 'wxwork';
  });

  it('sends every business message through QQ Markdown', async () => {
    const adapter = new QqbotAdapter(
      messageService as any,
      botKeyLoader as any,
      markdownHelper as any,
    );
    const channel = { type: 'group' as const, id: 'group-openid' };

    await adapter.sendGameDaily('general', { wakeupSuccessful: false });
    await adapter.sendWeather('weather', {
      kind: 'daily-rain',
      periods: [],
    });
    await adapter.sendRepo('repo', {
      event: 'member' as any,
      payload: {},
      receivedAt: new Date(),
    });
    await adapter.sendMcServer('mcserver', { event: 'server_started' });
    await adapter.sendDevice('monitor', {
      cpuUsage: 90,
      cpuSeverity: 'warning',
      memoryUsage: 30,
      memorySeverity: 'normal',
      checkedAt: new Date(),
      platform: 'test',
      cpuModel: 'test cpu',
      cpuCount: 4,
      uptimeSeconds: 60,
      highCpuApplications: [],
      highCpuApplicationThreshold: 80,
    });

    expect(messageService.sendMarkdown).toHaveBeenNthCalledWith(
      1,
      channel,
      '# game',
    );
    expect(messageService.sendMarkdown).toHaveBeenCalledTimes(5);
    expect(markdownHelper.buildGameDailyMarkdown).toHaveBeenCalled();
    expect(markdownHelper.buildWeatherMarkdown).toHaveBeenCalled();
    expect(markdownHelper.buildRepoMarkdown).toHaveBeenCalled();
    expect(markdownHelper.buildMcServerMarkdown).toHaveBeenCalled();
    expect(markdownHelper.buildDeviceMarkdown).toHaveBeenCalled();
  });
});
