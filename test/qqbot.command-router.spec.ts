import { QqbotCommandRouterService } from '../src/apps/push/services/callbacks/qqbot-command-router.service';

describe('QqbotCommandRouterService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, QQBOT_COMMAND_PREFIX: '/' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('routes commands with arguments and aliases', async () => {
    const router = new QqbotCommandRouterService();
    const handler = {
      command: 'status',
      aliases: ['s'],
      handle: jest.fn(({ args }: { args: string[] }) => args.join('|')),
    };
    router.register(handler);

    await expect(
      router.route({ commandText: '/s today now' } as any),
    ).resolves.toBe('today|now');
    expect(handler.handle).toHaveBeenCalled();
  });

  it('ignores non-command messages and responds to unknown commands', async () => {
    const router = new QqbotCommandRouterService();

    await expect(
      router.route({ commandText: 'hello' } as any),
    ).resolves.toBeUndefined();
    await expect(
      router.route({ commandText: '/unknown' } as any),
    ).resolves.toBe('未知命令：unknown');
  });

  it('lists registered command descriptions in help', async () => {
    const router = new QqbotCommandRouterService();
    router.register({
      command: 'status',
      aliases: ['s'],
      description: '查看设备状态',
      usage: '/status',
      handle: () => 'ok',
    });

    await expect(router.route({ commandText: '/help' } as any)).resolves.toBe(
      '可用命令：\n/status（/s）：查看设备状态\n/help：显示可用命令',
    );
  });

  it('lists commands without aliases in help', async () => {
    const router = new QqbotCommandRouterService();
    router.register({
      command: 'wake',
      description: '唤醒电脑',
      handle: () => 'ok',
    });

    await expect(router.route({ commandText: '/help' } as any)).resolves.toBe(
      '可用命令：\n/wake：唤醒电脑\n/help：显示可用命令',
    );
  });
});
