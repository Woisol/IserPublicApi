import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class CompactLogger extends ConsoleLogger {
  // ANSI 颜色代码
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  constructor(context?: string) {
    super(context, {
      json: false,
    });
  }

  /**
   * 格式化日期为 yyyy-MM-dd 格式
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 为文本添加颜色
   * 类“LoggerService”错误扩展基类“ConsoleLogger”。
  属性“colorize”在类型“LoggerService”中是私有属性，但在类型“ConsoleLogger”中不是。
   */
  colorize(text: string, color: string): string {
    return `${color}${text}${this.colors.reset}`;
  }

  /**
   * 格式化日志消息
   * 格式：Level[context](yyyy-MM-dd)：message
   */
  protected formatMessage(
    level: string,
    message: string,
    context?: string,
    levelColor?: string,
  ): string {
    const date = this.formatDate(new Date());
    const contextStr = context || this.context || 'Application';

    // 如果指定了颜色，为 level 添加颜色
    const coloredLevel = levelColor ? this.colorize(level, levelColor) : level;

    return `${coloredLevel}[${this.colorize(contextStr, this.colors.cyan)}](${this.colorize(date, this.colors.gray)})：${message}`;
  }

  info(message: string, context?: string) {
    const formattedMessage = this.formatMessage(
      'INFO',
      message,
      context,
      this.colors.green,
    );
    console.log(formattedMessage);
  }

  error(message: string, trace?: string, context?: string) {
    const formattedMessage = this.formatMessage(
      'ERRO',
      message,
      context,
      this.colors.red,
    );
    console.error(formattedMessage);
    if (trace) {
      console.error(trace);
    }
  }

  warn(message: string, context?: string) {
    const formattedMessage = this.formatMessage(
      'WARN',
      message,
      context,
      this.colors.yellow,
    );
    console.warn(formattedMessage);
  }

  debug(message: string, context?: string) {
    const formattedMessage = this.formatMessage(
      'DEBUG',
      message,
      context,
      this.colors.blue,
    );
    console.debug(formattedMessage);
  }

  verbose(message: string, context?: string) {
    const formattedMessage = this.formatMessage(
      'VERBOSE',
      message,
      context,
      this.colors.magenta,
    );
    console.log(formattedMessage);
  }
}
