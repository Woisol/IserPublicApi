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
});
