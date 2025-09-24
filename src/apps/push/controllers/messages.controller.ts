import {
  Controller,
  Get,
  Req,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { type Request } from 'express';
import { PushService } from '@app/apps/push/services';

@Controller('push')
export class MessagesController {
  constructor(private readonly pushService: PushService) { }

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
}