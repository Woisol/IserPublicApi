import { Injectable } from '@nestjs/common';
import type {
  QqbotCommandContext,
  QqbotCommandHandler,
} from '@app/apps/push/types/qqbot';

@Injectable()
export class QqbotCommandRouterService {
  private readonly handlers = new Map<string, QqbotCommandHandler>();

  constructor() {
    this.register({
      command: 'help',
      description: '显示可用命令',
      usage: '/help',
      handle: () =>
        [
          '可用命令：',
          ...this.getHandlers()
            .filter(({ command }) => command !== 'help')
            .map(
              ({ command, aliases, description, usage }) =>
                `/${command}${aliases?.length ? `（/${aliases.join('、/')}）` : ''}：${description || usage || '无说明'}`,
            ),
          '/help：显示可用命令',
        ].join('\n'),
    });
  }

  register(handler: QqbotCommandHandler): void {
    for (const name of [handler.command, ...(handler.aliases || [])]) {
      const command = name.toLowerCase();
      if (this.handlers.has(command)) {
        throw new Error(`QQ command already registered: ${command}`);
      }
      this.handlers.set(command, handler);
    }
  }

  private getHandlers(): QqbotCommandHandler[] {
    return [...new Set(this.handlers.values())];
  }

  async route(context: QqbotCommandContext): Promise<string | undefined> {
    const prefix = process.env.QQBOT_COMMAND_PREFIX || '/';
    const text = context.commandText.trim();
    if (!text.startsWith(prefix)) return undefined;
    const tokens = text
      .slice(prefix.length)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const command = tokens.shift()?.toLowerCase();
    if (!command) return this.handlers.get('help')?.handle(context);
    const handler = this.handlers.get(command);
    if (!handler) return `未知命令：${command}`;
    try {
      return await handler.handle({ ...context, args: tokens });
    } catch {
      return '命令执行失败，请稍后重试';
    }
  }
}
