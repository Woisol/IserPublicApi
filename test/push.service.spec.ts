jest.mock(
  '@app/common/utils/logger',
  () => ({
    CompactLogger: class CompactLogger {
      error = jest.fn();
    },
  }),
  { virtual: true },
);

import { PushService } from '../src/apps/push/services/push.service';
import type { WxworkAdapter } from '../src/apps/push/services/adapters';

describe('PushService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, WEBHOOK_SEND_ADAPTER: 'wxwork' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('routes a game daily message to the wxwork adapter channel', async () => {
    const adapter = {
      getAvailableChannels: jest.fn(),
      sendGameDaily: jest.fn(),
      sendWeather: jest.fn(),
      sendRepo: jest.fn(),
      sendMcServer: jest.fn(),
      sendDevice: jest.fn(),
    } as unknown as WxworkAdapter;
    const service = new PushService(adapter);
    const details = {
      title: '每日任务已完成',
      content: [{ 完成时间: '04:10' }],
    };

    await service.sendMessage('game-daily', { wxwork: 'genshin' }, details);

    expect(adapter.sendGameDaily).toHaveBeenCalledWith('genshin', details);
  });

  it('skips sending when the active adapter has no target channel', async () => {
    const adapter = {
      getAvailableChannels: jest.fn(),
      sendGameDaily: jest.fn(),
      sendWeather: jest.fn(),
      sendRepo: jest.fn(),
      sendMcServer: jest.fn(),
      sendDevice: jest.fn(),
    } as unknown as WxworkAdapter;
    const service = new PushService(adapter);

    await expect(
      service.sendMessage('weather', undefined, { message: '即将下雨' }),
    ).resolves.toBeUndefined();
    expect(adapter.sendWeather).not.toHaveBeenCalled();
  });
});
