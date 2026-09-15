import { Injectable } from '@nestjs/common';
import { PushService } from '../../push.service';
import type { ComfyUiPushDetails } from '@app/apps/push/types/push-message';

@Injectable()
export class PushApplicationsComfyUiService {
  constructor(private readonly pushService: PushService) {}

  async processPush(details: ComfyUiPushDetails) {
    await this.pushService.sendMessage('comfyui', 'general', details);
    return details;
  }
}
