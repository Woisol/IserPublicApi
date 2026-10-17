import { Injectable } from '@nestjs/common';
import { PushService } from '../../push.service';
import type { AgentPushDetails } from '../../../types/push-message';

@Injectable()
export class PushApplicationsAgentService {
  constructor(private readonly pushService: PushService) {}

  async processPush(details: AgentPushDetails) {
    await this.pushService.sendMessage('agent', 'agent', details);
    return details;
  }
}
