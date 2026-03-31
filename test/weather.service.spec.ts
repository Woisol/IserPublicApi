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

  it('previews a rain-start alert with precip timeline and peak time', async () => {
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

    const result = await service.testMinutelyCheck();

    expect(result.shouldAlert).toBe(true);
    expect(result.message).toContain('25min');
    expect(result.message).toContain('0.80mm|1.50mm');
    expect(result.message).toContain('10:30');
    expect(result.message).not.toContain('概率');
  });

  it('keeps stop tracking off when daily planning only prepares automatic rain-start monitoring', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '200',
        updateTime: '2026-03-31T10:00:00+08:00',
        fxLink: 'https://example.com',
        hourly: [
          {
            fxTime: '2026-03-31T10:00:00+08:00',
            temp: '22',
            icon: '100',
            text: 'Sunny',
            wind360: '180',
            windDir: 'S',
            windScale: '2',
            windSpeed: '10',
            humidity: '60',
            precip: '0',
            pop: '0',
            pressure: '1012',
            cloud: '10',
            dew: '14',
          },
          {
            fxTime: '2026-03-31T11:00:00+08:00',
            temp: '21',
            icon: '305',
            text: 'Light rain',
            wind360: '200',
            windDir: 'S',
            windScale: '2',
            windSpeed: '12',
            humidity: '70',
            precip: '0.4',
            pop: '70',
            pressure: '1011',
            cloud: '60',
            dew: '15',
          },
          {
            fxTime: '2026-03-31T12:00:00+08:00',
            temp: '20',
            icon: '305',
            text: 'Light rain',
            wind360: '200',
            windDir: 'S',
            windScale: '2',
            windSpeed: '12',
            humidity: '72',
            precip: '0.2',
            pop: '60',
            pressure: '1010',
            cloud: '65',
            dew: '15',
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

    const result = await service.testDailyCheck();
    const status = service.getRuntimeStatus();

    expect(result.rainPeriods).toHaveLength(1);
    expect(status.startMode).toBe('watch');
    expect(status.stopMode).toBe('off');
  });

  it('arms stop tracking only after notifyNextNoRain is called manually', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '200',
        updateTime: '2026-03-31T10:00:00+08:00',
        fxLink: 'https://example.com',
        summary: 'Rain will stop soon',
        minutely: [
          {
            fxTime: '2026-03-31T10:00:00+08:00',
            precip: '0.60',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:05:00+08:00',
            precip: '0.30',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:10:00+08:00',
            precip: '0',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:15:00+08:00',
            precip: '0',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:20:00+08:00',
            precip: '0',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:25:00+08:00',
            precip: '0',
            type: 'rain',
          },
          {
            fxTime: '2026-03-31T10:30:00+08:00',
            precip: '0',
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

    expect(service.getRuntimeStatus().stopMode).toBe('off');

    const result = await service.notifyNextNoRain();
    const status = service.getRuntimeStatus();

    expect(result.armed).toBe(true);
    expect(result.stopMode).toBe('precise');
    expect(result.noRainDurationMinutes).toBe(30);
    expect(status.stopMode).toBe('precise');
  });

  it('sends a stop notification during heartbeat only after manual arming', async () => {
    const sendTextMessage = jest.fn();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: '200',
          updateTime: '2026-03-31T10:00:00+08:00',
          fxLink: 'https://example.com',
          hourly: [],
          refer: {
            sources: ['QWeather'],
            license: ['test-license'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: '200',
          updateTime: '2026-03-31T10:00:00+08:00',
          fxLink: 'https://example.com',
          summary: 'Rain will stop soon',
          minutely: [
            {
              fxTime: '2026-03-31T10:00:00+08:00',
              precip: '0.60',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:05:00+08:00',
              precip: '0.20',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:10:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:15:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:20:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:25:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:30:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:35:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:40:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:45:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:50:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:55:00+08:00',
              precip: '0',
              type: 'rain',
            },
          ],
          refer: {
            sources: ['QWeather'],
            license: ['test-license'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: '200',
          updateTime: '2026-03-31T10:10:00+08:00',
          fxLink: 'https://example.com',
          summary: 'No rain in the next 2 hours',
          minutely: [
            {
              fxTime: '2026-03-31T10:10:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:15:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:20:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:25:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:30:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:35:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:40:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:45:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:50:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T10:55:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:00:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:05:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:10:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:15:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:20:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:25:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:30:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:35:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:40:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:45:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:50:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T11:55:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T12:00:00+08:00',
              precip: '0',
              type: 'rain',
            },
            {
              fxTime: '2026-03-31T12:05:00+08:00',
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
      sendTextMessage,
    } as any);

    await service.testDailyCheck();
    await service.notifyNextNoRain();

    jest.setSystemTime(new Date('2026-03-31T10:10:00+08:00'));
    const result = await service.runEngineTick();

    expect(result.stop.sent).toBe(true);
    expect(sendTextMessage).toHaveBeenCalledWith(
      expect.stringContaining('未来至少 2h 无雨'),
      'weather',
    );
    expect(service.getRuntimeStatus().stopMode).toBe('off');
  });
});
