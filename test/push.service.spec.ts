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
import type { PushAdapter } from '../src/apps/push/types/push-adapter';

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
      name: 'wxwork',
    } as unknown as PushAdapter;
    const service = new PushService([adapter]);
    const details = {
      gameName: 'Genshin',
      status: 'finished' as const,
      detail: [{ 完成时间: '04:10' }],
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
      name: 'wxwork',
    } as unknown as PushAdapter;
    const service = new PushService([adapter]);

    await expect(
      service.sendMessage('weather', undefined, {
        kind: 'minutely-rain',
        startsAt: new Date(),
        precipitationTimeline: [1],
        peakPrecipitation: 1,
        peakAt: new Date(),
      }),
    ).resolves.toBeUndefined();
    expect(adapter.sendWeather).not.toHaveBeenCalled();
  });

  it('uses the configured adapter name to select its channel', async () => {
    process.env.WEBHOOK_SEND_ADAPTER = 'qqbot';
    const adapter = {
      getAvailableChannels: jest.fn(),
      sendGameDaily: jest.fn(),
      sendWeather: jest.fn(),
      sendRepo: jest.fn(),
      sendMcServer: jest.fn(),
      sendDevice: jest.fn(),
      name: 'qqbot',
    } as unknown as PushAdapter;
    const service = new PushService([adapter]);
    const details = {
      kind: 'daily-rain' as const,
      periods: [],
    };

    await service.sendMessage('weather', { qqbot: 'weather-group' }, details);

    expect(adapter.sendWeather).toHaveBeenCalledWith('weather-group', details);
  });

  it('throws when WEBHOOK_SEND_ADAPTER is missing', () => {
    delete process.env.WEBHOOK_SEND_ADAPTER;

    expect(() => new PushService([])).toThrow(
      'WEBHOOK_SEND_ADAPTER is required',
    );
  });

  it('throws when WEBHOOK_SEND_ADAPTER has no registered implementation', () => {
    process.env.WEBHOOK_SEND_ADAPTER = 'qqbot';

    expect(() => new PushService([])).toThrow(
      "Webhook send adapter 'qqbot' is not registered",
    );
  });
});
