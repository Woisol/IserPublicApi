import { Controller, Get, Req } from '@nestjs/common';
import { type Request } from 'express';
import { PushService } from '@app/apps/push/services';

@Controller('push')
export class PushApplicationsController {
  constructor(private readonly pushService: PushService) { }

  // @section-应用消息通道
  /**
   * Github Repo 通知
   */
  @Get('repo')
  async sendCICDNotification(@Req() req: Request) {
    const channel = 'repo';
    const content = ``;
  }
}