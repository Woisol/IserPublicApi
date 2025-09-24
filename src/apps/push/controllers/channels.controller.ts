import { Controller, Get } from '@nestjs/common';
import { PushService } from '@app/apps/push/services';

@Controller('push/channels')
export class ChannelsController {
  constructor(private readonly pushService: PushService) {}

  /**
   * 获取所有可用渠道
   */
  @Get()
  getAvailableChannels() {
    const channels = this.pushService.getAvailableChannels();

    return {
      channels,
      count: channels.length,
      timestamp: new Date().toISOString(),
    };
  }
}
