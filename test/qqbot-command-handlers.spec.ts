import { QqbotCommandHandlersService } from '../src/apps/push/services/callbacks/qqbot-command-handlers.service';
import { QqbotCommandRouterService } from '../src/apps/push/services/callbacks/qqbot-command-router.service';

describe('QqbotCommandHandlersService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  function createContext(commandText: string, userId = 'user-id') {
    return {
      commandText,
      userId,
      args: [],
    } as any;
  }

  it('uses minutely weather check by default', async () => {
    const router = new QqbotCommandRouterService();
    const weatherService = {
      testMinutelyCheck: jest.fn().mockResolvedValue({ shouldAlert: false }),
      testDailyCheck: jest.fn(),
    };
    new QqbotCommandHandlersService(
      router,
      { getSystemInfo: jest.fn() } as any,
      { wakeUpComputer: jest.fn(), queryGameDailyCheck: jest.fn() } as any,
      weatherService as any,
    );

    await expect(router.route(createContext('/weather'))).resolves.toBe(
      '未来一小时暂无降雨预报',
    );
    expect(weatherService.testMinutelyCheck).toHaveBeenCalled();
    expect(weatherService.testDailyCheck).not.toHaveBeenCalled();
  });

  it('supports daily weather checks and rejects unknown modes', async () => {
    const router = new QqbotCommandRouterService();
    const weatherService = {
      testMinutelyCheck: jest.fn(),
      testDailyCheck: jest.fn().mockResolvedValue({ shouldAlert: false }),
    };
    new QqbotCommandHandlersService(
      router,
      { getSystemInfo: jest.fn() } as any,
      { wakeUpComputer: jest.fn(), queryGameDailyCheck: jest.fn() } as any,
      weatherService as any,
    );

    await expect(
      router.route({ ...createContext('/weather daily'), args: ['daily'] }),
    ).resolves.toBe('今天暂无明显降雨预报');
    await expect(
      router.route({ ...createContext('/weather hourly'), args: ['hourly'] }),
    ).resolves.toBe('用法：/weather [minutely|daily]');
    expect(weatherService.testDailyCheck).toHaveBeenCalled();
  });

  it('requires the caller to be in the wake white list', async () => {
    process.env = {
      ...originalEnv,
      QQBOT_COMMAND_WHITE_LIST: 'allowed, another',
    };
    const router = new QqbotCommandRouterService();
    const gameDailyService = {
      wakeUpComputer: jest.fn().mockResolvedValue({ wakeupSuccessful: true }),
      queryGameDailyCheck: jest.fn(),
    };
    new QqbotCommandHandlersService(
      router,
      { getSystemInfo: jest.fn() } as any,
      gameDailyService as any,
      { testMinutelyCheck: jest.fn(), testDailyCheck: jest.fn() } as any,
    );

    await expect(router.route(createContext('/wake', 'denied'))).resolves.toBe(
      '你没有权限执行此命令',
    );
    await expect(router.route(createContext('/wake', 'allowed'))).resolves.toBe(
      '已发送电脑唤醒信号',
    );
    expect(gameDailyService.wakeUpComputer).toHaveBeenCalledTimes(1);
  });

  it('supports game-daily aliases and formats queried details', async () => {
    const router = new QqbotCommandRouterService();
    const gameDailyService = {
      wakeUpComputer: jest.fn(),
      queryGameDailyCheck: jest.fn().mockResolvedValue({
        gameName: 'Genshin',
        status: 'finished',
        detail: [{ 完成时间: '04:10' }, { 剩余树脂: '120' }],
      }),
    };
    new QqbotCommandHandlersService(
      router,
      { getSystemInfo: jest.fn() } as any,
      gameDailyService as any,
      { testMinutelyCheck: jest.fn(), testDailyCheck: jest.fn() } as any,
    );

    await expect(
      router.route({ ...createContext('/gd genshin'), args: ['genshin'] }),
    ).resolves.toBe('Genshin每日任务：已完成\n完成时间：04:10\n剩余树脂：120');
    expect(gameDailyService.queryGameDailyCheck).toHaveBeenCalledWith(
      'Genshin',
    );
  });

  it('returns a permission error when the wake white list is empty', async () => {
    process.env = { ...originalEnv, QQBOT_COMMAND_WHITE_LIST: '' };
    const router = new QqbotCommandRouterService();
    const gameDailyService = {
      wakeUpComputer: jest.fn(),
      queryGameDailyCheck: jest.fn(),
    };
    new QqbotCommandHandlersService(
      router,
      { getSystemInfo: jest.fn() } as any,
      gameDailyService as any,
      { testMinutelyCheck: jest.fn(), testDailyCheck: jest.fn() } as any,
    );

    await expect(router.route(createContext('/wake', 'user-id'))).resolves.toBe(
      '你没有权限执行此命令',
    );
    expect(gameDailyService.wakeUpComputer).not.toHaveBeenCalled();
  });
});
