import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PushApplicationsAgentService } from '../../services/applications/agent/agent.service';
import type { AgentPushKind } from '../../types/push-message';

const DSH_NOTIFICATION_KINDS: readonly AgentPushKind[] = [
  'done',
  'ask',
  'question',
  'error',
  'test',
];

@Controller('push/agent/dsh')
export class DshController {
  constructor(private readonly agentService: PushApplicationsAgentService) {}

  @Post()
  processPush(@Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    const payload = body as Record<string, unknown>;
    if (
      typeof payload.kind !== 'string' ||
      !DSH_NOTIFICATION_KINDS.includes(payload.kind as AgentPushKind)
    ) {
      throw new BadRequestException(
        'kind must be one of: done, ask, question, error',
      );
    }
    if (typeof payload.message !== 'string' || !payload.message.trim()) {
      throw new BadRequestException('message is required');
    }

    return this.agentService.processPush({
      kind: payload.kind as AgentPushKind,
      message: payload.message,
    });
  }
}
