import { Controller, Get, Req } from '@nestjs/common';
import { PushService } from 'src/services/push';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {
    this.pushService = pushService;
  }
  /**
   * 发送文本消息
   */
  @Get('msg')
  async sendTextMessage(@Req() req) {
    await this.pushService.sendTextMessage(req.query.content);
  }
  /**
   * 测试连通性
   */
  @Get('msg/test')
  async testConnection() {
    await this.pushService.sendTestMessage();
  }
}
