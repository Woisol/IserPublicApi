jest.mock(
  '@app/common/utils/logger',
  () => ({
    CompactLogger: class CompactLogger {
      log = jest.fn();
      error = jest.fn();
    },
  }),
  { virtual: true },
);

import { WxworkAdapter } from '../src/apps/push/services/adapters/wxwork/wxwork.adapter';

describe('WxworkAdapter', () => {
  const botKeyLoader = {
    getAvailableChannels: jest.fn(),
    getWebhookUrl: jest.fn(() => 'https://example.test/webhook'),
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: 'ok' }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a wakeup failure from its dedicated details branch', async () => {
    const adapter = new WxworkAdapter(botKeyLoader as any);

    await adapter.sendGameDaily('general', { wakeupSuccessful: false });

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      msgtype: 'markdown',
      markdown: { content: expect.stringContaining('电脑唤醒失败') },
    });
  });

  it('renders weather facts inside the wxwork adapter', async () => {
    const adapter = new WxworkAdapter(botKeyLoader as any);

    await adapter.sendWeather('weather', {
      kind: 'minutely-rain',
      startsAt: new Date(Date.now() + 25 * 60 * 1000),
      precipitationTimeline: [0.8, 1.5],
      peakPrecipitation: 1.5,
      peakAt: new Date('2026-03-31T10:30:00+08:00'),
    });

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      msgtype: 'text',
      text: {
        content: expect.stringContaining('0.80mm|1.50mm'),
      },
    });
  });
});
