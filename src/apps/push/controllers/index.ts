import {
  Controller,
  Get,
  Req,
  Param,
  HttpException,
  HttpStatus,
  Redirect,
} from '@nestjs/common';
import { type Request } from 'express';
import { PushService } from '@app/apps/push/services';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {
    this.pushService = pushService;
  }

  /**
   * 获取所有可用渠道
   */
  @Get('channels')
  getAvailableChannels() {
    const channels = this.pushService.getAvailableChannels();

    return {
      channels,
      count: channels.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 发送文本消息 - 重定向到默认渠道(保留query参数)
   */
  // ! 纯 @Redirect 会抛弃 query 参数
  @Get('msg')
  @Redirect()
  redirectToGeneralText(@Req() req: Request) {
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const redirectUrl = `/push/general/msg${queryString ? `?${queryString}` : ''}`;
    return { url: redirectUrl, statusCode: 302 };
  }

  /**
   * markdown 消息 - 重定向到默认渠道(保留query参数)
   */
  @Get('msg/md')
  @Redirect()
  redirectToGeneralMarkdown(@Req() req: Request) {
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const redirectUrl = `/push/general/md${queryString ? `?${queryString}` : ''}`;
    return { url: redirectUrl, statusCode: 302 };
  }

  /**
   * 根据渠道发送文本消息
   * @param channel 渠道名称
   */
  @Get(':channel/msg')
  async sendTextMessageToChannel(
    @Param('channel') channel: string,
    @Req() req: Request,
  ) {
    try {
      const content = req.query.content as string;
      if (!content) {
        throw new HttpException(
          'Content parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.pushService.sendTextMessage(content, channel);

      return {
        success: true,
        channel,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to send message to channel '${channel}': ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 根据渠道发送Markdown消息
   * @param channel 渠道名称
   */
  @Get(':channel/md')
  async sendMarkdownMessageToChannel(
    @Param('channel') channel: string,
    @Req() req: Request,
  ) {
    try {
      const content = req.query.content as string;
      if (!content) {
        throw new HttpException(
          'Content parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.pushService.sendMarkdownMessage(
        content,
        channel,
      );

      return {
        success: true,
        channel,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to send markdown message to channel '${channel}': ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // /**
  //  * 测试连通性
  //  */
  // @Get('msg/test')
  // async testConnection() {
  //   await this.pushService.sendTestMessage();
  // }
}
