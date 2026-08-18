jest.mock(
  '@app/common/utils/logger',
  () => ({
    CompactLogger: class CompactLogger {
      log = jest.fn();
      warn = jest.fn();
      error = jest.fn();
      info = jest.fn();
    },
  }),
  { virtual: true },
);

import { PushApplicationsGameDailyService } from '../src/apps/push/services/applications/game-daily/game-daily.service';

describe('PushApplicationsGameDailyService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GAMELOG_BASEURL: 'https://logs.example.test',
      GAMELOG_GENSHINLOGSURL: '/genshin',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '今日奖励已领取\n原粹树脂：120',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('keeps query side-effect free and preserves the notification facade', async () => {
    const pushService = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    const service = new PushApplicationsGameDailyService(pushService as any);

    const queried = await service.queryGameDailyCheck('Genshin');
    expect(queried.status).toBe('finished');
    expect(pushService.sendMessage).not.toHaveBeenCalled();

    await service.processGameDailyCheck('Genshin');
    expect(pushService.sendMessage).toHaveBeenCalledWith(
      'game-daily',
      'genshin',
      expect.objectContaining({ gameName: 'Genshin', status: 'finished' }),
    );
  });
});
