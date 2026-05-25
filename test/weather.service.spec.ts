jest.mock('../src/apps/push/services', () => ({
  PushService: class PushService {},
}));

jest.mock(
  '@app/common/utils/logger',
  () => ({
    CompactLogger: class CompactLogger {
      log = jest.fn();
      warn = jest.fn();
      error = jest.fn();
      info = jest.fn();
      debug = jest.fn();
    },
  }),
  { virtual: true },
);

import { WeatherService } from '../src/apps/push/services/applications/weather.service';

describe('WeatherService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-31T10:00:00+08:00'));
    process.env = {
      ...originalEnv,
      QWEATHER_API_KEY: 'test-api-key',
      QWEATHER_LOCATION: '116.41,39.92',
      QWEATHER_API_HOST: 'devapi.qweather.com',
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('alerts for short but intense rain and includes peak time in the message', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '200',
        updateTime: '2026-03-31T10:00:00+08:00',
        fxLink: 'https://example.com',
        summary: 'Short rain expected in the next 2 hours',
        minutely: [
          {
            fxTime: '2026-03-31T10:25:00+08:00',
            precip: '0.80',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:30:00+08:00',
            precip: '1.50',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:35:00+08:00',
            precip: '0',
            type: 'rain',
          },
        ],
        refer: {
          sources: ['QWeather'],
          license: ['test-license'],
        },
      }),
    });

    const service = new WeatherService({
      sendTextMessage: jest.fn(),
    } as any);

    const result = await (
      service as unknown as {
        checkMinutelyRainForecast: () => Promise<{
          shouldAlert: boolean;
          message?: string;
        }>;
      }
    ).checkMinutelyRainForecast();

    expect(result.shouldAlert).toBe(true);
    expect(result.message).toContain('25min');
    expect(result.message).toContain('0.80mm|1.50mm');
    expect(result.message).toContain('10:30');
    expect(result.message).not.toContain('概率');
  });
});
